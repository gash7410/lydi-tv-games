// Λειτουργία ελέγχου της τηλεόρασης από απόσταση.
// Η σελίδα debug.html συνδέεται στο ίδιο δωμάτιο PeerJS (με τον κωδικό της οθόνης) και ζητά:
// πληροφορίες έκδοσης/κατάστασης, τα σφάλματα της εφαρμογής, στιγμιότυπο της οθόνης και πατήματα πλήκτρων.
// Φορτώνεται πρώτο, ώστε να καταγράφει σφάλματα από την αρχή.
(function () {
  'use strict';
  const T0 = Date.now();
  const logs = [];
  function add(level, args) {
    const msg = [...args].map((a) => {
      if (a instanceof Error) return a.stack || a.message;
      if (typeof a === 'object') { try { return JSON.stringify(a).slice(0, 400); } catch (e) { return String(a); } }
      return String(a);
    }).join(' ');
    logs.push({ t: ((Date.now() - T0) / 1000).toFixed(1), level, msg: msg.slice(0, 1200) });
    if (logs.length > 200) logs.shift();
  }
  for (const level of ['error', 'warn']) {
    const orig = console[level].bind(console);
    console[level] = (...a) => { add(level, a); orig(...a); };
  }
  addEventListener('error', (e) => {
    if (e.target && e.target !== window && e.target.src) add('error', ['Δεν φορτώθηκε: ' + e.target.src]);
    else add('error', [(e.error && e.error.stack) || `${e.message} (${e.filename}:${e.lineno})`]);
  }, true);
  addEventListener('unhandledrejection', (e) => add('error', ['Promise: ', e.reason]));

  function info() {
    const tv = window.__tv, S = tv && tv.S;
    const vis = [...document.querySelectorAll('body > section, body > canvas, #hud')].filter((el) => !el.hidden).map((el) => el.id);
    const f = document.activeElement;
    return {
      version: window.TVP_VERSION || { code: 'dev' },
      app: !!(window.TVP && TVP.isApp),
      ua: navigator.userAgent,
      screen: `${screen.width}×${screen.height}`, view: `${innerWidth}×${innerHeight}`, dpr: devicePixelRatio,
      uptime: Math.round((Date.now() - T0) / 1000),
      online: navigator.onLine,
      mem: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) + ' MB' : null,
      phase: S && S.phase, game: S && S.game,
      mini: tv && tv.mini ? Object.keys(tv.minis).find((k) => tv.minis[k] === tv.mini) : null,
      players: S ? S.players.map((p) => ({ name: p.name, connected: p.connected, rtt: p.rtt == null ? null : Math.round(p.rtt) })) : [],
      visible: vis,
      focus: f && f !== document.body ? (f.id || '') + ' «' + (f.textContent || '').trim().slice(0, 40) + '»' : null,
      errors: logs.filter((l) => l.level === 'error').length,
    };
  }

  // Στιγμιότυπο: αντιγράφει τη σελίδα σε SVG (foreignObject) με τους καμβάδες ως εικόνες.
  async function shot(maxW) {
    const W = innerWidth, H = innerHeight, k = Math.min(1, (maxW || 960) / W);
    const out = document.createElement('canvas');
    out.width = Math.round(W * k); out.height = Math.round(H * k);
    const g = out.getContext('2d');
    g.fillStyle = getComputedStyle(document.body).backgroundColor || '#000';
    g.fillRect(0, 0, out.width, out.height);
    let mode = 'dom';
    try {
      const body = document.body.cloneNode(true);
      body.querySelectorAll('script').forEach((s) => s.remove());
      const src = document.querySelectorAll('canvas'), dst = body.querySelectorAll('canvas');
      src.forEach((c, i) => {
        const img = document.createElement('img');
        if (!c.hidden && c.width) img.src = c.toDataURL('image/png');
        img.className = c.className; img.id = c.id; if (c.hidden) img.hidden = true;
        img.setAttribute('style', (c.getAttribute('style') || '') + `;width:${c.clientWidth}px;height:${c.clientHeight}px;`);
        dst[i].replaceWith(img);
      });
      const f = document.activeElement;
      if (f && f !== document.body) {
        const path = []; let n = f;
        while (n && n !== document.body) { path.unshift([...n.parentNode.children].indexOf(n)); n = n.parentNode; }
        let c = body; for (const i of path) c = c && c.children[i];
        if (c) c.setAttribute('data-dbgfocus', '');
      }
      // τα <button> δεν ζωγραφίζονται μέσα σε εικόνα SVG: γίνονται <div> με τις ίδιες κλάσεις
      body.querySelectorAll('button').forEach((b) => {
        const d = document.createElement('div');
        for (const a of b.attributes) d.setAttribute(a.name, a.value);
        d.classList.add('dbg-btn'); if (b.disabled) d.classList.add('dbg-dis');
        d.replaceChildren(...b.childNodes); b.replaceWith(d);
      });
      let css = '';
      for (const sh of document.styleSheets) { try { for (const r of sh.cssRules) css += r.cssText + '\n'; } catch (e) {} }
      css += '.dbg-btn{display:inline-block;box-sizing:border-box;text-align:center}.btn.game.dbg-btn{display:flex;text-align:left}.dbg-dis{opacity:.4}[hidden]{display:none!important}*{transition:none!important;animation:none!important}';
      css += '[data-dbgfocus]{border-color:#ffc93d!important;box-shadow:0 0 0 .6vh rgba(255,201,61,.45)!important;transform:scale(1.05)}';
      const html = `<html xmlns="http://www.w3.org/1999/xhtml" style="width:${W}px;height:${H}px"><head><style>${css}</style></head>${new XMLSerializer().serializeToString(body)}</html>`;
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><foreignObject width="100%" height="100%">${html}</foreignObject></svg>`;
      const img = new Image();
      await new Promise((ok, bad) => { img.onload = ok; img.onerror = bad; img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg); });
      g.drawImage(img, 0, 0, out.width, out.height);
      out.toDataURL('image/jpeg', 0.5); // ελέγχει ότι ο καμβάς δεν «μολύνθηκε»
    } catch (e) {
      mode = 'canvas';
      g.fillRect(0, 0, out.width, out.height);
      document.querySelectorAll('canvas').forEach((c) => { if (!c.hidden && c.width) g.drawImage(c, 0, 0, out.width, out.height); });
    }
    return { mode, w: out.width, h: out.height, data: out.toDataURL('image/jpeg', 0.72) };
  }

  function key(name) {
    const el = document.activeElement || document.body;
    const opts = { key: name, code: name, bubbles: true, cancelable: true };
    const ev = new KeyboardEvent('keydown', opts);
    el.dispatchEvent(ev);
    el.dispatchEvent(new KeyboardEvent('keyup', opts));
    if (name === 'Enter' && !ev.defaultPrevented && el && el.click && el !== document.body) el.click();
  }

  async function handle(conn, d) {
    const reply = (m) => { try { conn.send(Object.assign({ type: 'dbg', id: d.id }, m)); } catch (e) {} };
    try {
      switch (d.cmd) {
        case 'info': return reply({ info: info() });
        case 'logs': return reply({ logs: logs.slice(-(d.n || 100)) });
        case 'shot': return reply({ shot: await shot(d.w) });
        case 'key': key(String(d.key || '')); return reply({ ok: true });
        case 'reload': reply({ ok: true }); return setTimeout(() => location.reload(), 300);
        default: return reply({ error: 'Άγνωστη εντολή' });
      }
    } catch (e) { reply({ error: String(e && e.message || e) }); }
  }

  window.TVDBG = { handle, info, shot, logs, key };
})();
