/* ============================================================
   game.js — Game state, update, render, level flow
   ============================================================ */
window.BS = window.BS || {};

(function (NS) {
  'use strict';
  const U = NS.Utils;
  const E = NS.Engine;
  const Gr = NS.Graphics;

  /* ------------------------------------------------------------
     GAME STATE
     ------------------------------------------------------------ */
  const Game = {
    active: false,
    paused: false,
    levelIndex: 0,
    level: null,
    score: 0,
    shotsLeft: 0,
    bombsLeft: 0,
    useBomb: false,
    current: { ci: 0 },
    next: { ci: 0 },
    shot: null,
    falling: [],
    texts: [],
    aimAngle: -Math.PI / 2,
    aiming: false,
    pointer: { x: 0, y: 0 },
    recoil: 0,
    muzzle: 0,
    shake: 0,
    flash: 0,
    time: 0,
    combo: 0,
    comboTimer: 0,
    shotsSinceDrop: 0,
    resultShown: false,
    dropEvery: 12,
    colorCount: 4,
    initialBubbles: 0,
    totalBubbles: 0,
    lastStars: 0,
  };

  /* ------------------------------------------------------------
     SHOT OBJECT (pooled — single instance is enough)
     ------------------------------------------------------------ */
  class Shot {
    constructor() {
      this.active = false;
      this.x = 0; this.y = 0;
      this.dx = 0; this.dy = 0;
      this.ci = 0;
      this.bomb = false;
      this.trail = [];
      this.life = 6;
    }
    fire(x, y, angle, ci, bomb) {
      this.active = true;
      this.x = x; this.y = y;
      this.dx = Math.cos(angle); this.dy = Math.sin(angle);
      this.ci = ci;
      this.bomb = !!bomb;
      this.trail.length = 0;
      this.life = 6;
    }
    update(dt, onLand) {
      if (!this.active) return;
      this.life -= dt;
      if (this.life <= 0) { this.active = false; return; }

      let remaining = NS.State.cfg.shooting.shotSpeed * dt;
      const step = NS.State.G.R * 0.42;
      let guard = 0;
      const G = NS.State.G;
      const gridTop = NS.State.cfg.grid.gridTop;

      while (remaining > 0 && guard++ < 40) {
        const s = Math.min(step, remaining);
        remaining -= s;
        this.x += this.dx * s;
        this.y += this.dy * s;

        if (this.x - G.R < 0) { this.x = G.R; this.dx = -this.dx; NS.Sound.bounce(); }
        else if (this.x + G.R > G.W) { this.x = G.W - G.R; this.dx = -this.dx; NS.Sound.bounce(); }

        if (this.y - G.R <= gridTop) {
          this.y = gridTop + G.R;
          this.active = false;
          onLand(this.x, this.y);
          return;
        }
        if (E.collidesAt(this.x, this.y, G.R)) {
          this.active = false;
          onLand(this.x, this.y);
          return;
        }
        if (this.y > G.H + 60) { this.active = false; return; }
      }
      this.trail.push({ x: this.x, y: this.y });
      if (this.trail.length > 7) this.trail.shift();
    }
    draw(g) {
      if (!this.active) return;
      const G = NS.State.G;
      for (let i = 0; i < this.trail.length; i++) {
        const t = this.trail[i];
        g.globalAlpha = (i / this.trail.length) * 0.22;
        Gr.drawBubble(g, t.x, t.y, G.R * (0.5 + 0.5 * i / this.trail.length), this.ci);
      }
      g.globalAlpha = 1;
      if (this.bomb) {
        const t = performance.now() / 1000;
        const pulse = 0.5 + 0.5 * Math.sin(t * 6);
        g.beginPath(); g.arc(this.x, this.y, G.R * (1.15 + 0.10 * pulse), 0, 6.2832);
        g.fillStyle = 'rgba(255,140,40,' + (0.20 + 0.22 * pulse) + ')';
        g.fill();
        g.beginPath(); g.arc(this.x, this.y, G.R, 0, 6.2832);
        const grd = g.createRadialGradient(this.x - G.R * 0.3, this.y - G.R * 0.3, G.R * 0.1, this.x, this.y, G.R);
        grd.addColorStop(0, '#c9ccd2');
        grd.addColorStop(0.5, '#5c6b82');
        grd.addColorStop(1, '#141a26');
        g.fillStyle = grd; g.fill();
      } else {
        Gr.drawBubble(g, this.x, this.y, G.R, this.ci);
      }
    }
  }

  /* ------------------------------------------------------------
     INIT / START LEVEL
     ------------------------------------------------------------ */
  let shot = null;

  function init() {
    shot = new Shot();
    Game.shot = shot;
  }

  function startLevel(index) {
    const cfg = NS.State.cfg;
    const levels = NS.State.levels;
    const lvl = levels[index];
    if (!lvl) return;

    Game.levelIndex = index;
    Game.level = lvl;
    Game.colorCount = lvl.colors || 4;
    Game.shotsLeft = (lvl.shots != null) ? lvl.shots : cfg.gameplay.shotsPerLevel;
    Game.bombsLeft = (lvl.bombs != null) ? lvl.bombs : cfg.gameplay.bombsPerLevel;
    Game.dropEvery = (lvl.drop != null) ? lvl.drop : cfg.gameplay.dropEveryShots;
    Game.shotsSinceDrop = 0;
    Game.score = 0;
    Game.combo = 0;
    Game.comboTimer = 0;
    Game.shake = 0;
    Game.flash = 0;
    Game.recoil = 0;
    Game.muzzle = 0;
    Game.time = 0;
    Game.falling.length = 0;
    Game.texts.length = 0;
    Game.resultShown = false;
    Game.useBomb = false;
    Game.aimAngle = -Math.PI / 2;
    shot.active = false;
    Gr.Particles.clear();

    E.buildFromPattern(lvl.pattern, Game.colorCount);
    Game.initialBubbles = E.countBubbles();
    Game.totalBubbles = Game.initialBubbles;

    // ⚡ BUG FIX: Board build hone ke BAAD colors pick karo
    Game.current = { ci: E.pickExistingColor(Game.colorCount) };
    Game.next = { ci: E.pickExistingColor(Game.colorCount) };

    Game.active = true;
    Game.paused = false;

    NS.UI.showScreen(null);
    NS.UI.setHudVisible(true);
    NS.UI.updateHud();
    NS.Sound.startMusic();
  }

  /* ------------------------------------------------------------
     LANDING RESOLUTION
     ------------------------------------------------------------ */
  function onShotLand(x, y) {
    const G = NS.State.G;
    const cfg = NS.State.cfg;

    const cell = E.snapCell(x, y);
    if (!cell) { nextBubble(); return; }

    const i = cell.i, c = cell.c;

    const maxRow = G.maxRows;
    if (i > maxRow + 1) {
      E.setBubble(i, c, { ci: shot.ci });
      Game.shake = 18;
      Game.flash = 0.5;
      endLevel(false, 'Danger line crossed');
      return;
    }

    E.setBubble(i, c, { ci: shot.ci });
    NS.Sound.stick();
    U.buzz(8);
    Game.shake = Math.max(Game.shake, 1.4);

    if (shot.bomb) {
      const list = E.collectRadius(i, c, 2);
      popList(list, true);
      NS.Sound.bomb();
      Game.shake = 16;
      Game.flash = Math.max(Game.flash, 0.4);
      U.buzz(45);
    } else {
      const group = E.floodSame(i, c, shot.ci);
      if (group.length >= 3) {
        popList(group, false);
      }
    }

    const floaters = E.findFloating();
    if (floaters.length > 0) detachList(floaters);

    if (E.countBubbles() === 0) {
      endLevel(true);
      return;
    }

    Game.shotsSinceDrop++;
    if (Game.shotsSinceDrop >= Game.dropEvery) {
      Game.shotsSinceDrop = 0;
      addRow();
    }

    checkDanger();
    nextBubble();
    NS.UI.updateHud();
  }

  function popList(list, big) {
    let count = 0;
    const cfg = NS.State.cfg;
    for (const cell of list) {
      const b = E.bubbleAt(cell.i, cell.c);
      if (!b) continue;
      NS.Engine.grid.rows[cell.i][cell.c] = null;
      count++;
      const x = E.cellX(cell.i, cell.c), y = E.cellY(cell.i);
      spawnPopBurst(x, y, b.ci);
      Game.score += cfg.gameplay.popScore * (1 + Game.combo * 0.25) | 0;
    }
    if (count > 0) {
      Game.combo++;
      Game.comboTimer = cfg.gameplay.comboWindow;
      NS.Sound.pop(Game.combo);
      if (Game.combo >= 2) showComboText();
      if (big) Game.shake = Math.max(Game.shake, 12);
    }
    return count;
  }

  function detachList(list) {
    let bonus = 0;
    const cfg = NS.State.cfg;
    const G = NS.State.G;
    for (const cell of list) {
      const b = E.bubbleAt(cell.i, cell.c);
      if (!b) continue;
      NS.Engine.grid.rows[cell.i][cell.c] = null;
      const x = E.cellX(cell.i, cell.c), y = E.cellY(cell.i);
      Game.falling.push(new Gr.FallingBubble(x, y, G.R, b.ci));
      bonus += cfg.gameplay.floatScore;
    }
    if (bonus > 0) {
      Game.score += bonus;
      NS.Sound.drop();
      addText(G.W / 2, G.H * 0.5, 'DROP! +' + bonus, '#9effc4', 30);
    }
  }

  function addRow() {
    const G = NS.State.G;
    E.addRow(Game.colorCount, (n) => ({ ci: U.randInt(0, n - 1) }));
    Game.shake = Math.max(Game.shake, 7);
    NS.Sound.bounce();
    addText(G.W / 2, NS.State.cfg.grid.gridTop + 40, 'NEW ROW', '#ff9f6b', 22);
  }

  function checkDanger() {
    const G = NS.State.G;
    const lowest = E.lowestOccupiedRow();
    if (lowest < 0) return;
    if (E.cellY(lowest) + G.R > G.dangerY) {
      Game.shake = 20;
      Game.flash = 0.5;
      endLevel(false, 'Danger line crossed');
    }
  }

  /* ------------------------------------------------------------
     ⚡ BUG FIX: nextBubble
     Purani bubble ko promote karne se pehle check karo ke uska
     color ab bhi board pe hai. Agar nahi, to naya pick karo.
     ------------------------------------------------------------ */
  function nextBubble() {
    // Promote "next" → "current"
    Game.current = Game.next;

    // Agar promoted bubble ka color board pe nahi hai, dobara pick karo
    if (!E.colorExists(Game.current.ci)) {
      Game.current = { ci: E.pickExistingColor(Game.colorCount) };
    }

    // "next" hamesha current board state se pick karo
    Game.next = { ci: E.pickExistingColor(Game.colorCount) };

    // Safety: agar current aur next ek hi hain aur sirf 1 color bacha,
    // toh next bhi wahi rakho
    if (!E.colorExists(Game.next.ci)) {
      Game.next = { ci: E.pickExistingColor(Game.colorCount) };
    }

    Game.useBomb = false;
    NS.UI.updateHud();
  }

  /* ------------------------------------------------------------
     FIRING
     ------------------------------------------------------------ */
  function fireShot() {
    if (shot.active) return;
    const G = NS.State.G;
    const cfg = NS.State.cfg;

    if (Game.shotsLeft <= 0 && !Game.useBomb) return;

    const a = Game.aimAngle;
    const mx = G.shooterX + Math.cos(a) * (G.R * 1.55);
    const my = G.shooterY + Math.sin(a) * (G.R * 1.55);

    shot.fire(mx, my, a, Game.current.ci, Game.useBomb);
    Game.recoil = 1;
    Game.muzzle = 1;
    NS.Sound.shoot();
    U.buzz(10);

    if (Game.useBomb) {
      Game.bombsLeft = Math.max(0, Game.bombsLeft - 1);
    } else {
      if (Game.shotsLeft > 0) Game.shotsLeft--;
    }
    NS.UI.updateHud();
  }

  function swapBubbles() {
    const t = Game.current;
    Game.current = Game.next;
    Game.next = t;
    NS.Sound.swap();
    Game.recoil = 0.35;
  }

  function activateBomb() {
    if (Game.bombsLeft <= 0 || Game.useBomb) return;
    Game.useBomb = true;
    NS.Sound.click();
    NS.UI.updateHud();
  }

  /* ------------------------------------------------------------
     END CONDITIONS
     ------------------------------------------------------------ */
  function endLevel(won, reason) {
    if (Game.resultShown) return;
    Game.resultShown = true;
    Game.active = false;
    NS.Sound.stopMusic();
    if (won) {
      NS.Sound.complete();
      NS.UI.showWin();
    } else {
      NS.Sound.fail();
      NS.UI.showLose(reason || 'Out of bubbles');
    }
    NS.UI.setHudVisible(false);
  }

  /* ------------------------------------------------------------
     EFFECTS
     ------------------------------------------------------------ */
  function spawnPopBurst(x, y, ci) {
    const G = NS.State.G;
    const c = NS.State.cfg.colors[ci % NS.State.cfg.colors.length];
    const col = c ? c.main : '#fff';
    const light = c ? c.light : '#fff';
    for (let i = 0; i < 9; i++) {
      const a = Math.random() * 6.2832, sp = U.rand(90, 340);
      Gr.Particles.spawn(
        x, y,
        Math.cos(a) * sp, Math.sin(a) * sp - 60,
        U.rand(G.R * 0.10, G.R * 0.24),
        i % 3 === 0 ? light : col,
        U.rand(0.35, 0.75), 'drop'
      );
    }
    Gr.Particles.spawn(x, y, 0, 0, G.R * 1.9, col, 0.36, 'ring');
  }

  function addText(x, y, text, color, size) {
    Game.texts.push(new Gr.FloatText(x, y, text, color, size));
  }

  function showComboText() {
    const c = Game.combo;
    let msg = null, col = '#fff', size = 26;
    if (c === 2) { msg = 'NICE!'; col = '#8ff0ff'; }
    else if (c === 3) { msg = 'GREAT!'; col = '#a6ff8f'; size = 30; }
    else if (c === 4) { msg = 'AWESOME!'; col = '#ffd23f'; size = 34; }
    else if (c >= 5) { msg = 'UNSTOPPABLE x' + c; col = '#ff8ad8'; size = 36; }
    if (msg) {
      addText(NS.State.G.W / 2, NS.State.G.H * 0.42, msg, col, size);
      if (c >= 4) Game.flash = Math.max(Game.flash, 0.25);
      Game.shake = Math.max(Game.shake, 3 + c);
    }
  }

  /* ------------------------------------------------------------
     AIMING
     ------------------------------------------------------------ */
  function computeAim(px, py) {
    const G = NS.State.G;
    const cfg = NS.State.cfg;
    let angle = Math.atan2(py - G.shooterY, px - G.shooterX);
    const minA = -Math.PI + 0.30, maxA = -0.30;
    angle = U.clamp(angle, minA, maxA);

    if (cfg.shooting.aimAssist && !Game.useBomb) {
      const color = Game.current.ci;
      const range = 0.16;
      const N = 17;
      let best = null, bestOff = Infinity;
      for (let s = 0; s < N; s++) {
        const t = (s / (N - 1)) * 2 - 1;
        const a = U.clamp(angle + t * range, minA, maxA);
        const res = E.simulateShot(G.shooterX, G.shooterY, a, false);
        if (!res.hit || !res.cell) continue;
        const ci = res.cell.i, cc = res.cell.c;
        let match = false;
        const n = E.neighbors(ci);
        for (let k = 0; k < n.length; k++) {
          const nb = E.bubbleAt(ci + n[k][0], cc + n[k][1]);
          if (nb && nb.ci === color) { match = true; break; }
        }
        if (match) {
          const off = Math.abs(t);
          if (off < bestOff) { bestOff = off; best = a; }
        }
      }
      if (best !== null) angle = best;
    }
    Game.aimAngle = angle;
  }

  /* ------------------------------------------------------------
     UPDATE
     ------------------------------------------------------------ */
  function update(dt) {
    Game.time += dt;

    if (Game.active && !Game.paused) {
      shot.update(dt, onShotLand);

      if (Game.comboTimer > 0) {
        Game.comboTimer -= dt;
        if (Game.comboTimer <= 0) Game.combo = 0;
      }

      Game.shake *= Math.pow(0.0016, dt);
      if (Game.shake < 0.05) Game.shake = 0;
      Game.flash = Math.max(0, Game.flash - dt * 2.2);
      Game.recoil = Math.max(0, Game.recoil - dt * 4.5);
      Game.muzzle = Math.max(0, Game.muzzle - dt * 6);

      const grav = NS.State.cfg.shooting.gravity;
      for (let i = Game.falling.length - 1; i >= 0; i--) {
        Game.falling[i].update(dt, grav);
        if (Game.falling[i].dead) Game.falling.splice(i, 1);
      }

      if (!shot.active && Game.shotsLeft <= 0 && E.countBubbles() > 0) {
        endLevel(false, 'Out of bubbles');
      }
    }

    Gr.Particles.update(dt);
    for (let i = Game.texts.length - 1; i >= 0; i--) {
      Game.texts[i].update(dt);
      if (Game.texts[i].life <= 0) Game.texts.splice(i, 1);
    }
  }

  /* ------------------------------------------------------------
     RENDER
     ------------------------------------------------------------ */
  function render(g) {
    const G = NS.State.G;
    const cfg = NS.State.cfg;

    let shakeX = 0, shakeY = 0;
    if (Game.shake > 0.1) {
      shakeX = U.rand(-Game.shake, Game.shake);
      shakeY = U.rand(-Game.shake, Game.shake);
    }
    g.save();
    g.translate(shakeX, shakeY);

    if (Game.active || Game.resultShown) {
      drawDangerLine(g);
      drawGridBubbles(g);
      drawFalling(g);
      if (Game.active) {
        drawAim(g);
        shot.draw(g);
        drawShooter(g);
      }
    }
    Gr.Particles.draw(g);
    for (const t of Game.texts) t.draw(g);

    g.restore();

    if (Game.flash > 0.01) {
      g.fillStyle = 'rgba(255,255,255,' + (Game.flash * 0.6) + ')';
      g.fillRect(0, 0, G.W, G.H);
    }
    drawVignette(g);
  }

  function drawVignette(g) {
    const G = NS.State.G;
    const grd = g.createRadialGradient(G.W / 2, G.H * 0.45, G.H * 0.28, G.W / 2, G.H * 0.5, G.H * 0.86);
    grd.addColorStop(0, 'rgba(0,0,0,0)');
    grd.addColorStop(1, 'rgba(0,0,0,0.5)');
    g.fillStyle = grd;
    g.fillRect(0, 0, G.W, G.H);
  }

  function drawDangerLine(g) {
    const G = NS.State.G;
    const y = G.dangerY;
    const t = performance.now() / 1000;
    const pulse = 0.5 + 0.5 * Math.sin(t * 3);

    g.save();
    g.globalAlpha = 0.28 + 0.18 * pulse;
    g.strokeStyle = '#ff4d6a';
    g.lineWidth = 3;
    g.setLineDash([16, 12]);
    g.lineDashOffset = -t * 40;
    g.beginPath(); g.moveTo(0, y); g.lineTo(G.W, y); g.stroke();
    g.restore();

    const grd = g.createLinearGradient(0, y - 40, 0, y + 10);
    grd.addColorStop(0, 'rgba(255,60,90,0)');
    grd.addColorStop(1, 'rgba(255,60,90,' + (0.10 + 0.08 * pulse) + ')');
    g.fillStyle = grd;
    g.fillRect(0, y - 40, G.W, 50);
  }

  function drawGridBubbles(g) {
    const G = NS.State.G;
    const rows = E.grid.rows;
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (!row) continue;
      const y = E.cellY(i);
      if (y < -G.R * 2 || y > G.H + G.R * 2) continue;
      for (let c = 0; c < row.length; c++) {
        const b = row[c];
        if (!b) continue;
        Gr.drawBubble(g, E.cellX(i, c), y, G.R, b.ci);
      }
    }
  }

  function drawFalling(g) {
    for (const f of Game.falling) f.draw(g);
  }

  function drawAim(g) {
    if (!NS.State.cfg.shooting.trajectoryPreview) return;
    if (shot.active) return;

    const G = NS.State.G;
    const res = E.simulateShot(G.shooterX, G.shooterY, Game.aimAngle, true);
    const pts = res.pts;
    if (!pts || pts.length < 2) return;

    const t = performance.now() / 1000;
    g.save();
    g.setLineDash([12, 14]);
    g.lineDashOffset = -t * 90;
    g.lineWidth = 5;
    g.lineCap = 'round';
    g.strokeStyle = 'rgba(160,235,255,0.55)';
    g.beginPath();
    g.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) g.lineTo(pts[i].x, pts[i].y);
    g.stroke();
    g.setLineDash([]);
    g.restore();

    if (res.cell) {
      const gx = E.cellX(res.cell.i, res.cell.c);
      const gy = E.cellY(res.cell.i);
      const pulse = 0.5 + 0.5 * Math.sin(t * 7);
      g.globalAlpha = 0.20 + 0.20 * pulse;
      Gr.drawBubble(g, gx, gy, G.R, Game.current.ci);
      g.globalAlpha = 0.55 + 0.3 * pulse;
      g.strokeStyle = '#ffffff';
      g.lineWidth = 2.5;
      g.beginPath(); g.arc(gx, gy, G.R * 0.98, 0, 6.2832); g.stroke();
      g.globalAlpha = 1;
    }

    for (let i = 1; i < pts.length - 1; i++) {
      const p = pts[i];
      if (p.x < G.R * 1.2 || p.x > G.W - G.R * 1.2) {
        g.globalAlpha = 0.5;
        g.strokeStyle = '#8fe8ff';
        g.lineWidth = 2;
        g.beginPath(); g.arc(p.x, p.y, 8, 0, 6.2832); g.stroke();
        g.globalAlpha = 1;
      }
    }
  }

  function drawShooter(g) {
    const G = NS.State.G;
    const a = Game.aimAngle;
    const rec = Game.recoil * 12;
    const bx = G.shooterX, by = G.shooterY;

    g.save();

    g.beginPath();
    g.ellipse(bx, by + G.R * 1.15, G.R * 2.1, G.R * 0.55, 0, 0, 6.2832);
    g.fillStyle = 'rgba(10,20,44,.85)';
    g.fill();
    g.strokeStyle = 'rgba(120,200,255,.30)';
    g.lineWidth = 2;
    g.stroke();

    g.save();
    g.translate(bx, by);
    g.rotate(a + Math.PI / 2);
    g.translate(0, rec);
    const bg = g.createLinearGradient(-G.R * 0.55, 0, G.R * 0.55, 0);
    bg.addColorStop(0, '#26567a');
    bg.addColorStop(0.45, '#9fd6f5');
    bg.addColorStop(1, '#1b3f5c');
    g.beginPath();
    const bw = G.R * 0.55, bl = G.R * 2.0;
    if (g.roundRect) g.roundRect(-bw, -bl, bw * 2, bl, bw);
    else g.rect(-bw, -bl, bw * 2, bl);
    g.fillStyle = bg;
    g.fill();
    g.strokeStyle = 'rgba(180,240,255,.45)';
    g.lineWidth = 2;
    g.stroke();
    g.restore();

    if (Game.muzzle > 0.02) {
      const mx = bx + Math.cos(a) * G.R * 2.1;
      const my = by + Math.sin(a) * G.R * 2.1;
      g.globalAlpha = Game.muzzle;
      const fg = g.createRadialGradient(mx, my, 2, mx, my, G.R * 1.4);
      fg.addColorStop(0, 'rgba(255,255,220,0.95)');
      fg.addColorStop(0.4, 'rgba(140,230,255,0.5)');
      fg.addColorStop(1, 'rgba(80,180,255,0)');
      g.beginPath(); g.arc(mx, my, G.R * 1.4, 0, 6.2832);
      g.fillStyle = fg; g.fill();
      g.globalAlpha = 1;
    }

    if (Game.useBomb) {
      const t = performance.now() / 1000;
      const pulse = 0.5 + 0.5 * Math.sin(t * 6);
      g.beginPath(); g.arc(bx, by, G.R * (1.15 + 0.10 * pulse), 0, 6.2832);
      g.fillStyle = 'rgba(255,140,40,' + (0.25 + 0.25 * pulse) + ')';
      g.fill();
      g.beginPath(); g.arc(bx, by, G.R, 0, 6.2832);
      const grd = g.createRadialGradient(bx - G.R * 0.3, by - G.R * 0.3, G.R * 0.1, bx, by, G.R);
      grd.addColorStop(0, '#c9ccd2');
      grd.addColorStop(0.5, '#5c6b82');
      grd.addColorStop(1, '#141a26');
      g.fillStyle = grd; g.fill();
      g.font = '900 ' + (G.R * 0.9) + 'px system-ui, sans-serif';
      g.fillStyle = '#fff';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText('B', bx, by + 1);
    } else {
      Gr.drawBubble(g, bx, by, G.R, Game.current.ci);
    }

    const nx = G.W - G.R * 2.4;
    const ny = by + G.R * 0.3;
    g.globalAlpha = 0.85;
    Gr.drawBubble(g, nx, ny, G.R * 0.72, Game.next.ci);
    g.globalAlpha = 1;
    g.font = '800 13px system-ui, sans-serif';
    g.fillStyle = 'rgba(160,220,255,.75)';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('NEXT', nx, ny - G.R * 1.15);

    g.restore();
  }

  /* ------------------------------------------------------------
     EXPORT
     ------------------------------------------------------------ */
  NS.Game = {
    state: Game,
    init,
    startLevel,
    update,
    render,
    computeAim,
    fireShot,
    swapBubbles,
    activateBomb,
    nextBubble,
    endLevel,
  };
})(window.BS);
