// «Μπασκέτα»: όλοι σουτάρουν ταυτόχρονα στο ίδιο καλάθι από το κινητό
// (σύρσιμο προς τα πάνω: το μήκος είναι η δύναμη, η κλίση η στόχευση).
// Καλάθι = 2 πόντοι, καθαρό καλάθι (χωρίς στεφάνι) = 3. Στα μισά του χρόνου το καλάθι αρχίζει να κινείται.
// Νικά όποιος έχει τους περισσότερους πόντους όταν λήξει ο χρόνος.
(function () {
  'use strict';
  const { Base, U } = Mini;
  const TIME = 60;          // δευτ. παιχνιδιού
  const MOVE_AT = 30;       // μετά από τόσα δευτ. το καλάθι κινείται
  const FLY = 0.95;         // δευτ. πτήσης της μπάλας
  const GAP = 450;          // ms ανάμεσα σε δύο σουτ του ίδιου παίκτη
  const P_IDEAL = 0.68;     // ιδανική δύναμη (0..1)
  const P_TOL = 0.13;       // ανοχή δύναμης για «στεφάνι»
  const ORANGE = '#f07a1f';

  class HoopsGame extends Base {
    constructor(c, h) { super(c, h); this.WIN = 0; }

    setup() {
      this.shots = []; this.balls = []; this.pops = []; this.net = 0; this.flash = 0;
      this.hx = 0.5; this.lastSec = TIME;
      this.parts.forEach((p) => Object.assign(p, { lastT: 0, score: 0, made: 0, shots: 0, swish: 0, streak: 0, status: '', hi: false, botNext: U.rand(1, 1.8), firstT: 0 }));
      this.phase = 'count';
      this.banner('Σουτάρετε!', ORANGE);
      this.countdown(() => { this.phase = 'go'; this.goT = this.time; this.changed(); });
      this.changed();
    }

    // ---------- γεωμετρία ----------
    R() { return this.vh * 5.6; }                            // ακτίνα στεφανιού (οριζόντια)
    rimY() { return this.H * 0.4; }
    hoopX() { return this.W / 2 + (this.hx - 0.5) * this.W; }
    left() { return this.phase === 'count' ? TIME : Math.max(0, TIME - (this.time - this.goT)); }
    launchX(part) { const i = this.parts.indexOf(part), n = this.parts.length; return this.W * (i + 0.5) / n; }

    // ---------- είσοδος ----------
    input(part, msg, now) {
      if (msg.type !== 'toss' || this.phase !== 'go' || !part) return;
      if (now - part.lastT < GAP) return;
      part.lastT = now;
      this.shoot(part, U.clamp(+msg.ax || 0, -1, 1), U.clamp(+msg.p || 0, 0, 1));
    }

    shoot(part, ax, pw) {
      const R = this.R();
      const tx = this.hoopX() + ax * this.W * 0.18;  // στόχος σε σχέση με το καλάθι τη στιγμή του σουτ
      const dp = pw - P_IDEAL;
      // τελικό ύψος: αδύναμο σουτ πέφτει μπροστά από το στεφάνι, δυνατό χτυπά στο ταμπλό
      let ty = this.rimY();
      if (dp < -P_TOL) ty += Math.min(this.vh * 22, (-dp - P_TOL) * this.vh * 90 + this.vh * 3);
      else if (dp > P_TOL) ty -= Math.min(this.vh * 20, (dp - P_TOL) * this.vh * 70 + R * 0.9);
      this.shots.push({ part, x0: this.launchX(part), y0: this.H + this.vh * 5, tx, ty, dp, t: 0, rot: U.rand(0, 6), spin: U.rand(-6, 6) });
      part.shots++;
      this.sfx('throw');
    }

    // η μπάλα έφτασε στο ύψος του στεφανιού: βγαίνει το αποτέλεσμα
    arrive(s) {
      const R = this.R(), hx = this.hoopX(), ry = this.rimY(), p = s.part;
      const ex = Math.abs(s.tx - hx) / R, ep = Math.abs(s.dp) / P_TOL;
      const br = R * 0.42; // ακτίνα μπάλας στο ύψος του καλαθιού
      const ball = { x: s.tx, y: s.ty, r: br, rot: s.rot, spin: s.spin, vx: 0, vy: 0, life: 1.6, behind: false, c: p.color.hex };
      let pts = 0, how = '';
      if (ex < 0.45 && ep < 0.45) { pts = 3; how = 'swish'; }
      else if (ex < 1.0 && ep < 1.0) {
        this.sfx('rim');
        if (Math.random() < 0.95 - Math.max(ex, ep) * 0.6) { pts = 2; how = 'rim'; }
        else how = 'out';
      } else if (s.dp > P_TOL && s.dp < P_TOL * 2.2 && ex < 0.75) {
        this.sfx('bump');
        if (Math.random() < 0.55) { pts = 2; how = 'bank'; } else how = 'boardout';
      } else how = s.dp > P_TOL ? 'board' : s.dp < -P_TOL ? 'short' : 'wide';

      if (pts) {
        // μέσα: πέφτει από το δίχτυ
        Object.assign(ball, { x: hx + (s.tx - hx) * 0.3, y: ry, vx: (hx - s.tx) * 0.6, vy: this.vh * 24, behind: true, net: true });
        this.net = 1; this.flash = 1.2;
        this.sfx(pts === 3 ? 'sink' : 'point');
        p.score += pts; p.made++; p.streak++;
        if (pts === 3) p.swish++;
        if (!p.firstT) p.firstT = this.time;
        const fire = p.streak >= 3 ? ` · 🔥 ${p.streak} στη σειρά` : '';
        const label = how === 'swish' ? `🏀 ΚΑΘΑΡΟ! +3${fire}` : how === 'bank' ? `🏀 Ταμπλό και μέσα! +2${fire}` : `🏀 Καλάθι! +2${fire}`;
        p.status = how === 'swish' ? '+3 καθαρό' : '+2';
        this.fx(p, label, pts === 3 ? [40, 30, 120] : [60], true);
        this.pops.push({ x: hx, y: ry - this.vh * 9, c: p.color.hex, t: 0, txt: how === 'swish' ? '+3 ΚΑΘΑΡΟ!' : '+2' });
        this.lead();
        this.changed();
      } else {
        p.streak = 0;
        const side = s.tx >= hx ? 1 : -1;
        if (how === 'out') Object.assign(ball, { vx: side * this.vh * U.rand(14, 28), vy: -this.vh * U.rand(18, 30) });
        else if (how === 'board' || how === 'boardout') { this.sfx('bump'); Object.assign(ball, { vx: side * this.vh * U.rand(4, 12), vy: this.vh * 6, behind: true }); }
        else Object.assign(ball, { vx: side * this.vh * U.rand(2, 6), vy: this.vh * 10 });
        p.status = { out: 'στεφάνι, έξω', board: 'πολύ δυνατά', boardout: 'ταμπλό, έξω', short: 'πολύ σιγά', wide: 'άστοχο' }[how];
        if (how === 'short' || how === 'wide') this.sfx('miss');
        this.changed();
      }
      this.balls.push(ball);
    }

    lead() {
      const top = Math.max(...this.parts.map((q) => q.score));
      this.parts.forEach((q) => (q.hi = top > 0 && q.score === top));
    }

    ctrl(part) {
      const active = this.phase === 'go';
      const sec = Math.ceil(this.left());
      return {
        mode: 'throw', skin: 'hoops', active,
        label: active ? 'Σούταρε!' : this.phase === 'count' ? 'Ετοιμάσου…' : 'Τέλος χρόνου!',
        hint: 'Σύρε τη μπάλα προς τα πάνω<br><small>το μήκος είναι η δύναμη (η μπάρα δεξιά) · λοξά για στόχευση</small>',
        scoreText: `Πόντοι: ${part.score} · ⏱ ${sec}″`,
        sub: '',
      };
    }

    // ---------- κίνηση ----------
    update(dt) {
      if (this.phase === 'go') {
        const el = this.time - this.goT;
        if (el > MOVE_AT) {
          const k = Math.min(1, (el - MOVE_AT) / 6);  // ομαλή αρχή
          this.hx = 0.5 + Math.sin((el - MOVE_AT) * 0.85) * 0.2 * k;
        }
        const sec = Math.ceil(this.left());
        if (sec !== this.lastSec) {
          this.lastSec = sec;
          if (sec === MOVE_AT && TIME - MOVE_AT > 0) this.banner('Το καλάθι κινείται!', '#3da9ff');
          if (sec <= 5 && sec > 0) this.sfx('count');
          this.changed();
        }
        if (this.left() <= 0) {
          this.phase = 'buzzer';
          this.sfx('buzz');
          this.banner('ΤΕΛΟΣ ΧΡΟΝΟΥ!', '#ff4d5e');
          this.changed();
        }
      }
      // όσες μπάλες είναι ήδη στον αέρα μετράνε (buzzer beater)
      if (this.phase === 'buzzer' && !this.shots.length && !this.endSet) {
        this.endSet = true;
        this.after(1.6, () => this.finish());
      }

      for (const s of this.shots) { s.t += dt / FLY; s.rot += s.spin * dt; }
      const arrived = this.shots.filter((s) => s.t >= 1);
      this.shots = this.shots.filter((s) => s.t < 1);
      arrived.forEach((s) => this.arrive(s));

      const g = this.vh * 160, floor = this.H * 0.86;
      for (const b of this.balls) {
        b.vy += g * dt; b.x += b.vx * dt; b.y += b.vy * dt; b.rot += b.spin * dt; b.life -= dt;
        if (b.net && b.y > this.rimY() + this.vh * 9) b.net = false;
        if (b.y > floor && b.vy > 0) { b.y = floor; b.vy *= -0.55; b.vx *= 0.7; if (Math.abs(b.vy) > this.vh * 20) this.sfx('bounce'); }
      }
      this.balls = this.balls.filter((b) => b.life > 0);
      for (const q of this.pops) q.t += dt;
      this.pops = this.pops.filter((q) => q.t < 1.2);
      this.net = Math.max(0, this.net - dt * 2.2);
      this.flash = Math.max(0, this.flash - dt);

      // ρομπότ
      for (const p of this.parts) {
        if (!p.bot || this.phase !== 'go') continue;
        p.botNext -= dt;
        if (p.botNext > 0) continue;
        p.botNext = U.rand(1.3, 2.3);
        this.shoot(p, U.rand(-1, 1) * 0.11, P_IDEAL + U.rand(-1, 1) * 0.16);
      }
    }

    finish() {
      this.phase = 'end';
      const rank = [...this.parts].sort((a, b) => b.score - a.score || a.shots - b.shots || (a.firstT || 1e9) - (b.firstT || 1e9));
      const winner = rank[0];
      this.celebrate(winner.color.hex);
      this.sfx('win');
      this.h.onOver && this.h.onOver({
        winner,
        stats: `${winner.score} πόντοι σε ${TIME}″ · ${winner.made} καλάθια (${winner.swish} καθαρά)`,
        rank: rank.map((q) => ({ name: q.name, color: q.color, st: `${q.score} πόντοι · ${q.made}/${q.shots} καλάθια` })),
      });
    }

    begin(parts) { this.endSet = false; super.begin(parts); }

    // ---------- σχέδιο ----------
    draw() {
      const x = this.ctx, W = this.W, H = this.H, vh = this.vh;
      this.drawGym();
      const hx = this.hoopX(), ry = this.rimY(), R = this.R();

      this.drawBoard(hx, ry, R);
      // μπάλες πίσω από το μπροστινό στεφάνι (μέσα στο δίχτυ / στο ταμπλό)
      for (const b of this.balls) if (b.behind) this.drawBall(b.x, b.y, b.r, b.rot, b.life < 0.4 ? b.life / 0.4 : 1);
      this.drawRimFront(hx, ry, R);
      for (const b of this.balls) if (!b.behind) this.drawBall(b.x, b.y, b.r, b.rot, b.life < 0.4 ? b.life / 0.4 : 1);

      // μπάλες στον αέρα (μεγάλες κοντά στον θεατή, μικραίνουν προς το καλάθι)
      for (const s of this.shots) {
        const t = s.t, e = 1 - Math.pow(1 - t, 1.6);
        const X = s.x0 + (s.tx - s.x0) * e;
        const arc = H * 0.5;
        const Y = s.y0 + (s.ty - s.y0) * t - arc * 4 * t * (1 - t);
        const r = vh * 7 + (R * 0.42 - vh * 7) * e;
        // σκιά-ίχνος
        x.globalAlpha = 0.25; x.fillStyle = s.part.color.hex;
        x.beginPath(); x.arc(X, Y, r * 1.25, 0, 7); x.fill(); x.globalAlpha = 1;
        this.drawBall(X, Y, r, s.rot, 1);
      }

      for (const q of this.pops) {
        const k = q.t / 1.2;
        x.globalAlpha = 1 - Math.max(0, k - 0.6) / 0.4;
        this.text(q.txt, q.x, q.y - k * vh * 8, vh * (q.txt.length > 3 ? 6 : 8) * U.easeOutBack(Math.min(1, q.t * 4)), q.c, { fam: 'Comfortaa', w: 700 });
        x.globalAlpha = 1;
      }

      this.drawTimer();
      this.drawCards();
      if (this.phase === 'count') this.drawCount(this.countT, 'ΣΟΥΤ!');
    }

    drawGym() {
      const x = this.ctx, W = this.W, H = this.H, vh = this.vh, fy = H * 0.62;
      // τοίχος
      const g = x.createLinearGradient(0, 0, 0, fy);
      g.addColorStop(0, '#16224a'); g.addColorStop(1, '#2b3f7a');
      x.fillStyle = g; x.fillRect(0, 0, W, fy);
      // κερκίδες (σειρές με κεφαλάκια)
      for (let row = 0; row < 4; row++) {
        const y = fy - vh * 6 - row * vh * 5.5;
        x.fillStyle = row % 2 ? '#22326a' : '#1d2b5e'; x.fillRect(0, y, W, vh * 5.5);
        for (let i = 0; i < W / (vh * 4); i++) {
          const cx = i * vh * 4 + (row % 2) * vh * 2 + vh * 1.5;
          if (Math.abs(cx - W / 2) < vh * 34 && row > 0) continue;
          const bob = Math.sin(this.time * 4 + i * 1.7 + row) * (this.flash > 0 ? vh * 0.8 : vh * 0.15);
          x.fillStyle = TVP.COLORS[(i + row) % 4].hex; x.globalAlpha = 0.35;
          x.beginPath(); x.arc(cx, y + vh * 2 + bob, vh * 1.3, 0, 7); x.fill(); x.globalAlpha = 1;
        }
      }
      // φώτα
      for (let i = 0; i < 6; i++) {
        const lx = W * (i + 0.5) / 6;
        const lg = x.createRadialGradient(lx, vh * 2, 1, lx, vh * 2, vh * 18);
        lg.addColorStop(0, 'rgba(255,255,230,.55)'); lg.addColorStop(1, 'rgba(255,255,230,0)');
        x.fillStyle = lg; x.fillRect(lx - vh * 18, 0, vh * 36, vh * 20);
      }
      // παρκέ με προοπτική
      const fg = x.createLinearGradient(0, fy, 0, H);
      fg.addColorStop(0, '#c98b4e'); fg.addColorStop(1, '#e6ac6a');
      x.fillStyle = fg; x.fillRect(0, fy, W, H - fy);
      x.strokeStyle = 'rgba(120,70,30,.25)'; x.lineWidth = 1.5;
      for (let i = -12; i <= 12; i++) { x.beginPath(); x.moveTo(W / 2 + i * W * 0.03, fy); x.lineTo(W / 2 + i * W * 0.16, H); x.stroke(); }
      // ρακέτα + γραμμή βολών
      x.fillStyle = 'rgba(200,40,40,.55)';
      x.beginPath(); x.moveTo(W / 2 - W * 0.07, fy); x.lineTo(W / 2 + W * 0.07, fy); x.lineTo(W / 2 + W * 0.15, H * 0.8); x.lineTo(W / 2 - W * 0.15, H * 0.8); x.closePath(); x.fill();
      x.strokeStyle = 'rgba(255,255,255,.85)'; x.lineWidth = vh * 0.45; x.stroke();
      x.beginPath(); x.ellipse(W / 2, H * 0.8, W * 0.15, vh * 6, 0, Math.PI, 0); x.stroke();
      // τρίποντο
      x.beginPath(); x.ellipse(W / 2, fy, W * 0.42, H * 0.3, 0, 0, Math.PI); x.stroke();
    }

    drawBoard(hx, ry, R) {
      const x = this.ctx, vh = this.vh, lw = this.lw;
      const bw = R * 4.4, bh = R * 2.9, bx = hx - bw / 2, by = ry - bh + R * 0.55;
      // στήριγμα
      x.fillStyle = '#5b6273'; x.fillRect(hx - vh * 1.2, by + bh, vh * 2.4, this.H * 0.62 - by - bh);
      x.strokeStyle = U.INK; x.lineWidth = lw; x.strokeRect(hx - vh * 1.2, by + bh, vh * 2.4, this.H * 0.62 - by - bh);
      // ταμπλό
      U.rr(x, bx, by, bw, bh, vh * 1.2);
      x.fillStyle = 'rgba(235,245,255,.92)'; x.fill(); x.lineWidth = lw * 1.2; x.strokeStyle = U.INK; x.stroke();
      x.strokeStyle = '#e8482f'; x.lineWidth = vh * 0.6;
      x.strokeRect(bx + vh * 0.8, by + vh * 0.8, bw - vh * 1.6, bh - vh * 1.6);
      x.strokeRect(hx - R * 0.95, ry - R * 1.35, R * 1.9, R * 1.25);
      // πίσω μέρος στεφανιού + δίχτυ
      x.strokeStyle = '#b8400f'; x.lineWidth = vh * 0.7;
      x.beginPath(); x.ellipse(hx, ry, R, R * 0.28, 0, Math.PI, Math.PI * 2); x.stroke();
      this.drawNet(hx, ry, R);
    }

    drawNet(hx, ry, R) {
      const x = this.ctx, vh = this.vh, nh = vh * 9 * (1 - this.net * 0.25), sw = Math.sin(this.time * 30) * this.net * vh * 0.8;
      x.strokeStyle = 'rgba(255,255,255,.9)'; x.lineWidth = vh * 0.3;
      const n = 8;
      for (let i = 0; i <= n; i++) {
        const a = Math.PI * (i / n);
        const top = hx - Math.cos(a) * R, bot = hx - Math.cos(a) * R * 0.55 + sw;
        x.beginPath(); x.moveTo(top, ry + Math.sin(a) * R * 0.28); x.lineTo(bot, ry + nh); x.stroke();
      }
      for (let k = 1; k <= 3; k++) {
        const y = ry + nh * (k / 3.2), w = R * (1 - 0.45 * (k / 3.2));
        x.beginPath(); x.ellipse(hx + sw * k / 3, y, w, R * 0.2, 0, 0, Math.PI); x.stroke();
      }
    }

    drawRimFront(hx, ry, R) {
      const x = this.ctx, vh = this.vh;
      x.strokeStyle = U.INK; x.lineWidth = vh * 1.2;
      x.beginPath(); x.ellipse(hx, ry, R, R * 0.28, 0, 0, Math.PI); x.stroke();
      x.strokeStyle = ORANGE; x.lineWidth = vh * 0.75;
      x.beginPath(); x.ellipse(hx, ry, R, R * 0.28, 0, 0, Math.PI); x.stroke();
    }

    drawBall(X, Y, r, rot, a) {
      const x = this.ctx;
      x.save(); x.globalAlpha = a; x.translate(X, Y); x.rotate(rot);
      const g = x.createRadialGradient(-r * 0.35, -r * 0.35, r * 0.1, 0, 0, r);
      g.addColorStop(0, '#ffb066'); g.addColorStop(0.6, ORANGE); g.addColorStop(1, '#b44d0c');
      x.fillStyle = g; x.beginPath(); x.arc(0, 0, r, 0, 7); x.fill();
      x.strokeStyle = U.INK; x.lineWidth = Math.max(1.5, r * 0.09);
      x.stroke();
      x.lineWidth = Math.max(1, r * 0.07);
      x.beginPath(); x.moveTo(-r, 0); x.lineTo(r, 0); x.stroke();
      x.beginPath(); x.moveTo(0, -r); x.lineTo(0, r); x.stroke();
      x.beginPath(); x.ellipse(-r * 0.95, 0, r * 0.55, r * 0.9, 0, -Math.PI / 2, Math.PI / 2); x.stroke();
      x.beginPath(); x.ellipse(r * 0.95, 0, r * 0.55, r * 0.9, 0, Math.PI / 2, Math.PI * 1.5); x.stroke();
      x.restore();
    }

    drawTimer() {
      const x = this.ctx, vh = this.vh, W = this.W;
      const sec = Math.ceil(this.left());
      const w = vh * 22, h = vh * 9, X = W / 2 - w / 2, Y = vh * 2;
      U.rr(x, X, Y, w, h, vh * 2); x.fillStyle = 'rgba(10,5,30,.85)'; x.fill();
      x.lineWidth = vh * 0.4; x.strokeStyle = sec <= 10 && this.phase === 'go' ? '#ff4d5e' : 'rgba(255,255,255,.25)'; x.stroke();
      const txt = `0:${String(sec).padStart(2, '0')}`;
      this.text(txt, W / 2, Y + h / 2 + vh * 0.3, vh * 6, sec <= 10 && this.phase === 'go' ? '#ff6b6b' : '#ffc93d', { stroke: false, fam: 'Comfortaa', w: 700 });
    }

    drawCards() {
      const x = this.ctx, n = this.parts.length, vh = this.vh;
      const cw = Math.min(this.W * 0.21, vh * 40), ch = vh * 11, gap = vh * 2;
      let X = (this.W - (n * cw + (n - 1) * gap)) / 2;
      const Y = this.H - ch - vh * 2.5;
      for (const p of this.parts) {
        const c = p.color.hex;
        U.rr(x, X, Y, cw, ch, vh * 2);
        x.fillStyle = 'rgba(10,5,30,.82)'; x.fill();
        x.lineWidth = vh * 0.4; x.strokeStyle = p.hi ? c : 'rgba(255,255,255,.16)'; x.stroke();
        const name = p.name + (p.bot ? ' 🤖' : '') + (p.p && !p.p.connected ? ' (εκτός)' : '');
        x.font = this.font(vh * 2.5); x.textAlign = 'left'; x.textBaseline = 'middle'; x.fillStyle = c;
        let nm = name; while (x.measureText(nm).width > cw - vh * 14 && nm.length > 2) nm = nm.slice(0, -2) + '…';
        x.fillText(nm, X + vh * 2, Y + vh * 3.2);
        if (p.status) { x.font = this.font(vh * 2, 600); x.fillStyle = '#e9e4ff'; x.fillText(p.status, X + vh * 2, Y + vh * 7.6); }
        this.text(String(p.score), X + cw - vh * 2, Y + ch / 2, vh * 6.5, '#fff', { align: 'right', stroke: false, fam: 'Comfortaa', w: 700 });
        X += cw + gap;
      }
    }
  }

  Mini.games.hoops = HoopsGame;
})();
