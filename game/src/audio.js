// All sound is synthesized live with WebAudio: no audio files, no network.
// A small Sfx class owns one AudioContext (created on the first user
// gesture) plus a quiet pentatonic music loop that starts with play.

const PENTA = [0, 3, 5, 7, 10, 12, 15, 17, 19, 22, 24];

export class Sfx {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.musicGain = null;
    this.muted = false;
    this.musicTimer = null;
    this.musicStep = 0;
  }

  // Call from a user gesture (click / key) so the browser allows audio.
  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.5;
    this.master.connect(this.ctx.destination);
    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = 0.05;
    this.musicGain.connect(this.master);
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.5;
    return this.muted;
  }

  tone(freq, dur, type, vol, when = 0, slideTo = 0) {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime + when;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo > 0) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g);
    g.connect(this.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  // Short burst of filtered noise (dash whoosh, hit thud).
  noise(dur, vol, freq, when = 0) {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime + when;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = freq;
    filter.Q.value = 0.8;
    const g = this.ctx.createGain();
    g.gain.value = vol;
    src.connect(filter);
    filter.connect(g);
    g.connect(this.master);
    src.start(t0);
  }

  pickup(combo) {
    // Pitch climbs the pentatonic ladder with the combo: a rising reward.
    const step = Math.min(combo, PENTA.length - 1);
    const f = 523.25 * Math.pow(2, PENTA[step] / 12);
    this.tone(f, 0.16, 'sine', 0.35);
    this.tone(f * 2, 0.1, 'triangle', 0.12);
  }

  dash() {
    this.noise(0.18, 0.3, 1400);
    this.tone(220, 0.14, 'sine', 0.18, 0, 660);
  }

  banish() {
    this.tone(880, 0.12, 'square', 0.16);
    this.tone(1318, 0.2, 'sine', 0.2, 0.06);
  }

  hit() {
    this.tone(140, 0.25, 'square', 0.3, 0, 55);
    this.noise(0.2, 0.35, 300);
  }

  heart() {
    this.tone(659, 0.14, 'sine', 0.25);
    this.tone(988, 0.22, 'sine', 0.25, 0.1);
  }

  shield() {
    this.tone(392, 0.12, 'triangle', 0.25);
    this.tone(523, 0.12, 'triangle', 0.25, 0.08);
    this.tone(784, 0.2, 'triangle', 0.25, 0.16);
  }

  waveClear() {
    [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.22, 'triangle', 0.28, i * 0.09));
  }

  win() {
    [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => this.tone(f, 0.35, 'triangle', 0.3, i * 0.12));
    this.tone(261, 1.0, 'sine', 0.12, 0.1);
  }

  lose() {
    [392, 330, 262, 196].forEach((f, i) => this.tone(f, 0.4, 'sawtooth', 0.14, i * 0.18));
  }

  startMusic() {
    if (!this.ctx || this.musicTimer) return;
    this.musicStep = 0;
    this.musicTimer = window.setInterval(() => {
      if (this.muted || !this.ctx) return;
      const pattern = [0, 2, 4, 7, 4, 2, 5, 3];
      const step = pattern[this.musicStep % pattern.length];
      const f = 220 * Math.pow(2, PENTA[step % PENTA.length] / 12);
      const t0 = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = f;
      g.gain.setValueAtTime(0, t0);
      g.gain.linearRampToValueAtTime(1, t0 + 0.05);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.55);
      osc.connect(g);
      g.connect(this.musicGain);
      osc.start(t0);
      osc.stop(t0 + 0.6);
      this.musicStep++;
    }, 320);
  }

  stopMusic() {
    if (this.musicTimer) {
      window.clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
  }
}
