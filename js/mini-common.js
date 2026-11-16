// Κοινή βάση για τα μικρά παιχνίδια (Αστεράκι, Μπαλόνια, Σπρωξίματα)
// Κάθε παιχνίδι έχει γύρους· όποιος φτάσει πρώτος τους WIN πόντους κερδίζει.
(function () {
  'use strict';
  const INK = '#1c1a2b';
  const U = {
    INK,
    clamp: (v, a, b) => Math.max(a, Math.min(b, v)),
    rand: (a, b) => a + Math.random() * (b - a),
    pick: (arr) => arr[(Math.random() * arr.length) | 0],
    easeOutBack: (t) => { const c = 1.7; t = Math.min(1, Math.max(0, t)) - 1; return Math.max(0, 1 + t * t * ((c + 1) * t + c)); },
    rgb(hex) { const n = parseInt(hex.replace('#', ''), 16); return [n >> 16, (n >> 8) & 255, n & 255]; },
    shade(hex, a) {
      let [r, g, b] = U.rgb(hex);
      if (a < 0) { r *= 1 + a; g *= 1 + a; b *= 1 + a; } else { r += (255 - r) * a; g += (255 - g) * a; b += (255 - b) * a; }
      return `rgb(${r | 0},${g | 0},${b | 0})`;
    },
    rgba(hex, al) { const [r, g, b] = U.rgb(hex); return `rgba(${r},${g},${b},${al})`; },
    rr(x, X, Y, w, h, r) {
      r = Math.min(r, w / 2, h / 2); x.beginPath(); x.moveTo(X + r, Y); x.arcTo(X + w, Y, X + w, Y + h, r);
      x.arcTo(X + w, Y + h, X, Y + h, r); x.arcTo(X, Y + h, X, Y, r); x.arcTo(X, Y, X + w, Y, r); x.closePath();
    },
    starPath(x, cx, cy, r, inner = 0.48, rot = -Math.PI / 2) {
      x.beginPath();
      for (let i = 0; i < 10; i++) {
        const a = rot + (i * Math.PI) / 5, rad = i % 2 ? r * inner : r;
        i ? x.lineTo(cx + Math.cos(a) * rad, cy + Math.sin(a) * rad) : x.moveTo(cx + Math.cos(a) * rad, cy + Math.sin(a) * rad);
      }
      x.closePath();
    },
  };

  class Base {
    constructor(canvas, hooks) {
      this.c = canvas;
      this.ctx = canvas.getContext('2d');
      this.h = hooks || {};
      this.running = false;
      this.parts = [];
      this.timers = [];
      this.confetti = [];
      this.time = 0;
      this.WIN = 3;
      this.resize();
      addEventListener('resize', () => this.resize());
    }

    resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      this.W = innerWidth; this.H = innerHeight;
      this.c.width = Math.round(this.W * dpr); this.c.height = Math.round(this.H * dpr);
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      this.vh = this.H / 100;
      this.lw = Math.max(2, this.H * 0.0042);
    }

    // ---------- κύκλος ζωής ----------
    begin(parts) {
      this.parts = parts;
      parts.forEach((p) => { p.score = 0; p.status = ''; });
      this.timers = []; this.confetti = []; this.time = 0; this.over = false;
      this.c.hidden = false;
      this.resize();
      this.running = true;
      this.setup();
      this.last = performance.now();
      const id = (this.runId = (this.runId || 0) + 1);
      const loop = (t) => {
        if (!this.running || id !== this.runId) return;
        const dt = Math.min(0.05, (t - this.last) / 1000);
        this.last = t;
        this.time += dt;
        const due = this.timers.filter((x) => x.t <= this.time);
        this.timers = this.timers.filter((x) => x.t > this.time);
        requestAnimationFrame(loop); // πρώτα, ώστε ένα σφάλμα να μη σταματήσει το παιχνίδι
        try {
          due.forEach((x) => x.fn());
          this.update(dt);
          this.tickConfetti(dt);
          this.draw();
          this.drawConfetti();
        } catch (e) { console.error(e); }
      };
      requestAnimationFrame(loop);
    }

    end() { this.running = false; this.timers = []; this.c.hidden = true; }

    after(sec, fn) { this.timers.push({ t: this.time + sec, fn }); }

    // υπο-κλάσεις: setup(), update(dt), draw(), input(part, msg, now), ctrl(part)
    setup() {}
    update() {}
    draw() {}
    input() {}
    ctrl() { return null; }

    // ---------- βοηθητικά ----------
    sfx(n) { this.h.sfx && this.h.sfx(n); }
    banner(t, c, sticky) { this.h.banner && this.h.banner(t, c, sticky); }
    changed() { this.h.update && this.h.update(); }
    sendTo(part, msg) { if (part && part.p && this.h.send) this.h.send(part.p, msg); }
    fx(part, text, vib, flash) { this.sendTo(part, { type: 'fx', text, vib: vib || null, flash: !!flash }); }

    award(part, nextIn = 2.4) {
      part.score++;
      this.changed();
      if (part.score >= this.WIN) {
        this.over = true;
        this.after(1.4, () => this.finish(part));
      } else this.after(nextIn, () => this.running && this.newRound());
    }

    finish(winner) {
      this.celebrate(winner.color.hex);
      this.sfx('win');
      const rank = [...this.parts].sort((a, b) => b.score - a.score);
      this.h.onOver && this.h.onOver({
        winner,
        stats: this.winText(winner),
        rank: rank.map((q) => ({ name: q.name, color: q.color, st: `${q.score} ${q.score === 1 ? 'πόντος' : 'πόντοι'}` })),
      });
    }

    winText(w) { return `Έφτασε πρώτος τους ${this.WIN} πόντους`; }

    celebrate(hex) {
      for (let i = 0; i < 170; i++) {
        this.confetti.push({
          x: U.rand(0, this.W), y: U.rand(-this.H * 0.6, -10), vx: U.rand(-40, 40), vy: U.rand(120, 260),
          r: U.rand(0, 6.28), vr: U.rand(-6, 6), w: U.rand(6, 12), h: U.rand(10, 18),
          c: Math.random() < 0.5 ? hex : TVP.COLORS[(Math.random() * 4) | 0].hex, life: 6,
        });
      }
    }
    tickConfetti(dt) {
      for (const q of this.confetti) { q.x += q.vx * dt + Math.sin(this.time * 3 + q.r) * 0.6; q.y += q.vy * dt; q.r += q.vr * dt; q.life -= dt; }
      this.confetti = this.confetti.filter((q) => q.life > 0 && q.y < this.H + 30);
    }
    drawConfetti() {
      const x = this.ctx;
      for (const q of this.confetti) {
        x.save(); x.translate(q.x, q.y); x.rotate(q.r); x.fillStyle = q.c;
        x.fillRect(-q.w / 2, -q.h / 2, q.w, q.h * Math.abs(Math.cos(q.r * 1.3))); x.restore();
      }
    }

    font(size, w = 800, fam = 'Noto Sans') { return `${w} ${Math.round(size)}px "${fam}", sans-serif`; }

    // κείμενο με μαύρο περίγραμμα (στιλ καρτούν)
    text(str, X, Y, size, color = '#fff', opt = {}) {
      const x = this.ctx;
      x.font = this.font(size, opt.w || 800, opt.fam || 'Noto Sans');
      x.textAlign = opt.align || 'center'; x.textBaseline = opt.base || 'middle';
      x.lineJoin = 'round';
      if (opt.stroke !== false) { x.lineWidth = opt.sw || size * 0.18; x.strokeStyle = opt.ink || INK; x.strokeText(str, X, Y); }
      x.fillStyle = color; x.fillText(str, X, Y);
    }

    // μεγάλη αντίστροφη μέτρηση 3-2-1 στο κέντρο
    drawCount(t0, label) {
      const k = this.time - t0;
      const n = 3 - Math.floor(k);
      const f = k % 1;
      if (n < 1) {
        if (k < 3.6) {
          const s = U.easeOutBack(f * 3);
          this.ctx.globalAlpha = Math.max(0, 1 - (k - 3) * 1.6);
          this.text(label || 'ΤΩΡΑ!', this.W / 2, this.H * 0.42, this.vh * 16 * s, '#ffc93d', { fam: 'Comfortaa', w: 700 });
          this.ctx.globalAlpha = 1;
        }
        return;
      }
      const s = U.easeOutBack(f * 2.4);
      this.ctx.globalAlpha = 1 - Math.max(0, f - 0.7) / 0.3;
      this.text(String(n), this.W / 2, this.H * 0.42, this.vh * 24 * s, '#fff', { fam: 'Comfortaa', w: 700 });
      this.ctx.globalAlpha = 1;
    }
    // ξεκινά αντίστροφη μέτρηση· καλεί go() μετά από 3 δευτερόλεπτα
    countdown(go) {
      this.countT = this.time;
      this.sfx('count');
      this.after(1, () => this.sfx('count'));
      this.after(2, () => this.sfx('count'));
      this.after(3, () => { this.sfx('go'); go(); });
    }

    // κάρτες παικτών στο κάτω μέρος: όνομα, πόντοι, κατάσταση
    drawScoreboard(y0) {
      const x = this.ctx, n = this.parts.length, vh = this.vh;
      const cw = Math.min(this.W * 0.21, vh * 40), ch = vh * 10.5, gap = vh * 2;
      const total = n * cw + (n - 1) * gap;
      let X = (this.W - total) / 2;
      const Y = y0 != null ? y0 : this.H - ch - vh * 2.5;
      for (const p of this.parts) {
        const c = p.color.hex;
        U.rr(x, X, Y, cw, ch, vh * 2);
        x.fillStyle = 'rgba(10,5,30,.78)'; x.fill();
        x.lineWidth = vh * 0.35; x.strokeStyle = p.hi ? c : 'rgba(255,255,255,.16)'; x.stroke();
        const name = p.name + (p.bot ? ' 🤖' : '') + (p.p && !p.p.connected ? ' (εκτός)' : '');
        x.font = this.font(vh * 2.5); x.textAlign = 'left'; x.textBaseline = 'middle'; x.fillStyle = c;
        let nm = name; while (x.measureText(nm).width > cw - vh * 4 && nm.length > 2) nm = nm.slice(0, -2) + '…';
        x.fillText(nm, X + vh * 2, Y + vh * 2.8);
        const pr = vh * 1.05;
        for (let i = 0; i < this.WIN; i++) {
          x.beginPath(); x.arc(X + vh * 2 + pr + i * pr * 2.7, Y + vh * 6, pr, 0, 7);
          x.fillStyle = i < p.score ? c : 'rgba(255,255,255,.14)'; x.fill();
        }
        if (p.status) {
          x.font = this.font(vh * 2.1, 600); x.textAlign = 'right'; x.fillStyle = '#e9e4ff';
          x.fillText(p.status, X + cw - vh * 2, Y + vh * 6);
        }
        X += cw + gap;
      }
    }
  }

  window.Mini = { Base, U, games: {} };
})();
