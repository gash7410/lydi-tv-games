// «Αστεράκι»: εμφανίζονται σχήματα· πατάς μόνο όταν βγει το ΧΡΥΣΟ αστέρι.
// Όποιος πατήσει πρώτος παίρνει πόντο. Αν πατήσεις νωρίτερα, βγαίνεις από τον γύρο.
// Ο χρόνος υπολογίζεται στην τηλεόραση και αφαιρείται η καθυστέρηση του δικτύου (rtt/2).
(function () {
  'use strict';
  const { Base, U } = Mini;
  const GOLD = '#ffc93d';
  const DECOYS = [
    { kind: 'circle', c: '#3da9ff' }, { kind: 'square', c: '#2ecc71' }, { kind: 'tri', c: '#ff4d5e' },
    { kind: 'heart', c: '#ff7ab6' }, { kind: 'circle', c: '#9b5de5' }, { kind: 'square', c: '#ff8c3d' },
  ];

  class StarGame extends Base {
    constructor(c, h) { super(c, h); this.WIN = 5; }

    setup() { this.round = 0; this.newRound(); }

    newRound() {
      this.round++;
      this.parts.forEach((p) => { p.status = ''; p.out = false; p.ms = null; p.hi = false; });
      this.phase = 'ready'; this.shape = null; this.shapeT = 0; this.starAt = 0; this.decided = false;
      this.resultText = '';
      this.banner(`Γύρος ${this.round}`, '#fff');
      // σειρά: 0–3 ψεύτικα σχήματα και μετά το αστέρι
      const nd = this.round === 1 ? (Math.random() < 0.5 ? 0 : 1) : (Math.random() * 4) | 0;
      const seq = [];
      let t = U.rand(1.6, 2.6);
      for (let i = 0; i < nd; i++) {
        const fake = this.round >= 3 && Math.random() < 0.3;
        const d = fake ? { kind: 'star', c: '#9fb3c8' } : U.pick(DECOYS);
        const dur = U.rand(0.55, 0.85);
        seq.push({ at: t, dur, ...d });
        t += dur + U.rand(0.35, 1.3);
      }
      seq.push({ at: t, dur: 99, kind: 'star', c: GOLD, real: true });
      this.seq = seq; this.seqT = this.time; this.seqI = -1;
      this.after(0.6, () => { if (this.phase === 'ready') { this.phase = 'seq'; this.changed(); } });
      this.changed();
    }

    update() {
      if (this.phase !== 'seq' && this.phase !== 'star') return;
      const rt = this.time - this.seqT;
      let cur = null, ci = -1;
      this.seq.forEach((s, i) => { if (rt >= s.at && rt < s.at + s.dur) { cur = s; ci = i; } });
      if (ci !== this.seqI) {
        this.seqI = ci; this.shape = cur; this.shapeT = this.time;
        if (cur && cur.real) this.showStar();
        else if (cur) {
          this.sfx('blip');
          // τα ρομπότ κάπου-κάπου τσιμπάνε κι αυτά
          this.parts.filter((p) => p.bot && !p.out).forEach((b) => {
            if (Math.random() < 0.07) this.after(U.rand(0.25, 0.4), () => this.tap(b, performance.now()));
          });
        }
      }
    }

    showStar() {
      this.phase = 'star';
      this.starAt = performance.now();
      this.sfx('star');
      this.parts.filter((p) => p.bot && !p.out).forEach((b) => this.after(U.rand(0.27, 0.5), () => this.tap(b, performance.now())));
      const r = this.round;
      this.after(3.2, () => { if (this.round === r && this.phase === 'star' && !this.decided) this.voidRound('Κανείς δεν πάτησε!'); });
    }

    input(part, msg, now) { if (msg.type === 'tap') this.tap(part, now); }

    tap(part, now) {
      if (!part || part.out || part.ms != null || this.over) return;
      if (this.phase !== 'seq' && this.phase !== 'star') return;
      const adj = now - (part.p && part.p.rtt ? part.p.rtt / 2 : 0);
      if (this.phase === 'seq' || adj < this.starAt - 15) {
        part.out = true; part.status = 'Νωρίς! ✋';
        this.sfx('buzz');
        this.fx(part, 'Νωρίς! ✋ Βγήκες από τον γύρο', [220]);
        this.changed();
        const live = this.parts.filter((p) => !p.out);
        if (!live.length) this.voidRound('Όλοι πάτησαν νωρίς!');
        return;
      }
      part.ms = Math.max(1, Math.round(adj - this.starAt));
      if (!this.firstAt || this.firstRound !== this.round) {
        this.firstAt = now; this.firstRound = this.round;
        const r = this.round;
        // περιμένουμε λίγο για όσους έχουν πιο αργή σύνδεση
        this.after(0.3, () => this.round === r && this.decide());
      }
    }

    decide() {
      if (this.decided || this.phase !== 'star') return;
      this.decided = true;
      const tapped = this.parts.filter((p) => p.ms != null).sort((a, b) => a.ms - b.ms);
      if (!tapped.length) return this.voidRound('Κανείς δεν πάτησε!');
      const w = tapped[0];
      tapped.forEach((p) => (p.status = `${p.ms} ms`));
      w.status = `⚡ ${w.ms} ms`; w.hi = true;
      this.phase = 'result';
      this.resultText = `${w.name} · ${w.ms} ms`;
      this.resultColor = w.color.hex;
      this.sfx('point');
      this.banner(`Πόντος: ${w.name}!`, w.color.hex);
      this.fx(w, '⚡ Πόντος για σένα!', [60, 40, 120], true);
      this.parts.filter((p) => p !== w && !p.out).forEach((p) => this.fx(p, p.ms != null ? `Πιο αργός · ${p.ms} ms` : 'Δεν πάτησες!', [30]));
      this.award(w, 2.6);
    }

    voidRound(msg) {
      if (this.phase === 'result') return;
      this.phase = 'result'; this.decided = true;
      this.resultText = msg; this.resultColor = '#ffffff';
      this.banner(msg, '#fff');
      this.changed();
      this.after(2.2, () => this.running && this.newRound());
    }

    ctrl(part) {
      if (this.phase === 'result' || this.phase === 'ready') return { mode: 'tap', label: 'Περίμενε…', sub: 'Πάτα μόνο στο χρυσό ⭐', active: false };
      if (part.out) return { mode: 'tap', label: 'Εκτός γύρου', sub: 'Πάτησες νωρίς. Περίμενε τον επόμενο γύρο.', active: false };
      return { mode: 'tap', label: 'ΠΑΤΑ!', sub: 'Μόνο όταν βγει το ΧΡΥΣΟ ⭐ στην τηλεόραση', active: true };
    }

    winText(w) { return `Το πιο γρήγορο χέρι: ${this.WIN} πόντοι`; }

    // ---------- σχεδίαση ----------
    draw() {
      const x = this.ctx, W = this.W, H = this.H, vh = this.vh;
      const g = x.createRadialGradient(W / 2, H * 0.4, vh * 5, W / 2, H * 0.45, Math.max(W, H) * 0.75);
      g.addColorStop(0, '#3a1f7a'); g.addColorStop(0.55, '#1d0f45'); g.addColorStop(1, '#0b0520');
      x.fillStyle = g; x.fillRect(0, 0, W, H);
      // ακτίνες φόντου
      x.save(); x.translate(W / 2, H * 0.42); x.rotate(this.time * 0.08);
      x.fillStyle = 'rgba(255,255,255,.035)';
      for (let i = 0; i < 12; i++) { x.rotate(Math.PI / 6); x.beginPath(); x.moveTo(0, 0); x.lineTo(W, -W * 0.13); x.lineTo(W, W * 0.13); x.closePath(); x.fill(); }
      x.restore();
      // βάθρο
      const py = H * 0.62;
      x.fillStyle = '#120a33';
      x.beginPath(); x.ellipse(W / 2, py + vh * 1.6, vh * 30, vh * 5.5, 0, 0, 7); x.fill();
      x.fillStyle = '#2c1966'; x.strokeStyle = U.INK; x.lineWidth = this.lw * 1.3;
      x.beginPath(); x.ellipse(W / 2, py, vh * 30, vh * 5.5, 0, 0, 7); x.fill(); x.stroke();
      x.strokeStyle = 'rgba(255,201,61,.35)'; x.lineWidth = vh * 0.5;
      x.beginPath(); x.ellipse(W / 2, py, vh * 24, vh * 4.2, 0, 0, 7); x.stroke();

      // κανόνας
      const ry = H * 0.775;
      this.text('Πάτα μόνο στο', W / 2 - vh * 6.5, ry, vh * 3.4, '#fff', { align: 'right' });
      x.fillStyle = GOLD; x.strokeStyle = U.INK; x.lineWidth = this.lw;
      U.starPath(x, W / 2 - vh * 3.2, ry - vh * 0.2, vh * 2.3); x.fill(); x.stroke();
      this.text('ΧΡΥΣΟ αστέρι!', W / 2, ry, vh * 3.4, GOLD, { align: 'left' });

      const cy = H * 0.4, R = vh * 15;
      if (this.shape && (this.phase === 'seq' || this.phase === 'star' || (this.phase === 'result' && this.shape.real))) {
        const k = this.time - this.shapeT;
        let s = U.easeOutBack(k / 0.2);
        if (this.shape.real) s *= 1 + Math.sin(this.time * 9) * 0.03;
        if (this.shape.real) {
          x.fillStyle = 'rgba(255,201,61,.12)';
          x.beginPath(); x.arc(W / 2, cy, R * 1.45 * s, 0, 7); x.fill();
        }
        this.drawShape(this.shape, W / 2, cy, R * s);
      } else if (this.phase === 'seq' || this.phase === 'ready') {
        const n = 1 + (Math.floor(this.time * 2.5) % 3);
        this.text('·'.repeat(n), W / 2, cy, vh * 14, 'rgba(255,255,255,.55)', { stroke: false });
      }
      if (this.phase === 'result' && this.resultText)
        this.text(this.resultText, W / 2, H * 0.71, vh * 4.4, this.resultColor, { fam: 'Comfortaa', w: 700 });

      this.drawScoreboard();
    }

    drawShape(s, X, Y, R) {
      const x = this.ctx;
      x.save();
      x.lineWidth = this.lw * 2; x.strokeStyle = U.INK; x.lineJoin = 'round';
      x.fillStyle = s.c;
      this.shapePath(s, X, Y, R);
      x.fill();
      x.save(); x.clip();
      x.fillStyle = 'rgba(255,255,255,.28)';
      x.beginPath(); x.ellipse(X - R * 0.3, Y - R * 0.45, R * 0.45, R * 0.22, -0.5, 0, 7); x.fill();
      x.fillStyle = 'rgba(0,0,0,.14)';
      x.beginPath(); x.arc(X + R * 0.5, Y + R * 0.6, R * 0.9, 0, 7); x.fill();
      x.restore();
      this.shapePath(s, X, Y, R);
      x.stroke();
      // ματάκια
      const ey = Y - (s.kind === 'tri' ? -R * 0.1 : R * 0.05), ex = R * 0.24;
      x.fillStyle = U.INK;
      for (const sx of [-1, 1]) { x.beginPath(); x.ellipse(X + sx * ex, ey, R * 0.07, R * 0.11, 0, 0, 7); x.fill(); }
      x.restore();
    }

    shapePath(s, X, Y, R) {
      const x = this.ctx;
      if (s.kind === 'star') U.starPath(x, X, Y, R * 1.12);
      else if (s.kind === 'circle') { x.beginPath(); x.arc(X, Y, R * 0.85, 0, 7); }
      else if (s.kind === 'square') U.rr(x, X - R * 0.8, Y - R * 0.8, R * 1.6, R * 1.6, R * 0.22);
      else if (s.kind === 'tri') { x.beginPath(); x.moveTo(X, Y - R); x.lineTo(X + R * 0.98, Y + R * 0.72); x.lineTo(X - R * 0.98, Y + R * 0.72); x.closePath(); }
      else if (s.kind === 'heart') {
        x.beginPath(); x.moveTo(X, Y + R * 0.85);
        x.bezierCurveTo(X - R * 1.3, Y - R * 0.05, X - R * 0.75, Y - R * 1.05, X, Y - R * 0.45);
        x.bezierCurveTo(X + R * 0.75, Y - R * 1.05, X + R * 1.3, Y - R * 0.05, X, Y + R * 0.85);
        x.closePath();
      }
    }
  }

  Mini.games.star = StarGame;
})();
