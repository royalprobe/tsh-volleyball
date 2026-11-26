// Urkunden fürs U14-Turnier: je Team eine Seite mit eingedrucktem Teamnamen, der Platz bleibt zum händischen Eintragen frei.
// Am Ende zwei Urkunden ohne Teamnamen als Reserve. Ergebnis: turnier/druck/Urkunden-U14.pdf (A4, randlos gestaltet).
//   node werkzeuge/urkunden.mjs            → Teams von der Turnierseite
//   node werkzeuge/urkunden.mjs <API-URL>  → anderer Server
// Bild unten (Spielerinnen + Netz) aus Simons Vorlage (urkunde/vorlage.jpg, Swoosh rechts unten weggerechnet → urkunde/unten.png),
// Swooshes als Vektor, Steinbock im Kreis aus turnier/public/ts-zeichen.png.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'file:///C:/Users/Simon/VScode/beachliga/node_modules/playwright/index.mjs';

const BASIS = process.argv[2] || 'https://tsh-turnier-production.up.railway.app/';
const HIER = import.meta.dirname, PUB = path.join(HIER, '..', 'public'), AUS = path.join(HIER, '..', 'druck');
const RESERVE = 2;
const d = await (await fetch(new URL('api/stand', BASIS))).json();
const teams = Object.keys(d.teams).sort().map((id) => d.teams[id]);
const bild = async (datei) => 'data:image/png;base64,' + (await readFile(datei)).toString('base64');
const logo = await bild(path.join(HIER, 'urkunde', 'logo-volleyball.png')), steinbock = await bild(path.join(HIER, 'urkunde', 'steinbock.png')), unten = await bild(path.join(HIER, 'urkunde', 'unten.png'));
const h = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const NAVY = '#0a2c78', GOLD = '#f5c000';
// Ecke (Koordinaten in mm, Ursprung in der Ecke): Navy-Fläche, Goldband, weiße Lücke, auslaufendes Blauband
const ecke = (blau) => `<svg viewBox="0 0 170 75" width="170mm" height="75mm" xmlns="http://www.w3.org/2000/svg">
  <defs><linearGradient id="bl" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stop-color="#2d5cc4" stop-opacity=".95"/><stop offset=".55" stop-color="#5b84dc" stop-opacity=".55"/><stop offset="1" stop-color="#9db6ee" stop-opacity="0"/></linearGradient></defs>
  ${blau ? '<path d="M0 63 C 20 38, 72 8, 118 0 L 166 0 C 105 4, 38 30, 0 66 Z" fill="url(#bl)"/>' : ''}
  <path d="M0 0 H112 C 70 2, 15 30, 0 57 Z" fill="${GOLD}"/>
  <path d="M0 0 H100 C 62 2, 12 26, 0 49 Z" fill="${NAVY}"/>
</svg>`;

const seite = (team) => `<section class="seite">
  <div class="innen">
    <div class="ecke ol">${ecke(true)}</div>
    <img class="unten" src="${unten}" alt="">
    <div class="ecke ur">${ecke(false)}</div>
    <div class="logo"><div class="l1">TURNERSCHAFT HOHENEMS</div><span class="l2"></span></div>
    <div class="urkunde">URKUNDE</div><div class="balken"></div>
    <div class="fuer">FÜR DAS ERREICHEN DES</div>
    <div class="platz"><span class="feld"><span class="punkt">.</span></span><span class="pl">PLATZES</span></div>
    <div class="beim">BEIM</div>
    <div class="turnier"><div class="t1">HOHENEMSER</div><div class="t2">U14-VOLLEYBALLTURNIER</div></div>
    <div class="datum">Samstag, 28. November 2026 · Sportmittelschule Hohenems</div>
    <div class="trenner"><i></i><img class="steinbock" src="${steinbock}" alt=""><i></i></div>
    <div class="text">In Anerkennung eurer sportlichen Leistung,<br>eures Teamgeists und eures Engagements.</div>
    <div class="team"><small>TEAM</small><div class="name">${h(team || '')}</div></div>
    <div class="gratuliert"><i></i><span>Wir gratulieren herzlich!</span><i></i></div>
    <div class="verein">TS HOHENEMS VOLLEYBALL</div>
  </div>
</section>`;

const html = `<!doctype html><html lang="de"><head><meta charset="utf-8"><title>Urkunden U14-Turnier</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@500;600;700;800;900&display=block" rel="stylesheet">
<style>
@page{size:A4;margin:0}
*{box-sizing:border-box}html{-webkit-print-color-adjust:exact;print-color-adjust:exact}
body{margin:0;font-family:Montserrat,Arial,sans-serif;color:${NAVY}}
.seite{position:relative;width:210mm;height:297mm;overflow:hidden;break-after:page;background:#fff}
.seite:last-child{break-after:auto}
.seite::before{content:"";position:absolute;inset:4.5mm;border:.9mm solid ${NAVY};border-radius:1mm}
.innen{position:absolute;left:7mm;top:7mm;width:196mm;height:283mm;overflow:hidden;text-align:center}
.innen>*{position:absolute;left:0;right:0}
.ecke{width:170mm;height:75mm}.ecke.ol{left:0;top:0;transform:scale(.82);transform-origin:0 0}.ecke.ur{left:auto;right:0;top:auto;bottom:0;transform:rotate(180deg)}
.unten{left:0;right:auto;bottom:0;width:196mm;-webkit-mask:linear-gradient(to bottom,transparent 0,#000 9mm);mask:linear-gradient(to bottom,transparent 0,#000 9mm)}
.logo{left:auto;right:8mm;top:12mm;width:80mm;height:14.4mm}
.l1{position:absolute;left:0;top:-1.1mm;font-size:15.2pt;font-weight:400;line-height:1;white-space:nowrap;text-align:left}
.l2{position:absolute;left:0;right:0;bottom:0;height:9.63mm;background:${NAVY};-webkit-mask:url(${logo}) left bottom/100% 100% no-repeat;mask:url(${logo}) left bottom/100% 100% no-repeat}
.urkunde{top:29mm;font-size:70pt;font-weight:900;letter-spacing:.02em;line-height:1}
.balken{top:55mm;left:38mm;right:38mm;height:1.6mm;border-radius:1mm;background:linear-gradient(90deg,transparent,${GOLD} 12%,${GOLD} 88%,transparent)}
.fuer{top:61mm;font-size:15pt;font-weight:600;letter-spacing:.16em}
.platz{top:69mm;display:flex;justify-content:center;align-items:center;gap:6mm}
.feld{width:36mm;height:25mm;border:.7mm solid ${NAVY};border-radius:4mm;background:#f3f6fc}
.feld{position:relative}.punkt{position:absolute;right:4mm;bottom:4.5mm;font-size:36pt;font-weight:900;line-height:.6}.pl{font-size:36pt;font-weight:900;letter-spacing:.03em;line-height:1;margin-right:6mm}
.beim{top:97.5mm;font-size:15pt;font-weight:600;letter-spacing:.16em}
.turnier{top:104.5mm;font-weight:900;line-height:1.02}.t1{font-size:42pt;letter-spacing:.04em}.t2{font-size:35pt}
.datum{top:134mm;font-size:11pt;font-weight:600;color:#3a5590}
.trenner{top:140.5mm;display:flex;align-items:center;justify-content:center;gap:5mm}
.trenner i{display:block;width:62mm;height:1.1mm;border-radius:1mm;background:${GOLD}}
.steinbock{width:18mm;height:auto}
.text{top:162.5mm;font-size:12.5pt;font-weight:500;line-height:1.45;color:#1d3a80}
.team{top:177mm;left:18mm;right:18mm;height:23mm;border:.8mm solid ${NAVY};border-radius:5mm;background:#fff;display:flex;flex-direction:column;justify-content:center}
.team small{position:absolute;top:2.2mm;left:0;right:0;font-size:8.5pt;font-weight:700;letter-spacing:.3em;color:#5a6f9e}
.team .name{font-size:27pt;font-weight:800;padding-top:3mm;white-space:nowrap}
.gratuliert{top:203mm;display:flex;align-items:center;justify-content:center;gap:5mm;font-size:15pt;font-weight:700}
.gratuliert i{display:block;width:34mm;height:1mm;border-radius:1mm;background:${GOLD}}
.verein{top:210.5mm;font-size:10pt;font-weight:700;letter-spacing:.12em}
</style></head><body>
${[...teams, ...Array(RESERVE).fill('')].map(seite).join('')}
</body></html>`;

await mkdir(AUS, { recursive: true });
const htmlDatei = path.join(AUS, 'Urkunden-U14.html'), pdf = path.join(AUS, 'Urkunden-U14.pdf');
await writeFile(htmlDatei, html);
const b = await chromium.launch();
const p = await b.newPage();
await p.goto('file:///' + htmlDatei.replace(/\\/g, '/'), { waitUntil: 'networkidle' });
await p.evaluate(() => document.fonts.ready);
// obere Logozeile in Montserrat auf die Breite von „VOLLEYBALL“ bringen (im Logo-PNG ist sie oben angeschnitten)
await p.evaluate(() => {
  for (const z of document.querySelectorAll('.l1')) {
    const ziel = z.parentElement.getBoundingClientRect().width;
    let ls = 0;
    for (let i = 0; i < 40; i++) { z.style.letterSpacing = ls + 'px'; const b = z.getBoundingClientRect().width - ls; ls += (ziel - b) / z.textContent.length; }
    z.style.letterSpacing = ls + 'px';
  }
});
await p.pdf({ path: pdf, preferCSSPageSize: true, printBackground: true });
await b.close();
console.log(pdf, teams.length + RESERVE, 'Seiten');
