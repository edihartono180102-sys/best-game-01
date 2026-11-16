// The world: game state, wave flow, shop, scoring and collisions.
// main.js owns the loop and rendering; this file owns the rules.

import {
  BOSS_WAVE, COMBO_STEP, COMBO_WINDOW, ENEMIES, FINAL_WAVE, PALETTE,
  PLAYER, SALVAGE_VALUE, SHOP, SHOP_SECONDS, STORAGE_BEST_KEY, VIEW, WAVES,
} from './config.js';
import { Bullet, Enemy, Pickup, Player } from './entities.js';
import { Particles } from './particles.js';
import { clamp, fmt, makeRng, rand, randInt } from './random.js';

export const STATES = {
  TITLE: 'title',
  PLAYING: 'playing',
  SHOP: 'shop',
  PAUSED: 'paused',
  VICTORY: 'victory',
  GAMEOVER: 'gameover',
};

export class World {
  constructor(sound) {
    this.sound = sound;
    this.rng = makeRng();
    this.particles = new Particles(this.rng);
    this.player = new Player();
    this.enemies = [];
    this.bullets = [];
    this.pickups = [];
    this.state = STATES.TITLE;
    this.prevState = STATES.TITLE;
    this.wave = 0;
    this.score = 0;
    this.salvage = 0;
    this.kills = 0;
    this.combo = 0;
    this.comboTimer = 0;
    this.bestCombo = 0;
    this.time = 0;
    this.playTime = 0;
    this.shake = 0;
    this.banner = null; // {text, sub, t, dur}
    this.shopTimer = 0;
    this.shopLevels = {};
    for (const item of SHOP) this.shopLevels[item.id] = 0;
    this.spawnQueue = []; // enemy types waiting to warp in
    this.spawnTimer = 0;
    this.trickle = 1;
    this.boss = null;
    this.bestScore = 0;
    try {
      this.bestScore = Number(window.localStorage.getItem(STORAGE_BEST_KEY) || 0) || 0;
    } catch {
      this.bestScore = 0;
    }
    this.newBest = false;
    this.stats = { shotsFired: 0, shotsHit: 0, damageDealt: 0 };
    this.endStats = null;
  }

  startRun() {
    this.rng = makeRng();
    this.particles = new Particles(this.rng);
    this.player = new Player();
    this.enemies = [];
    this.bullets = [];
    this.pickups = [];
    this.wave = 0;
    this.score = 0;
    this.salvage = 0;
    this.kills = 0;
    this.combo = 0;
    this.comboTimer = 0;
    this.bestCombo = 0;
    this.playTime = 0;
    this.shake = 0;
    this.banner = null;
    this.boss = null;
    this.newBest = false;
    this.endStats = null;
    this.stats = { shotsFired: 0, shotsHit: 0, damageDealt: 0 };
    this.shopLevels = {};
    for (const item of SHOP) this.shopLevels[item.id] = 0;
    this.state = STATES.PLAYING;
    this.startWave(1);
  }

  startWave(n) {
    if (n > WAVES.length) return; // no wave past the final one
    this.wave = n;
    this.state = STATES.PLAYING;
    const def = WAVES[n - 1];
    this.spawnQueue = [];
    for (const [type, count] of def.spawn) {
      for (let i = 0; i < count; i++) this.spawnQueue.push(type);
    }
    // Shuffle so the wave arrives mixed, but the boss always warps in first.
    for (let i = this.spawnQueue.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng() * (i + 1));
      [this.spawnQueue[i], this.spawnQueue[j]] = [this.spawnQueue[j], this.spawnQueue[i]];
    }
    const bossIdx = this.spawnQueue.indexOf('boss');
    if (bossIdx > 0) {
      this.spawnQueue.splice(bossIdx, 1);
      this.spawnQueue.unshift('boss');
    }
    this.trickle = def.trickle;
    this.spawnTimer = 0.6;
    if (n === BOSS_WAVE) {
      this.showBanner('FINAL WAVE', 'The LEVIATHAN has arrived — destroy it to win', 3.2);
      this.sound.bossHorn();
    } else {
      this.showBanner(`WAVE ${n}`, n === 1 ? 'Destroy every hostile ship' : `${this.spawnQueue.length} hostiles inbound`, 2.4);
      this.sound.waveHorn();
    }
  }

  showBanner(text, sub, dur = 2.4) {
    this.banner = { text, sub, t: 0, dur };
  }

  // --- Spawning -----------------------------------------------------------

  spawnOne(type) {
    let x;
    let y;
    if (type === 'boss') {
      x = VIEW.w / 2;
      y = -80;
    } else {
      // Warp in from a random screen edge, away from the player.
      const edge = randInt(this.rng, 0, 3);
      const m = 46;
      if (edge === 0) { x = rand(this.rng, m, VIEW.w - m); y = -m; }
      else if (edge === 1) { x = rand(this.rng, m, VIEW.w - m); y = VIEW.h + m; }
      else if (edge === 2) { x = -m; y = rand(this.rng, m, VIEW.h - m); }
      else { x = VIEW.w + m; y = rand(this.rng, m, VIEW.h - m); }
      if (Math.hypot(x - this.player.x, y - this.player.y) < 220) {
        x = VIEW.w - x;
        y = VIEW.h - y;
      }
    }
    const e = new Enemy(type, x, y, this.rng, this.wave);
    this.enemies.push(e);
    if (type === 'boss') this.boss = e;
    this.particles.ring(x, clamp(y, 20, VIEW.h - 20), ENEMIES[type].color, e.radius + 46);
    return e;
  }

  // --- Combat -------------------------------------------------------------

  firePlayerBullet(aimAngle) {
    const p = this.player;
    const nx = p.x + Math.cos(aimAngle) * (p.radius + 8);
    const ny = p.y + Math.sin(aimAngle) * (p.radius + 8);
    this.bullets.push(new Bullet(nx, ny, aimAngle, PLAYER.bulletSpeed, p.bulletDamage, true, 5, PALETTE.bullet));
    this.stats.shotsFired += 1;
    this.sound.shoot();
    this.particles.sparks(nx, ny, PALETTE.bullet, 2);
  }

  enemyFire(e) {
    const p = this.player;
    if (e.type === 'weaver') {
      const a = Math.atan2(p.y - e.y, p.x - e.x);
      this.bullets.push(new Bullet(e.x, e.y, a, ENEMIES.weaver.bulletSpeed, ENEMIES.weaver.bulletDamage, false, 6, ENEMIES.weaver.color));
      this.sound.enemyShoot();
    } else if (e.type === 'boss') {
      // Radial burst, aimed fan, or aimed spread — rotating pattern.
      const mode = Math.floor(this.time * 0.5) % 3;
      const base = Math.atan2(p.y - e.y, p.x - e.x);
      if (mode === 0) {
        const n = e.rage ? 14 : 10;
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2 + this.time * 0.4;
          this.bullets.push(new Bullet(e.x, e.y, a, ENEMIES.boss.bulletSpeed, ENEMIES.boss.bulletDamage, false, 7, ENEMIES.boss.color));
        }
      } else if (mode === 1) {
        for (let k = -2; k <= 2; k++) {
          this.bullets.push(new Bullet(e.x, e.y, base + k * 0.16, ENEMIES.boss.bulletSpeed + 60, ENEMIES.boss.bulletDamage, false, 7, ENEMIES.boss.color));
        }
      } else {
        for (let k = -1; k <= 1; k++) {
          this.bullets.push(new Bullet(e.x, e.y, base + k * 0.35, ENEMIES.boss.bulletSpeed, ENEMIES.boss.bulletDamage, false, 7, '#ff9f43'));
        }
      }
      this.sound.enemyShoot();
    }
  }

  killEnemy(e, awardScore = true) {
    e.dead = true;
    this.kills += 1;
    this.particles.explosion(e.x, e.y, e.def.color, e.isBoss);
    this.sound.explosion(e.isBoss);
    this.shake = Math.min(18, this.shake + (e.isBoss ? 16 : 5));
    if (awardScore) {
      this.combo += 1;
      this.comboTimer = COMBO_WINDOW;
      this.bestCombo = Math.max(this.bestCombo, this.combo);
      const mult = 1 + Math.min(this.combo - 1, 10) * COMBO_STEP;
      const gained = Math.round(e.score * mult);
      this.score += gained;
      this.particles.floatText(e.x, e.y - e.radius - 6, `+${fmt(gained)}`, '#ffffff', e.isBoss ? 22 : 15);
      if (this.combo >= 5) {
        this.particles.floatText(e.x, e.y - e.radius - 26, `COMBO x${this.combo}`, PALETTE.gold, 14);
      }
    }
    // Salvage shards scatter; brutes and the boss also drop a hull cell.
    const shards = e.isBoss ? 14 : e.salvage;
    for (let i = 0; i < shards; i++) {
      this.pickups.push(new Pickup('salvage', e.x, e.y, SALVAGE_VALUE, this.rng));
    }
    if (e.type === 'brute' || e.isBoss || this.rng() < 0.06) {
      this.pickups.push(new Pickup('hull', e.x, e.y, e.isBoss ? 40 : 18, this.rng));
    }
    if (e.isBoss) {
      this.boss = null;
      this.finishRun(true);
    }
  }

  damagePlayer(amount, sx, sy) {
    const p = this.player;
    if (!p.alive || p.invuln > 0) return;
    const hullDamage = p.takeDamage(amount);
    this.shake = Math.min(16, this.shake + 7);
    this.particles.sparks(p.x, p.y, PALETTE.danger, 10);
    this.sound.hit();
    if (hullDamage > 0) this.particles.floatText(p.x, p.y - 26, `-${Math.round(hullDamage)}`, PALETTE.danger, 15);
    if (!p.alive) {
      this.particles.explosion(p.x, p.y, PALETTE.player, true);
      this.sound.explosion(true);
      this.shake = 22;
      this.finishRun(false);
    }
  }

  collectPickup(pk) {
    pk.dead = true;
    if (pk.kind === 'salvage') {
      this.salvage += pk.value;
      this.sound.pickup();
      this.particles.sparks(pk.x, pk.y, PALETTE.salvage, 4);
    } else {
      this.player.heal(pk.value);
      this.sound.heal();
      this.particles.floatText(pk.x, pk.y - 14, `+${pk.value} HULL`, PALETTE.hullCell, 14);
    }
  }

  // --- Shop ---------------------------------------------------------------

  shopCost(item) {
    const lvl = this.shopLevels[item.id];
    return Math.round(item.cost * Math.pow(item.growth, lvl));
  }

  shopAvailable(item) {
    return this.shopLevels[item.id] < item.max;
  }

  buy(item) {
    if (this.state !== STATES.SHOP) return false;
    if (!this.shopAvailable(item)) return false;
    const cost = this.shopCost(item);
    if (this.salvage < cost) {
      this.sound.denied();
      return false;
    }
    this.salvage -= cost;
    this.shopLevels[item.id] += 1;
    const p = this.player;
    if (item.id === 'repair') p.heal(40);
    else if (item.id === 'damage') p.damageMul *= 1.25;
    else if (item.id === 'rapid') p.fireRateMul *= 1.18;
    else if (item.id === 'shield') {
      p.shieldMax += 25;
      p.shield = p.shieldMax;
    } else if (item.id === 'magnet') p.magnetMul *= 1.6;
    this.sound.buy();
    this.particles.floatText(p.x, p.y - 30, item.name, PALETTE.gold, 16);
    return true;
  }

  openShop() {
    this.state = STATES.SHOP;
    this.shopTimer = SHOP_SECONDS;
    this.showBanner('WAVE CLEARED', 'Spend salvage — next wave starts soon', 2.2);
    this.sound.victory();
  }

  // --- End of run ---------------------------------------------------------

  finishRun(won) {
    const accuracy = this.stats.shotsFired > 0
      ? Math.round((this.stats.shotsHit / this.stats.shotsFired) * 100)
      : 0;
    this.endStats = {
      won,
      score: this.score,
      wave: this.wave,
      kills: this.kills,
      bestCombo: this.bestCombo,
      playTime: this.playTime,
      accuracy,
      salvage: this.salvage,
    };
    this.banner = null; // end screens draw their own panel, no wave banner over it
    if (this.score > this.bestScore) {
      this.bestScore = this.score;
      this.newBest = true;
      try {
        window.localStorage.setItem(STORAGE_BEST_KEY, String(this.score));
      } catch {
        // Storage unavailable: best score just lives for this session.
      }
    }
    this.state = won ? STATES.VICTORY : STATES.GAMEOVER;
    if (won) this.sound.victory();
    else this.sound.defeat();
  }

  // --- Per-frame update ---------------------------------------------------

  update(dt, input) {
    this.time += dt;
    if (this.banner) {
      this.banner.t += dt;
      if (this.banner.t > this.banner.dur) this.banner = null;
    }
    this.shake = Math.max(0, this.shake - dt * 34);
    this.particles.update(dt);

    if (this.state === STATES.TITLE) return;
    if (this.state === STATES.SHOP) {
      this.shopTimer -= dt;
      for (const pk of this.pickups) pk.update(dt, this.player);
      this.pickups = this.pickups.filter((p) => !p.dead);
      if (this.shopTimer <= 0) this.startWave(this.wave + 1);
      return;
    }
    if (this.state !== STATES.PLAYING) return;

    this.playTime += dt;
    const p = this.player;

    // Combo decay.
    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) this.combo = 0;
    }

    // Movement, dash and aim.
    const mv = input.moveVector();
    p.move(mv.x, mv.y, dt);
    p.tickTimers(dt);
    if (input.wasPressed('Space')) {
      if (p.startDash(mv.x, mv.y)) {
        this.sound.dash();
        this.particles.burst(p.x, p.y, PALETTE.player, 14, 260, 3, 0.4);
      }
    }
    const aim = Math.atan2(input.mouseY - p.y, input.mouseX - p.x);
    if (input.mouseDown && p.alive) {
      if (p.tryFire(dt, aim)) this.firePlayerBullet(aim);
    } else {
      p.fireTimer = Math.max(0, p.fireTimer - dt);
    }
    p.angle = aim;

    // Engine trail while thrusting.
    if (p.thrusting && p.alive) {
      p.trailTimer -= dt;
      if (p.trailTimer <= 0) {
        p.trailTimer = 0.03;
        const bx = p.x - Math.cos(p.angle) * p.radius;
        const by = p.y - Math.sin(p.angle) * p.radius;
        this.particles.trail(bx, by, -p.vx, -p.vy, '#3fa9ff', 2.5);
      }
    }

    // Trickle the spawn queue in.
    if (this.spawnQueue.length > 0) {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        this.spawnTimer = this.trickle;
        this.spawnOne(this.spawnQueue.shift());
      }
    }

    // Enemies act and shoot.
    for (const e of this.enemies) {
      e.update(dt, p, this.rng, this.time);
      if (e.spawnT >= 0.45 && e.def.fireInterval > 0 && p.alive) {
        e.fireTimer -= dt;
        if (e.fireTimer <= 0) {
          e.fireTimer = e.isBoss
            ? ENEMIES.boss.fireInterval / (e.rage ? 1.5 : 1)
            : e.def.fireInterval;
          this.enemyFire(e);
        }
      }
      if (e.checkRage()) {
        this.showBanner('LEVIATHAN ENRAGED', 'Its fire quickens — stay moving', 2.4);
        this.sound.bossHorn();
      }
    }

    // Bullets move.
    for (const b of this.bullets) b.update(dt);
    this.bullets = this.bullets.filter((b) => !b.dead);

    // Pickups drift and get collected.
    for (const pk of this.pickups) {
      pk.update(dt, p);
      if (!pk.dead && p.alive) {
        const d2 = (pk.x - p.x) ** 2 + (pk.y - p.y) ** 2;
        const rr = p.radius + pk.radius + 6;
        if (d2 < rr * rr) this.collectPickup(pk);
      }
    }
    this.pickups = this.pickups.filter((pk) => !pk.dead);

    // Friendly bullets vs enemies.
    for (const b of this.bullets) {
      if (b.dead || !b.friendly) continue;
      for (const e of this.enemies) {
        if (e.dead || e.spawnT < 0.45) continue;
        const rr = b.radius + e.radius;
        if ((b.x - e.x) ** 2 + (b.y - e.y) ** 2 < rr * rr) {
          b.dead = true;
          e.hull -= b.damage;
          e.flash = 0.12;
          this.stats.shotsHit += 1;
          this.stats.damageDealt += b.damage;
          this.particles.sparks(b.x, b.y, e.def.color, 5);
          if (e.hull <= 0) this.killEnemy(e);
          break;
        }
      }
    }

    // Enemy bullets vs player.
    for (const b of this.bullets) {
      if (b.dead || b.friendly || !p.alive) continue;
      const rr = b.radius + p.radius - 2;
      if ((b.x - p.x) ** 2 + (b.y - p.y) ** 2 < rr * rr) {
        b.dead = true;
        this.damagePlayer(b.damage, b.x, b.y);
      }
    }

    // Touch damage.
    for (const e of this.enemies) {
      if (e.dead || e.spawnT < 0.45 || !p.alive) continue;
      const rr = e.radius + p.radius - 2;
      if ((e.x - p.x) ** 2 + (e.y - p.y) ** 2 < rr * rr) {
        this.damagePlayer(e.touchDamage, e.x, e.y);
        // The rammed enemy bounces off so it cannot drain the hull in one frame.
        const a = Math.atan2(e.y - p.y, e.x - p.x);
        e.x = p.x + Math.cos(a) * (rr + 2);
        e.y = p.y + Math.sin(a) * (rr + 2);
        e.vx = Math.cos(a) * 160;
        e.vy = Math.sin(a) * 160;
      }
    }

    this.enemies = this.enemies.filter((e) => !e.dead);
    this.bullets = this.bullets.filter((b) => !b.dead);

    // Wave cleared: no enemies left and nothing left to spawn.
    if (this.spawnQueue.length === 0 && this.enemies.length === 0 && p.alive) {
      if (this.wave >= FINAL_WAVE) {
        // The boss is dead; finishRun already ran.
      } else {
        const bonus = 250 * this.wave;
        this.score += bonus;
        this.particles.floatText(p.x, p.y - 34, `WAVE BONUS +${fmt(bonus)}`, PALETTE.gold, 17);
        this.openShop();
      }
    }
  }
}
