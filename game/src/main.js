// NOVA DRIFT — Void Salvage. Entry point: owns the loop, the state machine
// wiring and the top-level input. The rules live in world.js, the drawing in
// render.js, the actors in entities.js.

import { SHOP, VIEW } from './config.js';
import { SoundBank } from './audio.js';
import { Input } from './input.js';
import { Starfield } from './particles.js';
import { makeRng } from './random.js';
import { Renderer } from './render.js';
import { STATES, World } from './world.js';
import { applySceneParam, shopCardAt } from './debug.js';

const canvas = document.getElementById('game');
const fallback = document.getElementById('fallback');
if (!canvas || !canvas.getContext) {
  if (fallback) fallback.style.display = 'flex';
  throw new Error('Canvas 2D is unavailable');
}

const sound = new SoundBank();
const input = new Input(canvas);
const starfield = new Starfield(makeRng(), VIEW.w, VIEW.h);
const renderer = new Renderer(canvas, starfield);
const world = new World(sound);
const params = new URLSearchParams(window.location.search);

// Screenshot staging (?scene=...) goes through the real state machine.
const staged = applySceneParam(world, params);

let last = performance.now();
let fpsDebt = 0;

function resumeFromTitle() {
  sound.ensure();
  world.startRun();
}

function handleGlobalInput() {
  // Mute works everywhere.
  if (input.wasPressed('KeyM')) {
    const muted = sound.toggleMute();
    world.particles.floatText(
      world.player.x, world.player.y - 30,
      muted ? 'MUTED' : 'SOUND ON', '#8fb4d8', 14,
    );
  }
  if (input.wasPressed('KeyR')) {
    if (world.state !== STATES.TITLE) {
      sound.ensure();
      world.startRun();
    }
    return;
  }

  switch (world.state) {
    case STATES.TITLE: {
      if (input.wasPressed('Enter', 'Space') || input.wasClicked()) resumeFromTitle();
      break;
    }
    case STATES.PLAYING: {
      if (input.wasPressed('KeyP', 'Escape')) {
        world.prevState = STATES.PLAYING;
        world.state = STATES.PAUSED;
      }
      break;
    }
    case STATES.PAUSED: {
      if (input.wasPressed('KeyP', 'Escape', 'Enter') || input.wasClicked()) {
        world.state = STATES.PLAYING;
      }
      break;
    }
    case STATES.SHOP: {
      // Number keys buy; clicking a card buys; Enter skips to the next wave.
      for (const item of SHOP) {
        if (input.wasPressed(`Digit${item.key}`, `Numpad${item.key}`)) world.buy(item);
      }
      if (input.wasClicked()) {
        const idx = shopCardAt(world, input.mouseX, input.mouseY);
        if (idx !== null) world.buy(SHOP[idx]);
      }
      if (input.wasPressed('Enter')) world.startWave(world.wave + 1);
      break;
    }
    case STATES.VICTORY:
    case STATES.GAMEOVER: {
      if (input.wasPressed('Enter', 'Space') || input.wasClicked()) {
        sound.ensure();
        world.startRun();
      }
      break;
    }
    default:
      break;
  }
}

function frame(now) {
  requestAnimationFrame(frame);
  let dt = (now - last) / 1000;
  last = now;
  // Clamp huge steps (tab switches) and shed backlog instead of spiral-of-death.
  if (dt > 0.1) dt = 0.1;
  fpsDebt += dt;
  const step = 1 / 60;
  let guard = 0;
  while (fpsDebt >= step && guard < 5) {
    handleGlobalInput();
    world.update(step, input);
    input.endFrame();
    fpsDebt -= step;
    guard += 1;
  }
  if (guard >= 5) fpsDebt = 0;
  renderer.draw(world, input, world.time);
}

if (!staged) {
  world.state = STATES.TITLE;
}
requestAnimationFrame(frame);

// Expose a read-only handle for the maker's screenshot script and debugging.
window.__novaDrift = { world, states: STATES };
