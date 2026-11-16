// Keyboard + mouse state, translated into game actions.
// Tracks held keys, edge-triggered presses, and the mouse position in canvas
// coordinates (the canvas is scaled to the window, so coordinates are mapped).

import { VIEW } from './config.js';

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set(); // currently held, by e.code
    this.pressed = new Set(); // edge-triggered, consumed once per frame
    this.mouseX = VIEW.w / 2;
    this.mouseY = VIEW.h / 2 - 120;
    this.mouseDown = false;
    this.mouseClicked = false; // edge-triggered click
    this._onKeyDown = (e) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
        e.preventDefault();
      }
      if (!e.repeat) this.pressed.add(e.code);
      this.keys.add(e.code);
    };
    this._onKeyUp = (e) => this.keys.delete(e.code);
    this._onBlur = () => {
      this.keys.clear();
      this.mouseDown = false;
    };
    this._onMouseMove = (e) => {
      const r = this.canvas.getBoundingClientRect();
      this.mouseX = ((e.clientX - r.left) / r.width) * VIEW.w;
      this.mouseY = ((e.clientY - r.top) / r.height) * VIEW.h;
    };
    this._onMouseDown = (e) => {
      if (e.button !== 0) return;
      this._onMouseMove(e);
      this.mouseDown = true;
      this.mouseClicked = true;
    };
    this._onMouseUp = (e) => {
      if (e.button !== 0) return;
      this.mouseDown = false;
    };
    this._onContext = (e) => e.preventDefault();
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('blur', this._onBlur);
    canvas.addEventListener('mousemove', this._onMouseMove);
    canvas.addEventListener('mousedown', this._onMouseDown);
    window.addEventListener('mouseup', this._onMouseUp);
    canvas.addEventListener('contextmenu', this._onContext);
  }

  held(...codes) {
    return codes.some((c) => this.keys.has(c));
  }

  // True once for the frame the key went down; callers consume it.
  wasPressed(...codes) {
    return codes.some((c) => this.pressed.has(c));
  }

  wasClicked() {
    return this.mouseClicked;
  }

  // Movement vector from WASD / arrows, normalised.
  moveVector() {
    let x = 0;
    let y = 0;
    if (this.held('KeyA', 'ArrowLeft')) x -= 1;
    if (this.held('KeyD', 'ArrowRight')) x += 1;
    if (this.held('KeyW', 'ArrowUp')) y -= 1;
    if (this.held('KeyS', 'ArrowDown')) y += 1;
    if (x !== 0 && y !== 0) {
      const inv = 1 / Math.hypot(x, y);
      x *= inv;
      y *= inv;
    }
    return { x, y };
  }

  // Call at the end of each frame so edge events fire exactly once.
  endFrame() {
    this.pressed.clear();
    this.mouseClicked = false;
  }
}
