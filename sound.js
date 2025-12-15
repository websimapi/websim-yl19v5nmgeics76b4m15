// ============================================
// SOUND EFFECTS
// ============================================
const sound = {
    audioContext: null,

    play(type) {
        if (!this.audioContext) {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }

        const osc = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();
        osc.connect(gainNode);
        gainNode.connect(this.audioContext.destination);

        const playConfig = {
            start: { type: 'sine', freq: 440, gain: 0.1, duration: 0.5 },
            elimination: { type: 'square', freq: 150, gain: 0.08, duration: 0.2 },
            win: { type: 'triangle', freq: 523, gain: 0.1, duration: 1.0 },
            click: { type: 'sine', freq: 880, gain: 0.05, duration: 0.1 },
        };

        const config = playConfig[type] || playConfig.click;
        osc.type = config.type;
        osc.frequency.setValueAtTime(config.freq, this.audioContext.currentTime);
        gainNode.gain.setValueAtTime(config.gain, this.audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.00001, this.audioContext.currentTime + config.duration);

        osc.start();
        osc.stop(this.audioContext.currentTime + config.duration);
    },

    playPresetClick() {
        try {
            const fx = new Audio('/shortenedelim.wav');
            fx.volume = 0.8;
            fx.play().catch(() => {});
        } catch (e) {
            console.error('Failed to play preset click sound', e);
        }
    },
};

// Initialize audio on first click
document.body.addEventListener('click', () => {
    if (!sound.audioContext) {
        sound.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
}, { once: true });

// ============================================
// BACKGROUND MUSIC
// ============================================
const bgm = {
    audio: null,
    hasStarted: false,
    muted: false,
    fadeIntervalId: null,
    baseVolume: 0.4,

    init() {
        try {
            this.audio = new Audio('/concerto.mp3');
            this.audio.loop = true;
            this.audio.volume = this.baseVolume;
        } catch (e) {
            console.error('Failed to initialize background music', e);
        }
    },

    playConcertoOnGameStart() {
        if (this.hasStarted || this.muted) return;
        if (!this.audio) this.init();
        if (this.audio) {
            this.audio.currentTime = 0;
            this.audio.play().catch(() => {});
            this.hasStarted = true;
        }
    },

    toggle() {
        this.muted = !this.muted;
        const btn = document.getElementById('musicToggleBtn');
        if (this.muted) {
            if (this.audio) this.audio.pause();
            if (btn) btn.textContent = '🔇 Music';
        } else {
            if (this.audio && this.hasStarted) {
                this.audio.play().catch(() => {});
            }
            if (btn) btn.textContent = '🔊 Music';
        }
    },

    fadeOut(duration = 2000) {
        if (!this.audio) return;
        const steps = 20;
        const stepTime = duration / steps;
        const volumeStep = this.audio.volume / steps;
        
        if (this.fadeIntervalId) clearInterval(this.fadeIntervalId);
        
        this.fadeIntervalId = setInterval(() => {
            if (this.audio.volume > volumeStep) {
                this.audio.volume -= volumeStep;
            } else {
                this.audio.volume = 0;
                this.audio.pause();
                clearInterval(this.fadeIntervalId);
            }
        }, stepTime);
    },

    fadeIn(duration = 2000) {
        if (!this.audio) return;
        this.audio.volume = 0;
        this.audio.play().catch(() => {});
        
        const steps = 20;
        const stepTime = duration / steps;
        const volumeStep = this.baseVolume / steps;
        
        if (this.fadeIntervalId) clearInterval(this.fadeIntervalId);
        
        this.fadeIntervalId = setInterval(() => {
            if (this.audio.volume < this.baseVolume - volumeStep) {
                this.audio.volume += volumeStep;
            } else {
                this.audio.volume = this.baseVolume;
                clearInterval(this.fadeIntervalId);
            }
        }, stepTime);
    },

    playVictoryTheme() {
        // Play victory sound/music
        sound.play('win');
    }
};
