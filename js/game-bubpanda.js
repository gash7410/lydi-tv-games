// «Φουσκοπάντα»: συνεργατικό platform. Όλα τα πάντα μαζί σε μία οθόνη με πλατφόρμες.
// Στο κινητό: ◀ ▶ για κίνηση, ΑΛΜΑ, ΦΟΥΣΚΑ. Η φούσκα κλείνει μέσα το τέρατάκι και ανεβαίνει·
// άγγιξέ την για να σκάσει και το τέρατάκι γίνεται φρούτο (πόντοι). Πολλές φούσκες μαζί = σειρά (διπλοί πόντοι).
// Η ομάδα έχει κοινές καρδιές. Αν μια φούσκα δεν σκάσει εγκαίρως, το τέρατάκι βγαίνει θυμωμένο.
// 6 πίστες· η ομάδα κερδίζει αν τις περάσει όλες. Στο τέλος, κατάταξη με τους πόντους του καθενός.
(function () {
  'use strict';
  const { Base, U } = Mini;
  const AW = 20, AH = 11.5;            // κόσμος (μονάδες), y προς τα πάνω, y = πόδια
  const G = 32, JV = 15.2, SPD = 6.2;  // βαρύτητα, ταχύτητα άλματος (~3,6 ύψος), τρέξιμο
  const PW = 0.8, PH = 1.15;           // μέγεθος πάντα
  const EW = 0.8, EH = 0.9;            // μέγεθος τέρατος
  const SHOT_V = 13, SHOT_T = 0.34, BR = 0.62, RISE = 1.7;
  const EMPTY_LIFE = 6, TRAP_LIFE = 8.5, SHOOT_CD = 0.32;
  const INV = 2.6, RESPAWN = 1.6, HURRY = 50, LIVES = 6;
  const VALUES = [10, 20, 40, 80, 160];

  // πλατφόρμες: [ύψος, από x, έως x] (το πάτωμα y = 0 υπάρχει πάντα)
  const LEVELS = [
    { name: 'Το δάσος', sky: ['#173a2e', '#2f6b4a'], plat: '#6fbf3f', mon: '#9b6bff',
      p: [[3, 2, 7.5], [3, 12.5, 18], [6, 5, 15], [9, 1.5, 7.5], [9, 12.5, 18.5]] },
    { name: 'Η σπηλιά', sky: ['#1d1638', '#3d2c6b'], plat: '#c98a4b', mon: '#ff7fb0',
      p: [[3, 0, 5], [3, 8, 12], [3, 15, 20], [6, 3, 9], [6, 11, 17], [9, 0, 6], [9, 8, 12], [9, 14, 20]] },
    { name: 'Η γέφυρα', sky: ['#0f2a4a', '#2c6aa0'], plat: '#e0c25a', mon: '#47d6c1',
      p: [[3, 3, 17], [6, 0, 4.5], [6, 8, 12], [6, 15.5, 20], [9, 3, 17]] },
    { name: 'Οι σκάλες', sky: ['#3a1730', '#7a3355'], plat: '#ff9a5a', mon: '#ffd23f',
      p: [[3, 0, 4], [3, 16, 20], [5.5, 4.5, 8.5], [5.5, 11.5, 15.5], [8.5, 0, 5], [8.5, 8, 12], [8.5, 15, 20]] },
    { name: 'Το κάστρο', sky: ['#22202e', '#4d4866'], plat: '#a7a3bf', mon: '#ff6a4d',
      p: [[3, 1, 6], [3, 9, 11], [3, 14, 19], [6, 4, 16], [9, 1, 8], [9, 12, 19]] },
    { name: 'Η κορυφή', sky: ['#2a0f3d', '#a2456b'], plat: '#7fd6ff', mon: '#b4ff5a',
      p: [[3, 0, 8], [3, 12, 20], [6, 6, 14], [9, 0, 8], [9, 12, 20]] },
  ];

  class BubPandaGame extends Base {
    constructor(c, h) { super(c, h); this.WIN = 0; this.plats = []; this.enemies = []; this.bubbles = []; }

    setup() {
      this.lives = LIVES; this.team = 0; this.level = 0; this.won = false;
      this.parts.forEach((p) => Object.assign(p, { pops: 0, fruit: 0, falls: 0 }));
      this.nextLevel();
    }

    active(p) { return p.bot || !p.p || p.p.connected; }

    nextLevel() {
      this.level++;
      const L = LEVELS[this.level - 1];
      this.L = L;
      this.plats = [{ y: 0, x0: 0, x1: AW, floor: true }, ...L.p.map(([y, x0, x1]) => ({ y, x0, x1 }))];
      this.bubbles = []; this.fruits = []; this.floats = []; this.bursts = []; this.enemies = [];
      this.levelT = 0; this.hurry = false; this.combo = 0;
      const n = this.parts.length;
      this.parts.forEach((p, i) => this.spawn(p, i, n, 0));
      // τέρατα πάνω στις ψηλές πλατφόρμες
      const cnt = Math.min(10, 3 + this.level + Math.max(0, n - 2));
      const flyers = this.level >= 3 ? Math.floor((this.level - 1) / 2) : 0;
      const high = this.plats.filter((q) => q.y >= 5.5);
      for (let k = 0; k < cnt; k++) {
        const fly = k < flyers;
        const pl = high[k % high.length];
        const ex = U.clamp(pl.x0 + 0.6 + ((k * 2.7) % Math.max(0.5, pl.x1 - pl.x0 - 1.2)), 0.6, AW - 0.6);
        this.enemies.push({
          id: k, x: ex, y: fly ? pl.y + 1.5 : pl.y, vx: (k % 2 ? -1 : 1) * U.rand(2.0, 2.6), vy: fly ? U.rand(1.6, 2.2) * (k % 2 ? 1 : -1) : 0,
          fly, on: !fly, angry: false, jumpT: U.rand(1.5, 4), edge: null, anim: Math.random() * 6, drop: k * 0.18,
        });
      }
      this.phase = 'count';
      this.banner(`Πίστα ${this.level}/${LEVELS.length} · ${L.name}`, '#fff');
      this.countdown(() => { this.phase = 'go'; this.parts.forEach((p) => (p.inv = 1.5)); this.changed(); });
      this.changed();
    }

    spawn(p, i, n, inv) {
      Object.assign(p, {
        x: U.clamp(AW / 2 + (i - (n - 1) / 2) * 1.6, 1, AW - 1), y: 0, vx: 0, vy: 0, on: true, face: i % 2 ? -1 : 1,
        mv: p.mv || 0, jumpBuf: 0, coyote: 0, shootCd: 0, blowT: -9, inv: inv, dead: 0, walk: 0, botT: 0,
        status: p.status === '💥 Τον έπιασαν' ? '' : p.status || '', hi: false,
      });
    }

    input(part, msg) {
      if (!part || this.phase !== 'go') {
        if (part && msg.type === 'move') part.mv = U.clamp(Math.round(+msg.d || 0), -1, 1);
        return;
      }
      if (msg.type === 'move') part.mv = U.clamp(Math.round(+msg.d || 0), -1, 1);
      else if (msg.type === 'jump') part.jumpBuf = 0.16;
      else if (msg.type === 'dash') this.shoot(part);
    }

    shoot(p) {
      if (p.dead > 0 || p.shootCd > 0) return;
      p.shootCd = SHOOT_CD; p.blowT = this.time;
      this.bubbles.push({ x: p.x + p.face * 0.55, y: p.y + PH * 0.55, vx: p.face * SHOT_V, t: 0, enemy: null, by: p, wob: Math.random() * 6 });
      this.sfx('blip');
    }

    // πάτημα σε πλατφόρμα (μόνο από πάνω προς τα κάτω)
    land(b, ny, hw) {
      if (b.vy > 0) return null;
      let best = null;
      for (const q of this.plats) {
        if (b.x + hw * 0.6 < q.x0 || b.x - hw * 0.6 > q.x1) continue;
        if (b.y >= q.y - 0.001 && ny <= q.y && (!best || q.y > best.y)) best = q;
      }
      return best;
    }
    physics(b, dt, hw) {
      b.vy = Math.max(-17, b.vy - G * dt);
      const ny = b.y + b.vy * dt;
      const q = this.land(b, ny, hw);
      if (q) { b.y = q.y; b.vy = 0; b.on = q; } else { b.y = ny; b.on = null; }
      if (b.y < 0) { b.y = 0; b.vy = 0; b.on = this.plats[0]; }
      b.x = U.clamp(b.x + b.vx * dt, hw / 2, AW - hw / 2);
      if (b.y > AH - 1.2 && b.vy > 0) { b.y = AH - 1.2; b.vy = 0; }
    }

    platAbove(x, y) { return this.plats.find((q) => q.y > y + 1 && q.y <= y + 3.4 && x > q.x0 + 0.3 && x < q.x1 - 0.3); }

    // ---------- ρομπότ-συμπαίκτης ----------
    bot(p, dt) {
      p.botT -= dt;
      if (p.botT > 0) return;
      p.botT = 0.12;
      const trapped = this.bubbles.filter((b) => b.enemy && b.t > 0.3);
      const fruit = this.fruits.filter((f) => f.t > 0.4);
      let goal = null, best = 1e9;
      const cost = (o) => Math.abs(o.x - p.x) + Math.abs(o.y - p.y) * 2.2;
      for (const o of [...trapped, ...fruit]) { const c = cost(o) - 4; if (c < best) { best = c; goal = o; } }
      for (const e of this.enemies) { const c = cost(e); if (c < best) { best = c; goal = e; } }
      if (!goal) { p.mv = 0; return; }
      const dx = goal.x - p.x, dy = goal.y - p.y;
      // κίνδυνος: τέρας πολύ κοντά → πήδα / φύγε
      const near = this.enemies.find((e) => Math.abs(e.x - p.x) < 1.6 && Math.abs(e.y - p.y) < 1.2);
      if (near && p.inv <= 0) {
        if (Math.sign(near.x - p.x) === p.face && p.shootCd <= 0) this.shoot(p);
        else p.mv = near.x > p.x ? -1 : 1;
        if (Math.random() < 0.5) p.jumpBuf = 0.16;
        return;
      }
      const isEnemy = this.enemies.includes(goal);
      if (isEnemy && Math.abs(dy) < 0.9 && Math.abs(dx) < 6) {
        p.mv = Math.abs(dx) < 3 ? 0 : Math.sign(dx);
        p.face = Math.sign(dx) || p.face;
        if (p.shootCd <= 0 && Math.random() < 0.6) this.shoot(p);
        return;
      }
      p.mv = Math.abs(dx) < 0.3 ? 0 : Math.sign(dx);
      if (dy > 1 && p.on && Math.random() < 0.55) {
        if (this.platAbove(p.x, p.y) || this.platAbove(p.x + p.mv * 1.5, p.y)) p.jumpBuf = 0.16;
      }
      if (dy < -1 && p.on && !p.on.floor && Math.abs(dx) < 0.6) p.mv = p.face; // κατέβα από την άκρη
    }

    // ---------- ενημέρωση ----------
    update(dt) {
      for (const f of this.floats) f.t += dt;
      this.floats = this.floats.filter((f) => f.t < 1.2);
      for (const q of this.bursts) q.t += dt;
      this.bursts = this.bursts.filter((q) => q.t < 0.4);
      for (const e of this.enemies) e.anim += dt;
      if (this.phase === 'count') { for (const e of this.enemies) e.drop = Math.max(0, e.drop - dt); return; }
      if (this.phase !== 'go' && this.phase !== 'clear' && this.phase !== 'lost') return;
      this.levelT += dt;

      if (this.phase === 'go' && !this.hurry && this.levelT > HURRY) {
        this.hurry = true;
        this.enemies.forEach((e) => (e.angry = true));
        this.banner('Βιάσου! Τα τέρατα θύμωσαν! 😠', '#ff8a8a');
        this.sfx('buzz');
      }

      // πάντα
      for (const p of this.parts) {
        if (!this.active(p)) { p.mv = 0; continue; }
        if (p.dead > 0) {
          p.dead -= dt; p.y += p.vy * dt; p.vy -= G * 0.5 * dt;
          if (p.dead <= 0) {
            if (this.lives <= 0) continue;
            const i = this.parts.indexOf(p);
            this.spawn(p, i, this.parts.length, INV);
            this.changed();
          }
          continue;
        }
        if (p.bot && this.phase === 'go') this.bot(p, dt);
        p.inv = Math.max(0, p.inv - dt); p.shootCd = Math.max(0, p.shootCd - dt);
        p.jumpBuf = Math.max(0, p.jumpBuf - dt);
        p.coyote = p.on ? 0.1 : Math.max(0, p.coyote - dt);
        p.vx = p.mv * SPD;
        if (p.mv) { p.face = p.mv; p.walk += dt * 11; } else p.walk = 0;
        if (p.jumpBuf > 0 && p.coyote > 0) { p.vy = JV; p.on = null; p.coyote = 0; p.jumpBuf = 0; this.sfx('step'); }
        this.physics(p, dt, PW);
      }

      // τέρατα
      for (const e of this.enemies) {
        const sp = e.angry ? 1.6 : 1;
        if (e.fly) {
          e.x += e.vx * sp * dt; e.y += e.vy * sp * dt;
          if (e.x < 0.5 || e.x > AW - 0.5) { e.vx = -e.vx; e.x = U.clamp(e.x, 0.5, AW - 0.5); }
          if (e.y < 0.2 || e.y > AH - 1.6) { e.vy = -e.vy; e.y = U.clamp(e.y, 0.2, AH - 1.6); }
          continue;
        }
        if (e.on) {
          e.jumpT -= dt;
          // άκρη πλατφόρμας: γύρνα ή πέσε
          const q = e.on;
          if (!q.floor && (e.x + e.vx * dt < q.x0 + 0.2 || e.x + e.vx * dt > q.x1 - 0.2)) {
            if (e.edge !== q) { e.edge = q; e.fall = Math.random() < 0.35; }
            if (!e.fall) e.vx = -e.vx;
          } else e.edge = null;
          if (e.x <= EW / 2 + 0.01 || e.x >= AW - EW / 2 - 0.01) e.vx = e.x < AW / 2 ? Math.abs(e.vx) : -Math.abs(e.vx);
          if (e.jumpT <= 0) {
            e.jumpT = U.rand(2, 4.5) / sp;
            if (this.platAbove(e.x, e.y)) { e.vy = JV * 0.98; e.on = null; }
          }
        }
        const vx = e.vx;
        e.vx = vx * sp; this.physics(e, dt, EW); e.vx = vx;
      }

      // φούσκες
      for (const b of this.bubbles) {
        b.t += dt; b.wob += dt * 3;
        if (b.t < SHOT_T) {
          b.x += b.vx * dt * (1 - b.t / SHOT_T * 0.6);
          if (b.x < BR || b.x > AW - BR) { b.x = U.clamp(b.x, BR, AW - BR); b.t = SHOT_T; }
          if (!b.enemy) {
            const e = this.enemies.find((q) => Math.abs(q.x - b.x) < 0.8 && Math.abs(q.y + EH / 2 - b.y) < 0.85);
            if (e) this.trap(b, e);
          }
        } else {
          const top = AH - 0.85;
          if (b.y < top) b.y = Math.min(top, b.y + RISE * dt);
          else b.x += Math.sign(AW / 2 - b.x) * Math.min(Math.abs(AW / 2 - b.x), 0.5 * dt);
          b.x += Math.sin(b.wob) * 0.25 * dt;
          b.x = U.clamp(b.x, BR, AW - BR);
        }
        const life = b.enemy ? TRAP_LIFE : EMPTY_LIFE;
        if (b.t > life) {
          b.dead = true;
          if (b.enemy) {
            const e = b.enemy;
            Object.assign(e, { x: b.x, y: Math.max(0, b.y - EH / 2), vy: 0, angry: true, on: null });
            this.enemies.push(e);
            this.floats.push({ x: b.x, y: b.y + 0.6, t: 0, text: 'Ξέφυγε! 😠', c: '#ff8a8a', sz: 2.6 });
            this.sfx('buzz');
          } else this.bursts.push({ x: b.x, y: b.y, t: 0, c: '#cfefff', r: BR });
        }
      }
      // σπρώξιμο ανάμεσα σε φούσκες στο ταβάνι
      for (let i = 0; i < this.bubbles.length; i++) for (let j = i + 1; j < this.bubbles.length; j++) {
        const a = this.bubbles[i], c = this.bubbles[j];
        if (a.t < SHOT_T || c.t < SHOT_T) continue;
        const dx = c.x - a.x, dy = c.y - a.y, d = Math.hypot(dx, dy);
        if (d > 0.001 && d < BR * 1.7) { const k = (BR * 1.7 - d) * 0.5; a.x -= (dx / d) * k * 0.5; c.x += (dx / d) * k * 0.5; a.y -= (dy / d) * k * 0.3; c.y += (dy / d) * k * 0.3; }
      }

      // πάντα πάνω σε φούσκες
      for (const p of this.parts) {
        if (p.dead > 0 || !this.active(p)) continue;
        for (const b of this.bubbles) {
          if (b.dead || b.t < 0.2) continue;
          const dx = b.x - p.x, dy = b.y - (p.y + PH / 2);
          if (Math.hypot(dx, dy * 0.9) > BR + 0.45) continue;
          if (b.enemy) this.popChain(b, p);
          else if (p.vy < 0 && p.y > b.y - 0.1) { p.vy = JV * 0.82; p.on = null; this.sfx('bounce'); }
          else if (b.t > SHOT_T) { b.dead = true; this.bursts.push({ x: b.x, y: b.y, t: 0, c: '#cfefff', r: BR }); this.sfx('pop'); }
        }
      }
      this.bubbles = this.bubbles.filter((b) => !b.dead);

      // φρούτα
      for (const f of this.fruits) {
        f.t += dt;
        const vx = f.vx; this.physics(f, dt, 0.5); f.vx = f.on ? 0 : vx;
        if (f.x <= 0.3 || f.x >= AW - 0.3) f.vx = -f.vx;
        for (const p of this.parts) {
          if (f.got || p.dead > 0 || !this.active(p) || f.t < 0.35) continue;
          if (Math.abs(p.x - f.x) < 0.75 && Math.abs(p.y + PH / 2 - (f.y + 0.25)) < 0.9) {
            f.got = true;
            p.score += f.v; p.fruit++; this.team += f.v;
            this.floats.push({ x: f.x, y: f.y + 0.7, t: 0, text: `+${f.v}`, c: p.color.hex });
            this.sfx('point');
            this.fx(p, `🍒 +${f.v}`, [25]);
            this.changed();
          }
        }
      }
      this.fruits = this.fruits.filter((f) => !f.got && f.t < 12);

      // τέρατα πάνω σε πάντα
      if (this.phase === 'go') for (const p of this.parts) {
        if (p.dead > 0 || p.inv > 0 || !this.active(p)) continue;
        const e = this.enemies.find((q) => Math.abs(q.x - p.x) < (PW + EW) * 0.33 && Math.abs((q.y + EH / 2) - (p.y + PH / 2)) < (PH + EH) * 0.32);
        if (e) this.hit(p);
      }

      if (this.phase === 'go' && !this.enemies.length && !this.bubbles.some((b) => b.enemy)) this.clearLevel();
    }

    trap(b, e) {
      this.enemies.splice(this.enemies.indexOf(e), 1);
      b.enemy = e; b.t = Math.max(b.t, SHOT_T * 0.7);
      b.by.pops++;
      this.sfx('pump');
      this.fx(b.by, '🫧 Το έκλεισες!', [30]);
    }

    // σκάει τη φούσκα και όσες ακουμπούν σε αυτή (σειρά)
    popChain(b0, p) {
      const set = [b0], seen = new Set([b0]);
      for (let i = 0; i < set.length; i++) {
        for (const c of this.bubbles) {
          if (seen.has(c) || c.dead || c.t < 0.2) continue;
          if (Math.hypot(c.x - set[i].x, c.y - set[i].y) < BR * 2.6) { seen.add(c); set.push(c); }
        }
      }
      let k = 0;
      for (const b of set) {
        b.dead = true;
        this.bursts.push({ x: b.x, y: b.y, t: 0, c: b.enemy ? this.L.mon : '#cfefff', r: BR });
        if (!b.enemy) continue;
        const v = VALUES[Math.min(k, VALUES.length - 1)];
        this.fruits.push({ x: b.x, y: b.y, vx: U.rand(-3, 3), vy: U.rand(5, 8), on: null, t: 0, v, kind: Math.min(k, 4) });
        k++;
      }
      if (k) {
        this.sfx(k > 1 ? 'finish' : 'pop');
        if (k > 1) {
          this.floats.push({ x: b0.x, y: b0.y + 0.9, t: 0, text: `Σειρά ×${k}!`, c: '#ffe36b', sz: 3.4 });
          this.fx(p, `💥 Σειρά ×${k}!`, [40, 40, 60]);
        } else this.fx(p, '💥 Έσκασε!', [40]);
        this.changed();
      }
    }

    hit(p) {
      p.dead = RESPAWN; p.vy = 9; p.falls++;
      // το ρομπότ-συμπαίκτης (όταν παίζεις μόνος) δεν χαλάει τις καρδιές της ομάδας
      if (!p.bot) this.lives--;
      p.status = '💥 Τον έπιασαν';
      this.floats.push({ x: p.x, y: p.y + PH + 0.4, t: 0, text: p.bot ? '💫' : '−❤', c: '#ff5a6e', sz: 3.2 });
      this.sfx('splat');
      this.fx(p, 'Σε έπιασε τέρατάκι! −1 ❤', [200, 60, 200], true);
      if (!p.bot && this.lives <= 0) {
        this.lives = 0;
        this.phase = 'lost';
        this.banner('Τελείωσαν οι καρδιές! 💔', '#ff8a8a');
        this.sfx('miss');
        this.after(2.4, () => this.running && this.finish(false));
      }
      this.changed();
    }

    clearLevel() {
      this.phase = 'clear';
      this.sfx('finish');
      const last = this.level >= LEVELS.length;
      const bonus = Math.max(0, Math.round((HURRY - this.levelT) * 2));
      this.team += bonus;
      if (!last) this.lives = Math.min(9, this.lives + 1);
      this.banner(last ? 'Περάσατε όλες τις πίστες! 🐼🏆' : `Πίστα ${this.level} καθαρή! +1 ❤${bonus ? ` · +${bonus} γρηγοράδα` : ''}`, '#ffc93d');
      this.changed();
      // λίγος χρόνος για να μαζέψουν τα φρούτα
      this.after(3.2, () => {
        if (!this.running) return;
        if (last) { this.won = true; this.finish(true); } else this.nextLevel();
      });
    }

    finish(won) {
      this.phase = 'end';
      this.parts.forEach((p) => { p.mv = 0; p.dead = 0; p.inv = 0; });
      const rank = [...this.parts].sort((a, b) => b.score - a.score || b.pops - a.pops || a.falls - b.falls);
      const mvp = rank[0];
      mvp.hi = true;
      if (won) this.team += this.lives * 50;
      this.celebrate(won ? mvp.color.hex : '#9b6bff');
      this.sfx(won ? 'win' : 'miss');
      this.changed();
      this.h.onOver && this.h.onOver({
        winner: mvp,
        title: won ? 'Η ομάδα νίκησε! Πρώτος σε πόντους' : 'Πρώτος της ομάδας',
        icon: won ? '🏆' : '🐼',
        stats: won
          ? `Ομάδα: ${this.team} πόντοι · πέρασε και τις ${LEVELS.length} πίστες με ${this.lives} ❤`
          : `Ομάδα: ${this.team} πόντοι · έφτασε στην πίστα ${this.level}/${LEVELS.length}`,
        rank: rank.map((q) => ({ name: q.name, color: q.color, st: `${q.score} ${q.score === 1 ? 'πόντος' : 'πόντοι'} · ${q.pops} ${q.pops === 1 ? 'φούσκα' : 'φούσκες'} · ${q.falls} ${q.falls === 1 ? 'πιάσιμο' : 'πιασίματα'}` })),
      });
    }

    ctrl(part) {
      const base = { mode: 'plat', scoreText: `❤ ${this.lives} · Πόντοι: ${part.score}` };
      if (this.phase === 'go' && part.dead > 0) return { ...base, active: false, label: '💥 Σε έπιασαν!', sub: 'Ξαναβγαίνεις σε λίγο' };
      if (this.phase === 'go' || this.phase === 'clear') return { ...base, active: true, label: '', sub: '' };
      return { ...base, active: false, label: this.phase === 'count' ? `Πίστα ${this.level} · Ετοιμάσου!` : this.phase === 'lost' ? '💔 Τέλος' : 'Μπράβο!', sub: '◀ ▶ κίνηση · ΑΛΜΑ · ΦΟΥΣΚΑ' };
    }

    // ---------- σχεδίαση ----------
    view() {
      const W = this.W, H = this.H;
      const top = H * 0.11, bot = H * 0.83;
      const s = Math.min((W * 0.95) / AW, (bot - top) / AH);
      const w = AW * s, h = AH * s;
      return { s, x0: (W - w) / 2, y0: top + (bot - top + h) / 2, w, h };
    }
    P(v, X, Y) { return { x: v.x0 + X * v.s, y: v.y0 - Y * v.s }; }

    draw() {
      const x = this.ctx, W = this.W, H = this.H, vh = this.vh, v = this.view(), L = this.L, s = v.s;
      const bg = x.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, '#120a26'); bg.addColorStop(1, '#070414');
      x.fillStyle = bg; x.fillRect(0, 0, W, H);

      // σκηνικό
      x.save();
      x.beginPath(); x.rect(v.x0, v.y0 - v.h, v.w, v.h + s * 0.55); x.clip();
      const sky = x.createLinearGradient(0, v.y0 - v.h, 0, v.y0);
      sky.addColorStop(0, L.sky[0]); sky.addColorStop(1, L.sky[1]);
      x.fillStyle = sky; x.fillRect(v.x0, v.y0 - v.h, v.w, v.h);
      // μπαμπού στο βάθος
      for (let i = 0; i < 16; i++) {
        const bx = v.x0 + ((i * 1.37 + 0.4) % AW) * s, w2 = s * (0.22 + (i % 3) * 0.06);
        x.fillStyle = `rgba(255,255,255,${0.035 + (i % 4) * 0.012})`;
        x.fillRect(bx, v.y0 - v.h, w2, v.h);
        for (let k = 1; k < 7; k++) x.fillRect(bx - w2 * 0.15, v.y0 - v.h + k * s * 1.7 + (i % 3) * s * 0.4, w2 * 1.3, s * 0.06);
      }
      // αστεράκια/πυγολαμπίδες
      for (let i = 0; i < 26; i++) {
        const fx = v.x0 + ((i * 7.31) % AW) * s + Math.sin(this.time * 0.7 + i) * s * 0.3;
        const fy = v.y0 - (((i * 3.17) % (AH - 1)) + 0.6) * s + Math.cos(this.time * 0.9 + i) * s * 0.2;
        x.fillStyle = `rgba(255,245,170,${0.25 + 0.25 * Math.sin(this.time * 2 + i * 1.7)})`;
        x.beginPath(); x.arc(fx, fy, s * 0.05, 0, 7); x.fill();
      }
      // πλατφόρμες
      for (const q of this.plats) {
        const a = this.P(v, q.x0, q.y), th = q.floor ? s * 0.55 : s * 0.42, w = (q.x1 - q.x0) * s;
        U.rr(x, a.x, a.y, w, th, s * 0.12);
        x.fillStyle = L.plat; x.fill();
        x.lineWidth = this.lw; x.strokeStyle = U.INK; x.stroke();
        x.fillStyle = 'rgba(255,255,255,.28)'; x.fillRect(a.x + s * 0.12, a.y + s * 0.06, w - s * 0.24, s * 0.08);
        x.strokeStyle = 'rgba(0,0,0,.25)'; x.lineWidth = Math.max(1, this.lw * 0.6);
        for (let X = a.x + s * 0.9; X < a.x + w - s * 0.3; X += s * 0.9) { x.beginPath(); x.moveTo(X, a.y + th * 0.3); x.lineTo(X, a.y + th * 0.9); x.stroke(); }
      }
      // φρούτα
      for (const f of this.fruits) this.drawFruit(v, f);
      // τέρατα
      for (const e of this.enemies) this.drawMonster(this.P(v, e.x, e.y + e.drop * 6), s, e, 1);
      // πάντα
      for (const p of this.parts) this.drawPanda(v, p);
      // φούσκες
      for (const b of this.bubbles) this.drawBubble(v, b);
      // σκασίματα
      for (const q of this.bursts) {
        const c = this.P(v, q.x, q.y), t = q.t / 0.4, r = q.r * s;
        x.strokeStyle = U.rgba(q.c, 1 - t); x.lineWidth = vh * 0.5 * (1 - t) + 1;
        for (let i = 0; i < 8; i++) {
          const a = (i * Math.PI) / 4 + 0.3;
          x.beginPath(); x.moveTo(c.x + Math.cos(a) * r * (0.7 + t), c.y + Math.sin(a) * r * (0.7 + t));
          x.lineTo(c.x + Math.cos(a) * r * (1.1 + t * 1.5), c.y + Math.sin(a) * r * (1.1 + t * 1.5)); x.stroke();
        }
      }
      for (const f of this.floats) {
        const c = this.P(v, f.x, f.y + f.t * 1.3);
        x.globalAlpha = Math.max(0, 1 - f.t / 1.2);
        this.text(f.text, c.x, c.y, vh * (f.sz || 3), f.c, { sw: vh * 0.6 });
        x.globalAlpha = 1;
      }
      x.restore();
      x.strokeStyle = U.INK; x.lineWidth = this.lw * 1.4;
      U.rr(x, v.x0, v.y0 - v.h, v.w, v.h + s * 0.55, s * 0.2); x.stroke();

      this.drawHud(v);
      if (this.phase === 'count' || (this.phase === 'go' && this.time - this.countT < 3.7)) this.drawCount(this.countT, 'ΦΟΥΣΚΕΣ!');
      this.drawBoard();
    }

    drawHud(v) {
      // όλα στη μέση, ώστε να μη σκεπάζονται από το λογότυπο (αριστερά) και τον κωδικό δωματίου (δεξιά)
      const x = this.ctx, vh = this.vh, y = (v.y0 - v.h) / 2, W = this.W;
      const n = Math.max(this.lives, 0), r = vh * 1.4, gap = r * 2.6, tot = Math.max(1, n) * gap;
      this.text(`Πίστα ${this.level}/${LEVELS.length}`, W / 2 - tot / 2 - vh * 1.5, y, vh * 3, '#fff', { align: 'right' });
      for (let i = 0; i < n; i++) this.heart(W / 2 - tot / 2 + gap * (i + 0.5), y, r, '#ff5a6e');
      if (!n) this.text('💔', W / 2, y, vh * 3, '#fff', { stroke: false });
      const t = this.hurry ? 'Βιάσου!' : `⏱ ${Math.max(0, Math.ceil(HURRY - this.levelT))}″`;
      this.text(`${t}  ⭐ ${this.team}`, W / 2 + tot / 2 + vh * 1.5, y, vh * 3, this.hurry && Math.sin(this.time * 10) > 0 ? '#ff6a6a' : '#ffe36b', { align: 'left' });
    }

    heart(cx, cy, r, c) {
      const x = this.ctx;
      x.beginPath();
      x.moveTo(cx, cy + r * 0.9);
      x.bezierCurveTo(cx - r * 1.6, cy - r * 0.1, cx - r * 0.7, cy - r * 1.3, cx, cy - r * 0.45);
      x.bezierCurveTo(cx + r * 0.7, cy - r * 1.3, cx + r * 1.6, cy - r * 0.1, cx, cy + r * 0.9);
      x.fillStyle = c; x.fill(); x.lineWidth = this.lw; x.strokeStyle = U.INK; x.stroke();
    }

    drawBubble(v, b) {
      const x = this.ctx, s = v.s, c = this.P(v, b.x, b.y);
      const life = b.enemy ? TRAP_LIFE : EMPTY_LIFE, left = life - b.t;
      const grow = b.t < SHOT_T ? 0.45 + 0.55 * (b.t / SHOT_T) : 1;
      let r = BR * s * grow;
      const shake = b.enemy && left < 2 ? Math.sin(this.time * 40) * s * 0.05 : 0;
      x.save(); x.translate(c.x + shake, c.y);
      r *= 1 + Math.sin(b.wob * 1.3) * 0.03;
      if (b.enemy) { x.save(); x.scale(0.7, 0.7); this.drawMonster({ x: 0, y: s * EH * 0.55 }, s, b.enemy, 0.9, true); x.restore(); }
      const edge = b.enemy && left < 2 ? '#ff5a6e' : b.by.color.hex;
      const g = x.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.1, 0, 0, r);
      g.addColorStop(0, 'rgba(255,255,255,.35)'); g.addColorStop(0.7, U.rgba(edge, 0.12)); g.addColorStop(1, U.rgba(edge, 0.45));
      x.fillStyle = g; x.beginPath(); x.arc(0, 0, r, 0, 7); x.fill();
      x.lineWidth = Math.max(1.5, s * 0.06); x.strokeStyle = U.rgba(edge, 0.95); x.stroke();
      x.fillStyle = 'rgba(255,255,255,.8)';
      x.beginPath(); x.ellipse(-r * 0.38, -r * 0.42, r * 0.2, r * 0.11, -0.7, 0, 7); x.fill();
      x.restore();
    }

    // τέρατάκι: στρογγυλό με ένα μάτι και κεράκια· c = πόδια (κάτω μέση)
    drawMonster(c, s, e, k, inBubble) {
      const x = this.ctx, col = e.angry ? '#ff4d4d' : this.L.mon;
      const w = s * EW * 0.55 * k, h = s * EH * 0.55 * k, face = e.vx >= 0 ? 1 : -1;
      const bob = inBubble ? 0 : Math.abs(Math.sin(e.anim * 9)) * s * 0.05;
      x.save(); x.translate(c.x, c.y - h - bob);
      if (inBubble) x.rotate(Math.sin(this.time * 3 + e.id) * 0.25);
      x.lineWidth = Math.max(1.4, s * 0.06); x.strokeStyle = U.INK; x.lineJoin = 'round';
      if (e.fly) { // φτερά
        const fl = Math.sin(e.anim * 18) * 0.5;
        x.fillStyle = U.shade(col, 0.4);
        for (const sd of [-1, 1]) {
          x.save(); x.scale(sd, 1); x.rotate(-0.3 + fl);
          x.beginPath(); x.ellipse(w * 1.05, -h * 0.2, w * 0.6, h * 0.35, -0.4, 0, 7); x.fill(); x.stroke(); x.restore();
        }
      } else { // ποδαράκια
        x.fillStyle = U.shade(col, -0.35);
        const st = inBubble ? 0 : Math.sin(e.anim * 12) * w * 0.2;
        for (const sd of [-1, 1]) { x.beginPath(); x.ellipse(sd * w * 0.45 + sd * st, h * 0.92, w * 0.3, h * 0.16, 0, 0, 7); x.fill(); x.stroke(); }
      }
      // κεράκια
      x.fillStyle = '#fff3d6';
      for (const sd of [-1, 1]) { x.beginPath(); x.moveTo(sd * w * 0.35, -h * 0.75); x.lineTo(sd * w * 0.62, -h * 1.25); x.lineTo(sd * w * 0.7, -h * 0.6); x.closePath(); x.fill(); x.stroke(); }
      // σώμα
      const g = x.createRadialGradient(-w * 0.3, -h * 0.4, w * 0.1, 0, 0, w * 1.1);
      g.addColorStop(0, U.shade(col, 0.45)); g.addColorStop(1, U.shade(col, -0.2));
      x.fillStyle = g; x.beginPath(); x.ellipse(0, 0, w, h, 0, 0, 7); x.fill(); x.stroke();
      // μάτι
      x.fillStyle = '#fff'; x.beginPath(); x.arc(face * w * 0.2, -h * 0.15, w * 0.42, 0, 7); x.fill(); x.stroke();
      x.fillStyle = U.INK; x.beginPath(); x.arc(face * w * 0.32, -h * 0.12, w * 0.18, 0, 7); x.fill();
      if (e.angry) { x.strokeStyle = U.INK; x.lineWidth = s * 0.07; x.beginPath(); x.moveTo(face * w * -0.2, -h * 0.62); x.lineTo(face * w * 0.6, -h * 0.4); x.stroke(); }
      // στόμα με δοντάκια
      x.fillStyle = U.INK; x.beginPath(); x.ellipse(face * w * 0.15, h * 0.45, w * 0.35, h * 0.15, 0, 0, Math.PI); x.fill();
      x.fillStyle = '#fff'; x.fillRect(face * w * 0.15 - w * 0.18, h * 0.45, w * 0.1, h * 0.1); x.fillRect(face * w * 0.15 + w * 0.08, h * 0.45, w * 0.1, h * 0.1);
      x.restore();
    }

    drawFruit(v, f) {
      const x = this.ctx, s = v.s, c = this.P(v, f.x, f.y), r = s * 0.28;
      if (f.t > 9 && Math.sin(this.time * 25) > 0) return;
      x.save(); x.translate(c.x, c.y - r);
      x.lineWidth = Math.max(1.3, s * 0.05); x.strokeStyle = U.INK;
      const cols = ['#ff4d5e', '#ffa62b', '#9b5bff', '#3ee08f', '#ffe36b'];
      if (f.kind === 2) { // σταφύλι
        x.fillStyle = cols[2];
        for (const [a, b] of [[-0.5, -0.5], [0.5, -0.5], [0, -0.1], [-0.5, 0.3], [0.5, 0.3], [0, 0.7]]) { x.beginPath(); x.arc(a * r * 0.8, b * r * 0.9, r * 0.42, 0, 7); x.fill(); x.stroke(); }
      } else if (f.kind === 4) { // αστέρι
        x.fillStyle = cols[4]; U.starPath(x, 0, 0, r * 1.25); x.fill(); x.stroke();
      } else if (f.kind === 3) { // καρπούζι
        x.fillStyle = '#3ea84a'; x.beginPath(); x.arc(0, -r * 0.3, r * 1.1, 0, Math.PI); x.closePath(); x.fill(); x.stroke();
        x.fillStyle = '#ff5a6e'; x.beginPath(); x.arc(0, -r * 0.3, r * 0.85, 0, Math.PI); x.closePath(); x.fill();
        x.fillStyle = U.INK; for (const a of [-0.4, 0, 0.4]) { x.beginPath(); x.arc(a * r, r * 0.05, r * 0.07, 0, 7); x.fill(); }
      } else { // μήλο / πορτοκάλι
        x.fillStyle = cols[f.kind]; x.beginPath(); x.arc(0, 0, r, 0, 7); x.fill(); x.stroke();
        x.fillStyle = 'rgba(255,255,255,.6)'; x.beginPath(); x.ellipse(-r * 0.35, -r * 0.35, r * 0.22, r * 0.13, -0.7, 0, 7); x.fill();
        x.fillStyle = '#4caf50'; x.beginPath(); x.ellipse(r * 0.3, -r * 1.05, r * 0.35, r * 0.16, -0.5, 0, 7); x.fill(); x.stroke();
      }
      x.restore();
    }

    drawPanda(v, p) {
      if (!this.active(p) && !p.bot) return;
      const x = this.ctx, s = v.s * 1.15, g = this.P(v, p.x, p.y), vh = this.vh;
      if (p.inv > 0 && p.dead <= 0 && Math.sin(this.time * 28) > 0.2) return;
      const air = !p.on && p.dead <= 0, blow = this.time - p.blowT < 0.25;
      const bob = p.walk ? Math.abs(Math.sin(p.walk)) * s * 0.05 : 0;
      x.save(); x.translate(g.x, g.y - bob);
      if (p.dead > 0) { x.translate(0, -s * 0.5); x.rotate((RESPAWN - p.dead) * 9); x.translate(0, s * 0.5); x.globalAlpha = Math.min(1, p.dead / 0.6); }
      x.scale(p.face, 1);
      x.lineWidth = Math.max(1.4, s * 0.055); x.strokeStyle = U.INK; x.lineJoin = 'round';
      const blk = '#1f1d2a';
      // πόδια
      const lg = air ? 0.5 : p.walk ? Math.sin(p.walk) * 0.45 : 0;
      x.fillStyle = blk;
      for (const sd of [-1, 1]) {
        x.save(); x.translate(sd * s * 0.15, -s * 0.28); x.rotate(sd * lg * (air ? -1 : 1));
        U.rr(x, -s * 0.1, 0, s * 0.2, s * 0.28, s * 0.09); x.fill(); x.restore();
      }
      // σώμα
      x.fillStyle = '#fff'; x.beginPath(); x.ellipse(0, -s * 0.47, s * 0.3, s * 0.27, 0, 0, 7); x.fill(); x.stroke();
      // χέρια
      x.fillStyle = blk;
      x.save(); x.translate(s * 0.05, -s * 0.6); x.rotate(blow ? -1.4 : air ? -2.3 : 0.4 + (p.walk ? Math.sin(p.walk) * 0.4 : 0));
      U.rr(x, -s * 0.07, 0, s * 0.14, s * 0.32, s * 0.07); x.fill(); x.restore();
      x.fillStyle = blk; x.beginPath(); x.ellipse(0, -s * 0.66, s * 0.31, s * 0.09, 0, 0, 7); x.fill();
      // κασκόλ
      x.fillStyle = p.color.hex; U.rr(x, -s * 0.27, -s * 0.73, s * 0.54, s * 0.1, s * 0.05); x.fill(); x.stroke();
      U.rr(x, -s * 0.3, -s * 0.7, s * 0.1, s * 0.22, s * 0.04); x.fill(); x.stroke();
      // κεφάλι
      const hy = -s * 0.98;
      x.fillStyle = blk;
      for (const sd of [-1, 1]) { x.beginPath(); x.arc(sd * s * 0.19, hy - s * 0.18, s * 0.09, 0, 7); x.fill(); }
      x.fillStyle = '#fff'; x.beginPath(); x.ellipse(0, hy, s * 0.27, s * 0.24, 0, 0, 7); x.fill(); x.stroke();
      x.fillStyle = blk;
      for (const sd of [-1, 1]) { x.beginPath(); x.ellipse(s * 0.04 + sd * s * 0.1, hy - s * 0.02, s * 0.065, s * 0.085, sd * 0.5, 0, 7); x.fill(); }
      x.fillStyle = '#fff';
      if (p.dead > 0) { x.font = this.font(s * 0.12); x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('✕', s * -0.06, hy - s * 0.02); x.fillText('✕', s * 0.14, hy - s * 0.02); }
      else for (const sd of [-1, 1]) { x.beginPath(); x.arc(s * 0.06 + sd * s * 0.1, hy - s * 0.03, s * 0.026, 0, 7); x.fill(); }
      x.fillStyle = blk; x.beginPath(); x.ellipse(s * 0.07, hy + s * 0.08, s * 0.045, s * 0.03, 0, 0, 7); x.fill();
      if (blow) { // φουσκωμένο στόμα
        x.fillStyle = '#ffb3c1'; x.beginPath(); x.arc(s * 0.2, hy + s * 0.1, s * 0.06, 0, 7); x.fill(); x.stroke();
      }
      x.restore();
      if (p.dead <= 0) this.text(p.name + (p.bot ? ' 🤖' : ''), g.x, g.y - s * 1.45, Math.max(11, vh * 2), p.color.hex, { sw: vh * 0.5 });
    }

    drawBoard() {
      const x = this.ctx, n = this.parts.length, vh = this.vh;
      const cw = Math.min(this.W * 0.21, vh * 38), ch = vh * 9, gap = vh * 2;
      let X = (this.W - (n * cw + (n - 1) * gap)) / 2;
      const Y = this.H - ch - vh * 1.4;
      for (const p of this.parts) {
        const c = p.color.hex;
        U.rr(x, X, Y, cw, ch, vh * 2);
        x.fillStyle = 'rgba(10,5,30,.85)'; x.fill();
        x.lineWidth = vh * 0.35; x.strokeStyle = p.hi ? c : 'rgba(255,255,255,.16)'; x.stroke();
        const name = '🐼 ' + p.name + (p.bot ? ' 🤖' : '') + (p.p && !p.p.connected ? ' (εκτός)' : '');
        x.font = this.font(vh * 2.3); x.textAlign = 'left'; x.textBaseline = 'middle'; x.fillStyle = c;
        let nm = name; while (x.measureText(nm).width > cw * 0.64 && nm.length > 2) nm = nm.slice(0, -2) + '…';
        x.fillText(nm, X + vh * 2, Y + vh * 2.9);
        x.font = this.font(vh * 1.85, 600); x.fillStyle = '#e9e4ff';
        x.fillText(p.dead > 0 ? '💥 Τον έπιασαν' : `🫧 ${p.pops} ${p.pops === 1 ? 'φούσκα' : 'φούσκες'}`, X + vh * 2, Y + vh * 6.3);
        x.font = this.font(vh * 4.8, 800, 'Comfortaa'); x.textAlign = 'right'; x.fillStyle = '#fff';
        x.fillText(String(p.score), X + cw - vh * 2, Y + ch / 2 + vh * 0.3);
        X += cw + gap;
      }
    }
  }

  Mini.games.bubpanda = BubPandaGame;
})();
