// Κουμπί «Ενημέρωση» (μόνο μέσα στην εφαρμογή Android TV).
// Ελέγχει τη release «latest» στο GitHub, κατεβάζει το νέο APK και ανοίγει την εγκατάσταση
// πάνω από την παλιά έκδοση. Ο native κώδικας είναι στο android/.../UpdaterPlugin.java.
(function () {
  const call = (m, o) => window.Capacitor.nativePromise('Updater', m, o || {});
  let btn, msg, busy = false, waitPerm = false, latest = null;

  function say(t, cls) { msg.textContent = t || ''; msg.className = 'hint upd-msg' + (cls ? ' ' + cls : ''); }
  function label(t) { btn.textContent = t; }
  function fmtMB(b) { return (b / 1048576).toFixed(1).replace('.', ',') + ' MB'; }

  async function check(silent) {
    try {
      const r = await call('check');
      latest = r;
      if (r.available) {
        btn.classList.add('upd-new');
        label('⬇ Ενημέρωση ' + r.name);
        say('Υπάρχει νέα έκδοση ' + r.name + (r.date ? ' (' + r.date + ')' : '') + '. Έχεις την ' + r.currentName + '.');
      } else {
        btn.classList.remove('upd-new');
        label('Ενημέρωση');
        if (!silent) say('Έχεις την τελευταία έκδοση (' + r.currentName + ').', 'ok');
      }
      return r;
    } catch (e) {
      if (!silent) say((e && e.message) || 'Δεν μπόρεσα να ελέγξω για νέα έκδοση.', 'err');
      return null;
    }
  }

  async function update() {
    if (busy) return;
    busy = true; btn.disabled = true;
    try {
      label('Έλεγχος…');
      const r = await check(false);
      if (!r || !r.available) return;
      label('Λήψη…');
      say('Κατεβαίνει η έκδοση ' + r.name + '…');
      const timer = setInterval(async () => {
        try {
          const p = await call('progress');
          if (p.total > 0) label('Λήψη ' + Math.floor((p.done / p.total) * 100) + '%');
          else if (p.done > 0) label('Λήψη ' + fmtMB(p.done));
        } catch (e) {}
      }, 300);
      try {
        await call('install');
        say('Στο παράθυρο που άνοιξε πάτα «Εγκατάσταση» (ή «Ενημέρωση»). Μετά άνοιξε ξανά το Lydi TV Games.', 'ok');
      } catch (e) {
        if (e && e.code === 'PERMISSION') {
          waitPerm = true;
          say('Άνοιξαν οι Ρυθμίσεις: ενεργοποίησε το «Lydi TV Games» (Να επιτρέπεται) και πάτα Πίσω. Η ενημέρωση θα συνεχίσει μόνη της.', 'warn');
        } else {
          say((e && e.message) || 'Η ενημέρωση απέτυχε.', 'err');
        }
      } finally {
        clearInterval(timer);
      }
    } finally {
      busy = false; btn.disabled = false;
      label(latest && latest.available ? '⬇ Ενημέρωση ' + latest.name : 'Ενημέρωση');
    }
  }

  // όταν γυρίσει από τις Ρυθμίσεις με την άδεια δοσμένη, συνεχίζει αυτόματα
  document.addEventListener('visibilitychange', async () => {
    if (document.hidden || !waitPerm) return;
    try {
      const i = await call('info');
      if (i.canInstall) { waitPerm = false; update(); }
    } catch (e) {}
  });

  function init() {
    if (btn) return;
    const full = document.getElementById('btnFull');
    if (!full) return;
    btn = document.createElement('button');
    btn.id = 'btnUpdate'; btn.className = 'btn'; btn.type = 'button';
    label('Ενημέρωση');
    full.parentNode.appendChild(btn);
    msg = document.createElement('p');
    say('');
    const hint = document.getElementById('startHint');
    hint.parentNode.insertBefore(msg, hint.nextSibling);
    btn.addEventListener('click', update);
    setTimeout(() => check(true), 2500); // αθόρυβος έλεγχος στην εκκίνηση
  }

  window.TVUPD = { init, check, update };
  if (window.TVP && TVP.isApp && window.Capacitor && window.Capacitor.nativePromise) init();
})();
