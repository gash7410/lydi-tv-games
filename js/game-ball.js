// «Μπαλίτσα»: συνεργατικό platform με χαριτωμένες μπαλίτσες (μία για κάθε παίκτη).
// Τρεις κόσμοι: Λιβάδι, Καραμελοχώρα, Σύννεφα + αφεντικό «Κύβος-Μπαμπούλας».
// Δωράκια μέσα στην πίστα: γίγαντας, μικρούλης, φούρια, τσαντισμένη, μπρατσαράς, μπαλόνι, φάντασμα,
// μαγνήτης, ελατήριο, φασολάδα (διπλό άλμα), μουστάκας (διπλοί πόντοι), φούσκα, καραμελοβροχή, καρδούλα
// — και δύο φάρσες: ζαλάδα (ανάποδα χειριστήρια) και παγάκι (γλιστράς).
(function () {
  'use strict';
  const { Base, U } = Mini;
  const LH = 216, GY = 180, TAU = Math.PI * 2;
  const G = 720, JV = 292, SPD = 92, R0 = 8.5, INVUL = 2.2, RESPAWN = 1.7;
  const OUT = '#2a1830';
  const TW = 384, GT = 96;
  const sh = (c, a) => U.shade(c, a);

  const AREAS = [
    { name: 'Το λιβάδι', len: 2500, foes: ['cube', 'cube', 'spiky'], pitMax: 40,
      w: { flat: 3, gap: 2, crates: 2, plats: 2, foes: 3, spikes: 1, spring: 1 } },
    { name: 'Η Καραμελοχώρα', len: 2800, foes: ['cube', 'spiky', 'cloud', 'cube'], pitMax: 48,
      w: { flat: 2, gap: 3, crates: 2, plats: 2, foes: 3, spikes: 2, spring: 2 } },
    { name: 'Τα σύννεφα', len: 2600, foes: ['cube', 'spiky', 'cloud', 'cloud'], pitMax: 52, boss: true,
      w: { flat: 2, gap: 3, crates: 1, plats: 3, foes: 4, spikes: 2, spring: 2 } },
  ];

  // δωράκια: t = διάρκεια (s), inst = άμεσο, bad = φάρσα, w = πόσο συχνά βγαίνει
  const PW = {
    big:      { t: 10, w: 10, e: '🍔', name: 'ΓΙΓΑΝΤΑΣ', d: 'Είσαι τεράστιος· πατάς ό,τι βρεις!' },
    tiny:     { t: 10, w: 9,  e: '🐭', name: 'ΜΙΚΡΟΥΛΗΣ', d: 'Μικροσκοπικός, πηδάς πιο ψηλά' },
    fast:     { t: 8,  w: 9,  e: '⚡', name: 'ΦΟΥΡΙΑ', d: 'Τρέχεις σαν αστραπή' },
    angry:    { t: 7,  w: 9,  e: '😡', name: 'ΤΣΑΝΤΙΣΜΕΝΗ', d: 'Σπάει ό,τι ακουμπά!' },
    strong:   { t: 12, w: 9,  e: '💪', name: 'ΜΠΡΑΤΣΑΡΑΣ', d: 'Πάτα ΜΠΟΥΝΙΑ για να σπας' },
    balloon:  { t: 9,  w: 8,  e: '🎈', name: 'ΜΠΑΛΟΝΙ', d: 'Πάτα ΠΗΔΑ στον αέρα και πετάς' },
    ghost:    { t: 8,  w: 7,  e: '👻', name: 'ΦΑΝΤΑΣΜΑΤΑΚΙ', d: 'Περνάς μέσα από τους κακούς' },
    magnet:   { t: 12, w: 7,  e: '🧲', name: 'ΜΑΓΝΗΤΗΣ', d: 'Τραβάς όλες τις καραμέλες' },
    spring:   { t: 10, w: 8,  e: '🦘', name: 'ΕΛΑΤΗΡΙΟ', d: 'Τεράστια άλματα' },
    beans:    { t: 12, w: 8,  e: '💨', name: 'ΦΑΣΟΛΑΔΑ', d: 'Διπλό άλμα με… πρρρτ!' },
    mustache: { t: 15, w: 7,  e: '🎩', name: 'ΚΥΡΙΟΣ ΜΟΥΣΤΑΚΑΣ', d: 'Διπλοί πόντοι, πολύ κύριος' },
    dizzy:    { t: 6,  w: 5,  e: '😵', name: 'ΖΑΛΑΔΑ', d: 'Ανάποδα χειριστήρια!', bad: true },
    ice:      { t: 7,  w: 5,  e: '🧊', name: 'ΠΑΓΑΚΙ', d: 'Γλιστράς παντού!', bad: true },
    shield:   { inst: true, w: 7, e: '🔵', name: 'ΦΟΥΣΚΑ', d: 'Σε γλιτώνει από ένα χτύπημα' },
    rain:     { inst: true, w: 6, e: '🍬', name: 'ΚΑΡΑΜΕΛΟΒΡΟΧΗ', d: '' },
    heart:    { inst: true, w: 4, e: '❤', name: 'ΚΑΡΔΟΥΛΑ', d: '+1 ζωή για την ομάδα' },
  };
  const PW_KEYS = Object.keys(PW), PW_TOT = PW_KEYS.reduce((s, k) => s + PW[k].w, 0);

  const FOE = { // πλάτος, ύψος, πατιέται;
    cube: [16, 15, true], spiky: [15, 13, false], cloud: [22, 13, true],
  };
  const GIFT_COLS = [['#ff5a8a', '#ffe066'], ['#4fc0ff', '#ff5a6e'], ['#9a5cff', '#7dff9a'], ['#ffb02e', '#3f6bff'], ['#4fd06a', '#ff7ad9']];
  const CANDY_COLS = ['#ff5a8a', '#4fc0ff', '#ffd23a', '#7ae05a', '#b46cff'];

  function rng(seed) {
    let s = seed >>> 0 || 1;
    return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  function lin(x, x0, y0, x1, y1, stops) { const g = x.createLinearGradient(x0, y0, x1, y1); stops.forEach(([o, c]) => g.addColorStop(o, c)); return g; }
  function rad(x, cx, cy, r, stops, fx = -0.35, fy = -0.4) {
    const g = x.createRadialGradient(cx + r * fx, cy + r * fy, r * 0.05, cx, cy, r); stops.forEach(([o, c]) => g.addColorStop(o, c)); return g;
  }
  function stroke(x, w = 0.9, c = OUT) { x.lineWidth = w; x.strokeStyle = c; x.lineJoin = 'round'; x.lineCap = 'round'; x.stroke(); }
  function circ(x, cx, cy, r) { x.beginPath(); x.arc(cx, cy, Math.max(0.01, r), 0, TAU); }
  function ell(x, cx, cy, rx, ry, rot = 0) { x.beginPath(); x.ellipse(cx, cy, Math.max(0.01, rx), Math.max(0.01, ry), rot, 0, TAU); }
  function rr(x, X, Y, w, h, r) { U.rr(x, X, Y, w, h, r); }
  function blobs(x, list, cols, ow) {
    x.fillStyle = cols.out; for (const [cx, cy, r] of list) { circ(x, cx, cy, r + ow); x.fill(); }
    x.fillStyle = cols.base; for (const [cx, cy, r] of list) { circ(x, cx, cy, r); x.fill(); }
    if (cols.hi) { x.fillStyle = cols.hi; for (const [cx, cy, r] of list) { ell(x, cx - r * 0.3, cy - r * 0.4, r * 0.4, r * 0.25, -0.4); x.fill(); } }
  }
  // μικρό χαμογελαστό προσωπάκι (σύννεφα, αστέρια, ήλιος)
  function face(x, cx, cy, s, sleepy) {
    x.fillStyle = OUT; x.strokeStyle = OUT; x.lineWidth = s * 0.18; x.lineCap = 'round';
    if (sleepy) { for (const d of [-1, 1]) { x.beginPath(); x.arc(cx + d * s * 0.9, cy - s * 0.1, s * 0.35, 0.2, Math.PI - 0.2); x.stroke(); } }
    else for (const d of [-1, 1]) { ell(x, cx + d * s * 0.9, cy - s * 0.15, s * 0.28, s * 0.38); x.fill(); x.fillStyle = '#fff'; circ(x, cx + d * s * 0.9 - s * 0.08, cy - s * 0.3, s * 0.11); x.fill(); x.fillStyle = OUT; }
    x.beginPath(); x.arc(cx, cy + s * 0.25, s * 0.42, 0.25, Math.PI - 0.25); x.stroke();
    x.fillStyle = 'rgba(255,110,140,.55)'; for (const d of [-1, 1]) { ell(x, cx + d * s * 1.45, cy + s * 0.3, s * 0.32, s * 0.2); x.fill(); }
  }

  // ---------- sprites (ζωγραφίζονται μία φορά σε μικρό καμβά) ----------
  const SPR = {
    crate: [19, 19, (x) => {
      rr(x, -9, -9, 18, 18, 1.6); x.fillStyle = lin(x, 0, -9, 0, 9, [[0, '#f2c27a'], [1, '#b87a3a']]); x.fill(); stroke(x, 1);
      x.strokeStyle = '#8a5424'; x.lineWidth = 0.6;
      for (const yy of [-3, 3]) { x.beginPath(); x.moveTo(-7, yy); x.lineTo(7, yy); x.stroke(); }
      rr(x, -7, -7, 14, 14, 0.8); x.lineWidth = 1.6; x.strokeStyle = '#9a6028'; x.stroke(); x.lineWidth = 0.5; x.strokeStyle = OUT; x.stroke();
      x.lineWidth = 2; x.strokeStyle = '#a86a30'; x.beginPath(); x.moveTo(-6, -6); x.lineTo(6, 6); x.stroke();
      x.lineWidth = 0.5; x.strokeStyle = OUT; x.beginPath(); x.moveTo(-6.5, -5); x.lineTo(5, 6.5); x.moveTo(-5, -6.5); x.lineTo(6.5, 5); x.stroke();
      x.fillStyle = '#6a4020'; for (const [a, b] of [[-7.6, -7.6], [7.6, -7.6], [-7.6, 7.6], [7.6, 7.6]]) { circ(x, a, b, 0.7); x.fill(); }
      x.fillStyle = 'rgba(255,255,255,.35)'; x.fillRect(-8, -8.4, 16, 1);
    }],
    gift: [20, 22, (x, i) => {
      const [c, rb] = GIFT_COLS[i % GIFT_COLS.length];
      rr(x, -7.5, -3.5, 15, 13, 1.5); x.fillStyle = lin(x, -7, 0, 7, 0, [[0, sh(c, 0.25)], [0.6, c], [1, sh(c, -0.3)]]); x.fill(); stroke(x, 0.9);
      rr(x, -8.8, -7, 17.6, 4.4, 1.3); x.fillStyle = lin(x, 0, -7, 0, -2.6, [[0, sh(c, 0.35)], [1, sh(c, -0.1)]]); x.fill(); stroke(x, 0.9);
      x.fillStyle = rb; x.fillRect(-1.6, -7, 3.2, 16.4); x.fillRect(-7.4, 2, 14.8, 2.6);
      x.strokeStyle = OUT; x.lineWidth = 0.4; x.strokeRect(-1.6, -7, 3.2, 16.4);
      for (const d of [-1, 1]) { x.beginPath(); x.moveTo(0, -7); x.bezierCurveTo(d * 6, -13, d * 8, -7.5, 0, -7); x.fillStyle = rb; x.fill(); stroke(x, 0.7); }
      circ(x, 0, -7.4, 1.6); x.fillStyle = sh(rb, -0.15); x.fill(); stroke(x, 0.6);
      x.fillStyle = 'rgba(255,255,255,.55)'; ell(x, -4.6, 0, 1.2, 2.6, 0.2); x.fill();
      x.fillStyle = 'rgba(255,255,255,.9)'; x.font = '900 7px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('?', 4, 2.6);
    }],
    candy: [15, 9, (x, i) => {
      const c = CANDY_COLS[i % CANDY_COLS.length];
      for (const d of [-1, 1]) { x.beginPath(); x.moveTo(d * 3.6, 0); x.lineTo(d * 7.2, -3.4); x.lineTo(d * 6.4, 0); x.lineTo(d * 7.2, 3.4); x.closePath(); x.fillStyle = sh(c, 0.25); x.fill(); stroke(x, 0.5); }
      ell(x, 0, 0, 4.4, 3.6); x.fillStyle = rad(x, 0, 0, 4.6, [[0, '#ffffff'], [0.3, sh(c, 0.3)], [1, sh(c, -0.25)]]); x.fill(); stroke(x, 0.6);
      x.save(); ell(x, 0, 0, 4.2, 3.4); x.clip(); x.strokeStyle = 'rgba(255,255,255,.75)'; x.lineWidth = 0.9;
      for (let k = -6; k <= 6; k += 2.6) { x.beginPath(); x.moveTo(k, -4); x.lineTo(k + 3, 4); x.stroke(); } x.restore();
    }],
    star: [16, 16, (x) => {
      U.starPath(x, 0, 0.5, 7.2, 0.5); x.fillStyle = rad(x, 0, 0, 7.5, [[0, '#fffbd0'], [0.5, '#ffd23a'], [1, '#f08a0a']]); x.fill(); stroke(x, 0.8);
      face(x, 0, 1.2, 1.3);
    }],
    spikes: [16, 8, (x) => {
      for (let i = 0; i < 4; i++) {
        const cx = -6 + i * 4; x.beginPath(); x.moveTo(cx - 2, 4); x.lineTo(cx, -4); x.lineTo(cx + 2, 4); x.closePath();
        x.fillStyle = lin(x, cx - 2, 0, cx + 2, 0, [[0, '#ffffff'], [0.5, '#b8c0d0'], [1, '#6a7088']]); x.fill(); stroke(x, 0.5);
      }
    }],
  };

  // ---------- φόντα ----------
  const SKY = [
    [[0, '#3aa8ff'], [0.55, '#8fd8ff'], [1, '#e6fbff']],
    [[0, '#ff8ac8'], [0.5, '#ffc0d8'], [1, '#fff0d8']],
    [[0, '#3a1a78'], [0.5, '#a04ab0'], [0.85, '#ff9a7a'], [1, '#ffd08a']],
  ];
  function cloudShape(x, cx, cy, s, col, sleepy) {
    const list = [[cx - 12 * s, cy, 8 * s], [cx, cy - 5 * s, 11 * s], [cx + 13 * s, cy, 8 * s], [cx + 3 * s, cy + 3 * s, 9 * s]];
    blobs(x, list, { out: col.out, base: col.base, hi: col.hi }, 0.9);
    if (col.face) face(x, cx + 1 * s, cy, 2.2 * s, sleepy);
  }
  const LAYERS = [
    { // λιβάδι
      clouds(x, R) { for (let i = 0; i < 4; i++) cloudShape(x, 40 + i * 95 + R() * 30, 30 + R() * 40, 0.75 + R() * 0.4, { out: '#9ccbe8', base: '#ffffff', hi: 'rgba(255,255,255,.8)', face: i % 2 === 0 }, R() < 0.5); },
      far(x, R) {
        x.beginPath(); x.moveTo(0, LH);
        for (let X = 0; X <= TW; X += 4) x.lineTo(X, 122 + Math.sin(X / TW * TAU * 2) * 10 + Math.sin(X / TW * TAU * 5) * 4);
        x.lineTo(TW, LH); x.closePath(); x.fillStyle = lin(x, 0, 110, 0, LH, [[0, '#a8e88a'], [1, '#6cc25a']]); x.fill(); stroke(x, 1, '#4f9a48');
        for (let i = 0; i < 7; i++) { const tx = R() * TW, ty = 130 + R() * 14; x.fillStyle = '#8a5a3a'; x.fillRect(tx - 0.8, ty, 1.6, 7); blobs(x, [[tx, ty - 2, 5], [tx - 3, ty + 1, 3.5], [tx + 3, ty + 1, 3.5]], { out: '#3f8a3a', base: '#5cb84a', hi: 'rgba(220,255,200,.45)' }, 0.6); }
      },
      mid(x, R) {
        x.beginPath(); x.moveTo(0, LH);
        for (let X = 0; X <= TW; X += 4) x.lineTo(X, 152 + Math.sin(X / TW * TAU * 3 + 1) * 8);
        x.lineTo(TW, LH); x.closePath(); x.fillStyle = lin(x, 0, 140, 0, LH, [[0, '#6ad04a'], [1, '#3a9a34']]); x.fill(); stroke(x, 1, '#2f7a2a');
        for (let i = 0; i < 4; i++) { // κυπαρισσάκια και στρογγυλά δέντρα
          const tx = 20 + i * 96 + R() * 40, ty = 150;
          x.fillStyle = '#7a4a2a'; x.fillRect(tx - 1.2, ty - 6, 2.4, 12);
          if (i % 2) { x.beginPath(); x.moveTo(tx, ty - 44); x.quadraticCurveTo(tx + 9, ty - 16, tx + 6, ty - 4); x.lineTo(tx - 6, ty - 4); x.quadraticCurveTo(tx - 9, ty - 16, tx, ty - 44); x.fillStyle = lin(x, tx - 8, 0, tx + 8, 0, [[0, '#5ad040'], [1, '#2a8a2a']]); x.fill(); stroke(x, 0.9, '#1f6a1c'); }
          else blobs(x, [[tx, ty - 22, 11], [tx - 8, ty - 12, 8], [tx + 8, ty - 12, 8]], { out: '#2a7a24', base: '#4ec23c', hi: 'rgba(220,255,190,.5)' }, 0.9);
        }
        for (let i = 0; i < 14; i++) { const fx = R() * TW, fy = 160 + R() * 20; x.fillStyle = ['#ffffff', '#ffe066', '#ff7ab0'][i % 3]; for (let k = 0; k < 5; k++) { circ(x, fx + Math.cos(k * 1.26) * 1.4, fy + Math.sin(k * 1.26) * 1.4, 1); x.fill(); } x.fillStyle = '#ffb020'; circ(x, fx, fy, 0.8); x.fill(); }
      },
      ground(x, R) {
        x.fillStyle = lin(x, 0, 0, 0, 40, [[0, '#d8995a'], [1, '#a8683a']]); x.fillRect(0, 0, GT, 40);
        for (let i = 0; i < 12; i++) { ell(x, R() * GT, 12 + R() * 24, 2 + R() * 3, 1.4 + R() * 1.6); x.fillStyle = ['#e8b880', '#b87848', '#8ab0e0'][i % 3]; x.fill(); stroke(x, 0.4, '#7a4a28'); }
        x.beginPath(); x.moveTo(0, 0); x.lineTo(GT, 0); x.lineTo(GT, 6);
        for (let X = GT; X >= 0; X -= 6) x.quadraticCurveTo(X - 3, 10.5, X - 6, 6);
        x.closePath(); x.fillStyle = lin(x, 0, 0, 0, 9, [[0, '#9cf06a'], [1, '#3fb534']]); x.fill(); stroke(x, 0.7, '#2a7a24');
        x.strokeStyle = '#2f9a2a'; x.lineWidth = 0.6; for (let X = 2; X < GT; X += 3.2) { x.beginPath(); x.moveTo(X, 2); x.lineTo(X + 0.8, -1.5 - (X * 7 % 3)); x.stroke(); }
      },
      pit: '#5a3a28',
    },
    { // καραμελοχώρα
      clouds(x, R) { for (let i = 0; i < 4; i++) cloudShape(x, 40 + i * 95 + R() * 30, 28 + R() * 40, 0.7 + R() * 0.4, { out: '#f0a0c8', base: '#fff4fa', hi: 'rgba(255,255,255,.8)', face: i % 2 === 1 }, R() < 0.5); },
      far(x, R) {
        for (let i = 0; i < 6; i++) { // βουνά-γλειφιτζούρια με ρίγες
          const mx = i * 70 + R() * 30, mh = 50 + R() * 30, mw = 44 + R() * 20, base = 150;
          x.save(); x.beginPath(); x.moveTo(mx - mw, base + 10); x.quadraticCurveTo(mx - mw * 0.25, base - mh * 1.25, mx, base - mh); x.quadraticCurveTo(mx + mw * 0.25, base - mh * 1.25, mx + mw, base + 10); x.closePath();
          x.fillStyle = '#ffe6f2'; x.fill(); x.clip();
          x.fillStyle = i % 2 ? '#ff9ac6' : '#c99aff'; for (let k = -6; k < 10; k++) { x.beginPath(); x.moveTo(mx - mw + k * 12, base + 12); x.lineTo(mx - mw + k * 12 + 6, base + 12); x.lineTo(mx - mw + k * 12 + 46, base - mh - 10); x.lineTo(mx - mw + k * 12 + 40, base - mh - 10); x.closePath(); x.fill(); }
          x.restore(); x.beginPath(); x.moveTo(mx - mw, base + 10); x.quadraticCurveTo(mx - mw * 0.25, base - mh * 1.25, mx, base - mh); x.quadraticCurveTo(mx + mw * 0.25, base - mh * 1.25, mx + mw, base + 10); stroke(x, 1, '#b05a8a');
          blobs(x, [[mx - 6, base - mh + 4, 6], [mx + 5, base - mh + 3, 5], [mx, base - mh - 2, 5]], { out: '#c05a8a', base: '#ffffff', hi: null }, 0.6);
        }
      },
      mid(x, R) {
        x.fillStyle = lin(x, 0, 150, 0, LH, [[0, '#ffb0d0'], [1, '#e070a8']]); x.beginPath(); x.moveTo(0, LH);
        for (let X = 0; X <= TW; X += 4) x.lineTo(X, 158 + Math.sin(X / TW * TAU * 4) * 5); x.lineTo(TW, LH); x.closePath(); x.fill(); stroke(x, 1, '#b04a80');
        for (let i = 0; i < 5; i++) { // γλειφιτζούρια
          const tx = 15 + i * 76 + R() * 30, ty = 158, h = 26 + R() * 16, r = 9 + R() * 5;
          x.fillStyle = '#fff'; x.fillRect(tx - 1, ty - h, 2, h); x.strokeStyle = '#c05a8a'; x.lineWidth = 0.5; x.strokeRect(tx - 1, ty - h, 2, h);
          circ(x, tx, ty - h - r + 2, r); x.fillStyle = ['#ff5a8a', '#4fc0ff', '#ffd23a', '#7ae05a', '#b46cff'][i]; x.fill(); stroke(x, 0.9);
          x.strokeStyle = 'rgba(255,255,255,.9)'; x.lineWidth = 1.6; x.beginPath();
          for (let k = 0; k < 40; k++) { const a = k * 0.42, rr2 = (k / 40) * (r - 1.5); const px = tx + Math.cos(a) * rr2, py = ty - h - r + 2 + Math.sin(a) * rr2; k ? x.lineTo(px, py) : x.moveTo(px, py); } x.stroke();
        }
        for (let i = 0; i < 6; i++) { const gx = R() * TW, gy = 172 + R() * 10; x.beginPath(); x.moveTo(gx - 5, gy); x.quadraticCurveTo(gx - 5, gy - 9, gx, gy - 9); x.quadraticCurveTo(gx + 5, gy - 9, gx + 5, gy); x.closePath(); x.fillStyle = CANDY_COLS[i % 5]; x.fill(); stroke(x, 0.7); x.fillStyle = 'rgba(255,255,255,.6)'; ell(x, gx - 2, gy - 6, 1, 1.8, 0.4); x.fill(); }
      },
      ground(x, R) {
        x.fillStyle = lin(x, 0, 0, 0, 40, [[0, '#8a4a2a'], [1, '#5a2a14']]); x.fillRect(0, 0, GT, 40);
        x.strokeStyle = 'rgba(0,0,0,.18)'; x.lineWidth = 0.6; for (let X = 0; X < GT; X += 16) { x.strokeRect(X + 1, 12, 14, 10); x.strokeRect(X + 9, 24, 14, 10); }
        x.beginPath(); x.moveTo(0, 0); x.lineTo(GT, 0); x.lineTo(GT, 5);
        for (let X = GT; X > 0; X -= 12) { const d = 4 + ((X * 13) % 7); x.quadraticCurveTo(X - 2, 5, X - 3, 5 + d); x.quadraticCurveTo(X - 4.5, 7 + d, X - 6, 5 + d); x.quadraticCurveTo(X - 7, 5, X - 12, 5); }
        x.closePath(); x.fillStyle = lin(x, 0, 0, 0, 8, [[0, '#fff0f8'], [1, '#ff8ac0']]); x.fill(); stroke(x, 0.6, '#b04a80');
        for (let i = 0; i < 18; i++) { x.save(); x.translate(R() * GT, 1 + R() * 3); x.rotate(R() * 3); x.fillStyle = CANDY_COLS[i % 5]; x.fillRect(-1.2, -0.4, 2.4, 0.8); x.restore(); }
      },
      pit: '#3a1a10',
    },
    { // σύννεφα
      clouds(x, R) {
        x.fillStyle = '#fff'; for (let i = 0; i < 40; i++) { x.globalAlpha = 0.4 + R() * 0.6; circ(x, R() * TW, R() * 90, 0.4 + R() * 0.8); x.fill(); } x.globalAlpha = 1;
        for (let i = 0; i < 3; i++) cloudShape(x, 60 + i * 130 + R() * 30, 60 + R() * 30, 0.8 + R() * 0.3, { out: '#c07ab8', base: '#ffd6ec', hi: 'rgba(255,255,255,.6)', face: i === 1 }, true);
      },
      far(x, R) {
        for (let i = 0; i < 4; i++) { // κάστρα πάνω σε σύννεφα
          const cx = 40 + i * 96 + R() * 20, cy = 128 + R() * 10;
          x.fillStyle = '#b07ad0'; for (const [dx, w, h] of [[-12, 8, 30], [0, 12, 40], [12, 8, 26]]) { x.fillRect(cx + dx - w / 2, cy - h, w, h); x.beginPath(); x.moveTo(cx + dx - w / 2 - 2, cy - h); x.lineTo(cx + dx, cy - h - 12); x.lineTo(cx + dx + w / 2 + 2, cy - h); x.closePath(); x.fillStyle = '#ff7ab0'; x.fill(); x.fillStyle = '#b07ad0'; }
          x.fillStyle = '#ffe680'; for (const dx of [-12, 0, 12]) { rr(x, cx + dx - 1.4, cy - 20, 2.8, 4, 1.2); x.fill(); }
          blobs(x, [[cx - 18, cy + 2, 9], [cx, cy + 4, 12], [cx + 18, cy + 2, 9]], { out: '#c9a0e0', base: '#f6e8ff', hi: null }, 0.8);
        }
      },
      mid(x, R) {
        const list = []; for (let i = 0; i < 22; i++) { const cx = (i / 22) * TW, r = 14 + R() * 10; list.push([cx, 168 + R() * 10, r], [cx - TW, 168, r], [cx + TW, 168, r]); }
        blobs(x, list, { out: '#d08ac0', base: '#ffe0f0', hi: 'rgba(255,255,255,.7)' }, 1);
        x.fillStyle = '#ffe0f0'; x.fillRect(0, 178, TW, LH);
      },
      ground(x, R) {
        x.fillStyle = lin(x, 0, 0, 0, 40, [[0, '#ffffff'], [0.4, '#e6dcff'], [1, '#a890e0']]); x.fillRect(0, 0, GT, 40);
        x.fillStyle = 'rgba(255,255,255,.9)'; for (let i = 0; i < 8; i++) { U.starPath(x, R() * GT, 14 + R() * 22, 1.4, 0.4); x.fill(); }
        x.beginPath(); x.moveTo(0, 6); for (let X = 0; X <= GT; X += 12) x.quadraticCurveTo(X + 6, -3, X + 12, 6); x.lineTo(GT, 0); x.lineTo(0, 0); x.closePath();
        x.fillStyle = '#ffffff'; x.fill();
        x.beginPath(); for (let X = 0; X <= GT; X += 12) { x.moveTo(X, 6); x.quadraticCurveTo(X + 6, -3, X + 12, 6); } stroke(x, 0.6, '#9a80d0');
      },
      pit: null,
    },
  ];

  class BallGame extends Base {
    constructor(c, h) { super(c, h); this.WIN = 0; }

    resize() {
      super.resize();
      this.s = this.H / LH; this.VW = this.W / this.s;
      this.dpr = this.c.width / this.W;
      this.R = this.s * this.dpr;
      this.sprC = new Map(); this.layerC = new Map(); this.skyG = null;
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
      const R = Math.min(this.R, 4), w = name === 'ground' ? GT : TW, h = name === 'ground' ? 40 : LH;
      c = document.createElement('canvas'); c.width = Math.ceil(w * R); c.height = Math.ceil(h * R);
      const x = c.getContext('2d'); x.scale(R, R);
      LAYERS[a][name](x, rng(a * 131 + name.length * 17 + 5));
      this.layerC.set(key, c); return c;
    }
    put(img, X, Y, rot = 0, sx = 1, sy = sx) {
      const x = this.ctx;
      if (rot || sx !== 1 || sy !== 1) { x.save(); x.translate(X, Y); x.rotate(rot); x.scale(sx, sy); x.drawImage(img, -img.w / 2, -img.h / 2, img.w, img.h); x.restore(); }
      else x.drawImage(img, X - img.w / 2, Y - img.h / 2, img.w, img.h);
    }

    active(p) { return p.bot || !p.p || p.p.connected; }
    alive() { return this.parts.filter((p) => !p.dead && !p.gone && this.active(p)); }

    setup() {
      this.humans = this.parts.filter((p) => !p.bot).length;
      this.lives = 3 + this.humans;
      this.seed = (Math.random() * 1e9) | 0;
      this.area = 1; this.team = 0; this.syncT = 0;
      this.parts.forEach((p) => Object.assign(p, { candies: 0, foes: 0, gifts: 0, mv: 0, botT: 0, hi: false, status: '', pw: '', pwT: 0, shield: false }));
      this.startArea();
    }

    startArea() {
      this.build();
      this.camX = 0; this.shake = 0;
      this.pfx = []; this.floats = []; this.boss = null; this.bossOn = false;
      this.parts.forEach((p, i) => Object.assign(p, {
        x: 30 + i * 20, y: GY - R0, vx: 0, vy: 0, r: R0, onG: true, coy: 0, jumpBuf: 0, face: 1, rot: 0,
        dead: 0, inv: 0, sq: 0, air: 0, dashT: 0, dashCd: 0, punchT: 0, blink: 2 + Math.random() * 3, gone: false,
        pw: '', pwT: 0, shield: false, look: 0,
      }));
      this.phase = 'count';
      const A = AREAS[this.area - 1];
      this.banner(this.area === 1 ? 'Μπαλίτσες, έτοιμες; 🎁' : `Κόσμος ${this.area}: ${A.name}${A.boss ? ' ☁' : ''}`, '#ffe066');
      this.countdown(() => { this.phase = 'go'; this.changed(); });
      this.changed();
    }

    // ---------- κατασκευή πίστας ----------
    build() {
      const a = this.area, A = AREAS[a - 1], R = rng(this.seed + a * 7919), n = this.parts.length;
      const L = this.L = { segs: [], plats: [], crates: [], gifts: [], candies: [], stars: [], foes: [], spikes: [], springs: [], deco: [], goal: 0, arena: 0, end: 0 };
      const ground = (x0, x1) => { const s = L.segs[L.segs.length - 1]; if (s && s.x1 >= x0 - 0.5) s.x1 = Math.max(s.x1, x1); else L.segs.push({ x0, x1 }); };
      const candy = (x, y) => L.candies.push({ x, y, c: (R() * 5) | 0, t: R() * 6 });
      const row = (x, y, cnt, gap) => { for (let i = 0; i < cnt; i++) candy(x + i * gap, y); };
      const arc = (x, y, cnt, gap, h) => { for (let i = 0; i < cnt; i++) { const k = cnt > 1 ? i / (cnt - 1) : 0.5; candy(x + i * gap, y - Math.sin(k * Math.PI) * h); } };
      const star = (x, y) => L.stars.push({ x, y, t: R() * 6 });
      const foe = (x, k) => {
        k = k || A.foes[(R() * A.foes.length) | 0];
        const e = { k, x, y: GY, dir: -1, t: R() * 5, alive: true, home: x, dead: null, dt: 0, vx: 0, vy: 0, rot: 0 };
        if (k === 'cloud') { e.y = GY - 40 - R() * 16; e.base = e.y; }
        L.foes.push(e);
      };
      const gift = (x, y) => L.gifts.push({ x, y, c: (R() * GIFT_COLS.length) | 0, open: 0, t: R() * 6 });
      const crate = (x, y) => L.crates.push({ x0: x - 9, x1: x + 9, y0: y - 18, y1: y, alive: true });
      const C = {
        flat(x) {
          const w = 140 + R() * 60; ground(x, x + w);
          if (R() < 0.5) row(x + 30, GY - 9, 4, 20); else arc(x + 30, GY - 30, 5, 18, 24);
          for (let i = 0; i < 2; i++) if (R() < 0.7) L.deco.push({ x: x + w * R(), k: (R() * 3) | 0 });
          return w;
        },
        gap(x) {
          const pw = 30 + R() * (A.pitMax - 30); ground(x, x + 44);
          arc(x + 44 + pw / 2 - 24, GY - 30, 4, 16, 20);
          return 44 + pw;
        },
        crates(x) {
          ground(x, x + 170); const cx = x + 85, k = R();
          if (k < 0.35) { crate(cx, GY); candy(cx, GY - 26); }
          else if (k < 0.7) { crate(cx - 9, GY); crate(cx + 9, GY); crate(cx, GY - 18); star(cx, GY - 46); }
          else { crate(cx - 18, GY); crate(cx, GY); crate(cx, GY - 18); crate(cx + 18, GY); crate(cx + 18, GY - 18); crate(cx + 18, GY - 36); row(cx - 18, GY - 30, 1, 0); candy(cx, GY - 48); star(cx + 18, GY - 64); }
          return 170;
        },
        plats(x) {
          ground(x, x + 240);
          L.plats.push({ x0: x + 30, x1: x + 90, y: GY - 38 }, { x0: x + 120, x1: x + 190, y: GY - 76 });
          row(x + 42, GY - 50, 3, 18); star(x + 155, GY - 94);
          if (R() < 0.5) gift(x + 140, GY - 76); else if (R() < 0.6) foe(x + 160);
          return 240;
        },
        foes(x) {
          const w = 170 + R() * 40; ground(x, x + w);
          foe(x + 100); if (a > 1 || n > 2 || R() < 0.4) foe(x + 140 + R() * 20);
          row(x + 30, GY - 9, 2, 18);
          return w;
        },
        spikes(x) {
          ground(x, x + 150); const sw = a === 1 ? 16 : 32;
          L.spikes.push({ x0: x + 70, x1: x + 70 + sw });
          arc(x + 50, GY - 30, 4, 18, 28);
          return 150;
        },
        spring(x) {
          ground(x, x + 70); L.springs.push({ x: x + 46, sq: 0 });
          const gw = 86 + R() * 14;
          arc(x + 70, GY - 70, 6, gw / 5, 50); star(x + 70 + gw / 2, GY - 140);
          return 70 + gw;
        },
      };
      ground(0, 280); row(90, GY - 9, 3, 20);
      gift(200, GY);
      let x = 280, lastGift = 200;
      const giftGap = n >= 3 ? 230 : 280;
      const types = Object.keys(A.w), tot = types.reduce((s, k) => s + A.w[k], 0);
      let prev = '';
      while (x < A.len - 260) {
        let t;
        if (x - lastGift > giftGap) t = 'gift';
        else { do { let r = R() * tot; t = types.find((k) => (r -= A.w[k]) < 0) || 'flat'; } while (t === prev && t !== 'flat'); }
        if (t === 'gift') {
          ground(x, x + 120);
          if (R() < 0.5) gift(x + 60, GY); else { gift(x + 60, GY - 30); candy(x + 30, GY - 9); candy(x + 90, GY - 9); }
          lastGift = x + 60; x += 120; prev = t; continue;
        }
        x += C[t](x); prev = t;
      }
      if (A.boss) {
        ground(x, x + 140); row(x + 20, GY - 9, 5, 20); gift(x + 120, GY); x += 140;
        L.arena = x; ground(x, x + 900);
        L.plats.push({ x0: x + 50, x1: x + 110, y: GY - 46 }, { x0: x + 274, x1: x + 334, y: GY - 46 });
        L.end = x + 384;
      } else {
        ground(x, x + 560); row(x + 30, GY - 9, 5, 20);
        L.goal = x + 230; L.end = L.goal + 90;
      }
    }

    segAt(x) { return this.L.segs.find((s) => x >= s.x0 - 2 && x <= s.x1 + 2); }
    groundAt(x) { return !!this.segAt(x); }
    solids() {
      const out = [];
      for (const s of this.L.segs) out.push({ x0: s.x0, x1: s.x1, y0: GY, y1: LH + 400, g: true });
      for (const c of this.L.crates) if (c.alive) out.push(c);
      return out;
    }
    // ποιο ύψος πατά κάτι στο x (για εχθρούς / respawn)
    floorAt(x) {
      let best = null;
      if (this.groundAt(x)) best = GY;
      for (const c of this.L.crates) if (c.alive && x > c.x0 && x < c.x1 && (best === null || c.y0 < best)) best = c.y0;
      return best;
    }

    // ---------- είσοδος ----------
    input(part, msg) {
      if (!part) return;
      if (msg.type === 'move') { part.mv = U.clamp(Math.round(+msg.d || 0), -1, 1); return; }
      if (this.phase !== 'go' || part.dead > 0) return;
      if (msg.type === 'jump') part.jumpBuf = 0.15;
      else if (msg.type === 'dash') this.action(part);
    }

    action(p) {
      if (p.pw === 'strong') {
        if (p.punchT > 0) return;
        p.punchT = 0.32; this.sfx('dash');
        const X = p.x + p.face * (p.r + 10);
        this.puff(X, p.y, 6, '#ffffff');
        for (const e of this.L.foes) if (e.alive && Math.abs(e.x - X) < 20 && Math.abs(this.foeCY(e) - p.y) < 20) this.killFoe(e, p, 'fly');
        for (const c of this.L.crates) if (c.alive && X + 10 > c.x0 && X - 10 < c.x1 && p.y + 6 > c.y0 && p.y - 6 < c.y1) this.breakCrate(c, p);
        if (this.boss && this.boss.hp > 0 && Math.abs(this.boss.x - X) < 30 && p.y > this.boss.y - 44) this.hitBoss(p, true);
        return;
      }
      if (p.dashCd > 0) return;
      p.dashCd = 0.9; p.dashT = 0.28; p.vx = p.face * 210; if (!p.onG) p.vy = Math.min(p.vy, -60);
      this.sfx('dash'); this.puff(p.x - p.face * p.r, p.y + p.r * 0.5, 4, '#ffffff');
    }

    // ---------- bot ----------
    bot(p, dt) {
      p.botT -= dt; if (p.botT > 0) return; p.botT = 0.07;
      if (p.dead > 0) return;
      const hum = this.parts.filter((q) => !q.bot && !q.dead && this.active(q));
      let tx = hum.length ? Math.max(...hum.map((q) => q.x)) + 14 : this.camX + this.VW * 0.6;
      const g = this.L.gifts.find((q) => !q.open && q.x > p.x - 10 && q.x < p.x + 90);
      if (g) tx = g.x + 4;
      if (this.boss) { const b = this.boss; tx = b.st === 'dizzy' ? b.x : (p.x < b.x ? b.x - 80 : b.x + 80); tx = U.clamp(tx, this.L.arena + 12, this.L.arena + this.VW - 12); }
      let mv = Math.abs(tx - p.x) > 10 ? Math.sign(tx - p.x) : 0;
      if (p.pw === 'dizzy') mv = -mv;
      p.mv = mv;
      const d = Math.sign(tx - p.x) || p.face;
      if (p.onG && Math.abs(tx - p.x) > 10) {
        const look = p.x + d * (p.r + 8);
        const near = (ox, rg) => (ox - p.x) * d > 0 && (ox - p.x) * d < rg;
        let jump = !this.groundAt(look) && p.y + p.r >= GY - 1;
        if (this.L.crates.some((c) => c.alive && near((c.x0 + c.x1) / 2, 26) && c.y1 > p.y - p.r)) jump = true;
        if (this.L.spikes.some((s) => near(s.x0, 22) || (p.x > s.x0 - 8 && p.x < s.x1))) jump = true;
        if (this.L.foes.some((e) => e.alive && near(e.x, 30) && Math.abs(this.foeCY(e) - p.y) < 24)) jump = true;
        if (this.boss && this.boss.st !== 'dizzy' && near(this.boss.x, 40)) jump = true;
        if (jump) p.jumpBuf = 0.12;
      }
      if (this.boss && this.boss.st === 'dizzy' && p.onG && Math.abs(this.boss.x - p.x) < 30) p.jumpBuf = 0.12;
      if (p.pw === 'balloon' && !p.onG && p.vy > 40 && !this.groundAt(p.x + d * 30)) p.jumpBuf = 0.12;
      if (p.pw === 'strong' && this.L.foes.some((e) => e.alive && Math.abs(e.x - p.x - p.face * 18) < 14)) this.action(p);
    }

    // ---------- δωράκια ----------
    openGift(g, p) {
      g.open = 0.001;
      let k; let r = Math.random() * PW_TOT; k = PW_KEYS.find((q) => (r -= PW[q].w) < 0) || 'big';
      if (this.area === 1 && !this.firstGift) k = 'big';
      this.firstGift = true;
      if (k === 'heart' && this.lives >= 9) k = 'rain';
      const P = PW[k];
      g.k = k; p.gifts++;
      this.gain(p, 25, g.x, g.y - 20, null);
      this.confettiAt(g.x, g.y - 10, 18);
      this.sfx(P.bad ? 'buzz' : 'pwr');
      this.banner(`${p.name}: ${P.e} ${P.name}!${P.bad ? ' (φάρσα!)' : ''}`, P.bad ? '#ffb0a0' : '#ffe066');
      this.floatText(g.x, g.y - 30, `${P.e} ${P.name}`, P.bad ? '#ffb0a0' : '#fff6a0', true);
      if (k === 'shield') { p.shield = true; }
      else if (k === 'heart') { this.lives++; this.sfx('point'); }
      else if (k === 'rain') {
        for (let i = 0; i < 18; i++) this.L.candies.push({ x: p.x + (Math.random() - 0.5) * 160, y: -10 - Math.random() * 90, c: (Math.random() * 5) | 0, t: 0, vy: 30 + Math.random() * 40, fall: true });
      } else {
        p.pw = k; p.pwT = P.t;
        if (k === 'big' || k === 'tiny') this.sfx(k === 'big' ? 'boom' : 'zap');
      }
      this.changed();
    }
    endPower(p) {
      const k = p.pw; p.pw = ''; p.pwT = 0;
      if (k === 'big' || k === 'tiny') this.puff(p.x, p.y, 8, '#ffffff');
      this.floatText(p.x, p.y - p.r - 10, 'τέλος ' + PW[k].e, '#ffffff');
      this.changed();
    }

    // ---------- ενημέρωση ----------
    update(dt) {
      const go = this.phase === 'go', live = go || this.phase === 'won' || this.phase === 'clear';
      this.shake = Math.max(0, this.shake - dt);
      if (live) {
        if (go) for (const p of this.parts) if (p.bot) this.bot(p, dt);
        if (!go) for (const p of this.parts) p.mv = 0;
        for (const p of this.parts) this.stepPlayer(p, dt);
        this.playersBump();
        this.camera(dt);
        this.stepFoes(dt);
        this.stepItems(dt);
        if (this.boss) this.stepBoss(dt);
        if (go) this.collide();
        if (go && !this.L.arena && this.parts.some((p) => !p.dead && !p.gone && p.x >= this.L.goal - 16)) this.clearArea();
        this.syncT -= dt; if (this.syncT <= 0) { this.syncT = 1; this.changed(); }
      }
      for (const q of this.pfx) { q.life -= dt; q.vy += (q.g || 0) * dt; q.x += q.vx * dt; q.y += q.vy * dt; if (q.rot != null) q.rot += (q.vr || 0) * dt; }
      this.pfx = this.pfx.filter((q) => q.life > 0);
      for (const f of this.floats) { f.t += dt; f.y -= dt * 18; }
      this.floats = this.floats.filter((f) => f.t < 1.5);
    }

    camera(dt) {
      const L = this.L, al = this.alive();
      const max = L.arena ? L.arena : Math.max(0, L.end + 40 - this.VW);
      if (al.length) {
        const lead = Math.max(...al.map((p) => p.x));
        const t = U.clamp(lead - this.VW * 0.5, 0, max);
        if (t > this.camX) this.camX += Math.min(t - this.camX, Math.max(30, (t - this.camX) * 6) * dt);
      }
      if (L.arena && !this.bossOn && this.camX >= L.arena - 0.5) this.startBoss();
    }

    speed(p) {
      const k = { fast: 1.85, angry: 1.3, big: 0.95, tiny: 1.05 }[p.pw] || 1;
      return SPD * k;
    }

    stepPlayer(p, dt) {
      if (p.gone) return;
      if (p.dead > 0) {
        p.dead -= dt; p.vy += G * dt; p.y += p.vy * dt; p.x += p.vx * dt; p.rot += dt * 12;
        if (p.dead <= 0) this.respawn(p);
        return;
      }
      if (!this.active(p)) { p.x = Math.max(p.x, this.camX + 10); return; }
      p.inv = Math.max(0, p.inv - dt); p.dashCd -= dt; p.punchT -= dt; p.sq *= Math.max(0, 1 - dt * 9);
      p.blink -= dt; if (p.blink < -0.14) p.blink = 2 + Math.random() * 3;
      if (p.pw && PW[p.pw].t && this.phase === 'go') { p.pwT -= dt; if (p.pwT <= 0) this.endPower(p); }
      const tr = p.pw === 'big' ? R0 * 1.9 : p.pw === 'tiny' ? R0 * 0.55 : R0;
      if (Math.abs(tr - p.r) > 0.01) { const or = p.r; p.r += (tr - p.r) * Math.min(1, dt * 7); if (p.onG) p.y -= p.r - or; }
      let mv = p.mv; if (p.pw === 'dizzy') mv = -mv;
      const top = this.speed(p), ice = p.pw === 'ice';
      const acc = p.onG ? (ice ? 110 : 900) : (ice ? 200 : 600);
      if (p.dashT > 0) p.dashT -= dt;
      else p.vx += U.clamp(mv * top - p.vx, -acc * dt, acc * dt);
      if (mv) p.face = mv;
      p.look += ((mv || 0) - p.look) * Math.min(1, dt * 8);
      if (p.jumpBuf > 0) {
        p.jumpBuf -= dt;
        const jm = p.pw === 'spring' ? 1.42 : p.pw === 'tiny' ? 1.14 : p.pw === 'big' ? 1.04 : 1;
        if (p.coy > 0) {
          p.vy = -JV * jm; p.onG = false; p.coy = 0; p.jumpBuf = 0; p.air = 1; p.sq = -0.7;
          this.sfx(p.pw === 'tiny' ? 'zap' : 'blip'); this.puff(p.x, p.y + p.r, 3, '#ffffff');
        } else if (p.pw === 'beans' && p.air > 0) {
          p.air--; p.vy = -JV * 0.95; p.jumpBuf = 0; p.sq = -0.6;
          this.sfx('buzz'); this.fart(p);
        } else if (p.pw === 'balloon') {
          p.vy = Math.min(p.vy, -150); p.jumpBuf = 0; this.sfx('pump');
        }
      }
      const g = G * (p.pw === 'balloon' ? 0.32 : 1);
      p.vy = Math.min(p.vy + g * dt, p.pw === 'balloon' ? 110 : 520);
      const ox = p.x, oy = p.y;
      p.x += p.vx * dt;
      const L = this.L;
      const lo = L.arena && this.bossOn ? L.arena : this.camX, hi = L.arena && this.bossOn ? L.arena + this.VW : L.end;
      if (p.x < lo + p.r * 0.9) { p.x = lo + p.r * 0.9; if (p.vx < 0) p.vx = 0; }
      if (p.x > hi - p.r * 0.9) { p.x = hi - p.r * 0.9; if (p.vx > 0) p.vx = 0; }
      const sol = this.solids(), hw = p.r * 0.78, hh = p.r;
      for (const s of sol) {
        if (p.x + hw > s.x0 && p.x - hw < s.x1 && p.y + hh > s.y0 + 1.5 && p.y - hh < s.y1) {
          if (!s.g && (p.pw === 'angry' || p.pw === 'big' || p.dashT > 0 && p.pw === 'fast')) { this.breakCrate(s, p); continue; }
          if (ox <= (s.x0 + s.x1) / 2) p.x = s.x0 - hw; else p.x = s.x1 + hw;
          p.vx = p.dashT > 0 ? -p.vx * 0.3 : 0; p.dashT = 0;
        }
      }
      p.y += p.vy * dt;
      const was = p.onG; p.onG = false;
      for (const s of sol) {
        if (p.x + hw > s.x0 + 0.5 && p.x - hw < s.x1 - 0.5) {
          if (p.vy >= 0 && oy + hh <= s.y0 + 1 && p.y + hh >= s.y0) this.land(p, s.y0, was);
          else if (p.vy < 0 && oy - hh >= s.y1 - 1 && p.y - hh <= s.y1) {
            if (!s.g && (p.pw === 'angry' || p.pw === 'big' || p.pw === 'strong')) this.breakCrate(s, p);
            else { p.y = s.y1 + hh; p.vy = 30; this.sfx('bump'); }
          }
        }
      }
      if (p.vy >= 0) for (const q of L.plats) if (p.x > q.x0 - 2 && p.x < q.x1 + 2 && oy + hh <= q.y + 1 && p.y + hh >= q.y) this.land(p, q.y, was);
      for (const sp of L.springs) if (p.vy >= 0 && Math.abs(p.x - sp.x) < 10 + hw * 0.5 && oy + hh <= GY - 7 && p.y + hh >= GY - 8) {
        p.y = GY - 8 - hh; p.vy = -JV * 1.62; p.onG = false; p.coy = 0; p.air = 1; sp.sq = 1; p.sq = -0.9;
        this.sfx('bounce'); this.floatText(sp.x, GY - 24, 'ΜΠΟΪΝΓΚ!', '#ffe066');
      }
      p.coy = p.onG ? 0.1 : p.coy - dt;
      p.rot += (p.x - ox) / Math.max(2, p.r);
      if (p.pw === 'angry' && Math.random() < dt * 14) this.pfx.push({ k: 'steam', x: p.x + (Math.random() - 0.5) * p.r, y: p.y - p.r, vx: (Math.random() - 0.5) * 10, vy: -26, life: 0.7, max: 0.7, s: 2 + Math.random() * 2 });
      if (p.pw === 'fast' && Math.abs(p.vx) > 60 && Math.random() < dt * 30) this.pfx.push({ k: 'line', x: p.x - p.face * p.r, y: p.y + (Math.random() - 0.5) * p.r * 1.4, vx: -p.face * 40, vy: 0, life: 0.3, max: 0.3, c: p.color.hex });
      if (p.pw === 'magnet') for (const c of L.candies) { const dx = p.x - c.x, dy = p.y - c.y, d = Math.hypot(dx, dy); if (d < 90 && d > 1) { c.x += (dx / d) * 160 * dt; c.y += (dy / d) * 160 * dt; c.fall = false; } }
      if (p.y - p.r > LH + 20) this.fallOut(p);
    }

    land(p, y, was) {
      if (!was && p.vy > 160) { p.sq = Math.min(1, p.vy / 420); if (p.vy > 260) this.puff(p.x, y, p.pw === 'big' ? 8 : 3, '#ffffff'); if (p.pw === 'big' && p.vy > 200) { this.shake = 0.2; this.sfx('boom'); } }
      p.y = y - p.r; p.vy = 0; p.onG = true; p.air = 1;
    }

    playersBump() {
      const al = this.parts.filter((p) => !p.dead && !p.gone);
      for (let i = 0; i < al.length; i++) for (let j = i + 1; j < al.length; j++) {
        const a = al[i], b = al[j], dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy), m = a.r + b.r;
        if (d >= m || d < 0.01) continue;
        const [top, bot] = a.y < b.y ? [a, b] : [b, a];
        if (bot.y - top.y > m * 0.55 && top.vy > 0) { // πήδηξε στο κεφάλι του φίλου
          top.y = bot.y - m; top.vy = -JV * 0.78; top.sq = -0.7; bot.sq = 0.8; top.air = 1;
          this.sfx('bounce'); this.floatText(bot.x, bot.y - bot.r - 8, 'μπουνγκ!', '#ffffff');
        } else {
          const push = (m - d) / 2, nx = dx / d;
          a.x -= nx * push; b.x += nx * push;
        }
      }
    }

    stepFoes(dt) {
      const L = this.L, c1 = this.camX + this.VW + 50;
      for (const e of L.foes) {
        e.t += dt;
        if (e.dead) {
          e.dt += dt;
          if (e.dead === 'fly') { e.vy += G * dt; e.x += e.vx * dt; e.y += e.vy * dt; e.rot += dt * 10; }
          if (e.dt > 2) e.gone = true;
          continue;
        }
        if (!e.alive || e.x > c1) continue;
        if (e.k === 'cloud') {
          e.x += e.dir * 20 * dt; if (Math.abs(e.x - e.home) > 60) e.dir = -Math.sign(e.x - e.home);
          e.y = e.base + Math.sin(e.t * 2) * 8;
          continue;
        }
        const sp = e.k === 'spiky' ? 15 : 22, ahead = e.x + e.dir * 10;
        const blocked = !this.groundAt(ahead) || L.crates.some((c) => c.alive && ahead > c.x0 && ahead < c.x1 && c.y1 > GY - 4) || L.spikes.some((s) => ahead > s.x0 - 2 && ahead < s.x1 + 2) || L.springs.some((s) => Math.abs(ahead - s.x) < 10);
        if (blocked) e.dir = -e.dir; else e.x += e.dir * sp * dt;
        if (this.boss && e.x < L.arena + 8) e.dir = 1;
        if (this.boss && e.x > L.arena + this.VW - 8) e.dir = -1;
      }
      L.foes = L.foes.filter((e) => !e.gone && e.x > this.camX - 300);
    }
    foeCY(e) { return e.k === 'cloud' ? e.y : e.y - FOE[e.k][1] / 2; }

    stepItems(dt) {
      const L = this.L;
      for (const c of L.candies) if (c.fall) { c.vy += 300 * dt; c.y += c.vy * dt; const f = this.floorAt(c.x); if (f !== null && c.y > f - 5) { c.y = f - 5; c.fall = false; } if (c.y > LH + 30) c.gone = true; }
      L.candies = L.candies.filter((c) => !c.gone);
      for (const g of L.gifts) if (g.open) g.open += dt;
      L.gifts = L.gifts.filter((g) => !g.open || g.open < 1.2);
      for (const s of L.springs) s.sq = Math.max(0, s.sq - dt * 4);
    }

    collide() {
      const L = this.L;
      for (const p of this.parts) {
        if (p.dead || p.gone || !this.active(p)) continue;
        const r = p.r, mul = p.pw === 'mustache' ? 2 : 1;
        for (const c of L.candies) if (!c.got && Math.abs(c.x - p.x) < r + 5 && Math.abs(c.y - p.y) < r + 5) {
          c.got = true; c.gone = true; p.candies++; this.gain(p, 10 * mul, c.x, c.y, null); this.sparkle(c.x, c.y, CANDY_COLS[c.c], 4); this.sfx('tick');
        }
        for (const s of L.stars) if (!s.got && Math.abs(s.x - p.x) < r + 7 && Math.abs(s.y - p.y) < r + 7) {
          s.got = true; this.gain(p, 50 * mul, s.x, s.y - 6, `+${50 * mul}`, '#ffe066'); this.sparkle(s.x, s.y, '#ffe066', 10); this.sfx('star');
        }
        for (const g of L.gifts) if (!g.open && Math.abs(g.x - p.x) < r + 8 && p.y + r > g.y - 18 && p.y - r < g.y) this.openGift(g, p);
        if (p.inv <= 0) for (const s of L.spikes) if (p.x + r * 0.6 > s.x0 && p.x - r * 0.6 < s.x1 && p.y + r > GY - 6) {
          if (p.pw === 'big' || p.pw === 'angry') continue;
          this.hurt(p, 'spikes'); p.vy = -230; break;
        }
        for (const e of L.foes) {
          if (!e.alive || p.dead) continue;
          const [fw, fh, stomp] = FOE[e.k], cy = this.foeCY(e);
          if (Math.abs(e.x - p.x) > fw / 2 + r * 0.8 || Math.abs(cy - p.y) > fh / 2 + r * 0.85) continue;
          if (p.pw === 'ghost') continue;
          const fromTop = p.vy > 30 && p.y < cy - fh * 0.15;
          if (p.pw === 'big' || p.pw === 'angry') { this.killFoe(e, p, fromTop ? 'flat' : 'fly'); if (fromTop) p.vy = -JV * 0.5; continue; }
          if (fromTop && stomp) { this.killFoe(e, p, 'flat'); p.vy = -JV * 0.68; p.sq = -0.6; p.air = 1; continue; }
          if (p.dashT > 0 && e.k !== 'spiky') { this.killFoe(e, p, 'fly'); continue; }
          if (p.inv <= 0) this.hurt(p, e.k);
        }
      }
    }

    killFoe(e, p, how) {
      if (!e.alive) return;
      e.alive = false; e.dead = how; e.dt = 0;
      if (how === 'fly') { e.vx = (Math.sign(e.x - (p ? p.x : e.x)) || 1) * 120; e.vy = -220; }
      if (p) { p.foes++; this.gain(p, 100 * (p.pw === 'mustache' ? 2 : 1), e.x, e.y - 20, null); }
      this.sfx(how === 'flat' ? 'splat' : 'pop'); this.sparkle(e.x, this.foeCY(e), '#ffffff', 7);
      this.floatText(e.x, e.y - 26, how === 'flat' ? ['ΣΠΛΑΤΣ!', 'ΠΛΑΚΑ!', 'ΣΚΟΥΙΣ!'][(Math.random() * 3) | 0] : ['ΜΠΑΜ!', 'ΠΟΥΦ!', 'ΓΙΟΥΧΟΥ!'][(Math.random() * 3) | 0], '#ffffff');
    }
    breakCrate(c, p) {
      if (!c.alive) return;
      c.alive = false; this.sfx('boom'); this.shake = Math.max(this.shake, 0.12);
      const cx = (c.x0 + c.x1) / 2, cy = (c.y0 + c.y1) / 2;
      for (let i = 0; i < 8; i++) this.pfx.push({ k: 'plank', x: cx, y: cy, vx: (Math.random() - 0.5) * 160, vy: -80 - Math.random() * 120, g: 600, life: 1.2, max: 1.2, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 20 });
      if (p) this.gain(p, 20, cx, cy, null);
      if (Math.random() < 0.6) this.L.candies.push({ x: cx, y: cy, c: (Math.random() * 5) | 0, t: 0, vy: -100, fall: true });
    }

    hurt(p) {
      if (p.dead || p.inv > 0 || this.phase !== 'go') return;
      if (p.shield) { p.shield = false; p.inv = 1.4; this.sfx('pop'); this.sparkle(p.x, p.y, '#9adfff', 12); this.floatText(p.x, p.y - p.r - 8, 'ΠΛΟΠ! η φούσκα έσκασε', '#9adfff'); this.changed(); return; }
      this.die(p);
    }
    fallOut(p) { if (p.dead) return; if (p.bot) return this.respawn(p); this.die(p, true); }
    die(p, fell) {
      p.dead = RESPAWN; p.vx = fell ? 0 : -p.face * 40; p.vy = fell ? 0 : -260; p.pw = ''; p.shield = false;
      this.sfx('hurt'); this.shake = 0.25;
      this.floatText(p.x, Math.min(p.y, LH - 30) - 14, ['ΑΟΥΤΣ!', 'ΩΧΟΥ!', 'ΜΑΜΑ!'][(Math.random() * 3) | 0], '#ffb0b0');
      if (!p.bot) {
        this.lives--;
        if (this.lives <= 0) { this.lives = 0; this.phase = 'lost'; this.banner('Τέλος οι καρδούλες! 💔', '#ffb0a0'); this.after(2.6, () => this.finish(false)); }
      }
      this.changed();
    }
    respawn(p) {
      const al = this.alive().filter((q) => q !== p);
      let X = al.length ? Math.min(...al.map((q) => q.x)) : this.camX + 40;
      X = U.clamp(X, this.camX + 20, this.camX + this.VW - 20);
      for (let k = 0; k < 40 && !this.groundAt(X); k++) X += 8;
      Object.assign(p, { dead: 0, x: X, y: 10, vx: 0, vy: 0, inv: INVUL, rot: 0, onG: false, r: R0, dashT: 0 });
      this.changed();
    }

    // ---------- αφεντικό: ο Κύβος-Μπαμπούλας ----------
    startBoss() {
      this.bossOn = true;
      const n = this.parts.length, A = this.L.arena;
      this.boss = { x: A + this.VW * 0.7, y: -60, vx: 0, vy: 0, st: 'enter', t: 0, hp: 4 + 2 * (n - 1), max: 4 + 2 * (n - 1), flash: 0, hops: 0, face: -1, inv: 0 };
      this.banner('Ο Κύβος-Μπαμπούλας! Πήδα στο κεφάλι του όταν ζαλίζεται 😵', '#ffcf8a');
      this.sfx('buzz');
    }
    stepBoss(dt) {
      const b = this.boss, A = this.L.arena;
      b.t += dt; b.flash = Math.max(0, b.flash - dt * 3); b.inv -= dt;
      const tg = this.nearest(b.x);
      if (b.st === 'enter' || b.st === 'air') {
        b.vy += G * 0.9 * dt; b.y += b.vy * dt; b.x += b.vx * dt;
        b.x = U.clamp(b.x, A + 24, A + this.VW - 24);
        if (b.y >= GY) {
          b.y = GY; b.vy = 0; b.vx = 0; this.shake = 0.5; this.sfx('boom'); this.puff(b.x - 20, GY, 6, '#ffffff'); this.puff(b.x + 20, GY, 6, '#ffffff');
          b.hops++;
          for (const p of this.parts) if (!p.dead && p.onG && Math.abs(p.x - b.x) < 70 && p.pw !== 'ghost') { p.vy = -160; p.onG = false; }
          if (b.hops % 3 === 0) { b.st = 'dizzy'; b.t = 0; this.floatText(b.x, GY - 60, 'ζαλίστηκε! ΤΩΡΑ!', '#ffe066'); }
          else { b.st = 'idle'; b.t = 0; }
          if (b.hops % 2 === 0 && this.L.foes.filter((e) => e.alive).length < 3) { const e = { k: 'cube', x: b.x + (Math.random() < 0.5 ? -36 : 36), y: GY, dir: Math.random() < 0.5 ? -1 : 1, t: 0, alive: true, home: b.x, dead: null, dt: 0, vx: 0, vy: 0, rot: 0 }; this.L.foes.push(e); }
        }
      } else if (b.st === 'idle') {
        if (tg) b.face = Math.sign(tg.x - b.x) || b.face;
        if (b.t > 0.75) { b.st = 'air'; b.t = 0; const dx = tg ? tg.x - b.x : 0; b.vx = U.clamp(dx / 0.95, -160, 160); b.vy = -330; this.sfx('throw'); }
      } else if (b.st === 'dizzy') {
        if (b.t > 2.4) { b.st = 'idle'; b.t = 0; }
      } else if (b.st === 'die') {
        b.y += dt * 30; if (Math.random() < dt * 8) { this.sparkle(b.x + (Math.random() - 0.5) * 40, b.y - Math.random() * 40, '#ffe066', 6); this.sfx('pop'); }
        return;
      }
      // επαφή με παίκτες
      if (this.phase !== 'go') return;
      for (const p of this.parts) {
        if (p.dead || p.gone || p.pw === 'ghost') continue;
        if (Math.abs(p.x - b.x) > 22 + p.r * 0.8 || p.y + p.r < b.y - 42 || p.y - p.r > b.y) continue;
        const top = p.vy > 0 && p.y < b.y - 34;
        if (top) { p.vy = -JV * 0.9; p.sq = -0.7; this.hitBoss(p); }
        else if (p.pw === 'angry' || p.pw === 'big') { p.vx = -Math.sign(b.x - p.x) * 200; p.vy = -180; this.hitBoss(p); }
        else if (p.inv <= 0) { this.hurt(p); }
      }
    }
    hitBoss(p, punch) {
      const b = this.boss;
      if (b.inv > 0 || b.hp <= 0) return;
      b.hp--; b.inv = 0.5; b.flash = 1; this.sfx('bump'); this.sparkle(b.x, b.y - 40, '#ffe066', 10);
      this.gain(p, 300, b.x, b.y - 52, '+300', '#ffe066');
      this.floatText(b.x, b.y - 66, ['ΑΪ!', 'ΟΥΦ!', 'ΤΟ ΣΤΕΜΜΑ ΜΟΥ!', 'ΑΧ ΑΧ!'][(Math.random() * 4) | 0], '#ffffff', true);
      if (b.st === 'dizzy' && !punch) { b.st = 'idle'; b.t = -0.3; }
      if (b.hp <= 0) {
        b.st = 'die'; b.t = 0; this.phase = 'won';
        for (const e of this.L.foes) if (e.alive) this.killFoe(e, null, 'fly');
        this.gain(p, 2000, b.x, b.y - 80, '+2000', '#ffd040');
        this.banner('Νικήσατε τον Κύβο-Μπαμπούλα! 🎉', '#ffe066');
        this.celebrate('#ffe066');
        this.after(2.8, () => this.finish(true));
      }
      this.changed();
    }
    nearest(x) {
      let best = null, bd = Infinity;
      for (const p of this.parts) if (!p.dead && !p.gone) { const d = Math.abs(p.x - x); if (d < bd) { bd = d; best = p; } }
      return best;
    }

    clearArea() {
      this.phase = 'clear';
      this.sfx('finish');
      this.banner(`Μπράβο! Περάσατε ${AREAS[this.area - 1].name.toLowerCase()} 🎂`, '#9dff8a');
      for (const p of this.parts) if (!p.dead && !p.gone) this.gain(p, 500, p.x, p.y - 30, '+500', '#9dff8a');
      this.celebrate('#ffe066');
      this.changed();
      this.after(3.6, () => { if (!this.running) return; this.area++; this.startArea(); });
    }

    finish(won) {
      this.phase = 'end';
      this.parts.forEach((p) => { p.mv = 0; });
      const rank = [...this.parts].sort((a, b) => b.score - a.score || b.candies - a.candies);
      const mvp = rank[0]; mvp.hi = true;
      if (won) this.team += this.lives * 300;
      this.celebrate(won ? mvp.color.hex : '#ff9a6a');
      this.sfx(won ? 'win' : 'miss');
      this.changed();
      this.h.onOver && this.h.onOver({
        winner: mvp,
        title: won ? 'Η ομάδα τα κατάφερε! Πρώτος σε πόντους' : 'Πρώτος της ομάδας',
        icon: won ? '🏆' : '🎁',
        stats: won ? `Ομάδα: ${this.team} πόντοι · πέρασε και τους ${AREAS.length} κόσμους με ${this.lives} ❤`
          : `Ομάδα: ${this.team} πόντοι · έφτασε στον κόσμο ${this.area}/${AREAS.length}`,
        rank: rank.map((q) => ({ name: q.name, color: q.color, st: `${q.score} πόντοι · ${q.candies} καραμέλες · ${q.gifts} ${q.gifts === 1 ? 'δωράκι' : 'δωράκια'}` })),
      });
    }

    ctrl(part) {
      const P = part.pw && PW[part.pw];
      const base = {
        mode: 'plat', scoreText: `❤ ${this.lives} · ${part.score} πόντοι${part.shield ? ' · 🔵' : ''}`,
        shoot: part.pw === 'strong' ? 'ΜΠΟΥΝΙΑ 💪' : 'ΤΟΥΜΠΑ 🌀', shootOff: false,
        jump: part.pw === 'balloon' ? 'ΠΕΤΑ 🎈' : part.pw === 'beans' ? 'ΠΗΔΑ 💨' : 'ΠΗΔΑ', extra: '',
      };
      if (this.phase === 'go' && part.dead > 0) return { ...base, active: false, label: '💫 Ωχ!', sub: 'Ξαναβγαίνεις σε λίγο' };
      if (this.phase === 'go' || this.phase === 'clear' || this.phase === 'won') return { ...base, active: true, label: P ? `${P.e} ${P.name}` : '', sub: P ? P.d : 'Άνοιξε τα δωράκια 🎁' };
      return { ...base, active: false, label: this.phase === 'count' ? `Κόσμος ${this.area} · Ετοιμάσου!` : this.phase === 'lost' ? '💔 Τέλος' : 'Μπράβο!', sub: '◀ ▶ κύλα · ΠΗΔΑ · ΤΟΥΜΠΑ · άνοιξε τα δωράκια 🎁' };
    }

    // ---------- εφέ ----------
    gain(p, v, X, Y, txt, col) {
      p.score += v; this.team += v;
      if (txt !== null) this.floatText(X, Y, txt || `+${v}`, col || '#ffffff');
    }
    floatText(x, y, t, c, big) { this.floats.push({ x, y, t: 0, txt: t, c, big: !!big }); }
    sparkle(x, y, c, n) { for (let i = 0; i < n; i++) { const a = Math.random() * TAU, v = 30 + Math.random() * 60; this.pfx.push({ k: 'spark', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.5, max: 0.5, c }); } }
    puff(x, y, n, c) { for (let i = 0; i < n; i++) this.pfx.push({ k: 'puff', x: x + (Math.random() - 0.5) * 8, y, vx: (Math.random() - 0.5) * 50, vy: -10 - Math.random() * 20, life: 0.5, max: 0.5, s: 2 + Math.random() * 3, c }); }
    fart(p) {
      for (let i = 0; i < 7; i++) this.pfx.push({ k: 'puff', x: p.x - p.face * p.r * 0.6, y: p.y + p.r * 0.7, vx: (Math.random() - 0.5) * 40, vy: 20 + Math.random() * 30, life: 0.9, max: 0.9, s: 3 + Math.random() * 4, c: '#a8e86a' });
      this.floatText(p.x, p.y + p.r + 10, ['ΠΡΡΡΤ!', 'ΠΟΥΡΡ!', 'ΦΡΡΡΤ!'][(Math.random() * 3) | 0], '#c8ff8a');
    }
    confettiAt(x, y, n) { for (let i = 0; i < n; i++) { const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.2, v = 60 + Math.random() * 120; this.pfx.push({ k: 'conf', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: 260, life: 1.4, max: 1.4, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 16, c: CANDY_COLS[i % 5] }); } }

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
      const x = this.ctx, a = this.area - 1, T = LAYERS[a], t = this.time;
      this.screen();
      if (!this.skyG || this.skyA !== a) { this.skyG = lin(x, 0, 0, 0, this.H, SKY[a]); this.skyA = a; }
      x.fillStyle = this.skyG; x.fillRect(0, 0, this.W, this.H);
      this.drawSun(a);
      for (const [name, f] of [['clouds', 0.08], ['far', 0.22], ['mid', 0.5]]) {
        const img = this.layer(a, name), w = TW * this.s;
        const drift = name === 'clouds' ? t * 6 * this.s : 0;
        const off = -(((this.camX * f * this.s) + drift) % w);
        for (let X = off; X < this.W; X += w) x.drawImage(img, X, 0, w, this.H);
      }
      this.world();
      const c0 = this.camX - 30, c1 = this.camX + this.VW + 30;
      if (T.pit) { x.fillStyle = T.pit; }
      // έδαφος
      const gimg = this.layer(a, 'ground');
      for (const s of this.L.segs) {
        if (s.x1 < c0 || s.x0 > c1) continue;
        const x0 = Math.max(s.x0, c0 - 10), x1 = Math.min(s.x1, c1 + 10);
        x.save(); rr(x, s.x0, GY, s.x1 - s.x0, LH - GY + 10, 4); x.clip();
        for (let k = Math.floor(x0 / GT) * GT; k < x1; k += GT) x.drawImage(gimg, k, GY, GT + 0.3, 40);
        x.restore();
        rr(x, s.x0, GY, s.x1 - s.x0, LH - GY + 10, 4); stroke(x, 1.1);
      }
      for (const q of this.L.plats) {
        if (q.x1 < c0 || q.x0 > c1) continue;
        const w = q.x1 - q.x0;
        x.fillStyle = 'rgba(0,0,0,.15)'; ell(x, (q.x0 + q.x1) / 2, q.y + 18, w * 0.4, 2.5); x.fill();
        x.save(); rr(x, q.x0, q.y, w, 11, 5); x.clip();
        for (let k = Math.floor(q.x0 / GT) * GT; k < q.x1; k += GT) x.drawImage(gimg, k, q.y, GT + 0.3, 40);
        x.fillStyle = lin(x, 0, q.y + 5, 0, q.y + 11, [[0, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,.3)']]); x.fillRect(q.x0, q.y, w, 11);
        x.restore();
        rr(x, q.x0, q.y, w, 11, 5); stroke(x, 1);
      }
      for (const d of this.L.deco) if (d.x > c0 && d.x < c1) this.drawDeco(d, a);
      for (const s of this.L.spikes) if (s.x1 > c0 && s.x0 < c1) { const img = this.sprite('spikes'); for (let X = s.x0; X < s.x1 - 1; X += 16) x.drawImage(img, X, GY - 8, 16, 8); }
      for (const s of this.L.springs) if (s.x > c0 && s.x < c1) this.drawSpring(s);
      for (const c of this.L.crates) if (c.alive && c.x1 > c0 && c.x0 < c1) x.drawImage(this.sprite('crate'), c.x0 - 0.5, c.y0 - 0.5, 19, 19);
      if (this.L.goal) this.drawCake(this.L.goal + 20);
      for (const g of this.L.gifts) if (g.x > c0 && g.x < c1) this.drawGift(g);
      for (const c of this.L.candies) if (c.x > c0 && c.x < c1) this.put(this.sprite('candy', c.c), c.x, c.y + Math.sin(t * 3 + c.t) * 1.2, Math.sin(t * 2 + c.t) * 0.25);
      for (const s of this.L.stars) if (!s.got && s.x > c0 && s.x < c1) { const k = 1 + Math.sin(t * 5 + s.t) * 0.08; this.put(this.sprite('star'), s.x, s.y + Math.sin(t * 2.5 + s.t) * 2, Math.sin(t * 2 + s.t) * 0.2, k); }
      for (const e of this.L.foes) if (e.x > c0 && e.x < c1) this.drawFoe(e);
      if (this.boss) this.drawBoss(this.boss);
      for (const p of this.parts) if (!p.gone) this.drawBall(p);
      this.drawFx();
      this.screen();
      this.drawFloats();
      this.drawHud();
      if (this.phase === 'count') this.drawCount(this.countT, 'ΚΥΛΑ!');
    }

    drawSun(a) {
      const x = this.ctx, vh = this.vh, cx = this.W * 0.8, cy = vh * 31, r = vh * 6.5, t = this.time;
      if (a === 2) { // φεγγαράκι που κοιμάται
        circ(x, cx, cy, r); x.fillStyle = rad(x, cx, cy, r, [[0, '#fffbe0'], [1, '#ffd88a']]); x.fill(); x.lineWidth = vh * 0.4; x.strokeStyle = '#c08a4a'; x.stroke();
        x.save(); x.translate(cx, cy); x.scale(r / 10, r / 10); face(x, 0, 0, 2.6, true); x.restore();
        this.text('z', cx + r * 1.2, cy - r * 0.9 - (t * 8 % 20) * vh * 0.1, vh * 3, '#ffffff', { sw: vh * 0.5 });
        return;
      }
      x.save(); x.translate(cx, cy); x.rotate(t * 0.3);
      x.fillStyle = a === 1 ? '#ffd0e8' : '#ffe066';
      for (let i = 0; i < 12; i++) { x.rotate(TAU / 12); x.beginPath(); x.moveTo(-r * 0.18, -r * 1.12); x.lineTo(0, -r * 1.55); x.lineTo(r * 0.18, -r * 1.12); x.closePath(); x.fill(); }
      x.restore();
      circ(x, cx, cy, r); x.fillStyle = rad(x, cx, cy, r, a === 1 ? [[0, '#fffbe0'], [1, '#ffb0d8']] : [[0, '#fffbd0'], [0.6, '#ffd23a'], [1, '#ffa31a']]); x.fill();
      x.lineWidth = vh * 0.4; x.strokeStyle = '#d07a0a'; x.stroke();
      // γυαλιά ηλίου (κουλ ήλιος)
      x.fillStyle = '#1a1030';
      for (const d of [-1, 1]) { x.beginPath(); x.ellipse(cx + d * r * 0.36, cy - r * 0.12, r * 0.3, r * 0.22, 0, 0, TAU); x.fill(); }
      x.fillRect(cx - r * 0.1, cy - r * 0.2, r * 0.2, r * 0.07);
      x.fillStyle = 'rgba(255,255,255,.7)'; for (const d of [-1, 1]) { x.beginPath(); x.ellipse(cx + d * r * 0.36 - r * 0.1, cy - r * 0.2, r * 0.07, r * 0.04, -0.5, 0, TAU); x.fill(); }
      x.lineWidth = vh * 0.5; x.strokeStyle = '#7a3a0a'; x.lineCap = 'round';
      x.beginPath(); x.arc(cx, cy + r * 0.15, r * 0.38, 0.35, Math.PI - 0.35); x.stroke();
      x.fillStyle = 'rgba(255,100,120,.45)'; for (const d of [-1, 1]) { x.beginPath(); x.ellipse(cx + d * r * 0.62, cy + r * 0.25, r * 0.15, r * 0.09, 0, 0, TAU); x.fill(); }
    }

    drawDeco(d, a) {
      const x = this.ctx, X = d.x, t = this.time;
      if (a === 0) {
        if (d.k === 0) { // λουλούδι που κουνιέται
          const sw = Math.sin(t * 2 + X) * 0.15;
          x.save(); x.translate(X, GY + 1); x.rotate(sw);
          x.strokeStyle = '#2a8a24'; x.lineWidth = 1; x.beginPath(); x.moveTo(0, 0); x.lineTo(0, -14); x.stroke();
          x.fillStyle = '#ff7ab0'; for (let k = 0; k < 6; k++) { circ(x, Math.cos(k * 1.05) * 3, -14 + Math.sin(k * 1.05) * 3, 2.2); x.fill(); }
          circ(x, 0, -14, 2); x.fillStyle = '#ffe066'; x.fill(); stroke(x, 0.5); x.restore();
        } else if (d.k === 1) { // μανιταράκι με πρόσωπο
          x.fillStyle = '#fff4e0'; rr(x, X - 2.5, GY - 7, 5, 7.5, 1.5); x.fill(); stroke(x, 0.6);
          x.beginPath(); x.ellipse(X, GY - 7, 6.5, 4.5, 0, Math.PI, TAU); x.closePath(); x.fillStyle = '#ff4a4a'; x.fill(); stroke(x, 0.7);
          x.fillStyle = '#fff'; for (const [dx, dy] of [[-3, -9], [1.5, -10], [3.8, -8]]) { circ(x, X + dx, GY + dy, 0.9); x.fill(); }
          x.fillStyle = OUT; circ(x, X - 1, GY - 4, 0.45); x.fill(); circ(x, X + 1, GY - 4, 0.45); x.fill();
        } else { x.strokeStyle = '#2f9a2a'; x.lineWidth = 1.1; for (let k = -2; k <= 2; k++) { x.beginPath(); x.moveTo(X + k * 1.5, GY + 1); x.quadraticCurveTo(X + k * 2, GY - 5, X + k * 3, GY - 7 - Math.abs(k)); x.stroke(); } }
      } else if (a === 1) {
        if (d.k === 0) { x.fillStyle = '#fff'; x.fillRect(X - 0.8, GY - 14, 1.6, 14); circ(x, X, GY - 17, 4); x.fillStyle = '#ff5a8a'; x.fill(); stroke(x, 0.6); x.strokeStyle = '#fff'; x.lineWidth = 0.9; x.beginPath(); x.arc(X, GY - 17, 2, 0, 5); x.stroke(); }
        else { x.save(); x.translate(X, GY - 3); x.rotate(0.3); rr(x, -5, -3, 10, 6, 2.5); x.fillStyle = CANDY_COLS[d.k + 1]; x.fill(); stroke(x, 0.6); x.restore(); }
      } else {
        if (d.k === 0) { x.fillStyle = '#ffe680'; U.starPath(x, X, GY - 10 + Math.sin(t * 2 + X) * 2, 3, 0.45); x.fill(); stroke(x, 0.5); }
      }
    }

    drawSpring(s) {
      const x = this.ctx, X = s.x, k = s.sq;
      x.save(); x.translate(X, GY);
      x.fillStyle = '#fff2d8'; rr(x, -3, -6 + k * 2, 6, 6 - k * 2, 1.5); x.fill(); stroke(x, 0.7);
      x.scale(1 + k * 0.25, 1 - k * 0.4);
      x.beginPath(); x.ellipse(0, -6, 11, 7, 0, Math.PI, TAU); x.closePath(); x.fillStyle = rad(x, 0, -9, 11, [[0, '#ff9ab0'], [0.6, '#f0304a'], [1, '#a01030']]); x.fill(); stroke(x, 0.9);
      x.fillStyle = '#fff'; for (const [dx, dy, r] of [[-5, -9, 1.8], [2, -11, 1.5], [6, -8, 1.3]]) { circ(x, dx, dy, r); x.fill(); }
      x.fillStyle = OUT; circ(x, -2, -7.6, 0.6); x.fill(); circ(x, 2, -7.6, 0.6); x.fill();
      x.strokeStyle = OUT; x.lineWidth = 0.5; x.beginPath(); x.arc(0, -7, 1.2, 0.3, Math.PI - 0.3); x.stroke();
      x.restore();
    }

    drawGift(g) {
      const x = this.ctx, t = this.time;
      if (!g.open) {
        const bob = Math.sin(t * 3 + g.t) * 1.2, wob = Math.sin(t * 6 + g.t) * 0.06;
        x.fillStyle = 'rgba(255,255,160,.25)'; circ(x, g.x, g.y - 9, 14 + Math.sin(t * 4 + g.t) * 2); x.fill();
        this.put(this.sprite('gift', g.c), g.x, g.y - 11 + (g.y < GY ? bob : 0), wob);
        if (Math.random() < 0.05) this.pfx.push({ k: 'spark', x: g.x + (Math.random() - 0.5) * 16, y: g.y - 10 - Math.random() * 12, vx: 0, vy: -10, life: 0.5, max: 0.5, c: '#fffbd0' });
        return;
      }
      const k = g.open, P = PW[g.k];
      x.globalAlpha = Math.max(0, 1 - k / 1.2);
      this.put(this.sprite('gift', g.c), g.x, g.y - 11, 0, 1 + k * 0.4, 1 - k * 0.3);
      x.globalAlpha = 1;
      if (P) { x.save(); x.translate(g.x, g.y - 24 - k * 26); const sc = U.easeOutBack(k * 3); x.scale(sc, sc); x.font = '14px "Noto Color Emoji", sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(P.e, 0, 0); x.restore(); }
    }

    drawCake(X) {
      const x = this.ctx, t = this.time;
      // σημαία «ΤΕΡΜΑ»
      x.fillStyle = '#8a5a3a'; x.fillRect(X + 34, GY - 70, 2, 70); stroke(x, 0.5);
      x.beginPath(); x.moveTo(X + 36, GY - 70); for (let i = 0; i <= 8; i++) x.lineTo(X + 36 + i * 3, GY - 70 + Math.sin(t * 6 + i * 0.8) * 1.6); x.lineTo(X + 60, GY - 56); for (let i = 8; i >= 0; i--) x.lineTo(X + 36 + i * 3, GY - 56 + Math.sin(t * 6 + i * 0.8) * 1.6); x.closePath();
      x.fillStyle = '#ffffff'; x.fill(); stroke(x, 0.6);
      x.fillStyle = OUT; for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) if ((i + j) % 2) x.fillRect(X + 37 + i * 5.5, GY - 69 + j * 6 + Math.sin(t * 6 + i) * 1.4, 5.5, 6);
      // τούρτα
      const tiers = [[34, 14, '#ffb0d0'], [26, 12, '#fff0d8'], [18, 11, '#9adfff']];
      let y = GY;
      tiers.forEach(([w, h, c], i) => {
        rr(x, X - w / 2, y - h, w, h, 3); x.fillStyle = lin(x, 0, y - h, 0, y, [[0, sh(c, 0.3)], [1, sh(c, -0.15)]]); x.fill(); stroke(x, 0.9);
        x.beginPath(); x.moveTo(X - w / 2, y - h + 3); for (let k = 0; k <= w; k += 4) x.quadraticCurveTo(X - w / 2 + k + 2, y - h + 6 + (k % 8 ? 2 : 0), X - w / 2 + k + 4, y - h + 3); x.lineTo(X + w / 2, y - h); x.lineTo(X - w / 2, y - h); x.closePath(); x.fillStyle = '#ffffff'; x.fill();
        x.fillStyle = CANDY_COLS[i]; for (let k = 0; k < 4; k++) { circ(x, X - w / 2 + 4 + k * (w - 8) / 3, y - h / 2 + 1, 1.3); x.fill(); }
        y -= h;
      });
      // κεράκια
      for (const dx of [-5, 0, 5]) {
        x.fillStyle = '#ff7ab0'; x.fillRect(X + dx - 1, y - 8, 2, 8); x.strokeStyle = OUT; x.lineWidth = 0.4; x.strokeRect(X + dx - 1, y - 8, 2, 8);
        const f = 1 + Math.sin(t * 12 + dx) * 0.2; x.fillStyle = '#ffb020'; ell(x, X + dx, y - 10, 1.4, 2.4 * f); x.fill(); x.fillStyle = '#fff6a0'; ell(x, X + dx, y - 9.6, 0.7, 1.3 * f); x.fill();
      }
      // προσωπάκι τούρτας
      face(x, X, GY - 20, 1.6);
    }

    drawFoe(e) {
      const x = this.ctx, t = e.t;
      let fl = 1;
      if (e.dead === 'flat') { fl = Math.max(0.2, 1 - e.dt * 4); x.globalAlpha = Math.max(0, 1 - Math.max(0, e.dt - 0.5) * 2); }
      x.save(); x.translate(e.x, e.y);
      if (e.dead === 'fly') x.rotate(e.rot);
      if (e.k === 'cube') {
        // κακό ζελεδένιο κυβάκι με ένα φρύδι
        const step = Math.sin(t * 10), squish = e.dead === 'flat' ? fl : 1 + Math.sin(t * 10) * 0.04;
        x.scale(1 / Math.sqrt(squish), squish);
        if (!e.dead) for (const d of [-1, 1]) { ell(x, d * 4.5 + (d * step) * 1.2, -0.8, 3, 1.6); x.fillStyle = '#2a2a6a'; x.fill(); }
        rr(x, -8, -16, 16, 15, 3.5); x.fillStyle = lin(x, -8, -16, 8, 0, [[0, '#8ab0ff'], [0.5, '#3a5ae0'], [1, '#22308a']]); x.fill(); stroke(x, 1);
        x.fillStyle = 'rgba(255,255,255,.5)'; rr(x, -6, -14.5, 5, 2.4, 1.2); x.fill();
        const dir = e.dir < 0 ? -1 : 1;
        for (const d of [-1, 1]) { ell(x, d * 3.2 + dir * 1.2, -9, 2.4, 2.8); x.fillStyle = '#fff'; x.fill(); stroke(x, 0.5); circ(x, d * 3.2 + dir * 2, -8.6, 1.2); x.fillStyle = OUT; x.fill(); }
        x.lineWidth = 1.5; x.strokeStyle = OUT; x.beginPath(); x.moveTo(-6.4, -13.2); x.lineTo(-0.4, -11.2); x.lineTo(6.4, -13.2); x.stroke();
        x.fillStyle = '#fff'; rr(x, -3.5 + dir, -5.2, 7, 2.6, 0.8); x.fill(); stroke(x, 0.5);
        x.strokeStyle = OUT; x.lineWidth = 0.35; for (const k of [-1.2, 1.2]) { x.beginPath(); x.moveTo(k + dir, -5.2); x.lineTo(k + dir, -2.6); x.stroke(); }
      } else if (e.k === 'spiky') {
        // αγκαθούλης: καστανό μπαλάκι με αγκάθια και πονηρό χαμόγελο
        const bob = Math.abs(Math.sin(t * 8)) * 1.2;
        x.translate(0, -bob);
        x.fillStyle = '#5a3a1a';
        for (let i = 0; i < 12; i++) { const a = i * TAU / 12 + t * 0.6 * -e.dir; x.beginPath(); x.moveTo(Math.cos(a - 0.22) * 6, -6.5 + Math.sin(a - 0.22) * 6); x.lineTo(Math.cos(a) * 10.5, -6.5 + Math.sin(a) * 10.5); x.lineTo(Math.cos(a + 0.22) * 6, -6.5 + Math.sin(a + 0.22) * 6); x.closePath(); x.fillStyle = '#f2e0c0'; x.fill(); stroke(x, 0.5); }
        circ(x, 0, -6.5, 7); x.fillStyle = rad(x, 0, -6.5, 7, [[0, '#ffc08a'], [0.6, '#e07a2a'], [1, '#8a3a0a']]); x.fill(); stroke(x, 0.9);
        const dir = e.dir < 0 ? -1 : 1;
        for (const d of [-1, 1]) { ell(x, d * 2.6 + dir * 1.4, -8, 1.8, 2.2); x.fillStyle = '#fff'; x.fill(); stroke(x, 0.4); circ(x, d * 2.6 + dir * 2, -7.6, 0.95); x.fillStyle = OUT; x.fill(); }
        x.strokeStyle = OUT; x.lineWidth = 0.8; x.beginPath(); x.moveTo(-4.2 + dir, -11); x.lineTo(-1 + dir, -10); x.moveTo(4.2 + dir, -11); x.lineTo(1 + dir, -10); x.stroke();
        x.beginPath(); x.arc(dir * 1.2, -4.6, 2.4, 0.2, Math.PI - 0.2); x.stroke();
        x.fillStyle = '#fff'; x.beginPath(); x.moveTo(dir * 1.2 - 1, -3); x.lineTo(dir * 1.2 - 0.4, -1.6); x.lineTo(dir * 1.2 + 0.2, -3); x.fill();
      } else if (e.k === 'cloud') {
        // γκρινιάρικο συννεφάκι που ψιχαλίζει
        if (e.dead === 'flat') x.scale(1 + (1 - fl), fl);
        blobs(x, [[-6, 0, 5.5], [0, -3, 7], [6.5, 0, 5.5], [0, 2, 6]], { out: OUT, base: '#a8a8c8', hi: 'rgba(255,255,255,.55)' }, 0.8);
        const dir = e.dir < 0 ? -1 : 1;
        for (const d of [-1, 1]) { ell(x, d * 2.8 + dir, -1.5, 1.8, 2); x.fillStyle = '#fff'; x.fill(); circ(x, d * 2.8 + dir * 1.6, -1.2, 0.9); x.fillStyle = OUT; x.fill(); }
        x.strokeStyle = OUT; x.lineWidth = 0.9; x.beginPath(); x.moveTo(-4.8 + dir, -5); x.lineTo(-1 + dir, -3.6); x.moveTo(4.8 + dir, -5); x.lineTo(1 + dir, -3.6); x.stroke();
        x.beginPath(); x.arc(dir, 3.4, 2, Math.PI + 0.4, TAU - 0.4); x.stroke();
        if (!e.dead) { x.fillStyle = '#6ab8ff'; for (let i = 0; i < 3; i++) { const yy = 8 + ((t * 30 + i * 7) % 16); x.globalAlpha = 1 - (yy - 8) / 16; ell(x, -5 + i * 5, yy, 0.8, 1.5); x.fill(); } x.globalAlpha = 1; }
      }
      x.restore();
      x.globalAlpha = 1;
    }

    drawBoss(b) {
      const x = this.ctx, t = this.time;
      if (b.st === 'die') x.globalAlpha = Math.max(0, 1 - b.t / 2.6);
      if (b.y > 0) { x.fillStyle = 'rgba(0,0,0,.22)'; ell(x, b.x, GY + 1, 26 * Math.max(0.3, 1 - (GY - b.y) / 180), 4); x.fill(); }
      x.save(); x.translate(b.x, b.y);
      const sq = b.st === 'idle' ? 1 + Math.sin(t * 8) * 0.04 : b.st === 'air' ? 1.08 : b.st === 'dizzy' ? 0.94 : 1;
      x.scale(1 / Math.sqrt(sq), sq);
      const dir = b.face < 0 ? -1 : 1;
      for (const d of [-1, 1]) { ell(x, d * 13, -2, 7, 3.4); x.fillStyle = '#1a1a5a'; x.fill(); stroke(x, 0.8); }
      rr(x, -24, -46, 48, 44, 8); x.fillStyle = lin(x, -24, -46, 24, 0, [[0, '#a890ff'], [0.5, '#5a3ae0'], [1, '#2a1a8a']]); x.fill(); stroke(x, 1.6);
      x.fillStyle = 'rgba(255,255,255,.4)'; rr(x, -19, -43, 14, 5, 2.5); x.fill();
      if (b.flash > 0) { rr(x, -24, -46, 48, 44, 8); x.fillStyle = `rgba(255,255,255,${b.flash * 0.7})`; x.fill(); }
      // στέμμα
      x.beginPath(); x.moveTo(-14, -45); x.lineTo(-16, -60); x.lineTo(-8, -52); x.lineTo(0, -64); x.lineTo(8, -52); x.lineTo(16, -60); x.lineTo(14, -45); x.closePath();
      x.fillStyle = lin(x, 0, -64, 0, -45, [[0, '#fff3a0'], [1, '#e0a010']]); x.fill(); stroke(x, 1);
      for (const [cx, c] of [[-8, '#ff4a6a'], [0, '#4ac0ff'], [8, '#7ae05a']]) { circ(x, cx, -49, 1.8); x.fillStyle = c; x.fill(); stroke(x, 0.5); }
      // μάτια
      if (b.st === 'dizzy') {
        x.strokeStyle = OUT; x.lineWidth = 1;
        for (const d of [-1, 1]) { circ(x, d * 9, -30, 6); x.fillStyle = '#fff'; x.fill(); stroke(x, 0.8); x.beginPath(); for (let k = 0; k < 24; k++) { const a = k * 0.5 + t * 8 * d, r = k * 0.22; k ? x.lineTo(d * 9 + Math.cos(a) * r, -30 + Math.sin(a) * r) : x.moveTo(d * 9, -30); } x.stroke(); }
        for (let i = 0; i < 3; i++) { const a = t * 4 + i * TAU / 3; x.fillStyle = '#ffe066'; U.starPath(x, Math.cos(a) * 22, -70 + Math.sin(a) * 5, 3.2, 0.45); x.fill(); stroke(x, 0.5); }
      } else {
        for (const d of [-1, 1]) { ell(x, d * 9, -30, 6, 6.6); x.fillStyle = '#fff'; x.fill(); stroke(x, 0.8); circ(x, d * 9 + dir * 2.4, -29, 3); x.fillStyle = OUT; x.fill(); circ(x, d * 9 + dir * 2.4 - 1, -30.2, 0.9); x.fillStyle = '#fff'; x.fill(); }
        x.lineWidth = 3; x.strokeStyle = OUT; x.beginPath(); x.moveTo(-17, -40); x.lineTo(-3, -35); x.moveTo(17, -40); x.lineTo(3, -35); x.stroke();
      }
      // μουστάκι + δόντια
      x.fillStyle = '#2a1a10';
      for (const d of [-1, 1]) { x.beginPath(); x.moveTo(0, -20); x.quadraticCurveTo(d * 8, -24, d * 15, -18); x.quadraticCurveTo(d * 16, -14, d * 13, -15); x.quadraticCurveTo(d * 7, -19, 0, -17); x.fill(); }
      rr(x, -8, -14, 16, 6, 2); x.fillStyle = '#fff'; x.fill(); stroke(x, 0.7);
      x.strokeStyle = OUT; x.lineWidth = 0.5; for (const k of [-4, 0, 4]) { x.beginPath(); x.moveTo(k, -14); x.lineTo(k, -8); x.stroke(); }
      x.restore();
      x.globalAlpha = 1;
    }

    drawBall(p) {
      const x = this.ctx, t = this.time, r = p.r;
      if (p.dead > 0 && p.y > LH + 40) return;
      if (p.inv > 0 && !p.dead && Math.floor(t * 12) % 2) x.globalAlpha = 0.4;
      if (p.pw === 'ghost') x.globalAlpha = 0.45 + Math.sin(t * 6) * 0.1;
      const fy = this.floorAt(p.x);
      if (fy !== null && !p.dead && fy >= p.y) { const k = Math.max(0.2, 1 - (fy - p.y - r) / 90); x.fillStyle = 'rgba(0,0,0,.22)'; ell(x, p.x, fy + 0.5, r * 0.9 * k, r * 0.22 * k); x.fill(); }
      let col = p.color.hex;
      if (p.pw === 'angry') col = '#ff2a2a';
      if (p.pw === 'ice') col = '#9ae0ff';
      // μπαλόνι από πάνω
      if (p.pw === 'balloon') {
        const bx = p.x + Math.sin(t * 2) * 3, by = p.y - r - 22;
        x.strokeStyle = '#fff'; x.lineWidth = 0.6; x.beginPath(); x.moveTo(p.x, p.y - r); x.quadraticCurveTo(p.x + 3, p.y - r - 10, bx, by + 9); x.stroke();
        ell(x, bx, by, 7, 8.5); x.fillStyle = rad(x, bx, by, 8.5, [[0, '#ffd0e0'], [0.5, '#ff4a7a'], [1, '#b01040']]); x.fill(); stroke(x, 0.8);
        x.fillStyle = 'rgba(255,255,255,.7)'; ell(x, bx - 2.6, by - 3.5, 1.6, 2.4, 0.4); x.fill();
      }
      x.save();
      x.translate(p.x, p.y + r);
      let sx = 1, sy = 1;
      if (p.sq > 0) { sy = 1 - 0.28 * p.sq; sx = 1 + 0.22 * p.sq; } else if (p.sq < 0) { sy = 1 - 0.22 * p.sq; sx = 1 + 0.15 * p.sq; }
      if (p.dead) { x.translate(0, -r); x.rotate(p.rot); x.translate(0, r); }
      x.scale(sx, sy); x.translate(0, -r);
      // σώμα
      if (p.pw === 'shield' || p.shield) { circ(x, 0, 0, r * 1.45); x.fillStyle = 'rgba(160,220,255,.22)'; x.fill(); x.lineWidth = r * 0.08; x.strokeStyle = 'rgba(200,240,255,.9)'; x.stroke(); x.fillStyle = 'rgba(255,255,255,.8)'; ell(x, -r * 0.6, -r * 0.8, r * 0.25, r * 0.14, -0.6); x.fill(); }
      circ(x, 0, 0, r); x.fillStyle = rad(x, 0, 0, r, [[0, sh(col, 0.6)], [0.45, col], [1, sh(col, -0.45)]]); x.fill();
      // βούλες που γυρίζουν (δείχνουν το κύλισμα)
      x.save(); circ(x, 0, 0, r * 0.97); x.clip(); x.rotate(p.rot);
      x.fillStyle = 'rgba(255,255,255,.22)';
      for (let i = 0; i < 4; i++) { const a = i * TAU / 4; circ(x, Math.cos(a) * r * 0.72, Math.sin(a) * r * 0.72, r * 0.17); x.fill(); }
      x.restore();
      circ(x, 0, 0, r); x.lineWidth = Math.max(0.8, r * 0.11); x.strokeStyle = OUT; x.stroke();
      x.fillStyle = 'rgba(255,255,255,.8)'; ell(x, -r * 0.4, -r * 0.5, r * 0.26, r * 0.15, -0.6); x.fill();
      circ(x, -r * 0.12, -r * 0.7, r * 0.06); x.fill();
      // πρόσωπο (κοιτάζει εκεί που πηγαίνει)
      if (!p.dead) {
        const fx = p.look * r * 0.2, air = !p.onG && p.vy < -40, blink = p.blink < 0;
        const ey = -r * 0.12;
        if (p.pw === 'dizzy') {
          x.strokeStyle = OUT; x.lineWidth = r * 0.08;
          for (const d of [-1, 1]) { x.beginPath(); for (let k = 0; k < 18; k++) { const a = k * 0.6 + t * 9 * d, rr2 = k * r * 0.017; k ? x.lineTo(fx + d * r * 0.33 + Math.cos(a) * rr2, ey + Math.sin(a) * rr2) : x.moveTo(fx + d * r * 0.33, ey); } x.stroke(); }
        } else if (p.pw === 'fast') {
          x.fillStyle = '#111'; x.beginPath(); x.moveTo(fx - r * 0.62, ey - r * 0.16); x.lineTo(fx + r * 0.62, ey - r * 0.16); x.lineTo(fx + r * 0.55, ey + r * 0.12); x.quadraticCurveTo(fx + r * 0.3, ey + r * 0.26, fx + r * 0.08, ey + r * 0.08); x.lineTo(fx - r * 0.08, ey + r * 0.08); x.quadraticCurveTo(fx - r * 0.3, ey + r * 0.26, fx - r * 0.55, ey + r * 0.12); x.closePath(); x.fill();
          x.fillStyle = 'rgba(255,255,255,.6)'; ell(x, fx - r * 0.38, ey - r * 0.04, r * 0.1, r * 0.04, -0.3); x.fill(); ell(x, fx + r * 0.28, ey - r * 0.04, r * 0.1, r * 0.04, -0.3); x.fill();
        } else {
          for (const d of [-1, 1]) {
            const ex = fx + d * r * 0.32;
            if (blink) { x.strokeStyle = OUT; x.lineWidth = r * 0.08; x.beginPath(); x.arc(ex, ey, r * 0.17, 0.2, Math.PI - 0.2); x.stroke(); continue; }
            const big = air ? 1.12 : 1;
            ell(x, ex, ey, r * 0.23 * big, r * 0.3 * big); x.fillStyle = '#fff'; x.fill(); x.lineWidth = r * 0.05; x.strokeStyle = OUT; x.stroke();
            const px = ex + p.look * r * 0.07, py = ey + r * 0.04;
            circ(x, px, py, r * 0.17 * big); x.fillStyle = p.pw === 'angry' ? '#5a0000' : '#1a1030'; x.fill();
            x.fillStyle = '#fff'; circ(x, px - r * 0.06, py - r * 0.08, r * 0.065); x.fill(); circ(x, px + r * 0.06, py + r * 0.06, r * 0.03); x.fill();
          }
        }
        if (p.pw === 'angry') { x.strokeStyle = OUT; x.lineWidth = r * 0.12; for (const d of [-1, 1]) { x.beginPath(); x.moveTo(fx + d * r * 0.58, ey - r * 0.42); x.lineTo(fx + d * r * 0.12, ey - r * 0.24); x.stroke(); } }
        // μάγουλα
        x.fillStyle = 'rgba(255,90,140,.5)'; for (const d of [-1, 1]) { ell(x, fx + d * r * 0.56, r * 0.2, r * 0.15, r * 0.09); x.fill(); }
        // στόμα
        x.strokeStyle = OUT; x.lineWidth = r * 0.08; x.lineCap = 'round';
        if (p.pw === 'angry') { rr(x, fx - r * 0.24, r * 0.24, r * 0.48, r * 0.16, r * 0.05); x.fillStyle = '#fff'; x.fill(); x.lineWidth = r * 0.05; x.stroke(); x.beginPath(); x.moveTo(fx, r * 0.24); x.lineTo(fx, r * 0.4); x.stroke(); }
        else if (air || p.pw === 'dizzy' || p.pw === 'ice') { ell(x, fx, r * 0.33, r * 0.09, r * 0.12); x.fillStyle = '#7a1a2a'; x.fill(); x.lineWidth = r * 0.05; x.stroke(); }
        else { x.beginPath(); x.moveTo(fx - r * 0.16, r * 0.26); x.quadraticCurveTo(fx - r * 0.08, r * 0.38, fx, r * 0.27); x.quadraticCurveTo(fx + r * 0.08, r * 0.38, fx + r * 0.16, r * 0.26); x.stroke(); }
        if (p.pw === 'mustache') {
          x.fillStyle = '#2a1a10';
          for (const d of [-1, 1]) { x.beginPath(); x.moveTo(fx, r * 0.2); x.quadraticCurveTo(fx + d * r * 0.3, r * 0.08, fx + d * r * 0.55, r * 0.22); x.quadraticCurveTo(fx + d * r * 0.62, r * 0.05, fx + d * r * 0.7, r * 0.1); x.quadraticCurveTo(fx + d * r * 0.6, r * 0.42, fx, r * 0.3); x.fill(); }
        }
      } else {
        x.strokeStyle = OUT; x.lineWidth = r * 0.09;
        for (const d of [-1, 1]) { const ex = d * r * 0.32; x.beginPath(); x.moveTo(ex - r * 0.12, -r * 0.24); x.lineTo(ex + r * 0.12, 0); x.moveTo(ex + r * 0.12, -r * 0.24); x.lineTo(ex - r * 0.12, 0); x.stroke(); }
        ell(x, 0, r * 0.32, r * 0.12, r * 0.14); x.fillStyle = '#7a1a2a'; x.fill();
      }
      x.restore();
      // αξεσουάρ που δεν πατικώνονται
      if (!p.dead) {
        if (p.pw === 'mustache') { // ψηλό καπέλο
          x.save(); x.translate(p.x + p.look * r * 0.2, p.y - r * 0.82); x.rotate(-0.15);
          x.fillStyle = '#1a1424'; rr(x, -r * 0.42, -r * 0.85, r * 0.84, r * 0.85, r * 0.08); x.fill(); stroke(x, 0.5, '#000');
          x.fillStyle = '#ff4a6a'; x.fillRect(-r * 0.42, -r * 0.3, r * 0.84, r * 0.16);
          rr(x, -r * 0.7, -r * 0.08, r * 1.4, r * 0.16, r * 0.08); x.fillStyle = '#1a1424'; x.fill(); x.restore();
        }
        if (p.pw === 'strong') { // μπράτσα με γάντια του μποξ
          for (const d of [-1, 1]) {
            const punch = p.punchT > 0 && d === p.face ? Math.sin((0.32 - p.punchT) / 0.32 * Math.PI) * r * 1.2 : 0;
            const sx2 = p.x + d * r * 0.9, sy2 = p.y + r * 0.1, gx = p.x + d * (r * 1.45 + punch), gy = p.y - r * 0.15 + Math.sin(t * 6 + d) * 1;
            x.strokeStyle = sh(p.color.hex, -0.2); x.lineWidth = r * 0.32; x.lineCap = 'round'; x.beginPath(); x.moveTo(sx2, sy2); x.quadraticCurveTo(sx2 + d * r * 0.4, sy2 + r * 0.4, gx, gy); x.stroke();
            ell(x, sx2 + d * r * 0.3, sy2 + r * 0.12, r * 0.24, r * 0.18); x.fillStyle = sh(p.color.hex, 0.15); x.fill();
            circ(x, gx, gy, r * 0.36); x.fillStyle = rad(x, gx, gy, r * 0.36, [[0, '#ff9a9a'], [1, '#c01020']]); x.fill(); stroke(x, 0.7);
            x.fillStyle = 'rgba(255,255,255,.6)'; circ(x, gx - r * 0.1, gy - r * 0.12, r * 0.08); x.fill();
          }
        }
        if (p.pw === 'dizzy') for (let i = 0; i < 3; i++) { const a = t * 5 + i * TAU / 3; x.fillStyle = '#ffe066'; U.starPath(x, p.x + Math.cos(a) * r * 0.9, p.y - r * 1.2 + Math.sin(a) * r * 0.25, r * 0.22, 0.45); x.fill(); stroke(x, 0.4); }
        if (p.pw === 'ice') { x.fillStyle = 'rgba(200,240,255,.5)'; rr(x, p.x - r * 1.05, p.y - r * 1.05, r * 2.1, r * 2.1, r * 0.4); x.fill(); x.lineWidth = 0.6; x.strokeStyle = 'rgba(255,255,255,.9)'; x.stroke(); }
        if (p.bot) { x.strokeStyle = OUT; x.lineWidth = 0.6; x.beginPath(); x.moveTo(p.x, p.y - r); x.lineTo(p.x + 1, p.y - r - 5); x.stroke(); circ(x, p.x + 1, p.y - r - 6, 1.4); x.fillStyle = Math.floor(t * 3) % 2 ? '#ff4a4a' : '#ffe066'; x.fill(); }
        if (p.pw === 'magnet' && Math.random() < 0.2) this.pfx.push({ k: 'spark', x: p.x + (Math.random() - 0.5) * 40, y: p.y + (Math.random() - 0.5) * 40, vx: 0, vy: 0, life: 0.3, max: 0.3, c: '#ff6a8a' });
      }
      x.globalAlpha = 1;
    }

    drawFx() {
      const x = this.ctx;
      for (const q of this.pfx) {
        const k = q.life / q.max;
        x.globalAlpha = Math.min(1, k * 1.5);
        if (q.k === 'spark') { x.fillStyle = q.c; U.starPath(x, q.x, q.y, 1.6 * k + 0.4, 0.45); x.fill(); }
        else if (q.k === 'puff') { x.fillStyle = q.c; circ(x, q.x, q.y, q.s * (1.6 - k * 0.6)); x.fill(); }
        else if (q.k === 'steam') { x.fillStyle = 'rgba(255,255,255,.85)'; circ(x, q.x, q.y, q.s * (1.5 - k * 0.5)); x.fill(); }
        else if (q.k === 'line') { x.strokeStyle = q.c; x.lineWidth = 1; x.beginPath(); x.moveTo(q.x, q.y); x.lineTo(q.x - q.vx * 0.15, q.y); x.stroke(); }
        else if (q.k === 'plank') { x.save(); x.translate(q.x, q.y); x.rotate(q.rot); x.fillStyle = '#d89a5a'; x.fillRect(-4, -1.2, 8, 2.4); x.strokeStyle = OUT; x.lineWidth = 0.4; x.strokeRect(-4, -1.2, 8, 2.4); x.restore(); }
        else if (q.k === 'conf') { x.save(); x.translate(q.x, q.y); x.rotate(q.rot); x.fillStyle = q.c; x.fillRect(-1.6, -1, 3.2, 2); x.restore(); }
      }
      x.globalAlpha = 1;
    }

    drawFloats() {
      const vh = this.vh, s = this.s;
      for (const f of this.floats) {
        const k = f.t / 1.5, X = (f.x - this.camX) * s, Y = f.y * s;
        this.ctx.globalAlpha = Math.max(0, 1 - Math.max(0, k - 0.6) / 0.4);
        const sc = U.easeOutBack(Math.min(1, f.t * 5));
        this.text(f.txt, X, Y, vh * (f.big ? 4.2 : 2.8) * sc, f.c);
      }
      this.ctx.globalAlpha = 1;
      // ονόματα πάνω από τις μπαλίτσες
      for (const p of this.parts) {
        if (p.dead || p.gone) continue;
        const X = (p.x - this.camX) * s, Y = (p.y - p.r - (p.pw === 'balloon' ? 34 : p.pw === 'mustache' ? 16 : 7)) * s;
        this.text(p.name, X, Y, vh * 2, p.color.hex, { sw: vh * 0.5 });
      }
    }

    drawHud() {
      const x = this.ctx, vh = this.vh, W = this.W, n = this.parts.length;
      const top = vh * 8.2;
      const pw = Math.min((W * 0.68 - vh * 1.4 * (n - 1)) / n, vh * 32), ph = vh * 7.6, gap = vh * 1.4;
      let X = vh * 2.5;
      for (const p of this.parts) {
        const c = p.color.hex;
        U.rr(x, X, top, pw, ph, vh * 1.8); x.fillStyle = 'rgba(40,16,50,.62)'; x.fill();
        x.lineWidth = vh * 0.3; x.strokeStyle = p.dead > 0 ? 'rgba(255,255,255,.2)' : c; x.stroke();
        // μικρή μπαλίτσα-εικονίδιο
        const bx = X + vh * 3, by = top + ph / 2, br = vh * 2;
        x.beginPath(); x.arc(bx, by, br, 0, TAU); x.fillStyle = c; x.fill(); x.lineWidth = vh * 0.3; x.strokeStyle = OUT; x.stroke();
        x.fillStyle = '#fff'; for (const d of [-1, 1]) { x.beginPath(); x.ellipse(bx + d * br * 0.32, by - br * 0.1, br * 0.2, br * 0.27, 0, 0, TAU); x.fill(); }
        x.fillStyle = OUT; for (const d of [-1, 1]) { x.beginPath(); x.arc(bx + d * br * 0.32, by - br * 0.05, br * 0.12, 0, TAU); x.fill(); }
        x.font = this.font(vh * 2.2); x.textAlign = 'left'; x.textBaseline = 'middle'; x.fillStyle = sh(c, 0.35);
        let nm = p.name + (p.bot ? ' 🤖' : ''); while (x.measureText(nm).width > pw * 0.5 && nm.length > 2) nm = nm.slice(0, -2) + '…';
        x.fillText(nm, X + vh * 5.8, top + vh * 2.4);
        x.textAlign = 'right'; x.fillStyle = '#fff'; x.font = this.font(vh * 2.2, 800);
        x.fillText(String(p.score).padStart(5, '0'), X + pw - vh * 1.4, top + vh * 2.4);
        const P = p.pw && PW[p.pw];
        if (P) {
          x.textAlign = 'left'; x.font = this.font(vh * 2.2, 400); x.fillStyle = '#fff';
          x.fillText(P.e + (p.shield ? '🔵' : ''), X + vh * 5.8, top + vh * 5.3);
          const bw = pw - vh * 11.5, bxx = X + vh * 9.3, byy = top + vh * 4.6, k = U.clamp(p.pwT / P.t, 0, 1);
          U.rr(x, bxx, byy, bw, vh * 1.4, vh * 0.7); x.fillStyle = 'rgba(255,255,255,.15)'; x.fill();
          U.rr(x, bxx, byy, Math.max(vh * 1.4, bw * k), vh * 1.4, vh * 0.7); x.fillStyle = P.bad ? '#ff8a6a' : '#ffe066'; x.fill();
        } else if (p.shield) { x.textAlign = 'left'; x.font = this.font(vh * 2.2, 400); x.fillText('🔵', X + vh * 5.8, top + vh * 5.3); }
        X += pw + gap;
      }
      // πάνω δεξιά: καρδούλες + πρόοδος
      const rx = W - vh * 2.5, L = this.L;
      const hs = vh * 1.6, shown = Math.min(this.lives, 9);
      for (let i = 0; i < shown; i++) this.heart(rx - hs - i * hs * 2.5, top + vh * 2.3, hs);
      const label = `${this.area}/${AREAS.length} · ${AREAS[this.area - 1].name}`;
      this.text(label, rx, top + vh * 6, vh * 2.4, '#fff6c0', { align: 'right' });
      const len = L.arena || L.goal, mw = vh * 28, mx = rx - mw - vh * 3, my = top + vh * 8.8;
      U.rr(x, mx, my, mw, vh * 1, vh * 0.5); x.fillStyle = 'rgba(40,16,50,.6)'; x.fill();
      for (const p of this.parts) {
        if (p.gone) continue;
        const k = U.clamp(p.x / len, 0, 1);
        x.beginPath(); x.arc(mx + k * mw, my + vh * 0.5, vh * 0.9, 0, TAU); x.fillStyle = p.color.hex; x.fill(); x.lineWidth = 1.5; x.strokeStyle = '#fff'; x.stroke();
      }
      x.font = this.font(vh * 2, 400); x.textAlign = 'right'; x.fillText(L.arena ? '👑' : '🎂', rx, my + vh * 0.5);
      const b = this.boss;
      if (b && b.st !== 'enter') {
        const bw = W * 0.4, bx = (W - bw) / 2, by = this.H - vh * 6;
        this.text('Ο ΚΥΒΟΣ-ΜΠΑΜΠΟΥΛΑΣ', W / 2, by - vh * 2.2, vh * 2.6, '#d8c8ff');
        U.rr(x, bx, by, bw, vh * 2, vh * 1); x.fillStyle = 'rgba(20,10,40,.75)'; x.fill(); x.lineWidth = 2; x.strokeStyle = '#d8c8ff'; x.stroke();
        const k = Math.max(0, b.hp / b.max);
        if (k > 0) { U.rr(x, bx + 3, by + 3, (bw - 6) * k, vh * 2 - 6, vh * 0.8); x.fillStyle = lin(x, 0, by, 0, by + vh * 2, [[0, '#b8a0ff'], [1, '#5a3ae0']]); x.fill(); }
      }
    }
    heart(cx, cy, s) {
      const x = this.ctx;
      x.beginPath(); x.moveTo(cx, cy + s * 0.9);
      x.bezierCurveTo(cx - s * 1.6, cy - s * 0.2, cx - s * 0.9, cy - s * 1.4, cx, cy - s * 0.5);
      x.bezierCurveTo(cx + s * 0.9, cy - s * 1.4, cx + s * 1.6, cy - s * 0.2, cx, cy + s * 0.9); x.closePath();
      x.fillStyle = rad(x, cx, cy, s * 1.4, [[0, '#ffb0d0'], [0.5, '#ff3a8a'], [1, '#a0105a']]); x.fill();
      x.lineWidth = s * 0.22; x.strokeStyle = OUT; x.stroke();
      x.fillStyle = 'rgba(255,255,255,.7)'; x.beginPath(); x.ellipse(cx - s * 0.5, cy - s * 0.45, s * 0.22, s * 0.14, -0.6, 0, TAU); x.fill();
    }
  }

  Mini.games.ball = BallGame;
})();
