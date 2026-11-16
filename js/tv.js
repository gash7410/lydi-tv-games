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
  };
  addEventListener('keydown', audio, { once: true });
  addEventListener('pointerdown', audio, { once: true });

  // ---------- κατάσταση ----------
  const S = { phase: 'lobby', players: [], turn: 0, cupsPerRack: 10, winner: null };
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
    const p = byConn.get(conn);
    switch (d.type) {
      case 'join': return join(conn, d);
      case 'start': if (p && isHost(p) && (S.phase === 'lobby' || S.phase === 'over')) startGame(); return;
      case 'lobby': if (p && isHost(p) && S.phase === 'over') toLobby(); return;
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
    if (S.phase === 'play' && game.state === 'idle' && S.players[S.turn] === p) beginTurn();
  }

  function onClose(conn) {
    const p = byConn.get(conn);
    byConn.delete(conn);
    if (!p || p.conn !== conn) return;
    p.connected = false; p.conn = null;
    if (S.phase === 'lobby') S.players.splice(S.players.indexOf(p), 1);
    else if (S.phase === 'play' && S.players[S.turn] === p && game.state === 'aiming') nextTurn();
    renderAll(); broadcast();
  }

  const isHost = (p) => S.players.find((x) => x.connected) === p;
  const isTurn = (p) => S.phase === 'play' && S.players[S.turn] === p;
  const left = (p) => p.cups.filter((c) => c.alive).length;

  function stateFor(p) {
    const cur = S.players[S.turn];
    return {
      type: 'state', phase: S.phase, code: roomCode,
      me: { name: p.name, color: p.color, index: S.players.indexOf(p) },
      host: isHost(p), count: S.players.length,
      yourTurn: isTurn(p) && game.state === 'aiming',
      current: cur && S.phase === 'play' ? { name: cur.name, color: cur.color } : null,
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

  function win(p) {
    S.phase = 'over'; S.winner = p;
    game.freeze(); game.celebrate(p.color.hex); SFX.win();
    hideBanner();
    const rank = [...S.players].sort((a, b) => left(a) - left(b) || a.throws - b.throws);
    $('#winName').textContent = p.name; $('#winName').style.color = p.color.hex;
    $('#winStats').textContent = `Καθάρισε όλα τα ποτηράκια σε ${p.throws} ρίψεις`;
    $('#rank').replaceChildren(...rank.map((q, i) => {
      const li = document.createElement('li');
      li.innerHTML = `<span class="dot"></span><b></b><span class="st"></span>`;
      li.querySelector('.dot').style.background = q.color.hex;
      li.querySelector('b').textContent = `${i + 1}. ${q.name}`;
      li.querySelector('.st').textContent = `${q.made}/${S.cupsPerRack} ποτηράκια · ${q.throws} ρίψεις`;
      return li;
    }));
    setTimeout(() => { $('#over').hidden = false; $('#btnAgain').focus(); }, 1200);
    renderPlayers(); broadcast();
  }

  function toLobby() {
    S.phase = 'lobby'; S.winner = null;
    S.players = S.players.filter((p) => p.connected);
    S.players.forEach((p) => (p.cups = []));
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
      d.innerHTML = `<div class="cup-ico"></div><div class="nm"></div>`;
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

  // πλοήγηση με τα βελάκια του τηλεχειριστηρίου Android TV
  addEventListener('keydown', (e) => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
    const btns = [...document.querySelectorAll('section:not([hidden]) .btn:not(:disabled):not([hidden])')];
    if (!btns.length) return;
    const i = btns.indexOf(document.activeElement);
    const dir = e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 1;
    btns[(i + dir + btns.length) % btns.length].focus();
    e.preventDefault();
  });

  renderAll();
  $('#btnStart').focus();
  startPeer();
  window.__tv = { S, game, startGame, controllerURL };
})();
