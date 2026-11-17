// «Διαστημική περιπολία»: συνεργατικό shoot 'em up με ρεαλιστικά γραφικά (φωτισμός, λέιζερ, νεφελώματα, εκρήξεις).
// Όλοι τα διαστημόπλοια μαζί· joystick για κίνηση, αυτόματη βολή, «ΒΟΜΒΑ» καθαρίζει την οθόνη.
// 6 κύματα (το 3ο και το 6ο είναι «αφεντικά»). Κοινές ζωές για την ομάδα· αν τελειώσουν, χάνετε.
(function () {
  'use strict';
  const { Base, U } = Mini;
  const LW = 384, LH = 216;                 // μονάδες κόσμου (16:9)
  const SPEED = 140, FIRE = 0.15, BUL_V = 300;
  const RESPAWN = 2.0, INVUL = 2.4, WAVES = 6;
  const TAU = Math.PI * 2;
  // μέγεθος (σε μονάδες κόσμου) κάθε sprite
  const SIZE = { ship: [18, 20], bug1: [16, 14], bug2: [16, 14], jelly: [15, 13], gem: [13, 16], crab: [64, 38], eye: [54, 44] };

  // ---------- ζωγραφική των sprites (σε υψηλή ανάλυση, μία φορά) ----------
  const sh = (c, a) => U.shade(c, a);
  function metal(x, x0, x1, col) {
    const g = x.createLinearGradient(x0, 0, x1, 0);
    g.addColorStop(0, sh(col, -0.75)); g.addColorStop(0.3, sh(col, -0.15)); g.addColorStop(0.48, sh(col, 0.65));
    g.addColorStop(0.62, sh(col, 0.05)); g.addColorStop(1, sh(col, -0.8));
    return g;
  }
  function ball(x, cx, cy, r, col, hi = 0.7, lo = -0.75) {
    const g = x.createRadialGradient(cx - r * 0.35, cy - r * 0.4, r * 0.05, cx, cy, r);
    g.addColorStop(0, sh(col, hi)); g.addColorStop(0.45, col); g.addColorStop(1, sh(col, lo));
    return g;
  }
  function lamp(x, cx, cy, r, col) {
    const g = x.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, '#fff'); g.addColorStop(0.25, col); g.addColorStop(1, U.rgba(col, 0));
    x.fillStyle = g; x.beginPath(); x.arc(cx, cy, r, 0, TAU); x.fill();
  }
  const PAINT = {
    ship(x, col) {
      const steel = '#9aa6bd';
      // φτερά
      x.beginPath(); x.moveTo(0, -3); x.lineTo(8.6, 4.5); x.lineTo(8.8, 8); x.lineTo(2.5, 6.4); x.lineTo(-2.5, 6.4); x.lineTo(-8.8, 8); x.lineTo(-8.6, 4.5); x.closePath();
      x.fillStyle = metal(x, -9, 9, col); x.fill();
      x.lineWidth = 0.25; x.strokeStyle = 'rgba(0,0,0,.6)'; x.stroke();
      // γραμμές πάνελ
      x.strokeStyle = 'rgba(255,255,255,.25)'; x.lineWidth = 0.2;
      x.beginPath(); x.moveTo(-3, 0); x.lineTo(-7.8, 5.2); x.moveTo(3, 0); x.lineTo(7.8, 5.2); x.stroke();
      // κανόνια στα φτερά
      x.fillStyle = metal(x, -8.6, -7.4, steel); x.fillRect(-8.4, 1.2, 1, 6);
      x.fillStyle = metal(x, 7.4, 8.6, steel); x.fillRect(7.4, 1.2, 1, 6);
      // άτρακτος
      x.beginPath(); x.moveTo(0, -9.6); x.quadraticCurveTo(3.2, -3, 2.8, 7); x.lineTo(-2.8, 7); x.quadraticCurveTo(-3.2, -3, 0, -9.6); x.closePath();
      x.fillStyle = metal(x, -3, 3, steel); x.fill(); x.strokeStyle = 'rgba(0,0,0,.6)'; x.lineWidth = 0.25; x.stroke();
      // χρωματιστή λωρίδα
      x.beginPath(); x.moveTo(-0.7, 0.5); x.lineTo(0.7, 0.5); x.lineTo(1.2, 6.5); x.lineTo(-1.2, 6.5); x.closePath();
      x.fillStyle = metal(x, -1.2, 1.2, col); x.fill();
      // πιλοτήριο
      x.beginPath(); x.ellipse(0, -3.2, 1.35, 3, 0, 0, TAU);
      const gl = x.createLinearGradient(0, -6.2, 0, 0);
      gl.addColorStop(0, '#d9fbff'); gl.addColorStop(0.35, '#3fb4e6'); gl.addColorStop(1, '#06233a');
      x.fillStyle = gl; x.fill(); x.strokeStyle = 'rgba(0,0,0,.7)'; x.lineWidth = 0.3; x.stroke();
      x.fillStyle = 'rgba(255,255,255,.75)'; x.beginPath(); x.ellipse(-0.45, -4.4, 0.35, 1.1, -0.2, 0, TAU); x.fill();
      // ακροφύσια
      for (const s of [-1.5, 1.5]) { x.fillStyle = '#23262f'; x.fillRect(s - 0.9, 6.6, 1.8, 1.6); x.fillStyle = '#ffb14a'; x.fillRect(s - 0.6, 7.6, 1.2, 0.5); }
      // φώτα στις άκρες
      lamp(x, -8.7, 7.8, 1, '#ff3b3b'); lamp(x, 8.7, 7.8, 1, '#3bff7a');
    },
    bug(x, col, frame, armored) {
      // διάφανα φτερά που χτυπούν
      const wa = frame ? 0.55 : 0.2;
      for (const s of [-1, 1]) {
        x.save(); x.translate(s * 2.5, -1.5); x.rotate(s * (0.9 + wa));
        const g = x.createLinearGradient(0, 0, 0, -7);
        g.addColorStop(0, 'rgba(220,240,255,.55)'); g.addColorStop(1, 'rgba(160,200,255,.12)');
        x.fillStyle = g; x.beginPath(); x.ellipse(0, -3.6, 1.9, 4, 0, 0, TAU); x.fill();
        x.strokeStyle = 'rgba(255,255,255,.35)'; x.lineWidth = 0.2; x.stroke(); x.restore();
      }
      // πόδια
      x.strokeStyle = sh(col, -0.6); x.lineWidth = 0.6; x.lineCap = 'round';
      for (const s of [-1, 1]) for (let i = 0; i < 3; i++) {
        x.beginPath(); x.moveTo(s * 2.5, -0.5 + i * 1.8); x.quadraticCurveTo(s * 5.8, -1 + i * 2.2, s * (5 + (frame ? 0.6 : 0)), 3 + i * 1.6); x.stroke();
      }
      // κοιλιά
      x.beginPath(); x.ellipse(0, 2.2, 3.3, 4.4, 0, 0, TAU); x.fillStyle = ball(x, 0, 2.2, 4.4, sh(col, -0.15)); x.fill();
      x.strokeStyle = 'rgba(0,0,0,.35)'; x.lineWidth = 0.3;
      for (let i = 0; i < 3; i++) { x.beginPath(); x.ellipse(0, 1.2 + i * 1.6, 3 - i * 0.5, 0.6, 0, 0, Math.PI); x.stroke(); }
      // κεφάλι / θώρακας
      x.beginPath(); x.ellipse(0, -2.6, 3.6, 3, 0, 0, TAU); x.fillStyle = ball(x, 0, -2.6, 3.8, col); x.fill();
      x.strokeStyle = 'rgba(0,0,0,.5)'; x.lineWidth = 0.25; x.stroke();
      if (armored) {
        x.fillStyle = metal(x, -3, 3, '#b8c0d0');
        x.beginPath(); x.moveTo(-3.2, -3.4); x.lineTo(0, -5.8); x.lineTo(3.2, -3.4); x.lineTo(0, -4.4); x.closePath(); x.fill();
        for (const s of [-1, 1]) { x.beginPath(); x.moveTo(s * 2.2, -4.8); x.lineTo(s * 3.8, -7); x.lineTo(s * 3, -4.2); x.closePath(); x.fill(); }
      }
      // σαγόνια
      x.fillStyle = sh(col, -0.5);
      for (const s of [-1, 1]) { x.beginPath(); x.moveTo(s * 0.8, 0); x.quadraticCurveTo(s * 2.2, 0.8, s * 0.6, 1.9); x.lineTo(s * 0.3, 0.6); x.fill(); }
      // λαμπερά μάτια
      for (const s of [-1, 1]) lamp(x, s * 1.5, -2.2, 1.6, armored ? '#ffdf4a' : '#ff3b3b');
    },
    jelly(x, col) {
      const g = x.createRadialGradient(0, -2.5, 0.5, 0, 0, 7.5);
      g.addColorStop(0, U.rgba('#ffffff', 0.9)); g.addColorStop(0.3, U.rgba(col, 0.75)); g.addColorStop(1, U.rgba(sh(col, -0.5), 0.25));
      x.beginPath(); x.moveTo(-7, 3); x.bezierCurveTo(-7.4, -7, 7.4, -7, 7, 3);
      for (let i = 6; i >= -6; i -= 2) x.quadraticCurveTo(i + 1, 4.6, i, 3);
      x.closePath(); x.fillStyle = g; x.fill();
      x.strokeStyle = U.rgba('#ffffff', 0.45); x.lineWidth = 0.3; x.stroke();
      // εσωτερικά όργανα που λάμπουν
      lamp(x, 0, -1, 3.4, '#fff7c2');
      x.strokeStyle = U.rgba(sh(col, 0.6), 0.6); x.lineWidth = 0.35;
      for (let i = -2; i <= 2; i++) { x.beginPath(); x.moveTo(i * 1.2, -3.8); x.quadraticCurveTo(i * 2.4, -1, i * 2.6, 2.8); x.stroke(); }
      x.fillStyle = 'rgba(255,255,255,.6)'; x.beginPath(); x.ellipse(-2.6, -3.4, 1, 1.8, -0.6, 0, TAU); x.fill();
    },
    gem(x, col) {
      const P = [[0, -8], [5.6, -2], [4, 6], [0, 8], [-4, 6], [-5.6, -2]];
      const c = [0, 0.6];
      const shades = [0.55, -0.1, -0.55, -0.35, 0.2, 0.75];
      for (let i = 0; i < 6; i++) {
        const a = P[i], b = P[(i + 1) % 6];
        x.beginPath(); x.moveTo(c[0], c[1]); x.lineTo(a[0], a[1]); x.lineTo(b[0], b[1]); x.closePath();
        x.fillStyle = sh(col, shades[i]); x.fill();
        x.strokeStyle = 'rgba(255,255,255,.35)'; x.lineWidth = 0.2; x.stroke();
      }
      lamp(x, 0, 0.6, 4.2, '#ff5050');
      x.fillStyle = 'rgba(255,255,255,.8)'; x.beginPath(); x.moveTo(-1.2, -6); x.lineTo(-3.6, -2.2); x.lineTo(-2.2, -2); x.closePath(); x.fill();
    },
    crab(x, col) {
      const steel = '#7d8aa3';
      // δαγκάνες
      for (const s of [-1, 1]) {
        x.save(); x.scale(s, 1);
        x.beginPath(); x.moveTo(14, -2); x.quadraticCurveTo(26, -6, 28, 6); x.lineTo(24, 4); x.quadraticCurveTo(22, -1, 14, 4); x.closePath();
        x.fillStyle = metal(x, 14, 30, col); x.fill(); x.strokeStyle = 'rgba(0,0,0,.6)'; x.lineWidth = 0.4; x.stroke();
        x.beginPath(); x.moveTo(28, 6); x.quadraticCurveTo(31, 13, 25, 17); x.quadraticCurveTo(27, 11, 24.5, 8); x.closePath();
        x.fillStyle = metal(x, 24, 31, sh(col, 0.15)); x.fill(); x.stroke();
        x.beginPath(); x.moveTo(24, 4); x.quadraticCurveTo(20, 12, 23, 16); x.quadraticCurveTo(19, 11, 21.5, 5); x.closePath();
        x.fillStyle = metal(x, 19, 24, sh(col, -0.1)); x.fill(); x.stroke();
        // πόδια
        x.strokeStyle = sh(col, -0.5); x.lineWidth = 1.2; x.lineCap = 'round';
        for (let i = 0; i < 3; i++) { x.beginPath(); x.moveTo(10 + i * 2, 8); x.lineTo(15 + i * 3, 14 + i); x.lineTo(14 + i * 3, 18); x.stroke(); }
        x.restore();
      }
      // κύριο σώμα
      x.beginPath(); x.ellipse(0, 2, 17, 11, 0, 0, TAU);
      x.fillStyle = ball(x, 0, 2, 18, col, 0.5, -0.8); x.fill(); x.strokeStyle = 'rgba(0,0,0,.6)'; x.lineWidth = 0.5; x.stroke();
      // θωράκιση
      x.strokeStyle = 'rgba(0,0,0,.35)'; x.lineWidth = 0.4;
      for (let i = 0; i < 3; i++) { x.beginPath(); x.ellipse(0, 2 + i * 3, 15 - i * 3, 7 - i * 2, 0, Math.PI * 1.05, Math.PI * 1.95); x.stroke(); }
      // μεταλλική πλάκα με πυργίσκους
      x.beginPath(); x.moveTo(-9, 6); x.lineTo(9, 6); x.lineTo(6, 12); x.lineTo(-6, 12); x.closePath();
      x.fillStyle = metal(x, -9, 9, steel); x.fill(); x.stroke();
      for (const s of [-6, 0, 6]) { x.fillStyle = metal(x, s - 1, s + 1, '#555e70'); x.fillRect(s - 0.8, 10, 1.6, 5); }
      // μάτια σε κοτσάνια
      for (const s of [-1, 1]) {
        x.strokeStyle = sh(col, -0.3); x.lineWidth = 1.4; x.beginPath(); x.moveTo(s * 4, -6); x.lineTo(s * 6, -13); x.stroke();
        x.fillStyle = ball(x, s * 6, -13.5, 2.4, '#f2f2f2', 0.4, -0.5); x.beginPath(); x.arc(s * 6, -13.5, 2.3, 0, TAU); x.fill();
        x.fillStyle = '#111'; x.beginPath(); x.arc(s * 6, -13, 1, 0, TAU); x.fill();
      }
    },
    eye(x, col) {
      // πλοκάμια (το βασικό σχήμα· κινούνται ζωντανά από πάνω)
      // εξωτερικός οργανικός δακτύλιος
      x.beginPath();
      for (let i = 0; i <= 40; i++) { const a = (i / 40) * TAU, r = 20 + Math.sin(a * 7) * 1.4; i ? x.lineTo(Math.cos(a) * r * 1.15, Math.sin(a) * r * 0.92) : x.moveTo(Math.cos(a) * r * 1.15, Math.sin(a) * r * 0.92); }
      x.closePath(); x.fillStyle = ball(x, 0, 0, 24, sh(col, -0.35), 0.3, -0.85); x.fill();
      // βολβός
      x.beginPath(); x.arc(0, 0, 15, 0, TAU);
      const g = x.createRadialGradient(-5, -6, 1, 0, 0, 15);
      g.addColorStop(0, '#ffffff'); g.addColorStop(0.55, '#f2dcd8'); g.addColorStop(0.85, '#c98a8a'); g.addColorStop(1, '#6b2630');
      x.fillStyle = g; x.fill();
      // φλέβες
      x.strokeStyle = 'rgba(190,20,40,.55)'; x.lineWidth = 0.35;
      for (let i = 0; i < 14; i++) {
        const a = (i / 14) * TAU + 0.2;
        x.beginPath(); x.moveTo(Math.cos(a) * 15, Math.sin(a) * 15);
        x.quadraticCurveTo(Math.cos(a + 0.3) * 11, Math.sin(a + 0.3) * 11, Math.cos(a - 0.1) * 8.5, Math.sin(a - 0.1) * 8.5); x.stroke();
      }
    },
  };

  // λάμψη (radial) ανά χρώμα, για additive φωτισμό
  const glowC = new Map();
  function glow(col) {
    let c = glowC.get(col); if (c) return c;
    c = document.createElement('canvas'); c.width = c.height = 64;
    const x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.18, U.rgba(col, 0.9)); g.addColorStop(0.45, U.rgba(col, 0.28)); g.addColorStop(1, U.rgba(col, 0));
    x.fillStyle = g; x.fillRect(0, 0, 64, 64);
    glowC.set(col, c); return c;
  }

  class SpaceGame extends Base {
    constructor(c, h) {
      super(c, h);
      this.WIN = 0;
      this.stars = Array.from({ length: 120 }, () => ({ x: U.rand(0, LW), y: U.rand(0, LH), z: U.pick([1, 1, 1, 2, 2, 3]), tw: U.rand(0, 6) }));
      this.planet = { x: LW * 0.82, y: LH * 0.3, r: 34 };
    }

    resize() {
      super.resize();
      const s = Math.min(this.W / LW, this.H / LH);
      this.scale = s; this.ox = (this.W - LW * s) / 2; this.oy = (this.H - LH * s) / 2;
      this.dpr = this.c.width / this.W;
      this.R = s * this.dpr;            // pixels ανά μονάδα κόσμου
      this.sprC = new Map();
      this.bg = null;
    }

    // sprite σε ανάλυση οθόνης (cache ανά όνομα/χρώμα/καρέ)
    sprite(name, col, frame = 0) {
      const key = name + col + frame;
      let c = this.sprC.get(key);
      if (c) return c;
      const [w, h] = SIZE[name], R = Math.min(this.R, 8);
      c = document.createElement('canvas'); c.width = Math.ceil(w * R); c.height = Math.ceil(h * R);
      const x = c.getContext('2d');
      x.scale(R, R); x.translate(w / 2, h / 2);
      if (name === 'bug1' || name === 'bug2') PAINT.bug(x, col, frame, name === 'bug2'); else PAINT[name](x, col);
      c.w = w; c.h = h;
      this.sprC.set(key, c);
      return c;
    }

    // φόντο: νεφελώματα + μακρινά αστέρια, σε πλακίδιο που κυλά κάθετα
    background() {
      if (this.bg) return this.bg;
      const R = Math.min(this.R, 4), W = LW, H = LH * 2;
      const c = document.createElement('canvas'); c.width = Math.ceil(W * R); c.height = Math.ceil(H * R);
      const x = c.getContext('2d'); x.scale(R, R);
      const base = x.createLinearGradient(0, 0, 0, H);
      base.addColorStop(0, '#030212'); base.addColorStop(0.5, '#07061c'); base.addColorStop(1, '#030212');
      x.fillStyle = base; x.fillRect(0, 0, W, H);
      x.globalCompositeOperation = 'lighter';
      const cols = ['#5a1e8c', '#1c3f9e', '#0f6b7a', '#8c1e5a', '#2a1e8c'];
      let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
      for (let i = 0; i < 46; i++) {
        // σύννεφα κοντά στις άκρες, πιο αραιά στο κέντρο, και ίδια πάνω/κάτω για να «κολλάει» το πλακίδιο
        const cx = rnd() * W, cy = rnd() * H, r = 20 + rnd() * 70, col = cols[(rnd() * cols.length) | 0], a = 0.05 + rnd() * 0.1;
        for (const yy of [cy, cy - H, cy + H]) {
          const g = x.createRadialGradient(cx, yy, 0, cx, yy, r);
          g.addColorStop(0, U.rgba(col, a)); g.addColorStop(1, U.rgba(col, 0));
          x.fillStyle = g; x.fillRect(cx - r, yy - r, r * 2, r * 2);
        }
      }
      for (let i = 0; i < 700; i++) {
        const sx = rnd() * W, sy = rnd() * H, b = rnd();
        x.fillStyle = `rgba(${200 + b * 55},${200 + b * 55},255,${0.15 + b * 0.55})`;
        x.fillRect(sx, sy, 0.35 + b * 0.35, 0.35 + b * 0.35);
      }
      x.globalCompositeOperation = 'source-over';
      // πλανήτης (ξεχωριστό canvas)
      const pr = this.planet.r, pc = document.createElement('canvas');
      pc.width = pc.height = Math.ceil(pr * 2.8 * R);
      const p = pc.getContext('2d'); p.scale(R, R); p.translate(pr * 1.4, pr * 1.4);
      const at = p.createRadialGradient(0, 0, pr * 0.9, 0, 0, pr * 1.4);
      at.addColorStop(0, 'rgba(90,170,255,.45)'); at.addColorStop(1, 'rgba(90,170,255,0)');
      p.fillStyle = at; p.beginPath(); p.arc(0, 0, pr * 1.4, 0, TAU); p.fill();
      p.save(); p.beginPath(); p.arc(0, 0, pr, 0, TAU); p.clip();
      const sg = p.createRadialGradient(-pr * 0.4, -pr * 0.4, pr * 0.1, 0, 0, pr);
      sg.addColorStop(0, '#9fd2ff'); sg.addColorStop(0.5, '#2f6fb8'); sg.addColorStop(1, '#0b1f45');
      p.fillStyle = sg; p.fillRect(-pr, -pr, pr * 2, pr * 2);
      p.globalAlpha = 0.35;
      for (let i = 0; i < 9; i++) { p.fillStyle = i % 2 ? '#d9ecff' : '#1b4f8a'; p.beginPath(); p.ellipse(rnd() * pr - pr / 2, -pr + i * pr * 0.24, pr * (0.6 + rnd() * 0.6), pr * 0.06, 0.12, 0, TAU); p.fill(); }
      p.globalAlpha = 1;
      const night = p.createLinearGradient(-pr, -pr, pr, pr);
      night.addColorStop(0.35, 'rgba(0,0,10,0)'); night.addColorStop(0.85, 'rgba(0,0,10,.92)');
      p.fillStyle = night; p.fillRect(-pr, -pr, pr * 2, pr * 2);
      p.restore();
      this.planetC = pc;
      return (this.bg = c);
    }

    active(p) { return p.bot || !p.p || p.p.connected; }

    setup() {
      const n = this.parts.length;
      this.humans = this.parts.filter((p) => !p.bot).length;
      this.lives = 3 + this.humans;
      this.hpMul = 1 + 0.4 * (n - 1);
      this.team = 0;
      this.wave = 0;
      this.shake = 0;
      this.zapT = 0; this.fxp = [];
      this.parts.forEach((p, i) => Object.assign(p, {
        kills: 0, deaths: 0, bombs: 2, lvl: 1, jx: 0, jy: 0, fireT: i * 0.04, botT: 0,
        x: LW * (i + 1) / (n + 1), y: LH - 26, dead: 0, inv: 0, status: '', hi: false,
      }));
      this.nextWave();
    }

    nextWave() {
      this.wave++;
      this.enemies = []; this.ebul = []; this.pbul = []; this.items = []; this.boom = []; this.floats = []; this.spawnQ = []; this.fxp = this.fxp || [];
      this.boss = null; this.waveT = 0;
      this.parts.forEach((p) => { p.dead = 0; p.inv = 1; p.status = ''; });
      const isBoss = this.wave === 3 || this.wave === 6;
      this.phase = 'count';
      this.banner(isBoss ? `Κύμα ${this.wave}: ΑΦΕΝΤΙΚΟ! ⚠` : this.wave === 1 ? 'Προστατέψτε τον γαλαξία! 🚀' : `Κύμα ${this.wave}`, isBoss ? '#ff8a8a' : '#6ff3ff');
      this.countdown(() => { this.phase = 'go'; this.buildWave(); this.changed(); });
      this.changed();
    }

    // ---------- κύματα ----------
    buildWave() {
      const n = this.parts.length, w = this.wave;
      const extra = n >= 3 ? 1 : 0;
      if (w === 1) this.formation(3 + extra, 8, ['bug1', 'bug1', 'bug2', 'bug2'], 0);
      if (w === 2) {
        this.formation(2 + extra, 8, ['bug2', 'bug1', 'bug1'], 0);
        for (let i = 0; i < 10 + n * 2; i++) this.spawnQ.push({ t: 2 + i * 0.9, fn: () => this.addJelly() });
      }
      if (w === 4) {
        this.formation(3, 9, ['bug2', 'bug1', 'bug1'], 0.4);
        for (let i = 0; i < 3 + extra; i++) this.spawnQ.push({ t: 1.5 + i * 2.2, fn: () => this.addGem() });
      }
      if (w === 5) {
        for (let i = 0; i < 6; i++) {
          this.spawnQ.push({ t: 0.5 + i * 3.2, fn: () => this.swarm(i % 2 ? -1 : 1, 6 + extra * 2) });
          if (i % 2) this.spawnQ.push({ t: 1.5 + i * 3.2, fn: () => this.addGem() });
        }
        for (let i = 0; i < 8; i++) this.spawnQ.push({ t: 3 + i * 2, fn: () => this.addJelly() });
      }
      if (w === 3) this.addBoss('crab');
      if (w === 6) this.addBoss('eye');
    }

    enemy(o) {
      const e = Object.assign({ hp: 1, max: 1, flash: 0, t: 0, fireT: U.rand(1.5, 5), pts: 10, r: 5 }, o);
      e.hp = e.max = Math.max(1, Math.round(e.hp * (e.boss ? this.hpMul : 1)));
      this.enemies.push(e);
      return e;
    }

    formation(rows, cols, kinds, dive) {
      const col = { bug1: '#5dff8a', bug2: '#ff7ad9' };
      for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
        const kind = kinds[j % kinds.length];
        const sx = LW / 2 + (i - (cols - 1) / 2) * 26, sy = 42 + j * 16;
        const side = i < cols / 2 ? -1 : 1;
        this.enemy({
          kind, col: col[kind], type: 'form', sx, sy, x: LW / 2 + side * 220, y: -20,
          enter: -(j * cols + i) * 0.05 - j * 0.2, hp: kind === 'bug2' ? 2 : 1, pts: kind === 'bug2' ? 20 : 10,
          diveRate: 0.012 + dive * 0.02 + this.wave * 0.004, side,
        });
      }
    }

    addJelly() {
      const x0 = U.rand(40, LW - 40);
      this.enemy({ kind: 'jelly', col: '#4fc3ff', type: 'jelly', x: x0, x0, y: -12, hp: 2, pts: 25, amp: U.rand(25, 60), sp: U.rand(32, 46), ph: U.rand(0, 6) });
    }

    addGem() {
      const side = Math.random() < 0.5 ? -1 : 1;
      this.enemy({ kind: 'gem', col: '#ffe36b', type: 'gem', x: LW / 2 + side * 210, y: U.rand(30, 70), hx: U.rand(60, LW - 60), hp: 5, pts: 60, fireT: 1.6, r: 6 });
    }

    swarm(side, k) {
      for (let i = 0; i < k; i++) {
        this.enemy({ kind: i % 2 ? 'bug1' : 'bug2', col: side > 0 ? '#ff9a2e' : '#c77dff', type: 'swarm', side, x: side > 0 ? -12 : LW + 12, y: 40, enter: -i * 0.22, hp: 1, pts: 15, fireT: U.rand(1, 4) });
      }
    }

    addBoss(kind) {
      const crab = kind === 'crab';
      this.boss = this.enemy({
        kind, col: crab ? '#ff4d6d' : '#c77dff', type: 'boss', boss: true, x: LW / 2, y: -40, hp: crab ? 110 : 190,
        pts: crab ? 800 : 1500, r: crab ? 26 : 26, h: crab ? 14 : 17, pat: 0, patT: 2.4, spin: 0, enterY: crab ? 58 : 62, name: crab ? 'ΚΟΣΜΟΚΑΒΟΥΡΑΣ' : 'ΤΟ ΜΑΤΙ ΤΟΥ ΚΕΝΟΥ',
      });
    }

    // ---------- είσοδος από κινητά ----------
    input(part, msg) {
      if (!part) return;
      if (msg.type === 'joy') { part.jx = U.clamp(+msg.x || 0, -1, 1); part.jy = U.clamp(+msg.y || 0, -1, 1); }
      else if (msg.type === 'dash') this.bomb(part);
    }

    bomb(p) {
      if (this.phase !== 'go' || p.dead > 0 || p.bombs <= 0) return;
      p.bombs--;
      this.ebul = [];
      this.flashT = 0.35; this.shake = 0.4;
      this.sfx('boom');
      this.boom.push({ x: p.x, y: p.y, t: 0, ring: true, c: p.color.hex });
      for (const e of [...this.enemies]) if (e.y > -5) this.damage(e, e.boss ? 14 : 6, p);
      this.fx(p, '💣 ΜΠΟΥΜ!', [80, 40, 120]);
      this.changed();
    }

    // ---------- ρομπότ-συμπαίκτης ----------
    bot(p, dt) {
      p.botT -= dt;
      if (p.botT > 0) return;
      p.botT = 0.1;
      let tx = p.x, ty = LH - 30;
      const alive = this.enemies.filter((e) => e.y > 0);
      if (alive.length) {
        const t = alive.reduce((a, b) => (Math.abs(a.x - p.x) < Math.abs(b.x - p.x) ? a : b));
        tx = t.x + Math.sin(this.time + p.x) * 8;
      }
      const it = this.items.find((i) => Math.abs(i.x - p.x) < 70);
      if (it) { tx = it.x; ty = U.clamp(it.y + 10, 120, LH - 12); }
      // απόφυγε σφαίρες που έρχονται
      let near = 0;
      for (const b of this.ebul) {
        const dx = b.x - p.x, dy = b.y - p.y;
        if (dy < 0 && dy > -46 && Math.abs(dx) < 14) { tx = p.x + (dx > 0 ? -30 : 30); near++; }
      }
      if (near >= 4 && p.bombs > 0 && Math.random() < 0.3) this.bomb(p);
      const dx = tx - p.x, dy = ty - p.y;
      p.jx = Math.abs(dx) < 3 ? 0 : U.clamp(dx / 25, -1, 1);
      p.jy = Math.abs(dy) < 3 ? 0 : U.clamp(dy / 25, -1, 1);
    }

    // ---------- κύκλος ----------
    update(dt) {
      this.shake = Math.max(0, this.shake - dt);
      this.flashT = Math.max(0, (this.flashT || 0) - dt);
      this.zapT -= dt;
      const fast = this.phase === 'go' ? 1.6 : 1;
      this.scroll = ((this.scroll || 0) + dt * 6 * fast) % (LH * 2);
      this.planet.y += dt * 1.5 * fast;
      if (this.planet.y > LH + 60) { this.planet.y = -60; this.planet.x = U.rand(30, LW - 30); }
      for (const s of this.stars) { s.y += s.z * s.z * 9 * dt * fast; if (s.y > LH) { s.y = 0; s.x = U.rand(0, LW); } }
      for (const b of this.boom) b.t += dt;
      this.boom = this.boom.filter((b) => b.t < 0.7);
      for (const q of this.fxp) { q.t += dt; q.x += q.vx * dt; q.y += q.vy * dt; const d = Math.pow(q.drag, dt); q.vx *= d; q.vy *= d; }
      this.fxp = this.fxp.filter((q) => q.t < q.life);
      for (const f of this.floats) { f.t += dt; f.y -= 14 * dt; }
      this.floats = this.floats.filter((f) => f.t < 1.1);

      const go = this.phase === 'go' || this.phase === 'clear';
      for (const p of this.parts) {
        if (p.bot && go) this.bot(p, dt);
        if (!this.active(p)) continue;
        p.inv = Math.max(0, p.inv - dt);
        if (p.dead > 0) {
          p.dead -= dt;
          if (p.dead <= 0) { p.dead = 0; p.inv = INVUL; p.x = LW / 2; p.y = LH - 24; p.status = ''; this.changed(); }
          continue;
        }
        let jx = p.jx, jy = p.jy; const l = Math.hypot(jx, jy); if (l > 1) { jx /= l; jy /= l; }
        p.x = U.clamp(p.x + jx * SPEED * dt, 6, LW - 6);
        p.y = U.clamp(p.y + jy * SPEED * dt, 96, LH - 10);
        p.tilt = jx;
        if (this.phase === 'go') {
          p.fireT -= dt;
          if (p.fireT <= 0) { p.fireT = FIRE; this.shoot(p); }
        }
      }
      if (this.phase !== 'go') return;

      this.waveT += dt;
      for (const s of this.spawnQ) if (!s.done && this.waveT >= s.t) { s.done = true; s.fn(); }
      this.spawnQ = this.spawnQ.filter((s) => !s.done);

      for (const e of this.enemies) this.moveEnemy(e, dt);
      this.enemies = this.enemies.filter((e) => !e.gone);

      for (const b of this.pbul) { b.x += b.vx * dt; b.y += b.vy * dt; }
      for (const b of this.ebul) { b.x += b.vx * dt; b.y += b.vy * dt; }
      this.pbul = this.pbul.filter((b) => b.y > -6 && b.x > -6 && b.x < LW + 6 && !b.hit);
      this.ebul = this.ebul.filter((b) => b.y < LH + 6 && b.y > -10 && b.x > -6 && b.x < LW + 6);

      // σφαίρες παικτών → εχθροί
      for (const b of this.pbul) {
        for (const e of this.enemies) {
          if (e.y < -4 || b.hit) continue;
          const hh = e.h || e.r;
          if (Math.abs(b.x - e.x) < e.r + 1 && Math.abs(b.y - e.y) < hh + 2) { b.hit = true; this.damage(e, 1, b.own); break; }
        }
      }
      // δώρα
      for (const it of this.items) {
        it.y += 30 * dt; it.t += dt;
        for (const p of this.parts) {
          if (p.dead > 0 || !this.active(p) || it.got) continue;
          if (Math.abs(p.x - it.x) < 9 && Math.abs(p.y - it.y) < 9) { it.got = true; this.collect(p, it); }
        }
      }
      this.items = this.items.filter((i) => !i.got && i.y < LH + 8);
      // χτυπήματα στους παίκτες
      for (const p of this.parts) {
        if (p.dead > 0 || p.inv > 0 || !this.active(p)) continue;
        let hit = this.ebul.find((b) => Math.abs(b.x - p.x) < 2.6 + b.r && Math.abs(b.y - p.y) < 2.6 + b.r);
        if (hit) hit.y = LH + 99;
        if (!hit) hit = this.enemies.find((e) => e.y > 0 && Math.abs(e.x - p.x) < e.r + 2 && Math.abs(e.y - p.y) < (e.h || e.r) + 2);
        if (hit) this.hurt(p);
        if (this.phase !== 'go') return;
      }
      // τέλος κύματος
      if (!this.spawnQ.length && !this.enemies.length && this.waveT > 1) this.clearWave();
    }

    shoot(p) {
      const add = (dx, vx) => this.pbul.push({ x: p.x + dx, y: p.y - 5, vx, vy: -BUL_V, own: p, c: p.color.hex });
      if (p.lvl === 1) add(0, 0);
      else if (p.lvl === 2) { add(-3, 0); add(3, 0); }
      else { add(-3, 0); add(3, 0); add(-4, -70); add(4, 70); }
      if (this.zapT <= 0) { this.zapT = 0.12; this.sfx('zap'); }
    }

    eshot(x, y, ang, sp, c, r) { this.ebul.push({ x, y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, c: c || '#ff4d6d', r: r || 1.5 }); }

    target(x, y) {
      const al = this.parts.filter((p) => p.dead <= 0 && this.active(p));
      if (!al.length) return Math.PI / 2;
      const t = al.reduce((a, b) => (Math.hypot(a.x - x, a.y - y) < Math.hypot(b.x - x, b.y - y) ? a : b));
      return Math.atan2(t.y - y, t.x - x);
    }

    moveEnemy(e, dt) {
      e.t += dt; e.flash = Math.max(0, e.flash - dt);
      const lvl = this.wave;
      if (e.type === 'form') {
        if (e.enter < 0) { e.enter += dt; return; }
        const swing = Math.sin(this.waveT * 0.7) * 34;
        if (e.mode === 'dive') {
          e.dt += dt;
          e.y += (70 + lvl * 8) * dt;
          e.x += Math.sin(e.dt * 3) * 70 * dt + (e.tx - e.x) * 0.6 * dt;
          if (e.y > LH + 12) { e.mode = 'back'; e.y = -14; }
        } else if (e.enter < 1.3) {
          e.enter += dt;
          const k = Math.min(1, e.enter / 1.3), q = 1 - (1 - k) * (1 - k);
          const fx = e.side * 220 * (1 - q) + Math.sin(k * Math.PI) * e.side * -60;
          e.x = e.sx + swing + fx; e.y = -20 + (e.sy + 20) * q;
        } else {
          const tx = e.sx + swing;
          if (e.mode === 'back') { e.x += (tx - e.x) * 3 * dt; e.y += (e.sy - e.y) * 3 * dt; if (Math.abs(e.y - e.sy) < 1) e.mode = ''; }
          else { e.x = tx; e.y = e.sy + Math.sin(this.time * 2 + e.sx) * 1.2; }
          if (!e.mode && Math.random() < e.diveRate * dt * 2) { e.mode = 'dive'; e.dt = 0; const a = this.target(e.x, e.y); e.tx = e.x + Math.cos(a) * 200; }
        }
        e.fireT -= dt;
        if (e.fireT <= 0) {
          e.fireT = U.rand(3.5, 8) / (1 + lvl * 0.12);
          if (e.y > 0 && e.y < LH * 0.6) this.eshot(e.x, e.y + 4, this.target(e.x, e.y), 70 + lvl * 6);
        }
      } else if (e.type === 'jelly') {
        e.y += e.sp * dt; e.x = e.x0 + Math.sin(e.t * 1.8 + e.ph) * e.amp;
        if (e.y > LH + 12) e.gone = true;
        e.fireT -= dt;
        if (e.fireT <= 0) { e.fireT = U.rand(2.5, 4); this.eshot(e.x, e.y + 4, Math.PI / 2, 80, '#4fc3ff'); }
      } else if (e.type === 'gem') {
        e.x += (e.hx - e.x) * 1.2 * dt; e.y += Math.sin(e.t * 1.4) * 10 * dt;
        if (Math.abs(e.hx - e.x) < 3) e.hx = U.rand(40, LW - 40);
        e.fireT -= dt;
        if (e.fireT <= 0) {
          e.fireT = 2.2 - Math.min(0.8, lvl * 0.1);
          const a = this.target(e.x, e.y);
          for (const d of [-0.18, 0, 0.18]) this.eshot(e.x, e.y + 5, a + d, 95, '#ffe36b', 1.8);
        }
      } else if (e.type === 'swarm') {
        if (e.enter < 0) { e.enter += dt; return; }
        const k = e.t + e.enter;
        e.x = e.side > 0 ? -12 + k * 120 : LW + 12 - k * 120;
        e.y = 40 + Math.sin(k * 2.2) * 26 + k * 22;
        if (e.x < -20 || e.x > LW + 20 || e.y > LH + 12) e.gone = true;
        e.fireT -= dt;
        if (e.fireT <= 0) { e.fireT = U.rand(2, 4); this.eshot(e.x, e.y, this.target(e.x, e.y), 85); }
      } else if (e.type === 'boss') this.moveBoss(e, dt);
    }

    moveBoss(e, dt) {
      if (e.y < e.enterY) { e.y += 30 * dt; return; }
      const rage = e.hp < e.max * 0.5;
      e.x = LW / 2 + Math.sin(e.t * (rage ? 0.75 : 0.5)) * 120;
      e.y = e.enterY + Math.sin(e.t * 1.3) * 6;
      e.patT -= dt;
      const crab = e.kind === 'crab';
      if (crab) {
        if (e.pat === 0 && e.patT % 0.9 < dt) {
          for (let i = -3; i <= 3; i++) this.eshot(e.x, e.y + 10, Math.PI / 2 + i * 0.22, 85, '#ff4d6d', 2);
        }
        if (e.pat === 1 && e.patT % 0.25 < dt) {
          for (const sx of [-20, 20]) this.eshot(e.x + sx, e.y + 6, this.target(e.x + sx, e.y), 120, '#ff9a2e', 1.6);
        }
        if (e.pat === 2 && e.patT % 1.4 < dt && this.enemies.length < 14) {
          for (const s of [-1, 1]) this.enemy({ kind: 'bug1', col: '#ff9a2e', type: 'swarm', side: s, x: e.x, y: e.y, enter: 0, hp: 1, pts: 10, fireT: 3 });
        }
      } else {
        if (e.pat === 0) { e.spin += dt * (rage ? 3.4 : 2.4); if (e.patT % 0.12 < dt) for (let k = 0; k < (rage ? 3 : 2); k++) this.eshot(e.x, e.y, e.spin + k * Math.PI * 2 / (rage ? 3 : 2), 75, '#c77dff', 1.8); }
        if (e.pat === 1 && e.patT % 1.1 < dt) { const o = Math.random(); for (let k = 0; k < 18; k++) this.eshot(e.x, e.y, o + k * Math.PI / 9, 70, '#ff7ad9', 2); }
        if (e.pat === 2 && e.patT % 0.18 < dt) this.eshot(e.x, e.y + 8, this.target(e.x, e.y) + U.rand(-0.1, 0.1), 140, '#6ff3ff', 1.6);
        if (e.pat === 3 && e.patT % 2 < dt && this.enemies.length < 10) this.addJelly();
      }
      if (e.patT <= 0) {
        e.pat = (e.pat + 1) % (crab ? 3 : 4);
        e.patT = rage ? 3.2 : 4;
        this.ebul.length > 160 && this.ebul.splice(0, 40);
      }
    }

    damage(e, dmg, p) {
      if (e.gone || e.dead) return;
      e.hp -= dmg; e.flash = 0.08;
      if (e.boss && e.y < e.enterY) e.hp = Math.max(e.hp, 1);
      if (e.hp > 0) { this.sparks(e.x + U.rand(-3, 3), e.y + (e.h || e.r) * 0.6, e.col, e.boss ? 2 : 4); if (e.boss && Math.random() < 0.3) this.sfx('tick'); return; }
      e.gone = true; e.dead = true;
      if (p) { p.score += e.pts; p.kills++; }
      this.team += e.pts;
      this.floats.push({ x: e.x, y: e.y - 6, t: 0, text: String(e.pts), c: p ? p.color.hex : '#fff' });
      this.explode(e.x, e.y, e.col, e.boss ? 3 : 1);
      if (e.boss) {
        this.ebul = [];
        this.shake = 1.2;
        this.sfx('finish');
        this.after(0.3, () => this.explode(e.x - 18, e.y + 6, '#ffe36b', 2));
        this.after(0.6, () => this.explode(e.x + 16, e.y - 4, '#fff', 2));
        this.boss = null;
        for (const k of [-1, 0, 1]) this.items.push({ x: e.x + k * 24, y: e.y, kind: k ? 'P' : 'H', t: 0 });
        if (p) this.fx(p, `🏆 Έριξες το αφεντικό! +${e.pts}`, [100, 50, 200]);
      } else {
        this.sfx('boom');
        const r = Math.random();
        if (r < 0.06) this.items.push({ x: e.x, y: e.y, kind: 'P', t: 0 });
        else if (r < 0.085) this.items.push({ x: e.x, y: e.y, kind: 'B', t: 0 });
        else if (r < 0.095) this.items.push({ x: e.x, y: e.y, kind: 'H', t: 0 });
      }
      this.changed();
    }

    explode(x, y, c, big) {
      this.boom.push({ x, y, t: 0, c, big });
      const P = this.fxp;
      for (let i = 0; i < 9 * big; i++) {
        const a = U.rand(0, TAU), v = U.rand(8, 40) * big;
        P.push({ k: 'fire', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, drag: 0.08, t: 0, life: U.rand(0.35, 0.8), s: U.rand(5, 10) * Math.sqrt(big) });
      }
      for (let i = 0; i < 6 * big; i++) {
        const a = U.rand(0, TAU), v = U.rand(4, 18) * big;
        P.push({ k: 'smoke', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 4, drag: 0.2, t: 0, life: U.rand(0.9, 1.6), s: U.rand(4, 8) * Math.sqrt(big) });
      }
      for (let i = 0; i < 14 * big; i++) {
        const a = U.rand(0, TAU), v = U.rand(60, 160) * Math.sqrt(big);
        P.push({ k: 'spark', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, drag: 0.04, t: 0, life: U.rand(0.25, 0.6), c });
      }
      for (let i = 0; i < 3 * big; i++) {
        const a = U.rand(0, TAU), v = U.rand(20, 60);
        P.push({ k: 'debris', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, drag: 0.5, t: 0, life: U.rand(0.8, 1.4), c, r: U.rand(0, 6), vr: U.rand(-12, 12), s: U.rand(1, 2.2) });
      }
      if (this.fxp.length > 900) this.fxp.splice(0, this.fxp.length - 900);
      if (big > 1) this.sfx('boom');
    }

    sparks(x, y, c, n = 4) {
      for (let i = 0; i < n; i++) {
        const a = U.rand(-Math.PI, 0), v = U.rand(40, 110);
        this.fxp.push({ k: 'spark', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, drag: 0.03, t: 0, life: U.rand(0.12, 0.3), c });
      }
    }

    collect(p, it) {
      this.sfx('pwr');
      if (it.kind === 'P') {
        if (p.lvl < 3) { p.lvl++; this.fx(p, `⚡ Όπλο επίπεδο ${p.lvl}!`, [40, 30, 40]); }
        else { p.score += 50; this.fx(p, '⚡ +50', [40]); }
        this.floats.push({ x: it.x, y: it.y, t: 0, text: p.lvl < 3 ? 'POWER' : '+50', c: '#ffe36b' });
      } else if (it.kind === 'B') {
        p.bombs = Math.min(3, p.bombs + 1);
        this.fx(p, '💣 +1 βόμβα', [40]);
        this.floats.push({ x: it.x, y: it.y, t: 0, text: '+ΒΟΜΒΑ', c: '#ff9a2e' });
      } else {
        this.lives = Math.min(9, this.lives + 1);
        this.fx(p, '❤ +1 ζωή για την ομάδα!', [40, 30, 40]);
        this.floats.push({ x: it.x, y: it.y, t: 0, text: '+1 ΖΩΗ', c: '#ff4d6d' });
      }
      this.changed();
    }

    hurt(p) {
      p.dead = RESPAWN; p.deaths++; p.lvl = Math.max(1, p.lvl - 1);
      p.status = '💥';
      this.explode(p.x, p.y, p.color.hex, 2);
      this.shake = 0.5;
      this.sfx('hurt');
      // ο ρομπότ-συμπαίκτης δεν χαλάει τις ζωές της ομάδας
      if (!p.bot) this.lives--;
      this.fx(p, 'Χτυπήθηκες! −1 ζωή', [200, 60, 200], true);
      if (!p.bot && this.lives <= 0) {
        this.lives = 0;
        this.phase = 'lost';
        this.banner('GAME OVER 💔', '#ff8a8a');
        this.sfx('miss');
        this.after(2.6, () => this.running && this.finish(false));
      }
      this.changed();
    }

    clearWave() {
      this.phase = 'clear';
      const last = this.wave >= WAVES;
      const bonus = Math.max(0, Math.round(300 - this.waveT * 3));
      this.team += bonus;
      this.parts.forEach((p) => { p.bombs = Math.min(3, p.bombs + 1); });
      this.sfx('finish');
      this.banner(last ? 'Ο γαλαξίας σώθηκε! 🚀🏆' : `Κύμα ${this.wave} καθαρό! +1 💣${bonus ? ` · +${bonus} γρηγοράδα` : ''}`, '#ffe36b');
      this.changed();
      this.after(3, () => {
        if (!this.running) return;
        if (last) this.finish(true); else this.nextWave();
      });
    }

    finish(won) {
      this.phase = 'end';
      this.parts.forEach((p) => { p.jx = p.jy = 0; });
      const rank = [...this.parts].sort((a, b) => b.score - a.score || b.kills - a.kills || a.deaths - b.deaths);
      const mvp = rank[0]; mvp.hi = true;
      if (won) this.team += this.lives * 200;
      this.celebrate(won ? mvp.color.hex : '#9b6bff');
      this.sfx(won ? 'win' : 'miss');
      this.changed();
      this.h.onOver && this.h.onOver({
        winner: mvp,
        title: won ? 'Η ομάδα νίκησε! Πρώτος σε πόντους' : 'Πρώτος της ομάδας',
        icon: won ? '🏆' : '🚀',
        stats: won ? `Ομάδα: ${this.team} πόντοι · πέρασε και τα ${WAVES} κύματα με ${this.lives} ❤`
          : `Ομάδα: ${this.team} πόντοι · έφτασε στο κύμα ${this.wave}/${WAVES}`,
        rank: rank.map((q) => ({ name: q.name, color: q.color, st: `${q.score} πόντοι · ${q.kills} ${q.kills === 1 ? 'εξωγήινος' : 'εξωγήινοι'} · ${q.deaths} ${q.deaths === 1 ? 'χτύπημα' : 'χτυπήματα'}` })),
      });
    }

    ctrl(part) {
      const base = { mode: 'joy', btn: `ΒΟΜΒΑ 💣×${part.bombs}`, cdMs: 700 };
      if (this.phase === 'go' && part.dead > 0) return { ...base, active: false, label: '💥 Χτυπήθηκες!', sub: 'Επιστρέφεις σε λίγο' };
      if (this.phase === 'go' || this.phase === 'clear') return { ...base, active: true };
      return { ...base, active: false, label: this.phase === 'count' ? `Κύμα ${this.wave} · Ετοιμάσου!` : this.phase === 'lost' ? '💔 GAME OVER' : 'Μπράβο!', sub: 'Joystick: κίνηση · πυροβολείς μόνος σου · ΒΟΜΒΑ: καθαρίζει την οθόνη' };
    }

    // ---------- σχεδίαση ----------
    world() {
      const x = this.ctx, d = this.dpr, s = this.scale;
      const shk = this.shake > 0 ? this.shake * 3 : 0;
      const jx = shk ? U.rand(-shk, shk) : 0, jy = shk ? U.rand(-shk, shk) : 0;
      x.setTransform(d * s, 0, 0, d * s, d * (this.ox + jx * s), d * (this.oy + jy * s));
    }
    screen() { this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0); }
    toScreen(wx, wy) { return [this.ox + wx * this.scale, this.oy + wy * this.scale]; }

    put(img, x, y, rot = 0, alpha = 1) {
      const c = this.ctx;
      if (alpha !== 1) c.globalAlpha = alpha;
      if (rot) { c.save(); c.translate(x, y); c.rotate(rot); c.drawImage(img, -img.w / 2, -img.h / 2, img.w, img.h); c.restore(); }
      else c.drawImage(img, x - img.w / 2, y - img.h / 2, img.w, img.h);
      if (alpha !== 1) c.globalAlpha = 1;
    }
    light(col, x, y, w, h = w, a = 1) {
      const c = this.ctx;
      if (a !== 1) c.globalAlpha = a;
      c.drawImage(glow(col), x - w / 2, y - h / 2, w, h);
      if (a !== 1) c.globalAlpha = 1;
    }
    label(str, X, Y, size, col, align = 'center', w = 800) {
      const x = this.ctx;
      x.font = `${w} ${Math.round(size)}px "Noto Sans", sans-serif`;
      x.textAlign = align; x.textBaseline = 'middle';
      x.lineJoin = 'round'; x.lineWidth = size * 0.22; x.strokeStyle = 'rgba(0,0,8,.85)';
      x.strokeText(str, X, Y); x.fillStyle = col; x.fillText(str, X, Y);
    }

    draw() {
      const x = this.ctx;
      this.screen();
      x.fillStyle = '#000'; x.fillRect(0, 0, this.W, this.H);
      this.world();
      x.save(); x.beginPath(); x.rect(0, 0, LW, LH); x.clip();
      // φόντο
      const bg = this.background(), off = this.scroll || 0;
      x.drawImage(bg, 0, off - LH * 2, LW, LH * 2); x.drawImage(bg, 0, off, LW, LH * 2);
      const pl = this.planet, pc = this.planetC;
      x.drawImage(pc, pl.x - pl.r * 1.4, pl.y - pl.r * 1.4, pl.r * 2.8, pl.r * 2.8);
      x.globalCompositeOperation = 'lighter';
      for (const s of this.stars) {
        const a = s.z === 3 ? 0.9 : s.z === 2 ? 0.55 : 0.3;
        const tw = 0.7 + 0.3 * Math.sin(this.time * 3 + s.tw);
        x.fillStyle = `rgba(220,230,255,${a * tw})`;
        const len = this.phase === 'go' ? s.z * s.z * 0.28 : 0;
        x.fillRect(s.x, s.y, s.z * 0.28, s.z * 0.28 + len);
      }
      x.globalCompositeOperation = 'source-over';

      // καπνός (κάτω από όλα)
      for (const q of this.fxp) {
        if (q.k !== 'smoke') continue;
        const k = q.t / q.life, r = q.s * (0.6 + k * 1.6);
        x.globalAlpha = 0.35 * (1 - k);
        x.fillStyle = '#2a2433'; x.beginPath(); x.arc(q.x, q.y, r, 0, TAU); x.fill();
      }
      x.globalAlpha = 1;

      // εχθροί
      const fr = Math.floor(this.time * 10) % 2;
      for (const e of this.enemies) {
        if (e.y < -40) continue;
        if (e.kind === 'jelly') this.drawTentacles(e);
        if (e.kind === 'eye') this.drawEyeBoss(e);
        const img = this.sprite(e.kind, e.col, e.kind.startsWith('bug') ? fr : 0);
        const rot = e.kind.startsWith('bug') ? Math.PI - (e.mode === 'dive' ? U.clamp((e.tx - e.x) / 200, -0.5, 0.5) : 0) : e.kind === 'gem' ? Math.sin(e.t * 2) * 0.25 : 0;
        if (e.kind !== 'eye') this.put(img, e.x, e.y, rot);
        x.globalCompositeOperation = 'lighter';
        if (e.flash > 0) { this.put(img, e.x, e.y, rot, 0.8); }
        if (e.kind === 'gem') this.light('#ff4040', e.x, e.y, 18 + Math.sin(e.t * 6) * 3, undefined, 0.6);
        if (e.kind === 'jelly') this.light(e.col, e.x, e.y - 1, 22, 22, 0.35);
        if (e.kind === 'crab') { const pu = 0.6 + 0.4 * Math.sin(e.t * 5); this.light('#ff2a2a', e.x, e.y + 1, 26 * pu, 18 * pu, 0.9); this.light('#ffffff', e.x, e.y + 1, 8, 6, pu); }
        x.globalCompositeOperation = 'source-over';
      }

      // δώρα: λαμπερές κάψουλες
      for (const it of this.items) {
        if (it.y > LH - 30 && Math.floor(it.t * 8) % 2) continue;
        const col = it.kind === 'H' ? '#ff4d6d' : it.kind === 'B' ? '#ff9a2e' : '#3d8bff';
        const yy = it.y + Math.sin(it.t * 5) * 1.5;
        x.globalCompositeOperation = 'lighter'; this.light(col, it.x, yy, 22, 22, 0.8); x.globalCompositeOperation = 'source-over';
        x.fillStyle = ball(x, it.x, yy, 5, col, 0.8, -0.6); x.beginPath(); x.arc(it.x, yy, 4.6, 0, TAU); x.fill();
        x.strokeStyle = 'rgba(255,255,255,.7)'; x.lineWidth = 0.4; x.stroke();
        x.font = '800 5.4px "Noto Sans", sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = '#fff';
        x.fillText(it.kind === 'H' ? '♥' : it.kind === 'B' ? 'B' : 'P', it.x, yy + 0.3);
      }

      // παίκτες
      for (const p of this.parts) {
        if (!this.active(p) || p.dead > 0) continue;
        const blink = p.inv > 0 && Math.floor(this.time * 12) % 2;
        // φλόγες κινητήρων
        x.globalCompositeOperation = 'lighter';
        const fl = 1 + Math.sin(this.time * 50 + p.x) * 0.15 + (p.jy < -0.2 ? 0.5 : p.jy > 0.2 ? -0.35 : 0);
        for (const s of [-1.5, 1.5]) {
          this.light('#ff8a2a', p.x + s, p.y + 9 + 3 * fl, 3.6, 9 * fl, 0.9);
          this.light('#6fd0ff', p.x + s, p.y + 8.4, 2.6, 4 * fl, 0.9);
        }
        x.globalCompositeOperation = 'source-over';
        this.put(this.sprite('ship', p.color.hex), p.x, p.y, (p.tilt || 0) * 0.18, blink ? 0.45 : 1);
        if (p.inv > 0) {
          x.globalCompositeOperation = 'lighter';
          x.strokeStyle = U.rgba(p.color.hex, 0.25 + 0.2 * Math.sin(this.time * 10)); x.lineWidth = 0.8;
          x.beginPath(); x.arc(p.x, p.y, 12, 0, TAU); x.stroke();
          this.light(p.color.hex, p.x, p.y, 28, 28, 0.15);
          x.globalCompositeOperation = 'source-over';
        }
      }

      // σφαίρες (additive)
      x.globalCompositeOperation = 'lighter';
      for (const b of this.pbul) {
        const a = Math.atan2(b.vy, b.vx) + Math.PI / 2;
        if (b.vx) { x.save(); x.translate(b.x, b.y); x.rotate(a); this.light(b.c, 0, 0, 4, 13); x.restore(); }
        else this.light(b.c, b.x, b.y, 4, 13);
        x.fillStyle = '#fff'; x.fillRect(b.x - 0.35, b.y - 3, 0.7, 6);
      }
      for (const b of this.ebul) {
        const r = b.r * 4.2;
        this.light(b.c, b.x, b.y, r, r);
        x.fillStyle = '#fff'; x.beginPath(); x.arc(b.x, b.y, b.r * 0.55, 0, TAU); x.fill();
      }
      // φωτιά, σπίθες, λάμψεις εκρήξεων
      for (const b of this.boom) {
        const k = b.t / 0.7;
        if (k < 0.3) this.light('#fff2c0', b.x, b.y, (14 + 40 * k) * b.big, undefined, 1 - k / 0.3);
        x.strokeStyle = U.rgba('#ffd28a', Math.max(0, 0.6 * (1 - k))); x.lineWidth = 1.2 * (1 - k);
        x.beginPath(); x.arc(b.x, b.y, 4 + k * 26 * b.big, 0, TAU); x.stroke();
      }
      for (const q of this.fxp) {
        const k = q.t / q.life;
        if (q.k === 'fire') {
          const col = k < 0.25 ? '#fff0b0' : k < 0.55 ? '#ff9a2e' : '#d8341c';
          const r = q.s * (0.5 + k * 0.9);
          this.light(col, q.x, q.y, r * 2, r * 2, 1 - k);
        } else if (q.k === 'spark') {
          x.strokeStyle = k < 0.5 ? U.rgba('#fff3c4', 1 - k) : U.rgba(q.c || '#ff9a2e', 1 - k); x.lineWidth = 0.6;
          x.beginPath(); x.moveTo(q.x, q.y); x.lineTo(q.x - q.vx * 0.03, q.y - q.vy * 0.03); x.stroke();
        }
      }
      if (this.flashT > 0) { x.fillStyle = `rgba(255,240,220,${this.flashT * 1.4})`; x.fillRect(0, 0, LW, LH); }
      x.globalCompositeOperation = 'source-over';
      // θραύσματα
      for (const q of this.fxp) {
        if (q.k !== 'debris') continue;
        const k = q.t / q.life;
        x.save(); x.translate(q.x, q.y); x.rotate(q.r + q.vr * q.t); x.globalAlpha = 1 - k;
        x.fillStyle = metal(x, -q.s, q.s, q.c); x.fillRect(-q.s, -q.s * 0.5, q.s * 2, q.s); x.restore();
      }
      x.globalAlpha = 1;
      // βινιέτα
      const vg = x.createRadialGradient(LW / 2, LH / 2, LH * 0.45, LW / 2, LH / 2, LW * 0.6);
      vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.5)');
      x.fillStyle = vg; x.fillRect(0, 0, LW, LH);
      x.restore();

      // ----- κείμενα σε συντεταγμένες οθόνης -----
      this.screen();
      const vh = this.vh;
      if (this.parts.length > 1) for (const p of this.parts) {
        if (!this.active(p) || p.dead > 0) continue;
        const [sx, sy] = this.toScreen(p.x, p.y + 15);
        this.label(p.name, sx, sy, vh * 1.9, p.color.hex, 'center', 700);
      }
      for (const f of this.floats) {
        const [sx, sy] = this.toScreen(f.x, f.y);
        x.globalAlpha = Math.min(1, Math.max(0, (1.1 - f.t) / 0.4));
        this.label(f.text, sx, sy, vh * 2.6, f.c === '#fff' ? '#fff' : U.shade(f.c, 0.35));
      }
      x.globalAlpha = 1;
      this.drawHud();
      if (this.phase === 'count' && this.countT != null) {
        if (this.time - this.countT < 3) this.label(this.wave === 3 || this.wave === 6 ? `ΚΥΜΑ ${this.wave} · ΑΦΕΝΤΙΚΟ` : `ΚΥΜΑ ${this.wave} / ${WAVES}`, this.W / 2, this.H * 0.26, vh * 5, this.wave % 3 ? '#8fe9ff' : '#ff8a8a');
        this.drawCount(this.countT, 'ΠΑΜΕ!');
      }
      if (this.phase === 'lost') this.label('GAME OVER', this.W / 2, this.H * 0.45, vh * 12, '#ff4d6d');
    }

    drawTentacles(e) {
      const x = this.ctx;
      x.globalCompositeOperation = 'lighter';
      x.lineCap = 'round';
      for (let i = 0; i < 5; i++) {
        const bx = e.x - 5 + i * 2.5;
        x.strokeStyle = U.rgba(e.col, 0.45); x.lineWidth = 0.9;
        x.beginPath(); x.moveTo(bx, e.y + 3);
        for (let k = 1; k <= 6; k++) x.lineTo(bx + Math.sin(e.t * 4 + i + k * 0.8) * k * 0.45, e.y + 3 + k * 2);
        x.stroke();
      }
      x.globalCompositeOperation = 'source-over';
    }

    drawEyeBoss(e) {
      const x = this.ctx;
      // πλοκάμια
      x.lineCap = 'round';
      for (let i = 0; i < 8; i++) {
        const a0 = Math.PI * (0.15 + (i / 7) * 0.7);
        let px = e.x + Math.cos(a0) * 20, py = e.y + Math.sin(a0) * 16;
        for (let k = 0; k < 7; k++) {
          const a = a0 + Math.sin(e.t * 2 + i + k * 0.6) * 0.5;
          const nx = px + Math.cos(a) * 3.2, ny = py + Math.sin(a) * 3.2;
          x.strokeStyle = U.shade(e.col, -0.4 - k * 0.05); x.lineWidth = 3.2 - k * 0.4;
          x.beginPath(); x.moveTo(px, py); x.lineTo(nx, ny); x.stroke();
          px = nx; py = ny;
        }
      }
      this.put(this.sprite('eye', e.col), e.x, e.y);
      // ίριδα που κοιτάζει τον πιο κοντινό παίκτη
      const a = this.target(e.x, e.y), d = 4.5;
      const ix = e.x + Math.cos(a) * d, iy = e.y + Math.sin(a) * d;
      const rage = e.hp < e.max * 0.5;
      const ir = x.createRadialGradient(ix, iy, 0.5, ix, iy, 7.5);
      ir.addColorStop(0, '#120018'); ir.addColorStop(0.32, '#120018'); ir.addColorStop(0.36, rage ? '#ff3030' : e.col);
      ir.addColorStop(0.75, U.shade(rage ? '#ff3030' : e.col, -0.4)); ir.addColorStop(1, '#2a0a2a');
      x.fillStyle = ir; x.beginPath(); x.arc(ix, iy, 7.5, 0, TAU); x.fill();
      x.fillStyle = 'rgba(255,255,255,.85)'; x.beginPath(); x.ellipse(ix - 2.6, iy - 2.8, 1.5, 1, -0.6, 0, TAU); x.fill();
      // βλέφαρα που ανοιγοκλείνουν
      const bl = Math.max(0, Math.sin(e.t * 0.9) - 0.96) * 25;
      if (bl > 0) { x.fillStyle = U.shade(e.col, -0.45); x.beginPath(); x.ellipse(e.x, e.y, 15.5, 15.5 * Math.min(1, bl), 0, 0, TAU); x.fill(); }
      if (e.flash > 0.04) { x.globalCompositeOperation = 'lighter'; this.light('#ff9ad0', e.x, e.y, 44, 40, 0.18); x.globalCompositeOperation = 'source-over'; }
    }

    drawHud() {
      const x = this.ctx, vh = this.vh, n = this.parts.length;
      const top = Math.max(this.oy, vh * 6.2) + vh * 0.6;
      const pw = Math.min(this.W * 0.19, vh * 34), ph = vh * 7.4, gap = vh * 1.4;
      let X = this.ox + vh * 1.6;
      for (const p of this.parts) {
        U.rr(x, X, top, pw, ph, vh * 1.4);
        const g = x.createLinearGradient(0, top, 0, top + ph);
        g.addColorStop(0, 'rgba(30,34,60,.78)'); g.addColorStop(1, 'rgba(8,8,22,.78)');
        x.fillStyle = g; x.fill();
        x.lineWidth = vh * 0.25; x.strokeStyle = U.rgba(p.color.hex, 0.75); x.stroke();
        x.fillStyle = p.color.hex; x.fillRect(X + vh * 0.9, top + vh * 1.3, vh * 0.5, ph - vh * 2.6);
        x.font = `700 ${Math.round(vh * 2)}px "Noto Sans", sans-serif`; x.textAlign = 'left'; x.textBaseline = 'middle'; x.fillStyle = '#dfe6ff';
        let nm = p.name + (p.bot ? ' 🤖' : ''); while (x.measureText(nm).width > pw * 0.62 && nm.length > 2) nm = nm.slice(0, -2) + '…';
        x.fillText(nm, X + vh * 2.2, top + vh * 2.3);
        x.font = `800 ${Math.round(vh * 3)}px "Noto Sans", sans-serif`; x.fillStyle = '#fff';
        x.fillText(String(p.score).padStart(5, '0'), X + vh * 2.2, top + vh * 5.2);
        x.textAlign = 'right'; x.font = `${Math.round(vh * 1.9)}px "Noto Sans", sans-serif`;
        x.fillText('💣'.repeat(p.bombs), X + pw - vh * 1.2, top + vh * 2.3);
        x.font = `800 ${Math.round(vh * 1.7)}px "Noto Sans", sans-serif`; x.fillStyle = p.lvl >= 3 ? '#ffe36b' : '#8fe9ff';
        x.fillText(p.dead > 0 ? '💥' : '⚡'.repeat(p.lvl), X + pw - vh * 1.2, top + vh * 5.2);
        X += pw + gap;
      }
      // ζωές ομάδας
      const rx = this.ox + LW * this.scale - vh * 1.6;
      x.font = `${Math.round(vh * 3)}px "Noto Sans", sans-serif`; x.textAlign = 'right'; x.textBaseline = 'middle';
      x.fillStyle = '#ff4d6d';
      if (this.lives <= 6) x.fillText('❤'.repeat(this.lives), rx, top + vh * 2.4);
      else this.label('❤ ×' + this.lives, rx, top + vh * 2.4, vh * 3, '#ff4d6d', 'right');
      this.label(`ΚΥΜΑ ${this.wave}/${WAVES}`, rx, top + vh * 6, vh * 2, '#9aa6c8', 'right', 700);
      // ζωή αφεντικού
      const b = this.boss;
      if (b && !b.gone) {
        const bw = this.W * 0.36, bx = this.W / 2 - bw / 2, by = top + ph + vh * 4.2, bh = vh * 1.6;
        U.rr(x, bx - vh * 0.3, by - vh * 0.3, bw + vh * 0.6, bh + vh * 0.6, vh); x.fillStyle = 'rgba(0,0,0,.7)'; x.fill();
        const k = Math.max(0, b.hp) / b.max;
        const g = x.createLinearGradient(bx, 0, bx + bw, 0);
        g.addColorStop(0, '#ff2a4a'); g.addColorStop(1, k < 0.5 ? '#ff6a2a' : '#ffd23f');
        U.rr(x, bx, by, Math.max(bh, bw * k), bh, bh / 2); x.fillStyle = g; x.fill();
        this.label(b.name, this.W / 2, by - vh * 2.2, vh * 2.4, '#fff');
      }
    }
  }

  Mini.games.space = SpaceGame;
})();
