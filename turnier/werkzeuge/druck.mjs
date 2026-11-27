// Druckvorlage fürs U14-Turnier als PDF (Spielplan, Tabellen, Playoff, Spielpläne je Feld). Holt den aktuellen Stand von der Turnierseite,
// eingetragene Ergebnisse sind ausgefüllt (Layout in ../druck.mjs, dasselbe wie der Druck-Knopf auf der Seite).
//   node werkzeuge/druck.mjs            → turnier/druck/U14-Turnier-Druck.pdf
//   node werkzeuge/druck.mjs <API-URL>  → anderer Server (z. B. http://localhost:8098/)
//   LEER=1 node werkzeuge/druck.mjs     → ohne Ergebnisse (Blanko zum Ausfüllen)
import { writeFile, mkdir, readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { druckHtml } from '../druck.mjs';

const BASIS = process.argv[2] || 'https://tsh-turnier-production.up.railway.app/';
const ORDNER = path.join(import.meta.dirname, '..', 'druck');
let d = await (await fetch(new URL('api/stand', BASIS))).json();
if (process.env.LEER) {
  const stand = await import('../plan.mjs');
  stand.format(d.variante || d.format);
  const grund = JSON.parse(await readFile(path.join(import.meta.dirname, '..', 'turnier.json'), 'utf8'));
  const v = (grund.varianten || []).find((x) => x.format === (d.variante || d.format)) || {};
  d = { ...d, ...stand.stand({ ...grund, pause: grund.pause && v.pause !== undefined ? { ...grund.pause, minuten: v.pause } : grund.pause, modus: v.modus || grund.modus, koMinuten: v.koMinuten, teams: d.teams }, {}) };
}
const logo = 'data:image/png;base64,' + (await readFile(path.join(import.meta.dirname, '..', 'public', 'logo.png'))).toString('base64');

await mkdir(ORDNER, { recursive: true });
const htmlDatei = path.join(ORDNER, 'U14-Turnier-Druck.html'), pdf = path.join(ORDNER, 'U14-Turnier-Druck.pdf');
await writeFile(htmlDatei, druckHtml(d, { logo }));
const browser = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
execFileSync(browser, ['--headless=new', '--disable-gpu', '--no-pdf-header-footer', `--print-to-pdf=${pdf}`, 'file:///' + htmlDatei.replace(/\\/g, '/')], { stdio: 'ignore' });
console.log(pdf);
