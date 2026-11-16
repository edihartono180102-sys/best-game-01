// The actors: player ship, enemy ships, bullets and pickups.
// Entities hold state and movement; collisions and waves live in world.js.

import { ENEMIES, PLAYER, VIEW } from './config.js';
import { clamp, rand, turnToward } from './random.js';

let NEXT_ID = 1;

export class Player {
  constructor() {
    this.id = NEXT_ID++;
    this.x = VIEW.w / 2;
    this.y = VIEW.h * 0.62;
    this.vx = 0;
    this.vy = 0;
    this.angle = -Math.PI / 2;
    this.radius = PLAYER.radius;
    this.hull = PLAYER.hullMax;
    this.hullMax = PLAYER.hullMax;
    this.shield = PLAYER.shieldMax;
    this.shieldMax = PLAYER.shieldMax;
    this.shieldRegenDelay = 0;
    this.fireTimer = 0;
    this.damageMul = 1;
    this.fireRateMul = 1;
    this.magnetMul = 1;
    this.dashTimer = 0;
    this.dashCooldown = 0;
    this.dashDirX = 0;
    this.dashDirY = -1;
    this.invuln = 0;
    this.alive = true;
    this.thrusting = false;
    this.trailTimer = 0;
  }

  reset() {
    const fresh = new Player();
    Object.assign(this, fresh);
  }

  get bulletDamage() {
    return PLAYER.bulletDamage * this.damageMul;
  }

  get fireInterval() {
    return PLAYER.fireInterval / this.fireRateMul;
  }

  get magnetRadius() {
    return PLAYER.magnetRadius * this.magnetMul;
  }

  move(mx, my, dt) {
    if (this.dashTimer > 0) {
      this.dashTimer -= dt;
      this.vx = this.dashDirX * PLAYER.dashSpeed;
      this.vy = this.dashDirY * PLAYER.dashSpeed;
    } else {
      this.vx += mx * PLAYER.accel * dt;
      this.vy += my * PLAYER.accel * dt;
      const damp = Math.pow(PLAYER.damping, dt * 60);
      this.vx *= damp;
      this.vy *= damp;
      const sp = Math.hypot(this.vx, this.vy);
      if (sp > PLAYER.maxSpeed) {
        this.vx = (this.vx / sp) * PLAYER.maxSpeed;
        this.vy = (this.vy / sp) * PLAYER.maxSpeed;
      }
    }
    this.x = clamp(this.x + this.vx * dt, this.radius, VIEW.w - this.radius);
    this.y = clamp(this.y + this.vy * dt, this.radius, VIEW.h - this.radius);
    this.thrusting = mx !== 0 || my !== 0;
  }

  startDash(mx, my) {
    if (this.dashCooldown > 0 || this.dashTimer > 0) return false;
    let dx = mx;
    let dy = my;
    if (dx === 0 && dy === 0) {
      dx = Math.cos(this.angle);
      dy = Math.sin(this.angle);
    }
    const len = Math.hypot(dx, dy) || 1;
    this.dashDirX = dx / len;
    this.dashDirY = dy / len;
    this.dashTimer = PLAYER.dashTime;
    this.dashCooldown = PLAYER.dashCooldown;
    this.invuln = Math.max(this.invuln, PLAYER.dashInvuln);
    return true;
  }

  // Returns true when a shot was actually fired.
  tryFire(dt, aimAngle) {
    this.fireTimer -= dt;
    if (this.fireTimer > 0) return false;
    this.fireTimer = this.fireInterval;
    this.angle = aimAngle;
    return true;
  }

  tickTimers(dt) {
    if (this.dashCooldown > 0) this.dashCooldown -= dt;
    if (this.invuln > 0) this.invuln -= dt;
    if (this.shieldRegenDelay > 0) this.shieldRegenDelay -= dt;
    else if (this.shield < this.shieldMax) {
      this.shield = Math.min(this.shieldMax, this.shield + PLAYER.shieldRegen * dt);
    }
  }

  // Damage hits the shield first, then the hull. Returns hull damage taken.
  takeDamage(amount) {
    if (this.invuln > 0 || !this.alive) return 0;
    this.shieldRegenDelay = 4;
    let rest = amount;
    if (this.shield > 0) {
      const absorbed = Math.min(this.shield, rest);
      this.shield -= absorbed;
      rest -= absorbed;
    }
    if (rest > 0) {
      this.hull = Math.max(0, this.hull - rest);
      if (this.hull <= 0) this.alive = false;
    }
    this.invuln = 0.35;
    return rest;
  }

  heal(amount) {
    this.hull = Math.min(this.hullMax, this.hull + amount);
  }

  addShield(amount) {
    this.shield = Math.min(this.shieldMax, this.shield + amount);
  }
}

export class Enemy {
  constructor(type, x, y, rng, wave) {
    const def = ENEMIES[type];
    this.id = NEXT_ID++;
    this.type = type;
    this.def = def;
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.angle = Math.PI / 2;
    this.radius = def.radius;
    // Later waves make the same ship tougher.
    const hpScale = 1 + (wave - 1) * 0.09;
    this.hull = Math.round(def.hull * hpScale);
    this.hullMax = this.hull;
    this.speed = def.speed * rand(rng, 0.9, 1.12);
    this.score = def.score;
    this.salvage = def.salvage;
    this.touchDamage = def.touchDamage;
    this.fireTimer = rand(rng, 1, def.fireInterval || 2);
    this.weavePhase = rng() * Math.PI * 2;
    this.weaveAmp = rand(rng, 40, 90);
    this.spawnT = 0; // warp-in animation time
    this.flash = 0; // hit flash
    this.isBoss = type === 'boss';
    this.rage = false;
    this.burstLeft = 0;
    this.burstTimer = 0;
  }

  update(dt, player, rng, time) {
    if (this.spawnT < 0.45) {
      this.spawnT += dt;
      return; // warping in: cannot act yet
    }
    if (this.flash > 0) this.flash -= dt;
    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const d = Math.hypot(dx, dy) || 1;
    const want = Math.atan2(dy, dx);

    if (this.type === 'drone') {
      this.angle = turnToward(this.angle, want, 3.2 * dt);
      this.vx = Math.cos(this.angle) * this.speed;
      this.vy = Math.sin(this.angle) * this.speed;
    } else if (this.type === 'weaver') {
      this.angle = turnToward(this.angle, want, 2.4 * dt);
      const perp = want + Math.PI / 2;
      const sway = Math.sin(time * 2.2 + this.weavePhase) * this.weaveAmp;
      this.vx = Math.cos(this.angle) * this.speed + Math.cos(perp) * sway * 0.9;
      this.vy = Math.sin(this.angle) * this.speed + Math.sin(perp) * sway * 0.9;
    } else if (this.type === 'brute') {
      this.angle = turnToward(this.angle, want, 1.4 * dt);
      this.vx = Math.cos(this.angle) * this.speed;
      this.vy = Math.sin(this.angle) * this.speed;
    } else if (this.type === 'boss') {
      // The Leviathan strafes slowly across the top third, keeping its distance.
      const targetY = 150 + Math.sin(time * 0.5) * 60;
      const tx = VIEW.w / 2 + Math.sin(time * 0.32) * 320;
      const ax = tx - this.x;
      const ay = targetY - this.y;
      const ad = Math.hypot(ax, ay) || 1;
      this.vx = (ax / ad) * this.speed;
      this.vy = (ay / ad) * this.speed;
      this.angle = turnToward(this.angle, want, 1.1 * dt);
    }
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    // Keep enemies on screen (the boss never leaves the top band).
    this.x = clamp(this.x, this.radius, VIEW.w - this.radius);
    this.y = clamp(this.y, this.radius, VIEW.h - this.radius);
  }

  // Boss enrages under 40% hull: faster, tighter bursts.
  checkRage() {
    if (this.isBoss && !this.rage && this.hull < this.hullMax * 0.4) {
      this.rage = true;
      this.speed *= 1.45;
      return true;
    }
    return false;
  }
}

export class Bullet {
  constructor(x, y, angle, speed, damage, friendly, radius = 5, color = null) {
    this.id = NEXT_ID++;
    this.x = x;
    this.y = y;
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.angle = angle;
    this.damage = damage;
    this.friendly = friendly;
    this.radius = radius;
    this.color = color;
    this.life = 2.2;
    this.dead = false;
  }

  update(dt) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.life -= dt;
    if (this.life <= 0 || this.x < -30 || this.x > VIEW.w + 30 || this.y < -30 || this.y > VIEW.h + 30) {
      this.dead = true;
    }
  }
}

export class Pickup {
  constructor(kind, x, y, value, rng) {
    this.id = NEXT_ID++;
    this.kind = kind; // 'salvage' | 'hull'
    this.x = x;
    this.y = y;
    const a = rng() * Math.PI * 2;
    const s = rand(rng, 40, 110);
    this.vx = Math.cos(a) * s;
    this.vy = Math.sin(a) * s;
    this.value = value;
    this.radius = kind === 'salvage' ? 8 : 11;
    this.life = 12;
    this.bob = rng() * Math.PI * 2;
    this.dead = false;
  }

  update(dt, player) {
    this.life -= dt;
    if (this.life <= 0) {
      this.dead = true;
      return;
    }
    // Drift to a stop, then get pulled toward the player inside the magnet radius.
    this.vx *= Math.max(0, 1 - 2.4 * dt);
    this.vy *= Math.max(0, 1 - 2.4 * dt);
    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const d = Math.hypot(dx, dy) || 1;
    const magnetR = player.magnetRadius;
    if (d < magnetR && d > 1) {
      const pull = 900 * (1 - d / magnetR) + 260;
      this.vx += (dx / d) * pull * dt;
      this.vy += (dy / d) * pull * dt;
    }
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.bob += dt * 4;
  }
}
