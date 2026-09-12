/* ============================================================
   GameEngine.js — hex grid math, collision, flood-fill, shot
   simulation. All positions are logical (720 x 1280).
   ============================================================ */
window.BS = window.BS || {};

(function (NS) {
  'use strict';
  const U = NS.Utils;

  /* ------------------------------------------------------------
     GRID STATE
     ------------------------------------------------------------ */
  const grid = {
    rows: [],
    base: 1000,   // parity base; flips as new rows are added on top
  };

  let G = null;
  let CFG = null;

  function init(geometry, cfg) { G = geometry; CFG = cfg; }

  function parityOf(i) { return U.mod(i + grid.base, 2); }
  function colsIn(i) { return parityOf(i) === 0 ? CFG.grid.cols : CFG.grid.cols - 1; }
  function cellX(i, c) { return parityOf(i) === 0 ? G.R + c * 2 * G.R : 2 * G.R + c * 2 * G.R; }
  function cellY(i) { return CFG.grid.gridTop + G.R + i * G.rowH; }

  const NEI_EVEN = [[0, -1], [0, 1], [-1, -1], [-1, 0], [1, -1], [1, 0]];
  const NEI_ODD  = [[0, -1], [0, 1], [-1, 0], [-1, 1], [1, 0], [1, 1]];
  function neighbors(i) { return parityOf(i) === 0 ? NEI_EVEN : NEI_ODD; }

  function ensureRow(i) {
    while (grid.rows.length <= i) {
      const idx = grid.rows.length;
      grid.rows.push(new Array(colsIn(idx)).fill(null));
    }
  }

  function reset() { grid.rows.length = 0; grid.base = 1000; }

  function bubbleAt(i, c) {
    if (i < 0 || i >= grid.rows.length) return null;
    const row = grid.rows[i];
    if (!row || c < 0 || c >= row.length) return null;
    return row[c];
  }

  function setBubble(i, c, b) { ensureRow(i); grid.rows[i][c] = b; }

  function hasOccupiedNeighbor(i, c) {
    if (i === 0) return true;
    const n = neighbors(i);
    for (let k = 0; k < n.length; k++) {
      if (bubbleAt(i + n[k][0], c + n[k][1])) return true;
    }
    return false;
  }

  /* ------------------------------------------------------------
     LEVEL BUILDING
     ------------------------------------------------------------ */
  function buildFromPattern(pattern, colors) {
    reset();
    for (let i = 0; i < pattern.length; i++) {
      ensureRow(i);
      const n = colsIn(i);
      const str = pattern[i];
      for (let c = 0; c < n; c++) {
        const ch = str[c];
        if (!ch || ch === '.' || ch === ' ') continue;
        const v = parseInt(ch, 10);
        if (isNaN(v)) continue;
        grid.rows[i][c] = { ci: U.mod(v, colors) };
      }
    }
  }

  function countBubbles() {
    let n = 0;
    for (let i = 0; i < grid.rows.length; i++) {
      const row = grid.rows[i];
      if (!row) continue;
      for (let c = 0; c < row.length; c++) if (row[c]) n++;
    }
    return n;
  }

  function lowestOccupiedRow() {
    for (let i = grid.rows.length - 1; i >= 0; i--) {
      const row = grid.rows[i];
      if (!row) continue;
      for (let c = 0; c < row.length; c++) if (row[c]) return i;
    }
    return -1;
  }

  /* ------------------------------------------------------------
     SNAPPING & COLLISION
     ------------------------------------------------------------ */
  function snapCell(x, y) {
    const guess = Math.round((y - CFG.grid.gridTop - G.R) / G.rowH);
    let best = null, bestD = Infinity;
    for (let i = Math.max(0, guess - 2); i <= guess + 2; i++) {
      ensureRow(i);
      const n = colsIn(i);
      for (let c = 0; c < n; c++) {
        if (grid.rows[i][c]) continue;
        const d = U.dist2(cellX(i, c), cellY(i), x, y);
        if (d < bestD && hasOccupiedNeighbor(i, c)) { bestD = d; best = { i, c }; }
      }
    }
    if (!best) {
      for (let i = Math.max(0, guess - 2); i <= guess + 2; i++) {
        ensureRow(i);
        const n = colsIn(i);
        for (let c = 0; c < n; c++) {
          if (grid.rows[i][c]) continue;
          const d = U.dist2(cellX(i, c), cellY(i), x, y);
          if (d < bestD) { bestD = d; best = { i, c }; }
        }
      }
    }
    return best;
  }

  function collidesAt(x, y, r) {
    const i0 = Math.max(0, Math.floor((y - CFG.grid.gridTop - G.R) / G.rowH) - 2);
    const i1 = Math.min(grid.rows.length - 1, i0 + 4);
    const rr = (2 * r) * (2 * r) * 0.94;
    for (let i = i0; i <= i1; i++) {
      const row = grid.rows[i];
      if (!row) continue;
      const cy = cellY(i);
      for (let c = 0; c < row.length; c++) {
        if (!row[c]) continue;
        const dx = cellX(i, c) - x, dy = cy - y;
        if (dx * dx + dy * dy < rr) return true;
      }
    }
    return false;
  }

  /* ------------------------------------------------------------
     SHOT SIMULATION (used by both aim preview and firing)
     ------------------------------------------------------------ */
  function simulateShot(sx, sy, angle, collect) {
    let x = sx, y = sy;
    let dx = Math.cos(angle), dy = Math.sin(angle);
    const step = G.R * 0.42;
    const pts = collect ? [{ x, y }] : null;
    let guard = 0;
    while (guard++ < 420) {
      x += dx * step; y += dy * step;
      if (x - G.R < 0) { x = G.R; dx = -dx; if (collect) pts.push({ x, y }); }
      else if (x + G.R > G.W) { x = G.W - G.R; dx = -dx; if (collect) pts.push({ x, y }); }
      if (y - G.R <= CFG.grid.gridTop) {
        y = CFG.grid.gridTop + G.R;
        if (collect) pts.push({ x, y });
        return { hit: true, x, y, cell: snapCell(x, y), pts };
      }
      if (collidesAt(x, y, G.R)) {
        if (collect) pts.push({ x, y });
        return { hit: true, x, y, cell: snapCell(x, y), pts };
      }
      if (y > G.H + 40) break;
    }
    if (collect) pts.push({ x, y });
    return { hit: false, x, y, cell: null, pts };
  }

  /* ------------------------------------------------------------
     FLOOD FILL / FLOATING DETECTION
     ------------------------------------------------------------ */
  function floodSame(i, c, ci) {
    const start = bubbleAt(i, c);
    if (!start) return [];
    const seen = new Set();
    const stack = [[i, c]];
    const out = [];
    while (stack.length) {
      const [r, cc] = stack.pop();
      const key = r * 64 + cc;
      if (seen.has(key)) continue;
      seen.add(key);
      const b = bubbleAt(r, cc);
      if (!b) continue;
      if (b.ci !== ci) continue;
      out.push({ i: r, c: cc });
      const n = neighbors(r);
      for (let k = 0; k < n.length; k++) stack.push([r + n[k][0], cc + n[k][1]]);
    }
    return out;
  }

  function findFloating() {
    const seen = new Set();
    const stack = [];
    if (grid.rows.length > 0) {
      const row0 = grid.rows[0];
      for (let c = 0; c < row0.length; c++) if (row0[c]) stack.push([0, c]);
    }
    while (stack.length) {
      const [r, c] = stack.pop();
      const key = r * 64 + c;
      if (seen.has(key)) continue;
      seen.add(key);
      const n = neighbors(r);
      for (let k = 0; k < n.length; k++) {
        const nr = r + n[k][0], nc = c + n[k][1];
        if (bubbleAt(nr, nc)) stack.push([nr, nc]);
      }
    }
    const out = [];
    for (let i = 0; i < grid.rows.length; i++) {
      const row = grid.rows[i];
      if (!row) continue;
      for (let c = 0; c < row.length; c++) {
        if (row[c] && !seen.has(i * 64 + c)) out.push({ i, c });
      }
    }
    return out;
  }

  /* ------------------------------------------------------------
     BOMB: collect everything within radius R cells of the target
     ------------------------------------------------------------ */
  function collectRadius(i, c, radius) {
    const out = [];
    const cx = cellX(i, c), cy = cellY(i);
    const R2 = (G.R * (2 * radius + 0.6)) ** 2;
    for (let r = Math.max(0, i - radius - 1); r <= i + radius + 1; r++) {
      const row = grid.rows[r];
      if (!row) continue;
      for (let cc = 0; cc < row.length; cc++) {
        if (!row[cc]) continue;
        if (U.dist2(cellX(r, cc), cellY(r), cx, cy) < R2) out.push({ i: r, c: cc });
      }
    }
    return out;
  }

  /* ------------------------------------------------------------
     ADD ROW (pressure mechanic)
     ------------------------------------------------------------ */
  function addRow(colorCount, makeBubble) {
    grid.base -= 1;
    const n = colsIn(0);
    const row = new Array(n).fill(null);
    for (let c = 0; c < n; c++) row[c] = makeBubble(colorCount);
    grid.rows.unshift(row);
  }

  /* ------------------------------------------------------------
     RANDOM COLOR PICKER — only colors still present on board
     ------------------------------------------------------------ */
  function pickExistingColor(fallbackCount) {
    const present = new Set();
    for (let i = 0; i < grid.rows.length; i++) {
      const row = grid.rows[i];
      if (!row) continue;
      for (let c = 0; c < row.length; c++) {
        const b = row[c];
        if (b) present.add(b.ci);
      }
    }
    if (present.size === 0) return U.randInt(0, fallbackCount - 1);
    const arr = [...present];
    return arr[(Math.random() * arr.length) | 0];
  }

  NS.Engine = {
    init, reset,
    grid,
    parityOf, colsIn, cellX, cellY, neighbors,
    ensureRow, bubbleAt, setBubble, hasOccupiedNeighbor,
    buildFromPattern, countBubbles, lowestOccupiedRow,
    snapCell, collidesAt, simulateShot,
    floodSame, findFloating, collectRadius, addRow,
    pickExistingColor,
  };
})(window.BS);
