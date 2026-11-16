// «Μπαλόνια»: κάθε πάτημα στο κινητό είναι μία τρόμπα. Όποιου σκάσει πρώτο το μπαλόνι, παίρνει τον γύρο.
(function () {
  'use strict';
  const { Base, U } = Mini;
  const NEED = 50;         // τρόμπες για να σκάσει
  const MIN_GAP = 45;      // ms ανάμεσα σε δύο μετρημένα πατήματα (όριο ~22/δευτ.)

  class BalloonGame extends Base {
    constructor(c, h) { super(c, h); this.WIN = 2; this.clouds = []; this.bits = []; }

    setup() {
      this.round = 0;
      this.clouds = Array.from({ length: 6 }, (_, i) => ({ x: Math.random(), y: U.rand(0.06, 0.38), s: U.rand(0.7, 1.4), v: U.rand(0.004, 0.012) }));
      this.newRound();
    }

    newRound() {
      this.round++;
      this.bits = [];
      this.parts.forEach((p) => {
        Object.assign(p, { pumps: 0, shown: 0, lastTap: 0, plunge: 0, popped: false, deflate: 0, status: '', hi: false, botNext: 0.3 });
      });
      this.phase = 'count'; this.winner = null; this.lastPumpSfx = 0;
      this.banner(this.round === 1 ? 'Έτοιμοι;' : `Γύρος ${this.round}`, '#fff');
      this.countdown(() => { this.phase = 'go'; this.changed(); });
      this.changed();
    }

    input(part, msg, now) {
      if (msg.type !== 'tap' || this.phase !== 'go' || !part) return;
      if (now - part.lastTap < MIN_GAP) return;
      part.lastTap = now;
      this.pump(part);
    }

    pump(part) {
      if (this.phase !== 'go') return;
      part.pumps++; part.plunge = 1;
      if (this.time - this.lastPumpSfx > 0.06) { this.lastPumpSfx = this.time; this.sfx('pump'); }
      if (part.pumps >= NEED) this.pop(part);
    }

    pop(w) {
      this.phase = 'popped'; this.winner = w;
      w.popped = true; w.popT = this.time; w.hi = true; w.status = 'ΜΠΑΜ! 💥';
      const L = this.lane(this.parts.indexOf(w));
      for (let i = 0; i < 60; i++) {
        const a = U.rand(0, Math.PI * 2), sp = U.rand(this.vh * 20, this.vh * 70);
        this.bits.push({ x: L.bx, y: L.by, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: U.rand(0.6, 1.3), c: Math.random() < 0.7 ? w.color.hex : '#fff', r: U.rand(0, 6) });
      }
      this.sfx('pop');
      this.parts.forEach((p) => { if (p !== w) p.status = `${Math.round((p.pumps / NEED) * 100)}%`; });
      this.after(0.35, () => this.sfx('deflate'));
      this.banner(`${w.name} το έσκασε!`, w.color.hex);
      this.fx(w, '💥 ΜΠΑΜ! Πήρες τον γύρο', [60, 40, 140], true);
      this.parts.filter((p) => p !== w).forEach((p) => this.fx(p, 'Το δικό του έσκασε πρώτο…', [30]));
      this.award(w, 2.8);
    }

    update(dt) {
      for (const c of this.clouds) { c.x += c.v * dt; if (c.x > 1.2) c.x = -0.2; }
      for (const p of this.parts) {
        p.plunge = Math.max(0, p.plunge - dt * 7);
        p.shown += (p.pumps - p.shown) * Math.min(1, dt * 14);
        if (this.phase === 'popped' && !p.popped) p.deflate = Math.min(1, p.deflate + dt * 1.4);
        if (p.bot && this.phase === 'go') {
          p.botNext -= dt;
          if (p.botNext <= 0) { this.pump(p); p.botNext = 1 / U.rand(6, 8.2); }
        }
      }
      for (const b of this.bits) { b.vy += this.vh * 90 * dt; b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt; b.r += dt * 8; }
      this.bits = this.bits.filter((b) => b.life > 0);
    }

    ctrl() {
      if (this.phase === 'go') return { mode: 'tap', label: 'ΦΟΥΣΚΩΣΕ!', sub: 'Πάτα όσο πιο γρήγορα μπορείς — και με δύο δάχτυλα', active: true };
      return { mode: 'tap', label: 'Περίμενε…', sub: this.phase === 'count' ? 'Ετοιμάσου, ξεκινάμε!' : 'Επόμενος γύρος σε λίγο', active: false };
    }

    winText() { return `Έσκασε πρώτος ${this.WIN} μπαλόνια`; }

    // θέσεις λωρίδας για τον παίκτη i
    lane(i) {
      const n = this.parts.length, W = this.W, H = this.H, vh = this.vh;
      const lw = Math.min(W / n, vh * 52);
      const x0 = (W - lw * n) / 2 + lw * (i + 0.5);
      const ground = H * 0.78;
      const p = this.parts[i];
      const k = p ? U.clamp(p.shown / NEED, 0, 1) : 0;
      const def = p ? p.deflate : 0;
      const sc = Math.min(1, lw / (vh * 44));
      const r = (vh * 4 + vh * 15 * Math.sqrt(k)) * sc * (1 - def * 0.85);
      const bx = x0 + lw * 0.12, by = ground - vh * 30 - r * 1.05;
      return { x0, lw, ground, r, bx, by, k };
    }

    draw() {
      const x = this.ctx, W = this.W, H = this.H, vh = this.vh;
      const sky = x.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, '#53b9f5'); sky.addColorStop(0.75, '#bfe9ff');
      x.fillStyle = sky; x.fillRect(0, 0, W, H);
      // ήλιος
      x.fillStyle = '#ffe27a'; x.beginPath(); x.arc(W * 0.88, H * 0.14, vh * 7, 0, 7); x.fill();
      x.fillStyle = 'rgba(255,226,122,.3)'; x.beginPath(); x.arc(W * 0.88, H * 0.14, vh * 10 + Math.sin(this.time * 2) * vh * 0.6, 0, 7); x.fill();
      for (const c of this.clouds) this.cloud(c.x * W, c.y * H, vh * 5 * c.s);
      // γρασίδι
      const gy = H * 0.78;
      x.fillStyle = '#5fcf55'; x.fillRect(0, gy, W, H - gy);
      x.fillStyle = '#4cb944';
      for (let i = 0; i < W; i += vh * 6) { x.beginPath(); x.arc(i, gy, vh * 3.5, Math.PI, 0); x.fill(); }
      x.strokeStyle = U.INK; x.lineWidth = this.lw; x.beginPath(); x.moveTo(0, gy); x.lineTo(W, gy); x.stroke();

      this.parts.forEach((p, i) => this.drawLane(p, i));

      for (const b of this.bits) {
        x.save(); x.translate(b.x, b.y); x.rotate(b.r); x.globalAlpha = U.clamp(b.life * 1.6, 0, 1);
        x.fillStyle = b.c; x.fillRect(-vh * 0.8, -vh * 0.4, vh * 1.6, vh * 0.8); x.restore();
      }
      x.globalAlpha = 1;
      if (this.phase === 'count') this.drawCount(this.countT, 'ΦΥΣΑ!');
      else if (this.phase === 'go' && this.time - this.countT < 3.7) this.drawCount(this.countT, 'ΦΥΣΑ!');
      this.drawScoreboard(H - vh * 12.5);
    }

    cloud(X, Y, r) {
      const x = this.ctx; x.fillStyle = 'rgba(255,255,255,.92)';
      x.beginPath(); x.arc(X, Y, r, 0, 7); x.arc(X + r * 1.1, Y - r * 0.4, r * 1.2, 0, 7); x.arc(X + r * 2.3, Y, r * 0.95, 0, 7);
      x.rect(X, Y, r * 2.3, r * 0.95); x.fill();
    }

    drawLane(p, i) {
      const x = this.ctx, vh = this.vh, L = this.lane(i), c = p.color.hex;
      const px = L.x0 - L.lw * 0.22, base = L.ground - vh * 13.5;
      // τρόμπα: σώμα
      const bodyH = vh * 13, bw = vh * 4.4;
      x.lineWidth = this.lw * 1.2; x.strokeStyle = U.INK;
      U.rr(x, px - bw * 1.3, base + bodyH - vh * 1.4, bw * 2.6, vh * 1.6, vh * 0.6); x.fillStyle = '#3b3f55'; x.fill(); x.stroke();
      U.rr(x, px - bw / 2, base, bw, bodyH, vh * 0.8); x.fillStyle = c; x.fill(); x.stroke();
      x.fillStyle = 'rgba(255,255,255,.3)'; x.fillRect(px - bw * 0.3, base + vh, bw * 0.16, bodyH - vh * 2);
      // χειρολαβή (κατεβαίνει με κάθε πάτημα)
      const hy = base - vh * 7 + p.plunge * vh * 5.5;
      x.fillStyle = '#d9dbe3'; x.fillRect(px - vh * 0.5, hy, vh, base - hy); x.strokeRect(px - vh * 0.5, hy, vh, base - hy);
      U.rr(x, px - vh * 5, hy - vh * 1.6, vh * 10, vh * 2.2, vh * 1.1); x.fillStyle = '#ffffff'; x.fill(); x.stroke();
      // σωληνάκι μέχρι το μπαλόνι
      const nx = L.bx, ny = L.by + L.r * 1.05 + vh * 1.2;
      x.strokeStyle = U.INK; x.lineWidth = vh * 1.1;
      x.beginPath(); x.moveTo(px + bw / 2, base + bodyH - vh * 3); x.bezierCurveTo(px + L.lw * 0.3, base + bodyH, nx, ny + vh * 10, nx, ny); x.stroke();
      x.strokeStyle = '#4a4e66'; x.lineWidth = vh * 0.6; x.stroke();

      if (!p.popped) this.drawBalloon(L, c, p);
      else {
        const t = (this.time - p.popT) / 0.4;
        if (t < 1) {
          x.strokeStyle = `rgba(255,255,255,${1 - t})`; x.lineWidth = vh * (1.5 - t);
          for (let k = 0; k < 12; k++) {
            const a = (k / 12) * Math.PI * 2, r1 = vh * (6 + t * 16), r2 = vh * (10 + t * 22);
            x.beginPath(); x.moveTo(L.bx + Math.cos(a) * r1, L.by + Math.sin(a) * r1); x.lineTo(L.bx + Math.cos(a) * r2, L.by + Math.sin(a) * r2); x.stroke();
          }
        }
        // κουρελάκι στο στόμιο
        x.fillStyle = c; x.strokeStyle = U.INK; x.lineWidth = this.lw;
        x.beginPath(); x.moveTo(nx - vh, ny); x.lineTo(nx - vh * 2, ny - vh * 2.5); x.lineTo(nx, ny - vh * 1.6); x.lineTo(nx + vh * 2, ny - vh * 2.7); x.lineTo(nx + vh, ny); x.closePath(); x.fill(); x.stroke();
      }
      // ποσοστό
      if (this.phase !== 'count' && !p.popped && p.deflate < 0.05)
        this.text(`${Math.round(L.k * 100)}%`, L.bx, L.by, vh * (2.4 + L.k * 2.6), '#fff', { sw: vh * 0.6 });
    }

    drawBalloon(L, c, p) {
      const x = this.ctx, vh = this.vh;
      let { bx, by, r, k } = L;
      // κοντά στο σκάσιμο τρέμει
      if (k > 0.75 && this.phase === 'go') { bx += Math.sin(this.time * 47) * vh * 0.5 * (k - 0.75) * 4; by += Math.cos(this.time * 39) * vh * 0.3; }
      const sw = 1 + Math.sin(this.time * 2 + bx) * 0.02;
      x.save(); x.translate(bx, by); x.rotate(Math.sin(this.time * 1.4 + bx) * 0.05 * (1 - p.deflate));
      x.lineWidth = this.lw * 1.4; x.strokeStyle = U.INK;
      // κόμπος
      x.fillStyle = U.shade(c, -0.2);
      x.beginPath(); x.moveTo(0, r * 1.02); x.lineTo(-vh * 1.1, r * 1.02 + vh * 1.5); x.lineTo(vh * 1.1, r * 1.02 + vh * 1.5); x.closePath(); x.fill(); x.stroke();
      x.beginPath(); x.ellipse(0, 0, r * 0.92 * sw, r * 1.05, 0, 0, 7);
      const g = x.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.1, 0, 0, r * 1.1);
      g.addColorStop(0, U.shade(c, 0.35)); g.addColorStop(0.6, c); g.addColorStop(1, U.shade(c, -0.25));
      x.fillStyle = g; x.fill(); x.stroke();
      x.fillStyle = 'rgba(255,255,255,.55)';
      x.beginPath(); x.ellipse(-r * 0.38, -r * 0.45, r * 0.16, r * 0.3, 0.5, 0, 7); x.fill();
      x.restore();
    }
  }

  Mini.games.balloon = BalloonGame;
})();
