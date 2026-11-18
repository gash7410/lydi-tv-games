// «Αγκαθούληδες»: συνεργατικό 3D platformer (Three.js) σε 3 κόσμους: λιβάδι, λίμνη, σύννεφα + αφεντικό.
// Η Κυρα-Αλεπού έκλεισε τα σκαντζοχοιράκια σε κλουβιά. Οι παίκτες (σκαντζόχοιροι) πετούν αγκάθια,
// καβαλούν μπαλόνια, βουτούν στη λίμνη (με οξυγόνο) και ανοίγουν το κλουβί στο τέλος κάθε κόσμου.
// Η τηλεόραση αποδίδει τη σκηνή με WebGL σε δικό της καμβά· το #stage2 (2D) κρατά μόνο το HUD.
(function () {
  'use strict';
  const { Base, U } = Mini;
  const SRC = (document.currentScript && document.currentScript.src) || location.href;
  let T = null, loadP = null;
  function loadThree() {
    if (T) return Promise.resolve(T);
    if (!loadP) loadP = import(new URL('vendor/three.module.min.js', SRC).href).then((m) => (T = m)).catch((e) => { loadP = null; throw e; });
    return loadP;
  }
  // προφόρτωση όταν ησυχάσει η αρχική οθόνη
  setTimeout(() => (window.requestIdleCallback || setTimeout)(() => loadThree().catch(() => {})), 8000);

  // ---------- σταθερές ----------
  const GRAV = 38, JUMP = 16.4, RUN = 6.6, ACC = 46, AIRACC = 30, MAXFALL = 19, MUSH = 25;
  const HW = 0.33, HH = 0.8, DEPTH = 1.8, O2T = 11, BAL_T = 22, INV = 2.4, LIVES = 5;
  const TAU = Math.PI * 2;
  const solidC = (c) => c === '#' || c === 'B' || c === 's';
  const FRUIT = { apple: 50, orange: 60, cherry: 80, straw: 100, grape: 150 };
  const POW = { tri: '🔱 ΤΡΙΠΛΑ ΑΓΚΑΘΙΑ!', shield: '⭐ ΑΣΠΙΔΑ!', speed: '👟 ΦΤΕΡΟΠΟΔΑΡΟΣ!', heart: '❤ +1 ΖΩΗ!' };

  // ---------- πίστες (y προς τα πάνω, 1 μονάδα = 1 πλακίδιο) ----------
  function grid(w, h) {
    const g = Array.from({ length: h }, () => new Array(w).fill(' '));
    const m = {
      w, h, g, ents: [],
      box(x0, y0, x1, y1, c) { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (x >= 0 && x < w && y >= 0 && y < h) g[y][x] = c; return m; },
      e(k, x, y, o) { m.ents.push(Object.assign({ k, x, y }, o)); return m; },
      fr(x0, x1, y, step, f) { for (let x = x0; x <= x1; x += step || 1) m.e('fruit', x, y, { f }); return m; },
    };
    return m;
  }
  const LEVELS = [
    {
      name: 'Το Λιβάδι', theme: 'meadow', w: 130, h: 22,
      build: (m) => m
        .box(0, 0, 24, 2, '#').e('start', 2, 3).fr(6, 10, 3, 1, 'apple').e('beetle', 14, 3)
        .box(16, 3, 19, 4, '#').fr(16, 19, 5, 1, 'cherry')
        .e('pod', 21, 3).fr(22, 30, 12, 2, 'straw').fr(23, 29, 14, 2, 'grape')
        .box(25, 0, 28, 0, '#').box(25, 1, 28, 1, '^')
        .box(29, 0, 48, 2, '#').box(32, 6, 36, 6, '=').fr(32, 36, 7, 1, 'orange').e('bee', 38, 7, { r: 2.5 })
        .e('crate', 40, 3).e('mush', 42, 3)
        .box(44, 5, 46, 5, '=').box(46, 8, 48, 8, '=')
        .box(49, 0, 54, 9, '#').fr(50, 53, 10, 1, 'cherry')
        .box(55, 0, 80, 2, '#').e('beetle', 60, 3).e('beetle', 72, 3).fr(62, 70, 3, 2, 'apple')
        .box(58, 8, 63, 9, '#').fr(59, 62, 10, 1, 'straw').e('bee', 65, 12, { r: 2 })
        .box(67, 8, 72, 9, '#').fr(68, 71, 10, 1, 'orange')
        .box(76, 8, 80, 9, '#').e('crate', 78, 10)
        .box(81, 0, 106, 2, '#').e('flag', 83, 3)
        .box(85, 5, 86, 5, '=')
        .box(88, 7, 100, 8, 'B').fr(89, 99, 4, 2, 'apple').e('beetle', 96, 3)
        .fr(89, 99, 9, 2, 'grape').e('bee', 94, 11, { r: 3 })
        .box(102, 3, 105, 3, '^')
        .box(107, 0, 110, 4, '#').box(111, 0, 113, 6, '#').box(114, 0, 129, 6, '#')
        .fr(115, 118, 7, 1, 'cherry').e('beetle', 119, 7)
        .e('cage', 123, 7).box(129, 0, 129, 21, 'B'),
    },
    {
      name: 'Η Λίμνη', theme: 'lake', w: 136, h: 22,
      build: (m) => m
        .box(0, 0, 12, 9, '#').e('start', 3, 10).fr(5, 10, 10, 1, 'apple')
        .box(13, 0, 72, 0, 's').box(13, 1, 72, 11, '~')
        .fr(16, 22, 8, 2, 'cherry').e('fish', 20, 5, { r: 3.5 })
        .box(24, 1, 26, 5, 'B').fr(24, 26, 6, 1, 'straw').e('vent', 29, 1)
        .e('fish', 30, 9, { r: 2 })
        .box(33, 6, 35, 13, 'B').fr(32, 36, 3, 1, 'grape')
        .box(42, 7, 58, 11, 'B').box(42, 12, 58, 12, '^')
        .fr(43, 57, 4, 2, 'orange').e('vent', 50, 1).e('fish', 47, 3, { r: 3 }).e('fish', 55, 5, { r: 2 })
        .box(60, 1, 64, 13, '#').e('flag', 62, 14)
        .e('fish', 68, 6, { r: 3 }).fr(66, 71, 10, 1, 'cherry')
        .box(73, 0, 90, 11, '#').fr(75, 80, 12, 1, 'apple').e('beetle', 82, 12).e('crate', 86, 12).e('bee', 84, 15, { r: 2.5 })
        .e('pod', 89, 12).fr(91, 95, 14, 2, 'straw')
        .box(96, 0, 99, 11, '#')
        .box(100, 0, 113, 0, 's').box(100, 1, 113, 9, '~').e('fish', 106, 4, { r: 4 }).fr(102, 111, 5, 3, 'grape')
        .box(114, 0, 135, 9, '#').e('beetle', 118, 10).fr(116, 119, 10, 1, 'cherry')
        .e('cage', 126, 10).box(135, 0, 135, 21, 'B'),
    },
    {
      name: 'Τα Σύννεφα', theme: 'sky', w: 120, h: 26, boss: true,
      build: (m) => m
        .box(0, 2, 10, 5, '#').e('start', 3, 6).fr(5, 9, 6, 1, 'apple')
        .box(13, 6, 17, 6, '=').fr(13, 17, 7, 1, 'cherry')
        .box(20, 8, 24, 8, '=').fr(20, 24, 9, 2, 'straw').e('bee', 22, 12, { r: 2 })
        .box(27, 7, 31, 7, '=').fr(27, 31, 8, 1, 'orange')
        .box(34, 9, 38, 9, '=').e('pod', 35, 10).fr(36, 48, 19, 2, 'grape')
        .e('crow', 33, 14, { r: 4 })
        .box(42, 12, 48, 12, '=').fr(43, 47, 13, 1, 'cherry')
        .box(52, 11, 56, 11, '=').e('crate', 54, 12)
        .box(59, 9, 64, 9, '=').e('flag', 61, 10)
        .box(68, 8, 72, 8, '=').e('mush', 70, 9).fr(66, 74, 17, 2, 'straw')
        .box(75, 7, 78, 7, '=').e('crow', 76, 12, { r: 3 })
        .box(81, 0, 119, 4, '#').box(88, 8, 91, 8, '=').box(106, 8, 109, 8, '=')
        .e('boss', 100, 13).e('cage', 114, 5).box(119, 0, 119, 25, 'B'),
    },
  ];

  const THEMES = {
    meadow: { top: '#3d9bff', bot: '#d4f0ff', fog: '#cbe9ff', grass: '#63cf3c', dirt: '#93613a', stone: '#9aa0a8', back: '#6cc04a', backY: 2.96, hills: ['#4caa3a', '#62bf48', '#3c9a33', '#7ccf5a'], sun: 2.6 },
    lake: { top: '#2f8ee8', bot: '#dff4ff', fog: '#d2ecfb', grass: '#58c43e', dirt: '#86583a', stone: '#8f9aa3', back: '#5db846', backY: 9.96, hills: ['#5a8fb5', '#6d9fc4', '#4b7fa6'], sun: 2.5 },
    sky: { top: '#5fb4ff', bot: '#ffd6ea', fog: '#ffe2f0', grass: '#ffffff', dirt: '#f4f1ff', stone: '#c9c3e6', back: null, backY: -6, hills: ['#ffffff', '#fff4fb', '#f4ecff'], sun: 2.3 },
  };

  // ---------- ήχος (δικό του AudioContext) ----------
  const SND = {
    ac: null, master: null, noise: null, music: null,
    init() {
      if (!this.ac) {
        try { this.ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; }
        this.master = this.ac.createGain(); this.master.gain.value = 0.3; this.master.connect(this.ac.destination);
        this.music = this.ac.createGain(); this.music.gain.value = 0.55; this.music.connect(this.master);
        const len = this.ac.sampleRate * 0.5, b = this.ac.createBuffer(1, len, this.ac.sampleRate), d = b.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
        this.noise = b;
      }
      if (this.ac.state === 'suspended') this.ac.resume();
      return this.ac;
    },
    tone(t, f, dur, type, vol, f2, out) {
      const a = this.ac, o = a.createOscillator(), g = a.createGain();
      o.type = type || 'sine'; o.frequency.setValueAtTime(f, t);
      if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
      o.connect(g).connect(out || this.master); o.start(t); o.stop(t + dur + 0.03);
    },
    hit(t, dur, vol, freq, q, type, out) {
      const a = this.ac, s = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
      s.buffer = this.noise; f.type = type || 'highpass'; f.frequency.value = freq; f.Q.value = q || 0.8;
      g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
      s.connect(f).connect(g).connect(out || this.master); s.start(t, Math.random() * 0.3); s.stop(t + dur + 0.02);
    },
    play(name) {
      if (!this.init()) return; const t = this.ac.currentTime;
      const F = {
        jump: () => this.tone(t, 330, 0.16, 'square', 0.07, 720),
        shoot: () => { this.hit(t, 0.09, 0.2, 2500, 0.7, 'bandpass'); this.tone(t, 900, 0.08, 'triangle', 0.08, 1500); },
        fruit: () => { this.tone(t, 988, 0.07, 'square', 0.06); this.tone(t + 0.06, 1319, 0.12, 'square', 0.06); },
        stomp: () => { this.tone(t, 260, 0.14, 'square', 0.12, 90); this.hit(t, 0.06, 0.25, 800, 1, 'lowpass'); },
        kill: () => { this.tone(t, 700, 0.1, 'triangle', 0.12, 1400); this.tone(t + 0.08, 1400, 0.12, 'triangle', 0.1); },
        hurt: () => { this.tone(t, 520, 0.4, 'sawtooth', 0.12, 110); this.tone(t, 260, 0.4, 'square', 0.06, 70); },
        pop: () => { this.hit(t, 0.12, 0.5, 1800, 0.8, 'bandpass'); this.tone(t, 1200, 0.06, 'square', 0.06, 300); },
        splash: () => this.hit(t, 0.4, 0.35, 900, 0.6, 'lowpass'),
        boing: () => this.tone(t, 180, 0.35, 'sine', 0.3, 640),
        crate: () => { this.hit(t, 0.12, 0.45, 600, 1, 'bandpass'); this.tone(t, 150, 0.12, 'square', 0.08, 70); },
        power: () => [523, 659, 784, 1046].forEach((f, i) => this.tone(t + i * 0.06, f, 0.12, 'square', 0.06)),
        flag: () => [784, 988, 1175].forEach((f, i) => this.tone(t + i * 0.08, f, 0.2, 'triangle', 0.12)),
        bubble: () => this.tone(t, 500, 0.12, 'sine', 0.15, 1100),
        grab: () => this.tone(t, 600, 0.2, 'triangle', 0.1, 900),
        boss: () => { this.tone(t, 110, 0.5, 'sawtooth', 0.14, 70); this.hit(t, 0.3, 0.3, 400, 0.6, 'lowpass'); },
        bhit: () => { this.tone(t, 300, 0.12, 'square', 0.1, 150); this.hit(t, 0.08, 0.3, 1200, 1, 'bandpass'); },
        boom: () => { this.hit(t, 0.5, 0.6, 300, 0.5, 'lowpass'); this.tone(t, 90, 0.4, 'sine', 0.35, 40); },
        warp: () => this.tone(t, 300, 0.25, 'sine', 0.12, 1500),
      };
      F[name] && F[name]();
    },
  };
  const N = (m) => 440 * Math.pow(2, (m - 69) / 12);
  const SONGS = [
    { bpm: 132, roots: [48, 43, 45, 41], minor: [0, 0, 1, 0],
      mel: [72, 76, 79, 76, 77, 76, 74, 72, 71, 74, 79, 74, 76, 74, 71, 67, 69, 72, 76, 72, 74, 72, 69, 0, 65, 69, 72, 77, 76, 74, 72, 0] },
    { bpm: 118, roots: [50, 45, 47, 43], minor: [0, 0, 1, 0],
      mel: [74, 0, 78, 81, 0, 78, 76, 74, 73, 0, 76, 81, 0, 76, 73, 69, 71, 0, 74, 78, 0, 74, 71, 0, 67, 71, 74, 79, 78, 76, 74, 0] },
    { bpm: 140, roots: [45, 41, 43, 40], minor: [1, 0, 0, 0],
      mel: [69, 72, 76, 72, 74, 72, 71, 69, 65, 69, 72, 69, 71, 69, 67, 65, 67, 71, 74, 71, 72, 71, 67, 0, 64, 68, 71, 76, 74, 71, 68, 0] },
  ];

  let G3 = null; // κοινές γεωμετρίες
  const MC = new Map();
  function mat(hex, r = 0.6, o = {}) {
    const k = [hex, r, o.em || '', o.flat ? 1 : 0, o.op || 1, o.m || 0].join('|');
    let m = MC.get(k);
    if (!m) {
      m = new T.MeshStandardMaterial({ color: hex, roughness: r, metalness: o.m || 0, flatShading: !!o.flat });
      if (o.em) { m.emissive.set(o.em); m.emissiveIntensity = o.ei || 1; }
      if (o.op && o.op < 1) { m.transparent = true; m.opacity = o.op; m.depthWrite = false; }
      MC.set(k, m);
    }
    return m;
  }
  function mk(geo, m, sx, sy, sz, x, y, z, parent, shadow = true) {
    const o = new T.Mesh(geo, m); o.scale.set(sx, sy, sz); o.position.set(x, y, z); o.castShadow = shadow;
    if (parent) parent.add(o); return o;
  }
  function canvasTex(w, h, draw, rep) {
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    draw(cv.getContext('2d'), w, h);
    const t = new T.CanvasTexture(cv); t.colorSpace = T.SRGBColorSpace; t.anisotropy = 4;
    if (rep) { t.wrapS = t.wrapT = T.RepeatWrapping; }
    return t;
  }
  function rnd(seed) {
    let s = seed >>> 0 || 1;
    return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  function mixHex(a, b, k) {
    const A = U.rgb(a), B = U.rgb(b);
    return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * k).toString(16).padStart(2, '0')).join('');
  }
  let _m, _q, _e, _v, _s, _c, _p;
  function Lm(x, y, z, sx, sy, sz, rx = 0, ry = 0, rz = 0) {
    return new T.Matrix4().compose(new T.Vector3(x, y, z), new T.Quaternion().setFromEuler(new T.Euler(rx, ry, rz)), new T.Vector3(sx, sy, sz));
  }

  // πολλά ίδια αντικείμενα (φρούτα, δέντρα, λουλούδια) με InstancedMesh ανά κομμάτι
  class Inst {
    constructor(parent, parts, n, shadow) {
      this.n = n;
      this.parts = parts.map((pt) => {
        const im = new T.InstancedMesh(pt.geo, pt.mat, Math.max(1, n));
        im.frustumCulled = false; im.castShadow = !!shadow; im.receiveShadow = true;
        im.instanceMatrix.setUsage(T.DynamicDrawUsage);
        const zero = new T.Matrix4().makeScale(0, 0, 0);
        for (let i = 0; i < Math.max(1, n); i++) im.setMatrixAt(i, zero);
        parent.add(im);
        return { im, m: pt.m, tint: pt.tint };
      });
    }
    set(i, x, y, z, ry = 0, s = 1, rx = 0, rz = 0, sy) {
      _e.set(rx, ry, rz); _q.setFromEuler(_e); _v.set(x, y, z); _s.set(s, sy == null ? s : sy, s);
      _m.compose(_v, _q, _s);
      for (const p of this.parts) { _p.multiplyMatrices(_m, p.m); p.im.setMatrixAt(i, _p); p.im.instanceMatrix.needsUpdate = true; }
    }
    color(i, hex) { for (const p of this.parts) if (p.tint) { _c.set(hex); p.im.setColorAt(i, _c); p.im.instanceColor.needsUpdate = true; } }
    hide(i) { _p.makeScale(0, 0, 0); for (const p of this.parts) { p.im.setMatrixAt(i, _p); p.im.instanceMatrix.needsUpdate = true; } }
  }

  // ---------- μοντέλα ----------
  function makeHog(hex, scale = 1) {
    const root = new T.Group(), body = new T.Group(); root.add(body);
    const skin = mat('#f3d2a2', 0.75), dark = mat('#2a1a12', 0.25), white = mat('#ffffff', 0.2, { em: '#ffffff', ei: 0.6 });
    const spikeCol = mixHex(hex, '#5b3a22', 0.38), spikeM = mat(spikeCol, 0.55), backM = mat(mixHex(spikeCol, '#000000', 0.12), 0.7);
    mk(G3.sph, backM, 0.45, 0.41, 0.42, -0.06, 0.42, 0, body);
    mk(G3.sph, skin, 0.33, 0.31, 0.33, 0.14, 0.37, 0, body);
    mk(G3.sph, skin, 0.18, 0.13, 0.14, 0.41, 0.34, 0, body);
    mk(G3.sph, dark, 0.06, 0.055, 0.06, 0.58, 0.37, 0, body);
    const eyes = [];
    for (const s of [-1, 1]) {
      const e = mk(G3.sph, dark, 0.055, 0.075, 0.05, 0.37, 0.5, s * 0.14, body);
      mk(G3.sphL, white, 0.25, 0.25, 0.25, 0.4, 0.35, 0.2, e, false);
      eyes.push(e);
      mk(G3.sphL, mat('#ff8fa3', 0.8), 0.055, 0.035, 0.03, 0.38, 0.38, s * 0.21, body, false);
      mk(G3.sph, mat('#d9a877', 0.7), 0.07, 0.08, 0.04, 0.08, 0.72, s * 0.19, body);
    }
    // φουλάρι στο χρώμα του παίκτη
    const sc = mk(G3.torus, mat(hex, 0.5), 0.27, 0.27, 0.3, 0.16, 0.24, 0, body); sc.rotation.y = Math.PI / 2; sc.rotation.x = 0.25;
    // αγκάθια
    const NS = 72, spikes = new T.InstancedMesh(G3.cone6, spikeM, NS); spikes.castShadow = true;
    const up = new T.Vector3(0, 1, 0), d = new T.Vector3(), qq = new T.Quaternion(), mm = new T.Matrix4();
    let k = 0;
    for (let i = 0; i < 220 && k < NS; i++) {
      const yy = 1 - (i / 219) * 2, r = Math.sqrt(1 - yy * yy), th = i * 2.399963;
      d.set(Math.cos(th) * r, yy, Math.sin(th) * r);
      if (d.x > 0.28 || d.y < -0.3) continue;
      const pos = new T.Vector3(-0.06 + d.x * 0.41, 0.42 + d.y * 0.37, d.z * 0.39);
      const dir = d.clone().add(new T.Vector3(-0.55, 0.1, 0)).normalize();
      qq.setFromUnitVectors(up, dir);
      mm.compose(pos.add(dir.clone().multiplyScalar(0.1)), qq, new T.Vector3(0.06, 0.3, 0.06));
      spikes.setMatrixAt(k++, mm);
    }
    spikes.count = k; body.add(spikes);
    const feet = [];
    for (const s of [-1, 1]) feet.push(mk(G3.sph, mat('#6b4129', 0.7), 0.11, 0.07, 0.09, 0.1, 0.06, s * 0.15, body));
    const hands = [];
    for (const s of [-1, 1]) hands.push(mk(G3.sph, skin, 0.07, 0.06, 0.06, 0.32, 0.22, s * 0.22, body));
    root.scale.setScalar(scale);
    return { root, body, eyes, feet, hands, phase: Math.random() * 6, blink: 2 + Math.random() * 3, ry: -0.5 };
  }
  function makeBalloons(cols, s = 1) {
    const g = new T.Group(), list = [];
    const offs = [[-0.32, 1.55, 0.05, -0.25], [0.05, 1.8, -0.05, 0.05], [0.36, 1.5, 0.08, 0.3]];
    offs.forEach(([x, y, z, rz], i) => {
      const b = new T.Group(); b.position.set(x * s, 0, z * s); b.rotation.z = rz; g.add(b);
      mk(G3.sph, mat(cols[i % cols.length], 0.25), 0.3 * s, 0.36 * s, 0.3 * s, 0, y * s, 0, b);
      mk(G3.cone6, mat(cols[i % cols.length], 0.3), 0.06 * s, 0.08 * s, 0.06 * s, 0, (y - 0.38) * s, 0, b);
      mk(G3.cylL, mat('#ffffff', 0.9), 0.008, y * s * 0.7, 0.008, 0, y * s * 0.32, 0, b, false);
      list.push(b);
    });
    return { g, list };
  }
  function makeBeetle() {
    const g = new T.Group(), b = new T.Group(); g.add(b);
    mk(G3.hemi, mat('#e8332c', 0.28), 0.5, 0.45, 0.4, -0.04, 0.14, 0, b);
    for (const [x, y, z] of [[0.05, 0.57, 0.12], [-0.22, 0.47, -0.16], [0.18, 0.44, -0.22], [-0.25, 0.43, 0.2], [0.24, 0.42, 0.2]])
      mk(G3.sphL, mat('#1b1414', 0.4), 0.09, 0.05, 0.09, x, y, z, b, false);
    mk(G3.box, mat('#1b1414', 0.5), 0.9, 0.04, 0.03, -0.04, 0.5, 0, b, false).position.y = 0.57;
    mk(G3.sph, mat('#1f1a1a', 0.4), 0.22, 0.2, 0.22, 0.44, 0.24, 0, b);
    for (const s of [-1, 1]) {
      const e = mk(G3.sph, mat('#ffffff', 0.2), 0.08, 0.09, 0.07, 0.56, 0.3, s * 0.1, b);
      mk(G3.sphL, mat('#111111', 0.2), 0.5, 0.55, 0.5, 0.45, 0, 0.1 * s, e, false);
      const an = mk(G3.cylL, mat('#1f1a1a', 0.5), 0.015, 0.28, 0.015, 0.56, 0.48, s * 0.07, b, false); an.rotation.z = -0.5;
    }
    const legs = [];
    for (const x of [-0.25, 0, 0.25]) for (const s of [-1, 1]) {
      const l = mk(G3.cylL, mat('#1f1a1a', 0.5), 0.03, 0.22, 0.03, x, 0.08, s * 0.34, b, false); l.rotation.x = s * 0.9; legs.push(l);
    }
    return { root: g, body: b, legs };
  }
  function makeBee() {
    const g = new T.Group(), b = new T.Group(); g.add(b);
    mk(G3.sph, mat('#ffd23a', 0.35), 0.38, 0.3, 0.3, 0, 0, 0, b);
    for (const x of [-0.1, 0.1]) { const r = mk(G3.torus, mat('#2a1d0c', 0.5), 0.27 - Math.abs(x) * 0.3, 0.27 - Math.abs(x) * 0.3, 0.35, x, 0, 0, b); r.rotation.y = Math.PI / 2; }
    mk(G3.sph, mat('#3a2a10', 0.4), 0.2, 0.19, 0.19, 0.34, 0.05, 0, b);
    for (const s of [-1, 1]) {
      const e = mk(G3.sph, mat('#ffffff', 0.2), 0.065, 0.075, 0.06, 0.47, 0.1, s * 0.09, b);
      mk(G3.sphL, mat('#111111', 0.2), 0.55, 0.55, 0.5, 0.45, 0, 0, e, false);
    }
    const st = mk(G3.cone6, mat('#2a1d0c', 0.5), 0.07, 0.18, 0.07, -0.44, 0, 0, b); st.rotation.z = Math.PI / 2;
    const wings = [];
    for (const s of [-1, 1]) { const w = mk(G3.sph, mat('#ffffff', 0.1, { op: 0.65 }), 0.2, 0.025, 0.13, -0.02, 0.3, s * 0.16, b, false); wings.push(w); }
    return { root: g, body: b, wings };
  }
  function makeFish() {
    const g = new T.Group(), b = new T.Group(); g.add(b);
    mk(G3.sph, mat('#ff7a2a', 0.3), 0.42, 0.3, 0.2, 0, 0, 0, b);
    mk(G3.sph, mat('#ffd3a0', 0.5), 0.3, 0.17, 0.16, 0.06, -0.12, 0, b, false);
    const tail = mk(G3.cone6, mat('#ff5a1a', 0.3), 0.24, 0.3, 0.07, -0.5, 0, 0, b); tail.rotation.z = -Math.PI / 2;
    const fin = mk(G3.cone6, mat('#ff5a1a', 0.3), 0.14, 0.22, 0.04, -0.02, 0.3, 0, b); fin.rotation.z = 0.5;
    for (const s of [-1, 1]) {
      const e = mk(G3.sph, mat('#ffffff', 0.2), 0.09, 0.09, 0.05, 0.24, 0.08, s * 0.15, b);
      mk(G3.sphL, mat('#111111', 0.2), 0.55, 0.55, 0.6, 0.35, 0, 0.3 * s, e, false);
      const br = mk(G3.box, mat('#3a1206', 0.6), 0.14, 0.03, 0.02, 0.25, 0.19, s * 0.16, b, false); br.rotation.z = -0.4;
    }
    return { root: g, body: b, tail };
  }
  function makeCrow() {
    const g = new T.Group(), b = new T.Group(); g.add(b);
    mk(G3.sph, mat('#2b2d42', 0.45), 0.36, 0.3, 0.28, 0, 0, 0, b);
    mk(G3.sph, mat('#2b2d42', 0.45), 0.21, 0.2, 0.2, 0.33, 0.17, 0, b);
    const bk = mk(G3.cone6, mat('#ffa21f', 0.4), 0.07, 0.22, 0.06, 0.58, 0.14, 0, b); bk.rotation.z = -Math.PI / 2;
    for (const s of [-1, 1]) {
      const e = mk(G3.sph, mat('#ffe14d', 0.2), 0.06, 0.06, 0.05, 0.45, 0.24, s * 0.12, b);
      mk(G3.sphL, mat('#111111', 0.2), 0.5, 0.6, 0.5, 0.4, 0, 0, e, false);
    }
    const tl = mk(G3.box, mat('#22233a', 0.5), 0.3, 0.05, 0.22, -0.42, 0.08, 0, b); tl.rotation.z = 0.3;
    const wings = [];
    for (const s of [-1, 1]) { const w = new T.Group(); w.position.set(0, 0.12, s * 0.22); b.add(w); mk(G3.box, mat('#22233a', 0.5), 0.4, 0.04, 0.45, 0, 0, s * 0.22, w); wings.push(w); }
    return { root: g, body: b, wings };
  }
  function makeBoss() {
    const g = new T.Group(), b = new T.Group(); g.add(b);
    const tex = canvasTex(256, 64, (x, w, h) => {
      const cols = ['#ff4a5a', '#ffd23a', '#ff4a5a', '#3dc1ff', '#ff4a5a', '#ffd23a', '#ff4a5a', '#7be05a'];
      for (let i = 0; i < 16; i++) { x.fillStyle = cols[i % cols.length]; x.fillRect(i * 16, 0, 16, h); }
    });
    const env = new T.Mesh(new T.SphereGeometry(1, 28, 18), new T.MeshStandardMaterial({ map: tex, roughness: 0.45 }));
    env.scale.set(2, 2.25, 2); env.position.y = 3.4; env.castShadow = true; b.add(env);
    mk(G3.cyl, mat('#e84a3a', 0.5), 0.7, 0.3, 0.7, 0, 1.25, 0, b);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * TAU + 0.6, r = mk(G3.cylL, mat('#5b3a22', 0.8), 0.025, 1.4, 0.025, Math.cos(a) * 0.68, 0.75, Math.sin(a) * 0.68, b, false);
      r.rotation.z = Math.cos(a) * 0.15; r.rotation.x = -Math.sin(a) * 0.15;
    }
    mk(G3.cyl, mat('#a86b35', 0.85), 0.8, 0.75, 0.8, 0, -0.15, 0, b);
    mk(G3.torus, mat('#7a4a22', 0.8), 0.8, 0.8, 0.5, 0, 0.22, 0, b).rotation.x = Math.PI / 2;
    // αλεπού
    const fox = new T.Group(); fox.position.set(0, 0.45, 0.25); b.add(fox);
    const or = mat('#ff7f24', 0.6), wh = mat('#fff4e6', 0.7), bl = mat('#1b1210', 0.3);
    mk(G3.sph, or, 0.5, 0.45, 0.45, 0, 0.5, 0, fox);
    mk(G3.sph, wh, 0.3, 0.2, 0.25, 0, 0.32, 0.3, fox);
    mk(G3.sph, bl, 0.08, 0.07, 0.07, 0, 0.42, 0.55, fox);
    for (const s of [-1, 1]) {
      const ear = mk(G3.cone6, or, 0.16, 0.4, 0.12, s * 0.3, 1.0, 0, fox); ear.rotation.z = -s * 0.3;
      mk(G3.cone6, bl, 0.07, 0.15, 0.05, s * 0.36, 1.12, 0.03, fox).rotation.z = -s * 0.3;
      const e = mk(G3.sph, mat('#ffffff', 0.2), 0.11, 0.09, 0.06, s * 0.19, 0.62, 0.38, fox);
      mk(G3.sphL, bl, 0.5, 0.75, 0.6, 0.15 * -s, -0.05, 0.5, e, false);
      const br = mk(G3.box, bl, 0.2, 0.04, 0.04, s * 0.19, 0.76, 0.42, fox); br.rotation.z = s * 0.35;
      mk(G3.sph, or, 0.11, 0.1, 0.11, s * 0.5, 0.05, 0.55, fox);
    }
    return { root: g, body: b, fox, env };
  }
  function makeCage(locked) {
    const g = new T.Group(), top = new T.Group(); g.add(top);
    mk(G3.cyl, mat('#8b5a2b', 0.8), 0.95, 0.2, 0.95, 0, 0.1, 0, g);
    mk(G3.cyl, mat('#8b5a2b', 0.8), 0.95, 0.16, 0.95, 0, 1.85, 0, top);
    mk(G3.cone, mat('#c0392b', 0.6), 1.05, 0.55, 1.05, 0, 2.2, 0, top);
    mk(G3.sph, mat('#ffd23a', 0.3, { m: 0.6 }), 0.12, 0.12, 0.12, 0, 2.55, 0, top);
    for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU; mk(G3.cylL, mat('#c9ccd6', 0.3, { m: 0.7 }), 0.035, 1.65, 0.035, Math.cos(a) * 0.86, 1.0, Math.sin(a) * 0.86, top); }
    const lock = new T.Group(); lock.position.set(0, 0.9, 0.92); g.add(lock);
    mk(G3.box, mat('#ffcc33', 0.3, { m: 0.7 }), 0.32, 0.28, 0.1, 0, 0, 0, lock);
    mk(G3.torus, mat('#c9ccd6', 0.3, { m: 0.7 }), 0.1, 0.1, 0.2, 0, 0.18, 0, lock);
    lock.visible = !!locked;
    const babies = [];
    ['#f7a8c4', '#a8d8f7', '#c8f7a8'].forEach((c, i) => {
      const h = makeHog(c, 0.55); h.root.position.set((i - 1) * 0.42, 0.2, (i % 2) * 0.15 - 0.05); h.root.rotation.y = -0.6 + i * 0.2; g.add(h.root); babies.push(h);
    });
    return { root: g, top, lock, babies };
  }

  // ---------- το παιχνίδι ----------
  class HedgehogGame extends Base {
    resize() {
      super.resize();
      if (this.R) { this.R.setSize(this.W, this.H, false); this.cam.aspect = this.W / this.H; this.cam.updateProjectionMatrix(); }
    }

    setup() {
      this.phase = 'load'; this.lv = 0; this.lives = LIVES; this.team = 0; this.map = null; this.loadErr = '';
      (this.hogs || []).forEach((o) => o.parent && o.parent.remove(o)); this.hogs = [];
      this.pops = []; this.say = null;
      this.parts.forEach((p, i) => Object.assign(p, {
        idx: i, score: 0, fruits: 0, foes: 0, deaths: 0, mv: 0, mvV: 0, x: 0, y: 0, vx: 0, vy: 0, face: 1, onG: false,
        jumpBuf: 0, coy: 0, dead: 0, inv: 0, pow: null, powT: 0, shield: 0, balloon: 0, o2: 1, swim: false, offT: 0, botT: 0, stuck: 0,
        shootCd: 0, land: 0, ckey: '', ckT: 0, mesh: null, hi: false, gone: false,
      }));
      const id = (this.gen = (this.gen || 0) + 1);
      loadThree().then(() => {
        if (!this.running || id !== this.gen) return;
        try { this.init3D(); this.startLevel(0); } catch (e) { console.error(e); this.loadErr = String(e && e.message || e); }
      }).catch((e) => { this.loadErr = 'Δεν φορτώθηκε το 3D (' + (e && e.message || e) + ')'; });
    }

    end() {
      super.end();
      this.musicOn = false;
      if (this.cv3) this.cv3.hidden = true;
    }

    // ---------- 3D σκηνή ----------
    init3D() {
      if (!G3) {
        G3 = {
          sph: new T.SphereGeometry(1, 18, 12), sphM: new T.SphereGeometry(1, 12, 8), sphL: new T.SphereGeometry(1, 8, 6), box: new T.BoxGeometry(1, 1, 1),
          cone: new T.ConeGeometry(1, 1, 14), cone6: new T.ConeGeometry(1, 1, 6), cyl: new T.CylinderGeometry(1, 1, 1, 16),
          cylL: new T.CylinderGeometry(1, 1, 1, 6), hemi: new T.SphereGeometry(1, 22, 12, 0, TAU, 0, Math.PI / 2),
          torus: new T.TorusGeometry(1, 0.22, 8, 24), ico: new T.IcosahedronGeometry(1, 1), ico0: new T.IcosahedronGeometry(1, 0),
        };
        _m = new T.Matrix4(); _q = new T.Quaternion(); _e = new T.Euler(); _v = new T.Vector3(); _s = new T.Vector3(); _c = new T.Color(); _p = new T.Matrix4();
      }
      if (!this.R) {
        const cv = (this.cv3 = document.createElement('canvas'));
        cv.id = 'stage3d';
        cv.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;display:block';
        this.c.parentNode.insertBefore(cv, this.c);
        const R = (this.R = new T.WebGLRenderer({ canvas: cv, antialias: true, powerPreference: 'high-performance' }));
        this.q = 1;
        R.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.25));
        R.shadowMap.enabled = true; R.shadowMap.type = T.PCFSoftShadowMap;
        R.toneMapping = T.ACESFilmicToneMapping; R.toneMappingExposure = 1.05;
        this.scene = new T.Scene();
        this.cam = new T.PerspectiveCamera(32, this.W / this.H, 0.5, 600);
        this.hemi = new T.HemisphereLight('#dff1ff', '#6b8f4a', 1.25); this.scene.add(this.hemi);
        const sun = (this.sun = new T.DirectionalLight('#fff1d6', 2.6));
        sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024);
        Object.assign(sun.shadow.camera, { left: -24, right: 24, top: 15, bottom: -15, near: 1, far: 90 });
        sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.03;
        this.scene.add(sun); this.scene.add(sun.target);
        const skyMat = (this.skyMat = new T.ShaderMaterial({
          side: T.BackSide, depthWrite: false, fog: false,
          uniforms: { a: { value: new T.Color('#3d9bff') }, b: { value: new T.Color('#d4f0ff') } },
          vertexShader: 'varying float h; void main(){ h = normalize(position).y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
          fragmentShader: 'uniform vec3 a; uniform vec3 b; varying float h; void main(){ gl_FragColor = vec4(mix(b, a, smoothstep(-0.08, 0.32, h)), 1.0);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}',
        }));
        this.sky = new T.Mesh(new T.SphereGeometry(400, 24, 12), skyMat); this.sky.renderOrder = -1; this.scene.add(this.sky);
        this.scene.fog = new T.Fog('#cbe9ff', 45, 190);
        // σωματίδια
        const pm = new T.MeshStandardMaterial({ color: '#ffffff', roughness: 0.5, emissive: '#222222' });
        this.pim = new T.InstancedMesh(G3.ico0, pm, 500); this.pim.frustumCulled = false; this.pim.count = 0;
        this.pim.setColorAt(0, new T.Color('#fff')); this.scene.add(this.pim);
        this.tex = {
          dirt: canvasTex(128, 128, (x, w, h) => {
            x.fillStyle = '#ffffff'; x.fillRect(0, 0, w, h); const r = rnd(7);
            for (let i = 0; i < 260; i++) { x.fillStyle = `rgba(${r() < 0.5 ? '60,30,10' : '255,230,200'},${0.06 + r() * 0.12})`; x.beginPath(); x.arc(r() * w, r() * h, 2 + r() * 9, 0, TAU); x.fill(); }
            for (let i = 0; i < 14; i++) { const X = r() * w, Y = r() * h, s = 4 + r() * 6; x.fillStyle = 'rgba(90,70,60,.55)'; x.beginPath(); x.ellipse(X, Y, s, s * 0.7, r() * 3, 0, TAU); x.fill(); x.fillStyle = 'rgba(255,255,255,.25)'; x.beginPath(); x.ellipse(X - s * 0.25, Y - s * 0.25, s * 0.4, s * 0.25, 0, 0, TAU); x.fill(); }
          }),
          stone: canvasTex(128, 128, (x, w, h) => {
            x.fillStyle = '#ffffff'; x.fillRect(0, 0, w, h); const r = rnd(3);
            x.strokeStyle = 'rgba(40,40,50,.55)'; x.lineWidth = 5;
            for (let row = 0; row < 3; row++) { const y0 = row * 43; x.strokeRect(-4, y0, w + 8, 43); for (let k = 0; k < 2; k++) { const X = ((row % 2) * 32 + k * 64) % w; x.beginPath(); x.moveTo(X, y0); x.lineTo(X, y0 + 43); x.stroke(); } }
            for (let i = 0; i < 120; i++) { x.fillStyle = `rgba(${r() < 0.5 ? '0,0,0' : '255,255,255'},${0.05 + r() * 0.08})`; x.fillRect(r() * w, r() * h, 3 + r() * 8, 3 + r() * 6); }
          }),
          wood: canvasTex(128, 32, (x, w, h) => {
            x.fillStyle = '#c98b4e'; x.fillRect(0, 0, w, h); const r = rnd(11);
            for (let i = 0; i < 18; i++) { x.strokeStyle = `rgba(90,50,20,${0.15 + r() * 0.2})`; x.lineWidth = 1 + r() * 2; x.beginPath(); const y = r() * h; x.moveTo(0, y); x.bezierCurveTo(w * 0.3, y + r() * 6 - 3, w * 0.7, y + r() * 6 - 3, w, y); x.stroke(); }
            x.fillStyle = 'rgba(60,30,10,.5)'; x.fillRect(0, h - 3, w, 3); x.fillRect(0, 0, w, 2);
            x.fillStyle = '#5a3a1a'; [[10, h / 2], [w - 10, h / 2]].forEach(([X, Y]) => { x.beginPath(); x.arc(X, Y, 3, 0, TAU); x.fill(); });
          }),
          crate: canvasTex(128, 128, (x, w, h) => {
            x.fillStyle = '#d29550'; x.fillRect(0, 0, w, h);
            x.fillStyle = '#9c6230'; x.fillRect(0, 0, w, 14); x.fillRect(0, h - 14, w, 14); x.fillRect(0, 0, 14, h); x.fillRect(w - 14, 0, 14, h);
            x.font = '900 78px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
            x.lineWidth = 8; x.strokeStyle = '#6b3d16'; x.strokeText('?', w / 2, h / 2 + 4); x.fillStyle = '#ffe066'; x.fillText('?', w / 2, h / 2 + 4);
          }),
          wave: canvasTex(128, 128, (x, w, h) => {
            x.fillStyle = '#ffffff'; x.fillRect(0, 0, w, h); x.strokeStyle = 'rgba(120,200,255,.6)'; x.lineWidth = 3;
            for (let k = 0; k < 6; k++) { x.beginPath(); for (let X = 0; X <= w; X += 4) { const Y = k * 22 + 8 + Math.sin((X / w) * TAU * 2 + k) * 4; X ? x.lineTo(X, Y) : x.moveTo(X, Y); } x.stroke(); }
          }, true),
        };
      }
      this.cv3.hidden = false;
      this.resize();
    }

    startLevel(i) {
      this.lv = i;
      const D = LEVELS[i], th = (this.th = THEMES[D.theme]);
      if (this.lvl) { this.scene.remove(this.lvl); this.lvl.traverse((o) => { if (o.isInstancedMesh) o.dispose(); }); }
      this.lvl = new T.Group(); this.scene.add(this.lvl);
      const m = grid(D.w, D.h); D.build(m); this.map = m;
      this.skyMat.uniforms.a.value.set(th.top); this.skyMat.uniforms.b.value.set(th.bot);
      this.scene.fog.color.set(th.fog);
      this.hemi.color.set(D.theme === 'sky' ? '#ffe6f2' : '#e2f3ff'); this.hemi.groundColor.set(D.theme === 'sky' ? '#e8dcff' : '#6b8f4a'); this.hemi.intensity = D.theme === 'sky' ? 1.6 : 1.25;
      this.sun.color.set(D.theme === 'sky' ? '#ffe1c4' : '#fff1d6'); this.sun.intensity = th.sun;
      this.buildTerrain(); this.buildDecor();
      this.foes = []; this.items = []; this.spines = []; this.cones = []; this.bubbles = []; this.parts3 = []; this.boss = null;
      this.cage = null; this.check = null; this.weeds = this.weeds || null;
      const fr = m.ents.filter((e) => e.k === 'fruit');
      this.fruitInst = {};
      for (const k of Object.keys(FRUIT)) {
        const list = fr.filter((e) => e.f === k);
        if (!list.length) continue;
        this.fruitInst[k] = new Inst(this.lvl, this.fruitParts(k), list.length, true);
      }
      const cnt = {};
      for (const e of m.ents) {
        const x = e.x + 0.5, y = e.y;
        if (e.k === 'start') this.start = { x, y };
        else if (e.k === 'fruit') { const n = (cnt[e.f] = (cnt[e.f] || 0) + 1) - 1; this.items.push({ k: 'fruit', f: e.f, x, y: y + 0.5, i: n, ph: x * 0.7 }); }
        else if (e.k === 'beetle') this.addFoe('beetle', x, y, e);
        else if (e.k === 'bee') this.addFoe('bee', x, y + 0.5, e);
        else if (e.k === 'fish') this.addFoe('fish', x, y + 0.5, e);
        else if (e.k === 'crow') this.addFoe('crow', x, y + 0.5, e);
        else if (e.k === 'boss') this.addBoss(x, y);
        else this.addItem(e.k, x, y);
      }
      // παίκτες
      this.parts.forEach((p, k) => {
        if (!p.mesh) { p.mesh = makeHog(p.color.hex); p.bal = makeBalloons(['#ff4a5a', '#ffd23a', '#3dc1ff'], 1.3); p.mesh.root.add(p.bal.g); this.scene.add(p.mesh.root); this.hogs.push(p.mesh.root);
          p.shieldM = mk(G3.sph, mat('#9ff0ff', 0.1, { op: 0.35, em: '#5fd6ff', ei: 0.5 }), 0.7, 0.7, 0.7, 0, 0.45, 0, p.mesh.root, false); }
        Object.assign(p, { x: this.start.x + k * 0.9, y: this.start.y, vx: 0, vy: 0, face: 1, dead: 0, inv: 0, balloon: 0, o2: 1, swim: false, offT: 0, pow: null, powT: 0, shield: 0 });
        p.bal.g.visible = false; p.shieldM.visible = false;
      });
      this.phase = 'count'; this.titleT = this.time;
      this.camX = this.start.x + 3; this.camY = this.start.y + 3; this.camD = 21;
      this.countdown(() => { this.phase = 'go'; this.changed(); });
      SND.init(); this.musicOn = true; this.song = SONGS[i]; this.mStep = 0; this.mNext = SND.ac ? SND.ac.currentTime + 0.1 : 0;
      this.changed();
    }

    fruitParts(k) {
      const leaf = mat('#3fbf3a', 0.5), stem = mat('#6b4423', 0.8);
      if (k === 'apple') return [{ geo: G3.sphM, mat: mat('#ef3b2d', 0.3), m: Lm(0, 0, 0, 0.27, 0.25, 0.27) }, { geo: G3.cylL, mat: stem, m: Lm(0, 0.28, 0, 0.025, 0.14, 0.025, 0, 0, 0.2) }, { geo: G3.sphL, mat: leaf, m: Lm(0.09, 0.3, 0, 0.11, 0.03, 0.06, 0, 0, 0.5) }];
      if (k === 'orange') return [{ geo: G3.sphM, mat: mat('#ff9a1f', 0.45), m: Lm(0, 0, 0, 0.26, 0.25, 0.26) }, { geo: G3.sphL, mat: leaf, m: Lm(0.07, 0.26, 0, 0.11, 0.03, 0.06, 0, 0, 0.4) }];
      if (k === 'cherry') {
        const r = mat('#c4102c', 0.25);
        return [{ geo: G3.sphM, mat: r, m: Lm(-0.13, -0.08, 0, 0.15, 0.15, 0.15) }, { geo: G3.sphM, mat: r, m: Lm(0.13, -0.1, 0.04, 0.15, 0.15, 0.15) },
          { geo: G3.cylL, mat: mat('#4a8a2a', 0.7), m: Lm(-0.065, 0.14, 0, 0.018, 0.26, 0.018, 0, 0, -0.55) }, { geo: G3.cylL, mat: mat('#4a8a2a', 0.7), m: Lm(0.065, 0.13, 0.02, 0.018, 0.3, 0.018, 0, 0, 0.48) },
          { geo: G3.sphL, mat: leaf, m: Lm(0.08, 0.3, 0, 0.12, 0.03, 0.06, 0, 0, 0.3) }];
      }
      if (k === 'straw') return [{ geo: G3.cone, mat: mat('#ff3550', 0.35), m: Lm(0, -0.04, 0, 0.22, 0.44, 0.22, Math.PI, 0, 0) }, { geo: G3.sphM, mat: mat('#ff3550', 0.35), m: Lm(0, 0.15, 0, 0.215, 0.1, 0.215) }, { geo: G3.cone6, mat: leaf, m: Lm(0, 0.24, 0, 0.2, 0.1, 0.2) }];
      const pu = mat('#8e44d8', 0.25), parts = [];
      [[0, 0.12, 0], [-0.11, 0.02, 0.03], [0.11, 0.02, 0.03], [0, -0.08, 0.05], [-0.06, -0.18, 0], [0.06, -0.18, 0], [0, 0.04, -0.09], [0, -0.28, 0.02]].forEach(([x, y, z]) => parts.push({ geo: G3.sphM, mat: pu, m: Lm(x, y, z, 0.1, 0.1, 0.1) }));
      parts.push({ geo: G3.cylL, mat: stem, m: Lm(0, 0.26, 0, 0.02, 0.14, 0.02) }, { geo: G3.sphL, mat: leaf, m: Lm(0.1, 0.27, 0, 0.13, 0.03, 0.07, 0, 0, 0.3) });
      return parts;
    }

    tile(x, y) {
      const m = this.map;
      if (x < 0 || x >= m.w) return 'B';
      if (y < 0 || y >= m.h) return ' ';
      return m.g[y][x];
    }

    buildTerrain() {
      const m = this.map, th = this.th, sky = this.map && LEVELS[this.lv].theme === 'sky', lake = LEVELS[this.lv].theme === 'lake';
      const L = { '#': [], cap: [], B: [], s: [], '=': [], '^': [], wf: [], wt: [] };
      for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
        const c = m.g[y][x];
        if (c === '#') { L['#'].push([x, y]); if (!solidC(this.tile(x, y + 1))) L.cap.push([x, y]); }
        else if (c === 'B' || c === 's' || c === '=' || c === '^') L[c].push([x, y]);
        else if (c === '~') { L.wf.push([x, y]); if (this.tile(x, y + 1) !== '~' && !solidC(this.tile(x, y + 1))) L.wt.push([x, y]); }
      }
      const root = this.lvl, r = rnd(this.lv * 99 + 5);
      const inst = (geo, material, list, fn, cast = true, colorFn) => {
        if (!list.length) return null;
        const im = new T.InstancedMesh(geo, material, list.length);
        list.forEach((q, i) => { fn(q, i); im.setMatrixAt(i, _m); if (colorFn) { colorFn(q, i); im.setColorAt(i, _c); } });
        im.castShadow = cast; im.receiveShadow = true; root.add(im); return im;
      };
      const put = (x, y, z, sx, sy, sz, ry = 0, rz = 0) => { _e.set(0, ry, rz); _q.setFromEuler(_e); _v.set(x, y, z); _s.set(sx, sy, sz); _m.compose(_v, _q, _s); };
      const jit = (hex, a) => { _c.set(hex); _c.offsetHSL((r() - 0.5) * 0.02, (r() - 0.5) * 0.08, (r() - 0.5) * a); };
      if (sky) {
        const cm = new T.MeshStandardMaterial({ color: '#ffffff', roughness: 1, emissive: '#ffffff', emissiveIntensity: 0.18 });
        inst(G3.box, cm, L['#'], ([x, y]) => put(x + 0.5, y + 0.5, 0, 1, 1, DEPTH * 0.9), true, () => jit('#f6f2ff', 0.05));
        const puffs = []; L.cap.forEach(([x, y]) => { for (const z of [-0.55, 0.05, 0.6]) puffs.push([x + 0.5 + (r() - 0.5) * 0.3, y + 0.92, z, 0.42 + r() * 0.2]); });
        L['#'].forEach(([x, y]) => { if (!solidC(this.tile(x, y - 1))) puffs.push([x + 0.5, y + 0.05, 0.2, 0.5 + r() * 0.15]); });
        inst(G3.ico, new T.MeshStandardMaterial({ color: '#ffffff', roughness: 1, emissive: '#ffffff', emissiveIntensity: 0.22 }), puffs, ([x, y, z, s]) => put(x, y, z, s * 1.15, s * 0.85, s), true, () => jit('#fff7fd', 0.04));
        const pp = []; L['='].forEach(([x, y]) => { for (const dx of [0.22, 0.78]) pp.push([x + dx, y + 0.76, (r() - 0.5) * 0.4, 0.38 + r() * 0.1]); pp.push([x + 0.5, y + 0.9, (r() - 0.5) * 0.6, 0.3]); });
        inst(G3.ico, new T.MeshStandardMaterial({ color: '#ffffff', roughness: 1, emissive: '#ffffff', emissiveIntensity: 0.22 }), pp, ([x, y, z, s]) => put(x, y, z, s * 1.2, s * 0.8, s * 1.4), true, () => jit('#fff3fb', 0.05));
      } else {
        const dm = new T.MeshStandardMaterial({ color: '#ffffff', map: this.tex.dirt, roughness: 0.95 });
        inst(G3.box, dm, L['#'], ([x, y]) => put(x + 0.5, y + 0.5, 0, 1, 1, DEPTH), true, () => jit(th.dirt, 0.06));
        const gm = new T.MeshStandardMaterial({ color: '#ffffff', roughness: 0.8 });
        inst(G3.box, gm, L.cap, ([x, y]) => put(x + 0.5, y + 0.9, 0, 1.03, 0.24, DEPTH + 0.06), true, () => jit(th.grass, 0.05));
        const lips = []; L.cap.forEach(([x, y]) => { lips.push([x + 0.25, y + 0.82, DEPTH / 2 + 0.03]); lips.push([x + 0.75, y + 0.8, DEPTH / 2 + 0.02]); });
        inst(G3.sphL, gm, lips, ([x, y, z]) => put(x, y, z, 0.3, 0.19, 0.12), false, () => jit(th.grass, 0.06));
      }
      if (!sky) {
        const cols = []; for (let x = 0; x < m.w; x++) if (solidC(m.g[0][x])) cols.push(x);
        inst(G3.box, new T.MeshStandardMaterial({ color: '#ffffff', map: this.tex.dirt, roughness: 1 }), cols, (x) => put(x + 0.5, -5, 0, 1, 10, DEPTH), false, () => jit(mixHex(th.dirt, '#000000', 0.25), 0.04));
      }
      const sm = new T.MeshStandardMaterial({ color: '#ffffff', map: this.tex.stone, roughness: 0.9 });
      inst(G3.box, sm, L.B, ([x, y]) => put(x + 0.5, y + 0.5, 0, 1, 1, DEPTH), true, () => jit(th.stone, 0.08));
      if (lake) {
        const moss = L.B.filter(([x, y]) => !solidC(this.tile(x, y + 1)) && this.tile(x, y + 1) !== '^');
        inst(G3.box, new T.MeshStandardMaterial({ color: '#ffffff', roughness: 0.9 }), moss, ([x, y]) => put(x + 0.5, y + 0.95, 0, 1.02, 0.12, DEPTH + 0.04), false, () => jit('#5d9a3a', 0.06));
      }
      inst(G3.box, new T.MeshStandardMaterial({ color: '#ffffff', roughness: 1 }), L.s, ([x, y]) => put(x + 0.5, y + 0.5, 0, 1, 1, DEPTH), false, () => jit('#e8cf8f', 0.06));
      if (!sky) {
        const wm = new T.MeshStandardMaterial({ color: '#ffffff', map: this.tex.wood, roughness: 0.75 });
        inst(G3.box, wm, L['='], ([x, y]) => put(x + 0.5, y + 0.86, 0, 1.0, 0.24, 1.3), true, () => jit('#e2a868', 0.06));
      }
      // αγκαθωτοί θάμνοι
      const th1 = [], th2 = [];
      L['^'].forEach(([x, y]) => {
        for (let k = 0; k < 3; k++) th1.push([x + 0.2 + k * 0.3, y + 0.25, (r() - 0.5) * 1.2]);
        for (let k = 0; k < 6; k++) th2.push([x + r(), y + 0.35 + r() * 0.2, (r() - 0.5) * 1.3, (r() - 0.5) * 1.2]);
      });
      inst(G3.ico, new T.MeshStandardMaterial({ color: '#2f6b2a', roughness: 0.8, flatShading: true }), th1, ([x, y, z]) => put(x, y, z, 0.3, 0.3, 0.3), true);
      inst(G3.cone6, new T.MeshStandardMaterial({ color: '#f1e7d0', roughness: 0.5 }), th2, ([x, y, z, rz]) => put(x, y, z, 0.07, 0.42, 0.07, 0, rz), true);
      // νερό: μπροστινή επιφάνεια, πίσω τοίχωμα, πάνω κυματιστή επιφάνεια
      if (L.wf.length) {
        const quads = (list, mkq) => {
          const pos = [], uv = [];
          for (const q of list) { const v = mkq(q); pos.push(...v.p); uv.push(...v.u); }
          const g = new T.BufferGeometry();
          g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); g.computeVertexNormals();
          return g;
        };
        const runs = []; // οριζόντιες σειρές νερού
        for (let y = 0; y < m.h; y++) { let x0 = -1; for (let x = 0; x <= m.w; x++) { const w = x < m.w && m.g[y][x] === '~'; if (w && x0 < 0) x0 = x; if (!w && x0 >= 0) { runs.push([x0, x, y]); x0 = -1; } } }
        const fq = (z) => ([x0, x1, y]) => { const yt = y + (this.tile(x0, y + 1) === '~' ? 1 : 0.92); return { p: [x0, y, z, x1, y, z, x1, yt, z, x0, y, z, x1, yt, z, x0, yt, z], u: [0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1] }; };
        const front = new T.Mesh(quads(runs, fq(DEPTH / 2 + 0.02)), new T.MeshStandardMaterial({ color: '#2a9be0', roughness: 0.15, transparent: true, opacity: 0.42, depthWrite: false }));
        front.renderOrder = 2; root.add(front);
        const back = new T.Mesh(quads(runs, fq(-DEPTH / 2 - 0.02)), new T.MeshStandardMaterial({ color: '#2a7cbf', roughness: 0.6, side: T.DoubleSide }));
        root.add(back);
        const tq = ([x0, x1, y]) => { const yt = y + 0.92, z0 = -DEPTH / 2, z1 = DEPTH / 2 + 0.02; return { p: [x0, yt, z1, x1, yt, z1, x1, yt, z0, x0, yt, z1, x1, yt, z0, x0, yt, z0], u: [x0 / 3, 0, x1 / 3, 0, x1 / 3, 0.6, x0 / 3, 0, x1 / 3, 0.6, x0 / 3, 0.6] }; };
        const truns = [];
        for (let y = 0; y < m.h; y++) { let x0 = -1; for (let x = 0; x <= m.w; x++) { const w = x < m.w && m.g[y][x] === '~' && this.tile(x, y + 1) === ' '; if (w && x0 < 0) x0 = x; if (!w && x0 >= 0) { truns.push([x0, x, y]); x0 = -1; } } }
        const wt = this.tex.wave.clone(); wt.needsUpdate = true; wt.wrapS = wt.wrapT = T.RepeatWrapping;
        this.waveTex = wt;
        const tm = new T.Mesh(quads(truns, tq), new T.MeshStandardMaterial({ color: '#8fd8ff', map: wt, roughness: 0.1, transparent: true, opacity: 0.75, depthWrite: false, side: T.DoubleSide }));
        tm.renderOrder = 3; root.add(tm);
        this.waterTop = tm;
      } else this.waveTex = null;
    }

    groundTop(x) {
      for (let y = this.map.h - 1; y >= 0; y--) if (solidC(this.tile(x, y))) return y + 1;
      return null;
    }

    buildDecor() {
      const D = LEVELS[this.lv], th = this.th, root = this.lvl, r = rnd(this.lv * 31 + 17), w = D.w;
      this.weeds = null;
      // πίσω έδαφος
      if (th.back) {
        const bm = new T.MeshStandardMaterial({ color: th.back, roughness: 1 });
        const b = mk(G3.box, bm, w + 160, 0.4, 70, w / 2, th.backY - 0.2, -DEPTH / 2 - 35.05, root, false); b.receiveShadow = true;
        mk(G3.box, mat(mixHex(th.dirt, '#000000', 0.45), 1), w + 160, 40, 70, w / 2, th.backY - 20.4, -DEPTH / 2 - 35.1, root, false);
      }
      if (D.theme === 'lake') {
        const lm = new T.MeshStandardMaterial({ color: '#4aa8e0', roughness: 0.15, metalness: 0.1 });
        mk(G3.box, lm, w + 160, 1, 60, w / 2, th.backY - 0.45, -46, root, false).receiveShadow = true;
        mk(G3.box, new T.MeshStandardMaterial({ color: '#5fae45', roughness: 1 }), w + 200, 6, 40, w / 2, th.backY - 2.5, -95, root, false);
        // βουνά
        const mts = new Inst(root, [{ geo: G3.cone6, mat: mat('#7b93b5', 0.9, { flat: true }), m: Lm(0, 0.5, 0, 1, 1, 1) }, { geo: G3.cone6, mat: mat('#ffffff', 0.7, { flat: true }), m: Lm(0, 0.82, 0, 0.36, 0.36, 0.36) }], 14);
        for (let i = 0; i < 14; i++) { const s = 18 + r() * 16; mts.set(i, -30 + i * ((w + 60) / 13) + r() * 6, th.backY - 1, -130 - r() * 30, r() * 3, s, 0, 0, s * (0.7 + r() * 0.4)); }
      }
      // λόφοι
      const nH = D.theme === 'sky' ? 26 : 18;
      const hm = new T.MeshStandardMaterial({ color: '#ffffff', roughness: 1, flatShading: D.theme !== 'sky' });
      if (D.theme === 'sky') { hm.emissive.set('#ffffff'); hm.emissiveIntensity = 0.3; }
      const hills = new Inst(root, [{ geo: G3.ico, mat: hm, m: new T.Matrix4(), tint: true }], nH);
      for (let i = 0; i < nH; i++) {
        const s = 9 + r() * 14, x = -40 + (i / nH) * (w + 80) + r() * 8;
        if (D.theme === 'sky') hills.set(i, x, -9 + r() * 4, -20 - r() * 60, r() * 3, s * 0.8, 0, 0, s * 0.35);
        else hills.set(i, x, th.backY - s * 0.55, (D.theme === 'lake' ? -100 : -40) - r() * 30, r() * 3, s, 0, 0, s * 0.62);
        hills.color(i, U.pick(th.hills));
      }
      // σύννεφα που περνούν
      const cl = [];
      for (let k = 0; k < 5; k++) cl.push({ geo: G3.ico, mat: new T.MeshStandardMaterial({ color: '#ffffff', roughness: 1, emissive: '#ffffff', emissiveIntensity: 0.15 }), m: Lm(k * 0.9 - 1.8, Math.sin(k * 1.3) * 0.3 + (k === 2 ? 0.4 : 0), (k % 2) * 0.5, 1 - Math.abs(k - 2) * 0.18, 0.8 - Math.abs(k - 2) * 0.1, 0.8) });
      this.clouds = new Inst(root, cl, 12); this.cloudPos = [];
      for (let i = 0; i < 12; i++) this.cloudPos.push({ x: r() * (w + 60) - 30, y: 16 + r() * 14, z: -30 - r() * 50, s: 1.6 + r() * 2.2, v: 0.3 + r() * 0.5 });
      if (D.theme === 'sky') {
        // ουράνιο τόξο και ήλιος
        ['#ff5a5a', '#ffa14a', '#ffe04a', '#5ad16a', '#4aa8ff', '#9a6aff'].forEach((c, i) => {
          const t = new T.Mesh(new T.TorusGeometry(40 - i * 1.4, 0.7, 6, 48, Math.PI), new T.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.45, fog: false }));
          t.position.set(w * 0.55, -6, -120); root.add(t);
        });
        const sunM = new T.Mesh(G3.sph, new T.MeshBasicMaterial({ color: '#fff3c4', fog: false })); sunM.scale.setScalar(9); sunM.position.set(w * 0.2, 40, -200); root.add(sunM);
        // μακρινά νησάκια
        const isl = new Inst(root, [{ geo: G3.cone6, mat: mat('#a5835d', 0.9, { flat: true }), m: Lm(0, -0.5, 0, 1, 1.2, 1, Math.PI, 0, 0) }, { geo: G3.cyl, mat: mat('#7ad35a', 0.9), m: Lm(0, 0.05, 0, 1.02, 0.15, 1.02) }, { geo: G3.ico, mat: mat('#3fa53a', 0.8, { flat: true }), m: Lm(0.2, 0.7, 0, 0.35, 0.5, 0.35) }], 9);
        for (let i = 0; i < 9; i++) isl.set(i, -10 + i * (w / 8) + r() * 6, 4 + r() * 16, -45 - r() * 40, r() * 3, 2 + r() * 2.5);
        return;
      }
      // δέντρα πίσω
      const nT = Math.floor(w / 2.6);
      const trees = new Inst(root, [
        { geo: G3.cyl, mat: mat('#8a5a33', 0.9), m: Lm(0, 1.1, 0, 0.22, 2.2, 0.22) },
        { geo: G3.ico, mat: new T.MeshStandardMaterial({ color: '#ffffff', roughness: 0.85, flatShading: true }), m: Lm(0, 2.8, 0, 1.25, 1.15, 1.25), tint: true },
        { geo: G3.ico, mat: new T.MeshStandardMaterial({ color: '#ffffff', roughness: 0.85, flatShading: true }), m: Lm(0.35, 3.7, 0.1, 0.85, 0.8, 0.85), tint: true },
      ], nT, true);
      for (let i = 0; i < nT; i++) {
        const z = -DEPTH / 2 - 2.5 - r() * 22, x = -20 + r() * (w + 40);
        trees.set(i, x, th.backY, z, r() * 6, 0.8 + r() * 0.7);
        trees.color(i, U.pick(['#3f9e36', '#4fb340', '#2f8a33', '#64bf3e', '#7cc23a']));
      }
      // λουλούδια και χορτάρια πάνω στο γρασίδι
      const caps = [];
      for (let y = 0; y < this.map.h; y++) for (let x = 0; x < w; x++) if (this.map.g[y][x] === '#' && !solidC(this.tile(x, y + 1)) && this.tile(x, y + 1) !== '~') caps.push([x, y + 1]);
      const fl = caps.filter(() => r() < 0.45);
      const flowers = new Inst(root, [
        { geo: G3.cylL, mat: mat('#3a9a2f', 0.8), m: Lm(0, 0.14, 0, 0.015, 0.28, 0.015) },
        { geo: G3.ico0, mat: new T.MeshStandardMaterial({ color: '#ffffff', roughness: 0.6 }), m: Lm(0, 0.3, 0, 0.09, 0.05, 0.09), tint: true },
        { geo: G3.sphL, mat: mat('#ffd23a', 0.5), m: Lm(0, 0.33, 0, 0.035, 0.03, 0.035) },
      ], fl.length);
      fl.forEach(([x, y], i) => { flowers.set(i, x + r(), y, (r() < 0.5 ? -1 : 1) * (0.25 + r() * 0.6), r() * 6, 0.8 + r() * 0.6); flowers.color(i, U.pick(['#ff5a7a', '#ffffff', '#ffb3e0', '#7fb2ff', '#ff9a3a', '#c38bff'])); });
      const gr = []; caps.forEach(([x, y]) => { for (let k = 0; k < 2; k++) if (r() < 0.7) gr.push([x + r(), y, (r() - 0.5) * 1.7]); });
      const grass = new Inst(root, [{ geo: G3.cone6, mat: new T.MeshStandardMaterial({ color: '#ffffff', roughness: 0.8 }), m: Lm(0, 0.12, 0, 0.06, 0.26, 0.04), tint: true }, { geo: G3.cone6, mat: new T.MeshStandardMaterial({ color: '#ffffff', roughness: 0.8 }), m: Lm(0.06, 0.09, 0.02, 0.05, 0.2, 0.04, 0, 0, -0.4), tint: true }], gr.length);
      gr.forEach(([x, y, z], i) => { grass.set(i, x, y, z, r() * 6, 0.8 + r() * 0.6); grass.color(i, U.pick([th.grass, '#4fb432', '#7fdc4a'])); });
      // φύκια και νούφαρα στη λίμνη
      this.weeds = null;
      if (D.theme === 'lake') {
        const bottoms = [], tops = [];
        for (let y = 0; y < this.map.h; y++) for (let x = 0; x < w; x++) {
          if (this.map.g[y][x] === '~' && solidC(this.tile(x, y - 1)) && r() < 0.5) bottoms.push([x + r(), y, (r() - 0.5) * 1.4]);
          if (this.map.g[y][x] === '~' && this.tile(x, y + 1) === ' ' && r() < 0.18) tops.push([x + r(), y + 0.93, -0.2 - r() * 0.6]);
        }
        this.weeds = new Inst(root, [{ geo: G3.box, mat: new T.MeshStandardMaterial({ color: '#ffffff', roughness: 0.7 }), m: Lm(0, 0.6, 0, 0.08, 1.2, 0.04), tint: true }, { geo: G3.box, mat: new T.MeshStandardMaterial({ color: '#ffffff', roughness: 0.7 }), m: Lm(0.08, 0.45, 0.05, 0.07, 0.9, 0.04, 0, 0, -0.2), tint: true }], bottoms.length);
        this.weedPos = bottoms.map(([x, y, z], i) => { this.weeds.color(i, U.pick(['#2f9a4a', '#4bbf5a', '#1f7a3a'])); return { x, y, z, s: 0.8 + r() * 1.2, ph: r() * 6 }; });
        const lil = new Inst(root, [{ geo: G3.cyl, mat: mat('#3fae3a', 0.6), m: Lm(0, 0, 0, 0.42, 0.03, 0.42) }, { geo: G3.ico0, mat: mat('#ff9ad0', 0.5), m: Lm(0.1, 0.07, 0.05, 0.12, 0.09, 0.12) }], tops.length);
        tops.forEach(([x, y, z], i) => lil.set(i, x, y, z, r() * 6, 0.8 + r() * 0.5));
        // καλάμια στις όχθες
        const reeds = [];
        caps.forEach(([x, y]) => { if (this.tile(x - 1, y - 1) === '~' || this.tile(x + 1, y - 1) === '~' || this.tile(x - 2, y - 1) === '~' || this.tile(x + 2, y - 1) === '~') for (let k = 0; k < 3; k++) reeds.push([x + r(), y, -0.4 - r() * 0.5]); });
        const rd = new Inst(root, [{ geo: G3.cylL, mat: mat('#5a9a3a', 0.8), m: Lm(0, 0.7, 0, 0.03, 1.4, 0.03) }, { geo: G3.cyl, mat: mat('#7a4a22', 0.8), m: Lm(0, 1.3, 0, 0.07, 0.35, 0.07) }], reeds.length);
        reeds.forEach(([x, y, z], i) => rd.set(i, x, y, z, 0, 0.7 + r() * 0.5, 0, (r() - 0.5) * 0.2));
      }
    }

    addFoe(k, x, y, e) {
      const mesh = k === 'beetle' ? makeBeetle() : k === 'bee' ? makeBee() : k === 'fish' ? makeFish() : makeCrow();
      this.lvl.add(mesh.root);
      const f = { k, x, y, x0: x, y0: y, r: e.r || 2, vx: k === 'beetle' ? -1.6 : 0, vy: 0, face: -1, hw: k === 'beetle' ? 0.4 : 0.36, hh: k === 'beetle' ? 0.55 : 0.5, ph: Math.random() * 6, mesh, dead: 0 };
      this.foes.push(f);
    }
    addBoss(x, y) {
      const mesh = makeBoss(); this.lvl.add(mesh.root);
      const hum = Math.max(1, this.parts.filter((p) => !p.bot).length);
      const hp = 20 + hum * 8;
      this.boss = { x, y, x0: x, y0: y, hp, max: hp, t: 0, flash: 0, dropT: 3, dead: 0, mesh, n: 0, beeT: 8 };
    }
    addItem(k, x, y) {
      const g = new T.Group(); g.position.set(x, y, 0); this.lvl.add(g);
      const it = { k, x, y, g, t: Math.random() * 5, ready: 1 };
      if (k === 'crate') {
        const cm = new T.MeshStandardMaterial({ map: this.tex.crate, roughness: 0.7 });
        it.box = mk(G3.box, cm, 0.85, 0.85, 0.85, 0, 0.43, 0, g); it.box.receiveShadow = true;
      } else if (k === 'mush') {
        mk(G3.cyl, mat('#fff1d6', 0.7), 0.17, 0.42, 0.17, 0, 0.21, 0, g);
        it.cap = new T.Group(); it.cap.position.y = 0.38; g.add(it.cap);
        mk(G3.hemi, mat('#ff3b3b', 0.35), 0.5, 0.36, 0.5, 0, 0, 0, it.cap);
        for (const [a, b, c] of [[0.2, 0.25, 0.22], [-0.24, 0.24, 0.15], [0, 0.34, -0.05], [0.05, 0.2, -0.38], [-0.1, 0.16, 0.42]]) mk(G3.sphL, mat('#ffffff', 0.5), 0.08, 0.04, 0.08, a, b, c, it.cap, false);
      } else if (k === 'pod') {
        mk(G3.cyl, mat('#8a5a33', 0.8), 0.06, 0.9, 0.06, 0, 0.45, 0, g);
        it.bal = makeBalloons(['#ff4a5a', '#ffd23a', '#3dc1ff'], 0.9); it.bal.g.position.y = -0.4; g.add(it.bal.g);
      } else if (k === 'flag') {
        mk(G3.cyl, mat('#f4f4f4', 0.4), 0.05, 2.2, 0.05, 0, 1.1, 0, g);
        mk(G3.sph, mat('#ffd23a', 0.3, { m: 0.5 }), 0.09, 0.09, 0.09, 0, 2.25, 0, g);
        it.cloth = new T.Group(); it.cloth.position.set(0.05, 1.85, 0); g.add(it.cloth);
        it.clothM = mk(G3.box, new T.MeshStandardMaterial({ color: '#b9b9c6', roughness: 0.7 }), 0.75, 0.5, 0.03, 0.4, 0, 0, it.cloth);
        it.on = false;
      } else if (k === 'cage') {
        it.cg = makeCage(LEVELS[this.lv].boss); g.add(it.cg.root); it.locked = !!LEVELS[this.lv].boss; this.cage = it;
      } else if (k === 'vent') {
        for (let i = 0; i < 5; i++) mk(G3.ico0, mat('#6f7a86', 0.9, { flat: true }), 0.22, 0.16, 0.22, Math.cos(i * 1.3) * 0.32, 0.08, Math.sin(i * 1.3) * 0.3, g);
        it.t = Math.random();
      }
      this.items.push(it);
    }

    // ---------- είσοδος ----------
    input(part, msg) {
      if (!part) return;
      if (msg.type === 'move') { part.mv = U.clamp(Math.round(+msg.d || 0), -1, 1); part.mvV = U.clamp(Math.round(+msg.v || 0), -1, 1); return; }
      if (this.phase !== 'go' && this.phase !== 'clear') return;
      if (part.dead > 0) return;
      if (msg.type === 'jump') part.jumpBuf = 0.16;
      else if (msg.type === 'dash') this.shoot(part);
    }

    active(p) { return p.bot || (p.p && p.p.connected); }

    ctrl(part) {
      const base = {
        mode: 'plat', scoreText: `❤ ${this.lives} · ${part.score} πόντοι`,
        shoot: part.pow === 'tri' ? 'ΑΓΚΑΘΙΑ ×3' : 'ΑΓΚΑΘΙ', shootOff: false,
        jump: part.balloon > 0 ? 'ΑΦΗΣΕ 🎈' : part.swim ? 'ΚΟΛΥΜΠΑ' : 'ΠΗΔΑ', extra: '',
      };
      const tip = part.balloon > 0 ? 'Μοχλός πάνω/κάτω: ανεβαίνεις/κατεβαίνεις' : part.swim ? 'Μοχλός πάνω/κάτω για βουτιά · πρόσεχε το οξυγόνο!' : 'Μοχλός πάνω + ΑΓΚΑΘΙ = ρίχνεις ψηλά';
      if (this.phase === 'go' && part.dead > 0) return { ...base, active: false, label: '💫 Ωχ!', sub: 'Ξαναβγαίνεις σε λίγο' };
      if (this.phase === 'go' || this.phase === 'clear') return { ...base, active: true, label: '', sub: tip };
      if (this.phase === 'load') return { ...base, active: false, label: 'Φόρτωση…', sub: 'Ετοιμάζεται ο 3D κόσμος' };
      return { ...base, active: false, label: this.phase === 'count' ? `Κόσμος ${this.lv + 1}: ${LEVELS[this.lv].name}` : this.phase === 'lost' ? '💔 Τέλος' : 'Μπράβο!', sub: '◀ ▶ κίνηση · ΠΗΔΑ · ΑΓΚΑΘΙ · βρείτε το κλουβί!' };
    }

    // ---------- φυσική ----------
    moveBody(b, dt) {
      b.hitWall = 0; b.bump = false;
      let nx = b.x + b.vx * dt;
      const y0 = Math.floor(b.y + 0.04), y1 = Math.floor(b.y + b.hh - 0.04);
      if (b.vx > 0) { const tx = Math.floor(nx + b.hw); for (let ty = y0; ty <= y1; ty++) if (solidC(this.tile(tx, ty))) { nx = tx - b.hw - 0.001; b.vx = 0; b.hitWall = 1; break; } }
      else if (b.vx < 0) { const tx = Math.floor(nx - b.hw); for (let ty = y0; ty <= y1; ty++) if (solidC(this.tile(tx, ty))) { nx = tx + 1 + b.hw + 0.001; b.vx = 0; b.hitWall = -1; break; } }
      b.x = nx;
      let ny = b.y + b.vy * dt; const was = b.onG; b.onG = false;
      const x0 = Math.floor(b.x - b.hw + 0.03), x1 = Math.floor(b.x + b.hw - 0.03);
      if (b.vy <= 0) {
        const ty = Math.floor(ny);
        for (let tx = x0; tx <= x1; tx++) {
          const c = this.tile(tx, ty);
          if (solidC(c) || (c === '=' && b.y >= ty + 1 - 0.06 && !(b.drop > 0))) { ny = ty + 1; if (!was && b.vy < -8) b.land = 1; b.vy = 0; b.onG = true; break; }
        }
      } else {
        const ty = Math.floor(ny + b.hh);
        for (let tx = x0; tx <= x1; tx++) if (solidC(this.tile(tx, ty))) { ny = ty - b.hh - 0.001; b.vy = 0; b.bump = true; break; }
      }
      b.y = ny;
    }
    waterAt(x, y) { return this.tile(Math.floor(x), Math.floor(y)) === '~'; }

    updPlayer(p, dt) {
      if (!this.active(p)) { p.gone = true; return; }
      if (p.gone) { p.gone = false; this.warpToGroup(p); }
      if (p.dead > 0) {
        p.dead -= dt; p.vy -= GRAV * 0.5 * dt; p.y += p.vy * dt;
        if (p.dead <= 0) this.respawn(p);
        return;
      }
      p.inv = Math.max(0, p.inv - dt); p.shootCd -= dt; p.jumpBuf -= dt; p.drop = (p.drop || 0) - dt; p.land = Math.max(0, p.land - dt * 4);
      if (p.pow) { p.powT -= dt; if (p.powT <= 0) { p.pow = null; this.changed(); } }
      p.hw = HW; p.hh = HH;
      const inW = this.waterAt(p.x, p.y + 0.4), headW = this.waterAt(p.x, p.y + 0.75);
      if (inW !== p.swim) { p.swim = inW; if (inW) { SND.play('splash'); this.burst(p.x, p.y + 0.6, '#bfe9ff', 14, 4); if (p.balloon > 0) this.popBalloon(p); } }
      if (p.mv) p.face = p.mv;
      if (p.mvV > 0 && p.onG) p.drop = 0.25;
      if (p.balloon > 0) {
        p.balloon -= dt;
        const tv = -p.mvV * 4.2 + 0.7;
        p.vx += U.clamp(p.mv * RUN * 0.8 - p.vx, -ACC * 0.5 * dt, ACC * 0.5 * dt);
        p.vy += U.clamp(tv - p.vy, -12 * dt, 12 * dt);
        if (p.jumpBuf > 0) { p.jumpBuf = 0; p.balloon = 0; p.vy = 6; this.changed(); SND.play('grab'); }
        if (p.balloon <= 0 && p.bal.g.visible) this.popBalloon(p);
      } else if (inW) {
        p.vx += U.clamp(p.mv * 4.2 - p.vx, -20 * dt, 20 * dt);
        const tv = p.mvV ? -p.mvV * 4 : 1.1;
        p.vy += U.clamp(tv - p.vy, -14 * dt, 14 * dt);
        if (p.jumpBuf > 0) {
          p.jumpBuf = 0;
          if (!headW || !this.waterAt(p.x, p.y + 1.4)) { p.vy = JUMP; SND.play('jump'); this.burst(p.x, p.y + 0.8, '#d8f4ff', 10, 4); }
          else { p.vy = 5.2; SND.play('bubble'); }
        }
      } else {
        const sp = RUN * (p.pow === 'speed' ? 1.4 : 1);
        const a = (p.onG ? ACC : AIRACC) * dt;
        p.vx += U.clamp(p.mv * sp - p.vx, -a, a);
        p.vy = Math.max(-MAXFALL, p.vy - GRAV * dt);
        if (p.onG) p.coy = 0.1; else p.coy -= dt;
        if (p.jumpBuf > 0 && p.coy > 0) { p.vy = JUMP; p.jumpBuf = 0; p.coy = 0; p.onG = false; SND.play('jump'); }
      }
      const wasG = p.onG, vy0 = p.vy;
      this.moveBody(p, dt);
      if (p.onG && !wasG && vy0 < -9) { this.dust(p.x, p.y); p.land = 1; }
      if (p.balloon > 0 && p.bump && this.tile(Math.floor(p.x), Math.floor(p.y + p.hh + 0.1)) === '^') this.popBalloon(p);
      // οξυγόνο
      if (headW) { p.o2 -= dt / O2T; if (p.o2 <= 0) { p.o2 = 1; this.hurt(p, true); return; } if (Math.random() < dt * 2) this.bubble(p.x + p.face * 0.4, p.y + 0.6); }
      else p.o2 = Math.min(1, p.o2 + dt * 0.7);
      // αγκάθια στο έδαφος
      for (const [ox, oy] of [[0, 0.15], [-HW * 0.8, 0.15], [HW * 0.8, 0.15], [0, 0.6]]) if (this.tile(Math.floor(p.x + ox), Math.floor(p.y + oy)) === '^') { this.hurt(p); break; }
      if (p.y < -4) { this.hurt(p, true); return; }
      // αντικείμενα
      for (const it of this.items) this.touchItem(p, it);
      // εχθροί
      for (const f of this.foes) {
        if (f.dead) continue;
        const fx0 = f.x - f.hw, fx1 = f.x + f.hw, fy0 = f.y - (f.k === 'beetle' ? 0 : f.hh * 0.5), fy1 = fy0 + f.hh;
        if (p.x + HW * 0.8 < fx0 || p.x - HW * 0.8 > fx1 || p.y + HH * 0.85 < fy0 || p.y > fy1) continue;
        if (f.k !== 'fish' && p.vy < -1 && p.y > fy0 + f.hh * 0.45) { this.killFoe(f, p, true); p.vy = 11; SND.play('stomp'); continue; }
        this.hurt(p);
      }
      for (const c of this.cones) if (!c.dead && Math.abs(c.x - p.x) < 0.55 && c.y > p.y - 0.2 && c.y < p.y + HH + 0.2) { c.dead = 1; this.boomCone(c); this.hurt(p); }
      if (this.boss && !this.boss.dead) { const b = this.boss; if (Math.abs(p.x - b.x) < 1.1 && p.y + HH > b.y - 0.6 && p.y < b.y + 1.4) this.hurt(p); }
    }

    touchItem(p, it) {
      const dx = p.x - it.x, dy = p.y + 0.4 - (it.y + (it.k === 'fruit' ? 0 : 0.4));
      if (it.k === 'fruit') {
        if (it.got || dx * dx + dy * dy > 0.55) return;
        it.got = 1; this.fruitInst[it.f].hide(it.i);
        const v = FRUIT[it.f]; this.gain(p, v, it.x, it.y + 0.4); p.fruits++;
        SND.play('fruit'); this.burst(it.x, it.y, it.f === 'grape' ? '#c38bff' : it.f === 'orange' ? '#ffb347' : '#ff6a6a', 8, 3);
      } else if (it.k === 'crate') {
        if (it.got || Math.abs(dx) > 0.75 || Math.abs(dy) > 0.8) return;
        this.openCrate(it, p);
      } else if (it.k === 'mush') {
        if (p.vy < 0 && Math.abs(dx) < 0.62 && p.y > it.y + 0.3 && p.y < it.y + 0.75) { p.vy = MUSH; p.y = it.y + 0.76; it.sq = 1; SND.play('boing'); this.burst(it.x, it.y + 0.7, '#ffffff', 8, 3); }
      } else if (it.k === 'pod') {
        if (it.ready < 1 || p.balloon > 0 || p.swim || Math.abs(dx) > 0.7 || dy < -0.6 || dy > 2.2) return;
        it.ready = 0; p.balloon = BAL_T; p.bal.g.visible = true; p.vy = Math.max(p.vy, 2); SND.play('grab'); this.changed();
        this.fx(p, '🎈 Μπαλόνια!', 30);
      } else if (it.k === 'flag') {
        if (it.on || Math.abs(dx) > 0.8 || Math.abs(dy) > 1.6) return;
        it.on = true; it.clothM.material.color.set(p.color.hex); this.check = { x: it.x, y: it.y };
        SND.play('flag'); this.banner('Σημαία! ✔ Από εδώ ξαναβγαίνετε', '#9dff8a'); this.burst(it.x, it.y + 2, '#ffe066', 16, 5);
      } else if (it.k === 'cage') {
        if (it.open || it.locked || Math.abs(dx) > 1.3 || Math.abs(dy) > 1.6) return;
        this.openCage(it, p);
      }
    }

    openCrate(it, p) {
      it.got = 1; it.g.visible = false; SND.play('crate');
      this.burst(it.x, it.y + 0.4, '#c98b4e', 16, 5, 0.12);
      const k = U.pick(this.lives < 3 ? ['heart', 'heart', 'tri', 'shield'] : ['tri', 'tri', 'shield', 'speed', 'heart']);
      if (k === 'heart') { this.lives++; this.gain(p, 50, it.x, it.y + 1, '❤ +1'); }
      else if (k === 'shield') { p.shield = 1; this.gain(p, 50, it.x, it.y + 1); }
      else { p.pow = k; p.powT = 15; this.gain(p, 50, it.x, it.y + 1); }
      SND.play('power'); this.fx(p, POW[k], 40); this.banner(`${p.name}: ${POW[k]}`, p.color.hex);
      this.changed();
    }

    openCage(it, p) {
      it.open = true; it.openT = 0; SND.play('flag'); this.sfx('win');
      this.parts.forEach((q) => this.gain(q, q === p ? 1000 : 500, q === p ? it.x : q.x, (q === p ? it.y : q.y) + 2, q === p ? '+1000 🦔' : '+500'));
      this.celebrate('#ffe066');
      this.phase = 'clear'; this.changed();
      const last = this.lv >= LEVELS.length - 1;
      this.banner(last ? 'Σώσατε όλα τα σκαντζοχοιράκια! 🎉' : `Ελευθερία! Σώσατε τα μικρά του κόσμου ${this.lv + 1} 🦔`, '#ffe066');
      this.after(4.6, () => {
        if (!this.running) return;
        if (last) this.finish(true);
        else { this.lives++; this.startLevel(this.lv + 1); }
      });
    }

    gain(p, v, x, y, txt) {
      p.score += v; this.team += v;
      this.pops.push({ x, y, t: 0, txt: txt || `+${v}`, c: p.color.hex });
    }

    shoot(p) {
      if (p.shootCd > 0 || p.dead > 0) return;
      if (this.spines.filter((s) => s.p === p).length >= (p.pow === 'tri' ? 6 : 3)) return;
      p.shootCd = 0.22;
      let dx = p.face, dy = 0;
      if (p.mvV < 0) { dx = p.mv * 0.7; dy = 1; }
      const l = Math.hypot(dx, dy); dx /= l; dy /= l;
      const angs = p.pow === 'tri' ? [-0.28, 0, 0.28] : [0];
      for (const a of angs) {
        const c = Math.cos(a), s = Math.sin(a), vx = (dx * c - dy * s) * 17, vy = (dx * s + dy * c) * 17;
        const m = mk(G3.cone6, mat(mixHex(p.color.hex, '#ffffff', 0.25), 0.4, { em: p.color.hex, ei: 0.35 }), 0.07, 0.45, 0.07, p.x, p.y + 0.45, 0, this.lvl);
        this.spines.push({ p, x: p.x + dx * 0.3, y: p.y + 0.45 + dy * 0.3, vx, vy, life: 0.55, m });
      }
      SND.play('shoot');
    }

    hurt(p, force) {
      if (p.dead > 0 || this.phase === 'clear' || this.phase === 'end') return;
      if (!force && p.inv > 0) return;
      if (!force && p.shield) { p.shield = 0; p.inv = 1.5; SND.play('pop'); this.burst(p.x, p.y + 0.5, '#9ff0ff', 16, 5); this.changed(); return; }
      if (!force && p.balloon > 0) { this.popBalloon(p); p.inv = 1.2; return; }
      p.dead = 1.5; p.vy = 9; p.balloon = 0; p.bal.g.visible = false; p.pow = null; p.shield = 0;
      SND.play('hurt'); this.burst(p.x, p.y + 0.5, p.color.hex, 18, 6);
      this.fx(p, '💫 Ωχ!', [80, 60, 80], true);
      if (!p.bot) {
        p.deaths++; this.lives--;
        if (this.lives <= 0) { this.lives = 0; this.gameOver(); }
      }
      this.changed();
    }
    popBalloon(p) {
      p.balloon = 0; p.bal.g.visible = false; SND.play('pop');
      this.burst(p.x, p.y + 1.8, '#ff6a7a', 14, 5); this.changed();
    }
    anchorFor(p) {
      const alive = this.parts.filter((q) => q !== p && this.active(q) && q.dead <= 0 && !q.gone && q.y > 0);
      const good = alive.filter((q) => q.onG && !q.swim);
      const pool = good.length ? good : alive;
      if (!pool.length) return null;
      return pool.reduce((a, b) => (Math.abs(b.x - this.camX) < Math.abs(a.x - this.camX) ? b : a));
    }
    respawn(p) {
      if (this.phase === 'lost' || this.phase === 'end') return;
      const a = this.anchorFor(p);
      const at = a ? { x: a.x, y: a.y + 0.5 } : this.check ? { x: this.check.x + 0.6, y: this.check.y + 0.5 } : { x: this.start.x, y: this.start.y + 0.5 };
      Object.assign(p, { x: at.x, y: at.y, vx: 0, vy: 0, dead: 0, inv: INV, o2: 1, offT: 0 });
      this.burst(p.x, p.y + 0.5, '#ffffff', 14, 4); SND.play('warp');
      this.changed();
    }
    warpToGroup(p) {
      const a = this.anchorFor(p);
      if (!a) return;
      Object.assign(p, { x: a.x - a.face * 0.6, y: a.y + 0.3, vx: 0, vy: 0, offT: 0, inv: 1.2, balloon: 0 });
      p.bal.g.visible = false;
      this.burst(p.x, p.y + 0.5, '#ffffff', 12, 4); SND.play('warp');
    }
    gameOver() {
      this.phase = 'lost'; this.musicOn = false;
      this.banner('Τελείωσαν οι ζωές! 💔', '#ff7a7a');
      this.changed();
      this.after(3.2, () => this.running && this.finish(false));
    }

    killFoe(f, p, stomp) {
      f.dead = 1; f.vy = 7; f.spin = 0;
      if (p) { this.gain(p, stomp ? 150 : 100, f.x, f.y + 0.6); p.foes++; }
      SND.play('kill'); this.burst(f.x, f.y + 0.3, '#fff3a0', 14, 5);
    }

    // ---------- bot ----------
    bot(p, dt) {
      p.botT -= dt; if (p.botT > 0) return; p.botT = 0.1;
      if (p.dead > 0) return;
      const hum = this.parts.filter((q) => !q.bot && this.active(q) && q.dead <= 0);
      let tx, ty;
      if (this.boss && !this.boss.dead && Math.abs(p.x - this.boss.x) < 16) { tx = this.boss.x + (p.x < this.boss.x ? -4 : 4); ty = 5; }
      else if (hum.length) { const h = hum.reduce((a, b) => (Math.abs(b.x - p.x) < Math.abs(a.x - p.x) ? b : a)); tx = h.x - h.face * 1.4; ty = h.y; }
      else if (this.cage) { tx = this.cage.x; ty = this.cage.y; }
      else return;
      const dx = tx - p.x, dy = ty - p.y;
      p.mv = Math.abs(dx) > 1.2 ? Math.sign(dx) : 0;
      p.mvV = dy > 1.2 ? -1 : dy < -1.2 ? 1 : 0;
      const d = p.mv || p.face;
      if (p.onG && !p.swim && !p.balloon) {
        const fy = Math.floor(p.y + 0.05);
        const danger = (X) => { for (let k = 0; k <= 4; k++) { const c = this.tile(X, fy - k); if (c === '^') return true; if (c !== ' ') return false; } return true; };
        const f1 = Math.floor(p.x + d * 0.75), f2 = Math.floor(p.x + d * 1.5);
        const wall = solidC(this.tile(f1, fy)) || solidC(this.tile(f1, fy + 1));
        const gap = danger(f1) || (danger(f2) && Math.abs(p.vx) > 4);
        const thorn = false;
        if ((p.mv && (wall || gap || thorn)) || (dy > 1.5 && Math.abs(dx) < 3.5 && !danger(f1))) p.jumpBuf = 0.16;
      }
      if (p.swim && (dy > 0.5 || p.o2 < 0.4)) p.jumpBuf = Math.random() < 0.5 ? 0.16 : 0;
      // βολές
      const foe = this.foes.find((f) => !f.dead && Math.abs(f.y - p.y - 0.3) < 1 && (f.x - p.x) * p.face > 0 && Math.abs(f.x - p.x) < 7);
      if (foe) this.shoot(p);
      if (this.boss && !this.boss.dead && Math.abs(this.boss.x - p.x) < 5 && Math.random() < 0.5) { const sv = p.mvV; p.mvV = -1; this.shoot(p); p.mvV = sv; }
      // κόλλησε;
      const far = hum.length && Math.min(...hum.map((h) => Math.abs(h.x - p.x) + Math.abs(h.y - p.y))) > 12;
      if (Math.abs(p.vx) < 0.3 && p.mv) p.stuck += 0.1; else p.stuck = Math.max(0, p.stuck - 0.05);
      if (p.stuck > 2.5 || far) { p.stuck = 0; this.warpToGroup(p); }
    }

    // ---------- εφέ ----------
    burst(x, y, col, n, sp, size = 0.08, z = 0) {
      for (let i = 0; i < n && this.parts3.length < 480; i++) {
        const a = Math.random() * TAU, b = Math.random() * Math.PI - Math.PI / 2, s = sp * (0.4 + Math.random() * 0.8);
        this.parts3.push({ x, y, z: z + (Math.random() - 0.5) * 0.4, vx: Math.cos(a) * Math.cos(b) * s, vy: Math.sin(b) * s + sp * 0.4, vz: Math.sin(a) * Math.cos(b) * s, life: 0.6 + Math.random() * 0.5, max: 1.1, s: size * (0.6 + Math.random() * 0.9), c: col, g: 9, r: Math.random() * 6 });
      }
    }
    dust(x, y) { for (let i = 0; i < 8; i++) this.parts3.push({ x: x + (Math.random() - 0.5) * 0.5, y: y + 0.05, z: (Math.random() - 0.5) * 0.6, vx: (Math.random() - 0.5) * 3, vy: Math.random() * 1.2, vz: (Math.random() - 0.5) * 2, life: 0.45, max: 0.45, s: 0.09, c: this.lv === 2 ? '#ffffff' : '#e8d2a8', g: 1, r: 0 }); }
    bubble(x, y) { this.parts3.push({ x, y, z: 0.3, vx: (Math.random() - 0.5) * 0.4, vy: 1.6, vz: 0, life: 1.4, max: 1.4, s: 0.06 + Math.random() * 0.05, c: '#e6f8ff', g: -0.5, r: 0, water: 1 }); }

    boomCone(c) { SND.play('boom'); this.burst(c.x, c.y, '#8a5a33', 14, 5, 0.1); this.burst(c.x, c.y, '#ffb347', 8, 4); this.scene && c.m && this.lvl.remove(c.m); }

    // ---------- ενημέρωση ----------
    update(dt) {
      this.fdt = dt;
      if (this.phase === 'load' || !this.map) return;
      const go = this.phase === 'go' || this.phase === 'clear';
      if (go) {
        for (const p of this.parts) { if (p.bot) this.bot(p, dt); this.updPlayer(p, dt); }
        this.updFoes(dt); this.updSpines(dt); this.updBoss(dt);
      }
      this.updItems(dt);
      this.updCamera(dt, go);
      // διάσπαρτοι παίκτες: όποιος μείνει έξω από την οθόνη μεταφέρεται στην ομάδα
      if (this.phase === 'go') for (const p of this.parts) {
        if (p.dead > 0 || p.gone) continue;
        const out = Math.abs(p.x - this.camX) > this.halfW + 0.6 || p.y - this.camY > this.halfH + 2 || this.camY - p.y > this.halfH + 0.5;
        p.offT = out ? p.offT + dt : 0;
        if (p.offT > 2.2) { this.warpToGroup(p); this.fx(p, 'Σε φέραμε κοντά στην ομάδα!'); }
      }
      // αλλαγή κατάστασης χειριστηρίου
      for (const p of this.parts) {
        const k = `${p.balloon > 0}|${p.swim}|${p.pow}|${p.dead > 0}`;
        p.ckT -= dt;
        if (k !== p.ckey && p.ckT <= 0) { p.ckey = k; p.ckT = 0.35; this.changed(); }
      }
      for (const q of this.pops) q.t += dt;
      this.pops = this.pops.filter((q) => q.t < 1.2);
      this.tickMusic();
      this.perf(dt);
    }

    updFoes(dt) {
      const t = this.time;
      for (const f of this.foes) {
        if (f.dead) {
          f.dead += dt; f.vy -= GRAV * 0.6 * dt; f.y += f.vy * dt; f.spin = (f.spin || 0) + dt * 10;
          if (f.dead > 2 && f.mesh.root.parent) this.lvl.remove(f.mesh.root);
          continue;
        }
        if (f.k === 'beetle') {
          f.vy = Math.max(-MAXFALL, f.vy - GRAV * dt);
          this.moveBody(f, dt);
          const ahead = Math.floor(f.x + Math.sign(f.vx) * (f.hw + 0.1)), below = this.tile(ahead, Math.floor(f.y - 0.5));
          if (f.hitWall || (f.onG && !solidC(below) && below !== '=')) { f.vx = (f.hitWall ? -f.hitWall : -Math.sign(f.vx)) * 1.6; }
          if (!f.vx) f.vx = 1.6;
          f.face = Math.sign(f.vx);
          if (f.y < -4) f.dead = 3;
        } else {
          const sp = f.k === 'crow' ? 0.75 : f.k === 'fish' ? 0.6 : 0.9;
          const nx = f.x0 + Math.sin(t * sp + f.ph) * f.r;
          f.face = nx > f.x ? 1 : -1; f.x = nx;
          f.y = f.y0 + Math.sin(t * (f.k === 'bee' ? 2.6 : 1.6) + f.ph) * (f.k === 'fish' ? 0.5 : 0.45);
        }
      }
    }

    updSpines(dt) {
      for (const s of this.spines) {
        s.life -= dt; s.x += s.vx * dt; s.y += s.vy * dt;
        const c = this.tile(Math.floor(s.x), Math.floor(s.y));
        if (solidC(c)) { s.life = 0; this.burst(s.x, s.y, '#fff1c4', 5, 2, 0.05); }
        for (const f of this.foes) if (!f.dead && s.life > 0) {
          const fy = f.k === 'beetle' ? f.y + 0.3 : f.y;
          if (Math.abs(s.x - f.x) < f.hw + 0.15 && Math.abs(s.y - fy) < 0.5) { s.life = 0; this.killFoe(f, s.p); }
        }
        for (const it of this.items) if (it.k === 'crate' && !it.got && s.life > 0 && Math.abs(s.x - it.x) < 0.55 && Math.abs(s.y - it.y - 0.43) < 0.55) { s.life = 0; this.openCrate(it, s.p); }
        for (const cn of this.cones) if (!cn.dead && s.life > 0 && Math.abs(s.x - cn.x) < 0.45 && Math.abs(s.y - cn.y) < 0.45) { s.life = 0; cn.dead = 1; this.boomCone(cn); this.gain(s.p, 20, cn.x, cn.y); }
        const b = this.boss;
        if (b && !b.dead && s.life > 0 && Math.abs(s.x - b.x) < 1.3 && s.y > b.y - 0.9 && s.y < b.y + 5.5) {
          s.life = 0; b.hp--; b.flash = 0.18; SND.play('bhit'); this.burst(s.x, s.y, '#ffe066', 6, 3); this.gain(s.p, 20, s.x, s.y);
          if (b.hp <= 0) this.bossDown(s.p);
        }
        s.m.position.set(s.x, s.y, 0); s.m.rotation.z = Math.atan2(s.vy, s.vx) - Math.PI / 2;
        if (s.life <= 0) this.lvl.remove(s.m);
      }
      this.spines = this.spines.filter((s) => s.life > 0);
    }

    updBoss(dt) {
      const b = this.boss; if (!b) return;
      b.t += dt; b.flash = Math.max(0, b.flash - dt);
      if (b.dead) {
        b.dead += dt; b.vy -= 12 * dt; b.y += b.vy * dt; b.x += dt * 2;
        b.mesh.root.rotation.z -= dt * 1.4;
        if (b.dead > 4 && b.mesh.root.parent) this.lvl.remove(b.mesh.root);
      } else {
        const near = this.parts.some((p) => !p.gone && p.dead <= 0 && p.x > 80);
        if (!near) { b.x += (b.x0 - b.x) * dt; } else {
          if (!b.seen) { b.seen = true; SND.play('boss'); this.banner('Η Κυρα-Αλεπού! Ρίξε αγκάθια ψηλά! ⬆', '#ff9a3a'); this.say = { t0: this.time, txt: 'Χα χα! Δεν θα πάρετε τα μικρά!' }; }
          const rage = b.hp < b.max / 2 ? 1.45 : 1;
          b.x = b.x0 + Math.sin(b.t * 0.42 * rage) * 10.5;
          b.y = b.y0 - 1.2 + Math.sin(b.t * 1.1) * 1.3 - (Math.sin(b.t * 0.23) > 0.7 ? 3 : 0);
          b.dropT -= dt;
          if (b.dropT <= 0) {
            b.n++; b.dropT = (1.5 + Math.random() * 0.8) / rage;
            const tgt = this.parts.filter((p) => p.dead <= 0 && !p.gone).sort((p, q) => Math.abs(p.x - b.x) - Math.abs(q.x - b.x))[0];
            const aim = b.n % 3 === 0 && tgt ? U.clamp((tgt.x - b.x) / 1.1, -5, 5) : (Math.random() - 0.5) * 3;
            const m = mk(G3.ico0, mat('#8a5a33', 0.8, { flat: true }), 0.22, 0.3, 0.22, b.x, b.y - 0.4, 0, this.lvl);
            this.cones.push({ x: b.x, y: b.y - 0.4, vx: aim, vy: 1, m, dead: 0 });
            if (rage > 1 && b.n % 4 === 0) this.cones.push({ x: b.x, y: b.y - 0.4, vx: -aim * 0.7 + 1.5, vy: 2, m: mk(G3.ico0, mat('#8a5a33', 0.8, { flat: true }), 0.22, 0.3, 0.22, b.x, b.y, 0, this.lvl), dead: 0 });
          }
          if (rage > 1) { b.beeT -= dt; if (b.beeT <= 0 && this.foes.filter((f) => !f.dead).length < 3) { b.beeT = 9; this.addFoe('bee', b.x, b.y - 1, { r: 3 }); } }
        }
      }
      for (const c of this.cones) {
        if (c.dead) continue;
        c.vy -= 16 * dt; c.x += c.vx * dt; c.y += c.vy * dt;
        c.m.position.set(c.x, c.y, 0); c.m.rotation.z += dt * 5;
        if (solidC(this.tile(Math.floor(c.x), Math.floor(c.y - 0.2))) || c.y < -3) { c.dead = 1; this.boomCone(c); }
      }
      this.cones = this.cones.filter((c) => !c.dead);
    }
    bossDown(p) {
      const b = this.boss; b.dead = 0.001; b.vy = 4;
      SND.play('boom'); this.sfx('win');
      this.gain(p, 2000, b.x, b.y + 2, '+2000 🦊');
      this.burst(b.x, b.y + 3, '#ff4a5a', 30, 9, 0.12); this.burst(b.x, b.y + 3, '#ffd23a', 30, 9, 0.12);
      this.banner('Η Κυρα-Αλεπού έφυγε! Ανοίξτε το κλουβί! 🔓', '#ffe066');
      this.say = { t0: this.time, txt: 'Ωχ! Θα ξαναγυρίσω…' };
      this.cones.forEach((c) => { c.dead = 1; this.boomCone(c); }); this.cones = [];
      if (this.cage) { this.cage.locked = false; this.cage.unlockT = 0; }
      this.changed();
    }

    updItems(dt) {
      for (const it of this.items) {
        it.t += dt;
        if (it.k === 'pod' && it.ready < 1) { it.ready = Math.min(1, it.ready + dt / 5); }
        if (it.k === 'vent' && (this.phase === 'go' || this.phase === 'count')) {
          it.e = (it.e || 0) - dt;
          if (it.e <= 0) { it.e = 1.7; this.bubbles.push({ x: it.x + (Math.random() - 0.5) * 0.3, y: it.y + 0.4, t: 0, m: mk(G3.sph, mat('#dff6ff', 0.05, { op: 0.45, em: '#9fe6ff', ei: 0.4 }), 0.3, 0.3, 0.3, it.x, it.y, 0.1, this.lvl, false) }); }
        }
      }
      for (const b of this.bubbles) {
        b.t += 1; b.y += dt * 1.4; b.x += Math.sin(this.time * 3 + b.y) * dt * 0.3;
        b.m.position.set(b.x, b.y, 0.1); const s = 0.3 + Math.sin(this.time * 6 + b.y) * 0.02; b.m.scale.set(s, s * 0.92, s);
        if (!this.waterAt(b.x, b.y + 0.3)) b.dead = 1;
        for (const p of this.parts) if (!b.dead && p.dead <= 0 && Math.abs(p.x - b.x) < 0.7 && Math.abs(p.y + 0.4 - b.y) < 0.7) { b.dead = 1; p.o2 = 1; SND.play('bubble'); this.fx(p, '🫧 Οξυγόνο!'); }
        if (b.dead) { this.lvl.remove(b.m); this.burst(b.x, b.y, '#e6f8ff', 5, 2, 0.05); }
      }
      this.bubbles = this.bubbles.filter((b) => !b.dead);
    }

    updCamera(dt, go) {
      const vis = this.parts.filter((p) => !p.gone && (p.dead <= 0 || this.parts.every((q) => q.dead > 0 || q.gone)));
      let tx = this.camX, ty = this.camY, need = 20;
      const tanH = Math.tan((this.cam.fov * Math.PI) / 360), asp = this.W / this.H;
      if (vis.length) {
        const xs = vis.map((p) => p.x), ys = vis.map((p) => p.y);
        const bs = this.boss;
        if (bs && bs.seen && !bs.dead) { xs.push(U.clamp(bs.x, Math.min(...xs) - 9, Math.max(...xs) + 9)); ys.push(bs.y + 1.5); }
        const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
        tx = (x0 + x1) / 2 + (vis.length === 1 ? vis[0].face * 1.5 : 0); ty = (y0 + y1) / 2 + 1.0;
        need = Math.max(20, ((x1 - x0) / 2 + 5) / (tanH * asp), ((y1 - y0) / 2 + 4.2) / tanH);
      }
      if (this.boss && !this.boss.dead && vis.some((p) => p.x > 80)) need = Math.max(need, 25);
      if (this.phase === 'clear' && this.cage) { tx = this.cage.x; ty = this.cage.y + 2; need = 17; }
      const k = Math.min(1, dt * (go ? 3 : 6));
      this.camD += (U.clamp(need, 17, 29) - this.camD) * Math.min(1, dt * 1.5);
      this.halfH = this.camD * tanH; this.halfW = this.halfH * asp;
      const W = this.map.w;
      tx = U.clamp(tx, this.halfW - 0.2, W - this.halfW + 0.2); ty = Math.max(ty, this.halfH - 2.2);
      this.camX += (tx - this.camX) * k; this.camY += (ty - this.camY) * k;
      if (!go && this.phase === 'count') { this.camX += (tx - this.camX) * 0.1; }
    }

    perf(dt) {
      this.fa = (this.fa || dt) * 0.95 + dt * 0.05;
      this.fq = (this.fq || 0) + dt;
      if (this.fq > 3 && this.fa > 0.028 && this.q > 0.55 && this.R) {
        this.fq = 0; this.q -= 0.15;
        this.R.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.25) * this.q); this.resize();
        if (this.q < 0.75) this.R.shadowMap.enabled = false;
      }
    }

    tickMusic() {
      const a = SND.ac; if (!a || !this.musicOn || !this.song) return;
      const S = this.song, step = 60 / S.bpm / 4;
      if (this.mNext < a.currentTime - 0.3) this.mNext = a.currentTime + 0.05;
      const out = SND.music;
      while (this.mNext < a.currentTime + 0.15) {
        const s = this.mStep, t = this.mNext, s16 = s % 16, bar = Math.floor(s / 16) % 4;
        const root = S.roots[bar], mi = S.minor[bar];
        if (s16 === 0 || s16 === 8 || (this.lv === 2 && s16 === 10)) SND.tone(t, 140, 0.14, 'sine', 0.5, 45, out);
        if (s16 === 4 || s16 === 12) SND.hit(t, 0.12, 0.25, 1800, 0.7, 'bandpass', out);
        if (s16 % 2 === 0) SND.hit(t, 0.03, 0.08, 8000, 0.7, 'highpass', out);
        if (s16 % 4 === 0 || s16 % 4 === 3) SND.tone(t, N(root - 12 + (s16 % 8 === 4 ? 7 : 0)), step * 1.6, 'triangle', 0.3, null, out);
        if (s16 === 2 || s16 === 10) [0, mi ? 3 : 4, 7].forEach((iv) => SND.tone(t, N(root + 12 + iv), step * 2.2, 'square', 0.022, null, out));
        if (s % 2 === 0) { const n = S.mel[(s / 2) % 32]; if (n) { SND.tone(t, N(n), step * 1.7, 'square', 0.045, null, out); SND.tone(t, N(n + 12), step * 1.2, 'triangle', 0.03, null, out); } }
        this.mNext += step; this.mStep = (s + 1) % 64;
      }
    }

    // ---------- σχεδίαση ----------
    draw() {
      const x = this.ctx;
      x.save(); x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, this.c.width, this.c.height); x.restore();
      if (this.phase === 'load' || !this.map) {
        x.fillStyle = '#1a2f5a'; x.fillRect(0, 0, this.W, this.H);
        this.text(this.loadErr || 'Φόρτωση 3D κόσμου…', this.W / 2, this.H / 2, this.vh * (this.loadErr ? 3 : 5), '#ffe066', { fam: 'Comfortaa', w: 700 });
        return;
      }
      this.render3D();
      this.drawHud();
    }

    render3D() {
      const t = this.time, cam = this.cam;
      cam.position.set(this.camX, this.camY + 2.6, this.camD);
      cam.lookAt(this.camX, this.camY + 0.3, 0);
      this.sky.position.copy(cam.position);
      this.sun.position.set(this.camX - 12, this.camY + 24, 20); this.sun.target.position.set(this.camX, this.camY - 3, 0);
      if (this.waveTex) { this.waveTex.offset.x = t * 0.05; this.waveTex.offset.y = Math.sin(t * 0.7) * 0.05; }
      // σύννεφα
      this.cloudPos.forEach((c, i) => { c.x += c.v * this.fdt; if (c.x > this.map.w + 40) c.x = -40; this.clouds.set(i, c.x, c.y, c.z, 0, c.s, 0, 0, c.s * 0.7); });
      if (this.weeds) this.weedPos.forEach((w, i) => this.weeds.set(i, w.x, w.y, w.z, 0, w.s * 0.9, 0, Math.sin(t * 1.6 + w.ph) * 0.25, w.s));
      // φρούτα
      for (const it of this.items) {
        if (it.k === 'fruit') { if (!it.got) this.fruitInst[it.f].set(it.i, it.x, it.y + Math.sin(t * 2.5 + it.ph) * 0.08, 0, t * 1.6 + it.ph, 1); continue; }
        if (it.k === 'crate' && !it.got) it.box.rotation.y = Math.sin(t * 1.5 + it.t) * 0.08;
        if (it.k === 'mush') { it.sq = Math.max(0, (it.sq || 0) - 0.05); const s = 1 + Math.sin((it.sq || 0) * 12) * (it.sq || 0) * 0.3; it.cap.scale.set(s, 2 - s, s); }
        if (it.k === 'pod') { const s = it.ready; it.bal.g.scale.setScalar(Math.max(0.01, s)); it.bal.list.forEach((b, j) => { b.rotation.z = Math.sin(t * 1.4 + j) * 0.12; }); }
        if (it.k === 'flag') it.cloth.rotation.y = Math.sin(t * 3) * (it.on ? 0.3 : 0.12);
        if (it.k === 'cage') this.animCage(it, t);
      }
      // εχθροί
      for (const f of this.foes) {
        const M = f.mesh, r = M.root;
        r.position.set(f.x, f.y, 0);
        r.rotation.y = f.face > 0 ? -0.35 : Math.PI + 0.35;
        if (f.dead) { r.rotation.z = f.spin || 0; r.rotation.x = Math.PI; continue; }
        if (f.k === 'beetle') { M.legs.forEach((l, i) => { l.rotation.z = Math.sin(t * 14 + i * 1.7) * 0.5; }); M.body.position.y = Math.abs(Math.sin(t * 7 + f.ph)) * 0.03; }
        else if (f.k === 'bee') M.wings.forEach((w, i) => { w.rotation.x = Math.sin(t * 40) * 0.7 * (i ? 1 : -1); });
        else if (f.k === 'crow') M.wings.forEach((w, i) => { w.rotation.x = Math.sin(t * 9 + f.ph) * 0.7 * (i ? -1 : 1); });
        else if (f.k === 'fish') { M.tail.rotation.y = Math.sin(t * 8 + f.ph) * 0.5; M.body.rotation.z = Math.sin(t * 2 + f.ph) * 0.1; }
      }
      // αφεντικό
      if (this.boss) {
        const b = this.boss, r = b.mesh.root;
        r.position.set(b.x, b.y - 0.5, -0.2);
        if (!b.dead) { b.mesh.body.rotation.z = Math.sin(t * 1.3) * 0.06; b.mesh.fox.rotation.y = Math.sin(t * 0.8) * 0.4; }
        const fl = b.flash > 0;
        b.mesh.env.material.emissive.set(fl ? '#ff2020' : '#000000');
        if (b.dead) b.mesh.env.scale.set(2 * Math.max(0.2, 1 - b.dead * 0.4), 2.25 * Math.max(0.2, 1 - b.dead * 0.4), 2 * Math.max(0.2, 1 - b.dead * 0.4));
      }
      // παίκτες
      for (const p of this.parts) this.animHog(p, t);
      // σωματίδια
      const pim = this.pim; let n = 0;
      for (const q of this.parts3) {
        q.life -= this.fdt; q.vy -= q.g * this.fdt; q.x += q.vx * this.fdt; q.y += q.vy * this.fdt; q.z += q.vz * this.fdt; q.r += 0.1;
        if (q.water && !this.waterAt(q.x, q.y)) q.life = 0;
        if (q.life <= 0) continue;
        const s = q.s * Math.min(1, (q.life / q.max) * 2);
        _e.set(q.r, q.r * 0.7, 0); _q.setFromEuler(_e); _v.set(q.x, q.y, q.z); _s.set(s, s, s); _m.compose(_v, _q, _s);
        pim.setMatrixAt(n, _m); _c.set(q.c); pim.setColorAt(n, _c); n++;
      }
      this.parts3 = this.parts3.filter((q) => q.life > 0);
      pim.count = n; pim.instanceMatrix.needsUpdate = true; if (pim.instanceColor) pim.instanceColor.needsUpdate = true;
      this.R.render(this.scene, cam);
    }

    animCage(it, t) {
      const cg = it.cg;
      cg.lock.visible = !!it.locked || (it.unlockT != null && it.unlockT < 1);
      if (it.unlockT != null && it.unlockT < 1) { it.unlockT += this.fdt; cg.lock.position.y = 0.9 + it.unlockT * 2; cg.lock.rotation.z = it.unlockT * 6; cg.lock.scale.setScalar(Math.max(0.01, 1 - it.unlockT)); }
      if (it.open) {
        it.openT += this.fdt;
        cg.top.position.y = Math.min(8, it.openT * it.openT * 6); cg.top.rotation.y = it.openT * 3;
        cg.babies.forEach((h, i) => {
          const k = Math.min(1, it.openT / 1.2), dir = i - 1;
          h.root.position.x = dir * (0.42 + k * 1.3);
          h.root.position.y = 0.2 + Math.abs(Math.sin(t * 7 + i * 1.3)) * 0.6 * k;
          h.root.rotation.y = -0.6 + Math.sin(t * 3 + i) * 0.6;
          h.body.rotation.z = Math.sin(t * 7 + i) * 0.1;
        });
      } else {
        cg.babies.forEach((h, i) => { h.root.position.y = 0.2 + Math.abs(Math.sin(t * 4 + i * 2)) * 0.12; h.body.rotation.z = Math.sin(t * 5 + i) * 0.08; });
        cg.top.position.y = 0;
      }
    }

    animHog(p, t) {
      const h = p.mesh; if (!h) return;
      const r = h.root;
      r.visible = !p.gone && !(p.inv > 0 && p.dead <= 0 && Math.floor(t * 14) % 2 === 0);
      r.position.set(p.x, p.y, 0);
      const target = p.face > 0 ? -0.55 : Math.PI + 0.55;
      h.ry += (target - h.ry) * 0.2; h.body.rotation.y = h.ry;
      const sp = Math.abs(p.vx);
      if (p.onG && sp > 0.3) h.phase += sp * this.fdt * 2.6;
      const sw = p.onG ? Math.sin(h.phase * 2) : 0;
      h.feet[0].position.x = 0.1 + sw * 0.13; h.feet[1].position.x = 0.1 - sw * 0.13;
      h.hands[0].position.y = 0.22 + (p.onG ? sw * 0.04 : 0.12); h.hands[1].position.y = 0.22 - (p.onG ? sw * 0.04 : -0.12);
      let sy = 1, bob = p.onG ? Math.abs(Math.sin(h.phase * 2)) * 0.05 * Math.min(1, sp / 3) : 0;
      if (!p.onG && !p.swim && !p.balloon) sy = 1 + U.clamp(p.vy * 0.012, -0.1, 0.14);
      if (p.land > 0) sy = 1 - p.land * 0.22;
      h.body.scale.set(1 + (1 - sy) * 0.6, sy, 1 + (1 - sy) * 0.6);
      h.body.position.y = bob;
      h.body.rotation.z = p.dead > 0 ? t * 12 : p.swim ? -0.25 + Math.sin(t * 4) * 0.08 : (!p.onG && p.vy > 4 && !p.balloon ? -0.15 : 0);
      if (p.dead > 0) h.body.rotation.x = Math.PI * 0.3;
      else h.body.rotation.x = 0;
      // ανοιγοκλείσιμο ματιών
      h.blink -= this.fdt;
      const bl = h.blink < 0.12 ? 0.15 : 1; if (h.blink < 0) h.blink = 2 + Math.random() * 3;
      h.eyes.forEach((e) => { e.scale.y = 0.075 * bl; });
      p.bal.g.visible = p.balloon > 0 && p.dead <= 0;
      if (p.bal.g.visible) {
        p.bal.list.forEach((b, j) => { b.rotation.z = (j - 1) * 0.25 + Math.sin(t * 2 + j) * 0.1 - p.vx * 0.03; });
        p.bal.g.visible = !(p.balloon < 3 && Math.floor(t * 8) % 2 === 0);
      }
      p.shieldM.visible = !!p.shield && p.dead <= 0;
      if (p.shieldM.visible) { const s = 0.72 + Math.sin(t * 5) * 0.03; p.shieldM.scale.setScalar(s); }
    }

    toScreen(x, y, z = 0) {
      _v.set(x, y, z).project(this.cam);
      return [((_v.x + 1) / 2) * this.W, ((1 - _v.y) / 2) * this.H, _v.z < 1];
    }

    drawHud() {
      const x = this.ctx, W = this.W, H = this.H, vh = this.vh;
      // ονόματα πάνω από τα κεφάλια
      for (const p of this.parts) {
        if (p.gone || p.dead > 0) continue;
        const [sx, sy, ok] = this.toScreen(p.x, p.y + (p.balloon > 0 ? 3.1 : 1.25));
        if (!ok) continue;
        x.font = this.font(vh * 1.9, 800); const tw = x.measureText(p.name).width + vh * 1.6;
        U.rr(x, sx - tw / 2, sy - vh * 1.7, tw, vh * 2.8, vh * 1.4); x.fillStyle = 'rgba(10,8,30,.6)'; x.fill();
        x.lineWidth = vh * 0.25; x.strokeStyle = p.color.hex; x.stroke();
        x.fillStyle = '#fff'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(p.name, sx, sy - vh * 0.3);
        if (p.o2 < 0.999) {
          const [ox, oy] = this.toScreen(p.x + 0.95, p.y + 1.0);
          x.beginPath(); x.arc(ox, oy, vh * 2.4, 0, TAU); x.fillStyle = 'rgba(10,30,60,.7)'; x.fill(); x.lineWidth = vh * 0.3; x.strokeStyle = '#fff'; x.stroke();
          x.beginPath(); x.moveTo(ox, oy); x.arc(ox, oy, vh * 2.0, -Math.PI / 2, -Math.PI / 2 + TAU * p.o2); x.closePath();
          x.fillStyle = p.o2 < 0.3 ? (Math.floor(this.time * 6) % 2 ? '#ff5a5a' : '#ffb0b0') : '#7fe0ff'; x.fill();
          this.text('O₂', ox, oy + vh * 0.1, vh * 1.9, '#fff', { sw: vh * 0.4 });
        }
      }
      // πόντοι που αιωρούνται
      for (const q of this.pops) {
        const [sx, sy, ok] = this.toScreen(q.x, q.y + q.t * 1.4); if (!ok) continue;
        x.globalAlpha = Math.max(0, 1 - q.t / 1.2);
        this.text(q.txt, sx, sy, vh * 2.8, q.c, { w: 900 });
        x.globalAlpha = 1;
      }
      // συννεφάκι ομιλίας αφεντικού
      if (this.say && this.boss) {
        if (this.time - this.say.t0 > 3) this.say = null;
        else {
          let [sx, sy] = this.toScreen(this.boss.x, this.boss.y + 6.3);
          x.font = this.font(vh * 2.6, 800); const tw = x.measureText(this.say.txt).width + vh * 3;
          sx = U.clamp(sx, tw / 2 + vh * 2, W - tw / 2 - vh * 2); sy = U.clamp(sy, vh * 16, H * 0.7);
          U.rr(x, sx - tw / 2, sy - vh * 2.6, tw, vh * 5, vh * 2.2); x.fillStyle = '#fff'; x.fill(); x.lineWidth = vh * 0.35; x.strokeStyle = '#3a2212'; x.stroke();
          x.fillStyle = '#3a2212'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(this.say.txt, sx, sy);
        }
      }
      // πάνω κέντρο: κόσμος + ζωές
      const D = LEVELS[this.lv];
      const label = `Κόσμος ${this.lv + 1}/3 · ${D.name}`;
      x.font = this.font(vh * 2.6, 800);
      const hearts = Math.min(this.lives, 9);
      const lw = x.measureText(label).width, pw = lw + vh * 4 + hearts * vh * 3.2 + vh * 3;
      U.rr(x, W / 2 - pw / 2, vh * 2.4, pw, vh * 5.4, vh * 2.7); x.fillStyle = 'rgba(10,8,30,.62)'; x.fill();
      x.textAlign = 'left'; x.textBaseline = 'middle'; x.fillStyle = '#ffe066';
      x.fillText(label, W / 2 - pw / 2 + vh * 2, vh * 5.1);
      for (let i = 0; i < hearts; i++) this.text('❤', W / 2 - pw / 2 + vh * 4.5 + lw + i * vh * 3.2, vh * 5.2, vh * 2.8, '#ff4a5a', { stroke: false });
      if (this.lives > 9) this.text(`×${this.lives}`, W / 2 + pw / 2 + vh * 2, vh * 5.1, vh * 2.4, '#fff');
      // μπάρα αφεντικού
      const b = this.boss;
      if (b && !b.dead && b.seen) {
        const bw = Math.min(W * 0.4, vh * 70), bx = W / 2 - bw / 2, by = vh * 9;
        U.rr(x, bx, by, bw, vh * 2.6, vh * 1.3); x.fillStyle = 'rgba(10,8,30,.7)'; x.fill();
        U.rr(x, bx + vh * 0.4, by + vh * 0.4, (bw - vh * 0.8) * Math.max(0, b.hp / b.max), vh * 1.8, vh * 0.9); x.fillStyle = b.flash > 0 ? '#fff' : '#ff7f24'; x.fill();
        this.text('🦊 Κυρα-Αλεπού', W / 2, by + vh * 1.35, vh * 1.8, '#fff', { sw: vh * 0.35 });
      }
      // κάρτες παικτών
      const n = this.parts.length, cw = Math.min(W * 0.2, vh * 36), ch = vh * 7.6, gap = vh * 1.6;
      let X = (W - (n * cw + (n - 1) * gap)) / 2; const Y = H - ch - vh * 2.2;
      for (const p of this.parts) {
        U.rr(x, X, Y, cw, ch, vh * 1.8); x.fillStyle = 'rgba(10,8,30,.7)'; x.fill();
        x.lineWidth = vh * 0.3; x.strokeStyle = p.color.hex; x.stroke();
        x.beginPath(); x.arc(X + vh * 3.4, Y + ch / 2, vh * 2.2, 0, TAU); x.fillStyle = p.color.hex; x.fill();
        this.text('🦔', X + vh * 3.4, Y + ch / 2 + vh * 0.2, vh * 2.6, '#fff', { stroke: false });
        x.font = this.font(vh * 2.2, 800); x.textAlign = 'left'; x.fillStyle = '#fff';
        let nm = p.name + (p.bot ? ' 🤖' : '') + (p.gone ? ' (εκτός)' : '');
        while (x.measureText(nm).width > cw - vh * 8 && nm.length > 2) nm = nm.slice(0, -2) + '…';
        x.fillText(nm, X + vh * 6.4, Y + vh * 2.5);
        x.font = this.font(vh * 2.4, 900); x.fillStyle = '#ffe066'; x.fillText(String(p.score), X + vh * 6.4, Y + vh * 5.3);
        const icons = (p.balloon > 0 ? '🎈' : '') + (p.pow === 'tri' ? '🔱' : p.pow === 'speed' ? '👟' : '') + (p.shield ? '⭐' : '');
        if (icons) { x.textAlign = 'right'; x.font = this.font(vh * 2.4); x.fillText(icons, X + cw - vh * 1.4, Y + vh * 5.2); }
        X += cw + gap;
      }
      // τίτλος κόσμου στην αρχή
      if (this.phase === 'count') {
        const k = this.time - this.titleT;
        x.globalAlpha = Math.min(1, k * 3) * Math.max(0, Math.min(1, 3.2 - k));
        this.text(`Κόσμος ${this.lv + 1}`, W / 2, H * 0.22, vh * 5, '#fff', { fam: 'Comfortaa', w: 700 });
        this.text(D.name, W / 2, H * 0.3, vh * 7.5, '#ffe066', { fam: 'Comfortaa', w: 700 });
        x.globalAlpha = 1;
        this.drawCount(this.countT, 'ΠΑΜΕ!');
      }
    }

    finish(won) {
      this.phase = 'end'; this.musicOn = false;
      this.parts.forEach((p) => { p.mv = 0; p.mvV = 0; });
      const rank = [...this.parts].sort((a, b) => b.score - a.score || b.fruits - a.fruits || a.deaths - b.deaths);
      const mvp = rank[0]; mvp.hi = true;
      this.celebrate(won ? mvp.color.hex : '#ff9a6a');
      this.sfx(won ? 'win' : 'miss');
      this.changed();
      this.h.onOver && this.h.onOver({
        winner: mvp,
        title: this.parts.length === 1 ? (won ? 'Έσωσες τα σκαντζοχοιράκια!' : 'Καλή προσπάθεια!') : won ? 'Σώσατε τα σκαντζοχοιράκια! Πρώτος σε πόντους' : 'Πρώτος της ομάδας',
        icon: won ? '🏆' : '🦔',
        stats: this.parts.length === 1 ? (won ? `${this.team} πόντοι · νίκησες την Κυρα-Αλεπού με ${this.lives} ❤` : `${this.team} πόντοι · έφτασες στον κόσμο ${this.lv + 1}/3`) : won ? `Ομάδα: ${this.team} πόντοι · νικήσατε την Κυρα-Αλεπού με ${this.lives} ❤`
          : `Ομάδα: ${this.team} πόντοι · φτάσατε στον κόσμο ${this.lv + 1}/3`,
        rank: rank.map((q) => ({ name: q.name, color: q.color, st: `${q.score} πόντοι · ${q.fruits} ${q.fruits === 1 ? 'φρούτο' : 'φρούτα'} · ${q.foes} ${q.foes === 1 ? 'εχθρός' : 'εχθροί'}` })),
      });
    }
  }

  Mini.games.hedgehog = HedgehogGame;
})();
