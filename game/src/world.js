// Game state and rules for Lumen Harvest. Pure logic: no drawing, no audio
// calls except through the events this module returns to main.js.
// The arena is 960x600. The player is a lantern-ship harvesting light
// motes; void wisps chase it, thorn mines guard the field. Fill the Core
// quota for 5 waves to win; lose all 3 hull hearts and the light goes out.

import { makeRng, range, clamp, dist2 } from './random.js';

export const ARENA_W = 960;
export const ARENA_H = 600;
export const TOTAL_WAVES = 5;
export const MAX_HULL = 3;
export const COMBO_WINDOW = 3.0;

export function quotaForWave(wave) {
  return 8 + wave * 2; // wave 1: 10, wave 5: 18
}

export function wispCountForWave(wave) {
  return Math.min(1 + Math.floor(wave / 2), 5);
}

export function mineCountForWave(wave) {
  return 2 + wave;
}

export function createWorld(seed = 20261117) {
  const rng = makeRng(seed);
  const world = {
    seed,
    rng,
    screen: 'title', // title | playing | paused | win | lose
    time: 0, // seconds of active play
    frozen: false, // screenshot mode: state is staged, not simulated
    wave: 1,
    score: 0,
    combo: 0,
    comboTimer: 0,
    maxCombo: 0,
    motesCollected: 0,
    waveCollected: 0,
    hull: MAX_HULL,
    dashCooldown: 0,
    dashTime: 0,
    shieldTimer: 0,
    banner: '', // transient centre message
    bannerTimer: 0,
    pickupTimer: 12, // seconds until the next bonus pickup spawns
    player: {
      x: ARENA_W / 2, y: ARENA_H / 2,
      vx: 0, vy: 0, r: 14,
      angle: -Math.PI / 2, faceX: 0, faceY: -1,
    },
    motes: [],
    wisps: [],
    mines: [],
    pickups: [],
    particles: [],
    stars: [],
    stats: { time: 0, motes: 0, maxCombo: 0, wavesCleared: 0, score: 0 },
    best: 0,
  };
  for (let i = 0; i < 90; i++) {
    world.stars.push({
      x: rng() * ARENA_W, y: rng() * ARENA_H,
      r: range(rng, 0.6, 2.0), tw: range(rng, 0, Math.PI * 2),
    });
  }
  return world;
}

export function startRun(world) {
  world.screen = 'playing';
  world.time = 0;
  world.wave = 1;
  world.score = 0;
  world.combo = 0;
  world.comboTimer = 0;
  world.maxCombo = 0;
  world.motesCollected = 0;
  world.waveCollected = 0;
  world.hull = MAX_HULL;
  world.dashCooldown = 0;
  world.dashTime = 0;
  world.shieldTimer = 0;
  world.pickupTimer = 12;
  world.player.x = ARENA_W / 2;
  world.player.y = ARENA_H / 2;
  world.player.vx = 0;
  world.player.vy = 0;
  world.motes = [];
  world.wisps = [];
  world.mines = [];
  world.pickups = [];
  world.particles = [];
  world.banner = 'WAVE 1 — HARVEST 10 MOTES';
  world.bannerTimer = 2.2;
  spawnWaveField(world);
}

function spawnWaveField(world) {
  const { rng } = world;
  const quota = quotaForWave(world.wave);
  for (let i = 0; i < Math.min(quota, 12); i++) spawnMote(world);
  for (let i = 0; i < wispCountForWave(world.wave); i++) spawnWisp(world);
  for (let i = 0; i < mineCountForWave(world.wave); i++) spawnMine(world);
}

function farFromPlayer(world, x, y, minDist) {
  return dist2(x, y, world.player.x, world.player.y) > minDist * minDist;
}

function spawnMote(world) {
  const { rng } = world;
  let x = 0;
  let y = 0;
  for (let tries = 0; tries < 12; tries++) {
    x = range(rng, 40, ARENA_W - 40);
    y = range(rng, 70, ARENA_H - 40);
    if (farFromPlayer(world, x, y, 60)) break;
  }
  world.motes.push({
    x, y, r: 9,
    phase: rng() * Math.PI * 2,
    drift: range(rng, 4, 14),
    driftDir: rng() * Math.PI * 2,
  });
}

function spawnWisp(world) {
  const { rng } = world;
  let x = 0;
  let y = 0;
  for (let tries = 0; tries < 12; tries++) {
    x = range(rng, 50, ARENA_W - 50);
    y = range(rng, 80, ARENA_H - 50);
    if (farFromPlayer(world, x, y, 260)) break;
  }
  world.wisps.push({
    x, y, r: 13,
    speed: 66 + world.wave * 17,
    wobble: rng() * Math.PI * 2,
    hue: range(rng, 275, 305),
  });
}

function spawnMine(world) {
  const { rng } = world;
  let x = 0;
  let y = 0;
  for (let tries = 0; tries < 12; tries++) {
    x = range(rng, 50, ARENA_W - 50);
    y = range(rng, 80, ARENA_H - 50);
    if (farFromPlayer(world, x, y, 120)) break;
  }
  world.mines.push({ x, y, r: 12, phase: rng() * Math.PI * 2 });
}

function spawnPickup(world, kind) {
  const { rng } = world;
  const x = range(rng, 60, ARENA_W - 60);
  const y = range(rng, 90, ARENA_H - 60);
  world.pickups.push({ x, y, r: 12, kind, phase: rng() * Math.PI * 2, life: 10 });
}

function burst(world, x, y, color, n, speed) {
  for (let i = 0; i < n; i++) {
    const a = world.rng() * Math.PI * 2;
    const s = range(world.rng, speed * 0.3, speed);
    world.particles.push({
      x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
      life: range(world.rng, 0.3, 0.7), maxLife: 0.7,
      r: range(world.rng, 2, 4.5), color,
    });
  }
}

// One fixed step. Returns a list of event names main.js turns into sounds
// and screen changes: pickup, banish, hit, heart, shield, dash, wave, win, lose.
export function updateWorld(world, input, dt) {
  const events = [];
  if (world.screen !== 'playing' || world.frozen) return events;
  world.time += dt;
  const p = world.player;

  // --- movement: keys steer, mouse pulls the ship toward the pointer ---
  const axis = input.moveAxis();
  if (input.hasMoveKeys()) {
    const len = Math.hypot(axis.x, axis.y) || 1;
    p.vx += (axis.x / len) * 1500 * dt;
    p.vy += (axis.y / len) * 1500 * dt;
  } else if (input.mouseActive) {
    const dx = input.mouseX - p.x;
    const dy = input.mouseY - p.y;
    const d = Math.hypot(dx, dy);
    if (d > 6) {
      p.vx += (dx / d) * 1150 * dt;
      p.vy += (dy / d) * 1150 * dt;
    }
  }
  p.vx *= Math.pow(0.12, dt);
  p.vy *= Math.pow(0.12, dt);
  const speed = Math.hypot(p.vx, p.vy);
  const maxSpeed = world.dashTime > 0 ? 780 : 265;
  if (speed > maxSpeed) {
    p.vx = (p.vx / speed) * maxSpeed;
    p.vy = (p.vy / speed) * maxSpeed;
  }
  p.x = clamp(p.x + p.vx * dt, p.r, ARENA_W - p.r);
  p.y = clamp(p.y + p.vy * dt, p.r + 34, ARENA_H - p.r);
  if (speed > 24) {
    p.faceX = p.vx / speed;
    p.faceY = p.vy / speed;
    p.angle = Math.atan2(p.faceY, p.faceX);
  }

  // --- dash: Space or click. Brief burst + invulnerability; banishes wisps ---
  world.dashCooldown = Math.max(0, world.dashCooldown - dt);
  world.dashTime = Math.max(0, world.dashTime - dt);
  const wantDash = input.wasPressed('Space') || input.clicked;
  if (wantDash && world.dashCooldown <= 0) {
    world.dashTime = 0.18;
    world.dashCooldown = 1.6;
    events.push('dash');
    // Dash along the facing direction; with the mouse, dash toward the
    // pointer instead, so a standing-still player still dashes somewhere
    // they meant.
    let dx = p.faceX;
    let dy = p.faceY;
    if (input.mouseActive && !input.hasMoveKeys()) {
      const mdx = input.mouseX - p.x;
      const mdy = input.mouseY - p.y;
      const md = Math.hypot(mdx, mdy);
      if (md > 12) {
        dx = mdx / md;
        dy = mdy / md;
      }
    }
    p.vx = dx * 780;
    p.vy = dy * 780;
    burst(world, p.x, p.y, '#7dd3fc', 10, 160);
  }

  world.shieldTimer = Math.max(0, world.shieldTimer - dt);
  const invulnerable = world.dashTime > 0 || world.shieldTimer > 0;

  // --- combo decay ---
  if (world.comboTimer > 0) {
    world.comboTimer -= dt;
    if (world.comboTimer <= 0) world.combo = 0;
  }

  // --- motes: drift, collect on touch ---
  for (let i = world.motes.length - 1; i >= 0; i--) {
    const m = world.motes[i];
    m.phase += dt * 2;
    m.x += Math.cos(m.driftDir) * m.drift * dt;
    m.y += Math.sin(m.driftDir) * m.drift * dt;
    if (m.x < 30 || m.x > ARENA_W - 30) m.driftDir = Math.PI - m.driftDir;
    if (m.y < 60 || m.y > ARENA_H - 30) m.driftDir = -m.driftDir;
    const rr = m.r + p.r + 4;
    if (dist2(m.x, m.y, p.x, p.y) < rr * rr) {
      world.motes.splice(i, 1);
      world.combo = world.comboTimer > 0 ? Math.min(world.combo + 1, 8) : 1;
      world.comboTimer = COMBO_WINDOW;
      world.maxCombo = Math.max(world.maxCombo, world.combo);
      world.score += 10 * world.combo;
      world.motesCollected++;
      world.waveCollected++;
      burst(world, m.x, m.y, '#fbbf24', 8, 120);
      events.push('pickup');
      if (world.motes.length < 10 && world.waveCollected < quotaForWave(world.wave)) {
        spawnMote(world);
      }
    }
  }

  // --- wave complete? ---
  if (world.waveCollected >= quotaForWave(world.wave)) {
    const bonus = 100 * world.wave;
    world.score += bonus;
    world.stats.wavesCleared = world.wave;
    if (world.wave >= TOTAL_WAVES) {
      finishRun(world, true);
      events.push('win');
      return events;
    }
    world.wave++;
    world.waveCollected = 0;
    world.banner = `WAVE ${world.wave} — HARVEST ${quotaForWave(world.wave)} MOTES  ·  BONUS +${bonus}`;
    world.bannerTimer = 2.4;
    world.motes = [];
    world.wisps = [];
    world.mines = [];
    world.pickups = [];
    spawnWaveField(world);
    events.push('wave');
  }

  // --- wisps: chase with a wobble; dash through one to banish it ---
  for (let i = world.wisps.length - 1; i >= 0; i--) {
    const w = world.wisps[i];
    w.wobble += dt * 2.4;
    const dx = p.x - w.x;
    const dy = p.y - w.y;
    const d = Math.hypot(dx, dy) || 1;
    const wob = Math.sin(w.wobble) * 0.5;
    const ax = dx / d + Math.cos(w.wobble) * wob * 0.4;
    const ay = dy / d + Math.sin(w.wobble) * wob * 0.4;
    const al = Math.hypot(ax, ay) || 1;
    w.x += (ax / al) * w.speed * dt;
    w.y += (ay / al) * w.speed * dt;
    w.x = clamp(w.x, w.r, ARENA_W - w.r);
    w.y = clamp(w.y, w.r + 34, ARENA_H - w.r);
    const rr = w.r + p.r - 2;
    if (dist2(w.x, w.y, p.x, p.y) < rr * rr) {
      if (world.dashTime > 0) {
        world.wisps.splice(i, 1);
        world.score += 50;
        burst(world, w.x, w.y, '#c084fc', 14, 200);
        events.push('banish');
        if (world.wisps.length < wispCountForWave(world.wave)) spawnWisp(world);
      } else if (!invulnerable) {
        hurtPlayer(world, events);
        world.wisps.splice(i, 1);
        burst(world, w.x, w.y, '#c084fc', 12, 180);
        if (world.wisps.length < wispCountForWave(world.wave)) spawnWisp(world);
        if (world.screen !== 'playing') return events;
      }
    }
  }

  // --- mines: static thorns, hurt on touch (dash is safe through them) ---
  for (const m of world.mines) {
    m.phase += dt * 2;
    const rr = m.r + p.r - 4;
    if (dist2(m.x, m.y, p.x, p.y) < rr * rr && !invulnerable) {
      hurtPlayer(world, events);
      burst(world, p.x, p.y, '#f87171', 12, 180);
      if (world.screen !== 'playing') return events;
      // knock the player away from the mine so one touch is one hit
      const dx = p.x - m.x;
      const dy = p.y - m.y;
      const d = Math.hypot(dx, dy) || 1;
      p.x = clamp(p.x + (dx / d) * 70, p.r, ARENA_W - p.r);
      p.y = clamp(p.y + (dy / d) * 70, p.r + 34, ARENA_H - p.r);
      p.vx = (dx / d) * 320;
      p.vy = (dy / d) * 320;
    }
  }

  // --- bonus pickups: heart (+1 hull) and shield (6 s invulnerable) ---
  world.pickupTimer -= dt;
  if (world.pickupTimer <= 0) {
    world.pickupTimer = 16 + world.rng() * 8;
    spawnPickup(world, world.rng() < 0.45 ? 'heart' : 'shield');
  }
  for (let i = world.pickups.length - 1; i >= 0; i--) {
    const pk = world.pickups[i];
    pk.phase += dt * 2;
    pk.life -= dt;
    if (pk.life <= 0) {
      world.pickups.splice(i, 1);
      continue;
    }
    const rr = pk.r + p.r + 2;
    if (dist2(pk.x, pk.y, p.x, p.y) < rr * rr) {
      world.pickups.splice(i, 1);
      if (pk.kind === 'heart') {
        world.hull = Math.min(MAX_HULL, world.hull + 1);
        events.push('heart');
      } else {
        world.shieldTimer = 6;
        events.push('shield');
      }
      burst(world, pk.x, pk.y, pk.kind === 'heart' ? '#f472b6' : '#38bdf8', 10, 140);
    }
  }

  // --- particles + banner ---
  for (let i = world.particles.length - 1; i >= 0; i--) {
    const pt = world.particles[i];
    pt.life -= dt;
    pt.x += pt.vx * dt;
    pt.y += pt.vy * dt;
    pt.vx *= Math.pow(0.2, dt);
    pt.vy *= Math.pow(0.2, dt);
    if (pt.life <= 0) world.particles.splice(i, 1);
  }
  if (world.bannerTimer > 0) world.bannerTimer -= dt;

  return events;
}

function hurtPlayer(world, events) {
  world.hull--;
  world.combo = 0;
  world.comboTimer = 0;
  world.shieldTimer = 1.2; // brief grace so one hit is one hit
  events.push('hit');
  if (world.hull <= 0) {
    finishRun(world, false);
    events.push('lose');
  }
}

function finishRun(world, won) {
  world.screen = won ? 'win' : 'lose';
  world.stats = {
    time: world.time,
    motes: world.motesCollected,
    maxCombo: world.maxCombo,
    wavesCleared: won ? TOTAL_WAVES : world.wave - 1,
    score: world.score,
  };
  world.best = Math.max(world.best, world.score);
}
