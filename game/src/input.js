// Keyboard + mouse state for the canvas. Tracks held keys, the pointer in
// logical canvas coordinates, and click events the game loop consumes.
// No network, no DOM beyond the one canvas element.

const MOVE_KEYS = new Set([
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
  'KeyW', 'KeyA', 'KeyS', 'KeyD',
]);

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.mouseX = canvas.width / 2;
    this.mouseY = canvas.height / 2;
    this.mouseActive = false; // true once the pointer has moved over the canvas
    this.clicked = false; // set on mousedown, consumed once per frame
    this.clickX = 0;
    this.clickY = 0;
    this.pressed = new Set(); // keys pressed since last consume (edge trigger)

    window.addEventListener('keydown', (e) => {
      if (MOVE_KEYS.has(e.code) || e.code === 'Space') e.preventDefault();
      if (!e.repeat) this.pressed.add(e.code);
      this.keys.add(e.code);
    });
    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
    });
    window.addEventListener('blur', () => {
      this.keys.clear();
    });

    canvas.addEventListener('pointermove', (e) => {
      const p = this.toLogical(e);
      this.mouseX = p.x;
      this.mouseY = p.y;
      this.mouseActive = true;
    });
    canvas.addEventListener('pointerdown', (e) => {
      const p = this.toLogical(e);
      this.mouseX = p.x;
      this.mouseY = p.y;
      this.mouseActive = true;
      this.clicked = true;
      this.clickX = p.x;
      this.clickY = p.y;
    });
  }

  toLogical(e) {
    const r = this.canvas.getBoundingClientRect();
    return {
      x: (e.clientX - r.left) * (this.canvas.width / r.width),
      y: (e.clientY - r.top) * (this.canvas.height / r.height),
    };
  }

  // -1 / 0 / 1 on each axis from the held movement keys.
  moveAxis() {
    let x = 0;
    let y = 0;
    if (this.keys.has('ArrowLeft') || this.keys.has('KeyA')) x -= 1;
    if (this.keys.has('ArrowRight') || this.keys.has('KeyD')) x += 1;
    if (this.keys.has('ArrowUp') || this.keys.has('KeyW')) y -= 1;
    if (this.keys.has('ArrowDown') || this.keys.has('KeyS')) y += 1;
    return { x, y };
  }

  hasMoveKeys() {
    for (const k of MOVE_KEYS) if (this.keys.has(k)) return true;
    return false;
  }

  wasPressed(code) {
    return this.pressed.has(code);
  }

  // Consume the edge-triggered state at the end of each frame.
  endFrame() {
    this.pressed.clear();
    this.clicked = false;
  }
}
