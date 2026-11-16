// «Κούρσα 200μ»: κάθε πάτημα στο κινητό είναι ένας δρασκελισμός. Όποιος τερματίσει πρώτος στα 200 μέτρα κερδίζει.
// Πάτημα πριν από τον πυροβολισμό = άκυρη εκκίνηση (ο δρομέας μένει κολλημένος 1 δευτερόλεπτο).
// Ο χρόνος τερματισμού υπολογίζεται στην τηλεόραση και αφαιρείται η καθυστέρηση του δικτύου (rtt/2).
(function () {
  'use strict';
  const { Base, U } = Mini;
  const DIST = 200;        // μέτρα
  const STRIDE = 1.45;     // μέτρα ανά πάτημα (~138 πατήματα)
  const MIN_GAP = 45;      // ms ανάμεσα σε δύο μετρημένα πατήματα (όριο ~22/δευτ.)
  const FALSE_PEN = 1;     // δευτ. τιμωρία για άκυρη εκκίνηση
  const AFTER_WIN = 7;     // δευτ. που περιμένουμε τους υπόλοιπους μετά τον νικητή

  const fmt = (s) => s.toFixed(2).replace('.', ',') + '″';

  class RaceGame extends Base {
    constructor(c, h) { super(c, h); this.WIN = 1; this.crowd = []; this.dust = []; }

    setup() {
      this.crowd = Array.from({ length: 140 }, () => ({ x: Math.random(), y: Math.random(), c: U.pick(['#f0544f', '#3da9ff', '#ffc93d', '#2ecc71', '#9b5de5', '#ff8fc7', '#ffffff']), ph: U.rand(0, 6) }));
      this.dust = [];
      this.parts.forEach((p) => Object.assign(p, {
        taps: 0, shown: 0, v: 0, lastTap: 0, frozen: 0, fs: false, done: false, t: null, place: 0,
        status: '', hi: false, botNext: 0.25, botRate: U.rand(6.4, 7.6), legT: U.rand(0, 6), fsT: -9,
      }));
      this.phase = 'count'; this.places = 0; this.cam = 0; this.lastStep = 0; this.goT = 0;
      this.banner('Στις θέσεις σας…', '#fff');
      this.after(1, () => this.phase === 'count' && this.banner('Έτοιμοι…', '#fff'));
      this.after(2, () => this.phase === 'count' && this.banner('Περίμενε τον πυροβολισμό!', '#ffc93d'));
      this.countdown(() => this.go());
      this.changed();
    }

    go() {
      this.phase = 'go'; this.goT = this.time; this.goPerf = performance.now();
      this.sfx('gun');
      this.banner('ΤΡΕΞΕ!', '#ffc93d');
      this.parts.forEach((p) => { if (!p.fs) p.status = ''; });
      this.changed();
    }

    input(part, msg, now) {
      if (msg.type !== 'tap' || !part || part.done) return;
      if (this.phase === 'count') {
        // άκυρη εκκίνηση (μετράει μόνο μία φορά ανά παίκτη)
        if (!part.fs && this.time - this.countT > 0.4) {
          part.fs = true; part.fsT = this.time; part.status = 'Άκυρη εκκίνηση!';
          this.sfx('buzz');
          this.fx(part, '⛔ Βιάστηκες! Χάνεις 1 δευτερόλεπτο', [200]);
          this.changed();
        }
        return;
      }
      if (this.phase !== 'go') return;
      if (now - part.lastTap < MIN_GAP) return;
      part.lastTap = now;
      this.stride(part, now - (part.p && part.p.rtt ? part.p.rtt / 2 : 0));
    }

    // έναν δρασκελισμό· perf = χρόνος πατήματος (performance.now) για ακριβή χρόνο τερματισμού
    stride(part, perf) {
      if (this.phase !== 'go' || part.done) return;
      if (part.fs && this.time - this.goT < FALSE_PEN) return; // ακόμα τιμωρημένος
      part.taps++;
      if (this.time - this.lastStep > 0.09) { this.lastStep = this.time; this.sfx('step'); }
      if (part.taps * STRIDE >= DIST) {
        part.done = true;
        part.t = Math.max(0.5, ((perf != null ? perf : performance.now()) - this.goPerf) / 1000);
        part.place = ++this.places;
        part.status = `${part.place}ος · ${fmt(part.t)}`;
        part.hi = part.place === 1;
        if (part.place === 1) {
          part.score = 1;
          this.sfx('finish');
          this.banner(`${part.name} τερμάτισε πρώτος!`, part.color.hex);
          this.fx(part, `🏆 1ος! ${fmt(part.t)}`, [60, 40, 160], true);
          this.after(AFTER_WIN, () => this.endRace());
        } else {
          this.sfx('point');
          this.fx(part, `🏁 ${part.place}ος · ${fmt(part.t)}`, [40]);
        }
        if (this.parts.every((p) => p.done)) this.after(1.6, () => this.endRace());
        this.changed();
      }
    }

    endRace() {
      if (this.phase !== 'go') return;
      this.phase = 'end';
      this.parts.filter((p) => !p.done).forEach((p) => { p.status = `${Math.round(Math.min(DIST, p.taps * STRIDE))} μ.`; });
      this.changed();
      this.finish(this.parts.find((p) => p.place === 1));
    }

    finish(winner) {
      this.celebrate(winner.color.hex);
      this.sfx('win');
      const rank = [...this.parts].sort((a, b) => (a.done ? a.t : 1e9 - a.taps) - (b.done ? b.t : 1e9 - b.taps));
      this.h.onOver && this.h.onOver({
        winner,
        stats: `Έτρεξε τα ${DIST} μέτρα σε ${fmt(winner.t)}`,
        rank: rank.map((q) => ({ name: q.name, color: q.color, st: q.done ? fmt(q.t) : `${Math.round(Math.min(DIST, q.taps * STRIDE))} μ.` })),
      });
    }

    update(dt) {
      for (const p of this.parts) {
        if (p.fs && !p.done && p.status && this.phase === 'go' && this.time - this.goT > FALSE_PEN) p.status = '';
        const target = Math.min(DIST, p.taps * STRIDE);
        const prev = p.shown;
        p.shown += (target - p.shown) * Math.min(1, dt * 7);
        if (target - p.shown < 0.02) p.shown = target;
        const inst = dt > 0 ? (p.shown - prev) / dt : 0;
        p.v += (inst - p.v) * Math.min(1, dt * 5);
        p.legT += dt * (1.5 + p.v * 1.5);
        if (p.v > 3 && Math.random() < dt * p.v * 1.2) this.dust.push({ m: p.shown - 0.5, lane: this.parts.indexOf(p), life: 0.5, dy: U.rand(-1, 1) });
        if (p.bot && this.phase === 'go' && !p.done) {
          p.botNext -= dt;
          if (p.botNext <= 0) {
            this.stride(p, null);
            const tired = this.time - this.goT > 12 ? 0.9 : 1;
            p.botNext = 1 / (p.botRate * tired * U.rand(0.85, 1.15));
          }
        }
      }
      for (const d of this.dust) d.life -= dt;
      this.dust = this.dust.filter((d) => d.life > 0);
      // κάμερα: ακολουθεί τον πρώτο, αλλά προσπαθεί να χωρέσει και τον τελευταίο
      const ds = this.parts.map((p) => p.shown);
      const lead = Math.max(...ds), tail = Math.min(...ds);
      const span = this.span();
      const want = U.clamp(Math.max(lead - span * 0.72, Math.min(tail - span * 0.12, lead - span * 0.4)), -span * 0.12, DIST + 12 - span);
      this.cam += (want - this.cam) * Math.min(1, dt * 3);
    }

    span() { return Math.max(26, (this.W / this.vh) * 0.32); }

    ctrl() {
      if (this.phase === 'go') return { mode: 'tap', label: 'ΤΡΕΞΕ!', sub: 'Πάτα όσο πιο γρήγορα μπορείς — και με δύο δάχτυλα', active: true };
      if (this.phase === 'count') return { mode: 'tap', label: 'Περίμενε…', sub: 'ΜΗΝ πατήσεις πριν τον πυροβολισμό!', active: false };
      return { mode: 'tap', label: 'Τέλος!', sub: 'Δες τα αποτελέσματα στην τηλεόραση', active: false };
    }

    // ---------- σχέδιο ----------
    geo() {
      const W = this.W, H = this.H, vh = this.vh, n = this.parts.length;
      const top = H * 0.4, bot = H * 0.86;
      const lh = (bot - top) / Math.max(n, 2.6);
      const t0 = top + ((bot - top) - lh * n) / 2;
      const ppm = W / this.span();
      return { W, H, vh, n, top, bot, lh, t0, ppm, X: (m) => (m - this.cam) * ppm };
    }

    draw() {
      const x = this.ctx, G = this.geo(), { W, H, vh } = G;
      // ουρανός
      const sky = x.createLinearGradient(0, 0, 0, H * 0.3);
      sky.addColorStop(0, '#3f8fe0'); sky.addColorStop(1, '#a9dcff');
      x.fillStyle = sky; x.fillRect(0, 0, W, H);
      // κερκίδα (κινείται πιο αργά: parallax)
      const sy0 = H * 0.2, sy1 = G.top - vh * 4.5;
      x.fillStyle = '#5a4b8a'; x.fillRect(0, sy0, W, sy1 - sy0);
      const off = -((this.cam * G.ppm * 0.35) % W + W) % W;
      const cheer = this.phase === 'go' || this.phase === 'end';
      for (let rep = 0; rep < 2; rep++) {
        for (const f of this.crowd) {
          const cx = off + rep * W + f.x * W, cy = sy0 + vh * 2 + f.y * (sy1 - sy0 - vh * 4);
          const hop = cheer ? Math.max(0, Math.sin(this.time * 9 + f.ph)) * vh * 0.9 : 0;
          x.fillStyle = f.c; x.beginPath(); x.arc(cx, cy - hop, vh * 1.05, 0, 7); x.fill();
        }
      }
      x.fillStyle = 'rgba(28,26,43,.25)'; for (let i = 0; i < 4; i++) x.fillRect(0, sy0 + (i + 1) * (sy1 - sy0) / 5, W, vh * 0.3);
      x.fillStyle = '#2e2650'; x.fillRect(0, sy0 - vh * 1.2, W, vh * 1.2);
      // διαφημιστικός φράχτης
      x.fillStyle = '#ffffff'; x.fillRect(0, sy1, W, vh * 4.5);
      x.strokeStyle = U.INK; x.lineWidth = this.lw; x.strokeRect(-5, sy1, W + 10, vh * 4.5);
      const boff = -((this.cam * G.ppm) % (vh * 60) + vh * 60) % (vh * 60);
      for (let bx = boff; bx < W + vh * 60; bx += vh * 60) {
        this.text('LYDI TV GAMES', bx + vh * 15, sy1 + vh * 2.3, vh * 2.4, '#f0544f', { stroke: false, fam: 'Comfortaa', w: 700 });
        this.text('200 μ.', bx + vh * 42, sy1 + vh * 2.3, vh * 2.4, '#3da9ff', { stroke: false, fam: 'Comfortaa', w: 700 });
      }
      // γρασίδι + στίβος
      x.fillStyle = '#5fcf55'; x.fillRect(0, G.top - vh * 3, W, H);
      x.fillStyle = '#d65a3a'; x.fillRect(0, G.t0 - vh * 0.6, W, G.lh * G.n + vh * 1.2);
      x.strokeStyle = 'rgba(255,255,255,.9)'; x.lineWidth = vh * 0.35;
      for (let i = 0; i <= G.n; i++) { const y = G.t0 + i * G.lh; x.beginPath(); x.moveTo(0, y); x.lineTo(W, y); x.stroke(); }
      // σημάδια απόστασης κάθε 10 μ.
      for (let m = Math.ceil(this.cam / 10) * 10; m <= this.cam + this.span() + 10; m += 10) {
        if (m < 0 || m > DIST) continue;
        const X = G.X(m);
        x.strokeStyle = m % 50 === 0 ? 'rgba(255,255,255,.75)' : 'rgba(255,255,255,.28)'; x.lineWidth = vh * (m % 50 === 0 ? 0.45 : 0.25);
        x.beginPath(); x.moveTo(X, G.t0); x.lineTo(X, G.t0 + G.lh * G.n); x.stroke();
        if (m % 50 === 0 && m > 0 && m < DIST) this.text(`${m} μ.`, X, G.t0 + G.lh * G.n + vh * 2.6, vh * 2.4, '#fff', { sw: vh * 0.5 });
      }
      // εκκίνηση και τερματισμός
      this.line(G, 0, '#fff', 'ΕΚΚΙΝΗΣΗ');
      this.finishLine(G);
      // σκόνη
      for (const d of this.dust) {
        const y = G.t0 + (d.lane + 0.78) * G.lh + d.dy * vh * 0.6;
        x.fillStyle = `rgba(255,220,190,${d.life})`; x.beginPath(); x.arc(G.X(d.m) - (0.5 - d.life) * vh * 4, y, vh * (0.6 + (0.5 - d.life) * 2), 0, 7); x.fill();
      }
      this.parts.forEach((p, i) => this.runner(G, p, i));
      this.hud(G);
      if (this.phase === 'count' || this.time - this.goT < 0.7) this.drawCount(this.countT, 'ΤΡΕΞΕ!');
    }

    line(G, m, col, label) {
      const x = this.ctx, X = G.X(m), vh = G.vh;
      if (X < -vh * 10 || X > G.W + vh * 10) return;
      x.fillStyle = col; x.fillRect(X - vh * 0.5, G.t0, vh, G.lh * G.n);
      this.text(label, X, G.t0 + G.lh * G.n + vh * 2.6, vh * 2.3, '#fff', { sw: vh * 0.5 });
    }

    finishLine(G) {
      const x = this.ctx, X = G.X(DIST), vh = G.vh;
      if (X < -vh * 10 || X > G.W + vh * 20) return;
      const sq = vh * 1.2, hgt = G.lh * G.n;
      for (let r = 0; r * sq < hgt; r++) for (let c = 0; c < 2; c++) {
        x.fillStyle = (r + c) % 2 ? U.INK : '#fff';
        x.fillRect(X - sq + c * sq, G.t0 + r * sq, sq, Math.min(sq, hgt - r * sq));
      }
      // αψίδα τερματισμού
      const top = G.top - vh * 14;
      x.lineWidth = this.lw * 1.2; x.strokeStyle = U.INK;
      for (const px of [X - vh * 1.6, X + vh * 1.6]) { x.fillStyle = '#d9dbe3'; x.fillRect(px - vh * 0.5, top, vh, G.t0 + hgt - top); x.strokeRect(px - vh * 0.5, top, vh, G.t0 + hgt - top); }
      U.rr(x, X - vh * 9, top - vh * 5, vh * 18, vh * 5.4, vh * 1.2); x.fillStyle = '#ffc93d'; x.fill(); x.stroke();
      this.text('ΤΕΡΜΑ', X, top - vh * 2.3, vh * 3, U.INK, { stroke: false, fam: 'Comfortaa', w: 700 });
    }

    runner(G, p, i) {
      const x = this.ctx, vh = G.vh, c = p.color.hex;
      const X = G.X(p.shown), base = G.t0 + (i + 0.82) * G.lh;
      const s = Math.min(G.lh / (vh * 13), 1.25) * vh; // μονάδα μεγέθους
      if (X < -s * 12) { // πίσω από την κάμερα: βελάκι στην άκρη
        U.rr(x, s * 1, base - s * 6, s * 9, s * 4.2, s * 2); x.fillStyle = c; x.fill();
        x.lineWidth = this.lw; x.strokeStyle = U.INK; x.stroke();
        this.text(`◀ ${Math.round(p.shown)}μ`, s * 5.5, base - s * 3.9, s * 2, '#fff', { sw: s * 0.4 });
        return;
      }
      const run = this.phase === 'go' && p.v > 0.5 && !(p.done && p.shown >= DIST && p.v < 1);
      const a = run ? Math.sin(p.legT) : 0;
      const bob = run ? Math.abs(Math.cos(p.legT)) * s * 0.9 : 0;
      const lean = run ? Math.min(0.32, p.v * 0.03) : 0;
      // σκιά
      x.fillStyle = 'rgba(0,0,0,.22)'; x.beginPath(); x.ellipse(X, base, s * 4.2, s * 1, 0, 0, 7); x.fill();
      x.save(); x.translate(X, base - bob);
      x.lineCap = 'round'; x.lineJoin = 'round';
      const hip = -s * 5.2;
      const leg = (ang, col) => {
        const kx = Math.sin(ang) * s * 2.6, ky = hip + s * 2.6;
        const fx = kx + Math.sin(ang - 0.9) * s * 2.2 * (run ? 1 : 0), fy = ky + s * 2.5 - (run ? Math.max(0, Math.sin(ang + 1.2)) * s * 1.2 : 0);
        x.strokeStyle = U.INK; x.lineWidth = s * 2.1;
        x.beginPath(); x.moveTo(0, hip); x.lineTo(kx, ky); x.lineTo(fx, fy); x.stroke();
        x.strokeStyle = col; x.lineWidth = s * 1.3; x.stroke();
        x.fillStyle = '#fff'; x.strokeStyle = U.INK; x.lineWidth = s * 0.45;
        x.beginPath(); x.ellipse(fx + s * 0.7, fy + s * 0.2, s * 1.35, s * 0.7, 0, 0, 7); x.fill(); x.stroke();
      };
      leg(-a * 0.9, U.shade(c, -0.3));
      x.rotate(lean);
      // πίσω χέρι
      const arm = (ang, col) => {
        x.strokeStyle = U.INK; x.lineWidth = s * 1.7;
        const sx = 0, sy = -s * 9.2, ex = Math.sin(ang) * s * 2.2, ey = sy + s * 2.2, hx = ex + Math.sin(ang + 1.3) * s * 1.8, hy = ey + s * 0.6;
        x.beginPath(); x.moveTo(sx, sy); x.lineTo(ex, ey); x.lineTo(hx, hy); x.stroke();
        x.strokeStyle = col; x.lineWidth = s * 1.05; x.stroke();
        x.fillStyle = '#ffd9b3'; x.beginPath(); x.arc(hx, hy, s * 0.75, 0, 7); x.fill();
      };
      arm(a * 1.1, U.shade(c, -0.3));
      // σώμα (μπλούζα με αριθμό)
      x.lineWidth = this.lw * 1.1; x.strokeStyle = U.INK;
      U.rr(x, -s * 2.6, -s * 11.2, s * 5.2, s * 6.8, s * 2); x.fillStyle = c; x.fill(); x.stroke();
      x.fillStyle = '#fff'; U.rr(x, -s * 1.5, -s * 8.6, s * 3, s * 2.6, s * 0.4); x.fill();
      this.text(String(i + 1), 0, -s * 7.25, s * 2, U.INK, { stroke: false });
      // κεφάλι
      x.fillStyle = '#ffd9b3'; x.beginPath(); x.arc(s * 0.3, -s * 13.6, s * 2.7, 0, 7); x.fill(); x.stroke();
      x.fillStyle = c; x.beginPath(); x.arc(s * 0.3, -s * 13.6, s * 2.75, Math.PI * 1.05, Math.PI * 1.95); x.closePath(); x.fill(); x.stroke();
      x.fillStyle = U.INK; x.beginPath(); x.ellipse(s * 1.6, -s * 13.4, s * 0.38, s * 0.55, 0, 0, 7); x.fill();
      if (p.fs && this.time - this.goT < FALSE_PEN && this.phase !== 'end') { // ζαλάδα από την άκυρη εκκίνηση
        this.text('💫', s * 0.3, -s * 18, s * 3, '#fff', { stroke: false });
      }
      x.restore();
      x.save(); x.translate(X, base - bob); x.rotate(lean);
      leg(a * 0.9, c);
      arm(-a * 1.1, c);
      x.restore();
      // ετικέτα με όνομα
      if (p.done) {
        const pl = p.place === 1 ? '🏆 1ος' : `${p.place}ος`;
        this.text(`${pl} ${fmt(p.t)}`, X, base - s * 20, s * 2.3, p.place === 1 ? '#ffc93d' : '#fff', { sw: s * 0.5 });
      } else {
        this.text(p.name + (p.bot ? ' 🤖' : ''), X, base - s * 19.5, s * 2.1, c, { sw: s * 0.5 });
      }
    }

    hud(G) {
      const x = this.ctx, { W, vh } = G;
      // μπάρα προόδου 0 → 200 μ.
      const bw = Math.min(W * 0.62, vh * 110), bx = (W - bw) / 2 - vh * 4, by = vh * 11.5;
      U.rr(x, bx - vh, by - vh * 1.6, bw + vh * 2, vh * 3.2, vh * 1.6); x.fillStyle = 'rgba(10,5,30,.7)'; x.fill();
      x.strokeStyle = 'rgba(255,255,255,.25)'; x.lineWidth = vh * 0.25;
      for (let m = 0; m <= DIST; m += 50) { const X = bx + (m / DIST) * bw; x.beginPath(); x.moveTo(X, by - vh * 0.8); x.lineTo(X, by + vh * 0.8); x.stroke(); }
      this.text('🏁', bx + bw + vh * 3.4, by, vh * 3, '#fff', { stroke: false });
      [...this.parts].sort((a, b) => a.shown - b.shown).forEach((p) => {
        const X = bx + (p.shown / DIST) * bw;
        x.beginPath(); x.arc(X, by, vh * 1.25, 0, 7); x.fillStyle = p.color.hex; x.fill();
        x.lineWidth = vh * 0.3; x.strokeStyle = U.INK; x.stroke();
      });
      // χρονόμετρο
      if (this.phase !== 'count') {
        const lead = this.parts.find((p) => p.place === 1);
        const t = lead ? lead.t : this.time - this.goT;
        this.text(fmt(t), bx + bw + vh * 11, by, vh * 3.4, '#fff', { fam: 'Comfortaa', w: 700, sw: vh * 0.7 });
      }
      // κάρτες παικτών: μέτρα και θέση
      const n = this.parts.length, cw = Math.min(W * 0.21, vh * 40), ch = vh * 7.2, gap = vh * 2;
      let X = (W - (n * cw + (n - 1) * gap)) / 2;
      const Y = this.H - ch - vh * 2;
      for (const p of this.parts) {
        const c = p.color.hex;
        U.rr(x, X, Y, cw, ch, vh * 2);
        x.fillStyle = 'rgba(10,5,30,.8)'; x.fill();
        x.lineWidth = vh * 0.35; x.strokeStyle = p.hi ? c : 'rgba(255,255,255,.16)'; x.stroke();
        x.font = this.font(vh * 2.4); x.textAlign = 'left'; x.textBaseline = 'middle'; x.fillStyle = c;
        let nm = p.name + (p.bot ? ' 🤖' : '') + (p.p && !p.p.connected ? ' (εκτός)' : '');
        while (x.measureText(nm).width > cw * 0.55 && nm.length > 2) nm = nm.slice(0, -2) + '…';
        x.fillText(nm, X + vh * 2, Y + ch / 2);
        x.textAlign = 'right'; x.fillStyle = '#e9e4ff'; x.font = this.font(vh * 2.3, 700);
        x.fillText(p.status || `${Math.floor(p.shown)} μ.`, X + cw - vh * 2, Y + ch / 2);
        X += cw + gap;
      }
    }
  }

  Mini.games.race = RaceGame;
})();
