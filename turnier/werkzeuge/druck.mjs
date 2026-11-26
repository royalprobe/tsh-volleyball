// Druckvorlage fürs U14-Turnier: Vorrunden-Spielplan, Gruppentabellen (Kreuztabellen zum Ausfüllen) und Playoff-Spielplan
// als PDF (A4, schwarz-weiß-tauglich). Holt den aktuellen Plan von der Turnierseite, Ergebnisse bleiben leer.
//   node werkzeuge/druck.mjs            → turnier/druck/U14-Turnier-Druck.pdf
//   node werkzeuge/druck.mjs <API-URL>  → anderer Server (z. B. http://localhost:8098/)
import { writeFile, mkdir, readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';

const BASIS = process.argv[2] || 'https://tsh-turnier-production.up.railway.app/';
const ORDNER = path.join(import.meta.dirname, '..', 'druck');
const d = await (await fetch(new URL('api/stand', BASIS))).json();

const h = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const name = (id) => d.teams[id] || id;
const TAGE = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
const MONATE = ['Jänner', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
const dt = new Date(d.datum + 'T12:00:00');
const datum = `${TAGE[dt.getDay()]}, ${dt.getDate()}. ${MONATE[dt.getMonth()]} ${dt.getFullYear()}`;
const uhr = (z) => z.replace(/^0/, '');
const logo = 'data:image/png;base64,' + (await readFile(path.join(import.meta.dirname, '..', 'public', 'logo.png'))).toString('base64');

const kopf = (titel, zusatz) => `<header><span class="logo"></span><div><div class="t">${h(titel)}</div>
  <div class="u">${h(d.name)} weiblich · ${h(datum)}${zusatz ? ' · ' + h(zusatz) : ''}</div></div></header>`;
const gruppen = Object.keys(d.tabellen).sort();
const vor = d.spiele.filter((s) => s.phase === 'gruppe');
const ko = d.spiele.filter((s) => s.phase !== 'gruppe').sort((a, b) => a.zeit.localeCompare(b.zeit) || (a.feld || 9) - (b.feld || 9));
const zeiten = (liste) => [...new Set(liste.map((s) => s.zeit))];
const teil = (id, text) => id ? `<b>${h(name(id))}</b>` : `<span class="platzhalter">${h(text)}</span><span class="linie"></span>`;
const schiri = (s) => s.schiri ? h(name(s.schiri)) : s.schiriText === 'offen' ? '<span class="linie"></span>' : `<span class="platzhalter">${h(s.schiriText)}</span><span class="linie"></span>`;

// ---- Seite 1: Vorrunde
const vorZeilen = zeiten(vor).map((z) => {
  const sp = vor.filter((s) => s.zeit === z);
  return sp.map((s, i) => `<tr class="${i === 0 ? 'neu' : ''}">${i === 0 ? `<td class="zeit" rowspan="${sp.length}">${uhr(z)}</td>` : ''}
    <td class="c">${s.feld}</td><td class="c">${s.nr}</td><td class="c">${h(s.titel.replace('Gruppe ', ''))}</td>
    <td>${h(name(s.heim))}</td><td>${h(name(s.gast))}</td><td class="erg"><span class="box"></span>:<span class="box"></span></td><td class="klein">${schiri(s)}</td></tr>`).join('');
}).join('');
const seite1 = `<section>${kopf('Vorrunde – Spielplan', '1 Satz auf 25')}
<table class="plan vr"><thead><tr><th>Zeit</th><th>Feld</th><th>Spiel</th><th>Gr.</th><th>Heim</th><th>Gast</th><th>Ergebnis</th><th>Schiedsgericht</th></tr></thead>
<tbody>${vorZeilen}</tbody></table>
</section>`;

// ---- Seite 2: Gruppentabellen als Kreuztabellen
const kreuz = (g) => {
  const ids = d.tabellen[g].zeilen.map((z) => z.id).sort();
  const spiel = (a, b) => vor.find((s) => (s.heim === a && s.gast === b) || (s.heim === b && s.gast === a));
  return `<h2>Gruppe ${g}</h2><table class="kreuz"><thead><tr><th class="tm"></th>${ids.map((id, i) => `<th class="sp">${i + 1}</th>`).join('')}<th>Siege</th><th>Bälle</th><th>Diff.</th><th>Platz</th></tr></thead><tbody>
  ${ids.map((a, i) => `<tr><th class="tm"><span class="nr">${i + 1}</span>${h(name(a))}</th>${ids.map((b) => a === b ? '<td class="leer"></td>'
    : `<td class="feld"><span class="spnr">Sp. ${spiel(a, b).nr}</span><span class="doppel"><span></span>:<span></span></span></td>`).join('')}<td></td><td class="baelle">:</td><td></td><td></td></tr>`).join('')}
  </tbody></table>`;
};
const seite2 = `<section>${kopf('Gruppentabellen')}
${gruppen.map(kreuz).join('')}
<p class="hinweis">Je Zeile die eigenen Punkte links, die des Gegners rechts eintragen. Reihung: Siege, direkter Vergleich, Ballpunkt-Differenz.</p>
</section>`;

// ---- Seite 3: Playoff
const gs = (s) => (s.gewinnsaetze || 1) > 1;
// je Spiel zwei Zeilen (Heim oben, Gast unten), pro Satz ein Kästchen je Team, dazu gewonnene Sätze
const koZeilen = zeiten(ko).map((z) => {
  const sp = ko.filter((s) => s.zeit === z);
  const saetze = (s) => gs(s) ? '<td class="b"><span class="box"></span></td><td class="b"><span class="box"></span></td><td class="b"><span class="box"></span></td><td class="b s"><span class="box"></span></td>'
    : '<td class="b"><span class="box"></span></td><td class="b x"></td><td class="b x"></td><td class="b s"><span class="box"></span></td>';
  return sp.map((s, i) => `<tr class="${i === 0 ? 'neu' : 'spiel'}">${i === 0 ? `<td class="zeit" rowspan="${sp.length * 2}">${uhr(z)}</td>` : ''}
    <td class="c" rowspan="2">${s.feld || ''}</td><td class="c" rowspan="2">${s.nr}</td><td class="titel" rowspan="2">${h(s.titel)}</td>
    <td class="team">${teil(s.heim, s.heimText)}</td>${saetze(s)}<td class="klein team" rowspan="2">${schiri(s)}</td></tr>
    <tr class="gast"><td class="team">${teil(s.gast, s.gastText)}</td>${saetze(s)}</tr>`).join('');
}).join('');
const seite3 = `<section>${kopf('Playoff – Spielplan', d.modus.includes('KO') ? 'alle Spiele 2 Gewinnsätze (3. Satz auf 15)' : '')}
<table class="plan ko"><colgroup><col style="width:12mm"><col style="width:10mm"><col style="width:11mm"><col style="width:24mm"><col><col style="width:13mm"><col style="width:13mm"><col style="width:13mm"><col style="width:14mm"><col style="width:34mm"></colgroup>
<thead><tr><th>Zeit</th><th>Feld</th><th>Spiel</th><th>Runde</th><th>Teams</th><th>1. Satz</th><th>2. Satz</th><th>3. Satz</th><th>Sätze</th><th>Schiedsgericht</th></tr></thead>
<tbody>${koZeilen}</tbody></table>
<h2>Endstand</h2>
<table class="end"><tbody>${Array.from({ length: Object.keys(d.teams).length / 2 }, (_, i) => `<tr><td class="c">${i + 1}.</td><td></td><td class="c">${i + 1 + Object.keys(d.teams).length / 2}.</td><td></td></tr>`).join('')}</tbody></table>
</section>`;

const html = `<!doctype html><html lang="de"><head><meta charset="utf-8"><title>${h(d.name)} – Druck</title><style>
@page{size:A4;margin:12mm 12mm 12mm}
*{box-sizing:border-box}html{-webkit-print-color-adjust:exact;print-color-adjust:exact}
body{margin:0;font-family:"Segoe UI",Arial,sans-serif;font-size:10.5pt;color:#000}
section{page-break-after:always}section:last-child{page-break-after:auto}
header{display:flex;align-items:center;gap:14px;padding-bottom:8px;margin-bottom:10px;border-bottom:2px solid #000}
.logo{flex:none;width:150px;height:36px;background:#000;-webkit-mask:url(${logo}) left center/contain no-repeat;mask:url(${logo}) left center/contain no-repeat}
header .t{font-size:17pt;font-weight:800;line-height:1.1}header .u{font-size:9.5pt;color:#333}
h2{font-size:13pt;margin:14px 0 6px}
table{width:100%;border-collapse:collapse}
th,td{border:1px solid #000;padding:4px 6px;vertical-align:middle}
thead th{background:#ddd;font-size:8.5pt;text-transform:uppercase;letter-spacing:.03em;text-align:left}
.c{text-align:center}.zeit{font-weight:800;text-align:center;width:13mm}
tr.neu td{border-top:2px solid #000}
.plan td{height:8.4mm}.vr td{height:12.4mm}.vr td.erg .box{height:7.5mm;width:9.5mm}.ko td{height:9.5mm}.ko{table-layout:fixed}.ko tr.gast td{border-top:1px dashed #888}.ko tr.spiel td{border-top:1.5px solid #000}.ko td.b{text-align:center;padding:2px}.ko td.s{background:#eee}.ko td.x{background:repeating-linear-gradient(45deg,#ccc 0 1px,#fff 1px 6px)}.ko .linie{height:4mm}
.erg{white-space:nowrap;text-align:center;width:24mm}.ko .box{width:8mm;height:6.5mm;margin:0}.ko td.team{font-size:9.5pt}
.box{display:inline-block;width:8.5mm;height:6.5mm;border:1px solid #555;border-radius:2px;vertical-align:middle;margin:0 3px;background:#fff}
.klein{font-size:8.5pt}.titel{font-size:8.5pt;font-weight:700;width:24mm}
.team{line-height:1.15}.platzhalter{display:block;font-size:7.5pt;color:#444;font-style:italic}.linie{display:block;border-bottom:1px solid #777;height:5mm}
.hinweis{font-size:8.5pt;color:#333;margin:6px 0 0}
.teams{display:grid;grid-template-columns:1fr 1fr;gap:6px 20px;margin-top:10px;font-size:9pt}.teams div{display:flex;flex-direction:column;gap:1px}
.kreuz th.tm{text-align:left;width:52mm;white-space:nowrap;background:#ddd;font-size:9.5pt}.kreuz .nr{display:inline-block;width:5mm;font-weight:800}
.kreuz th.sp{text-align:center;width:20mm}.kreuz td{height:15mm;text-align:center}
.kreuz td.leer{background:repeating-linear-gradient(45deg,#bbb 0 2px,#eee 2px 7px)}
.kreuz td.feld{position:relative;padding-top:10px}.spnr{position:absolute;top:2px;left:4px;font-size:6.5pt;color:#555}
.doppel{display:inline-flex;align-items:center;gap:2px}.doppel span{display:inline-block;width:7.5mm;height:6.5mm;border:1px solid #555;border-radius:2px}
.baelle{color:#555}
.end td{height:9mm}.end td.c{width:12mm;font-weight:800}
</style></head><body>${seite1}${seite2}${seite3}</body></html>`;

await mkdir(ORDNER, { recursive: true });
const htmlDatei = path.join(ORDNER, 'U14-Turnier-Druck.html'), pdf = path.join(ORDNER, 'U14-Turnier-Druck.pdf');
await writeFile(htmlDatei, html);
const browser = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
execFileSync(browser, ['--headless=new', '--disable-gpu', '--no-pdf-header-footer', `--print-to-pdf=${pdf}`, 'file:///' + htmlDatei.replace(/\\/g, '/')], { stdio: 'ignore' });
console.log(pdf);
