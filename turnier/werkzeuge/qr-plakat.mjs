// A4-Aushang mit großem QR-Code zur Turnierseite → turnier/druck/QR-Spielplan-Tabelle.pdf
//   node werkzeuge/qr-plakat.mjs [URL]
// QR-Code per Python-Paket segno (als SVG), PDF per Playwright (aus beachliga/node_modules wie bei den Urkunden).
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { chromium } from 'file:///C:/Users/Simon/VScode/beachliga/node_modules/playwright/index.mjs';

const URL_ = process.argv[2] || 'https://www.ts-hohenems.at/sparten/volleyball/u14-turnier';
const HIER = import.meta.dirname, AUS = path.join(HIER, '..', 'druck');
const svg = execFileSync('C:/Program Files/Python314/python.exe', ['-c',
  'import segno,sys,io;q=segno.make(sys.argv[1],error="m");b=io.BytesIO();q.save(b,kind="svg",border=0,dark="#000",xmldecl=False,svgns=True,omitsize=True);sys.stdout.write(b.getvalue().decode())', URL_]).toString();
// Logo wie auf den Urkunden: obere Zeile als Text (im Logo-PNG oben angeschnitten), darunter „VOLLEYBALL“ aus urkunde/logo-volleyball.png
const logo = 'data:image/png;base64,' + (await readFile(path.join(HIER, 'urkunde', 'logo-volleyball.png'))).toString('base64');
const NAVY = '#000', GOLD = '#000';   // schwarz-weiß (Simon hat nur einen S/W-Drucker)
const html = `<!doctype html><html lang="de"><head><meta charset="utf-8"><title>QR Spielplan und Tabelle</title>
<link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@500;600;700;800;900&display=block" rel="stylesheet">
<style>
@page{size:A4;margin:0}*{box-sizing:border-box}html{-webkit-print-color-adjust:exact;print-color-adjust:exact}
body{margin:0;font-family:Montserrat,Arial,sans-serif;color:${NAVY}}
.seite{position:relative;width:210mm;height:297mm;overflow:hidden;display:flex;flex-direction:column;align-items:center;text-align:center;padding-top:18mm}
.seite::before{content:"";position:absolute;inset:6mm;border:1mm solid ${NAVY};border-radius:2mm}
.logo{position:relative;width:100mm;height:18mm}.l1{position:absolute;left:0;top:-1.4mm;font-size:19pt;font-weight:400;line-height:1;white-space:nowrap;text-align:left}
.l2{position:absolute;left:0;right:0;bottom:0;height:12.04mm;background:${NAVY};-webkit-mask:url(${logo}) left bottom/100% 100% no-repeat;mask:url(${logo}) left bottom/100% 100% no-repeat}
.u14{margin-top:10mm;font-size:16pt;font-weight:700;letter-spacing:.14em;text-transform:uppercase}
h1{margin:3mm 0 0;font-size:50pt;font-weight:900;line-height:1.05}
.balken{width:110mm;height:1.2mm;margin:6mm 0 8mm;border-radius:1mm;background:linear-gradient(90deg,transparent,${GOLD} 12%,${GOLD} 88%,transparent)}
.qr{width:118mm;height:118mm;padding:6mm;border:.8mm solid ${NAVY};border-radius:6mm;background:#fff}.qr svg{display:block;width:100%;height:100%}
.text{margin-top:8mm;font-size:17pt;font-weight:700;line-height:1.35}
.klein{margin-top:3mm;font-size:12pt;font-weight:500;color:#333}
.url{margin-top:6mm;font-size:10pt;font-weight:600;color:#555}
</style></head><body><section class="seite">
<div class="logo"><div class="l1">TURNERSCHAFT HOHENEMS</div><span class="l2"></span></div>
<div class="u14">U14-Turnier weiblich · 28. November 2026</div>
<h1>Spielplan<br>&amp; Tabelle</h1>
<div class="balken"></div>
<div class="qr">${svg}</div>
<div class="text">Alle Spiele, Ergebnisse und die Tabelle<br>live auf dem Handy</div>
<div class="klein">QR-Code mit der Handykamera scannen</div>
<div class="url">${URL_.replace(/^https:\/\/(www\.)?/, '').replace(/\/$/, '')}</div>
</section></body></html>`;
await mkdir(AUS, { recursive: true });
const htmlDatei = path.join(AUS, 'QR-Spielplan-Tabelle.html'), pdf = path.join(AUS, 'QR-Spielplan-Tabelle.pdf');
await writeFile(htmlDatei, html);
const b = await chromium.launch(), p = await b.newPage();
await p.goto('file:///' + htmlDatei.replaceAll(path.sep, '/'), { waitUntil: 'load' });
await p.evaluate(() => document.fonts.ready);
await p.evaluate(() => {   // obere Logozeile auf die Breite von „VOLLEYBALL“ bringen
  const z = document.querySelector('.l1'), ziel = z.parentElement.getBoundingClientRect().width;
  let ls = 0;
  for (let i = 0; i < 40; i++) { z.style.letterSpacing = ls + 'px'; ls += (ziel - (z.getBoundingClientRect().width - ls)) / z.textContent.length; }
  z.style.letterSpacing = ls + 'px';
});
await p.pdf({ path: pdf, preferCSSPageSize: true, printBackground: true });
await b.close();
console.log(pdf);
