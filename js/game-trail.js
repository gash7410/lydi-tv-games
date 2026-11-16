// «Δασόδρομος»: αγώνας δρόμου με εμπόδια σε μονοπάτι μέσα στο δάσος.
// Κάθε πάτημα «ΤΡΕΞΕ» είναι ένας δρασκελισμός· με «ΑΛΜΑ» πηδάς κορμούς, πέτρες, λάσπες και κούτσουρα.
// Αν πέσεις πάνω σε εμπόδιο, σκοντάφτεις και μένεις κάτω για λίγο. Όλοι έχουν τα ίδια εμπόδια στις ίδιες θέσεις.
(function () {
  'use strict';
  const { Base, U } = Mini;
  const DIST = 250;        // μέτρα
  const STRIDE = 1.35;     // μέτρα ανά πάτημα
  const MAX_AHEAD = 3.2;   // πόσα μέτρα «πίστωση» επιτρέπονται (δεν αποθηκεύεις πατήματα)
  const MIN_GAP = 45;      // ms ανάμεσα σε δύο μετρημένα πατήματα
  const JUMP_T = 0.62;     // δευτ. στον αέρα
  const CLEAR = 0.16;      // πάνω από αυτό το ύψος (0..1) περνάς πάνω από το εμπόδιο
  const TRIP_T = 1.25;     // δευτ. κάτω μετά από σκόνταμμα
  const FALSE_PEN = 1;     // δευτ. τιμωρία για άκυρη εκκίνηση
  const AFTER_WIN = 8;     // δευτ. που περιμένουμε τους υπόλοιπους

  const fmt = (s) => s.toFixed(2).replace('.', ',') + '″';
  const TYPES = {
    log:    { w: 1.0, name: 'κορμός' },
    rock:   { w: 0.8, name: 'πέτρα' },
    mud:    { w: 2.3, name: 'λάσπη' },
    stump:  { w: 0.7, name: 'κούτσουρο' },
    hedge:  { w: 1.1, name: 'θάμνος' },
  };

  // σταθερό «τυχαίο» ανά αντικείμενο, για να μη τρεμοπαίζουν τα δέντρα
  const hash = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };

  class TrailGame extends Base {
    constructor(c, h) { super(c, h); this.WIN = 1; this.obs = []; this.dust = []; this.leaves = []; }

    setup() {
      // εμπόδια: ίδια για όλους
      this.obs = [];
      let m = 24;
      const kinds = Object.keys(TYPES);
      let lastK = '';
      while (m < DIST - 16) {
        let k = U.pick(kinds); if (k === lastK) k = U.pick(kinds);
        lastK = k;
        this.obs.push({ m, k, w: TYPES[k].w, seed: Math.random() });
        m += U.rand(13, 22);
      }
      this.dust = []; this.leaves = []; this.splats = [];
      this.parts.forEach((p) => Object.assign(p, {
        taps: 0, credit: 0, pos: 0, v: 0, lastTap: 0, fs: false, fsT: -9, done: false, t: null, place: 0,
        status: '', hi: false, jumpT: -9, tripT: -9, trips: 0, legT: U.rand(0, 6), hitObs: new Set(),
        botNext: 0.3, botRate: U.rand(6.2, 7.4), botSkill: U.rand(0.8, 0.92), botPlan: null,
      }));
      this.phase = 'count'; this.places = 0; this.cam = -4; this.lastStep = 0; this.goT = 0;
      this.banner('Στις θέσεις σας…', '#fff');
      this.after(1, () => this.phase === 'count' && this.banner('Έτοιμοι…', '#fff'));
      this.after(2, () => this.phase === 'count' && this.banner('Περίμενε τη σφυρίχτρα!', '#ffc93d'));
      this.countdown(() => this.go());
      this.changed();
    }

    go() {
      this.phase = 'go'; this.goT = this.time; this.goPerf = performance.now();
      this.sfx('go');
      this.banner('ΤΡΕΞΕ! Πήδα τα εμπόδια!', '#ffc93d');
      this.parts.forEach((p) => { if (!p.fs) p.status = ''; });
      this.changed();
    }

    input(part, msg, now) {
      if (!part || part.done) return;
      if (msg.type === 'jump') return this.jump(part);
      if (msg.type !== 'tap') return;
      if (this.phase === 'count') {
        if (!part.fs && this.time - this.countT > 0.4) {
          part.fs = true; part.fsT = this.time; part.status = 'Άκυρη εκκίνηση!';
          this.sfx('buzz');
          this.fx(part, '⛔ Βιάστηκες! Χάνεις 1 δευτερόλεπτο', [200]);
          this.changed();
        }
        return;
      }
      if (this.phase !== 'go' || now - part.lastTap < MIN_GAP) return;
      part.lastTap = now;
      this.stride(part);
    }

    down(p) { return this.time - p.tripT < TRIP_T; }
    air(p) { const k = (this.time - p.jumpT) / JUMP_T; return k >= 0 && k < 1 ? k : -1; }
    height(p) { const k = this.air(p); return k < 0 ? 0 : 4 * k * (1 - k); }

    stride(p) {
      if (this.phase !== 'go' || p.done || this.down(p)) return;
      if (p.fs && this.time - this.goT < FALSE_PEN) return;
      p.taps++;
      p.credit = Math.min(p.credit + STRIDE, p.pos + MAX_AHEAD, DIST);
      if (this.time - this.lastStep > 0.09 && this.air(p) < 0) { this.lastStep = this.time; this.sfx('step'); }
    }

    jump(p) {
      if (this.phase !== 'go' || p.done || this.down(p) || this.air(p) >= 0) return;
      if (p.fs && this.time - this.goT < FALSE_PEN) return;
      p.jumpT = this.time;
      this.sfx('dash');
    }

    trip(p, o) {
      p.tripT = this.time; p.jumpT = -9; p.trips++;
      p.pos = Math.max(0, o.m - 0.7); p.credit = p.pos; p.v = 0;
      p.hitObs.add(o);
      this.sfx(o.k === 'mud' ? 'splat' : 'bump');
      if (o.k === 'mud') this.splats.push({ m: o.m + 0.6, lane: this.parts.indexOf(p), life: 0.9 });
      const msg = { log: '🪵 Σκόνταψες στον κορμό!', rock: '🪨 Σκόνταψες στην πέτρα!', mud: '💦 Γλίστρησες στη λάσπη!', stump: '🪵 Σκόνταψες στο κούτσουρο!', hedge: '🌿 Μπλέχτηκες στον θάμνο!' }[o.k];
      this.fx(p, msg, [120, 60, 120]);
      p.status = 'Έπεσε!';
      this.changed();
    }

    finishRunner(p) {
      p.done = true;
      p.t = Math.max(0.5, this.time - this.goT);
      p.place = ++this.places;
      p.status = `${p.place}ος · ${fmt(p.t)}`;
      p.hi = p.place === 1;
      if (p.place === 1) {
        p.score = 1;
        this.sfx('finish');
        this.banner(`${p.name} τερμάτισε πρώτος!`, p.color.hex);
        this.fx(p, `🏆 1ος! ${fmt(p.t)}`, [60, 40, 160], true);
        this.after(AFTER_WIN, () => this.endRace());
      } else {
        this.sfx('point');
        this.fx(p, `🏁 ${p.place}ος · ${fmt(p.t)}`, [40]);
      }
      if (this.parts.every((q) => q.done)) this.after(1.6, () => this.endRace());
      this.changed();
    }

    endRace() {
      if (this.phase !== 'go') return;
      this.phase = 'end';
      this.parts.filter((p) => !p.done).forEach((p) => { p.status = `${Math.round(p.pos)} μ.`; });
      this.changed();
      this.finish(this.parts.find((p) => p.place === 1));
    }

    finish(winner) {
      this.celebrate(winner.color.hex);
      this.sfx('win');
      const rank = [...this.parts].sort((a, b) => (a.done ? a.t : 1e9 - a.pos) - (b.done ? b.t : 1e9 - b.pos));
      const fall = (q) => (q.trips ? ` · ${q.trips} ${q.trips === 1 ? 'πτώση' : 'πτώσεις'}` : ' · καμία πτώση');
      this.h.onOver && this.h.onOver({
        winner,
        stats: `Έτρεξε τα ${DIST} μέτρα του δάσους σε ${fmt(winner.t)}${fall(winner)}`,
        rank: rank.map((q) => ({ name: q.name, color: q.color, st: (q.done ? fmt(q.t) : `${Math.round(q.pos)} μ.`) + fall(q) })),
      });
    }

    update(dt) {
      for (const p of this.parts) {
        if (this.phase === 'go' && !p.done) {
          if (p.status && !this.down(p) && (p.status === 'Έπεσε!' || (p.fs && this.time - this.goT > FALSE_PEN))) p.status = '';
          const prev = p.pos;
          if (!this.down(p)) {
            // στον αέρα κρατάς την ορμή σου
            const rate = this.air(p) >= 0 ? Math.max(p.v, 3) : (p.credit - p.pos) * 7;
            p.pos = Math.min(p.credit + (this.air(p) >= 0 ? 0.8 : 0), p.pos + Math.max(0, rate) * dt, DIST);
            if (p.pos > p.credit) p.credit = p.pos;
            if (p.credit - p.pos < 0.03) p.pos = p.credit; // να φτάνει ακριβώς (και στο τέρμα)
          }
          const inst = dt > 0 ? (p.pos - prev) / dt : 0;
          p.v += (inst - p.v) * Math.min(1, dt * 5);
          // έλεγχος εμποδίων
          if (this.height(p) < CLEAR && !this.down(p)) {
            for (const o of this.obs) {
              if (p.hitObs.has(o)) continue;
              if (p.pos > o.m - 0.5 && prev < o.m + o.w + 0.3) { this.trip(p, o); break; }
            }
          }
          if (p.pos >= DIST - 0.01 && !p.done) { p.pos = DIST; this.finishRunner(p); }
        } else if (p.done && p.pos < DIST + 6) {
          p.pos += Math.max(1, p.v * 0.6) * dt; // τρέχει λίγο μετά το τέρμα
          p.v *= 1 - dt * 1.5;
        }
        p.legT += dt * (1.5 + p.v * 1.5);
        if (p.v > 3 && this.air(p) < 0 && Math.random() < dt * p.v * 1.1) this.dust.push({ m: p.pos - 0.5, lane: this.parts.indexOf(p), life: 0.5, dy: U.rand(-1, 1) });
        if (p.bot && this.phase === 'go' && !p.done) this.bot(p, dt);
      }
      for (const d of this.dust) d.life -= dt;
      this.dust = this.dust.filter((d) => d.life > 0);
      for (const s of this.splats) s.life -= dt;
      this.splats = this.splats.filter((s) => s.life > 0);
      // πεσμένα φύλλα που πέφτουν από τα δέντρα
      if (Math.random() < dt * 1.3) this.leaves.push({ x: U.rand(0, 1.1), y: -0.05, vy: U.rand(0.05, 0.11), ph: U.rand(0, 6), c: U.pick(['#e9a23b', '#d9682f', '#9cc94a', '#f2c94c']) });
      for (const l of this.leaves) { l.y += l.vy * dt; l.x += Math.sin(this.time * 1.5 + l.ph) * 0.0008 - 0.0006; }
      this.leaves = this.leaves.filter((l) => l.y < 1.05);
      // κάμερα: ακολουθεί τον πρώτο, αλλά προσπαθεί να χωρέσει και τον τελευταίο
      const ds = this.parts.map((p) => p.pos);
      const lead = Math.max(...ds), tail = Math.min(...ds);
      const span = this.span();
      const want = U.clamp(Math.max(lead - span * 0.6, Math.min(tail - span * 0.12, lead - span * 0.32)), -span * 0.12, DIST + 14 - span);
      this.cam += (want - this.cam) * Math.min(1, dt * 3);
    }

    // απλό ρομπότ: τρέχει σταθερά και πηδάει (σχεδόν πάντα) στη σωστή στιγμή
    bot(p, dt) {
      p.botNext -= dt;
      if (p.botNext <= 0) {
        this.stride(p);
        const tired = this.time - this.goT > 20 ? 0.92 : 1;
        p.botNext = 1 / (p.botRate * tired * U.rand(0.85, 1.15));
      }
      const next = this.obs.find((o) => o.m + o.w > p.pos && !p.hitObs.has(o));
      if (!next) return;
      if (p.botPlan !== next) {
        p.botPlan = next;
        // λάθος μόνο μερικές φορές: πηδάει πολύ νωρίς ή πολύ αργά
        p.botOff = Math.random() < p.botSkill ? U.rand(-0.3, 0.3) : (Math.random() < 0.6 ? U.rand(2.6, 3.4) : U.rand(-2.2, -1.6));
      }
      // πηδά ώστε το μέσο του άλματος να πέφτει στο μέσο του εμποδίου
      const v = Math.max(p.v, 3);
      const mid = next.m + next.w / 2 - p.pos;
      if (this.air(p) < 0 && p.botDone !== next && mid <= v * JUMP_T * 0.5 + p.botOff) { this.jump(p); p.botDone = next; }
    }

    span() { return Math.max(26, (this.W / this.vh) * 0.3); }

    ctrl(part) {
      if (this.phase === 'go') {
        if (part && part.done) return { mode: 'run', label: 'Τερμάτισες!', sub: 'Κοίτα την τηλεόραση', active: false };
        return { mode: 'run', label: 'ΤΡΕΞΕ', sub: 'Πάτα «ΤΡΕΞΕ» γρήγορα και «ΑΛΜΑ» λίγο πριν από κάθε εμπόδιο', active: true };
      }
      if (this.phase === 'count') return { mode: 'run', label: 'Περίμενε…', sub: 'ΜΗΝ πατήσεις πριν τη σφυρίχτρα!', active: false };
      return { mode: 'run', label: 'Τέλος!', sub: 'Δες τα αποτελέσματα στην τηλεόραση', active: false };
    }

    // ---------- σχέδιο ----------
    geo() {
      const W = this.W, H = this.H, vh = this.vh, n = this.parts.length;
      const top = H * 0.47, bot = H * 0.86;
      const lh = (bot - top) / Math.max(n, 2.6);
      const t0 = top + ((bot - top) - lh * n) / 2;
      const ppm = W / this.span();
      return { W, H, vh, n, top, bot, lh, t0, ppm, X: (m) => (m - this.cam) * ppm };
    }

    draw() {
      const x = this.ctx, G = this.geo(), { W, H, vh } = G;
      const camPx = this.cam * G.ppm;
      // ουρανός πρωινός
      const sky = x.createLinearGradient(0, 0, 0, H * 0.45);
      sky.addColorStop(0, '#7cc4ef'); sky.addColorStop(1, '#e6f4d9');
      x.fillStyle = sky; x.fillRect(0, 0, W, H);
      // ήλιος
      x.fillStyle = 'rgba(255,240,170,.55)'; x.beginPath(); x.arc(W * 0.8, H * 0.12, vh * 9, 0, 7); x.fill();
      x.fillStyle = '#fff3b0'; x.beginPath(); x.arc(W * 0.8, H * 0.12, vh * 6, 0, 7); x.fill();
      // βουνά (πολύ αργό parallax)
      this.hills(camPx * 0.06, H * 0.3, vh * 12, '#8fb6c9', 1.7, 11);
      this.hills(camPx * 0.12, H * 0.36, vh * 9, '#6f9fa0', 1.1, 23);
      // μακρινά έλατα
      this.forest(camPx * 0.25, H * 0.42, vh * 11, '#3f7a5a', '#2f6449', 0.022, 1, false);
      // πιο κοντινά δέντρα πίσω από το μονοπάτι
      this.forest(camPx * 0.55, G.top - vh * 1.5, vh * 19, '#2f8a4a', '#226a38', 0.06, 2, true);
      // λιβάδι και χωμάτινο μονοπάτι
      x.fillStyle = '#6dbb4a'; x.fillRect(0, G.top - vh * 3, W, H);
      const path = x.createLinearGradient(0, G.t0, 0, G.t0 + G.lh * G.n);
      path.addColorStop(0, '#c89a5e'); path.addColorStop(1, '#b0814a');
      x.fillStyle = path; x.fillRect(0, G.t0 - vh * 0.8, W, G.lh * G.n + vh * 1.6);
      // άκρες μονοπατιού με χορτάρι
      x.fillStyle = '#5aa63c';
      for (const yy of [G.t0 - vh * 0.8, G.t0 + G.lh * G.n + vh * 0.8]) {
        const off = -((camPx) % (vh * 3) + vh * 3) % (vh * 3);
        for (let X = off; X < W + vh * 3; X += vh * 3) {
          x.beginPath(); x.moveTo(X, yy); x.lineTo(X + vh * 0.8, yy - vh * 1.4); x.lineTo(X + vh * 1.6, yy); x.lineTo(X + vh * 2.2, yy - vh * 0.9); x.lineTo(X + vh * 3, yy); x.fill();
        }
      }
      // λωρίδες: αυλάκια στο χώμα
      x.strokeStyle = 'rgba(90,55,25,.28)'; x.lineWidth = vh * 0.3; x.setLineDash([vh * 2, vh * 1.6]);
      x.lineDashOffset = camPx % (vh * 3.6);
      for (let i = 1; i < G.n; i++) { const y = G.t0 + i * G.lh; x.beginPath(); x.moveTo(0, y); x.lineTo(W, y); x.stroke(); }
      x.setLineDash([]);
      // βότσαλα στο μονοπάτι
      for (let k = Math.floor(this.cam / 2.5) - 1; k * 2.5 < this.cam + this.span() + 3; k++) {
        const r = hash(k), X = G.X(k * 2.5 + r * 2), y = G.t0 + hash(k + 99) * G.lh * G.n;
        x.fillStyle = 'rgba(120,85,50,.45)'; x.beginPath(); x.ellipse(X, y, vh * (0.4 + r * 0.5), vh * 0.3, 0, 0, 7); x.fill();
      }
      // πινακίδες απόστασης κάθε 50 μ.
      for (let m = 50; m < DIST; m += 50) this.sign(G, m, `${m} μ.`);
      this.startLine(G);
      this.finishLine(G);
      // λωρίδα-λωρίδα: εμπόδια, σκόνη και δρομείς (πίσω προς τα μπρος)
      this.parts.forEach((p, i) => {
        const base = G.t0 + (i + 0.82) * G.lh;
        for (const o of this.obs) this.obstacle(G, o, base, p.hitObs.has(o));
        for (const d of this.dust) if (d.lane === i) {
          x.fillStyle = `rgba(230,200,150,${d.life})`; x.beginPath(); x.arc(G.X(d.m) - (0.5 - d.life) * vh * 4, base + d.dy * vh * 0.6, vh * (0.6 + (0.5 - d.life) * 2), 0, 7); x.fill();
        }
        for (const s of this.splats) if (s.lane === i) {
          x.fillStyle = `rgba(95,62,30,${Math.min(1, s.life * 1.5)})`;
          for (let k = 0; k < 6; k++) { const a = k * 1.05 + 0.3, r = (1 - s.life) * vh * 5; x.beginPath(); x.arc(G.X(s.m) + Math.cos(a) * r, base - vh * 1.5 - Math.abs(Math.sin(a)) * r, vh * 0.55, 0, 7); x.fill(); }
        }
        this.runner(G, p, i, base);
      });
      // μπροστινές φτέρες (λίγο πιο γρήγορο parallax)
      this.ferns(camPx * 1.25, G.t0 + G.lh * G.n + vh * 2.4);
      // φύλλα που πέφτουν
      for (const l of this.leaves) {
        x.save(); x.translate(l.x * W, l.y * H); x.rotate(this.time * 2 + l.ph);
        x.fillStyle = l.c; x.beginPath(); x.ellipse(0, 0, vh * 0.9, vh * 0.45, 0, 0, 7); x.fill(); x.restore();
      }
      this.hud(G);
      if (this.phase === 'count' || this.time - this.goT < 0.7) this.drawCount(this.countT, 'ΤΡΕΞΕ!');
    }

    hills(off, baseY, amp, col, freq, seed) {
      const x = this.ctx, W = this.W;
      x.fillStyle = col; x.beginPath(); x.moveTo(0, this.H);
      for (let X = 0; X <= W + 20; X += 20) {
        const u = (X + off) / W * freq;
        const y = baseY - amp * (0.55 + 0.3 * Math.sin(u * 2.1 + seed) + 0.15 * Math.sin(u * 5.3 + seed * 2));
        x.lineTo(X, y);
      }
      x.lineTo(W, this.H); x.closePath(); x.fill();
    }

    // σειρά από δέντρα με σταθερές θέσεις στον «κόσμο» της κάθε στρώσης
    forest(off, baseY, size, c1, c2, step, layer, round) {
      const x = this.ctx, W = this.W, lw = this.lw;
      const gap = W * step * (layer === 1 ? 1 : 1.9);
      const k0 = Math.floor(off / gap) - 1;
      for (let k = k0; k * gap - off < W + gap; k++) {
        const r = hash(k * 7 + layer * 1000), X = k * gap - off + r * gap * 0.6;
        const s = size * (0.7 + hash(k * 13 + layer) * 0.5);
        if (layer === 1) {
          x.fillStyle = r < 0.5 ? c1 : c2;
          x.beginPath(); x.moveTo(X, baseY - s); x.lineTo(X + s * 0.32, baseY); x.lineTo(X - s * 0.32, baseY); x.fill();
          continue;
        }
        x.lineWidth = lw; x.strokeStyle = 'rgba(28,26,43,.55)';
        // κορμός
        x.fillStyle = '#7a4f2c'; x.fillRect(X - s * 0.05, baseY - s * 0.35, s * 0.1, s * 0.37);
        if (round && r > 0.55) { // φυλλοβόλο δέντρο
          x.fillStyle = r > 0.8 ? '#4e9d3a' : '#3d8b3f';
          for (const [dx, dy, rr] of [[0, -0.62, 0.3], [-0.2, -0.48, 0.22], [0.2, -0.47, 0.23], [0, -0.42, 0.24]]) { x.beginPath(); x.arc(X + dx * s, baseY + dy * s, rr * s, 0, 7); x.fill(); }
          x.fillStyle = 'rgba(255,255,255,.12)'; x.beginPath(); x.arc(X - s * 0.08, baseY - s * 0.7, s * 0.12, 0, 7); x.fill();
        } else { // έλατο σε τρία επίπεδα
          for (let t = 0; t < 3; t++) {
            const w = s * (0.36 - t * 0.08), yb = baseY - s * (0.25 + t * 0.22);
            x.fillStyle = t % 2 ? c2 : c1;
            x.beginPath(); x.moveTo(X, yb - s * 0.36); x.lineTo(X + w, yb); x.lineTo(X - w, yb); x.closePath(); x.fill(); x.stroke();
          }
        }
      }
    }

    ferns(off, y) {
      const x = this.ctx, vh = this.vh, gap = vh * 16;
      for (let k = Math.floor(off / gap) - 1; k * gap - off < this.W + gap; k++) {
        const r = hash(k * 31 + 5); if (r < 0.35) continue;
        const X = k * gap - off + r * gap * 0.5;
        x.fillStyle = r > 0.7 ? '#3f8f3a' : '#4fa443';
        for (let j = -2; j <= 2; j++) {
          x.save(); x.translate(X, y); x.rotate(j * 0.38);
          x.beginPath(); x.ellipse(0, -vh * 2.2, vh * 0.9, vh * 2.6, 0, 0, 7); x.fill(); x.restore();
        }
        if (r > 0.85) { x.fillStyle = '#f26b8a'; x.beginPath(); x.arc(X + vh, y - vh * 3, vh * 0.7, 0, 7); x.fill(); }
      }
    }

    sign(G, m, label) {
      const x = this.ctx, X = G.X(m), vh = G.vh, y = G.t0 - vh * 0.8;
      if (X < -vh * 10 || X > G.W + vh * 10) return;
      x.lineWidth = this.lw; x.strokeStyle = U.INK;
      x.fillStyle = '#8a5a32'; x.fillRect(X - vh * 0.4, y - vh * 7, vh * 0.8, vh * 7); x.strokeRect(X - vh * 0.4, y - vh * 7, vh * 0.8, vh * 7);
      U.rr(x, X - vh * 4.6, y - vh * 10, vh * 9.2, vh * 3.8, vh * 0.8); x.fillStyle = '#c98d55'; x.fill(); x.stroke();
      this.text(label, X, y - vh * 8.1, vh * 2.2, '#fff6e0', { sw: vh * 0.45 });
    }

    startLine(G) {
      const x = this.ctx, X = G.X(0), vh = G.vh;
      if (X < -vh * 10 || X > G.W + vh * 10) return;
      x.fillStyle = 'rgba(255,255,255,.85)'; x.fillRect(X - vh * 0.4, G.t0, vh * 0.8, G.lh * G.n);
      this.text('ΕΚΚΙΝΗΣΗ', X, G.t0 + G.lh * G.n + vh * 2.8, vh * 2.2, '#fff', { sw: vh * 0.5 });
    }

    finishLine(G) {
      const x = this.ctx, X = G.X(DIST), vh = G.vh;
      if (X < -vh * 20 || X > G.W + vh * 20) return;
      const sq = vh * 1.2, hgt = G.lh * G.n;
      for (let r = 0; r * sq < hgt; r++) for (let c = 0; c < 2; c++) {
        x.fillStyle = (r + c) % 2 ? U.INK : '#fff';
        x.fillRect(X - sq + c * sq, G.t0 + r * sq, sq, Math.min(sq, hgt - r * sq));
      }
      // ξύλινη αψίδα με γιρλάντα
      const top = G.top - vh * 16, bot = G.t0 + hgt;
      x.lineWidth = this.lw * 1.2; x.strokeStyle = U.INK;
      for (const px of [X - vh * 2.2, X + vh * 2.2]) {
        x.fillStyle = '#8a5a32'; x.fillRect(px - vh * 0.8, top, vh * 1.6, bot - top); x.strokeRect(px - vh * 0.8, top, vh * 1.6, bot - top);
      }
      U.rr(x, X - vh * 10, top - vh * 5.5, vh * 20, vh * 6, vh * 1.2); x.fillStyle = '#c98d55'; x.fill(); x.stroke();
      this.text('ΤΕΡΜΑ', X, top - vh * 2.5, vh * 3.2, '#fff6e0', { fam: 'Comfortaa', w: 700, sw: vh * 0.6 });
      const cols = ['#f0544f', '#ffc93d', '#3da9ff', '#2ecc71', '#9b5de5'];
      for (let k = 0; k < 9; k++) {
        const fx = X - vh * 9 + k * vh * 2.25, fy = top + vh * 1.2 + Math.sin(k / 8 * Math.PI) * vh * 1.4;
        x.fillStyle = cols[k % cols.length]; x.beginPath(); x.moveTo(fx - vh * 0.8, fy - vh * 0.6); x.lineTo(fx + vh * 0.8, fy - vh * 0.6); x.lineTo(fx, fy + vh * 1.3); x.fill();
      }
    }

    obstacle(G, o, base, hit) {
      const x = this.ctx, vh = G.vh, X0 = G.X(o.m), X1 = G.X(o.m + o.w);
      if (X1 < -vh * 6 || X0 > G.W + vh * 6) return;
      const s = Math.min(G.lh / (vh * 13), 1.2) * vh * 1.6, cx = (X0 + X1) / 2, w = X1 - X0;
      x.lineWidth = this.lw; x.strokeStyle = U.INK; x.lineJoin = 'round';
      if (o.k === 'mud') {
        x.fillStyle = '#5e3d1f'; x.beginPath(); x.ellipse(cx, base - s * 0.4, w / 2 + s, s * 1.5, 0, 0, 7); x.fill(); x.stroke();
        x.fillStyle = '#7a5530'; x.beginPath(); x.ellipse(cx - w * 0.12, base - s * 0.7, w * 0.28, s * 0.6, 0, 0, 7); x.fill();
        x.fillStyle = 'rgba(255,255,255,.3)'; x.beginPath(); x.ellipse(cx + w * 0.2, base - s * 0.5, s * 0.8, s * 0.25, 0, 0, 7); x.fill();
        return;
      }
      // σκιά
      x.fillStyle = 'rgba(0,0,0,.22)'; x.beginPath(); x.ellipse(cx, base, w / 2 + s * 1.2, s * 0.9, 0, 0, 7); x.fill();
      if (o.k === 'log') {
        const r = s * 1.9, L = w / 2 + s * 1.5;
        x.save(); x.translate(cx, base - r); if (hit) x.rotate(0.12);
        U.rr(x, -L, -r, L * 2, r * 2, r); x.fillStyle = '#8b5a2b'; x.fill(); x.stroke();
        x.strokeStyle = 'rgba(40,20,5,.45)'; x.lineWidth = s * 0.3;
        for (const k of [-0.5, 0, 0.45]) { x.beginPath(); x.moveTo(-L + r, k * r); x.lineTo(L - r * 1.4, k * r + s * 0.2); x.stroke(); }
        x.lineWidth = this.lw; x.strokeStyle = U.INK;
        x.fillStyle = '#e1b47a'; x.beginPath(); x.ellipse(L - r * 0.6, 0, r * 0.6, r * 0.95, 0, 0, 7); x.fill(); x.stroke();
        x.strokeStyle = '#a77a45'; x.lineWidth = s * 0.25; x.beginPath(); x.ellipse(L - r * 0.6, 0, r * 0.3, r * 0.5, 0, 0, 7); x.stroke();
        x.restore();
      } else if (o.k === 'rock') {
        const r = s * 2.4;
        x.fillStyle = '#9aa0a8';
        x.beginPath(); x.moveTo(cx - r * 1.2, base); x.quadraticCurveTo(cx - r * 1.1, base - r * 1.3, cx - r * 0.1, base - r * 1.5);
        x.quadraticCurveTo(cx + r * 1.2, base - r * 1.4, cx + r * 1.25, base); x.closePath(); x.fill(); x.stroke();
        x.fillStyle = '#c3c8cf'; x.beginPath(); x.ellipse(cx - r * 0.35, base - r * 1.05, r * 0.35, r * 0.18, -0.4, 0, 7); x.fill();
        x.fillStyle = '#5fa04a'; x.beginPath(); x.ellipse(cx + r * 0.5, base - r * 1.25, r * 0.4, r * 0.15, 0.3, 0, 7); x.fill();
      } else if (o.k === 'stump') {
        const r = s * 1.8, h = s * 3.4;
        x.fillStyle = '#7a4f2c'; x.beginPath(); x.moveTo(cx - r * 1.25, base); x.lineTo(cx - r, base - h); x.lineTo(cx + r, base - h); x.lineTo(cx + r * 1.25, base); x.closePath(); x.fill(); x.stroke();
        x.fillStyle = '#e1b47a'; x.beginPath(); x.ellipse(cx, base - h, r, r * 0.42, 0, 0, 7); x.fill(); x.stroke();
        x.strokeStyle = '#a77a45'; x.lineWidth = s * 0.22; x.beginPath(); x.ellipse(cx, base - h, r * 0.5, r * 0.2, 0, 0, 7); x.stroke();
        x.fillStyle = '#e8564f'; x.strokeStyle = U.INK; x.lineWidth = this.lw * 0.7;
        x.beginPath(); x.arc(cx + r * 1.1, base - s * 0.9, s * 0.9, Math.PI, 0); x.closePath(); x.fill(); x.stroke();
        x.fillStyle = '#fff'; x.beginPath(); x.arc(cx + r * 1.0, base - s * 1.4, s * 0.18, 0, 7); x.fill();
      } else if (o.k === 'hedge') {
        const r = s * 1.7;
        const pts = [[-1.1, -0.9], [-0.4, -1.5], [0.4, -1.45], [1.1, -0.9], [0, -0.85]];
        for (const [dx, dy] of pts) { x.fillStyle = hit ? '#3f8a35' : '#4a9e3d'; x.beginPath(); x.arc(cx + dx * r, base + dy * r, r, 0, 7); x.fill(); x.stroke(); }
        x.fillStyle = '#4a9e3d'; for (const [dx, dy] of pts) { x.beginPath(); x.arc(cx + dx * r, base + dy * r, r - this.lw * 0.6, 0, 7); x.fill(); }
        x.fillStyle = '#d93a5a'; for (const [dx, dy] of [[-0.6, -1.5], [0.7, -1.7], [0.1, -1.1], [1.2, -1.1]]) { x.beginPath(); x.arc(cx + dx * r, base + dy * r, s * 0.32, 0, 7); x.fill(); }
      }
    }

    runner(G, p, i, base) {
      const x = this.ctx, vh = G.vh, c = p.color.hex;
      const X = G.X(p.pos);
      const s = Math.min(G.lh / (vh * 13), 1.2) * vh;
      if (X < -s * 12) {
        U.rr(x, s * 1, base - s * 6, s * 9, s * 4.2, s * 2); x.fillStyle = c; x.fill();
        x.lineWidth = this.lw; x.strokeStyle = U.INK; x.stroke();
        this.text(`◀ ${Math.round(p.pos)}μ`, s * 5.5, base - s * 3.9, s * 2, '#fff', { sw: s * 0.4 });
        return;
      }
      const down = this.down(p) && this.phase !== 'count';
      const hgt = this.height(p) * s * 9;
      const inAir = this.air(p) >= 0;
      const run = this.phase !== 'count' && p.v > 0.5 && !down && !(p.done && p.v < 1);
      const a = inAir ? 0.9 : run ? Math.sin(p.legT) : 0;
      const bob = run && !inAir ? Math.abs(Math.cos(p.legT)) * s * 0.9 : 0;
      const lean = down ? 0 : run ? Math.min(0.32, p.v * 0.03) : 0;
      // σκιά (μικραίνει όταν είναι στον αέρα)
      const sk = 1 - this.height(p) * 0.5;
      x.fillStyle = 'rgba(0,0,0,.22)'; x.beginPath(); x.ellipse(X, base, s * 4.2 * sk, s * sk, 0, 0, 7); x.fill();
      x.save(); x.translate(X, base - bob - hgt);
      if (down) { // πεσμένος μπρούμυτα και σηκώνεται σιγά σιγά
        const k = (this.time - p.tripT) / TRIP_T;
        const ang = k < 0.15 ? (k / 0.15) * 1.35 : k < 0.7 ? 1.35 : 1.35 * (1 - (k - 0.7) / 0.3);
        x.translate(s * 2, 0); x.rotate(ang); x.translate(-s * 2, 0);
      }
      x.lineCap = 'round'; x.lineJoin = 'round';
      const hip = -s * 5.2;
      const leg = (ang, col) => {
        const kx = Math.sin(ang) * s * 2.6, ky = hip + s * 2.6 - (inAir ? s * 1 : 0);
        const fx = kx + Math.sin(ang - (inAir ? 2.2 : 0.9)) * s * 2.2 * (run || inAir ? 1 : 0), fy = ky + s * 2.5 - (run ? Math.max(0, Math.sin(ang + 1.2)) * s * 1.2 : 0);
        x.strokeStyle = U.INK; x.lineWidth = s * 2.1;
        x.beginPath(); x.moveTo(0, hip); x.lineTo(kx, ky); x.lineTo(fx, fy); x.stroke();
        x.strokeStyle = col; x.lineWidth = s * 1.3; x.stroke();
        x.fillStyle = '#fff'; x.strokeStyle = U.INK; x.lineWidth = s * 0.45;
        x.beginPath(); x.ellipse(fx + s * 0.7, fy + s * 0.2, s * 1.35, s * 0.7, 0, 0, 7); x.fill(); x.stroke();
      };
      const arm = (ang, col) => {
        x.strokeStyle = U.INK; x.lineWidth = s * 1.7;
        const sy = -s * 9.2, ex = Math.sin(ang) * s * 2.2, ey = sy + s * 2.2 * (inAir ? -0.6 : 1), hx = ex + Math.sin(ang + 1.3) * s * 1.8, hy = ey + s * 0.6 * (inAir ? -2 : 1);
        x.beginPath(); x.moveTo(0, sy); x.lineTo(ex, ey); x.lineTo(hx, hy); x.stroke();
        x.strokeStyle = col; x.lineWidth = s * 1.05; x.stroke();
        x.fillStyle = '#ffd9b3'; x.beginPath(); x.arc(hx, hy, s * 0.75, 0, 7); x.fill();
      };
      leg(-a * 0.9, U.shade(c, -0.3));
      x.rotate(lean);
      arm(a * 1.1, U.shade(c, -0.3));
      x.lineWidth = this.lw * 1.1; x.strokeStyle = U.INK;
      U.rr(x, -s * 2.6, -s * 11.2, s * 5.2, s * 6.8, s * 2); x.fillStyle = c; x.fill(); x.stroke();
      x.fillStyle = '#fff'; U.rr(x, -s * 1.5, -s * 8.6, s * 3, s * 2.6, s * 0.4); x.fill();
      this.text(String(i + 1), 0, -s * 7.25, s * 2, U.INK, { stroke: false });
      x.fillStyle = '#ffd9b3'; x.beginPath(); x.arc(s * 0.3, -s * 13.6, s * 2.7, 0, 7); x.fill(); x.stroke();
      // κασκέτο
      x.fillStyle = c; x.beginPath(); x.arc(s * 0.3, -s * 13.6, s * 2.75, Math.PI * 1.05, Math.PI * 1.95); x.closePath(); x.fill(); x.stroke();
      x.beginPath(); x.ellipse(s * 2.9, -s * 14.6, s * 1.5, s * 0.45, 0.15, 0, 7); x.fill(); x.stroke();
      x.fillStyle = U.INK;
      if (down) { x.font = this.font(s * 1.6); x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('×', s * 1.6, -s * 13.3); }
      else { x.beginPath(); x.ellipse(s * 1.6, -s * 13.4, s * 0.38, s * 0.55, 0, 0, 7); x.fill(); }
      x.restore();
      x.save(); x.translate(X, base - bob - hgt);
      if (down) {
        const k = (this.time - p.tripT) / TRIP_T;
        const ang = k < 0.15 ? (k / 0.15) * 1.35 : k < 0.7 ? 1.35 : 1.35 * (1 - (k - 0.7) / 0.3);
        x.translate(s * 2, 0); x.rotate(ang); x.translate(-s * 2, 0);
      }
      x.rotate(lean);
      leg(a * 0.9, c);
      arm(-a * 1.1, c);
      x.restore();
      if (down || (p.fs && this.time - this.goT < FALSE_PEN && this.phase !== 'count' && this.phase !== 'end')) {
        this.text('💫', X + s * 2, base - s * (down ? 8 : 18), s * 3, '#fff', { stroke: false });
      }
      if (p.done) {
        const pl = p.place === 1 ? '🏆 1ος' : `${p.place}ος`;
        this.text(`${pl} ${fmt(p.t)}`, X, base - hgt - s * 20, s * 2.3, p.place === 1 ? '#ffc93d' : '#fff', { sw: s * 0.5 });
      } else {
        this.text(p.name + (p.bot ? ' 🤖' : ''), X, base - hgt - s * 19.5, s * 2.1, c, { sw: s * 0.5 });
      }
    }

    hud(G) {
      const x = this.ctx, { W, vh } = G;
      const bw = Math.min(W * 0.62, vh * 110), bx = (W - bw) / 2 - vh * 4, by = vh * 11.5;
      U.rr(x, bx - vh, by - vh * 1.6, bw + vh * 2, vh * 3.2, vh * 1.6); x.fillStyle = 'rgba(20,35,15,.72)'; x.fill();
      // εμπόδια στη μπάρα
      for (const o of this.obs) { const X = bx + (o.m / DIST) * bw; x.fillStyle = 'rgba(255,220,160,.45)'; x.fillRect(X - vh * 0.2, by - vh * 0.7, vh * 0.4, vh * 1.4); }
      this.text('🏁', bx + bw + vh * 3.4, by, vh * 3, '#fff', { stroke: false });
      [...this.parts].sort((a, b) => a.pos - b.pos).forEach((p) => {
        const X = bx + (Math.min(DIST, p.pos) / DIST) * bw;
        x.beginPath(); x.arc(X, by, vh * 1.25, 0, 7); x.fillStyle = p.color.hex; x.fill();
        x.lineWidth = vh * 0.3; x.strokeStyle = U.INK; x.stroke();
      });
      if (this.phase !== 'count') {
        const lead = this.parts.find((p) => p.place === 1);
        const t = lead ? lead.t : this.time - this.goT;
        this.text(fmt(t), bx + bw + vh * 11, by, vh * 3.4, '#fff', { fam: 'Comfortaa', w: 700, sw: vh * 0.7 });
      }
      const n = this.parts.length, cw = Math.min(W * 0.21, vh * 40), ch = vh * 7.2, gap = vh * 2;
      let X = (W - (n * cw + (n - 1) * gap)) / 2;
      const Y = this.H - ch - vh * 2;
      for (const p of this.parts) {
        const c = p.color.hex;
        U.rr(x, X, Y, cw, ch, vh * 2);
        x.fillStyle = 'rgba(15,25,12,.82)'; x.fill();
        x.lineWidth = vh * 0.35; x.strokeStyle = p.hi ? c : 'rgba(255,255,255,.16)'; x.stroke();
        x.font = this.font(vh * 2.4); x.textAlign = 'left'; x.textBaseline = 'middle'; x.fillStyle = c;
        let nm = p.name + (p.bot ? ' 🤖' : '') + (p.p && !p.p.connected ? ' (εκτός)' : '');
        while (x.measureText(nm).width > cw * 0.55 && nm.length > 2) nm = nm.slice(0, -2) + '…';
        x.fillText(nm, X + vh * 2, Y + ch / 2);
        x.textAlign = 'right'; x.fillStyle = p.status === 'Έπεσε!' ? '#ffb38a' : '#e9e4ff'; x.font = this.font(vh * 2.3, 700);
        x.fillText(p.status || `${Math.floor(Math.min(DIST, p.pos))} μ.`, X + cw - vh * 2, Y + ch / 2);
        X += cw + gap;
      }
    }
  }

  Mini.games.trail = TrailGame;
})();
