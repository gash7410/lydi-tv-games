// Κινητό-χειριστήριο: σύνδεση στην τηλεόραση και ρίψη με σύρσιμο
(function () {
  'use strict';
  const $ = (s) => document.querySelector(s);
  const params = new URLSearchParams(location.search);
  let cid = localStorage.getItem('tvp_cid');
  if (!cid) { cid = Math.random().toString(36).slice(2) + Date.now().toString(36); localStorage.setItem('tvp_cid', cid); }

  $('#inCode').value = params.get('r') || localStorage.getItem('tvp_code') || '';
  $('#inName').value = localStorage.getItem('tvp_name') || '';

  let peer = null, conn = null, code = '', name = '', joined = false, st = null, retry = 0;

  function show(id) { ['#scrJoin', '#scrWait', '#scrPad'].forEach((s) => ($(s).hidden = s !== id)); }
  function setConn(ok, t) { const c = $('#conn'); c.textContent = t; c.classList.toggle('ok', !!ok); }

  $('#joinForm').addEventListener('submit', (e) => {
    e.preventDefault();
    code = $('#inCode').value.replace(/\D/g, '').slice(0, 4);
    name = $('#inName').value.trim().slice(0, 12);
    if (code.length !== 4 || !name) { $('#joinErr').textContent = 'Γράψε τον 4ψήφιο κωδικό και το όνομά σου.'; return; }
    localStorage.setItem('tvp_code', code); localStorage.setItem('tvp_name', name);
    $('#joinErr').textContent = '';
    $('#btnJoin').disabled = true; $('#btnJoin').textContent = 'Σύνδεση…';
    joined = true;
    connect();
    wakeLock();
  });

  function connect() {
    setConn(false, 'σύνδεση…');
    if (!peer || peer.destroyed) {
      peer = new Peer(TVP.peerOptions);
      peer.on('open', openConn);
      peer.on('error', (e) => {
        if (e.type === 'peer-unavailable') return fail('Δεν βρέθηκε τηλεόραση με κωδικό ' + code + '. Έλεγξε τον κωδικό.');
        scheduleRetry();
      });
      peer.on('disconnected', () => { if (!peer.destroyed) peer.reconnect(); });
    } else if (peer.open) openConn();
  }

  function openConn() {
    if (conn) try { conn.close(); } catch (e) {}
    conn = peer.connect(TVP.PREFIX + code, { reliable: true, serialization: 'json' });
    const myConn = conn;
    const to = setTimeout(() => { if (!myConn.open) scheduleRetry(); }, 9000);
    conn.on('open', () => {
      clearTimeout(to); retry = 0;
      setConn(true, 'συνδεδεμένο');
      conn.send({ type: 'join', cid, name });
    });
    conn.on('data', onData);
    conn.on('close', () => { if (myConn === conn) { setConn(false, 'αποσύνδεση'); scheduleRetry(); } });
    conn.on('error', () => scheduleRetry());
  }

  let retryT = null;
  function scheduleRetry() {
    if (!joined || retryT) return;
    retry++;
    if (retry > 6 && !st) return fail('Δεν ήταν δυνατή η σύνδεση. Δοκίμασε ξανά.');
    setConn(false, 'επανασύνδεση…');
    retryT = setTimeout(() => { retryT = null; connect(); }, Math.min(1000 * retry, 4000));
  }

  function fail(msg) {
    joined = false; retry = 0;
    show('#scrJoin');
    $('#joinErr').textContent = msg;
    $('#btnJoin').disabled = false; $('#btnJoin').textContent = 'Μπες στο παιχνίδι';
    setConn(false, 'εκτός σύνδεσης');
  }

  function onData(d) {
    if (!d || typeof d !== 'object') return;
    if (d.type === 'reject') { try { conn.close(); } catch (e) {} return fail(d.reason); }
    if (d.type === 'result') {
      if (d.made) { vibrate([60, 40, 120]); flash(); }
      else vibrate(25);
      return;
    }
    if (d.type === 'state') { st = d; render(); }
  }

  function render() {
    const s = st;
    document.body.style.setProperty('--c', s.me.color.hex);
    $('#myName').textContent = s.me.name;
    $('#myColor').textContent = `Παίκτης ${s.me.index + 1} · ${s.me.color.name}`;
    $('#padName').textContent = s.me.name;
    $('#padLeft').textContent = `Ποτηράκια: ${s.left}/${s.total}`;
    $('#btnStart').hidden = !(s.host && (s.phase === 'lobby' || s.phase === 'over'));
    $('#btnLobby').hidden = !(s.host && s.phase === 'over');
    $('#btnStart').textContent = s.phase === 'over' ? 'Ξανά' : 'Έναρξη παιχνιδιού';

    if (s.phase === 'play' && s.yourTurn) {
      if ($('#scrPad').hidden) { show('#scrPad'); resetBall(); vibrate(40); }
      return;
    }
    show('#scrWait');
    if (s.phase === 'lobby') {
      $('#waitMsg').textContent = 'Είσαι μέσα!';
      $('#waitSub').textContent = s.host
        ? `Παίκτες: ${s.count}/4. Όταν μπουν όλοι, πάτα «Έναρξη».`
        : `Παίκτες: ${s.count}/4. Περιμένουμε να ξεκινήσει ο παίκτης 1.`;
    } else if (s.phase === 'play') {
      $('#waitMsg').textContent = s.current ? `Ρίχνει: ${s.current.name}` : 'Περιμένουμε…';
      $('#waitSub').textContent = `Σου απομένουν ${s.left} από ${s.total} ποτηράκια. Κοίτα την τηλεόραση!`;
    } else if (s.phase === 'over') {
      $('#waitMsg').textContent = s.winner && s.winner.me ? '🏆 Κέρδισες!' : `Νίκησε: ${s.winner ? s.winner.name : ''}`;
      $('#waitSub').textContent = s.host ? 'Πάτα «Ξανά» για νέο γύρο.' : 'Περιμένουμε τον παίκτη 1 για νέο γύρο.';
    }
  }

  $('#btnStart').addEventListener('click', () => conn && conn.open && conn.send({ type: 'start' }));
  $('#btnLobby').addEventListener('click', () => conn && conn.open && conn.send({ type: 'lobby' }));

  // ---------- ρίψη ----------
  const pad = $('#pad'), ball = $('#ball'), fill = $('#meterFill');
  let drag = null, lastAim = 0, thrown = false;

  function calc(e) {
    const up = drag.y0 - e.clientY, dx = e.clientX - drag.x0;
    const H = pad.clientHeight;
    const p = Math.max(0, Math.min(1, up / (H * 0.62)));
    const ax = up > 12 ? Math.max(-1, Math.min(1, dx / up / 0.55)) : 0;
    return { up, dx, p, ax };
  }

  pad.addEventListener('pointerdown', (e) => {
    if (!st || !st.yourTurn || thrown) return;
    drag = { x0: e.clientX, y0: e.clientY, id: e.pointerId };
    try { pad.setPointerCapture(e.pointerId); } catch (err) {}
    ball.className = '';
    $('#padHint').style.opacity = 0.35;
  });
  pad.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const v = calc(e);
    const maxUp = pad.clientHeight * 0.72;
    ball.style.transform = `translate(${v.dx * 0.8}px, ${-Math.max(0, Math.min(v.up, maxUp))}px)`;
    fill.style.height = v.p * 100 + '%';
    const now = performance.now();
    if (now - lastAim > 50 && conn && conn.open) { lastAim = now; conn.send({ type: 'aim', ax: v.ax, p: v.p }); }
  });
  function release(e) {
    if (!drag || e.pointerId !== drag.id) return;
    const v = calc(e);
    drag = null;
    if (v.p > 0.06 && e.type === 'pointerup') {
      thrown = true;
      conn && conn.open && conn.send({ type: 'throw', ax: v.ax, p: v.p });
      vibrate(30);
      ball.className = 'fly';
      ball.style.transform = `translate(${v.ax * 120}px, ${-pad.clientHeight}px) scale(.3)`;
      setTimeout(() => { thrown = false; resetBall(); if (st) render(); }, 650);
    } else {
      conn && conn.open && conn.send({ type: 'aim', ax: 0, p: 0 });
      resetBall(true);
    }
  }
  pad.addEventListener('pointerup', release);
  pad.addEventListener('pointercancel', release);

  function resetBall(anim) {
    ball.className = anim ? 'back' : '';
    ball.style.transform = 'translate(0,0)';
    fill.style.height = '0%';
    $('#padHint').style.opacity = 1;
  }

  function vibrate(p) { try { navigator.vibrate && navigator.vibrate(p); } catch (e) {} }
  function flash() { const f = $('#flash'); f.classList.add('on'); requestAnimationFrame(() => requestAnimationFrame(() => f.classList.remove('on'))); }

  let lock = null;
  async function wakeLock() { try { lock = await navigator.wakeLock.request('screen'); } catch (e) {} }
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      if (joined) wakeLock();
      if (joined && (!conn || !conn.open)) connect();
    }
  });

  if (params.get('r') && $('#inName').value) $('#inName').focus();
  else if (params.get('r')) $('#inName').focus();
})();
