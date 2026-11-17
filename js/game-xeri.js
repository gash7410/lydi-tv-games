// «Ξερή»: το κλασικό ελληνικό παιχνίδι με την τράπουλα.
// Η τηλεόραση είναι το τραπέζι· κάθε κινητό δείχνει τα φύλλα του παίκτη.
// Ο παίκτης διαλέγει φύλλο και πατά «ΠΕΤΑ» (το αφήνει στο τραπέζι) ή «ΠΑΡΕ ΤΑ»
// (όταν το φύλλο του ταιριάζει με το πάνω φύλλο ή είναι Βαλές, μαζεύει όλα τα φύλλα).
// Ξερή = μαζεύεις ένα μόνο φύλλο με το ίδιο νούμερο: 10 πόντοι (Βαλές σε Βαλέ: 20).
// Στο τέλος της τράπουλας: περισσότερα φύλλα 3, Ρήγας/Ντάμα/Βαλές/10 από 1, 10♦ 2, 2♣ 1.
(function () {
  'use strict';
  const { Base, U } = Mini;

  const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  const SUITS = ['S', 'H', 'D', 'C'];
  const SYM = { S: '♠', H: '♥', D: '♦', C: '♣' };
  const RED = { H: 1, D: 1 };
  const rankOf = (c) => c.slice(0, -1);
  const suitOf = (c) => c.slice(-1);
  const HAND = 6;
  const TURN_SEC = 60; // αν ο παίκτης δεν παίξει, παίζει μόνο του το χειριστήριο
  const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };

  function cardPts(c) {
    if (c === '10D') return 2;
    if (c === '2C') return 1;
    return ['K', 'Q', 'J', '10'].includes(rankOf(c)) ? 1 : 0;
  }

  class XeriGame extends Base {
    constructor(c, h) { super(c, h); this.WIN = 0; }

    setup() {
      this.deck = [];
      for (const s of SUITS) for (const r of RANKS) this.deck.push(r + s);
      shuffle(this.deck);
      // στο τραπέζι 4 φύλλα, χωρίς Βαλέ
      this.pile = [];
      for (let i = 0; i < 4; i++) {
        let k = this.deck.findIndex((c) => rankOf(c) !== 'J');
        this.pile.push(this.mk(this.deck.splice(k, 1)[0]));
      }
      this.parts.forEach((p) => { p.hand = []; p.won = []; p.xeri = 0; p.xpts = 0; p.score = 0; p.status = ''; });
      this.cur = (Math.random() * this.parts.length) | 0;
      this.firstPlayer = this.cur;
      this.lastTaker = null;
      this.round = 0;
      this.rounds = Math.ceil(this.deck.length / (this.parts.length * HAND));
      this.flying = []; this.pop = null; this.tid = 0; this.phase = 'deal';
      this.deal();
    }

    mk(c) { return { c, rot: U.rand(-0.22, 0.22), dx: U.rand(-1, 1), dy: U.rand(-1, 1) }; }

    // ---------- μοίρασμα ----------
    deal() {
      const n = this.parts.length, per = Math.min(HAND, Math.floor(this.deck.length / n));
      this.round++; this.phase = 'deal';
      this.banner(this.round === 1 ? 'Μοιράζω!' : `Μοιρασιά ${this.round}/${this.rounds}`, '#fff');
      this.sfx('blip');
      let k = 0;
      for (let j = 0; j < per; j++) {
        for (let i = 0; i < n; i++) {
          const p = this.parts[(this.firstPlayer + i) % n], c = this.deck.pop();
          const d = this.deckPos(), s = this.seatPos(p);
          this.fly({ c, face: false, x0: d.x, y0: d.y, x1: s.x, y1: s.y - this.vh * 4, delay: k * 0.07, dur: 0.32, s1: 0.45,
            done: () => { p.hand.push(c); this.sortHand(p); } });
          k++;
        }
      }
      this.changed();
      this.after(k * 0.07 + 0.6, () => { if (this.running) this.startTurn(); });
    }

    sortHand(p) {
      p.hand.sort((a, b) => RANKS.indexOf(rankOf(a)) - RANKS.indexOf(rankOf(b)) || SUITS.indexOf(suitOf(a)) - SUITS.indexOf(suitOf(b)));
    }

    startTurn() {
      const p = this.parts[this.cur];
      this.phase = 'turn'; this.tid++; this.turnT = this.time;
      this.fx(p, 'Σειρά σου! 🃏', [40, 30, 40]);
      this.changed();
      const id = this.tid, gone = !p.bot && !(p.p && p.p.connected);
      if (p.bot || gone) this.after(p.bot ? U.rand(1.1, 2) : 1.2, () => this.tid === id && this.play(p, this.botPick(p)));
      else this.after(TURN_SEC, () => this.tid === id && this.play(p, this.botPick(p)));
    }

    top() { return this.pile.length ? this.pile[this.pile.length - 1].c : null; }
    takes(c) { const t = this.top(); return !!t && (rankOf(c) === 'J' || rankOf(c) === rankOf(t)); }

    // ρομπότ (και αυτόματο παίξιμο όταν κάποιος αργεί ή φύγει)
    botPick(p) {
      const h = p.hand, t = this.top();
      if (t) {
        const m = h.find((c) => rankOf(c) === rankOf(t) && rankOf(c) !== 'J');
        if (m) return m;
        const val = this.pile.reduce((s, e) => s + cardPts(e.c), 0);
        const j = h.find((c) => rankOf(c) === 'J');
        if (j && (this.pile.length >= 4 || val >= 2 || (rankOf(t) === 'J' && this.pile.length === 1))) return j;
      }
      // πέτα το φύλλο με τη μικρότερη αξία (όχι Βαλέ, αν γίνεται)
      const pool = h.filter((c) => rankOf(c) !== 'J' && !this.takes(c));
      const list = pool.length ? pool : h.filter((c) => rankOf(c) !== 'J').length ? h.filter((c) => rankOf(c) !== 'J') : h;
      return [...list].sort((a, b) => cardPts(a) - cardPts(b) || Math.random() - 0.5)[0];
    }

    input(part, msg) {
      if (msg.type !== 'card' || !part || this.phase !== 'turn' || this.parts[this.cur] !== part) return;
      const c = String(msg.c || '');
      if (!part.hand.includes(c)) return;
      this.play(part, c);
    }

    play(p, c) {
      if (this.phase !== 'turn' || !c || !p.hand.includes(c)) return;
      this.phase = 'anim'; this.tid++;
      p.hand.splice(p.hand.indexOf(c), 1);
      const take = this.takes(c);
      const xeri = take && this.pile.length === 1 && rankOf(c) === rankOf(this.top());
      const s = this.seatPos(p), e = this.mk(c), pc = this.pilePos();
      this.sfx('throw');
      this.changed();
      this.fly({ c, face: true, x0: s.x, y0: s.y - this.vh * 4, x1: pc.x + e.dx * this.vh, y1: pc.y + e.dy * this.vh, dur: 0.42, s0: 0.45, s1: 1, r1: e.rot,
        done: () => {
          this.pile.push(e);
          if (!take) { this.sfx('blip'); return this.after(0.35, () => this.next()); }
          this.sfx(xeri ? 'sink' : 'point');
          if (xeri) {
            const pts = rankOf(c) === 'J' ? 20 : 10;
            p.xeri++; p.xpts += pts;
            this.pop = { text: `ΞΕΡΗ! +${pts}`, color: p.color.hex, t0: this.time };
            this.fx(p, `ΞΕΡΗ! +${pts} πόντοι 🎉`, [80, 50, 160], true);
          } else this.fx(p, `Μάζεψες ${this.pile.length} φύλλα ✋`, [50, 30, 50]);
          p.status = xeri ? 'ΞΕΡΗ!' : `+${this.pile.length} φύλλα`;
          this.after(xeri ? 1.3 : 0.75, () => this.sweep(p));
        } });
    }

    sweep(p) {
      const cards = this.pile; this.pile = [];
      const pc = this.pilePos(), s = this.seatPos(p);
      cards.forEach((e, i) => this.fly({ c: e.c, face: true, x0: pc.x + e.dx * this.vh, y0: pc.y + e.dy * this.vh, r0: e.rot,
        x1: s.x + this.cw() * 0.2, y1: s.y, delay: i * 0.03, dur: 0.45, s0: 1, s1: 0.3 }));
      p.won.push(...cards.map((e) => e.c));
      this.lastTaker = p;
      this.changed();
      this.after(cards.length * 0.03 + 0.55, () => { p.status = ''; this.next(); });
    }

    next() {
      if (!this.running) return;
      if (this.parts.every((q) => !q.hand.length)) {
        if (this.deck.length) { this.firstPlayer = (this.firstPlayer + 1) % this.parts.length; this.cur = this.firstPlayer; return this.deal(); }
        return this.finishDeck();
      }
      const n = this.parts.length;
      for (let i = 1; i <= n; i++) { const j = (this.cur + i) % n; if (this.parts[j].hand.length) { this.cur = j; break; } }
      this.startTurn();
    }

    // ---------- τέλος τράπουλας: βαθμολογία ----------
    finishDeck() {
      this.phase = 'score';
      if (this.pile.length && this.lastTaker) {
        const p = this.lastTaker;
        this.banner(`Τα τελευταία φύλλα στον/στην ${p.name}`, p.color.hex);
        const pc = this.pilePos(), s = this.seatPos(p);
        this.pile.forEach((e, i) => this.fly({ c: e.c, face: true, x0: pc.x, y0: pc.y, x1: s.x, y1: s.y, delay: i * 0.03, dur: 0.45, s0: 1, s1: 0.3 }));
        p.won.push(...this.pile.map((e) => e.c)); this.pile = [];
      }
      const most = Math.max(...this.parts.map((p) => p.won.length));
      const tops = this.parts.filter((p) => p.won.length === most);
      for (const p of this.parts) {
        p.cpts = p.won.reduce((s, c) => s + cardPts(c), 0);
        p.mpts = tops.length === 1 && tops[0] === p ? 3 : 0;
        p.score = p.cpts + p.mpts + p.xpts;
        p.status = '';
      }
      this.scoreT = this.time + 1;
      this.changed();
      this.after(1.2, () => this.sfx('point'));
      this.after(9, () => {
        if (!this.running) return;
        this.over = true;
        const w = [...this.parts].sort((a, b) => b.score - a.score || b.won.length - a.won.length)[0];
        this.finish(w);
      });
    }

    finish(winner) {
      this.celebrate(winner.color.hex);
      this.sfx('win');
      const rank = [...this.parts].sort((a, b) => b.score - a.score || b.won.length - a.won.length);
      const tie = rank.filter((q) => q.score === winner.score).length > 1;
      this.h.onOver && this.h.onOver({
        winner,
        stats: `${winner.score} πόντοι · ${winner.won.length} φύλλα · ${winner.xeri} ${winner.xeri === 1 ? 'ξερή' : 'ξερές'}` + (tie ? ' (ισοπαλία στην κορυφή!)' : ''),
        rank: rank.map((q) => ({ name: q.name, color: q.color, st: `${q.score} πόντοι · ${q.won.length} φύλλα · ξερές ${q.xeri}` })),
        icon: '🃏',
      });
    }

    // ---------- χειριστήριο ----------
    ctrl(part) {
      const cur = this.parts[this.cur];
      const mine = this.phase === 'turn' && cur === part;
      const base = {
        mode: 'cards', hand: part.hand.slice(), top: this.top(), pileN: this.pile.length, deckN: this.deck.length,
        turn: cur ? { name: cur.name, color: cur.color.hex } : null, tid: this.tid,
        scoreText: `Μάζεψες ${part.won.length} φύλλα` + (part.xeri ? ` · ξερές ${part.xeri}` : ''),
      };
      if (this.phase === 'score') return { ...base, active: false, label: `Τέλος! Έχεις ${part.score} πόντους`, sub: 'Κοίτα τη βαθμολογία στην τηλεόραση' };
      if (this.phase === 'deal') return { ...base, active: false, label: 'Μοιράζω…', sub: '' };
      if (mine) return { ...base, active: true, label: 'Σειρά σου!', sub: 'Διάλεξε φύλλο και πάτα «ΠΕΤΑ» ή «ΠΑΡΕ ΤΑ»' };
      if (cur === part) return { ...base, active: false, label: 'Έπαιξες!', sub: '' };
      return { ...base, active: false, label: cur ? `Παίζει: ${cur.name}` : '', sub: 'Περίμενε τη σειρά σου' };
    }

    // ---------- κινήσεις ----------
    fly(o) { this.flying.push({ delay: 0, dur: 0.4, s0: 1, s1: 1, r0: 0, r1: 0, ...o, t0: this.time + (o.delay || 0) }); }

    update() {
      for (const f of this.flying) if (!f.fin && this.time >= f.t0 + f.dur) { f.fin = true; f.done && f.done(); }
      this.flying = this.flying.filter((f) => !f.fin);
    }

    // ---------- θέσεις ----------
    ch() { return this.vh * 25; }
    cw() { return this.ch() * 0.7; }
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

    // ---------- σχεδίαση ----------
    drawCard(c, cx, cy, h, rot = 0, face = true, alpha = 1) {
      const x = this.ctx, w = h * 0.7;
      x.save(); x.translate(cx, cy); x.rotate(rot); x.globalAlpha = alpha;
      x.shadowColor = 'rgba(0,0,0,.35)'; x.shadowBlur = h * 0.06; x.shadowOffsetY = h * 0.03;
      U.rr(x, -w / 2, -h / 2, w, h, h * 0.07);
      x.fillStyle = face ? '#fffdf6' : '#b5283a'; x.fill();
      x.shadowColor = 'transparent';
      x.lineWidth = Math.max(1, h * 0.012); x.strokeStyle = 'rgba(0,0,0,.35)'; x.stroke();
      if (!face) {
        // πλάτη: κόκκινο με χρυσό ρόμβο
        U.rr(x, -w / 2 + h * 0.05, -h / 2 + h * 0.05, w - h * 0.1, h * 0.9, h * 0.04);
        x.lineWidth = h * 0.02; x.strokeStyle = '#ffd88a'; x.stroke();
        x.save(); x.clip();
        x.strokeStyle = 'rgba(255,216,138,.35)'; x.lineWidth = h * 0.012;
        for (let i = -6; i <= 6; i++) { x.beginPath(); x.moveTo(i * h * 0.1 - h, -h); x.lineTo(i * h * 0.1 + h, h); x.stroke(); x.beginPath(); x.moveTo(i * h * 0.1 + h, -h); x.lineTo(i * h * 0.1 - h, h); x.stroke(); }
        x.restore();
        x.beginPath(); x.moveTo(0, -h * 0.16); x.lineTo(w * 0.22, 0); x.lineTo(0, h * 0.16); x.lineTo(-w * 0.22, 0); x.closePath();
        x.fillStyle = '#ffd88a'; x.fill();
        x.restore(); return;
      }
      const r = rankOf(c), s = suitOf(c), col = RED[s] ? '#d42a35' : '#1c1a2b', sym = SYM[s];
      x.fillStyle = col; x.textAlign = 'center'; x.textBaseline = 'middle';
      // γωνίες
      for (const k of [1, -1]) {
        x.save(); x.scale(k, k);
        x.font = this.font(h * (r === '10' ? 0.15 : 0.17), 800);
        x.fillText(r, -w / 2 + h * 0.1, -h / 2 + h * 0.11);
        x.font = this.font(h * 0.13, 700, 'Noto Sans Symbols');
        x.fillText(sym, -w / 2 + h * 0.1, -h / 2 + h * 0.25);
        x.restore();
      }
      if (['J', 'Q', 'K'].includes(r)) {
        // φιγούρα: πλαίσιο με γράμμα, στέμμα και σύμβολο
        U.rr(x, -w * 0.3, -h * 0.32, w * 0.6, h * 0.64, h * 0.04);
        x.fillStyle = RED[s] ? '#ffe7e3' : '#e8eaf6'; x.fill();
        x.lineWidth = h * 0.012; x.strokeStyle = col; x.stroke();
        x.fillStyle = '#e9b130';
        x.beginPath(); const cy0 = -h * 0.16, cwid = w * 0.34;
        x.moveTo(-cwid / 2, cy0); x.lineTo(-cwid / 2, cy0 - h * 0.08); x.lineTo(-cwid / 4, cy0 - h * 0.03); x.lineTo(0, cy0 - h * 0.1);
        x.lineTo(cwid / 4, cy0 - h * 0.03); x.lineTo(cwid / 2, cy0 - h * 0.08); x.lineTo(cwid / 2, cy0); x.closePath(); x.fill();
        x.fillStyle = col; x.font = this.font(h * 0.27, 800, 'Comfortaa');
        x.fillText(r, 0, h * 0.04);
        x.font = this.font(h * 0.12, 700, 'Noto Sans Symbols'); x.fillText(sym, 0, h * 0.22);
      } else if (r === 'A') {
        x.font = this.font(h * 0.42, 700, 'Noto Sans Symbols'); x.fillText(sym, 0, h * 0.02);
      } else {
        x.font = this.font(h * 0.26, 800); x.fillText(r, 0, -h * 0.05);
        x.font = this.font(h * 0.17, 700, 'Noto Sans Symbols'); x.fillText(sym, 0, h * 0.17);
      }
      x.restore();
    }

    draw() {
      const x = this.ctx, W = this.W, H = this.H, vh = this.vh;
      // τσόχα
      const g = x.createRadialGradient(W / 2, H * 0.42, vh * 5, W / 2, H * 0.45, W * 0.65);
      g.addColorStop(0, '#1f8a4c'); g.addColorStop(0.6, '#13663a'); g.addColorStop(1, '#0a3d22');
      x.fillStyle = g; x.fillRect(0, 0, W, H);
      x.save(); x.globalAlpha = 0.05; x.fillStyle = '#000';
      for (let i = 0; i < 70; i++) x.fillRect((i * 97.3) % W, (i * 53.7) % H, vh * 0.3, vh * 0.3);
      x.restore();
      // ξύλινο πλαίσιο
      x.lineWidth = vh * 1.6; x.strokeStyle = '#6b3d1f'; x.strokeRect(vh * 0.8, vh * 0.8, W - vh * 1.6, H - vh * 1.6);
      x.lineWidth = vh * 0.3; x.strokeStyle = 'rgba(255,220,150,.3)'; x.strokeRect(vh * 1.8, vh * 1.8, W - vh * 3.6, H - vh * 3.6);

      // επικεφαλίδα
      this.text('Ξερή', W * 0.05, vh * 15, vh * 5, '#fff', { fam: 'Comfortaa', w: 700, align: 'left' });
      this.text(`Μοιρασιά ${Math.max(1, this.round)}/${this.rounds}`, W * 0.05, vh * 20.5, vh * 2.4, '#bfe8cc', { align: 'left', stroke: false, w: 700 });
      const cur = this.parts[this.cur];
      if (cur && (this.phase === 'turn' || this.phase === 'anim')) {
        const t = `Σειρά: ${cur.name}`;
        x.font = this.font(vh * 3.2, 800);
        const tw = x.measureText(t).width + vh * 5;
        U.rr(x, W / 2 - tw / 2, vh * 4.5, tw, vh * 7, vh * 3.5);
        x.fillStyle = 'rgba(0,0,0,.35)'; x.fill(); x.lineWidth = vh * 0.4; x.strokeStyle = cur.color.hex; x.stroke();
        this.text(t, W / 2, vh * 8, vh * 3.2, cur.color.hex, { sw: vh * 0.5 });
        if (this.phase === 'turn' && !cur.bot) {
          const left = TURN_SEC - (this.time - this.turnT);
          if (left < 15 && left > 0) this.text(`${Math.ceil(left)}″`, W / 2 + tw / 2 + vh * 4, vh * 8, vh * 3, '#ffc93d');
        }
      }

      // τράπουλα
      const d = this.deckPos(), CH = this.ch();
      const dn = this.deck.length;
      for (let i = Math.min(6, Math.ceil(dn / 8)) - 1; i >= 0; i--) this.drawCard('', d.x - i * vh * 0.35, d.y - i * vh * 0.35, CH * 0.9, 0, false);
      if (!dn) { U.rr(x, d.x - CH * 0.315, d.y - CH * 0.45, CH * 0.63, CH * 0.9, CH * 0.06); x.lineWidth = vh * 0.3; x.setLineDash([vh, vh]); x.strokeStyle = 'rgba(255,255,255,.3)'; x.stroke(); x.setLineDash([]); }
      this.text(dn ? `${dn} φύλλα` : 'τελείωσε', d.x, d.y + CH * 0.6, vh * 2.4, '#e6f5ea', { stroke: false, w: 700 });

      // στοίβα στο τραπέζι
      const pc = this.pilePos();
      const pl = this.pile, from = Math.max(0, pl.length - 9);
      if (!pl.length) {
        U.rr(x, pc.x - CH * 0.35, pc.y - CH / 2, CH * 0.7, CH, CH * 0.07);
        x.lineWidth = vh * 0.35; x.setLineDash([vh * 1.2, vh]); x.strokeStyle = 'rgba(255,255,255,.35)'; x.stroke(); x.setLineDash([]);
        this.text('άδειο', pc.x, pc.y, vh * 2.6, 'rgba(255,255,255,.45)', { stroke: false });
      }
      for (let i = from; i < pl.length; i++) {
        const e = pl[i];
        this.drawCard(e.c, pc.x + e.dx * vh, pc.y + e.dy * vh, CH, e.rot, true);
      }
      if (pl.length) {
        const t = pl.length === 1 ? 'Μόνο ένα φύλλο: ευκαιρία για ξερή!' : `Στο τραπέζι: ${pl.length} φύλλα`;
        this.text(t, pc.x, pc.y + CH * 0.66, vh * 2.6, pl.length === 1 ? '#ffe27a' : '#fff', { sw: vh * 0.45 });
      }

      // οδηγίες
      const ix = W * 0.8;
      U.rr(x, ix - vh * 19, H * 0.43 - vh * 15, vh * 38, vh * 30, vh * 2.5);
      x.fillStyle = 'rgba(0,0,0,.25)'; x.fill();
      const lines = [
        ['Πώς μαζεύεις', '#ffe27a', 2.6],
        ['Ίδιο νούμερο με το πάνω φύλλο', '#fff', 2.1],
        ['ή Βαλές (J): τα παίρνει όλα', '#fff', 2.1],
        ['Ξερή = 10 · με Βαλέ = 20', '#ffe27a', 2.3],
        ['Περισσότερα φύλλα: 3', '#d8f1df', 1.9],
        ['K, Q, J, 10: 1 · 10♦: 2 · 2♣: 1', '#d8f1df', 1.9],
      ];
      lines.forEach(([t, c, s], i) => this.text(t, ix, H * 0.43 - vh * 10.5 + i * vh * 4.4 + (i > 2 ? vh * 1.2 : 0), vh * s, c, { stroke: false, w: i === 0 || i === 3 ? 800 : 600 }));

      this.drawSeats();

      // κάρτες που κινούνται
      for (const f of this.flying) {
        if (this.time < f.t0) continue;
        const k = Math.min(1, (this.time - f.t0) / f.dur), e = 1 - Math.pow(1 - k, 3);
        const fx = f.x0 + (f.x1 - f.x0) * e, fy = f.y0 + (f.y1 - f.y0) * e - Math.sin(k * Math.PI) * vh * 4;
        this.drawCard(f.c, fx, fy, CH * (f.s0 + (f.s1 - f.s0) * e), f.r0 + (f.r1 - f.r0) * e, f.face);
      }

      if (this.pop) {
        const k = this.time - this.pop.t0;
        if (k > 2.2) this.pop = null;
        else {
          x.globalAlpha = Math.min(1, (2.2 - k) * 3);
          this.text(this.pop.text, W / 2, H * 0.42, vh * 13 * U.easeOutBack(Math.min(1, k * 2.5)), '#ffe27a', { fam: 'Comfortaa', w: 700, sw: vh * 1.6 });
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
        x.fillStyle = 'rgba(8,20,14,.82)'; x.fill();
        x.lineWidth = vh * (on ? 0.55 : 0.3); x.strokeStyle = on ? c : 'rgba(255,255,255,.18)'; x.stroke();
        if (on) x.restore();
        const name = p.name + (p.bot ? ' 🤖' : '') + (p.p && !p.p.connected ? ' (εκτός)' : '');
        x.font = this.font(vh * 2.6); x.textAlign = 'left'; x.textBaseline = 'middle'; x.fillStyle = c;
        let nm = name; while (x.measureText(nm).width > g.w * 0.5 && nm.length > 2) nm = nm.slice(0, -2) + '…';
        x.fillText(nm, X + vh * 2, Y + vh * 3.2);
        // φύλλα στο χέρι (πλάτες)
        const n = p.hand.length, bh = vh * 7.5;
        for (let j = 0; j < n; j++) {
          const a = (j - (n - 1) / 2) * 0.16;
          this.drawCard('', X + g.w - vh * 7 + (j - (n - 1) / 2) * vh * 1.6, Y + vh * 5.5 + Math.abs(a) * vh * 3, bh, a, false);
        }
        x.font = this.font(vh * 2.1, 700); x.fillStyle = '#e6f5ea'; x.textAlign = 'left';
        x.fillText(`Μάζεψε: ${p.won.length} φύλλα`, X + vh * 2, Y + vh * 8.6);
        x.fillStyle = p.xeri ? '#ffe27a' : 'rgba(230,245,234,.6)';
        x.fillText(p.xeri ? `Ξερές: ${p.xeri} (+${p.xpts})` : 'Ξερές: 0', X + vh * 2, Y + vh * 12.4);
        if (p.status) {
          x.font = this.font(vh * 2.4, 800); x.textAlign = 'right'; x.fillStyle = '#ffe27a';
          x.fillText(p.status, X + g.w - vh * 2, Y + vh * 13.6);
        }
        if (on) this.text('▼', X + g.w / 2, Y - vh * 2.2 + Math.sin(this.time * 6) * vh * 0.6, vh * 3, c, { sw: vh * 0.4 });
      });
    }

    drawScoreTable() {
      const x = this.ctx, W = this.W, H = this.H, vh = this.vh, n = this.parts.length;
      const k = Math.min(1, (this.time - this.scoreT) / 0.4);
      x.fillStyle = `rgba(0,0,0,${0.6 * k})`; x.fillRect(0, 0, W, H);
      const bw = Math.min(W * 0.8, vh * 140), rowH = vh * 9, bh = vh * 20 + n * rowH;
      const bx = (W - bw) / 2, by = (H - bh) / 2 - vh * 4 + (1 - k) * vh * 8;
      x.globalAlpha = k;
      U.rr(x, bx, by, bw, bh, vh * 3); x.fillStyle = '#0f3a24'; x.fill(); x.lineWidth = vh * 0.5; x.strokeStyle = '#ffd88a'; x.stroke();
      this.text('Βαθμολογία', W / 2, by + vh * 7, vh * 4.4, '#ffe27a', { fam: 'Comfortaa', w: 700 });
      const cols = [0.2, 0.42, 0.57, 0.72, 0.87];
      ['Παίκτης', 'Φύλλα', 'Πόντοι φύλλων', 'Ξερές', 'Σύνολο'].forEach((t, i) =>
        this.text(t, bx + bw * cols[i], by + vh * 14, vh * 2.2, '#bfe8cc', { stroke: false, w: 700 }));
      const rank = [...this.parts].sort((a, b) => b.score - a.score || b.won.length - a.won.length);
      rank.forEach((p, i) => {
        const y = by + vh * 20 + i * rowH;
        const show = this.time - this.scoreT > 0.5 + i * 0.35;
        if (!show) return;
        if (i === 0) { U.rr(x, bx + vh * 2, y - rowH * 0.45, bw - vh * 4, rowH * 0.9, vh * 2); x.fillStyle = 'rgba(255,226,122,.12)'; x.fill(); }
        this.text((i === 0 ? '👑 ' : '') + p.name, bx + bw * cols[0], y, vh * 3, p.color.hex, { sw: vh * 0.45 });
        this.text(`${p.won.length}` + (p.mpts ? ' (+3)' : ''), bx + bw * cols[1], y, vh * 2.8, '#fff', { stroke: false });
        this.text(`${p.cpts}`, bx + bw * cols[2], y, vh * 2.8, '#fff', { stroke: false });
        this.text(`${p.xeri}` + (p.xpts ? ` (+${p.xpts})` : ''), bx + bw * cols[3], y, vh * 2.8, p.xeri ? '#ffe27a' : '#fff', { stroke: false });
        this.text(`${p.score}`, bx + bw * cols[4], y, vh * 4, '#ffe27a', { fam: 'Comfortaa', w: 700 });
      });
      x.globalAlpha = 1;
    }
  }

  Mini.games.xeri = XeriGame;
})();
