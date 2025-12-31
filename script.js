/**
 * Happy New Year 2026
 * Tushar Basak
 */

// Configuration
const CONFIG = {
    // Dynamic target:
    // Month is 0-indexed (0 = January)
    targetDate: new Date(2026, 0, 1, 0, 0, 0).getTime(),
    colors: ['#d4af37', '#ffffff', '#FF5733', '#33FF57', '#3357FF', '#FF33A1', '#00FFFF'],
    fireworksChance: 0.05, // Chance per frame to launch auto firework
};

// DOM Elements
const elements = {
    greeting: document.getElementById('greeting'),
    year: document.getElementById('year'),
    message: document.getElementById('message'),
    countdown: document.getElementById('countdown'),
    days: document.getElementById('days'),
    hours: document.getElementById('hours'),
    minutes: document.getElementById('minutes'),
    seconds: document.getElementById('seconds'),
    canvas: document.getElementById('canvas'),
    main: document.querySelector('main')
};

// --- Audio Engine (Procedural) ---
class AudioEngine {
    constructor() {
        this.ctx = null;
        this.enabled = false;
    }

    init() {
        if (!this.ctx) {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
            this.enabled = true;
        } else if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    playExplosion() {
        if (!this.enabled) return;
        
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const filter = this.ctx.createBiquadFilter();

        // Noise buffer for explosion sound
        const bufferSize = this.ctx.sampleRate * 2; // 2 seconds
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }

        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;

        // Lowpass filter to make it sound like a boom, not static
        filter.type = 'lowpass';
        filter.frequency.value = 800;

        // Envelope
        gain.gain.setValueAtTime(1, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 1);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.ctx.destination);

        noise.start();
        noise.stop(this.ctx.currentTime + 2);
    }

    playLaunch() {
        if (!this.enabled) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.frequency.setValueAtTime(200, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(800, this.ctx.currentTime + 0.5);

        gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.5);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start();
        osc.stop(this.ctx.currentTime + 0.5);
    }
}

const audio = new AudioEngine();

// --- Personalization Engine ---
function initPersonalization() {
    const urlParams = new URLSearchParams(window.location.search);
    const name = urlParams.get('name');

    if (name) {
        // Sanitize input
        const safeName = name.replace(/[<>]/g, '');
        elements.greeting.textContent = `Happy New Year, ${safeName}!`;
        document.title = `Happy New Year ${safeName}! | Tushar Basak`;
    }
}

// --- Visual Engine (Fireworks & Glitter) ---
const ctx = elements.canvas.getContext('2d');
let particles = []; // Explosion particles
let fireworks = [];
let ambientParticles = []; // Background glitter

function resizeCanvas() {
    elements.canvas.width = window.innerWidth;
    elements.canvas.height = window.innerHeight;
    initAmbientParticles(); // Re-init on resize to fill screen
}

class AmbientParticle {
    constructor() {
        this.reset();
    }

    reset() {
        this.x = Math.random() * elements.canvas.width;
        this.y = Math.random() * elements.canvas.height;
        this.vx = (Math.random() - 0.5) * 0.5;
        this.vy = (Math.random() - 0.5) * 0.5;
        this.size = Math.random() * 2 + 0.5;
        this.color = CONFIG.colors[Math.floor(Math.random() * CONFIG.colors.length)];
        this.opacity = Math.random() * 0.5 + 0.1;
        this.life = Math.random() * 100 + 100;
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.life--;

        // Wrap around
        if (this.x < 0) this.x = elements.canvas.width;
        if (this.x > elements.canvas.width) this.x = 0;
        if (this.y < 0) this.y = elements.canvas.height;
        if (this.y > elements.canvas.height) this.y = 0;

        if (this.life <= 0) this.reset();
    }

    draw(ctx) {
        ctx.save();
        ctx.globalAlpha = this.opacity;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

class Particle {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.color = color;
        // Random velocity in all directions
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 5 + 1;
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed;
        this.alpha = 1;
        this.decay = Math.random() * 0.015 + 0.005;
        this.gravity = 0.05;
    }

    update() {
        this.vx *= 0.95; // Air resistance
        this.vy *= 0.95;
        this.vy += this.gravity;
        this.x += this.vx;
        this.y += this.vy;
        this.alpha -= this.decay;
        return this.alpha > 0;
    }

    draw(ctx) {
        ctx.save();
        ctx.globalAlpha = this.alpha;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

class Firework {
    constructor(x, y, targetY) {
        this.x = x;
        this.y = y;
        this.targetY = targetY;
        this.color = CONFIG.colors[Math.floor(Math.random() * CONFIG.colors.length)];
        this.speed = 2;
        this.angle = -Math.PI / 2;
        this.vx = (Math.random() - 0.5) * 2; // Slight drift
        this.vy = -Math.random() * 3 - 8; // Shoot up
        this.exploded = false;
        
        audio.playLaunch();
    }

    update() {
        this.x += this.vx;
        this.vy += 0.1; // Gravity affects launch
        this.y += this.vy;

        if (this.vy >= 0 || this.y <= this.targetY) {
            this.explode();
            return false; // Remove firework, particles take over
        }
        return true;
    }

    draw(ctx) {
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, 3, 0, Math.PI * 2);
        ctx.fill();
    }

    explode() {
        audio.playExplosion();
        for (let i = 0; i < 50; i++) {
            particles.push(new Particle(this.x, this.y, this.color));
        }
    }
}

function initAmbientParticles() {
    ambientParticles = [];
    for(let i=0; i<100; i++) {
        ambientParticles.push(new AmbientParticle());
    }
}

function animate() {
    // Fade out trail effect
    ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.fillRect(0, 0, elements.canvas.width, elements.canvas.height);

    // Draw Ambient Particles (Glitter)
    ambientParticles.forEach(p => {
        p.update();
        p.draw(ctx);
    });

    // Update Fireworks
    fireworks = fireworks.filter(fw => {
        const alive = fw.update();
        if (alive) fw.draw(ctx);
        return alive;
    });

    // Update Explosion Particles
    particles = particles.filter(p => {
        const alive = p.update();
        if (alive) p.draw(ctx);
        return alive;
    });

    // Auto launch in New Year Mode
    if (isNewYear && Math.random() < CONFIG.fireworksChance) {
        launchFirework();
    }

    requestAnimationFrame(animate);
}

function launchFirework(x) {
    const startX = x || Math.random() * elements.canvas.width;
    const startY = elements.canvas.height;
    const targetY = Math.random() * (elements.canvas.height / 2);
    fireworks.push(new Firework(startX, startY, targetY));
}

// --- Time Engine ---
let isNewYear = false;

function updateTimer() {
    const now = new Date().getTime();
    const distance = CONFIG.targetDate - now;

    if (distance < 0) {
        if (!isNewYear) {
            // TRANSITION TO NEW YEAR
            isNewYear = true;
            elements.countdown.style.display = 'none';
            elements.year.classList.remove('hidden');
            elements.main.classList.add('celebration-mode');
        }
        return;
    }

    // Standard Countdown
    isNewYear = false;
    elements.countdown.style.display = 'flex'; // Ensure visible
    elements.countdown.classList.remove('hidden');
    elements.year.classList.add('hidden');

    const days = Math.floor(distance / (1000 * 60 * 60 * 24));
    const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((distance % (1000 * 60)) / 1000);

    elements.days.textContent =  String(days).padStart(2, '0');
    elements.hours.textContent = String(hours).padStart(2, '0');
    elements.minutes.textContent = String(minutes).padStart(2, '0');
    elements.seconds.textContent = String(seconds).padStart(2, '0');
}

// --- Interaction ---
window.onclick = () => {
    audio.init(); // Enable audio on first click
    if (isNewYear) launchFirework(); // Click to explode
};

// --- Initialization ---
window.addEventListener('resize', resizeCanvas);
initPersonalization();
initAmbientParticles(); // Initialize glitter
resizeCanvas();
animate();
setInterval(updateTimer, 1000);
updateTimer();
