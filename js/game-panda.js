// «Pandamania»: τα πάντα πηδούν από δέντρο σε δέντρο κρεμασμένα από κληματσίδες.
// Ένα κουμπί στο κινητό: κρεμασμένος → πάτα για να αφήσεις την κληματσίδα (άλμα),
// στον αέρα → πάτα για να πιάσεις την επόμενη, κάτω στο έδαφος → πάτα γρήγορα για να σκαρφαλώσεις.
// Η ενέργεια πέφτει συνέχεια· τα μπαμπού (στον αέρα και στον δρόμο) τη γεμίζουν.
// Νικά όποιος τερματίσει με τα περισσότερα μπαμπού (ισοπαλία: ο πιο γρήγορος).
(function () {
  'use strict';
  const { Base, U } = Mini;
  const TREES = 34;         // δέντρα στην πίστα
  const AY = 7.2;           // ύψος από όπου κρέμεται η κληματσίδα (μ.)
  const L = 4.2;            // μήκος κληματσίδας
  const G = 13;             // βαρύτητα (λίγο «γρήγορη» για να έχει ρυθμό)
  const AMAX = 1.1;         // μέγιστο πλάτος αιώρησης (rad, ~63°)
  const REACH = 1.1;        // πόσο κοντά στην κληματσίδα πρέπει να είσαι για να την πιάσεις
  const GRAB_WIN = 0.32;    // δευτ. που «ψάχνουν» τα χέρια μετά το πάτημα στον αέρα
  const BODY = 0.75;        // ύψος κέντρου του πάντα όταν πατά στο έδαφος
  const CLIMB_TOP = AY - L + 0.2;
  const DRAIN_AIR = 6, DRAIN_WALK = 2.5, CLIMB_COST = 1.2, BAMBOO_E = 12;
  const AFTER_WIN = 15;     // δευτ. για τους υπόλοιπους μετά τον πρώτο
  const MAX_T = 150;

  const fmt = (s) => s.toFixed(1).replace('.', ',') + '″';
  const hash = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
  const bam = (n) => `${n} ${n === 1 ? 'μπαμπού' : 'μπαμπού'}`;

  class PandaGame extends Base {
    constructor(c, h) { super(c, h); this.WIN = 0; this.trees = []; this.items = []; }

    setup() {
      // πίστα: ίδια για όλους
      this.trees = [];
      let x = 0;
      for (let i = 0; i < TREES; i++) {
        this.trees.push({ x, ax: x + 1.1, seed: Math.random() });
        x += i < 2 ? U.rand(4.8, 5.4) : U.rand(4.8, 6.6);
      }
      this.FIN = this.trees[TREES - 1].ax + 7;
      this.items = [];
      for (let i = 0; i < TREES - 1; i++) {
        const a = this.trees[i], b = this.trees[i + 1];
        // στον αέρα, πάνω στην τροχιά του άλματος
        if (i > 0 && Math.random() < 0.5) this.items.push({ x: (a.ax + b.ax) / 2 + U.rand(-0.6, 0.6), y: U.rand(3.6, 5.2), air: true, id: this.items.length });
        // στον δρόμο: τουλάχιστον ένα σε κάθε άνοιγμα, για να μην ξεμένεις
        const k = 1 + ((Math.random() * 3) | 0);
        for (let j = 0; j < k; j++) this.items.push({ x: U.rand(a.x + 1.2, b.x - 1), y: 0.25, air: false, id: this.items.length, rot: U.rand(-0.5, 0.5) });
      }
      // λίγα μπαμπού και μετά το τελευταίο δέντρο
      this.items.push({ x: this.FIN - 3.5, y: 0.25, air: false, id: this.items.length, rot: 0.2 });
      this.parts.forEach((p) => Object.assign(p, {
        st: 'hang', tree: 0, th: -0.35, w: 0, len: L, x: this.trees[0].ax, y: AY - L, vx: 0, vy: 0,
        E: 100, eaten: new Set(), score: 0, grabT: -9, stunT: -9, climbY: BODY, falls: 0, lastE: 10,
        done: false, t: null, place: 0, status: '', hi: false, face: 1, anim: U.rand(0, 6),
        botWait: 0, botSkill: U.rand(0.72, 0.86), botRel: null, botGrab: null, botNext: 0,
      }));
      this.parts.forEach((p) => this.place(p));
      this.phase = 'count'; this.places = 0; this.cam = -8; this.goT = 0; this.endAt = null;
      this.pops = []; this.leaves = [];
      this.banner('Κρατηθείτε γερά…', '#fff');
      this.after(1.5, () => this.phase === 'count' && this.banner('Πάτα για να αφήσεις την κληματσίδα!', '#ffc93d'));
      this.countdown(() => this.go());
      this.changed();
    }

    go() {
      this.phase = 'go'; this.goT = this.time;
      this.banner('PANDAMANIA! Από δέντρο σε δέντρο!', '#ffc93d');
      this.parts.forEach((p) => { p.w = 1.6; });
      this.changed();
    }

    anchor(p) { return this.trees[p.tree]; }
    place(p) { const a = this.anchor(p); p.x = a.ax + p.len * Math.sin(p.th); p.y = AY - p.len * Math.cos(p.th); }
    nextTree(x) { return this.trees.find((t) => t.x >= x - 0.6); }

    input(part, msg) {
      if (!part || part.done || msg.type !== 'tap' || this.phase !== 'go') return;
      this.press(part);
    }

    press(p) {
      if (p.st === 'hang') return this.release(p);
      if (p.st === 'fly') { p.grabT = this.time; return; }
      if (p.st === 'climb') return this.climb(p);
    }

    release(p) {
      const v = p.len * p.w;
      p.vx = v * Math.cos(p.th) * 1.05; p.vy = v * Math.sin(p.th) * 1.05;
      p.st = 'fly'; p.grabT = -9;
      this.sfx('dash');
      this.changed();
    }

    grab(p, j) {
      const a = this.trees[j];
      const dx = p.x - a.ax, dy = AY - p.y;
      p.tree = j;
      p.len = U.clamp(Math.hypot(dx, dy), 2.2, L);
      p.th = Math.atan2(dx, dy);
      p.w = (p.vx * Math.cos(p.th) + p.vy * Math.sin(p.th)) / p.len;
      if (p.w < 0.8) p.w = 0.8; // η φόρα σε πάει πάντα μπροστά
      p.st = 'hang'; p.grabT = -9;
      this.place(p);
      this.sfx('blip');
      this.changed();
    }

    fall(p, why) {
      p.st = 'ground'; p.y = BODY; p.vx = 0; p.vy = 0; p.stunT = this.time; p.falls++;
      this.sfx('bump');
      this.fx(p, why || '💥 Έπεσες! Σκαρφάλωσε στο επόμενο δέντρο', [120, 60, 120]);
      p.status = 'Έπεσε!';
      this.changed();
    }

    climb(p) {
      const tired = p.E <= 0;
      if (!tired) p.E = Math.max(0, p.E - CLIMB_COST);
      p.climbY += tired ? 0.22 : 0.55;
      p.y = p.climbY;
      this.sfx('step');
      if (p.climbY >= CLIMB_TOP) {
        p.tree = this.trees.indexOf(p.climbTree);
        p.len = L; p.th = -0.3; p.w = 1.4; p.st = 'hang';
        this.place(p);
        p.status = '';
        this.sfx('blip');
        this.changed();
      }
    }

    eat(p, it) {
      p.eaten.add(it.id); p.score++;
      p.E = Math.min(100, p.E + BAMBOO_E);
      this.sfx('point');
      this.pops.push({ x: it.x, y: it.air ? it.y : 1.2, lane: this.parts.indexOf(p), life: 0.9 });
      this.changed();
    }

    finishPanda(p) {
      p.done = true; p.st = 'done'; p.y = BODY; p.vx = 0; p.vy = 0;
      p.t = Math.max(0.5, this.time - this.goT);
      p.place = ++this.places;
      p.status = `${p.place}ος · ${fmt(p.t)}`;
      if (p.place === 1) {
        this.sfx('finish');
        this.banner(`${p.name} τερμάτισε πρώτος! ${AFTER_WIN}″ για τους υπόλοιπους`, p.color.hex);
        this.endAt = this.time + AFTER_WIN;
        this.after(AFTER_WIN, () => this.endRace());
      } else this.sfx('point');
      this.fx(p, `🏁 Τερμάτισες ${p.place}ος με ${bam(p.score)}!`, [60, 40, 160], p.place === 1);
      if (this.parts.every((q) => q.done)) this.after(1.6, () => this.endRace());
      this.changed();
    }

    ranked() {
      return [...this.parts].sort((a, b) => (b.done - a.done) || (a.done ? (b.score - a.score) || (a.t - b.t) : (b.x - a.x)));
    }

    endRace() {
      if (this.phase !== 'go') return;
      this.phase = 'end';
      this.parts.filter((p) => !p.done).forEach((p) => { p.status = 'Δεν τερμάτισε'; });
      const rank = this.ranked();
      rank[0].hi = true;
      this.changed();
      const w = rank[0];
      this.celebrate(w.color.hex);
      this.sfx('win');
      const fl = (q) => (q.falls ? ` · ${q.falls} ${q.falls === 1 ? 'πτώση' : 'πτώσεις'}` : '');
      this.h.onOver && this.h.onOver({
        winner: w,
        stats: w.done ? `Τερμάτισε με ${bam(w.score)} σε ${fmt(w.t)}${fl(w)}` : `Έφτασε πιο μακριά, με ${bam(w.score)}`,
        rank: rank.map((q) => ({ name: q.name, color: q.color, st: `🎋 ${q.score} · ` + (q.done ? fmt(q.t) : `${Math.max(0, Math.round((q.x / this.FIN) * 100))}% της πίστας`) + fl(q) })),
      });
    }

    // ---------- φυσική ----------
    update(dt) {
      const go = this.phase === 'go';
      for (const p of this.parts) {
        p.anim += dt;
        if (p.done) { if (p.x < this.FIN + 4) p.x += 2.2 * dt; continue; }
        if (p.st === 'hang') this.swing(p, dt, go);
        else if (p.st === 'fly') this.fly(p, dt);
        else if (p.st === 'ground') this.walk(p, dt);
        if (!go) continue;
        // ενέργεια
        const drain = p.st === 'ground' ? DRAIN_WALK : p.st === 'climb' ? 0 : DRAIN_AIR;
        p.E = Math.max(0, p.E - drain * dt);
        if (p.E <= 0 && (p.st === 'hang' || p.st === 'fly')) {
          if (p.st === 'hang') { const v = p.len * p.w; p.vx = v * Math.cos(p.th); p.vy = v * Math.sin(p.th); }
          p.st = 'fly'; p.tired = true;
          this.fx(p, '😩 Τέλειωσε η ενέργεια! Φάε μπαμπού από τον δρόμο', [200, 80, 200]);
        }
        const lvl = Math.ceil(p.E / 10);
        if (lvl !== p.lastE) { p.lastE = lvl; this.changed(); }
        // μπαμπού
        for (const it of this.items) {
          if (p.eaten.has(it.id)) continue;
          if (it.air ? Math.hypot(p.x - it.x, p.y - it.y) < 0.95 : (p.st === 'ground' && Math.abs(p.x - it.x) < 0.6)) this.eat(p, it);
        }
        if (p.x >= this.FIN) this.finishPanda(p);
        if (p.bot) this.bot(p, dt);
      }
      if (go && this.time - this.goT > MAX_T) this.endRace();
      for (const q of this.pops) q.life -= dt;
      this.pops = this.pops.filter((q) => q.life > 0);
      if (Math.random() < dt * 1.1) this.leaves.push({ x: U.rand(0, 1.1), y: -0.05, vy: U.rand(0.05, 0.1), ph: U.rand(0, 6), c: U.pick(['#7fc24a', '#a8d65a', '#4f9a3a']) });
      for (const l of this.leaves) { l.y += l.vy * dt; l.x += Math.sin(this.time * 1.4 + l.ph) * 0.0008 - 0.0005; }
      this.leaves = this.leaves.filter((l) => l.y < 1.05);
      // κάμερα: ακολουθεί τον πρώτο, χωράει και τον τελευταίο
      const xs = this.parts.map((p) => p.x);
      const lead = Math.max(...xs), tail = Math.min(...xs), span = this.span();
      const want = U.clamp(Math.max(lead - span * 0.72, Math.min(tail - span * 0.24, lead - span * 0.4)), -span * 0.3, this.FIN + 8 - span);
      this.cam += (want - this.cam) * Math.min(1, dt * 2.5);
    }

    swing(p, dt, go) {
      const k = G / p.len;
      // μόνο του «φουσκώνει» την αιώρηση μέχρι το AMAX
      const E = 0.5 * p.w * p.w + k * (1 - Math.cos(p.th)), Et = k * (1 - Math.cos(AMAX));
      const steps = 4, h = dt / steps;
      for (let i = 0; i < steps; i++) {
        p.w += (-k * Math.sin(p.th) + (go ? (E < Et ? 2.6 : -0.8) * Math.sign(p.w || 1) : 0)) * h;
        if (!go) p.w -= p.w * h * 0.8;
        p.th += p.w * h;
      }
      this.place(p);
    }

    fly(p, dt) {
      p.vy -= G * dt; p.x += p.vx * dt; p.y += p.vy * dt;
      if (this.time - p.grabT < GRAB_WIN && p.E > 0) {
        for (let j = p.tree + 1; j < this.trees.length; j++) {
          const a = this.trees[j];
          if (a.ax - p.x > 3) break;
          if (Math.abs(p.x - a.ax) < REACH && p.y > AY - L - 0.5 && p.y < AY - 0.6) return this.grab(p, j);
        }
      }
      if (p.y > BODY) return;
      if (!this.nextTree(p.x)) { p.st = 'ground'; p.y = BODY; p.stunT = -9; p.tired = false; return; } // μετά το τελευταίο δέντρο: προσγείωση
      this.fall(p, p.tired ? '😩 Κουράστηκες κι έπεσες! Φάε μπαμπού' : null);
      p.tired = false;
    }

    walk(p, dt) {
      if (this.time - p.stunT < 0.6) return;
      const t = this.nextTree(p.x);
      const sp = p.E > 0 ? 3 : 1.3;
      const goal = t ? t.x - 0.55 : this.FIN + 1;
      p.x = Math.min(goal, p.x + sp * dt);
      if (t && p.x >= goal - 0.01) {
        p.st = 'climb'; p.climbTree = t; p.climbY = BODY; p.x = goal;
        p.status = 'Σκαρφαλώνει';
        this.changed();
      }
    }

    // ---------- ρομπότ ----------
    // προσομοιώνει το άλμα: αφήνει την κληματσίδα όταν η τροχιά φτάνει στην επόμενη
    reachable(p) {
      const v = p.len * p.w;
      let x = p.x, y = p.y, vx = v * Math.cos(p.th) * 1.05, vy = v * Math.sin(p.th) * 1.05;
      const a = this.trees[p.tree + 1];
      if (!a) return { ok: true, t: 0 };
      for (let t = 0; t < 2; t += 0.02) {
        vy -= G * 0.02; x += vx * 0.02; y += vy * 0.02;
        if (Math.abs(x - a.ax) < REACH * 0.7 && y > AY - L - 0.3 && y < AY - 0.8) return { ok: true, t };
        if (y < BODY || x > a.ax + 1) return { ok: false };
      }
      return { ok: false };
    }

    bot(p, dt) {
      p.botNext -= dt;
      if (p.st === 'hang') {
        if (p.botWait > 0) { p.botWait -= dt; return; }
        if (p.w > 0.5 && p.th > 0.05) {
          const r = this.reachable(p);
          if (r.ok) {
            if (p.botRel == null) p.botRel = Math.random() < p.botSkill ? 0 : U.rand(0.08, 0.25);
            p.botRel -= dt;
            if (p.botRel <= 0) { p.botRel = null; p.botGrab = null; this.release(p); }
          } else if (p.botRel != null && p.botRel <= 0) { p.botRel = null; this.release(p); }
        }
      } else if (p.st === 'fly') {
        const a = this.trees[p.tree + 1];
        if (!a) return;
        if (p.botGrab == null) p.botGrab = Math.random() < p.botSkill + 0.05 ? U.rand(0.25, 0.6) : U.rand(-0.6, -0.3);
        if (a.ax - p.x < p.botGrab + REACH && this.time - p.grabT > GRAB_WIN) p.grabT = this.time;
      } else if (p.st === 'climb' && p.botNext <= 0) {
        this.climb(p);
        p.botNext = 1 / U.rand(5, 7);
        if (p.st === 'hang') p.botWait = U.rand(0.2, 0.5);
      }
    }

    span() { return Math.max(30, (this.W / this.vh) * 0.4); }

    ctrl(part) {
      if (this.phase === 'go' && part && !part.done) {
        const e = `Ενέργεια ${Math.round(part.E)}% · 🎋 ${part.score}`;
        if (part.st === 'hang') return { mode: 'tap', label: 'ΑΛΜΑ', sub: `${e} — πάτα όταν η αιώρηση πάει μπροστά`, active: true };
        if (part.st === 'fly') return { mode: 'tap', label: 'ΠΙΑΣΕ', sub: `${e} — πάτα μόλις φτάσεις την κληματσίδα`, active: true };
        if (part.st === 'climb') return { mode: 'tap', label: 'ΣΚΑΡΦΑΛΩΣΕ', sub: `${e} — πάτα γρήγορα!`, active: true };
        return { mode: 'tap', label: 'Περπατά…', sub: `${e} — μάζεψε τα μπαμπού του δρόμου`, active: false };
      }
      if (this.phase === 'go') return { mode: 'tap', label: 'Τερμάτισες!', sub: `🎋 ${part.score} μπαμπού · κοίτα την τηλεόραση`, active: false };
      if (this.phase === 'count') return { mode: 'tap', label: 'Έτοιμος…', sub: 'Κρέμεσαι από την κληματσίδα. Μόλις ξεκινήσει, πάτα για άλμα.', active: false };
      return { mode: 'tap', label: 'Τέλος!', sub: 'Δες τα αποτελέσματα στην τηλεόραση', active: false };
    }

    // ---------- σχέδιο ----------
    geo() {
      const W = this.W, H = this.H, vh = this.vh, n = this.parts.length;
      const top = vh * 10.5, bot = H - vh * 2;
      const lh = (bot - top) / Math.max(n, 2);
      const ppm = (lh * 0.9) / 8.6;
      return { W, H, vh, n, top, lh, ppm, X: (m) => (m - this.cam) * ppm };
    }

    draw() {
      const x = this.ctx, g = this.geo(), { W, H, vh } = g;
      // ουρανός δάσους
      const sky = x.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, '#173d2c'); sky.addColorStop(1, '#0c2219');
      x.fillStyle = sky; x.fillRect(0, 0, W, H);
      this.parts.forEach((p, i) => this.drawLane(g, p, i));
      // πεσμένα φύλλα
      for (const l of this.leaves) {
        x.save(); x.translate(l.x * W, l.y * H); x.rotate(this.time * 2 + l.ph); x.fillStyle = l.c;
        x.beginPath(); x.ellipse(0, 0, vh * 0.8, vh * 0.35, 0, 0, 7); x.fill(); x.restore();
      }
      if (this.phase === 'count') this.drawCount(this.countT, 'ΑΛΜΑ!');
      if (this.endAt && this.phase === 'go') {
        const s = Math.max(0, Math.ceil(this.endAt - this.time));
        this.text(`⏱ ${s}″`, W - vh * 3, vh * 13.5, vh * 4, s <= 5 ? '#ff6b5a' : '#ffc93d', { align: 'right' });
      }
    }

    drawLane(g, p, i) {
      const x = this.ctx, { W, vh, lh, ppm, X } = g;
      const Y0 = g.top + i * lh, gy = Y0 + lh * 0.93;
      const SY = (m) => gy - m * ppm;
      x.save();
      x.beginPath(); x.rect(0, Y0, W, lh); x.clip();
      // φόντο λωρίδας
      const bg = x.createLinearGradient(0, Y0, 0, gy);
      bg.addColorStop(0, '#2e6b45'); bg.addColorStop(1, '#a8d68a');
      x.fillStyle = bg; x.fillRect(0, Y0, W, lh);
      // μακρινά δέντρα (parallax)
      const far = this.cam * 0.45, fs = 3.2;
      for (let k = Math.floor(far / fs) - 1; k < far / fs + W / ppm / fs + 2; k++) {
        const fx = (k * fs - far) * ppm, hh = (3.5 + hash(k) * 3) * ppm;
        x.fillStyle = hash(k + 9) > 0.5 ? '#3f8a55' : '#4d9a60';
        x.beginPath(); x.moveTo(fx - ppm * 1.6, gy); x.lineTo(fx, gy - hh); x.lineTo(fx + ppm * 1.6, gy); x.fill();
      }
      // δρόμος
      x.fillStyle = '#6b4a2b'; x.fillRect(0, gy, W, lh);
      x.fillStyle = '#c89a5e'; x.fillRect(0, gy - ppm * 0.15, W, ppm * 0.55);
      x.fillStyle = '#4d9a3a'; x.fillRect(0, gy - ppm * 0.3, W, ppm * 0.18);
      // τερματισμός
      const fxp = X(this.FIN);
      if (fxp > -ppm * 2 && fxp < W + ppm * 2) {
        const sq = ppm * 0.5;
        for (let r = 0; r < 14; r++) for (let c = 0; c < 2; c++) {
          x.fillStyle = (r + c) % 2 ? '#fff' : '#1c1a2b'; x.fillRect(fxp + c * sq, SY(7) + r * sq, sq, sq);
        }
        x.fillStyle = '#8a5a32'; x.fillRect(fxp - ppm * 0.25, SY(7.4), ppm * 0.25, ppm * 7.4);
      }
      // δέντρα + κληματσίδες
      const lw = Math.max(1.5, ppm * 0.09);
      x.lineJoin = 'round'; x.lineCap = 'round';
      for (let j = 0; j < this.trees.length; j++) {
        const t = this.trees[j], tx = X(t.x);
        if (tx < -ppm * 5 || tx > W + ppm * 5) continue;
        // κορμός
        x.fillStyle = '#7a4a26'; x.strokeStyle = U.INK; x.lineWidth = lw;
        x.beginPath(); x.moveTo(tx - ppm * 0.55, gy); x.lineTo(tx - ppm * 0.35, SY(8)); x.lineTo(tx + ppm * 0.35, SY(8)); x.lineTo(tx + ppm * 0.55, gy); x.closePath(); x.fill(); x.stroke();
        // κλαδί προς την κληματσίδα
        x.strokeStyle = '#5c3519'; x.lineWidth = ppm * 0.28;
        x.beginPath(); x.moveTo(tx, SY(AY - 0.5)); x.quadraticCurveTo(tx + ppm * 0.6, SY(AY + 0.1), X(t.ax) + ppm * 0.3, SY(AY)); x.stroke();
        // φύλλωμα
        for (let b = 0; b < 4; b++) {
          const ox = (hash(j * 7 + b) - 0.5) * 3.2, oy = 7.6 + hash(j * 3 + b) * 1.2, r = 1.2 + hash(j + b * 5) * 0.7;
          x.fillStyle = b % 2 ? '#2f7a3f' : '#3f9a4f';
          x.beginPath(); x.arc(tx + ox * ppm, SY(oy), r * ppm, 0, 7); x.fill();
        }
        // κληματσίδα (αν δεν κρέμεται ο πάντα από αυτή)
        if (!(p.st === 'hang' && p.tree === j)) {
          const sw = Math.sin(this.time * 1.3 + j) * 0.12;
          x.strokeStyle = '#3e8a2a'; x.lineWidth = ppm * 0.22;
          x.beginPath(); x.moveTo(X(t.ax), SY(AY)); x.quadraticCurveTo(X(t.ax + sw * 3), SY(AY - L / 2), X(t.ax + sw * 6), SY(AY - L)); x.stroke();
          x.fillStyle = '#5fb83a';
          for (let q = 1; q < 4; q++) { x.beginPath(); x.ellipse(X(t.ax + sw * q * 1.5) + ppm * 0.15, SY(AY - q * 1.05), ppm * 0.22, ppm * 0.1, 0.6, 0, 7); x.fill(); }
        }
      }
      // μπαμπού
      for (const it of this.items) {
        if (p.eaten.has(it.id)) continue;
        const ix = X(it.x);
        if (ix < -ppm * 2 || ix > W + ppm * 2) continue;
        if (it.air) {
          x.strokeStyle = 'rgba(255,240,140,.35)'; x.lineWidth = ppm * 0.08;
          x.beginPath(); x.arc(ix, SY(it.y), ppm * (1.15 + Math.sin(this.time * 4 + it.id) * 0.08), 0, 7); x.stroke();
          this.bamboo(ix, SY(it.y), ppm, Math.sin(this.time * 2 + it.id) * 0.2);
        } else this.bamboo(ix, SY(0.25), ppm, Math.PI / 2 + it.rot);
      }
      // «+1»
      for (const q of this.pops) {
        if (q.lane !== i) continue;
        x.globalAlpha = Math.min(1, q.life * 2);
        this.text('+1 🎋', X(q.x), SY(q.y + (0.9 - q.life) * 2), ppm * 0.8, '#d6ff7a', { sw: ppm * 0.16 });
        x.globalAlpha = 1;
      }
      // ο πάντα
      this.drawPanda(g, p, X, SY);
      x.restore();
      // ετικέτα λωρίδας: όνομα, μπαμπού, ενέργεια
      const bw = vh * 23, bh = Math.min(lh - vh * 1.2, vh * 9.5), bx = vh * 1.2, by = Y0 + vh * 0.6;
      U.rr(x, bx, by, bw, bh, vh * 1.4); x.fillStyle = 'rgba(10,5,30,.72)'; x.fill();
      x.lineWidth = vh * 0.3; x.strokeStyle = p.hi ? p.color.hex : 'rgba(255,255,255,.15)'; x.stroke();
      let nm = p.name + (p.bot ? ' 🤖' : '') + (p.p && !p.p.connected ? ' (εκτός)' : '');
      x.font = this.font(vh * 2.3); x.textAlign = 'left'; x.textBaseline = 'middle'; x.fillStyle = p.color.hex;
      while (x.measureText(nm).width > bw - vh * 9 && nm.length > 2) nm = nm.slice(0, -2) + '…';
      x.fillText(nm, bx + vh * 1.4, by + bh * 0.27);
      x.textAlign = 'right'; x.fillStyle = '#d6ff7a'; x.fillText(`🎋 ${p.score}`, bx + bw - vh * 1.2, by + bh * 0.27);
      const ew = bw - vh * 2.8, ex = bx + vh * 1.4, ey = by + bh * 0.52, eh = bh * 0.16;
      U.rr(x, ex, ey, ew, eh, eh / 2); x.fillStyle = 'rgba(255,255,255,.14)'; x.fill();
      if (p.E > 0) { U.rr(x, ex, ey, Math.max(eh, (ew * p.E) / 100), eh, eh / 2); x.fillStyle = p.E > 50 ? '#7ad13a' : p.E > 20 ? '#ffc93d' : '#ff5a4f'; x.fill(); }
      x.font = this.font(vh * 1.7, 600); x.textAlign = 'left'; x.fillStyle = '#e9e4ff';
      const pct = Math.round(U.clamp(p.x / this.FIN, 0, 1) * 100);
      x.fillText(p.status || `⚡ ${Math.round(p.E)}% · πίστα ${pct}%`, ex, by + bh * 0.84);
      // βελάκι αν ο πάντα βγήκε από την οθόνη
      const px = X(p.x);
      if (px < bw + vh * 2 && !p.done) {
        this.text('◀', bx + bw + vh * 2.2, Y0 + lh * 0.55, vh * 3, p.color.hex, { sw: vh * 0.5 });
      }
    }

    bamboo(X0, Y0, ppm, rot) {
      const x = this.ctx;
      x.save(); x.translate(X0, Y0); x.rotate(rot);
      const h = ppm * 1.9, w = ppm * 0.4;
      x.lineWidth = Math.max(1.2, ppm * 0.07); x.strokeStyle = U.INK;
      U.rr(x, -w / 2, -h / 2, w, h, w * 0.3); x.fillStyle = '#7cc84a'; x.fill(); x.stroke();
      x.strokeStyle = '#3d7a24';
      for (const k of [-0.18, 0.16]) { x.beginPath(); x.moveTo(-w / 2, k * h); x.lineTo(w / 2, k * h); x.stroke(); }
      x.fillStyle = '#5fb83a'; x.beginPath(); x.ellipse(w * 0.9, -h * 0.32, ppm * 0.45, ppm * 0.16, -0.6, 0, 7); x.fill();
      x.restore();
    }

    drawPanda(g, p, X, SY) {
      const x = this.ctx, s = g.ppm * 2.1, px = X(p.x);
      const onFoot = p.st === 'ground' || p.st === 'done';
      const py = onFoot ? SY(0) - s * 0.58 : SY(p.y);
      const a = this.anchor(p);
      if (p.st === 'hang') {
        // κληματσίδα μέχρι τα χέρια
        x.strokeStyle = '#3e8a2a'; x.lineWidth = g.ppm * 0.22;
        x.beginPath(); x.moveTo(X(a.ax), SY(AY)); x.lineTo(px, py); x.stroke();
      }
      let rot = 0, arms = 'up', legs = Math.sin(p.anim * 8) * 0.3;
      if (p.st === 'hang') { rot = p.th; legs = -p.w * 0.15; }
      else if (p.st === 'fly') { rot = U.clamp(p.vx * 0.04, -0.3, 0.3); arms = this.time - p.grabT < GRAB_WIN ? 'reach' : 'spread'; }
      else if (p.st === 'climb') { arms = 'climb'; legs = Math.sin(p.climbY * 6) * 0.4; }
      else { arms = 'walk'; legs = (p.st === 'ground' && this.time - p.stunT < 0.6) ? 0 : Math.sin(p.anim * 10) * 0.5; }
      x.save(); x.translate(px, py); x.rotate(rot);
      if (p.st === 'hang') x.translate(0, s * 0.48); // τα χέρια στην άκρη της κληματσίδας
      x.lineWidth = Math.max(1.4, s * 0.07); x.strokeStyle = U.INK; x.lineJoin = 'round'; x.lineCap = 'round';
      const blk = '#1f1d2a';
      // πόδια
      x.fillStyle = blk;
      for (const sd of [-1, 1]) {
        x.save(); x.translate(sd * s * 0.17, s * 0.28); x.rotate(sd * legs);
        U.rr(x, -s * 0.1, 0, s * 0.2, s * 0.3, s * 0.1); x.fill(); x.restore();
      }
      // χέρια
      const arm = (ang) => { x.save(); x.rotate(ang); U.rr(x, -s * 0.08, -s * 0.48, s * 0.16, s * 0.42, s * 0.08); x.fill(); x.restore(); };
      x.save(); x.translate(0, -s * 0.05);
      if (arms === 'up') { arm(-0.12); arm(0.12); }
      else if (arms === 'reach') { arm(0.9); arm(1.2); }
      else if (arms === 'spread') { arm(-1.3); arm(1.3); }
      else if (arms === 'climb') { arm(0.6 + Math.sin(p.climbY * 6) * 0.3); arm(0.9 - Math.sin(p.climbY * 6) * 0.3); }
      else { arm(2.6 + legs * 0.5); arm(-2.6 + legs * 0.5); }
      x.restore();
      // σώμα
      x.fillStyle = '#fff'; x.beginPath(); x.ellipse(0, s * 0.12, s * 0.3, s * 0.27, 0, 0, 7); x.fill(); x.stroke();
      x.fillStyle = blk; x.beginPath(); x.ellipse(0, -s * 0.06, s * 0.31, s * 0.1, 0, 0, 7); x.fill();
      // κασκόλ στο χρώμα του παίκτη
      x.fillStyle = p.color.hex; U.rr(x, -s * 0.28, -s * 0.13, s * 0.56, s * 0.1, s * 0.05); x.fill();
      // κεφάλι
      const hy = -s * 0.36;
      x.fillStyle = blk;
      for (const sd of [-1, 1]) { x.beginPath(); x.arc(sd * s * 0.19, hy - s * 0.17, s * 0.09, 0, 7); x.fill(); }
      x.fillStyle = '#fff'; x.beginPath(); x.ellipse(0, hy, s * 0.26, s * 0.23, 0, 0, 7); x.fill(); x.stroke();
      x.fillStyle = blk;
      for (const sd of [-1, 1]) { x.beginPath(); x.ellipse(sd * s * 0.1, hy - s * 0.01, s * 0.07, s * 0.09, sd * 0.5, 0, 7); x.fill(); }
      const dead = p.st === 'ground' && this.time - p.stunT < 0.6;
      x.fillStyle = '#fff';
      for (const sd of [-1, 1]) {
        if (dead) { x.strokeStyle = '#fff'; x.lineWidth = s * 0.03; x.beginPath(); x.moveTo(sd * s * 0.1 - s * 0.03, hy - s * 0.04); x.lineTo(sd * s * 0.1 + s * 0.03, hy + s * 0.02); x.stroke(); }
        else { x.beginPath(); x.arc(sd * s * 0.1 + s * 0.015, hy - s * 0.02, s * 0.025, 0, 7); x.fill(); }
      }
      x.fillStyle = blk; x.beginPath(); x.ellipse(0, hy + s * 0.08, s * 0.045, s * 0.03, 0, 0, 7); x.fill();
      x.restore();
      // όνομα πάνω από τον πάντα
      this.text(p.name + (p.bot ? ' 🤖' : ''), px, py - s * 0.95, Math.max(11, s * 0.24), p.color.hex, { sw: s * 0.08 });
    }
  }

  Mini.games.panda = PandaGame;
})();
