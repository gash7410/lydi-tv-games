// «Ντομάτες στο Μητσοτάκι»: ο Μητσοτάκης με το μπλε κοστούμι στέκεται στην είσοδο και κάνει ελιγμούς.
// Όλοι οι παίκτες πετάνε ταυτόχρονα ντομάτες από το κινητό (σύρσιμο προς τα πάνω, όπως στο Μπαλάκι).
// Κάθε πετυχημένη ντομάτα = 1 πόντος. Νικά όποιος φτάσει πρώτος τους 10.
(function () {
  'use strict';
  const { Base, U } = Mini;
  const FLY = 0.62;        // δευτ. πτήσης της ντομάτας
  const GAP = 330;         // ms ανάμεσα σε δύο ρίψεις του ίδιου παίκτη
  const SUIT = '#1f3f8f', SUIT_D = '#16306e', SHIRT = '#bcd8f5', TIE = '#1d4fa8', SKIN = '#f1c7a1', HAIR = '#8d8f97';
  const HIT_LINES = ['Ωχ! Το κουστούμι μου!', 'Αυτό ήταν καινούργιο!', 'Θα σας στείλω το καθαριστήριο!', 'Ε, όχι στο πρόσωπο!', 'Σάλτσα παντού!'];
  const MISS_LINES = ['Χα! Αστόχησες!', 'Ούτε κοντά!', 'Πιο γρήγορα, παιδιά!', 'Δεν με πιάνετε!', 'Πάλι έξω!'];

  class TomatoGame extends Base {
    constructor(c, h) { super(c, h); this.WIN = 10; }

    setup() {
      this.toms = []; this.walls = []; this.drops = []; this.pops = []; this.bubble = null;
      this.man = { x: 0.5, tx: 0.5, v: 0, duck: 0, duckT: 0, face: 'smile', faceT: 0, splats: [], wob: 0, dodges: 0 };
      this.parts.forEach((p) => Object.assign(p, { lastT: 0, status: '', hi: false, botNext: U.rand(1.2, 2), shots: 0 }));
      this.phase = 'count';
      this.banner('Πάρτε ντομάτες!', '#ff5a4a');
      this.countdown(() => { this.phase = 'go'; this.goT = this.time; this.say('Ελάτε, αν μπορείτε!'); this.changed(); });
      this.changed();
    }

    // ---------- γεωμετρία ----------
    feetY() { return this.H * 0.8; }
    manX() { const W = this.W; return W * 0.5 + (this.man.x - 0.5) * Math.min(W * 0.62, this.vh * 120); }
    unit() { return this.vh * 0.98; }
    // περιοχές σώματος σε pixels (για τον έλεγχο χτυπήματος)
    body() {
      const u = this.unit(), X = this.manX(), F = this.feetY(), d = this.man.duck;
      const hip = F - u * (22 - d * 9);
      const sh = hip - u * 19;
      const head = { x: X, y: sh - u * 7 + d * u * 2, r: u * 6.2 };
      return { X, F, u, hip, sh, head, torso: { x0: X - u * 9.5, x1: X + u * 9.5, y0: sh - u * 1, y1: hip + u * 5 }, legs: { x0: X - u * 7, x1: X + u * 7, y0: hip, y1: F } };
    }
    launchX(part) { const i = this.parts.indexOf(part), n = this.parts.length; return this.W * (i + 0.5) / n; }

    // ---------- είσοδος ----------
    input(part, msg, now) {
      if (msg.type !== 'toss' || this.phase !== 'go' || !part) return;
      if (now - part.lastT < GAP) return;
      part.lastT = now;
      this.toss(part, U.clamp(+msg.ax || 0, -1, 1), U.clamp(+msg.p || 0, 0, 1));
    }

    toss(part, ax, pw) {
      const W = this.W, lx = this.launchX(part);
      const tx = W / 2 + ax * W * 0.42 + (lx - W / 2) * 0.45;
      const B = this.body();
      const manH = B.F - (B.head.y - B.head.r);
      const ty = pw < 0.28 ? this.feetY() + this.vh * 6 * (1 - pw / 0.28) : this.feetY() - ((pw - 0.28) / 0.72) * manH * 1.02;
      this.toms.push({ part, x0: lx, y0: this.H + this.vh * 4, tx, ty, t: 0, rot: U.rand(0, 6), spin: U.rand(-9, 9) });
      part.shots++;
      this.sfx('throw');
      // αντίδραση: αν η ντομάτα έρχεται προς τα πάνω του, ίσως κάνει ελιγμό
      const near = Math.abs(tx - B.X) < B.u * 12;
      const lvl = Math.min(1, (this.time - this.goT) / 60 + this.lead() / 14);
      if (near && Math.random() < 0.28 + lvl * 0.25) this.after(U.rand(0.12, 0.3), () => this.dodge(tx, ty));
    }

    lead() { return Math.max(0, ...this.parts.map((p) => p.score)); }

    dodge(tx, ty) {
      if (this.phase !== 'go') return;
      const m = this.man, B = this.body();
      if (ty < B.head.y + B.u * 4 && Math.random() < 0.55) { m.duck = Math.max(m.duck, 0.01); m.duckT = 0.75; return; }
      const dir = tx > B.X ? -1 : 1;
      m.tx = U.clamp(m.x + dir * U.rand(0.18, 0.3), 0.04, 0.96);
      if (Math.abs(m.tx - m.x) < 0.1) m.tx = U.clamp(m.x - dir * 0.25, 0.04, 0.96);
      m.v = 2.4;
    }

    say(t, d = 1.8) { this.bubble = { t, until: this.time + d }; }

    land(tm) {
      const B = this.body(), r = this.vh * 2.4;
      const inHead = Math.hypot(tm.tx - B.head.x, tm.ty - B.head.y) < B.head.r + r * 0.6;
      const inBox = (b) => tm.tx > b.x0 - r * 0.5 && tm.tx < b.x1 + r * 0.5 && tm.ty > b.y0 && tm.ty < b.y1;
      const p = tm.part;
      if (inHead || inBox(B.torso) || inBox(B.legs)) {
        const m = this.man;
        m.splats.push({ dx: (tm.tx - B.X) / B.u, dy: (tm.ty - B.F) / B.u, head: inHead, seed: Math.random() * 100, a: 1 });
        if (m.splats.length > 14) m.splats.shift();
        m.face = 'ouch'; m.faceT = 0.7; m.wob = 1;
        this.sfx('splat');
        this.drip(tm.tx, tm.ty);
        p.score++;
        this.fx(p, inHead ? '🍅 ΣΤΟ ΚΕΦΑΛΙ! +1' : '🍅 Πέτυχες! +1', [50], true);
        if (Math.random() < 0.6) this.say(U.pick(HIT_LINES), 1.4);
        this.pops.push({ x: tm.tx, y: tm.ty - this.vh * 4, c: p.color.hex, t: 0, txt: inHead ? '+1 ΚΕΦΑΛΙ!' : '+1' });
        this.changed();
        if (p.score >= this.WIN && this.phase === 'go') {
          this.phase = 'end'; this.over = true;
          this.banner(`${p.name} κέρδισε!`, p.color.hex);
          m.face = 'ouch'; m.faceT = 3;
          this.after(1.6, () => this.finish(p));
        }
      } else {
        // αστοχία: λεκές στον τοίχο ή στο πάτωμα
        this.walls.push({ x: tm.tx, y: tm.ty, seed: Math.random() * 100, a: 1, floor: tm.ty > this.feetY() - this.vh });
        if (this.walls.length > 30) this.walls.shift();
        this.sfx('splat');
        this.man.dodges++;
        if (Math.random() < 0.35) { this.man.face = 'taunt'; this.man.faceT = 0.9; this.say(U.pick(MISS_LINES), 1.3); }
      }
    }

    drip(x, y) { for (let i = 0; i < 10; i++) this.drops.push({ x, y, vx: U.rand(-1, 1) * this.vh * 25, vy: U.rand(-30, -5) * this.vh, life: U.rand(0.4, 0.8) }); }

    winText(w) { return `Πέτυχε πρώτος ${this.WIN} ντομάτες στον Μητσοτάκη`; }

    finish(winner) {
      this.celebrate(winner.color.hex);
      this.sfx('win');
      const rank = [...this.parts].sort((a, b) => b.score - a.score);
      this.h.onOver && this.h.onOver({
        winner, stats: this.winText(winner),
        rank: rank.map((q) => ({ name: q.name, color: q.color, st: `${q.score} πετυχημένες · ${q.shots} ρίψεις` })),
      });
    }

    ctrl(part) {
      const active = this.phase === 'go';
      return { mode: 'throw', active, label: active ? 'Πέτα ντομάτα!' : this.phase === 'count' ? 'Ετοιμάσου…' : 'Τέλος!', sub: active ? 'Σύρε προς τα πάνω · λοξά για στόχευση' : '' };
    }

    // ---------- κίνηση ----------
    update(dt) {
      const m = this.man;
      if (this.phase === 'go') {
        const lvl = Math.min(1, (this.time - this.goT) / 60 + this.lead() / 14);
        // περπατά σε τυχαία σημεία της σκάλας
        if (Math.abs(m.tx - m.x) < 0.01 && Math.random() < dt * (0.9 + lvl * 1.5)) { m.tx = U.rand(0.05, 0.95); m.v = U.rand(0.35, 0.55) + lvl * 0.6; }
        if (m.duckT <= 0 && Math.random() < dt * 0.08 * lvl) m.duckT = 0.6;
      }
      const dx = m.tx - m.x, step = m.v * dt;
      m.x = Math.abs(dx) <= step ? m.tx : m.x + Math.sign(dx) * step;
      if (Math.abs(dx) <= step && m.v > 1) m.v = 0.5;
      m.walk = Math.abs(dx) > 0.004 ? (m.walk || 0) + dt * (6 + m.v * 6) : 0;
      m.duckT -= dt;
      m.duck += ((m.duckT > 0 ? 1 : 0) - m.duck) * Math.min(1, dt * 14);
      m.faceT -= dt; if (m.faceT <= 0) m.face = 'smile';
      m.wob = Math.max(0, m.wob - dt * 3);
      for (const s of m.splats) s.a = Math.max(0.35, s.a - dt * 0.03);

      for (const tm of this.toms) { tm.t += dt / FLY; tm.rot += tm.spin * dt; }
      const landed = this.toms.filter((t) => t.t >= 1);
      this.toms = this.toms.filter((t) => t.t < 1);
      landed.forEach((t) => this.land(t));
      for (const d of this.drops) { d.vy += this.vh * 120 * dt; d.x += d.vx * dt; d.y += d.vy * dt; d.life -= dt; }
      this.drops = this.drops.filter((d) => d.life > 0);
      for (const q of this.pops) q.t += dt;
      this.pops = this.pops.filter((q) => q.t < 1.1);

      // ρομπότ: στοχεύει με λίγη αστοχία
      for (const p of this.parts) {
        if (!p.bot || this.phase !== 'go') continue;
        p.botNext -= dt;
        if (p.botNext > 0) continue;
        p.botNext = U.rand(1.1, 1.9);
        const B = this.body(), W = this.W, lx = this.launchX(p);
        const aimX = B.X + U.rand(-1, 1) * B.u * 15;
        const ax = U.clamp((aimX - W / 2 - (lx - W / 2) * 0.45) / (W * 0.42), -1, 1);
        this.toss(p, ax, U.rand(0.42, 0.95));
      }
    }

    // ---------- σχέδιο ----------
    draw() {
      const x = this.ctx, W = this.W, H = this.H, vh = this.vh, F = this.feetY();
      // τοίχος από μάρμαρο
      x.fillStyle = '#e7e2d8'; x.fillRect(0, 0, W, H);
      x.strokeStyle = 'rgba(150,140,125,.25)'; x.lineWidth = 1.5;
      for (let i = 0; i < 9; i++) { x.beginPath(); x.moveTo(W * (i / 9), 0); x.bezierCurveTo(W * (i / 9) + 40, H * 0.3, W * (i / 9) - 30, H * 0.5, W * (i / 9) + 20, F); x.stroke(); }
      // σκοτεινή είσοδος
      const dw = Math.min(W * 0.78, vh * 150), dx0 = (W - dw) / 2, dtop = H * 0.06;
      x.fillStyle = '#2a1b12'; x.fillRect(dx0, dtop, dw, F - dtop);
      const glow = x.createRadialGradient(W / 2, F - vh * 10, vh * 5, W / 2, F - vh * 10, dw * 0.6);
      glow.addColorStop(0, 'rgba(255,170,80,.35)'); glow.addColorStop(1, 'rgba(0,0,0,0)');
      x.fillStyle = glow; x.fillRect(dx0, dtop, dw, F - dtop);
      // ξύλινα φύλλα πόρτας
      x.fillStyle = '#1b120d';
      x.fillRect(dx0, dtop, dw * 0.09, F - dtop); x.fillRect(dx0 + dw * 0.91, dtop, dw * 0.09, F - dtop);
      x.strokeStyle = 'rgba(120,80,50,.45)'; x.lineWidth = vh * 0.4;
      x.strokeRect(dx0 + dw * 0.015, dtop + vh * 18, dw * 0.06, vh * 25); x.strokeRect(dx0 + dw * 0.925, dtop + vh * 18, dw * 0.06, vh * 25);
      // σιδεριά πάνω από την πόρτα
      x.strokeStyle = '#0d0907'; x.lineWidth = vh * 0.7;
      const iy = dtop + vh * 4;
      x.fillStyle = '#3a2a1e'; x.fillRect(dx0 + dw * 0.12, dtop + vh * 1, dw * 0.76, vh * 12);
      for (let k = 0; k < 8; k++) {
        const cx = dx0 + dw * 0.12 + (k + 0.5) * dw * 0.095;
        x.beginPath(); x.ellipse(cx, iy + vh * 3, dw * 0.04, vh * 3.2, 0, 0, 7); x.stroke();
        x.beginPath(); x.arc(cx, iy + vh * 3, vh * 1.2, 0, 7); x.stroke();
      }
      // φωτιστικά
      for (const lx of [dx0 + dw * 0.17, dx0 + dw * 0.83]) {
        const ly = F - vh * 26;
        const g = x.createRadialGradient(lx, ly, 2, lx, ly, vh * 9);
        g.addColorStop(0, 'rgba(255,200,120,.95)'); g.addColorStop(0.3, 'rgba(255,170,80,.4)'); g.addColorStop(1, 'rgba(255,150,60,0)');
        x.fillStyle = g; x.beginPath(); x.arc(lx, ly, vh * 9, 0, 7); x.fill();
      }
      // κολόνες
      for (const cx of [dx0 - vh * 4, dx0 + dw + vh * 4]) {
        x.fillStyle = '#f4f1ea'; x.fillRect(cx - vh * 4, 0, vh * 8, F);
        x.fillStyle = 'rgba(0,0,0,.08)'; x.fillRect(cx + vh * 1.5, 0, vh * 2.5, F);
        x.strokeStyle = U.INK; x.lineWidth = this.lw; x.strokeRect(cx - vh * 4, -5, vh * 8, F + 5);
      }
      // σκαλοπάτι και χαλί
      x.fillStyle = '#f2efe8'; x.fillRect(0, F - vh * 1.5, W, vh * 4);
      x.strokeStyle = U.INK; x.lineWidth = this.lw; x.beginPath(); x.moveTo(0, F - vh * 1.5); x.lineTo(W, F - vh * 1.5); x.stroke();
      x.fillStyle = '#1b1b22'; x.fillRect(0, F + vh * 2.5, W, H - F);
      x.fillStyle = 'rgba(255,255,255,.04)'; for (let i = 0; i < W; i += 6) x.fillRect(i, F + vh * 2.5, 2, H);

      // λεκέδες σε τοίχο/πάτωμα
      for (const s of this.walls) this.splat(s.x, s.y, vh * (s.floor ? 2.6 : 3), s.seed, 0.9, s.floor ? 0.4 : 1);

      this.drawMan();

      // ντομάτες στον αέρα (πίσω προς τα μπρος)
      for (const tm of this.toms) {
        const t = tm.t, X = tm.x0 + (tm.tx - tm.x0) * t, Y = tm.y0 + (tm.ty - tm.y0) * t - Math.sin(Math.PI * t) * vh * 22;
        const r = vh * (5.5 - 3.3 * t);
        x.fillStyle = 'rgba(0,0,0,.18)'; x.beginPath(); x.ellipse(X, Math.max(Y, F + vh * 4) + vh * 2, r, r * 0.3, 0, 0, 7); x.fill();
        this.tomato(X, Y, r, tm.rot, tm.part.color.hex);
      }
      for (const d of this.drops) { x.fillStyle = `rgba(214,40,30,${U.clamp(d.life * 2, 0, 1)})`; x.beginPath(); x.arc(d.x, d.y, vh * 0.6, 0, 7); x.fill(); }
      for (const q of this.pops) {
        x.globalAlpha = U.clamp(1.6 - q.t * 1.6, 0, 1);
        this.text(q.txt, q.x, q.y - q.t * vh * 8, vh * (3.4 + U.easeOutBack(q.t * 3) * 1.2), q.c, { sw: vh * 0.7 });
        x.globalAlpha = 1;
      }
      // συννεφάκι λόγων
      if (this.bubble && this.time < this.bubble.until) this.drawBubble();
      if (this.phase === 'count' || this.time - this.countT < 3.7) this.drawCount(this.countT, 'ΠΕΤΑ!');
      this.drawScoreboard(H - vh * 12.5);
    }

    tomato(X, Y, r, rot, ring) {
      const x = this.ctx;
      x.save(); x.translate(X, Y); x.rotate(rot);
      x.lineWidth = Math.max(1.5, r * 0.12); x.strokeStyle = U.INK;
      x.beginPath(); x.ellipse(0, 0, r, r * 0.9, 0, 0, 7);
      const g = x.createRadialGradient(-r * 0.35, -r * 0.35, r * 0.1, 0, 0, r);
      g.addColorStop(0, '#ff8a6e'); g.addColorStop(0.55, '#e8302a'); g.addColorStop(1, '#a8150f');
      x.fillStyle = g; x.fill(); x.stroke();
      x.fillStyle = '#3aa64a'; x.beginPath();
      for (let k = 0; k < 5; k++) { const a = -Math.PI / 2 + (k / 5) * Math.PI * 2; x.lineTo(Math.cos(a) * r * 0.5, -r * 0.82 + Math.sin(a) * r * 0.3); x.lineTo(Math.cos(a + 0.6) * r * 0.15, -r * 0.82 + Math.sin(a + 0.6) * r * 0.1); }
      x.closePath(); x.fill(); x.lineWidth = Math.max(1, r * 0.07); x.stroke();
      x.fillStyle = 'rgba(255,255,255,.5)'; x.beginPath(); x.ellipse(-r * 0.4, -r * 0.25, r * 0.15, r * 0.25, 0.6, 0, 7); x.fill();
      x.restore();
      // χρώμα παίκτη: δαχτυλίδι γύρω από τη ντομάτα
      x.strokeStyle = ring; x.lineWidth = Math.max(2, r * 0.14); x.beginPath(); x.arc(X, Y, r * 1.18, 0, 7); x.stroke();
    }

    splat(X, Y, r, seed, a, squash = 1) {
      const x = this.ctx;
      x.save(); x.globalAlpha = a; x.translate(X, Y); x.scale(1, squash);
      x.fillStyle = '#d6281e';
      x.beginPath();
      for (let k = 0; k <= 14; k++) {
        const ang = (k / 14) * Math.PI * 2, rr = r * (0.7 + 0.45 * Math.abs(Math.sin(seed + k * 1.7)));
        x.lineTo(Math.cos(ang) * rr, Math.sin(ang) * rr);
      }
      x.closePath(); x.fill();
      for (let k = 0; k < 5; k++) { const ang = seed + k * 1.3, d = r * (1.3 + (k % 2) * 0.4); x.beginPath(); x.arc(Math.cos(ang) * d, Math.sin(ang) * d, r * 0.18, 0, 7); x.fill(); }
      x.fillStyle = '#f2d24a'; for (let k = 0; k < 4; k++) { const ang = seed * 2 + k * 1.6; x.beginPath(); x.ellipse(Math.cos(ang) * r * 0.4, Math.sin(ang) * r * 0.4, r * 0.09, r * 0.05, ang, 0, 7); x.fill(); }
      x.restore();
    }

    drawMan() {
      const x = this.ctx, B = this.body(), u = B.u, m = this.man, d = m.duck;
      const X = B.X, F = B.F, hip = B.hip, sh = B.sh;
      const sway = Math.sin(m.walk) * u * 0.8 + Math.sin(this.time * 18) * m.wob * u * 0.9;
      x.lineJoin = 'round'; x.lineCap = 'round'; x.strokeStyle = U.INK; x.lineWidth = this.lw * 1.1;
      // σκιά
      x.fillStyle = 'rgba(0,0,0,.25)'; x.beginPath(); x.ellipse(X, F, u * 10, u * 1.6, 0, 0, 7); x.fill();
      // πόδια (παντελόνι)
      for (const s of [-1, 1]) {
        const step = Math.sin(m.walk + (s > 0 ? Math.PI : 0)) * u * 1.6;
        const kx = X + s * (u * 3.2 + d * u * 3), ky = (hip + F) / 2 - d * u * 2;
        const fx = X + s * (u * 3.6 + d * u * 1.5) + step;
        x.fillStyle = SUIT;
        x.beginPath();
        x.moveTo(X + s * u * 0.4, hip); x.lineTo(X + s * u * 6.6, hip); x.lineTo(kx + s * u * 2.7, ky); x.lineTo(fx + s * u * 2.5, F - u * 1.2);
        x.lineTo(fx - s * u * 2.5, F - u * 1.2); x.lineTo(kx - s * u * 2.7, ky); x.closePath(); x.fill(); x.stroke();
        // παπούτσι
        x.fillStyle = '#111'; x.beginPath(); x.ellipse(fx + s * u * 0.6, F - u * 0.6, u * 3.4, u * 1.4, 0, 0, 7); x.fill(); x.stroke();
        x.fillStyle = 'rgba(255,255,255,.25)'; x.beginPath(); x.ellipse(fx + s * u * 0.2, F - u * 1.2, u * 1.2, u * 0.35, 0, 0, 7); x.fill();
      }
      x.save(); x.translate(sway, 0);
      // σακάκι
      x.fillStyle = SUIT;
      x.beginPath();
      x.moveTo(X - u * 4, sh - u * 1.2); x.quadraticCurveTo(X - u * 9.6, sh - u * 0.6, X - u * 9.8, sh + u * 3.5);
      x.lineTo(X - u * 8.6, hip + u * 5); x.lineTo(X + u * 8.6, hip + u * 5); x.lineTo(X + u * 9.8, sh + u * 3.5);
      x.quadraticCurveTo(X + u * 9.6, sh - u * 0.6, X + u * 4, sh - u * 1.2); x.closePath(); x.fill(); x.stroke();
      // πουκάμισο και γραβάτα (V)
      x.fillStyle = SHIRT;
      x.beginPath(); x.moveTo(X - u * 3.6, sh - u * 1.2); x.lineTo(X, sh + u * 9); x.lineTo(X + u * 3.6, sh - u * 1.2); x.closePath(); x.fill(); x.stroke();
      x.fillStyle = TIE;
      x.beginPath(); x.moveTo(X - u * 1.1, sh - u * 0.4); x.lineTo(X + u * 1.1, sh - u * 0.4); x.lineTo(X + u * 0.8, sh + u * 1.3);
      x.lineTo(X + u * 1.5, sh + u * 8); x.lineTo(X, sh + u * 9.6); x.lineTo(X - u * 1.5, sh + u * 8); x.lineTo(X - u * 0.8, sh + u * 1.3); x.closePath(); x.fill(); x.stroke();
      x.fillStyle = 'rgba(160,200,255,.6)';
      for (let k = 0; k < 7; k++) { x.beginPath(); x.arc(X + ((k % 2) - 0.5) * u * 0.9, sh + u * (2 + k * 0.95), u * 0.18, 0, 7); x.fill(); }
      // πέτα σακακιού
      x.fillStyle = SUIT_D;
      for (const s of [-1, 1]) {
        x.beginPath(); x.moveTo(X + s * u * 3.6, sh - u * 1.2); x.lineTo(X + s * u * 6, sh + u * 1.5); x.lineTo(X + s * u * 4, sh + u * 3);
        x.lineTo(X + s * u * 0.2, sh + u * 10.5); x.lineTo(X + s * u * 0.9, sh + u * 8); x.closePath(); x.fill(); x.stroke();
      }
      // κουμπί
      x.fillStyle = '#0d1b3d'; x.beginPath(); x.arc(X + u * 0.3, sh + u * 12, u * 0.55, 0, 7); x.fill();
      // χέρια: μανίκια που καταλήγουν σε ενωμένες παλάμες
      const hy = hip - u * 0.5 + (m.face === 'ouch' ? -u * 3 : 0);
      for (const s of [-1, 1]) {
        x.strokeStyle = U.INK; x.lineWidth = u * 4.4;
        x.beginPath(); x.moveTo(X + s * u * 8.4, sh + u * 1.5); x.quadraticCurveTo(X + s * u * 10.5, sh + u * 10, X + s * u * 3, hy); x.stroke();
        x.strokeStyle = SUIT; x.lineWidth = u * 3.2; x.stroke();
      }
      // μανσέτες + ρολόι
      x.fillStyle = SHIRT; x.strokeStyle = U.INK; x.lineWidth = this.lw;
      for (const s of [-1, 1]) { x.beginPath(); x.ellipse(X + s * u * 2.8, hy, u * 1.1, u * 1.5, 0, 0, 7); x.fill(); x.stroke(); }
      x.fillStyle = '#c9ccd4'; x.beginPath(); x.arc(X + u * 3.6, hy - u * 1.6, u * 1, 0, 7); x.fill(); x.stroke();
      x.fillStyle = '#20232c'; x.beginPath(); x.arc(X + u * 3.6, hy - u * 1.6, u * 0.55, 0, 7); x.fill();
      x.fillStyle = SKIN; x.beginPath(); x.ellipse(X, hy + u * 0.3, u * 2.6, u * 2.1, 0, 0, 7); x.fill(); x.stroke();
      x.strokeStyle = 'rgba(28,26,43,.5)'; x.lineWidth = this.lw * 0.6;
      for (let k = -1; k <= 1; k++) { x.beginPath(); x.moveTo(X + k * u * 0.9, hy - u * 1.2); x.lineTo(X + k * u * 0.9, hy + u * 1.4); x.stroke(); }
      // λαιμός
      const hd = B.head;
      x.fillStyle = SKIN; x.strokeStyle = U.INK; x.lineWidth = this.lw * 1.1;
      x.fillRect(X - u * 2, hd.y + u * 4, u * 4, sh - hd.y - u * 4.5);
      // γιακάς
      x.fillStyle = SHIRT;
      for (const s of [-1, 1]) { x.beginPath(); x.moveTo(X, sh); x.lineTo(X + s * u * 3.4, sh - u * 2.4); x.lineTo(X + s * u * 3.8, sh + u * 0.6); x.closePath(); x.fill(); x.stroke(); }
      this.drawHead(hd.x, hd.y, hd.r, u);
      // ντομάτες πάνω του (κινούνται μαζί του)
      for (const s of m.splats) this.splat(X + s.dx * u, F + s.dy * u + (s.head ? d * u * 2 : d * u * 7 * (s.dy > -22 ? 0.3 : 1)), u * 2.8, s.seed, s.a);
      x.restore();
    }

    drawHead(X, Y, r, u) {
      const x = this.ctx, m = this.man;
      x.lineWidth = this.lw * 1.1; x.strokeStyle = U.INK;
      // αυτιά
      x.fillStyle = SKIN;
      for (const s of [-1, 1]) { x.beginPath(); x.ellipse(X + s * r * 0.98, Y + u * 0.6, u * 1.3, u * 2, 0, 0, 7); x.fill(); x.stroke(); }
      // πρόσωπο (λίγο μακρόστενο)
      x.beginPath(); x.ellipse(X, Y, r * 0.95, r * 1.12, 0, 0, 7); x.fill(); x.stroke();
      // μαλλιά: γκρίζα, χτενισμένα προς τα πίσω, πιο σκούρα στα πλάγια
      x.fillStyle = HAIR;
      x.beginPath();
      x.moveTo(X - r * 0.98, Y - r * 0.05);
      x.bezierCurveTo(X - r * 1.15, Y - r * 1.15, X - r * 0.4, Y - r * 1.55, X + r * 0.15, Y - r * 1.42);
      x.bezierCurveTo(X + r * 0.85, Y - r * 1.35, X + r * 1.15, Y - r * 0.9, X + r * 0.98, Y - r * 0.05);
      x.bezierCurveTo(X + r * 0.9, Y - r * 0.6, X + r * 0.55, Y - r * 0.8, X + r * 0.1, Y - r * 0.82);
      x.bezierCurveTo(X - r * 0.4, Y - r * 0.9, X - r * 0.8, Y - r * 0.7, X - r * 0.98, Y - r * 0.05);
      x.closePath(); x.fill(); x.stroke();
      x.strokeStyle = 'rgba(255,255,255,.35)'; x.lineWidth = u * 0.35;
      for (let k = 0; k < 4; k++) { x.beginPath(); x.moveTo(X - r * 0.5 + k * r * 0.3, Y - r * 0.95); x.quadraticCurveTo(X - r * 0.2 + k * r * 0.3, Y - r * 1.35, X + r * 0.2 + k * r * 0.2, Y - r * 1.3); x.stroke(); }
      x.strokeStyle = U.INK; x.lineWidth = this.lw * 1.1;
      // φρύδια
      x.lineWidth = u * 0.6;
      const browUp = m.face === 'ouch' ? -u * 0.8 : 0;
      for (const s of [-1, 1]) { x.beginPath(); x.moveTo(X + s * r * 0.15, Y - r * 0.38 + browUp); x.quadraticCurveTo(X + s * r * 0.4, Y - r * 0.52 + browUp, X + s * r * 0.62, Y - r * 0.36 + browUp); x.stroke(); }
      x.lineWidth = u * 0.5;
      if (m.face === 'ouch') {
        // μάτια Χ και στόμα «Ο»
        for (const s of [-1, 1]) {
          const ex = X + s * r * 0.38, ey = Y - r * 0.1, k = u * 0.9;
          x.beginPath(); x.moveTo(ex - k, ey - k); x.lineTo(ex + k, ey + k); x.moveTo(ex + k, ey - k); x.lineTo(ex - k, ey + k); x.stroke();
        }
        x.fillStyle = '#5a1a1a'; x.beginPath(); x.ellipse(X, Y + r * 0.55, u * 1.5, u * 1.9, 0, 0, 7); x.fill(); x.stroke();
      } else {
        // μάτια μισόκλειστα από το χαμόγελο (στο «taunt» κλείνει το ένα μάτι)
        for (const s of [-1, 1]) {
          const ex = X + s * r * 0.38, ey = Y - r * 0.08;
          if (m.face === 'taunt' && s > 0) { x.beginPath(); x.moveTo(ex - u * 1.1, ey); x.lineTo(ex + u * 1.1, ey - u * 0.3); x.stroke(); continue; }
          x.fillStyle = U.INK; x.beginPath(); x.ellipse(ex, ey, u * 0.75, u * 0.6, 0, 0, 7); x.fill();
          x.beginPath(); x.arc(ex, ey + u * 1.2, u * 1.2, Math.PI * 1.2, Math.PI * 1.8); x.stroke();
        }
        // μύτη
        x.lineWidth = u * 0.4; x.beginPath(); x.moveTo(X + u * 0.2, Y - r * 0.05); x.quadraticCurveTo(X + u * 1.3, Y + r * 0.3, X - u * 0.2, Y + r * 0.32); x.stroke();
        // χαμόγελο με κλειστά χείλη
        x.lineWidth = u * 0.55;
        x.beginPath(); x.moveTo(X - r * 0.45, Y + r * 0.5); x.quadraticCurveTo(X, Y + r * 0.78, X + r * 0.45, Y + r * 0.48); x.stroke();
        x.lineWidth = u * 0.3; x.beginPath(); x.arc(X - r * 0.5, Y + r * 0.4, u * 0.9, Math.PI * 0.4, Math.PI * 0.9); x.stroke();
        x.beginPath(); x.arc(X + r * 0.5, Y + r * 0.4, u * 0.9, Math.PI * 0.1, Math.PI * 0.6); x.stroke();
        if (m.face === 'taunt') { x.fillStyle = '#ff7a8a'; x.beginPath(); x.ellipse(X + r * 0.1, Y + r * 0.72, u * 1, u * 1.3, 0, 0, Math.PI); x.fill(); x.stroke(); }
      }
      // ροδαλά μάγουλα
      x.fillStyle = 'rgba(240,120,110,.25)';
      for (const s of [-1, 1]) { x.beginPath(); x.ellipse(X + s * r * 0.6, Y + r * 0.28, u * 1.4, u * 0.9, 0, 0, 7); x.fill(); }
    }

    drawBubble() {
      const x = this.ctx, B = this.body(), vh = this.vh, t = this.bubble.t;
      x.font = this.font(vh * 2.6, 800);
      const w = x.measureText(t).width + vh * 4, h = vh * 6;
      const right = B.X < this.W * 0.55;
      let bx = right ? B.X + B.u * 9 : B.X - B.u * 9 - w;
      bx = U.clamp(bx, vh, this.W - w - vh);
      const by = B.head.y - B.u * 13;
      U.rr(x, bx, by, w, h, vh * 2.4); x.fillStyle = '#fff'; x.fill(); x.lineWidth = this.lw; x.strokeStyle = U.INK; x.stroke();
      x.beginPath(); x.moveTo(right ? bx + vh * 3 : bx + w - vh * 3, by + h - 1); x.lineTo(B.X + (right ? B.u * 4 : -B.u * 4), B.head.y - B.u * 6); x.lineTo(right ? bx + vh * 7 : bx + w - vh * 7, by + h - 1);
      x.fillStyle = '#fff'; x.fill(); x.stroke();
      x.fillStyle = U.INK; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(t, bx + w / 2, by + h / 2);
    }
  }

  Mini.games.tomato = TomatoGame;
})();
