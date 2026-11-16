// «Μπαλάκι στα ποτηράκια» — φυσική + σχεδίαση σε Canvas 2D με προοπτική
(function () {
  'use strict';
  const G = 9.8;
  const CUP_R = 0.4, CUP_RB = 0.28, CUP_H = 0.52, BALL_R = 0.11;
  const PITCH = 0.84, ROW_DZ = 0.73, APEX_Z = 3.6;
  const TABLE_HW = 1.75, TABLE_NEAR = -1.2, TABLE_FAR = APEX_Z + 3 * ROW_DZ + CUP_R + 0.35;
  const WALL_Z = TABLE_FAR + 2.0, FLOOR = -1.0;
  const START = { x: 0, y: BALL_R + 0.15, z: 0 };
  const CAM = { y: 5.4, z: -2.2, pitch: (45 * Math.PI) / 180 };
  const CP = Math.cos(CAM.pitch), SP = Math.sin(CAM.pitch);
  const VY0 = 4.3;
  const D_MIN = 1.8, D_RANGE = 5.5;
  const INK = '#1c1a2b', FELT = '#0b8a57', FELT_D = '#087246';

  function rackLayout(n) {
    const rows = n === 6 ? 3 : n === 3 ? 2 : 4;
    const out = [];
    for (let r = 0; r < rows; r++)
      for (let i = 0; i <= r; i++)
        out.push({ x: (i - r / 2) * PITCH, z: APEX_Z + r * ROW_DZ, alive: true });
    return out;
  }

  function rgb(hex) {
    const n = parseInt(hex.replace('#', ''), 16);
    return [n >> 16, (n >> 8) & 255, n & 255];
  }
  function shade(hex, a) {
    let [r, g, b] = rgb(hex);
    if (a < 0) { r *= 1 + a; g *= 1 + a; b *= 1 + a; }
    else { r += (255 - r) * a; g += (255 - g) * a; b += (255 - b) * a; }
    return `rgb(${r | 0},${g | 0},${b | 0})`;
  }
  function rgba(hex, al) { const [r, g, b] = rgb(hex); return `rgba(${r},${g},${b},${al})`; }
  function rr(x, X, Y, w, h, r) {
    r = Math.min(r, w / 2, h / 2); x.beginPath(); x.moveTo(X + r, Y); x.arcTo(X + w, Y, X + w, Y + h, r);
    x.arcTo(X + w, Y + h, X, Y + h, r); x.arcTo(X, Y + h, X, Y, r); x.arcTo(X, Y, X + w, Y, r); x.closePath();
  }
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rand = (a, b) => a + Math.random() * (b - a);

  class CupsGame {
    constructor(canvas, hooks) {
      this.c = canvas;
      this.ctx = canvas.getContext('2d');
      this.h = hooks || {};
      this.state = 'idle';
      this.cups = rackLayout(10);
      this.color = '#ff4d5e';
      this.ball = { x: START.x, y: START.y, z: START.z, vx: 0, vy: 0, vz: 0 };
      this.trail = [];
      this.aim = { ax: 0, p: 0, active: false };
      this.fx = [];
      this.parts = [];
      this.confetti = [];
      this.time = 0;
      this.demo = false;
      this.demoWait = 0;
      this.tid = 0; // αναγνωριστικό ρίψης: ακυρώνει παλιά timeouts
      this.resize();
      addEventListener('resize', () => this.resize());
      this.last = performance.now();
      const loop = (t) => {
        const dt = Math.min(0.05, (t - this.last) / 1000);
        this.last = t;
        if (!this.paused) { this.update(dt); this.draw(); } // σε παύση όσο τρέχει άλλο παιχνίδι
        requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
    }

    resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      this.W = innerWidth; this.H = innerHeight;
      this.c.width = Math.round(this.W * dpr);
      this.c.height = Math.round(this.H * dpr);
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      this.f = Math.min(this.H * 1.2, this.W * 0.8);
      this.cx = this.W / 2;
      this.cy = this.H * 0.45;
      this.lw = Math.max(2, this.H * 0.0042);
    }

    // ---------- δημόσιο API ----------
    static rack(n) { return rackLayout(n); }

    setDemo(on) {
      this.demo = on;
      this.tid++;
      if (on) {
        this.cups = rackLayout(10);
        this.color = TVP.COLORS[0].hex;
        this.state = 'aiming';
        this.resetBall();
        this.demoWait = 1.2;
      }
    }

    setTurn(player) {
      this.demo = false;
      this.tid++;
      this.cups = player.cups;
      this.color = player.color.hex;
      this.state = 'aiming';
      this.resetBall();
      this.aim = { ax: 0, p: 0, active: false };
    }

    freeze() { this.tid++; this.state = 'idle'; this.aim.active = false; }

    setAim(ax, p) {
      if (this.state !== 'aiming') return;
      this.aim = { ax: clamp(+ax || 0, -1, 1), p: clamp(+p || 0, 0, 1), active: true };
    }

    throw(ax, p) {
      if (this.state !== 'aiming') return false;
      ax = clamp(+ax || 0, -1, 1); p = clamp(+p || 0, 0, 1);
      const d = D_MIN + p * D_RANGE;
      const t = (VY0 + Math.sqrt(VY0 * VY0 + 2 * G * (START.y - CUP_H))) / G;
      const b = this.ball;
      Object.assign(b, { x: START.x, y: START.y, z: START.z, vy: VY0, vz: d / t, vx: (ax * 1.6) / t });
      this.state = 'flying';
      this.flightT = 0;
      this.trail = [];
      this.aim.active = false;
      this.sfx('throw');
      return true;
    }

    celebrate(hex) {
      for (let i = 0; i < 160; i++) {
        this.confetti.push({
          x: rand(0, this.W), y: rand(-this.H * 0.6, -10),
          vx: rand(-40, 40), vy: rand(120, 260), r: rand(0, 6.28), vr: rand(-6, 6),
          w: rand(6, 12), h: rand(10, 18),
          c: Math.random() < 0.5 ? hex : TVP.COLORS[(Math.random() * 4) | 0].hex, life: 6,
        });
      }
    }

    // ---------- προσομοίωση ----------
    sfx(n) { this.h.sfx && this.h.sfx(n); }

    resetBall() {
      Object.assign(this.ball, { x: START.x, y: START.y, z: START.z, vx: 0, vy: 0, vz: 0 });
      this.trail = [];
    }

    update(dt) {
      this.time += dt;
      if (this.state === 'flying') {
        const n = Math.ceil(dt / (1 / 300));
        const h = dt / n;
        for (let i = 0; i < n && this.state === 'flying'; i++) this.step(h);
        this.flightT += dt;
        if (this.state === 'flying') {
          this.trail.push({ x: this.ball.x, y: this.ball.y, z: this.ball.z });
          if (this.trail.length > 14) this.trail.shift();
          if (this.flightT > 6) this.endThrow(false);
        }
      }
      if (this.demo && this.state === 'aiming') {
        this.demoWait -= dt;
        if (this.demoWait <= 0) {
          const alive = this.cups.filter((c) => c.alive);
          const c = alive[(Math.random() * alive.length) | 0];
          const good = Math.random() < 0.55;
          const nx = good ? rand(-0.02, 0.02) : rand(-0.3, 0.3);
          const nz = good ? rand(-0.012, 0.012) : rand(-0.07, 0.07);
          this.throw(c.x / 1.6 + nx, (c.z - D_MIN) / D_RANGE + nz);
        }
      }
      for (const f of this.fx) f.t += dt;
      this.fx = this.fx.filter((f) => f.t < 0.7);
      for (const p of this.parts) {
        p.vy -= G * 0.6 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.life -= dt;
      }
      this.parts = this.parts.filter((p) => p.life > 0);
      for (const q of this.confetti) {
        q.x += q.vx * dt + Math.sin(this.time * 3 + q.r) * 0.6; q.y += q.vy * dt; q.r += q.vr * dt; q.life -= dt;
      }
      this.confetti = this.confetti.filter((q) => q.life > 0 && q.y < this.H + 30);
    }

    step(h) {
      const b = this.ball, py = b.y;
      b.vy -= G * h;
      b.x += b.vx * h; b.y += b.vy * h; b.z += b.vz * h;

      for (const c of this.cups) {
        if (!c.alive) continue;
        const dx = b.x - c.x, dz = b.z - c.z;
        const dist = Math.hypot(dx, dz) || 1e-6, nx = dx / dist, nz = dz / dist;
        if (py >= CUP_H && b.y < CUP_H) {
          if (dist < CUP_R - BALL_R * 0.55) { this.sink(c); return; }
          if (dist < CUP_R + BALL_R) {
            // χτύπημα στο χείλος: αναπηδά, μέσα ή έξω ανάλογα με την πλευρά
            b.y = CUP_H + 0.001;
            b.vy = Math.abs(b.vy) * 0.42;
            const dir = dist < CUP_R ? -1 : 1;
            b.vx = b.vx * 0.5 + nx * dir * 0.9;
            b.vz = b.vz * 0.5 + nz * dir * 0.9;
            this.sfx('rim');
          }
        } else if (b.y < CUP_H && dist < CUP_R + BALL_R) {
          const vn = b.vx * nx + b.vz * nz;
          if (vn < 0) { b.vx -= 1.7 * vn * nx; b.vz -= 1.7 * vn * nz; if (vn < -0.5) this.sfx('tick'); }
          b.x = c.x + nx * (CUP_R + BALL_R);
          b.z = c.z + nz * (CUP_R + BALL_R);
        }
      }

      const onTable = Math.abs(b.x) <= TABLE_HW && b.z >= TABLE_NEAR && b.z <= TABLE_FAR;
      if (onTable && b.y < BALL_R && py >= BALL_R - 0.02 && b.vy < 0) {
        b.y = BALL_R;
        if (-b.vy > 0.8) this.sfx('bounce');
        b.vy = -b.vy * 0.55;
        if (b.vy < 0.35) b.vy = 0;
        b.vx *= 0.92; b.vz *= 0.92;
      }
      if (onTable && b.y <= BALL_R + 0.002 && b.vy <= 0 && py >= BALL_R - 0.02) {
        b.y = BALL_R; b.vy = 0;
        const fr = Math.max(0, 1 - 1.3 * h);
        b.vx *= fr; b.vz *= fr;
        if (Math.hypot(b.vx, b.vz) < 0.15) return this.endThrow(false);
      }
      if (b.z > WALL_Z - BALL_R && b.vz > 0) { b.z = WALL_Z - BALL_R; b.vz = -b.vz * 0.4; this.sfx('tick'); }
      if (!onTable && b.y < FLOOR + BALL_R) { b.y = FLOOR + BALL_R; this.endThrow(false); }
      if (b.y < -2.5) this.endThrow(false);
    }

    sink(c) {
      c.alive = false;
      this.state = 'sinking';
      this.fx.push({ x: c.x, z: c.z, t: 0, color: this.color });
      for (let i = 0; i < 46; i++) {
        const a = rand(0, Math.PI * 2), sp = rand(0.6, 2.2);
        this.parts.push({
          x: c.x, y: CUP_H, z: c.z, vx: Math.cos(a) * sp, vz: Math.sin(a) * sp, vy: rand(1.5, 4.5),
          life: rand(0.6, 1.2), c: Math.random() < 0.6 ? this.color : '#ffffff',
        });
      }
      this.sfx('sink');
      this.h.onSink && this.h.onSink();
      const id = this.tid;
      setTimeout(() => id === this.tid && this.finish(true), 1150);
    }

    endThrow(made) {
      if (this.state !== 'flying') return;
      this.state = 'done';
      this.sfx('miss');
      const id = this.tid;
      setTimeout(() => id === this.tid && this.finish(made), 700);
    }

    finish(made) {
      if (this.demo) {
        if (!this.cups.some((c) => c.alive)) this.cups = rackLayout(10);
        this.color = TVP.COLORS[(TVP.COLORS.findIndex((c) => c.hex === this.color) + 1) % 4].hex;
        this.state = 'aiming';
        this.resetBall();
        this.demoWait = 1.4;
        return;
      }
      this.h.onThrowDone && this.h.onThrowDone(made);
    }

    // ---------- σχεδίαση (καρτούν, κάμερα από ψηλά) ----------
    proj(X, Y, Z) {
      const dy = Y - CAM.y, dz = Z - CAM.z;
      const d = Math.max(0.3, dz * CP - dy * SP), u = dy * CP + dz * SP;
      const s = this.f / d;
      return { x: this.cx + X * s, y: this.cy - u * s, s, d };
    }
    // προβολή οριζόντιου κύκλου ως έλλειψη
    ell(X, Y, Z, r) {
      const l = this.proj(X - r, Y, Z), rt = this.proj(X + r, Y, Z);
      const f = this.proj(X, Y, Z - r), b = this.proj(X, Y, Z + r);
      return { x: (l.x + rt.x) / 2, y: (f.y + b.y) / 2, rx: (rt.x - l.x) / 2, ry: Math.abs(f.y - b.y) / 2 };
    }
    quad(pts) {
      const x = this.ctx; x.beginPath();
      pts.forEach((p, i) => { const q = this.proj(p[0], p[1], p[2]); i ? x.lineTo(q.x, q.y) : x.moveTo(q.x, q.y); });
      x.closePath();
    }

    draw() {
      const x = this.ctx, W = this.W, H = this.H;
      this.drawRoom();
      this.drawTable();

      // σκιές ποτηριών
      x.fillStyle = 'rgba(0,40,20,.35)';
      for (const c of this.cups) if (c.alive) {
        const e = this.ell(c.x - 0.07, 0, c.z - 0.1, CUP_RB * 1.3);
        x.beginPath(); x.ellipse(e.x, e.y, e.rx, e.ry, 0, 0, 7); x.fill();
      }
      this.drawBallShadow();
      if (this.state === 'aiming') this.drawStartZone();

      const items = [];
      for (const c of this.cups) if (c.alive) items.push({ d: this.proj(c.x, CUP_H, c.z).d, f: () => this.drawCup(c.x, c.z, this.color, 1, 1) });
      for (const f of this.fx) items.push({ d: this.proj(f.x, CUP_H, f.z).d, f: () => this.drawPop(f) });
      if (this.state === 'aiming' || this.state === 'flying' || this.state === 'done') {
        const b = this.ball;
        items.push({ d: this.proj(b.x, b.y, b.z).d - 0.05, f: () => this.drawBall() });
      }
      items.sort((a, b) => b.d - a.d);
      for (const it of items) it.f();

      for (const p of this.parts) {
        const q = this.proj(p.x, p.y, p.z);
        x.globalAlpha = clamp(p.life * 1.5, 0, 1);
        x.fillStyle = p.c;
        const s = Math.max(3, 0.05 * q.s);
        x.fillRect(q.x - s / 2, q.y - s / 2, s, s);
      }
      x.globalAlpha = 1;

      if (this.aim.active && this.state === 'aiming') this.drawPower();

      for (const q of this.confetti) {
        x.save(); x.translate(q.x, q.y); x.rotate(q.r); x.fillStyle = q.c;
        x.fillRect(-q.w / 2, -q.h / 2, q.w, q.h * Math.abs(Math.cos(q.r * 1.3))); x.restore();
      }
    }

    drawRoom() {
      const x = this.ctx, W = this.W, H = this.H;
      // τοίχος με φαρδιές ρίγες στο χρώμα του παίκτη
      const base = this.color;
      x.fillStyle = shade(base, -0.08); x.fillRect(0, 0, W, H);
      const wy0 = this.proj(0, FLOOR, WALL_Z).y;
      for (let i = -14; i < 14; i++) {
        if (i % 2) continue;
        this.quad([[i * 1.3, FLOOR, WALL_Z], [(i + 1) * 1.3, FLOOR, WALL_Z], [(i + 1) * 1.9, 12, WALL_Z], [i * 1.9, 12, WALL_Z]]);
        x.fillStyle = shade(base, -0.18); x.fill();
      }
      // σοβατεπί
      x.fillStyle = shade(base, -0.45);
      const bt = this.proj(0, FLOOR + 0.22, WALL_Z).y;
      x.fillRect(0, bt, W, wy0 - bt + 1);
      // πάτωμα (ξύλο)
      x.fillStyle = '#d6a571'; x.fillRect(0, wy0, W, H - wy0);
      x.strokeStyle = 'rgba(120,70,30,.18)'; x.lineWidth = Math.max(1, this.lw * 0.5);
      for (let px = -16; px <= 16; px += 0.7) {
        const a = this.proj(px, FLOOR, WALL_Z), b = this.proj(px, FLOOR, -4);
        x.beginPath(); x.moveTo(a.x, a.y); x.lineTo(b.x, b.y); x.stroke();
      }
      x.strokeStyle = 'rgba(0,0,0,.25)'; x.lineWidth = this.lw;
      x.beginPath(); x.moveTo(0, wy0); x.lineTo(W, wy0); x.stroke();
    }

    drawTable() {
      const x = this.ctx, B = 0.1;
      // σκιά τραπεζιού στο πάτωμα
      this.quad([[-TABLE_HW - 0.35, FLOOR, TABLE_NEAR], [TABLE_HW + 0.1, FLOOR, TABLE_NEAR], [TABLE_HW + 0.1, FLOOR, TABLE_FAR + 0.25], [-TABLE_HW - 0.35, FLOOR, TABLE_FAR + 0.25]]);
      x.fillStyle = 'rgba(70,35,10,.3)'; x.fill();
      const T = 0;
      // πίσω πόδια
      for (const lx of [-TABLE_HW + 0.2, TABLE_HW - 0.35]) {
        this.quad([[lx, FLOOR, TABLE_FAR - 0.3], [lx + 0.15, FLOOR, TABLE_FAR - 0.3], [lx + 0.15, 0, TABLE_FAR - 0.3], [lx, 0, TABLE_FAR - 0.3]]);
        x.fillStyle = '#8a8d99'; x.fill();
      }
      this.quad([[-TABLE_HW, T, TABLE_NEAR], [TABLE_HW, T, TABLE_NEAR], [TABLE_HW, T, TABLE_FAR], [-TABLE_HW, T, TABLE_FAR]]);
      x.fillStyle = '#f4f5f8'; x.fill();
      x.lineWidth = this.lw; x.strokeStyle = 'rgba(0,0,0,.12)'; x.stroke();
      this.quad([[-TABLE_HW + B, T, TABLE_NEAR], [TABLE_HW - B, T, TABLE_NEAR], [TABLE_HW - B, T, TABLE_FAR - B], [-TABLE_HW + B, T, TABLE_FAR - B]]);
      x.fillStyle = FELT; x.fill();
      // κεντρική γραμμή
      this.quad([[-0.045, T, TABLE_NEAR], [0.045, T, TABLE_NEAR], [0.045, T, TABLE_FAR - B], [-0.045, T, TABLE_FAR - B]]);
      x.fillStyle = '#ffffff'; x.fill();
    }

    drawStartZone() {
      const x = this.ctx;
      const e = this.ell(0, 0, 0, 0.34 * (1 + 0.06 * Math.sin(this.time * 4)));
      x.strokeStyle = 'rgba(255,255,255,.75)'; x.lineWidth = this.lw;
      x.setLineDash([this.lw * 2.5, this.lw * 2]);
      x.beginPath(); x.ellipse(e.x, e.y, e.rx, e.ry, 0, 0, 7); x.stroke();
      x.setLineDash([]);
      if (this.aim.active) this.drawAimArrow();
    }

    drawBallShadow() {
      const x = this.ctx, b = this.ball;
      if (!(this.state === 'aiming' || this.state === 'flying' || this.state === 'done')) return;
      const over = Math.abs(b.x) <= TABLE_HW && b.z <= TABLE_FAR && b.z >= TABLE_NEAR && b.y >= 0;
      const gy = over ? 0 : FLOOR, h = b.y - gy;
      const k = clamp(1 - h * 0.35, 0.25, 1);
      const e = this.ell(b.x - 0.04, gy, b.z - 0.05, BALL_R * (1.1 + h * 0.15));
      x.fillStyle = `rgba(0,40,20,${0.45 * k})`;
      x.beginPath(); x.ellipse(e.x, e.y, e.rx, e.ry, 0, 0, 7); x.fill();
    }

    drawAimArrow() {
      const x = this.ctx;
      const { ax, p } = this.aim;
      const len = 0.6 + p * 2.6;
      const dirX = (ax * 1.6) / (D_MIN + p * D_RANGE), n = Math.hypot(dirX, 1);
      const ux = dirX / n, uz = 1 / n, z0 = 0.45;
      const pts = [];
      for (let i = 0; i <= 12; i++) { const t = (i / 12) * len; pts.push(this.proj(ux * (z0 + t), 0.01, uz * (z0 + t))); }
      x.lineCap = 'round';
      x.lineWidth = this.lw * 2.4;
      x.strokeStyle = '#ffffff';
      x.setLineDash([this.lw * 3, this.lw * 3]);
      x.beginPath(); pts.forEach((q, i) => (i ? x.lineTo(q.x, q.y) : x.moveTo(q.x, q.y))); x.stroke();
      x.setLineDash([]);
      const tip = pts[pts.length - 1], pre = pts[pts.length - 3];
      const ang = Math.atan2(tip.y - pre.y, tip.x - pre.x), hs = this.lw * 6;
      x.fillStyle = '#ffffff'; x.strokeStyle = INK; x.lineWidth = this.lw;
      x.beginPath(); x.moveTo(tip.x + Math.cos(ang) * hs, tip.y + Math.sin(ang) * hs);
      x.lineTo(tip.x + Math.cos(ang + 2.4) * hs, tip.y + Math.sin(ang + 2.4) * hs);
      x.lineTo(tip.x + Math.cos(ang - 2.4) * hs, tip.y + Math.sin(ang - 2.4) * hs); x.closePath(); x.fill(); x.stroke();
    }

    drawPower() {
      const x = this.ctx, H = this.H, W = this.W;
      const bw = Math.max(18, H * 0.032), bh = H * 0.42, bx = W - bw - W * 0.05, by = H * 0.3;
      x.lineWidth = this.lw * 1.4; x.strokeStyle = INK;
      rr(x, bx, by, bw, bh, bw / 2); x.fillStyle = '#ffffff'; x.fill(); x.stroke();
      const fh = (bh - this.lw * 2) * this.aim.p;
      const g = x.createLinearGradient(0, by + bh, 0, by);
      g.addColorStop(0, '#2ecc71'); g.addColorStop(0.55, '#ffc93d'); g.addColorStop(1, '#ff4d5e');
      x.fillStyle = g;
      if (fh > 1) { rr(x, bx + this.lw, by + bh - this.lw - fh, bw - this.lw * 2, fh, bw / 2); x.fill(); }
      x.font = `800 ${Math.round(H * 0.024)}px "Noto Sans", sans-serif`; x.textAlign = 'center';
      x.lineJoin = 'round'; x.lineWidth = this.lw * 1.5; x.strokeText('ΔΥΝΑΜΗ', bx + bw / 2, by - H * 0.018);
      x.fillStyle = '#fff'; x.fillText('ΔΥΝΑΜΗ', bx + bw / 2, by - H * 0.018);
    }

    drawBall() {
      const x = this.ctx, b = this.ball;
      // ίχνος
      this.trail.forEach((t, i) => {
        const q = this.proj(t.x, t.y, t.z);
        x.fillStyle = `rgba(255,255,255,${(i / this.trail.length) * 0.35})`;
        x.beginPath(); x.arc(q.x, q.y, BALL_R * q.s * (0.3 + 0.6 * (i / this.trail.length)), 0, 7); x.fill();
      });
      const bob = this.state === 'aiming' ? Math.abs(Math.sin(this.time * 3)) * 0.12 : 0;
      const p = this.proj(b.x, b.y + bob, b.z), r = Math.max(4, BALL_R * p.s);
      x.fillStyle = '#ffffff'; x.strokeStyle = INK; x.lineWidth = this.lw * 1.3;
      x.beginPath(); x.arc(p.x, p.y, r, 0, 7); x.fill();
      x.fillStyle = '#d9dbe3';
      x.beginPath(); x.arc(p.x, p.y, r, -0.2, Math.PI * 0.95); x.arc(p.x - r * 0.18, p.y - r * 0.2, r * 0.9, Math.PI * 0.95, -0.2, true); x.fill();
      x.beginPath(); x.arc(p.x, p.y, r, 0, 7); x.stroke();
    }

    drawCup(cx, cz, color, k, alpha) {
      const x = this.ctx, lw = this.lw;
      const Hh = CUP_H * k, R = CUP_R * k, RB = CUP_RB * k;
      const top = this.ell(cx, Hh, cz, R), bot = this.ell(cx, 0, cz, RB);
      x.save(); x.globalAlpha = alpha;
      // σώμα
      x.beginPath(); x.moveTo(top.x - top.rx, top.y); x.lineTo(bot.x - bot.rx, bot.y);
      x.ellipse(bot.x, bot.y, bot.rx, bot.ry, 0, Math.PI, 0, true); x.lineTo(top.x + top.rx, top.y); x.closePath();
      x.fillStyle = color; x.fill();
      x.save(); x.clip();
      x.fillStyle = shade(color, -0.2); x.fillRect(top.x + top.rx * 0.38, top.y - top.ry, top.rx * 2, (bot.y - top.y) + bot.ry * 2 + top.ry);
      x.fillStyle = 'rgba(255,255,255,.28)'; x.fillRect(top.x - top.rx * 0.62, top.y, top.rx * 0.16, bot.y - top.y + bot.ry);
      x.restore();
      x.lineWidth = lw * 1.3; x.strokeStyle = INK; x.lineJoin = 'round'; x.stroke();
      // στόμιο: περίγραμμα → λευκό χείλος → εσωτερικό
      x.fillStyle = INK;
      x.beginPath(); x.ellipse(top.x, top.y, top.rx + lw * 0.6, top.ry + lw * 0.6, 0, 0, 7); x.fill();
      x.fillStyle = '#ffffff';
      x.beginPath(); x.ellipse(top.x, top.y, top.rx - lw * 0.4, top.ry - lw * 0.4, 0, 0, 7); x.fill();
      const ig = x.createLinearGradient(0, top.y - top.ry, 0, top.y + top.ry);
      ig.addColorStop(0, '#8d8f99'); ig.addColorStop(0.75, '#f3f3f6');
      x.fillStyle = ig;
      x.beginPath(); x.ellipse(top.x, top.y + lw * 0.3, Math.max(1, top.rx - lw * 1.8), Math.max(1, top.ry - lw * 1.6), 0, 0, 7); x.fill();
      x.restore();
    }

    drawPop(f) {
      const t = f.t / 0.7;
      const x = this.ctx;
      this.drawCup(f.x, f.z, f.color, 1 + t * 0.6, Math.max(0, 1 - t * 1.7));
      const e = this.ell(f.x, CUP_H, f.z, CUP_R * (1 + t * 2.2));
      x.strokeStyle = `rgba(255,255,255,${1 - t})`; x.lineWidth = this.lw * (3 * (1 - t) + 0.5);
      x.beginPath(); x.ellipse(e.x, e.y, e.rx, e.ry, 0, 0, 7); x.stroke();
    }
  }

  window.CupsGame = CupsGame;
})();
