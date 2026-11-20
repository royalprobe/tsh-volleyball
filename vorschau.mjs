// Lokale Vorschau: http://localhost:8097/ zeigt die echte Volleyball-Seite von ts-hohenems.at mit dem Widget statt der
// bisherigen Inhalte (wie es nach dem Umbau in Jimdo aussehen soll). public/ wird unter / ausgeliefert.
// Vorher `npm run holen`, damit public/daten.json da ist. ?leer zeigt das Widget allein auf einer leeren Seite.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const PORT = Number(process.env.PORT || 8097);
const OEFFENTLICH = path.join(import.meta.dirname, 'public');
const SEITE = 'https://www.ts-hohenems.at/sparten/volleyball/';
const TYPEN = { '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.ics': 'text/calendar', '.html': 'text/html' };
let jimdo = null;

const snippet = `<div class="j-module n j-htmlCode"><div id="tsh-volleyball"></div>
<script src="http://localhost:${PORT}/tsh-volleyball.js" defer></script></div>`;

createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  try {
    if (url.pathname === '/') {
      let html;
      if (url.searchParams.has('leer')) {
        html = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>TSH Volleyball</title>
<link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700;800&display=swap" rel="stylesheet">
<body style="margin:0;padding:24px 16px;font-family:Montserrat,sans-serif;background:#fff"><div style="max-width:940px;margin:auto">${snippet}</div></body>`;
      } else {
        jimdo ??= await (await fetch(SEITE)).text();
        // so, wie die Seite in Jimdo aussehen soll: das Widget als einziges Element im Inhaltsbereich
        // (die bisherigen Elemente – Überschrift, Bild, Kontakt, Trainingszeiten – stecken jetzt im Widget)
        html = jimdo.replace('<head>', `<head><base href="${SEITE}">`)
          .replace(/(<div id="content_area" data-container="content">)[\s\S]*?(<!-- END _content\.sass -->)/,
            `$1${snippet}</div></div></div>\n    $2`);
      }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
      return res.end(html);
    }
    const datei = path.join(OEFFENTLICH, path.normalize(decodeURIComponent(url.pathname)).replace(/^([/\\])+/, ''));
    if (!datei.startsWith(OEFFENTLICH)) throw new Error('außerhalb');
    const inhalt = await readFile(datei);
    res.writeHead(200, { 'Content-Type': TYPEN[path.extname(datei)] ?? 'application/octet-stream', 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*' });
    res.end(inhalt);
  } catch {
    res.writeHead(404).end('nicht gefunden');
  }
}).listen(PORT, () => console.log(`Vorschau: http://localhost:${PORT}/  (nur das Widget: http://localhost:${PORT}/?leer)`));
