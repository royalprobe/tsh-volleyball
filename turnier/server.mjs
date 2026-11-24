// Kleiner Server für das U14-Turnier: liefert das Widget (tsh-turnier.js), den Stand als JSON und nimmt Ergebnisse
// und Teamnamen entgegen (nur mit PIN). Änderungen gehen per Server-Sent Events sofort an alle offenen Seiten.
// Ohne Abhängigkeiten. Daten in $DATA_DIR/turnier-daten.json (Railway-Volume), Grundeinstellungen in turnier.json.
//   PIN       – zum Eintragen (Pflicht, sonst ist Eintragen gesperrt)
//   DATA_DIR  – Ablage der Ergebnisse (Standard: ./daten)
//   PORT      – Port (Railway setzt ihn)
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir, rename, appendFile } from 'node:fs/promises';
import { timingSafeEqual, createHash } from 'node:crypto';
import path from 'node:path';
import { stand, pruefen, spielplan, format } from './plan.mjs';

const ORDNER = import.meta.dirname;
const DATA_DIR = process.env.DATA_DIR || path.join(ORDNER, 'daten');
const DATEI = path.join(DATA_DIR, 'turnier-daten.json');
const PROTOKOLL = path.join(DATA_DIR, 'protokoll.jsonl');   // jede Änderung und jede Anmeldung, eine Zeile je Eintrag
const PIN = process.env.PIN || '';
const PORT = Number(process.env.PORT || 8098);

const grund = JSON.parse(await readFile(path.join(ORDNER, 'turnier.json'), 'utf8'));
let daten = { teams: {}, ergebnisse: {}, version: 0 };
try { daten = { ...daten, ...JSON.parse(await readFile(DATEI, 'utf8')) }; } catch { /* noch nichts gespeichert */ }
format(grund.format || '12');   // "12" oder "9" Teams (plan.mjs)
const SPIEL_IDS = new Set(spielplan().map((s) => s.id));
const TEAM_IDS = new Set(spielplan().flatMap((s) => [s.heim.t, s.gast.t]).filter(Boolean));

async function speichern() {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(DATEI + '.neu', JSON.stringify(daten));
  await rename(DATEI + '.neu', DATEI);   // in einem Schritt ersetzen
}
/** Eintrag ins Protokoll: Zeit, wer (Name/Gerät vom Widget), was, vorher, nachher */
async function protokoll(req, eintrag) {
  const wer = String(req.headers['x-name'] || '').trim().slice(0, 40), geraet = String(req.headers['x-geraet'] || '').slice(0, 12);
  await mkdir(DATA_DIR, { recursive: true });
  await appendFile(PROTOKOLL, JSON.stringify({ zeit: new Date().toISOString(), wer, geraet, ...eintrag }) + '\n');
}
const spielText = (id) => { const sp = aktuell().spiele.find((s) => s.id === id); return sp ? { nr: sp.nr, titel: sp.titel, heim: sp.heim ? aktuell().teams[sp.heim] : sp.heimText, gast: sp.gast ? aktuell().teams[sp.gast] : sp.gastText } : { nr: id }; };
const aktuell = () => ({ ...stand({ ...grund, teams: { ...grund.teams, ...daten.teams } }, daten.ergebnisse), version: daten.version });

// ---- Live: Server-Sent Events
const zuhoerer = new Set();
function senden() {
  const text = `data: ${JSON.stringify({ version: daten.version })}\n\n`;
  for (const res of zuhoerer) res.write(text);
}
setInterval(() => { for (const res of zuhoerer) res.write(': ping\n\n'); }, 25000);

const pinOk = (p) => {
  if (!PIN || typeof p !== 'string') return false;
  const a = createHash('sha256').update(p).digest(), b = createHash('sha256').update(PIN).digest();
  return timingSafeEqual(a, b);
};
const fehlversuche = new Map();   // IP -> [Anzahl, seit]

function json(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*' });
  res.end(JSON.stringify(obj));
}
async function lesen(req) {
  let s = '';
  for await (const teil of req) { s += teil; if (s.length > 20000) throw new Error('zu groß'); }
  return JSON.parse(s || '{}');
}

createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  try {
    if (req.method === 'OPTIONS') {
      res.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST', 'Access-Control-Allow-Headers': 'Content-Type, X-PIN, X-Name, X-Geraet', 'Access-Control-Max-Age': '86400' });
      return res.end();
    }
    if (req.method === 'GET' && url.pathname === '/api/stand') return json(res, 200, aktuell());
    if (req.method === 'GET' && url.pathname === '/api/live') {
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive', 'Access-Control-Allow-Origin': '*' });
      res.write(`data: ${JSON.stringify({ version: daten.version })}\n\n`);
      zuhoerer.add(res);
      req.on('close', () => zuhoerer.delete(res));
      return;
    }
    if (req.method === 'POST' && url.pathname.startsWith('/api/')) {
      const ip = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress).split(',')[0].trim();
      const [n, seit] = fehlversuche.get(ip) || [0, Date.now()];
      if (n >= 10 && Date.now() - seit < 10 * 60000) return json(res, 429, { fehler: 'Zu viele falsche PINs – bitte in 10 Minuten nochmal.' });
      if (!pinOk(req.headers['x-pin'])) {
        fehlversuche.set(ip, Date.now() - seit < 10 * 60000 ? [n + 1, seit] : [1, Date.now()]);
        if (url.pathname === '/api/pin') await protokoll(req, { art: 'anmeldung', ok: false });
        return json(res, 401, { fehler: PIN ? 'Falsche PIN.' : 'Eintragen ist nicht eingerichtet (keine PIN gesetzt).' });
      }
      fehlversuche.delete(ip);
      const b = await lesen(req);
      if (url.pathname === '/api/pin') { await protokoll(req, { art: 'anmeldung', ok: true }); return json(res, 200, { ok: true }); }
      if (url.pathname === '/api/protokoll') {
        let zeilen = [];
        try { zeilen = (await readFile(PROTOKOLL, 'utf8')).split('\n').filter(Boolean).map((z) => JSON.parse(z)); } catch { /* noch leer */ }
        return json(res, 200, { eintraege: zeilen.reverse() });
      }
      if (url.pathname === '/api/ergebnis') {
        if (!SPIEL_IDS.has(b.spiel)) return json(res, 400, { fehler: 'Unbekanntes Spiel.' });
        const vorher = daten.ergebnisse[b.spiel] || null;
        let nachher = null;
        if (b.ergebnis !== null) {
          nachher = Array.isArray(b.ergebnis) ? b.ergebnis.map(Number) : null;
          const f = pruefen(nachher);
          if (f) return json(res, 400, { fehler: f });
        }
        if (JSON.stringify(vorher) === JSON.stringify(nachher)) return json(res, 200, aktuell());   // nichts geändert
        await protokoll(req, { art: 'ergebnis', spiel: spielText(b.spiel), vorher, nachher });
        if (nachher) daten.ergebnisse[b.spiel] = nachher; else delete daten.ergebnisse[b.spiel];
      } else if (url.pathname === '/api/teams') {
        const aenderungen = [];
        for (const [id, name] of Object.entries(b.teams || {})) {
          if (!TEAM_IDS.has(id)) continue;
          const n = String(name || '').trim().slice(0, 40), alt = daten.teams[id] || '';
          if (n === alt) continue;
          aenderungen.push({ team: id, vorher: alt || null, nachher: n || null });
          if (n) daten.teams[id] = n; else delete daten.teams[id];
        }
        if (!aenderungen.length) return json(res, 200, aktuell());
        await protokoll(req, { art: 'teams', aenderungen });
      } else return json(res, 404, { fehler: 'Unbekannt.' });
      daten.version++;
      await speichern();
      senden();
      return json(res, 200, aktuell());
    }
    if (req.method === 'GET' && ['/tsh-turnier.js', '/logo.png', '/ts-zeichen.png', '/ball-zeichen.png', '/'].includes(url.pathname)) {
      const datei = url.pathname === '/' ? 'vorschau.html' : url.pathname.slice(1);
      const typ = { js: 'text/javascript; charset=utf-8', png: 'image/png', html: 'text/html; charset=utf-8' }[datei.split('.').pop()];
      res.writeHead(200, { 'Content-Type': typ, 'Cache-Control': datei.endsWith('.js') ? 'no-cache' : 'public, max-age=3600', 'Access-Control-Allow-Origin': '*' });
      return res.end(await readFile(path.join(ORDNER, 'public', datei)));
    }
    json(res, 404, { fehler: 'Nicht gefunden.' });
  } catch (e) {
    json(res, 500, { fehler: 'Fehler: ' + e.message });
  }
}).listen(PORT, () => console.log(`U14-Turnier auf Port ${PORT}${PIN ? '' : ' (ohne PIN – Eintragen gesperrt)'}`));
