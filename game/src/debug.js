// Screenshot staging, used only by the maker's own screenshot script.
// `?scene=play` drops the player into a busy wave-3 fight, `?scene=victory`
// and `?scene=gameover` open the real end screens with plausible stats, and
// `?scene=shop` opens the salvage shop. These states are produced through the
// game's own state machine and rendering — no pixels are faked — so the
// screenshots stay honest renders of the game itself.

import { STATES } from './world.js';
import { ENEMIES } from './config.js';

export function applySceneParam(world, params) {
  const scene = params.get('scene');
  if (!scene) return false;
  if (scene === 'play') {
    world.startRun();
    world.wave = 3;
    // A busy mid-wave-3 scene: weavers, drones and a brute already fighting.
    const spots = [
      ['weaver', 300, 160], ['weaver', 980, 200], ['drone', 420, 120],
      ['drone', 860, 140], ['drone', 640, 90], ['brute', 640, 220],
      ['drone', 220, 320], ['weaver', 1080, 330],
    ];
    for (const [type, x, y] of spots) {
      const e = world.spawnOne(type);
      e.x = x;
      e.y = y;
      e.spawnT = 0.45;
    }
    world.spawnQueue = ['drone', 'drone', 'weaver', 'brute'];
    world.score = 18450;
    world.salvage = 37;
    world.kills = 42;
    world.combo = 7;
    world.comboTimer = 3.5;
    world.player.x = 640;
    world.player.y = 480;
    world.player.hull = 78;
    world.player.shield = 31;
    for (let i = 0; i < 14; i++) {
      world.particles.burst(300 + (i % 7) * 110, 140 + Math.floor(i / 7) * 160, '#5df2ff', 4, 120, 2.5, 0.8);
    }
    return true;
  }
  if (scene === 'victory' || scene === 'gameover') {
    world.startRun();
    world.score = 48250;
    world.kills = 138;
    world.bestCombo = 12;
    world.playTime = 642;
    world.stats = { shotsFired: 2100, shotsHit: 1491, damageDealt: 31200 };
    world.wave = scene === 'victory' ? 10 : 6;
    world.finishRun(scene === 'victory');
    return true;
  }
  if (scene === 'shop') {
    world.startRun();
    world.wave = 2;
    world.score = 8450;
    world.salvage = 63;
    world.kills = 21;
    world.player.hull = 64;
    world.openShop();
    world.showBanner('WAVE CLEARED', 'Spend salvage — next wave starts soon', 2.2);
    return true;
  }
  if (scene === 'boss') {
    world.startRun();
    world.startWave(10);
    world.spawnQueue = world.spawnQueue.filter((t) => t !== 'boss'); // one Leviathan only
    const boss = world.spawnOne('boss');
    boss.x = 640;
    boss.y = 170;
    boss.spawnT = 0.45;
    boss.hull = Math.round(boss.hullMax * 0.55);
    world.score = 42100;
    world.salvage = 88;
    world.kills = 121;
    world.player.x = 640;
    world.player.y = 520;
    return true;
  }
  return false;
}

// Hit-test the shop cards against a click, in the same geometry render.js draws.
export function shopCardAt(world, mx, my) {
  if (world.state !== STATES.SHOP) return null;
  const cardW = 140;
  const cardH = 190;
  const gap = 12;
  const totalW = 5 * cardW + 4 * gap;
  const startX = (1280 - totalW) / 2;
  const cardY = 120 + 126;
  if (my < cardY || my > cardY + cardH) return null;
  for (let i = 0; i < 5; i++) {
    const x = startX + i * (cardW + gap);
    if (mx >= x && mx <= x + cardW) return i;
  }
  return null;
}

export { ENEMIES };
