// Κινητό-χειριστήριο: σύνδεση στην τηλεόραση και ρίψη με σύρσιμο
(function () {
  'use strict';
  const $ = (s) => document.querySelector(s);
  const params = new URLSearchParams(location.search);
  // ?p=… ξεχωρίζει πολλά χειριστήρια στον ίδιο browser (σελίδα δοκιμής demo.html)
  const cidKey = 'tvp_cid' + (params.get('p') || '').replace(/\W/g, '').slice(0, 4);
  let cid = localStorage.getItem(cidKey);
  if (!cid) { cid = Math.random().toString(36).slice(2) + Date.now().toString(36); localStorage.setItem(cidKey, cid); }

  $('#inCode').value = params.get('r') || localStorage.getItem('tvp_code') || '';
  $('#inName').value = localStorage.getItem('tvp_name') || '';

  let peer = null, conn = null, code = '', name = '', joined = false, st = null, retry = 0;
  let stage = 'server', hintT = null; // server: δεν απαντά ο server PeerJS · tv: δεν ανοίγει το κανάλι προς την τηλεόραση
  const hintText = () => stage === 'server'
    ? 'Ακόμα συνδέεται… Έλεγξε ότι το κινητό έχει internet.'
    : 'Ακόμα συνδέεται… Βάλε το κινητό στο ίδιο Wi‑Fi με την τηλεόραση (όχι δεδομένα κινητής ή Wi‑Fi επισκεπτών).';

  function show(id) { ['#scrJoin', '#scrWait', '#scrPad', '#scrTap', '#scrJoy', '#scrRun', '#scrPlat', '#scrChoice'].forEach((s) => ($(s).hidden = s !== id)); }
  const sendMsg = (m) => { if (conn && conn.open) try { conn.send(m); } catch (e) {} };
  function setConn(ok, t) { const c = $('#conn'); c.textContent = t; c.classList.toggle('ok', !!ok); }

  $('#joinForm').addEventListener('submit', (e) => {
    e.preventDefault();
    code = $('#inCode').value.replace(/\D/g, '').slice(0, 4);
    name = $('#inName').value.trim().slice(0, 12);
    if (code.length !== 4 || !name) { $('#joinErr').textContent = 'Γράψε τον 4ψήφιο κωδικό και το όνομά σου.'; return; }
    localStorage.setItem('tvp_code', code); localStorage.setItem('tvp_name', name);
    $('#joinErr').textContent = '';
    if (!window.Peer || !window.RTCPeerConnection) {
      $('#joinErr').textContent = 'Αυτός ο browser δεν υποστηρίζει τη σύνδεση. Άνοιξε τη σελίδα σε Chrome ή Safari (όχι μέσα από την εφαρμογή σάρωσης QR).';
      return;
    }
    $('#btnJoin').disabled = true; $('#btnJoin').textContent = 'Σύνδεση…';
    joined = true; retry = 0; stage = 'server';
    clearTimeout(hintT);
    hintT = setTimeout(() => { if (joined && !st) $('#joinErr').textContent = hintText(); }, 12000);
    connect();
    wakeLock();
  });

  function connect() {
    setConn(false, 'σύνδεση…');
    if (!peer || peer.destroyed) {
      try { peer = new Peer(TVP.peerOptions); } catch (e) { return fail('Δεν ήταν δυνατή η σύνδεση σε αυτόν τον browser. Δοκίμασε σε Chrome ή Safari.'); }
      peer.on('open', openConn);
      peer.on('error', (e) => {
        if (e.type === 'peer-unavailable') return fail('Δεν βρέθηκε τηλεόραση με κωδικό ' + code + '. Έλεγξε τον κωδικό.');
        scheduleRetry();
      });
      peer.on('disconnected', () => { if (!peer.destroyed) peer.reconnect(); });
    } else if (peer.open) return openConn();
    // αν ο server δεν απαντήσει, ξαναφτιάξε το peer αντί να περιμένεις για πάντα
    const myPeer = peer;
    setTimeout(() => {
      if (joined && myPeer === peer && !myPeer.open) { try { myPeer.destroy(); } catch (e) {} peer = null; scheduleRetry(); }
    }, 10000);
  }

  function openConn() {
    if (!joined) return;
    stage = 'tv';
    if (conn) try { conn.close(); } catch (e) {}
    conn = peer.connect(TVP.PREFIX + code, { reliable: true, serialization: 'json' });
    const myConn = conn;
    const to = setTimeout(() => { if (!myConn.open) scheduleRetry(); }, 9000);
    conn.on('open', () => {
      clearTimeout(to); retry = 0; clearTimeout(hintT);
      $('#joinErr').textContent = '';
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
    if (retry > 3 && !st) {
      return fail(stage === 'server'
        ? 'Δεν ήταν δυνατή η σύνδεση στον server. Έλεγξε ότι το κινητό έχει internet και δοκίμασε ξανά.'
        : 'Το κινητό δεν μπόρεσε να φτάσει στην τηλεόραση. Σύνδεσέ το στο ίδιο Wi‑Fi με την τηλεόραση (όχι δεδομένα κινητής ή Wi‑Fi επισκεπτών) και δοκίμασε ξανά.');
    }
    setConn(false, 'επανασύνδεση…');
    retryT = setTimeout(() => { retryT = null; connect(); }, Math.min(1000 * retry, 4000));
  }

  function fail(msg) {
    joined = false; retry = 0; clearTimeout(hintT);
    if (retryT) { clearTimeout(retryT); retryT = null; }
    if (conn) { const c = conn; conn = null; try { c.close(); } catch (e) {} }
    show('#scrJoin');
    $('#joinErr').textContent = msg;
    $('#btnJoin').disabled = false; $('#btnJoin').textContent = 'Μπες στο παιχνίδι';
    setConn(false, 'εκτός σύνδεσης');
  }

  function onData(d) {
    if (!d || typeof d !== 'object') return;
    if (d.type === 'ping') return sendMsg({ type: 'pong', t: d.t });
    if (d.type === 'fx') {
      if (d.vib) vibrate(d.vib);
      if (d.flash) flash();
      return showFx(d.text);
    }
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
    $('#myAv').textContent = s.me.name.slice(0, 1).toUpperCase();
    const gm = TVP.GAMES.find((g) => g.id === s.game) || TVP.GAMES[0];
    document.querySelectorAll('.pName').forEach((e) => (e.textContent = s.me.name));
    document.querySelectorAll('.pScore').forEach((e) => (e.textContent = s.score ? `Πόντοι: ${s.score.v}${s.score.of ? '/' + s.score.of : ''}` : ''));
    $('#gameNow').innerHTML = '';
    $('#gameNow').append('Παιχνίδι: ', Object.assign(document.createElement('b'), { textContent: gm.title }));
    const canPick = s.host && (s.phase === 'lobby' || s.phase === 'over');
    $('#picker').hidden = !canPick;
    if (canPick) {
      $('#picker').replaceChildren(...TVP.GAMES.map((g) => {
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'pick' + (g.id === s.game ? ' sel' : '');
        b.textContent = g.title;
        b.addEventListener('click', () => sendMsg({ type: 'pick', game: g.id }));
        return b;
      }));
    }
    $('#myColor').textContent = `Παίκτης ${s.me.index + 1} · ${s.me.color.name}`;
    $('#padName').textContent = s.me.name;
    $('#padLeft').textContent = `Ποτηράκια: ${s.left}/${s.total}`;
    $('#btnStart').hidden = !(s.host && (s.phase === 'lobby' || s.phase === 'over'));
    $('#btnLobby').hidden = !(s.host && s.phase === 'over');
    $('#btnStart').textContent = s.phase === 'over' ? 'Ξανά' : 'Έναρξη παιχνιδιού';

    const tossMode = s.phase === 'play' && s.ctrl && s.ctrl.mode === 'throw';
    const skin = tossMode ? s.ctrl.skin || 'tomato' : '';
    $('#scrPad').classList.toggle('tomato', skin === 'tomato');
    $('#scrPad').classList.toggle('hoops', skin === 'hoops');
    if (tossMode) {
      if ($('#scrPad').hidden) { show('#scrPad'); resetBall(); vibrate(40); }
      $('#padName').textContent = s.me.name;
      $('#padLeft').textContent = s.ctrl.scoreText || (s.score ? `Πετυχημένες: ${s.score.v}/${s.score.of}` : '');
      $('#padHint').innerHTML = s.ctrl.active ? s.ctrl.hint || 'Σύρε τη ντομάτα προς τα πάνω<br><small>όσο πιο ψηλά, τόσο πιο ψηλά στον Μητσοτάκη · λοξά για στόχευση</small>' : s.ctrl.label;
      $('#pad').classList.toggle('off', !s.ctrl.active);
      return;
    }
    $('#pad').classList.remove('off');
    $('#padHint').innerHTML = 'Σύρε το μπαλάκι προς τα πάνω<br><small>όσο πιο ψηλά, τόσο πιο δυνατά · λοξά για στόχευση</small>';
    if (s.phase === 'play' && s.yourTurn) {
      if ($('#scrPad').hidden) { show('#scrPad'); resetBall(); vibrate(40); }
      return;
    }
    if (s.phase === 'play' && s.ctrl && s.ctrl.mode === 'tap') {
      show('#scrTap');
      $('#tapLabel').textContent = s.ctrl.label;
      $('#tapSub').textContent = s.ctrl.sub || '';
      $('#tapBtn').classList.toggle('off', !s.ctrl.active);
      return;
    }
    if (s.phase === 'play' && s.ctrl && s.ctrl.mode === 'joy') {
      if ($('#scrJoy').hidden) { show('#scrJoy'); vibrate(30); }
      $('#joyMsg').textContent = s.ctrl.active ? '' : (s.ctrl.label || '');
      $('#joySub').textContent = s.ctrl.active ? 'Σύρε τον κύκλο για να κινηθείς' : (s.ctrl.sub || '');
      $('#scrJoy').classList.toggle('off', !s.ctrl.active);
      dashBtn.textContent = s.ctrl.btn || 'ΩΘΗΣΗ';
      dashCd = s.ctrl.cdMs || 1400;
      if (!s.ctrl.active) joyReset();
      return;
    }
    if (s.phase === 'play' && s.ctrl && s.ctrl.mode === 'run') {
      if ($('#scrRun').hidden) { show('#scrRun'); vibrate(30); }
      $('#runMsg').textContent = s.ctrl.active ? '' : (s.ctrl.label || '');
      $('#runSub').textContent = s.ctrl.sub || '';
      $('#scrRun').classList.toggle('off', !s.ctrl.active);
      $('#runBtn small').textContent = s.ctrl.runHint || 'πάτα γρήγορα';
      $('#jumpBtn small').textContent = s.ctrl.jumpHint || 'πριν το εμπόδιο';
      return;
    }
    if (s.phase === 'play' && s.ctrl && s.ctrl.mode === 'plat') {
      if ($('#scrPlat').hidden) { show('#scrPlat'); vibrate(30); }
      $('#platScore').textContent = s.ctrl.scoreText || '';
      $('#platMsg').textContent = s.ctrl.label || '';
      $('#platSub').textContent = s.ctrl.sub || '';
      $('#scrPlat').classList.toggle('off', !s.ctrl.active);
      return;
    }
    if (s.phase === 'play' && s.ctrl && s.ctrl.mode === 'choice') {
      if ($('#scrChoice').hidden) { show('#scrChoice'); vibrate(30); }
      renderChoice(s.ctrl);
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
      $('#gameNow').textContent = '';
      $('#waitSub').textContent = `Σου απομένουν ${s.left} από ${s.total} ποτηράκια. Κοίτα την τηλεόραση!`;
    } else if (s.phase === 'over') {
      $('#waitMsg').textContent = s.winner && s.winner.me ? '🏆 Κέρδισες!' : `Νίκησε: ${s.winner ? s.winner.name : ''}`;
      $('#waitSub').textContent = s.host ? 'Πάτα «Ξανά» για νέο γύρο.' : 'Περιμένουμε τον παίκτη 1 για νέο γύρο.';
    }
  }

  // ---------- μεγάλο κουμπί (Αστεράκι, Μπαλόνια) ----------
  const tapBtn = $('#tapBtn');
  tapBtn.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    sendMsg({ type: 'tap' });
    tapBtn.classList.remove('hit'); void tapBtn.offsetWidth; tapBtn.classList.add('hit');
    vibrate(12);
  });
  tapBtn.addEventListener('contextmenu', (e) => e.preventDefault());

  // ---------- τρέξιμο + άλμα (Δασόδρομος) ----------
  // το «ΤΡΕΞΕ» στέλνει tap και πριν τη σφυρίχτρα, ώστε να μετράει η άκυρη εκκίνηση
  [['#runBtn', 'tap', 10], ['#jumpBtn', 'jump', 25]].forEach(([sel, type, vib]) => {
    const b = $(sel);
    b.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      sendMsg({ type });
      b.classList.remove('hit'); void b.offsetWidth; b.classList.add('hit');
      vibrate(vib);
    });
    b.addEventListener('contextmenu', (e) => e.preventDefault());
  });


  // ---------- ◀ ▶ + ΑΛΜΑ + ΦΟΥΣΚΑ (Φουσκοπάντα) ----------
  // τα βελάκια στέλνουν την κατεύθυνση όσο είναι πατημένα (και ξανά κάθε 400ms, μήπως χαθεί μήνυμα)
  const held = { L: new Set(), R: new Set() };
  let platDir = 0, platTimer = null;
  function platSend() {
    const d = (held.R.size ? 1 : 0) - (held.L.size ? 1 : 0);
    if (d !== platDir) { platDir = d; sendMsg({ type: 'move', d }); }
    clearInterval(platTimer);
    if (d) platTimer = setInterval(() => sendMsg({ type: 'move', d: platDir }), 400);
  }
  [['#platL', 'L'], ['#platR', 'R']].forEach(([sel, k]) => {
    const b = $(sel);
    b.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      try { b.setPointerCapture(e.pointerId); } catch (er) {}
      held[k].add(e.pointerId); b.classList.add('down'); platSend(); vibrate(8);
    });
    const up = (e) => { held[k].delete(e.pointerId); if (!held[k].size) b.classList.remove('down'); platSend(); };
    b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('lostpointercapture', up);
    b.addEventListener('contextmenu', (e) => e.preventDefault());
  });
  [['#platJump', 'jump', 15], ['#platShoot', 'dash', 25]].forEach(([sel, type, vib]) => {
    const b = $(sel);
    b.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      sendMsg({ type });
      b.classList.remove('hit'); void b.offsetWidth; b.classList.add('hit');
      vibrate(vib);
    });
    b.addEventListener('contextmenu', (e) => e.preventDefault());
  });

  // ---------- joystick + ορμή (Σπρωξίματα) ----------
  const joy = $('#joy'), knob = $('#knob'), dashBtn = $('#dashBtn');
  let jd = null, lastJoy = 0, jv = { x: 0, y: 0 }, joyTimer = null;
  function joySend(force) {
    const now = performance.now();
    if (!force && now - lastJoy < 40) {
      if (!joyTimer) joyTimer = setTimeout(() => { joyTimer = null; joySend(true); }, 40);
      return;
    }
    lastJoy = now; sendMsg({ type: 'joy', x: +jv.x.toFixed(3), y: +jv.y.toFixed(3) });
  }
  function joyMove(e) {
    const r = joy.getBoundingClientRect(), R = r.width / 2;
    let dx = e.clientX - (r.left + R), dy = e.clientY - (r.top + R);
    const l = Math.hypot(dx, dy), m = R * 0.62;
    if (l > m) { dx = (dx / l) * m; dy = (dy / l) * m; }
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
    jv = { x: dx / m, y: dy / m };
    joySend();
  }
  function joyReset() {
    jd = null; knob.style.transform = 'translate(0,0)';
    if (jv.x || jv.y) { jv = { x: 0, y: 0 }; joySend(true); }
  }
  joy.addEventListener('pointerdown', (e) => {
    if ($('#scrJoy').classList.contains('off')) return;
    jd = e.pointerId; try { joy.setPointerCapture(e.pointerId); } catch (er) {}
    joyMove(e);
  });
  joy.addEventListener('pointermove', (e) => { if (e.pointerId === jd) joyMove(e); });
  joy.addEventListener('pointerup', (e) => { if (e.pointerId === jd) joyReset(); });
  joy.addEventListener('pointercancel', (e) => { if (e.pointerId === jd) joyReset(); });
  let dashReady = 0, dashCd = 1400;
  dashBtn.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if ($('#scrJoy').classList.contains('off') || performance.now() < dashReady) return;
    dashReady = performance.now() + dashCd;
    sendMsg({ type: 'dash' });
    vibrate(35);
    dashBtn.classList.add('cool');
    setTimeout(() => dashBtn.classList.remove('cool'), dashCd);
  });

  // ---------- 4 απαντήσεις («Ποιος είναι;») ----------
  let choiceQ = null, choiceSent = null;
  function renderChoice(c) {
    const box = $('#choices');
    if (choiceQ !== c.q) {
      choiceQ = c.q; choiceSent = null;
      box.replaceChildren(...c.opts.map((o, i) => {
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'choice';
        b.style.setProperty('--oc', c.colors[i]);
        b.innerHTML = '<i></i><span></span>';
        b.querySelector('i').textContent = c.letters[i];
        b.querySelector('span').textContent = o;
        b.addEventListener('click', () => {
          if (box.classList.contains('off') || choiceSent === choiceQ) return;
          choiceSent = choiceQ;
          sendMsg({ type: 'ans', i });
          b.classList.add('picked'); box.classList.add('off');
          vibrate(20);
        });
        return b;
      }));
    }
    const picked = c.picked != null ? c.picked : null;
    box.classList.toggle('off', !c.active || choiceSent === choiceQ);
    [...box.children].forEach((b, i) => {
      b.classList.toggle('picked', picked === i);
      b.classList.toggle('good', c.correct === i);
      b.classList.toggle('bad', c.correct != null && picked === i && c.correct !== i);
    });
    $('#choiceMsg').textContent = c.label || '';
    $('#choiceSub').textContent = c.sub || '';
  }

  let fxT = null;
  function showFx(t) {
    const f = $('#fxMsg');
    f.textContent = t || ''; f.classList.remove('on'); void f.offsetWidth; f.classList.add('on');
    clearTimeout(fxT); fxT = setTimeout(() => f.classList.remove('on'), 1600);
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
    if (!st || !(st.yourTurn || canToss()) || thrown) return;
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
    if (!canToss() && now - lastAim > 50 && conn && conn.open) { lastAim = now; conn.send({ type: 'aim', ax: v.ax, p: v.p }); }
  });
  function release(e) {
    if (!drag || e.pointerId !== drag.id) return;
    const v = calc(e);
    drag = null;
    if (v.p > 0.06 && e.type === 'pointerup') {
      thrown = true;
      const toss = canToss();
      conn && conn.open && conn.send({ type: toss ? 'toss' : 'throw', ax: v.ax, p: v.p });
      vibrate(30);
      ball.className = 'fly';
      ball.style.transform = `translate(${v.ax * 120}px, ${-pad.clientHeight}px) scale(.3)`;
      setTimeout(() => { thrown = false; resetBall(); if (st) render(); }, toss ? 380 : 650);
    } else {
      conn && conn.open && conn.send({ type: 'aim', ax: 0, p: 0 });
      resetBall(true);
    }
  }
  pad.addEventListener('pointerup', release);
  pad.addEventListener('pointercancel', release);

  function canToss() { return !!(st && st.phase === 'play' && st.ctrl && st.ctrl.mode === 'throw' && st.ctrl.active); }

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
