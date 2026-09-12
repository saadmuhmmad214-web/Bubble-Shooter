/* ============================================================
   GameUtils.js — helpers, math, small utilities
   ============================================================ */
window.BS = window.BS || {};

(function (NS) {
  'use strict';

  const Utils = {
    clamp(v, a, b) { return v < a ? a : v > b ? b : v; },
    lerp(a, b, t) { return a + (b - a) * t; },
    rand(a, b) { return a + Math.random() * (b - a); },
    randInt(a, b) { return Math.floor(a + Math.random() * (b - a + 1)); },
    choice(arr) { return arr[(Math.random() * arr.length) | 0]; },
    mod(n, m) { return ((n % m) + m) % m; },
    dist2(ax, ay, bx, by) { const dx = ax - bx, dy = ay - by; return dx * dx + dy * dy; },

    el(tag, cls, html) {
      const e = document.createElement(tag);
      if (cls) e.className = cls;
      if (html !== undefined) e.innerHTML = html;
      return e;
    },

    /* Deterministic PRNG */
    mulberry32(a) {
      return function () {
        a |= 0; a = a + 0x6D2B79F5 | 0;
        let t = Math.imul(a ^ a >>> 15, 1 | a);
        t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
      };
    },

    /* Recursive merge used when layering loaded config onto defaults */
    deepMerge(base, over) {
      for (const k in over) {
        if (!Object.prototype.hasOwnProperty.call(over, k)) continue;
        const v = over[k];
        if (v && typeof v === 'object' && !Array.isArray(v) &&
            base[k] && typeof base[k] === 'object' && !Array.isArray(base[k])) {
          Utils.deepMerge(base[k], v);
        } else if (v !== undefined) {
          base[k] = v;
        }
      }
      return base;
    },

    formatNum(n) {
      return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    },

    /* Vibrate if allowed */
    buzz(ms) {
      if (!NS.State || !NS.State.cfg) return;
      if (!NS.State.cfg.settings.haptics) return;
      try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) {}
    },
  };

  NS.Utils = Utils;
})(window.BS);
