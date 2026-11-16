// Τηλεόραση: δωμάτιο PeerJS, lobby, σειρές, βαθμολογία
(function () {
  'use strict';
  const $ = (s) => document.querySelector(s);

  // ---------- ήχοι (συνθετικοί, χωρίς αρχεία) ----------
  let ac = null;
  function audio() {
    if (!ac) { try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; } }
    if (ac.state === 'suspended') ac.resume();
    return ac;
  }
  function tone(freq, dur, type = 'sine', vol = 0.2, f2 = null, delay = 0) {
    const a = audio(); if (!a) return;
    const t = a.currentTime + delay, o = a.createOscillator(), g = a.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(a.destination); o.start(t); o.stop(t + dur + 0.02);
  }
  const SFX = {
    throw: () => tone(500, 0.18, 'triangle', 0.12, 1400),
    bounce: () => tone(950, 0.06, 'sine', 0.25),
    tick: () => tone(1500, 0.05, 'square', 0.06),
    rim: () => tone(1300, 0.12, 'triangle', 0.18, 900),
    sink: () => { tone(700, 0.25, 'sine', 0.3, 140); [880, 1108, 1318].forEach((f, i) => tone(f, 0.25, 'triangle', 0.15, null, 0.15 + i * 0.08)); },
    miss: () => tone(220, 0.3, 'sine', 0.1, 140),
    join: () => { tone(660, 0.1, 'triangle', 0.15); tone(990, 0.12, 'triangle', 0.15, null, 0.09); },
    win: () => [523, 659, 784, 1046, 784, 1046].forEach((f, i) => tone(f, 0.3, 'triangle', 0.18, null, i * 0.13)),
    count: () => tone(660, 0.14, 'square', 0.08),
    go: () => { tone(990, 0.3, 'square', 0.1); tone(1320, 0.3, 'triangle', 0.12, null, 0.05); },
    blip: () => tone(420, 0.09, 'triangle', 0.12),
    star: () => { tone(1200, 0.12, 'triangle', 0.2); tone(1800, 0.2, 'triangle', 0.16, null, 0.06); },
    buzz: () => tone(130, 0.35, 'sawtooth', 0.12, 90),
    point: () => [784, 1046, 1318].forEach((f, i) => tone(f, 0.18, 'triangle', 0.16, null, i * 0.07)),
    pump: () => tone(300 + Math.random() * 60, 0.07, 'triangle', 0.1, 520),
    pop: () => { tone(160, 0.25, 'sawtooth', 0.3, 40); tone(2400, 0.08, 'square', 0.15, 600); },
    deflate: () => tone(900, 0.9, 'sawtooth', 0.05, 160),
    dash: () => tone(260, 0.18, 'triangle', 0.14, 700),
    bump: () => tone(180, 0.12, 'square', 0.14, 90),
    splat: () => { tone(260, 0.16, 'sawtooth', 0.16, 70); tone(900, 0.07, 'square', 0.05, 200, 0.02); },
    gun: () => { tone(120, 0.35, 'sawtooth', 0.35, 40); tone(2000, 0.06, 'square', 0.2, 300); },
    step: () => tone(170 + Math.random() * 40, 0.05, 'triangle', 0.12, 90),
    finish: () => [659, 880, 1175, 1568].forEach((f, i) => tone(f, 0.22, 'triangle', 0.18, null, i * 0.08)),
    splash: () => { tone(500, 0.4, 'sine', 0.2, 80); tone(1500, 0.25, 'triangle', 0.05, 300, 0.05); },
  };
  addEventListener('keydown', audio, { once: true });
  addEventListener('pointerdown', audio, { once: true });

  // ---------- κατάσταση ----------
  const S = { phase: 'lobby', game: localStorage.getItem('tvp_game') || 'cups', players: [], turn: 0, cupsPerRack: 10, winner: null };
  if (!TVP.GAMES.some((g) => g.id === S.game)) S.game = 'cups';
  const meta = (id) => TVP.GAMES.find((g) => g.id === (id || S.game));
  const byConn = new Map();
  let peer = null, roomCode = '';

  const game = new CupsGame($('#stage'), {
    sfx: (n) => SFX[n] && SFX[n](),
    onSink: () => {
      const p = S.players[S.turn];
      banner('ΜΠΗΚΕ!', p && p.color.hex);
      if (p) send(p, { type: 'result', made: true });
    },
    onThrowDone,
  });
  game.setDemo(true);

  // ---------- μικρά παιχνίδια (κοινός καμβάς #stage2) ----------
  const minis = {};
  let mini = null, parts = [];
  const miniHooks = {
    sfx: (n) => SFX[n] && SFX[n](),
    banner: (t, c, sticky) => banner(t, c, sticky),
    send: (p, m) => send(p, m),
    update: () => broadcast(),
    onOver: (res) => miniOver(res),
  };
  for (const id of Object.keys(Mini.games)) minis[id] = new Mini.games[id]($('#stage2'), miniHooks);
  const partOf = (p) => parts.find((x) => x.p === p);

  // ---------- δίκτυο ----------
  let reuseTries = 0;
  function startPeer() {
    const saved = localStorage.getItem('tvp_room');
    roomCode = saved && reuseTries < 4 ? saved : String(1000 + Math.floor(Math.random() * 9000));
    localStorage.setItem('tvp_room', roomCode);
    setNet('Σύνδεση στον server…');
    peer = new Peer(TVP.PREFIX + roomCode, TVP.peerOptions);
    peer.on('open', () => { showRoom(); setNet(''); });
    peer.on('connection', (conn) => {
      conn.on('data', (d) => onMsg(conn, d));
      conn.on('close', () => onClose(conn));
      conn.on('error', () => onClose(conn));
    });
    peer.on('disconnected', () => { setNet('Επανασύνδεση…'); setTimeout(() => peer && !peer.destroyed && peer.reconnect(), 1500); });
    peer.on('error', (e) => {
      if (e.type === 'unavailable-id') {
        // ο ίδιος κωδικός μπορεί να μένει «πιασμένος» λίγα δευτερόλεπτα μετά από ανανέωση
        peer.destroy(); reuseTries++;
        return setTimeout(startPeer, reuseTries < 4 ? 2500 : 0);
      }
      if (['network', 'server-error', 'socket-error', 'socket-closed'].includes(e.type)) {
        setNet('Πρόβλημα σύνδεσης — νέα προσπάθεια…');
        setTimeout(() => { if (peer.disconnected && !peer.destroyed) peer.reconnect(); }, 3000);
      }
    });
  }

  function controllerURL() {
    const u = new URL('controller.html', TVP.isApp ? TVP.WEB_URL : location.href);
    u.search = '?r=' + roomCode;
    return u.href;
  }

  function showRoom() {
    const url = controllerURL();
    const qr = qrcode(0, 'M'); qr.addData(url); qr.make();
    const img = new Image(); img.alt = 'QR για σύνδεση κινητού'; img.src = qr.createDataURL(8, 2);
    $('#qr').replaceChildren(img);
    $('#code').textContent = roomCode;
    $('#hudCode').textContent = roomCode;
  }

  function setNet(t) { $('#netStatus').textContent = t; }

  function send(p, msg) { if (p && p.conn && p.conn.open) try { p.conn.send(msg); } catch (e) {} }

  function onMsg(conn, d) {
    if (!d || typeof d !== 'object') return;
    if (d.type === 'dbg') return window.TVDBG && TVDBG.handle(conn, d);
    const p = byConn.get(conn);
    switch (d.type) {
      case 'join': return join(conn, d);
      case 'start': if (p && isHost(p) && (S.phase === 'lobby' || S.phase === 'over')) startGame(); return;
      case 'lobby': if (p && isHost(p) && S.phase === 'over') toLobby(); return;
      case 'pick': if (p && isHost(p) && (S.phase === 'lobby' || S.phase === 'over')) pickGame(d.game); return;
      case 'pong': if (p && typeof d.t === 'number') { const r = performance.now() - d.t; if (r >= 0 && r < 3000) p.rtt = p.rtt == null ? r : p.rtt * 0.7 + r * 0.3; } return;
      case 'tap': case 'jump': case 'joy': case 'dash': case 'ans': case 'toss':
        if (p && mini && S.phase === 'play') mini.input(partOf(p), d, performance.now());
        return;
      case 'aim': if (p && isTurn(p)) game.setAim(d.ax, d.p); return;
      case 'throw':
        if (p && isTurn(p) && game.throw(d.ax, d.p)) { hideBanner(); broadcast(); }
        return;
    }
  }

  function join(conn, d) {
    const cid = String(d.cid || '').slice(0, 40);
    const name = (String(d.name || '').trim() || 'Παίκτης').slice(0, 12);
    let p = S.players.find((x) => x.cid === cid);
    if (p) {
      if (p.conn && p.conn !== conn) { byConn.delete(p.conn); try { p.conn.close(); } catch (e) {} }
      p.conn = conn; p.connected = true; p.name = name;
    } else {
      if (S.phase !== 'lobby') return conn.send({ type: 'reject', reason: 'Το παιχνίδι έχει ήδη ξεκινήσει. Περίμενε τον επόμενο γύρο.' });
      if (S.players.length >= 4) return conn.send({ type: 'reject', reason: 'Το δωμάτιο είναι γεμάτο (4 παίκτες).' });
      const used = S.players.map((x) => x.color.hex);
      const color = TVP.COLORS.find((c) => !used.includes(c.hex));
      p = { cid, name, color, conn, connected: true, cups: [], throws: 0, made: 0 };
      S.players.push(p);
      SFX.join();
    }
    byConn.set(conn, p);
    renderAll();
    broadcast();
    // αν ήταν η σειρά του και η κίνηση είχε σταματήσει, συνέχισε
    if (S.phase === 'play' && !mini && game.state === 'idle' && S.players[S.turn] === p) beginTurn();
  }

  function onClose(conn) {
    const p = byConn.get(conn);
    byConn.delete(conn);
    if (!p || p.conn !== conn) return;
    p.connected = false; p.conn = null;
    if (S.phase === 'lobby') S.players.splice(S.players.indexOf(p), 1);
    else if (S.phase === 'play' && mini) { const q = partOf(p); if (q) { q.jx = q.jy = 0; } }
    else if (S.phase === 'play' && S.players[S.turn] === p && game.state === 'aiming') nextTurn();
    renderAll(); broadcast();
  }

  const isHost = (p) => S.players.find((x) => x.connected) === p;
  const isTurn = (p) => S.phase === 'play' && !mini && S.players[S.turn] === p;
  const left = (p) => p.cups.filter((c) => c.alive).length;

  function stateFor(p) {
    const cur = S.players[S.turn];
    const q = mini ? partOf(p) : null;
    return {
      type: 'state', phase: S.phase, code: roomCode, game: S.game,
      ctrl: q && S.phase === 'play' ? mini.ctrl(q) : null,
      score: q ? { v: q.score, of: mini.WIN } : null,
      me: { name: p.name, color: p.color, index: S.players.indexOf(p) },
      host: isHost(p), count: S.players.length,
      yourTurn: isTurn(p) && game.state === 'aiming',
      current: cur && S.phase === 'play' && !mini ? { name: cur.name, color: cur.color } : null,
      left: p.cups.length ? left(p) : S.cupsPerRack, total: S.cupsPerRack,
      winner: S.winner ? { name: S.winner.name, color: S.winner.color, me: S.winner === p } : null,
    };
  }
  function broadcast() { S.players.forEach((p) => send(p, stateFor(p))); }

  // ---------- ροή παιχνιδιού ----------
  function startGame() {
    if (!S.players.some((p) => p.connected)) return;
    audio();
    S.players = S.players.filter((p) => p.connected);
    if (mini) { mini.end(); mini = null; }
    if (S.game !== 'cups') return startMini();
    game.paused = false; $('#stage').hidden = false; $('#playersBar').hidden = false;
    S.players.forEach((p) => { p.cups = CupsGame.rack(S.cupsPerRack); p.throws = 0; p.made = 0; });
    S.phase = 'play'; S.turn = 0; S.winner = null;
    $('#lobby').hidden = true; $('#over').hidden = true; $('#hud').hidden = false;
    beginTurn();
  }

  function beginTurn() {
    const p = S.players[S.turn];
    if (!p) return;
    if (!p.connected) {
      if (!S.players.some((x) => x.connected)) { game.freeze(); banner('Αναμονή για παίκτες…'); return; }
      return nextTurn();
    }
    game.setTurn(p);
    banner(S.players.length > 1 ? `Σειρά: ${p.name}` : `Ρίξε, ${p.name}!`, p.color.hex, true);
    renderPlayers(); broadcast();
  }

  function onThrowDone(made) {
    const p = S.players[S.turn];
    if (!p) return;
    p.throws++; if (made) p.made++;
    if (!made) send(p, { type: 'result', made: false });
    if (left(p) === 0) return win(p);
    nextTurn();
  }

  function nextTurn() {
    const n = S.players.length;
    for (let i = 1; i <= n; i++) {
      const j = (S.turn + i) % n;
      if (S.players[j].connected) { S.turn = j; return beginTurn(); }
    }
    beginTurn();
  }

  function startMini() {
    parts = S.players.map((p) => ({ name: p.name, color: p.color, p, bot: false }));
    if (parts.length === 1) {
      // μόνος σου; παίζεις με ένα ρομπότ
      const used = parts.map((q) => q.color.hex);
      parts.push({ name: 'Ρομπότ', color: TVP.COLORS.find((c) => !used.includes(c.hex)), p: null, bot: true });
    }
    S.phase = 'play'; S.winner = null;
    mini = minis[S.game];
    game.freeze(); game.paused = true; $('#stage').hidden = true;
    $('#lobby').hidden = true; $('#over').hidden = true; $('#hud').hidden = false; $('#playersBar').hidden = true;
    mini.begin(parts);
    broadcast();
  }

  function miniOver(res) {
    S.phase = 'over'; S.winner = res.winner.p || res.winner;
    hideBanner();
    showOver(res.winner, res.stats, res.rank);
    broadcast();
  }

  function showOver(w, stats, rank) {
    $('#winName').textContent = w.name; $('#winName').style.color = w.color.hex;
    $('#winStats').textContent = stats;
    $('#rank').replaceChildren(...rank.map((q, i) => {
      const li = document.createElement('li');
      li.innerHTML = `<span class="dot"></span><b></b><span class="st"></span>`;
      li.querySelector('.dot').style.background = q.color.hex;
      li.querySelector('b').textContent = `${i + 1}. ${q.name}`;
      li.querySelector('.st').textContent = q.st;
      return li;
    }));
    setTimeout(() => { if (S.phase === 'over') { $('#over').hidden = false; $('#btnAgain').focus(); } }, 1200);
  }

  function win(p) {
    S.phase = 'over'; S.winner = p;
    game.freeze(); game.celebrate(p.color.hex); SFX.win();
    hideBanner();
    const rank = [...S.players].sort((a, b) => left(a) - left(b) || a.throws - b.throws);
    showOver(p, `Καθάρισε όλα τα ποτηράκια σε ${p.throws} ρίψεις`,
      rank.map((q) => ({ name: q.name, color: q.color, st: `${q.made}/${S.cupsPerRack} ποτηράκια · ${q.throws} ρίψεις` })));
    renderPlayers(); broadcast();
  }

  function toLobby() {
    S.phase = 'lobby'; S.winner = null;
    S.players = S.players.filter((p) => p.connected);
    S.players.forEach((p) => (p.cups = []));
    if (mini) { mini.end(); mini = null; }
    game.paused = false; $('#stage').hidden = false;
    $('#over').hidden = true; $('#hud').hidden = true; $('#lobby').hidden = false;
    game.setDemo(true);
    renderAll(); broadcast();
    $('#btnStart').focus();
  }

  // ---------- UI ----------
  let bannerT = null;
  function banner(text, color, sticky) {
    const b = $('#banner');
    b.textContent = text; b.style.setProperty('--c', color || '#fff');
    b.classList.remove('show'); void b.offsetWidth; b.classList.add('show');
    clearTimeout(bannerT);
    if (!sticky) bannerT = setTimeout(hideBanner, 1400);
  }
  function hideBanner() { $('#banner').classList.remove('show'); }

  function renderSlots() {
    const el = $('#slots'); el.replaceChildren();
    for (let i = 0; i < 4; i++) {
      const p = S.players[i], d = document.createElement('div');
      d.className = 'slot' + (p ? ' on' : '');
      const c = p ? p.color.hex : TVP.COLORS[i].hex;
      d.style.setProperty('--c', c);
      d.innerHTML = `<div class="av"></div><div class="nm"></div>`;
      d.querySelector('.av').textContent = p ? p.name.slice(0, 1).toUpperCase() : '+';
      d.querySelector('.nm').textContent = p ? p.name : 'Ελεύθερη θέση';
      el.appendChild(d);
    }
    $('#btnStart').disabled = !S.players.length;
    $('#startHint').textContent = S.players.length
      ? 'Πάτα «Έναρξη» με το τηλεχειριστήριο ή από το κινητό του παίκτη 1.'
      : 'Περιμένουμε τον πρώτο παίκτη…';
  }

  function renderPlayers() {
    const el = $('#playersBar'); el.replaceChildren();
    S.players.forEach((p, i) => {
      const d = document.createElement('div');
      d.className = 'pl' + (i === S.turn && S.phase === 'play' ? ' cur' : '') + (p.connected ? '' : ' off');
      d.style.setProperty('--c', p.color.hex);
      const dots = p.cups.map((c) => `<i class="${c.alive ? '' : 'gone'}"></i>`).join('');
      d.innerHTML = `<div class="nm"></div><div class="dots">${dots}</div><div class="lf"></div>`;
      d.querySelector('.nm').textContent = p.name + (p.connected ? '' : ' (εκτός)');
      d.querySelector('.lf').textContent = `${left(p)} απομένουν`;
      el.appendChild(d);
    });
  }
  function renderAll() { renderSlots(); renderPlayers(); }

  $('#btnStart').addEventListener('click', startGame);
  $('#btnCups').addEventListener('click', () => {
    S.cupsPerRack = S.cupsPerRack === 10 ? 6 : S.cupsPerRack === 6 ? 3 : 10;
    $('#btnCups').textContent = `Ποτηράκια: ${S.cupsPerRack}`;
    broadcast();
  });
  if (TVP.isApp) $('#btnFull').hidden = true; // η εφαρμογή είναι ήδη σε πλήρη οθόνη
  $('#btnFull').addEventListener('click', () => {
    if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen?.();
  });
  $('#btnAgain').addEventListener('click', startGame);
  $('#btnLobby').addEventListener('click', toLobby);

  // πλοήγηση με τα βελάκια του τηλεχειριστηρίου Android TV (χωρική: πάει στο πιο κοντινό κουμπί προς τα εκεί)
  addEventListener('keydown', (e) => {
    const dir = { ArrowLeft: 'l', ArrowRight: 'r', ArrowUp: 'u', ArrowDown: 'd' }[e.key];
    if (!dir) return;
    const btns = [...document.querySelectorAll('section:not([hidden]) .btn:not(:disabled):not([hidden])')];
    if (!btns.length) return;
    e.preventDefault();
    const cur = document.activeElement;
    if (!btns.includes(cur)) return btns[0].focus();
    const a = cur.getBoundingClientRect(), ax = a.left + a.width / 2, ay = a.top + a.height / 2;
    let best = null, bs = Infinity;
    for (const b of btns) {
      if (b === cur) continue;
      const r = b.getBoundingClientRect(), dx = r.left + r.width / 2 - ax, dy = r.top + r.height / 2 - ay;
      const ok = dir === 'r' ? dx > 4 : dir === 'l' ? dx < -4 : dir === 'd' ? dy > 4 : dy < -4;
      if (!ok) continue;
      const h = dir === 'l' || dir === 'r';
      const sc = (h ? Math.abs(dx) : Math.abs(dy)) + (h ? Math.abs(dy) : Math.abs(dx)) * 2.5;
      if (sc < bs) { bs = sc; best = b; }
    }
    if (best) best.focus();
  });

  // ---------- επιλογή παιχνιδιού ----------
  const ICONS = {
    cups: '<svg viewBox="0 0 64 64"><path d="M14 18h36l-6 38H20z" fill="#f0544f" stroke="#1c1a2b" stroke-width="3" stroke-linejoin="round"/><ellipse cx="32" cy="18" rx="18" ry="5" fill="#fff" stroke="#1c1a2b" stroke-width="3"/><circle cx="46" cy="9" r="6" fill="#fff" stroke="#1c1a2b" stroke-width="3"/></svg>',
    star: '<svg viewBox="0 0 64 64"><path d="M32 5l7.6 16.6 18 2-13.4 12.3 3.7 17.8L32 44.6 16.1 53.7l3.7-17.8L6.4 23.6l18-2z" fill="#ffc93d" stroke="#1c1a2b" stroke-width="3" stroke-linejoin="round"/><ellipse cx="27" cy="32" rx="2" ry="3" fill="#1c1a2b"/><ellipse cx="37" cy="32" rx="2" ry="3" fill="#1c1a2b"/></svg>',
    balloon: '<svg viewBox="0 0 64 64"><path d="M32 46c-2 6 4 8 1 15" fill="none" stroke="#1c1a2b" stroke-width="2.5"/><ellipse cx="32" cy="25" rx="16" ry="20" fill="#3da9ff" stroke="#1c1a2b" stroke-width="3"/><path d="M29 45h6l-3 4z" fill="#2a7fc4" stroke="#1c1a2b" stroke-width="2.5" stroke-linejoin="round"/><ellipse cx="25" cy="17" rx="3" ry="6" fill="#fff" opacity=".6" transform="rotate(25 25 17)"/></svg>',
    who: '<svg viewBox="0 0 64 64"><rect x="10" y="6" width="44" height="52" rx="8" fill="#3a2580" stroke="#1c1a2b" stroke-width="3"/><circle cx="32" cy="27" r="9" fill="#9b5de5"/><path d="M16 52c2-10 9-14 16-14s14 4 16 14z" fill="#9b5de5"/><text x="32" y="32" text-anchor="middle" font-size="15" font-weight="800" fill="#ffc93d" font-family="sans-serif">?</text></svg>',
    tomato: '<svg viewBox="0 0 64 64"><ellipse cx="32" cy="36" rx="22" ry="20" fill="#e8302a" stroke="#1c1a2b" stroke-width="3"/><path d="M32 17l5-6 1 7 7-2-5 6-8 1-8-1-5-6 7 2 1-7z" fill="#3aa64a" stroke="#1c1a2b" stroke-width="2.5" stroke-linejoin="round"/><ellipse cx="23" cy="30" rx="3.5" ry="6" fill="#fff" opacity=".5" transform="rotate(30 23 30)"/></svg>',
    race: '<svg viewBox="0 0 64 64"><rect x="4" y="40" width="56" height="16" rx="3" fill="#d65a3a" stroke="#1c1a2b" stroke-width="3"/><path d="M4 48h56" stroke="#fff" stroke-width="2"/><path d="M50 40v16" stroke="#fff" stroke-width="3" stroke-dasharray="3 3"/><path d="M26 30l-6 10M30 30l8 9" stroke="#1c1a2b" stroke-width="4" stroke-linecap="round"/><rect x="22" y="17" width="11" height="15" rx="4" fill="#ffc93d" stroke="#1c1a2b" stroke-width="3" transform="rotate(15 27 24)"/><circle cx="31" cy="11" r="6" fill="#ffd9b3" stroke="#1c1a2b" stroke-width="3"/><path d="M10 20h8M6 26h9M12 32h6" stroke="#fff" stroke-width="3" stroke-linecap="round"/></svg>',
    trail: '<svg viewBox="0 0 64 64"><path d="M14 4L4 26h20z" fill="#3f8a4a" stroke="#1c1a2b" stroke-width="2.5" stroke-linejoin="round"/><path d="M50 2l-9 20h18z" fill="#2f7a3f" stroke="#1c1a2b" stroke-width="2.5" stroke-linejoin="round"/><path d="M2 58c10-6 50-6 60 0" fill="#c89a5e" stroke="#1c1a2b" stroke-width="3"/><rect x="34" y="44" width="24" height="10" rx="5" fill="#8b5a2b" stroke="#1c1a2b" stroke-width="3"/><ellipse cx="53" cy="49" rx="3" ry="4" fill="#e1b47a" stroke="#1c1a2b" stroke-width="2"/><path d="M18 34l-6 6M22 34l7 5" stroke="#1c1a2b" stroke-width="4" stroke-linecap="round"/><rect x="15" y="20" width="10" height="14" rx="4" fill="#ffc93d" stroke="#1c1a2b" stroke-width="3" transform="rotate(18 20 27)"/><circle cx="24" cy="15" r="5.5" fill="#ffd9b3" stroke="#1c1a2b" stroke-width="3"/><path d="M30 30q6-10 12 0" fill="none" stroke="#fff" stroke-width="2.5" stroke-dasharray="3 3"/></svg>',
    panda: '<svg viewBox="0 0 64 64"><path d="M8 2q6 14 22 20" fill="none" stroke="#3e8a2a" stroke-width="3.5" stroke-linecap="round"/><circle cx="22" cy="24" r="6" fill="#1f1d2a"/><circle cx="44" cy="24" r="6" fill="#1f1d2a"/><circle cx="33" cy="37" r="16" fill="#fff" stroke="#1c1a2b" stroke-width="3"/><ellipse cx="26" cy="36" rx="4.5" ry="6" fill="#1f1d2a" transform="rotate(30 26 36)"/><ellipse cx="40" cy="36" rx="4.5" ry="6" fill="#1f1d2a" transform="rotate(-30 40 36)"/><circle cx="27" cy="35" r="1.6" fill="#fff"/><circle cx="41" cy="35" r="1.6" fill="#fff"/><ellipse cx="33" cy="44" rx="3" ry="2" fill="#1f1d2a"/><rect x="50" y="30" width="6" height="30" rx="2" fill="#7cc84a" stroke="#1c1a2b" stroke-width="2.5"/><path d="M50 40h6M50 50h6" stroke="#3d7a24" stroke-width="2"/><path d="M56 32q6-4 7 2" fill="#5fb83a"/></svg>',
    longjump: '<svg viewBox="0 0 64 64"><rect x="2" y="48" width="30" height="10" fill="#d65a3a" stroke="#1c1a2b" stroke-width="3"/><rect x="26" y="48" width="5" height="10" fill="#fff" stroke="#1c1a2b" stroke-width="2"/><rect x="31" y="48" width="31" height="10" fill="#f0d49b" stroke="#1c1a2b" stroke-width="3"/><path d="M10 40q20-34 44 4" fill="none" stroke="#fff" stroke-width="2.5" stroke-dasharray="3 4"/><path d="M33 26l9 5M35 30l4 9" stroke="#1c1a2b" stroke-width="4" stroke-linecap="round"/><rect x="25" y="13" width="10" height="14" rx="4" fill="#3da9ff" stroke="#1c1a2b" stroke-width="3" transform="rotate(-25 30 20)"/><circle cx="26" cy="9" r="5.5" fill="#ffd9b3" stroke="#1c1a2b" stroke-width="3"/></svg>',
    sumo: '<svg viewBox="0 0 64 64"><ellipse cx="32" cy="44" rx="28" ry="13" fill="#f2d39a" stroke="#1c1a2b" stroke-width="3"/><circle cx="22" cy="33" r="10" fill="#9b5de5" stroke="#1c1a2b" stroke-width="3"/><circle cx="43" cy="31" r="10" fill="#2ecc71" stroke="#1c1a2b" stroke-width="3"/><path d="M32 12l2 6 6-2-4 5 5 3-6 1 1 6-4-4-4 4 1-6-6-1 5-3-4-5 6 2z" fill="#ffc93d" stroke="#1c1a2b" stroke-width="2" stroke-linejoin="round"/></svg>',
  };
  function renderGames() {
    $('#games').replaceChildren(...TVP.GAMES.map((g) => {
      const b = document.createElement('button');
      b.className = 'btn game' + (g.id === S.game ? ' sel' : '');
      b.innerHTML = `${ICONS[g.id] || ''}<span></span>`;
      b.querySelector('span').textContent = g.title;
      b.addEventListener('click', () => pickGame(g.id));
      return b;
    }));
  }
  function pickGame(id) {
    if (!TVP.GAMES.some((g) => g.id === id)) return;
    const had = document.activeElement && document.activeElement.classList.contains('game');
    S.game = id; localStorage.setItem('tvp_game', id);
    const m = meta();
    $('#gTitle').innerHTML = '';
    $('#gTitle').append(m.title + ' ', Object.assign(document.createElement('span'), { textContent: m.sub }));
    $('#gTag').textContent = m.tag + ' Από 1 έως 4 παίκτες' + (m.turns ? '.' : ' (αν είσαι μόνος, παίζεις με ρομπότ).');
    $('#gHow').textContent = m.how;
    $('#btnCups').hidden = id !== 'cups';
    renderGames();
    if (had) $('#games .game.sel').focus();
    if (S.phase === 'over') $('#btnAgain').textContent = `Ξανά: ${m.title}`;
    broadcast();
  }

  // μέτρηση καθυστέρησης δικτύου για κάθε κινητό (χρειάζεται στο «Αστεράκι»)
  setInterval(() => S.players.forEach((p) => send(p, { type: 'ping', t: performance.now() })), 1500);

  pickGame(S.game);
  renderAll();
  $('#btnStart').focus();
  startPeer();
  window.__tv = { S, game, startGame, controllerURL, minis, pickGame, get mini() { return mini; }, get parts() { return parts; } };
})();
