// «Shoot'n Map»: κυνήγι με καραμπίνα πάνω από μια λίμνη.
// Κάθε παίκτης έχει ένα στόχαστρο στο χρώμα του: μοχλός = κίνηση, «ΠΥΡ» = βολή.
// Η καραμπίνα έχει 2 φυσίγγια και ξαναγεμίζει μόνη της. Πάπια 10, χήνα 25 (θέλει 2 βολές), χρυσή πάπια 50.
// 75 δευτερόλεπτα· όσο περνά ο χρόνος, τα πουλιά πετούν πιο γρήγορα. Νικά όποιος μαζέψει τους περισσότερους πόντους.
(function () {
  'use strict';
  const { Base, U } = Mini;
  const TAU = Math.PI * 2;
  const DUR = 75, SHELLS = 2, RELOAD = 1.1;
  // size σε vh (μήκος σώματος ≈ 2·size), speed σε vh/δευτ.
  const KINDS = {
    duck:  { pts: 10, hp: 1, size: 3.7, speed: [24, 33], flap: 11 },
    goose: { pts: 25, hp: 2, size: 4.6, speed: [15, 20], flap: 6.5 },
    gold:  { pts: 50, hp: 1, size: 3.0, speed: [42, 52], flap: 15 },
  };

  class HuntGame extends Base {
    resize() {
      super.resize();
      this.dpr = this.c.width / this.W;
      this.waterY = this.H * 0.665;
      this.bake();
    }

    // ---------- στατικό σκηνικό (σχεδιάζεται μία φορά ανά μέγεθος οθόνης) ----------
    bake() {
      const W = this.W, H = this.H, vh = this.vh, d = this.dpr, WY = this.waterY;
      const mk = (w = W, h = H) => {
        const c = document.createElement('canvas');
        c.width = Math.max(1, Math.round(w * d)); c.height = Math.max(1, Math.round(h * d));
        const x = c.getContext('2d'); x.setTransform(d, 0, 0, d, 0, 0); c.w = w; c.h = h;
        return [c, x];
      };
      let rs = 7; const rnd = () => ((rs = (rs * 16807) % 2147483647) / 2147483647);

      // ---- φόντο: ουρανός, ήλιος, βουνά, δάσος, λίμνη ----
      const [bg, x] = mk();
      let g = x.createLinearGradient(0, 0, 0, WY);
      g.addColorStop(0, '#2f7fcf'); g.addColorStop(0.5, '#86c3ec'); g.addColorStop(0.85, '#ffe0b0'); g.addColorStop(1, '#ffc890');
      x.fillStyle = g; x.fillRect(0, 0, W, WY + 2);
      const sx = W * 0.76, sy = H * 0.24;
      g = x.createRadialGradient(sx, sy, 0, sx, sy, vh * 42);
      g.addColorStop(0, 'rgba(255,252,230,1)'); g.addColorStop(0.1, 'rgba(255,240,190,.85)');
      g.addColorStop(0.35, 'rgba(255,215,150,.25)'); g.addColorStop(1, 'rgba(255,215,150,0)');
      x.fillStyle = g; x.fillRect(0, 0, W, WY);
      x.fillStyle = '#fffdf0'; x.beginPath(); x.arc(sx, sy, vh * 4.6, 0, TAU); x.fill();

      const ridge = (base, amp, f1, f2, seed, top, bot) => {
        x.beginPath(); x.moveTo(0, WY + 1);
        for (let X = 0; X <= W + 8; X += 6) {
          const k = X / W;
          const y = base - amp * (0.55 + 0.3 * Math.sin(k * f1 + seed) + 0.15 * Math.sin(k * f2 + seed * 3));
          x.lineTo(X, y);
        }
        x.lineTo(W, WY + 1); x.closePath();
        const gg = x.createLinearGradient(0, base - amp, 0, WY);
        gg.addColorStop(0, top); gg.addColorStop(1, bot);
        x.fillStyle = gg; x.fill();
      };
      ridge(WY - vh * 6, vh * 20, 7, 23, 1.3, '#9db7d4', '#c9d7e2');   // μακρινά βουνά (θολά)
      ridge(WY - vh * 2, vh * 13, 11, 31, 4.1, '#6f9bb5', '#a9c3c9');
      ridge(WY, vh * 8, 5, 19, 2.2, '#5f8f5c', '#7aa16a');              // λόφοι
      // δασωμένη όχθη: έλατα και φυλλοβόλα
      for (let i = 0; i < 230; i++) {
        const X = rnd() * W, h = vh * (2.2 + rnd() * 4.2) * (0.7 + 0.3 * Math.sin(X / W * 9));
        const y = WY + vh * 0.3;
        const dark = 0.25 + rnd() * 0.3;
        if (rnd() < 0.55) {
          x.fillStyle = U.shade('#2f6b3a', -dark);
          x.beginPath(); x.moveTo(X, y - h); x.lineTo(X + h * 0.32, y); x.lineTo(X - h * 0.32, y); x.closePath(); x.fill();
          x.fillStyle = 'rgba(255,230,170,.18)';
          x.beginPath(); x.moveTo(X, y - h); x.lineTo(X + h * 0.32, y); x.lineTo(X + h * 0.05, y); x.closePath(); x.fill();
        } else {
          const r = h * 0.42;
          const gg = x.createRadialGradient(X + r * 0.3, y - h * 0.6 - r * 0.3, r * 0.1, X, y - h * 0.55, r * 1.2);
          gg.addColorStop(0, U.shade('#6aa64a', -dark * 0.4)); gg.addColorStop(1, U.shade('#2f5d2e', -dark));
          x.fillStyle = gg; x.beginPath(); x.ellipse(X, y - h * 0.55, r, h * 0.5, 0, 0, TAU); x.fill();
        }
      }
      // λίμνη
      g = x.createLinearGradient(0, WY, 0, H);
      g.addColorStop(0, '#8fb9c4'); g.addColorStop(0.18, '#5d97ad'); g.addColorStop(1, '#22546e');
      x.fillStyle = g; x.fillRect(0, WY, W, H - WY);
      // αντανάκλαση της όχθης
      g = x.createLinearGradient(0, WY, 0, WY + vh * 6);
      g.addColorStop(0, 'rgba(30,70,40,.55)'); g.addColorStop(1, 'rgba(30,70,40,0)');
      x.fillStyle = g; x.fillRect(0, WY, W, vh * 6);
      // ήλιος στο νερό
      for (let i = 0; i < 70; i++) {
        const y = WY + vh * 0.6 + rnd() * (H - WY) * 0.75, k = (y - WY) / (H - WY);
        const w = vh * (1 + rnd() * 5) * (1 + k * 2);
        x.fillStyle = `rgba(255,240,200,${(0.55 - k * 0.5) * (0.4 + rnd() * 0.6)})`;
        x.fillRect(sx - w / 2 + (rnd() - 0.5) * vh * 9 * (1 + k * 3), y, w, Math.max(1, vh * 0.25));
      }
      // κυματάκια
      x.strokeStyle = 'rgba(255,255,255,.18)'; x.lineWidth = Math.max(1, vh * 0.15);
      for (let i = 0; i < 60; i++) {
        const y = WY + vh + rnd() * (H - WY), X = rnd() * W, w = vh * (2 + rnd() * 5) * (1 + (y - WY) / (H - WY) * 2);
        x.beginPath(); x.moveTo(X - w / 2, y); x.quadraticCurveTo(X, y - vh * 0.35, X + w / 2, y); x.stroke();
      }
      // νούφαρα
      for (let i = 0; i < 9; i++) {
        const X = rnd() * W, y = WY + vh * 4 + rnd() * vh * 10, r = vh * (1.4 + rnd() * 1.6) * (1 + (y - WY) / (H - WY));
        x.fillStyle = 'rgba(0,0,0,.18)'; x.beginPath(); x.ellipse(X + r * 0.1, y + r * 0.12, r, r * 0.32, 0, 0, TAU); x.fill();
        x.fillStyle = '#4d8f3e'; x.beginPath(); x.ellipse(X, y, r, r * 0.3, 0, 0.3, TAU - 0.3); x.lineTo(X, y); x.fill();
        if (rnd() < 0.5) { x.fillStyle = '#ffd1e4'; x.beginPath(); x.arc(X - r * 0.2, y - r * 0.12, r * 0.2, 0, TAU); x.fill(); }
      }
      this.bg = bg;

      // ---- πρώτο πλάνο: καλαμιές και όχθη (από πάνω από τα πουλιά που πέφτουν) ----
      const [fg, f] = mk();
      const bank = (x0, x1, top) => {
        f.beginPath(); f.moveTo(x0, H);
        for (let X = x0; X <= x1; X += 8) {
          const k = (X - x0) / (x1 - x0);
          f.lineTo(X, H - (H - top) * Math.sin(Math.PI * k) ** 0.6 - Math.sin(X * 0.05) * vh * 0.4);
        }
        f.lineTo(x1, H); f.closePath();
        const gg = f.createLinearGradient(0, top, 0, H);
        gg.addColorStop(0, '#6c8f3a'); gg.addColorStop(0.4, '#4a6b2a'); gg.addColorStop(1, '#2a3f1a');
        f.fillStyle = gg; f.fill();
      };
      const reeds = (x0, x1, n, hMin, hMax) => {
        for (let i = 0; i < n; i++) {
          const X = x0 + rnd() * (x1 - x0), h = vh * (hMin + rnd() * (hMax - hMin));
          const lean = (rnd() - 0.5) * vh * 6, base = H + vh;
          const col = U.shade(rnd() < 0.5 ? '#6f8f35' : '#8aa04a', -rnd() * 0.45);
          f.strokeStyle = col; f.lineCap = 'round';
          f.lineWidth = vh * (0.25 + rnd() * 0.35);
          f.beginPath(); f.moveTo(X, base); f.quadraticCurveTo(X + lean * 0.2, base - h * 0.6, X + lean, base - h); f.stroke();
          if (rnd() < 0.3) { // ψαθί (κεφαλάκι)
            const tx = X + lean * 0.93, ty = base - h * 0.93;
            f.save(); f.translate(tx, ty); f.rotate(Math.atan2(lean, h));
            const gg = f.createLinearGradient(-vh * 0.6, 0, vh * 0.6, 0);
            gg.addColorStop(0, '#3e2412'); gg.addColorStop(0.4, '#8a5a2e'); gg.addColorStop(1, '#2e1a0c');
            f.fillStyle = gg; U.rr(f, -vh * 0.6, -vh * 1.6, vh * 1.2, vh * 3.4, vh * 0.6); f.fill();
            f.restore();
          } else if (rnd() < 0.6) { // φύλλο-λεπίδα
            f.fillStyle = col;
            f.beginPath(); f.moveTo(X, base);
            f.quadraticCurveTo(X + lean * 1.4 + vh, base - h * 0.5, X + lean * 1.8, base - h * 0.8);
            f.quadraticCurveTo(X + lean * 0.9, base - h * 0.45, X + vh * 0.6, base); f.fill();
          }
        }
      };
      bank(-W * 0.05, W * 0.38, H * 0.84); bank(W * 0.62, W * 1.05, H * 0.82); bank(W * 0.25, W * 0.75, H * 0.93);
      reeds(-W * 0.02, W * 0.24, 70, 14, 30);
      reeds(W * 0.76, W * 1.02, 70, 14, 32);
      reeds(W * 0.22, W * 0.78, 90, 5, 16);
      // σκιά/βινιέτα στις γωνίες
      g = f.createRadialGradient(W / 2, H * 0.45, H * 0.45, W / 2, H * 0.45, W * 0.75);
      g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,10,20,.35)');
      f.fillStyle = g; f.fillRect(0, 0, W, H);
      this.fg = fg;

      // ---- σύννεφα ----
      this.cloudImgs = [0, 1, 2].map((k) => {
        const cw = vh * (26 + k * 8), chh = vh * 10;
        const [c, y] = mk(cw, chh);
        for (let i = 0; i < 14; i++) {
          const X = cw * (0.15 + 0.7 * rnd()), Y = chh * (0.45 + 0.3 * rnd()), r = chh * (0.18 + 0.2 * rnd());
          const gg = y.createRadialGradient(X - r * 0.3, Y - r * 0.5, r * 0.1, X, Y, r);
          gg.addColorStop(0, 'rgba(255,255,255,.95)'); gg.addColorStop(0.7, 'rgba(250,246,240,.85)'); gg.addColorStop(1, 'rgba(225,230,240,0)');
          y.fillStyle = gg; y.beginPath(); y.arc(X, Y, r, 0, TAU); y.fill();
        }
        return c;
      });
    }

    // ---------- κύκλος ----------
    setup() {
      const n = this.parts.length;
      this.parts.forEach((p, i) => Object.assign(p, {
        cx: this.W * (0.5 + (i - (n - 1) / 2) * 0.16), cy: this.H * 0.42,
        jx: 0, jy: 0, shells: SHELLS, reload: 0, shots: 0, hits: 0, kills: 0, botT: 0, botFire: 0, kick: 0,
      }));
      this.birds = []; this.fxs = []; this.pops = [];
      this.clouds = Array.from({ length: 6 }, (_, i) => ({ i: i % 3, x: U.rand(-0.1, 1) * this.W, y: this.H * U.rand(0.05, 0.4), v: this.vh * U.rand(0.6, 1.6) }));
      this.phase = 'count'; this.left = DUR; this.spawnT = 0.6; this.geeseT = 9; this.goldT = U.rand(14, 22); this.shake = 0;
      this.countdown(() => { this.phase = 'go'; this.changed(); });
      this.changed();
    }

    active(p) { return p.bot || !p.p || p.p.connected; }
    get k() { return U.clamp(1 - this.left / DUR, 0, 1); } // 0 → 1 με τον χρόνο

    update(dt) {
      const vh = this.vh;
      for (const c of this.clouds) { c.x += c.v * dt; if (c.x > this.W + vh * 5) { c.x = -vh * 45; c.y = this.H * U.rand(0.05, 0.4); } }
      this.shake = Math.max(0, this.shake - dt * 3);

      if (this.phase === 'go') {
        const prev = Math.ceil(this.left);
        this.left -= dt;
        if (Math.ceil(this.left) !== prev && this.left <= 5 && this.left > 0) this.sfx('tick');
        if (this.left <= 0) {
          this.left = 0; this.phase = 'end'; this.sfx('buzz');
          this.banner('ΤΕΛΟΣ ΧΡΟΝΟΥ!', '#ffc93d');
          for (const b of this.birds) if (b.st === 'fly') b.flee = true;
          this.changed();
          this.after(2.6, () => this.finishHunt());
        }
        this.spawner(dt);
      }

      // στόχαστρα
      for (const p of this.parts) {
        if (p.bot && this.phase === 'go') this.bot(p, dt);
        const m = Math.hypot(p.jx, p.jy);
        if (m > 0.05 && (this.phase === 'go' || this.phase === 'count')) {
          const sp = this.H * (0.35 + 1.05 * m * m); // ακρίβεια στο λίγο, ταχύτητα στο πολύ
          p.cx += (p.jx / m) * Math.min(1, m) * sp * dt;
          p.cy += (p.jy / m) * Math.min(1, m) * sp * dt;
        }
        p.cx = U.clamp(p.cx, vh * 2, this.W - vh * 2);
        p.cy = U.clamp(p.cy, vh * 13, this.H - vh * 6);
        p.kick = Math.max(0, p.kick - dt * 5);
        if (p.reload > 0) {
          p.reload -= dt;
          if (p.reload <= 0) { p.reload = 0; p.shells = SHELLS; this.sfx('blip'); this.changed(); }
        }
      }

      // πουλιά
      for (const b of this.birds) this.moveBird(b, dt);
      this.birds = this.birds.filter((b) => !b.gone);

      // εφέ
      for (const e of this.fxs) {
        e.t += dt;
        if (e.kind === 'feather') { e.vy += vh * 6 * dt; e.vy = Math.min(e.vy, vh * 7); e.vx *= 1 - dt * 1.5; e.x += (e.vx + Math.sin(e.t * 4 + e.s) * vh * 4) * dt; e.y += e.vy * dt; e.r += e.vr * dt; }
        else if (e.kind === 'drop') { e.vy += vh * 160 * dt; e.x += e.vx * dt; e.y += e.vy * dt; }
        else if (e.kind === 'smoke') { e.y -= vh * 3 * dt; e.x += vh * 1.5 * dt; }
      }
      this.fxs = this.fxs.filter((e) => e.t < e.life);
      for (const q of this.pops) { q.t += dt; q.y -= vh * 6 * dt; }
      this.pops = this.pops.filter((q) => q.t < 1.3);
    }

    spawner(dt) {
      const k = this.k, n = this.parts.length;
      const flying = this.birds.filter((b) => b.st === 'fly' && !b.flee).length;
      const maxB = 2 + Math.ceil(n * 0.8) + Math.floor(k * 3);
      this.spawnT -= dt;
      if (this.spawnT <= 0 && flying < maxB) {
        this.spawnT = U.rand(0.7, 1.5) * (1 - k * 0.4);
        this.spawnDuck('duck');
        if (Math.random() < 0.15 + k * 0.25) this.after(0.25, () => this.phase === 'go' && this.spawnDuck('duck'));
      }
      this.geeseT -= dt;
      if (this.geeseT <= 0) { this.geeseT = U.rand(10, 15) * (1 - k * 0.3); this.spawnGeese(); }
      this.goldT -= dt;
      if (this.goldT <= 0) { this.goldT = U.rand(16, 24); this.spawnDuck('gold'); }
    }

    bird(kind, o) {
      const K = KINDS[kind], mul = 1 + this.k * 0.6;
      const b = Object.assign({ kind, st: 'fly', hp: K.hp, t: Math.random() * 3, turnT: U.rand(0.8, 1.6), life: U.rand(6, 9) - this.k * 2.5,
        size: K.size * this.vh, speed: U.rand(...K.speed) * this.vh * mul, flap: K.flap, rot: 0, flee: false, hitT: 0, who: null }, o);
      this.birds.push(b);
      return b;
    }
    spawnDuck(kind) {
      const x = this.W * U.rand(0.12, 0.88), a = U.rand(0.35, 0.75) * Math.PI;
      const b = this.bird(kind, { x, y: this.H * U.rand(0.8, 0.9) });
      const dir = x < this.W / 2 ? 1 : -1;
      b.vx = Math.cos(a) * b.speed * (Math.random() < 0.75 ? dir : -dir) * (Math.abs(Math.cos(a)) < 0.3 ? 2 : 1);
      b.vy = -Math.sin(a) * b.speed;
      b.rise = 0.9; // πρώτα βγαίνει από τις καλαμιές
      this.sfx(kind === 'gold' ? 'star' : 'blip');
      for (let i = 0; i < 6; i++) this.fxs.push({ kind: 'drop', x: x + U.rand(-1, 1) * this.vh * 2, y: this.waterY + this.vh * 14, vx: U.rand(-1, 1) * this.vh * 10, vy: -this.vh * U.rand(20, 40), t: 0, life: 0.6, c: '#dff3ff' });
    }
    spawnGeese() {
      const dir = Math.random() < 0.5 ? 1 : -1, n = Math.random() < 0.5 ? 3 : 2;
      const y0 = this.H * U.rand(0.16, 0.36);
      for (let i = 0; i < n; i++) {
        const b = this.bird('goose', { x: dir > 0 ? -this.vh * (8 + i * 9) : this.W + this.vh * (8 + i * 9), y: y0 + (i % 2 ? 1 : -1) * i * this.vh * 3.2, life: 99, goose: true });
        b.vx = dir * b.speed; b.vy = 0; b.speed *= 1; b.t = i * 0.4;
      }
      this.sfx('pump');
    }

    moveBird(b, dt) {
      const vh = this.vh;
      b.t += dt;
      if (b.st === 'fly') {
        if (b.goose) {
          b.vy = Math.sin(b.t * 1.2) * vh * 2.5 * (b.flee ? 0 : 1) - (b.flee ? vh * 20 : 0);
          b.x += b.vx * dt; b.y += b.vy * dt;
          if (b.x < -vh * 40 || b.x > this.W + vh * 40 || b.y < -vh * 10) b.gone = true;
        } else {
          b.life -= dt;
          if (b.rise > 0) b.rise -= dt;
          else {
            b.turnT -= dt;
            if (b.turnT <= 0 && !b.flee) {
              b.turnT = U.rand(0.7, 1.6) * (1 - this.k * 0.35);
              const a = Math.atan2(b.vy, b.vx) + U.rand(-1.3, 1.3);
              b.vx = Math.cos(a) * b.speed; b.vy = Math.sin(a) * b.speed;
            }
            // μένει μέσα στην οθόνη και πάνω από το νερό
            if (!b.flee) {
              if (b.x < vh * 4 && b.vx < 0) b.vx = -b.vx;
              if (b.x > this.W - vh * 4 && b.vx > 0) b.vx = -b.vx;
              if (b.y < vh * 16 && b.vy < 0) b.vy = -b.vy;
              if (b.y > this.waterY - vh * 6 && b.vy > 0) b.vy = -b.vy;
            }
          }
          if (b.life <= 0 && !b.flee) { b.flee = true; }
          if (b.flee) { b.vy += (-b.speed * 1.6 - b.vy) * Math.min(1, dt * 3); }
          b.x += b.vx * dt; b.y += b.vy * dt;
          if (b.y < -vh * 12 || b.x < -vh * 20 || b.x > this.W + vh * 20) {
            b.gone = true;
            if (this.phase === 'go' && b.kind !== 'gold') this.pops.push({ x: U.clamp(b.x, vh * 8, this.W - vh * 8), y: vh * 12, t: 0, s: 'ξέφυγε!', c: '#e9eef7', small: true });
          }
        }
        b.dir = b.vx >= 0 ? 1 : -1;
        if (b.hitT > 0) b.hitT -= dt;
      } else if (b.st === 'hit') {
        b.hold -= dt;
        if (b.hold <= 0) { b.st = 'fall'; b.vy = -vh * 6; b.vx = b.dir * vh * 4; }
      } else if (b.st === 'fall') {
        b.vy += vh * 130 * dt; b.x += b.vx * dt; b.y += b.vy * dt; b.rot += dt * 9 * b.dir;
        if (Math.random() < dt * 8) this.feathers(b, 1);
        if (b.y > this.waterY + vh * 10) {
          b.gone = true; this.sfx('splash');
          for (let i = 0; i < 12; i++) this.fxs.push({ kind: 'drop', x: b.x, y: b.y, vx: U.rand(-1, 1) * vh * 22, vy: -vh * U.rand(25, 60), t: 0, life: 0.7, c: '#e8f7ff' });
          this.fxs.push({ kind: 'ring', x: b.x, y: b.y + vh, t: 0, life: 0.9 });
        }
      }
    }

    feathers(b, n) {
      const cols = b.kind === 'gold' ? ['#ffe27a', '#ffd23f', '#fff4c2'] : b.kind === 'goose' ? ['#8c8274', '#d9d2c4', '#5d5548'] : ['#8b6a4b', '#c9b49a', '#2f7d4a', '#f0e6d6'];
      for (let i = 0; i < n; i++) this.fxs.push({
        kind: 'feather', x: b.x + U.rand(-1, 1) * b.size * 0.6, y: b.y + U.rand(-1, 1) * b.size * 0.4,
        vx: U.rand(-1, 1) * this.vh * 22, vy: -this.vh * U.rand(5, 20), r: U.rand(0, TAU), vr: U.rand(-5, 5), s: U.rand(0, 9),
        t: 0, life: U.rand(1.6, 2.6), c: U.pick(cols), w: b.size * U.rand(0.22, 0.34),
      });
    }

    // ---------- είσοδος ----------
    input(part, msg) {
      if (!part) return;
      if (msg.type === 'joy') { part.jx = U.clamp(+msg.x || 0, -1, 1); part.jy = U.clamp(+msg.y || 0, -1, 1); }
      else if (msg.type === 'dash') this.fire(part);
    }

    fire(p) {
      if (this.phase !== 'go' || p.reload > 0 || p.shells <= 0) return;
      const vh = this.vh;
      p.shells--; p.shots++; p.kick = 1;
      this.sfx('gun'); this.shake = Math.max(this.shake, 0.25);
      this.fxs.push({ kind: 'flash', x: p.cx, y: p.cy, t: 0, life: 0.18, c: p.color.hex });
      for (let i = 0; i < 3; i++) this.fxs.push({ kind: 'smoke', x: p.cx + U.rand(-1, 1) * vh, y: p.cy + U.rand(-1, 1) * vh, t: 0, life: 0.9, r: vh * U.rand(1.5, 2.6) });
      const R = this.aimR();
      const got = [];
      for (const b of this.birds) {
        if (b.st !== 'fly') continue;
        if (Math.hypot(b.x - p.cx, (b.y - p.cy) * 1.15) < R + b.size * 0.75) got.push(b);
      }
      let pts = 0;
      for (const b of got) {
        b.hp--; b.who = p; this.feathers(b, 6);
        if (b.hp > 0) { // χήνα: πρώτο χτύπημα
          b.hitT = 0.3; b.speed *= 1.35; b.vx = Math.sign(b.vx) * b.speed;
          pts += 5; p.hits++;
          this.pops.push({ x: b.x, y: b.y - b.size, t: 0, s: '+5', c: p.color.hex });
          continue;
        }
        const K = KINDS[b.kind];
        b.st = 'hit'; b.hold = 0.35; p.hits++; p.kills++;
        pts += K.pts;
        this.pops.push({ x: b.x, y: b.y - b.size, t: 0, s: '+' + K.pts, c: b.kind === 'gold' ? '#ffd23f' : p.color.hex, big: b.kind === 'gold' });
        this.feathers(b, 8);
      }
      const kills = got.filter((b) => b.st === 'hit').length;
      if (kills >= 2) {
        const bonus = 10 * kills; pts += bonus;
        this.pops.push({ x: p.cx, y: p.cy - vh * 8, t: 0, s: (kills === 2 ? 'ΔΙΠΛΟ! +' : 'ΤΡΙΠΛΟ! +') + bonus, c: '#ffc93d', big: true });
        this.fx(p, (kills === 2 ? 'ΔΙΠΛΟ!' : 'ΤΡΙΠΛΟ!') + ' 🎯', [40, 30, 80]);
      }
      if (got.length) {
        p.score += pts; this.sfx(got.some((b) => b.kind === 'gold' && b.st === 'hit') ? 'pwr' : 'point');
        if (kills < 2) this.fx(p, got.some((b) => b.kind === 'gold' && b.st === 'hit') ? '✨ ΧΡΥΣΗ! +50' : '🎯 +' + pts, [35]);
      }
      if (p.shells <= 0) p.reload = RELOAD;
      this.changed();
    }

    aimR() { return this.vh * 4.2; }

    // ---------- ρομπότ ----------
    bot(p, dt) {
      p.botT -= dt; p.botFire -= dt;
      if (p.botT > 0) return;
      p.botT = 0.12;
      const fly = this.birds.filter((b) => b.st === 'fly' && b.x > 0 && b.x < this.W && b.y > 0);
      if (!fly.length) { p.jx = p.jy = 0; return; }
      // κάθε ρομπότ προτιμά το πουλί που είναι κοντά του και δεν το κυνηγά άλλος
      const taken = new Set(this.parts.filter((q) => q !== p && q.bot && q.tgt).map((q) => q.tgt));
      const cost = (b) => Math.hypot(b.x - p.cx, b.y - p.cy) * (taken.has(b) ? 2.5 : 1) * (b === p.tgt ? 0.7 : 1);
      const t = (p.tgt = fly.reduce((a, b) => (cost(a) < cost(b) ? a : b)));
      const tx = t.x + t.vx * 0.06, ty = t.y + t.vy * 0.06;
      const dx = tx - p.cx, dy = ty - p.cy, dd = Math.hypot(dx, dy);
      const m = U.clamp(dd / (this.vh * 22), 0.12, 0.9);
      p.jx = dd ? (dx / dd) * m + U.rand(-0.12, 0.12) : 0; p.jy = dd ? (dy / dd) * m + U.rand(-0.12, 0.12) : 0;
      const near = Math.hypot(t.x - p.cx, t.y - p.cy), R = this.aimR();
      if (p.botFire <= 0 && (near < R + t.size * 0.4 ? Math.random() < 0.5 : near < R * 2.6 && Math.random() < 0.18)) { p.botFire = U.rand(0.45, 0.9); this.fire(p); }
    }

    ctrl(p) {
      const base = { mode: 'joy', cdMs: 260, scoreText: `🎯 ${p.score} πόντοι` };
      if (this.phase === 'go') return { ...base, active: true, btn: p.reload > 0 ? 'ΓΕΜΙΖΩ…' : `ΠΥΡ ${'▮'.repeat(p.shells)}` };
      if (this.phase === 'count') return { ...base, active: false, btn: 'ΠΥΡ', label: '🦆 Ετοιμάσου!', sub: 'Μοχλός: κουνάς το στόχαστρο · ΠΥΡ: πυροβολείς · 2 φυσίγγια, ξαναγεμίζει μόνη της' };
      return { ...base, active: false, btn: 'ΠΥΡ', label: '⏱️ Τέλος χρόνου!', sub: 'Κοίτα την τηλεόραση' };
    }

    finishHunt() {
      if (!this.running) return;
      const rank = [...this.parts].sort((a, b) => b.score - a.score);
      const w = rank[0];
      this.celebrate(w.color.hex); this.sfx('win');
      const acc = (q) => (q.shots ? Math.round((q.hits / q.shots) * 100) : 0);
      this.h.onOver && this.h.onOver({
        winner: w, icon: '🦆',
        stats: `${w.score} πόντοι · ${w.kills} πουλιά · εύστοχία ${acc(w)}%`,
        rank: rank.map((q) => ({ name: q.name, color: q.color, st: `${q.score} πόντοι · ${q.kills} πουλιά · ${acc(q)}%` })),
      });
    }

    // ---------- σχεδίαση ----------
    draw() {
      const x = this.ctx, vh = this.vh, W = this.W, H = this.H;
      x.save();
      if (this.shake > 0) x.translate(U.rand(-1, 1) * this.shake * vh * 1.2, U.rand(-1, 1) * this.shake * vh * 1.2);
      x.drawImage(this.bg, 0, 0, W, H);
      for (const c of this.clouds) { const im = this.cloudImgs[c.i]; x.globalAlpha = 0.9; x.drawImage(im, c.x, c.y, im.w, im.h); }
      x.globalAlpha = 1;
      // σκιές στο νερό για όσα πετούν χαμηλά
      for (const b of this.birds) {
        if (b.st !== 'fly') continue;
        const k = 1 - U.clamp((this.waterY - b.y) / (H * 0.4), 0, 1);
        if (k <= 0) continue;
        x.fillStyle = `rgba(10,30,45,${0.25 * k})`;
        x.beginPath(); x.ellipse(b.x, this.waterY + vh * 3 + (this.waterY - b.y) * 0.12, b.size * 1.1, b.size * 0.22, 0, 0, TAU); x.fill();
      }
      for (const e of this.fxs) if (e.kind === 'ring') {
        const k = e.t / e.life; x.strokeStyle = `rgba(255,255,255,${0.7 * (1 - k)})`; x.lineWidth = vh * 0.3;
        x.beginPath(); x.ellipse(e.x, e.y, vh * (2 + k * 9), vh * (0.6 + k * 2.2), 0, 0, TAU); x.stroke();
      }
      for (const b of this.birds) this.drawBird(b);
      x.drawImage(this.fg, 0, 0, W, H);
      this.drawFx();
      for (const p of this.parts) this.drawAim(p);
      for (const q of this.pops) {
        const a = 1 - Math.max(0, q.t - 0.8) / 0.5, s = U.easeOutBack(Math.min(1, q.t * 4));
        x.globalAlpha = Math.max(0, a);
        this.text(q.s, q.x, q.y, vh * (q.big ? 5.5 : q.small ? 2.4 : 4) * s, q.c, { fam: 'Comfortaa', w: 700 });
        x.globalAlpha = 1;
      }
      x.restore();
      this.drawHud();
      if (this.phase === 'count') {
        if (this.time - this.countT < 3) {
          this.text("SHOOT'N MAP", W / 2, H * 0.2, vh * 7, '#ffe36b', { fam: 'Comfortaa', w: 700 });
          this.text('Πάπια 10 · Χήνα 25 (2 βολές) · Χρυσή πάπια 50', W / 2, H * 0.29, vh * 3, '#fff');
        }
        this.drawCount(this.countT, 'ΠΑΜΕ!');
      }
    }

    drawFx() {
      const x = this.ctx, vh = this.vh;
      for (const e of this.fxs) {
        const k = e.t / e.life;
        if (e.kind === 'feather') {
          x.save(); x.translate(e.x, e.y); x.rotate(e.r); x.globalAlpha = Math.min(1, (1 - k) * 3);
          x.fillStyle = e.c; x.beginPath(); x.ellipse(0, 0, e.w, e.w * 0.32, 0, 0, TAU); x.fill();
          x.strokeStyle = 'rgba(0,0,0,.3)'; x.lineWidth = Math.max(1, e.w * 0.06);
          x.beginPath(); x.moveTo(-e.w * 1.15, 0); x.lineTo(e.w, 0); x.stroke();
          x.restore(); x.globalAlpha = 1;
        } else if (e.kind === 'drop') {
          x.fillStyle = e.c; x.globalAlpha = 1 - k; x.beginPath(); x.arc(e.x, e.y, vh * 0.45, 0, TAU); x.fill(); x.globalAlpha = 1;
        } else if (e.kind === 'smoke') {
          x.fillStyle = `rgba(235,235,230,${0.45 * (1 - k)})`;
          x.beginPath(); x.arc(e.x, e.y, e.r * (1 + k * 1.8), 0, TAU); x.fill();
        } else if (e.kind === 'flash') {
          const r = vh * (3 + k * 6);
          const g = x.createRadialGradient(e.x, e.y, 0, e.x, e.y, r);
          g.addColorStop(0, `rgba(255,255,230,${1 - k})`); g.addColorStop(0.4, `rgba(255,200,90,${0.7 * (1 - k)})`); g.addColorStop(1, 'rgba(255,150,50,0)');
          x.fillStyle = g; x.beginPath(); x.arc(e.x, e.y, r, 0, TAU); x.fill();
        }
      }
    }

    // πουλί σε τοπικές μονάδες: σώμα μήκους ~2 (από -1 ουρά έως +1 στήθος), κλίμακα = size
    drawBird(b) {
      const x = this.ctx, s = b.size;
      const dead = b.st !== 'fly';
      const flapA = dead ? 0.2 : Math.sin(b.t * b.flap);
      x.save(); x.translate(b.x, b.y);
      if (b.st === 'fall') x.rotate(b.rot);
      else if (!dead) x.rotate(U.clamp(Math.atan2(b.vy, Math.abs(b.vx)) * 0.5, -0.5, 0.5) * b.dir);
      x.scale(s * b.dir, s);
      if (b.st === 'fall') x.scale(1, -1);
      const P = b.kind === 'goose'
        ? { body: '#8f8676', belly: '#e6e0d2', back: '#6e6556', wing: '#7d7465', wing2: '#4f483d', head: '#1d1b1a', neck: 1 }
        : b.kind === 'gold'
          ? { body: '#ffcf3a', belly: '#fff1b0', back: '#e5a915', wing: '#ffd95c', wing2: '#c98a0c', head: '#ffe27a', neck: 0 }
          : { body: '#9a7b5e', belly: '#c9b9a5', back: '#6b5644', wing: '#8c7a68', wing2: '#4b3e33', head: '#1f6e4a', neck: 0 };
      if (b.kind === 'gold') {
        const g = x.createRadialGradient(0, 0, 0.2, 0, 0, 2.6);
        g.addColorStop(0, 'rgba(255,240,150,.55)'); g.addColorStop(1, 'rgba(255,220,80,0)');
        x.fillStyle = g; x.beginPath(); x.arc(0, 0, 2.6, 0, TAU); x.fill();
      }
      const wing = (far) => {
        const a = flapA * (far ? 0.85 : 1);
        x.save(); x.translate(-0.05, -0.15); x.scale(1, far ? 0.8 : 1);
        x.rotate(-0.15);
        const tipY = -1.6 * a - (far ? 0.2 : 0), len = 1.35;
        x.beginPath(); x.moveTo(0.35, 0);
        x.quadraticCurveTo(0.2, tipY * 0.6, -0.4, tipY);
        x.quadraticCurveTo(-len * 0.9, tipY * 0.85 + 0.1, -len, tipY * 0.55 + 0.25);
        x.quadraticCurveTo(-0.6, 0.1, -0.5, 0.05);
        x.closePath();
        const g = x.createLinearGradient(0, 0, -0.4, tipY);
        g.addColorStop(0, far ? U.shade(P.wing, -0.35) : P.wing); g.addColorStop(1, far ? U.shade(P.wing2, -0.3) : P.wing2);
        x.fillStyle = g; x.fill();
        if (!far) { // ζώνη στο φτερό (καθρέφτης)
          x.strokeStyle = b.kind === 'duck' ? '#3a5fd0' : 'rgba(255,255,255,.25)'; x.lineWidth = 0.12;
          x.beginPath(); x.moveTo(-0.05, tipY * 0.25); x.quadraticCurveTo(-0.45, tipY * 0.5, -0.9, tipY * 0.45 + 0.2); x.stroke();
        }
        x.restore();
      };
      wing(true);
      // ουρά
      x.fillStyle = P.back;
      x.beginPath(); x.moveTo(-0.8, -0.1); x.lineTo(-1.35, -0.25); x.lineTo(-1.3, 0.12); x.lineTo(-0.8, 0.2); x.closePath(); x.fill();
      if (b.kind === 'duck') { x.strokeStyle = '#1b1b1b'; x.lineWidth = 0.08; x.beginPath(); x.moveTo(-0.95, -0.15); x.quadraticCurveTo(-1, -0.45, -0.82, -0.42); x.stroke(); }
      // πόδια
      x.fillStyle = b.kind === 'goose' ? '#3a332b' : '#f08a24';
      x.beginPath(); x.ellipse(-0.75, 0.35, 0.22, 0.07, 0.3, 0, TAU); x.fill();
      // σώμα
      const g = x.createLinearGradient(0, -0.5, 0, 0.5);
      g.addColorStop(0, P.back); g.addColorStop(0.45, P.body); g.addColorStop(1, P.belly);
      x.fillStyle = g; x.beginPath(); x.ellipse(-0.05, 0.02, 0.95, 0.42, -0.05, 0, TAU); x.fill();
      x.strokeStyle = 'rgba(0,0,0,.35)'; x.lineWidth = 0.05; x.stroke();
      if (b.kind === 'duck') { // καφέ στήθος
        x.fillStyle = '#7a4a33'; x.beginPath(); x.ellipse(0.62, 0.05, 0.36, 0.33, 0, 0, TAU); x.fill();
      }
      // λαιμός + κεφάλι
      const hx = P.neck ? 1.35 : 1.0, hy = P.neck ? -0.45 : -0.28, hr = P.neck ? 0.26 : 0.3;
      if (P.neck) {
        x.strokeStyle = P.head; x.lineWidth = 0.28; x.lineCap = 'round';
        x.beginPath(); x.moveTo(0.7, -0.05); x.quadraticCurveTo(1.15, -0.1, hx - 0.05, hy + 0.05); x.stroke();
      } else {
        x.fillStyle = P.head; x.beginPath(); x.ellipse(0.82, -0.12, 0.22, 0.2, 0, 0, TAU); x.fill();
      }
      const hg = x.createRadialGradient(hx - 0.05, hy - 0.12, 0.02, hx, hy, hr);
      hg.addColorStop(0, b.kind === 'duck' ? '#3fc98a' : U.shade(P.head, 0.35)); hg.addColorStop(1, P.head);
      x.fillStyle = hg; x.beginPath(); x.arc(hx, hy, hr, 0, TAU); x.fill();
      if (b.kind === 'duck') { x.strokeStyle = '#fff'; x.lineWidth = 0.07; x.beginPath(); x.arc(0.84, -0.12, 0.21, 1.0, 2.6); x.stroke(); }
      if (b.kind === 'goose') { x.fillStyle = '#f4f1ea'; x.beginPath(); x.ellipse(hx - 0.04, hy + 0.08, 0.13, 0.08, -0.4, 0, TAU); x.fill(); }
      // ράμφος
      x.fillStyle = b.kind === 'goose' ? '#222' : b.kind === 'gold' ? '#ff8a1c' : '#f2c94c';
      x.beginPath(); x.moveTo(hx + hr * 0.7, hy - 0.06); x.quadraticCurveTo(hx + hr + 0.38, hy - 0.02, hx + hr + 0.36, hy + 0.09); x.lineTo(hx + hr * 0.75, hy + 0.1); x.closePath(); x.fill();
      // μάτι
      if (dead) {
        x.strokeStyle = '#111'; x.lineWidth = 0.05;
        const ex = hx + 0.06, ey = hy - 0.07, r = 0.06;
        x.beginPath(); x.moveTo(ex - r, ey - r); x.lineTo(ex + r, ey + r); x.moveTo(ex + r, ey - r); x.lineTo(ex - r, ey + r); x.stroke();
      } else {
        x.fillStyle = '#fff'; x.beginPath(); x.arc(hx + 0.06, hy - 0.07, 0.07, 0, TAU); x.fill();
        x.fillStyle = '#111'; x.beginPath(); x.arc(hx + 0.08, hy - 0.07, 0.04, 0, TAU); x.fill();
      }
      wing(false);
      if (b.hitT > 0) { x.globalAlpha = b.hitT / 0.3; x.fillStyle = '#fff'; x.beginPath(); x.ellipse(0, 0, 1, 0.5, 0, 0, TAU); x.fill(); x.globalAlpha = 1; }
      x.restore();
    }

    drawAim(p) {
      const x = this.ctx, vh = this.vh, R = this.aimR(), c = p.color.hex;
      const k = p.kick, r = R * (1 + k * 0.25);
      x.save(); x.translate(p.cx, p.cy - k * vh * 0.8);
      x.lineCap = 'round';
      for (const [col, lw] of [['rgba(10,10,25,.75)', vh * 0.9], [c, vh * 0.45]]) {
        x.strokeStyle = col; x.lineWidth = lw;
        for (let i = 0; i < 4; i++) { const a0 = i * Math.PI / 2 + 0.25; x.beginPath(); x.arc(0, 0, r, a0, a0 + Math.PI / 2 - 0.5); x.stroke(); }
        x.beginPath();
        x.moveTo(-r * 1.35, 0); x.lineTo(-r * 0.55, 0); x.moveTo(r * 0.55, 0); x.lineTo(r * 1.35, 0);
        x.moveTo(0, -r * 1.35); x.lineTo(0, -r * 0.55); x.moveTo(0, r * 0.55); x.lineTo(0, r * 1.35);
        x.stroke();
      }
      x.fillStyle = c; x.beginPath(); x.arc(0, 0, vh * 0.45, 0, TAU); x.fill();
      x.strokeStyle = 'rgba(10,10,25,.75)'; x.lineWidth = vh * 0.2; x.stroke();
      // φυσίγγια ή γέμισμα
      const by = r * 1.35 + vh * 1.8;
      if (p.reload > 0) {
        const f = 1 - p.reload / RELOAD;
        x.strokeStyle = 'rgba(10,10,25,.6)'; x.lineWidth = vh * 0.7; x.beginPath(); x.arc(0, 0, r * 0.4, 0, TAU); x.stroke();
        x.strokeStyle = '#fff'; x.lineWidth = vh * 0.45; x.beginPath(); x.arc(0, 0, r * 0.4, -Math.PI / 2, -Math.PI / 2 + f * TAU); x.stroke();
      } else {
        for (let i = 0; i < SHELLS; i++) {
          const sx = (i - (SHELLS - 1) / 2) * vh * 1.5;
          const on = i < p.shells;
          x.fillStyle = on ? '#d8312b' : 'rgba(0,0,0,.35)'; U.rr(x, sx - vh * 0.45, by - vh * 1.1, vh * 0.9, vh * 1.6, vh * 0.3); x.fill();
          x.fillStyle = on ? '#e3b341' : 'rgba(0,0,0,.35)'; x.fillRect(sx - vh * 0.45, by + vh * 0.3, vh * 0.9, vh * 0.5);
        }
      }
      x.restore();
      // όνομα
      let nm = p.name + (p.bot ? ' 🤖' : '');
      x.font = this.font(vh * 1.9, 800); if (nm.length > 14) nm = nm.slice(0, 13) + '…';
      this.text(nm, p.cx, p.cy - r * 1.35 - vh * 1.8, vh * 1.9, c);
    }

    drawHud() {
      const x = this.ctx, vh = this.vh;
      const n = this.parts.length;
      const pw = Math.min(this.W * 0.17, vh * 30), ph = vh * 7, gap = vh * 1.2, top = vh * 1.6;
      let X = vh * 2;
      const lead = Math.max(...this.parts.map((p) => p.score));
      for (const p of this.parts) {
        U.rr(x, X, top, pw, ph, vh * 1.4);
        const g = x.createLinearGradient(0, top, 0, top + ph);
        g.addColorStop(0, 'rgba(20,32,48,.8)'); g.addColorStop(1, 'rgba(6,12,22,.8)');
        x.fillStyle = g; x.fill();
        x.lineWidth = vh * 0.25; x.strokeStyle = U.rgba(p.color.hex, 0.85); x.stroke();
        x.fillStyle = p.color.hex; x.fillRect(X + vh * 0.9, top + vh * 1.2, vh * 0.5, ph - vh * 2.4);
        x.font = this.font(vh * 1.9, 700); x.textAlign = 'left'; x.textBaseline = 'middle'; x.fillStyle = '#dfe9f5';
        let nm = p.name + (p.bot ? ' 🤖' : '') + (p.p && !p.p.connected ? ' (εκτός)' : '');
        while (x.measureText(nm).width > pw * 0.7 && nm.length > 2) nm = nm.slice(0, -2) + '…';
        x.fillText(nm, X + vh * 2.1, top + vh * 2.2);
        x.font = this.font(vh * 3); x.fillStyle = '#fff';
        x.fillText(String(p.score), X + vh * 2.1, top + vh * 5);
        x.textAlign = 'right'; x.font = this.font(vh * 1.7, 700); x.fillStyle = '#9fb3c8';
        x.fillText(`🦆×${p.kills}`, X + pw - vh * 1.2, top + vh * 5);
        if (p.score === lead && lead > 0 && n > 1) { x.font = this.font(vh * 2); x.fillText('👑', X + pw - vh * 1.2, top + vh * 2.2); }
        X += pw + gap;
      }
      // χρόνος
      const t = Math.ceil(this.left), mm = Math.floor(t / 60), ss = String(t % 60).padStart(2, '0');
      const tw = vh * 13, tx = this.W - tw - vh * 2;
      U.rr(x, tx, top, tw, ph, vh * 1.4); x.fillStyle = 'rgba(6,12,22,.8)'; x.fill();
      x.lineWidth = vh * 0.25; x.strokeStyle = this.left <= 10 && this.phase === 'go' ? '#ff5d5d' : 'rgba(255,255,255,.25)'; x.stroke();
      this.text(`⏱ ${mm}:${ss}`, tx + tw / 2, top + ph / 2, vh * 3.4, this.left <= 10 && this.phase === 'go' ? '#ff8080' : '#fff', { stroke: false });
    }
  }

  Mini.games.hunt = HuntGame;
})();
