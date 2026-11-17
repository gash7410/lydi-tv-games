// «Ζούγκλα»: συνεργατικό platform με ζωγραφιστά γραφικά καρτούν (δάσος, ακρογιαλιά, ηφαίστειο + αφεντικό).
// Όλοι τρέχουν μαζί στην ίδια πίστα. Η ενέργεια πέφτει με τον χρόνο· τα φρούτα τη γεμίζουν.
// Αυγά με δώρα: πέτρινο τσεκούρι, πατίνι, νεράιδα (άτρωτος), καλάθι φρούτων — ή σύννεφο βροχής (κακό αυγό).
// Πέτρες = σκόνταμμα, φωτιές/εχθροί/λάκκοι = χάνεις ζωή. Κοινές ζωές για την ομάδα.
(function () {
  'use strict';
  const { Base, U } = Mini;
  const LH = 216, GY = 184, TAU = Math.PI * 2;
  const G = 660, JV = 278, SPD = 84, SKATE = 126, DRAIN = 2.3, RESPAWN = 2.3, INVUL = 2.4;
  const OUT = '#3a2212';
  const TW = 384, GT = 96;              // πλάτος πλακιδίου φόντου / εδάφους (μονάδες κόσμου)
  const sh = (c, a) => U.shade(c, a);

  const AREAS = [
    { name: 'Το δάσος', len: 2700, foes: ['snail', 'snail', 'frog', 'bee'], bad: 0,
      w: { flat: 3, rock: 2, pit: 2, foes: 3, stairs: 1, fire: 1, bridge: 0 }, pitMax: 36 },
    { name: 'Η ακρογιαλιά', len: 3000, foes: ['crab', 'crab', 'frog', 'bee', 'snail'], bad: 0.2,
      w: { flat: 2, rock: 2, pit: 3, foes: 3, stairs: 2, fire: 2, bridge: 1 }, pitMax: 42 },
    { name: 'Το ηφαίστειο', len: 2900, foes: ['snake', 'boulder', 'bee', 'frog', 'crab'], bad: 0.25, boss: true,
      w: { flat: 1, rock: 2, pit: 3, foes: 4, stairs: 2, fire: 3, bridge: 2 }, pitMax: 46 },
  ];
  const FRUIT = {
    cherry: { e: 8, p: 30 }, banana: { e: 12, p: 50 }, apple: { e: 15, p: 80 },
    grapes: { e: 20, p: 120 }, pine: { e: 25, p: 160 }, melon: { e: 32, p: 200 },
  };
  const FOE = { // πλάτος, ύψος κουτιού σύγκρουσης, αν πατιέται
    snail: [16, 13, true], frog: [14, 11, true], bee: [12, 9, true], crab: [16, 11, true],
    snake: [12, 20, false], boulder: [16, 16, false],
  };
  const ITEM = {
    axe: '🪓 ΤΣΕΚΟΥΡΙ!', skate: '🛹 ΠΑΤΙΝΙ!', fairy: '🧚 ΝΕΡΑΪΔΑ!', basket: '🧺 ΚΑΛΑΘΙ!', cloud: '🌧 ΣΥΝΝΕΦΟ!',
  };

  function rng(seed) {
    let s = seed >>> 0 || 1;
    return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  function rrp(x, X, Y, w, h, r) { U.rr(x, X, Y, w, h, r); }
  function lin(x, x0, y0, x1, y1, stops) { const g = x.createLinearGradient(x0, y0, x1, y1); stops.forEach(([o, c]) => g.addColorStop(o, c)); return g; }
  function rad(x, cx, cy, r, stops, fx = -0.35, fy = -0.4) {
    const g = x.createRadialGradient(cx + r * fx, cy + r * fy, r * 0.05, cx, cy, r); stops.forEach(([o, c]) => g.addColorStop(o, c)); return g;
  }
  function stroke(x, w = 0.9, c = OUT) { x.lineWidth = w; x.strokeStyle = c; x.lineJoin = 'round'; x.lineCap = 'round'; x.stroke(); }
  function circ(x, cx, cy, r) { x.beginPath(); x.arc(cx, cy, r, 0, TAU); }
  function ell(x, cx, cy, rx, ry, rot = 0) { x.beginPath(); x.ellipse(cx, cy, rx, ry, rot, 0, TAU); }

  // συστάδα από κύκλους με περίγραμμα (φυλλώματα, θάμνοι, σύννεφα)
  function blobs(x, list, cols, ow) {
    x.fillStyle = cols.out; for (const [cx, cy, r] of list) { circ(x, cx, cy, r + ow); x.fill(); }
    x.fillStyle = cols.base; for (const [cx, cy, r] of list) { circ(x, cx, cy, r); x.fill(); }
    x.fillStyle = cols.mid; for (const [cx, cy, r] of list) { circ(x, cx - r * 0.12, cy - r * 0.18, r * 0.78); x.fill(); }
    if (cols.hi) { x.fillStyle = cols.hi; for (const [cx, cy, r] of list) { ell(x, cx - r * 0.34, cy - r * 0.42, r * 0.32, r * 0.22, -0.5); x.fill(); } }
  }

  // ---------- μικρά sprites (φρούτα, αυγά, πέτρες, τσεκούρι) ----------
  const SPR = {
    banana: [16, 14, (x) => {
      for (const [dy, rot] of [[1.5, 0.15], [-1.5, -0.12]]) {
        x.save(); x.translate(0, dy); x.rotate(rot);
        x.beginPath(); x.moveTo(-6.5, -2.5); x.quadraticCurveTo(-4.5, 4.8, 6.5, 2.2); x.quadraticCurveTo(-0.5, 1.6, -4.2, -3.6); x.closePath();
        x.fillStyle = lin(x, 0, -3, 0, 4, [[0, '#fff6a0'], [0.5, '#ffd92e'], [1, '#e0a10c']]); x.fill(); stroke(x, 0.8);
        x.fillStyle = '#6b4a1c'; circ(x, 6.3, 2.2, 0.8); x.fill(); x.fillRect(-6.6, -3.6, 1.6, 1.6);
        x.restore();
      }
      x.fillStyle = 'rgba(255,255,255,.7)'; ell(x, -2, 0.5, 2.4, 0.6, 0.4); x.fill();
    }],
    apple: [13, 14, (x) => {
      x.beginPath(); x.moveTo(0, -3.5); x.bezierCurveTo(5, -7, 8, 1, 3.5, 5.5); x.quadraticCurveTo(0, 7, -3.5, 5.5); x.bezierCurveTo(-8, 1, -5, -7, 0, -3.5); x.closePath();
      x.fillStyle = rad(x, 0, 1, 6.5, [[0, '#ffb0a0'], [0.35, '#f0302c'], [1, '#8a0c12']]); x.fill(); stroke(x, 0.8);
      x.strokeStyle = '#5a3412'; x.lineWidth = 0.9; x.beginPath(); x.moveTo(0, -3.4); x.quadraticCurveTo(0.4, -5.5, 1.4, -6.4); x.stroke();
      x.beginPath(); x.moveTo(1, -5.2); x.quadraticCurveTo(4.6, -7.5, 5.2, -4.6); x.quadraticCurveTo(2.6, -3.6, 1, -5.2); x.fillStyle = '#4fc23a'; x.fill(); stroke(x, 0.6);
      x.fillStyle = 'rgba(255,255,255,.75)'; ell(x, -2.6, -0.6, 1.1, 1.9, 0.4); x.fill();
    }],
    grapes: [13, 15, (x) => {
      const P = [[-3, -1.5], [0, -1.5], [3, -1.5], [-1.5, 1.2], [1.5, 1.2], [-3, 1.2], [3, 1.2], [0, 3.9], [-1.5, 6.4], [1.5, 6.4], [0, -4]];
      x.strokeStyle = '#5a3412'; x.lineWidth = 0.9; x.beginPath(); x.moveTo(0, -4.5); x.lineTo(0.6, -7); x.stroke();
      x.beginPath(); x.moveTo(0.6, -6.4); x.quadraticCurveTo(4.6, -8.4, 5, -5); x.quadraticCurveTo(2.4, -4.8, 0.6, -6.4); x.fillStyle = '#4fc23a'; x.fill(); stroke(x, 0.6);
      x.fillStyle = OUT; for (const [a, b] of P) { circ(x, a, b, 2.15); x.fill(); }
      for (const [a, b] of P) { x.fillStyle = rad(x, a, b, 1.75, [[0, '#e4b3ff'], [0.45, '#9440d6'], [1, '#4a1278']]); circ(x, a, b, 1.7); x.fill(); }
    }],
    melon: [15, 11, (x) => {
      x.beginPath(); x.moveTo(-7, -3); x.arc(0, -3, 7, 0, Math.PI); x.closePath();
      x.fillStyle = '#2f8a2a'; x.fill(); stroke(x, 0.8);
      x.beginPath(); x.moveTo(-6, -3); x.arc(0, -3, 6, 0, Math.PI); x.closePath(); x.fillStyle = '#f2ffe0'; x.fill();
      x.beginPath(); x.moveTo(-5.2, -3); x.arc(0, -3, 5.2, 0, Math.PI); x.closePath();
      x.fillStyle = rad(x, 0, -3, 5.2, [[0, '#ff8a8a'], [1, '#e8262e']], 0, -0.6); x.fill();
      x.fillStyle = '#1b1010'; for (const [a, b] of [[-2.6, -1], [0, 0], [2.6, -1], [-1.2, 1.4], [1.3, 1.4]]) { ell(x, a, b, 0.45, 0.75); x.fill(); }
      x.fillStyle = 'rgba(255,255,255,.5)'; x.fillRect(-6.5, -3.6, 13, 0.6);
    }],
    pine: [12, 17, (x) => {
      for (let i = -2; i <= 2; i++) { x.beginPath(); x.moveTo(i * 1.1, -3); x.quadraticCurveTo(i * 2.2, -6.5, i * 1.6, -8.4); x.quadraticCurveTo(i * 0.6, -5.5, i * 0.2 - 0.9, -3); x.fillStyle = i % 2 ? '#3fae32' : '#62d040'; x.fill(); stroke(x, 0.5); }
      ell(x, 0, 2.5, 4.6, 5.6); x.fillStyle = rad(x, 0, 2.5, 5.8, [[0, '#fff09a'], [0.5, '#f2b51c'], [1, '#a8640a']]); x.fill(); stroke(x, 0.8);
      x.save(); ell(x, 0, 2.5, 4.4, 5.4); x.clip(); x.strokeStyle = 'rgba(120,60,0,.6)'; x.lineWidth = 0.4;
      for (let i = -10; i <= 10; i += 2.2) { x.beginPath(); x.moveTo(i, -4); x.lineTo(i + 10, 9); x.moveTo(i, 9); x.lineTo(i + 10, -4); x.stroke(); }
      x.restore();
      x.fillStyle = 'rgba(255,255,255,.6)'; ell(x, -1.8, 0.4, 0.9, 1.8, 0.3); x.fill();
    }],
    cherry: [13, 13, (x) => {
      x.strokeStyle = '#3f7a1c'; x.lineWidth = 0.8; x.beginPath(); x.moveTo(-3, 2); x.quadraticCurveTo(-1, -4, 1.5, -5.5); x.moveTo(3, 2.5); x.quadraticCurveTo(2, -3, 1.5, -5.5); x.stroke();
      x.beginPath(); x.moveTo(1.5, -5.5); x.quadraticCurveTo(5.5, -7, 5.4, -3.6); x.quadraticCurveTo(3, -3.8, 1.5, -5.5); x.fillStyle = '#4fc23a'; x.fill(); stroke(x, 0.5);
      for (const [a, b] of [[-3, 3], [3, 3.6]]) { circ(x, a, b, 2.9); x.fillStyle = rad(x, a, b, 2.9, [[0, '#ff9a9a'], [0.4, '#e3122c'], [1, '#6a0010']]); x.fill(); stroke(x, 0.7); x.fillStyle = 'rgba(255,255,255,.75)'; circ(x, a - 1, b - 1, 0.7); x.fill(); }
    }],
    egg: [12, 15, (x, bad) => {
      x.beginPath(); x.moveTo(0, -7); x.bezierCurveTo(5, -7, 5.6, 2, 5, 3.6); x.bezierCurveTo(4, 7.4, -4, 7.4, -5, 3.6); x.bezierCurveTo(-5.6, 2, -5, -7, 0, -7); x.closePath();
      x.fillStyle = rad(x, 0, 0, 7.5, [[0, '#ffffff'], [0.6, '#f1ece2'], [1, '#bdb2a0']]); x.fill(); stroke(x, 0.85);
      x.fillStyle = bad ? '#e5352c' : '#53b4f0';
      for (const [a, b, r] of [[-2, -3, 1.3], [2.2, -0.8, 1.1], [-1.8, 2.6, 1.2], [2, 4, 0.9], [0.4, -5.2, 0.7]]) { circ(x, a, b, r); x.fill(); }
      x.fillStyle = 'rgba(255,255,255,.9)'; ell(x, -2.2, -3.6, 0.9, 1.8, 0.3); x.fill();
    }],
    rock: [18, 13, (x, a) => {
      const c = a === 3 ? ['#8a7d78', '#4a3e3c', '#2a2020'] : a === 2 ? ['#efd9b0', '#b99a6a', '#6e5430'] : ['#e2ddd2', '#a39b8c', '#5e574c'];
      x.beginPath(); x.moveTo(-8.4, 6); x.quadraticCurveTo(-9, -1, -4.5, -3.5); x.quadraticCurveTo(-1, -6.4, 3.5, -4.6); x.quadraticCurveTo(8.8, -2.2, 8.4, 6); x.closePath();
      x.fillStyle = rad(x, 0, 0, 9.5, [[0, c[0]], [0.55, c[1]], [1, c[2]]]); x.fill(); stroke(x, 0.9);
      x.strokeStyle = 'rgba(0,0,0,.25)'; x.lineWidth = 0.6; x.beginPath(); x.moveTo(-1, -5); x.lineTo(0.5, -1); x.lineTo(-1.6, 2.5); x.moveTo(4, -1.5); x.lineTo(6, 2); x.stroke();
      x.fillStyle = 'rgba(255,255,255,.55)'; ell(x, -4, -1.5, 2.2, 1, -0.5); x.fill();
      if (a === 1) { x.fillStyle = 'rgba(80,170,60,.75)'; ell(x, 2, -4.5, 3.2, 1.1, 0.2); x.fill(); }
    }],
    axe: [12, 12, (x) => {
      x.save(); x.rotate(-0.5);
      rrp(x, -0.9, -4, 1.8, 10, 0.8); x.fillStyle = lin(x, -1, 0, 1, 0, [[0, '#7a4a20'], [0.5, '#c88a4a'], [1, '#6a3a14']]); x.fill(); stroke(x, 0.6);
      x.beginPath(); x.moveTo(-0.8, -5.5); x.lineTo(5, -6.8); x.quadraticCurveTo(6.2, -3.2, 5, 0.4); x.lineTo(-0.8, -1); x.closePath();
      x.fillStyle = lin(x, 0, -7, 0, 1, [[0, '#e6e6ea'], [0.5, '#9a9aa6'], [1, '#5a5a66']]); x.fill(); stroke(x, 0.7);
      x.strokeStyle = '#c9a86a'; x.lineWidth = 0.7; x.beginPath(); x.moveTo(-1.2, -4.6); x.lineTo(1.2, -2.2); x.moveTo(-1.2, -2.6); x.lineTo(1.2, -4.8); x.stroke();
      x.restore();
    }],
  };

  // ---------- φόντα (πλακίδια που επαναλαμβάνονται οριζόντια, με parallax) ----------
  const LAYERS = [
    { // δάσος
      sky(x, R) {
        x.fillStyle = lin(x, 0, 0, 0, LH, [[0, '#2f9ff0'], [0.5, '#7fd3ff'], [0.85, '#d6f6ff'], [1, '#e8fbff']]); x.fillRect(0, 0, TW, LH);
        for (let i = 0; i < 7; i++) cloud(x, R() * TW, 70 + R() * 70, 0.7 + R() * 0.7);
      },
      far(x, R) {
        const list = [];
        for (let i = 0; i < 26; i++) { const cx = (i / 26) * TW + R() * 8, cy = 112 + R() * 26, r = 12 + R() * 12; list.push([cx, cy, r], [cx - TW, cy, r], [cx + TW, cy, r]); }
        x.fillStyle = '#b9d9a0'; for (let i = 0; i < 12; i++) { const tx = R() * TW; x.fillRect(tx, 110, 4, 80); }
        blobs(x, list, { out: '#6fb27a', base: '#8ccf8a', mid: '#a6e09a', hi: 'rgba(230,255,210,.5)' }, 0.8);
        x.fillStyle = '#8ccf8a'; x.fillRect(0, 140, TW, LH);
        x.fillStyle = lin(x, 0, 90, 0, LH, [[0, 'rgba(220,245,255,0)'], [1, 'rgba(220,245,255,.55)']]); x.fillRect(0, 90, TW, LH);
      },
      mid(x, R) {
        const trunks = [];
        for (let i = 0; i < 4; i++) trunks.push([(i + 0.15 + R() * 0.6) * TW / 4, 22 + R() * 8]);
        for (const [tx, w] of trunks) for (const o of [0, -TW, TW]) trunk(x, tx + o, w, R);
        const list = [];
        for (let i = 0; i < 22; i++) { const cx = (i / 22) * TW + R() * 10, cy = 22 + R() * 36, r = 18 + R() * 16; list.push([cx, cy, r], [cx - TW, cy, r], [cx + TW, cy, r]); }
        x.fillStyle = '#1d6b1c'; x.fillRect(0, 0, TW, 26);
        x.fillStyle = 'rgba(0,40,0,.18)'; for (const [cx, cy, r] of list) { ell(x, cx + 2, cy + 8, r * 1.02, r * 0.9); x.fill(); }
        blobs(x, list, { out: '#1d6b1c', base: '#2eb534', mid: '#4fd23e', hi: 'rgba(190,255,120,.85)' }, 1.4);
        x.fillStyle = 'rgba(20,90,20,.35)';
        for (let i = 0; i < 200; i++) { const a = R() * TW, b = R() * 70; ell(x, a, b, 1.6, 0.9, R() * 3); x.fill(); }
        for (let i = 0; i < 6; i++) { // λιάνες
          const vx = R() * TW, vl = 40 + R() * 60;
          x.strokeStyle = '#2a7a24'; x.lineWidth = 1.2; x.beginPath(); x.moveTo(vx, 30); x.quadraticCurveTo(vx + 6, 30 + vl / 2, vx, 30 + vl); x.stroke();
          x.fillStyle = '#4fc23a'; for (let k = 0; k < vl; k += 8) { ell(x, vx + Math.sin(k) * 2.5 + 2, 34 + k, 2.2, 1.2, 0.6); x.fill(); }
        }
      },
      near(x, R) {
        const list = [];
        for (let i = 0; i < 18; i++) { const cx = (i / 18) * TW + R() * 12, cy = GY - 6 - R() * 6, r = 11 + R() * 11; list.push([cx, cy, r], [cx - TW, cy, r], [cx + TW, cy, r]); }
        blobs(x, list, { out: '#13541a', base: '#239a2e', mid: '#3fbe3c', hi: 'rgba(170,240,110,.8)' }, 1.2);
        x.fillStyle = '#239a2e'; x.fillRect(0, GY - 4, TW, LH);
        for (let i = 0; i < 14; i++) flower(x, R() * TW, GY - 8 - R() * 14, ['#fff36a', '#ff7ab8', '#ffffff'][(R() * 3) | 0]);
      },
      ground(x, R) { // 96×32
        x.fillStyle = '#5e3416'; x.fillRect(0, 0, GT, 32);
        for (let row = 0; row < 4; row++) for (let i = -1; i < 7; i++) {
          const w = 13 + R() * 2, X0 = i * 16 + (row % 2) * 8 + R() * 1.5, Y = 9 + row * 6.4;
          for (const X of [X0 - GT, X0, X0 + GT]) {
            rrp(x, X, Y, w, 5.4, 2.4); x.fillStyle = lin(x, 0, Y, 0, Y + 5.4, [[0, '#ffe2a0'], [0.5, '#eabf72'], [1, '#b98440']]); x.fill(); stroke(x, 0.6, '#4a2a10');
            x.fillStyle = 'rgba(255,255,255,.45)'; rrp(x, X + 1.4, Y + 0.8, w * 0.45, 1, 0.5); x.fill();
          }
        }
        x.fillStyle = '#3c2210'; x.fillRect(0, 5, GT, 3.2);
        x.fillStyle = lin(x, 0, 0, 0, 6, [[0, '#9cf25a'], [0.5, '#4fcf32'], [1, '#2a9a22']]);
        x.beginPath(); x.moveTo(0, 0); x.lineTo(GT, 0); x.lineTo(GT, 5);
        for (let i = GT; i >= 0; i -= 4) x.quadraticCurveTo(i - 2, 7.6, i - 4, 5);
        x.closePath(); x.fill();
        x.beginPath(); x.moveTo(GT + 4, 5); for (let i = GT + 4; i >= -4; i -= 4) x.quadraticCurveTo(i - 2, 7.6, i - 4, 5); stroke(x, 0.6, '#1d6a14');
        x.fillStyle = '#7ad84a'; for (let i = 0; i < 10; i++) { const a = R() * GT; x.beginPath(); x.moveTo(a, 6.5); x.quadraticCurveTo(a + 1.6, 4.6, a + 3, 6.6); x.fill(); }
        x.fillStyle = 'rgba(255,255,255,.35)'; x.fillRect(0, 0.6, GT, 0.8);
      },
      plat: '#2a9a22', pit: ['#3a2210', '#0c0603'],
    },
    { // ακρογιαλιά
      sky(x, R) {
        x.fillStyle = lin(x, 0, 0, 0, 122, [[0, '#2386f0'], [0.6, '#7cc8ff'], [1, '#ffe7c2']]); x.fillRect(0, 0, TW, LH);
        const g = x.createRadialGradient(300, 46, 0, 300, 46, 46); g.addColorStop(0, 'rgba(255,255,230,1)'); g.addColorStop(0.25, 'rgba(255,240,170,.9)'); g.addColorStop(1, 'rgba(255,230,150,0)');
        x.fillStyle = g; x.fillRect(240, 0, 120, 100);
        for (let i = 0; i < 6; i++) cloud(x, R() * TW, 28 + R() * 60, 0.6 + R() * 0.6);
      },
      far(x, R) {
        x.fillStyle = lin(x, 0, 120, 0, LH, [[0, '#7fd6ff'], [0.12, '#2fa6e8'], [0.6, '#1170c4'], [1, '#0a4d96']]); x.fillRect(0, 120, TW, LH);
        for (const [cx, w, h] of [[60, 70, 12], [230, 50, 8]]) {
          x.fillStyle = '#5a9a8a'; x.beginPath(); x.moveTo(cx - w / 2, 121); x.quadraticCurveTo(cx, 121 - h * 2, cx + w / 2, 121); x.fill();
          x.strokeStyle = '#3a6a5a'; x.lineWidth = 0.8; x.beginPath(); x.moveTo(cx + 4, 121 - h * 0.8); x.quadraticCurveTo(cx + 6, 121 - h * 1.6, cx + 9, 121 - h * 2); x.stroke();
        }
        x.strokeStyle = 'rgba(255,255,255,.55)'; x.lineWidth = 0.7;
        for (let i = 0; i < 70; i++) { const a = R() * TW, b = 124 + R() * 70, l = 3 + R() * 9; x.beginPath(); x.moveTo(a, b); x.lineTo(a + l, b); x.stroke(); }
        x.fillStyle = 'rgba(255,255,255,.8)'; x.fillRect(0, 120, TW, 1);
      },
      mid(x, R) {
        for (let i = 0; i < 3; i++) { const px = (i + 0.2 + R() * 0.6) * TW / 3, lean = (R() - 0.5) * 50, h = 110 + R() * 40; for (const o of [0, -TW, TW]) palm(x, px + o, h, lean, R); }
      },
      near(x, R) {
        x.fillStyle = '#e9c27a';
        x.beginPath(); x.moveTo(0, LH); x.lineTo(0, GY - 6);
        for (let i = 0; i <= 12; i++) x.quadraticCurveTo(i * 32 - 16, GY - 18 - R() * 8, i * 32, GY - 6);
        x.lineTo(TW, LH); x.closePath();
        x.fillStyle = lin(x, 0, GY - 26, 0, GY, [[0, '#ffe6a6'], [1, '#d9a95a']]); x.fill(); stroke(x, 1, '#a2763a');
        for (let i = 0; i < 16; i++) { const a = R() * TW, b = GY - 10 - R() * 6; x.strokeStyle = '#4f9a32'; x.lineWidth = 0.9; for (let k = -2; k <= 2; k++) { x.beginPath(); x.moveTo(a, b + 4); x.quadraticCurveTo(a + k * 1.5, b - 2, a + k * 3, b - 5 - Math.abs(k)); x.stroke(); } }
      },
      ground(x, R) {
        x.fillStyle = '#8a5a2a'; x.fillRect(0, 0, GT, 32);
        for (let row = 0; row < 4; row++) for (let i = -1; i < 5; i++) {
          const X = i * 24 + (row % 2) * 12, Y = 9 + row * 6.2;
          rrp(x, X + 0.5, Y, 23, 5.6, 1.2); x.fillStyle = lin(x, 0, Y, 0, Y + 6, [[0, '#ffd99a'], [0.5, '#eab36a'], [1, '#b47a3a']]); x.fill(); stroke(x, 0.5, '#6a4218');
          x.fillStyle = 'rgba(120,70,20,.35)'; for (let k = 0; k < 5; k++) { circ(x, X + 2 + R() * 20, Y + 1 + R() * 4, 0.4); x.fill(); }
        }
        x.fillStyle = lin(x, 0, 0, 0, 8, [[0, '#fff3c8'], [0.6, '#ffe1a0'], [1, '#e6b86a']]);
        x.beginPath(); x.moveTo(0, 0); x.lineTo(GT, 0); x.lineTo(GT, 7);
        for (let i = GT; i >= 0; i -= 8) x.quadraticCurveTo(i - 4, 9.5, i - 8, 7);
        x.closePath(); x.fill();
        x.beginPath(); x.moveTo(GT + 8, 7); for (let i = GT + 8; i >= -8; i -= 8) x.quadraticCurveTo(i - 4, 9.5, i - 8, 7); stroke(x, 0.6, '#b8863a');
        x.fillStyle = 'rgba(160,110,50,.5)'; for (let i = 0; i < 40; i++) { circ(x, R() * GT, 1 + R() * 6, 0.35); x.fill(); }
        x.fillStyle = 'rgba(255,255,255,.6)'; x.fillRect(0, 0.5, GT, 0.7);
      },
      plat: '#e6b86a', pit: ['#2fa6e8', '#0a3a7a'], water: true,
    },
    { // ηφαίστειο
      sky(x, R) {
        x.fillStyle = lin(x, 0, 0, 0, LH, [[0, '#14082a'], [0.35, '#4a1440'], [0.62, '#b8323a'], [0.8, '#ff8a3a'], [1, '#ffc070']]); x.fillRect(0, 0, TW, LH);
        x.fillStyle = 'rgba(255,255,255,.7)'; for (let i = 0; i < 60; i++) { const s = R() * 0.8; x.fillRect(R() * TW, R() * 60, s, s); }
        // ηφαίστειο
        x.fillStyle = lin(x, 0, 70, 0, LH, [[0, '#3a1a2a'], [1, '#1a0a14']]);
        x.beginPath(); x.moveTo(150, LH); x.lineTo(235, 78); x.quadraticCurveTo(250, 72, 265, 78); x.lineTo(350, LH); x.closePath(); x.fill();
        x.globalCompositeOperation = 'lighter';
        const g = x.createRadialGradient(250, 76, 0, 250, 76, 40); g.addColorStop(0, 'rgba(255,200,80,.9)'); g.addColorStop(1, 'rgba(255,80,20,0)');
        x.fillStyle = g; x.fillRect(200, 30, 100, 90);
        x.strokeStyle = 'rgba(255,120,30,.9)'; x.lineWidth = 1.6;
        for (const s of [-1, 1, -0.4]) { x.beginPath(); x.moveTo(250 + s * 6, 78); x.quadraticCurveTo(250 + s * 20, 110, 250 + s * 30 + R() * 10, 140); x.stroke(); }
        x.globalCompositeOperation = 'source-over';
        for (let i = 0; i < 16; i++) { x.fillStyle = `rgba(${60 + i * 4},${30 + i * 2},${50 + i * 2},${0.55 - i * 0.025})`; circ(x, 250 + Math.sin(i) * 6 + i * 5, 70 - i * 5, 7 + i * 1.6); x.fill(); }
      },
      far(x, R) {
        x.beginPath(); x.moveTo(0, LH); x.lineTo(0, 140);
        for (let i = 0; i <= 16; i++) x.lineTo(i * 24, 116 + R() * 34 + (i % 2) * 10);
        x.lineTo(TW, 140); x.lineTo(TW, LH); x.closePath();
        x.fillStyle = lin(x, 0, 110, 0, LH, [[0, '#4a2240'], [1, '#2a1028']]); x.fill(); stroke(x, 1.2, 'rgba(255,130,60,.7)');
      },
      mid(x, R) {
        for (let i = 0; i < 5; i++) {
          const px = (i + R()) * TW / 5, h = 50 + R() * 50, w = 12 + R() * 10;
          for (const o of [0, -TW, TW]) {
            x.beginPath(); x.moveTo(px + o - w, GY + 4); x.lineTo(px + o - w * 0.6, GY - h); x.lineTo(px + o - w * 0.1, GY - h - 6); x.lineTo(px + o + w * 0.6, GY - h + 4); x.lineTo(px + o + w, GY + 4); x.closePath();
            x.fillStyle = lin(x, px + o - w, 0, px + o + w, 0, [[0, '#ff7a3a'], [0.12, '#3a1c24'], [1, '#1c0c14']]); x.fill(); stroke(x, 1, '#12060c');
            x.strokeStyle = 'rgba(0,0,0,.4)'; x.lineWidth = 0.6; x.beginPath(); x.moveTo(px + o - w * 0.3, GY - h * 0.7); x.lineTo(px + o + w * 0.1, GY - h * 0.3); x.stroke();
          }
        }
      },
      near(x, R) {
        const list = [];
        for (let i = 0; i < 16; i++) { const cx = (i / 16) * TW + R() * 12, cy = GY - 4 - R() * 6, r = 8 + R() * 9; list.push([cx, cy, r], [cx - TW, cy, r], [cx + TW, cy, r]); }
        blobs(x, list, { out: '#120608', base: '#2e1c1e', mid: '#3e2a2a', hi: 'rgba(255,140,60,.35)' }, 1);
        x.fillStyle = '#2e1c1e'; x.fillRect(0, GY - 2, TW, LH);
      },
      ground(x, R) {
        x.fillStyle = '#1e1416'; x.fillRect(0, 0, GT, 32);
        for (let row = 0; row < 4; row++) for (let i = -1; i < 7; i++) {
          const w = 14 + R() * 1.5, X0 = i * 16 + (row % 2) * 8, Y = 9 + row * 6.3;
          for (const X of [X0 - GT, X0, X0 + GT]) { rrp(x, X, Y, w, 5.6, 1.6); x.fillStyle = lin(x, 0, Y, 0, Y + 6, [[0, '#6a5a58'], [0.5, '#4a3c3c'], [1, '#2a2020']]); x.fill(); stroke(x, 0.5, '#0e0808'); }
        }
        x.strokeStyle = 'rgba(255,110,30,.7)'; x.lineWidth = 0.5;
        for (let i = 0; i < 8; i++) { const a = R() * GT; x.beginPath(); x.moveTo(a, 8); x.lineTo(a + 2, 15); x.lineTo(a - 1, 22); x.stroke(); }
        x.fillStyle = lin(x, 0, 0, 0, 7, [[0, '#8a7472'], [0.5, '#5a4a48'], [1, '#3a2c2c']]);
        x.beginPath(); x.moveTo(0, 0); x.lineTo(GT, 0); x.lineTo(GT, 6);
        for (let i = GT; i >= 0; i -= 6) x.lineTo(i - 3, 8), x.lineTo(i - 6, 6);
        x.closePath(); x.fill();
        x.beginPath(); x.moveTo(GT + 6, 6); for (let i = GT + 6; i >= -6; i -= 6) x.lineTo(i - 3, 8), x.lineTo(i - 6, 6); stroke(x, 0.6, '#140a0a');
        x.strokeStyle = '#ff8a2a'; x.lineWidth = 0.6;
        for (let i = 0; i < 5; i++) { const a = R() * GT; x.beginPath(); x.moveTo(a, 1); x.lineTo(a + 3, 3.5); x.lineTo(a + 1.5, 6); x.stroke(); }
        x.fillStyle = 'rgba(255,255,255,.25)'; x.fillRect(0, 0.5, GT, 0.7);
      },
      plat: '#5a4a48', pit: ['#ffcf40', '#a8200a'], lava: true,
    },
  ];
  function cloud(x, cx, cy, s) {
    const list = [[0, 0, 12], [-12, 4, 9], [12, 4, 10], [-5, -6, 9], [7, -5, 8], [-20, 8, 6], [21, 8, 6]].map(([a, b, r]) => [cx + a * s, cy + b * s, r * s]);
    for (const o of [0, -TW, TW]) blobs(x, list.map(([a, b, r]) => [a + o, b, r]), { out: 'rgba(120,160,200,.55)', base: '#d4e6f6', mid: '#ffffff' }, 0.7);
  }
  function trunk(x, tx, w, R) {
    x.beginPath();
    x.moveTo(tx - w * 0.42, 20); x.lineTo(tx - w * 0.5, GY - 14); x.quadraticCurveTo(tx - w * 0.55, GY - 2, tx - w * 0.95, GY + 4);
    x.lineTo(tx + w * 0.95, GY + 4); x.quadraticCurveTo(tx + w * 0.55, GY - 2, tx + w * 0.5, GY - 14); x.lineTo(tx + w * 0.42, 20); x.closePath();
    x.fillStyle = lin(x, tx - w / 2, 0, tx + w / 2, 0, [[0, '#9a5a22'], [0.25, '#e9b25e'], [0.45, '#ffd98a'], [0.7, '#d8963e'], [1, '#7a4214']]); x.fill(); stroke(x, 1.2);
    x.strokeStyle = 'rgba(110,60,20,.55)'; x.lineWidth = 0.8;
    for (let k = 0; k < 5; k++) { const bx = tx - w * 0.3 + k * w * 0.15; x.beginPath(); x.moveTo(bx, 40 + R() * 30); x.quadraticCurveTo(bx + (R() - 0.5) * 4, 110, bx + (R() - 0.5) * 3, GY - 20 - R() * 30); x.stroke(); }
    x.fillStyle = '#5a3010'; ell(x, tx + (R() - 0.5) * w * 0.4, 100 + R() * 40, 2.2, 3.2); x.fill();
    x.fillStyle = lin(x, 0, 20, 0, 70, [[0, 'rgba(30,60,10,.55)'], [1, 'rgba(30,60,10,0)']]); x.fillRect(tx - w, 20, w * 2, 50);
  }
  function palm(x, px, h, lean, R) {
    const n = 12; let pts = [];
    for (let i = 0; i <= n; i++) { const t = i / n; pts.push([px + lean * t * t, GY + 2 - h * t]); }
    for (let i = 0; i < n; i++) {
      const [a, b] = pts[i], [c, d] = pts[i + 1], w = 6.5 - i * 0.25;
      x.beginPath(); x.moveTo(a - w, b); x.lineTo(c - w + 0.6, d); x.lineTo(c + w - 0.6, d); x.lineTo(a + w, b); x.closePath();
      x.fillStyle = lin(x, a - w, 0, a + w, 0, [[0, '#7a4a20'], [0.4, '#d8a060'], [1, '#8a5428']]); x.fill(); stroke(x, 0.7);
    }
    const [tx, ty] = pts[n];
    for (let k = 0; k < 7; k++) {
      const a = -Math.PI / 2 + (k - 3) * 0.55 + (R() - 0.5) * 0.2, L = 34 + R() * 10;
      const ex = tx + Math.cos(a) * L, ey = ty + Math.sin(a) * L * 0.5 + 18;
      const mx = tx + Math.cos(a) * L * 0.5, my = ty + Math.sin(a) * L * 0.6 - 8;
      x.beginPath(); x.moveTo(tx, ty); x.quadraticCurveTo(mx - 4, my - 6, ex, ey); x.quadraticCurveTo(mx + 4, my + 6, tx, ty);
      x.fillStyle = lin(x, tx, ty - 10, tx, ty + 20, [[0, '#6ae04a'], [1, '#1f8a2e']]); x.fill(); stroke(x, 0.8, '#155a1c');
      x.strokeStyle = 'rgba(20,80,20,.6)'; x.lineWidth = 0.5; x.beginPath(); x.moveTo(tx, ty); x.quadraticCurveTo(mx, my, ex, ey); x.stroke();
    }
    for (const [a, b] of [[-2.5, 3], [2.5, 3.5], [0, 6]]) { circ(x, tx + a, ty + b, 2.6); x.fillStyle = rad(x, tx + a, ty + b, 2.6, [[0, '#a8743a'], [1, '#4a2a10']]); x.fill(); stroke(x, 0.6); }
  }
  function flower(x, fx, fy, col) {
    x.strokeStyle = '#2a8a24'; x.lineWidth = 0.7; x.beginPath(); x.moveTo(fx, fy); x.lineTo(fx, fy + 8); x.stroke();
    x.fillStyle = col; for (let i = 0; i < 5; i++) { const a = (i / 5) * TAU; circ(x, fx + Math.cos(a) * 1.6, fy + Math.sin(a) * 1.6, 1.3); x.fill(); }
    x.fillStyle = '#ffb320'; circ(x, fx, fy, 1); x.fill();
  }

  class JungleGame extends Base {
    constructor(c, h) { super(c, h); this.WIN = 0; }

    resize() {
      super.resize();
      this.s = this.H / LH; this.VW = this.W / this.s;
      this.dpr = this.c.width / this.W;
      this.R = this.s * this.dpr;
      this.sprC = new Map(); this.layerC = new Map();
    }

    sprite(name, arg = 0) {
      const key = name + arg; let c = this.sprC.get(key); if (c) return c;
      const [w, h, paint] = SPR[name], R = Math.min(this.R, 8);
      c = document.createElement('canvas'); c.width = Math.ceil(w * R); c.height = Math.ceil(h * R);
      const x = c.getContext('2d'); x.scale(R, R); x.translate(w / 2, h / 2); paint(x, arg);
      c.w = w; c.h = h; this.sprC.set(key, c); return c;
    }
    layer(a, name) {
      const key = a + name; let c = this.layerC.get(key); if (c) return c;
      const R = Math.min(this.R, 5), w = name === 'ground' ? GT : TW, h = name === 'ground' ? 32 : LH;
      c = document.createElement('canvas'); c.width = Math.ceil(w * R); c.height = Math.ceil(h * R);
      const x = c.getContext('2d'); x.scale(R, R);
      LAYERS[a][name](x, rng(a * 131 + name.length * 17 + 5));
      this.layerC.set(key, c); return c;
    }
    put(img, X, Y, rot = 0, sc = 1) {
      const x = this.ctx;
      if (rot || sc !== 1) { x.save(); x.translate(X, Y); x.rotate(rot); x.scale(sc, sc); x.drawImage(img, -img.w / 2, -img.h / 2, img.w, img.h); x.restore(); }
      else x.drawImage(img, X - img.w / 2, Y - img.h / 2, img.w, img.h);
    }

    active(p) { return p.bot || !p.p || p.p.connected; }

    setup() {
      const n = this.parts.length;
      this.humans = this.parts.filter((p) => !p.bot).length;
      this.lives = 3 + this.humans;
      this.hpMul = 1 + 0.35 * (n - 1);
      this.seed = (Math.random() * 1e9) | 0;
      this.area = 1; this.team = 0; this.syncT = 0;
      this.parts.forEach((p) => Object.assign(p, { fruits: 0, foes: 0, falls: 0, axe: false, skate: false, mv: 0, botT: 0, hi: false, status: '' }));
      this.startArea();
    }

    startArea() {
      this.build();
      this.camX = 0; this.shake = 0;
      this.axes = []; this.pfx = []; this.floats = []; this.shots = []; this.waves = [];
      this.boss = null; this.bossOn = false; this.dropT = 3;
      this.parts.forEach((p, i) => Object.assign(p, {
        x: 34 + i * 16, y: GY, vx: 0, vy: 0, onG: true, coy: 0, jumpBuf: 0, face: 1, ph: 0,
        dead: 0, rot: 0, inv: 0, trip: 0, fairy: 0, cloud: 0, en: 100, throwT: 0, pushT: 0, gone: false,
      }));
      this.phase = 'count';
      const A = AREAS[this.area - 1];
      this.banner(this.area === 1 ? 'Περιπέτεια στη ζούγκλα! 🌴' : `Περιοχή ${this.area}: ${A.name}${A.boss ? ' 🌋' : ''}`, '#ffe066');
      this.countdown(() => { this.phase = 'go'; this.changed(); });
      this.changed();
    }

    // ---------- κατασκευή πίστας (τυχαία αλλά πάντα βατή) ----------
    build() {
      const a = this.area, A = AREAS[a - 1], R = rng(this.seed + a * 7919), n = this.parts.length;
      const L = this.L = { segs: [], plats: [], fruits: [], rocks: [], fires: [], eggs: [], foes: [], deco: [], goal: 0, arena: 0, end: 0 };
      const ground = (x0, x1) => { const s = L.segs[L.segs.length - 1]; if (s && s.x1 >= x0 - 0.5) s.x1 = Math.max(s.x1, x1); else L.segs.push({ x0, x1 }); };
      const pickFruit = () => { const r = R(); return r < 0.3 ? 'banana' : r < 0.5 ? 'apple' : r < 0.65 ? 'cherry' : r < 0.8 ? 'grapes' : r < 0.92 ? 'pine' : 'melon'; };
      const fruit = (x, y, k) => L.fruits.push({ x, y, k: k || pickFruit(), t: R() * 6 });
      const row = (x, y, cnt, gap) => { for (let i = 0; i < cnt; i++) fruit(x + i * gap, y); };
      const foe = (x, k) => {
        k = k || A.foes[(R() * A.foes.length) | 0];
        const e = { k, x, y: GY, vx: 0, vy: 0, dir: -1, t: R() * 5, hp: k === 'boulder' ? 2 : 1, on: false, alive: true, home: x, cd: 1 + R() * 2 };
        if (k === 'bee') { e.y = GY - 30 - R() * 14; e.base = e.y; }
        L.foes.push(e);
      };
      const egg = (x, y = GY) => {
        let k;
        if (R() < A.bad) k = 'cloud';
        else { const r = R(); k = r < 0.45 ? 'axe' : r < 0.65 ? 'skate' : r < 0.8 ? 'fairy' : 'basket'; }
        L.eggs.push({ x, y, k, broken: 0 });
      };
      const C = {
        flat(x) {
          const w = 130 + R() * 60; ground(x, x + w);
          if (R() < 0.5) row(x + 30, GY - 13, 3, 22); else { row(x + 40, GY - 52, 3, 18); }
          if (R() < 0.6) L.deco.push({ x: x + w * R(), k: (R() * 3) | 0 });
          return w;
        },
        rock(x) { ground(x, x + 140); L.rocks.push({ x: x + 70, hit: 0 }); fruit(x + 70, GY - 48); if (R() < 0.5) fruit(x + 115, GY - 13); return 140; },
        fire(x) { ground(x, x + 150); L.fires.push({ x: x + 75, t: R() * 5 }); fruit(x + 75, GY - 52); return 150; },
        pit(x) {
          const pw = 26 + R() * (A.pitMax - 26); ground(x, x + 44);
          for (let i = 0; i < 3; i++) fruit(x + 44 + pw / 2 + (i - 1) * 16, GY - 40 - (i === 1 ? 8 : 0));
          return 44 + pw;
        },
        bridge(x) {
          ground(x, x + 30); const g1 = 34 + R() * 6, pw = 44;
          L.plats.push({ x0: x + 30 + g1, x1: x + 30 + g1 + pw, y: GY - 26 });
          row(x + 30 + g1 + 8, GY - 40, 3, 14);
          return 30 + g1 + pw + 34 + R() * 6;
        },
        stairs(x) {
          const w = 230; ground(x, x + w);
          L.plats.push({ x0: x + 26, x1: x + 86, y: GY - 36 }, { x0: x + 108, x1: x + 178, y: GY - 70 });
          fruit(x + 130, GY - 84, 'melon'); fruit(x + 155, GY - 84); fruit(x + 56, GY - 50);
          if (R() < 0.7) foe(x + 150);
          return w;
        },
        foes(x) {
          const w = 170 + R() * 40; ground(x, x + w);
          foe(x + 90); if (a > 1 || n > 2 || R() < 0.4) foe(x + 90 + 40 + R() * 30);
          fruit(x + 40, GY - 13);
          return w;
        },
      };
      ground(0, 280); row(110, GY - 13, 4, 22);
      if (a === 1) L.eggs.push({ x: 230, y: GY, k: 'axe', broken: 0 });
      else egg(230);
      let x = 280, lastEgg = 230;
      const eggGap = n >= 3 ? 360 : 460;
      const types = Object.keys(A.w), tot = types.reduce((s, k) => s + A.w[k], 0);
      let prev = '';
      while (x < A.len - 260) {
        let t;
        if (x - lastEgg > eggGap) t = 'egg';
        else {
          do { let r = R() * tot; t = types.find((k) => (r -= A.w[k]) < 0) || 'flat'; } while (t === prev && (t === 'pit' || t === 'bridge'));
        }
        if (t === 'egg') { ground(x, x + 110); egg(x + 55); lastEgg = x + 55; fruit(x + 90, GY - 13); x += 110; prev = t; continue; }
        x += C[t](x); prev = t;
      }
      if (A.boss) {
        ground(x, x + 120); row(x + 20, GY - 13, 4, 20); x += 120;
        L.arena = x; ground(x, x + 1200);
        L.plats.push({ x0: x + 40, x1: x + 100, y: GY - 44 }, { x0: x + 284, x1: x + 344, y: GY - 44 });
        L.end = x + 384;
      } else {
        ground(x, x + 700); row(x + 30, GY - 13, 5, 20);
        L.goal = x + 200; L.end = L.goal + 70;
      }
    }

    segAt(x) { return this.L.segs.find((s) => x >= s.x0 - 3 && x <= s.x1 + 3); }
    groundAt(x) { return !!this.segAt(x); }
    // επιφάνεια που διασχίζουν τα πόδια (y0 → y1) στο x, αλλιώς null
    surface(x, y0, y1) {
      let best = null;
      if (y0 <= GY + 0.5 && y1 >= GY && this.groundAt(x)) best = GY;
      for (const q of this.L.plats) if (x >= q.x0 - 3 && x <= q.x1 + 3 && y0 <= q.y + 0.5 && y1 >= q.y && (best === null || q.y < best)) best = q.y;
      return best;
    }
    below(x, y) {
      let best = null;
      if (y <= GY + 1 && this.groundAt(x)) best = GY;
      for (const q of this.L.plats) if (x >= q.x0 - 3 && x <= q.x1 + 3 && y <= q.y + 1 && (best === null || q.y < best)) best = q.y;
      return best;
    }

    // ---------- είσοδος ----------
    input(part, msg) {
      if (!part) return;
      if (msg.type === 'move') { part.mv = U.clamp(Math.round(+msg.d || 0), -1, 1); return; }
      if (msg.type === 'extra') { part.turbo = !!msg.on; return; }
      if (this.phase !== 'go' || part.dead > 0) return;
      if (msg.type === 'jump') part.jumpBuf = 0.15;
      else if (msg.type === 'dash') this.throwAxe(part);
    }

    throwAxe(p) {
      if (!p.axe || p.dead > 0 || p.throwT > 0) return;
      if (this.axes.filter((a) => a.p === p).length >= 2) return;
      p.throwT = 0.28;
      this.axes.push({ p, x: p.x + p.face * 6, y: p.y - 14, vx: p.face * 190 + p.vx * 0.4, vy: -125, rot: 0, d: p.face });
      this.sfx('throw');
    }

    // ---------- bot ----------
    bot(p, dt) {
      p.botT -= dt; if (p.botT > 0) return; p.botT = 0.07;
      if (p.dead > 0) return;
      const hum = this.parts.filter((q) => !q.bot && !q.dead && this.active(q));
      let tx = hum.length ? Math.max(...hum.map((q) => q.x)) + 8 : this.camX + this.VW * 0.6;
      if (this.boss) {
        const b = this.boss, side = p.x < b.x ? -1 : 1;
        const room = side < 0 ? b.x - this.camX : this.camX + this.VW - b.x;
        const s2 = room < 70 ? -side : side;
        tx = U.clamp(b.x + s2 * 95, this.camX + 12, this.camX + this.VW - 12);
      }
      p.mv = Math.abs(tx - p.x) > 12 ? Math.sign(tx - p.x) : 0;
      const d = p.mv || p.face;
      if (p.onG && p.mv) {
        const look = p.x + d * 15;
        let jump = !this.groundAt(look) && p.y >= GY - 0.5 && !this.L.plats.some((q) => look > q.x0 && look < q.x1 && Math.abs(q.y - p.y) < 1);
        const near = (ox, r) => (ox - p.x) * d > 0 && (ox - p.x) * d < r;
        if (this.L.rocks.some((o) => near(o.x, 24)) || this.L.fires.some((o) => near(o.x, 26))) jump = true;
        if (this.L.foes.some((e) => e.alive && e.on && near(e.x, 26) && Math.abs(e.y - p.y) < 24)) jump = true;
        if (this.L.eggs.some((e) => !e.broken && e.k === 'cloud' && near(e.x, 18))) jump = true;
        if (this.waves.some((w) => Math.abs(w.x - p.x) < 34)) jump = true;
        if (jump) p.jumpBuf = 0.12;
      }
      if (p.axe) {
        const tgt = this.boss ? (this.boss.st !== 'die' && this.boss) : this.L.foes.find((e) => e.alive && e.on && Math.abs(e.x - p.x) < 150 && Math.abs(e.y - p.y) < 30);
        if (tgt) { p.face = Math.sign(tgt.x - p.x) || 1; if (Math.random() < 0.5) this.throwAxe(p); }
      }
    }

    // ---------- ενημέρωση ----------
    update(dt) {
      const go = this.phase === 'go', live = go || this.phase === 'won' || this.phase === 'clear';
      this.shake = Math.max(0, this.shake - dt);
      if (live) {
        if (go) for (const p of this.parts) if (p.bot) this.bot(p, dt);
        if (!go) for (const p of this.parts) p.mv = 0;
        for (const p of this.parts) this.stepPlayer(p, dt);
        this.camera(dt);
        this.stepFoes(dt);
        this.stepAxes(dt);
        this.stepShots(dt);
        if (this.boss) this.stepBoss(dt);
        if (go) this.collide();
        if (go && !this.L.arena && this.parts.some((p) => !p.dead && !p.gone && p.x >= this.L.goal)) this.clearArea();
        this.syncT -= dt; if (this.syncT <= 0) { this.syncT = 1; this.changed(); }
      }
      for (const q of this.pfx) { q.life -= dt; q.vy += (q.g || 0) * dt; q.x += q.vx * dt; q.y += q.vy * dt; if (q.rot != null) q.rot += q.vr * dt; }
      this.pfx = this.pfx.filter((q) => q.life > 0);
      for (const f of this.floats) { f.t += dt; f.y -= dt * 16; }
      this.floats = this.floats.filter((f) => f.t < 1.4);
      // ατμόσφαιρα: φύλλα, σταγόνες, κάρβουνα
      if (Math.random() < dt * (this.area === 2 ? 1 : 3)) {
        const X = this.camX + Math.random() * this.VW * 1.1;
        if (this.area === 1) this.pfx.push({ k: 'leaf', x: X, y: -4 + Math.random() * 50, vx: -8, vy: 14, g: 0, life: 9, max: 9, rot: Math.random() * 6, vr: 2, c: Math.random() < 0.5 ? '#6fd040' : '#e8c040' });
        else if (this.area === 3) this.pfx.push({ k: 'ember', x: X, y: LH + 2, vx: (Math.random() - 0.5) * 10, vy: -20 - Math.random() * 20, g: 0, life: 7, max: 7 });
      }
    }

    camera(dt) {
      const L = this.L, al = this.parts.filter((p) => !p.dead && !p.gone && this.active(p));
      const max = L.arena ? L.arena : Math.max(0, L.end + 40 - this.VW);
      if (al.length) {
        const lead = Math.max(...al.map((p) => p.x));
        const t = U.clamp(lead - this.VW * 0.52, 0, max);
        if (t > this.camX) this.camX += Math.min(t - this.camX, Math.max(30, (t - this.camX) * 6) * dt);
      }
      if (L.arena && !this.bossOn && this.camX >= L.arena - 0.5) this.startBoss();
    }

    stepPlayer(p, dt) {
      if (p.gone) return;
      if (p.dead > 0) {
        p.dead -= dt; p.vy += G * dt; p.y += p.vy * dt; p.x += p.vx * dt; p.rot += dt * 9;
        if (p.dead <= 0) this.respawn(p);
        return;
      }
      if (!this.active(p)) { p.x = Math.max(p.x, this.camX + 6); return; }
      p.inv = Math.max(0, p.inv - dt); p.trip = Math.max(0, p.trip - dt); p.throwT -= dt; p.pushT -= dt;
      if (p.fairy > 0) p.fairy = Math.max(0, p.fairy - dt);
      if (p.cloud > 0) p.cloud = Math.max(0, p.cloud - dt);
      if (this.phase === 'go') p.en -= DRAIN * (p.cloud > 0 ? 3.2 : 1) * dt;
      if (p.en <= 0) { p.en = 0; this.floatText(p.x, p.y - 30, 'Εξάντληση!', '#ffd0a0'); return this.die(p); }
      const mv = p.trip > 0 ? 0 : p.mv, top = (p.skate ? SKATE : SPD) * (p.turbo ? 1.4 : 1);
      const acc = p.onG ? (p.skate ? 420 : 900) : 560;
      p.vx += U.clamp(mv * top - p.vx, -acc * dt, acc * dt);
      if (mv) p.face = mv;
      if (p.jumpBuf > 0) {
        p.jumpBuf -= dt;
        if (p.coy > 0 && p.trip <= 0) {
          p.vy = -JV * (p.skate ? 1.05 : 1); p.onG = false; p.coy = 0; p.jumpBuf = 0; this.sfx('blip');
          this.dust(p.x, p.y, 4);
        }
      }
      p.vy = Math.min(p.vy + G * dt, 480);
      const oy = p.y;
      p.x += p.vx * dt; p.y += p.vy * dt;
      const lo = this.camX + 6, hi = this.camX + this.VW - 6;
      if (p.x < lo) { p.x = lo; p.pushT = 1; if (p.vx < 0) p.vx = 0; }
      if (p.x > hi) { p.x = hi; if (p.vx > 0) p.vx = 0; }
      const wasG = p.onG; p.onG = false;
      if (p.vy >= 0) { const s = this.surface(p.x, oy, p.y); if (s !== null) { p.y = s; p.vy = 0; p.onG = true; if (!wasG) this.dust(p.x, p.y, 3); } }
      // τοίχος του γκρεμού όταν πέφτεις σε λάκκο
      if (p.y > GY + 1) {
        const s = this.L.segs.find((q) => p.x > q.x0 - 4 && p.x < q.x1 + 4);
        if (s) { p.x = p.x - s.x0 < s.x1 - p.x ? s.x0 - 4 : s.x1 + 4; p.vx = 0; }
      }
      p.coy = p.onG ? 0.1 : p.coy - dt;
      if (p.onG && Math.abs(p.vx) > 8) p.ph += Math.abs(p.vx) * dt * 0.32;
      if (p.y > LH + 24) {
        if (p.pushT > 0) { this.respawn(p, true); this.floatText(p.x, 60, 'Σε σώσαμε!', '#bdf'); }
        else { p.falls++; this.die(p, true); }
      }
      if (p.skate && p.onG && Math.random() < dt * 8) this.dust(p.x - p.face * 6, p.y, 1);
    }

    die(p, fell) {
      if (p.dead > 0 || p.gone) return;
      p.dead = RESPAWN; p.rot = 0; p.vy = fell ? 0 : -240; p.vx = 0;
      p.skate = false; p.fairy = 0; p.cloud = 0; p.axe = false; p.trip = 0;
      this.sfx('hurt'); this.shake = 0.25;
      this.fx(p, '💫 Ωχ! Χάνεις μια ζωή', [80, 40, 160], true);
      if (!p.bot) {
        this.lives--;
        if (this.lives <= 0) {
          this.lives = 0; this.phase = 'lost';
          this.banner('💔 Τελείωσαν οι ζωές!', '#ff8a8a');
          this.after(2.6, () => this.finish(false));
        }
      }
      this.changed();
    }

    respawn(p, saved) {
      if (this.phase === 'lost' || this.phase === 'end') { p.gone = true; return; }
      let x = this.camX + this.VW * (this.bossOn ? 0.2 : 0.35);
      if (!this.groundAt(x)) {
        const s = this.L.segs.find((q) => q.x1 > x + 10) || this.L.segs[this.L.segs.length - 1];
        x = Math.max(s.x0 + 14, x);
      }
      for (let k = 0; k < 6; k++) if (this.L.rocks.some((o) => Math.abs(o.x - x) < 16) || this.L.fires.some((o) => Math.abs(o.x - x) < 18)) x += 20;
      Object.assign(p, { x, y: -10, vx: 0, vy: 0, dead: 0, rot: 0, inv: INVUL, en: saved ? p.en : 100, onG: false, trip: 0, pushT: 0 });
      this.changed();
    }

    hurt(p) {
      if (p.dead > 0 || p.inv > 0 || p.fairy > 0) return;
      if (p.skate) {
        p.skate = false; p.inv = 1.2; this.sfx('bump');
        this.pfx.push({ k: 'board', x: p.x, y: p.y - 2, vx: -p.face * 60, vy: -160, g: 600, life: 1.2, max: 1.2, rot: 0, vr: 9 });
        this.floatText(p.x, p.y - 30, 'Έσπασε το πατίνι!', '#ffd0a0'); this.changed();
        return;
      }
      this.die(p);
    }

    gain(p, pts, X, Y, txt, col) {
      p.score += pts; this.team += pts;
      if (X != null) this.floatText(X, Y, txt || `+${pts}`, col || '#fff6a0');
    }
    floatText(x, y, txt, col) { this.floats.push({ x, y, txt, col, t: 0 }); }
    dust(x, y, n) { for (let i = 0; i < n; i++) this.pfx.push({ k: 'dust', x: x + U.rand(-4, 4), y: y - 1, vx: U.rand(-20, 20), vy: U.rand(-18, -4), g: 0, life: 0.5, max: 0.5, r: U.rand(2, 3.5) }); }
    sparkle(x, y, c, n = 10) { for (let i = 0; i < n; i++) { const a = U.rand(0, TAU), v = U.rand(30, 90); this.pfx.push({ k: 'spark', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: 60, life: 0.6, max: 0.6, c }); } }
    poof(x, y, n = 8) { for (let i = 0; i < n; i++) { const a = U.rand(0, TAU), v = U.rand(10, 40); this.pfx.push({ k: 'smoke', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 10, g: 0, life: 0.7, max: 0.7, r: U.rand(3, 6) }); } }

    // ---------- εχθροί ----------
    stepFoes(dt) {
      const L = this.L, edgeR = this.camX + this.VW + 24;
      for (const e of L.foes) {
        if (!e.alive) continue;
        if (!e.on) { if (e.x < edgeR) e.on = true; else continue; }
        e.t += dt;
        if (e.x < this.camX - 60 || e.y > LH + 40) { e.alive = false; continue; }
        if (e.k === 'snail' || e.k === 'crab') {
          const sp = e.k === 'snail' ? 11 : 26;
          if (e.k === 'crab' && Math.abs(e.x - e.home) > 30) e.dir = Math.sign(e.home - e.x);
          if (!this.groundAt(e.x + e.dir * 10)) e.dir = -e.dir;
          e.x += e.dir * sp * dt;
        } else if (e.k === 'frog') {
          if (e.y >= GY && e.vy >= 0) {
            e.cd -= dt;
            if (e.cd <= 0) {
              const tgt = this.nearest(e.x); const d = tgt ? Math.sign(tgt.x - e.x) || -1 : -1;
              e.dir = d; e.cd = 1.3 + Math.random();
              if (this.groundAt(e.x + d * 34)) { e.vx = d * 40; e.vy = -210; } else { e.vx = 0; e.vy = -160; }
            }
          }
          if (e.y < GY || e.vy < 0) { e.vy += G * dt; e.x += e.vx * dt; e.y += e.vy * dt; if (e.y >= GY && e.vy > 0) { e.y = GY; e.vy = 0; e.vx = 0; } }
        } else if (e.k === 'bee') {
          e.x -= 30 * dt; e.y = e.base + Math.sin(e.t * 3) * 12; e.dir = -1;
        } else if (e.k === 'snake') {
          const tgt = this.nearest(e.x); if (tgt) e.dir = Math.sign(tgt.x - e.x) || -1;
          e.cd -= dt;
          if (e.cd <= 0 && e.x < this.camX + this.VW - 10) { e.cd = 2.6; e.spit = 0.4; this.shots.push({ x: e.x + e.dir * 8, y: GY - 15, vx: e.dir * 85, vy: 0, g: 0, life: 4 }); this.sfx('zap'); }
          e.spit = Math.max(0, (e.spit || 0) - dt);
        } else if (e.k === 'boulder') {
          if (e.x < this.camX + this.VW - 20) e.roll = true;
          if (e.roll) {
            e.vx = -72; e.x += e.vx * dt;
            if (this.groundAt(e.x) || e.y < GY) { e.vy += G * dt; e.y += e.vy * dt; if (e.y >= GY && this.groundAt(e.x)) { if (e.vy > 120) { this.shake = 0.1; this.dust(e.x, GY, 3); } e.y = GY; e.vy = e.vy > 120 ? -e.vy * 0.3 : 0; } }
            else { e.vy += G * dt; e.y += e.vy * dt; }
            e.rot = (e.rot || 0) - dt * 9;
          }
        }
      }
    }
    nearest(x) {
      let best = null, bd = 1e9;
      for (const p of this.parts) if (!p.dead && !p.gone) { const d = Math.abs(p.x - x); if (d < bd) { bd = d; best = p; } }
      return best;
    }
    killFoe(e, p, how) {
      e.alive = false;
      this.poof(e.x, e.y - 6, 10); this.sparkle(e.x, e.y - 6, '#fff3a0', 8);
      this.sfx('pop');
      if (p) { p.foes++; this.gain(p, how === 'stomp' ? 150 : 100, e.x, e.y - 18); }
      this.pfx.push({ k: 'corpse', foe: e.k, x: e.x, y: e.y, vx: (p ? p.face : 1) * 40, vy: -160, g: 600, life: 1.3, max: 1.3, rot: 0, vr: 8, dir: e.dir });
    }

    stepAxes(dt) {
      for (const a of this.axes) {
        a.vy += 400 * dt; a.x += a.vx * dt; a.y += a.vy * dt; a.rot += a.d * dt * 16;
        if (a.y >= GY - 3 && this.groundAt(a.x) && a.vy > 0) { a.dead = true; this.dust(a.x, GY, 2); }
        for (const q of this.L.plats) if (a.vy > 0 && a.x > q.x0 && a.x < q.x1 && Math.abs(a.y - q.y) < 4) a.dead = true;
        if (a.y > LH + 10 || a.x < this.camX - 20 || a.x > this.camX + this.VW + 20) a.dead = true;
        if (a.dead) continue;
        for (const o of this.L.rocks) if (Math.abs(a.x - o.x) < 9 && a.y > GY - 12) { a.dead = true; this.sfx('rim'); this.sparkle(a.x, a.y, '#ffffff', 5); }
        for (const e of this.L.foes) {
          if (!e.alive || !e.on || a.dead) continue;
          const [w, h] = FOE[e.k];
          if (Math.abs(a.x - e.x) < w / 2 + 4 && a.y > e.y - h - 4 && a.y < e.y + 4) {
            a.dead = true; e.hp--;
            if (e.hp <= 0) this.killFoe(e, a.p, 'axe'); else { this.sfx('bump'); this.sparkle(a.x, a.y, '#ffffff', 5); }
          }
        }
        const b = this.boss;
        if (b && b.st !== 'die' && b.st !== 'enter' && Math.abs(a.x - b.x) < 26 && a.y > b.y - 60 && a.y < b.y) { a.dead = true; this.hitBoss(a.p, a.x, a.y); }
        for (const s of this.shots) if (!s.dead && Math.hypot(s.x - a.x, s.y - a.y) < 7) { s.dead = true; a.dead = true; this.poof(s.x, s.y, 5); }
      }
      this.axes = this.axes.filter((a) => !a.dead);
    }

    stepShots(dt) {
      for (const s of this.shots) {
        s.vy += s.g * dt; s.x += s.vx * dt; s.y += s.vy * dt; s.life -= dt;
        if (s.g && s.y >= GY - 3 && this.groundAt(s.x)) { s.dead = true; this.poof(s.x, GY - 3, 5); for (let i = 0; i < 4; i++) this.pfx.push({ k: 'ember', x: s.x, y: GY - 3, vx: U.rand(-40, 40), vy: U.rand(-80, -20), g: 200, life: 0.6, max: 0.6 }); }
        if (s.life <= 0 || s.y > LH + 10) s.dead = true;
        if (Math.random() < dt * 30) this.pfx.push({ k: 'ember', x: s.x, y: s.y, vx: U.rand(-10, 10), vy: U.rand(-20, 0), g: 0, life: 0.35, max: 0.35 });
      }
      this.shots = this.shots.filter((s) => !s.dead);
      for (const w of this.waves) { w.x += w.d * 120 * dt; w.life -= dt; if (Math.random() < dt * 30) this.dust(w.x, GY, 1); }
      this.waves = this.waves.filter((w) => w.life > 0 && w.x > this.camX - 10 && w.x < this.camX + this.VW + 10);
    }

    collide() {
      const L = this.L;
      for (const p of this.parts) {
        if (p.dead > 0 || p.gone || !this.active(p)) continue;
        const px0 = p.x - 5, px1 = p.x + 5, py0 = p.y - 21, py1 = p.y;
        // φρούτα
        for (const f of L.fruits) {
          if (f.got) continue;
          if (Math.abs(f.x - p.x) < 10 && f.y > py0 - 6 && f.y < py1 + 4) {
            f.got = true; const F = FRUIT[f.k];
            p.en = Math.min(100, p.en + F.e); p.fruits++;
            this.gain(p, F.p, f.x, f.y - 8); this.sparkle(f.x, f.y, '#fff6a0', 7); this.sfx('star');
          }
        }
        // αυγά
        for (const e of L.eggs) {
          if (e.broken) continue;
          if (Math.abs(e.x - p.x) < 10 && e.y > py0 && e.y - 14 < py1) this.crack(e, p);
        }
        // πέτρες
        for (const o of L.rocks) {
          if (Math.abs(o.x - p.x) < 12 && p.y > GY - 10) {
            if (p.fairy > 0) continue;
            const side = p.x < o.x ? -1 : 1;
            if (p.skate) { this.hurt(p); }
            else if (p.trip <= 0 && p.inv <= 0) {
              p.trip = 0.7; p.en = Math.max(1, p.en - 18); this.sfx('bump'); this.floatText(p.x, p.y - 30, '−ενέργεια', '#ffb0a0');
              this.fx(p, '🪨 Σκόνταψες!', [40], false);
            }
            p.x = o.x + side * 12; p.vx = side * 40;
          }
        }
        // φωτιές
        for (const o of L.fires) if (Math.abs(o.x - p.x) < 9 && p.y > GY - 14) this.hurt(p);
        // εχθροί
        for (const e of L.foes) {
          if (!e.alive || !e.on) continue;
          const [w, h, stomp] = FOE[e.k];
          if (px1 > e.x - w / 2 && px0 < e.x + w / 2 && py1 > e.y - h && py0 < e.y) {
            if (p.fairy > 0) { this.killFoe(e, p, 'fairy'); continue; }
            if (stomp && p.vy > 40 && py1 - p.vy * 0.03 <= e.y - h + 4) { this.killFoe(e, p, 'stomp'); p.vy = -210; p.onG = false; continue; }
            this.hurt(p);
          }
        }
        for (const s of this.shots) if (!s.dead && Math.abs(s.x - p.x) < 7 && s.y > py0 && s.y < py1 + 2) { if (p.fairy <= 0) s.dead = true; this.hurt(p); }
        for (const w of this.waves) if (Math.abs(w.x - p.x) < 8 && p.y > GY - 6) this.hurt(p);
        const b = this.boss;
        if (b && b.st !== 'die' && b.st !== 'enter' && px1 > b.x - 22 && px0 < b.x + 22 && py1 > b.y - 58 && py0 < b.y) {
          if (p.vy > 40 && py1 - p.vy * 0.03 <= b.y - 52) { this.hitBoss(p, p.x, p.y); p.vy = -280; p.onG = false; }
          else if (p.fairy > 0) { if (!b.inv) this.hitBoss(p, p.x, p.y); }
          else this.hurt(p);
        }
      }
    }

    crack(e, p) {
      e.broken = this.time;
      this.sfx('pop');
      for (let i = 0; i < 6; i++) this.pfx.push({ k: 'shell', x: e.x, y: e.y - 7, vx: U.rand(-50, 50), vy: U.rand(-150, -60), g: 600, life: 0.9, max: 0.9, rot: U.rand(0, 6), vr: U.rand(-12, 12), bad: e.k === 'cloud' });
      this.gain(p, 50);
      const k = e.k;
      if (k === 'axe') { p.axe = true; this.sfx('pwr'); }
      else if (k === 'skate') { p.skate = true; this.sfx('pwr'); }
      else if (k === 'fairy') { p.fairy = 10; this.sfx('win'); }
      else if (k === 'basket') { p.en = 100; this.gain(p, 300); this.sfx('point'); }
      else if (k === 'cloud') { p.cloud = 8; this.sfx('buzz'); }
      this.floatText(e.x, e.y - 30, ITEM[k], k === 'cloud' ? '#c8d0ff' : '#fff6a0');
      this.fx(p, ITEM[k], k === 'cloud' ? [200] : [30, 30, 30], false);
      this.sparkle(e.x, e.y - 8, k === 'cloud' ? '#9aa8c0' : '#fff6a0', 12);
      this.changed();
    }

    // ---------- αφεντικό ----------
    startBoss() {
      this.bossOn = true;
      const hp = Math.round(18 * this.hpMul);
      this.boss = { x: this.L.arena + 300, y: -60, vx: 0, vy: 0, hp, max: hp, st: 'enter', t: 0, face: -1, flash: 0, n: 0, mouth: 0 };
      this.banner('ΑΦΕΝΤΙΚΟ: Ο Γέρο-Τίκι! ⚠', '#ff9a6a');
      this.sfx('buzz');
    }
    stepBoss(dt) {
      const b = this.boss, L = this.L;
      b.t += dt; b.flash = Math.max(0, b.flash - dt * 3); b.mouth = Math.max(0, b.mouth - dt * 2);
      const tgt = this.nearest(b.x); if (tgt && b.st !== 'air') b.face = Math.sign(tgt.x - b.x) || b.face;
      const rage = 1 - b.hp / b.max;
      // αυγά που πέφτουν από ψηλά στην αρένα
      this.dropT -= dt;
      if (this.dropT <= 0 && b.st !== 'die') {
        this.dropT = 6.5 - rage * 2;
        const ex = L.arena + U.rand(30, 354);
        L.eggs.push({ x: ex, y: -10, vy: 0, k: Math.random() < 0.7 ? 'axe' : 'basket', broken: 0, fall: true });
      }
      if (b.st === 'enter') {
        b.vy += G * dt; b.y += b.vy * dt;
        if (b.y >= GY) { b.y = GY; b.vy = 0; b.st = 'idle'; b.t = 0; this.shake = 0.6; this.sfx('boom'); this.dust(b.x - 18, GY, 6); this.dust(b.x + 18, GY, 6); }
        return;
      }
      if (b.st === 'die') {
        if (Math.random() < dt * 14) { this.poof(b.x + U.rand(-24, 24), b.y - U.rand(0, 60), 6); this.sparkle(b.x + U.rand(-24, 24), b.y - U.rand(0, 60), '#ffd040', 6); }
        if (Math.random() < dt * 5) this.sfx('boom');
        b.y += dt * 12;
        return;
      }
      if (b.st === 'idle') {
        if (b.t > 1.1 - rage * 0.5) {
          b.n++; b.t = 0;
          const mv = b.n % 4;
          if (mv === 1 || mv === 3) {
            const tx = U.clamp((tgt ? tgt.x : b.x) + U.rand(-30, 30), L.arena + 40, L.arena + 344);
            b.st = 'air'; b.kind = 'hop'; b.vy = -300; b.vx = (tx - b.x) / 0.9;
          } else if (mv === 2) { b.st = 'spit'; b.shots = 3 + Math.round(rage * 2); }
          else { b.st = 'air'; b.kind = 'quake'; b.vy = -380; b.vx = 0; }
        }
      } else if (b.st === 'air') {
        b.vy += G * dt; b.x += b.vx * dt; b.y += b.vy * dt;
        b.x = U.clamp(b.x, L.arena + 30, L.arena + 354);
        if (b.y >= GY && b.vy > 0) {
          b.y = GY; b.vy = 0; b.vx = 0; b.st = 'idle'; b.t = 0;
          this.shake = b.kind === 'quake' ? 0.6 : 0.3; this.sfx('boom'); this.dust(b.x - 20, GY, 5); this.dust(b.x + 20, GY, 5);
          if (b.kind === 'quake' || rage > 0.5) { this.waves.push({ x: b.x - 24, d: -1, life: 4 }, { x: b.x + 24, d: 1, life: 4 }); }
        }
      } else if (b.st === 'spit') {
        if (b.t > 0.35) {
          b.t = 0; b.shots--; b.mouth = 1;
          const al = this.parts.filter((p) => !p.dead && !p.gone);
          const p = al.length ? U.pick(al) : null;
          const tx = p ? p.x + U.rand(-16, 16) : b.x - 80, T = 1.0;
          this.shots.push({ x: b.x + b.face * 10, y: b.y - 26, vx: (tx - b.x) / T, vy: -170, g: (2 * (GY - (b.y - 26) + 170 * T)) / (T * T), life: 3 });
          this.sfx('zap');
          if (b.shots <= 0) { b.st = 'idle'; b.t = 0; }
        }
      }
      // τα αυγά που πέφτουν
      for (const e of L.eggs) if (e.fall) { e.vy += G * 0.5 * dt; e.y += e.vy * dt; if (e.y >= GY) { e.y = GY; e.fall = false; this.dust(e.x, GY, 3); } }
    }
    hitBoss(p, X, Y) {
      const b = this.boss;
      if (!b || b.st === 'die') return;
      b.hp--; b.flash = 1; this.sfx('bump'); this.sparkle(X, Y, '#ffd040', 8);
      if (p) this.gain(p, 50, X, Y - 10);
      if (b.hp <= 0) {
        b.st = 'die'; b.t = 0; this.shots = []; this.waves = [];
        if (p) this.gain(p, 2000, b.x, b.y - 70, '+2000', '#ffd040');
        this.banner('Νικήσατε τον Γέρο-Τίκι! 🎉', '#ffe066');
        this.phase = 'won';
        this.after(2.6, () => this.finish(true));
      }
      this.changed();
    }

    clearArea() {
      this.phase = 'clear';
      this.sfx('finish');
      this.banner(`Μπράβο! Περάσατε ${AREAS[this.area - 1].name.toLowerCase()} ✔`, '#9dff8a');
      for (const p of this.parts) if (!p.dead && !p.gone) { const bonus = Math.round(p.en) * 5; this.gain(p, bonus, p.x, p.y - 34, `+${bonus} ενέργεια`, '#9dff8a'); }
      this.celebrate('#ffe066');
      this.changed();
      this.after(3.6, () => { if (!this.running) return; this.area++; this.startArea(); });
    }

    finish(won) {
      this.phase = 'end';
      this.parts.forEach((p) => { p.mv = 0; });
      const rank = [...this.parts].sort((a, b) => b.score - a.score || b.fruits - a.fruits);
      const mvp = rank[0]; mvp.hi = true;
      if (won) this.team += this.lives * 300;
      this.celebrate(won ? mvp.color.hex : '#ff9a6a');
      this.sfx(won ? 'win' : 'miss');
      this.changed();
      this.h.onOver && this.h.onOver({
        winner: mvp,
        title: won ? 'Η ομάδα τερμάτισε! Πρώτος σε πόντους' : 'Πρώτος της ομάδας',
        icon: won ? '🏆' : '🌴',
        stats: won ? `Ομάδα: ${this.team} πόντοι · πέρασε και τις ${AREAS.length} περιοχές με ${this.lives} ❤`
          : `Ομάδα: ${this.team} πόντοι · έφτασε στην περιοχή ${this.area}/${AREAS.length}`,
        rank: rank.map((q) => ({ name: q.name, color: q.color, st: `${q.score} πόντοι · ${q.fruits} ${q.fruits === 1 ? 'φρούτο' : 'φρούτα'} · ${q.foes} ${q.foes === 1 ? 'εχθρός' : 'εχθροί'}` })),
      });
    }

    ctrl(part) {
      const base = { mode: 'plat', scoreText: `❤ ${this.lives} · ${part.score} πόντοι`, shoot: part.axe ? 'ΡΙΞΕ 🪓' : 'ΧΩΡΙΣ 🪓', shootOff: !part.axe, jump: 'ΠΗΔΑ', extra: 'ΤΡΕΞΕ 💨' };
      if (this.phase === 'go' && part.dead > 0) return { ...base, active: false, label: '💫 Ωχ!', sub: 'Ξαναβγαίνεις σε λίγο' };
      if (this.phase === 'go' || this.phase === 'clear' || this.phase === 'won') return { ...base, active: true, label: '', sub: part.axe ? '' : 'Σπάσε αυγά για να βρεις τσεκούρι' };
      return { ...base, active: false, label: this.phase === 'count' ? `Περιοχή ${this.area} · Ετοιμάσου!` : this.phase === 'lost' ? '💔 Τέλος' : 'Μπράβο!', sub: '◀ ▶ κίνηση · ΠΗΔΑ · ΡΙΞΕ τσεκούρι · κράτα ΤΡΕΞΕ για ταχύτητα' };
    }

    // ---------- σχεδίαση ----------
    world() {
      const x = this.ctx, d = this.dpr, s = this.s;
      const k = this.shake > 0 ? this.shake * 4 : 0;
      const jx = k ? U.rand(-k, k) : 0, jy = k ? U.rand(-k, k) : 0;
      x.setTransform(d * s, 0, 0, d * s, d * s * (-this.camX + jx), d * s * jy);
    }
    screen() { this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0); }

    draw() {
      if (!this.L) return;
      const x = this.ctx, a = this.area - 1, T = LAYERS[a];
      this.screen();
      // φόντο με parallax
      for (const [name, f] of [['sky', 0.04], ['far', 0.2], ['mid', 0.5], ['near', 0.8]]) {
        const img = this.layer(a, name), w = TW * this.s;
        let off = -((this.camX * f * this.s) % w);
        for (let X = off; X < this.W; X += w) x.drawImage(img, X, 0, w, this.H);
      }
      this.world();
      const c0 = this.camX - 30, c1 = this.camX + this.VW + 30, t = this.time;
      // λάκκοι: νερό / λάβα / σκοτάδι
      if (T.water || T.lava) {
        const wy = GY + 12;
        x.fillStyle = lin(x, 0, wy, 0, LH, [[0, T.pit[0]], [1, T.pit[1]]]); x.fillRect(c0, wy, c1 - c0, LH - wy + 2);
        x.strokeStyle = T.water ? 'rgba(255,255,255,.85)' : 'rgba(255,240,150,.9)'; x.lineWidth = 1.2;
        x.beginPath(); for (let X = Math.floor(c0 / 8) * 8; X < c1; X += 8) { const y = wy + Math.sin(X * 0.2 + t * 3) * 1.2; X === Math.floor(c0 / 8) * 8 ? x.moveTo(X, y) : x.lineTo(X, y); } x.stroke();
        if (T.lava) { x.globalCompositeOperation = 'lighter'; x.fillStyle = 'rgba(255,120,30,.25)'; x.fillRect(c0, wy - 14, c1 - c0, 14); x.globalCompositeOperation = 'source-over'; }
      } else {
        x.fillStyle = lin(x, 0, GY, 0, LH, [[0, T.pit[0]], [1, T.pit[1]]]); x.fillRect(c0, GY + 4, c1 - c0, LH - GY);
      }
      // έδαφος
      const gimg = this.layer(a, 'ground');
      for (const s of this.L.segs) {
        if (s.x1 < c0 || s.x0 > c1) continue;
        const x0 = Math.max(s.x0, c0 - 10), x1 = Math.min(s.x1, c1 + 10);
        x.save(); rrp(x, s.x0, GY, s.x1 - s.x0, LH - GY + 10, 3); x.clip();
        for (let k = Math.floor(x0 / GT) * GT; k < x1; k += GT) x.drawImage(gimg, k, GY, GT + 0.3, 32);
        x.fillStyle = lin(x, s.x0, 0, s.x0 + 6, 0, [[0, 'rgba(0,0,0,.45)'], [1, 'rgba(0,0,0,0)']]); x.fillRect(s.x0, GY, 6, 40);
        x.fillStyle = lin(x, s.x1 - 6, 0, s.x1, 0, [[0, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,.45)']]); x.fillRect(s.x1 - 6, GY, 6, 40);
        x.restore();
        rrp(x, s.x0, GY, s.x1 - s.x0, LH - GY + 10, 3); stroke(x, 1.1);
      }
      // πλατφόρμες
      for (const q of this.L.plats) {
        if (q.x1 < c0 || q.x0 > c1) continue;
        const w = q.x1 - q.x0;
        x.fillStyle = 'rgba(0,0,0,.18)'; ell(x, (q.x0 + q.x1) / 2, q.y + 16, w * 0.4, 2.5); x.fill();
        x.save(); rrp(x, q.x0, q.y, w, 12, 4); x.clip();
        for (let k = Math.floor(q.x0 / GT) * GT; k < q.x1; k += GT) x.drawImage(gimg, k, q.y, GT + 0.3, 32);
        x.fillStyle = lin(x, 0, q.y + 6, 0, q.y + 12, [[0, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,.35)']]); x.fillRect(q.x0, q.y, w, 12);
        x.restore();
        rrp(x, q.x0, q.y, w, 12, 4); stroke(x, 1);
        if (a === 0) { x.strokeStyle = '#2a8a24'; x.lineWidth = 0.8; for (let k = q.x0 + 6; k < q.x1 - 4; k += 11) { x.beginPath(); x.moveTo(k, q.y + 11); x.quadraticCurveTo(k + 2, q.y + 15, k + 0.5, q.y + 18 + (k % 5)); x.stroke(); } }
      }
      // διακοσμητικά στο έδαφος
      for (const d of this.L.deco) if (d.x > c0 && d.x < c1) this.drawDeco(d);
      // τέρμα
      if (this.L.goal) this.drawGoal(this.L.goal);
      // φωτιές, πέτρες
      for (const o of this.L.fires) if (o.x > c0 && o.x < c1) this.drawFire(o.x, GY, o.t + t);
      for (const o of this.L.rocks) if (o.x > c0 && o.x < c1) this.put(this.sprite('rock', a + 1), o.x, GY - 5.5);
      // φρούτα
      for (const f of this.L.fruits) if (!f.got && f.x > c0 && f.x < c1) this.put(this.sprite(f.k), f.x, f.y + Math.sin(t * 3 + f.t) * 1.2);
      // αυγά
      for (const e of this.L.eggs) {
        if (e.x < c0 || e.x > c1) continue;
        if (!e.broken) { const w = Math.sin(t * 4 + e.x) * 0.06; this.shadow(e.x, e.y, 5); this.put(this.sprite('egg', e.k === 'cloud' ? 1 : 0), e.x, e.y - 7.4, w); }
        else { const k = t - e.broken; if (k < 1) { x.globalAlpha = 1 - Math.max(0, k - 0.6) / 0.4; this.drawItem(e.k, e.x, e.y - 12 - k * 22, 1 + k * 0.3); x.globalAlpha = 1; } }
      }
      // εχθροί
      for (const e of this.L.foes) if (e.alive && e.on && e.x > c0 && e.x < c1) { if (e.k !== 'bee') this.shadow(e.x, e.y, 6); this.drawFoe(e.k, e.x, e.y, e.dir, e.t, e); }
      if (this.boss) this.drawBoss(this.boss);
      // κύματα σοκ
      for (const w of this.waves) {
        x.globalCompositeOperation = 'lighter';
        const g = x.createRadialGradient(w.x, GY, 0, w.x, GY, 12); g.addColorStop(0, 'rgba(255,200,90,.9)'); g.addColorStop(1, 'rgba(255,90,20,0)');
        x.fillStyle = g; ell(x, w.x, GY - 2, 12, 7); x.fill(); x.globalCompositeOperation = 'source-over';
        x.fillStyle = '#6a4a3a'; for (let i = -1; i <= 1; i++) { x.beginPath(); x.moveTo(w.x + i * 4 - 2, GY); x.lineTo(w.x + i * 4, GY - 6 - Math.abs(Math.sin(t * 20 + i)) * 3); x.lineTo(w.x + i * 4 + 2, GY); x.fill(); }
      }
      // παίκτες
      for (const p of this.parts) {
        if (p.gone || (!this.active(p) && !p.dead)) continue;
        if (!p.dead) { const sy = this.below(p.x, p.y); if (sy !== null) this.shadow(p.x, sy, 6 * Math.max(0.4, 1 - (sy - p.y) / 70)); }
        if (p.inv > 0 && !p.dead && Math.floor(t * 14) % 2) x.globalAlpha = 0.45;
        this.drawHero(p);
        x.globalAlpha = 1;
      }
      // τσεκούρια, βολές
      for (const ax of this.axes) this.put(this.sprite('axe'), ax.x, ax.y, ax.rot);
      for (const s of this.shots) this.drawFireball(s.x, s.y);
      // σωματίδια
      this.drawFx();
      // κείμενα και HUD
      this.screen();
      for (const f of this.floats) {
        const X = (f.x - this.camX) * this.s, Y = f.y * this.s;
        x.globalAlpha = f.t > 1 ? Math.max(0, 1 - (f.t - 1) / 0.4) : 1;
        this.text(f.txt, X, Y, this.vh * 3.2, f.col);
        x.globalAlpha = 1;
      }
      this.drawHud();
      if (this.phase === 'count') this.drawCount(this.countT, 'ΠΑΜΕ!');
    }

    shadow(X, Y, r) { const x = this.ctx; x.fillStyle = 'rgba(30,20,10,.28)'; ell(x, X, Y + 0.5, r, r * 0.28); x.fill(); }

    drawFx() {
      const x = this.ctx;
      for (const q of this.pfx) {
        const k = q.life / q.max;
        if (q.k === 'dust' || q.k === 'smoke') {
          x.globalAlpha = k * (q.k === 'smoke' ? 0.7 : 0.55); x.fillStyle = q.k === 'smoke' ? '#ffffff' : (this.area === 3 ? '#7a6a68' : '#e9d6b0');
          circ(x, q.x, q.y, q.r * (1.6 - k * 0.6)); x.fill();
        } else if (q.k === 'spark') {
          x.globalCompositeOperation = 'lighter'; x.globalAlpha = k; x.fillStyle = q.c;
          U.starPath(x, q.x, q.y, 2.2 * k + 0.6); x.fill(); x.globalCompositeOperation = 'source-over';
        } else if (q.k === 'ember') {
          x.globalCompositeOperation = 'lighter'; x.globalAlpha = Math.min(1, k * 1.5); x.fillStyle = k > 0.5 ? '#ffd060' : '#ff6a20';
          circ(x, q.x, q.y, 0.8); x.fill(); x.globalCompositeOperation = 'source-over';
        } else if (q.k === 'leaf') {
          if (q.y > GY) { q.life = 0; continue; }
          q.vx = -8 + Math.sin(this.time * 2 + q.max * 7) * 12;
          x.globalAlpha = Math.min(1, k * 3); x.save(); x.translate(q.x, q.y); x.rotate(q.rot);
          x.fillStyle = q.c; ell(x, 0, 0, 2.6, 1.2); x.fill(); stroke(x, 0.4, '#2a5a14'); x.restore();
        } else if (q.k === 'shell') {
          x.globalAlpha = Math.min(1, k * 2); x.save(); x.translate(q.x, q.y); x.rotate(q.rot);
          x.beginPath(); x.moveTo(-3, 0); x.lineTo(-1.5, -2.5); x.lineTo(0, -0.5); x.lineTo(1.5, -2.6); x.lineTo(3, 0); x.quadraticCurveTo(0, 3, -3, 0);
          x.fillStyle = '#f4efe6'; x.fill(); stroke(x, 0.5); x.fillStyle = q.bad ? '#e5352c' : '#53b4f0'; circ(x, 0, 0.6, 0.7); x.fill(); x.restore();
        } else if (q.k === 'board') {
          x.globalAlpha = Math.min(1, k * 2); x.save(); x.translate(q.x, q.y); x.rotate(q.rot); this.drawBoard(0, 0); x.restore();
        } else if (q.k === 'corpse') {
          x.globalAlpha = Math.min(1, k * 2); x.save(); x.translate(q.x, q.y); x.rotate(q.rot); x.translate(-q.x, -q.y);
          this.drawFoe(q.foe, q.x, q.y, q.dir, 0, { dead: true }); x.restore();
        }
        x.globalAlpha = 1;
      }
    }

    drawDeco(d) {
      const x = this.ctx, X = d.x, a = this.area;
      if (a === 1) {
        if (d.k === 0) { flower(x, X, GY - 7, '#ff7ab8'); flower(x, X + 5, GY - 5, '#fff36a'); }
        else if (d.k === 1) { // μανιτάρι
          x.fillStyle = '#fff4e0'; rrp(x, X - 1.4, GY - 5, 2.8, 5, 1); x.fill(); stroke(x, 0.6);
          x.beginPath(); x.ellipse(X, GY - 5, 5, 3.6, 0, Math.PI, 0); x.closePath(); x.fillStyle = rad(x, X, GY - 6, 5, [[0, '#ff8a7a'], [1, '#c41a1a']]); x.fill(); stroke(x, 0.7);
          x.fillStyle = '#fff'; circ(x, X - 2, GY - 6.5, 0.8); x.fill(); circ(x, X + 1.6, GY - 7, 0.7); x.fill();
        } else { x.strokeStyle = '#2f9a2a'; x.lineWidth = 1.1; for (let i = -3; i <= 3; i++) { x.beginPath(); x.moveTo(X, GY); x.quadraticCurveTo(X + i * 2, GY - 6, X + i * 3.4, GY - 9 + Math.abs(i)); x.stroke(); } }
      } else if (a === 2) {
        if (d.k === 0) { // αστερίας
          U.starPath(x, X, GY - 2.5, 3.6, 0.45); x.fillStyle = '#ff8a4a'; x.fill(); stroke(x, 0.6);
        } else { x.beginPath(); x.ellipse(X, GY - 1, 3.4, 2.6, 0, Math.PI, 0); x.closePath(); x.fillStyle = '#ffe6f0'; x.fill(); stroke(x, 0.6); x.strokeStyle = 'rgba(200,120,150,.8)'; x.lineWidth = 0.4; for (let i = -2; i <= 2; i++) { x.beginPath(); x.moveTo(X, GY - 1); x.lineTo(X + i * 1.4, GY - 3.4); x.stroke(); } }
      } else {
        x.globalCompositeOperation = 'lighter'; const g = x.createRadialGradient(X, GY - 3, 0, X, GY - 3, 8); g.addColorStop(0, 'rgba(120,200,255,.5)'); g.addColorStop(1, 'rgba(120,200,255,0)'); x.fillStyle = g; x.fillRect(X - 8, GY - 11, 16, 16); x.globalCompositeOperation = 'source-over';
        x.fillStyle = '#7ad0ff'; x.beginPath(); x.moveTo(X - 2, GY); x.lineTo(X - 1, GY - 7); x.lineTo(X + 1, GY - 5); x.lineTo(X + 2, GY); x.fill(); stroke(x, 0.5, '#1a3a5a');
      }
    }

    drawGoal(X) {
      const x = this.ctx, t = this.time;
      x.fillStyle = lin(x, X - 2, 0, X + 2, 0, [[0, '#7a4a20'], [0.5, '#d8a060'], [1, '#6a3a14']]);
      rrp(x, X - 2, GY - 78, 4, 78, 1.5); x.fill(); stroke(x, 0.9);
      // σημαία που κυματίζει
      x.beginPath(); x.moveTo(X + 2, GY - 76);
      for (let i = 0; i <= 10; i++) x.lineTo(X + 2 + i * 3.4, GY - 76 + Math.sin(t * 6 + i * 0.7) * 2 * (i / 10));
      for (let i = 10; i >= 0; i--) x.lineTo(X + 2 + i * 3.4, GY - 56 + Math.sin(t * 6 + i * 0.7) * 2 * (i / 10));
      x.closePath(); x.save(); x.clip();
      for (let i = 0; i < 9; i++) for (let j = 0; j < 4; j++) { x.fillStyle = (i + j) % 2 ? '#ffffff' : '#1c1a2b'; x.fillRect(X + 2 + i * 4, GY - 78 + j * 5.5, 4, 5.5); }
      x.restore(); x.beginPath(); x.moveTo(X + 2, GY - 76);
      for (let i = 0; i <= 10; i++) x.lineTo(X + 2 + i * 3.4, GY - 76 + Math.sin(t * 6 + i * 0.7) * 2 * (i / 10));
      for (let i = 10; i >= 0; i--) x.lineTo(X + 2 + i * 3.4, GY - 56 + Math.sin(t * 6 + i * 0.7) * 2 * (i / 10));
      x.closePath(); stroke(x, 0.8);
      x.fillStyle = '#ffd040'; circ(x, X, GY - 80, 2.6); x.fill(); stroke(x, 0.7);
      // ταμπέλα
      rrp(x, X - 16, GY - 40, 32, 12, 2); x.fillStyle = lin(x, 0, GY - 40, 0, GY - 28, [[0, '#f0c070'], [1, '#b07a3a']]); x.fill(); stroke(x, 0.9);
      x.fillStyle = '#4a2a10'; x.font = '800 7px "Noto Sans", sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('ΤΕΡΜΑ', X, GY - 33.6);
    }

    drawFire(X, Y, t) {
      const x = this.ctx;
      x.fillStyle = '#6a3a18'; x.save(); x.translate(X, Y - 2);
      for (const r of [-0.35, 0.35]) { x.save(); x.rotate(r); rrp(x, -8, -1.6, 16, 3.2, 1.5); x.fill(); stroke(x, 0.7); x.restore(); }
      x.restore();
      x.globalCompositeOperation = 'lighter';
      const g = x.createRadialGradient(X, Y - 8, 0, X, Y - 8, 22); g.addColorStop(0, 'rgba(255,170,60,.55)'); g.addColorStop(1, 'rgba(255,90,20,0)');
      x.fillStyle = g; x.fillRect(X - 22, Y - 30, 44, 44);
      x.globalCompositeOperation = 'source-over';
      for (const [w, h, c0, c1, ph] of [[7, 17, '#ff5a1a', '#c41a0a', 0], [5, 12, '#ffb020', '#ff5a1a', 1.7], [3, 7, '#fff8b0', '#ffd040', 3.1]]) {
        const fl = Math.sin(t * 11 + ph) * 1.4, fh = h + Math.sin(t * 7 + ph) * 2;
        x.beginPath(); x.moveTo(X - w, Y - 2); x.quadraticCurveTo(X - w * 1.1, Y - fh * 0.5, X + fl, Y - fh);
        x.quadraticCurveTo(X + w * 1.1, Y - fh * 0.5, X + w, Y - 2); x.closePath();
        x.fillStyle = lin(x, 0, Y - fh, 0, Y, [[0, c0], [1, c1]]); x.fill();
        if (w === 7) stroke(x, 0.7, '#7a1a08');
      }
      if (Math.random() < 0.15) this.pfx.push({ k: 'ember', x: X + U.rand(-4, 4), y: Y - 10, vx: U.rand(-8, 8), vy: U.rand(-40, -20), g: 0, life: 0.8, max: 0.8 });
    }

    drawFireball(X, Y) {
      const x = this.ctx;
      x.globalCompositeOperation = 'lighter';
      const g = x.createRadialGradient(X, Y, 0, X, Y, 9); g.addColorStop(0, 'rgba(255,255,200,1)'); g.addColorStop(0.3, 'rgba(255,170,40,.9)'); g.addColorStop(1, 'rgba(255,60,10,0)');
      x.fillStyle = g; x.fillRect(X - 9, Y - 9, 18, 18);
      x.globalCompositeOperation = 'source-over';
    }

    drawBoard(X, Y) {
      const x = this.ctx;
      rrp(x, X - 9, Y - 1.8, 18, 2.6, 1.3); x.fillStyle = lin(x, 0, Y - 2, 0, Y + 1, [[0, '#ff9a4a'], [1, '#c43a1a']]); x.fill(); stroke(x, 0.7);
      x.fillStyle = '#ffe066'; x.fillRect(X - 4, Y - 1.4, 8, 0.8);
      for (const s of [-5.5, 5.5]) { circ(x, X + s, Y + 1.8, 1.7); x.fillStyle = '#3a3a48'; x.fill(); stroke(x, 0.5); x.fillStyle = '#c8c8d8'; circ(x, X + s, Y + 1.8, 0.6); x.fill(); }
    }

    drawItem(k, X, Y, sc) {
      const x = this.ctx;
      if (k === 'axe') { this.put(this.sprite('axe'), X, Y, 0, sc * 1.3); return; }
      x.save(); x.translate(X, Y); x.scale(sc, sc);
      if (k === 'skate') this.drawBoard(0, 0);
      else if (k === 'fairy') this.drawFairy(0, 0);
      else if (k === 'basket') {
        x.beginPath(); x.moveTo(-7, -2); x.lineTo(7, -2); x.lineTo(5, 5); x.lineTo(-5, 5); x.closePath(); x.fillStyle = '#c88a4a'; x.fill(); stroke(x, 0.7);
        this.put(this.sprite('apple'), -3, -4, 0, 0.6); this.put(this.sprite('banana'), 3, -4, 0, 0.6);
      } else if (k === 'cloud') this.drawCloud(0, 0);
      x.restore();
    }

    drawFairy(X, Y) {
      const x = this.ctx, t = this.time;
      x.globalCompositeOperation = 'lighter';
      const g = x.createRadialGradient(X, Y, 0, X, Y, 10); g.addColorStop(0, 'rgba(255,220,255,.9)'); g.addColorStop(1, 'rgba(255,120,220,0)');
      x.fillStyle = g; x.fillRect(X - 10, Y - 10, 20, 20); x.globalCompositeOperation = 'source-over';
      const fl = Math.sin(t * 30) * 0.4;
      x.fillStyle = 'rgba(220,240,255,.75)';
      for (const s of [-1, 1]) { ell(x, X + s * 3, Y - 2, 3, 1.6, s * (0.6 + fl)); x.fill(); stroke(x, 0.4, '#8ab'); }
      x.beginPath(); x.moveTo(X, Y - 1.5); x.lineTo(X + 2.4, Y + 3.5); x.lineTo(X - 2.4, Y + 3.5); x.closePath(); x.fillStyle = '#ff7ad0'; x.fill(); stroke(x, 0.5);
      circ(x, X, Y - 3, 1.8); x.fillStyle = '#ffe0c8'; x.fill(); stroke(x, 0.5);
      x.fillStyle = '#ffd040'; circ(x, X, Y - 4.4, 1.2); x.fill();
    }

    drawCloud(X, Y) {
      const x = this.ctx;
      blobs(x, [[X - 5, Y, 4], [X, Y - 2.5, 5], [X + 5, Y, 4]], { out: '#3a3a52', base: '#6a6e88', mid: '#8a8ea8' }, 0.7);
      x.strokeStyle = '#7ab0ff'; x.lineWidth = 0.7;
      for (let i = -2; i <= 2; i++) { const o = (this.time * 40 + i * 7) % 10; x.beginPath(); x.moveTo(X + i * 3, Y + 4 + o); x.lineTo(X + i * 3 - 0.6, Y + 6 + o); x.stroke(); }
    }

    drawHero(p) {
      const x = this.ctx, c = p.color.hex, f = p.face || 1, t = this.time;
      const run = p.onG && Math.abs(p.vx) > 8 && !p.skate && p.trip <= 0;
      const sw = run ? Math.sin(p.ph) : 0, air = !p.onG && !p.dead;
      const lift = p.skate ? 4.2 : 0, bob = run ? Math.abs(Math.cos(p.ph)) * 1.1 : 0;
      const cheer = this.phase === 'clear' || this.phase === 'won';
      if (p.fairy > 0) {
        x.globalCompositeOperation = 'lighter';
        const g = x.createRadialGradient(p.x, p.y - 12, 0, p.x, p.y - 12, 22); g.addColorStop(0, 'rgba(255,200,255,.5)'); g.addColorStop(1, 'rgba(255,120,220,0)');
        x.fillStyle = g; x.fillRect(p.x - 22, p.y - 34, 44, 44); x.globalCompositeOperation = 'source-over';
      }
      if (p.skate && !p.dead) this.drawBoard(p.x, p.y - 2.2);
      x.save(); x.translate(p.x, p.y - lift - bob);
      if (p.dead) { x.translate(0, -12); x.rotate(p.rot); x.translate(0, 12); }
      if (p.trip > 0) { x.translate(0, 0); x.rotate(-f * 0.5); }
      x.scale(f, 1);
      const skin = '#ffd3a8', skinD = '#e8956a';
      const leg = (ang, back) => {
        x.save(); x.translate(back ? -1.4 : 1.4, -8.5); x.rotate(ang);
        rrp(x, -1.8, 0, 3.6, 6.8, 1.6); x.fillStyle = back ? '#eab48c' : skin; x.fill(); stroke(x, 0.8);
        ell(x, 1.1, 7.2, 2.9, 1.7); x.fillStyle = back ? '#6a3618' : '#8a4a22'; x.fill(); stroke(x, 0.8);
        x.restore();
      };
      const arm = (ang, back, axe) => {
        x.save(); x.translate(back ? -1 : 0.8, -14.5); x.rotate(ang);
        rrp(x, -1.4, 0, 2.8, 6.4, 1.4); x.fillStyle = back ? '#eab48c' : skin; x.fill(); stroke(x, 0.8);
        circ(x, 0, 6.8, 1.7); x.fill(); stroke(x, 0.7);
        if (axe) { x.translate(0, 6.8); x.rotate(-1.2); x.translate(4, -1); x.drawImage(this.sprite('axe'), -4.5, -4.5, 9, 9); }
        x.restore();
      };
      let lb = 0, lf = 0, ab = 0, af = 0;
      if (run) { lb = -sw * 0.85; lf = sw * 0.85; ab = sw * 0.9; af = -sw * 0.9; }
      else if (air) { lb = 0.7; lf = -1.0; ab = -2.4; af = -0.4; }
      else if (p.skate) { lb = -0.4; lf = 0.35; ab = 0.9; af = -1.2; }
      if (cheer && !p.dead) { ab = -2.8 + Math.sin(t * 10) * 0.2; af = -2.6 - Math.sin(t * 10) * 0.2; }
      if (p.throwT > 0.1) af = -2.2 + (0.28 - p.throwT) * 14;
      leg(lb, true); arm(ab, true, false); leg(lf, false);
      // σώμα (χιτώνας με το χρώμα του παίκτη)
      x.beginPath(); x.moveTo(-4.6, -14.5); x.quadraticCurveTo(0, -17, 4.6, -14.5); x.lineTo(5.4, -7.2);
      for (let i = 5.4; i > -5.4; i -= 2.7) x.lineTo(i - 1.35, -5.6 + (i % 2 ? 0.6 : 0)), x.lineTo(i - 2.7, -7.2);
      x.closePath(); x.fillStyle = lin(x, -5, -16, 5, -6, [[0, sh(c, 0.45)], [0.5, c], [1, sh(c, -0.4)]]); x.fill(); stroke(x, 0.85);
      x.strokeStyle = '#6a3a14'; x.lineWidth = 1.1; x.beginPath(); x.moveTo(-4.4, -13.5); x.lineTo(3.8, -8); x.stroke();
      // κεφάλι
      const hx = 1.2, hy = -21;
      x.beginPath(); x.moveTo(hx - 7, hy - 1); // μαλλιά πίσω
      for (let i = 0; i < 5; i++) { const a = Math.PI * (0.75 + i * 0.16); x.lineTo(hx + Math.cos(a) * 10.2, hy + Math.sin(a) * 9.8 - 0.5); x.lineTo(hx + Math.cos(a + 0.08) * 6.5, hy + Math.sin(a + 0.08) * 6.5); }
      x.closePath(); x.fillStyle = '#5b2d12'; x.fill(); stroke(x, 0.8);
      circ(x, hx, hy, 7.4); x.fillStyle = rad(x, hx, hy, 7.6, [[0, '#ffe6cc'], [0.6, skin], [1, skinD]], 0.25, -0.35); x.fill(); stroke(x, 0.9);
      circ(x, hx - 2.4, hy + 0.8, 1.8); x.fillStyle = skin; x.fill(); stroke(x, 0.7); x.fillStyle = skinD; circ(x, hx - 2.4, hy + 0.8, 0.7); x.fill();
      x.beginPath(); x.moveTo(hx - 6.6, hy - 3); // φράντζα
      x.quadraticCurveTo(hx - 4, hy - 9.5, hx + 3, hy - 8.4); x.quadraticCurveTo(hx + 7, hy - 7.2, hx + 7.6, hy - 3.6);
      x.lineTo(hx + 5.2, hy - 4.6); x.lineTo(hx + 4.4, hy - 2.8); x.lineTo(hx + 2.6, hy - 4.8); x.lineTo(hx + 1, hy - 3.2); x.lineTo(hx - 0.6, hy - 5); x.closePath();
      x.fillStyle = lin(x, 0, hy - 9, 0, hy - 3, [[0, '#8a4a22'], [1, '#5b2d12']]); x.fill(); stroke(x, 0.8);
      // κορδέλα με τις άκρες που ανεμίζουν
      x.beginPath(); x.moveTo(hx - 7.1, hy - 2.2); x.quadraticCurveTo(hx, hy - 5.6, hx + 7.3, hy - 3.2); x.lineTo(hx + 7.1, hy - 1.2); x.quadraticCurveTo(hx, hy - 3.4, hx - 7, hy);
      x.closePath(); x.fillStyle = lin(x, 0, hy - 5, 0, hy, [[0, sh(c, 0.4)], [1, sh(c, -0.2)]]); x.fill(); stroke(x, 0.7);
      const wv = Math.sin(t * 14 + p.x) * 1.5;
      for (const [dy, l] of [[-1, 7], [0.6, 6]]) { x.beginPath(); x.moveTo(hx - 6.8, hy - 1.2); x.quadraticCurveTo(hx - 10, hy + dy - 2 + wv, hx - 6.8 - l, hy + dy + wv * 0.6); x.lineTo(hx - 6.8 - l + 1, hy + dy + 1.4 + wv * 0.6); x.quadraticCurveTo(hx - 9.4, hy + dy + wv, hx - 6.6, hy + 0.2); x.closePath(); x.fillStyle = sh(c, -0.1); x.fill(); stroke(x, 0.6); }
      // πρόσωπο
      if (p.dead) {
        x.strokeStyle = OUT; x.lineWidth = 0.8;
        x.beginPath(); x.moveTo(hx + 2.6, hy - 1); x.lineTo(hx + 5, hy + 1.6); x.moveTo(hx + 5, hy - 1); x.lineTo(hx + 2.6, hy + 1.6); x.stroke();
        x.beginPath(); x.ellipse(hx + 4.6, hy + 4, 1.1, 1.4, 0, 0, TAU); x.fillStyle = '#7a1a1a'; x.fill();
      } else {
        ell(x, hx + 3.7, hy + 0.2, 1.9, 2.5); x.fillStyle = '#fff'; x.fill(); stroke(x, 0.55);
        ell(x, hx + 4.4, hy + 0.5, 1.15, 1.6); x.fillStyle = '#1b1020'; x.fill();
        x.fillStyle = '#fff'; circ(x, hx + 4.8, hy - 0.3, 0.5); x.fill();
        x.strokeStyle = '#5b2d12'; x.lineWidth = 0.7; x.beginPath(); x.moveTo(hx + 2.3, hy - 2.8); x.quadraticCurveTo(hx + 3.8, hy - 3.6, hx + 5.6, hy - 2.8); x.stroke();
        x.fillStyle = 'rgba(255,100,100,.4)'; ell(x, hx + 2.4, hy + 3.4, 1.7, 1); x.fill();
        if (air || cheer || p.trip > 0) { ell(x, hx + 4.8, hy + 4, 1.1, p.trip > 0 ? 0.6 : 1.4); x.fillStyle = '#8a1a1a'; x.fill(); stroke(x, 0.5); }
        else { x.strokeStyle = OUT; x.lineWidth = 0.7; x.beginPath(); x.arc(hx + 4.6, hy + 3, 1.6, 0.2 * Math.PI, 0.85 * Math.PI); x.stroke(); }
        x.strokeStyle = skinD; x.lineWidth = 0.6; x.beginPath(); x.arc(hx + 7.1, hy + 1.6, 0.9, -1.2, 1.2); x.stroke();
      }
      arm(af, false, p.axe && p.throwT <= 0.05 && !p.dead);
      x.restore();
      if (p.fairy > 0 && !p.dead) {
        const a = t * 4;
        this.drawFairy(p.x + Math.cos(a) * 15, p.y - 22 + Math.sin(a * 2) * 4);
        if (Math.random() < 0.4) this.pfx.push({ k: 'spark', x: p.x + U.rand(-8, 8), y: p.y - U.rand(0, 24), vx: 0, vy: -10, g: 0, life: 0.5, max: 0.5, c: '#ffb0f0' });
      }
      if (p.cloud > 0 && !p.dead) this.drawCloud(p.x, p.y - 38 + Math.sin(t * 3) * 1.2);
      if (p.trip > 0) for (let i = 0; i < 3; i++) { const a = t * 6 + i * 2.1; U.starPath(x, p.x + Math.cos(a) * 6, p.y - 27 + Math.sin(a) * 2, 1.8); x.fillStyle = '#ffe066'; x.fill(); stroke(x, 0.4); }
      // όνομα πάνω από το κεφάλι (μικρό)
      if (!p.dead) {
        x.font = '800 5.4px "Noto Sans", sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
        let nm = p.name; if (nm.length > 10) nm = nm.slice(0, 9) + '…';
        const idx = this.parts.indexOf(p);
        const close = this.parts.filter((q, j) => j < idx && !q.dead && !q.gone && Math.abs(q.x - p.x) < 24 && Math.abs(q.y - p.y) < 20).length;
        const ny = p.y - lift - 36 - close * 6.5;
        x.lineWidth = 1.6; x.strokeStyle = 'rgba(20,10,5,.85)'; x.strokeText(nm, p.x, ny); x.fillStyle = sh(c, 0.35); x.fillText(nm, p.x, ny);
      }
    }

    drawFoe(k, X, Y, dir, t, e) {
      const x = this.ctx, dead = e && e.dead;
      x.save(); x.translate(X, Y); x.scale(dir < 0 ? 1 : -1, 1); // σχεδιάζονται κοιτώντας αριστερά
      if (k === 'snail') {
        const st = Math.sin(t * 4) * 0.8;
        x.beginPath(); x.moveTo(-10 - st, 0); x.quadraticCurveTo(-11 - st, -6, -7 - st, -7); x.quadraticCurveTo(-4, -4, 0, -3); x.lineTo(9, -2); x.quadraticCurveTo(10, 0, 8, 0); x.closePath();
        x.fillStyle = lin(x, 0, -7, 0, 0, [[0, '#f0f79a'], [1, '#a8c23a']]); x.fill(); stroke(x, 0.8);
        x.strokeStyle = OUT; x.lineWidth = 0.7;
        for (const [ex, ey] of [[-10.5 - st, -12.5], [-7.5 - st, -13]]) { x.beginPath(); x.moveTo(-8.5 - st, -6.5); x.lineTo(ex, ey); x.stroke(); circ(x, ex, ey, 1.7); x.fillStyle = '#fff'; x.fill(); stroke(x, 0.5); circ(x, ex - 0.5, ey + 0.2, 0.8); x.fillStyle = '#111'; x.fill(); }
        x.strokeStyle = OUT; x.lineWidth = 0.6; x.beginPath(); x.arc(-9.5 - st, -3.5, 1.2, 0.2, 2.2); x.stroke();
        circ(x, 2.5, -7.5, 6.6); x.fillStyle = rad(x, 2.5, -7.5, 6.8, [[0, '#e4a8ff'], [0.5, '#9a3ad6'], [1, '#4a106e']]); x.fill(); stroke(x, 0.9);
        x.strokeStyle = 'rgba(255,230,255,.85)'; x.lineWidth = 0.9; x.beginPath();
        for (let i = 0; i < 26; i++) { const a = i * 0.42, r = 0.4 + i * 0.2; const px = 2.5 + Math.cos(a) * r, py = -7.5 + Math.sin(a) * r; i ? x.lineTo(px, py) : x.moveTo(px, py); } x.stroke();
      } else if (k === 'frog') {
        const air = e && e.vy && e.vy !== 0;
        if (air) { x.fillStyle = '#3aa832'; for (const s of [3, 6]) { x.beginPath(); x.moveTo(s - 1, -4); x.lineTo(s + 7, -1); x.lineTo(s + 8, 1); x.lineTo(s, -1); x.closePath(); x.fill(); stroke(x, 0.6); } }
        else { x.fillStyle = '#3aa832'; ell(x, 5, -2, 4.2, 2.4); x.fill(); stroke(x, 0.7); }
        ell(x, 0, -5, 7.2, 5); x.fillStyle = rad(x, 0, -5, 7.4, [[0, '#b8f57a'], [0.5, '#4fcf3a'], [1, '#1f7a1c']]); x.fill(); stroke(x, 0.85);
        ell(x, -1.5, -3, 4.2, 2.6); x.fillStyle = '#f4ffc8'; x.fill();
        for (const ex of [-4.5, 0.5]) { circ(x, ex, -10, 2.6); x.fillStyle = '#4fcf3a'; x.fill(); stroke(x, 0.7); circ(x, ex, -10.3, 1.7); x.fillStyle = '#fff'; x.fill(); circ(x, ex - 0.5, -10.2, 0.9); x.fillStyle = '#111'; x.fill(); }
        x.strokeStyle = OUT; x.lineWidth = 0.6; x.beginPath(); x.moveTo(-6.5, -5.5); x.quadraticCurveTo(-3, -3.8, 0, -5.4); x.stroke();
        x.fillStyle = '#2a8a24'; ell(x, -5, -0.6, 2.4, 1.2); x.fill(); stroke(x, 0.6);
      } else if (k === 'bee') {
        const fl = Math.sin(t * 40);
        x.fillStyle = 'rgba(230,245,255,.7)'; for (const s of [-1, 2]) { ell(x, s, -5 - fl, 2.6, 4.2, s * 0.4); x.fill(); stroke(x, 0.5, '#7a9ab0'); }
        ell(x, 1, 0, 6.2, 4.4); x.save(); x.clip();
        x.fillStyle = rad(x, 1, 0, 6.5, [[0, '#fff3a0'], [0.6, '#ffc81a'], [1, '#c48a0a']]); x.fillRect(-6, -5, 14, 10);
        x.fillStyle = '#2a1a10'; for (const b of [0.5, 4]) x.fillRect(b - 1, -5, 2, 10);
        x.restore(); ell(x, 1, 0, 6.2, 4.4); stroke(x, 0.8);
        x.beginPath(); x.moveTo(6.8, -0.8); x.lineTo(9.5, 0); x.lineTo(6.8, 0.8); x.fillStyle = '#2a1a10'; x.fill();
        circ(x, -5.5, -0.5, 3.2); x.fillStyle = '#2a1a10'; x.fill(); stroke(x, 0.6);
        circ(x, -6.4, -1, 1.2); x.fillStyle = '#fff'; x.fill(); circ(x, -6.8, -0.9, 0.6); x.fillStyle = '#111'; x.fill();
        x.strokeStyle = OUT; x.lineWidth = 0.5; x.beginPath(); x.moveTo(-6, -3.4); x.quadraticCurveTo(-8, -6, -9, -6.4); x.stroke();
      } else if (k === 'crab') {
        const st = Math.sin(t * 12) * 0.8;
        x.strokeStyle = '#a8280a'; x.lineWidth = 1.2;
        for (const s of [-1, 1]) for (let i = 0; i < 3; i++) { x.beginPath(); x.moveTo(s * 4, -3); x.lineTo(s * (8 + i * 1.5), -5 + i * 1.5 + (i % 2 ? st : -st)); x.lineTo(s * (9 + i * 1.5), 0); x.stroke(); }
        for (const s of [-1, 1]) { x.beginPath(); x.moveTo(s * 5, -8); x.lineTo(s * 9, -12); x.stroke(); circ(x, s * 10, -13.5, 3); x.fillStyle = rad(x, s * 10, -13.5, 3, [[0, '#ffb08a'], [1, '#c4320a']]); x.fill(); stroke(x, 0.7); x.strokeStyle = OUT; x.beginPath(); x.moveTo(s * 10, -13.5); x.lineTo(s * 12.6, -14.6); x.stroke(); x.strokeStyle = '#a8280a'; x.lineWidth = 1.2; }
        ell(x, 0, -5, 7.6, 4.8); x.fillStyle = rad(x, 0, -5, 8, [[0, '#ffb08a'], [0.5, '#f0522a'], [1, '#a8200a']]); x.fill(); stroke(x, 0.85);
        for (const s of [-2, 2]) { x.strokeStyle = OUT; x.lineWidth = 0.6; x.beginPath(); x.moveTo(s, -9); x.lineTo(s, -12); x.stroke(); circ(x, s, -12.6, 1.4); x.fillStyle = '#fff'; x.fill(); stroke(x, 0.5); circ(x, s - 0.3, -12.4, 0.6); x.fillStyle = '#111'; x.fill(); }
      } else if (k === 'snake') {
        const sp = e && e.spit > 0;
        for (const [cy, rx, ry] of [[-2.5, 8, 3], [-6.5, 6.4, 2.8], [-10, 4.6, 2.4]]) { ell(x, 1, cy, rx, ry); x.fillStyle = lin(x, 0, cy - ry, 0, cy + ry, [[0, '#c48aff'], [0.5, '#8a3ad6'], [1, '#4a1478']]); x.fill(); stroke(x, 0.8); }
        x.beginPath(); x.moveTo(0, -10); x.quadraticCurveTo(-2, -15, -2, -18); x.lineTo(1.5, -18); x.quadraticCurveTo(2.4, -14, 3, -10); x.fillStyle = '#8a3ad6'; x.fill(); stroke(x, 0.8);
        ell(x, -0.4, -19.5, 5, 4.2); x.fillStyle = rad(x, -0.4, -19.5, 5, [[0, '#e0b8ff'], [1, '#6a20a8']]); x.fill(); stroke(x, 0.85);
        ell(x, -3.2, -20, 2.6, 2); x.fillStyle = '#b07ae8'; x.fill(); stroke(x, 0.6);
        circ(x, -2.4, -21, 1.2); x.fillStyle = '#ffe040'; x.fill(); x.fillStyle = '#111'; x.fillRect(-2.6, -21.9, 0.5, 1.8);
        if (sp) { ell(x, -5.6, -19.4, 1.4, 1.3); x.fillStyle = '#5a0a1a'; x.fill(); }
        else if (Math.sin(t * 6) > 0.4) { x.strokeStyle = '#ff2a4a'; x.lineWidth = 0.5; x.beginPath(); x.moveTo(-5.6, -19.4); x.lineTo(-8, -19.4); x.lineTo(-9, -20.2); x.moveTo(-8, -19.4); x.lineTo(-9, -18.6); x.stroke(); }
      } else if (k === 'boulder') {
        x.translate(0, -8); x.rotate((e && e.rot) || 0);
        circ(x, 0, 0, 8); x.fillStyle = rad(x, 0, 0, 8.4, [[0, '#a89e9c'], [0.6, '#5a4e4c'], [1, '#2a2020']]); x.fill(); stroke(x, 1);
        x.strokeStyle = 'rgba(0,0,0,.4)'; x.lineWidth = 0.7; x.beginPath(); x.moveTo(-4, -4); x.lineTo(0, 0); x.lineTo(-2, 5); x.moveTo(0, 0); x.lineTo(5, 1); x.stroke();
        x.fillStyle = 'rgba(255,130,50,.6)'; circ(x, 3, -3, 1.2); x.fill();
      }
      if (dead) { x.fillStyle = 'rgba(255,255,255,.35)'; circ(x, 0, -6, 8); x.fill(); }
      x.restore();
    }

    drawBoss(b) {
      const x = this.ctx, t = this.time;
      if (b.st === 'die') x.globalAlpha = Math.max(0, 1 - b.t / 2.4);
      if (b.y > 0) this.shadow(b.x, GY, 26 * Math.max(0.3, 1 - (GY - b.y) / 160));
      x.save(); x.translate(b.x, b.y);
      const sq = b.st === 'idle' ? 1 + Math.sin(t * 6) * 0.02 : b.st === 'air' ? 1.05 : 1;
      x.scale(b.face > 0 ? -1 : 1, 1); x.scale(1 / sq, sq);
      // πόδια
      for (const s of [-1, 1]) { rrp(x, s * 12 - 5, -12, 10, 12, 3); x.fillStyle = lin(x, 0, -12, 0, 0, [[0, '#8a4a1e'], [1, '#5a2a0e']]); x.fill(); stroke(x, 1.1); ell(x, s * 12, -0.5, 7, 2.8); x.fillStyle = '#4a240c'; x.fill(); stroke(x, 1); }
      // φύλλα-στέμμα
      for (let i = 0; i < 9; i++) {
        const a = -Math.PI / 2 + (i - 4) * 0.33 + Math.sin(t * 3 + i) * 0.04, L = 30 - Math.abs(i - 4) * 2.6;
        x.save(); x.translate(0, -60); x.rotate(a + Math.PI / 2);
        x.beginPath(); x.moveTo(0, 0); x.quadraticCurveTo(5, -L * 0.5, 0, -L); x.quadraticCurveTo(-5, -L * 0.5, 0, 0);
        x.fillStyle = lin(x, 0, 0, 0, -L, [[0, '#1f8a2e'], [1, i % 2 ? '#8af05a' : '#5ad040']]); x.fill(); stroke(x, 1, '#124a18');
        x.strokeStyle = 'rgba(10,60,10,.5)'; x.lineWidth = 0.5; x.beginPath(); x.moveTo(0, 0); x.lineTo(0, -L * 0.9); x.stroke();
        x.restore();
      }
      // μάσκα
      const mask = () => { x.beginPath(); x.moveTo(-22, -12); x.lineTo(-25, -50); x.quadraticCurveTo(-24, -66, 0, -66); x.quadraticCurveTo(24, -66, 25, -50); x.lineTo(22, -12); x.quadraticCurveTo(0, -6, -22, -12); x.closePath(); };
      mask(); x.fillStyle = lin(x, -25, 0, 25, 0, [[0, '#7a3a14'], [0.3, '#c8803a'], [0.55, '#e8a85a'], [1, '#6a300e']]); x.fill(); stroke(x, 1.4);
      x.strokeStyle = 'rgba(70,30,10,.55)'; x.lineWidth = 0.8;
      for (const yy of [-58, -30, -18]) { x.beginPath(); x.moveTo(-23, yy); x.quadraticCurveTo(0, yy + 2, 23, yy); x.stroke(); }
      // βαμμένες ρίγες
      for (const s of [-1, 1]) { x.fillStyle = '#e8322a'; x.beginPath(); x.moveTo(s * 20, -40); x.lineTo(s * 14, -40); x.lineTo(s * 12, -33); x.lineTo(s * 19, -33); x.closePath(); x.fill(); stroke(x, 0.6); x.fillStyle = '#fff2d0'; x.fillRect(s > 0 ? 12 : -20, -31.5, 8, 1.6); }
      // φρύδια
      const ang = b.st === 'spit' || b.flash > 0 ? 0.35 : 0.22;
      for (const s of [-1, 1]) { x.save(); x.translate(s * 9, -50); x.rotate(s * ang); rrp(x, -8, -2.4, 16, 4.8, 2); x.fillStyle = '#4a200a'; x.fill(); stroke(x, 0.8); x.restore(); }
      // μάτια που λάμπουν
      const tgt = this.nearest(b.x), look = tgt ? U.clamp((tgt.x - b.x) / 60, -1, 1) * (b.face > 0 ? -1 : 1) : 0;
      for (const s of [-1, 1]) {
        ell(x, s * 9, -42, 6, 4.6); x.fillStyle = '#1a0a04'; x.fill(); stroke(x, 0.9);
        x.globalCompositeOperation = 'lighter';
        const g = x.createRadialGradient(s * 9 + look * 2, -42, 0, s * 9 + look * 2, -42, 7); g.addColorStop(0, 'rgba(255,255,200,1)'); g.addColorStop(0.35, 'rgba(255,190,40,.9)'); g.addColorStop(1, 'rgba(255,90,0,0)');
        x.fillStyle = g; x.fillRect(s * 9 - 8, -50, 16, 16); x.globalCompositeOperation = 'source-over';
      }
      // στόμα
      const mo = 5 + b.mouth * 6 + (b.st === 'die' ? 6 : 0);
      rrp(x, -13, -26, 26, mo + 3, 3); x.fillStyle = '#3a0a04'; x.fill(); stroke(x, 1);
      x.globalCompositeOperation = 'lighter'; x.fillStyle = `rgba(255,100,20,${0.3 + b.mouth * 0.5})`; rrp(x, -10, -24, 20, mo, 2); x.fill(); x.globalCompositeOperation = 'source-over';
      x.fillStyle = '#fff6e0'; for (let i = -2; i <= 2; i++) { x.beginPath(); x.moveTo(i * 5 - 2, -26); x.lineTo(i * 5 + 2, -26); x.lineTo(i * 5, -22.5); x.closePath(); x.fill(); stroke(x, 0.5); }
      x.fillStyle = 'rgba(255,255,255,.25)'; ell(x, -14, -56, 4, 7, 0.3); x.fill();
      if (b.flash > 0) { mask(); x.fillStyle = `rgba(255,255,255,${b.flash * 0.6})`; x.fill(); }
      x.restore();
      x.globalAlpha = 1;
    }

    drawHud() {
      const x = this.ctx, vh = this.vh, W = this.W, n = this.parts.length;
      const top = vh * 8.2;
      const pw = Math.min((W * 0.7 - vh * 1.4 * (n - 1)) / n, vh * 34), ph = vh * 8.4, gap = vh * 1.4;
      let X = vh * 2.5;
      for (const p of this.parts) {
        const c = p.color.hex;
        U.rr(x, X, top, pw, ph, vh * 1.6); x.fillStyle = 'rgba(30,16,6,.62)'; x.fill();
        x.lineWidth = vh * 0.3; x.strokeStyle = p.dead > 0 ? 'rgba(255,255,255,.2)' : c; x.stroke();
        x.font = this.font(vh * 2.3); x.textAlign = 'left'; x.textBaseline = 'middle'; x.fillStyle = sh(c, 0.3);
        let nm = p.name + (p.bot ? ' 🤖' : ''); while (x.measureText(nm).width > pw * 0.55 && nm.length > 2) nm = nm.slice(0, -2) + '…';
        x.fillText(nm, X + vh * 1.4, top + vh * 2.4);
        x.textAlign = 'right'; x.fillStyle = '#fff'; x.font = this.font(vh * 2.3, 800);
        x.fillText(String(p.score).padStart(5, '0'), X + pw - vh * 1.4, top + vh * 2.4);
        // μπάρα ενέργειας σε κομμάτια
        const segs = 16, bx = X + vh * 1.4, by = top + vh * 4.6, bw = pw - vh * 2.8 - vh * 6, bh = vh * 2.2, sw = bw / segs;
        const lit = Math.ceil((p.en / 100) * segs);
        for (let i = 0; i < segs; i++) {
          const on = i < lit && !p.dead, col = i < 4 ? '#ff3a3a' : i < 9 ? '#ffb020' : '#ffe040';
          U.rr(x, bx + i * sw + 0.5, by, sw - 1.5, bh, vh * 0.35);
          x.fillStyle = on ? col : 'rgba(255,255,255,.12)'; x.fill();
          if (on) { x.fillStyle = 'rgba(255,255,255,.4)'; x.fillRect(bx + i * sw + 1, by + 1, sw - 2.5, bh * 0.3); }
        }
        if (p.en < 25 && !p.dead && Math.floor(this.time * 4) % 2) { x.strokeStyle = '#ff5a5a'; x.lineWidth = 2; U.rr(x, bx - 2, by - 2, bw + 3, bh + 4, vh * 0.5); x.stroke(); }
        const icons = (p.axe ? '🪓' : '') + (p.skate ? '🛹' : '') + (p.fairy > 0 ? '🧚' : '') + (p.cloud > 0 ? '🌧' : '');
        x.font = this.font(vh * 2.2, 400); x.textAlign = 'right'; x.fillStyle = '#fff';
        x.fillText(icons, X + pw - vh * 1, by + bh / 2);
        X += pw + gap;
        if (X + pw > W * 0.72 && n > 3) { /* 4 κάρτες χωράνε στο 16:9 */ }
      }
      // πάνω δεξιά: ζωές + πρόοδος
      const rx = W - vh * 2.5, L = this.L;
      x.textAlign = 'right'; x.textBaseline = 'middle';
      this.text(`❤ × ${this.lives}`, rx, top + vh * 2.2, vh * 3.4, '#ff6a7a', { align: 'right' });
      const label = `${this.area}/${AREAS.length} · ${AREAS[this.area - 1].name}`;
      this.text(label, rx, top + vh * 5.8, vh * 2.4, '#fff6c0', { align: 'right' });
      const len = L.arena || L.goal, mw = vh * 28, mx = rx - mw - vh * 3, my = top + vh * 8.6;
      U.rr(x, mx, my, mw, vh * 1, vh * 0.5); x.fillStyle = 'rgba(30,16,6,.6)'; x.fill();
      for (const p of this.parts) {
        if (p.gone) continue;
        const k = U.clamp(p.x / len, 0, 1);
        x.beginPath(); x.arc(mx + k * mw, my + vh * 0.5, vh * 0.9, 0, TAU); x.fillStyle = p.color.hex; x.fill(); x.lineWidth = 1.5; x.strokeStyle = '#fff'; x.stroke();
      }
      x.font = this.font(vh * 2, 400); x.textAlign = 'right'; x.fillText(L.arena ? '🗿' : '🏁', rx, my + vh * 0.5);
      // μπάρα ζωής αφεντικού
      const b = this.boss;
      if (b && b.st !== 'enter') {
        const bw = W * 0.4, bx = (W - bw) / 2, by = this.H - vh * 6;
        this.text('Ο ΓΕΡΟ-ΤΙΚΙ', W / 2, by - vh * 2.2, vh * 2.6, '#ffcf8a');
        U.rr(x, bx, by, bw, vh * 2, vh * 1); x.fillStyle = 'rgba(30,10,4,.75)'; x.fill(); x.lineWidth = 2; x.strokeStyle = '#ffcf8a'; x.stroke();
        const k = Math.max(0, b.hp / b.max);
        if (k > 0) { U.rr(x, bx + 3, by + 3, (bw - 6) * k, vh * 2 - 6, vh * 0.8); x.fillStyle = lin(x, 0, by, 0, by + vh * 2, [[0, '#ffb04a'], [1, '#d8401a']]); x.fill(); }
      }
    }
  }

  Mini.games.jungle = JungleGame;
})();
