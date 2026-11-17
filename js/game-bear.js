// «Νηστικό αρκούδι δεν χορεύει»: ένα αρκουδάκι πάνω σε σκηνή πανηγυριού.
// Όλοι οι παίκτες πετάνε ταυτόχρονα φαγητά από το κινητό (σύρσιμο προς τα πάνω) για να μπουν στο στόμα του.
// Όσο τρώει, γεμίζει η μπάρα «χορού» και το αρκουδάκι χορεύει: κουνιέται → χοροπηδά → ΠΑΡΤΙ με ντισκομπάλα.
// Αν πεινάσει ξανά, σταματά η μουσική. 60 δευτερόλεπτα· νικά όποιος τάισε τους περισσότερους πόντους.
(function () {
  'use strict';
  const { Base, U } = Mini;
  const FLY = 0.72;          // δευτ. πτήσης του φαγητού
  const GAP = 340;           // ms ανάμεσα σε δύο ρίψεις του ίδιου παίκτη
  const DUR = 60;            // διάρκεια παιχνιδιού
  const BPM = 124;
  const FUR = '#a8683a', FUR_L = '#d39a62', FUR_D = '#6e3f1f', MUZ = '#f3d3a6', PAD = '#e9a88f', INK = U.INK;

  // φαγητά: e = emoji (και για το κινητό), v = πόντοι
  const FOODS = [
    { id: 'souvlaki', e: '🍢', n: 'σουβλάκι', v: 1, w: 7 },
    { id: 'burger', e: '🍔', n: 'μπέργκερ', v: 1, w: 6 },
    { id: 'fries', e: '🍟', n: 'πατάτες', v: 1, w: 6 },
    { id: 'gyros', e: '🥙', n: 'πιτόγυρο', v: 1, w: 5 },
    { id: 'pizza', e: '🍕', n: 'πίτσα', v: 1, w: 4 },
    { id: 'hotdog', e: '🌭', n: 'χοτ ντογκ', v: 1, w: 3 },
    { id: 'apple', e: '🍎', n: 'μήλο', v: 1, w: 4 },
    { id: 'banana', e: '🍌', n: 'μπανάνα', v: 1, w: 4 },
    { id: 'melon', e: '🍉', n: 'καρπούζι', v: 1, w: 4 },
    { id: 'straw', e: '🍓', n: 'φράουλα', v: 1, w: 4 },
    { id: 'grapes', e: '🍇', n: 'σταφύλι', v: 1, w: 3 },
    { id: 'peach', e: '🍑', n: 'ροδάκινο', v: 1, w: 3 },
    { id: 'carrot', e: '🥕', n: 'καρότο', v: 1, w: 4 },
    { id: 'broc', e: '🥦', n: 'μπρόκολο', v: 1, w: 3 },
    { id: 'corn', e: '🌽', n: 'καλαμπόκι', v: 1, w: 3 },
    { id: 'tomato', e: '🍅', n: 'ντομάτα', v: 1, w: 3 },
    { id: 'cucumber', e: '🥒', n: 'αγγούρι', v: 1, w: 2 },
    { id: 'cheese', e: '🧀', n: 'τυρί', v: 1, w: 3 },
    { id: 'pretzel', e: '🥨', n: 'κουλούρι', v: 1, w: 2 },
    { id: 'donut', e: '🍩', n: 'ντόνατ', v: 1, w: 3 },
    { id: 'icecream', e: '🍦', n: 'παγωτό', v: 1, w: 3 },
    { id: 'cake', e: '🍰', n: 'γλυκό', v: 1, w: 2 },
    { id: 'fish', e: '🐟', n: 'ψαράκι', v: 2, w: 3, gold: true },
    { id: 'chili', e: '🌶️', n: 'καυτερή πιπεριά', v: 2, w: 2, hot: true },
    { id: 'honey', e: '🍯', n: 'μέλι', v: 3, w: 2, gold: true },
  ];
  const FOOD_W = FOODS.reduce((s, f) => s + f.w, 0);
  function randFood() { let r = Math.random() * FOOD_W; for (const f of FOODS) { if ((r -= f.w) < 0) return f; } return FOODS[0]; }

  const EAT_LINES = (f) => [`Μμμ! ${cap(f.n)}!`, `Νιαμ νιαμ, ${f.n}!`, 'Κι άλλο, κι άλλο!', 'Τέλειο!', 'Ωραίοοο!', 'Νόστιμο!'];
  const HUNGRY_LINES = ['Πεινάωωω!', 'Ταΐστε με!', 'Γουργουρίζει η κοιλιά μου…', 'Νηστικό αρκούδι δεν χορεύει!', 'Λίγο φαγάκι;'];
  const MISS_LINES = ['Στο στόμα, στο στόμα!', 'Εδώ είμαι!', 'Ωχ, έπεσε!', 'Πιο ψηλά!', 'Κρίμα…'];
  const LEVEL_LINES = ['', 'Ωπ, έρχεται ο ρυθμός!', 'Χορεύωωω!', 'ΠΑΡΤΙΙΙ!'];
  const LEVEL_NAMES = ['Πεινάει…', 'Κουνιέται', 'Χορεύει!', 'ΠΑΡΤΙ!'];
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const lerp = (a, b, t) => a + (b - a) * t;
  const ROT = (x, y, a) => { const c = Math.cos(a), s = Math.sin(a); return [x * c - y * s, x * s + y * c]; };

  // ---------- μουσική και ήχοι (δικό του AudioContext) ----------
  const SND = {
    ac: null, master: null, noise: null,
    init() {
      if (!this.ac) {
        try { this.ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; }
        this.master = this.ac.createGain(); this.master.gain.value = 0.32; this.master.connect(this.ac.destination);
        const len = this.ac.sampleRate * 0.5, b = this.ac.createBuffer(1, len, this.ac.sampleRate), d = b.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
        this.noise = b;
      }
      if (this.ac.state === 'suspended') this.ac.resume();
      return this.ac;
    },
    tone(t, f, dur, type, vol, f2) {
      const a = this.ac, o = a.createOscillator(), g = a.createGain();
      o.type = type || 'sine'; o.frequency.setValueAtTime(f, t);
      if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
      o.connect(g).connect(this.master); o.start(t); o.stop(t + dur + 0.03);
    },
    hit(t, dur, vol, freq, q, type) {
      const a = this.ac, s = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
      s.buffer = this.noise; f.type = type || 'highpass'; f.frequency.value = freq; f.Q.value = q || 0.8;
      g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
      s.connect(f).connect(g).connect(this.master); s.start(t, Math.random() * 0.3); s.stop(t + dur + 0.02);
    },
    chomp() {
      if (!this.init()) return; const t = this.ac.currentTime;
      this.hit(t, 0.07, 0.5, 900, 1.2, 'bandpass'); this.tone(t, 180, 0.12, 'square', 0.12, 90);
      this.hit(t + 0.13, 0.06, 0.4, 1200, 1.2, 'bandpass'); this.tone(t + 0.13, 210, 0.1, 'square', 0.1, 100);
    },
    burp() { if (!this.init()) return; const t = this.ac.currentTime; this.tone(t, 95, 0.55, 'sawtooth', 0.22, 60); this.tone(t, 140, 0.5, 'square', 0.06, 80); },
    yum() { if (!this.init()) return; const t = this.ac.currentTime; [660, 880, 1320].forEach((f, i) => this.tone(t + 0.2 + i * 0.07, f, 0.16, 'triangle', 0.1)); },
    whoosh() { if (!this.init()) return; const t = this.ac.currentTime; this.hit(t, 0.25, 0.18, 1800, 0.6, 'bandpass'); },
    thud() { if (!this.init()) return; const t = this.ac.currentTime; this.tone(t, 140, 0.18, 'sine', 0.3, 60); this.hit(t, 0.08, 0.15, 400, 0.8, 'lowpass'); },
    rumble() { if (!this.init()) return; const t = this.ac.currentTime; this.tone(t, 70, 0.5, 'sawtooth', 0.08, 55); this.tone(t + 0.3, 62, 0.5, 'sawtooth', 0.07, 50); },
    fire() { if (!this.init()) return; const t = this.ac.currentTime; this.hit(t, 0.9, 0.4, 500, 0.5, 'lowpass'); },
  };
  // μουσική σε 16 βήματα ανά μέτρο, σε ρε ελάσσονα με λίγη «πανηγυριώτικη» μελωδία
  const N = (m) => 440 * Math.pow(2, (m - 69) / 12);
  const BASS = [38, 38, 45, 38, 41, 41, 45, 41, 43, 43, 46, 43, 45, 45, 49, 45]; // ανά όγδοο, 2 μέτρα
  const MEL = [
    74, null, 74, 76, 77, null, 76, 74, 73, null, 74, 76, 74, null, null, null,
    77, null, 77, 79, 81, null, 79, 77, 76, null, 74, 73, 74, null, null, null,
    81, null, 79, 77, 79, null, 77, 76, 77, null, 76, 74, 73, null, 74, 76,
    77, 76, 74, null, 73, null, 70, null, 74, null, null, null, null, null, null, null,
  ];

  // ---------- εικόνες φαγητών (cache σε offscreen canvas) ----------
  const IMG = {};
  function foodImg(f) {
    if (IMG[f.id]) return IMG[f.id];
    const S = 128, c = document.createElement('canvas'); c.width = c.height = S;
    const x = c.getContext('2d');
    if (f.id === 'souvlaki') drawSouvlaki(x, S);
    else {
      x.font = `${S * 0.78}px "Noto Color Emoji","Apple Color Emoji","Segoe UI Emoji",sans-serif`;
      x.textAlign = 'center'; x.textBaseline = 'middle';
      x.fillText(f.e, S / 2, S * 0.55);
    }
    IMG[f.id] = c;
    return c;
  }
  // ελληνικό σουβλάκι: ξυλάκι με ψητά κομμάτια χοιρινό, πιπεριά και κρεμμύδι
  function drawSouvlaki(x, S) {
    x.save(); x.translate(S / 2, S / 2); x.rotate(-0.7);
    x.lineCap = 'round';
    x.strokeStyle = '#5a3a1a'; x.lineWidth = S * 0.075; x.beginPath(); x.moveTo(-S * 0.48, 0); x.lineTo(S * 0.48, 0); x.stroke();
    x.strokeStyle = '#e2bb7c'; x.lineWidth = S * 0.045; x.beginPath(); x.moveTo(-S * 0.47, 0); x.lineTo(S * 0.47, 0); x.stroke();
    const pcs = [['m', -0.3], ['p', -0.17], ['m', -0.05], ['o', 0.07], ['m', 0.19], ['m', 0.31]];
    for (const [k, px] of pcs) {
      const X = px * S, r = S * 0.1;
      if (k === 'm') {
        const g = x.createRadialGradient(X - r * 0.4, -r * 0.4, r * 0.1, X, 0, r * 1.3);
        g.addColorStop(0, '#d88a4a'); g.addColorStop(0.55, '#9a4f1f'); g.addColorStop(1, '#4e2208');
        x.fillStyle = g; U.rr(x, X - r, -r * 1.05, r * 2, r * 2.1, r * 0.55); x.fill();
        x.strokeStyle = '#2a1205'; x.lineWidth = S * 0.018; x.stroke();
        x.strokeStyle = 'rgba(40,15,0,.65)'; x.lineWidth = S * 0.02;
        for (const d of [-0.4, 0.25]) { x.beginPath(); x.moveTo(X - r * 0.8, d * r - r * 0.3); x.lineTo(X + r * 0.8, d * r + r * 0.2); x.stroke(); }
        x.fillStyle = 'rgba(255,220,160,.35)'; x.beginPath(); x.ellipse(X - r * 0.35, -r * 0.5, r * 0.35, r * 0.18, -0.4, 0, 7); x.fill();
      } else if (k === 'p') {
        x.fillStyle = '#2fa84a'; U.rr(x, X - r * 0.55, -r * 1.15, r * 1.1, r * 2.3, r * 0.4); x.fill();
        x.strokeStyle = '#14551f'; x.lineWidth = S * 0.016; x.stroke();
        x.fillStyle = 'rgba(255,255,255,.35)'; x.fillRect(X - r * 0.3, -r * 0.9, r * 0.18, r * 1.4);
      } else {
        x.fillStyle = '#f1e6f5'; U.rr(x, X - r * 0.5, -r * 1.1, r * 1.0, r * 2.2, r * 0.45); x.fill();
        x.strokeStyle = '#a77bb6'; x.lineWidth = S * 0.016; x.stroke();
        x.beginPath(); x.moveTo(X, -r); x.lineTo(X, r); x.stroke();
      }
    }
    // φετούλα λεμόνι στην άκρη
    x.restore();
    x.save(); x.translate(S * 0.8, S * 0.78);
    x.fillStyle = '#ffe14d'; x.beginPath(); x.arc(0, 0, S * 0.11, Math.PI, 0); x.closePath(); x.fill();
    x.strokeStyle = '#d6a800'; x.lineWidth = S * 0.018; x.stroke();
    x.strokeStyle = '#fff6b8'; x.lineWidth = S * 0.01;
    for (let i = 1; i < 5; i++) { const a = Math.PI + (i * Math.PI) / 5; x.beginPath(); x.moveTo(0, 0); x.lineTo(Math.cos(a) * S * 0.09, Math.sin(a) * S * 0.09); x.stroke(); }
    x.restore();
  }

  class BearGame extends Base {
    constructor(c, h) { super(c, h); this.WIN = 999; this.bg = null; }

    resize() { super.resize(); this.bg = null; }

    setup() {
      SND.init();
      this.foods = []; this.floor = []; this.pops = []; this.fxs = []; this.bubble = null;
      this.bear = {
        x: 0.5, tx: 0.5, v: 0.25, walk: 0, full: 0, level: 0, shown: 0, mouth: 0.8, chew: 0, chewN: 0,
        blink: 0, nextBlink: 2, wob: 0, spin: -1, hat: 0, hot: 0, rumbleT: 4, hungryT: 0, lean: 0, cheek: 0, bigT: 0,
      };
      this.disco = 0; this.beat = 0; this.music = { next: 0, step: 0, on: false };
      this.parts.forEach((p) => Object.assign(p, { lastT: 0, status: '', hi: false, botNext: U.rand(1.0, 1.8), shots: 0, eaten: 0, food: randFood(), flash: 0 }));
      this.phase = 'count';
      this.banner('Ταΐστε το αρκουδάκι!', '#ffb13d');
      this.say('Πεινάωωω! Ταΐστε με!', 3);
      this.countdown(() => { this.phase = 'go'; this.goT = this.time; this.changed(); });
      this.changed();
    }

    end() { super.end(); this.music.on = false; }

    // ---------- γεωμετρία ----------
    u() { return this.vh * 0.92; }
    feetY() { return this.H * 0.8; }
    stageY() { return this.H * 0.76; }
    bearX() { return this.W * 0.5 + (this.bear.x - 0.5) * Math.min(this.W * 0.62, this.vh * 125); }
    launchX(part) { const i = this.parts.indexOf(part), n = this.parts.length; return this.W * (i + 0.5) / n; }
    left() { return this.phase === 'go' ? Math.max(0, DUR - (this.time - this.goT)) : this.phase === 'count' ? DUR : 0; }

    // στάση του σώματος (υπολογίζεται μία φορά ανά καρέ)
    pose() {
      const b = this.bear, u = this.u(), t = this.time, ph = this.beat * Math.PI;
      const L = b.level, sn = Math.sin(ph), ab = Math.abs(sn);
      const P = { X: this.bearX(), F: this.feetY(), hop: 0, tilt: 0, head: 0, sq: 0, sx: 1, aL: 0.2, eL: 0.25, aR: 0.2, eR: 0.25, fL: 0, fR: 0, u };
      if (L === 0) {
        P.tilt = Math.sin(t * 1.4) * 0.03 + Math.sin(t * 31) * 0.02 * b.wob;
        P.head = 0.12 + Math.sin(t * 0.9) * 0.05;
        P.aL = 0.12; P.aR = 0.12; P.eL = 0.15; P.eR = 0.15;
      } else if (L === 1) {
        P.tilt = sn * 0.13; P.head = -sn * 0.1; P.hop = ab * u * 1.2;
        P.aR = 0.55 + sn * 0.35; P.aL = 0.55 - sn * 0.35; P.eL = P.eR = 0.7;
      } else if (L === 2) {
        P.hop = ab * u * 4.5; P.sq = 0.07 * Math.pow(1 - ab, 5);
        P.tilt = sn * 0.16; P.head = -sn * 0.12;
        const w = Math.sin(ph * 0.5);
        P.aR = 1.7 + w * 1.05; P.aL = 1.7 - w * 1.05; P.eR = 0.35 + ab * 0.5; P.eL = 0.35 + (1 - ab) * 0.5;
        P.fL = Math.max(0, sn) * u * 2.5; P.fR = Math.max(0, -sn) * u * 2.5;
      } else {
        P.hop = ab * u * 6; P.sq = 0.09 * Math.pow(1 - ab, 5);
        const side = Math.sin(ph * 0.25 * 2) > 0 ? 1 : -1, sm = U.clamp(Math.sin(ph * 0.5) * 3, -1, 1);
        P.tilt = sm * 0.2; P.head = sm * 0.15;
        // ένα χέρι δείχνει ψηλά, το άλλο στη μέση — αλλάζουν κάθε 2 χτύπους
        P.aR = lerp(0.95, 2.7, (sm + 1) / 2); P.eR = lerp(2.3, 0.05, (sm + 1) / 2);
        P.aL = lerp(2.7, 0.95, (sm + 1) / 2); P.eL = lerp(0.05, 2.3, (sm + 1) / 2);
        P.fL = Math.max(0, sn) * u * 3; P.fR = Math.max(0, -sn) * u * 3;
        if (b.spin >= 0) P.sx = Math.cos(b.spin * Math.PI * 2);
        void side;
      }
      // περπάτημα: τα πόδια ανεβοκατεβαίνουν
      if (b.walk && L < 2) { P.fL += Math.max(0, Math.sin(b.walk)) * u * 2; P.fR += Math.max(0, -Math.sin(b.walk)) * u * 2; P.hop += Math.abs(Math.sin(b.walk)) * u * 0.8; }
      // τσίμπημα πιπεριάς: τινάζεται
      if (b.hot > 0) { P.tilt += Math.sin(t * 40) * 0.05; P.hop += u * 2 * b.hot; }
      P.tilt += b.lean;
      return P;
    }
    // από το σύστημα του κεφαλιού στον κόσμο
    headToWorld(P, hx, hy) {
      const u = P.u;
      let [x, y] = ROT(hx, hy, P.head);
      y -= 9 * u;                   // κέντρο κεφαλιού πάνω από τον λαιμό
      y -= 21 * u;                  // λαιμός πάνω από τον γοφό
      [x, y] = ROT(x, y, P.tilt);
      y -= 14 * u;                  // γοφός πάνω από τα πόδια
      x *= P.sx * (1 + P.sq); y *= 1 - P.sq;
      return [P.X + x, P.F - P.hop + y];
    }
    mouthPos(P) { return this.headToWorld(P || this.pose(), 0, 4.8 * this.u()); }

    // ---------- είσοδος ----------
    input(part, msg, now) {
      if (msg.type !== 'toss' || this.phase !== 'go' || !part) return;
      if (now - part.lastT < GAP) return;
      part.lastT = now;
      this.toss(part, U.clamp(+msg.ax || 0, -1, 1), U.clamp(+msg.p || 0, 0, 1));
    }

    aimY(pw) { const F = this.feetY(), u = this.u(); return F + this.vh * 4 * (1 - pw) - pw * 74 * u; }

    toss(part, ax, pw) {
      const W = this.W, lx = this.launchX(part);
      const tx = W / 2 + ax * W * 0.42 + (lx - W / 2) * 0.45;
      const f = part.food || randFood();
      this.foods.push({ part, f, x0: lx, y0: this.H + this.vh * 6, tx, ty: this.aimY(pw), t: 0, rot: U.rand(-0.5, 0.5), spin: U.rand(-7, 7), x: lx, y: this.H });
      part.shots++;
      part.food = randFood();
      SND.whoosh();
      this.changed();
    }

    lead() { return Math.max(0, ...this.parts.map((p) => p.score)); }

    say(t, d = 1.8) { this.bubble = { t, until: this.time + d, t0: this.time }; }

    land(fd) {
      const P = this.pose(), u = P.u, [mx, my] = this.mouthPos(P), p = fd.part, b = this.bear;
      const d = Math.hypot(fd.tx - mx, fd.ty - my);
      if (d < u * 8.2 && this.phase === 'go') {
        // ΜΠΗΚΕ ΣΤΟ ΣΤΟΜΑ
        const f = fd.f, wasL = b.level;
        p.score += f.v; p.eaten++; p.flash = 1;
        b.full = Math.min(1, b.full + 0.13 + f.v * 0.05);
        b.chew = 0.9; b.chewN = 0; b.cheek = 1; b.hungryT = 0;
        SND.chomp(); if (f.v > 1) SND.yum();
        this.crumbs(mx, my, f);
        this.pops.push({ x: mx, y: my - u * 14, c: p.color.hex, t: 0, txt: `+${f.v}` });
        this.fx(p, `${f.e} Το έφαγε! +${f.v}`, [40], true);
        if (f.hot) { b.hot = 1; SND.fire(); this.say('ΚΑΙΕΙΙΙ! 🔥', 1.6); this.fxs.push({ k: 'fire', t: 0 }); }
        else if (f.id === 'honey') { this.say('ΜΕΛΑΚΙ! Το αγαπημένο μου!', 1.8); this.sparkle(mx, my, '#ffd23d', 26); }
        else if (Math.random() < 0.4) this.say(U.pick(EAT_LINES(f)), 1.3);
        const nl = this.levelOf(b.full);
        if (nl > wasL) this.levelUp(nl);
        this.changed();
      } else {
        // αστοχία: χτυπά στο σώμα ή πέφτει στη σκηνή
        const [hx, hy] = this.headToWorld(P, 0, 0);
        const onBody = Math.hypot(fd.tx - hx, fd.ty - hy) < u * 12 || (Math.abs(fd.tx - P.X) < u * 13 && fd.ty > hy && fd.ty < P.F);
        const fy = this.stageY() + U.rand(0, this.vh * 8);
        this.floor.push({ f: fd.f, x: fd.tx, y: fd.ty, vx: onBody ? Math.sign(fd.tx - P.X || 1) * this.vh * U.rand(18, 35) : U.rand(-1, 1) * this.vh * 6, vy: onBody ? -this.vh * 30 : 0, gy: Math.max(fy, Math.min(fd.ty, this.H * 0.95)), rot: fd.rot, spin: fd.spin, a: 1, life: 4.5, rest: false });
        if (this.floor.length > 24) this.floor.shift();
        SND.thud();
        if (onBody) { b.wob = 1; if (Math.random() < 0.5) this.say('Άουτς! Στο στόμα!', 1.2); }
        else if (Math.random() < 0.25) this.say(U.pick(MISS_LINES), 1.2);
      }
    }

    levelOf(f) { return f < 0.12 ? 0 : f < 0.45 ? 1 : f < 0.78 ? 2 : 3; }

    levelUp(nl) {
      const b = this.bear;
      if (nl === 3) { SND.burp(); this.banner('ΠΑΡΤΙ! 🪩', '#ff4fd8'); b.spin = 0; }
      else if (nl === 2) this.banner('Χορεύει! 💃', '#3ee08f');
      if (LEVEL_LINES[nl]) this.after(nl === 3 ? 0.6 : 0, () => this.say(LEVEL_LINES[nl], 1.6));
      this.sparkle(this.bearX(), this.feetY() - this.u() * 30, '#fff', 20);
    }

    crumbs(x, y, f) {
      const cols = f.id === 'melon' ? ['#ff4d5e', '#3aa64a', '#222'] : f.gold ? ['#ffd23d', '#fff1a8'] : ['#e8a64a', '#c46a2a', '#fff0c8', '#3aa64a'];
      for (let i = 0; i < 16; i++) this.fxs.push({ k: 'crumb', x, y, vx: U.rand(-1, 1) * this.vh * 30, vy: U.rand(-40, -10) * this.vh, t: 0, life: U.rand(0.5, 0.9), c: U.pick(cols), r: U.rand(0.4, 0.9) * this.vh });
    }
    sparkle(x, y, c, n) {
      for (let i = 0; i < n; i++) { const a = U.rand(0, 6.28), s = U.rand(10, 45) * this.vh; this.fxs.push({ k: 'spark', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, t: 0, life: U.rand(0.6, 1.1), c }); }
    }

    winText(w) { return `Τάισε το αρκουδάκι ${w.score} πόντους (${w.eaten} φαγητά)`; }

    finish(winner) {
      this.celebrate(winner.color.hex);
      this.sfx('win');
      const rank = [...this.parts].sort((a, b) => b.score - a.score || b.eaten - a.eaten || a.shots - b.shots);
      this.h.onOver && this.h.onOver({
        winner, stats: this.winText(winner),
        rank: rank.map((q) => ({ name: q.name, color: q.color, st: `${q.score} πόντοι · ${q.eaten}/${q.shots} στο στόμα` })),
      });
    }

    endGame() {
      this.phase = 'end'; this.over = true;
      const rank = [...this.parts].sort((a, b) => b.score - a.score || b.eaten - a.eaten || a.shots - b.shots);
      const w = rank[0];
      const tie = rank[1] && rank[1].score === w.score && rank[1].eaten === w.eaten && rank[1].shots === w.shots;
      this.banner(tie ? 'Ισοπαλία!' : `${w.name} κέρδισε!`, w.color.hex);
      this.bear.full = Math.max(this.bear.full, 0.85);
      this.say('Ευχαριστώ για το φαγητό! 💛', 3);
      this.changed();
      this.after(3.2, () => this.finish(w));
    }

    ctrl(part) {
      const active = this.phase === 'go';
      const f = part.food || FOODS[0];
      return {
        mode: 'throw', skin: 'bear', active, food: f.e,
        label: active ? `Πέτα ${f.n}!` : this.phase === 'count' ? 'Ετοιμάσου…' : 'Τέλος!',
        hint: `Πέτα ${f.e} ${f.n} στο στόμα του!<br><small>σύρε προς τα πάνω · λοξά για στόχευση${f.v > 1 ? ` · αξίζει ${f.v} πόντους!` : ''}</small>`,
        scoreText: `Πόντοι: ${part.score} · ⏱ ${Math.ceil(this.left())}″`,
      };
    }

    // ---------- κίνηση ----------
    update(dt) {
      const b = this.bear;
      if (this.phase === 'go' && this.left() <= 0) this.endGame();
      const prog = this.phase === 'go' ? Math.min(1, (this.time - this.goT) / DUR) : 0;

      // πείνα: η μπάρα αδειάζει σιγά σιγά (πιο γρήγορα όταν είναι γεμάτη)
      if (this.phase === 'go') b.full = Math.max(0, b.full - dt * (0.045 + b.full * 0.035));
      const nl = this.levelOf(b.full);
      if (nl < b.level && nl === 0) { this.say(U.pick(HUNGRY_LINES), 1.8); }
      b.level = nl;
      b.shown += (b.full - b.shown) * Math.min(1, dt * 6);
      this.beat += dt * BPM / 60;

      // περπάτημα σε τυχαία σημεία της σκηνής
      if (this.phase === 'go' && Math.abs(b.tx - b.x) < 0.01 && Math.random() < dt * (0.35 + prog * 1.1)) {
        b.tx = U.clamp(b.x + U.rand(0.18, 0.5) * (Math.random() < 0.5 ? -1 : 1), 0.06, 0.94);
        b.v = 0.16 + prog * 0.34 + Math.random() * 0.08;
      }
      const dx = b.tx - b.x, st = b.v * dt;
      b.x = Math.abs(dx) <= st ? b.tx : b.x + Math.sign(dx) * st;
      b.walk = Math.abs(dx) > 0.004 ? (b.walk || 0) + dt * 9 : 0;
      b.lean += ((Math.abs(dx) > 0.004 ? Math.sign(dx) * 0.06 : 0) - b.lean) * Math.min(1, dt * 5);

      // στόμα: ανοιχτό όταν περιμένει, μασά μετά από μπουκιά
      b.chew -= dt; b.cheek = Math.max(0, b.cheek - dt * 1.3);
      let target = b.level === 0 ? 0.85 : 0.7;
      const P = this.pose(), [mx, my] = this.mouthPos(P);
      if (this.foods.some((f) => f.t > 0.45 && Math.hypot(f.tx - mx, f.ty - my) < P.u * 16)) target = 1.05;
      if (b.chew > 0) target = 0.15 + 0.3 * Math.abs(Math.sin(b.chew * 14));
      b.mouth += (target - b.mouth) * Math.min(1, dt * 16);
      b.nextBlink -= dt; if (b.nextBlink <= 0) { b.blink = 0.14; b.nextBlink = U.rand(2, 4.5); }
      b.blink -= dt;
      b.wob = Math.max(0, b.wob - dt * 2.5);
      b.hot = Math.max(0, b.hot - dt * 0.8);
      b.hat += ((b.level === 3 ? 1 : 0) - b.hat) * Math.min(1, dt * 5);
      if (b.spin >= 0) { b.spin += dt * 1.4; if (b.spin >= 1) b.spin = -1; }
      if (b.level === 3 && b.spin < 0 && Math.random() < dt * 0.12) b.spin = 0;
      this.disco += ((b.level === 3 ? 1 : 0) - this.disco) * Math.min(1, dt * 2.2);

      // γουργουρητό κοιλιάς όταν πεινάει
      if (b.level === 0 && this.phase === 'go') {
        b.hungryT += dt; b.rumbleT -= dt;
        if (b.rumbleT <= 0) { b.rumbleT = U.rand(4, 7); b.wob = 1; SND.rumble(); this.fxs.push({ k: 'grr', t: 0 }); if (Math.random() < 0.6) this.say(U.pick(HUNGRY_LINES), 1.8); }
      }

      // νότες όταν χορεύει
      if (b.level > 0 && Math.random() < dt * (1 + b.level * 1.4)) {
        const [hx, hy] = this.headToWorld(P, 0, -8 * P.u);
        this.fxs.push({ k: 'note', x: hx + U.rand(-1, 1) * P.u * 18, y: hy, vx: U.rand(-1, 1) * this.vh * 4, vy: -this.vh * U.rand(8, 14), t: 0, life: 2.2, c: U.pick(['#ffd23d', '#ff6fb5', '#6fd8ff', '#9dff6f']), s: U.pick(['♪', '♫', '♩', '♬']) });
      }
      if (b.level === 3 && Math.random() < dt * 2.5) {
        const [hx, hy] = this.headToWorld(P, 0, 0);
        this.fxs.push({ k: 'heart', x: hx + U.rand(-1, 1) * P.u * 14, y: hy, vx: U.rand(-1, 1) * this.vh * 3, vy: -this.vh * 10, t: 0, life: 1.8 });
      }

      // φαγητά στον αέρα
      for (const f of this.foods) {
        f.t += dt / FLY; f.rot += f.spin * dt;
        const k = Math.min(1, f.t);
        f.x = lerp(f.x0, f.tx, k);
        f.y = lerp(f.y0, f.ty, k) - Math.sin(Math.PI * k) * this.H * 0.2;
      }
      const landed = this.foods.filter((f) => f.t >= 1);
      this.foods = this.foods.filter((f) => f.t < 1);
      landed.forEach((f) => this.land(f));
      for (const q of this.floor) {
        if (!q.rest) {
          q.vy += this.vh * 160 * dt; q.x += q.vx * dt; q.y += q.vy * dt; q.rot += q.spin * dt;
          if (q.y >= q.gy) { q.y = q.gy; if (Math.abs(q.vy) > this.vh * 25) { q.vy *= -0.35; q.vx *= 0.5; q.spin *= 0.4; } else { q.rest = true; q.rot = Math.round(q.rot / Math.PI) * Math.PI * 0 + q.rot * 0.2; } }
        }
        q.life -= dt; if (q.life < 1) q.a = Math.max(0, q.life);
      }
      this.floor = this.floor.filter((q) => q.life > 0);
      for (const e of this.fxs) {
        e.t += dt;
        if (e.vx != null) { e.x += e.vx * dt; e.y += e.vy * dt; if (e.k === 'crumb' || e.k === 'spark') e.vy += this.vh * (e.k === 'crumb' ? 140 : 30) * dt; }
      }
      this.fxs = this.fxs.filter((e) => e.t < (e.life || (e.k === 'fire' ? 1.2 : 1.6)));
      for (const q of this.pops) q.t += dt;
      this.pops = this.pops.filter((q) => q.t < 1.2);
      for (const p of this.parts) p.flash = Math.max(0, p.flash - dt * 2);
      if (this.bubble && this.time > this.bubble.until) this.bubble = null;

      // ρομπότ: στοχεύει στο στόμα με λίγη αστοχία
      for (const p of this.parts) {
        if (!p.bot || this.phase !== 'go') continue;
        p.botNext -= dt;
        if (p.botNext > 0) continue;
        p.botNext = U.rand(1.0, 1.7);
        const [mx2, my2] = this.mouthPos(P), W = this.W, lx = this.launchX(p), u = P.u;
        const aimX = mx2 + (b.tx - b.x) * 0.4 * W * 0.3 + U.rand(-1, 1) * u * 11;
        const ax = U.clamp((aimX - W / 2 - (lx - W / 2) * 0.45) / (W * 0.42), -1, 1);
        const F = this.feetY(), want = my2 + U.rand(-1, 1) * u * 9;
        const pw = U.clamp((F + this.vh * 4 - want) / (this.vh * 4 + 74 * u), 0, 1);
        this.toss(p, ax, pw);
      }

      this.tickMusic();
      // ανανέωση του χρόνου στα κινητά κάθε δευτερόλεπτο
      const sec = Math.ceil(this.left());
      if (sec !== this.lastSec) { this.lastSec = sec; this.changed(); }
    }

    tickMusic() {
      const a = SND.ac, b = this.bear;
      if (!a || !this.running) return;
      const play = b.level > 0;
      const step = 60 / BPM / 4;
      if (!play) { this.music.on = false; return; }
      if (!this.music.on) { this.music.on = true; this.music.next = a.currentTime + 0.05; this.music.step = Math.round(this.beat * 4) % 64; }
      while (this.music.next < a.currentTime + 0.12) {
        const t = this.music.next, s = this.music.step, L = b.level, s16 = s % 16;
        if (s16 % 4 === 0) { SND.tone(t, 150, 0.16, 'sine', 0.55, 45); }
        if (s16 % 4 === 2) SND.hit(t, 0.04, 0.12, 7000, 0.7);
        if (L >= 2 && (s16 === 4 || s16 === 12)) { SND.hit(t, 0.14, 0.35, 1500, 0.7, 'bandpass'); SND.tone(t, 220, 0.08, 'triangle', 0.12, 150); }
        if (L >= 2 && s16 % 2 === 1) SND.hit(t, 0.025, 0.05, 9000, 0.7);
        if (s % 2 === 0) { const bn = BASS[(s / 2) % 16]; SND.tone(t, N(bn), step * 1.7, 'triangle', 0.32); if (L >= 2) SND.tone(t, N(bn + 12), step * 1.2, 'square', 0.05); }
        if (L >= 1 && s16 % 8 === 4) { const root = BASS[(s / 2) % 16]; [0, 3, 7].forEach((iv) => SND.tone(t, N(root + 24 + iv), step * 1.5, 'sawtooth', 0.025)); }
        if (L >= 3) { const m = MEL[s % 64]; if (m) { SND.tone(t, N(m), step * 1.8, 'square', 0.06); SND.tone(t, N(m) * 1.003, step * 1.8, 'triangle', 0.08); } }
        this.music.next += step; this.music.step = (s + 1) % 64;
      }
    }

    // ---------- σχέδιο ----------
    buildBg() {
      const W = this.W, H = this.H, vh = this.vh, c = document.createElement('canvas');
      c.width = this.c.width; c.height = this.c.height;
      const x = c.getContext('2d'), dpr = c.width / W;
      x.setTransform(dpr, 0, 0, dpr, 0, 0);
      // ουρανός σούρουπο
      let g = x.createLinearGradient(0, 0, 0, H * 0.75);
      g.addColorStop(0, '#1b1046'); g.addColorStop(0.45, '#5a2a78'); g.addColorStop(0.78, '#e0607e'); g.addColorStop(1, '#ffb070');
      x.fillStyle = g; x.fillRect(0, 0, W, H);
      // αστέρια
      let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
      for (let i = 0; i < 90; i++) { x.fillStyle = `rgba(255,255,255,${0.3 + rnd() * 0.6})`; x.beginPath(); x.arc(rnd() * W, rnd() * H * 0.4, rnd() * vh * 0.25 + 0.5, 0, 7); x.fill(); }
      // φεγγάρι
      const mx = W * 0.82, my = H * 0.17, mr = vh * 6;
      g = x.createRadialGradient(mx, my, mr * 0.5, mx, my, mr * 3.2); g.addColorStop(0, 'rgba(255,240,200,.35)'); g.addColorStop(1, 'rgba(255,240,200,0)');
      x.fillStyle = g; x.beginPath(); x.arc(mx, my, mr * 3.2, 0, 7); x.fill();
      g = x.createRadialGradient(mx - mr * 0.3, my - mr * 0.3, mr * 0.1, mx, my, mr); g.addColorStop(0, '#fffbe8'); g.addColorStop(1, '#f1d9a0');
      x.fillStyle = g; x.beginPath(); x.arc(mx, my, mr, 0, 7); x.fill();
      x.fillStyle = 'rgba(200,170,110,.35)'; [[-0.3, -0.2, 0.22], [0.25, 0.15, 0.16], [-0.1, 0.4, 0.12]].forEach(([a, b2, r]) => { x.beginPath(); x.arc(mx + a * mr, my + b2 * mr, r * mr, 0, 7); x.fill(); });
      // βουνά σε στρώσεις
      const hills = [[0.52, '#6b3a7d', 0.13, 3], [0.6, '#46285e', 0.09, 5], [0.68, '#2c1b44', 0.07, 7]];
      for (const [base, col, amp, fr] of hills) {
        x.fillStyle = col; x.beginPath(); x.moveTo(0, H);
        for (let i = 0; i <= 60; i++) { const X = (i / 60) * W; x.lineTo(X, H * base - Math.abs(Math.sin(i / 60 * fr + base * 9)) * H * amp - Math.sin(i * 0.9) * vh * 0.6); }
        x.lineTo(W, H); x.closePath(); x.fill();
      }
      // πεύκα
      for (let i = 0; i < 26; i++) {
        const X = (i / 25) * W + Math.sin(i * 3.3) * vh * 3, base = H * (0.7 + (i % 3) * 0.015), h = vh * (9 + (i * 7) % 9);
        x.fillStyle = '#1a1030';
        for (let k = 0; k < 3; k++) { const w = h * (0.42 - k * 0.09), y = base - k * h * 0.28; x.beginPath(); x.moveTo(X - w, y); x.lineTo(X, y - h * 0.45); x.lineTo(X + w, y); x.closePath(); x.fill(); }
      }
      // ξύλινη σκηνή
      const sy = this.stageY();
      g = x.createLinearGradient(0, sy, 0, H);
      g.addColorStop(0, '#b97a45'); g.addColorStop(0.35, '#8c5429'); g.addColorStop(1, '#4a2a14');
      x.fillStyle = g; x.fillRect(0, sy, W, H - sy);
      x.strokeStyle = 'rgba(40,20,5,.35)'; x.lineWidth = Math.max(1, vh * 0.18);
      for (let i = 1; i < 9; i++) { const y = sy + (H - sy) * Math.pow(i / 9, 1.4); x.beginPath(); x.moveTo(0, y); x.lineTo(W, y); x.stroke(); }
      for (let i = -12; i <= 12; i++) { x.beginPath(); x.moveTo(W / 2 + i * W * 0.045, sy); x.lineTo(W / 2 + i * W * 0.14, H); x.stroke(); }
      x.fillStyle = 'rgba(255,220,170,.25)'; x.fillRect(0, sy, W, vh * 0.5);
      g = x.createLinearGradient(0, sy - vh * 3, 0, sy); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.3)');
      x.fillStyle = g; x.fillRect(0, sy - vh * 3, W, vh * 3);
      // κολώνες με γιρλάντες στα πλάγια
      for (const s of [0, 1]) {
        const X = s ? W - vh * 5 : vh * 2;
        g = x.createLinearGradient(X, 0, X + vh * 3, 0); g.addColorStop(0, '#5b3317'); g.addColorStop(0.5, '#a5693a'); g.addColorStop(1, '#4a2810');
        x.fillStyle = g; x.fillRect(X, H * 0.06, vh * 3, sy - H * 0.06 + vh);
      }
      this.bg = c;
    }

    draw() {
      const x = this.ctx, W = this.W, H = this.H, vh = this.vh, b = this.bear, ph = this.beat * Math.PI;
      if (!this.bg) this.buildBg();
      x.drawImage(this.bg, 0, 0, W, H);
      const P = this.pose();

      // φώτα σκηνής (προβολείς) όταν χορεύει
      const glow = b.level >= 2 ? 1 : b.level === 1 ? 0.35 : 0;
      if (glow > 0) {
        x.save(); x.globalCompositeOperation = 'lighter';
        const cols = ['255,80,200', '80,200,255', '255,220,80', '120,255,140'];
        for (let i = 0; i < 4; i++) {
          const sx = W * (0.12 + i * 0.25), a = Math.sin(this.time * (0.9 + i * 0.23) + i * 2) * 0.5;
          const ex = sx + Math.sin(a) * H * 1.1, ey = this.stageY() + vh * 6;
          const g = x.createLinearGradient(sx, 0, ex, ey); g.addColorStop(0, `rgba(${cols[i]},${0.32 * glow})`); g.addColorStop(1, `rgba(${cols[i]},0)`);
          x.fillStyle = g; x.beginPath(); x.moveTo(sx - vh, 0); x.lineTo(sx + vh, 0); x.lineTo(ex + vh * 11, ey); x.lineTo(ex - vh * 11, ey); x.closePath(); x.fill();
          const g2 = x.createRadialGradient(ex, ey - vh * 2, 0, ex, ey - vh * 2, vh * 14); g2.addColorStop(0, `rgba(${cols[i]},${0.22 * glow})`); g2.addColorStop(1, `rgba(${cols[i]},0)`);
          x.fillStyle = g2; x.beginPath(); x.ellipse(ex, ey - vh * 2, vh * 14, vh * 4, 0, 0, 7); x.fill();
        }
        x.restore();
      }
      this.drawLights();
      if (this.disco > 0.01) this.drawDiscoBall();

      // σκιά αρκούδας
      x.fillStyle = 'rgba(0,0,0,.32)';
      x.beginPath(); x.ellipse(P.X, P.F + P.u * 0.6, P.u * (15 - P.hop / P.u * 0.6), P.u * 2.6, 0, 0, 7); x.fill();

      // φαγητά στο πάτωμα (πίσω από το αρκουδάκι αν είναι πιο πάνω)
      for (const q of this.floor) if (q.y < P.F) this.drawFood(q.f, q.x, q.y, vh * 4.2, q.rot, q.a);
      this.drawBear(P);
      for (const q of this.floor) if (q.y >= P.F) this.drawFood(q.f, q.x, q.y, vh * 4.6, q.rot, q.a);

      // εφέ
      this.drawFx(P);

      // φαγητά στον αέρα (μεγάλα κοντά στην κάμερα, μικραίνουν όσο πάνε)
      for (const f of this.foods) {
        const k = Math.min(1, f.t), s = lerp(vh * 8.5, vh * 4.6, k);
        x.fillStyle = `rgba(0,0,0,${0.18 * k})`;
        x.beginPath(); x.ellipse(f.x, lerp(H, Math.max(f.ty, this.stageY()) + vh * 3, k), s * 0.5, s * 0.14, 0, 0, 7); x.fill();
        this.drawFood(f.f, f.x, f.y, s, f.rot, 1, f.part.color.hex);
      }
      for (const q of this.pops) {
        const s = U.easeOutBack(Math.min(1, q.t * 3));
        x.globalAlpha = Math.max(0, 1 - Math.max(0, q.t - 0.6) / 0.6);
        this.text(q.txt, q.x, q.y - q.t * vh * 9, vh * 7 * s, q.c, { fam: 'Comfortaa', w: 700 });
        x.globalAlpha = 1;
      }
      if (this.bubble) this.drawBubble(P);
      this.drawHud();
      if (this.phase === 'count') this.drawCount(this.countT, 'ΠΕΤΑΤΕ!');
    }

    drawLights() {
      const x = this.ctx, W = this.W, vh = this.vh, L = this.bear.level;
      const cols = ['#ff4d5e', '#ffd23d', '#3ee08f', '#4fc3ff', '#ff6fd8', '#ff9a2e'];
      for (let row = 0; row < 2; row++) {
        const y0 = vh * (row ? 13 : 7), sag = vh * (row ? 6 : 5), n = 13;
        x.strokeStyle = '#2a1a10'; x.lineWidth = Math.max(1.5, vh * 0.25);
        x.beginPath();
        for (let i = 0; i <= 40; i++) { const t = i / 40, X = vh * 3.5 + t * (W - vh * 7); const y = y0 + Math.sin(t * Math.PI) * sag; i ? x.lineTo(X, y) : x.moveTo(X, y); }
        x.stroke();
        for (let i = 0; i < n; i++) {
          const t = (i + 0.5) / n, X = vh * 3.5 + t * (W - vh * 7), Y = y0 + Math.sin(t * Math.PI) * sag + vh * 1.2;
          const on = L === 0 ? 0.35 + 0.15 * Math.sin(this.time * 2 + i) : (Math.floor(this.beat) + i + row) % (L >= 2 ? 2 : 3) === 0 ? 1 : 0.55;
          const c = cols[(i + row * 3) % cols.length];
          const g = x.createRadialGradient(X, Y, 0, X, Y, vh * 3.2);
          g.addColorStop(0, U.rgba(c, 0.55 * on)); g.addColorStop(1, U.rgba(c, 0));
          x.fillStyle = g; x.beginPath(); x.arc(X, Y, vh * 3.2, 0, 7); x.fill();
          x.fillStyle = on > 0.8 ? U.shade(c, 0.45) : U.shade(c, -0.2 + on * 0.3);
          x.beginPath(); x.ellipse(X, Y, vh * 0.85, vh * 1.1, 0, 0, 7); x.fill();
          x.fillStyle = 'rgba(255,255,255,.6)'; x.beginPath(); x.arc(X - vh * 0.3, Y - vh * 0.4, vh * 0.28, 0, 7); x.fill();
        }
      }
    }

    drawDiscoBall() {
      const x = this.ctx, vh = this.vh, W = this.W, d = this.disco;
      const X = W * 0.3, Y = -vh * 8 + d * vh * 26, r = vh * 5.5;
      x.strokeStyle = '#ddd'; x.lineWidth = Math.max(1, vh * 0.2); x.beginPath(); x.moveTo(X, 0); x.lineTo(X, Y - r); x.stroke();
      // ακτίνες
      x.save(); x.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 10; i++) {
        const a = this.time * 0.8 + i * 0.63;
        const ex = X + Math.cos(a) * this.W * 0.6, ey = Y + Math.abs(Math.sin(a)) * this.H * 0.9;
        x.strokeStyle = `rgba(255,255,255,${0.12 * d})`; x.lineWidth = vh * 0.5;
        x.beginPath(); x.moveTo(X, Y); x.lineTo(ex, ey); x.stroke();
        x.fillStyle = `rgba(255,255,255,${0.35 * d})`; x.beginPath(); x.arc(ex, ey, vh * 0.6, 0, 7); x.fill();
      }
      x.restore();
      const g = x.createRadialGradient(X - r * 0.35, Y - r * 0.35, r * 0.1, X, Y, r);
      g.addColorStop(0, '#ffffff'); g.addColorStop(0.5, '#b9c2d6'); g.addColorStop(1, '#5c6478');
      x.fillStyle = g; x.beginPath(); x.arc(X, Y, r, 0, 7); x.fill();
      x.save(); x.beginPath(); x.arc(X, Y, r, 0, 7); x.clip();
      const rot = this.time * 1.5;
      for (let j = -4; j <= 4; j++) {
        const y = Y + (j / 4.5) * r, w = Math.sqrt(Math.max(0, 1 - (j / 4.5) ** 2)) * r;
        for (let i = 0; i < 8; i++) {
          const a = rot + i * 0.785, cx = X + Math.sin(a) * w;
          if (Math.cos(a) < 0) continue;
          const lum = 0.4 + 0.6 * Math.abs(Math.sin(a * 3 + j + this.time * 4));
          x.fillStyle = `rgba(255,255,255,${lum * 0.75})`; x.fillRect(cx - r * 0.09, y - r * 0.08, r * 0.18 * Math.cos(a), r * 0.15);
        }
      }
      x.restore();
      x.strokeStyle = INK; x.lineWidth = this.lw * 0.8; x.beginPath(); x.arc(X, Y, r, 0, 7); x.stroke();
    }

    // σχέδιο φαγητού: εικόνα + λευκό «αυτοκόλλητο» περίγραμμα για να ξεχωρίζει
    drawFood(f, X, Y, s, rot, a, col) {
      const x = this.ctx, img = foodImg(f);
      x.save(); x.globalAlpha = a; x.translate(X, Y); x.rotate(rot);
      if (col) { const g = x.createRadialGradient(0, 0, 0, 0, 0, s * 0.85); g.addColorStop(0, U.rgba(col, 0.55)); g.addColorStop(1, U.rgba(col, 0)); x.fillStyle = g; x.beginPath(); x.arc(0, 0, s * 0.85, 0, 7); x.fill(); }
      if (f.gold) { x.fillStyle = `rgba(255,220,80,${0.35 + 0.2 * Math.sin(this.time * 10)})`; x.beginPath(); x.arc(0, 0, s * 0.7, 0, 7); x.fill(); }
      x.drawImage(img, -s / 2, -s / 2, s, s);
      x.restore();
    }

    // ---------- το αρκουδάκι ----------
    limb(x0, y0, x1, y1, w, col) {
      const x = this.ctx;
      x.lineCap = 'round';
      x.strokeStyle = INK; x.lineWidth = w + this.lw * 2; x.beginPath(); x.moveTo(x0, y0); x.lineTo(x1, y1); x.stroke();
      x.strokeStyle = col; x.lineWidth = w; x.beginPath(); x.moveTo(x0, y0); x.lineTo(x1, y1); x.stroke();
    }
    arm(side, a, e, u) {
      // side: -1 αριστερά (οθόνη), +1 δεξιά. a: γωνία ώμου από το «κάτω», e: λύγισμα αγκώνα
      const x = this.ctx, sx = side * 10.5 * u, sy = -15 * u;
      const ex = sx + side * Math.sin(a) * 8 * u, ey = sy + Math.cos(a) * 8 * u;
      const a2 = a - e, px = ex + side * Math.sin(a2) * 7.5 * u, py = ey + Math.cos(a2) * 7.5 * u;
      // ενιαίο χέρι με περίγραμμα
      x.lineCap = 'round'; x.lineJoin = 'round';
      x.strokeStyle = INK; x.lineWidth = 6.6 * u + this.lw * 2; x.beginPath(); x.moveTo(sx, sy); x.lineTo(ex, ey); x.lineTo(px, py); x.stroke();
      const g = x.createLinearGradient(sx, sy, px, py); g.addColorStop(0, FUR); g.addColorStop(1, FUR_D);
      x.strokeStyle = g; x.lineWidth = 6.6 * u; x.beginPath(); x.moveTo(sx, sy); x.lineTo(ex, ey); x.lineTo(px, py); x.stroke();
      x.strokeStyle = 'rgba(255,220,170,.22)'; x.lineWidth = 2 * u; x.beginPath(); x.moveTo(sx - side * u, sy - u); x.lineTo(ex - side * u * 1.2, ey - u * 0.5); x.stroke();
      // πατούσα
      x.fillStyle = FUR_D; x.strokeStyle = INK; x.lineWidth = this.lw;
      x.beginPath(); x.arc(px, py, 3.9 * u, 0, 7); x.fill(); x.stroke();
      x.fillStyle = PAD; x.beginPath(); x.ellipse(px, py + 0.4 * u, 2.1 * u, 1.7 * u, 0, 0, 7); x.fill();
      for (let i = -1; i <= 1; i++) { x.beginPath(); x.arc(px + i * 1.5 * u, py - 1.9 * u, 0.75 * u, 0, 7); x.fill(); }
    }

    drawBear(P) {
      const x = this.ctx, u = P.u, b = this.bear, lw = this.lw;
      const fat = b.shown * 0.12;
      x.save();
      x.translate(P.X, P.F - P.hop);
      x.scale(P.sx * (1 + P.sq), 1 - P.sq);
      // ---- πόδια (στο σύστημα των ποδιών) ----
      for (const s of [-1, 1]) {
        const lift = s < 0 ? P.fL : P.fR;
        const hx = s * 6.5 * u, hy = -13 * u, fx = s * 7.5 * u, fy = -2.6 * u - lift;
        this.limb(hx, hy, fx, fy, 8.5 * u, FUR_D);
        x.fillStyle = FUR_D; x.strokeStyle = INK; x.lineWidth = lw;
        x.beginPath(); x.ellipse(fx + s * 0.6 * u, fy + 0.6 * u, 5.4 * u, 3.3 * u, 0, 0, 7); x.fill(); x.stroke();
        x.fillStyle = PAD; x.beginPath(); x.ellipse(fx + s * 0.6 * u, fy + 1.0 * u, 3.2 * u, 1.8 * u, 0, 0, 7); x.fill();
      }
      // ---- σώμα ----
      x.translate(0, -14 * u);
      x.rotate(P.tilt);
      const brx = 12.6 * u * (1 + fat), bry = 14.5 * u * (1 + fat * 0.4);
      let g = x.createRadialGradient(-brx * 0.35, -bry * 0.7, u, 0, -7 * u, bry * 1.25);
      g.addColorStop(0, FUR_L); g.addColorStop(0.5, FUR); g.addColorStop(1, FUR_D);
      x.fillStyle = g; x.strokeStyle = INK; x.lineWidth = lw * 1.2;
      x.beginPath(); x.ellipse(0, -7 * u, brx, bry, 0, 0, 7); x.fill(); x.stroke();
      // κοιλίτσα
      g = x.createRadialGradient(-2 * u, -8 * u, u, 0, -4 * u, 11 * u);
      g.addColorStop(0, '#fff2d8'); g.addColorStop(1, MUZ);
      x.fillStyle = g; x.beginPath(); x.ellipse(0, -4.5 * u, brx * 0.64, bry * 0.66, 0, 0, 7); x.fill();
      // γούνα: μικρές τούφες στο περίγραμμα της κοιλιάς
      x.strokeStyle = 'rgba(170,110,60,.45)'; x.lineWidth = Math.max(1, u * 0.35);
      for (let i = 0; i < 9; i++) { const a = -2.5 + i * 0.62; x.beginPath(); x.moveTo(Math.cos(a) * brx * 0.62, -4.5 * u + Math.sin(a) * bry * 0.64); x.lineTo(Math.cos(a) * brx * 0.7, -4.5 * u + Math.sin(a) * bry * 0.72); x.stroke(); }
      // αφαλός
      x.strokeStyle = 'rgba(150,90,40,.6)'; x.lineWidth = u * 0.5; x.beginPath(); x.arc(0, -2 * u, u * 0.7, 0.3, 2.8); x.stroke();
      // γουργουρητό
      if (b.wob > 0.3 && b.level === 0) { x.strokeStyle = `rgba(80,40,20,${b.wob * 0.6})`; x.lineWidth = u * 0.4; for (let i = 0; i < 3; i++) { x.beginPath(); x.arc(0, -4 * u, u * (2 + i * 1.6), -0.6, 0.6); x.stroke(); } }
      // ---- χέρια ----
      this.arm(-1, P.aL, P.eL, u);
      this.arm(1, P.aR, P.eR, u);
      // ---- μαντήλι στον λαιμό ----
      x.save(); x.translate(0, -19.5 * u);
      x.fillStyle = '#d8263a'; x.strokeStyle = INK; x.lineWidth = lw;
      x.beginPath(); x.moveTo(-9 * u, -1.6 * u); x.quadraticCurveTo(0, 2.4 * u, 9 * u, -1.6 * u); x.lineTo(0, 7.5 * u); x.closePath(); x.fill(); x.stroke();
      x.fillStyle = '#fff';
      [[-3.5, 1.2], [3, 1.4], [0, 4.2], [-1.5, 0.3], [5.5, -0.2], [-6, -0.3]].forEach(([a, c]) => { x.beginPath(); x.arc(a * u, c * u, 0.55 * u, 0, 7); x.fill(); });
      x.restore();
      // ---- κεφάλι ----
      x.translate(0, -21 * u);
      x.rotate(P.head);
      x.translate(0, -9 * u);
      this.drawHead(u);
      x.restore();
    }

    drawHead(u) {
      const x = this.ctx, b = this.bear, lw = this.lw, L = b.level;
      // αυτιά
      for (const s of [-1, 1]) {
        const g = x.createRadialGradient(s * 8.5 * u, -9 * u, u, s * 8.5 * u, -8.5 * u, 4.6 * u);
        g.addColorStop(0, FUR_L); g.addColorStop(1, FUR_D);
        x.fillStyle = g; x.strokeStyle = INK; x.lineWidth = lw;
        x.beginPath(); x.arc(s * 8.5 * u, -8.5 * u, 4.4 * u, 0, 7); x.fill(); x.stroke();
        x.fillStyle = '#f2a7a0'; x.beginPath(); x.arc(s * 8.5 * u, -8.3 * u, 2.4 * u, 0, 7); x.fill();
      }
      // κεφάλι
      let g = x.createRadialGradient(-3.5 * u, -5 * u, u, 0, 0, 12.5 * u);
      g.addColorStop(0, FUR_L); g.addColorStop(0.6, FUR); g.addColorStop(1, FUR_D);
      x.fillStyle = g; x.strokeStyle = INK; x.lineWidth = lw * 1.2;
      x.beginPath(); x.ellipse(0, 0, 11.6 * u, 10.8 * u, 0, 0, 7); x.fill(); x.stroke();
      // τουφίτσα στην κορυφή
      x.fillStyle = FUR; x.beginPath(); x.moveTo(-2 * u, -10.4 * u); x.quadraticCurveTo(-1 * u, -13.5 * u, 0.5 * u, -11 * u); x.quadraticCurveTo(1.5 * u, -13 * u, 2.6 * u, -10.3 * u); x.closePath(); x.fill();
      x.strokeStyle = INK; x.lineWidth = lw * 0.8; x.stroke();
      // μάγουλα (φουσκώνουν όταν μασά)
      const ck = b.cheek;
      x.fillStyle = `rgba(255,120,130,${0.35 + ck * 0.25})`;
      for (const s of [-1, 1]) { x.beginPath(); x.ellipse(s * 7.4 * u, 3 * u, (2.2 + ck * 1.2) * u, (1.4 + ck * 0.8) * u, 0, 0, 7); x.fill(); }
      // ρύγχος
      g = x.createRadialGradient(-1.5 * u, 2 * u, u * 0.5, 0, 4 * u, 7 * u);
      g.addColorStop(0, '#fff4df'); g.addColorStop(1, MUZ);
      x.fillStyle = g; x.strokeStyle = 'rgba(28,26,43,.55)'; x.lineWidth = lw * 0.7;
      x.beginPath(); x.ellipse(0, 4 * u, (6.4 + ck * 0.8) * u, (5.2 + b.mouth * 1.2) * u, 0, 0, 7); x.fill(); x.stroke();
      // μάτια
      const happy = L >= 2, blink = b.blink > 0;
      for (const s of [-1, 1]) {
        const ex = s * 4.6 * u, ey = -2.6 * u;
        if (happy || blink) {
          x.strokeStyle = INK; x.lineWidth = u * 0.9; x.lineCap = 'round';
          x.beginPath(); happy && !blink ? x.arc(ex, ey + u * 0.6, u * 1.7, Math.PI * 1.15, Math.PI * 1.85) : (x.moveTo(ex - u * 1.5, ey), x.lineTo(ex + u * 1.5, ey)); x.stroke();
        } else {
          x.fillStyle = '#1a0f0a'; x.beginPath(); x.ellipse(ex, ey, 1.75 * u, 2.1 * u, 0, 0, 7); x.fill();
          x.fillStyle = '#fff'; x.beginPath(); x.arc(ex + 0.6 * u, ey - 0.8 * u, 0.7 * u, 0, 7); x.fill();
          x.beginPath(); x.arc(ex - 0.5 * u, ey + 0.7 * u, 0.32 * u, 0, 7); x.fill();
        }
        // φρύδια: λυπημένα όταν πεινάει
        x.strokeStyle = FUR_D; x.lineWidth = u * 0.8; x.lineCap = 'round';
        const sad = L === 0 ? 1 : 0;
        x.beginPath(); x.moveTo(ex - s * 1.8 * u, ey - 3.3 * u + sad * -0.9 * u * 0 - sad * 0.2 * u); x.lineTo(ex + s * 1.6 * u, ey - 3.6 * u + sad * 1.2 * u - (1 - sad) * 0.4 * u); x.stroke();
      }
      // μύτη
      g = x.createRadialGradient(-0.6 * u, 0.2 * u, 0.1 * u, 0, 0.8 * u, 2.6 * u);
      g.addColorStop(0, '#5a4a4a'); g.addColorStop(1, '#120a08');
      x.fillStyle = g; x.beginPath(); x.ellipse(0, 1 * u, 2.5 * u, 1.75 * u, 0, 0, 7); x.fill();
      x.fillStyle = 'rgba(255,255,255,.7)'; x.beginPath(); x.ellipse(-0.8 * u, 0.4 * u, 0.8 * u, 0.4 * u, -0.3, 0, 7); x.fill();
      x.strokeStyle = INK; x.lineWidth = u * 0.45; x.beginPath(); x.moveTo(0, 2.7 * u); x.lineTo(0, 3.6 * u); x.stroke();
      // στόμα
      const m = b.mouth, my = 4.8 * u;
      if (m > 0.2) {
        const rx = (2.6 + m * 1.4) * u, ry = (0.6 + m * 2.6) * u;
        x.fillStyle = '#5a1020'; x.strokeStyle = INK; x.lineWidth = lw * 0.8;
        x.beginPath(); x.ellipse(0, my + ry * 0.35, rx, ry, 0, 0, 7); x.fill(); x.stroke();
        x.save(); x.beginPath(); x.ellipse(0, my + ry * 0.35, rx, ry, 0, 0, 7); x.clip();
        x.fillStyle = '#ff7a8a'; x.beginPath(); x.ellipse(0, my + ry * 1.15, rx * 0.75, ry * 0.65, 0, 0, 7); x.fill();
        x.fillStyle = '#fff'; x.fillRect(-rx * 0.5, my + ry * 0.35 - ry - u * 0.1, rx * 0.35, u * 0.9); x.fillRect(rx * 0.15, my + ry * 0.35 - ry - u * 0.1, rx * 0.35, u * 0.9);
        x.restore();
        // σάλια όταν πεινάει πολύ
        if (L === 0 && b.hungryT > 3) { x.fillStyle = 'rgba(180,220,255,.8)'; const dl = (this.time * 0.7) % 1; x.beginPath(); x.ellipse(rx * 0.6, my + ry * 0.9 + dl * 2.5 * u, 0.5 * u, (0.6 + dl) * u, 0, 0, 7); x.fill(); }
      } else {
        x.strokeStyle = INK; x.lineWidth = u * 0.55; x.lineCap = 'round';
        x.beginPath(); x.moveTo(-3 * u, my - 0.4 * u); x.quadraticCurveTo(-1.5 * u, my + 1.2 * u, 0, my); x.quadraticCurveTo(1.5 * u, my + 1.2 * u, 3 * u, my - 0.4 * u); x.stroke();
      }
      // κόκκινο πρόσωπο από την πιπεριά
      if (b.hot > 0) { x.fillStyle = `rgba(255,40,30,${b.hot * 0.35})`; x.beginPath(); x.ellipse(0, 0, 11.6 * u, 10.8 * u, 0, 0, 7); x.fill(); }
      // καπελάκι πάρτι
      if (b.hat > 0.02) {
        x.save(); x.translate(3 * u, -9.5 * u); x.rotate(0.25); x.scale(b.hat, b.hat);
        x.fillStyle = '#4fc3ff'; x.strokeStyle = INK; x.lineWidth = lw;
        x.beginPath(); x.moveTo(-4 * u, 0); x.lineTo(0, -10 * u); x.lineTo(4 * u, 0); x.closePath(); x.fill(); x.stroke();
        x.save(); x.clip(); x.strokeStyle = '#ffd23d'; x.lineWidth = u * 1.1; for (let i = 0; i < 4; i++) { x.beginPath(); x.moveTo(-5 * u, -i * 3 * u + 1 * u); x.lineTo(5 * u, -i * 3 * u - 2 * u); x.stroke(); } x.restore();
        x.fillStyle = '#ff6fd8'; x.beginPath(); x.arc(0, -10 * u, 1.6 * u, 0, 7); x.fill(); x.stroke();
        x.restore();
      }
    }

    drawFx(P) {
      const x = this.ctx, vh = this.vh, u = P.u;
      for (const e of this.fxs) {
        const k = e.t / (e.life || 1.6);
        if (e.k === 'crumb') { x.globalAlpha = 1 - k; x.fillStyle = e.c; x.beginPath(); x.arc(e.x, e.y, e.r, 0, 7); x.fill(); }
        else if (e.k === 'spark') { x.globalAlpha = 1 - k; U.starPath(x, e.x, e.y, vh * 1.1 * (1 - k * 0.5)); x.fillStyle = e.c; x.fill(); }
        else if (e.k === 'note') { x.globalAlpha = Math.min(1, (1 - k) * 2); this.text(e.s, e.x + Math.sin(e.t * 5) * vh, e.y, vh * 4.5, e.c, { sw: vh * 0.6 }); }
        else if (e.k === 'heart') { x.globalAlpha = 1 - k; this.text('♥', e.x, e.y, vh * 3.5, '#ff5a8a', { sw: vh * 0.5 }); }
        else if (e.k === 'grr') {
          const [bx, by] = this.headToWorld(P, 0, 30 * u);
          x.globalAlpha = Math.max(0, 1 - k); this.text('γρρρ…', bx + 16 * u, by - k * vh * 4, vh * 3.2, '#ffe2b0', { sw: vh * 0.6 });
        } else if (e.k === 'fire') {
          const [mx, my] = this.mouthPos(P);
          x.save(); x.globalCompositeOperation = 'lighter';
          for (let i = 0; i < 14; i++) {
            const d = ((e.t * 3 + i / 14) % 1), r = vh * (1.5 + d * 4.5);
            const fx = mx + Math.sin(i * 7.1 + e.t * 20) * vh * 2 * d, fy = my + d * vh * 18;
            const g = x.createRadialGradient(fx, fy, 0, fx, fy, r);
            g.addColorStop(0, `rgba(255,240,150,${0.8 * (1 - d) * (1 - k)})`); g.addColorStop(0.5, `rgba(255,120,20,${0.6 * (1 - d) * (1 - k)})`); g.addColorStop(1, 'rgba(255,40,0,0)');
            x.fillStyle = g; x.beginPath(); x.arc(fx, fy, r, 0, 7); x.fill();
          }
          x.restore();
        }
        x.globalAlpha = 1;
      }
    }

    drawBubble(P) {
      const x = this.ctx, vh = this.vh, t = this.bubble.t;
      const [hx, hy] = this.headToWorld(P, 0, -12 * P.u);
      x.font = this.font(vh * 3, 800);
      const w = x.measureText(t).width + vh * 4.5, h = vh * 6.8;
      const right = hx < this.W * 0.55;
      let bx = right ? hx + P.u * 8 : hx - P.u * 8 - w;
      bx = U.clamp(bx, vh, this.W - w - vh);
      const by = Math.max(vh * 21, hy - h - vh * 2);
      const s = U.easeOutBack(Math.min(1, (this.time - this.bubble.t0) * 5));
      x.save(); x.translate(bx + w / 2, by + h / 2); x.scale(s, s); x.translate(-(bx + w / 2), -(by + h / 2));
      U.rr(x, bx, by, w, h, vh * 2.6); x.fillStyle = '#fff'; x.fill(); x.lineWidth = this.lw; x.strokeStyle = INK; x.stroke();
      const tx = right ? bx + vh * 3 : bx + w - vh * 3;
      x.beginPath(); x.moveTo(tx, by + h - 1); x.lineTo(hx + (right ? P.u * 5 : -P.u * 5), hy + vh); x.lineTo(tx + (right ? vh * 3.5 : -vh * 3.5), by + h - 1);
      x.fillStyle = '#fff'; x.fill(); x.stroke();
      x.fillRect(Math.min(tx, tx + (right ? vh * 3.5 : -vh * 3.5)) + 2, by + h - this.lw * 1.5, vh * 3.5 - 4, this.lw * 2);
      x.fillStyle = INK; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(t, bx + w / 2, by + h / 2);
      x.restore();
    }

    drawHud() {
      const x = this.ctx, W = this.W, H = this.H, vh = this.vh, b = this.bear;
      // τίτλος και χρόνος
      const sec = Math.ceil(this.left());
      const pw = vh * 20, ph = vh * 7.5, px = W / 2 - pw / 2, py = vh * 1.8;
      U.rr(x, px, py, pw, ph, vh * 3.7); x.fillStyle = 'rgba(15,8,35,.78)'; x.fill();
      x.lineWidth = vh * 0.35; x.strokeStyle = sec <= 10 && this.phase === 'go' ? '#ff4d5e' : 'rgba(255,255,255,.25)'; x.stroke();
      this.text(`⏱ ${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`, W / 2, py + ph / 2 + vh * 0.2, vh * 4.4, sec <= 10 && this.phase === 'go' ? '#ff8a8a' : '#fff', { stroke: false, w: 800 });
      // μπάρα χορού (κάτω από το «Δωμάτιο» της τηλεόρασης)
      const bw = Math.min(W * 0.3, vh * 56), bh = vh * 3.4, bxx = W - bw - vh * 3, byy = vh * 14;
      this.text(LEVEL_NAMES[b.level], bxx + bw, byy - vh * 2.2, vh * 2.7, ['#ffb0a0', '#ffd23d', '#3ee08f', '#ff6fd8'][b.level], { align: 'right', sw: vh * 0.6 });
      this.text('🐻 Χορός', bxx, byy - vh * 2.2, vh * 2.5, '#fff', { align: 'left', sw: vh * 0.6 });
      U.rr(x, bxx, byy, bw, bh, bh / 2); x.fillStyle = 'rgba(15,8,35,.78)'; x.fill();
      x.strokeStyle = 'rgba(255,255,255,.3)'; x.lineWidth = vh * 0.25; x.stroke();
      if (b.shown > 0.005) {
        const g = x.createLinearGradient(bxx, 0, bxx + bw, 0);
        g.addColorStop(0, '#ff9a2e'); g.addColorStop(0.45, '#ffd23d'); g.addColorStop(0.78, '#3ee08f'); g.addColorStop(1, '#ff6fd8');
        x.save(); U.rr(x, bxx + vh * 0.4, byy + vh * 0.4, (bw - vh * 0.8) * b.shown, bh - vh * 0.8, (bh - vh * 0.8) / 2); x.clip();
        x.fillStyle = g; x.fillRect(bxx, byy, bw, bh);
        x.fillStyle = 'rgba(255,255,255,.3)'; x.fillRect(bxx, byy + vh * 0.5, bw, bh * 0.25);
        x.restore();
      }
      for (const t of [0.12, 0.45, 0.78]) { x.fillStyle = 'rgba(255,255,255,.5)'; x.fillRect(bxx + bw * t - 1, byy + vh * 0.5, 2, bh - vh); }

      // κάρτες παικτών
      const n = this.parts.length, cw = Math.min(W * 0.21, vh * 40), ch = vh * 9.5, gap = vh * 2;
      let X = (W - (n * cw + (n - 1) * gap)) / 2;
      const Y = H - ch - vh * 2;
      const best = this.lead();
      for (const p of this.parts) {
        const c = p.color.hex;
        U.rr(x, X, Y, cw, ch, vh * 2);
        x.fillStyle = p.flash > 0 ? U.rgba(c, 0.35 + p.flash * 0.4) : 'rgba(10,5,30,.8)'; x.fill();
        x.lineWidth = vh * 0.35; x.strokeStyle = p.score === best && best > 0 ? '#ffd23d' : U.rgba(c, 0.8); x.stroke();
        // το φαγητό που κρατά τώρα
        if (p.food) this.drawFood(p.food, X + vh * 5, Y + ch / 2, vh * 6.2, 0, 1);
        const name = p.name + (p.bot ? ' 🤖' : '') + (p.p && !p.p.connected ? ' (εκτός)' : '');
        x.font = this.font(vh * 2.5); x.textAlign = 'left'; x.textBaseline = 'middle'; x.fillStyle = c;
        let nm = name; while (x.measureText(nm).width > cw - vh * 19 && nm.length > 2) nm = nm.slice(0, -2) + '…';
        x.fillText(nm, X + vh * 9.5, Y + vh * 3.3);
        x.font = this.font(vh * 1.9, 600); x.fillStyle = '#d9d2f5';
        x.fillText(`${p.eaten} στο στόμα`, X + vh * 9.5, Y + vh * 6.6);
        this.text(String(p.score), X + cw - vh * 2.5, Y + ch / 2 + vh * 0.3, vh * 5.4, '#fff', { align: 'right', fam: 'Comfortaa', w: 700, sw: vh * 0.9 });
        X += cw + gap;
      }
    }
  }

  Mini.games.bear = BearGame;
})();
