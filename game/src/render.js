// All canvas drawing for Lumen Harvest: the garden arena, the lantern-ship,
// motes, wisps, mines, pickups, the HUD, and the title / pause / win /
// lose screens. Drawing only reads world state; it never mutates it.

import { ARENA_W, ARENA_H, TOTAL_WAVES, MAX_HULL, quotaForWave } from './world.js';

export const BUTTONS = {
  start: { x: 380, y: 452, w: 200, h: 54, label: 'START HARVEST' },
  restart: { x: 380, y: 462, w: 200, h: 54, label: 'PLAY AGAIN' },
  resume: { x: 380, y: 330, w: 200, h: 54, label: 'RESUME' },
  menu: { x: 380, y: 398, w: 200, h: 54, label: 'TITLE SCREEN' },
};

export function hitButton(b, x, y) {
  return x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h;
}

function glowCircle(ctx, x, y, r, color, alpha) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, color);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.globalAlpha = alpha;
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
}

function drawButton(ctx, b, hover) {
  ctx.save();
  ctx.fillStyle = hover ? '#fbbf24' : '#f59e0b';
  ctx.strokeStyle = '#fef3c7';
  ctx.lineWidth = 2;
  roundRect(ctx, b.x, b.y, b.w, b.h, 10);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#1e1b0a';
  ctx.font = 'bold 20px "Trebuchet MS", Verdana, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(b.label, b.x + b.w / 2, b.y + b.h / 2 + 1);
  ctx.restore();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawBackground(ctx, world, t) {
  const bg = ctx.createLinearGradient(0, 0, 0, ARENA_H);
  bg.addColorStop(0, '#0a0c26');
  bg.addColorStop(0.6, '#101238');
  bg.addColorStop(1, '#0b1f2e');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, ARENA_W, ARENA_H);

  // Twinkling stars.
  for (const s of world.stars) {
    const a = 0.25 + 0.55 * Math.abs(Math.sin(t * 0.8 + s.tw));
    ctx.globalAlpha = a;
    ctx.fillStyle = '#e2e8f0';
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Soft garden mounds along the bottom.
  ctx.fillStyle = '#0d2b1d';
  ctx.beginPath();
  ctx.moveTo(0, ARENA_H);
  ctx.lineTo(0, 540);
  ctx.quadraticCurveTo(180, 500, 360, 545);
  ctx.quadraticCurveTo(560, 580, 720, 540);
  ctx.quadraticCurveTo(860, 510, ARENA_W, 548);
  ctx.lineTo(ARENA_W, ARENA_H);
  ctx.closePath();
  ctx.fill();

  // Arena border.
  ctx.strokeStyle = 'rgba(251, 191, 36, 0.35)';
  ctx.lineWidth = 2;
  ctx.strokeRect(6, 40, ARENA_W - 12, ARENA_H - 46);
}

function drawPlayer(ctx, world, t) {
  const p = world.player;
  const flicker = 0.85 + 0.15 * Math.sin(t * 9);
  const shielded = world.shieldTimer > 0;
  const dashing = world.dashTime > 0;

  // Warm lantern glow.
  glowCircle(ctx, p.x, p.y, 64 * flicker, 'rgba(251, 191, 36, 0.55)', 0.8);
  if (shielded) glowCircle(ctx, p.x, p.y, 44, 'rgba(56, 189, 248, 0.5)', 0.7);

  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.angle + Math.PI / 2);
  if (dashing) {
    ctx.fillStyle = 'rgba(125, 211, 252, 0.7)';
    ctx.beginPath();
    ctx.moveTo(0, 26);
    ctx.lineTo(-9, 12);
    ctx.lineTo(9, 12);
    ctx.closePath();
    ctx.fill();
  }
  // Hull: a little lantern-ship.
  ctx.fillStyle = '#f59e0b';
  ctx.beginPath();
  ctx.moveTo(0, -16);
  ctx.lineTo(11, 8);
  ctx.lineTo(6, 14);
  ctx.lineTo(-6, 14);
  ctx.lineTo(-11, 8);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#78350f';
  ctx.fillRect(-7, -20, 14, 5);
  // Flame inside.
  ctx.fillStyle = '#fef3c7';
  ctx.beginPath();
  ctx.arc(0, 0, 5.5 * flicker, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fbbf24';
  ctx.beginPath();
  ctx.arc(0, 1, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  if (shielded) {
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.85)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 26 + 2 * Math.sin(t * 5), 0, Math.PI * 2);
    ctx.stroke();
  }
}

function drawMote(ctx, m, t) {
  const pulse = 1 + 0.18 * Math.sin(m.phase);
  glowCircle(ctx, m.x, m.y, 30 * pulse, 'rgba(251, 191, 36, 0.5)', 0.9);
  ctx.fillStyle = '#fde68a';
  ctx.beginPath();
  ctx.arc(m.x, m.y, m.r * pulse, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#f59e0b';
  ctx.beginPath();
  ctx.arc(m.x, m.y, m.r * 0.55 * pulse, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fffbeb';
  ctx.beginPath();
  ctx.arc(m.x - 2.5, m.y - 2.5, 2.2, 0, Math.PI * 2);
  ctx.fill();
}

function drawWisp(ctx, w, t) {
  const pulse = 1 + 0.12 * Math.sin(t * 6 + w.wobble);
  glowCircle(ctx, w.x, w.y, 42 * pulse, 'rgba(192, 132, 252, 0.45)', 0.85);
  ctx.fillStyle = `hsl(${w.hue}, 70%, 62%)`;
  ctx.beginPath();
  ctx.arc(w.x, w.y, w.r * pulse, 0, Math.PI * 2);
  ctx.fill();
  // Smoky tail.
  ctx.fillStyle = `hsla(${w.hue}, 70%, 45%, 0.55)`;
  ctx.beginPath();
  ctx.arc(w.x - Math.cos(w.wobble) * 10, w.y + 12, 6, 0, Math.PI * 2);
  ctx.fill();
  // Eyes.
  ctx.fillStyle = '#1e1b4b';
  ctx.beginPath();
  ctx.arc(w.x - 4.5, w.y - 2, 2.4, 0, Math.PI * 2);
  ctx.arc(w.x + 4.5, w.y - 2, 2.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#f5f3ff';
  ctx.beginPath();
  ctx.arc(w.x - 3.8, w.y - 2.8, 0.9, 0, Math.PI * 2);
  ctx.arc(w.x + 5.2, w.y - 2.8, 0.9, 0, Math.PI * 2);
  ctx.fill();
}

function drawMine(ctx, m, t) {
  const pulse = 1 + 0.1 * Math.sin(m.phase);
  glowCircle(ctx, m.x, m.y, 30, 'rgba(248, 113, 113, 0.4)', 0.8);
  ctx.save();
  ctx.translate(m.x, m.y);
  ctx.rotate(m.phase * 0.25);
  ctx.fillStyle = '#b91c1c';
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const a2 = a + Math.PI / 8;
    ctx.lineTo(Math.cos(a) * 15 * pulse, Math.sin(a) * 15 * pulse);
    ctx.lineTo(Math.cos(a2) * 7, Math.sin(a2) * 7);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = '#fecaca';
  ctx.beginPath();
  ctx.arc(m.x, m.y, 4, 0, Math.PI * 2);
  ctx.fill();
}

function drawPickup(ctx, pk, t) {
  const bob = Math.sin(pk.phase) * 3;
  const y = pk.y + bob;
  const blink = pk.life < 3 ? (Math.sin(t * 12) > 0 ? 1 : 0.35) : 1;
  ctx.globalAlpha = blink;
  if (pk.kind === 'heart') {
    glowCircle(ctx, pk.x, y, 30, 'rgba(244, 114, 182, 0.55)', 0.9);
    ctx.fillStyle = '#f472b6';
    ctx.beginPath();
    ctx.moveTo(pk.x, y + 8);
    ctx.bezierCurveTo(pk.x - 12, y - 2, pk.x - 8, y - 11, pk.x, y - 4);
    ctx.bezierCurveTo(pk.x + 8, y - 11, pk.x + 12, y - 2, pk.x, y + 8);
    ctx.fill();
  } else {
    glowCircle(ctx, pk.x, y, 30, 'rgba(56, 189, 248, 0.55)', 0.9);
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(pk.x, y, 10, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#bae6fd';
    ctx.beginPath();
    ctx.arc(pk.x, y, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawParticles(ctx, world) {
  for (const pt of world.particles) {
    ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
    ctx.fillStyle = pt.color;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, pt.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function fmtTime(sec) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function drawHud(ctx, world) {
  // Top bar.
  ctx.fillStyle = 'rgba(4, 6, 24, 0.72)';
  ctx.fillRect(0, 0, ARENA_W, 34);
  ctx.fillStyle = '#fbbf24';
  ctx.font = 'bold 17px "Trebuchet MS", Verdana, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';

  // Hull hearts.
  for (let i = 0; i < MAX_HULL; i++) {
    const x = 24 + i * 26;
    const y = 17;
    ctx.fillStyle = i < world.hull ? '#f472b6' : 'rgba(244, 114, 182, 0.25)';
    ctx.beginPath();
    ctx.moveTo(x, y + 6);
    ctx.bezierCurveTo(x - 9, y - 2, x - 6, y - 9, x, y - 3);
    ctx.bezierCurveTo(x + 6, y - 9, x + 9, y - 2, x, y + 6);
    ctx.fill();
  }

  ctx.fillStyle = '#fef3c7';
  ctx.fillText(`SCORE ${world.score}`, 120, 18);
  ctx.fillStyle = world.combo > 1 ? '#fbbf24' : '#94a3b8';
  ctx.fillText(world.combo > 1 ? `COMBO x${world.combo}` : 'COMBO —', 268, 18);
  ctx.fillStyle = '#e2e8f0';
  ctx.fillText(`WAVE ${world.wave}/${TOTAL_WAVES}`, 420, 18);

  // Quota progress bar.
  const quota = quotaForWave(world.wave);
  const bx = 540;
  const bw = 170;
  ctx.fillStyle = 'rgba(148, 163, 184, 0.35)';
  roundRect(ctx, bx, 10, bw, 14, 7);
  ctx.fill();
  ctx.fillStyle = '#fbbf24';
  const frac = Math.min(1, world.waveCollected / quota);
  if (frac > 0) {
    roundRect(ctx, bx, 10, bw * frac, 14, 7);
    ctx.fill();
  }
  ctx.fillStyle = '#e2e8f0';
  ctx.font = '13px "Trebuchet MS", Verdana, sans-serif';
  ctx.fillText(`MOTES ${world.waveCollected}/${quota}`, bx + 8, 18);

  // Dash cooldown pip + timer.
  const dashReady = world.dashCooldown <= 0;
  ctx.fillStyle = dashReady ? '#7dd3fc' : 'rgba(125, 211, 252, 0.35)';
  ctx.beginPath();
  ctx.arc(748, 17, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#e2e8f0';
  ctx.font = '13px "Trebuchet MS", Verdana, sans-serif';
  ctx.fillText(dashReady ? 'DASH READY' : 'DASH…', 760, 18);
  if (world.shieldTimer > 0) {
    ctx.fillStyle = '#38bdf8';
    ctx.fillText(`SHIELD ${Math.ceil(world.shieldTimer)}s`, 850, 18);
  } else {
    ctx.fillStyle = '#e2e8f0';
    ctx.fillText(fmtTime(world.time), 886, 18);
  }

  // Combo timer bar under the top bar.
  if (world.combo > 0 && world.comboTimer > 0) {
    const cw = 120 * (world.comboTimer / 3);
    ctx.fillStyle = '#fbbf24';
    ctx.fillRect(268, 36, cw, 4);
  }

  // Wave banner.
  if (world.bannerTimer > 0) {
    ctx.globalAlpha = Math.min(1, world.bannerTimer);
    ctx.fillStyle = '#fef3c7';
    ctx.font = 'bold 26px "Trebuchet MS", Verdana, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(world.banner, ARENA_W / 2, 96);
    ctx.globalAlpha = 1;
  }
}

function drawTitle(ctx, world, t, hover) {
  ctx.fillStyle = 'rgba(4, 6, 24, 0.55)';
  ctx.fillRect(0, 0, ARENA_W, ARENA_H);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fbbf24';
  ctx.font = 'bold 64px "Trebuchet MS", Verdana, sans-serif';
  ctx.shadowColor = '#f59e0b';
  ctx.shadowBlur = 24;
  ctx.fillText('LUMEN HARVEST', ARENA_W / 2, 150);
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#fef3c7';
  ctx.font = '22px "Trebuchet MS", Verdana, sans-serif';
  ctx.fillText('Pilot the last lantern-ship. Gather the light. Dodge the dark.', ARENA_W / 2, 196);

  ctx.fillStyle = '#e2e8f0';
  ctx.font = '17px "Trebuchet MS", Verdana, sans-serif';
  const lines = [
    'MOVE — WASD / Arrow keys, or steer with the mouse',
    'DASH — Space or Click (dash through a wisp to banish it)',
    'HARVEST the gold motes to fill each wave’s quota — 5 waves to win',
    'VOID WISPS chase you · THORN MINES bite · 3 hull hearts',
    'Chain pickups for a COMBO multiplier · Hearts and shields appear',
    'P pause · M mute · R restart',
  ];
  lines.forEach((line, i) => ctx.fillText(line, ARENA_W / 2, 248 + i * 28));

  drawButton(ctx, BUTTONS.start, hover === 'start');
  ctx.fillStyle = '#94a3b8';
  ctx.font = '15px "Trebuchet MS", Verdana, sans-serif';
  ctx.fillText('or press Enter', ARENA_W / 2, 534);
  if (world.best > 0) {
    ctx.fillStyle = '#fbbf24';
    ctx.font = 'bold 16px "Trebuchet MS", Verdana, sans-serif';
    ctx.fillText(`BEST SCORE ${world.best}`, ARENA_W / 2, 566);
  }
}

function drawPause(ctx, hover) {
  ctx.fillStyle = 'rgba(4, 6, 24, 0.7)';
  ctx.fillRect(0, 0, ARENA_W, ARENA_H);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fef3c7';
  ctx.font = 'bold 44px "Trebuchet MS", Verdana, sans-serif';
  ctx.fillText('PAUSED', ARENA_W / 2, 220);
  ctx.fillStyle = '#94a3b8';
  ctx.font = '17px "Trebuchet MS", Verdana, sans-serif';
  ctx.fillText('Take a breath — the dark waits for no one, but it waits for you.', ARENA_W / 2, 262);
  drawButton(ctx, BUTTONS.resume, hover === 'resume');
  drawButton(ctx, BUTTONS.menu, hover === 'menu');
}

function drawEnd(ctx, world, won, hover) {
  ctx.fillStyle = won ? 'rgba(20, 40, 10, 0.72)' : 'rgba(40, 8, 16, 0.72)';
  ctx.fillRect(0, 0, ARENA_W, ARENA_H);
  ctx.textAlign = 'center';
  ctx.fillStyle = won ? '#fbbf24' : '#f87171';
  ctx.font = 'bold 52px "Trebuchet MS", Verdana, sans-serif';
  ctx.shadowColor = won ? '#f59e0b' : '#b91c1c';
  ctx.shadowBlur = 20;
  ctx.fillText(won ? 'THE GARDEN GLOWS AGAIN' : 'THE LIGHT GOES OUT', ARENA_W / 2, 150);
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#fef3c7';
  ctx.font = '24px "Trebuchet MS", Verdana, sans-serif';
  ctx.fillText(won ? 'All five waves harvested. You win!' : `The dark took the lantern on wave ${world.wave}.`, ARENA_W / 2, 198);

  const s = world.stats;
  ctx.fillStyle = '#e2e8f0';
  ctx.font = '19px "Trebuchet MS", Verdana, sans-serif';
  const rows = [
    `SCORE  ${s.score}`,
    `TIME  ${fmtTime(s.time)}`,
    `MOTES HARVESTED  ${s.motes}`,
    `BEST COMBO  x${Math.max(1, s.maxCombo)}`,
    `WAVES CLEARED  ${s.wavesCleared}/${TOTAL_WAVES}`,
  ];
  rows.forEach((row, i) => ctx.fillText(row, ARENA_W / 2, 252 + i * 30));

  drawButton(ctx, BUTTONS.restart, hover === 'restart');
  ctx.fillStyle = '#94a3b8';
  ctx.font = '15px "Trebuchet MS", Verdana, sans-serif';
  ctx.fillText('or press R to play again', ARENA_W / 2, 542);
}

// The one entry point: draws the whole frame for the current screen.
export function render(ctx, world, t, hover) {
  drawBackground(ctx, world, t);
  for (const m of world.motes) drawMote(ctx, m, t);
  for (const m of world.mines) drawMine(ctx, m, t);
  for (const pk of world.pickups) drawPickup(ctx, pk, t);
  for (const w of world.wisps) drawWisp(ctx, w, t);
  drawParticles(ctx, world);
  if (world.screen !== 'title') drawPlayer(ctx, world, t);
  if (world.screen === 'playing' || world.screen === 'paused') drawHud(ctx, world);
  if (world.screen === 'title') drawTitle(ctx, world, t, hover);
  if (world.screen === 'paused') drawPause(ctx, hover);
  if (world.screen === 'win') drawEnd(ctx, world, true, hover);
  if (world.screen === 'lose') drawEnd(ctx, world, false, hover);
}
