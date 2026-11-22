// Sammelt alles für das Volleyball-Widget der TS Hohenems und schreibt public/daten.json (+ Kalender je Team).
// Läuft alle 15 Minuten als GitHub-Workflow (.github/workflows/daten.yml), lokal mit `npm run holen`.
//
// Quellen (alle öffentlich, nur lesen):
//  - vvv.volleynet.at: Termine, Ergebnisse, Kader von Liga, Cup und Nachwuchs (robots.txt erlaubt das Abrufen).
//    Die Seiten sind langsam (mehrere Sekunden je Seite): Termine und Kader einmal am Tag ab 18 Uhr, Ergebnisse nur,
//    solange ein angepfiffenes Spiel noch ohne Ergebnis ist.
//  - volley-ball.at/landesklasse/api.php?p=liga: Spielplan, Termine, Ergebnisse der Landesklasse (nur lesen).
//  - volley-ball.at/liga.php: die VolleyStation-Match-IDs der Spiele (für den Live-Spielstand im Widget), alle 6 Stunden.
// Der vorige Stand kommt aus public/daten.json bzw. (im Workflow) von der veröffentlichten Seite (VORHER_URL).
import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';

const ORDNER = import.meta.dirname;
const AUSGABE = path.join(ORDNER, 'public');
const VEREIN = process.env.VEREIN || 'Hohenems';   // Namensteil, an dem die Teams des Vereins erkannt werden
const UA = 'TSH-Volleyball-Widget (ts-hohenems.at)';
const ZONE = 'Europe/Vienna';

// Saison 2026/27: volleynet-Phase => [Kürzel, Name der Phase] (Menü auf vvv.volleynet.at)
const PHASEN = {
  39903: ['1LLH', 'Meisterschaftsphase'], 39904: ['2LLH', 'Meisterschaftsphase'], 39905: ['1LLD', 'Meisterschaftsphase'],
  39906: ['2LLD', 'Grunddurchgang'], 39907: ['3LLD', 'Grunddurchgang Oberland'], 39908: ['3LLD', 'Grunddurchgang Unterland'],
  39909: ['3LLD', 'Oberes Meister-Playoff'], 39910: ['3LLD', 'Unteres Meister-Playoff'],
  39911: ['VCH', 'Vorarlberg Cup Herren'], 39912: ['VCD', 'Vorarlberg Cup Damen'],
  40041: ['U20w', 'Landesmeisterschaft'], 40042: ['U20m', 'Landesmeisterschaft'],
  40216: ['NWU18w', 'Nachwuchsliga'], 40215: ['NWU18m', 'Nachwuchsliga'],
  40212: ['NWU16w', 'Gruppe A'], 40213: ['NWU16w', 'Gruppe B'], 40214: ['NWU16m', 'Nachwuchsliga'],
};
const TURNIER = [40041];   // K.-o.-Turnier: Endstand statt Punktetabelle
// Kürzel => [Name im Widget, Kurzname, VolleyStation-Website der Liga (für den Link zum Spiel)]
const BEWERBE = {
  '1LLH': ['1. Landesliga Herren', '1. LL Herren', 1155], '2LLH': ['2. Landesliga Herren', '2. LL Herren', 1163],
  '1LLD': ['1. Landesliga Damen', '1. LL Damen', 1164], '2LLD': ['2. Landesliga Damen', '2. LL Damen', 1165],
  '3LLD': ['3. Landesliga Damen', '3. LL Damen', 1166],
  'VCH': ['Vorarlberg Cup Herren', 'Cup Herren', 1173], 'VCD': ['Vorarlberg Cup Damen', 'Cup Damen', 1174],
  'U20w': ['U20 weiblich', 'U20 w', 1227], 'U20m': ['U20 männlich', 'U20 m', 1226],
  'NWU18w': ['U18 weiblich', 'U18 w', 1241], 'NWU18m': ['U18 männlich', 'U18 m', 1244],
  'NWU16w': ['U16 weiblich', 'U16 w', 1242], 'NWU16m': ['U16 männlich', 'U16 m', 1243],
};
const HERREN = ['1LLH', '2LLH', 'VCH'], DAMEN = ['1LLD', '2LLD', '3LLD', 'VCD'];
const DREI_GEWINNSAETZE = [...HERREN, ...DAMEN];   // Nachwuchs teils auf 2 Gewinnsätze
const WERTUNG_2_0 = ['U20w', 'U20m', 'NWU18w', 'NWU18m', 'NWU16w', 'NWU16m'];
const KADER_BEWERBE = {   // Abschnitte der volleynet-Seite „Mannschaften“
  '1. Landesliga Herren': '1LLH', '2. Landesliga Herren': '2LLH', '1. Landesliga Damen': '1LLD',
  '2. Landesliga Damen': '2LLD', '3. Landesliga Damen': '3LLD', 'Vorarlberg Cup Herren': 'VCH', 'Vorarlberg Cup Damen': 'VCD',
};
const LK_API = 'https://volley-ball.at/landesklasse/api.php?p=liga';
const KADER_VERSION = 2;
const TERMINE_UHR = 18, SPIELDAUER_MIN = 60, NACHSEHEN_TAGE = 3;

// ---------------------------------------------------------------- Hilfen
const jetzt = new Date();
const wien = (d = jetzt) => Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: ZONE, year: 'numeric', month: '2-digit',
  day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(d).map((p) => [p.type, p.value]));
const heute = (() => { const w = wien(); return `${w.year}-${w.month}-${w.day}`; })();
/** Zeitpunkt (ms) eines Termins in Wiener Zeit */
function zeitpunkt(datum, zeit) {
  const probe = new Date(`${datum}T${zeit || '20:00'}:00Z`);
  const w = wien(probe);
  const versatz = Date.UTC(+w.year, +w.month - 1, +w.day, +w.hour % 24, +w.minute) - probe.getTime();
  return probe.getTime() - versatz;
}
const ab18Heute = zeitpunkt(heute, `${TERMINE_UHR}:00`);
const klein = (s) => String(s ?? '').toLowerCase().replace(/\s+/g, ' ').trim();
const eigen = (t) => klein(t).includes(klein(VEREIN));
const entities = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: '\u00a0', '#39': "'" };
const text = (h) => String(h).replace(/<[^>]*>/g, '').replace(/&(#\d+|#x[0-9a-f]+|\w+);/gi, (m, e) =>
  e[0] === '#' ? String.fromCodePoint(e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : +e.slice(1)) : entities[e.toLowerCase()] ?? m)
  .replace(/^[\s\u00a0]+|[\s\u00a0]+$/g, '');
const titelCase = (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
const halle = (s) => s.replace(/\{([^}]*)\}/g, (m, x) => x.split(/(\s|-)/).map(titelCase).join('')).trim();

async function holen(url, versuche = 2) {
  for (let i = 0; i < versuche; i++) {
    try {
      const a = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(45000) });
      if (a.ok) return await a.text();
    } catch { /* nochmal */ }
  }
  return null;
}
/** mehrere Seiten, höchstens 4 gleichzeitig (volleynet ist langsam) */
async function holenAlle(urls) {
  const raus = {}, liste = Object.entries(urls);
  for (let i = 0; i < liste.length; i += 4) {
    await Promise.all(liste.slice(i, i + 4).map(async ([k, u]) => { raus[k] = await holen(u); }));
  }
  return raus;
}
const zeilen = (html) => [...html.matchAll(/<tr class='table(?:hell|dunkel)'\s*>(.*?)<\/tr>/gs)]
  .map((z) => [...z[1].matchAll(/<td[^>]*>(.*?)<\/td>/gs)].map((c) => ({ text: text(c[1]), html: c[1] })));
const nummer = (s) => { let m = s.match(/^([A-Z0-9]+)-(\d{4})$/); if (m) return [m[1], m[2]]; m = s.match(/^([A-Za-z0-9]+)-(\d{3})$/); return m ? [m[1], s] : null; };
const datum = (s) => { const m = s.match(/(\d\d)\.(\d\d)\.(\d{4})/); return m ? `${m[3]}-${m[2]}-${m[1]}` : null; };
const fertig = (k, erg) => { if (!DREI_GEWINNSAETZE.includes(k)) return true; const [a, b] = erg.split(':').map(Number); return Math.max(a, b) >= 3; };

// ---------------------------------------------------------------- volleynet: Termine und Ergebnisse
async function volleynet(vorher) {
  const v = vorher?.volleynet;
  const alleFaellig = !v || (jetzt.getTime() >= ab18Heute && (v.stand_termine ?? 0) < ab18Heute)
    || JSON.stringify(v.phasen) !== JSON.stringify(Object.keys(PHASEN).map(Number));
  let phasen;
  if (alleFaellig) {
    phasen = Object.keys(PHASEN).map(Number);
  } else {   // nur Phasen mit angepfiffenen Spielen ohne Ergebnis
    const offen = new Set();
    for (const sp of Object.values(v.spiele)) {
      if (sp.ergebnis !== null) continue;
      const t = zeitpunkt(sp.datum, sp.zeit);
      if (jetzt >= t + SPIELDAUER_MIN * 60000 && jetzt <= t + NACHSEHEN_TAGE * 86400000) offen.add(sp.phase);
    }
    phasen = [...offen];
  }
  if (!phasen.length) return { ...v, geholt: false };
  const urls = {};
  for (const id of phasen) {
    if (alleFaellig) urls[`t${id}`] = `https://vvv.volleynet.at/Termine/${id}`;
    urls[`e${id}`] = `https://vvv.volleynet.at/Ergebnisse/${id}`;
  }
  const seiten = await holenAlle(urls);
  if (Object.values(seiten).some((s) => !s)) {
    console.warn('volleynet: nicht alle Seiten geladen, alter Stand bleibt');
    return v ? { ...v, geholt: false } : null;
  }
  const spiele = alleFaellig ? {} : structuredClone(v.spiele);
  for (const id of phasen) {
    // Termine: Rd. | Nr. | Tag | Datum | Zeit | Heim | Gast | Halle | Karte
    for (const z of alleFaellig ? zeilen(seiten[`t${id}`]) : []) {
      const nr = z.length >= 8 && nummer(z[1].text), d = nr && datum(z[3].text);
      if (!d) continue;
      const karte = z[8]?.html.match(/href="(https:\/\/www\.google\.[^"]+)"/)?.[1]?.replace(/&amp;/g, '&');
      const adresse = karte ? decodeURIComponent(new URL(karte).searchParams.get('q') || '').replace(/\s*\(.*$/, '') : '';
      spiele[nr[1]] = { kuerzel: nr[0], phase: id, datum: d, zeit: /^\d\d:\d\d$/.test(z[4].text) && z[4].text !== '00:00' ? z[4].text : '',
        heim: z[5].text, gast: z[6].text, halle: halle(z[7].text), adresse: adresse ? titelAdresse(adresse) : '', ergebnis: null, saetze: null, runde: +z[0].text };
    }
    // Ergebnisse: Rd. | Nr. | Datum | Heim | Gast | „0:3 (18:25, 21:25, 22:25)“
    for (const z of zeilen(seiten[`e${id}`])) {
      const nr = z.length >= 6 && nummer(z[1].text), d = nr && datum(z[2].text);
      const erg = d && z[5].text.match(/^(\d+:\d+)\s*\(([^)]*)\)/);
      if (!erg || !fertig(nr[0], erg[1])) continue;
      const alt = spiele[nr[1]] ?? {};
      spiele[nr[1]] = { kuerzel: nr[0], phase: id, datum: d, zeit: alt.zeit ?? '', heim: z[3].text, gast: z[4].text,
        halle: alt.halle ?? '', adresse: alt.adresse ?? '', ergebnis: erg[1], saetze: erg[2], runde: +z[0].text };
    }
  }
  console.log(`volleynet: ${alleFaellig ? 'alles' : 'Ergebnisse'} (${Object.keys(urls).length} Seiten)`);
  return { stand_termine: alleFaellig ? Date.now() : v.stand_termine, phasen: Object.keys(PHASEN).map(Number), spiele, geholt: true };
}
/** „JAKOB HANNIBAL-STRASSE 11, 6845 HOHENEMS“ -> Großbuchstaben-Orte normal schreiben */
const titelAdresse = (s) => s.replace(/\b[A-ZÄÖÜ]{3,}\b/g, titelCase);

// ---------------------------------------------------------------- volleynet: Kader
async function kader(vorher, teams) {
  const v = vorher?.kader;
  // KADER_VERSION erhöhen, wenn sich die Aufbereitung ändert – dann wird gleich neu geholt
  if (v && v.version === KADER_VERSION && !(jetzt.getTime() >= ab18Heute && (v.stand ?? 0) < ab18Heute)) return v;
  const liste = await holen('https://vvv.volleynet.at/Teams');
  if (!liste) return v ?? null;
  const urls = {};
  let k = null;
  for (const t of liste.matchAll(/<tr class="tablehead"><td[^>]*>(.*?)<\/td><\/tr>|<a\s+href="(https:\/\/vvv\.volleynet\.at\/Kader\/[0-9-]+)"\s*>(.*?)<\/a>/gs)) {
    if (t[1]) k = KADER_BEWERBE[text(t[1]).replace(/^VVV\s*-\s*/, '')] ?? null;
    else if (k && teams.has(`${k}|${text(t[3])}`)) urls[`${k}|${text(t[3])}`] = t[2];
  }
  const seiten = await holenAlle(urls);
  const raus = {};
  for (const [name, html] of Object.entries(seiten)) {
    const z = html && kaderZerlegen(html);
    if (z) raus[name] = z; else if (v?.teams?.[name]) raus[name] = v.teams[name];
  }
  console.log(`Kader: ${Object.keys(raus).length} Teams`);
  return { stand: Date.now(), version: KADER_VERSION, teams: raus };
}
function kaderZerlegen(html) {
  let teil = -1;
  const k = { spieler: [], betreuer: [] };
  for (const z of html.matchAll(/<tr[^>]*>(.*?)<\/tr>/gs)) {
    const c = [...z[1].matchAll(/<t[dh][^>]*>(.*?)<\/t[dh]>/gs)].map((x) => text(x[1]));
    if (c.length < 4) continue;
    if (c[1] === 'Name') { teil++; continue; }
    if (c[1] === '' || teil < 0) continue;
    const pos = c[3] === 'Nicht festgelegt' ? '' : c[3];
    if (teil === 0) k.spieler.push([/^\d{1,2}$/.test(c[0]) ? c[0] : '', name(c[1]), pos]);
    else k.betreuer.push([name(c[1]), pos]);
  }
  if (teil < 0) return null;
  k.spieler.sort((a, b) => (a[0] === '') - (b[0] === '') || +a[0] - +b[0] || a[1].localeCompare(b[1], 'de'));
  return k;
}
/** „Felicitas BALDAUF“ -> „Felicitas Baldauf“ */
const name = (s) => s.trim().split(/\s+/).map((w) => {
  const gross = !/[a-zà-öø-ÿ]/.test(w.replace(/ß/g, '')), klein_ = w === w.toLowerCase();   // „SCHIEßL“ zählt als groß geschrieben
  return (gross || klein_) && w.length > 1 ? w.split('-').map(titelCase).join('-') : w;
}).join(' ');

// ---------------------------------------------------------------- Landesklasse (volley-ball.at, nur lesen)
async function landesklasse(vorher) {
  const roh = await holen(LK_API);
  let d;
  try { d = JSON.parse(roh); } catch { return vorher?.lk ?? null; }
  const spiele = [], tabellen = {};
  for (const b of d.bewerbe ?? []) {
    const team = Object.fromEntries(b.teams.map((t) => [t.id, t]));
    const z = Object.fromEntries(b.teams.map((t) => [t.id, { name: t.anzeige, sp: 0, s: 0, n: 0, sa: 0, sg: 0, ba: 0, bg: 0, pkt: 0 }]));
    for (const termin of b.termine) {
      const info = d.termine?.[termin.id] ?? {};
      for (const sp of termin.spiele) {
        const e = d.ergebnisse?.[sp.id];
        let ergebnis = null, saetze = null;
        if (e?.saetze?.length) {
          let sa = 0, sb = 0, ba = 0, bb = 0;
          for (const [x, y] of e.saetze) { x > y ? sa++ : sb++; ba += x; bb += y; }
          ergebnis = `${sa}:${sb}`;
          saetze = e.saetze.map(([x, y]) => `${x}:${y}`).join(', ');
          const pa = sa === 2 ? (sb === 0 ? 3 : 2) : sa === 1 ? 1 : 0, pb = sb === 2 ? (sa === 0 ? 3 : 2) : sb === 1 ? 1 : 0;
          for (const [id, p, m, bp, bm, pk] of [[sp.a, sa, sb, ba, bb, pa], [sp.b, sb, sa, bb, ba, pb]]) {
            const t = z[id];
            if (!t) continue;
            t.sp++; p > m ? t.s++ : t.n++; t.sa += p; t.sg += m; t.ba += bp; t.bg += bm; t.pkt += pk;
          }
        }
        if (!info.datum) continue;
        spiele.push({ quelle: 'lk', kuerzel: `lk:${b.id}`, bewerb: `LK ${b.kurz}`, datum: info.datum, zeit: info.zeit ?? '',
          heim: team[sp.a]?.anzeige ?? sp.a, gast: team[sp.b]?.anzeige ?? sp.b, halle: info.ort ?? '', adresse: info.adresse ?? '',
          ergebnis, saetze, link: `https://volley-ball.at/landesklasse/#${encodeURIComponent(b.id)}` });
      }
    }
    tabellen[`lk:${b.id}`] = { name: `Landesklasse ${b.kurz}`, endstand: false, zeilen: reihen(Object.values(z), false) };
  }
  return { spiele, tabellen };
}

// ---------------------------------------------------------------- VolleyStation-Match-IDs (von volley-ball.at, nur lesen)
// Die Liga-Seiten von volley-ball.at führen bei jedem Spiel die VolleyStation-Match-ID (data-match bzw. spiel.php?id=…).
// Die braucht das Widget für den Live-Spielstand. Alle 6 Stunden, nur die Bewerbe, in denen der Verein spielt.
const VVV_LIGEN = {
  '1LLH': 'landesliga-herren-1', '2LLH': 'landesliga-herren-2', '1LLD': 'landesliga-damen-1', '2LLD': 'landesliga-damen-2',
  '3LLD': 'landesliga-damen-3', 'VCH': 'herren-vvv-cup', 'VCD': 'damen-vvv-cup',
  'U20w': 'nachwuchs-u20-weiblich', 'U20m': 'nachwuchs-u20-maennlich', 'NWU18w': 'nachwuchs-u18-weiblich',
  'NWU18m': 'nachwuchs-u18-maennlich', 'NWU16w': 'nachwuchs-u16-weiblich', 'NWU16m': 'nachwuchs-u16-maennlich',
};
async function volleystation(vorher, spiele) {
  const v = vorher?.vs;
  if (v && v.quelle === 'volley-ball.at' && Date.now() - v.stand < 6 * 3600000) return v;
  const kuerzel = [...new Set(Object.values(spiele).filter((s) => eigen(s.heim) || eigen(s.gast)).map((s) => s.kuerzel))].filter((k) => VVV_LIGEN[k]);
  const seiten = await holenAlle(Object.fromEntries(kuerzel.map((k) => [k, `https://volley-ball.at/liga.php?id=${VVV_LIGEN[k]}`])));
  const gefunden = [];   // { kuerzel, heim, gast, datum, id }
  for (const [k, html] of Object.entries(seiten)) {
    if (!html) continue;
    for (const a of html.matchAll(/<a class="hg-spiel"([^>]*)>/g)) {
      const attr = (n) => { const m = a[1].match(new RegExp(`${n}="([^"]*)"`)); return m ? text(m[1]) : ''; };
      const id = (attr('data-match') || (attr('href').match(/(?:spiel\.php\?id=|\/matches\/)(\d+)/) || [])[1]);
      if (!id) continue;
      gefunden.push({ kuerzel: attr('data-bewerb').replace(/^liga:/, '') || k, heim: attr('data-heim'), gast: attr('data-gast'), datum: attr('data-start').slice(0, 10), id: Number(id) });
    }
  }
  if (!gefunden.length) { console.warn('volley-ball.at: keine Match-IDs gefunden, alter Stand bleibt'); return v ?? { stand: 0, ids: {} }; }
  const ids = {};
  for (const [nr, sp] of Object.entries(spiele)) {
    const passt = gefunden.filter((g) => g.kuerzel === sp.kuerzel && klein(g.heim) === klein(sp.heim) && klein(g.gast) === klein(sp.gast));
    const m = passt.length > 1 ? passt.find((g) => g.datum === sp.datum) ?? passt[0] : passt[0];
    if (m) ids[nr] = m.id;
  }
  console.log(`Match-IDs von volley-ball.at: ${gefunden.length} Spiele, ${Object.keys(ids).length} zugeordnet`);
  return { stand: Date.now(), quelle: 'volley-ball.at', ids };
}

// ---------------------------------------------------------------- Tabellen
const quote = (p, m) => m === 0 ? (p === 0 ? 1 : Infinity) : p / m;
/** Zeilen [Platz, Team, Sp, S, N, Sätze+, Sätze−, Bälle+, Bälle−, Pkt]; gleicher Platz bleibt leer */
function reihen(teams, zweiNull, direkt = {}) {
  const schluessel = (t) => zweiNull ? [t.pkt, t.direkt ?? 0, quote(t.sa, t.sg), quote(t.ba, t.bg)] : [t.pkt, t.s, quote(t.sa, t.sg), quote(t.ba, t.bg)];
  if (zweiNull) {
    for (const t of teams) t.direkt = teams.filter((g) => g !== t && g.pkt === t.pkt).reduce((n, g) => n + (direkt[t.name]?.[g.name] ?? 0), 0);
  }
  const vergleich = (a, b) => { const x = schluessel(a), y = schluessel(b); for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return y[i] - x[i] > 0 ? 1 : -1; return 0; };
  teams.sort((a, b) => vergleich(a, b) || a.name.localeCompare(b.name, 'de'));
  return teams.map((t, i) => [i && !vergleich(teams[i - 1], t) ? '' : String(i + 1), t.name, ...[t.sp, t.s, t.n, t.sa, t.sg, t.ba, t.bg, t.pkt].map(String)]);
}
function tabelle(spiele, phase) {
  const k = PHASEN[phase][0], zweiNull = WERTUNG_2_0.includes(k);
  const t = {}, direkt = {};
  const team = (n) => (t[n] ??= { name: n, sp: 0, s: 0, n: 0, sa: 0, sg: 0, ba: 0, bg: 0, pkt: 0 });
  for (const sp of Object.values(spiele)) {
    if (sp.phase !== phase) continue;
    team(sp.heim); team(sp.gast);
    const m = sp.ergebnis?.match(/^(\d+):(\d+)$/);
    if (!m) continue;
    const [h, g] = [+m[1], +m[2]];
    let bh = 0, bg = 0;
    for (const x of String(sp.saetze).matchAll(/(\d+):(\d+)/g)) { bh += +x[1]; bg += +x[2]; }
    for (const [n, a, b, ba, bb] of [[sp.heim, h, g, bh, bg], [sp.gast, g, h, bg, bh]]) {
      const z = t[n];
      z.sp++; a > b ? z.s++ : z.n++; z.sa += a; z.sg += b; z.ba += ba; z.bg += bb;
      const p = zweiNull ? (a > b ? 2 : 0) : a > b ? (b === 2 ? 2 : 3) : a === 2 ? 1 : 0;
      z.pkt += p;
      const gegner = n === sp.heim ? sp.gast : sp.heim;
      (direkt[n] ??= {})[gegner] = (direkt[n][gegner] ?? 0) + p;
    }
  }
  return reihen(Object.values(t), zweiNull, direkt);
}
/** K.-o.-Turnier: Finale (höchste Spielnummer der letzten Runde) entscheidet Platz 1/2, das nächste Spiel 3/4 usw. */
function endstand(spiele, phase) {
  const basis = Object.fromEntries(tabelle(spiele, phase).map((z) => [z[1], z]));
  const gespielt = Object.entries(spiele).filter(([, s]) => s.phase === phase && /^\d+:\d+$/.test(s.ergebnis ?? '')).sort(([a], [b]) => a.localeCompare(b));
  if (!gespielt.length) return [];
  const sieger = (s) => { const [h, g] = s.ergebnis.split(':').map(Number); return h > g ? [s.heim, s.gast] : [s.gast, s.heim]; };
  const team = {};
  for (const [, s] of gespielt) { const [w, l] = sieger(s); team[w] = [s.runde, 1]; team[l] = [s.runde, 0]; }
  const letzte = Math.max(...gespielt.map(([, s]) => s.runde));
  const platz = {};
  for (const [, s] of gespielt.filter(([, s]) => s.runde === letzte).reverse()) for (const n of sieger(s)) platz[n] = Object.keys(platz).length + 1;
  const wert = (n) => { const z = basis[n] ?? ['', n, 0, 0, 0, 0, 0, 0, 0, 0]; return [platz[n] ? -platz[n] : -1000, team[n][0], team[n][1], +z[3], quote(+z[5], +z[6]), quote(+z[7], +z[8])]; };
  const namen = Object.keys(team).sort((a, b) => { const x = wert(a), y = wert(b); for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return y[i] - x[i]; return a.localeCompare(b, 'de'); });
  return namen.map((n, i) => { const z = [...(basis[n] ?? ['', n, '0', '0', '0', '0', '0', '0', '0', '0'])]; z[0] = String(i + 1); z[9] = ''; return z; });
}

// ---------------------------------------------------------------- Teams des Vereins
const gruppe = (s) => s.quelle === 'lk' ? s.kuerzel : HERREN.includes(s.kuerzel) ? 'H' : DAMEN.includes(s.kuerzel) ? 'D' : s.kuerzel;
const REIHENFOLGE = ['H', 'D', 'U20m', 'U20w', 'NWU18m', 'NWU18w', 'NWU16m', 'NWU16w'];

function vereinsdaten(vn, kaderDaten, lk, vs) {
  // alle Spiele (Liga, Cup, Nachwuchs, Landesklasse) in einer Form
  const alle = [];
  for (const [nr, sp] of Object.entries(vn?.spiele ?? {})) {
    const [, kurz, liga] = BEWERBE[sp.kuerzel] ?? [sp.kuerzel, sp.kuerzel];
    const id = vs?.ids?.[nr] ?? null;
    alle.push({ quelle: 'liga', kuerzel: sp.kuerzel, phase: sp.phase, nr, bewerb: kurz, datum: sp.datum, zeit: sp.zeit, heim: sp.heim, gast: sp.gast,
      halle: sp.halle, adresse: sp.adresse, ergebnis: sp.ergebnis, saetze: sp.saetze, vs: id,
      // Spielseite auf volley-ball.at (Aufstellung, Spielverlauf, live); ohne Match-ID die Liga-Seite dort
      link: id ? `https://volley-ball.at/spiel.php?id=${id}` : VVV_LIGEN[sp.kuerzel] ? `https://volley-ball.at/liga.php?id=${VVV_LIGEN[sp.kuerzel]}` : null });
  }
  alle.push(...(lk?.spiele ?? []));
  const spiele = alle.filter((s) => eigen(s.heim) || eigen(s.gast));

  // Teams: je Gruppe (Herren, Damen, Nachwuchs-Bewerb, Landesklasse-Gruppe) und Name
  const teams = new Map(), namen = {};
  for (const s of spiele) {
    for (const n of [s.heim, s.gast]) {
      if (!eigen(n)) continue;
      const key = `${gruppe(s)}|${n}`;
      if (!teams.has(key)) teams.set(key, { gruppe: gruppe(s), name: n, quelle: s.quelle, kuerzel: new Set(), spiele: [] });
      teams.get(key).kuerzel.add(s.kuerzel);
      teams.get(key).spiele.push(s);
      const anfang = n.slice(0, klein(n).indexOf(klein(VEREIN)) + VEREIN.length);
      namen[anfang] = (namen[anfang] ?? 0) + 1;
    }
  }
  const vereinsname = Object.entries(namen).sort((a, b) => b[1] - a[1])[0]?.[0] ?? VEREIN;
  const rang = (g) => { const i = REIHENFOLGE.indexOf(g); return i < 0 ? (g.startsWith('lk:') ? 50 : 40) : i; };
  const liste = [...teams.values()].sort((a, b) => rang(a.gruppe) - rang(b.gruppe) || a.gruppe.localeCompare(b.gruppe)
    || a.name.localeCompare(b.name, 'de', { numeric: true }));

  const raus = liste.map((t, i) => {
    const id = `t${i}`;
    const rest = t.name.slice(klein(t.name).indexOf(klein(VEREIN)) + VEREIN.length).trim();
    const kuerzel = [...t.kuerzel].sort((a, b) => a.startsWith('VC') - b.startsWith('VC'));
    const liga = kuerzel.find((k) => !k.startsWith('VC')) ?? kuerzel[0];
    let titel;
    if (t.gruppe === 'H' || t.gruppe === 'D') titel = `${t.gruppe === 'H' ? 'Herren' : 'Damen'} ${rest}`.trim();
    else if (t.quelle === 'lk') titel = /\p{L}/u.test(rest) ? rest : `LK ${t.spiele[0].bewerb.replace(/^LK\s+/, '')} ${rest}`.trim();
    else titel = rest || BEWERBE[liga]?.[0] || liga;
    const bewerbe = kuerzel.map((k) => t.quelle === 'lk' ? t.spiele.find((s) => s.kuerzel === k).bewerb.replace(/^LK /, 'Landesklasse ') : BEWERBE[k]?.[0] ?? k);

    // Tabelle: bei mehreren Phasen die letzte, in der das Team vorkommt
    let tab = null;
    if (t.quelle === 'lk') tab = lk?.tabellen?.[liga] ?? null;
    else {
      for (const [phase, [k, pname]] of Object.entries(PHASEN)) {
        if (k !== liga) continue;
        const ende = TURNIER.includes(+phase);
        const z = ende ? endstand(vn.spiele, +phase) : tabelle(vn.spiele, +phase);
        if (z.some((r) => klein(r[1]) === klein(t.name))) tab = { name: pname, endstand: ende, zeilen: z };
      }
    }
    let platz = null;
    if (tab) {
      let vorher = '';
      for (const r of tab.zeilen) {
        const p = r[0] || vorher; vorher = p;
        if (klein(r[1]) === klein(t.name)) platz = { platz: p, von: tab.zeilen.length, sp: +r[2], s: +r[3], n: +r[4], pkt: r[9] };
      }
    }
    const kd = t.quelle === 'liga' ? kaderDaten?.teams?.[`${liga}|${t.name}`] ?? null : null;
    return { id, titel, name: t.name, quelle: t.quelle, bewerbe, tabelle: tab, platz, kader: kd && kd.spieler.length ? kd : null,
      kalender: `kalender/${dateiname(vereinsname, titel)}.ics`, _spiele: t.spiele, _gruppe: t.gruppe };
  });

  for (const s of spiele) {
    s.teams = raus.filter((t) => t._gruppe === gruppe(s) && [klein(s.heim), klein(s.gast)].includes(klein(t.name))).map((t) => t.id);
  }
  spiele.sort((a, b) => (a.datum + (a.zeit || '99')).localeCompare(b.datum + (b.zeit || '99')));
  return { verein: vereinsname, teams: raus, spiele };
}
const dateiname = (verein, titel) => `${verein} ${titel}`.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase();

// ---------------------------------------------------------------- Kalender (iCalendar)
function kalender(verein, t) {
  const esc = (s) => String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
  const falten = (z) => { const b = Buffer.from(z); if (b.length <= 75) return z + '\r\n'; let raus = '', i = 0; while (i < b.length) { let n = Math.min(i + (i ? 74 : 75), b.length); while (n < b.length && (b[n] & 0xc0) === 0x80) n--; raus += (i ? ' ' : '') + b.subarray(i, n).toString() + '\r\n'; i = n; } return raus; };
  const utc = (ms) => new Date(ms).toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  const name = `${verein} ${t.titel}`;
  const z = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//TS Hohenems Volleyball//Spielplan//DE', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    `X-WR-CALNAME:${esc(name)}`, 'X-WR-TIMEZONE:Europe/Vienna', 'REFRESH-INTERVAL;VALUE=DURATION:PT6H', 'X-PUBLISHED-TTL:PT6H'];
  for (const s of t._spiele) {
    z.push('BEGIN:VEVENT', `UID:${s.quelle}-${s.kuerzel}-${s.nr ?? klein(s.heim + s.gast + s.datum).replace(/[^a-z0-9]/g, '')}@tsh-volleyball`, `DTSTAMP:${utc(jetzt)}`);
    if (!s.zeit) z.push(`DTSTART;VALUE=DATE:${s.datum.replace(/-/g, '')}`);
    else { const b = zeitpunkt(s.datum, s.zeit); z.push(`DTSTART:${utc(b)}`, `DTEND:${utc(b + 2 * 3600000)}`); }
    z.push(`SUMMARY:${esc(`${s.heim} – ${s.gast}${s.ergebnis ? ' ' + s.ergebnis : ''}`)}`);
    if (s.halle) z.push(`LOCATION:${esc(s.halle + (s.adresse ? ', ' + s.adresse : ''))}`);
    z.push(`DESCRIPTION:${esc(s.bewerb + (s.ergebnis ? `\nErgebnis: ${s.ergebnis} (${s.saetze})` : ''))}`, 'END:VEVENT');
  }
  z.push('END:VCALENDAR');
  return z.map(falten).join('');
}

// ---------------------------------------------------------------- Ablauf
async function vorigerStand() {
  if (process.env.VORHER_URL) {
    const t = await holen(process.env.VORHER_URL);
    try { if (t) return JSON.parse(t); } catch { /* neu anfangen */ }
  }
  try { return JSON.parse(await readFile(path.join(AUSGABE, 'stand.json'), 'utf8')); } catch { return null; }
}

const vorher = await vorigerStand();
const vn = await volleynet(vorher);
if (!vn) { console.error('Keine Daten von volleynet – Abbruch'); process.exit(1); }
const vereinsTeams = new Set(Object.values(vn.spiele).flatMap((s) => [s.heim, s.gast].filter(eigen).map((n) => `${s.kuerzel}|${n}`)));
const [kd, lk, vs] = await Promise.all([kader(vorher, vereinsTeams), landesklasse(vorher), volleystation(vorher, vn.spiele)]);
const d = vereinsdaten(vn, kd, lk, vs);

await mkdir(path.join(AUSGABE, 'kalender'), { recursive: true });
await rm(path.join(AUSGABE, 'kalender'), { recursive: true, force: true });
await mkdir(path.join(AUSGABE, 'kalender'), { recursive: true });
for (const t of d.teams) await writeFile(path.join(AUSGABE, t.kalender), kalender(d.verein, t));

const w = wien();
const saison = +w.month >= 7 ? `${w.year}/${String(+w.year + 1).slice(2)}` : `${+w.year - 1}/${w.year.slice(2)}`;
const { _hinweis, ...inhalt } = JSON.parse(await readFile(path.join(ORDNER, 'inhalt.json'), 'utf8'));   // Texte, Training, Kontakt
const daten = { stand: jetzt.toISOString(), verein: d.verein, saison, inhalt,
  teams: d.teams.map(({ _spiele, _gruppe, ...t }) => t),
  spiele: d.spiele.map(({ phase, ...s }) => s) };
// Hat sich etwas geändert? Sonst muss der Workflow nichts veröffentlichen (Ausgabe für GitHub Actions)
let vorherDaten = null;
try { vorherDaten = process.env.VORHER_URL ? JSON.parse(await holen(process.env.VORHER_URL.replace(/stand\.json$/, 'daten.json'))) : null; } catch { /* egal */ }
const ohneStand = (x) => JSON.stringify({ ...x, stand: null });
// auch wenn nur der interne Stand neu ist (sonst holte der nächste Lauf dasselbe noch einmal)
const geaendert = !vorherDaten || ohneStand(vorherDaten) !== ohneStand(daten) || vn.geholt
  || kd?.stand !== vorher?.kader?.stand || vs?.stand !== vorher?.vs?.stand;
if (!geaendert) daten.stand = vorherDaten.stand;   // „Stand“ = letzte Änderung
if (process.env.GITHUB_OUTPUT) await writeFile(process.env.GITHUB_OUTPUT, `geaendert=${geaendert}\n`, { flag: 'a' });
await writeFile(path.join(AUSGABE, 'daten.json'), JSON.stringify(daten));
// interner Stand für den nächsten Lauf (alle Spiele der Phasen, Kader, VolleyStation-IDs) – nicht fürs Widget
const { geholt, ...vnStand } = vn;
await writeFile(path.join(AUSGABE, 'stand.json'), JSON.stringify({ volleynet: vnStand, kader: kd, vs }));
console.log(`${d.verein}: ${d.teams.length} Teams, ${d.spiele.length} Spiele`);
