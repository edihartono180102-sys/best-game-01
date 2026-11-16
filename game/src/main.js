// Lumen Harvest — entry point. Owns the animation loop, the screen state
// machine (title / playing / paused / win / lose), button clicks, and the
// deterministic `?shot=` mode used for screenshots.

import { createWorld, startRun, updateWorld } from './world.js';
import { render, BUTTONS, hitButton } from './render.js';
import { Sfx } from './audio.js';
import { Input } from './input.js';
import { applyShot } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const sfx = new Sfx();
const input = new Input(canvas);

const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');
const shotSeed = parseInt(params.get('seed') || '1', 10) || 1;

const world = createWorld(20261117);
// Debug/test handle: lets a play-test read the live state (screen, score,
// wave, hull) without touching the game. Harmless in normal play.
window.__game = world;
try {
  world.best = parseInt(window.localStorage.getItem('lumen-harvest-best') || '0', 10) || 0;
} catch (e) {
  world.best = 0;
}

let shotMode = false;
if (shotName) {
  shotMode = applyShot(world, shotName, shotSeed);
}

let last = performance.now();
let elapsed = 0; // render clock (frozen scenes still need a stable t)

function hoverButton() {
  if (!input.mouseActive) return null;
  const x = input.mouseX;
  const y = input.mouseY;
  if (world.screen === 'title' && hitButton(BUTTONS.start, x, y)) return 'start';
  if (world.screen === 'paused') {
    if (hitButton(BUTTONS.resume, x, y)) return 'resume';
    if (hitButton(BUTTONS.menu, x, y)) return 'menu';
  }
  if ((world.screen === 'win' || world.screen === 'lose') && hitButton(BUTTONS.restart, x, y)) {
    return 'restart';
  }
  return null;
}

function handleEvents(events) {
  for (const e of events) {
    if (e === 'pickup') sfx.pickup(world.combo);
    if (e === 'dash') sfx.dash();
    if (e === 'banish') sfx.banish();
    if (e === 'hit') sfx.hit();
    if (e === 'heart') sfx.heart();
    if (e === 'shield') sfx.shield();
    if (e === 'wave') sfx.waveClear();
    if (e === 'win') {
      sfx.win();
      sfx.stopMusic();
      saveBest();
    }
    if (e === 'lose') {
      sfx.lose();
      sfx.stopMusic();
      saveBest();
    }
  }
}

function saveBest() {
  try {
    window.localStorage.setItem('lumen-harvest-best', String(Math.max(world.best, world.score)));
  } catch (e) {
    // Storage may be unavailable; the best score is a nicety, not a rule.
  }
  world.best = Math.max(world.best, world.score);
}

function beginRun() {
  sfx.ensure();
  startRun(world);
  sfx.startMusic();
  justBegan = true; // skip one simulation step: the key/click that started
  // the run must not also fire a dash on the first frame.
}

let justBegan = false;

function toTitle() {
  world.screen = 'title';
  world.motes = [];
  world.wisps = [];
  world.mines = [];
  world.pickups = [];
  world.particles = [];
  world.banner = '';
  sfx.stopMusic();
}

function frame(now) {
  const dt = Math.min(0.033, (now - last) / 1000);
  last = now;
  if (!world.frozen) elapsed += dt;
  const t = world.frozen ? 1.7 : elapsed;

  if (!shotMode) {
    // --- global keys ---
    if (input.wasPressed('KeyM')) {
      sfx.ensure();
      sfx.toggleMute();
    }
    if (input.wasPressed('KeyR') && (world.screen === 'win' || world.screen === 'lose')) {
      beginRun();
    }
    if (input.wasPressed('Enter') && world.screen === 'title') {
      beginRun();
    }
    if (input.wasPressed('Space') && world.screen === 'title') {
      beginRun();
    }
    if ((input.wasPressed('KeyP') || input.wasPressed('Escape')) && world.screen === 'playing') {
      world.screen = 'paused';
      sfx.stopMusic();
    } else if ((input.wasPressed('KeyP') || input.wasPressed('Escape')) && world.screen === 'paused') {
      world.screen = 'playing';
      sfx.startMusic();
    }

    // --- clicks on menu buttons ---
    if (input.clicked) {
      const b = hoverButton();
      if (b === 'start') beginRun();
      else if (b === 'restart') beginRun();
      else if (b === 'resume') {
        world.screen = 'playing';
        sfx.startMusic();
      } else if (b === 'menu') toTitle();
      else if (world.screen === 'title' || world.screen === 'win' || world.screen === 'lose') {
        sfx.ensure();
      }
    }

    // --- simulate (skip the frame a run begins) ---
    if (justBegan) {
      justBegan = false;
    } else {
      const events = updateWorld(world, input, dt);
      handleEvents(events);
    }
  }

  render(ctx, world, t, hoverButton());
  input.endFrame();
  requestAnimationFrame(frame);

  // Screenshot mode: signal readiness after the first painted frame.
  if (shotMode && !window.__shotReady) {
    window.__shotReady = true;
    window.__shot = shotName;
  }
}

requestAnimationFrame(frame);
