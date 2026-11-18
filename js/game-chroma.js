// «Χρωμοφύλλα»: παιχνίδι με χρωματιστά φύλλα (ξεφορτώσου πρώτος τα φύλλα σου).
// Η τηλεόραση είναι το τραπέζι· κάθε κινητό δείχνει τα φύλλα του παίκτη (ίδια λογική με την Ξερή).
// Ρίχνεις φύλλο με ίδιο χρώμα ή ίδιο νούμερο/σύμβολο με το πάνω φύλλο, ή ένα «Ουράνιο τόξο».
// Αν δεν έχεις, τραβάς ένα· αν κάνει, το παίζεις, αλλιώς «ΠΑΣΟ».
// Ειδικά φύλλα: ⊘ χάνει σειρά ο επόμενος, ⇄ αλλάζει φορά, +2 / +4 τραβάει ο επόμενος και χάνει σειρά,
// Ουράνιο τόξο: διαλέγεις χρώμα. Όταν σου μένει ένα φύλλο πάτα «ΤΕΛΕΥΤΑΙΟ!», αλλιώς τραβάς 2.
(function () {
  'use strict';
  const { Base, U } = Mini;

  const COLS = ['R', 'Y', 'G', 'B'];
  const CHEX = { R: '#ec3b43', Y: '#ffc21a', G: '#22b35e', B: '#2d7ff0' };
  const CNAME = { R: 'Κόκκινο', Y: 'Κίτρινο', G: 'Πράσινο', B: 'Μπλε' };
  const VALS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'S', 'V', 'D'];
  const HAND = 7;
  const TURN_SEC = 60;
  const LAST_SEC = 3.2; // χρόνος για να πεις «ΤΕΛΕΥΤΑΙΟ!» αφού σου μείνει ένα φύλλο
  const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };

  // κωδικός φύλλου: «R5.17» (χρώμα + αξία + μοναδικός αριθμός) · «W.3» ουράνιο τόξο · «F.7» +4
  const base = (c) => String(c).split('.')[0];
  const colOf = (c) => { const b = base(c); return COLS.includes(b[0]) ? b[0] : null; };
  const valOf = (c) => { const b = base(c); return COLS.includes(b[0]) ? b.slice(1) : b; };
  const isWild = (c) => !colOf(c);
  const pts = (c) => { const v = valOf(c); return isWild(c) ? 50 : /\d/.test(v) ? +v : 20; };

  class ChromaGame extends Base {
    constructor(c, h) { super(c, h); this.WIN = 0; }

    setup() {
      let k = 0;
      this.deck = [];
      for (const col of COLS) for (const v of VALS) for (let i = 0; i < (v === '0' ? 1 : 2); i++) this.deck.push(`${col}${v}.${k++}`);
      for (let i = 0; i < 4; i++) { this.deck.push(`W.${k++}`); this.deck.push(`F.${k++}`); }
      shuffle(this.deck);
      this.parts.forEach((p) => { p.hand = []; p.score = 0; p.status = ''; p.called = false; p.lastAt = 0; p.drawn = 0; p.played = 0; });
      this.pile = []; this.color = null; this.dir = 1;
      this.cur = (Math.random() * this.parts.length) | 0;
      this.flying = []; this.pop = null; this.tid = 0; this.phase = 'deal'; this.drew = null;
      this.dirSpin = 0; this.colT = -9;
      this.deal();
    }

    mk(c, col) { return { c, col, rot: U.rand(-0.3, 0.3), dx: U.rand(-1.4, 1.4), dy: U.rand(-1.2, 1.2) }; }
    top() { return this.pile.length ? this.pile[this.pile.length - 1].c : null; }
    sortHand(p) {
      const o = (c) => (isWild(c) ? 4 + (valOf(c) === 'F' ? 1 : 0) : COLS.indexOf(colOf(c))) * 20 + VALS.indexOf(valOf(c));
      p.hand.sort((a, b) => o(a) - o(b));
    }
    ok(c) {
      if (!c) return false;
      if (isWild(c)) return true;
      const t = this.top();
      return colOf(c) === this.color || (!!t && !isWild(t) && valOf(c) === valOf(t));
    }

    // ---------- μοίρασμα ----------
    deal() {
      const n = this.parts.length;
      this.banner('Μοιράζω!', '#fff');
      this.sfx('blip');
      let k = 0;
      for (let j = 0; j < HAND; j++) for (let i = 0; i < n; i++) {
        const p = this.parts[(this.cur + i) % n];
        this.flyTo(p, this.deck.pop(), k++ * 0.06);
      }
      this.changed();
      this.after(k * 0.06 + 0.6, () => {
        if (!this.running) return;
        // πρώτο φύλλο στο τραπέζι: πάντα αριθμός
        const i = this.deck.findIndex((c) => /\d/.test(valOf(c)));
        const c = this.deck.splice(i, 1)[0], e = this.mk(c, colOf(c)), d = this.deckPos(), pc = this.pilePos();
        this.sfx('throw');
        this.fly({ c, face: true, x0: d.x, y0: d.y, x1: pc.x, y1: pc.y, dur: 0.5, s0: 0.9, s1: 1, r1: e.rot,
          done: () => { this.pile.push(e); this.setColor(e.col); this.changed(); this.after(0.6, () => this.running && this.startTurn()); } });
      });
    }

    flyTo(p, c, delay = 0, cb) {
      if (!c) return;
      const d = this.deckPos(), s = this.seatPos(p);
      this.fly({ c, face: false, x0: d.x, y0: d.y, x1: s.x + this.vh * 6, y1: s.y - this.vh * 3, delay, dur: 0.34, s0: 0.9, s1: 0.32,
        done: () => { p.hand.push(c); this.sortHand(p); this.changed(); cb && cb(); } });
    }

    // τραβάει ένα φύλλο από την τράπουλα (ανακατεύει το τραπέζι αν τελείωσε)
    pull() {
      if (!this.deck.length && this.pile.length > 1) {
        const keep = this.pile.pop();
        this.deck = shuffle(this.pile.map((e) => e.c));
        this.pile = [keep];
        this.banner('Ανακάτεμα! 🔀', '#fff');
        this.sfx('pump');
      }
      return this.deck.pop() || null;
    }

    give(p, k, cb) {
      let got = 0;
      for (let i = 0; i < k; i++) {
        const c = this.pull();
        if (!c) break;
        got++; p.drawn++;
        this.flyTo(p, c, i * 0.14);
      }
      p.called = false;
      this.changed();
      this.after(got * 0.14 + 0.45, () => cb && cb());
      return got;
    }

    setColor(col) { if (col !== this.color) this.colT = this.time; this.color = col; }

    startTurn() {
      const p = this.parts[this.cur];
      this.phase = 'turn'; this.tid++; this.turnT = this.time; this.drew = null;
      this.fx(p, 'Σειρά σου! 🎴', [40, 30, 40]);
      this.changed();
      this.armTimer();
    }

    armTimer() {
      const p = this.parts[this.cur], id = this.tid, gone = !p.bot && !(p.p && p.p.connected);
      if (p.bot || gone) this.after(p.bot ? U.rand(1.1, 2) : 1.2, () => this.tid === id && this.auto(p));
      else this.after(TURN_SEC, () => this.tid === id && this.auto(p));
    }

    // ---------- ρομπότ (και αυτόματο παίξιμο όταν κάποιος αργεί ή φύγει) ----------
    bestColor(p, skip) {
      const cnt = { R: 0, Y: 0, G: 0, B: 0 };
      p.hand.forEach((c) => { if (c !== skip && colOf(c)) cnt[colOf(c)] += 1 + (/\d/.test(valOf(c)) ? 0 : 0.5); });
      const m = Math.max(...Object.values(cnt));
      return m ? U.pick(COLS.filter((k) => cnt[k] === m)) : U.pick(COLS);
    }
    botPick(p) {
      const can = this.drew ? [this.drew].filter((c) => this.ok(c)) : p.hand.filter((c) => this.ok(c));
      if (!can.length) return null;
      const nx = this.parts[this.nextIdx(1)];
      const danger = nx && nx !== p && nx.hand.length <= 2;
      const score = (c) => {
        const v = valOf(c);
        let s = 0;
        if (isWild(c)) s = v === 'F' ? (danger ? 90 : -40) : -30;
        else if (v === 'D' || v === 'S') s = danger ? 80 : 10;
        else if (v === 'V') s = danger ? 60 : 8;
        else s = +v;
        if (colOf(c) === this.color) s += 3;
        return s + Math.random() * 2;
      };
      return can.sort((a, b) => score(b) - score(a))[0];
    }
    auto(p) {
      if (this.phase !== 'turn' || this.parts[this.cur] !== p) return;
      const c = this.botPick(p);
      if (c) {
        if (p.hand.length === 2 && (p.bot ? Math.random() < 0.82 : true)) p.called = true;
        return this.play(p, c, isWild(c) ? this.bestColor(p, c) : null);
      }
      if (this.drew) return this.pass(p);
      this.pick(p);
    }

    input(part, msg) {
      if (!part || msg.type !== 'card') return;
      if (msg.act === 'last') return this.callLast(part);
      if (this.phase !== 'turn' || this.parts[this.cur] !== part) return;
      if (msg.act === 'draw') return this.pick(part);
      if (msg.act === 'pass') return this.pass(part);
      const c = String(msg.c || '');
      if (!part.hand.includes(c) || !this.ok(c) || (this.drew && c !== this.drew)) return;
      if (msg.last && part.hand.length === 2) part.called = true;
      const col = COLS.includes(msg.col) ? msg.col : this.bestColor(part, c);
      this.play(part, c, isWild(c) ? col : null);
    }

    callLast(p) {
      if (p.called || p.hand.length > 2 || !p.hand.length) return;
      if (p.hand.length === 2 && !(this.parts[this.cur] === p && this.phase === 'turn')) return;
      p.called = true;
      this.sfx('star');
      this.pop = { text: 'ΤΕΛΕΥΤΑΙΟ! ☝', color: p.color.hex, t0: this.time, small: true };
      this.fx(p, 'Το είπες! ☝', [30]);
      p.status = '☝ τελευταίο!';
      this.changed();
    }

    // «ΤΡΑΒΑ»: παίρνει ένα φύλλο από την τράπουλα
    pick(p) {
      if (this.drew || this.phase !== 'turn') return;
      this.phase = 'anim'; this.tid++;
      const c = this.pull();
      if (!c) { this.phase = 'turn'; return this.pass(p, true); }
      p.drawn++; p.called = false;
      this.sfx('tick');
      p.status = 'τράβηξε';
      this.flyTo(p, c, 0, () => {
        if (!this.running) return;
        if (this.ok(c)) {
          this.phase = 'turn'; this.drew = c; this.tid++;
          this.fx(p, 'Το φύλλο κάνει! Παίξ\' το ή πάτα «ΠΑΣΟ»', [30, 30, 30]);
          this.changed();
          const id = this.tid, gone = !p.bot && !(p.p && p.p.connected);
          this.after(p.bot || gone ? U.rand(0.7, 1.2) : 25, () => this.tid === id && this.auto(p));
        } else this.after(0.35, () => { p.status = 'πάσο'; this.next(0); });
      });
    }

    pass(p, force) {
      if (!force && (!this.drew || this.phase !== 'turn')) return;
      this.tid++; this.phase = 'anim';
      p.status = 'πάσο';
      this.sfx('blip');
      this.after(0.3, () => this.next(0));
    }

    play(p, c, col) {
      if (this.phase !== 'turn' || !c || !p.hand.includes(c)) return;
      this.phase = 'anim'; this.tid++; this.drew = null;
      p.hand.splice(p.hand.indexOf(c), 1);
      p.played++;
      const s = this.seatPos(p), e = this.mk(c, col || colOf(c)), pc = this.pilePos();
      p.status = '';
      this.sfx('throw');
      this.changed();
      this.fly({ c, col: e.col, face: true, x0: s.x, y0: s.y - this.vh * 4, x1: pc.x + e.dx * this.vh, y1: pc.y + e.dy * this.vh, dur: 0.42, s0: 0.4, s1: 1, r1: e.rot,
        done: () => this.land(p, e) });
    }

    land(p, e) {
      this.pile.push(e);
      this.setColor(e.col);
      const v = valOf(e.c), n = this.parts.length;
      if (!p.hand.length) return this.win(p);
      if (p.hand.length === 1) this.lastCheck(p);
      let skip = 0, nx = this.parts[this.nextIdx(1)];
      if (isWild(e.c)) {
        this.sfx(v === 'F' ? 'boom' : 'pwr');
        this.pop = { text: v === 'F' ? `+4! 😱` : `${CNAME[e.col]}! 🌈`, color: CHEX[e.col], t0: this.time };
      }
      if (v === 'S') { skip = 1; this.sfx('buzz'); this.pop = { text: `${nx.name}: χάνεις σειρά! 🚫`, color: nx.color.hex, t0: this.time, small: true }; this.fx(nx, 'Χάνεις τη σειρά σου! 🚫', [80]); }
      if (v === 'V') {
        this.dir *= -1; this.dirSpin = this.time; this.sfx('zap');
        if (n === 2) { skip = 1; this.fx(nx, 'Ανάποδα: χάνεις σειρά! 🔄', [80]); }
        this.pop = { text: 'ΑΝΑΠΟΔΑ! 🔄', color: '#fff', t0: this.time };
        nx = this.parts[this.nextIdx(1)];
      }
      if (v === 'D' || v === 'F') {
        const k = v === 'D' ? 2 : 4;
        skip = 1;
        if (v === 'D') { this.sfx('hurt'); this.pop = { text: `${nx.name}: +2! 🤭`, color: nx.color.hex, t0: this.time }; }
        this.fx(nx, `Τραβάς ${k} φύλλα! 😱`, [100, 50, 100], true);
        nx.status = `+${k} 😵`;
        this.changed();
        return this.after(0.7, () => this.give(nx, k, () => this.next(skip)));
      }
      this.changed();
      this.after(isWild(e.c) ? 0.9 : 0.45, () => this.next(skip));
    }

    // όταν μένει ένα φύλλο: αν δεν το είπες σε LAST_SEC, τραβάς 2
    lastCheck(p) {
      if (p.called) { this.callFx(p); return; }
      p.lastAt = this.time;
      this.changed();
      if (p.bot && Math.random() < 0.6) this.after(U.rand(0.6, 2.2), () => this.callLast(p));
      this.after(LAST_SEC, () => {
        if (!this.running || p.called || p.hand.length !== 1 || this.phase === 'score') return;
        p.lastAt = 0;
        this.sfx('hurt');
        this.pop = { text: `${p.name}: ξέχασες! +2 🤭`, color: p.color.hex, t0: this.time, small: true };
        this.fx(p, 'Ξέχασες να πεις «ΤΕΛΕΥΤΑΙΟ!»: +2 φύλλα 🤭', [100, 50, 100], true);
        p.status = 'ξέχασε! +2';
        this.give(p, 2);
      });
    }
    callFx(p) {
      this.sfx('star');
      this.pop = { text: 'ΤΕΛΕΥΤΑΙΟ! ☝', color: p.color.hex, t0: this.time, small: true };
      p.status = '☝ τελευταίο!';
    }

    nextIdx(step) {
      const n = this.parts.length;
      return (((this.cur + this.dir * step) % n) + n) % n;
    }

    next(skip) {
      if (!this.running || this.phase === 'score') return;
      this.cur = this.nextIdx(1 + (skip || 0));
      const p = this.parts[this.cur];
      if (p.status === 'πάσο' || p.status === 'τράβηξε') p.status = '';
      this.parts.forEach((q) => { if (q !== p && (q.status === 'πάσο' || q.status === 'τράβηξε')) q.status = ''; });
      this.startTurn();
    }

    // ---------- τέλος ----------
    win(p) {
      this.phase = 'score'; this.tid++;
      this.sfx('finish');
      this.pop = { text: `${p.name}: ΤΕΛΕΙΩΣΕ! 🎉`, color: p.color.hex, t0: this.time };
      for (const q of this.parts) { q.left = q.hand.reduce((s, c) => s + pts(c), 0); q.status = ''; }
      p.score = this.parts.reduce((s, q) => s + q.left, 0);
      this.winner = p;
      this.scoreT = this.time + 2;
      this.changed();
      this.after(2.2, () => this.sfx('point'));
      this.after(10, () => { if (this.running) { this.over = true; this.finish(p); } });
    }

    finish(w) {
      this.celebrate(w.color.hex);
      this.sfx('win');
      const rank = [w, ...this.parts.filter((q) => q !== w).sort((a, b) => a.left - b.left || a.hand.length - b.hand.length)];
      this.h.onOver && this.h.onOver({
        winner: w,
        stats: `Ξεφορτώθηκε πρώτος τα φύλλα · ${w.score} πόντοι από τα φύλλα των άλλων`,
        rank: rank.map((q) => ({ name: q.name, color: q.color, st: q === w ? `${q.score} πόντοι` : `έμειναν ${q.hand.length} φύλλα (${q.left})` })),
        icon: '🎴',
      });
    }

    // ---------- χειριστήριο ----------
    ctrl(part) {
      const cur = this.parts[this.cur];
      const mine = this.phase === 'turn' && cur === part;
      const lastOn = !part.called && part.hand.length && this.phase !== 'score' &&
        ((part.hand.length === 2 && mine && part.hand.some((c) => this.ok(c))) || (part.hand.length === 1 && part.lastAt));
      const b = {
        mode: 'cards', kind: 'chroma', hand: part.hand.slice(), top: this.top(), col: this.color, dir: this.dir,
        pileN: this.pile.length, deckN: this.deck.length, drew: mine ? this.drew : null, last: !!lastOn, called: !!part.called,
        turn: cur ? { name: cur.name, color: cur.color.hex } : null, tid: this.tid,
        scoreText: `${part.hand.length} ${part.hand.length === 1 ? 'φύλλο' : 'φύλλα'}`,
      };
      if (this.phase === 'score') {
        const w = this.winner;
        return { ...b, active: false, label: w === part ? 'Κέρδισες! 🎉' : `Κέρδισε: ${w.name}`, sub: 'Κοίτα τη βαθμολογία στην τηλεόραση' };
      }
      if (this.phase === 'deal') return { ...b, active: false, label: 'Μοιράζω…', sub: '' };
      if (mine && this.drew) return { ...b, active: true, label: 'Το φύλλο κάνει!', sub: 'Παίξ\' το ή πάτα «ΠΑΣΟ»' };
      if (mine) {
        const any = part.hand.some((c) => this.ok(c));
        return { ...b, active: true, label: 'Σειρά σου!', sub: any ? `Ρίξε ${CNAME[this.color]} ή ίδιο σύμβολο · ή «ΤΡΑΒΑ»` : 'Δεν έχεις φύλλο που κάνει: πάτα «ΤΡΑΒΑ»' };
      }
      if (cur === part) return { ...b, active: false, label: 'Έπαιξες!', sub: '' };
      return { ...b, active: false, label: cur ? `Παίζει: ${cur.name}` : '', sub: `Χρώμα τώρα: ${CNAME[this.color] || '—'}` };
    }

    // ---------- κινήσεις ----------
    fly(o) { this.flying.push({ delay: 0, dur: 0.4, s0: 1, s1: 1, r0: 0, r1: 0, ...o, t0: this.time + (o.delay || 0) }); }
    update() {
      for (const f of this.flying) if (!f.fin && this.time >= f.t0 + f.dur) { f.fin = true; f.done && f.done(); }
      this.flying = this.flying.filter((f) => !f.fin);
    }

    // ---------- θέσεις ----------
    ch() { return this.vh * 25; }
    pilePos() { return { x: this.W * 0.5, y: this.H * 0.43 }; }
    deckPos() { return { x: this.W * 0.2, y: this.H * 0.43 }; }
    seatGeom() {
      const n = this.parts.length, vh = this.vh;
      const w = Math.min(this.W * 0.215, vh * 42), h = vh * 17, gap = vh * 2;
      return { n, w, h, gap, x0: (this.W - (n * w + (n - 1) * gap)) / 2, y: this.H - h - vh * 2.2 };
    }
    seatPos(p) {
      const g = this.seatGeom(), i = this.parts.indexOf(p);
      return { x: g.x0 + i * (g.w + g.gap) + g.w / 2, y: g.y + g.h / 2 };
    }

    // ---------- σχεδίαση φύλλου ----------
    rainbow(x, cx, cy, r, rot = 0) {
      COLS.forEach((k, i) => {
        x.beginPath(); x.moveTo(cx, cy); x.arc(cx, cy, r, rot + i * Math.PI / 2, rot + (i + 1) * Math.PI / 2); x.closePath();
        x.fillStyle = CHEX[k]; x.fill();
      });
    }
    sym(x, v, cx, cy, s, col) {
      // s = μέγεθος· col = χρώμα γεμίσματος
      x.save(); x.translate(cx, cy);
      x.fillStyle = col; x.strokeStyle = col; x.lineCap = 'round'; x.lineJoin = 'round';
      if (v === 'S') {
        x.lineWidth = s * 0.17;
        x.beginPath(); x.arc(0, 0, s * 0.36, 0, 7); x.stroke();
        x.beginPath(); x.moveTo(-s * 0.25, s * 0.25); x.lineTo(s * 0.25, -s * 0.25); x.stroke();
      } else if (v === 'V') {
        x.lineWidth = s * 0.15;
        for (const k of [1, -1]) {
          x.save(); x.scale(k, k);
          x.beginPath(); x.arc(0, 0, s * 0.3, Math.PI * 1.05, Math.PI * 1.75); x.stroke();
          const a = Math.PI * 1.75, ex = Math.cos(a) * s * 0.3, ey = Math.sin(a) * s * 0.3;
          x.beginPath(); x.moveTo(ex + s * 0.18, ey + s * 0.02); x.lineTo(ex - s * 0.06, ey - s * 0.16); x.lineTo(ex - s * 0.02, ey + s * 0.16); x.closePath(); x.fill();
          x.restore();
        }
      } else {
        const t = v === 'D' ? '+2' : v === 'F' ? '+4' : v;
        x.font = this.font(s * (t.length > 1 ? 0.62 : 0.78), 900);
        x.textAlign = 'center'; x.textBaseline = 'middle';
        x.lineWidth = s * 0.1; x.strokeStyle = '#1c1a2b'; x.strokeText(t, 0, s * 0.04);
        x.fillText(t, 0, s * 0.04);
        if (v === '6' || v === '9') x.fillRect(-s * 0.17, s * 0.36, s * 0.34, s * 0.06);
      }
      x.restore();
    }
    drawCard(c, cx, cy, h, rot = 0, face = true, chosen) {
      const x = this.ctx, w = h * 0.7;
      x.save(); x.translate(cx, cy); x.rotate(rot);
      x.shadowColor = 'rgba(0,0,0,.4)'; x.shadowBlur = h * 0.07; x.shadowOffsetY = h * 0.035;
      U.rr(x, -w / 2, -h / 2, w, h, h * 0.09);
      x.fillStyle = '#fff'; x.fill();
      x.shadowColor = 'transparent';
      const iw = w - h * 0.07, ih = h * 0.93;
      if (!face) {
        U.rr(x, -iw / 2, -ih / 2, iw, ih, h * 0.07);
        const g = x.createLinearGradient(0, -ih / 2, 0, ih / 2);
        g.addColorStop(0, '#3b2a7a'); g.addColorStop(1, '#1d1442');
        x.fillStyle = g; x.fill();
        // τέσσερις χρωματιστές βούλες σε ρόμβο και ένα αστεράκι
        const r = w * 0.13;
        [[0, -h * 0.17, 'R'], [w * 0.22, 0, 'Y'], [0, h * 0.17, 'G'], [-w * 0.22, 0, 'B']].forEach(([dx, dy, k]) => {
          x.beginPath(); x.arc(dx, dy, r, 0, 7); x.fillStyle = CHEX[k]; x.fill();
          x.beginPath(); x.arc(dx - r * 0.3, dy - r * 0.35, r * 0.3, 0, 7); x.fillStyle = 'rgba(255,255,255,.55)'; x.fill();
        });
        U.starPath(x, 0, 0, w * 0.1); x.fillStyle = '#fff'; x.fill();
        x.restore(); return;
      }
      const col = colOf(c), v = valOf(c), wild = !col;
      U.rr(x, -iw / 2, -ih / 2, iw, ih, h * 0.07);
      if (wild) { x.fillStyle = '#1c1a2b'; x.fill(); }
      else {
        const g = x.createLinearGradient(-iw / 2, -ih / 2, iw / 2, ih / 2);
        g.addColorStop(0, U.shade(CHEX[col], 0.18)); g.addColorStop(1, U.shade(CHEX[col], -0.18));
        x.fillStyle = g; x.fill();
      }
      // βούλες-σχέδιο στο φόντο
      x.save(); x.clip(); x.fillStyle = 'rgba(255,255,255,.1)';
      for (let i = 0; i < 4; i++) for (let j = 0; j < 6; j++) { x.beginPath(); x.arc(-iw / 2 + (i + (j % 2) * 0.5) * iw / 3.2, -ih / 2 + j * ih / 5, h * 0.025, 0, 7); x.fill(); }
      x.restore();
      // κεντρική φούσκα
      const R = w * 0.36;
      if (wild) {
        this.rainbow(x, 0, 0, R, -Math.PI / 4);
        if (chosen) { x.beginPath(); x.arc(0, 0, R * 1.12, 0, 7); x.lineWidth = h * 0.03; x.strokeStyle = CHEX[chosen]; x.stroke(); }
      } else {
        x.beginPath(); x.arc(0, 0, R, 0, 7); x.fillStyle = '#fff'; x.fill();
      }
      x.beginPath(); x.ellipse(-R * 0.35, -R * 0.45, R * 0.4, R * 0.2, -0.5, 0, 7); x.fillStyle = 'rgba(255,255,255,.4)'; x.fill();
      if (wild) { if (v === 'F') this.sym(x, 'F', 0, 0, R * 1.3, '#fff'); }
      else this.sym(x, v, 0, 0, R * 1.6, CHEX[col]);
      // γωνίες
      const cv = wild ? (v === 'F' ? 'F' : null) : v;
      for (const k of [1, -1]) {
        x.save(); x.scale(k, k);
        if (cv) this.sym(x, cv, -w / 2 + h * 0.1, -h / 2 + h * 0.11, h * 0.15, '#fff');
        else this.rainbow(x, -w / 2 + h * 0.1, -h / 2 + h * 0.11, h * 0.05);
        x.restore();
      }
      x.restore();
    }

    draw() {
      const x = this.ctx, W = this.W, H = this.H, vh = this.vh;
      // τραπέζι: μωβ τσόχα με χρωματιστή λάμψη του τρέχοντος χρώματος
      const g = x.createRadialGradient(W / 2, H * 0.42, vh * 5, W / 2, H * 0.45, W * 0.65);
      g.addColorStop(0, '#4a2f8f'); g.addColorStop(0.6, '#2d1b63'); g.addColorStop(1, '#160c38');
      x.fillStyle = g; x.fillRect(0, 0, W, H);
      x.save(); x.globalAlpha = 0.07;
      for (let i = 0; i < 60; i++) { x.fillStyle = CHEX[COLS[i % 4]]; x.beginPath(); x.arc((i * 137.3) % W, (i * 71.7) % H, vh * (0.4 + (i % 3) * 0.3), 0, 7); x.fill(); }
      x.restore();
      x.lineWidth = vh * 1.6; x.strokeStyle = '#120a2e'; x.strokeRect(vh * 0.8, vh * 0.8, W - vh * 1.6, H - vh * 1.6);
      x.lineWidth = vh * 0.3; x.strokeStyle = 'rgba(255,255,255,.18)'; x.strokeRect(vh * 1.8, vh * 1.8, W - vh * 3.6, H - vh * 3.6);

      // τίτλος
      const tt = 'Χρωμοφύλλα';
      x.font = this.font(vh * 5, 700, 'Comfortaa');
      let tx = W * 0.05;
      [...tt].forEach((ch, i) => {
        const cw = x.measureText(ch).width;
        this.text(ch, tx + cw / 2, vh * 15 + Math.sin(this.time * 3 + i * 0.6) * vh * 0.4, vh * 5, CHEX[COLS[i % 4]], { fam: 'Comfortaa', w: 700 });
        tx += cw;
      });
      this.text('ξεφορτώσου πρώτος τα φύλλα!', W * 0.05, vh * 20.5, vh * 2.4, '#d9ccff', { align: 'left', stroke: false, w: 700 });

      const cur = this.parts[this.cur];
      if (cur && (this.phase === 'turn' || this.phase === 'anim')) {
        const t = `Σειρά: ${cur.name}`;
        x.font = this.font(vh * 3.2, 800);
        const tw = x.measureText(t).width + vh * 5;
        U.rr(x, W / 2 - tw / 2, vh * 4.5, tw, vh * 7, vh * 3.5);
        x.fillStyle = 'rgba(0,0,0,.35)'; x.fill(); x.lineWidth = vh * 0.4; x.strokeStyle = cur.color.hex; x.stroke();
        this.text(t, W / 2, vh * 8, vh * 3.2, cur.color.hex, { sw: vh * 0.5 });
        if (this.phase === 'turn' && !cur.bot) {
          const left = (this.drew ? 25 : TURN_SEC) - (this.time - this.turnT);
          if (left < 15 && left > 0) this.text(`${Math.ceil(left)}″`, W / 2 + tw / 2 + vh * 4, vh * 8, vh * 3, '#ffc93d');
        }
      }

      // τράπουλα
      const d = this.deckPos(), CH = this.ch(), dn = this.deck.length;
      for (let i = Math.min(6, Math.ceil(dn / 12)) - 1; i >= 0; i--) this.drawCard('', d.x - i * vh * 0.35, d.y - i * vh * 0.35, CH * 0.9, 0, false);
      this.text(dn ? `${dn} φύλλα` : 'τελείωσε', d.x, d.y + CH * 0.6, vh * 2.4, '#e6dcff', { stroke: false, w: 700 });
      const me = cur && this.phase === 'turn' && !this.drew && !cur.bot;
      if (me) this.text('«ΤΡΑΒΑ» από εδώ', d.x, d.y - CH * 0.62, vh * 2.2, 'rgba(255,255,255,.6)', { stroke: false, w: 700 });

      // τρέχον χρώμα: λάμψη και δαχτυλίδι γύρω από τη στοίβα
      const pc = this.pilePos();
      if (this.color) {
        const k = Math.min(1, (this.time - this.colT) / 0.5), hex = CHEX[this.color];
        const rg = x.createRadialGradient(pc.x, pc.y, CH * 0.3, pc.x, pc.y, CH * (0.95 + 0.05 * Math.sin(this.time * 3)));
        rg.addColorStop(0, U.rgba(hex, 0.55 * k)); rg.addColorStop(1, U.rgba(hex, 0));
        x.fillStyle = rg; x.beginPath(); x.arc(pc.x, pc.y, CH, 0, 7); x.fill();
        // βελάκια φοράς που γυρίζουν
        const sp = this.time * 0.6 * this.dir + Math.max(0, 1 - (this.time - this.dirSpin)) * 6 * this.dir, R = CH * 0.78;
        x.save(); x.translate(pc.x, pc.y); x.strokeStyle = U.rgba('#ffffff', 0.55); x.fillStyle = U.rgba('#ffffff', 0.55); x.lineWidth = vh * 0.6; x.lineCap = 'round';
        for (let i = 0; i < 3; i++) {
          const a0 = sp + i * Math.PI * 2 / 3, a1 = a0 + 1.2;
          x.beginPath(); x.arc(0, 0, R, a0, a1); x.stroke();
          const hx = this.dir > 0 ? a1 : a0, px = Math.cos(hx) * R, py = Math.sin(hx) * R;
          const ux = -Math.sin(hx) * this.dir, uy = Math.cos(hx) * this.dir;
          x.beginPath(); x.moveTo(px + ux * vh * 1.6, py + uy * vh * 1.6);
          x.lineTo(px - ux * vh * 0.4 + Math.cos(hx) * vh * 1.2, py - uy * vh * 0.4 + Math.sin(hx) * vh * 1.2);
          x.lineTo(px - ux * vh * 0.4 - Math.cos(hx) * vh * 1.2, py - uy * vh * 0.4 - Math.sin(hx) * vh * 1.2); x.closePath(); x.fill();
        }
        x.restore();
      }
      const pl = this.pile, from = Math.max(0, pl.length - 9);
      for (let i = from; i < pl.length; i++) {
        const e = pl[i];
        this.drawCard(e.c, pc.x + e.dx * vh, pc.y + e.dy * vh, CH, e.rot, true, isWild(e.c) ? e.col : null);
      }
      if (this.color) {
        const t = `Χρώμα: ${CNAME[this.color]}`;
        x.font = this.font(vh * 2.8, 800);
        const tw = x.measureText(t).width + vh * 4;
        U.rr(x, pc.x - tw / 2, pc.y + CH * 0.6, tw, vh * 5, vh * 2.5);
        x.fillStyle = CHEX[this.color]; x.fill(); x.lineWidth = vh * 0.35; x.strokeStyle = '#fff'; x.stroke();
        this.text(t, pc.x, pc.y + CH * 0.6 + vh * 2.5, vh * 2.8, '#fff', { sw: vh * 0.5 });
      }

      // οδηγίες
      const ix = W * 0.8;
      U.rr(x, ix - vh * 19, H * 0.43 - vh * 16, vh * 38, vh * 32, vh * 2.5);
      x.fillStyle = 'rgba(0,0,0,.28)'; x.fill();
      this.text('Τι ρίχνεις', ix, H * 0.43 - vh * 12, vh * 2.6, '#ffe27a', { stroke: false, w: 800 });
      this.text('ίδιο χρώμα ή ίδιο σύμβολο', ix, H * 0.43 - vh * 8, vh * 2.1, '#fff', { stroke: false, w: 600 });
      const rows = [['S', '#ec3b43', 'χάνει σειρά ο επόμενος'], ['V', '#22b35e', 'αλλάζει η φορά'], ['D', '#2d7ff0', 'ο επόμενος τραβάει 2'],
        ['W', null, 'διαλέγεις χρώμα'], ['F', null, '+4 και διαλέγεις χρώμα']];
      rows.forEach(([v, c, t], i) => {
        const y = H * 0.43 - vh * 3 + i * vh * 4.3, sx = ix - vh * 15;
        x.beginPath(); x.arc(sx, y, vh * 1.7, 0, 7);
        if (c) { x.fillStyle = c; x.fill(); this.sym(x, v, sx, y, vh * 2.4, '#fff'); }
        else { this.rainbow(x, sx, y, vh * 1.7, -Math.PI / 4); if (v === 'F') this.sym(x, 'F', sx, y, vh * 2.2, '#fff'); }
        this.text(t, sx + vh * 3, y, vh * 1.95, '#e6dcff', { stroke: false, w: 600, align: 'left' });
      });

      this.drawSeats();

      for (const f of this.flying) {
        if (this.time < f.t0) continue;
        const k = Math.min(1, (this.time - f.t0) / f.dur), e = 1 - Math.pow(1 - k, 3);
        const fx = f.x0 + (f.x1 - f.x0) * e, fy = f.y0 + (f.y1 - f.y0) * e - Math.sin(k * Math.PI) * vh * 4;
        this.drawCard(f.c, fx, fy, CH * (f.s0 + (f.s1 - f.s0) * e), f.r0 + (f.r1 - f.r0) * e, f.face, f.col);
      }

      if (this.pop) {
        const k = this.time - this.pop.t0;
        if (k > 2.2) this.pop = null;
        else {
          x.globalAlpha = Math.min(1, (2.2 - k) * 3);
          const sz = (this.pop.small ? 7 : 11) * vh * U.easeOutBack(Math.min(1, k * 2.5));
          x.font = this.font(sz, 700, 'Comfortaa');
          const fit = Math.min(1, (W * 0.9) / Math.max(1, x.measureText(this.pop.text).width));
          this.text(this.pop.text, W / 2, H * 0.3, sz * fit, this.pop.color, { fam: 'Comfortaa', w: 700, sw: vh * 1.4 * fit });
          x.globalAlpha = 1;
        }
      }
      if (this.phase === 'score' && this.time > this.scoreT) this.drawScoreTable();
    }

    drawSeats() {
      const x = this.ctx, vh = this.vh, g = this.seatGeom();
      const cur = this.parts[this.cur];
      this.parts.forEach((p, i) => {
        const X = g.x0 + i * (g.w + g.gap), Y = g.y, c = p.color.hex;
        const on = cur === p && (this.phase === 'turn' || this.phase === 'anim');
        if (on) { x.save(); x.shadowColor = c; x.shadowBlur = vh * 3 * (0.7 + 0.3 * Math.sin(this.time * 5)); }
        U.rr(x, X, Y, g.w, g.h, vh * 2);
        x.fillStyle = 'rgba(14,8,36,.85)'; x.fill();
        x.lineWidth = vh * (on ? 0.55 : 0.3); x.strokeStyle = on ? c : 'rgba(255,255,255,.18)'; x.stroke();
        if (on) x.restore();
        const name = p.name + (p.bot ? ' 🤖' : '') + (p.p && !p.p.connected ? ' (εκτός)' : '');
        x.font = this.font(vh * 2.6); x.textAlign = 'left'; x.textBaseline = 'middle'; x.fillStyle = c;
        let nm = name; while (x.measureText(nm).width > g.w * 0.5 && nm.length > 2) nm = nm.slice(0, -2) + '…';
        x.fillText(nm, X + vh * 2, Y + vh * 3.2);
        // φύλλα στο χέρι (πλάτες)
        const n = p.hand.length, bh = vh * 7.5, shown = Math.min(n, 10), sp = Math.min(vh * 1.6, (g.w * 0.42) / Math.max(1, shown));
        for (let j = 0; j < shown; j++) {
          const a = (j - (shown - 1) / 2) * 0.12;
          this.drawCard('', X + g.w - vh * 8 + (j - (shown - 1) / 2) * sp, Y + vh * 5.5 + Math.abs(a) * vh * 3, bh, a, false);
        }
        x.font = this.font(vh * 3.4, 900); x.textAlign = 'left'; x.fillStyle = n === 1 ? '#ffe27a' : '#fff';
        x.fillText(`${n}`, X + vh * 2, Y + vh * 9);
        const nw = x.measureText(`${n}`).width;
        x.font = this.font(vh * 2.1, 700); x.fillStyle = '#d9ccff';
        x.fillText(n === 1 ? 'φύλλο!' : 'φύλλα', X + vh * 2.8 + nw, Y + vh * 9.3);
        if (p.lastAt && !p.called && p.hand.length === 1) {
          const left = LAST_SEC - (this.time - p.lastAt);
          if (left > 0) { x.font = this.font(vh * 2.2, 800); x.fillStyle = '#ff8a8a'; x.fillText(`θα το πει; ${left.toFixed(1)}″`, X + vh * 2, Y + vh * 13.4); }
        } else if (p.status) {
          x.font = this.font(vh * 2.3, 800); x.textAlign = 'left'; x.fillStyle = '#ffe27a';
          x.fillText(p.status, X + vh * 2, Y + vh * 13.4);
        }
        if (on) this.text('▼', X + g.w / 2, Y - vh * 2.2 + Math.sin(this.time * 6) * vh * 0.6, vh * 3, c, { sw: vh * 0.4 });
      });
    }

    drawScoreTable() {
      const x = this.ctx, W = this.W, H = this.H, vh = this.vh, n = this.parts.length, w = this.winner;
      const k = Math.min(1, (this.time - this.scoreT) / 0.4);
      x.fillStyle = `rgba(0,0,0,${0.6 * k})`; x.fillRect(0, 0, W, H);
      const bw = Math.min(W * 0.78, vh * 130), rowH = vh * 9, bh = vh * 20 + n * rowH;
      const bx = (W - bw) / 2, by = (H - bh) / 2 - vh * 4 + (1 - k) * vh * 8;
      x.globalAlpha = k;
      U.rr(x, bx, by, bw, bh, vh * 3); x.fillStyle = '#24165a'; x.fill(); x.lineWidth = vh * 0.5; x.strokeStyle = '#ffe27a'; x.stroke();
      this.text('Βαθμολογία', W / 2, by + vh * 7, vh * 4.4, '#ffe27a', { fam: 'Comfortaa', w: 700 });
      const cols = [0.24, 0.55, 0.82];
      ['Παίκτης', 'Φύλλα στο χέρι', 'Πόντοι'].forEach((t, i) => this.text(t, bx + bw * cols[i], by + vh * 14, vh * 2.2, '#d9ccff', { stroke: false, w: 700 }));
      const rank = [w, ...this.parts.filter((q) => q !== w).sort((a, b) => a.left - b.left)];
      rank.forEach((p, i) => {
        const y = by + vh * 20 + i * rowH;
        if (this.time - this.scoreT < 0.5 + i * 0.35) return;
        if (i === 0) { U.rr(x, bx + vh * 2, y - rowH * 0.45, bw - vh * 4, rowH * 0.9, vh * 2); x.fillStyle = 'rgba(255,226,122,.12)'; x.fill(); }
        this.text((i === 0 ? '👑 ' : '') + p.name, bx + bw * cols[0], y, vh * 3, p.color.hex, { sw: vh * 0.45 });
        this.text(i === 0 ? 'κανένα! 🎉' : `${p.hand.length} φύλλα (${p.left} π.)`, bx + bw * cols[1], y, vh * 2.8, '#fff', { stroke: false });
        this.text(i === 0 ? `${p.score}` : '0', bx + bw * cols[2], y, vh * 4, '#ffe27a', { fam: 'Comfortaa', w: 700 });
      });
      x.globalAlpha = 1;
    }
  }

  ChromaGame.CHEX = CHEX;
  Mini.games.chroma = ChromaGame;
})();
