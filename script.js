let display = document.getElementById('display');
let currentInput = '0';
let shouldResetDisplay = false;

function updateDisplay() {
    display.value = currentInput;
}

function appendToDisplay(value) {
    if (shouldResetDisplay) {
        currentInput = '0';
        shouldResetDisplay = false;
    }
    
    if (currentInput === '0' && value !== '.') {
        currentInput = value;
    } else {
        // Replace * with × for display, but keep * for calculation
        if (value === '*') {
            currentInput += '×';
        } else {
            currentInput += value;
        }
    }
    updateDisplay();
}

function clearDisplay() {
    currentInput = '0';
    updateDisplay();
}

function deleteLast() {
    if (currentInput.length > 1) {
        currentInput = currentInput.slice(0, -1);
    } else {
        currentInput = '0';
    }
    updateDisplay();
}

function calculate() {
    try {
        // Replace × with * for calculation, and handle division
        let expression = currentInput.replace(/×/g, '*');
        
        // Validate expression
        if (!/^[0-9+\-*/. ]+$/.test(expression)) {
            throw new Error('Invalid expression');
        }
        
        // Use Function constructor for safe evaluation
        let result = Function('"use strict"; return (' + expression + ')')();
        
        // Handle division by zero
        if (!isFinite(result)) {
            throw new Error('Division by zero');
        }
        
        // Format result
        if (result % 1 !== 0) {
            result = parseFloat(result.toFixed(10));
        } else {
            result = parseInt(result);
        }
        
        currentInput = result.toString();
        shouldResetDisplay = true;
        updateDisplay();
    } catch (error) {
        currentInput = 'Error';
        updateDisplay();
        setTimeout(() => {
            clearDisplay();
        }, 2000);
    }
}

// Keyboard support
document.addEventListener('keydown', (e) => {
    const key = e.key;
    
    if (key >= '0' && key <= '9' || key === '.') {
        appendToDisplay(key);
    } else if (key === '+' || key === '-' || key === '/') {
        appendToDisplay(key);
    } else if (key === '*') {
        appendToDisplay('*');
    } else if (key === 'Enter' || key === '=') {
        e.preventDefault();
        calculate();
    } else if (key === 'Escape' || key === 'c' || key === 'C') {
        clearDisplay();
    } else if (key === 'Backspace') {
        e.preventDefault();
        deleteLast();
    }
});

// Initialize display
updateDisplay();

// ==================== AUDI A3 SIMULATOR ====================

let simulatorState = {
    speed: 0,          // mph
    rpm: 0,            // rpm (0-7000)
    turbo: 0,          // psi (0-20)
    distance: 0,       // miles
    maxSpeed: 0,       // mph
    stress: 0,         // 0-100%
    isAccelerating: false,
    engineHealth: 100, // 0-100%
    isEngineDead: false,
    isCrashed: false,
    animationFrame: null
};

// ==================== AUDIO SYSTEM ====================
let audioContext = null;
let engineOscillator = null;
let turboOscillator = null;
let engineGain = null;
let turboGain = null;
let masterGain = null;
let radioOscillator = null;
let radioGain = null;
let radioOn = false;
let currentStationIndex = 0;
let radioScheduler = null;
let radioNodes = [];

// Radio stations with frequencies and names
const radioStations = [
    { freq: 88.5, name: "Synthwave FM", color: "#00d4ff" },
    { freq: 90.1, name: "Lo-Fi Garage", color: "#00ff88" },
    { freq: 92.3, name: "Hard Bass", color: "#ff00ff" },
    { freq: 96.7, name: "Jazz Late Night", color: "#ffd700" },
    { freq: 101.1, name: "Metal-ish Riff", color: "#ff6b6b" },
    { freq: 104.4, name: "Talk + Static", color: "#b0b0b0" },
    { freq: 105.9, name: "Off", color: "#666" }
];

// Initialize audio context
function initAudioContext() {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        masterGain = audioContext.createGain();
        masterGain.connect(audioContext.destination);
        masterGain.gain.value = 0.3; // Master volume
    }
}

// Create engine sound
function createEngineSound() {
    if (!audioContext) initAudioContext();
    
    if (engineOscillator) {
        engineOscillator.stop();
    }
    
    engineOscillator = audioContext.createOscillator();
    engineGain = audioContext.createGain();
    
    engineOscillator.type = 'sawtooth';
    engineOscillator.frequency.value = 50;
    
    engineGain.gain.value = 0;
    
    engineOscillator.connect(engineGain);
    engineGain.connect(masterGain);
    
    engineOscillator.start();
}

// Create turbo sound
function createTurboSound() {
    if (!audioContext) initAudioContext();
    
    if (turboOscillator) {
        turboOscillator.stop();
    }
    
    turboOscillator = audioContext.createOscillator();
    turboGain = audioContext.createGain();
    
    turboOscillator.type = 'sine';
    turboOscillator.frequency.value = 200;
    
    turboGain.gain.value = 0;
    
    turboOscillator.connect(turboGain);
    turboGain.connect(masterGain);
    
    turboOscillator.start();
}

// Update engine sound based on RPM
function updateEngineSound() {
    if (!engineGain || !engineOscillator || simulatorState.isEngineDead) {
        if (engineGain) engineGain.gain.value = 0;
        return;
    }
    
    // Map RPM to frequency (50Hz to 400Hz)
    const baseFreq = 50 + (simulatorState.rpm / MAX_RPM) * 350;
    engineOscillator.frequency.value = baseFreq;
    
    // Map RPM to volume (0 to 0.4)
    const volume = Math.min(0.4, (simulatorState.rpm / MAX_RPM) * 0.4);
    engineGain.gain.value = volume;
}

// Update turbo sound
function updateTurboSound() {
    if (!turboGain || !turboOscillator || simulatorState.turbo < 5) {
        if (turboGain) turboGain.gain.value = 0;
        return;
    }
    
    // Turbo whistle sound
    const turboFreq = 200 + (simulatorState.turbo / MAX_TURBO) * 300;
    turboOscillator.frequency.value = turboFreq;
    
    // Turbo volume based on PSI
    const turboVolume = (simulatorState.turbo / MAX_TURBO) * 0.2;
    turboGain.gain.value = turboVolume;
}

// Radio functions
function toggleRadio() {
    // Initialize audio on first interaction
    if (!audioContext) {
        initAudioContext();
    }
    
    radioOn = !radioOn;
    const powerBtn = document.getElementById('radioPower');
    
    if (radioOn) {
        powerBtn.classList.add('active');
        playRadioStation();
    } else {
        powerBtn.classList.remove('active');
        stopRadio();
    }
}

function changeRadioStation(direction) {
    currentStationIndex += direction;
    if (currentStationIndex < 0) currentStationIndex = radioStations.length - 1;
    if (currentStationIndex >= radioStations.length) currentStationIndex = 0;
    
    updateRadioDisplay();
    if (radioOn) {
        playRadioStation();
    }
}

function updateRadioDisplay() {
    const station = radioStations[currentStationIndex];
    document.getElementById('radioFrequency').textContent = station.freq.toFixed(1);
    document.getElementById('radioStation').textContent = station.name;
    document.getElementById('radioStation').style.color = station.color;
}

function updateRadioVolume(value) {
    if (radioGain) {
        radioGain.gain.value = (value / 100) * 0.35;
    }
}

function playRadioStation() {
    if (!audioContext) initAudioContext();
    
    stopRadio();
    
    const station = radioStations[currentStationIndex];
    if (station.name === 'Off') return;

    // Procedural stations: small sequencer + optional noise/static
    radioGain = audioContext.createGain();
    const volume = document.getElementById('radioVolume')?.value ? (document.getElementById('radioVolume').value / 100) : 0.5;
    radioGain.gain.value = volume * 0.35;
    radioGain.connect(masterGain);
    radioNodes.push(radioGain);

    const bpmByStation = {
        "Synthwave FM": 104,
        "Lo-Fi Garage": 78,
        "Hard Bass": 138,
        "Jazz Late Night": 92,
        "Metal-ish Riff": 156,
        "Talk + Static": 60
    };
    const bpm = bpmByStation[station.name] ?? 100;
    const step = 60 / bpm / 2; // 8th note

    const mkVoice = (type) => {
        const o = audioContext.createOscillator();
        const g = audioContext.createGain();
        o.type = type;
        g.gain.value = 0.0001;
        o.connect(g);
        g.connect(radioGain);
        o.start();
        radioNodes.push(o, g);
        return { o, g };
    };

    const lead = mkVoice(station.name === "Jazz Late Night" ? "triangle" : "sawtooth");
    const bass = mkVoice("square");

    // Optional static layer
    let staticNode = null;
    if (station.name === "Talk + Static" || Math.random() < 0.15) {
        const noiseBuf = audioContext.createBuffer(1, Math.floor(audioContext.sampleRate * 2.0), audioContext.sampleRate);
        const data = noiseBuf.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * 0.25;
        const noise = audioContext.createBufferSource();
        noise.buffer = noiseBuf;
        noise.loop = true;
        const lp = audioContext.createBiquadFilter();
        lp.type = "lowpass";
        lp.frequency.value = station.name === "Talk + Static" ? 1800 : 900;
        const sg = audioContext.createGain();
        sg.gain.value = station.name === "Talk + Static" ? 0.18 : 0.06;
        noise.connect(lp);
        lp.connect(sg);
        sg.connect(radioGain);
        noise.start();
        staticNode = { noise, lp, sg };
        radioNodes.push(noise, lp, sg);
    }

    // Tiny drum (noise tick) for beat-driven stations
    const playTick = (time, level = 0.12) => {
        const dur = 0.03;
        const noiseBuf = audioContext.createBuffer(1, Math.floor(audioContext.sampleRate * dur), audioContext.sampleRate);
        const data = noiseBuf.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
        const src = audioContext.createBufferSource();
        src.buffer = noiseBuf;
        const hp = audioContext.createBiquadFilter();
        hp.type = "highpass";
        hp.frequency.value = 1800;
        const g = audioContext.createGain();
        g.gain.setValueAtTime(0.0001, time);
        g.gain.exponentialRampToValueAtTime(level, time + 0.005);
        g.gain.exponentialRampToValueAtTime(0.0001, time + dur);
        src.connect(hp);
        hp.connect(g);
        g.connect(radioGain);
        src.start(time);
        src.stop(time + dur);
        radioNodes.push(src, hp, g);
    };

    const scale = {
        // MIDI-ish offsets for feel; converted to frequency later
        minor: [0, 2, 3, 5, 7, 8, 10],
        dorian: [0, 2, 3, 5, 7, 9, 10],
        mixolydian: [0, 2, 4, 5, 7, 9, 10]
    };

    const noteToHz = (baseHz, semis) => baseHz * Math.pow(2, semis / 12);

    let stepIndex = 0;
    const startAt = audioContext.currentTime + 0.05;

    const patterns = {
        "Synthwave FM": { base: 110, mode: "minor", leadSeq: [0, 7, 10, 7, 12, 10, 7, 5], bassSeq: [0, 0, 7, 7, 5, 5, 3, 3], tick: true },
        "Lo-Fi Garage": { base: 98, mode: "dorian", leadSeq: [0, 3, 7, 10, 7, 3, 5, 3], bassSeq: [0, 0, 0, 0, 7, 7, 5, 5], tick: true },
        "Hard Bass": { base: 55, mode: "minor", leadSeq: [0, 0, 7, 0, 10, 0, 7, 0], bassSeq: [0, 0, 0, 0, 0, 7, 0, 10], tick: true },
        "Jazz Late Night": { base: 130, mode: "mixolydian", leadSeq: [0, 4, 7, 10, 9, 7, 4, 2], bassSeq: [0, 0, 7, 7, 5, 5, 2, 2], tick: false },
        "Metal-ish Riff": { base: 82, mode: "minor", leadSeq: [0, 0, 3, 2, 0, 5, 3, 2], bassSeq: [0, 0, 0, 0, -5, -5, -5, -5], tick: true },
        "Talk + Static": { base: 90, mode: "minor", leadSeq: [0, 0, 0, 0, 2, 0, 0, 0], bassSeq: [0, 0, 0, 0, 0, 0, 0, 0], tick: false }
    };

    const pat = patterns[station.name] ?? patterns["Synthwave FM"];
    const modeScale = scale[pat.mode] ?? scale.minor;

    const scheduleStep = (t, idx) => {
        // Choose semitone from scale-ish offsets (allow negative for riff)
        const leadSemi = pat.leadSeq[idx % pat.leadSeq.length];
        const bassSemi = pat.bassSeq[idx % pat.bassSeq.length];

        // Frequencies
        const leadHz = noteToHz(pat.base, leadSemi);
        const bassHz = noteToHz(pat.base / 2, bassSemi);

        // Envelopes
        const leadLevel = station.name === "Hard Bass" ? 0.12 : 0.18;
        const bassLevel = station.name === "Metal-ish Riff" ? 0.22 : 0.16;

        lead.o.frequency.setValueAtTime(leadHz, t);
        lead.g.gain.setValueAtTime(0.0001, t);
        lead.g.gain.exponentialRampToValueAtTime(leadLevel, t + 0.01);
        lead.g.gain.exponentialRampToValueAtTime(0.0001, t + step * 0.95);

        bass.o.frequency.setValueAtTime(bassHz, t);
        bass.g.gain.setValueAtTime(0.0001, t);
        bass.g.gain.exponentialRampToValueAtTime(bassLevel, t + 0.008);
        bass.g.gain.exponentialRampToValueAtTime(0.0001, t + step * 1.05);

        if (pat.tick && (idx % 2 === 0)) {
            playTick(t, station.name === "Hard Bass" ? 0.18 : 0.11);
        }

        // Small "radio wobble"
        if (staticNode?.lp) {
            staticNode.lp.frequency.setValueAtTime(staticNode.lp.frequency.value, t);
            staticNode.lp.frequency.linearRampToValueAtTime(staticNode.lp.frequency.value * (0.92 + Math.random() * 0.18), t + step);
        }
    };

    // Scheduler: keep it simple with setInterval scheduling a small lookahead
    const lookahead = 0.2;
    let nextTime = startAt;
    radioScheduler = setInterval(() => {
        if (!audioContext) return;
        const now = audioContext.currentTime;
        while (nextTime < now + lookahead) {
            scheduleStep(nextTime, stepIndex++);
            nextTime += step;
        }
    }, 50);
}

function stopRadio() {
    if (radioScheduler) {
        clearInterval(radioScheduler);
        radioScheduler = null;
    }

    // Stop/cleanup nodes
    for (const n of radioNodes) {
        try {
            if (n && typeof n.stop === 'function') n.stop();
        } catch (_) {}
        try {
            if (n && typeof n.disconnect === 'function') n.disconnect();
        } catch (_) {}
    }
    radioNodes = [];
    radioOscillator = null;
}

function initializeRadioStations() {
    const stationList = document.getElementById('radioStationList');
    stationList.innerHTML = '';
    radioStations.forEach((station, index) => {
        const stationEl = document.createElement('div');
        stationEl.className = 'radio-station-item';
        if (index === currentStationIndex) stationEl.classList.add('active');
        stationEl.innerHTML = `<span style="color: ${station.color}">${station.freq.toFixed(1)}</span> ${station.name}`;
        stationEl.onclick = () => {
            currentStationIndex = index;
            updateRadioDisplay();
            if (radioOn) playRadioStation();
        };
        stationList.appendChild(stationEl);
    });
}

const MAX_SPEED = 130;      // mph (electronically limited)
const MAX_RPM = 7000;       // rpm
const MAX_TURBO = 20;       // psi
const ACCELERATION_RATE = 2.5;  // mph per frame
const DECELERATION_RATE = 1.2;  // mph per frame
const RPM_MULTIPLIER = 54;      // rpm per mph
const TURBO_THRESHOLD = 30;     // mph before turbo kicks in
const STRESS_RATE = 0.15;       // stress increase per frame when accelerating
const STRESS_DECAY = 0.05;      // stress decrease per frame when not accelerating
const FAILURE_THRESHOLD = 95;   // stress level that causes engine failure

// ==================== STEERING + CRASH SYSTEM ====================
let steeringInput = 0; // -1..1
let carPos = 0; // -1..1 (left/right)
let obstacles = []; // { id, x (-1..1), z (0..1), el }
let lastObstacleSpawnAt = 0; // distance marker

function setSteering(value) {
    // Accept -1..1 (slider passes floats)
    steeringInput = Math.max(-1, Math.min(1, Number(value) || 0));
    const slider = document.getElementById('steeringSlider');
    if (slider && document.activeElement !== slider) {
        slider.value = String(Math.round(steeringInput * 100));
    }
}

function crash(reason = 'CRASH!') {
    if (simulatorState.isCrashed) return;
    simulatorState.isCrashed = true;
    simulatorState.isAccelerating = false;

    const crashTag = document.getElementById('crashTag');
    if (crashTag) crashTag.hidden = false;

    const warningEl = document.getElementById('warningMessage');
    if (warningEl) {
        warningEl.textContent = `💥 ${reason} You crashed. Reset to try again.`;
        warningEl.className = 'warning-message warning-danger';
    }

    // Shake + explosion (smaller than engine death)
    const dash = document.querySelector('.simulator-dashboard');
    if (dash) {
        dash.classList.remove('shake');
        void dash.offsetWidth; // reflow to restart animation
        dash.classList.add('shake');
        setTimeout(() => dash.classList.remove('shake'), 650);
    }
    triggerExplosion({ intensity: 0.7 });
    playCrashSound();
}

function resetCrashState() {
    simulatorState.isCrashed = false;
    carPos = 0;
    steeringInput = 0;
    const slider = document.getElementById('steeringSlider');
    if (slider) slider.value = '0';
    const crashTag = document.getElementById('crashTag');
    if (crashTag) crashTag.hidden = true;

    // Clear obstacles
    obstacles.forEach(o => o.el?.remove());
    obstacles = [];
}

function spawnObstacle() {
    const container = document.getElementById('roadObjects');
    if (!container) return;
    const el = document.createElement('div');
    el.className = 'obstacle';
    container.appendChild(el);

    const o = {
        id: `${Date.now()}-${Math.random()}`,
        x: (Math.random() * 1.6) - 0.8, // keep within road
        z: 0, // 0 (far) -> 1 (near)
        el
    };
    obstacles.push(o);
}

function updateObstacles(dt) {
    const container = document.getElementById('roadObjects');
    if (!container) return;

    // spawn more often as speed increases (distance-based)
    const spawnEveryMiles = Math.max(0.03, 0.12 - (simulatorState.speed / MAX_SPEED) * 0.08);
    if (simulatorState.distance - lastObstacleSpawnAt > spawnEveryMiles && simulatorState.speed > 10 && !simulatorState.isCrashed && !simulatorState.isEngineDead) {
        lastObstacleSpawnAt = simulatorState.distance;
        // sometimes spawn 2
        spawnObstacle();
        if (Math.random() < 0.25) spawnObstacle();
    }

    // Move obstacles towards the player
    const speedFactor = simulatorState.speed / MAX_SPEED;
    const zSpeed = (0.55 + speedFactor * 1.15) * dt; // normalized per second

    obstacles.forEach(o => {
        o.z += zSpeed;

        // Perspective mapping: far objects are smaller and higher; near are larger and lower
        const scale = 0.35 + o.z * 1.6;
        const y = 18 + o.z * 210;
        const xPx = o.x * 140; // lane width approx
        o.el.style.transform = `translateX(calc(-50% + ${xPx}px)) translateY(${y}px) scale(${scale})`;
        o.el.style.opacity = String(Math.max(0, 1 - Math.max(0, o.z - 0.9) / 0.2));
    });

    // Remove passed obstacles
    obstacles = obstacles.filter(o => {
        if (o.z > 1.15) {
            o.el.remove();
            return false;
        }
        return true;
    });
}

function checkCollisions() {
    if (simulatorState.isCrashed || simulatorState.isEngineDead) return;
    if (simulatorState.speed < 8) return;

    // Off-road crash (too far left/right)
    if (Math.abs(carPos) > 0.98) {
        crash('Off-road');
        return;
    }

    // Obstacle collision near the player
    for (const o of obstacles) {
        if (o.z > 0.82 && o.z < 0.98) {
            const dx = Math.abs(o.x - carPos);
            if (dx < 0.18) {
                crash('Impact');
                return;
            }
        }
    }
}

function updateCarHUD() {
    const car = document.getElementById('car');
    if (car) {
        const xPx = carPos * 150;
        car.style.transform = `translateX(calc(-50% + ${xPx}px))`;
    }

    const lanePosEl = document.getElementById('lanePos');
    if (lanePosEl) {
        lanePosEl.textContent = String(Math.round(carPos * 100));
    }
}

// ==================== EXPLOSION VFX + SFX ====================
function triggerExplosion({ intensity = 1 } = {}) {
    const overlay = document.getElementById('explosionOverlay');
    const particles = document.getElementById('explosionParticles');
    if (!overlay || !particles) return;

    overlay.classList.remove('active');
    void overlay.offsetWidth; // restart animation
    overlay.classList.add('active');

    // particles burst
    particles.innerHTML = '';
    const count = Math.floor(36 * intensity);
    for (let i = 0; i < count; i++) {
        const p = document.createElement('div');
        p.className = 'particle';
        const startX = 50 + (Math.random() * 20 - 10);
        const startY = 68 + (Math.random() * 12 - 6);
        const angle = (Math.random() * Math.PI * 2);
        const dist = (120 + Math.random() * 260) * intensity;
        const dx = Math.cos(angle) * dist;
        const dy = Math.sin(angle) * dist - (120 * intensity);
        const dur = 700 + Math.random() * 900;

        p.style.left = `${startX}%`;
        p.style.top = `${startY}%`;
        p.animate([
            { transform: 'translate3d(0,0,0) scale(1)', opacity: 1 },
            { transform: `translate3d(${dx}px, ${dy}px, 0) scale(${0.3 + Math.random() * 0.6})`, opacity: 0 }
        ], { duration: dur, easing: 'cubic-bezier(.2,.9,.2,1)', fill: 'forwards' });

        particles.appendChild(p);
    }
}

function playExplosionSound(intensity = 1) {
    if (!audioContext) {
        initAudioContext();
    }
    if (!audioContext || !masterGain) return;

    const now = audioContext.currentTime;
    const out = audioContext.createGain();
    out.gain.setValueAtTime(0.0001, now);
    out.gain.exponentialRampToValueAtTime(0.9 * intensity, now + 0.02);
    out.gain.exponentialRampToValueAtTime(0.0001, now + 1.2);
    out.connect(masterGain);

    // Low boom (sine)
    const boom = audioContext.createOscillator();
    boom.type = 'sine';
    boom.frequency.setValueAtTime(90, now);
    boom.frequency.exponentialRampToValueAtTime(30, now + 0.35);
    boom.connect(out);

    // Noise burst (filtered)
    const noiseBuf = audioContext.createBuffer(1, Math.floor(audioContext.sampleRate * 1.0), audioContext.sampleRate);
    const data = noiseBuf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    const noise = audioContext.createBufferSource();
    noise.buffer = noiseBuf;
    const bp = audioContext.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(700, now);
    bp.Q.setValueAtTime(0.8, now);
    noise.connect(bp);
    bp.connect(out);

    boom.start(now);
    boom.stop(now + 1.0);
    noise.start(now);
    noise.stop(now + 1.0);
}

function playCrashSound() {
    if (!audioContext) initAudioContext();
    if (!audioContext || !masterGain) return;
    const now = audioContext.currentTime;

    const g = audioContext.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(0.55, now + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.5);
    g.connect(masterGain);

    // Metallic hit
    const hit = audioContext.createOscillator();
    hit.type = 'square';
    hit.frequency.setValueAtTime(220, now);
    hit.frequency.exponentialRampToValueAtTime(70, now + 0.2);
    hit.connect(g);
    hit.start(now);
    hit.stop(now + 0.45);
}

function startAcceleration() {
    if (simulatorState.isEngineDead) return;
    if (simulatorState.isCrashed) return;
    
    // Initialize audio on first user interaction
    if (!audioContext) {
        initAudioContext();
        createEngineSound();
        createTurboSound();
    }
    
    simulatorState.isAccelerating = true;
    const gasPedal = document.getElementById('gasPedal');
    if (gasPedal) {
        gasPedal.classList.add('active');
    }
    
    // Start engine sound if not already playing
    if (!engineOscillator) {
        createEngineSound();
    }
    
    if (!simulatorState.animationFrame) {
        simulatorLoop();
    }
}

function stopAcceleration() {
    simulatorState.isAccelerating = false;
    const gasPedal = document.getElementById('gasPedal');
    if (gasPedal) {
        gasPedal.classList.remove('active');
    }
}

function resetSimulator() {
    simulatorState.speed = 0;
    simulatorState.rpm = 0;
    simulatorState.turbo = 0;
    simulatorState.distance = 0;
    simulatorState.maxSpeed = 0;
    simulatorState.stress = 0;
    simulatorState.isAccelerating = false;
    simulatorState.engineHealth = 100;
    simulatorState.isEngineDead = false;
    updateSimulatorDisplay();
    updateEngineStatus();
    document.getElementById('warningMessage').textContent = '';
    document.getElementById('warningMessage').className = 'warning-message';
    
    // Reset sounds
    if (engineGain) engineGain.gain.value = 0;
    if (turboGain) turboGain.gain.value = 0;

    resetCrashState();
}

function simulatorLoop() {
    if (simulatorState.isEngineDead) {
        // Engine is dead, just decelerate
        simulatorState.speed = Math.max(0, simulatorState.speed - DECELERATION_RATE * 2);
        simulatorState.rpm = Math.max(0, simulatorState.rpm - RPM_MULTIPLIER * DECELERATION_RATE * 2);
        simulatorState.turbo = Math.max(0, simulatorState.turbo - 0.5);
        simulatorState.stress = Math.min(100, simulatorState.stress + 0.1);
    } else if (simulatorState.isAccelerating) {
        // Accelerating
        simulatorState.speed = Math.min(MAX_SPEED, simulatorState.speed + ACCELERATION_RATE);
        simulatorState.rpm = Math.min(MAX_RPM, simulatorState.rpm + RPM_MULTIPLIER * ACCELERATION_RATE);
        
        // Turbo kicks in after 30 mph
        if (simulatorState.speed > TURBO_THRESHOLD) {
            simulatorState.turbo = Math.min(MAX_TURBO, simulatorState.turbo + 0.3);
        }
        
        // Increase stress
        simulatorState.stress = Math.min(100, simulatorState.stress + STRESS_RATE);
        
        // Check for engine failure
        if (simulatorState.stress >= FAILURE_THRESHOLD) {
            triggerEngineFailure();
        }
    } else {
        // Decelerating
        simulatorState.speed = Math.max(0, simulatorState.speed - DECELERATION_RATE);
        simulatorState.rpm = Math.max(0, simulatorState.rpm - RPM_MULTIPLIER * DECELERATION_RATE);
        simulatorState.turbo = Math.max(0, simulatorState.turbo - 0.2);
        simulatorState.stress = Math.max(0, simulatorState.stress - STRESS_DECAY);
    }

    // Steering + car position update (independent of accel state)
    // dt approximation based on frame time is overkill; use speed-scaled smoothing
    const steerStrength = 0.018 + (simulatorState.speed / MAX_SPEED) * 0.02;
    carPos += steeringInput * steerStrength;
    carPos *= 0.995; // slight self-centering drift
    carPos = Math.max(-1.25, Math.min(1.25, carPos));
    
    // Update distance (rough calculation)
    simulatorState.distance += (simulatorState.speed / 3600) * (1/60); // miles per frame (assuming 60fps)
    
    // Update max speed
    if (simulatorState.speed > simulatorState.maxSpeed) {
        simulatorState.maxSpeed = simulatorState.speed;
    }
    
    // Update engine health based on stress
    simulatorState.engineHealth = Math.max(0, 100 - simulatorState.stress);
    
    updateSimulatorDisplay();
    updateEngineStatus();
    checkWarnings();
    updateCarHUD();

    // Obstacles + collisions
    // dt for obstacle movement (~1/60s); stable enough
    updateObstacles(1/60);
    checkCollisions();
    
    // Update sounds
    updateEngineSound();
    updateTurboSound();
    
    // Continue loop
    simulatorState.animationFrame = requestAnimationFrame(simulatorLoop);
    
    // Stop loop if everything is at zero and not accelerating
    if (!simulatorState.isAccelerating && simulatorState.speed === 0 && simulatorState.rpm === 0) {
        cancelAnimationFrame(simulatorState.animationFrame);
        simulatorState.animationFrame = null;
    }
}

function triggerEngineFailure() {
    simulatorState.isEngineDead = true;
    simulatorState.engineHealth = 0;
    const warningEl = document.getElementById('warningMessage');
    warningEl.textContent = '⚠️ CATASTROPHIC ENGINE FAILURE! The engine has reached its breaking point, just like the real A3. You pushed it too hard!';
    warningEl.className = 'warning-message warning-critical';
    updateEngineStatus();
    
    // Engine failure sound - abrupt stop
    if (engineGain) {
        engineGain.gain.setValueAtTime(engineGain.gain.value, audioContext.currentTime);
        engineGain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.5);
    }
    if (turboGain) {
        turboGain.gain.setValueAtTime(turboGain.gain.value, audioContext.currentTime);
        turboGain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.3);
    }
    
    // Play failure sound
    if (audioContext) {
        const failureOsc = audioContext.createOscillator();
        const failureGain = audioContext.createGain();
        failureOsc.type = 'sawtooth';
        failureOsc.frequency.setValueAtTime(100, audioContext.currentTime);
        failureOsc.frequency.exponentialRampToValueAtTime(20, audioContext.currentTime + 1);
        failureGain.gain.setValueAtTime(0.3, audioContext.currentTime);
        failureGain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 1);
        failureOsc.connect(failureGain);
        failureGain.connect(masterGain);
        failureOsc.start();
        failureOsc.stop(audioContext.currentTime + 1);
    }

    // Big explosion moment (flash + particles + shake + BOOM)
    const dash = document.querySelector('.simulator-dashboard');
    if (dash) {
        dash.classList.remove('shake');
        void dash.offsetWidth;
        dash.classList.add('shake');
        setTimeout(() => dash.classList.remove('shake'), 650);
    }
    triggerExplosion({ intensity: 1.25 });
    playExplosionSound(1.2);
}

function updateSimulatorDisplay() {
    // Update values
    document.getElementById('speed').textContent = Math.round(simulatorState.speed);
    document.getElementById('rpm').textContent = (simulatorState.rpm / 1000).toFixed(1);
    document.getElementById('turbo').textContent = simulatorState.turbo.toFixed(1);
    document.getElementById('distance').textContent = simulatorState.distance.toFixed(2);
    document.getElementById('maxSpeed').textContent = Math.round(simulatorState.maxSpeed);
    document.getElementById('stress').textContent = Math.round(simulatorState.stress);
    
    // Update gauges (circular progress)
    const speedPercent = simulatorState.speed / MAX_SPEED;
    const rpmPercent = simulatorState.rpm / MAX_RPM;
    const turboPercent = simulatorState.turbo / MAX_TURBO;
    
    const speedGauge = document.getElementById('speed-gauge');
    const rpmGauge = document.getElementById('rpm-gauge');
    const turboGauge = document.getElementById('turbo-gauge');
    
    if (speedGauge) {
        const circumference = 2 * Math.PI * 80;
        speedGauge.style.strokeDashoffset = circumference - (speedPercent * circumference);
    }
    
    if (rpmGauge) {
        const circumference = 2 * Math.PI * 80;
        rpmGauge.style.strokeDashoffset = circumference - (rpmPercent * circumference);
    }
    
    if (turboGauge) {
        const circumference = 2 * Math.PI * 80;
        turboGauge.style.strokeDashoffset = circumference - (turboPercent * circumference);
    }
    
    // Update road animation speed based on speed (for both 2D and 3D)
    const roadLines = document.querySelectorAll('.road-lines');
    const baseSpeed = 0.5;
    const speedFactor = Math.max(0.1, simulatorState.speed / MAX_SPEED);
    roadLines.forEach((line, index) => {
        const duration = baseSpeed / (speedFactor + 0.1);
        line.style.animationDuration = `${duration}s`;
    });
    
    // Update 3D road perspective based on speed
    const road3D = document.querySelector('.road-3d');
    if (road3D) {
        const speedPercent = simulatorState.speed / MAX_SPEED;
        const rotationX = 60 - (speedPercent * 10); // Tilt more at speed
        const translateZ = -200 - (speedPercent * 100); // Move forward at speed
        const rotationY = carPos * 10; // banking on steering
        road3D.style.transform = `rotateX(${rotationX}deg) rotateY(${rotationY}deg) translateZ(${translateZ}px)`;
    }
}

function updateEngineStatus() {
    const statusEl = document.getElementById('engineStatus');
    const indicator = statusEl.querySelector('.status-indicator');
    const statusText = statusEl.querySelector('.status-text');
    
    if (simulatorState.isEngineDead) {
        indicator.className = 'status-indicator status-dead';
        statusText.textContent = 'Engine: FAILED';
        statusEl.style.color = '#ff0000';
    } else if (simulatorState.stress > 80) {
        indicator.className = 'status-indicator status-warning';
        statusText.textContent = 'Engine: CRITICAL';
        statusEl.style.color = '#ff6b6b';
    } else if (simulatorState.stress > 60) {
        indicator.className = 'status-indicator status-warning';
        statusText.textContent = 'Engine: WARNING';
        statusEl.style.color = '#ffa500';
    } else if (simulatorState.stress > 40) {
        indicator.className = 'status-indicator status-caution';
        statusText.textContent = 'Engine: STRESSED';
        statusEl.style.color = '#ffd700';
    } else {
        indicator.className = 'status-indicator status-ok';
        statusText.textContent = 'Engine: OK';
        statusEl.style.color = '#00ff88';
    }
}

function checkWarnings() {
    const warningEl = document.getElementById('warningMessage');
    
    if (simulatorState.isEngineDead) {
        return; // Already showing failure message
    }
    
    if (simulatorState.stress > 85) {
        warningEl.textContent = '⚠️ DANGER! Engine stress critical! This is how the real A3 met its end!';
        warningEl.className = 'warning-message warning-danger';
    } else if (simulatorState.stress > 70) {
        warningEl.textContent = '⚠️ WARNING! High engine stress detected. Remember what happened to the real A3?';
        warningEl.className = 'warning-message warning-high';
    } else if (simulatorState.stress > 50) {
        warningEl.textContent = '⚠️ Engine stress increasing. The owner\'s gas pedal tendencies are showing...';
        warningEl.className = 'warning-message warning-medium';
    } else if (simulatorState.stress > 30) {
        warningEl.textContent = 'Engine stress building. Keep pushing and you might replicate history.';
        warningEl.className = 'warning-message warning-low';
    } else {
        warningEl.textContent = '';
        warningEl.className = 'warning-message';
    }
}

// Keyboard support for gas pedal (spacebar)
document.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && e.target.tagName !== 'INPUT') {
        e.preventDefault();
        startAcceleration();
    }
});

document.addEventListener('keyup', (e) => {
    if (e.code === 'Space') {
        e.preventDefault();
        stopAcceleration();
    }
});

// Steering keyboard controls
document.addEventListener('keydown', (e) => {
    if (simulatorState.isEngineDead || simulatorState.isCrashed) return;
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
        setSteering(-1);
    } else if (e.code === 'ArrowRight' || e.code === 'KeyD') {
        setSteering(1);
    }
});

document.addEventListener('keyup', (e) => {
    if (e.code === 'ArrowLeft' || e.code === 'KeyA' || e.code === 'ArrowRight' || e.code === 'KeyD') {
        setSteering(0);
    }
});

// Prevent default touch behavior on gas pedal
const gasPedal = document.getElementById('gasPedal');
if (gasPedal) {
    gasPedal.addEventListener('touchstart', (e) => {
        e.preventDefault();
        startAcceleration();
    });
    
    gasPedal.addEventListener('touchend', (e) => {
        e.preventDefault();
        stopAcceleration();
    });
    
    gasPedal.addEventListener('touchcancel', (e) => {
        e.preventDefault();
        stopAcceleration();
    });
}

// Initialize simulator display (audio will be initialized on first user interaction)
if (document.getElementById('speed')) {
    updateSimulatorDisplay();
    initializeRadioStations();
    updateRadioDisplay();
    
    // Initialize audio context on any user interaction
    const initAudioOnInteraction = () => {
        if (!audioContext) {
            initAudioContext();
            createEngineSound();
            createTurboSound();
        }
        document.removeEventListener('click', initAudioOnInteraction);
        document.removeEventListener('touchstart', initAudioOnInteraction);
        document.removeEventListener('keydown', initAudioOnInteraction);
    };
    
    document.addEventListener('click', initAudioOnInteraction);
    document.addEventListener('touchstart', initAudioOnInteraction);
    document.addEventListener('keydown', initAudioOnInteraction);
}
