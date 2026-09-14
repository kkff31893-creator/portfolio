// Web Audio API procedural sound synthesizer (Zero external dependencies)
(function () {
  let audioCtx = null;
  let isMuted = localStorage.getItem('portfolio-mute') === 'true';

  function getContext() {
    if (!audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        audioCtx = new AudioContext();
      }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    return audioCtx;
  }

  window.soundEngine = {
    get muted() {
      return isMuted;
    },
    set muted(val) {
      isMuted = !!val;
      localStorage.setItem('portfolio-mute', isMuted);
      updateSoundUI();
    },
    toggle() {
      this.muted = !isMuted;
      if (!this.muted) {
        this.playClick();
      }
      return this.muted;
    },

    // Light mechanical UI click
    playClick(freq = 880, duration = 0.035) {
      if (isMuted) return;
      try {
        const ctx = getContext();
        if (!ctx) return;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(140, ctx.currentTime + duration);

        gain.gain.setValueAtTime(0.12, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + duration);
      } catch (e) {}
    },

    // Crisp keyboard tap for terminal
    playKey() {
      if (isMuted) return;
      try {
        const ctx = getContext();
        if (!ctx) return;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const freq = 420 + Math.random() * 160;
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, ctx.currentTime);

        gain.gain.setValueAtTime(0.04, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.02);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.02);
      } catch (e) {}
    },

    // Target spawn blip in mini-game
    playSignalSpawn() {
      if (isMuted) return;
      try {
        const ctx = getContext();
        if (!ctx) return;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.06);

        gain.gain.setValueAtTime(0.08, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.07);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.07);
      } catch (e) {}
    },

    // Hit confirmation in mini-game
    playHit() {
      if (isMuted) return;
      try {
        const ctx = getContext();
        if (!ctx) return;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(620, ctx.currentTime);
        osc.frequency.setValueAtTime(932, ctx.currentTime + 0.03);

        gain.gain.setValueAtTime(0.14, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.1);
      } catch (e) {}
    },

    // Game finish fanfare
    playGameOver() {
      if (isMuted) return;
      try {
        const ctx = getContext();
        if (!ctx) return;
        const notes = [440, 554, 659, 880];
        notes.forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.07);

          gain.gain.setValueAtTime(0.12, ctx.currentTime + idx * 0.07);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.07 + 0.22);

          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(ctx.currentTime + idx * 0.07);
          osc.stop(ctx.currentTime + idx * 0.07 + 0.22);
        });
      } catch (e) {}
    }
  };

  function updateSoundUI() {
    const soundToggle = document.querySelector('#sound-toggle');
    const soundState = document.querySelector('#sound-state');
    if (soundToggle && soundState) {
      soundState.textContent = isMuted ? 'OFF' : 'ON';
      soundToggle.classList.toggle('active', !isMuted);
      soundToggle.setAttribute('aria-pressed', String(!isMuted));
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    updateSoundUI();
    const soundToggle = document.querySelector('#sound-toggle');
    soundToggle?.addEventListener('click', () => {
      window.soundEngine.toggle();
    });

    document.addEventListener('click', (e) => {
      const target = e.target.closest('button, .editor-tab, .preset-btn, .segmented button, [data-command], .tags span');
      if (target && !target.id.includes('sound-toggle') && !target.id.includes('game-target')) {
        window.soundEngine.playClick(600 + Math.random() * 120);
      }
    });
  });
})();
