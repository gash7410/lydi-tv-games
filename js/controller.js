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

  function show(id) { ['#scrJoin', '#scrWait', '#scrPad', '#scrTap', '#scrRun', '#scrPlat', '#scrChoice', '#scrCards'].forEach((s) => ($(s).hidden = s !== id)); }
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
    st = null; exitBtns(false); $('#exitDlg').hidden = true;
  }

  // ---------- έξοδος από το παιχνίδι ----------
  // Παίκτης 1 στη διάρκεια του παιχνιδιού: τελειώνει το παιχνίδι για όλους και γυρνάνε στο μενού.
  // Οι υπόλοιποι (ή οποιοσδήποτε εκτός παιχνιδιού): βγαίνουν από το δωμάτιο.
  const exitEnds = () => st && st.host && (st.phase === 'play' || st.phase === 'over');
  function exitBtns(on) { document.querySelectorAll('.exit-btn').forEach((b) => (b.hidden = !on)); }
  document.querySelectorAll('.exit-btn').forEach((b) => b.addEventListener('click', () => {
    if (!st) return;
    const ends = exitEnds();
    $('#exitTitle').textContent = ends ? 'Τέλος παιχνιδιού;' : 'Φεύγεις;';
    $('#exitText').textContent = ends
      ? 'Το παιχνίδι σταματά για όλους και γυρνάτε στο μενού με τα παιχνίδια.'
      : st.phase === 'play' ? 'Θα βγεις από το παιχνίδι. Οι άλλοι συνεχίζουν χωρίς εσένα.' : 'Θα βγεις από το δωμάτιο της τηλεόρασης.';
    $('#exitYes').textContent = ends ? 'Ναι, στο μενού' : 'Ναι, φεύγω';
    $('#exitDlg').hidden = false;
    vibrate(15);
  }));
  $('#exitNo').addEventListener('click', () => ($('#exitDlg').hidden = true));
  $('#exitDlg').addEventListener('click', (e) => { if (e.target.id === 'exitDlg') $('#exitDlg').hidden = true; });
  $('#exitYes').addEventListener('click', () => {
    $('#exitDlg').hidden = true;
    if (exitEnds()) return sendMsg({ type: 'quit' });
    sendMsg({ type: 'leave' });
    setTimeout(() => { fail(''); setConn(false, 'εκτός σύνδεσης'); }, 150);
  });

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

  // δοκιμές στον browser: controller.html?dev → window.__ctl (ψεύτικη σύνδεση + κατάσταση)
  if (params.has('dev')) window.__ctl = { onData: (d) => onData(d), fake: (c) => { conn = c; } };

  function render() {
    const s = st;
    exitBtns(true);
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
        b.innerHTML = '<span class="th"></span><span class="nm"></span>';
        b.querySelector('.th').style.backgroundImage = `url(img/covers/${g.id}.jpg)`;
        b.querySelector('.nm').textContent = g.title.replace(/\u00AD/g, '');
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
    $('#scrPad').classList.toggle('bear', skin === 'bear');
    $('#ball').dataset.food = skin === 'bear' ? s.ctrl.food || '' : '';
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
      // οριζόντιο gamepad: αναλογικός μοχλός + ένα κουμπί (Διάστημα, Φούσκες, Σπρωξίματα)
      gpSetMode('joy');
      if ($('#scrPlat').hidden) { show('#scrPlat'); vibrate(30); }
      $('#platScore').textContent = s.ctrl.scoreText || (s.score ? `Πόντοι: ${s.score.v}${s.score.of ? '/' + s.score.of : ''}` : '');
      $('#platMsg').textContent = s.ctrl.active ? '' : (s.ctrl.label || '');
      $('#platSub').textContent = s.ctrl.active ? '' : (s.ctrl.sub || '');
      $('#platShoot').textContent = s.ctrl.btn || 'ΩΘΗΣΗ';
      $('#platShoot').classList.remove('dim');
      dashCd = s.ctrl.cdMs || 1400;
      $('#scrPlat').classList.toggle('off', !s.ctrl.active);
      if (!s.ctrl.active) stickEnd();
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
      gpSetMode('plat');
      if ($('#scrPlat').hidden) { show('#scrPlat'); vibrate(30); }
      $('#platScore').textContent = s.ctrl.scoreText || '';
      $('#platMsg').textContent = s.ctrl.label || '';
      $('#platSub').textContent = s.ctrl.sub || '';
      $('#platShoot').textContent = s.ctrl.shoot || 'ΦΟΥΣΚΑ';
      $('#platShoot').classList.toggle('dim', !!s.ctrl.shootOff);
      $('#platJump').textContent = s.ctrl.jump || 'ΠΗΔΑ';
      $('#platExtra').textContent = s.ctrl.extra || '';
      $('#platExtra').hidden = !s.ctrl.extra;
      $('#scrPlat').classList.toggle('off', !s.ctrl.active);
      return;
    }
    if (s.phase === 'play' && s.ctrl && s.ctrl.mode === 'cards') {
      if ($('#scrCards').hidden) { show('#scrCards'); vibrate(30); }
      renderCards(s.ctrl);
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


  // ---------- οριζόντιο gamepad: μοχλός + 3 κουμπιά (Ζούγκλα, Φουσκοπάντα) ----------
  // ο μοχλός στέλνει την κατεύθυνση όταν αλλάζει (και ξανά κάθε 400ms, μήπως χαθεί μήνυμα)
  const stick = $('#gpStick'), gpKnob = $('#gpKnob');
  const portrait = matchMedia('(orientation: portrait)');
  let platDir = 0, platV = 0, platTimer = null, stickId = null;
  // gpMode: 'plat' (κατευθύνσεις + 3 κουμπιά) ή 'joy' (αναλογικός μοχλός + 1 κουμπί)
  let gpMode = 'plat', gpModeCb = null;
  function gpSetMode(m) {
    if (m === gpMode) return;
    stickEnd(); gpMode = m;
    $('#scrPlat').classList.toggle('one', m === 'joy');
    $('#platJump').hidden = m === 'joy';
    if (m === 'joy') $('#platExtra').hidden = true;
    if (gpModeCb) gpModeCb(m);
  }
  function arrows(d, v) {
    stick.classList.toggle('l', d < 0); stick.classList.toggle('r', d > 0);
    stick.classList.toggle('u', v < 0); stick.classList.toggle('d', v > 0);
  }
  function platSend(d, v) {
    if (d === platDir && v === platV) return;
    if (d !== platDir && d) vibrate(8);
    platDir = d; platV = v; sendMsg({ type: 'move', d, v });
    clearInterval(platTimer);
    if (d || v) platTimer = setInterval(() => sendMsg({ type: 'move', d: platDir, v: platV }), 400);
    arrows(d, v);
  }
  // αναλογικό: στέλνει x,y (-1..1) το πολύ κάθε 40ms
  let gjv = { x: 0, y: 0 }, gjLast = 0, gjTimer = null;
  function gjSend(force) {
    const now = performance.now();
    if (!force && now - gjLast < 40) {
      if (!gjTimer) gjTimer = setTimeout(() => { gjTimer = null; gjSend(true); }, 40);
      return;
    }
    gjLast = now; sendMsg({ type: 'joy', x: +gjv.x.toFixed(3), y: +gjv.y.toFixed(3) });
  }
  function stickMove(e) {
    const r = stick.getBoundingClientRect(), R = r.width / 2;
    let sx = e.clientX - (r.left + R), sy = e.clientY - (r.top + R);
    // όταν το κινητό είναι όρθιο το χειριστήριο είναι γυρισμένο 90°: μετατροπή σε συντεταγμένες του χειριστηρίου
    let dx = portrait.matches ? sy : sx, dy = portrait.matches ? -sx : sy;
    const l = Math.hypot(dx, dy), m = R * 0.52;
    if (l > m) { dx = (dx / l) * m; dy = (dy / l) * m; }
    gpKnob.style.transform = `translate(${dx}px, ${dy}px)`;
    const nx = dx / m, ny = dy / m;
    if (gpMode === 'joy') {
      gjv = { x: nx, y: ny }; gjSend();
      arrows(nx > 0.4 ? 1 : nx < -0.4 ? -1 : 0, ny > 0.4 ? 1 : ny < -0.4 ? -1 : 0);
      return;
    }
    platSend(nx > 0.35 ? 1 : nx < -0.35 ? -1 : 0, ny > 0.55 ? 1 : ny < -0.55 ? -1 : 0);
  }
  function stickEnd(e) {
    if (e && e.pointerId !== stickId) return;
    stickId = null; stick.classList.remove('held'); gpKnob.style.transform = '';
    if (gpMode === 'joy') { arrows(0, 0); if (gjv.x || gjv.y) { gjv = { x: 0, y: 0 }; gjSend(true); } } else platSend(0, 0);
  }
  stick.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (stickId !== null || (gpMode === 'joy' && $('#scrPlat').classList.contains('off'))) return;
    stickId = e.pointerId; stick.classList.add('held');
    try { stick.setPointerCapture(e.pointerId); } catch (er) {}
    stickMove(e);
  });
  stick.addEventListener('pointermove', (e) => { if (e.pointerId === stickId) stickMove(e); });
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((t) => stick.addEventListener(t, stickEnd));
  stick.addEventListener('contextmenu', (e) => e.preventDefault());
  let dashReady = 0, dashCd = 1400;
  [['#platJump', 'jump', 15], ['#platShoot', 'dash', 25]].forEach(([sel, type, vib]) => {
    const b = $(sel);
    b.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      if (gpMode === 'joy') { // ένα κουμπί με χρόνο επαναφόρτισης (ΩΘΗΣΗ, ΒΟΜΒΑ, ΒΕΛΟΣ)
        if ($('#scrPlat').classList.contains('off') || performance.now() < dashReady) return;
        dashReady = performance.now() + dashCd;
        b.classList.add('cool'); setTimeout(() => b.classList.remove('cool'), dashCd);
      }
      sendMsg({ type });
      b.classList.remove('hit'); void b.offsetWidth; b.classList.add('hit');
      vibrate(vib);
    });
    b.addEventListener('animationend', () => b.classList.remove('hit'));
    b.addEventListener('contextmenu', (e) => e.preventDefault());
  });
  // τρίτο κουμπί: κρατιέται πατημένο (π.χ. «ΤΡΕΞΕ» στη Ζούγκλα) → extra on/off
  {
    const b = $('#platExtra'), ids = new Set();
    b.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      try { b.setPointerCapture(e.pointerId); } catch (er) {}
      if (!ids.size) { sendMsg({ type: 'extra', on: true }); vibrate(12); }
      ids.add(e.pointerId); b.classList.add('down');
    });
    const up = (e) => {
      if (!ids.delete(e.pointerId) || ids.size) return;
      b.classList.remove('down'); sendMsg({ type: 'extra', on: false });
    };
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((t) => b.addEventListener(t, up));
    b.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  // ---------- γρανάζι: ο παίκτης στήνει μόνος του το χειριστήριο ----------
  // κάθε στοιχείο έχει μετατόπιση (x,y ως κλάσμα πλάτους/ύψους του χειριστηριού) και μέγεθος s· σώζονται στο κινητό
  {
    const scr = $('#scrPlat'), gpIn = scr.querySelector('.gp-in');
    const items = { stick: stick, extra: $('#platExtra'), jump: $('#platJump'), shoot: $('#platShoot') };
    // ξεχωριστή διάταξη για 3 κουμπιά και για 1 κουμπί
    let LKEY = 'tvp_gp_layout', lay = {};
    function load() {
      LKEY = gpMode === 'joy' ? 'tvp_gp_layout_joy' : 'tvp_gp_layout';
      try { lay = JSON.parse(localStorage.getItem(LKEY)) || {}; } catch (er) { lay = {}; }
      Object.keys(items).forEach(apply);
    }
    gpModeCb = () => { if (editing) setEdit(false); load(); };
    const get = (k) => lay[k] || (lay[k] = { x: 0, y: 0, s: 1 });
    function apply(k) {
      const el = items[k], o = lay[k];
      el.style.translate = o && (o.x || o.y) ? `calc(var(--W) * ${o.x.toFixed(4)}) calc(var(--H) * ${o.y.toFixed(4)})` : '';
      el.style.scale = o && o.s !== 1 ? String(o.s) : '';
    }
    const save = () => { try { localStorage.setItem(LKEY, JSON.stringify(lay)); } catch (er) {} };

    // φυσική θέση του στοιχείου μέσα στο χειριστήριο (χωρίς τη μετατόπιση) — για να μη βγαίνει έξω
    function natural(el) {
      let x = 0, y = 0, n = el;
      while (n && n !== gpIn) { x += n.offsetLeft; y += n.offsetTop; n = n.offsetParent; }
      return { x, y, w: el.offsetWidth, h: el.offsetHeight };
    }
    function clamp(k) {
      const el = items[k], o = get(k), W = gpIn.offsetWidth, H = gpIn.offsetHeight, top = scr.querySelector('.gp-top');
      const n = natural(el), hw = (n.w * o.s) / 2, hh = (n.h * o.s) / 2;
      const cx = n.x + n.w / 2 + o.x * W, cy = n.y + n.h / 2 + o.y * H;
      const minY = top.offsetTop + top.offsetHeight * 0.6;
      const ncx = Math.min(Math.max(cx, hw), W - hw), ncy = Math.min(Math.max(cy, minY + hh), H - hh);
      o.x = (ncx - n.x - n.w / 2) / W; o.y = (ncy - n.y - n.h / 2) / H;
    }

    let editing = false, sel = 'stick', drag = null;
    function select(k) {
      sel = k;
      Object.entries(items).forEach(([kk, el]) => el.classList.toggle('gp-sel', editing && kk === k));
    }
    function setEdit(on) {
      editing = on; scr.classList.toggle('edit', on); $('#gpEdit').hidden = !on;
      if (on) { stickEnd(); platSend(0, 0); } else save();
      select(sel);
    }
    $('#gpGear').addEventListener('click', () => { vibrate(10); setEdit(true); });
    $('#gpDone').addEventListener('click', () => { vibrate(10); setEdit(false); });
    $('#gpReset').addEventListener('click', () => { lay = {}; Object.keys(items).forEach(apply); save(); vibrate(20); });
    const resize = (f) => {
      const o = get(sel); o.s = Math.round(Math.min(1.5, Math.max(0.6, o.s * f)) * 100) / 100;
      clamp(sel); apply(sel); save(); vibrate(8);
    };
    $('#gpSmall').addEventListener('click', () => resize(1 / 1.1));
    $('#gpBig').addEventListener('click', () => resize(1.1));

    // στη ρύθμιση τα αγγίγματα πιάνονται εδώ (capture) και δεν φτάνουν στο παιχνίδι
    scr.addEventListener('pointerdown', (e) => {
      if (!editing) return;
      const el = e.target.closest('.gp-stick, .gp-btn');
      if (!el) return;
      e.preventDefault(); e.stopPropagation();
      const k = Object.keys(items).find((kk) => items[kk] === el);
      const o = get(k);
      select(k);
      drag = { k, id: e.pointerId, sx: e.clientX, sy: e.clientY, x: o.x, y: o.y };
      el.classList.add('gp-drag');
      try { el.setPointerCapture(e.pointerId); } catch (er) {}
      vibrate(8);
    }, true);
    scr.addEventListener('pointermove', (e) => {
      if (!editing) return;
      e.stopPropagation();
      if (!drag || e.pointerId !== drag.id) return;
      const sx = e.clientX - drag.sx, sy = e.clientY - drag.sy;
      const dx = portrait.matches ? sy : sx, dy = portrait.matches ? -sx : sy; // γυρισμένο χειριστήριο
      const o = get(drag.k);
      o.x = drag.x + dx / gpIn.offsetWidth; o.y = drag.y + dy / gpIn.offsetHeight;
      clamp(drag.k); apply(drag.k);
    }, true);
    const end = (e) => {
      if (!editing) return;
      e.stopPropagation();
      if (!drag || e.pointerId !== drag.id) return;
      items[drag.k].classList.remove('gp-drag'); drag = null; save();
    };
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((t) => scr.addEventListener(t, end, true));
    load();
    window.addEventListener('resize', () => { if (editing) Object.keys(lay).forEach((k) => { clamp(k); apply(k); }); });
  }

  // ---------- 4 απαντήσεις («Ποιος είναι;») ----------
  let choiceQ = null, choiceSent = null;
  // ---------- Ξερή: τα φύλλα του παίκτη ----------
  const SYM = { S: '♠', H: '♥', D: '♦', C: '♣' };
  const rankOf = (c) => c.slice(0, -1), suitOf = (c) => c.slice(-1);
  let cc = null, cardSel = null, cardHandKey = '', cardSent = -1;
  // θέσεις συμβόλων (x%, y%) όπως στα αληθινά τραπουλόχαρτα· κάτω από τη μέση γυρίζουν ανάποδα
  const PIPS = {
    2: [[50, 18], [50, 82]], 3: [[50, 18], [50, 50], [50, 82]],
    4: [[32, 18], [68, 18], [32, 82], [68, 82]], 5: [[32, 18], [68, 18], [50, 50], [32, 82], [68, 82]],
    6: [[32, 18], [68, 18], [32, 50], [68, 50], [32, 82], [68, 82]],
    7: [[32, 18], [68, 18], [50, 34], [32, 50], [68, 50], [32, 82], [68, 82]],
    8: [[32, 18], [68, 18], [50, 34], [32, 50], [68, 50], [50, 66], [32, 82], [68, 82]],
    9: [[32, 18], [68, 18], [32, 39], [68, 39], [50, 50], [32, 61], [68, 61], [32, 82], [68, 82]],
    10: [[32, 18], [68, 18], [50, 29], [32, 39], [68, 39], [32, 61], [68, 61], [50, 71], [32, 82], [68, 82]],
  };
  const FACE = { J: 'Βαλές', Q: 'Ντάμα', K: 'Ρήγας' };
  function paintCard(el, c) {
    if (isChroma()) return paintChroma(el, c);
    el.classList.remove('ck');
    el.classList.toggle('red', !!c && 'HD'.includes(suitOf(c)));
    el.classList.toggle('empty', !c);
    el.replaceChildren();
    if (!c) return;
    const r = rankOf(c), sy = SYM[suitOf(c)], face = !!FACE[r];
    el.classList.toggle('face', face);
    el.classList.toggle('ace', r === 'A');
    const mk = (tag, cls, txt) => { const e = document.createElement(tag); e.className = cls; if (txt != null) e.textContent = txt; return e; };
    const corner = (cls) => { const k = mk('i', 'cn ' + cls); k.append(mk('b', '', r), mk('s', '', sy)); return k; };
    el.append(corner('tl'), corner('br'));
    if (face) {
      const f = mk('i', 'fc');
      f.append(mk('s', 'fs', sy), mk('b', 'fr', r), mk('small', 'fn', FACE[r]), mk('s', 'fs dn', sy));
      el.append(f);
    } else if (r === 'A') {
      el.append(mk('i', 'pip ace', sy));
    } else {
      (PIPS[r] || []).forEach(([x, y]) => {
        const p = mk('i', 'pip' + (y > 50 ? ' dn' : ''), sy);
        p.style.left = x + '%'; p.style.top = y + '%';
        el.append(p);
      });
    }
  }
  // ---------- Χρωμοφύλλα: χρωματιστά φύλλα (ίδια οθόνη με την Ξερή) ----------
  const CK = { R: '#ec3b43', Y: '#ffc21a', G: '#22b35e', B: '#2d7ff0' };
  const CKN = { R: 'Κόκκινο', Y: 'Κίτρινο', G: 'Πράσινο', B: 'Μπλε' };
  const isChroma = () => !!(cc && cc.kind === 'chroma');
  const ckBase = (c) => String(c).split('.')[0];
  const ckCol = (c) => { const b = ckBase(c); return CK[b[0]] ? b[0] : null; };
  const ckVal = (c) => { const b = ckBase(c); return CK[b[0]] ? b.slice(1) : b; };
  const ckSvg = {
    S: '<svg viewBox="-10 -10 20 20"><circle r="6.4" fill="none" stroke="currentColor" stroke-width="2.6"/><path d="M-4.4 4.4 4.4-4.4" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></svg>',
    V: '<svg viewBox="-10 -10 20 20"><g fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round"><path d="M-6 -1A6 6 0 0 1 4-4.6"/><path d="M6 1A6 6 0 0 1-4 4.6"/></g><path d="M1.6-8 6.4-4 1.2-1.6Z M-1.6 8-6.4 4-1.2 1.6Z" fill="currentColor"/></svg>',
  };
  function ckSym(v) {
    const e = document.createElement('i');
    e.className = 'ks';
    if (ckSvg[v]) e.innerHTML = ckSvg[v];
    else e.textContent = v === 'D' ? '+2' : v === 'F' ? '+4' : v;
    if (v === '6' || v === '9') e.classList.add('ul');
    return e;
  }
  function paintChroma(el, c, chosen) {
    el.classList.remove('red', 'face', 'ace');
    el.classList.add('ck');
    el.classList.toggle('empty', !c);
    el.replaceChildren();
    if (!c) return;
    const col = ckCol(c), v = ckVal(c);
    el.classList.toggle('wild', !col);
    el.style.setProperty('--kc', col ? CK[col] : '#1c1a2b');
    const mid = document.createElement('i'); mid.className = 'kb';
    if (col || v === 'F') mid.append(ckSym(v));
    if (!col && chosen) mid.style.boxShadow = `0 0 0 6cqw ${CK[chosen]}`;
    el.append(mid);
    for (const k of ['tl', 'br']) {
      const n = col || v === 'F' ? ckSym(v) : document.createElement('i');
      if (!col && v !== 'F') n.className = 'ks rb';
      n.classList.add('kn', k);
      el.append(n);
    }
  }
  function ckOk(c) {
    if (!c || !cc) return false;
    if (cc.drew && c !== cc.drew) return false;
    if (!ckCol(c)) return true;
    return ckCol(c) === cc.col || (!!cc.top && !!ckCol(cc.top) && ckVal(c) === ckVal(cc.top));
  }
  let ckPending = null, ckLastSent = false;
  function ckPick(col) {
    $('#ckPick').hidden = true;
    if (!ckPending || !cardsCanPlay()) { ckPending = null; return; }
    ckSend(ckPending, col);
    ckPending = null;
  }
  function ckSend(code, col) {
    sendMsg({ type: 'card', act: 'play', c: code, col: col || null, last: ckLastSent });
    cardSent = cc.tid; vibrate(25);
    const el = [...$('#hand').children].find((b) => b.dataset.c === code);
    if (el) el.classList.add('gone');
    cardSel = null; cardsUi();
  }
  function ckAct(act) {
    if (!cardsCanPlay()) return cardHint(cc && cc.turn ? `Παίζει: ${cc.turn.name}` : 'Περίμενε…');
    if (act === 'take') {
      if (cc.drew) sendMsg({ type: 'card', act: 'pass' }); else sendMsg({ type: 'card', act: 'draw' });
      cardSent = cc.tid; vibrate(20); cardSel = null; cardsUi(); return;
    }
    if (!cardSel) { vibrate(30); return cardHint(cc.drew ? 'Διάλεξε το φύλλο που τράβηξες ή πάτα «ΠΑΣΟ»' : 'Διάλεξε πρώτα ένα φύλλο'); }
    if (!ckOk(cardSel)) {
      vibrate([30, 40, 30]);
      if (cc.drew) return cardHint('Μπορείς να παίξεις μόνο το φύλλο που τράβηξες');
      return cardHint(`Δεν κάνει! Θέλει ${CKN[cc.col] || ''} ή ίδιο σύμβολο. Αλλιώς «ΤΡΑΒΑ»`);
    }
    if (!ckCol(cardSel)) { ckPending = cardSel; $('#ckPick').hidden = false; vibrate(15); return; }
    ckSend(cardSel);
  }
  document.querySelectorAll('#ckPick [data-col]').forEach((b) => b.addEventListener('click', () => ckPick(b.dataset.col)));
  $('#ckPickNo').addEventListener('click', () => { ckPending = null; $('#ckPick').hidden = true; });
  window.addEventListener('resize', () => { if (isChroma() && !$('#scrCards').hidden) setTimeout(() => renderCards(cc), 60); });
  $('#scrCards .xr-deck').addEventListener('click', () => { if (isChroma() && !cc.drew) ckAct('take'); });
  $('#btnLast').addEventListener('click', () => {
    if (!cc || !cc.last || ckLastSent) return;
    ckLastSent = true; vibrate([40, 30, 40]);
    sendMsg({ type: 'card', act: 'last' });
    $('#btnLast').hidden = true;
  });

  let cHintT = 0;
  function cardHint(t) {
    const h = $('#cardsHint');
    h.textContent = t || ''; h.classList.remove('on'); void h.offsetWidth; h.classList.add('on');
    clearTimeout(cHintT); cHintT = setTimeout(() => h.classList.remove('on'), 1800);
  }
  const cardTakes = (c) => !!(cc && cc.top && c && (rankOf(c) === 'J' || rankOf(c) === rankOf(cc.top)));
  function cardsCanPlay() { return cc && cc.active && cardSent !== cc.tid; }
  function renderCards(c) {
    const wasCk = isChroma();
    cc = c;
    const ck = isChroma();
    if (wasCk !== ck) { cardHandKey = ''; $('#cardsTop').dataset.c = '-'; }
    $('#scrCards').classList.toggle('ck', ck);
    $('#btnThrow').innerHTML = ck ? '<i>🎴</i>ΠΑΙΞΕ' : '<i>🃏</i>ΠΕΤΑ';
    $('#btnTake').innerHTML = ck ? (c.drew ? '<i>👋</i>ΠΑΣΟ' : '<i>🫳</i>ΤΡΑΒΑ') : '<i>✋</i>ΠΑΡΕ ΤΑ';
    $('#btnTake').classList.toggle('pass', ck && !!c.drew);
    if (!c.last || c.called) ckLastSent = !!c.called;
    $('#btnLast').hidden = !(ck && c.last && !ckLastSent);
    if (!ck || !c.active) { $('#ckPick').hidden = true; ckPending = null; }
    if (ck) {
      const ring = $('#scrCards .xr-pile');
      ring.style.setProperty('--kc', CK[c.col] || 'transparent');
      $('#cardsPileN').textContent = c.col ? CKN[c.col] : '';
    }
    const key = c.hand.join(',');
    if (!c.hand.includes(cardSel)) cardSel = null;
    if (key !== cardHandKey) {
      cardHandKey = key;
      $('#hand').replaceChildren(...c.hand.map((code) => {
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'pc'; b.dataset.c = code;
        paintCard(b, code);
        b.addEventListener('click', () => {
          if (!cardsCanPlay()) { cardHint(cc && cc.turn ? `Παίζει: ${cc.turn.name}` : 'Περίμενε…'); return; }
          cardSel = cardSel === code ? null : code; vibrate(10); cardsUi();
        });
        return b;
      }));
    }
    $('#hand').dataset.n = c.hand.length;
    const kids = [...$('#hand').children], mid = (kids.length - 1) / 2;
    const step = ck ? Math.min(5, 36 / Math.max(1, kids.length)) : 5, yk = ck ? Math.min(1.6, 30 / Math.max(1, kids.length * kids.length)) : 1.6;
    let ov = '';
    if (ck && kids.length > 1) {
      const hw = $('#hand').clientWidth, cw = kids[0].offsetWidth || 1;
      ov = Math.min(-cw * 0.32, (hw * 0.8 - cw) / (kids.length - 1) - cw) + 'px';
    }
    kids.forEach((b, i) => { const d = i - mid; b.style.setProperty('--a', (d * step) + 'deg'); b.style.setProperty('--y', (d * d * yk) + '%'); b.style.zIndex = i + 1; b.style.marginLeft = i && ov ? ov : ''; b.classList.toggle('ok', ck && !!c.active && ckOk(b.dataset.c)); });
    const topEl = $('#cardsTop');
    if (topEl.dataset.c !== (c.top || '')) {
      topEl.dataset.c = c.top || ''; if (ck) paintChroma(topEl, c.top, c.col); else paintCard(topEl, c.top);
      topEl.style.animation = 'none'; void topEl.offsetWidth; topEl.style.animation = '';
    }
    if (!ck) $('#cardsPileN').textContent = c.pileN ? `${c.pileN} ${c.pileN === 1 ? 'φύλλο' : 'φύλλα'}` : 'άδειο';
    $('#scrCards').dataset.pile = Math.min(c.pileN || 0, 3);
    $('#scrCards').dataset.deck = c.deckN > 12 ? 3 : c.deckN > 0 ? (c.deckN > 6 ? 2 : 1) : 0;
    $('#cardsDeckN').textContent = c.deckN ? `${c.deckN} φύλλα` : 'τελείωσε';
    $('#cardsScore').textContent = c.scoreText || '';
    $('#cardsMsg').textContent = c.label || '';
    $('#cardsMsg').style.color = c.active ? '#ffe27a' : c.turn ? c.turn.color : '';
    $('#cardsSub').textContent = c.sub || '';
    cardsUi();
  }
  function cardsUi() {
    const on = cardsCanPlay();
    $('#scrCards').classList.toggle('mine', !!on);
    [...$('#hand').children].forEach((b) => b.classList.toggle('sel', b.dataset.c === cardSel));
    if (isChroma()) {
      const any = cc.hand.some(ckOk);
      $('#btnThrow').classList.toggle('ready', !!(on && cardSel && ckOk(cardSel)));
      $('#btnTake').classList.toggle('ready', !!(on && (cc.drew ? !cardSel : !any)));
    } else {
    const t = cardTakes(cardSel);
    $('#btnThrow').classList.toggle('ready', !!(on && cardSel && !t));
    $('#btnTake').classList.toggle('ready', !!(on && cardSel && t));
    }
    $('#btnThrow').classList.toggle('off', !on);
    $('#btnTake').classList.toggle('off', !on);
  }
  function cardAct(act) {
    if (isChroma()) return ckAct(act);
    if (!cardsCanPlay()) return cardHint(cc && cc.turn ? `Παίζει: ${cc.turn.name}` : 'Περίμενε…');
    if (!cardSel) { vibrate(30); return cardHint('Διάλεξε πρώτα ένα φύλλο από τη βεντάλια'); }
    const t = cardTakes(cardSel);
    if (act === 'throw' && t) { vibrate([30, 40, 30]); return cardHint('Με αυτό το φύλλο τα παίρνεις! Πάτα «ΠΑΡΕ ΤΑ» ✋'); }
    if (act === 'take' && !t) {
      vibrate([30, 40, 30]);
      return cardHint(cc.top ? 'Αυτό το φύλλο δεν τα παίρνει. Πάτα «ΠΕΤΑ» 🃏' : 'Το τραπέζι είναι άδειο. Πάτα «ΠΕΤΑ» 🃏');
    }
    sendMsg({ type: 'card', c: cardSel, act });
    cardSent = cc.tid; vibrate(act === 'take' ? [40, 30, 60] : 25);
    const el = [...$('#hand').children].find((b) => b.dataset.c === cardSel);
    if (el) el.classList.add('gone');
    cardSel = null; cardsUi();
  }
  $('#btnThrow').addEventListener('click', () => cardAct('throw'));
  $('#btnTake').addEventListener('click', () => cardAct('take'));

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
