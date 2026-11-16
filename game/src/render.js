// All drawing: background, ships, bullets, pickups, HUD and every screen.
// The canvas is 1280x720 logical; the page scales it to the window.

import { PALETTE, SHOP, SHOP_SECONDS, VIEW } from './config.js';
import { clamp, fmt } from './random.js';
import { STATES } from './world.js';

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function bar(ctx, x, y, w, h, frac, fill, bg = 'rgba(255,255,255,0.12)') {
  ctx.fillStyle = bg;
  roundRect(ctx, x, y, w, h, h / 2);
  ctx.fill();
  if (frac > 0) {
    ctx.fillStyle = fill;
    roundRect(ctx, x, y, w * clamp(frac, 0, 1), h, h / 2);
    ctx.fill();
  }
}

export class Renderer {
  constructor(canvas, starfield) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.starfield = starfield;
  }

  draw(world, input, time) {
    const ctx = this.ctx;
    const w = VIEW.w;
    const h = VIEW.h;
    ctx.save();
    ctx.clearRect(0, 0, w, h);

    // Screen shake while playing.
    if (world.shake > 0.2 && (world.state === STATES.PLAYING || world.state === STATES.GAMEOVER)) {
      const s = world.shake;
      ctx.translate((Math.random() - 0.5) * s, (Math.random() - 0.5) * s);
    }

    // Backdrop.
    const bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, PALETTE.bg0);
    bg.addColorStop(1, PALETTE.bg1);
    ctx.fillStyle = bg;
    ctx.fillRect(-24, -24, w + 48, h + 48);
    const camX = world.player.x - w / 2;
    const camY = world.player.y - h / 2;
    this.starfield.draw(ctx, time, camX, camY);

    const st = world.state;
    if (st === STATES.TITLE) {
      this.drawTitle(world, time);
    } else {
      this.drawPickups(ctx, world);
      this.drawBullets(ctx, world);
      this.drawEnemies(ctx, world, time);
      this.drawPlayer(ctx, world, time);
      world.particles.draw(ctx);
      if (st === STATES.PLAYING || st === STATES.PAUSED || st === STATES.SHOP) {
        this.drawHud(ctx, world);
      }
      // The wave-cleared banner belongs to combat, not to the shop panel.
      if (world.banner && st !== STATES.SHOP) this.drawBanner(ctx, world);
      if (st === STATES.SHOP) this.drawShop(ctx, world, input);
      if (st === STATES.PAUSED) this.drawPaused(ctx, world);
      if (st === STATES.VICTORY) this.drawEnd(ctx, world, true);
      if (st === STATES.GAMEOVER) this.drawEnd(ctx, world, false);
    }
    ctx.restore();
  }

  // --- World objects ------------------------------------------------------

  drawPlayer(ctx, world, time) {
    const p = world.player;
    if (!p.alive) return;
    // Blink while invulnerable.
    if (p.invuln > 0 && Math.floor(time * 18) % 2 === 0) return;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.angle);

    // Shield ring.
    if (p.shield > 0) {
      ctx.globalAlpha = 0.28 + 0.14 * Math.sin(time * 5);
      ctx.strokeStyle = PALETTE.shield;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, p.radius + 8, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // Engine glow.
    if (p.thrusting) {
      const flick = 10 + Math.random() * 8;
      const g = ctx.createRadialGradient(-p.radius - 4, 0, 0, -p.radius - 4, 0, flick + 8);
      g.addColorStop(0, 'rgba(120,200,255,0.9)');
      g.addColorStop(1, 'rgba(120,200,255,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(-p.radius - 4, 0, flick + 8, 0, Math.PI * 2);
      ctx.fill();
    }

    // Hull: a swept salvage ship.
    ctx.shadowColor = PALETTE.player;
    ctx.shadowBlur = 16;
    ctx.fillStyle = '#0e2f45';
    ctx.strokeStyle = PALETTE.player;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(p.radius + 8, 0);
    ctx.lineTo(-p.radius * 0.7, p.radius * 0.85);
    ctx.lineTo(-p.radius * 0.35, 0);
    ctx.lineTo(-p.radius * 0.7, -p.radius * 0.85);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;
    // Cockpit.
    ctx.fillStyle = PALETTE.playerCore;
    ctx.beginPath();
    ctx.arc(p.radius * 0.25, 0, 4.5, 0, Math.PI * 2);
    ctx.fill();
    // Salvage claw prongs.
    ctx.strokeStyle = PALETTE.player;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(p.radius * 0.4, p.radius * 0.5);
    ctx.lineTo(p.radius + 2, p.radius * 0.28);
    ctx.moveTo(p.radius * 0.4, -p.radius * 0.5);
    ctx.lineTo(p.radius + 2, -p.radius * 0.28);
    ctx.stroke();
    ctx.restore();
  }

  drawEnemies(ctx, world, time) {
    for (const e of world.enemies) {
      ctx.save();
      // Warp-in: fade and scale in.
      const warp = e.spawnT < 0.45 ? e.spawnT / 0.45 : 1;
      ctx.globalAlpha = 0.25 + 0.75 * warp;
      ctx.translate(e.x, e.y);
      ctx.scale(warp, warp);
      ctx.rotate(e.angle);

      const flash = e.flash > 0;
      const body = flash ? '#ffffff' : '#160a18';
      ctx.shadowColor = e.def.color;
      ctx.shadowBlur = e.isBoss ? 26 : 14;
      ctx.fillStyle = body;
      ctx.strokeStyle = e.def.color;
      ctx.lineWidth = e.isBoss ? 3 : 2;

      if (e.type === 'drone') {
        // Spiked dart.
        ctx.beginPath();
        ctx.moveTo(e.radius + 6, 0);
        ctx.lineTo(-e.radius * 0.6, e.radius * 0.8);
        ctx.lineTo(-e.radius * 0.2, 0);
        ctx.lineTo(-e.radius * 0.6, -e.radius * 0.8);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = e.def.color;
        ctx.beginPath();
        ctx.arc(e.radius * 0.2, 0, 4, 0, Math.PI * 2);
        ctx.fill();
      } else if (e.type === 'weaver') {
        // Twin-pronged crescent.
        ctx.beginPath();
        ctx.moveTo(e.radius + 4, 0);
        ctx.quadraticCurveTo(0, e.radius, -e.radius, e.radius * 0.7);
        ctx.lineTo(-e.radius * 0.4, 0);
        ctx.lineTo(-e.radius, -e.radius * 0.7);
        ctx.quadraticCurveTo(0, -e.radius, e.radius + 4, 0);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = e.def.color;
        ctx.beginPath();
        ctx.arc(2, 0, 4, 0, Math.PI * 2);
        ctx.fill();
      } else if (e.type === 'brute') {
        // Armoured hexagon.
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2;
          const px = Math.cos(a) * e.radius;
          const py = Math.sin(a) * e.radius;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.strokeStyle = 'rgba(255,255,255,0.5)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(0, 0, e.radius * 0.55, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = e.def.color;
        ctx.beginPath();
        ctx.arc(0, 0, 5, 0, Math.PI * 2);
        ctx.fill();
      } else if (e.type === 'boss') {
        // The Leviathan: a wide capital hull with rotating ring.
        ctx.rotate(-e.angle); // draw axis-aligned, ring spins on its own
        ctx.beginPath();
        ctx.moveTo(e.radius + 18, 0);
        ctx.lineTo(e.radius * 0.4, e.radius * 0.62);
        ctx.lineTo(-e.radius * 0.7, e.radius * 0.9);
        ctx.lineTo(-e.radius, 0);
        ctx.lineTo(-e.radius * 0.7, -e.radius * 0.9);
        ctx.lineTo(e.radius * 0.4, -e.radius * 0.62);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        // Spinning outer ring.
        ctx.save();
        ctx.rotate(time * 0.7);
        ctx.strokeStyle = e.rage ? '#ff9f43' : e.def.color;
        ctx.lineWidth = 3;
        ctx.setLineDash([18, 14]);
        ctx.beginPath();
        ctx.arc(0, 0, e.radius + 16, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
        ctx.setLineDash([]);
        // Core.
        const pulse = 10 + Math.sin(time * 6) * 3;
        ctx.fillStyle = e.rage ? '#ffb347' : '#ff5d7a';
        ctx.beginPath();
        ctx.arc(0, 0, pulse, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(0, 0, pulse * 0.45, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      // Hull bar above damaged enemies (boss gets the big bar in the HUD).
      if (!e.isBoss && e.hull < e.hullMax) {
        const bw = e.radius * 2;
        bar(ctx, e.x - bw / 2, e.y - e.radius - 12, bw, 4,
          e.hull / e.hullMax, e.def.color, 'rgba(0,0,0,0.45)');
      }
    }
  }

  drawBullets(ctx, world) {
    for (const b of world.bullets) {
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.rotate(b.angle);
      if (b.friendly) {
        ctx.shadowColor = PALETTE.bullet;
        ctx.shadowBlur = 10;
        ctx.fillStyle = PALETTE.bulletCore;
        roundRect(ctx, -9, -2.5, 18, 5, 2.5);
        ctx.fill();
        ctx.fillStyle = PALETTE.bullet;
        roundRect(ctx, -12, -1.5, 7, 3, 1.5);
        ctx.fill();
      } else {
        ctx.shadowColor = b.color || PALETTE.enemyBoss;
        ctx.shadowBlur = 12;
        ctx.fillStyle = b.color || PALETTE.enemyBoss;
        ctx.beginPath();
        ctx.arc(0, 0, b.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(0, 0, b.radius * 0.45, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  drawPickups(ctx, world) {
    for (const pk of world.pickups) {
      const blink = pk.life < 3 ? (Math.floor(world.time * 8) % 2 === 0 ? 0.35 : 1) : 1;
      ctx.save();
      ctx.globalAlpha = blink;
      ctx.translate(pk.x, pk.y + Math.sin(pk.bob) * 2);
      if (pk.kind === 'salvage') {
        ctx.rotate(Math.PI / 4);
        ctx.shadowColor = PALETTE.salvage;
        ctx.shadowBlur = 10;
        ctx.fillStyle = PALETTE.salvage;
        const s = 6;
        ctx.fillRect(-s / 2, -s / 2, s, s);
        ctx.fillStyle = '#eafff1';
        ctx.fillRect(-s / 4, -s / 4, s / 2, s / 2);
      } else {
        ctx.shadowColor = PALETTE.hullCell;
        ctx.shadowBlur = 12;
        ctx.fillStyle = '#2b0a12';
        ctx.strokeStyle = PALETTE.hullCell;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.moveTo(-5, 0);
        ctx.lineTo(5, 0);
        ctx.moveTo(0, -5);
        ctx.lineTo(0, 5);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  // --- HUD ---------------------------------------------------------------

  drawHud(ctx, world) {
    const p = world.player;
    ctx.save();
    ctx.textBaseline = 'alphabetic';

    // Top-left: hull + shield.
    ctx.textAlign = 'left';
    ctx.font = '700 13px "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = PALETTE.dim;
    ctx.fillText('HULL', 24, 30);
    bar(ctx, 24, 36, 220, 14, p.hull / p.hullMax, p.hull < 30 ? PALETTE.danger : '#3ddc84');
    ctx.fillStyle = '#ffffff';
    ctx.font = '700 12px "Segoe UI", Arial, sans-serif';
    ctx.fillText(`${Math.ceil(p.hull)} / ${p.hullMax}`, 252, 48);
    ctx.fillStyle = PALETTE.dim;
    ctx.font = '700 13px "Segoe UI", Arial, sans-serif';
    ctx.fillText('SHIELD', 24, 70);
    bar(ctx, 24, 76, 220, 10, p.shield / p.shieldMax, PALETTE.shield);
    ctx.fillStyle = '#ffffff';
    ctx.font = '700 12px "Segoe UI", Arial, sans-serif';
    ctx.fillText(`${Math.ceil(p.shield)} / ${p.shieldMax}`, 252, 86);

    // Top-center: wave + score.
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.text;
    ctx.font = '800 30px "Segoe UI", Arial, sans-serif';
    ctx.fillText(fmt(world.score), VIEW.w / 2, 40);
    ctx.fillStyle = PALETTE.dim;
    ctx.font = '700 14px "Segoe UI", Arial, sans-serif';
    ctx.fillText(`WAVE ${world.wave} / 10`, VIEW.w / 2, 62);
    if (world.combo >= 2) {
      ctx.fillStyle = PALETTE.gold;
      ctx.font = '800 16px "Segoe UI", Arial, sans-serif';
      const mult = (1 + Math.min(world.combo - 1, 10) * 0.1).toFixed(1);
      ctx.fillText(`COMBO x${world.combo}  ·  SCORE x${mult}`, VIEW.w / 2, 86);
    }

    // Top-right: salvage, kills, dash.
    ctx.textAlign = 'right';
    ctx.fillStyle = PALETTE.salvage;
    ctx.font = '800 22px "Segoe UI", Arial, sans-serif';
    ctx.fillText(`◆ ${fmt(world.salvage)}`, VIEW.w - 24, 40);
    ctx.fillStyle = PALETTE.dim;
    ctx.font = '700 13px "Segoe UI", Arial, sans-serif';
    ctx.fillText(`KILLS ${world.kills}`, VIEW.w - 24, 62);
    const dashFrac = 1 - clamp(p.dashCooldown / 1.6, 0, 1);
    ctx.fillText('DASH [SPACE]', VIEW.w - 24, 84);
    bar(ctx, VIEW.w - 144, 90, 120, 7, dashFrac, dashFrac >= 1 ? PALETTE.player : '#3a6a8a');

    // Bottom-left: controls reminder.
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(143,180,216,0.75)';
    ctx.font = '600 12px "Segoe UI", Arial, sans-serif';
    ctx.fillText('WASD move · MOUSE aim · HOLD CLICK fire · SPACE dash · P pause · M mute', 24, VIEW.h - 16);

    // Boss bar.
    if (world.boss && world.boss.hull > 0) {
      const b = world.boss;
      const bw = 520;
      const bx = (VIEW.w - bw) / 2;
      const by = VIEW.h - 52;
      ctx.textAlign = 'center';
      ctx.fillStyle = b.rage ? '#ffb347' : PALETTE.enemyBoss;
      ctx.font = '800 14px "Segoe UI", Arial, sans-serif';
      ctx.fillText(b.rage ? 'LEVIATHAN — ENRAGED' : 'LEVIATHAN', VIEW.w / 2, by - 8);
      bar(ctx, bx, by, bw, 12, b.hull / b.hullMax, b.rage ? '#ff9f43' : PALETTE.enemyBoss);
    }
    ctx.restore();
  }

  drawBanner(ctx, world) {
    const b = world.banner;
    const t = b.t / b.dur;
    const a = t < 0.12 ? t / 0.12 : t > 0.8 ? (1 - t) / 0.2 : 1;
    ctx.save();
    ctx.globalAlpha = clamp(a, 0, 1);
    ctx.textAlign = 'center';
    ctx.shadowColor = '#5df2ff';
    ctx.shadowBlur = 24;
    ctx.fillStyle = '#ffffff';
    ctx.font = '800 44px "Segoe UI", Arial, sans-serif';
    ctx.fillText(b.text, VIEW.w / 2, 190);
    ctx.shadowBlur = 0;
    ctx.fillStyle = PALETTE.dim;
    ctx.font = '600 17px "Segoe UI", Arial, sans-serif';
    ctx.fillText(b.sub, VIEW.w / 2, 222);
    ctx.restore();
  }

  // --- Screens ------------------------------------------------------------

  panel(ctx, x, y, w, h) {
    ctx.fillStyle = 'rgba(4,10,26,0.82)';
    roundRect(ctx, x, y, w, h, 14);
    ctx.fill();
    ctx.strokeStyle = 'rgba(93,242,255,0.35)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  drawTitle(world, time) {
    const ctx = this.ctx;
    // A few drifting demo ships for life behind the title.
    ctx.save();
    ctx.globalAlpha = 0.9;
    for (let i = 0; i < 5; i++) {
      const x = 140 + i * 240 + Math.sin(time * 0.4 + i * 1.7) * 30;
      const y = 150 + ((i * 97) % 420) + Math.sin(time * 0.6 + i) * 14;
      ctx.translate(x, y);
      ctx.rotate(Math.sin(time * 0.3 + i * 2) * 0.4);
      ctx.fillStyle = ['#ff5d7a', '#c77dff', '#ff9f43', '#5df2ff', '#7dffb2'][i];
      ctx.globalAlpha = 0.55;
      ctx.beginPath();
      ctx.moveTo(14, 0);
      ctx.lineTo(-10, 10);
      ctx.lineTo(-4, 0);
      ctx.lineTo(-10, -10);
      ctx.closePath();
      ctx.fill();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalAlpha = 0.9;
    }
    ctx.restore();

    ctx.save();
    ctx.textAlign = 'center';
    ctx.shadowColor = '#5df2ff';
    ctx.shadowBlur = 30;
    ctx.fillStyle = '#ffffff';
    ctx.font = '800 76px "Segoe UI", Arial, sans-serif';
    ctx.fillText('NOVA DRIFT', VIEW.w / 2, 250);
    ctx.shadowBlur = 0;
    ctx.fillStyle = PALETTE.player;
    ctx.font = '700 26px "Segoe UI", Arial, sans-serif';
    ctx.fillText('— VOID SALVAGE —', VIEW.w / 2, 292);

    ctx.fillStyle = PALETTE.text;
    ctx.font = '400 18px "Segoe UI", Arial, sans-serif';
    ctx.fillText('Salvage the wreck-field. Survive 10 waves. Sink the LEVIATHAN.', VIEW.w / 2, 340);
    ctx.fillText('Spend salvage between waves to upgrade your ship.', VIEW.w / 2, 368);

    const pulse = 0.65 + 0.35 * Math.sin(time * 3.2);
    ctx.globalAlpha = pulse;
    ctx.fillStyle = '#ffffff';
    ctx.font = '800 26px "Segoe UI", Arial, sans-serif';
    ctx.fillText('CLICK OR PRESS ENTER TO LAUNCH', VIEW.w / 2, 448);
    ctx.globalAlpha = 1;

    this.panel(ctx, VIEW.w / 2 - 330, 486, 660, 118);
    ctx.fillStyle = PALETTE.text;
    ctx.font = '600 15px "Segoe UI", Arial, sans-serif';
    ctx.fillText('WASD / ARROWS — fly      MOUSE — aim      HOLD CLICK — fire', VIEW.w / 2, 518);
    ctx.fillText('SPACE — dash (brief invulnerability)      P — pause      M — mute', VIEW.w / 2, 546);
    ctx.fillText('Collect ◆ salvage, buy upgrades between waves, beat wave 10 to win.', VIEW.w / 2, 574);

    if (world.bestScore > 0) {
      ctx.fillStyle = PALETTE.gold;
      ctx.font = '700 16px "Segoe UI", Arial, sans-serif';
      ctx.fillText(`BEST SCORE  ${fmt(world.bestScore)}`, VIEW.w / 2, 648);
    }
    ctx.fillStyle = 'rgba(143,180,216,0.8)';
    ctx.font = '600 13px "Segoe UI", Arial, sans-serif';
    ctx.fillText('A complete game in one page — no downloads, no network, just you and the void.', VIEW.w / 2, 692);
    ctx.restore();
  }

  drawShop(ctx, world, input) {
    const mx = input.mouseX;
    const my = input.mouseY;
    ctx.save();
    ctx.fillStyle = 'rgba(2,6,18,0.55)';
    ctx.fillRect(0, 0, VIEW.w, VIEW.h);
    const pw = 780;
    const ph = 430;
    const px = (VIEW.w - pw) / 2;
    const py = 120;
    this.panel(ctx, px, py, pw, ph);

    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.font = '800 30px "Segoe UI", Arial, sans-serif';
    ctx.fillText('SALVAGE SHOP', VIEW.w / 2, py + 46);
    ctx.fillStyle = PALETTE.salvage;
    ctx.font = '800 20px "Segoe UI", Arial, sans-serif';
    ctx.fillText(`◆ ${fmt(world.salvage)} salvage`, VIEW.w / 2, py + 76);
    ctx.fillStyle = PALETTE.dim;
    ctx.font = '600 14px "Segoe UI", Arial, sans-serif';
    ctx.fillText(`Next wave in ${Math.ceil(world.shopTimer)}s — click a card or press its number key`, VIEW.w / 2, py + 100);

    const cardW = 140;
    const cardH = 190;
    const gap = 12;
    const totalW = SHOP.length * cardW + (SHOP.length - 1) * gap;
    const startX = (VIEW.w - totalW) / 2;
    const cardY = py + 126;
    SHOP.forEach((item, i) => {
      const x = startX + i * (cardW + gap);
      const lvl = world.shopLevels[item.id];
      const maxed = lvl >= item.max;
      const cost = world.shopCost(item);
      const afford = world.salvage >= cost;
      const hover = mx >= x && mx <= x + cardW && my >= cardY && my <= cardY + cardH;
      ctx.fillStyle = hover && !maxed ? 'rgba(93,242,255,0.14)' : 'rgba(255,255,255,0.05)';
      roundRect(ctx, x, cardY, cardW, cardH, 10);
      ctx.fill();
      ctx.strokeStyle = maxed ? 'rgba(255,209,102,0.6)' : hover ? PALETTE.player : 'rgba(255,255,255,0.18)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.textAlign = 'center';
      ctx.fillStyle = PALETTE.gold;
      ctx.font = '800 15px "Segoe UI", Arial, sans-serif';
      ctx.fillText(`[${item.key}]`, x + cardW / 2, cardY + 26);
      ctx.fillStyle = '#ffffff';
      ctx.font = '800 14px "Segoe UI", Arial, sans-serif';
      // Wrap the two-word name over two lines.
      const words = item.name.split(' ');
      ctx.fillText(words.slice(0, -1).join(' ') || item.name, x + cardW / 2, cardY + 52);
      ctx.fillText(words.slice(-1).join(' '), x + cardW / 2, cardY + 72);
      ctx.fillStyle = PALETTE.dim;
      ctx.font = '600 12px "Segoe UI", Arial, sans-serif';
      const descWords = item.desc.split(' ');
      let line = '';
      let ly = cardY + 98;
      for (const w2 of descWords) {
        if ((line + ' ' + w2).trim().length > 16) {
          ctx.fillText(line.trim(), x + cardW / 2, ly);
          ly += 16;
          line = w2;
        } else {
          line += ' ' + w2;
        }
      }
      ctx.fillText(line.trim(), x + cardW / 2, ly);
      // Level pips.
      const pips = Math.min(item.max, 6);
      for (let pI = 0; pI < pips; pI++) {
        ctx.fillStyle = pI < lvl ? PALETTE.gold : 'rgba(255,255,255,0.18)';
        ctx.beginPath();
        ctx.arc(x + cardW / 2 - (pips - 1) * 8 + pI * 16, cardY + 150, 4, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.font = '800 15px "Segoe UI", Arial, sans-serif';
      if (maxed) {
        ctx.fillStyle = PALETTE.gold;
        ctx.fillText('MAXED', x + cardW / 2, cardY + 176);
      } else {
        ctx.fillStyle = afford ? PALETTE.salvage : PALETTE.danger;
        ctx.fillText(`◆ ${fmt(cost)}`, x + cardW / 2, cardY + 176);
      }
    });

    ctx.fillStyle = PALETTE.dim;
    ctx.font = '600 14px "Segoe UI", Arial, sans-serif';
    ctx.fillText('or press ENTER to skip the shop and launch the next wave now', VIEW.w / 2, py + ph - 22);
    ctx.restore();
  }

  drawPaused(ctx, world) {
    ctx.save();
    ctx.fillStyle = 'rgba(2,6,18,0.6)';
    ctx.fillRect(0, 0, VIEW.w, VIEW.h);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.font = '800 44px "Segoe UI", Arial, sans-serif';
    ctx.fillText('PAUSED', VIEW.w / 2, VIEW.h / 2 - 10);
    ctx.fillStyle = PALETTE.dim;
    ctx.font = '600 17px "Segoe UI", Arial, sans-serif';
    ctx.fillText('Press P or click to resume — R restarts the run', VIEW.w / 2, VIEW.h / 2 + 28);
    ctx.restore();
  }

  drawEnd(ctx, world, won) {
    const s = world.endStats;
    ctx.save();
    ctx.fillStyle = 'rgba(2,6,18,0.62)';
    ctx.fillRect(0, 0, VIEW.w, VIEW.h);
    const pw = 620;
    const ph = 440;
    const px = (VIEW.w - pw) / 2;
    const py = (VIEW.h - ph) / 2;
    this.panel(ctx, px, py, pw, ph);
    ctx.textAlign = 'center';
    ctx.shadowColor = won ? PALETTE.gold : PALETTE.danger;
    ctx.shadowBlur = 26;
    ctx.fillStyle = won ? PALETTE.gold : PALETTE.danger;
    ctx.font = '800 52px "Segoe UI", Arial, sans-serif';
    ctx.fillText(won ? 'VICTORY!' : 'SHIP LOST', VIEW.w / 2, py + 78);
    ctx.shadowBlur = 0;
    ctx.fillStyle = PALETTE.text;
    ctx.font = '600 17px "Segoe UI", Arial, sans-serif';
    ctx.fillText(
      won
        ? 'The LEVIATHAN is scrap. The wreck-field is yours, salvager.'
        : 'Your hull gave out in the wreck-field. The void keeps its salvage.',
      VIEW.w / 2, py + 112,
    );
    if (world.newBest) {
      ctx.fillStyle = PALETTE.gold;
      ctx.font = '800 16px "Segoe UI", Arial, sans-serif';
      ctx.fillText('★ NEW BEST SCORE ★', VIEW.w / 2, py + 142);
    }
    const rows = [
      ['FINAL SCORE', fmt(s.score)],
      ['WAVE REACHED', `${s.wave} / 10`],
      ['SHIPS DESTROYED', fmt(s.kills)],
      ['BEST COMBO', `x${s.bestCombo}`],
      ['ACCURACY', `${s.accuracy}%`],
      ['TIME IN THE VOID', `${Math.floor(s.playTime / 60)}:${String(Math.floor(s.playTime % 60)).padStart(2, '0')}`],
    ];
    ctx.font = '600 16px "Segoe UI", Arial, sans-serif';
    rows.forEach(([label, value], i) => {
      const y = py + 178 + i * 30;
      ctx.textAlign = 'left';
      ctx.fillStyle = PALETTE.dim;
      ctx.fillText(label, px + 70, y);
      ctx.textAlign = 'right';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(value, px + pw - 70, y);
    });
    const pulse = 0.65 + 0.35 * Math.sin(world.time * 3.2);
    ctx.globalAlpha = pulse;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.font = '800 20px "Segoe UI", Arial, sans-serif';
    ctx.fillText('PRESS R OR CLICK TO FLY AGAIN', VIEW.w / 2, py + ph - 28);
    ctx.restore();
  }
}
