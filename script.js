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

// Radio stations with frequencies and names
const radioStations = [
    { freq: 88.5, name: "Classic Rock", color: "#ff6b6b" },
    { freq: 92.3, name: "Electronic", color: "#00d4ff" },
    { freq: 96.7, name: "Jazz", color: "#ff00ff" },
    { freq: 101.1, name: "Ambient", color: "#00ff88" },
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
        radioGain.gain.value = value / 100;
    }
}

function playRadioStation() {
    if (!audioContext) initAudioContext();
    
    stopRadio();
    
    const station = radioStations[currentStationIndex];
    if (station.name === 'Off') return;
    
    radioOscillator = audioContext.createOscillator();
    radioGain = audioContext.createGain();
    
    // Create different sounds for different stations
    let freq = 220;
    let type = 'sine';
    
    switch(station.name) {
        case 'Classic Rock':
            freq = 220;
            type = 'square';
            break;
        case 'Electronic':
            freq = 330;
            type = 'sawtooth';
            break;
        case 'Jazz':
            freq = 165;
            type = 'triangle';
            break;
        case 'Ambient':
            freq = 110;
            type = 'sine';
            break;
    }
    
    radioOscillator.type = type;
    radioOscillator.frequency.value = freq;
    
    const volume = document.getElementById('radioVolume').value / 100;
    radioGain.gain.value = volume * 0.3;
    
    // Add some modulation for more interesting sound
    const lfo = audioContext.createOscillator();
    const lfoGain = audioContext.createGain();
    lfo.frequency.value = 2;
    lfoGain.gain.value = 10;
    lfo.connect(lfoGain);
    lfoGain.connect(radioOscillator.frequency);
    lfo.start();
    
    radioOscillator.connect(radioGain);
    radioGain.connect(masterGain);
    
    radioOscillator.start();
}

function stopRadio() {
    if (radioOscillator) {
        radioOscillator.stop();
        radioOscillator = null;
    }
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

function startAcceleration() {
    if (simulatorState.isEngineDead) return;
    
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
        road3D.style.transform = `rotateX(${rotationX}deg) translateZ(${translateZ}px)`;
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
