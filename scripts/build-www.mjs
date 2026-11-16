// Αντιγράφει τα αρχεία του παιχνιδιού στο www/ για την εφαρμογή Android (Capacitor).
// Το site στο GitHub Pages σερβίρεται από τη ρίζα, οπότε τα αρχεία μένουν εκεί.
import { cpSync, rmSync, mkdirSync } from 'node:fs';
const out = 'www';
rmSync(out, { recursive: true, force: true });
mkdirSync(out);
for (const f of ['index.html', 'controller.html', 'demo.html', 'css', 'js']) cpSync(f, `${out}/${f}`, { recursive: true });
console.log('www/ έτοιμο');
