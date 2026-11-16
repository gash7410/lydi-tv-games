// «Σπάσε φούσκες»: όλοι στην ίδια αρένα. Joystick αριστερά-δεξιά, «ΒΕΛΟΣ» για βέλος με αλυσίδα που ανεβαίνει κάθετα.
// Κάθε φούσκα που χτυπιέται σπάει σε δύο μικρότερες· οι πιο μικρές σκάνε. Όσο μικρότερη, τόσο περισσότεροι πόντοι.
// Αν σε χτυπήσει φούσκα, ζαλίζεσαι και χάνεις 3 πόντους. 3 επίπεδα· νικά όποιος μαζέψει τους περισσότερους πόντους.
(function () {
  'use strict';
  const { Base, U } = Mini;
  const AW = 16, AH = 9;                       // διαστάσεις αρένας (μονάδες κόσμου, y προς τα πάνω)
  const G = 11;                                 // βαρύτητα
  const RAD = [0, 0.36, 0.62, 1.0, 1.45];       // ακτίνα ανά μέγεθος
  const HOP = [0, 2.8, 4.1, 5.4, 6.5];          // ύψος αναπήδησης (κέντρο) ανά μέγεθος
  const PTS = [0, 5, 3, 2, 1];                  // πόντοι ανά μέγεθος
  const VX = 2.3, SHOT_V = 15, SPEED = 6.2, PW = 0.75, PH = 1.25;
  const STUN = 2.2, SAFE = 3.6, HIT_LOSS = 3, LEVEL_TIME = 70;
  const LEVELS = [[4], [4, 3], [4, 4, 2]];
  const HUES = [null, '#4fc3ff', '#3ee08f', '#ffb02e', '#ff5a6e']; // χρώμα ανά μέγεθος

  class BubbleGame extends Base {
    constructor(c, h) { super(c, h); this.WIN = 0; }

    setup() {
      this.parts.forEach((p, i) => Object.assign(p, { pops: 0, hits: 0, x: 0, face: 1, jx: 0, jy: 0 }));
      this.level = 0;
      this.nextLevel();
    }

    nextLevel() {
      this.level++;
      const n = this.parts.length;
      this.bubbles = []; this.bursts = []; this.floats = [];
      this.levelT = 0;
      const sizes = [...LEVELS[this.level - 1]];
      if (n >= 3) sizes.push(3);
      sizes.forEach((s, i) => {
        const k = (i + 1) / (sizes.length + 1);
        this.bubbles.push({
          x: AW * k, y: AH - RAD[s] - 1.2 - (i % 2) * 0.6, vx: i % 2 ? -VX : VX, vy: 0, s,
          born: this.time,
        });
      });
      this.parts.forEach((p, i) => Object.assign(p, {
        x: AW * (i + 1) / (n + 1), shot: null, stunT: 0, safeT: 0, status: '', hi: false, botT: 0, walk: 0,
      }));
      this.phase = 'count';
      this.banner(this.level === 1 ? 'Σπάσε όλες τις φούσκες!' : `Επίπεδο ${this.level}`, '#fff');
      this.countdown(() => { this.phase = 'go'; this.changed(); });
      this.changed();
    }

    input(part, msg) {
      if (!part) return;
      if (msg.type === 'joy') {
        part.jx = U.clamp(+msg.x || 0, -1, 1);
      } else if (msg.type === 'dash') this.fire(part);
    }

    fire(p) {
      if (this.phase !== 'go' || p.shot || p.stunT > 0) return;
      p.shot = { x: p.x, tip: PH * 0.6 };
      this.sfx('throw');
    }

    bot(p, dt) {
      p.botT -= dt;
      if (p.botT > 0) return;
      p.botT = 0.1;
      if (!this.bubbles.length) { p.jx = 0; return; }
      // κοντινή απειλή; απομακρύνσου
      const danger = this.bubbles.find((b) => Math.abs(b.x - p.x) < RAD[b.s] + 1.3 && b.y - RAD[b.s] < 2.4 && b.vy < 0);
      if (danger) { p.jx = danger.x > p.x ? -1 : 1; if (p.x < 1 || p.x > AW - 1) p.jx = -p.jx; return; }
      // αλλιώς στήσου κάτω από τη χαμηλότερη φούσκα, λίγο μπροστά της
      const t = this.bubbles.reduce((a, b) => (Math.abs(a.x - p.x) < Math.abs(b.x - p.x) ? a : b));
      const aim = U.clamp(t.x + t.vx * 0.35, 0.5, AW - 0.5);
      const d = aim - p.x;
      p.jx = Math.abs(d) < 0.25 ? 0 : U.clamp(d * 1.5, -0.9, 0.9);
      if (Math.abs(d) < RAD[t.s] * 0.8 && !p.shot && this.time > (p.botFire || 0) && Math.random() < 0.4) { p.botFire = this.time + U.rand(0.7, 1.3); this.fire(p); }
    }

    pop(b, p) {
      this.bubbles.splice(this.bubbles.indexOf(b), 1);
      const pts = PTS[b.s];
      p.score += pts; p.pops++;
      this.floats.push({ x: b.x, y: b.y, t: 0, text: `+${pts}`, c: p.color.hex });
      this.bursts.push({ x: b.x, y: b.y, r: RAD[b.s], hue: HUES[b.s], t: 0 });
      if (b.s > 1) {
        for (const sd of [-1, 1]) {
          const s = b.s - 1;
          this.bubbles.push({ x: b.x + sd * RAD[s] * 0.6, y: Math.max(RAD[s] + 0.05, b.y), vx: sd * VX, vy: 4.6, s, born: this.time });
        }
        this.sfx('pop');
      } else this.sfx('point');
      this.fx(p, b.s > 1 ? `💥 +${pts}` : `✨ Έσκασε! +${pts}`, [40]);
      this.changed();
    }

    update(dt) {
      for (const f of this.floats) f.t += dt;
      this.floats = this.floats.filter((f) => f.t < 1.1);
      for (const q of this.bursts) q.t += dt;
      this.bursts = this.bursts.filter((q) => q.t < 0.45);
      if (this.phase !== 'go') {
        for (const p of this.parts) p.walk = 0;
        return;
      }
      this.levelT += dt;

      // παίκτες
      for (const p of this.parts) {
        if (p.bot) this.bot(p, dt);
        p.stunT = Math.max(0, p.stunT - dt); p.safeT = Math.max(0, p.safeT - dt);
        if (p.stunT <= 0 && p.status === '😵 Ζαλίστηκε') { p.status = ''; this.changed(); }
        const mv = p.stunT > 0 ? 0 : p.jx;
        p.x = U.clamp(p.x + mv * SPEED * dt, PW / 2, AW - PW / 2);
        if (Math.abs(mv) > 0.15) { p.face = Math.sign(mv); p.walk += dt * Math.abs(mv) * 10; } else p.walk = 0;
        if (p.shot) {
          p.shot.tip += SHOT_V * dt;
          if (p.shot.tip >= AH) p.shot = null;
        }
      }

      // φούσκες
      for (const b of this.bubbles) {
        const r = RAD[b.s];
        b.vy -= G * dt;
        b.x += b.vx * dt; b.y += b.vy * dt;
        if (b.x < r) { b.x = r; b.vx = Math.abs(b.vx); }
        if (b.x > AW - r) { b.x = AW - r; b.vx = -Math.abs(b.vx); }
        if (b.y < r) { b.y = r; b.vy = Math.sqrt(2 * G * (HOP[b.s] - r + 0.3)); this.sfx('bounce'); }
        if (b.y > AH - r) { b.y = AH - r; b.vy = -Math.abs(b.vy) * 0.5; }
      }

      // βέλη πάνω σε φούσκες
      for (const p of this.parts) {
        if (!p.shot) continue;
        const hit = this.bubbles.find((b) => Math.abs(b.x - p.shot.x) < RAD[b.s] && b.y - RAD[b.s] < p.shot.tip);
        if (hit) { p.shot = null; this.pop(hit, p); }
      }

      // φούσκες πάνω σε παίκτες
      for (const p of this.parts) {
        if (p.safeT > 0) continue;
        for (const b of this.bubbles) {
          const r = RAD[b.s] * 0.9;
          const cx = U.clamp(b.x, p.x - PW / 2, p.x + PW / 2), cy = U.clamp(b.y, 0, PH);
          if (Math.hypot(b.x - cx, b.y - cy) < r) {
            p.stunT = STUN; p.safeT = SAFE; p.hits++; p.shot = null;
            const loss = Math.min(HIT_LOSS, p.score); p.score -= loss;
            p.status = '😵 Ζαλίστηκε';
            if (loss) this.floats.push({ x: p.x, y: PH + 0.6, t: 0, text: `−${loss}`, c: '#ff4d5e' });
            this.sfx('buzz');
            this.fx(p, `Σε χτύπησε φούσκα! −${loss}`, [200, 60, 200]);
            this.changed();
            break;
          }
        }
      }

      if (!this.bubbles.length) this.endLevel(true);
      else if (this.levelT >= LEVEL_TIME) this.endLevel(false);
    }

    endLevel(cleared) {
      this.phase = 'clear';
      this.parts.forEach((p) => { p.shot = null; p.jx = 0; });
      if (cleared) { this.sfx('finish'); this.banner(`Επίπεδο ${this.level} καθαρό! ✨`, '#ffc93d'); }
      else { this.sfx('miss'); this.banner('Τέλος χρόνου!', '#ff8a8a'); this.bubbles = []; }
      this.changed();
      if (this.level >= LEVELS.length) this.after(2.2, () => this.running && this.finish());
      else this.after(2.8, () => this.running && this.nextLevel());
    }

    finish() {
      this.phase = 'end';
      const rank = [...this.parts].sort((a, b) => b.score - a.score || b.pops - a.pops || a.hits - b.hits);
      const winner = rank[0];
      winner.hi = true;
      this.celebrate(winner.color.hex);
      this.sfx('win');
      this.changed();
      this.h.onOver && this.h.onOver({
        winner,
        stats: `${winner.score} πόντοι · ${winner.pops} φούσκες`,
        rank: rank.map((q) => ({ name: q.name, color: q.color, st: `${q.score} πόντοι · ${q.pops} φούσκες · ${q.hits} χτυπήματα` })),
      });
    }

    ctrl(part) {
      const base = { mode: 'joy', btn: 'ΒΕΛΟΣ ⬆', cdMs: 300 };
      if (this.phase === 'go' && part.stunT > 0) return { ...base, active: false, label: '😵 Ζαλίστηκες!', sub: 'Σε λίγο συνεχίζεις' };
      if (this.phase === 'go') return { ...base, active: true, scoreText: `Πόντοι: ${part.score}` };
      return { ...base, active: false, label: this.phase === 'count' ? 'Ετοιμάσου!' : 'Μπράβο!', sub: 'Joystick: αριστερά-δεξιά · ΒΕΛΟΣ: ρίξε προς τα πάνω' };
    }

    // ---------- σχεδίαση ----------
    view() {
      const W = this.W, H = this.H;
      const top = H * 0.17, bot = H * 0.83;
      const s = Math.min((W * 0.92) / AW, (bot - top) / AH);
      const w = AW * s, h = AH * s;
      return { s, x0: (W - w) / 2, y0: bot, w, h };
    }
    P(v, X, Y) { return { x: v.x0 + X * v.s, y: v.y0 - Y * v.s }; }

    draw() {
      const x = this.ctx, W = this.W, H = this.H, vh = this.vh, v = this.view();
      // φόντο έξω από την αρένα
      const bg = x.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, '#1b0f3a'); bg.addColorStop(1, '#0b0620');
      x.fillStyle = bg; x.fillRect(0, 0, W, H);

      // αρένα: ουρανός σούρουπου με βουνά
      x.save();
      x.beginPath(); x.rect(v.x0, v.y0 - v.h, v.w, v.h); x.clip();
      const sky = x.createLinearGradient(0, v.y0 - v.h, 0, v.y0);
      sky.addColorStop(0, '#3a1c71'); sky.addColorStop(0.55, '#d76d77'); sky.addColorStop(1, '#ffaf7b');
      x.fillStyle = sky; x.fillRect(v.x0, v.y0 - v.h, v.w, v.h);
      x.fillStyle = 'rgba(255,240,200,.85)';
      x.beginPath(); x.arc(v.x0 + v.w * 0.78, v.y0 - v.h * 0.62, v.s * 1.1, 0, 7); x.fill();
      const ridge = (amp, base, col, ph) => {
        x.fillStyle = col; x.beginPath(); x.moveTo(v.x0, v.y0);
        for (let i = 0; i <= 40; i++) {
          const t = i / 40;
          const yy = base + Math.sin(t * 9 + ph) * amp * 0.5 + Math.sin(t * 23 + ph * 2) * amp * 0.25 + Math.abs(Math.sin(t * 4 + ph)) * amp;
          x.lineTo(v.x0 + t * v.w, v.y0 - yy * v.s);
        }
        x.lineTo(v.x0 + v.w, v.y0); x.closePath(); x.fill();
      };
      ridge(1.6, 2.6, '#7a3b69', 0.4);
      ridge(1.2, 1.4, '#4a2152', 2.1);
      x.restore();

      // πλαίσιο από τούβλα
      const fw = v.s * 0.38;
      x.fillStyle = '#c0582b';
      x.fillRect(v.x0 - fw, v.y0 - v.h - fw, v.w + fw * 2, fw);
      x.fillRect(v.x0 - fw, v.y0, v.w + fw * 2, fw * 1.6);
      x.fillRect(v.x0 - fw, v.y0 - v.h, fw, v.h);
      x.fillRect(v.x0 + v.w, v.y0 - v.h, fw, v.h);
      x.save(); x.beginPath(); x.rect(v.x0 - fw, v.y0 - v.h - fw, v.w + fw * 2, v.h + fw * 2.6); x.clip();
      x.strokeStyle = 'rgba(60,20,5,.55)'; x.lineWidth = Math.max(1, vh * 0.18);
      const bw = fw * 2;
      for (let X = v.x0 - fw, k = 0; X < v.x0 + v.w + fw; X += bw, k++) {
        x.strokeRect(X, v.y0 - v.h - fw, bw, fw);
        x.strokeRect(X + (k % 2 ? 0 : bw / 2), v.y0, bw, fw * 0.8); x.strokeRect(X + (k % 2 ? bw / 2 : 0), v.y0 + fw * 0.8, bw, fw * 0.8);
      }
      for (let Y = v.y0 - v.h; Y < v.y0; Y += fw) { x.strokeRect(v.x0 - fw, Y, fw, fw); x.strokeRect(v.x0 + v.w, Y, fw, fw); }
      x.restore();
      x.strokeStyle = U.INK; x.lineWidth = this.lw * 1.3;
      x.strokeRect(v.x0, v.y0 - v.h, v.w, v.h);

      // βέλη
      for (const p of this.parts) if (p.shot) this.drawShot(v, p);
      // φούσκες
      for (const b of this.bubbles) this.drawBubble(v, b);
      // σκασίματα
      for (const q of this.bursts) {
        const c = this.P(v, q.x, q.y), t = q.t / 0.45, r = q.r * v.s;
        x.strokeStyle = U.rgba(q.hue, 1 - t); x.lineWidth = vh * 0.6 * (1 - t) + 1;
        for (let i = 0; i < 8; i++) {
          const a = (i * Math.PI) / 4 + 0.3;
          x.beginPath(); x.moveTo(c.x + Math.cos(a) * r * (0.6 + t), c.y + Math.sin(a) * r * (0.6 + t));
          x.lineTo(c.x + Math.cos(a) * r * (1 + t * 1.6), c.y + Math.sin(a) * r * (1 + t * 1.6)); x.stroke();
        }
      }
      // παίκτες
      for (const p of this.parts) this.drawPlayer(v, p);
      // αιωρούμενοι πόντοι
      for (const f of this.floats) {
        const c = this.P(v, f.x, f.y + f.t * 1.4);
        x.globalAlpha = Math.max(0, 1 - f.t / 1.1);
        this.text(f.text, c.x, c.y, vh * 3.6, f.c, { sw: vh * 0.7 });
        x.globalAlpha = 1;
      }

      // πάνω μπάρα: επίπεδο + χρόνος
      const left = Math.max(0, LEVEL_TIME - this.levelT);
      const bw2 = Math.min(v.w * 0.36, vh * 50), bx = W / 2 - bw2 / 2 + vh * 6, by = v.y0 - v.h - v.s * 0.38 - vh * 5.4, bh = vh * 3.2;
      this.text(`Επίπεδο ${this.level}/${LEVELS.length}`, bx - vh * 9, by + bh / 2, vh * 3.2, '#fff', { align: 'right' });
      U.rr(x, bx, by, bw2, bh, bh / 2); x.fillStyle = 'rgba(255,255,255,.14)'; x.fill();
      const fr = left / LEVEL_TIME;
      if (fr > 0) { U.rr(x, bx, by, bw2 * fr, bh, bh / 2); x.fillStyle = fr < 0.25 && Math.sin(this.time * 10) > 0 ? '#ff4d5e' : '#ffc93d'; x.fill(); }
      x.lineWidth = this.lw; x.strokeStyle = U.INK; U.rr(x, bx, by, bw2, bh, bh / 2); x.stroke();
      this.text(`${Math.ceil(left)}″`, bx - vh * 1.5, by + bh / 2, vh * 3, '#fff', { align: 'right' });

      if (this.phase === 'count' || (this.phase === 'go' && this.time - this.countT < 3.7)) this.drawCount(this.countT, 'ΣΠΑΣ\' ΤΕΣ!');
      this.drawBoard();
    }

    drawBubble(v, b) {
      const x = this.ctx, c = this.P(v, b.x, b.y), r = RAD[b.s] * v.s;
      const age = this.time - b.born, sc = age < 0.15 ? 0.6 + age / 0.15 * 0.4 : 1;
      // σκιά στο έδαφος
      const sh = this.P(v, b.x, 0), k = Math.max(0.2, 1 - b.y / AH);
      x.fillStyle = `rgba(30,10,30,${0.3 * k})`;
      x.beginPath(); x.ellipse(sh.x, sh.y - v.s * 0.05, r * k, r * 0.22 * k, 0, 0, 7); x.fill();
      x.save(); x.translate(c.x, c.y); x.scale(sc, sc);
      const g = x.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.08, 0, 0, r), hue = HUES[b.s];
      g.addColorStop(0, '#ffffff'); g.addColorStop(0.25, U.shade(hue, 0.25)); g.addColorStop(1, U.shade(hue, -0.35));
      x.fillStyle = g; x.strokeStyle = U.INK; x.lineWidth = this.lw * 1.2;
      x.beginPath(); x.arc(0, 0, r, 0, 7); x.fill(); x.stroke();
      x.fillStyle = 'rgba(255,255,255,.75)';
      x.beginPath(); x.ellipse(-r * 0.38, -r * 0.42, r * 0.2, r * 0.12, -0.7, 0, 7); x.fill();
      x.restore();
    }

    drawShot(v, p) {
      const x = this.ctx, base = this.P(v, p.shot.x, 0), tip = this.P(v, p.shot.x, p.shot.tip), s = v.s;
      // αλυσίδα σε ζιγκ-ζαγκ
      x.strokeStyle = '#e9e4ff'; x.lineWidth = Math.max(2, s * 0.07); x.lineJoin = 'round';
      x.beginPath(); x.moveTo(base.x, base.y);
      const step = s * 0.22;
      let i = 0;
      for (let y = base.y; y > tip.y + s * 0.3; y -= step, i++) x.lineTo(base.x + (i % 2 ? 1 : -1) * s * 0.09, y);
      x.lineTo(tip.x, tip.y + s * 0.3); x.stroke();
      // μύτη βέλους
      x.fillStyle = p.color.hex; x.strokeStyle = U.INK; x.lineWidth = this.lw;
      x.beginPath(); x.moveTo(tip.x, tip.y); x.lineTo(tip.x - s * 0.22, tip.y + s * 0.4); x.lineTo(tip.x + s * 0.22, tip.y + s * 0.4); x.closePath();
      x.fill(); x.stroke();
    }

    drawPlayer(v, p) {
      const x = this.ctx, s = v.s, c = p.color.hex, vh = this.vh;
      if (p.safeT > 0 && p.stunT <= 0 && Math.sin(this.time * 30) > 0) return; // αναβοσβήνει όσο προστατεύεται
      const g = this.P(v, p.x, 0);
      const bob = p.walk ? Math.abs(Math.sin(p.walk)) * s * 0.06 : 0;
      x.save(); x.translate(g.x, g.y - bob);
      if (p.stunT > 0) x.rotate(Math.sin(this.time * 14) * 0.12);
      x.lineWidth = this.lw * 1.1; x.strokeStyle = U.INK;
      // πόδια
      const sw = p.walk ? Math.sin(p.walk) * s * 0.12 : 0;
      x.fillStyle = '#2b2440';
      U.rr(x, -s * 0.26 + sw, -s * 0.38, s * 0.2, s * 0.38, s * 0.06); x.fill(); x.stroke();
      U.rr(x, s * 0.06 - sw, -s * 0.38, s * 0.2, s * 0.38, s * 0.06); x.fill(); x.stroke();
      // σώμα
      U.rr(x, -s * 0.34, -s * 0.9, s * 0.68, s * 0.58, s * 0.16);
      x.fillStyle = c; x.fill(); x.stroke();
      // κεφάλι
      x.fillStyle = '#ffd9b0'; x.beginPath(); x.arc(0, -s * 1.08, s * 0.24, 0, 7); x.fill(); x.stroke();
      // κράνος σε χρώμα παίκτη
      x.fillStyle = U.shade(c, -0.2);
      x.beginPath(); x.arc(0, -s * 1.12, s * 0.26, Math.PI, 0); x.closePath(); x.fill(); x.stroke();
      x.fillRect(p.face > 0 ? 0 : -s * 0.4, -s * 1.14, s * 0.4, s * 0.06);
      // μάτι
      x.fillStyle = U.INK;
      if (p.stunT > 0) this.text('✶', p.face * s * 0.1, -s * 1.03, s * 0.2, U.INK, { stroke: false });
      else { x.beginPath(); x.arc(p.face * s * 0.11, -s * 1.04, s * 0.04, 0, 7); x.fill(); }
      x.restore();
      // αστεράκια ζάλης
      if (p.stunT > 0) for (let i = 0; i < 3; i++) {
        const a = this.time * 5 + (i * Math.PI * 2) / 3;
        x.fillStyle = '#ffe878'; x.strokeStyle = U.INK; x.lineWidth = this.lw * 0.7;
        U.starPath(x, g.x + Math.cos(a) * s * 0.4, g.y - s * 1.45 + Math.sin(a) * s * 0.12, s * 0.11); x.fill(); x.stroke();
      }
      this.text(p.name, g.x, g.y - s * 1.75, vh * 2.2, c, { sw: vh * 0.55 });
    }

    drawBoard() {
      const x = this.ctx, n = this.parts.length, vh = this.vh;
      const cw = Math.min(this.W * 0.21, vh * 40), ch = vh * 9.5, gap = vh * 2;
      let X = (this.W - (n * cw + (n - 1) * gap)) / 2;
      const Y = this.H - ch - vh * 1.6;
      const best = Math.max(...this.parts.map((q) => q.score));
      for (const p of this.parts) {
        const c = p.color.hex;
        U.rr(x, X, Y, cw, ch, vh * 2);
        x.fillStyle = 'rgba(10,5,30,.85)'; x.fill();
        x.lineWidth = vh * 0.35; x.strokeStyle = p.hi || (best > 0 && p.score === best) ? c : 'rgba(255,255,255,.16)'; x.stroke();
        const name = p.name + (p.bot ? ' 🤖' : '') + (p.p && !p.p.connected ? ' (εκτός)' : '');
        x.font = this.font(vh * 2.4); x.textAlign = 'left'; x.textBaseline = 'middle'; x.fillStyle = c;
        let nm = name; while (x.measureText(nm).width > cw * 0.62 && nm.length > 2) nm = nm.slice(0, -2) + '…';
        x.fillText(nm, X + vh * 2, Y + vh * 3);
        x.font = this.font(vh * 1.9, 600); x.fillStyle = '#e9e4ff';
        x.fillText(p.status || `${p.pops} φούσκες`, X + vh * 2, Y + vh * 6.6);
        x.font = this.font(vh * 5.2, 800, 'Comfortaa'); x.textAlign = 'right'; x.fillStyle = '#fff';
        x.fillText(String(p.score), X + cw - vh * 2, Y + ch / 2 + vh * 0.3);
        X += cw + gap;
      }
    }
  }

  Mini.games.bubbles = BubbleGame;
})();
