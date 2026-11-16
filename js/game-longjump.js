// «Άλμα εις μήκος»: όλοι τρέχουν ταυτόχρονα στον διάδρομό τους και πηδούν στη σανίδα.
// «ΤΡΕΞΕ» = ταχύτητα, «ΑΛΜΑ» = απογείωση. Πέρα από τη γραμμή = άκυρο.
// Απόσταση = πτήση (από την ταχύτητα) μείον όσο απείχες από τη σανίδα. 3 προσπάθειες, μετράει το καλύτερο.
(function () {
  'use strict';
  const { Base, U } = Mini;
  const RUN = 30;          // μέτρα φόρας πριν τη σανίδα
  const STRIDE = 1.2;      // μέτρα ανά πάτημα (8 πατήματα/δευτ. ≈ 9,6 μ./δευτ.)
  const MAX_AHEAD = 3;     // «πίστωση» πατημάτων
  const MIN_GAP = 45;      // ms ανάμεσα σε δύο μετρημένα πατήματα
  const PIT0 = 0.6, PIT1 = 10.6; // σκάμμα με άμμο (μέτρα μετά τη σανίδα)
  const TRIES = 3;
  const LIMIT = 11;        // δευτ. για κάθε προσπάθεια

  const fmtm = (d) => d.toFixed(2).replace('.', ',') + ' μ.';
  const short = (d) => (d == null ? '✗' : d.toFixed(2).replace('.', ','));

  class LongJumpGame extends Base {
    constructor(c, h) { super(c, h); this.WIN = 1; this.crowd = []; this.sand = []; }

    setup() {
      this.crowd = Array.from({ length: 170 }, () => ({ x: Math.random(), y: Math.random(), c: U.pick(['#f0544f', '#3da9ff', '#ffc93d', '#2ecc71', '#9b5de5', '#ff8fc7', '#ffffff']), ph: U.rand(0, 6) }));
      this.parts.forEach((p) => Object.assign(p, { tries: [], best: null, status: '', hi: false, botRate: U.rand(7, 8.2) }));
      this.round = 0; this.sand = []; this.cam = -RUN - 4;
      this.newTry();
    }

    newTry() {
      this.round++;
      this.parts.forEach((p) => Object.assign(p, {
        st: 'run', pos: -RUN, credit: -RUN, v: 0, lastTap: 0, legT: U.rand(0, 6), toff: 0, land: 0, flyT: 0, flyDur: 0, foul: '', status: '',
        botNext: 0.25, botAt: Math.random() < 0.12 ? U.rand(0.08, 0.5) : U.rand(-0.9, -0.04),
      }));
      this.phase = 'count'; this.goT = 0; this.sand = [];
      this.banner(`Προσπάθεια ${this.round} από ${TRIES}`, '#fff');
      this.after(1.5, () => this.phase === 'count' && this.banner('Πήδα πάνω στη λευκή σανίδα!', '#ffc93d'));
      this.countT = this.time + 0.8;
      this.after(0.8, () => this.countdown(() => this.go()));
      this.changed();
    }

    go() {
      this.phase = 'go'; this.goT = this.time;
      this.banner('ΤΡΕΞΕ!', '#ffc93d');
      const r = this.round;
      this.after(LIMIT, () => { if (this.phase === 'go' && this.round === r) this.parts.filter((p) => p.st === 'run').forEach((p) => this.fault(p, 'Δεν πήδηξε')); });
      this.changed();
    }

    input(part, msg, now) {
      if (!part || this.phase !== 'go' || part.st !== 'run') return;
      if (msg.type === 'jump') return this.takeoff(part, part.p && part.p.rtt ? Math.min(0.15, part.p.rtt / 2000) : 0);
      if (msg.type !== 'tap' || now - part.lastTap < MIN_GAP) return;
      part.lastTap = now;
      this.stride(part);
    }

    stride(p) {
      if (p.st !== 'run') return;
      p.credit = Math.min(p.credit + STRIDE, p.pos + MAX_AHEAD);
      if (this.time - (this.lastStep || 0) > 0.09) { this.lastStep = this.time; this.sfx('step'); }
    }

    // lag = δευτ. καθυστέρησης δικτύου: η απογείωση γίνεται εκεί που ήταν ο δρομέας όταν πατήθηκε το κουμπί
    takeoff(p, lag = 0) {
      if (p.st !== 'run' || p.pos < -RUN + 2) return;
      const v = p.v;
      p.pos = Math.max(-RUN, p.pos - v * lag);
      const flight = Math.min(PIT1 - 0.4 - p.pos, Math.max(0.6, v * 0.75));
      p.toff = p.pos;
      p.land = p.pos + flight;
      p.flyT = this.time; p.flyDur = 0.38 + flight * 0.075;
      p.foul = p.pos > 0.2 ? 'Πάτησε τη γραμμή' : '';
      p.st = 'air';
      this.sfx('dash');
    }

    // άκυρη προσπάθεια χωρίς άλμα (πέρασε τη σανίδα τρέχοντας ή δεν πρόλαβε)
    fault(p, why) {
      p.foul = why; p.st = 'done'; p.land = null;
      p.tries.push(null); p.status = '✗ Άκυρο';
      this.sfx('buzz');
      this.fx(p, `🚩 Άκυρο: ${why}`, [200]);
      this.checkAll();
    }

    landed(p) {
      p.st = 'done';
      for (let k = 0; k < 18; k++) this.sand.push({ m: p.land, lane: this.parts.indexOf(p), vx: U.rand(-2.5, 2.5), vy: U.rand(2, 6), y: 0, life: 0.8 });
      this.sfx('splash');
      if (p.foul) {
        p.tries.push(null); p.status = '✗ Άκυρο';
        this.sfx('buzz');
        this.fx(p, `🚩 Άκυρο! ${p.foul}`, [200]);
      } else {
        const d = Math.round(p.land * 100) / 100;
        const rec = p.best == null || d > p.best;
        p.tries.push(d); if (rec) p.best = d;
        p.status = fmtm(d);
        this.fx(p, `${rec ? '⭐ ' : ''}${fmtm(d)}${rec && this.round > 1 ? ' — ρεκόρ σου!' : ''}`, [40, 30, 90], rec);
        this.sfx('point');
      }
      this.checkAll();
    }

    checkAll() {
      this.changed();
      if (this.phase !== 'go' || !this.parts.every((p) => p.st === 'done')) return;
      this.phase = 'show';
      const good = this.parts.filter((p) => p.tries[this.round - 1] != null).sort((a, b) => b.tries[this.round - 1] - a.tries[this.round - 1]);
      if (good.length) this.banner(`Καλύτερο άλμα: ${good[0].name} · ${fmtm(good[0].tries[this.round - 1])}`, good[0].color.hex);
      else this.banner('Όλα άκυρα!', '#ff8a7a');
      this.lead();
      this.after(3.4, () => {
        if (!this.running) return;
        if (this.round >= TRIES) this.done(); else this.newTry();
      });
    }

    rankList() {
      const key = (p) => [...p.tries].map((d) => (d == null ? -1 : d)).sort((a, b) => b - a);
      return [...this.parts].sort((a, b) => {
        const ka = key(a), kb = key(b);
        for (let i = 0; i < Math.max(ka.length, kb.length); i++) if ((kb[i] ?? -1) !== (ka[i] ?? -1)) return (kb[i] ?? -1) - (ka[i] ?? -1);
        return 0;
      });
    }

    lead() {
      const r = this.rankList();
      this.parts.forEach((p) => (p.hi = p === r[0] && p.best != null));
    }

    done() {
      this.phase = 'end';
      const rank = this.rankList(), winner = rank[0];
      winner.score = 1;
      this.celebrate(winner.color.hex);
      this.sfx('win');
      this.h.onOver && this.h.onOver({
        winner,
        stats: winner.best != null ? `Καλύτερο άλμα: ${fmtm(winner.best)}` : 'Κανένα έγκυρο άλμα',
        rank: rank.map((q) => ({ name: q.name, color: q.color, st: `${q.best != null ? fmtm(q.best) : 'άκυρα'} (${q.tries.map(short).join(' · ')})` })),
      });
    }

    update(dt) {
      for (const p of this.parts) {
        const prev = p.pos;
        if (p.st === 'run' && this.phase === 'go') {
          p.pos = Math.min(p.credit, p.pos + Math.max(0, (p.credit - p.pos) * 6) * dt);
          if (p.credit - p.pos < 0.03) p.pos = p.credit;
          if (p.bot) {
            p.botNext -= dt;
            if (p.botNext <= 0) { this.stride(p); p.botNext = 1 / (p.botRate * U.rand(0.88, 1.12)); }
            if (p.pos >= p.botAt) this.takeoff(p);
          }
          if (p.st === 'run' && p.pos > 0.9) { // πέρασε τη σανίδα χωρίς άλμα
            p.credit = p.pos;
            this.fault(p, 'Πέρασε τη σανίδα');
          }
        } else if (p.st === 'air') {
          const k = Math.min(1, (this.time - p.flyT) / p.flyDur);
          p.pos = p.toff + (p.land - p.toff) * k;
          if (k >= 1) this.landed(p);
        } else if (p.st === 'done' && p.land == null && p.v > 0.1) {
          p.pos += p.v * dt; p.v *= 1 - dt * 3; // φρενάρει στην άμμο
        }
        if (p.st !== 'done' || p.land == null) {
          const inst = dt > 0 ? (p.pos - prev) / dt : 0;
          p.v += (inst - p.v) * Math.min(1, dt * (p.st === 'air' ? 0 : 5));
        } else p.v = 0;
        p.legT += dt * (1.5 + p.v * 1.5);
      }
      for (const s of this.sand) { s.m += s.vx * dt * 0.4; s.y += s.vy * dt; s.vy -= 14 * dt; s.life -= dt; }
      this.sand = this.sand.filter((s) => s.life > 0 && s.y > -0.1);
      // κάμερα: ακολουθεί όσους τρέχουν, μετά κοιτάζει το σκάμμα
      const span = this.span();
      const act = this.parts.filter((p) => p.st !== 'done' || p.land != null).map((p) => p.pos);
      const lead = act.length ? Math.max(...act) : 0;
      let want = this.phase === 'count' ? -RUN - span * 0.3 : lead - span * 0.45;
      if (this.phase === 'show' || this.phase === 'end') want = -span * 0.32;
      want = U.clamp(want, -RUN - span * 0.35, PIT1 + 1.5 - span);
      this.cam += (want - this.cam) * Math.min(1, dt * 3.2);
    }

    span() { return Math.max(20, (this.W / this.vh) * 0.15); }

    ctrl(part) {
      const base = { mode: 'run', runHint: 'πάτα γρήγορα', jumpHint: 'στη σανίδα' };
      if (this.phase === 'go' && part && part.st === 'run') return { ...base, label: 'ΤΡΕΞΕ', sub: `Προσπάθεια ${this.round}/${TRIES} · Τρέξε γρήγορα και πάτα «ΑΛΜΑ» πάνω στη λευκή σανίδα`, active: true };
      if (this.phase === 'go') return { ...base, label: part && part.st === 'air' ? 'Πετάς!' : (part && part.status) || 'Περίμενε…', sub: 'Κοίτα την τηλεόραση', active: false };
      if (this.phase === 'count') return { ...base, label: `Προσπάθεια ${this.round}/${TRIES}`, sub: 'Ετοιμάσου…', active: false };
      return { ...base, label: this.phase === 'end' ? 'Τέλος!' : 'Μέτρηση…', sub: 'Κοίτα την τηλεόραση', active: false };
    }

    // ---------- σχέδιο ----------
    geo() {
      const W = this.W, H = this.H, vh = this.vh, n = this.parts.length;
      const top = H * 0.44, bot = H * 0.83;
      const lh = (bot - top) / Math.max(n, 2.6);
      const t0 = top + ((bot - top) - lh * n) / 2;
      const ppm = W / this.span();
      return { W, H, vh, n, top, bot, lh, t0, ppm, X: (m) => (m - this.cam) * ppm };
    }

    draw() {
      const x = this.ctx, G = this.geo(), { W, H, vh } = G;
      // ηλιοβασίλεμα
      const sky = x.createLinearGradient(0, 0, 0, H * 0.32);
      sky.addColorStop(0, '#3a2c7a'); sky.addColorStop(0.55, '#d4537a'); sky.addColorStop(1, '#ffb867');
      x.fillStyle = sky; x.fillRect(0, 0, W, H);
      // προβολείς
      const off = -((this.cam * G.ppm * 0.3) % W + W) % W;
      for (let rep = 0; rep < 2; rep++) for (const fx of [0.18, 0.62]) {
        const px = off + rep * W + fx * W;
        x.fillStyle = 'rgba(255,250,210,.13)'; x.beginPath(); x.moveTo(px - vh * 3, vh * 6); x.lineTo(px + vh * 3, vh * 6); x.lineTo(px + vh * 26, G.top); x.lineTo(px - vh * 26, G.top); x.fill();
        x.fillStyle = '#2b2440'; x.fillRect(px - vh * 0.5, vh * 6, vh, H * 0.2);
        U.rr(x, px - vh * 4, vh * 3, vh * 8, vh * 3.4, vh * 0.6); x.fill();
        x.fillStyle = '#fffbe0'; for (let k = 0; k < 4; k++) { x.beginPath(); x.arc(px - vh * 2.7 + k * vh * 1.8, vh * 4.7, vh * 0.65, 0, 7); x.fill(); }
      }
      // κερκίδα
      const sy0 = H * 0.21, sy1 = G.top - vh * 4.5;
      x.fillStyle = '#3d3263'; x.fillRect(0, sy0, W, sy1 - sy0);
      const coff = -((this.cam * G.ppm * 0.35) % W + W) % W;
      for (let rep = 0; rep < 2; rep++) for (const f of this.crowd) {
        const cx = coff + rep * W + f.x * W, cy = sy0 + vh * 2 + f.y * (sy1 - sy0 - vh * 4);
        const hop = this.phase !== 'count' ? Math.max(0, Math.sin(this.time * 8 + f.ph)) * vh * 0.7 : 0;
        x.fillStyle = f.c; x.beginPath(); x.arc(cx, cy - hop, vh * 1, 0, 7); x.fill();
      }
      x.fillStyle = 'rgba(20,10,40,.3)'; for (let i = 0; i < 4; i++) x.fillRect(0, sy0 + (i + 1) * (sy1 - sy0) / 5, W, vh * 0.3);
      x.fillStyle = '#ffffff'; x.fillRect(0, sy1, W, vh * 4.5);
      x.strokeStyle = U.INK; x.lineWidth = this.lw; x.strokeRect(-5, sy1, W + 10, vh * 4.5);
      const boff = -((this.cam * G.ppm) % (vh * 60) + vh * 60) % (vh * 60);
      for (let bx = boff; bx < W + vh * 60; bx += vh * 60) {
        this.text('LYDI SHOW TV GAMES', bx + vh * 17, sy1 + vh * 2.3, vh * 2.3, '#f0544f', { stroke: false, fam: 'Comfortaa', w: 700 });
        this.text('ΑΛΜΑ ΕΙΣ ΜΗΚΟΣ', bx + vh * 45, sy1 + vh * 2.3, vh * 2.3, '#3da9ff', { stroke: false, fam: 'Comfortaa', w: 700 });
      }
      // γρασίδι
      x.fillStyle = '#4fb84a'; x.fillRect(0, G.top - vh * 3, W, H);
      for (let i = 0; i < 12; i++) { x.fillStyle = i % 2 ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.04)'; const w = G.ppm * 5, X0 = ((i * w - this.cam * G.ppm) % (w * 12) + w * 12) % (w * 12) - w; x.fillRect(X0, G.top - vh * 3, w, H); }
      // διάδρομοι φόρας + σκάμματα
      const yA = G.t0, yB = G.t0 + G.lh * G.n;
      const xP0 = G.X(PIT0), xP1 = G.X(PIT1);
      { const r0 = Math.max(G.X(-RUN - 6), 0), r1 = Math.min(xP0, W); if (r1 > r0) { x.fillStyle = '#d65a3a'; x.fillRect(r0, yA - vh * 0.5, r1 - r0 + 1, yB - yA + vh); } }
      // άμμος
      x.fillStyle = '#f0d49b'; x.fillRect(xP0, yA - vh * 0.5, xP1 - xP0, yB - yA + vh);
      x.strokeStyle = '#b98a4b'; x.lineWidth = vh * 0.5; x.strokeRect(xP0, yA - vh * 0.5, xP1 - xP0, yB - yA + vh);
      for (let k = 0; k < 40; k++) { const m = PIT0 + hashf(k) * (PIT1 - PIT0), y = yA + hashf(k + 50) * (yB - yA); x.fillStyle = 'rgba(185,138,75,.35)'; x.beginPath(); x.ellipse(G.X(m), y, vh * 0.7, vh * 0.25, 0, 0, 7); x.fill(); }
      // γραμμές λωρίδων
      x.strokeStyle = 'rgba(255,255,255,.85)'; x.lineWidth = vh * 0.3;
      for (let i = 0; i <= G.n; i++) { const y = yA + i * G.lh; x.beginPath(); x.moveTo(Math.max(0, G.X(-RUN - 6)), y); x.lineTo(xP0, y); x.stroke(); }
      x.strokeStyle = 'rgba(160,110,60,.5)'; x.lineWidth = vh * 0.2;
      for (let i = 1; i < G.n; i++) { const y = yA + i * G.lh; x.beginPath(); x.moveTo(xP0, y); x.lineTo(xP1, y); x.stroke(); }
      // σημάδια φόρας κάθε 10 μ.
      for (let m = -RUN; m < 0; m += 10) {
        const X = G.X(m); if (X < -vh * 5 || X > W + vh * 5) continue;
        x.fillStyle = 'rgba(255,255,255,.7)'; x.fillRect(X - vh * 0.2, yA, vh * 0.4, yB - yA);
        if (m === -RUN) this.text('ΑΦΕΤΗΡΙΑ', X, yB + vh * 2.6, vh * 2.1, '#fff', { sw: vh * 0.45 });
      }
      // σανίδα απογείωσης + πλαστελίνη
      const xb0 = G.X(-0.2), xb1 = G.X(0);
      x.fillStyle = '#ffffff'; x.fillRect(xb0, yA, xb1 - xb0, yB - yA);
      x.fillStyle = '#2f9e44'; x.fillRect(xb1, yA, G.ppm * 0.1, yB - yA);
      x.strokeStyle = U.INK; x.lineWidth = this.lw * 0.6; x.strokeRect(xb0, yA, xb1 - xb0 + G.ppm * 0.1, yB - yA);
      this.text('ΣΑΝΙΔΑ', (xb0 + xb1) / 2, yB + vh * 2.6, vh * 2.1, '#fff', { sw: vh * 0.45 });
      // μετροταινία στο σκάμμα
      for (let m = 1; m <= 10; m++) {
        const X = G.X(m);
        x.fillStyle = '#fff'; x.fillRect(X - vh * 0.15, yB + vh * 0.5, vh * 0.3, vh * 1.2);
        if (m >= 3) this.text(`${m}μ`, X, yB + vh * 2.8, vh * 1.9, m >= 8 ? '#ffc93d' : '#fff', { sw: vh * 0.4 });
      }
      // σημαιάκια καλύτερου άλματος κάθε παίκτη
      this.parts.forEach((p, i) => {
        if (p.best == null) return;
        const X = G.X(p.best), y = yA + i * G.lh + vh * 0.6;
        x.strokeStyle = U.INK; x.lineWidth = vh * 0.25; x.beginPath(); x.moveTo(X, y + G.lh * 0.5); x.lineTo(X, y); x.stroke();
        x.fillStyle = p.color.hex; x.beginPath(); x.moveTo(X, y); x.lineTo(X + vh * 2.2, y + vh * 0.8); x.lineTo(X, y + vh * 1.6); x.fill();
      });
      // κάθε λωρίδα: σημάδι προσγείωσης, άμμος, δρομέας
      this.parts.forEach((p, i) => {
        const base = yA + (i + 0.8) * G.lh;
        if (p.st === 'done' && p.land != null) {
          x.fillStyle = 'rgba(150,100,50,.55)'; x.beginPath(); x.ellipse(G.X(p.land) - vh * 0.6, base, vh * 2, vh * 0.7, 0, 0, 7); x.fill();
          if (this.phase === 'go' || this.phase === 'show') {
            const lbl = p.foul ? '🚩 ΑΚΥΡΟ' : fmtm(p.land);
            this.text(lbl, G.X(p.land) + vh * 1.5, base - vh * 1.2, vh * 2.6, p.foul ? '#ff8a7a' : '#fff', { sw: vh * 0.55, align: 'left' });
          }
        }
        for (const s of this.sand) if (s.lane === i) { x.fillStyle = `rgba(230,195,130,${Math.min(1, s.life * 2)})`; x.beginPath(); x.arc(G.X(s.m), base - s.y * vh * 1.6, vh * 0.45, 0, 7); x.fill(); }
        this.runner(G, p, i, base);
      });
      this.hud(G);
      if ((this.phase === 'count' && this.time >= this.countT) || (this.phase === 'go' && this.time - this.goT < 0.7)) this.drawCount(this.countT, 'ΤΡΕΞΕ!');
    }

    runner(G, p, i, base) {
      const x = this.ctx, vh = G.vh, c = p.color.hex;
      const s = Math.min(G.lh / (vh * 13), 1.15) * vh;
      const X = G.X(p.pos) - (p.st === 'done' && p.land != null ? s * 6.2 : 0); // καθισμένος: οι φτέρνες στο σημάδι
      if (X < -s * 12 || X > G.W + s * 12) return;
      const air = p.st === 'air' ? Math.min(1, (this.time - p.flyT) / p.flyDur) : -1;
      const sat = p.st === 'done' && p.land != null; // κάθεται στην άμμο
      const hgt = air >= 0 ? 4 * air * (1 - air) * s * (2.5 + (p.land - p.toff) * 0.45) : 0;
      const run = p.st === 'run' && p.v > 0.5;
      const a = run ? Math.sin(p.legT) : 0;
      const bob = run ? Math.abs(Math.cos(p.legT)) * s * 0.9 : 0;
      const lean = air >= 0 ? -0.15 + air * 0.35 : sat ? -0.2 : run ? Math.min(0.3, p.v * 0.03) : 0;
      x.fillStyle = 'rgba(0,0,0,.22)'; x.beginPath(); x.ellipse(X, base, s * 4 * (1 - hgt / (s * 30)), s, 0, 0, 7); x.fill();
      x.save(); x.translate(X, base - bob - hgt + (sat ? s * 3.2 : 0));
      x.lineCap = 'round'; x.lineJoin = 'round';
      const hip = -s * 5.2;
      const leg = (ang, col) => {
        let kx, ky, fx, fy;
        if (air >= 0 || sat) { // πόδια μπροστά (θέση προσγείωσης)
          const tuck = air >= 0 ? Math.sin(air * Math.PI) : 1;
          kx = s * (1.5 + tuck * 1.2) + ang * s * 0.6; ky = hip + s * (1.8 - tuck * 0.8);
          fx = kx + s * 2.6; fy = ky + s * (0.9 - tuck * 0.3);
        } else {
          kx = Math.sin(ang) * s * 2.6; ky = hip + s * 2.6;
          fx = kx + Math.sin(ang - 0.9) * s * 2.2 * (run ? 1 : 0); fy = ky + s * 2.5 - (run ? Math.max(0, Math.sin(ang + 1.2)) * s * 1.2 : 0);
        }
        x.strokeStyle = U.INK; x.lineWidth = s * 2.1;
        x.beginPath(); x.moveTo(0, hip); x.lineTo(kx, ky); x.lineTo(fx, fy); x.stroke();
        x.strokeStyle = col; x.lineWidth = s * 1.3; x.stroke();
        x.fillStyle = '#fff'; x.strokeStyle = U.INK; x.lineWidth = s * 0.45;
        x.beginPath(); x.ellipse(fx + s * 0.7, fy + s * 0.2, s * 1.35, s * 0.7, 0, 0, 7); x.fill(); x.stroke();
      };
      const arm = (ang, col) => {
        x.strokeStyle = U.INK; x.lineWidth = s * 1.7;
        const up = air >= 0 ? -1 : 1;
        const sy = -s * 9.2, ex = Math.sin(ang) * s * 2.2 + (air >= 0 ? s * 1.4 : 0), ey = sy + s * 2.2 * up, hx = ex + Math.sin(ang + 1.3) * s * 1.8, hy = ey + s * 0.6 * up;
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
      x.fillStyle = U.shade(c, -0.35); x.beginPath(); x.arc(s * 0.3, -s * 13.6, s * 2.75, Math.PI * 1.05, Math.PI * 1.9); x.closePath(); x.fill(); x.stroke();
      x.fillStyle = U.INK; x.beginPath(); x.ellipse(s * 1.6, -s * 13.4, s * 0.38, s * 0.55, 0, 0, 7); x.fill();
      if (air >= 0) { x.beginPath(); x.arc(s * 1.5, -s * 12.2, s * 0.5, 0, Math.PI); x.fill(); } // ανοιχτό στόμα
      x.restore();
      x.save(); x.translate(X, base - bob - hgt + (sat ? s * 3.2 : 0)); x.rotate(lean);
      leg(a * 0.9, c);
      arm(-a * 1.1, c);
      x.restore();
      if (p.st !== 'done') this.text(p.name + (p.bot ? ' 🤖' : ''), X, base - hgt - s * 19.5, s * 2.1, c, { sw: s * 0.5 });
    }

    hud(G) {
      const x = this.ctx, { W, vh } = G;
      // προσπάθεια
      U.rr(x, W / 2 - vh * 17, vh * 8.8, vh * 34, vh * 5.2, vh * 2.6); x.fillStyle = 'rgba(10,5,30,.72)'; x.fill();
      this.text(`Προσπάθεια ${Math.min(this.round, TRIES)} / ${TRIES}`, W / 2, vh * 11.4, vh * 2.8, '#fff', { fam: 'Comfortaa', w: 700, stroke: false });
      // κάρτες: προσπάθειες και καλύτερο
      const n = this.parts.length, cw = Math.min(W * 0.21, vh * 40), ch = vh * 10, gap = vh * 2;
      let X = (W - (n * cw + (n - 1) * gap)) / 2;
      const Y = this.H - ch - vh * 1.6;
      for (const p of this.parts) {
        const c = p.color.hex;
        U.rr(x, X, Y, cw, ch, vh * 2);
        x.fillStyle = 'rgba(10,5,30,.82)'; x.fill();
        x.lineWidth = vh * 0.35; x.strokeStyle = p.hi ? c : 'rgba(255,255,255,.16)'; x.stroke();
        x.font = this.font(vh * 2.4); x.textAlign = 'left'; x.textBaseline = 'middle'; x.fillStyle = c;
        let nm = p.name + (p.bot ? ' 🤖' : '') + (p.p && !p.p.connected ? ' (εκτός)' : '');
        while (x.measureText(nm).width > cw * 0.5 && nm.length > 2) nm = nm.slice(0, -2) + '…';
        x.fillText(nm, X + vh * 2, Y + vh * 3);
        x.textAlign = 'right'; x.fillStyle = '#ffe8a8'; x.font = this.font(vh * 2.4, 800);
        x.fillText(p.best != null ? fmtm(p.best) : '—', X + cw - vh * 2, Y + vh * 3);
        // τρεις προσπάθειες
        x.font = this.font(vh * 2, 700); x.textAlign = 'center';
        for (let k = 0; k < TRIES; k++) {
          const d = p.tries[k], cx = X + vh * 2 + (cw - vh * 4) * (k + 0.5) / TRIES;
          x.fillStyle = d === undefined ? 'rgba(255,255,255,.3)' : d == null ? '#ff8a7a' : d === p.best ? '#fff' : '#cfc8ea';
          x.fillText(d === undefined ? '·' : short(d), cx, Y + vh * 7.2);
        }
        X += cw + gap;
      }
    }
  }

  function hashf(n) { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); }

  Mini.games.longjump = LongJumpGame;
})();
