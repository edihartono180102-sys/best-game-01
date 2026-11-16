// Particles, shockwave rings, engine trails and floating score text.
// Purely visual: nothing here changes the simulation, only how it looks.

import { rand } from './random.js';

export class Particles {
  constructor(rng) {
    this.rng = rng;
    this.list = []; // {x,y,vx,vy,life,maxLife,size,color,drag,grav}
    this.rings = []; // {x,y,r,maxR,life,maxLife,color,width}
    this.texts = []; // {x,y,vy,life,maxLife,text,color,size}
  }

  burst(x, y, color, count, speed, size = 3, life = 0.7) {
    for (let i = 0; i < count; i++) {
      const a = this.rng() * Math.PI * 2;
      const s = speed * (0.3 + this.rng() * 0.7);
      this.list.push({
        x, y,
        vx: Math.cos(a) * s, vy: Math.sin(a) * s,
        life: life * (0.5 + this.rng() * 0.5), maxLife: life,
        size: size * (0.6 + this.rng() * 0.8),
        color, drag: 2.2, grav: 0,
      });
    }
  }

  sparks(x, y, color, count = 6) {
    this.burst(x, y, color, count, 260, 2.5, 0.4);
  }

  explosion(x, y, color, big = false) {
    this.burst(x, y, color, big ? 46 : 26, big ? 420 : 320, big ? 5 : 4, big ? 1.0 : 0.7);
    this.burst(x, y, '#ffffff', big ? 12 : 7, big ? 300 : 220, 2.5, 0.35);
    this.burst(x, y, '#ffb347', big ? 16 : 9, big ? 200 : 150, 4, 0.8);
    this.ring(x, y, color, big ? 150 : 90);
  }

  ring(x, y, color, maxR) {
    this.rings.push({ x, y, r: 6, maxR, life: 0.45, maxLife: 0.45, color, width: 3 });
  }

  trail(x, y, vx, vy, color, size = 3) {
    this.list.push({
      x, y, vx: vx * 0.2, vy: vy * 0.2,
      life: 0.35, maxLife: 0.35, size, color, drag: 3, grav: 0,
    });
  }

  floatText(x, y, text, color, size = 15) {
    this.texts.push({ x, y, vy: -46, life: 0.9, maxLife: 0.9, text, color, size });
  }

  update(dt) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.list.splice(i, 1);
        continue;
      }
      const d = Math.max(0, 1 - p.drag * dt);
      p.vx *= d;
      p.vy *= d;
      p.vy += p.grav * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i];
      r.life -= dt;
      if (r.life <= 0) {
        this.rings.splice(i, 1);
        continue;
      }
      const t = 1 - r.life / r.maxLife;
      r.r = 6 + (r.maxR - 6) * (1 - (1 - t) * (1 - t));
    }
    for (let i = this.texts.length - 1; i >= 0; i--) {
      const t = this.texts[i];
      t.life -= dt;
      if (t.life <= 0) {
        this.texts.splice(i, 1);
        continue;
      }
      t.y += t.vy * dt;
      t.vy *= 0.98;
    }
  }

  draw(ctx) {
    for (const p of this.list) {
      const a = Math.max(0, p.life / p.maxLife);
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (0.5 + a * 0.5), 0, Math.PI * 2);
      ctx.fill();
    }
    for (const r of this.rings) {
      const a = Math.max(0, r.life / r.maxLife);
      ctx.globalAlpha = a * 0.9;
      ctx.strokeStyle = r.color;
      ctx.lineWidth = r.width * a + 0.5;
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.textAlign = 'center';
    for (const t of this.texts) {
      const a = Math.max(0, t.life / t.maxLife);
      ctx.globalAlpha = a;
      ctx.font = `700 ${t.size}px "Segoe UI", Arial, sans-serif`;
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, t.x, t.y);
    }
    ctx.globalAlpha = 1;
  }

  clear() {
    this.list.length = 0;
    this.rings.length = 0;
    this.texts.length = 0;
  }
}

// A parallax starfield with three depth layers plus soft nebula blobs,
// pre-rendered once into an offscreen canvas so the backdrop costs nothing.
export class Starfield {
  constructor(rng, w, h) {
    this.w = w;
    this.h = h;
    this.layers = [];
    for (let depth = 0; depth < 3; depth++) {
      const stars = [];
      const count = [90, 60, 34][depth];
      for (let i = 0; i < count; i++) {
        stars.push({
          x: rng() * w, y: rng() * h,
          r: 0.6 + rng() * (depth === 2 ? 1.6 : 1.0),
          tw: rng() * Math.PI * 2,
          twSpeed: 0.6 + rng() * 1.8,
        });
      }
      this.layers.push({ depth, speed: [14, 30, 55][depth], stars });
    }
    // Nebula: three large soft radial gradients baked into one canvas.
    this.nebula = document.createElement('canvas');
    this.nebula.width = w;
    this.nebula.height = h;
    const nctx = this.nebula.getContext('2d');
    const blobs = [
      { x: w * 0.18, y: h * 0.22, r: 420, c: 'rgba(27,42,107,0.55)' },
      { x: w * 0.85, y: h * 0.75, r: 460, c: 'rgba(58,27,94,0.5)' },
      { x: w * 0.72, y: h * 0.12, r: 340, c: 'rgba(14,58,77,0.5)' },
      { x: w * 0.3, y: h * 0.9, r: 300, c: 'rgba(27,42,107,0.35)' },
    ];
    for (const b of blobs) {
      const g = nctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r);
      g.addColorStop(0, b.c);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      nctx.fillStyle = g;
      nctx.fillRect(b.x - b.r, b.y - b.r, b.r * 2, b.r * 2);
    }
  }

  draw(ctx, time, camX, camY) {
    ctx.drawImage(this.nebula, 0, 0);
    for (const layer of this.layers) {
      const ox = ((-camX * layer.speed * 0.02) % this.w + this.w) % this.w;
      const oy = ((-camY * layer.speed * 0.02) % this.h + this.h) % this.h;
      for (const s of layer.stars) {
        const tw = 0.55 + 0.45 * Math.sin(time * s.twSpeed + s.tw);
        const x = (s.x + ox) % this.w;
        const y = (s.y + oy) % this.h;
        ctx.globalAlpha = tw * (0.35 + layer.depth * 0.25);
        ctx.fillStyle = '#cfe6ff';
        ctx.beginPath();
        ctx.arc(x, y, s.r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }
}
