// «Σπρωξίματα»: στρογγυλή πίστα πάνω στο νερό. Με το joystick κινείσαι, με την «ΩΘΗΣΗ» κάνεις ορμή.
// Όποιος βγει από την πίστα πέφτει στο νερό. Ο τελευταίος που μένει παίρνει τον γύρο. Η πίστα μικραίνει.
(function () {
  'use strict';
  const { Base, U } = Mini;
  const R0 = 10, PR = 1, ACC = 26, DAMP = 2.1, DASH = 15, DASH_CD = 1.4, TILT = 0.6;
  const SHRINK_AT = 12, R_MIN = 4.6;

  class SumoGame extends Base {
    constructor(c, h) { super(c, h); this.WIN = 3; this.splash = []; this.stars = []; }

    setup() { this.round = 0; this.newRound(); }

    newRound() {
      this.round++;
      const n = this.parts.length;
      this.R = R0; this.roundT = 0; this.splash = []; this.stars = []; this.fallen = [];
      this.parts.forEach((p, i) => {
        const a = n === 2 ? Math.PI * i : -Math.PI / 2 + (i * Math.PI * 2) / n + Math.PI / 4;
        Object.assign(p, {
          x: Math.cos(a) * R0 * 0.55, y: Math.sin(a) * R0 * 0.55, vx: 0, vy: 0, jx: p.jx || 0, jy: p.jy || 0,
          face: a + Math.PI, alive: true, fallT: 0, dashCd: 0, dashT: 0, status: '', hi: false, botT: 0,
        });
      });
      this.phase = 'count';
      this.banner(this.round === 1 ? 'Μείνε μέσα στην πίστα!' : `Γύρος ${this.round}`, '#fff');
      this.countdown(() => { this.phase = 'go'; this.changed(); });
      this.changed();
    }

    input(part, msg) {
      if (!part) return;
      if (msg.type === 'joy') {
        let jx = +msg.x || 0, jy = +msg.y || 0;
        const l = Math.hypot(jx, jy); if (l > 1) { jx /= l; jy /= l; }
        part.jx = jx; part.jy = jy;
      } else if (msg.type === 'dash') this.dash(part);
    }

    dash(p) {
      if (this.phase !== 'go' || !p.alive || p.dashCd > 0) return;
      let dx = p.jx, dy = p.jy, l = Math.hypot(dx, dy);
      if (l < 0.2) { dx = Math.cos(p.face); dy = Math.sin(p.face); l = 1; }
      p.vx += (dx / l) * DASH; p.vy += (dy / l) * DASH;
      p.dashCd = DASH_CD; p.dashT = 0.3;
      this.sfx('dash');
    }

    bot(p, dt) {
      p.botT -= dt;
      if (p.botT > 0) return;
      p.botT = 0.12;
      const foes = this.parts.filter((q) => q !== p && q.alive);
      if (!foes.length) { p.jx = p.jy = 0; return; }
      const t = foes.reduce((a, b) => (Math.hypot(a.x - p.x, a.y - p.y) < Math.hypot(b.x - p.x, b.y - p.y) ? a : b));
      let dx = t.x - p.x, dy = t.y - p.y;
      const d = Math.hypot(dx, dy) || 1; dx /= d; dy /= d;
      // αν είναι κοντά στην άκρη, γυρίζει προς το κέντρο
      const r = Math.hypot(p.x, p.y);
      if (r > this.R - 2.6) { const w = (r - (this.R - 2.6)) / 2; dx -= (p.x / r) * w * 2; dy -= (p.y / r) * w * 2; }
      dx += U.rand(-0.35, 0.35); dy += U.rand(-0.35, 0.35);
      const l = Math.hypot(dx, dy) || 1;
      p.jx = (dx / l) * 0.85; p.jy = (dy / l) * 0.85;
      if (d < 4.2 && r < this.R - 2 && Math.random() < 0.35) this.dash(p);
    }

    update(dt) {
      if (this.phase === 'go' || this.phase === 'end') {
        this.roundT += dt;
        if (this.roundT > SHRINK_AT && this.phase === 'go') this.R = Math.max(R_MIN, R0 - (this.roundT - SHRINK_AT) * 0.2);
      }
      const live = this.phase === 'go' || this.phase === 'end';
      for (const p of this.parts) {
        if (!p.alive) {
          p.fallT += dt; p.x += p.vx * dt * 0.3; p.y += p.vy * dt * 0.3;
          continue;
        }
        if (!live) continue;
        if (p.bot && this.phase === 'go') this.bot(p, dt);
        const free = this.phase === 'go' ? 1 : 0;
        p.vx += p.jx * ACC * dt * free; p.vy += p.jy * ACC * dt * free;
        const d = Math.exp(-DAMP * dt); p.vx *= d; p.vy *= d;
        p.x += p.vx * dt; p.y += p.vy * dt;
        p.dashCd = Math.max(0, p.dashCd - dt); p.dashT = Math.max(0, p.dashT - dt);
        if (Math.hypot(p.jx, p.jy) > 0.2) p.face = Math.atan2(p.jy, p.jx);
      }
      // συγκρούσεις
      const A = this.parts.filter((p) => p.alive);
      for (let i = 0; i < A.length; i++) for (let j = i + 1; j < A.length; j++) {
        const a = A[i], b = A[j];
        let dx = b.x - a.x, dy = b.y - a.y; const dist = Math.hypot(dx, dy);
        if (dist >= PR * 2 || dist === 0) continue;
        dx /= dist; dy /= dist;
        const ov = PR * 2 - dist;
        a.x -= dx * ov / 2; a.y -= dy * ov / 2; b.x += dx * ov / 2; b.y += dy * ov / 2;
        const vn = (a.vx - b.vx) * dx + (a.vy - b.vy) * dy;
        if (vn <= 0) continue;
        // όποιος κάνει ορμή σπρώχνει πιο δυνατά και μένει πιο σταθερός
        const ma = a.dashT > 0 ? 1.8 : 1, mb = b.dashT > 0 ? 1.8 : 1;
        const jimp = (1.85 * vn) / (1 / ma + 1 / mb);
        a.vx -= (jimp / ma) * dx; a.vy -= (jimp / ma) * dy;
        b.vx += (jimp / mb) * dx; b.vy += (jimp / mb) * dy;
        if (vn > 2.5) {
          this.sfx('bump');
          this.stars.push({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, t: 0, k: Math.min(1.6, vn / 8) });
        }
      }
      // πτώσεις
      if (this.phase === 'go') for (const p of A) {
        if (Math.hypot(p.x, p.y) > this.R + 0.15) {
          p.alive = false; p.fallT = 0; this.fallen.push(p);
          p.status = 'Στο νερό 💦';
          this.splash.push({ x: p.x, y: p.y, t: 0 });
          this.sfx('splash');
          this.fx(p, 'Έπεσες στο νερό! 💦', [250]);
          this.changed();
        }
      }
      for (const s of this.splash) s.t += dt;
      this.splash = this.splash.filter((s) => s.t < 1.4);
      for (const s of this.stars) s.t += dt;
      this.stars = this.stars.filter((s) => s.t < 0.5);

      if (this.phase === 'go') {
        const alive = this.parts.filter((p) => p.alive);
        if (alive.length <= 1 && this.parts.length > 1 || alive.length === 0) {
          this.phase = 'end';
          const w = alive[0] || this.fallen[this.fallen.length - 1];
          w.hi = true; w.status = '👑 Νικητής';
          this.parts.forEach((p) => { p.jx = p.jy = 0; });
          this.banner(`Γύρος για: ${w.name}!`, w.color.hex);
          this.sfx('point');
          this.fx(w, '👑 Έμεινες τελευταίος!', [60, 40, 140], true);
          this.award(w, 2.8);
        }
      }
    }

    ctrl(part) {
      if (this.phase === 'go' && part.alive) return { mode: 'joy', active: true, cd: part.dashCd > 0 };
      if (this.phase === 'go') return { mode: 'joy', active: false, label: 'Έπεσες στο νερό 💦', sub: 'Περίμενε τον επόμενο γύρο' };
      return { mode: 'joy', active: false, label: this.phase === 'count' ? 'Ετοιμάσου!' : 'Τέλος γύρου', sub: 'Joystick: κίνηση · ΩΘΗΣΗ: ορμή' };
    }

    winText() { return `Έμεινε τελευταίος στην πίστα ${this.WIN} φορές`; }

    // ---------- σχεδίαση ----------
    view() {
      const W = this.W, H = this.H;
      const s = Math.min((W * 0.4) / R0, (H * 0.33) / (R0 * TILT));
      return { s, cx: W / 2, cy: H * 0.46 };
    }
    P(v, X, Y, Z = 0) { return { x: v.cx + X * v.s, y: v.cy + Y * v.s * TILT - Z * v.s }; }

    draw() {
      const x = this.ctx, W = this.W, H = this.H, vh = this.vh, v = this.view();
      // νερό
      x.fillStyle = '#1a8fd0'; x.fillRect(0, 0, W, H);
      x.strokeStyle = 'rgba(255,255,255,.12)'; x.lineWidth = vh * 0.35;
      for (let k = 0; k < 9; k++) {
        const r = ((this.time * 0.9 + k * 1.4) % 12.6) + R0 + 0.4;
        x.beginPath(); x.ellipse(v.cx, v.cy + v.s * 0.6, r * v.s, r * v.s * TILT, 0, 0, 7); x.stroke();
      }
      // πίστα: πλευρά + πάνω επιφάνεια
      const R = this.R, th = 1.1;
      x.fillStyle = '#8a5a2b'; x.strokeStyle = U.INK; x.lineWidth = this.lw * 1.4;
      x.beginPath(); x.ellipse(v.cx, v.cy + th * v.s, R * v.s, R * v.s * TILT, 0, 0, Math.PI); x.lineTo(v.cx - R * v.s, v.cy);
      x.ellipse(v.cx, v.cy, R * v.s, R * v.s * TILT, 0, Math.PI, 0, true); x.closePath(); x.fill(); x.stroke();
      x.fillStyle = '#f2d39a';
      x.beginPath(); x.ellipse(v.cx, v.cy, R * v.s, R * v.s * TILT, 0, 0, 7); x.fill(); x.stroke();
      const warn = this.R < R0 && this.phase === 'go' && Math.sin(this.time * 8) > 0;
      x.strokeStyle = warn ? '#ff4d5e' : '#c0392b'; x.lineWidth = vh * 0.9;
      x.beginPath(); x.ellipse(v.cx, v.cy, (R - 0.55) * v.s, (R - 0.55) * v.s * TILT, 0, 0, 7); x.stroke();
      x.strokeStyle = 'rgba(192,57,43,.35)'; x.lineWidth = vh * 0.5;
      x.beginPath(); x.moveTo(v.cx - v.s * 1.6, v.cy); x.lineTo(v.cx + v.s * 1.6, v.cy); x.stroke();

      // πιτσιλιές
      for (const s of this.splash) {
        const q = this.P(v, s.x, s.y), t = s.t / 1.4;
        x.strokeStyle = `rgba(255,255,255,${0.9 * (1 - t)})`; x.lineWidth = vh * 0.7 * (1 - t) + 1;
        for (const k of [1, 1.7]) { x.beginPath(); x.ellipse(q.x, q.y, v.s * (0.6 + t * 2.2 * k), v.s * TILT * (0.6 + t * 2.2 * k), 0, 0, 7); x.stroke(); }
      }
      // παίκτες με σειρά βάθους
      const order = [...this.parts].sort((a, b) => a.y - b.y);
      for (const p of order) this.drawBlob(v, p);
      for (const s of this.stars) {
        const q = this.P(v, s.x, s.y, 1.2), t = s.t / 0.5;
        x.fillStyle = `rgba(255,232,120,${1 - t})`; x.strokeStyle = U.INK; x.lineWidth = this.lw;
        U.starPath(x, q.x, q.y, v.s * (0.5 + t * 0.9) * s.k); x.fill(); x.stroke();
      }
      if (this.phase === 'count' || (this.phase === 'go' && this.time - this.countT < 3.7)) this.drawCount(this.countT, 'ΣΠΡΩΞΕ!');
      if (this.R < R0 && this.phase === 'go' && this.R > R_MIN + 0.1)
        this.text('Η πίστα μικραίνει!', W / 2, vh * 11, vh * 3.4, '#ffc93d');
      this.drawScoreboard();
    }

    drawBlob(v, p) {
      const x = this.ctx, vh = this.vh, c = p.color.hex;
      let sink = 0, al = 1;
      if (!p.alive) { sink = Math.min(1.6, p.fallT * 2.2); al = Math.max(0, 1 - p.fallT * 0.9); if (al <= 0) return; }
      const g = this.P(v, p.x, p.y), r = PR * v.s;
      x.save(); x.globalAlpha = al;
      if (p.alive) { x.fillStyle = 'rgba(60,30,5,.3)'; x.beginPath(); x.ellipse(g.x, g.y, r * 0.95, r * 0.95 * TILT, 0, 0, 7); x.fill(); }
      const body = this.P(v, p.x, p.y, 0.85 - sink);
      // γραμμές ταχύτητας στην ορμή
      if (p.dashT > 0) {
        const sp = Math.hypot(p.vx, p.vy) || 1, ux = -p.vx / sp, uy = (-p.vy / sp) * TILT;
        x.strokeStyle = 'rgba(255,255,255,.8)'; x.lineWidth = vh * 0.5; x.lineCap = 'round';
        for (const o of [-0.5, 0, 0.5]) {
          const ox = -uy * o * r, oy = ux * o * r;
          x.beginPath(); x.moveTo(body.x + ux * r * 1.1 + ox, body.y + uy * r * 1.1 + oy); x.lineTo(body.x + ux * r * 2.3 + ox, body.y + uy * r * 2.3 + oy); x.stroke();
        }
      }
      if (sink > 0) { x.beginPath(); x.rect(0, 0, this.W, g.y + r * 0.2); x.clip(); }
      x.lineWidth = this.lw * 1.4; x.strokeStyle = U.INK;
      x.beginPath(); x.arc(body.x, body.y, r, 0, 7);
      const gr = x.createRadialGradient(body.x - r * 0.35, body.y - r * 0.4, r * 0.1, body.x, body.y, r);
      gr.addColorStop(0, U.shade(c, 0.35)); gr.addColorStop(1, U.shade(c, -0.15));
      x.fillStyle = gr; x.fill(); x.stroke();
      // μάτια προς την κατεύθυνση
      const fx = Math.cos(p.face), fy = Math.sin(p.face) * TILT;
      for (const sd of [-1, 1]) {
        const ex = body.x + fx * r * 0.4 - fy * sd * r * 0.32, ey = body.y - r * 0.15 + fy * r * 0.4 + fx * sd * r * 0.2 * TILT;
        x.fillStyle = '#fff'; x.beginPath(); x.arc(ex, ey, r * 0.2, 0, 7); x.fill(); x.lineWidth = this.lw * 0.8; x.stroke();
        x.fillStyle = U.INK; x.beginPath(); x.arc(ex + fx * r * 0.07, ey + fy * r * 0.07, r * 0.09, 0, 7); x.fill();
      }
      x.restore();
      if (p.alive) {
        this.text(p.name, body.x, body.y - r * 1.55, vh * 2.3, c, { sw: vh * 0.55 });
        if (p.dashCd > 0) {
          x.strokeStyle = 'rgba(255,255,255,.75)'; x.lineWidth = vh * 0.5;
          x.beginPath(); x.arc(body.x, body.y, r * 1.2, -Math.PI / 2, -Math.PI / 2 + (1 - p.dashCd / DASH_CD) * Math.PI * 2); x.stroke();
        }
      }
    }
  }

  Mini.games.sumo = SumoGame;
})();
