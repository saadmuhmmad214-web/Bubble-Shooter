/* ============================================================
   script.js — Bootstrap, config loading, UI, input, main loop
   ============================================================ */
window.BS = window.BS || {};

(function (NS) {
  'use strict';
  const U = NS.Utils;
  const Gr = NS.Graphics;
  const E = NS.Engine;
  const GameMod = NS.Game;

  /* ------------------------------------------------------------
     DEFAULT CONFIG (fallback if configs.json cannot be loaded)
     ------------------------------------------------------------ */
  const DEFAULT_CONFIG = {
    game: { title: 'Bubble Shooter', version: '1.0.0', showCredit: true },
    credit: { developer: 'Muhammad Saad', country: 'Pakistan', license: 'MIT', year: '2025' },
    background: { mode: 'builtin', file: 'backgrounds/01.svg' },
    grid: { cols: 11, bubbleRadius: 32, gridTop: 178, maxRows: 14, shooterBottomMargin: 152, dangerGap: 3.0 },
    shooting: { shotSpeed: 1450, gravity: 2100, aimAssist: true, trajectoryPreview: true, wallBounce: true },
    gameplay: {
      bombsPerLevel: 3, shotsPerLevel: 60, dropEveryShots: 12,
      popScore: 10, floatScore: 25, comboWindow: 1.6, maxParticles: 280,
    },
    colors: [
      { name: 'red',    light: '#ffc2c8', main: '#ff4d5e', dark: '#8f0f26', pattern: 'dots' },
      { name: 'blue',   light: '#bcdcff', main: '#3a9dff', dark: '#0b3d7d', pattern: 'stripes' },
      { name: 'green',  light: '#c2ffd8', main: '#3fd97a', dark: '#0d6b36', pattern: 'chevron' },
      { name: 'yellow', light: '#fff3b8', main: '#ffce2e', dark: '#9c6a00', pattern: 'star' },
      { name: 'purple', light: '#e2c8ff', main: '#b06bff', dark: '#4d1c94', pattern: 'cross' },
      { name: 'cyan',   light: '#c2fffa', main: '#2fe0d0', dark: '#0a6e66', pattern: 'hex' },
    ],
    settings: { sfx: 0.8, music: 0.4, haptics: true, aimAssist: true, trajectory: true },
  };

  const DEFAULT_LEVELS = {
    levels: [
      { name: 'Level 1', colors: 4, bombs: 3, shots: 40, pattern: ['00112233440', '0112233445', '01230123012'] },
      { name: 'Level 2', colors: 4, bombs: 3, shots: 40, pattern: ['00112233440', '0112233445', '01230123012', '00112233440'] },
      { name: 'Level 3', colors: 4, bombs: 3, shots: 40, pattern: ['00111111100', '01122222110', '00123333210', '00012332100'] },
      { name: 'Level 4', colors: 4, bombs: 3, shots: 45, pattern: ['33333333333', '30000000003', '30111111103', '30122222103', '30111111103'] },
      { name: 'Level 5', colors: 5, bombs: 3, shots: 45, pattern: ['01234012340', '01234012340', '01234012340'] },
      { name: 'Level 6', colors: 5, bombs: 3, shots: 45, pattern: ['00112233440', '0112233445', '00112233440', '0112233445', '00112233440'] },
      { name: 'Level 7', colors: 5, bombs: 3, shots: 50, pattern: ['44444444444', '03333333330', '00222222200', '00011111000'] },
      { name: 'Level 8', colors: 5, bombs: 3, shots: 50, pattern: ['01234012340', '12340123401', '23401234012', '34012340123', '40123401234'] },
      { name: 'Level 9', colors: 6, bombs: 3, shots: 55, pattern: ['00112233445', '0112233445', '00112233445', '0112233445'] },
      { name: 'Level 10', colors: 6, bombs: 3, shots: 55, pattern: ['55555555555', '04444444440', '00333333300', '00022222000', '00001110000'] },
      { name: 'Level 11', colors: 5, bombs: 3, shots: 50, pattern: ['00110011001', '11001100110', '00110011001', '11001100110', '00110011001'] },
      { name: 'Level 12', colors: 6, bombs: 3, shots: 55, pattern: ['01234501234', '12345012345', '01234501234', '12345012345'] },
      { name: 'Level 13', colors: 6, bombs: 3, shots: 55, pattern: ['00112233440', '0112233445', '00112233440', '0112233445', '00112233440'] },
      { name: 'Level 14', colors: 6, bombs: 3, shots: 55, pattern: ['00220022002', '01100110011', '02200220022', '01100110011', '00220022002'] },
      { name: 'Level 15', colors: 6, bombs: 3, shots: 60, pattern: ['00112233440', '0112233445', '02233445500', '0112233445', '00112233440'] },
      { name: 'Level 16', colors: 6, bombs: 3, shots: 60, pattern: ['11111111111', '12222222221', '12333333321', '12344444321', '12345554321'] },
      { name: 'Level 17', colors: 6, bombs: 3, shots: 60, pattern: ['00112233440', '01122334455', '02233445500', '00112233440'] },
      { name: 'Level 18', colors: 6, bombs: 3, shots: 60, pattern: ['55555555555', '54444444445', '54333333345', '54322222345', '54321112345'] },
      { name: 'Level 19', colors: 6, bombs: 3, shots: 60, pattern: ['00112233440', '0112233445', '0223344550', '0112233445', '0223344550'] },
      { name: 'Level 20', colors: 6, bombs: 3, shots: 65, pattern: ['01234501234', '12345012345', '23450123450', '34501234501', '45012345012'] },
    ],
  };

  /* ------------------------------------------------------------
     STATE
     ------------------------------------------------------------ */
  NS.State = {
    cfg: null,
    levels: [],
    G: null,
    game: null,
  };

  /* ------------------------------------------------------------
     SOUND (simple Web Audio)
     ------------------------------------------------------------ */
  const Sound = {
    ctx: null, master: null, sfxGain: null, musicGain: null, ready: false,
    musicOn: false, musicTimer: 0, musicStep: 0, musicNext: 0,

    init() {
      if (this.ctx) return;
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        this.ctx = new AC();
        this.master = this.ctx.createGain(); this.master.gain.value = 1;
        this.master.connect(this.ctx.destination);
        this.sfxGain = this.ctx.createGain();
        this.musicGain = this.ctx.createGain();
        this.sfxGain.connect(this.master);
        this.musicGain.connect(this.master);
        this.ready = true;
        this.applyVolumes();
      } catch (e) { this.ready = false; }
    },
    resume() {
      if (this.ctx && this.ctx.state === 'suspended') {
        try { this.ctx.resume(); } catch (e) {}
      }
    },
    applyVolumes() {
      if (!this.ready) return;
      const s = NS.State.cfg.settings;
      this.sfxGain.gain.value = s.sfx;
      this.musicGain.gain.value = s.music * 0.35;
    },
    tone(freq, dur, type, vol, when, glide, dest) {
      if (!this.ready) return;
      const t = when !== undefined ? when : this.ctx.currentTime;
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = type || 'sine';
      o.frequency.setValueAtTime(freq, t);
      if (glide) o.frequency.exponentialRampToValueAtTime(Math.max(20, glide), t + dur);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(Math.max(0.0001, vol), t + Math.min(0.015, dur * 0.25));
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(dest || this.sfxGain);
      o.start(t); o.stop(t + dur + 0.03);
    },
    noise(dur, vol, freq, when, q) {
      if (!this.ready) return;
      const t = when !== undefined ? when : this.ctx.currentTime;
      const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = this.ctx.createBufferSource(); src.buffer = buf;
      const f = this.ctx.createBiquadFilter();
      f.type = 'bandpass'; f.frequency.value = freq || 900; f.Q.value = q || 1.1;
      const g = this.ctx.createGain(); g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      src.connect(f); f.connect(g); g.connect(this.sfxGain);
      src.start(t); src.stop(t + dur + 0.02);
    },
    shoot()   { this.tone(660, 0.09, 'square', 0.13, undefined, 340); this.tone(1320, 0.05, 'sine', 0.05, undefined, 900); },
    bounce()  { this.tone(1500, 0.035, 'triangle', 0.07, undefined, 1100); },
    stick()   { this.tone(220, 0.11, 'sine', 0.16, undefined, 130); this.noise(0.06, 0.05, 500); },
    pop(c) {
      const base = 440 * Math.pow(1.075, Math.min(c || 0, 12));
      this.tone(base, 0.10, 'sine', 0.16, undefined, base * 1.6);
      this.tone(base * 2, 0.07, 'triangle', 0.08, this.ctx.currentTime + 0.02, base * 2.6);
    },
    drop()    { this.tone(700, 0.35, 'sine', 0.12, undefined, 180); this.noise(0.22, 0.05, 400); },
    bomb()    { this.noise(0.45, 0.34, 220, undefined, 0.7); this.tone(90, 0.42, 'sawtooth', 0.22, undefined, 36); },
    swap()    { this.tone(520, 0.07, 'triangle', 0.09, undefined, 780); },
    click()   { this.tone(880, 0.045, 'square', 0.07, undefined, 700); },
    complete() {
      const t = this.ctx.currentTime;
      [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.30, 'triangle', 0.14, t + i * 0.11));
    },
    fail() {
      const t = this.ctx.currentTime;
      this.tone(392, 0.30, 'sawtooth', 0.13, t, 300);
      this.tone(294, 0.46, 'sawtooth', 0.12, t + 0.16, 190);
    },
    star()    { const t = this.ctx.currentTime; [880, 1175, 1568].forEach((f, i) => this.tone(f, 0.20, 'triangle', 0.12, t + i * 0.09)); },

    startMusic() {
      if (!this.ready || this.musicOn) return;
      this.musicOn = true;
      this.musicStep = 0;
      this.musicNext = this.ctx.currentTime + 0.1;
    },
    stopMusic() { this.musicOn = false; },
    tickMusic() {
      if (!this.musicOn || !this.ready) return;
      const now = this.ctx.currentTime;
      const spb = 60 / 96 / 2;
      let guard = 0;
      while (this.musicNext < now + 0.30 && guard++ < 24) {
        this.scheduleMusic(this.musicStep, this.musicNext);
        this.musicStep++;
        this.musicNext += spb;
      }
    },
    scheduleMusic(step, t) {
      const prog = [
        { root: 0,  type: [0, 3, 7] },
        { root: -4, type: [0, 4, 7] },
        { root: 3,  type: [0, 4, 7] },
        { root: 10, type: [0, 4, 7] },
      ];
      const bar = Math.floor(step / 8) % prog.length;
      const chord = prog[bar];
      const local = step % 8;
      const base = 220;
      const freq = s => base * Math.pow(2, s / 12);
      if (local === 0 || local === 4) {
        this.tone(freq(chord.root - 24), 0.34, 'triangle', 0.16, t, undefined, this.musicGain);
      }
      const toneIdx = [0, 1, 2, 1, 2, 1, 0, 2][local];
      const semi = chord.root + chord.type[toneIdx] + (local === 6 ? 12 : 0);
      this.tone(freq(semi), 0.20, 'sine', 0.055, t, undefined, this.musicGain);
    },
  };

  NS.Sound = Sound;

  /* ------------------------------------------------------------
     GEOMETRY
     ------------------------------------------------------------ */
  function computeGeometry() {
    const cfg = NS.State.cfg;
    const G = {
      W: 720,
      H: 1280,
      R: 720 / (2 * cfg.grid.cols),
      rowH: 0,
      gridTop: cfg.grid.gridTop,
      shooterX: 360,
      shooterY: 1280 - cfg.grid.shooterBottomMargin,
      dangerY: 0,
      maxRows: 0,
      scale: 1,
      dpr: 1,
    };
    G.rowH = G.R * Math.sqrt(3);
    G.dangerY = G.shooterY - G.R * cfg.grid.dangerGap;
    G.maxRows = Math.max(8, Math.floor((G.dangerY - G.gridTop - 2 * G.R) / G.rowH));
    return G;
  }

  /* ------------------------------------------------------------
     SCREENS / UI
     ------------------------------------------------------------ */
  const UI = {
    currentScreen: 'splash',
    screenEls: {},
    canvas: null,
    stage: null,
    bgLayer: null,

    init() {
      document.querySelectorAll('.screen').forEach(s => {
        this.screenEls[s.id.replace('scr-', '')] = s;
      });
      this.canvas = document.getElementById('cv');
      this.stage = document.getElementById('stage');
      this.bgLayer = document.getElementById('bg-layer');
    },

    showScreen(name) {
      if (this.currentScreen === name) return;
      for (const k in this.screenEls) {
        this.screenEls[k].classList.toggle('active', k === name);
      }
      this.currentScreen = name;
      if (name === 'levels') this.refreshLevelSelect();
      if (name === 'settings') this.syncSettings();
      if (name === 'about') this.refreshAbout();
      if (name === 'brief') this.refreshBrief();
    },

    setHudVisible(v) {
      document.getElementById('hud').classList.toggle('hidden', !v);
    },

    updateHud() {
      const G = NS.State.game;
      if (!G) return;
      document.getElementById('hud-score').textContent = G.score;
      document.getElementById('hud-shots').textContent = Math.max(0, G.shotsLeft);
      document.getElementById('hud-bombs').textContent = G.bombsLeft;
      const total = Math.max(1, G.totalBubbles);
      const left = E.countBubbles();
      const pct = U.clamp(100 * (1 - left / total), 0, 100);
      document.getElementById('prog-fill').style.width = pct + '%';
    },

    /* ---- Level select ---- */
    refreshLevelSelect() {
      const gridEl = document.getElementById('lvl-grid');
      gridEl.innerHTML = '';
      const saved = NS.Save.get();
      const levels = NS.State.levels;
      for (let i = 0; i < levels.length; i++) {
        const unlocked = i <= saved.unlocked;
        const rec = saved.levels[i] || { stars: 0, best: 0 };
        const div = U.el('div', 'lvl' + (unlocked ? '' : ' locked'));
        let starsHtml = '<div class="stars">';
        for (let s = 0; s < 3; s++) {
          starsHtml += '<span class="star' + (rec.stars > s ? '' : ' off') + '"></span>';
        }
        starsHtml += '</div>';
        div.innerHTML = '<span class="num">' + (i + 1) + '</span>' +
          (unlocked ? starsHtml : '') +
          (rec.best ? '<span class="best">' + rec.best + '</span>' : '');
        div.addEventListener('click', () => {
          if (!unlocked) { Sound.click(); return; }
          Sound.click();
          UI.briefIndex = i;
          UI.showScreen('brief');
        });
        gridEl.appendChild(div);
      }
    },

    briefIndex: 0,

    refreshBrief() {
      const idx = this.briefIndex;
      const lvl = NS.State.levels[idx];
      if (!lvl) return;
      document.getElementById('brief-title').textContent = lvl.name || ('Level ' + (idx + 1));
      const remaining = countPattern(lvl.pattern);
      document.getElementById('brief-goal').textContent =
        'Clear all ' + remaining + ' bubbles to finish the level.';
      const cfg = NS.State.cfg;
      const info = document.getElementById('brief-info');
      info.innerHTML =
        '<div><span>Colors</span><span>' + (lvl.colors || 4) + '</span></div>' +
        '<div><span>Shot Limit</span><span>' + (lvl.shots || cfg.gameplay.shotsPerLevel) + '</span></div>' +
        '<div><span>Bombs</span><span>' + (lvl.bombs != null ? lvl.bombs : cfg.gameplay.bombsPerLevel) + '</span></div>' +
        '<div><span>Row Drop</span><span>every ' + (lvl.drop || cfg.gameplay.dropEveryShots) + ' shots</span></div>';
    },

    /* ---- Settings ---- */
    syncSettings() {
      const s = NS.State.cfg.settings;
      document.getElementById('set-sfx').value = Math.round(s.sfx * 100);
      document.getElementById('set-music').value = Math.round(s.music * 100);
      document.getElementById('set-haptics').classList.toggle('on', s.haptics);
      document.getElementById('set-aim').classList.toggle('on', s.aimAssist);
      document.getElementById('set-trail').classList.toggle('on', s.trajectory);
    },

    /* ---- About ---- */
    refreshAbout() {
      const cfg = NS.State.cfg;
      const c = cfg.credit;
      const logo = document.getElementById('about-logo');
      if (logo && cfg.background && cfg.background.mode === 'svg') {
        logo.style.backgroundImage = 'url(' + cfg.background.file + ')';
        logo.style.backgroundSize = 'cover';
        logo.style.backgroundPosition = 'center';
      }
      document.getElementById('about-title').textContent = cfg.game.title;
      document.getElementById('about-ver').textContent = 'v' + cfg.game.version;
      const credits = document.getElementById('about-credits');
      if (cfg.game.showCredit) {
        credits.innerHTML =
          'Developed by <b>' + c.developer + '</b><br/>' +
          'Country of Origin: <b>' + c.country + '</b><br/>' +
          '&copy; ' + c.year + ' &middot; All rights reserved.';
        credits.style.display = '';
      } else {
        credits.innerHTML = '';
        credits.style.display = 'none';
      }
      document.getElementById('about-license').textContent = 'License: ' + c.license;
    },

    /* ---- Win / Lose ---- */
    showWin() {
      const G = NS.State.game;
      const cfg = NS.State.cfg;
      const shotsUsed = G.level ? (G.level.shots || cfg.gameplay.shotsPerLevel) - G.shotsLeft : 0;

      // 3-star par: clear under 60% of shots; 2-star: under 85%
      const total = G.level ? (G.level.shots || cfg.gameplay.shotsPerLevel) : 40;
      let stars = 1;
      if (shotsUsed <= Math.ceil(total * 0.6)) stars = 3;
      else if (shotsUsed <= Math.ceil(total * 0.85)) stars = 2;
      G.lastStars = stars;

      // Save progress
      const saved = NS.Save.get();
      const idx = G.levelIndex;
      const rec = saved.levels[idx] || { stars: 0, best: 0 };
      rec.stars = Math.max(rec.stars, stars);
      rec.best = Math.max(rec.best, G.score);
      saved.levels[idx] = rec;
      if (idx + 1 > saved.unlocked) saved.unlocked = idx + 1;
      NS.Save.write();

      document.getElementById('win-score').textContent = G.score;
      const info = document.getElementById('win-info');
      info.innerHTML =
        '<div><span>Shots Used</span><span>' + shotsUsed + '</span></div>' +
        '<div><span>Shots Left</span><span>' + G.shotsLeft + '</span></div>' +
        '<div><span>Bombs Left</span><span>' + G.bombsLeft + '</span></div>';

      const starEls = document.querySelectorAll('#win-stars .star');
      starEls.forEach((s) => s.classList.remove('show'));
      UI.showScreen('win');
      setTimeout(() => {
        starEls.forEach((s, i) => { if (i < stars) s.classList.add('show'); });
        let n = 0;
        const iv = setInterval(() => {
          Sound.star();
          if (++n >= stars) clearInterval(iv);
        }, 180);
      }, 180);

      const nextBtn = document.getElementById('win-next');
      const isLast = idx >= NS.State.levels.length - 1;
      nextBtn.textContent = isLast ? 'Play Again' : 'Next Level';
      nextBtn.onclick = () => {
        Sound.click();
        const nextIdx = isLast ? 0 : idx + 1;
        UI.briefIndex = nextIdx;
        UI.showScreen('brief');
      };
    },

    showLose(reason) {
      const G = NS.State.game;
      document.getElementById('lose-reason').textContent = reason || 'Out of bubbles';
      const info = document.getElementById('lose-info');
      info.innerHTML =
        '<div><span>Score</span><span>' + G.score + '</span></div>' +
        '<div><span>Bubbles Left</span><span>' + E.countBubbles() + '</span></div>' +
        '<div><span>Shots Left</span><span>' + Math.max(0, G.shotsLeft) + '</span></div>';
      UI.showScreen('lose');
    },
  };

  NS.UI = UI;

  function countPattern(pattern) {
    let n = 0;
    for (const row of pattern) {
      for (let i = 0; i < row.length; i++) {
        const ch = row[i];
        if (ch && ch !== '.' && ch !== ' ') n++;
      }
    }
    return n;
  }

  /* ------------------------------------------------------------
     SAVE SYSTEM — simple, just progress
     ------------------------------------------------------------ */
  NS.Save = {
    KEY: 'bubbleshooter_simple_v1',
    cache: null,
    get() {
      if (this.cache) return this.cache;
      const def = { unlocked: 0, levels: {} };
      try {
        const raw = localStorage.getItem(this.KEY);
        if (raw) this.cache = Object.assign(def, JSON.parse(raw));
        else this.cache = def;
      } catch (e) { this.cache = def; }
      return this.cache;
    },
    write() {
      try { localStorage.setItem(this.KEY, JSON.stringify(this.cache)); } catch (e) {}
    },
    reset() {
      this.cache = { unlocked: 0, levels: {} };
      this.write();
    },
  };

  /* ------------------------------------------------------------
     CONFIG LOADING
     ------------------------------------------------------------ */
  async function loadJSON(path) {
    const res = await fetch(path, { cache: 'no-cache' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return await res.json();
  }

  async function loadConfig() {
    let cfg = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
    try {
      const loaded = await loadJSON('configs.json');
      U.deepMerge(cfg, loaded);
    } catch (e) {
      console.warn('[BubbleShooter] configs.json not loaded, using defaults.', e.message);
    }
    // Merge saved settings
    const saved = NS.Save.get();
    if (saved.settings) U.deepMerge(cfg.settings, saved.settings);
    return cfg;
  }

  async function loadLevels() {
    let levels = JSON.parse(JSON.stringify(DEFAULT_LEVELS));
    try {
      const loaded = await loadJSON('levels.json');
      if (loaded && Array.isArray(loaded.levels)) levels = loaded;
    } catch (e) {
      console.warn('[BubbleShooter] levels.json not loaded, using defaults.', e.message);
    }
    return levels.levels;
  }

  /* ------------------------------------------------------------
     BACKGROUND
     ------------------------------------------------------------ */
  function setupBackground() {
    const cfg = NS.State.cfg;
    const bg = cfg.background || {};
    if (bg.mode === 'svg' && bg.file) {
      UI.bgLayer.style.backgroundImage = 'url(' + bg.file + ')';
      UI.bgLayer.style.display = '';
      UI.canvas.style.background = 'transparent';
    } else {
      UI.bgLayer.style.backgroundImage = 'none';
      UI.canvas.style.background = 'transparent';
    }
  }

  /* ------------------------------------------------------------
     RESIZE
     ------------------------------------------------------------ */
  function resize() {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const aspect = 720 / 1280;
    let sw = vw, sh = vw / aspect;
    if (sh > vh) { sh = vh; sw = vh * aspect; }
    UI.stage.style.width = sw + 'px';
    UI.stage.style.height = sh + 'px';

    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const canvas = UI.canvas;
    canvas.width = Math.round(720 * dpr);
    canvas.height = Math.round(1280 * dpr);

    NS.State.G.dpr = dpr;
    NS.State.G.scale = sw / 720;

    Gr.SPR.res = Math.min(2.4, dpr * (sw / 720));
    Gr.buildSprites();
  }

  /* ------------------------------------------------------------
     INPUT
     ------------------------------------------------------------ */
  function screenToLogical(clientX, clientY) {
    const rect = UI.canvas.getBoundingClientRect();
    return {
      x: (clientX - rect.left) / NS.State.G.scale,
      y: (clientY - rect.top) / NS.State.G.scale,
    };
  }

  function bindInput() {
    const canvas = UI.canvas;
    canvas.addEventListener('pointerdown', (e) => {
      Sound.init(); Sound.resume();
      const G = NS.State.game;
      if (!G || !G.active || G.paused) return;
      const p = screenToLogical(e.clientX, e.clientY);
      G.pointer = p;
      G.aiming = true;
      const d = Math.hypot(p.x - NS.State.G.shooterX, p.y - NS.State.G.shooterY);
      if (d < NS.State.G.R * 2.6) {
        GameMod.swapBubbles();
        G.aiming = false;
        e.preventDefault();
        return;
      }
      GameMod.computeAim(p.x, p.y);
      e.preventDefault();
    }, { passive: false });

    canvas.addEventListener('pointermove', (e) => {
      const G = NS.State.game;
      if (!G || !G.active || G.paused) return;
      const p = screenToLogical(e.clientX, e.clientY);
      G.pointer = p;
      if (G.aiming) GameMod.computeAim(p.x, p.y);
      else {
        const d = Math.hypot(p.x - NS.State.G.shooterX, p.y - NS.State.G.shooterY);
        if (d > NS.State.G.R * 2.6) GameMod.computeAim(p.x, p.y);
      }
      e.preventDefault();
    }, { passive: false });

    canvas.addEventListener('pointerup', (e) => {
      const G = NS.State.game;
      if (!G || !G.active || G.paused) return;
      if (G.aiming) {
        G.aiming = false;
        GameMod.fireShot();
      }
      e.preventDefault();
    }, { passive: false });

    canvas.addEventListener('pointercancel', () => {
      const G = NS.State.game;
      if (G) G.aiming = false;
    }, { passive: false });

    canvas.addEventListener('contextmenu', e => e.preventDefault());

    // Desktop keyboard
    window.addEventListener('keydown', (e) => {
      const G = NS.State.game;
      if (!G || !G.active || G.paused) {
        if (e.code === 'Escape' && G && G.active) UI.showScreen('pause');
        return;
      }
      if (e.code === 'Space') { e.preventDefault(); GameMod.swapBubbles(); }
      if (e.code === 'ArrowLeft')  G.aimAngle = U.clamp(G.aimAngle - 0.04, -Math.PI + 0.30, -0.30);
      if (e.code === 'ArrowRight') G.aimAngle = U.clamp(G.aimAngle + 0.04, -Math.PI + 0.30, -0.30);
      if (e.code === 'Enter') { e.preventDefault(); GameMod.fireShot(); }
      if (e.code === 'Escape') UI.showScreen('pause');
      if (e.code === 'KeyB') GameMod.activateBomb();
    });

    // Prevent scroll & zoom
    document.addEventListener('touchmove', e => { e.preventDefault(); }, { passive: false });
    document.addEventListener('gesturestart', e => e.preventDefault());
    document.addEventListener('dblclick', e => e.preventDefault());

    window.addEventListener('resize', () => setTimeout(resize, 60));
    window.addEventListener('orientationchange', () => setTimeout(resize, 220));
    document.addEventListener('visibilitychange', () => {
      const G = NS.State.game;
      if (document.hidden && G && G.active && !G.paused) {
        G.paused = true;
        UI.showScreen('pause');
      }
    });
  }

  /* ------------------------------------------------------------
     BUTTON WIRING
     ------------------------------------------------------------ */
  function bindUI() {
    // Nav
    document.querySelectorAll('[data-nav]').forEach(btn => {
      btn.addEventListener('click', () => {
        Sound.init(); Sound.resume();
        Sound.click();
        UI.showScreen(btn.dataset.nav);
      });
    });

    // Splash
    document.getElementById('scr-splash').addEventListener('pointerdown', () => {
      Sound.init(); Sound.resume();
      UI.showScreen('menu');
      Sound.click();
      // Start menu music
      Sound.startMusic();
    });

    // Briefing
    document.getElementById('brief-start').addEventListener('click', () => {
      Sound.click();
      const idx = UI.briefIndex;
      GameMod.startLevel(idx);
    });

    // Pause
    document.getElementById('btn-pause').addEventListener('click', () => {
      const G = NS.State.game;
      if (!G || !G.active) return;
      G.paused = true;
      Sound.click();
      UI.showScreen('pause');
    });
    document.getElementById('pause-resume').addEventListener('click', () => {
      Sound.click();
      const G = NS.State.game;
      if (G) G.paused = false;
      UI.showScreen(null);
    });
    document.getElementById('pause-restart').addEventListener('click', () => {
      Sound.click();
      const G = NS.State.game;
      if (G) GameMod.startLevel(G.levelIndex);
    });
    document.getElementById('pause-settings').addEventListener('click', () => {
      Sound.click();
      UI._settingsReturn = 'pause';
      UI.showScreen('settings');
    });
    document.getElementById('pause-quit').addEventListener('click', () => {
      Sound.click();
      const G = NS.State.game;
      if (G) { G.active = false; G.paused = false; }
      Sound.stopMusic();
      UI.setHudVisible(false);
      UI.showScreen('menu');
    });

    // Lose
    document.getElementById('lose-retry').addEventListener('click', () => {
      Sound.click();
      const G = NS.State.game;
      if (G) GameMod.startLevel(G.levelIndex);
    });

    // Settings back
    document.getElementById('set-back').addEventListener('click', () => {
      Sound.click();
      if (UI._settingsReturn === 'pause') {
        UI._settingsReturn = null;
        UI.showScreen('pause');
      } else {
        UI.showScreen('menu');
      }
    });

    // Settings controls
    document.getElementById('set-sfx').addEventListener('input', (e) => {
      NS.State.cfg.settings.sfx = e.target.value / 100;
      Sound.applyVolumes();
      saveSettings();
    });
    document.getElementById('set-music').addEventListener('input', (e) => {
      NS.State.cfg.settings.music = e.target.value / 100;
      Sound.applyVolumes();
      saveSettings();
    });
    const toggle = (id, key) => {
      document.getElementById(id).addEventListener('click', (e) => {
        const s = NS.State.cfg.settings;
        s[key] = !s[key];
        e.currentTarget.classList.toggle('on', s[key]);
        Sound.click();
        U.buzz(10);
        saveSettings();
      });
    };
    toggle('set-haptics', 'haptics');
    toggle('set-aim', 'aimAssist');
    toggle('set-trail', 'trajectory');

    document.getElementById('set-reset').addEventListener('click', () => {
      if (confirm('Reset all progress? This cannot be undone.')) {
        NS.Save.reset();
        Sound.click();
      }
    });
  }

  function saveSettings() {
    const saved = NS.Save.get();
    saved.settings = Object.assign({}, NS.State.cfg.settings);
    NS.Save.write();
  }

  /* ------------------------------------------------------------
     BUILD SPLASH & HOW-TO DEMO
     ------------------------------------------------------------ */
  function buildSplash() {
    const wrap = document.getElementById('splash-logo');
    const positions = [
      [18, 62, 46, 0], [78, 24, 54, 1], [150, 70, 40, 2],
      [52, 108, 34, 3], [120, 116, 30, 4], [172, 14, 30, 5],
    ];
    const colors = NS.State.cfg.colors;
    for (const [x, y, r, ci] of positions) {
      const c = colors[ci % colors.length];
      const d = document.createElement('div');
      d.className = 'sb';
      d.style.cssText =
        'left:' + x + 'px;top:' + y + 'px;width:' + (r * 2) + 'px;height:' + (r * 2) + 'px;' +
        'background:radial-gradient(circle at 34% 28%,' + c.light + ',' + c.main + ' 46%,' + c.dark + ');' +
        'animation-delay:' + (ci * 0.22) + 's;';
      wrap.appendChild(d);
    }
  }

  function buildHowDemo() {
    const demo = document.getElementById('how-demo');
    const colors = NS.State.cfg.colors;
    for (let i = 0; i < 7; i++) {
      const c = colors[i % colors.length];
      const d = document.createElement('div');
      d.className = 'b';
      const size = 26;
      d.style.cssText =
        'width:' + size + 'px;height:' + size + 'px;left:' + (12 + (i % 4) * 34) + 'px;top:' +
        (10 + Math.floor(i / 4) * 30) + 'px;' +
        'background:radial-gradient(circle at 34% 28%,' + c.light + ',' + c.main + ' 46%,' + c.dark + ');' +
        'animation:floaty ' + (2 + (i % 3) * 0.4) + 's ease-in-out infinite;animation-delay:' + (i * 0.12) + 's;';
      demo.appendChild(d);
    }
  }

  function buildMenuFoot() {
    const cfg = NS.State.cfg;
    const foot = document.getElementById('menu-foot');
    if (cfg.game.showCredit) {
      foot.innerHTML = 'By ' + cfg.credit.developer + ' &middot; ' + cfg.credit.country;
    } else {
      foot.innerHTML = '';
    }
  }

  /* ------------------------------------------------------------
     MAIN LOOP
     ------------------------------------------------------------ */
  let lastT = 0;
  function frame(t) {
    requestAnimationFrame(frame);
    if (!lastT) lastT = t;
    let dt = (t - lastT) / 1000;
    lastT = t;
    if (dt > 0.05) dt = 0.05;
    if (dt < 0) dt = 0;

    Sound.tickMusic();
    GameMod.update(dt);

    // Draw
    const canvas = UI.canvas;
    const g = canvas.getContext('2d');
    const dpr = NS.State.G.dpr;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, 720, 1280);

    // Draw builtin background if no SVG
    if (NS.State.cfg.background.mode !== 'svg') {
      drawBuiltinBackground(g);
    }

    GameMod.render(g);
  }

  let bgBubbles = [];
  function initBgBubbles() {
    bgBubbles = [];
    for (let i = 0; i < 14; i++) {
      bgBubbles.push({
        x: Math.random() * 720,
        y: Math.random() * 1280,
        r: U.rand(24, 90),
        sp: U.rand(6, 26),
        a: U.rand(0.03, 0.10),
        hue: U.randInt(0, 5),
      });
    }
  }
  function updateBgBubbles(dt) {
    for (const b of bgBubbles) {
      b.y -= b.sp * dt;
      if (b.y < -b.r * 2) { b.y = 1280 + b.r * 2; b.x = Math.random() * 720; }
    }
  }
  function drawBuiltinBackground(g) {
    const c = NS.State.cfg;
    const grd = g.createLinearGradient(0, 0, 0, 1280);
    grd.addColorStop(0, '#0d2450');
    grd.addColorStop(0.55, '#0a1730');
    grd.addColorStop(1, '#04070f');
    g.fillStyle = grd;
    g.fillRect(0, 0, 720, 1280);
    for (const b of bgBubbles) {
      const col = c.colors[b.hue % c.colors.length];
      g.globalAlpha = b.a;
      const gr = g.createRadialGradient(b.x - b.r * 0.3, b.y - b.r * 0.35, b.r * 0.05, b.x, b.y, b.r);
      gr.addColorStop(0, col.light);
      gr.addColorStop(1, col.dark);
      g.beginPath(); g.arc(b.x, b.y, b.r, 0, 6.2832);
      g.fillStyle = gr; g.fill();
    }
    g.globalAlpha = 1;
  }

  // Hook background animation into main update
  const _origUpdate = GameMod.update;
  GameMod.update = function (dt) {
    updateBgBubbles(dt);
    _origUpdate(dt);
  };

  /* ------------------------------------------------------------
     BOOT
     ------------------------------------------------------------ */
  async function boot() {
    UI.init();

    const cfg = await loadConfig();
    const levels = await loadLevels();
    NS.State.cfg = cfg;
    NS.State.levels = levels;

    const G = computeGeometry();
    NS.State.G = G;

    Gr.setColors(cfg.colors);
    Gr.setGeometry(G);
    Gr.buildSprites();
    Gr.Particles.init(cfg.gameplay.maxParticles || 280);

    E.init(G, cfg);
    GameMod.init();
    NS.State.game = GameMod.state;

    setupBackground();
    UI.syncSettings();
    buildSplash();
    buildHowDemo();
    buildMenuFoot();
    initBgBubbles();
    bindUI();
    bindInput();

    resize();
    requestAnimationFrame(frame);
  }

  // Small safety: rebuild background bubbles when SVG mode is on and sprite res changes
  window.addEventListener('load', () => setTimeout(resize, 120));

  boot().catch(err => {
    console.error('[BubbleShooter] Boot failed:', err);
  });

})(window.BS);
