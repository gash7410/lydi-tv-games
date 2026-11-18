// «Ζούγκλα» σε 3D: ίδια λογική με το game-jungle.js (πίστες, εχθροί, αυγά, αφεντικό), αλλά η σκηνή
// αποδίδεται με Three.js σε δικό της καμβά (#stage3d) πίσω από το #stage2, που κρατά μόνο HUD και κείμενα.
// Το επίπεδο z=0 αντιστοιχεί ακριβώς στην οθόνη του 2D (κάμερα με view offset), οπότε τα όρια της κάμερας,
// οι συγκρούσεις και τα κείμενα μένουν ίδια. Αν το 3D δεν φορτώσει, το παιχνίδι παίζει όπως πριν σε 2D.
(function () {
  'use strict';
  const J2 = Mini.games.jungle;
  if (!J2 || !J2.K) return;
  const { U } = Mini;
  const { LH, GY, AREAS } = J2.K;
  const SRC = (document.currentScript && document.currentScript.src) || location.href;
  let T = null, loadP = null;
  // Το Three.js r170 θέλει WebGL2. Σε τηλεοράσεις που έχουν μόνο WebGL1 φορτώνουμε το r162 (το τελευταίο με WebGL1).
  function glLevel() {
    const q = /[?&]gl1/.test(location.search) || (window.localStorage && localStorage.getItem('tvp.gl1') === '1');
    const test = (k) => { try { const c = document.createElement('canvas'); const g = c.getContext(k, { failIfMajorPerformanceCaveat: false }); if (!g) return false; const l = g.getExtension('WEBGL_lose_context'); if (l) l.loseContext(); return true; } catch (e) { return false; } };
    if (!q && test('webgl2')) return 2;
    return test('webgl') || test('experimental-webgl') ? 1 : 0;
  }
  function loadThree() {
    if (T) return Promise.resolve(T);
    if (!loadP) {
      const lv = glLevel();
      loadP = lv === 0 ? Promise.reject(new Error('NOGL'))
        : import(new URL(lv === 2 ? 'vendor/three.module.min.js' : 'vendor/three-r162.module.min.js', SRC).href).then((m) => (T = m));
      loadP = loadP.catch((e) => { if (e && e.message !== 'NOGL') loadP = null; throw e; });
    }
    return loadP;
  }
  // WebGLRenderer με εφεδρικές, πιο ελαφριές ρυθμίσεις αν οι πρώτες αποτύχουν
  function makeRenderer(cv) {
    const opts = [{ antialias: true, powerPreference: 'high-performance' }, { antialias: false }, { antialias: false, failIfMajorPerformanceCaveat: false, precision: 'mediump' }];
    let err;
    for (let i = 0; i < opts.length; i++) {
      if (i) { const n = document.createElement('canvas'); n.id = cv.id; n.style.cssText = cv.style.cssText; cv.replaceWith(n); cv = n; } // νέος καμβάς σε κάθε δοκιμή
      try { return new T.WebGLRenderer(Object.assign({ canvas: cv }, opts[i])); } catch (e) { err = e; }
    }
    throw err;
  }
  setTimeout(() => (window.requestIdleCallback || setTimeout)(() => loadThree().catch(() => {})), 9000);

  const K = 1 / 16, TAU = Math.PI * 2;
  const X3 = (x) => x * K, Y3 = (y) => (GY - y) * K;
  const UNITS_H = LH * K, LIFT = 3.4, DIST = 24, FRONT = 1.7, BACK = -3.2;

  const TH = [
    { sky: ['#2b95ee', '#e4f8ff'], fog: '#d6f2ff', fn: 50, ff: 190, top: '#5ccb3c', topD: '#3f9a2a', dirt: '#a06a3a', back: '#4aa83a',
      hemi: ['#eaf7ff', '#5a7a3a', 1.25], sun: ['#fff1d6', 2.7], plat: '#5ccb3c', platSide: '#8a5a2e' },
    { sky: ['#39a6f4', '#fff1cf'], fog: '#fdf0d6', fn: 55, ff: 230, top: '#f7dc94', topD: '#e2bb68', dirt: '#d8a25e', back: '#f2d48a',
      hemi: ['#fff6e8', '#c8a060', 1.3], sun: ['#fff4e0', 2.7], plat: '#d9a35a', platSide: '#a8743a' },
    { sky: ['#2a1226', '#ff8044'], fog: '#5a2a2c', fn: 40, ff: 170, top: '#6e5e5a', topD: '#4a3c3a', dirt: '#40302c', back: '#3a2c2a',
      hemi: ['#ffb894', '#3a1a1a', 1.0], sun: ['#ffbc80', 2.3], plat: '#62524e', platSide: '#3a2c2a' },
  ];

  // ---------- βοηθητικά Three ----------
  let G3 = null;
  const MC = new Map();
  function mat(hex, r = 0.6, o = {}) {
    const k = [hex, r, o.em || '', o.flat ? 1 : 0, o.op || 1, o.ei || 1].join('|');
    let m = MC.get(k);
    if (!m) {
      m = new T.MeshStandardMaterial({ color: hex, roughness: r, flatShading: !!o.flat });
      if (o.em) { m.emissive.set(o.em); m.emissiveIntensity = o.ei || 1; }
      if (o.op && o.op < 1) { m.transparent = true; m.opacity = o.op; m.depthWrite = false; }
      MC.set(k, m);
    }
    return m;
  }
  function basic(hex, o = {}) {
    const k = 'b|' + hex + '|' + (o.add ? 1 : 0) + '|' + (o.op || 1) + '|' + (o.map ? o.map.uuid : '');
    let m = MC.get(k);
    if (!m) {
      m = new T.MeshBasicMaterial({ color: hex, map: o.map || null, transparent: !!(o.add || o.map || o.op), opacity: o.op || 1, depthWrite: !(o.add || o.map), fog: !o.add });
      if (o.add) m.blending = T.AdditiveBlending;
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
    if (rep) t.wrapS = t.wrapT = T.RepeatWrapping;
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
  // γινόμενο πινάκων από αριστερά προς τα δεξιά
  function chain(...ms) { const r = new T.Matrix4(); for (const m of ms) r.multiply(m); return r; }
  const Tm = (x, y, z) => new T.Matrix4().makeTranslation(x, y, z);
  const Sm = (x, y, z) => new T.Matrix4().makeScale(x, y, z);
  const Rx = (a) => new T.Matrix4().makeRotationX(a), Ry = (a) => new T.Matrix4().makeRotationY(a), Rz = (a) => new T.Matrix4().makeRotationZ(a);
  // κουτί με UV σε μονάδες κόσμου (για επαναλαμβανόμενη υφή)
  function boxUV(w, h, d, su) {
    const g = new T.BoxGeometry(w, h, d), uv = g.attributes.uv;
    const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
    for (let f = 0; f < 6; f++) for (let i = 0; i < 4; i++) { const k = f * 4 + i; uv.setXY(k, uv.getX(k) * dims[f][0] / su, uv.getY(k) * dims[f][1] / su); }
    return g;
  }

  class Inst {
    constructor(parent, parts, n, shadow) {
      this.n = n;
      this.parts = parts.map((pt) => {
        const im = new T.InstancedMesh(pt.geo, pt.mat, Math.max(1, n));
        im.frustumCulled = false; im.castShadow = !!shadow; im.receiveShadow = true;
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

  // ---------- μοντέλα (κοιτούν προς +x, πατούν στο y=0) ----------
  function glowPlane(hex, s, parent, x = 0, y = 0, z = 0) {
    const m = new T.Mesh(G3.plane, basic(hex, { add: true, map: TEX.glow })); m.scale.set(s, s, 1); m.position.set(x, y, z); m.renderOrder = 5;
    if (parent) parent.add(m); return m;
  }

  function makeKid(hex) {
    const root = new T.Group(), pivot = new T.Group(), body = new T.Group();
    root.add(pivot); pivot.position.y = 0.75; pivot.add(body); body.position.y = -0.75;
    const skin = mat('#ffd3a8', 0.7), skinB = mat('#eab48c', 0.7), hair = mat('#5b2d12', 0.85), foot = mat('#8a4a22', 0.8);
    const cloth = mat(hex, 0.6), band = mat(mixHex(hex, '#ffffff', 0.35), 0.5);
    const legs = [1, -1].map((s) => {
      const g = new T.Group(); g.position.set(0, 0.5, s * 0.12); body.add(g);
      mk(G3.cyl, s > 0 ? skin : skinB, 0.075, 0.42, 0.075, 0, -0.21, 0, g);
      mk(G3.sph, foot, 0.14, 0.08, 0.1, 0.05, -0.43, 0, g);
      return g;
    });
    // χιτώνας με δόντια στο κάτω μέρος + λουρί
    mk(G3.tunic, cloth, 0.3, 0.5, 0.26, 0, 0.75, 0, body);
    for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU; mk(G3.cone6, cloth, 0.07, 0.12, 0.07, Math.cos(a) * 0.27, 0.47, Math.sin(a) * 0.24, body).rotation.x = Math.PI; }
    mk(G3.box, mat('#7a4a20', 0.8), 0.06, 0.62, 0.05, 0.02, 0.8, 0.23, body, false).rotation.x = 0.0;
    body.children[body.children.length - 1].rotation.z = 0.7;
    const arms = [1, -1].map((s) => {
      const g = new T.Group(); g.position.set(0.02, 0.96, s * 0.27); body.add(g);
      mk(G3.cyl, s > 0 ? skin : skinB, 0.06, 0.36, 0.06, 0, -0.18, 0, g);
      mk(G3.sphM, s > 0 ? skin : skinB, 0.085, 0.085, 0.085, 0, -0.38, 0, g);
      return g;
    });
    // τσεκούρι στο μπροστινό χέρι
    const axe = makeAxe(); axe.position.set(0.05, -0.38, 0.05); axe.rotation.z = -1.4; axe.scale.setScalar(0.85); arms[0].add(axe);
    // κεφάλι
    const head = new T.Group(); head.position.set(0.03, 1.3, 0); body.add(head);
    mk(G3.sph, skin, 0.3, 0.29, 0.29, 0, 0, 0, head);
    mk(G3.sphM, skin, 0.08, 0.08, 0.08, 0.02, -0.02, 0.29, head); // αυτί
    mk(G3.sphM, skin, 0.07, 0.06, 0.07, 0.3, -0.03, 0, head); // μύτη
    const eyes = [], pupils = [];
    for (const s of [1, -1]) {
      eyes.push(mk(G3.sphM, mat('#ffffff', 0.3), 0.065, 0.085, 0.05, 0.25, 0.06, s * 0.11, head, false));
      pupils.push(mk(G3.sphM, mat('#1b1020', 0.3), 0.04, 0.055, 0.03, 0.29, 0.06, s * 0.11, head, false));
      mk(G3.sphM, mat('#ff9a9a', 0.8), 0.05, 0.03, 0.03, 0.26, -0.08, s * 0.17, head, false);
    }
    const mouth = mk(G3.sphM, mat('#8a1a1a', 0.7), 0.025, 0.03, 0.06, 0.28, -0.13, 0, head, false);
    // μαλλιά: πίσω, κορυφή και τσουλούφια
    const hc = mk(G3.hemi, hair, 0.33, 0.3, 0.32, -0.03, 0.02, 0, head); hc.rotation.z = 0.5;
    for (let i = 0; i < 6; i++) { const a = -0.4 + i * 0.32; const c = mk(G3.cone6, hair, 0.09, 0.22, 0.09, -Math.cos(a) * 0.24 - 0.04, Math.sin(a) * 0.24 + 0.14, (i % 2 ? 1 : -1) * 0.12, head); c.rotation.z = 1.2 + a; }
    const fr = mk(G3.sphM, hair, 0.16, 0.08, 0.26, 0.18, 0.2, 0, head); fr.rotation.z = -0.4;
    // κορδέλα στο χρώμα του παίκτη + ουρές
    const bd = mk(G3.torus, band, 0.3, 0.3, 0.3, 0, 0.08, 0, head, false); bd.rotation.x = Math.PI / 2; bd.rotation.y = 0.15;
    const tails = [0.06, -0.06].map((z) => { const t = mk(G3.box, band, 0.28, 0.05, 0.03, -0.42, 0.05, z, head, false); return t; });
    root.traverse((o) => { if (o.isMesh) o.receiveShadow = false; });
    return { root, pivot, body, legs, arms, axe, head, eyes, pupils, mouth, tails };
  }
  function makeAxe() {
    const g = new T.Group();
    mk(G3.cyl, mat('#9a6030', 0.8), 0.035, 0.5, 0.035, 0, 0.2, 0, g);
    const h = mk(G3.ico0, mat('#b8b8c4', 0.5, { flat: true }), 0.15, 0.11, 0.05, 0.1, 0.4, 0, g); h.rotation.z = 0.3;
    mk(G3.box, mat('#d8b878', 0.8), 0.09, 0.07, 0.07, 0, 0.38, 0, g);
    return g;
  }
  function makeBoard() {
    const g = new T.Group();
    mk(G3.box, mat('#c87a3a', 0.6), 0.9, 0.06, 0.32, 0, 0.12, 0, g);
    mk(G3.box, mat('#ff5a3a', 0.6), 0.7, 0.065, 0.1, 0, 0.12, 0, g, false);
    for (const x of [-0.3, 0.3]) for (const z of [-0.12, 0.12]) { const w = mk(G3.cyl, mat('#333333', 0.6), 0.06, 0.05, 0.06, x, 0.06, z, g); w.rotation.x = Math.PI / 2; }
    return g;
  }
  function makeFairy() {
    const g = new T.Group();
    mk(G3.sphM, basic('#ffe0ff'), 0.1, 0.1, 0.1, 0, 0, 0, g, false);
    glowPlane('#ff8ae8', 1.2, g);
    for (const s of [1, -1]) { const w = mk(G3.sphM, mat('#ffffff', 0.2, { op: 0.65, em: '#ffd0ff', ei: 0.6 }), 0.16, 0.08, 0.02, -0.04, 0.08, s * 0.08, g, false); w.rotation.z = s * 0.6; }
    return g;
  }
  function makeRainCloud() {
    const g = new T.Group(), m = mat('#8a94a8', 0.9);
    for (const [x, y, s] of [[0, 0, 0.32], [-0.3, -0.05, 0.24], [0.3, -0.04, 0.26], [0.12, 0.14, 0.24]]) mk(G3.sphM, m, s, s * 0.85, s * 0.8, x, y, 0, g, false);
    const drops = [];
    for (let i = 0; i < 6; i++) drops.push(mk(G3.cylL, basic('#9ad4ff'), 0.015, 0.14, 0.015, -0.35 + i * 0.14, -0.3, (i % 2) * 0.1, g, false));
    g.userData.drops = drops;
    return g;
  }
  function makeBasket() {
    const g = new T.Group();
    mk(G3.cyl, mat('#c8904a', 0.8), 0.28, 0.24, 0.22, 0, 0.12, 0, g);
    for (const [x, c] of [[-0.12, '#f0302c'], [0.1, '#ffd92e'], [0, '#9440d6']]) mk(G3.sphM, mat(c, 0.4), 0.12, 0.12, 0.12, x, 0.28, 0, g);
    const h = mk(G3.torus, mat('#a8743a', 0.8), 0.24, 0.24, 0.24, 0, 0.26, 0, g); h.rotation.y = 0;
    return g;
  }
  function makeItem(k) {
    if (k === 'axe') { const g = makeAxe(); g.scale.setScalar(1.5); return g; }
    if (k === 'skate') return makeBoard();
    if (k === 'fairy') { const g = makeFairy(); g.scale.setScalar(1.6); return g; }
    if (k === 'basket') return makeBasket();
    const g = makeRainCloud(); g.scale.setScalar(1.1); return g;
  }

  function eye(parent, x, y, z, s = 1) {
    mk(G3.sphM, mat('#ffffff', 0.3), 0.08 * s, 0.08 * s, 0.08 * s, x, y, z, parent, false);
    mk(G3.sphM, mat('#151015', 0.3), 0.045 * s, 0.05 * s, 0.045 * s, x + 0.05 * s, y, z, parent, false);
  }
  function makeFoe(k) {
    const root = new T.Group(), body = new T.Group(); root.add(body);
    const M = { root, body, k };
    if (k === 'snail') {
      const sh = mk(G3.sph, mat('#d8843a', 0.5), 0.34, 0.34, 0.26, -0.12, 0.42, 0, body);
      const sp = mk(G3.torus, mat('#a8541c', 0.5), 0.2, 0.2, 0.5, -0.12, 0.42, 0, body); sp.rotation.y = 0;
      mk(G3.sphM, mat('#f0c070', 0.5), 0.1, 0.1, 0.27, -0.12, 0.42, 0, body);
      M.foot = mk(G3.sph, mat('#cbe05a', 0.5), 0.55, 0.14, 0.2, 0.05, 0.13, 0, body);
      mk(G3.sphM, mat('#cbe05a', 0.5), 0.15, 0.17, 0.15, 0.42, 0.26, 0, body);
      for (const s of [1, -1]) { const st = mk(G3.cylL, mat('#cbe05a', 0.5), 0.025, 0.28, 0.025, 0.48, 0.48, s * 0.07, body); st.rotation.x = s * 0.25; eye(body, 0.49, 0.62, s * 0.1, 0.9); }
      void sh;
    } else if (k === 'frog') {
      mk(G3.sph, mat('#4cc23a', 0.5), 0.36, 0.26, 0.32, 0, 0.28, 0, body);
      mk(G3.sph, mat('#c8f070', 0.5), 0.25, 0.18, 0.26, 0.12, 0.22, 0, body);
      M.legs = [1, -1].map((s) => mk(G3.sph, mat('#3aa02c', 0.5), 0.2, 0.1, 0.12, -0.2, 0.1, s * 0.27, body));
      for (const s of [1, -1]) { mk(G3.sphM, mat('#4cc23a', 0.5), 0.12, 0.12, 0.12, 0.14, 0.5, s * 0.14, body); eye(body, 0.2, 0.54, s * 0.14, 1.1); }
      mk(G3.box, mat('#2a6a1a', 0.6), 0.02, 0.02, 0.3, 0.34, 0.26, 0, body, false);
    } else if (k === 'bee') {
      mk(G3.sph, mat('#ffd02a', 0.4), 0.3, 0.23, 0.23, 0, 0.3, 0, body);
      for (const x of [-0.08, 0.08]) { const r = mk(G3.torus, mat('#2a1a10', 0.5), 0.2, 0.2, 0.3, x, 0.3, 0, body); r.rotation.y = Math.PI / 2; r.scale.set(0.22, 0.2, 0.3); }
      mk(G3.cone6, mat('#2a1a10', 0.5), 0.05, 0.14, 0.05, -0.33, 0.28, 0, body).rotation.z = Math.PI / 2;
      eye(body, 0.22, 0.36, 0.1); eye(body, 0.22, 0.36, -0.1);
      M.wings = [1, -1].map((s) => { const w = new T.Group(); w.position.set(-0.02, 0.5, s * 0.08); body.add(w); mk(G3.sphM, mat('#ffffff', 0.2, { op: 0.7 }), 0.18, 0.04, 0.12, 0, 0.02, s * 0.12, w, false); return w; });
    } else if (k === 'crab') {
      mk(G3.sph, mat('#f0442c', 0.5), 0.42, 0.2, 0.3, 0, 0.32, 0, body);
      M.claws = [1, -1].map((s) => {
        const g = new T.Group(); g.position.set(0.32, 0.36, s * 0.36); body.add(g);
        mk(G3.sph, mat('#f0442c', 0.5), 0.15, 0.12, 0.12, 0.08, 0.06, 0, g);
        const p = mk(G3.cone6, mat('#d0301c', 0.5), 0.06, 0.16, 0.06, 0.2, 0.14, 0, g); p.rotation.z = -0.9;
        return g;
      });
      M.legs = [];
      for (const s of [1, -1]) for (let i = 0; i < 3; i++) { const l = mk(G3.cylL, mat('#d0301c', 0.5), 0.03, 0.3, 0.03, -0.18 + i * 0.16, 0.17, s * 0.32, body); l.rotation.x = s * 0.7; M.legs.push(l); }
      for (const s of [1, -1]) { mk(G3.cylL, mat('#f0442c', 0.5), 0.02, 0.2, 0.02, 0.2, 0.52, s * 0.08, body); eye(body, 0.22, 0.64, s * 0.08, 0.8); }
    } else if (k === 'snake') {
      const m = mat('#8a4ad0', 0.45), b = mat('#ffd060', 0.5);
      const t1 = mk(G3.torus, m, 0.34, 0.34, 0.5, 0, 0.12, 0, body); t1.rotation.x = Math.PI / 2;
      const t2 = mk(G3.torus, m, 0.26, 0.26, 0.45, 0.02, 0.3, 0, body); t2.rotation.x = Math.PI / 2;
      const nk = mk(G3.cyl, m, 0.09, 0.75, 0.09, 0.1, 0.7, 0, body); nk.rotation.z = -0.25;
      mk(G3.cyl, b, 0.06, 0.7, 0.07, 0.15, 0.68, 0, body, false).rotation.z = -0.25;
      M.head = new T.Group(); M.head.position.set(0.2, 1.1, 0); body.add(M.head);
      mk(G3.sph, m, 0.22, 0.14, 0.17, 0.08, 0, 0, M.head);
      eye(M.head, 0.12, 0.09, 0.09, 0.9); eye(M.head, 0.12, 0.09, -0.09, 0.9);
      M.tongue = mk(G3.box, mat('#ff2a4a', 0.5), 0.18, 0.015, 0.04, 0.34, -0.05, 0, M.head, false);
      for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU; mk(G3.sphL, mat('#ffd060', 0.5), 0.05, 0.05, 0.05, Math.cos(a) * 0.34, 0.2, Math.sin(a) * 0.34, body, false); }
    } else if (k === 'boulder') {
      M.rock = mk(G3.ico, mat('#8a7468', 0.9, { flat: true }), 0.52, 0.5, 0.5, 0, 0.5, 0, body);
      for (let i = 0; i < 4; i++) mk(G3.ico0, mat('#6a564c', 0.9, { flat: true }), 0.16, 0.12, 0.1, Math.cos(i * 1.6) * 0.44, Math.sin(i * 1.6) * 0.44, 0.22, M.rock).scale.setScalar(0.35);
    }
    root.traverse((o) => { if (o.isMesh) o.receiveShadow = false; });
    return M;
  }

  function makeBoss() {
    const root = new T.Group(), body = new T.Group(); root.add(body);
    const woodM = new T.MeshStandardMaterial({ color: '#c8803a', roughness: 0.75, map: TEX.wood });
    for (const s of [-1, 1]) { mk(G3.box, mat('#7a3e16', 0.8), 0.6, 0.8, 0.6, s * 0.75, 0.4, 0, body); mk(G3.sph, mat('#4a240c', 0.8), 0.45, 0.18, 0.4, s * 0.75, 0.05, 0.1, body); }
    const mask = mk(G3.box, woodM, 3.0, 3.2, 1.2, 0, 2.4, 0, body);
    mk(G3.cyl, woodM, 1.5, 1.2, 0.6, 0, 4.0, 0, body).rotation.x = Math.PI / 2;
    for (const y of [1.2, 3.4]) mk(G3.box, mat('#7a3a14', 0.8), 3.08, 0.1, 1.25, 0, y, 0, body, false);
    for (const s of [-1, 1]) {
      mk(G3.box, mat('#e8322a', 0.6), 0.5, 0.42, 0.06, s * 1.05, 2.0, 0.62, body, false);
      mk(G3.box, mat('#fff2d0', 0.6), 0.5, 0.1, 0.06, s * 1.05, 1.68, 0.62, body, false);
    }
    const brows = [-1, 1].map((s) => { const b = mk(G3.box, mat('#4a200a', 0.8), 1.0, 0.24, 0.2, s * 0.6, 3.15, 0.62, body, false); b.rotation.z = -s * 0.25; return b; });
    const eyes = [-1, 1].map((s) => {
      mk(G3.sph, mat('#1a0a04', 0.8), 0.38, 0.3, 0.1, s * 0.6, 2.7, 0.6, body, false);
      const e = mk(G3.sphM, basic('#ffe680'), 0.14, 0.14, 0.05, s * 0.6, 2.7, 0.69, body, false);
      const gl = glowPlane('#ffaa30', 1.4, body, s * 0.6, 2.7, 0.72);
      return { e, gl };
    });
    const mouth = new T.Group(); mouth.position.set(0, 1.55, 0.62); body.add(mouth);
    mk(G3.box, mat('#3a0a04', 0.9), 1.7, 0.5, 0.06, 0, -0.2, 0, mouth, false);
    const fire = mk(G3.box, basic('#ff6a20'), 1.4, 0.3, 0.07, 0, -0.22, 0, mouth, false);
    for (let i = -2; i <= 2; i++) { const t = mk(G3.cone6, mat('#fff6e0', 0.5), 0.1, 0.2, 0.05, i * 0.3, -0.08, 0.04, mouth, false); t.rotation.z = Math.PI; }
    const crown = new T.Group(); crown.position.set(0, 4.3, -0.1); body.add(crown);
    for (let i = 0; i < 9; i++) {
      const a = (i - 4) * 0.3, L = 1.9 - Math.abs(i - 4) * 0.16;
      const lf = mk(G3.sph, mat(i % 2 ? '#8af05a' : '#4ac040', 0.6), 0.2, L / 2, 0.06, 0, 0, 0, crown);
      lf.position.set(Math.sin(a) * L * 0.5, Math.cos(a) * L * 0.5, -0.02 * Math.abs(i - 4)); lf.rotation.z = -a;
    }
    root.traverse((o) => { if (o.isMesh) o.receiveShadow = false; });
    return { root, body, mask, woodM, eyes, mouth, fire, brows, crown };
  }

  let TEX = null;
  function initTex() {
    TEX = {
      glow: canvasTex(64, 64, (x, w) => { const g = x.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.35, 'rgba(255,255,255,.45)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, w, w); }),
      dirt: canvasTex(128, 128, (x, w, h) => {
        x.fillStyle = '#ffffff'; x.fillRect(0, 0, w, h); const r = rnd(7);
        for (let i = 0; i < 240; i++) { x.fillStyle = `rgba(${r() < 0.5 ? '60,30,10' : '255,230,200'},${0.06 + r() * 0.12})`; x.beginPath(); x.arc(r() * w, r() * h, 2 + r() * 9, 0, TAU); x.fill(); }
        for (let i = 0; i < 12; i++) { const X = r() * w, Y = r() * h, s = 4 + r() * 6; x.fillStyle = 'rgba(90,70,60,.5)'; x.beginPath(); x.ellipse(X, Y, s, s * 0.7, r() * 3, 0, TAU); x.fill(); x.fillStyle = 'rgba(255,255,255,.22)'; x.beginPath(); x.ellipse(X - s * 0.25, Y - s * 0.25, s * 0.4, s * 0.25, 0, 0, TAU); x.fill(); }
      }, true),
      wood: canvasTex(128, 128, (x, w, h) => {
        x.fillStyle = '#ffffff'; x.fillRect(0, 0, w, h); const r = rnd(11);
        for (let i = 0; i < 26; i++) { x.strokeStyle = `rgba(90,50,20,${0.12 + r() * 0.2})`; x.lineWidth = 1 + r() * 3; x.beginPath(); const X = r() * w; x.moveTo(X, 0); x.bezierCurveTo(X + r() * 10 - 5, h * 0.3, X + r() * 10 - 5, h * 0.7, X, h); x.stroke(); }
      }, true),
      egg: canvasTex(128, 64, (x, w, h) => { x.fillStyle = '#f6f1e6'; x.fillRect(0, 0, w, h); const r = rnd(5); x.fillStyle = '#53b4f0'; for (let i = 0; i < 16; i++) { x.beginPath(); x.ellipse(r() * w, 8 + r() * (h - 16), 4 + r() * 5, 4 + r() * 4, 0, 0, TAU); x.fill(); } }),
      eggBad: canvasTex(128, 64, (x, w, h) => { x.fillStyle = '#f6f1e6'; x.fillRect(0, 0, w, h); const r = rnd(5); x.fillStyle = '#e5352c'; for (let i = 0; i < 16; i++) { x.beginPath(); x.ellipse(r() * w, 8 + r() * (h - 16), 4 + r() * 5, 4 + r() * 4, 0, 0, TAU); x.fill(); } }),
      melon: canvasTex(64, 32, (x, w, h) => { x.fillStyle = '#3aa83a'; x.fillRect(0, 0, w, h); x.fillStyle = '#1f6a1f'; for (let i = 0; i < 8; i++) { x.beginPath(); for (let y = 0; y <= h; y += 2) x.lineTo(i * 8 + 2 + Math.sin(y * 0.6) * 1.4, y); for (let y = h; y >= 0; y -= 2) x.lineTo(i * 8 + 5 + Math.sin(y * 0.6) * 1.4, y); x.fill(); } }),
      water: canvasTex(128, 128, (x, w, h) => {
        x.fillStyle = '#ffffff'; x.fillRect(0, 0, w, h); x.strokeStyle = 'rgba(255,255,255,.0)';
        x.strokeStyle = 'rgba(140,200,255,.55)'; x.lineWidth = 3;
        for (let k = 0; k < 6; k++) { x.beginPath(); for (let X = 0; X <= w; X += 4) { const Y = k * 22 + 8 + Math.sin((X / w) * TAU * 2 + k) * 4; X ? x.lineTo(X, Y) : x.moveTo(X, Y); } x.stroke(); }
      }, true),
      lava: canvasTex(128, 128, (x, w, h) => {
        x.fillStyle = '#ff6a10'; x.fillRect(0, 0, w, h); const r = rnd(9);
        for (let i = 0; i < 60; i++) { x.fillStyle = r() < 0.5 ? 'rgba(255,220,80,.6)' : 'rgba(170,30,0,.5)'; x.beginPath(); x.ellipse(r() * w, r() * h, 4 + r() * 14, 3 + r() * 6, r() * 3, 0, TAU); x.fill(); }
      }, true),
      flag: canvasTex(128, 80, (x, w, h) => { const s = 16; for (let i = 0; i < w / s; i++) for (let j = 0; j < h / s; j++) { x.fillStyle = (i + j) % 2 ? '#1a1a1a' : '#ffffff'; x.fillRect(i * s, j * s, s, s); } }),
    };
  }

  class Jungle3D extends J2 {
    resize() {
      super.resize();
      if (this.GL) { this.GL.setSize(this.W, this.H, false); }
    }
    setup() {
      super.setup();
      this.l3 = null;
      loadThree().catch(() => {});
    }
    end() {
      super.end();
      if (this.cv3) this.cv3.hidden = true;
    }

    ok3() {
      if (this.fail3 || !T) return false;
      if (!this.GL) {
        try { this.init3D(); } catch (e) { console.error(e); this.fail3 = true; if (this.cv3) this.cv3.hidden = true; return false; }
      }
      if (this.l3 !== this.L) {
        try { this.buildArea(); } catch (e) { console.error(e); this.fail3 = true; this.cv3.hidden = true; return false; }
      }
      return true;
    }

    init3D() {
      if (!G3) {
        G3 = {
          sph: new T.SphereGeometry(1, 16, 12), sphM: new T.SphereGeometry(1, 10, 8), sphL: new T.SphereGeometry(1, 7, 5), box: new T.BoxGeometry(1, 1, 1),
          cone: new T.ConeGeometry(1, 1, 12), cone6: new T.ConeGeometry(1, 1, 6), cyl: new T.CylinderGeometry(1, 1, 1, 12), cylL: new T.CylinderGeometry(1, 1, 1, 6),
          hemi: new T.SphereGeometry(1, 16, 8, 0, TAU, 0, Math.PI / 2), torus: new T.TorusGeometry(1, 0.22, 8, 22), ico: new T.IcosahedronGeometry(1, 1), ico0: new T.IcosahedronGeometry(1, 0),
          plane: new T.PlaneGeometry(1, 1), hemiL: new T.SphereGeometry(1, 8, 3, 0, TAU, 0, Math.PI / 2), tunic: new T.CylinderGeometry(0.62, 1, 1, 12), ban: new T.TorusGeometry(0.26, 0.075, 6, 12, Math.PI * 0.75),
        };
        _m = new T.Matrix4(); _q = new T.Quaternion(); _e = new T.Euler(); _v = new T.Vector3(); _s = new T.Vector3(); _c = new T.Color(); _p = new T.Matrix4();
        initTex();
      }
      const cv = (this.cv3 = document.createElement('canvas'));
      cv.id = 'stage3dJ';
      cv.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;display:block';
      this.c.parentNode.insertBefore(cv, this.c);
      const R = (this.GL = makeRenderer(cv)); this.cv3 = R.domElement; // σε WebGL1 (παλιές GPU) χωρίς σκιές
      this.q = 1;
      R.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.25));
      R.shadowMap.enabled = !!R.capabilities.isWebGL2; R.shadowMap.type = T.PCFSoftShadowMap;
      R.toneMapping = T.ACESFilmicToneMapping; R.toneMappingExposure = 1.05;
      this.scene = new T.Scene();
      this.cam = new T.PerspectiveCamera(30, 1, 0.5, 700);
      this.hemi = new T.HemisphereLight('#eaf7ff', '#5a7a3a', 1.25); this.scene.add(this.hemi);
      const sun = (this.sun = new T.DirectionalLight('#fff1d6', 2.6));
      sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024);
      Object.assign(sun.shadow.camera, { left: -20, right: 20, top: 12, bottom: -12, near: 1, far: 90 });
      sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.03;
      this.scene.add(sun); this.scene.add(sun.target);
      this.skyMat = new T.ShaderMaterial({
        side: T.BackSide, depthWrite: false, fog: false,
        uniforms: { a: { value: new T.Color('#2b95ee') }, b: { value: new T.Color('#e4f8ff') } },
        vertexShader: 'varying float h; void main(){ h = normalize(position).y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
        fragmentShader: 'uniform vec3 a; uniform vec3 b; varying float h; void main(){ gl_FragColor = vec4(mix(b, a, smoothstep(-0.03, 0.16, h)), 1.0);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}',
      });
      this.sky = new T.Mesh(new T.SphereGeometry(500, 24, 12), this.skyMat); this.sky.renderOrder = -1; this.scene.add(this.sky);
      this.scene.fog = new T.Fog('#d6f2ff', 50, 190);
      // σωματίδια: απλά (σκόνη, φύλλα) και φωτεινά (σπίθες, κάρβουνα)
      this.pim = new T.InstancedMesh(G3.ico0, new T.MeshStandardMaterial({ color: '#ffffff', roughness: 0.6, emissive: '#222222' }), 600);
      this.pim.frustumCulled = false; this.pim.count = 0; this.pim.setColorAt(0, new T.Color('#fff')); this.scene.add(this.pim);
      const gm = new T.MeshBasicMaterial({ color: '#ffffff', map: TEX.glow, transparent: true, depthWrite: false, blending: T.AdditiveBlending, fog: false });
      this.gim = new T.InstancedMesh(G3.plane, gm, 600);
      this.gim.frustumCulled = false; this.gim.count = 0; this.gim.setColorAt(0, new T.Color('#fff')); this.gim.renderOrder = 6; this.scene.add(this.gim);
      // παίκτες (μένουν από περιοχή σε περιοχή)
      this.kids = new Map();
      this.resize();
    }

    kidFor(p) {
      let M = this.kids.get(p);
      if (!M) {
        M = makeKid(p.color.hex); M.root.scale.setScalar(1.18);
        M.board = makeBoard(); M.root.add(M.board);
        M.fairy = makeFairy(); M.cloud = makeRainCloud();
        M.stars = new T.Group();
        for (let i = 0; i < 3; i++) mk(G3.ico0, basic('#ffe066'), 0.07, 0.07, 0.07, 0, 0, 0, M.stars, false);
        M.aura = glowPlane('#ff4ad0', 3.2, null); M.aura.material = basic('#c0309a', { add: true, map: TEX.glow, op: 0.55 });
        this.scene.add(M.root, M.fairy, M.cloud, M.stars, M.aura);
        this.kids.set(p, M);
      }
      return M;
    }

    // ---------- κατασκευή περιοχής ----------
    buildArea() {
      const L = (this.l3 = this.L), a = this.area - 1, th = (this.th = TH[a]);
      if (this.lvl) { this.scene.remove(this.lvl); this.lvl.traverse((o) => { if (o.isInstancedMesh) o.dispose(); if (o.geometry && o.geometry.userData.own) o.geometry.dispose(); }); }
      for (const M of this.kids.values()) this.scene.remove(M.root, M.fairy, M.cloud, M.stars, M.aura);
      this.kids = new Map();
      const g = (this.lvl = new T.Group()); this.scene.add(g);
      this.live = {};
      this.skyMat.uniforms.a.value.set(th.sky[0]); this.skyMat.uniforms.b.value.set(th.sky[1]);
      this.scene.fog.color.set(th.fog); this.scene.fog.near = th.fn; this.scene.fog.far = th.ff;
      this.hemi.color.set(th.hemi[0]); this.hemi.groundColor.set(th.hemi[1]); this.hemi.intensity = th.hemi[2];
      this.sun.color.set(th.sun[0]); this.sun.intensity = th.sun[1];
      const R = rnd(this.seed + a * 101 + 3), end = X3(L.end) + 40;
      const dirtM = new T.MeshStandardMaterial({ color: th.dirt, roughness: 0.95, map: TEX.dirt });
      const topM = mat(th.top, 0.85), topD = mat(th.topD, 0.85);
      const H0 = 5.5; // βάθος εδάφους προς τα κάτω
      // μπροστινή λωρίδα εδάφους (τα κομμάτια ανάμεσα στους λάκκους)
      let lips = 0; for (const s of L.segs) lips += Math.ceil(((s.x1 - s.x0) * K) / 0.55) + 1;
      const lipI = new Inst(g, [{ geo: G3.hemiL, mat: mat(th.top, 0.85), m: Lm(0, 0, 0, 1, 1, 1, -Math.PI / 2) }], lips, false);
      let li = 0;
      for (const s of L.segs) {
        const x0 = X3(s.x0), x1 = X3(s.x1), w = x1 - x0, d = FRONT - BACK;
        const geo = boxUV(w, H0, d, 2.4); geo.userData.own = true;
        const m = new T.Mesh(geo, dirtM); m.position.set((x0 + x1) / 2, -H0 / 2 - 0.22, (FRONT + BACK) / 2); m.receiveShadow = true; g.add(m);
        const tg = new T.BoxGeometry(w + 0.12, 0.3, d + 0.12); tg.userData.own = true;
        const t = new T.Mesh(tg, topM); t.position.set((x0 + x1) / 2, -0.15, (FRONT + BACK) / 2); t.receiveShadow = true; g.add(t);
        const n = Math.ceil(w / 0.55) + 1;
        for (let i = 0; i < n; i++) { const x = x0 + (i / (n - 1)) * w, sc = 0.16 + R() * 0.1; lipI.set(li++, x, -0.24, FRONT + 0.04, 0, sc, 0, 0, sc * 1.2); }
      }
      lipI.parts[0].im.material = topD;
      // πίσω λωρίδα (συνεχής) + βυθός λάκκων
      const bw = end + 60, bx = bw / 2 - 30;
      const bg = boxUV(bw, H0, 6, 2.4); bg.userData.own = true;
      const back = new T.Mesh(bg, dirtM); back.position.set(bx, -H0 / 2 - 0.5, BACK - 3.01); back.receiveShadow = true; g.add(back);
      const btg = new T.BoxGeometry(bw, 0.3, 6); btg.userData.own = true;
      const btop = new T.Mesh(btg, mat(th.back, 0.9)); btop.position.set(bx, -0.43, BACK - 3.01); btop.receiveShadow = true; g.add(btop);
      if (a === 1 || a === 2) {
        const lava = a === 2;
        const tex = lava ? TEX.lava : TEX.water; tex.repeat.set(lava ? 0.25 : 0.12, lava ? 0.25 : 0.12);
        const pm = lava ? new T.MeshBasicMaterial({ color: '#ffffff', map: tex }) : new T.MeshStandardMaterial({ color: '#2f9fe8', map: tex, roughness: 0.25, transparent: true, opacity: 0.9 });
        const pg = new T.PlaneGeometry(bw + 200, lava ? 30 : 420); pg.userData.own = true;
        const pl = new T.Mesh(pg, pm); pl.rotation.x = -Math.PI / 2; pl.position.set(bx, Y3(GY + 12), lava ? -6 : -200); pl.receiveShadow = !lava; g.add(pl);
        this.pitTex = tex;
        if (lava) { const gl = new T.Mesh(pg, basic('#ff7a20', { add: true, map: TEX.glow, op: 0.5 })); gl.rotation.x = -Math.PI / 2; gl.position.set(bx, Y3(GY + 12) + 0.6, -6); g.add(gl); }
      } else {
        this.pitTex = null;
        const pg = new T.PlaneGeometry(bw, 12); pg.userData.own = true;
        const pl = new T.Mesh(pg, mat('#24140a', 1)); pl.rotation.x = -Math.PI / 2; pl.position.set(bx, -2.6, 0); g.add(pl);
      }
      // πλατφόρμες
      for (const q of L.plats) {
        const x0 = X3(q.x0), x1 = X3(q.x1), w = x1 - x0, y = Y3(q.y);
        const pg = boxUV(w, 0.62, 1.5, 1.2); pg.userData.own = true;
        const m = new T.Mesh(pg, a === 1 ? new T.MeshStandardMaterial({ color: th.platSide, roughness: 0.8, map: TEX.wood }) : dirtM);
        m.position.set((x0 + x1) / 2, y - 0.36, 0); m.castShadow = true; m.receiveShadow = true; g.add(m);
        const tg = new T.BoxGeometry(w + 0.1, 0.18, 1.62); tg.userData.own = true;
        const t = new T.Mesh(tg, mat(th.plat, 0.8)); t.position.set((x0 + x1) / 2, y - 0.08, 0); t.castShadow = true; t.receiveShadow = true; g.add(t);
        if (a === 0) for (let k = x0 + 0.3; k < x1 - 0.2; k += 0.5 + R() * 0.3) { const l = Math.min(0.3 + R() * 0.8, y - 1.3); if (l < 0.15) continue; mk(G3.cylL, mat('#2f8a24', 0.8), 0.03, l, 0.03, k, y - 0.6 - l / 2, 0.76, g, false); mk(G3.sphM, mat('#4fc23a', 0.8), 0.09, 0.05, 0.07, k, y - 0.6 - l, 0.76, g, false); }
      }
      this.buildBack(a, end, R);
      this.buildDeco(a, R);
      // στατικά εμπόδια
      for (const o of L.rocks) {
        const r = new T.Group(); r.position.set(X3(o.x), 0, 0); g.add(r);
        const c = a === 2 ? '#5a4a48' : a === 1 ? '#d8c09a' : '#a8a296';
        mk(G3.ico, mat(c, 0.9, { flat: true }), 0.6, 0.5, 0.55, 0, 0.32, 0, r).rotation.y = R() * 3;
        mk(G3.ico0, mat(mixHex(c, '#000000', 0.15), 0.9, { flat: true }), 0.28, 0.24, 0.3, 0.42, 0.14, 0.2, r);
        if (a === 0) mk(G3.sph, mat('#5ab43a', 0.9), 0.3, 0.08, 0.25, 0.1, 0.72, 0, r, false);
      }
      this.fires = L.fires.map((o) => {
        const f = new T.Group(); f.position.set(X3(o.x), 0, 0); g.add(f);
        for (const s of [-1, 1]) { const l = mk(G3.cyl, mat('#6a3a18', 0.9), 0.08, 0.75, 0.08, 0, 0.08, 0, f); l.rotation.z = Math.PI / 2; l.rotation.y = s * 0.6; }
        for (let i = 0; i < 6; i++) { const a2 = (i / 6) * TAU; mk(G3.ico0, mat('#7a7068', 0.9, { flat: true }), 0.1, 0.08, 0.1, Math.cos(a2) * 0.42, 0.05, Math.sin(a2) * 0.32, f); }
        const fl = [['#ff5a10', 0.34, 0.9], ['#ffa020', 0.24, 0.7], ['#fff080', 0.13, 0.45]].map(([c, r, h], j) => mk(G3.cone, basic(c), r, h, r, 0, 0.12 + h / 2, j * 0.02, f, false));
        const gl = glowPlane('#ff7020', 2.6, f, 0, 0.5, 0.3);
        return { o, f, fl, gl };
      });
      // στόχος
      if (L.goal) {
        const gg = (this.goal = new T.Group()); gg.position.set(X3(L.goal), 0, -0.3); g.add(gg);
        mk(G3.cyl, mat('#b07840', 0.7), 0.08, 5, 0.08, 0, 2.5, 0, gg);
        mk(G3.sphM, mat('#ffd040', 0.4), 0.16, 0.16, 0.16, 0, 5.05, 0, gg);
        mk(G3.cyl, mat('#8a8078', 0.9), 0.5, 0.3, 0.5, 0, 0.15, 0, gg);
        this.flag = new T.Group(); this.flag.position.set(0.08, 4.5, 0); gg.add(this.flag);
        mk(G3.box, new T.MeshStandardMaterial({ map: TEX.flag, roughness: 0.7, side: T.DoubleSide }), 1.8, 1.1, 0.03, 0.9, -0.1, 0, this.flag);
      } else this.goal = null;
      // φρούτα (instanced ανά είδος)
      const kinds = ['banana', 'apple', 'cherry', 'grapes', 'pine', 'melon'];
      this.fruitI = {};
      const idx = {};
      for (const k of kinds) idx[k] = 0;
      for (const f of L.fruits) f.i3 = idx[f.k]++;
      for (const k of kinds) this.fruitI[k] = new Inst(g, this.fruitParts(k), idx[k] + 2, true);
      // συγχρονίζονται κάθε καρέ
      this.camX3 = null;
    }

    fruitParts(k) {
      const P = (geo, c, m, o) => ({ geo, mat: o === 'map' ? new T.MeshStandardMaterial({ map: TEX.melon, roughness: 0.4 }) : mat(c, 0.35, o || {}), m });
      const stem = (x, y, l = 0.12, rz = 0) => P(G3.cylL, '#6a4a1c', Lm(x, y, 0, 0.02, l, 0.02, 0, 0, rz));
      const leaf = (x, y, rz = -0.6) => P(G3.sphM, '#4fc23a', Lm(x, y, 0, 0.11, 0.035, 0.07, 0, 0, rz));
      if (k === 'apple') return [P(G3.sphM, '#e8282c', Lm(0, 0, 0, 0.3, 0.28, 0.3)), stem(0, 0.3), leaf(0.09, 0.33)];
      if (k === 'banana') return [P(G3.ban, '#ffd92e', Lm(0, 0.1, 0.07, 1, 1, 1, 0, 0, -2.75)), P(G3.ban, '#f2c418', Lm(0.03, 0.06, -0.07, 1, 1, 1, 0, 0, -2.6)), P(G3.cylL, '#6a4a1c', Lm(-0.22, 0.2, 0, 0.03, 0.08, 0.03, 0, 0, 0.6))];
      if (k === 'cherry') return [P(G3.sphM, '#d8102a', Lm(-0.11, -0.06, 0, 0.15, 0.15, 0.15)), P(G3.sphM, '#c80a24', Lm(0.11, -0.1, 0.03, 0.15, 0.15, 0.15)), stem(-0.05, 0.14, 0.34, -0.35), stem(0.06, 0.12, 0.36, 0.3), leaf(0.1, 0.3)];
      if (k === 'grapes') {
        const out = [stem(0, 0.3), leaf(0.1, 0.32)];
        [[-0.1, 0.18], [0.1, 0.18], [0, 0.2], [-0.05, 0.03], [0.07, 0.03], [-0.15, 0.06], [0.15, 0.06], [0, -0.12], [-0.08, -0.1], [0.08, -0.1], [0, -0.25]].forEach(([x, y], i) => out.push(P(G3.sphL, i % 2 ? '#8a38cc' : '#a050e0', Lm(x, y, (i % 3 - 1) * 0.05, 0.1, 0.1, 0.1))));
        return out;
      }
      if (k === 'pine') return [P(G3.sphM, '#f0b020', Lm(0, -0.05, 0, 0.24, 0.32, 0.24), { flat: true }), P(G3.cone6, '#3faa30', Lm(0, 0.38, 0, 0.1, 0.32, 0.1)), P(G3.cone6, '#5ad040', Lm(-0.08, 0.34, 0, 0.08, 0.26, 0.08, 0, 0, 0.5)), P(G3.cone6, '#5ad040', Lm(0.08, 0.34, 0, 0.08, 0.26, 0.08, 0, 0, -0.5))];
      return [P(G3.sphM, '', Lm(0, 0, 0, 0.38, 0.29, 0.29, 0, 0, Math.PI / 2), 'map'), stem(0.3, 0.12, 0.08, -1.2)];
    }

    buildBack(a, end, R) {
      const g = this.lvl;
      if (a === 0) {
        // δέντρα της ζούγκλας, θάμνοι και λόφοι
        const nT = Math.ceil(end / 3.2) + 10;
        const trees = new Inst(g, [
          { geo: G3.cylL, mat: mat('#7a4a24', 0.9), m: Lm(0, 2.4, 0, 0.32, 4.8, 0.32) },
          { geo: G3.ico, mat: mat('#ffffff', 0.85, { flat: true }), m: Lm(0, 5.4, 0, 2.1, 1.7, 2.1), tint: true },
          { geo: G3.ico, mat: mat('#ffffff', 0.85, { flat: true }), m: Lm(-1.2, 4.6, 0.4, 1.4, 1.2, 1.4), tint: true },
          { geo: G3.ico, mat: mat('#ffffff', 0.85, { flat: true }), m: Lm(1.3, 4.8, -0.3, 1.5, 1.25, 1.5), tint: true },
        ], nT, true);
        for (let i = 0; i < nT; i++) {
          const x = -15 + i * 3.2 + R() * 2.2, z = -10 - R() * 18, s = 0.7 + R() * 0.7;
          trees.set(i, x, -0.4, z, R() * 6, s); trees.color(i, ['#3aa83a', '#2f9a34', '#4fbf3a', '#27843a', '#5ac848'][(R() * 5) | 0]);
        }
        const nB = Math.ceil(end / 1.4) + 10;
        const bush = new Inst(g, [{ geo: G3.ico, mat: mat('#ffffff', 0.85, { flat: true }), m: Lm(0, 0, 0, 1, 0.8, 1), tint: true }], nB, false);
        for (let i = 0; i < nB; i++) { bush.set(i, -15 + i * 1.4 + R(), -0.3, BACK - 1.2 - R() * 1.6, R() * 6, 0.55 + R() * 0.6); bush.color(i, ['#46b03a', '#3a9a30', '#5ac040', '#2f8a2a'][(R() * 4) | 0]); }
        const nH = Math.ceil(end / 22) + 4;
        const hills = new Inst(g, [{ geo: G3.sph, mat: mat('#ffffff', 1), m: Lm(0, 0, 0, 1, 1, 1), tint: true }], nH, false);
        for (let i = 0; i < nH; i++) { hills.set(i, -30 + i * 22 + R() * 10, -8, -70 - R() * 30, 0, 18 + R() * 12, 0, 0, 14 + R() * 10); hills.color(i, ['#6cbf5a', '#5aae4a', '#7ccf6a'][(R() * 3) | 0]); }
        // λιάνες που κρέμονται από ψηλά στο βάθος
        const nV = Math.ceil(end / 5);
        const vines = new Inst(g, [{ geo: G3.cylL, mat: mat('#2f7a24', 0.9), m: Lm(0, 0, 0, 0.05, 1, 0.05) }, { geo: G3.sphM, mat: mat('#4fbf3a', 0.9), m: Lm(0, -0.5, 0, 0.2, 0.1, 0.14) }], nV, false);
        for (let i = 0; i < nV; i++) { const l = 2 + R() * 4; vines.set(i, i * 5 + R() * 3, 17 - l / 2, -9 - R() * 8, 0, 1, 0, 0, l); }
      } else if (a === 1) {
        // φοίνικες, θάλασσα και νησάκια
        const top = 4.4;
        const parts = [];
        for (let i = 0; i < 6; i++) parts.push({ geo: G3.cylL, mat: mat(i % 2 ? '#a8743a' : '#c08848', 0.9), m: Lm(Math.pow(i / 6, 2) * 0.9, 0.4 + i * 0.75, 0, 0.22 - i * 0.015, 0.8, 0.22 - i * 0.015, 0, 0, -0.08 - i * 0.05) });
        for (let i = 0; i < 7; i++) {
          const ay = (i / 7) * TAU;
          parts.push({ geo: G3.sphL, mat: mat('#ffffff', 0.8), m: chain(Tm(0.9, top, 0), Ry(ay), Rz(-0.35), Tm(1.0, 0, 0), Sm(1.15, 0.05, 0.28)), tint: true });
        }
        for (let i = 0; i < 3; i++) parts.push({ geo: G3.sphL, mat: mat('#6a4020', 0.6), m: Lm(0.9 + Math.cos(i * 2.1) * 0.18, top - 0.2, Math.sin(i * 2.1) * 0.18, 0.15, 0.15, 0.15) });
        const nP = Math.ceil(end / 6) + 6;
        const palms = new Inst(g, parts, nP, true);
        for (let i = 0; i < nP; i++) { const z = BACK - 1.5 - R() * 2.5; palms.set(i, -10 + i * 6 + R() * 3, -0.4, z, R() < 0.5 ? 0.3 : Math.PI - 0.3, 0.8 + R() * 0.45); palms.color(i, ['#3aaa3a', '#4ac040', '#2f9a34'][(R() * 3) | 0]); }
        const nS = Math.ceil(end / 2);
        const shells = new Inst(g, [{ geo: G3.hemiL, mat: mat('#ffffff', 0.5), m: Lm(0, 0, 0, 1, 0.6, 1), tint: true }], nS, false);
        for (let i = 0; i < nS; i++) { shells.set(i, i * 2 + R() * 2, -0.3, BACK - 0.5 - R() * 5, R() * 6, 0.1 + R() * 0.08); shells.color(i, ['#ffe6f0', '#ffd0a0', '#fff6e0'][(R() * 3) | 0]); }
        const nI = Math.ceil(end / 45) + 2;
        const isl = new Inst(g, [{ geo: G3.hemi, mat: mat('#f2d48a', 1), m: Lm(0, 0, 0, 1, 0.35, 1) }, { geo: G3.ico, mat: mat('#3a9a40', 1, { flat: true }), m: Lm(0, 0.35, 0, 0.55, 0.3, 0.55) }], nI, false);
        for (let i = 0; i < nI; i++) isl.set(i, -20 + i * 45 + R() * 20, -0.7, -120 - R() * 60, 0, 6 + R() * 5);
        const nW = Math.ceil(end / 8);
        const waves = new Inst(g, [{ geo: G3.sphL, mat: mat('#ffffff', 0.3), m: Lm(0, 0, 0, 1.2, 0.06, 0.12) }], nW, false);
        for (let i = 0; i < nW; i++) waves.set(i, i * 8 + R() * 5, -0.58, -10 - R() * 40, 0, 1 + R() * 1.5);
      } else {
        // ηφαίστειο, βραχώδεις κορυφές και καπνός
        const nR = Math.ceil(end / 2.4) + 8;
        const rocks = new Inst(g, [{ geo: G3.cone6, mat: mat('#ffffff', 0.95, { flat: true }), m: Lm(0, 0.5, 0, 1, 1, 1), tint: true }], nR, true);
        for (let i = 0; i < nR; i++) { const h = 1.4 + R() * 3.2; rocks.set(i, -15 + i * 2.4 + R() * 1.5, -0.6, -8 - R() * 16, R() * 3, 0.6 + R() * 0.7, 0, 0, h); rocks.color(i, ['#6a5450', '#5a4644', '#7a605a'][(R() * 3) | 0]); }
        const nV = Math.max(2, Math.ceil(end / 90));
        this.volc = [];
        for (let i = 0; i < nV; i++) {
          const vx = 30 + i * 90 + R() * 20, v = new T.Group(); v.position.set(vx, -6, -230 - R() * 40); g.add(v);
          mk(G3.cone, mat('#5a3a36', 1, { flat: true }), 60, 50, 60, 0, 25, 0, v, false);
          mk(G3.cyl, basic('#ff7a20'), 7.6, 1.2, 7.6, 0, 44, 0, v, false);
          glowPlane('#ff5010', 50, v, 0, 46, 4);
          this.volc.push(v);
        }
        const nC = Math.ceil(end / 3);
        const cry = new Inst(g, [{ geo: G3.cone6, mat: mat('#7ad0ff', 0.3, { em: '#3aa0ff', ei: 0.8 }), m: Lm(0, 0.3, 0, 0.12, 0.6, 0.12) }, { geo: G3.cone6, mat: mat('#9ae0ff', 0.3, { em: '#3aa0ff', ei: 0.8 }), m: Lm(0.12, 0.2, 0.05, 0.08, 0.4, 0.08, 0, 0, -0.4) }], nC, false);
        for (let i = 0; i < nC; i++) cry.set(i, i * 3 + R() * 2, -0.3, BACK - 0.6 - R() * 4.5, R() * 6, 0.8 + R() * 0.8);
      }
    }

    buildDeco(a, R) {
      const g = this.lvl, L = this.L;
      // λουλούδια / κοχύλια / κρύσταλλοι στο έδαφος (από τη λίστα deco) + χορτάρι στη μπροστινή άκρη
      for (const d of L.deco) {
        const o = new T.Group(); o.position.set(X3(d.x), 0, 0.6 + R() * 0.6); g.add(o);
        if (a === 0) {
          if (d.k === 0) for (const [x, c] of [[0, '#ff7ab8'], [0.35, '#fff36a'], [-0.3, '#8ad0ff']]) { mk(G3.cylL, mat('#3a9a2a', 0.8), 0.02, 0.4, 0.02, x, 0.2, 0, o, false); for (let i = 0; i < 5; i++) { const a2 = (i / 5) * TAU; mk(G3.sphL, mat(c, 0.6), 0.07, 0.07, 0.03, x + Math.cos(a2) * 0.08, 0.42 + Math.sin(a2) * 0.08, 0, o, false); } mk(G3.sphL, mat('#ffd040', 0.6), 0.05, 0.05, 0.05, x, 0.42, 0.02, o, false); }
          else if (d.k === 1) { mk(G3.cyl, mat('#fff4e0', 0.7), 0.1, 0.3, 0.1, 0, 0.15, 0, o); mk(G3.hemi, mat('#e8302a', 0.5), 0.32, 0.24, 0.32, 0, 0.28, 0, o); for (let i = 0; i < 5; i++) mk(G3.sphL, mat('#ffffff', 0.6), 0.05, 0.03, 0.05, Math.cos(i * 1.3) * 0.18, 0.46, Math.sin(i * 1.3) * 0.18, o, false); }
          else for (let i = -3; i <= 3; i++) { const c = mk(G3.cone6, mat('#3fa82a', 0.8), 0.05, 0.4 + Math.random() * 0.2, 0.05, i * 0.07, 0.2, 0, o, false); c.rotation.z = -i * 0.15; }
        } else if (a === 1) {
          if (d.k === 0) for (let i = 0; i < 5; i++) { const c = mk(G3.cone6, mat('#ff8a4a', 0.6), 0.08, 0.24, 0.05, Math.sin((i / 5) * TAU) * 0.1, 0.06, Math.cos((i / 5) * TAU) * 0.1, o, false); c.rotation.x = Math.PI / 2; c.rotation.z = -(i / 5) * TAU; c.rotation.order = 'ZXY'; }
          else { mk(G3.hemi, mat('#ffe6f0', 0.5), 0.2, 0.14, 0.2, 0, 0, 0, o, false); }
        } else { mk(G3.cone6, mat('#7ad0ff', 0.3, { em: '#3aa0ff', ei: 0.9 }), 0.1, 0.5, 0.1, 0, 0.25, 0, o, false); mk(G3.cone6, mat('#7ad0ff', 0.3, { em: '#3aa0ff', ei: 0.9 }), 0.07, 0.35, 0.07, 0.12, 0.15, 0, o, false).rotation.z = -0.4; glowPlane('#3aa0ff', 1.2, o, 0, 0.3, 0.2); }
      }
      if (a === 0) {
        let n = 0; for (const s of L.segs) n += Math.ceil(((s.x1 - s.x0) * K) / 1.1);
        const tuft = new Inst(g, [{ geo: G3.cone6, mat: mat('#3fa82a', 0.8), m: Lm(0, 0.15, 0, 0.05, 0.3, 0.05, 0, 0, 0.2) }, { geo: G3.cone6, mat: mat('#56c63a', 0.8), m: Lm(0.06, 0.18, 0.02, 0.05, 0.36, 0.05) }, { geo: G3.cone6, mat: mat('#3fa82a', 0.8), m: Lm(-0.06, 0.13, -0.02, 0.05, 0.26, 0.05, 0, 0, 0.35) }], n, false);
        let i = 0;
        for (const s of L.segs) { const m = Math.ceil(((s.x1 - s.x0) * K) / 1.1); for (let k = 0; k < m; k++) tuft.set(i++, X3(s.x0) + 0.3 + R() * ((s.x1 - s.x0) * K - 0.6), 0, 0.9 + R() * 0.7, R() * 3, 0.8 + R() * 0.6); }
      }
    }

    // ---------- απόδοση ----------
    perf(dt) {
      this.fa = (this.fa || dt) * 0.95 + dt * 0.05;
      this.fq = (this.fq || 0) + dt;
      if (this.fq > 3 && this.fa > 0.028 && this.q > 0.55) {
        this.fq = 0; this.q -= 0.15;
        this.GL.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.25) * this.q); this.resize();
        if (this.q < 0.75) this.GL.shadowMap.enabled = false;
      }
    }

    draw() {
      if (!this.L) return;
      if (!this.ok3()) { if (this.cv3) this.cv3.hidden = true; return super.draw(); }
      const fdt = (this.fdt = Math.min(0.05, Math.max(0, this.time - (this.t3 || this.time))));
      this.t3 = this.time;
      this.cv3.hidden = false;
      this.perf(fdt || 0.016);
      const x = this.ctx;
      x.save(); x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, this.c.width, this.c.height); x.restore();
      this.render3D();
      // κείμενα, ονόματα και HUD (το επίπεδο z=0 ταυτίζεται με τις συντεταγμένες του 2D)
      this.screen();
      for (const f of this.floats) {
        x.globalAlpha = f.t > 1 ? Math.max(0, 1 - (f.t - 1) / 0.4) : 1;
        this.text(f.txt, (f.x - this.camX) * this.s, f.y * this.s, this.vh * 3.2, f.col);
        x.globalAlpha = 1;
      }
      this.drawNames();
      this.drawHud();
      if (this.phase === 'count') this.drawCount(this.countT, 'ΠΑΜΕ!');
    }

    drawNames() {
      const x = this.ctx, vh = this.vh;
      this.parts.forEach((p, idx) => {
        if (p.dead > 0 || p.gone || !this.active(p)) return;
        const close = this.parts.filter((q, j) => j < idx && !q.dead && !q.gone && Math.abs(q.x - p.x) < 24 && Math.abs(q.y - p.y) < 20).length;
        const X = (p.x - this.camX) * this.s, Y = (p.y - (p.skate ? 4.2 : 0) - 34 - close * 6.5) * this.s;
        let nm = p.name; if (nm.length > 10) nm = nm.slice(0, 9) + '…';
        x.font = this.font(vh * 2.3); x.textAlign = 'center'; x.textBaseline = 'middle';
        const w = x.measureText(nm).width + vh * 1.6;
        U.rr(x, X - w / 2, Y - vh * 1.6, w, vh * 3.2, vh * 1.6); x.fillStyle = 'rgba(20,12,6,.6)'; x.fill();
        x.lineWidth = vh * 0.25; x.strokeStyle = p.color.hex; x.stroke();
        x.fillStyle = '#fff'; x.fillText(nm, X, Y + vh * 0.1);
      });
    }

    sync(tag, list, make) {
      const live = this.live[tag] || (this.live[tag] = new Map());
      const seen = new Set();
      for (const o of list) {
        seen.add(o);
        if (!live.has(o)) { const m = make(o); if (!m) continue; this.lvl.add(m.root || m); live.set(o, m); }
      }
      for (const [o, m] of live) if (!seen.has(o)) { this.lvl.remove(m.root || m); live.delete(o); }
      return live;
    }

    render3D() {
      const t = this.time, cam = this.cam, L = this.L, fdt = this.fdt;
      const W = this.W, H = this.H;
      // κάμερα: το επίπεδο z=0 δείχνει ακριβώς [camX, camX+VW] × [0, LH]
      const pxU = H / UNITS_H, dy = LIFT * pxU;
      cam.fov = (2 * Math.atan((UNITS_H + 2 * LIFT) / 2 / DIST) * 180) / Math.PI;
      cam.aspect = W / (H + 2 * dy);
      cam.setViewOffset(W, H + 2 * dy, 0, 2 * dy, W, H);
      const k = this.shake > 0 ? this.shake * 4 * K : 0;
      const cx = X3(this.camX + this.VW / 2) + (k ? U.rand(-k, k) : 0), cy = Y3(LH / 2) + (k ? U.rand(-k, k) : 0);
      cam.position.set(cx, cy + LIFT, DIST);
      cam.rotation.set(0, 0, 0);
      cam.updateProjectionMatrix();
      this.sky.position.copy(cam.position);
      this.sun.position.set(cx - 10, 22, 18); this.sun.target.position.set(cx + 2, 0, 0);
      const c0 = this.camX - 60, c1 = this.camX + this.VW + 60;
      const inView = (x) => x > c0 && x < c1;
      if (this.pitTex) { this.pitTex.offset.x = t * (this.area === 3 ? 0.01 : 0.02); this.pitTex.offset.y = Math.sin(t * 0.5) * 0.03; }
      // φρούτα
      for (const f of L.fruits) {
        const I = this.fruitI[f.k];
        if (f.got || !inView(f.x)) { if (!f.hid) { I.hide(f.i3); f.hid = true; } continue; }
        f.hid = false;
        I.set(f.i3, X3(f.x), Y3(f.y) + Math.sin(t * 3 + f.t) * 0.07, 0, Math.sin(t * 1.5 + f.t) * 0.6, 1.25);
      }
      // φωτιές
      for (const F of this.fires) {
        if (!inView(F.o.x)) continue;
        F.fl.forEach((m, i) => { const s = 1 + Math.sin(t * (13 + i * 5) + F.o.t + i) * 0.15; m.scale.y = [0.9, 0.7, 0.45][i] * s; m.position.y = 0.12 + m.scale.y / 2; m.rotation.z = Math.sin(t * 7 + i * 2) * 0.12; });
        F.gl.scale.setScalar(2.4 + Math.sin(t * 11 + F.o.t) * 0.3);
      }
      if (this.flag) { this.flag.rotation.y = Math.sin(t * 3) * 0.25; this.flag.children[0].rotation.x = Math.sin(t * 5) * 0.05; }
      if (this.volc) this.volc.forEach((v, i) => { v.children[2].scale.setScalar(46 + Math.sin(t * 2 + i) * 6); });
      // αυγά (και τα δώρα που πετάγονται)
      const eggs = this.sync('egg', L.eggs.filter((e) => inView(e.x) && (!e.broken || t - e.broken < 1.1)), (e) => {
        const root = new T.Group();
        const egg = mk(G3.sph, new T.MeshStandardMaterial({ map: e.k === 'cloud' ? TEX.eggBad : TEX.egg, roughness: 0.5 }), 0.36, 0.47, 0.36, 0, 0.47, 0, root);
        return { root, egg, item: null };
      });
      for (const [e, M] of eggs) {
        M.root.position.set(X3(e.x), Y3(e.y), 0.1);
        if (!e.broken) { M.egg.visible = true; M.root.rotation.z = Math.sin(t * 4 + e.x) * 0.08; continue; }
        M.egg.visible = false; M.root.rotation.z = 0;
        if (!M.item) { M.item = makeItem(e.k); M.root.add(M.item); }
        const q = t - e.broken;
        M.item.position.set(0, 0.6 + q * 1.5, 0.2); M.item.rotation.y = q * 6; M.item.scale.setScalar((e.k === 'axe' ? 1.5 : 1.2) * Math.min(1, q * 5) * (q > 0.75 ? Math.max(0.01, 1 - (q - 0.75) / 0.35) : 1));
      }
      // εχθροί
      const foes = this.sync('foe', L.foes.filter((e) => e.alive && inView(e.x)), (e) => makeFoe(e.k));
      for (const [e, M] of foes) this.animFoe(e, M, t);
      // πτώματα εχθρών και σπασμένα πατίνια (σωματίδια με μοντέλο)
      const spin = this.sync('spin', this.pfx.filter((q) => q.k === 'corpse' || q.k === 'board'), (q) => (q.k === 'board' ? makeBoard() : makeFoe(q.foe)));
      for (const [q, M] of spin) {
        const r = M.root || M;
        r.position.set(X3(q.x), Y3(q.y), 0.3); r.rotation.set(q.k === 'corpse' ? Math.PI : 0, q.dir > 0 ? 0 : Math.PI, -q.rot);
        r.scale.setScalar(Math.min(1, (q.life / q.max) * 2.5));
      }
      // αφεντικό
      if (this.boss) this.animBoss(this.boss, t);
      // τσεκούρια, βολές, κύματα
      const axes = this.sync('axe', this.axes, () => { const g = makeAxe(); g.scale.setScalar(1.4); return g; });
      for (const [a, m] of axes) { m.position.set(X3(a.x), Y3(a.y), 0.2); m.rotation.set(0, 0, -a.rot); }
      const shots = this.sync('shot', this.shots, () => { const g = new T.Group(); mk(G3.sphM, basic('#ffcf40'), 0.16, 0.16, 0.16, 0, 0, 0, g, false); mk(G3.ico0, basic('#ff6a10'), 0.26, 0.26, 0.26, 0, 0, -0.02, g, false); glowPlane('#ff6a10', 1.6, g, 0, 0, 0.2); return g; });
      for (const [s, m] of shots) { m.position.set(X3(s.x), Y3(s.y), 0.2); m.children[1].rotation.set(t * 5, t * 7, 0); }
      const waves = this.sync('wave', this.waves, () => { const g = new T.Group(); for (let i = -1; i <= 1; i++) mk(G3.cone6, mat('#6a4a3a', 0.9, { flat: true }), 0.14, 0.5, 0.14, i * 0.26, 0.2, 0, g); glowPlane('#ff8030', 2, g, 0, 0.3, 0.4); return g; });
      for (const [w, m] of waves) { m.position.set(X3(w.x), 0, 0.2); m.children.forEach((c, i) => { if (i < 3) c.scale.y = 0.4 + Math.abs(Math.sin(t * 20 + i)) * 0.4; }); }
      // παίκτες
      for (const p of this.parts) this.animKid(p, t);
      // σωματίδια
      this.renderFx();
      this.GL.render(this.scene, cam);
      void fdt;
    }

    animFoe(e, M, t) {
      const r = M.root;
      r.position.set(X3(e.x), Y3(e.y), 0);
      const d = e.dir || -1;
      r.rotation.y = d > 0 ? -0.35 : Math.PI + 0.35;
      if (e.k === 'snail') { M.foot.scale.x = 0.55 + Math.sin(e.t * 4) * 0.05; }
      else if (e.k === 'frog') { const air = e.y < GY - 0.5; M.legs.forEach((l) => { l.scale.x = air ? 0.32 : 0.2; l.position.x = air ? -0.32 : -0.2; }); M.body.scale.y = air ? 1.1 : 1 + Math.sin(t * 5 + e.home) * 0.04; }
      else if (e.k === 'bee') M.wings.forEach((w, i) => { w.rotation.x = Math.sin(t * 40) * 0.6 * (i ? 1 : -1); });
      else if (e.k === 'crab') { M.legs.forEach((l, i) => { l.rotation.z = Math.sin(t * 16 + i) * 0.3; }); M.claws.forEach((c, i) => { c.rotation.z = Math.sin(t * 6 + i * 2) * 0.3; }); }
      else if (e.k === 'snake') { M.head.rotation.z = (e.spit > 0 ? 0.4 : 0) + Math.sin(t * 3) * 0.1; M.head.position.x = 0.2 + Math.sin(t * 2.4) * 0.06; M.tongue.visible = Math.sin(t * 9) > 0.2 || e.spit > 0; M.body.scale.y = 1 + Math.sin(t * 3) * 0.03; }
      else if (e.k === 'boulder') { M.rock.rotation.z = -(e.rot || 0); r.rotation.y = 0; }
    }

    animBoss(b, t) {
      let M = this.bossM;
      if (!M || M.b !== b) { if (M) this.lvl.remove(M.root); M = this.bossM = makeBoss(); M.b = b; this.lvl.add(M.root); }
      const r = M.root;
      r.position.set(X3(b.x), Y3(b.y), -1.3);
      r.rotation.y = -b.face * 0.3;
      const sq = b.st === 'idle' ? 1 + Math.sin(t * 6) * 0.02 : b.st === 'air' ? 1.06 : 1;
      M.body.scale.set(1 / sq, sq, 1 / sq);
      M.woodM.emissive.set('#ffffff'); M.woodM.emissiveIntensity = b.flash * 0.7;
      const mo = 1 + b.mouth * 1.4 + (b.st === 'die' ? 1.2 : 0);
      M.mouth.scale.y = mo; M.fire.material.color.set(b.mouth > 0.1 ? '#ffb030' : '#ff5a10');
      M.eyes.forEach((e, i) => { e.gl.scale.setScalar(1.3 + Math.sin(t * 8 + i) * 0.25 + (b.st === 'spit' ? 0.5 : 0)); });
      M.brows.forEach((br, i) => { br.rotation.z = (i ? 1 : -1) * (b.st === 'spit' || b.flash > 0 ? 0.42 : 0.25); });
      M.crown.children.forEach((lf, i) => { lf.rotation.x = Math.sin(t * 3 + i) * 0.08; });
      if (b.st === 'die') { const k = Math.max(0.01, 1 - b.t / 2.4); r.scale.setScalar(k); r.rotation.z = Math.sin(t * 30) * 0.05; }
      else r.scale.setScalar(1);
    }

    animKid(p, t) {
      const M = this.kidFor(p);
      const show = !p.gone && (this.active(p) || p.dead > 0);
      const blink = p.inv > 0 && !p.dead && Math.floor(t * 14) % 2;
      M.root.visible = show && !blink;
      M.fairy.visible = M.aura.visible = show && p.fairy > 0 && !p.dead;
      M.cloud.visible = show && p.cloud > 0 && !p.dead;
      M.stars.visible = show && p.trip > 0;
      if (!show) return;
      const run = p.onG && Math.abs(p.vx) > 8 && !p.skate && p.trip <= 0;
      const sw = run ? Math.sin(p.ph) : 0, air = !p.onG && !p.dead;
      const lift = p.skate ? 4.2 : 0, bob = run ? Math.abs(Math.cos(p.ph)) * 1.1 : 0;
      const cheer = this.phase === 'clear' || this.phase === 'won';
      const f = p.face || 1;
      M.root.position.set(X3(p.x), Y3(p.y - lift - bob), 0);
      M.root.rotation.y = cheer && p.onG ? 0 : f > 0 ? -0.45 : Math.PI + 0.45;
      M.root.rotation.x = 0;
      M.pivot.rotation.z = p.dead > 0 ? p.rot : p.trip > 0 ? -0.45 : run ? -0.12 : 0;
      let lb = 0, lf = 0, ab = 0, af = 0;
      if (run) { lb = -sw * 0.9; lf = sw * 0.9; ab = sw * 0.9; af = -sw * 0.9; }
      else if (air) { lb = -0.6; lf = 0.9; ab = 2.3; af = 2.6; }
      else if (p.skate) { lb = -0.35; lf = 0.35; ab = -0.9; af = 1.2; }
      if (cheer && !p.dead) { ab = 2.8 + Math.sin(t * 10) * 0.2; af = 2.6 - Math.sin(t * 10) * 0.2; }
      if (p.throwT > 0.1) af = 2.8 - (0.28 - p.throwT) * 14;
      M.legs[0].rotation.z = lf; M.legs[1].rotation.z = lb;
      M.arms[0].rotation.z = af; M.arms[1].rotation.z = ab;
      M.axe.visible = p.axe && p.throwT <= 0.05 && !p.dead;
      M.board.visible = p.skate && !p.dead;
      M.board.position.y = (-lift + bob) * K / 1.18;
      M.board.rotation.y = 0;
      M.head.rotation.z = air ? 0.15 : run ? 0.08 : Math.sin(t * 2 + p.x) * 0.04;
      const open = air || cheer || p.trip > 0 || p.dead > 0;
      M.mouth.scale.set(open ? 0.05 : 0.025, open ? 0.06 : 0.025, open ? 0.06 : 0.07);
      M.eyes.forEach((e) => { e.scale.y = p.dead > 0 ? 0.015 : 0.085; });
      M.pupils.forEach((e) => { e.visible = !(p.dead > 0); });
      M.tails.forEach((tl, i) => { tl.rotation.z = 0.3 + Math.sin(t * 14 + p.x + i) * 0.25 + (run ? 0.3 : 0); tl.rotation.y = (i ? -1 : 1) * 0.3; });
      const hx = X3(p.x), hy = Y3(p.y - lift);
      if (M.fairy.visible) {
        const a = t * 4;
        M.fairy.position.set(hx + Math.cos(a) * 0.95, hy + 1.4 + Math.sin(a * 2) * 0.25, Math.sin(a) * 0.9);
        M.fairy.children.forEach((c, i) => { if (i > 1) c.rotation.x = Math.sin(t * 30) * 0.6 * (i % 2 ? 1 : -1); });
        M.aura.position.set(hx, hy + 0.9, -0.3); M.aura.scale.setScalar(2.6 + Math.sin(t * 6) * 0.25);
        if (Math.random() < 0.4) this.pfx.push({ k: 'spark', x: p.x + U.rand(-8, 8), y: p.y - U.rand(0, 24), vx: 0, vy: -10, g: 0, life: 0.5, max: 0.5, c: '#ffb0f0' });
      }
      if (M.cloud.visible) {
        M.cloud.position.set(hx, hy + 2.4 + Math.sin(t * 3) * 0.08, 0);
        M.cloud.userData.drops.forEach((d, i) => { const k = (t * 2.2 + i * 0.37) % 1; d.position.y = -0.25 - k * 1.3; d.visible = k < 0.9; });
      }
      if (M.stars.visible) M.stars.children.forEach((s, i) => { const a = t * 6 + i * 2.1; s.position.set(hx + Math.cos(a) * 0.4, hy + 1.75, Math.sin(a) * 0.4); s.rotation.set(t * 4, t * 3, 0); });
    }

    renderFx() {
      const pim = this.pim, gim = this.gim; let n = 0, m = 0;
      const dustC = this.area === 3 ? '#7a6a68' : this.area === 2 ? '#f2dca0' : '#e9d6b0';
      for (const q of this.pfx) {
        if (q.k === 'corpse' || q.k === 'board') continue;
        const k = q.life / q.max, x = X3(q.x), y = Y3(q.y);
        if (q.k === 'spark' || q.k === 'ember') {
          if (m >= 600) continue;
          const s = q.k === 'spark' ? 0.25 + k * 0.35 : 0.22;
          _q.identity(); _v.set(x, y, 0.6); _s.set(s, s, s); _m.compose(_v, _q, _s);
          gim.setMatrixAt(m, _m); _c.set(q.k === 'spark' ? q.c : k > 0.5 ? '#ffd060' : '#ff6a20'); gim.setColorAt(m, _c); m++;
          continue;
        }
        if (n >= 600) continue;
        let s = 0.08, c = '#ffffff', sy = 1;
        if (q.k === 'dust') { s = q.r * K * (1.6 - k * 0.6) * 0.9; c = dustC; }
        else if (q.k === 'smoke') { s = q.r * K * (1.6 - k * 0.6); c = '#f4f0ea'; }
        else if (q.k === 'leaf') { if (q.y > GY) { q.life = 0; continue; } s = 0.14; sy = 0.35; c = q.c; }
        else if (q.k === 'shell') { s = 0.12; sy = 0.6; c = q.bad ? '#ffd6d0' : '#f4efe6'; }
        s *= Math.min(1, k * 3);
        _e.set(q.rot || q.life * 3, q.life * 2, q.rot || 0); _q.setFromEuler(_e); _v.set(x, y, 0.5); _s.set(s, s * sy, s); _m.compose(_v, _q, _s);
        pim.setMatrixAt(n, _m); _c.set(c); pim.setColorAt(n, _c); n++;
      }
      pim.count = n; pim.instanceMatrix.needsUpdate = true; if (pim.instanceColor) pim.instanceColor.needsUpdate = true;
      gim.count = m; gim.instanceMatrix.needsUpdate = true; if (gim.instanceColor) gim.instanceColor.needsUpdate = true;
    }
  }

  Mini.games.jungle = Jungle3D;
})();
