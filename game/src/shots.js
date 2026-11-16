// Deterministic screenshot states for `?shot=start|play|win|lose&seed=N`.
// Each state stages a fixed, readable scene and freezes simulation so a
// capture is reproducible. Real gameplay never uses this module.

import { makeRng, range } from './random.js';
import { quotaForWave } from './world.js';

function scatter(rng, world, count, kind) {
  for (let i = 0; i < count; i++) {
    const x = range(rng, 70, 890);
    const y = range(rng, 90, 540);
    if (kind === 'mote') {
      world.motes.push({ x, y, r: 9, phase: rng() * 6.28, drift: 8, driftDir: rng() * 6.28 });
    } else if (kind === 'wisp') {
      world.wisps.push({ x, y, r: 13, speed: 90, wobble: rng() * 6.28, hue: range(rng, 275, 305) });
    } else {
      world.mines.push({ x, y, r: 12, phase: rng() * 6.28 });
    }
  }
}

// Stages a shot and freezes the world. Returns true when the shot name is known.
export function applyShot(world, shot, seed) {
  const rng = makeRng(seed);
  world.frozen = true;
  world.motes = [];
  world.wisps = [];
  world.mines = [];
  world.pickups = [];
  world.particles = [];

  if (shot === 'start') {
    world.screen = 'title';
    world.best = 1250;
    world.player.x = 480;
    world.player.y = 380;
    scatter(rng, world, 9, 'mote');
    scatter(rng, world, 2, 'wisp');
    scatter(rng, world, 1, 'mine');
    return true;
  }

  if (shot === 'play') {
    world.screen = 'playing';
    world.wave = 2;
    world.score = 1250;
    world.combo = 4;
    world.comboTimer = 2.1;
    world.maxCombo = 4;
    world.motesCollected = 17;
    world.waveCollected = 7;
    world.hull = 2;
    world.time = 74;
    world.dashCooldown = 0;
    world.shieldTimer = 0;
    world.banner = 'WAVE 2 — HARVEST 12 MOTES';
    world.bannerTimer = 99; // banner stays visible in the frozen shot
    world.player.x = 430;
    world.player.y = 330;
    world.player.vx = 120;
    world.player.vy = -60;
    world.player.angle = -0.46;
    scatter(rng, world, 8, 'mote');
    scatter(rng, world, 3, 'wisp');
    scatter(rng, world, 4, 'mine');
    world.pickups.push({ x: 700, y: 210, r: 12, kind: 'shield', phase: 1.2, life: 9 });
    return true;
  }

  if (shot === 'win') {
    world.screen = 'win';
    world.score = 4860;
    world.stats = { time: 312, motes: 70, maxCombo: 8, wavesCleared: 5, score: 4860 };
    world.best = 4860;
    world.player.x = 480;
    world.player.y = 380;
    scatter(rng, world, 12, 'mote');
    return true;
  }

  if (shot === 'lose') {
    world.screen = 'lose';
    world.wave = 3;
    world.score = 1980;
    world.stats = { time: 187, motes: 34, maxCombo: 5, wavesCleared: 2, score: 1980 };
    world.best = 4860;
    world.hull = 0;
    world.player.x = 480;
    world.player.y = 380;
    scatter(rng, world, 5, 'mote');
    scatter(rng, world, 3, 'wisp');
    return true;
  }

  return false;
}

export { quotaForWave };
