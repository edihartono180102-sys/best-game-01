// Synthesised sound effects through WebAudio — no audio assets, no network.
// Every effect is a tiny oscillator/noise recipe. Created lazily on first user
// gesture so browsers allow it; M toggles mute.

export class SoundBank {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.lastPlay = new Map();
  }

  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.22;
      this.master.connect(this.ctx.destination);
    } catch {
      this.ctx = null;
    }
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.22;
    return this.muted;
  }

  // Rate-limit a named effect so a 60 Hz fire loop cannot stack up.
  _throttle(name, ms) {
    const now = performance.now();
    const last = this.lastPlay.get(name) || 0;
    if (now - last < ms) return false;
    this.lastPlay.set(name, now);
    return true;
  }

  _tone(freq, dur, type, vol, slideTo) {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo !== undefined) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g);
    g.connect(this.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  _noise(dur, vol, filterFreq) {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const filt = this.ctx.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.value = filterFreq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filt);
    filt.connect(g);
    g.connect(this.master);
    src.start(t0);
  }

  shoot() {
    if (!this._throttle('shoot', 45)) return;
    this._tone(880, 0.09, 'square', 0.10, 220);
  }

  enemyShoot() {
    if (!this._throttle('eshoot', 90)) return;
    this._tone(300, 0.14, 'sawtooth', 0.06, 140);
  }

  explosion(big = false) {
    this._noise(big ? 0.55 : 0.28, big ? 0.5 : 0.3, big ? 900 : 1600);
    this._tone(big ? 120 : 180, big ? 0.4 : 0.2, 'sine', 0.25, 40);
  }

  hit() {
    if (!this._throttle('hit', 60)) return;
    this._tone(160, 0.08, 'triangle', 0.14, 90);
  }

  pickup() {
    if (!this._throttle('pickup', 50)) return;
    this._tone(1320, 0.09, 'sine', 0.12, 1980);
  }

  heal() {
    this._tone(520, 0.16, 'sine', 0.14, 780);
  }

  dash() {
    this._noise(0.16, 0.16, 2400);
    this._tone(240, 0.14, 'sine', 0.1, 720);
  }

  buy() {
    this._tone(660, 0.1, 'triangle', 0.16, 660);
    setTimeout(() => this._tone(990, 0.14, 'triangle', 0.16, 990), 70);
  }

  denied() {
    this._tone(180, 0.16, 'square', 0.12, 120);
  }

  waveHorn() {
    this._tone(196, 0.35, 'sawtooth', 0.12, 196);
    setTimeout(() => this._tone(294, 0.4, 'sawtooth', 0.12, 294), 140);
  }

  bossHorn() {
    this._tone(98, 0.5, 'sawtooth', 0.18, 65);
    setTimeout(() => this._tone(147, 0.5, 'sawtooth', 0.16, 98), 220);
  }

  victory() {
    [523, 659, 784, 1046].forEach((f, i) =>
      setTimeout(() => this._tone(f, 0.28, 'triangle', 0.18, f), i * 130));
  }

  defeat() {
    [392, 330, 262, 196].forEach((f, i) =>
      setTimeout(() => this._tone(f, 0.32, 'sawtooth', 0.12, f * 0.94), i * 170));
  }
}
