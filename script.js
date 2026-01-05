/**
 * Happy New Year 2027
 * Tushar Basak
 */

// Configuration
const CONFIG = {
    // Dynamic target:
    // Month is 0-indexed (0 = January)
    targetDate: new Date(2027, 0, 1, 0, 0, 0).getTime(),
    colors: [
        'oklch(85% 0.18 85)',   // Gold
        'oklch(100% 0 0)',      // White
        'oklch(65% 0.22 30)',   // Red/Orange
        'oklch(70% 0.19 145)',  // Green
        'oklch(60% 0.2 250)',   // Blue
        'oklch(75% 0.2 330)',   // Pink
        'oklch(80% 0.15 200)',  // Cyan
        'oklch(85% 0.2 130)',   // Lime
        'oklch(65% 0.22 290)',  // Purple
        'oklch(60% 0.25 310)'   // Magenta
    ],
    fireworksChance: 0.02, // Chance per frame to launch auto firework
};

// Crypto Random Helper
const random = () => {
    const u32 = new Uint32Array(1);
    window.crypto.getRandomValues(u32);
    return u32[0] / 0xFFFFFFFF;
};

// Override default Math.random for consistency if needed, 
// but sticking to a dedicated function is safer to avoid side effects.
// We have replaced usage of Math.random() with random() below.

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
    canvasFg: document.getElementById('canvas-fg'),
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
            data[i] = random() * 2 - 1;
        }

        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;

        // Lowpass filter to make it sound like a boom, not static
        filter.type = 'lowpass';
        filter.frequency.value = 600; // Lower frequency for softer boom

        // Envelope
        gain.gain.setValueAtTime(0.5, this.ctx.currentTime); // Reduced volume
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
const ctxFg = elements.canvasFg.getContext('2d');
let particles = []; // Explosion particles
let fireworks = [];
let ambientParticles = []; // Background glitter

function resizeCanvas() {
    elements.canvas.width = window.innerWidth;
    elements.canvas.height = window.innerHeight;
    elements.canvasFg.width = window.innerWidth;
    elements.canvasFg.height = window.innerHeight;
    initAmbientParticles(); // Re-init on resize to fill screen
}

class AmbientParticle {
    constructor() {
        this.reset();
    }

    reset() {
        this.x = random() * elements.canvas.width;
        this.y = random() * elements.canvas.height;
        this.vx = (random() - 0.5) * 0.5;
        this.vy = (random() - 0.5) * 0.5;
        this.size = random() * 2 + 0.5;
        this.color = CONFIG.colors[Math.floor(random() * CONFIG.colors.length)];
        this.opacity = random() * 0.5 + 0.1;
        this.life = random() * 100 + 100;
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
    constructor(x, y, color, scale = 1, isForeground = false) {
        this.x = x;
        this.y = y;
        this.color = color;
        this.isForeground = isForeground;
        // Random velocity in all directions
        const angle = random() * Math.PI * 2;
        // Base speed 1-6, scaled by explosion size
        const speed = (random() * 5 + 1) * scale;
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed;
        this.alpha = 1;
        this.decay = (random() * 0.015 + 0.005) / scale; // Larger blasts fade slower
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
    constructor(x, y, targetY, isForeground = false) {
        this.x = x;
        this.y = y;
        this.targetY = targetY;
        this.color = CONFIG.colors[Math.floor(random() * CONFIG.colors.length)];
        this.isForeground = isForeground;
        this.speed = 2;
        this.angle = -Math.PI / 2;
        this.vx = (random() - 0.5) * 2; // Slight drift
        this.vy = -random() * 3 - 8; // Shoot up
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
        // Random scale factor (0.5x to 1.5x)
        const scale = random() + 0.5;
        const count = Math.floor(50 * scale);
        
        for (let i = 0; i < count; i++) {
            particles.push(new Particle(this.x, this.y, this.color, scale, this.isForeground));
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
    // Fade out trail effect (using OKLCH black with alpha)
    ctx.fillStyle = 'oklch(0% 0 0 / 0.2)';
    ctx.fillRect(0, 0, elements.canvas.width, elements.canvas.height);

    // Fade FG
    ctxFg.save();
    ctxFg.globalCompositeOperation = 'destination-out';
    ctxFg.fillStyle = 'oklch(0% 0 0 / 0.2)';
    ctxFg.fillRect(0, 0, elements.canvas.width, elements.canvas.height);
    ctxFg.restore();

    // Draw Ambient Particles (Glitter)
    ambientParticles.forEach(p => {
        p.update();
        p.draw(ctx);
    });

    // Update Fireworks
    fireworks = fireworks.filter(fw => {
        const alive = fw.update();
        if (alive) fw.draw(fw.isForeground ? ctxFg : ctx);
        return alive;
    });

    // Update Explosion Particles
    particles = particles.filter(p => {
        const alive = p.update();
        if (alive) p.draw(p.isForeground ? ctxFg : ctx);
        return alive;
    });

    // Auto launch in New Year Mode
    if (isNewYear && random() < CONFIG.fireworksChance) {
        launchFirework();
    }

    requestAnimationFrame(animate);
}

function launchFirework(x) {
    const startX = x || random() * elements.canvas.width;
    const startY = elements.canvas.height;
    const targetY = random() * (elements.canvas.height / 2);
    // 90% chance for foreground
    const isForeground = random() < 0.5;
    fireworks.push(new Firework(startX, startY, targetY, isForeground));
}

// --- Time Engine ---
let isNewYear = false;

function updateTimer() {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth(); // 0 = Jan
    const currentDate = now.getDate();

    // Check if we are in the "Celebration Window" (Jan 1 to Jan 5)
    // Note: Month is 0-indexed.
    if (currentMonth === 0 && currentDate >= 1 && currentDate <= 5) {
        if (!isNewYear) {
            isNewYear = true;
            elements.countdown.style.display = 'none';
            elements.year.classList.remove('hidden');
            elements.year.textContent = currentYear; // Ensure current celebration year is shown
            elements.main.classList.add('celebration-mode');
            
            // Update greeting if needed
            if (!elements.greeting.textContent.includes('Happy New Year')) {
                 elements.greeting.textContent = 'Happy New Year';
            }
            // Update Title
            document.title = `Happy New Year ${currentYear} | Tushar Basak`;
        }
        return; // Exit, no countdown needed
    }

    // Determine target date (Next January 1st)
    // If today is after Jan 5th, target is next year.
    // Use Math.max to ensure we don't go backwards if system time is weird, 
    // but typically: if not in Jan 1-5, we want next Jan 1.
    // Example: Jan 6, 2025 -> Target: Jan 1, 2026.
    // Example: Dec 31, 2025 -> Target: Jan 1, 2026.
    
    let targetYear = currentYear + 1;
    // If for some reason we are in December, target is next year (already covered by +1)
    
    const targetDate = new Date(targetYear, 0, 1, 0, 0, 0).getTime();
    const distance = targetDate - now.getTime();

    // Standard Countdown Mode
    if (isNewYear) {
        // Reset from celebration mode if date changes while open
        isNewYear = false;
        elements.year.classList.add('hidden');
        elements.main.classList.remove('celebration-mode');
    }
    
    // Update Title for countdown
    if (document.title.indexOf(String(targetYear)) === -1) {
         document.title = `Happy New Year ${targetYear} | Tushar Basak`;
    }

    elements.countdown.style.display = 'flex';
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
// Mouse state for glitter interaction
const mouse = { x: -1000, y: -1000 };
window.addEventListener('mousemove', (e) => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
});
// Touch support for interaction
window.addEventListener('touchstart', (e) => {
    mouse.x = e.touches[0].clientX;
    mouse.y = e.touches[0].clientY;
    
    // Auto launch firework on touch if in New Year mode
    if (isNewYear) {
        launchFirework(mouse.x);
    }
    
    audio.init(); // Init audio on touch
});
window.addEventListener('touchmove', (e) => {
    mouse.x = e.touches[0].clientX;
    mouse.y = e.touches[0].clientY;
});
window.addEventListener('touchend', () => {
    mouse.x = -1000;
    mouse.y = -1000;
});


// Ambient Particle Update with Mouse Interaction
AmbientParticle.prototype.update = function() {
    this.x += this.vx;
    this.y += this.vy;
    this.life--;

    // Mouse Interaction
    const dx = this.x - mouse.x;
    const dy = this.y - mouse.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const repulsionRadius = 150;

    if (distance < repulsionRadius) {
        const force = (repulsionRadius - distance) / repulsionRadius;
        const angle = Math.atan2(dy, dx);
        const push = force * 2; // Strength
        
        this.x += Math.cos(angle) * push;
        this.y += Math.sin(angle) * push;
    }

    // Wrap around
    if (this.x < 0) this.x = elements.canvas.width;
    if (this.x > elements.canvas.width) this.x = 0;
    if (this.y < 0) this.y = elements.canvas.height;
    if (this.y > elements.canvas.height) this.y = 0;

    if (this.life <= 0) this.reset();
};


// Sound Toggle Logic (Audio Visualizer)
const audioControl = document.getElementById('audio-control');
let isPlaying = true; // Default: Playing (Unmuted)

// Update UI
function updateSoundUI() {
    if (isPlaying) {
        audioControl.classList.add('playing');
        audioControl.setAttribute('aria-label', 'Mute Audio');
        audio.init();
        audio.enabled = true;
    } else {
        audioControl.classList.remove('playing');
        audioControl.setAttribute('aria-label', 'Play Audio');
        audio.enabled = false;
        if(audio.ctx) audio.ctx.suspend();
    }
}

audioControl.addEventListener('click', (e) => {
    e.stopPropagation(); // Don't trigger fireworks
    isPlaying = !isPlaying;
    updateSoundUI();
});




// Update global click handler to NOT handle audio init blindly, let specific interactions do it.
window.onclick = (e) => {
    // If clicking on controls, ignore.
    if (e.target.closest('.audio-control') || e.target.closest('button')) return;
    
    // If playing but context is suspended (browser policy), resume on first click
    if (isPlaying && audio.ctx && audio.ctx.state === 'suspended') {
        audio.ctx.resume();
    }
    
    if (isNewYear) launchFirework(e.clientX);
};


// Reduced Motion Preference
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

// --- Initialization ---
window.addEventListener('resize', resizeCanvas);
initPersonalization();
initAmbientParticles(); // Initialize glitter
resizeCanvas();

// Initialize sound UI
updateSoundUI();

function animateLoop() {
    requestAnimationFrame(animateLoop);
    animate();
}
animateLoop();

setInterval(updateTimer, 1000);
updateTimer();

// Modify launchFirework to respect reduced motion
// Overwrite the launch logic slightly to check preference
const originalLaunch = launchFirework;
launchFirework = function(x) {
    if (prefersReducedMotion.matches && isNewYear) {
         // In reduced motion, maybe just fewer particles or no launch, just static gentle fade?
         // For now, let's limit the frequency drastically or stop auto-launch.
         // But manual clicks might still want feedback?
         // Let's allow manual clicks but disable auto-launch in standard loop.
    }
    originalLaunch(x);
};

// Modify animate loop for auto-fireworks respecting reduced motion
const originalAnimate = animate;
animate = function() {
    // Fade out trail effect
    ctx.fillStyle = 'oklch(0% 0 0 / 0.2)';
    ctx.fillRect(0, 0, elements.canvas.width, elements.canvas.height);

    ctxFg.save();
    ctxFg.globalCompositeOperation = 'destination-out';
    ctxFg.fillStyle = 'oklch(0% 0 0 / 0.2)';
    ctxFg.fillRect(0, 0, elements.canvas.width, elements.canvas.height);
    ctxFg.restore();

    // Glitter
    ambientParticles.forEach(p => {
        p.update();
        p.draw(ctx);
    });

    // Fireworks
    fireworks = fireworks.filter(fw => {
        const alive = fw.update();
        if (alive) fw.draw(fw.isForeground ? ctxFg : ctx);
        return alive;
    });

    particles = particles.filter(p => {
        const alive = p.update();
        if (alive) p.draw(p.isForeground ? ctxFg : ctx);
        return alive;
    });

    // Auto Launch - Disable if Reduced Motion
    if (isNewYear && !prefersReducedMotion.matches && random() < CONFIG.fireworksChance) {
        launchFirework();
    }
}

