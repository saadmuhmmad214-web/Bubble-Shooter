/* ============================================================
   GameGraphies.js — procedural sprites, particles, falling
   bubbles and floating text. No external assets used.
   ============================================================ */
window.BS = window.BS || {};

(function (NS) {
  'use strict';
  const U = NS.Utils;

  /* ------------------------------------------------------------
     SPRITE CACHE
     ------------------------------------------------------------ */
  const SPR = { pad: 1.42, res: 1, cache: {} };
  let COLORS = [];
  let G = null;

  function setColors(arr) { COLORS = arr || []; }
  function setGeometry(g) { G = g; }

  function starPath(g, cx, cy, R1, R2, n) {
    g.beginPath();
    for (let i = 0; i < n * 2; i++) {
      const a = (i * Math.PI / n) - Math.PI / 2;
      const r = i % 2 === 0 ? R1 : R2;
      const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
      if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
    }
    g.closePath();
  }

  function drawPattern(g, r, ci) {
    const c = COLORS[ci % COLORS.length];
    if (!c) return;
    g.globalAlpha = 0.26;
    g.strokeStyle = '#ffffff';
    g.fillStyle = '#ffffff';
    g.lineWidth = Math.max(1, r * 0.085);
    g.lineCap = 'round';
    switch (c.pattern) {
      case 'dots':
        for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
          g.beginPath(); g.arc(i * r * 0.46, j * r * 0.46, r * 0.10, 0, 6.2832); g.fill();
        }
        break;
      case 'stripes':
        for (let i = -2; i <= 2; i++) {
          g.beginPath(); g.moveTo(-r, i * r * 0.32); g.lineTo(r, i * r * 0.32); g.stroke();
        }
        break;
      case 'chevron':
        for (let i = -1; i <= 1; i++) {
          g.beginPath();
          g.moveTo(-r * 0.55, i * r * 0.46 + r * 0.18);
          g.lineTo(0, i * r * 0.46 - r * 0.14);
          g.lineTo(r * 0.55, i * r * 0.46 + r * 0.18);
          g.stroke();
        }
        break;
      case 'star':
        starPath(g, 0, 0, r * 0.5, r * 0.21, 5); g.fill();
        break;
      case 'cross':
        g.beginPath();
        g.moveTo(-r * 0.48, 0); g.lineTo(r * 0.48, 0);
        g.moveTo(0, -r * 0.48); g.lineTo(0, r * 0.48);
        g.stroke();
        break;
      case 'hex':
        g.beginPath();
        for (let i = 0; i < 6; i++) {
          const a = i * Math.PI / 3 - Math.PI / 2;
          const x = Math.cos(a) * r * 0.52, y = Math.sin(a) * r * 0.52;
          if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
        }
        g.closePath(); g.stroke();
        break;
    }
    g.globalAlpha = 1;
  }

  function paintBubble(g, r, ci) {
    const c = COLORS[ci % COLORS.length];
    if (!c) return;
    const grd = g.createRadialGradient(-r * 0.34, -r * 0.38, r * 0.08, 0, 0, r * 1.08);
    grd.addColorStop(0, c.light);
    grd.addColorStop(0.42, c.main);
    grd.addColorStop(1, c.dark);
    g.beginPath(); g.arc(0, 0, r, 0, 6.2832); g.fillStyle = grd; g.fill();

    g.save();
    g.beginPath(); g.arc(0, 0, r * 0.97, 0, 6.2832); g.clip();
    drawPattern(g, r, ci);
    const sh = g.createRadialGradient(r * 0.25, r * 0.4, r * 0.1, 0, 0, r * 1.25);
    sh.addColorStop(0, 'rgba(0,0,0,0)');
    sh.addColorStop(0.62, 'rgba(0,0,0,0.05)');
    sh.addColorStop(1, 'rgba(0,0,0,0.42)');
    g.fillStyle = sh;
    g.beginPath(); g.arc(0, 0, r, 0, 6.2832); g.fill();
    g.restore();

    g.lineWidth = Math.max(1, r * 0.10);
    g.strokeStyle = 'rgba(255,255,255,0.30)';
    g.beginPath(); g.arc(0, 0, r * 0.955, Math.PI * 0.85, Math.PI * 1.85); g.stroke();
    g.strokeStyle = 'rgba(0,0,0,0.22)';
    g.beginPath(); g.arc(0, 0, r * 0.955, Math.PI * -0.15, Math.PI * 0.85); g.stroke();

    g.beginPath();
    g.ellipse(-r * 0.33, -r * 0.40, r * 0.30, r * 0.19, -0.62, 0, 6.2832);
    g.fillStyle = 'rgba(255,255,255,0.62)';
    g.fill();
    g.beginPath();
    g.ellipse(r * 0.30, r * 0.36, r * 0.16, r * 0.09, -0.5, 0, 6.2832);
    g.fillStyle = 'rgba(255,255,255,0.16)';
    g.fill();
  }

  function buildSprites() {
    SPR.cache = {};
    if (!G || !COLORS.length) return;
    const S = Math.ceil(G.R * 2 * SPR.pad);
    const px = Math.max(4, Math.ceil(S * SPR.res));
    for (let i = 0; i < COLORS.length; i++) {
      const c = document.createElement('canvas');
      c.width = px; c.height = px;
      const g = c.getContext('2d');
      g.translate(px / 2, px / 2);
      g.scale(SPR.res, SPR.res);
      paintBubble(g, G.R, i);
      SPR.cache['c' + i] = { c, S };
    }
  }

  function drawBubble(g, x, y, r, ci) {
    const spr = SPR.cache['c' + (ci % COLORS.length)];
    if (!spr) return;
    const size = spr.S * (r / G.R);
    g.drawImage(spr.c, x - size / 2, y - size / 2, size, size);
  }

  /* ------------------------------------------------------------
     PARTICLES — pooled
     ------------------------------------------------------------ */
  class Particle {
    constructor() { this.alive = false; }
    init(x, y, vx, vy, r, color, life, kind) {
      this.alive = true;
      this.x = x; this.y = y;
      this.vx = vx; this.vy = vy;
      this.r = r; this.color = color;
      this.life = life; this.maxLife = life;
      this.kind = kind || 'drop';
      this.rot = Math.random() * 6.28;
      this.vr = U.rand(-8, 8);
      return this;
    }
    update(dt) {
      this.life -= dt;
      if (this.life <= 0) { this.alive = false; return; }
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      this.vy += 900 * dt;
      this.vx *= (1 - 1.2 * dt);
      this.rot += this.vr * dt;
    }
  }

  const Particles = {
    pool: [], max: 280,
    init(max) {
      this.max = max || 280;
      this.pool = [];
      for (let i = 0; i < this.max; i++) this.pool.push(new Particle());
    },
    spawn(x, y, vx, vy, r, color, life, kind) {
      for (let i = 0; i < this.pool.length; i++) {
        const p = this.pool[i];
        if (!p.alive) { p.init(x, y, vx, vy, r, color, life, kind); return p; }
      }
      return null;
    },
    update(dt) { for (const p of this.pool) if (p.alive) p.update(dt); },
    clear() { for (const p of this.pool) p.alive = false; },
    draw(g) {
      for (const p of this.pool) {
        if (!p.alive) continue;
        const a = U.clamp(p.life / p.maxLife, 0, 1);
        g.globalAlpha = a;
        if (p.kind === 'ring') {
          const t = 1 - a;
          g.strokeStyle = p.color;
          g.lineWidth = Math.max(1, 6 * a);
          g.beginPath();
          g.arc(p.x, p.y, p.r * (0.3 + t * 1.0), 0, 6.2832);
          g.stroke();
        } else {
          g.fillStyle = p.color;
          g.beginPath();
          g.arc(p.x, p.y, p.r * (0.4 + 0.6 * a), 0, 6.2832);
          g.fill();
        }
      }
      g.globalAlpha = 1;
    },
  };

  /* ------------------------------------------------------------
     FALLING BUBBLES
     ------------------------------------------------------------ */
  class FallingBubble {
    constructor(x, y, r, ci) {
      this.x = x; this.y = y;
      this.vx = U.rand(-70, 70);
      this.vy = U.rand(-140, -40);
      this.r = r; this.ci = ci;
      this.rot = 0; this.vr = U.rand(-4, 4);
      this.sx = 1; this.sy = 1;
      this.dead = false;
    }
    update(dt, gravity) {
      this.vy += (gravity || 2100) * dt;
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      this.rot += this.vr * dt;
      const sp = Math.hypot(this.vx, this.vy);
      this.sy = U.clamp(1 + sp / 2600, 1, 1.5);
      this.sx = 1 / this.sy;
      if (this.y > G.H + this.r * 3) this.dead = true;
    }
    draw(g) {
      g.save();
      g.translate(this.x, this.y);
      g.rotate(this.rot);
      g.scale(this.sx, this.sy);
      g.globalAlpha = U.clamp(1 - (this.y - G.H * 0.8) / (G.H * 0.35), 0.15, 1);
      drawBubble(g, 0, 0, this.r, this.ci);
      g.restore();
      g.globalAlpha = 1;
    }
  }

  /* ------------------------------------------------------------
     FLOATING TEXT
     ------------------------------------------------------------ */
  class FloatText {
    constructor(x, y, text, color, size) {
      this.x = x; this.y = y;
      this.text = text; this.color = color;
      this.size = size || 26;
      this.life = 1.1; this.max = 1.1;
      this.vy = -90;
    }
    update(dt) {
      this.life -= dt;
      this.y += this.vy * dt;
      this.vy *= (1 - 1.6 * dt);
    }
    draw(g) {
      const a = U.clamp(this.life / this.max, 0, 1);
      g.globalAlpha = a;
      g.font = '900 ' + this.size + 'px system-ui, -apple-system, sans-serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.lineWidth = 5;
      g.strokeStyle = 'rgba(0,0,0,.55)';
      g.strokeText(this.text, this.x, this.y);
      g.fillStyle = this.color;
      g.fillText(this.text, this.x, this.y);
      g.globalAlpha = 1;
    }
  }

  NS.Graphics = {
    SPR,
    setColors,
    setGeometry,
    buildSprites,
    drawBubble,
    Particles,
    FallingBubble,
    FloatText,
    paintBubble,
  };
})(window.BS);
