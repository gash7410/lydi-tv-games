// Αντιγράφει τα αρχεία του παιχνιδιού στο www/ για την εφαρμογή Android (Capacitor).
// Το site στο GitHub Pages σερβίρεται από τη ρίζα, οπότε τα αρχεία μένουν εκεί.
import { cpSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
const out = 'www';
rmSync(out, { recursive: true, force: true });
mkdirSync(out);
for (const f of ['index.html', 'controller.html', 'demo.html', 'css', 'js', 'img']) cpSync(f, `${out}/${f}`, { recursive: true });
// αριθμός έκδοσης (ίδιος με το versionCode του APK) για τη σελίδα ελέγχου debug.html
let ver = { code: 'dev' };
try {
  const git = (c) => execSync('git ' + c, { encoding: 'utf8' }).trim();
  ver = { code: git('rev-list --count HEAD'), sha: git('rev-parse --short HEAD'), date: git('log -1 --format=%cI') };
} catch (e) {}
ver.built = new Date().toISOString();
writeFileSync(`${out}/js/version.js`, `window.TVP_VERSION = ${JSON.stringify(ver)};\n`);
console.log('www/ έτοιμο', ver.code);
