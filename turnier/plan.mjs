// Spielplan und Wertung des U14-Turniers. Zwei Formate (turnier.json → "format"):
//  "12": 12 Teams in zwei 6er-Gruppen (jeder gegen jeden), danach Überkreuz-Spiele (1./2., 3./4., 5./6. der Gruppen)
//        und alle Platzierungsspiele – 42 Spiele, 14 Runden, 3 Felder. (Stand 22.11.2026, auch als Git-Tag u14-12-teams)
//  "9":  9 Teams jeder gegen jeden (36 Spiele, 12 Runden, Mittagspause nach Runde 6), danach Finale 1. gegen 2. (Tag u14-9-teams)
//  "10": 10 Teams in zwei 5er-Gruppen (bis 11:55), Mittagszeit nur auf Feld 1+2 (Überkreuz, Pause, Halbfinale),
//        Überkreuz 3./4. und Halbfinale 1./2., danach um Platz 9, 7, 5, 3 und Finale – die Platzierungsspiele auf 2 Gewinnsätze.
//  "10v": wie "10", aber Gruppensieger direkt im Halbfinale, davor 4./5. und Viertelfinale 2./3. (Variante zum Ansehen).
// Ein Spiel = 1 Satz auf 25. Schiedsgericht: möglichst ein Team, das danach auf demselben Feld spielt.
//
// Teilnehmer eines Spiels sind Platzhalter: { g: 'A', p: 1 } = 1. der Gruppe A (erst bekannt, wenn die Gruppe fertig ist),
// { s: 'S31' } / { v: 'S31' } = Sieger / Verlierer von Spiel 31, { t: 'A3' } = Team A3 direkt (Gruppenphase).

/** Jeder gegen jeden für 6 Teams (Kreisverfahren): 5 Runden à 3 Spiele, Indizes 0..5 */
function rundenSechs() {
  const r = [];
  const t = [0, 1, 2, 3, 4, 5];
  for (let runde = 0; runde < 5; runde++) {
    const paare = [];
    for (let i = 0; i < 3; i++) paare.push(runde % 2 ? [t[5 - i], t[i]] : [t[i], t[5 - i]]);   // Heimrecht abwechseln
    r.push(paare);
    t.splice(1, 0, t.pop());   // alle außer dem ersten weiterdrehen
  }
  return r;
}

/** Für jede Liste [Kandidat 1, Kandidat 2] einen wählen, so dass die Einsätze je Team möglichst gleich sind
 *  (alle Kombinationen durchprobieren, je Gruppe höchstens 2^15 – das geht schnell). */
function schiriWahl(kandidaten) {
  const gruppen = { A: [], B: [] };
  kandidaten.forEach((k, i) => gruppen[k[0][0]].push(i));
  const raus = [];
  for (const idx of Object.values(gruppen)) {
    let beste = null, besteWert = Infinity;
    for (let maske = 0; maske < (1 << idx.length); maske++) {
      const zahl = {};
      idx.forEach((i, j) => { const t = kandidaten[i][(maske >> j) & 1]; zahl[t] = (zahl[t] || 0) + 1; });
      const werte = Object.values(zahl);
      while (werte.length < 6) werte.push(0);
      const wert = werte.reduce((n, x) => n + x * x, 0) * 100 + (Math.max(...werte) - Math.min(...werte));
      if (wert < besteWert) { besteWert = wert; beste = maske; }
    }
    idx.forEach((i, j) => { raus[i] = kandidaten[i][(beste >> j) & 1]; });
  }
  return raus;
}

/** Format wählen ("12" oder "9"); ohne Wert: das aktuelle */
let FORMAT = '12';
export function format(f) { if (f && String(f) !== FORMAT) { FORMAT = String(f); plan = null; } return FORMAT; }

/** Alle Spiele mit Runde, Feld, Phase, Teilnehmern und Schiedsgericht (einmal gerechnet, danach aus dem Speicher) */
let plan = null;
export function spielplan() {
  if (!plan) plan = FORMAT === '10v' ? planZehnVariante() : FORMAT === '10' ? planZehn() : FORMAT === '9' ? planNeun() : planRechnen();
  return plan.map((sp) => ({ ...sp }));
}

// 9 Teams: Runden, Felder und Schiedsgericht von werkzeuge/plan9-erzeugen.mjs gesucht (jedes Team 4 Spiele vor und 4 nach
// der Pause, höchstens einmal 3 Spiele in Folge, die 3 freien Teams pfeifen – meist dort, wo sie danach spielen).
// Je Runde: spiele = [[Heim, Gast] auf Feld 1, 2, 3], schiri = [Team auf Feld 1, 2, 3]; Zahlen = Team A1 … A9.
// Vereinsduelle zuerst: Runde 1 Dornbirn 1–2, Hohenems 1–2, Montafon 1–2; Runde 2 und 3 Dornbirn 1 bzw. 2 gegen Jungs.
const PLAN_9 = [{"runde":1,"spiele":[[1,2],[4,5],[6,7]],"schiri":[3,8,9]},{"runde":2,"spiele":[[1,3],[4,8],[5,9]],"schiri":[2,7,6]},{"runde":3,"spiele":[[2,3],[7,9],[6,8]],"schiri":[1,5,4]},{"runde":4,"spiele":[[1,7],[5,8],[4,6]],"schiri":[2,9,3]},{"runde":5,"spiele":[[2,9],[1,4],[3,5]],"schiri":[6,7,8]},{"runde":6,"spiele":[[3,6],[2,7],[8,9]],"schiri":[5,4,1]},{"runde":7,"spiele":[[5,7],[3,4],[1,8]],"schiri":[2,6,9]},{"runde":8,"spiele":[[7,8],[2,6],[3,9]],"schiri":[1,5,4]},{"runde":9,"spiele":[[1,6],[2,5],[4,9]],"schiri":[7,3,8]},{"runde":10,"spiele":[[4,7],[1,5],[3,8]],"schiri":[2,6,9]},{"runde":11,"spiele":[[2,8],[6,9],[3,7]],"schiri":[1,5,4]},{"runde":12,"spiele":[[1,9],[5,6],[2,4]],"schiri":[3,7,8]}];
function planNeun() {
  const spiele = [];
  let nr = 0;
  for (const r of PLAN_9) {
    r.spiele.forEach(([a, b], f) => { nr++; spiele.push({ id: `S${nr}`, nr, runde: r.runde, feld: f + 1, phase: 'gruppe', titel: 'Gruppe A', heim: { t: `A${a}` }, gast: { t: `A${b}` }, schiri: { t: `A${r.schiri[f]}` } }); });
  }
  nr++;
  spiele.push({ id: `S${nr}`, nr, runde: PLAN_9.length + 1, feld: null, phase: 'platz', titel: 'Finale', heim: { g: 'A', p: 1 }, gast: { g: 'A', p: 2 }, schiri: { g: 'A', p: 3 } });
  return spiele;
}
// 10 Teams: Gruppenphase von werkzeuge/plan10-erzeugen.mjs (Runde 1–6 auf 3 Feldern, Runde 7 auf Feld 1+2; Dornbirn 2 –
// Dornbirn Jungs in Runde 1, jedes Team pfeift 2-mal, Teams desselben Vereins in A und B spielen nur 1-mal gleichzeitig).
// Teams A1…A5 = Gruppe A, B1…B5 = Gruppe B.
const PLAN_10 = [{"runde":1,"spiele":[["B4","B5"],["B1","B2"],["A2","A5"]],"schiri":["A4","A1","B3"]},{"runde":2,"spiele":[["A2","A4"],["A1","A3"],["B3","B5"]],"schiri":["A5","B2","B4"]},{"runde":3,"spiele":[["A4","A5"],["B2","B3"],["B1","B4"]],"schiri":["A2","A3","B5"]},{"runde":4,"spiele":[["A1","A2"],["A3","A5"],["B1","B5"]],"schiri":["A4","B4","B2"]},{"runde":5,"spiele":[["A1","A4"],["B3","B4"],["B2","B5"]],"schiri":["B1","A3","A5"]},{"runde":6,"spiele":[["B1","B3"],["A3","A4"],["B2","B4"]],"schiri":["A2","A1","B5"]},{"runde":7,"spiele":[["A2","A3"],["A1","A5"]],"schiri":["B1","B3"]}];
// Variante "10v" (zum Ansehen, 25.11.): Gruppensieger direkt ins Halbfinale. 4. gegen 5. der anderen Gruppe:
// Verlierer spielen um Platz 9, Sieger gegen die Verlierer des Viertelfinales (2. gegen 3.) um Platz 5–8.
// Viertelfinal-Sieger ins Halbfinale; die Spiele um Platz 5–8 kommen vor dem Halbfinale (Simons Wunsch). Der Gruppenfünfte kann also höchstens 5. werden, der Gruppendritte noch 1.
// Raster 25 min, Spiele auf 2 Gewinnsätze belegen ihr Feld 50 min (über die nächste Zeile hinweg).
// Zeiten und Schiedsgericht per Suche über alle Spielausgänge gefunden: mit diesem Ablauf geht es nicht kürzer als bis 15:10.
function planZehnVariante() {
  const spiele = [];
  let nr = 0;
  const neu = (runde, feld, phase, titel, heim, gast, schiri, gewinnsaetze = 1) => spiele.push({ id: `S${++nr}`, nr, runde, feld, phase, titel, heim, gast, schiri, gewinnsaetze });
  const FELD_ZU_ZWEIT = [1, 3];
  for (const r of PLAN_10) r.spiele.forEach(([a, b], f) => neu(r.runde, r.spiele.length === 2 ? FELD_ZU_ZWEIT[f] : f + 1, 'gruppe', `Gruppe ${a[0]}`, { t: a }, { t: b }, { t: r.schiri[f] }));
  neu(8, 1, 'kreuz', '4. gegen 5.', { g: 'A', p: 4 }, { g: 'B', p: 5 }, { g: 'B', p: 2 });          // S21 12:15
  neu(8, 3, 'kreuz', '4. gegen 5.', { g: 'B', p: 4 }, { g: 'A', p: 5 }, { g: 'A', p: 2 });          // S22
  neu(9, 1, 'kreuz', 'Viertelfinale', { g: 'B', p: 2 }, { g: 'A', p: 3 }, { s: 'S21' });            // S23 12:40
  neu(9, 2, 'platz', 'Spiel um Platz 9', { v: 'S21' }, { v: 'S22' }, { g: 'A', p: 1 }, 2);         // S24 12:40–13:30
  neu(9, 3, 'kreuz', 'Viertelfinale', { g: 'A', p: 2 }, { g: 'B', p: 3 }, { s: 'S22' });            // S25
  neu(10, 1, 'kreuz', 'um Platz 5–8', { s: 'S21' }, { v: 'S23' }, { s: 'S23' });                    // S26 13:05
  neu(10, 3, 'kreuz', 'um Platz 5–8', { s: 'S22' }, { v: 'S25' }, { s: 'S25' });                    // S27
  neu(11, 1, 'kreuz', 'Halbfinale', { g: 'A', p: 1 }, { s: 'S23' }, { s: 'S26' });                  // S28 13:30
  neu(11, 2, 'platz', 'Spiel um Platz 7', { v: 'S26' }, { v: 'S27' }, { v: 'S24' }, 2);             // S29 13:30–14:20
  neu(11, 3, 'kreuz', 'Halbfinale', { g: 'B', p: 1 }, { s: 'S25' }, { s: 'S27' });                  // S30
  neu(12, 3, 'platz', 'Spiel um Platz 5', { s: 'S26' }, { s: 'S27' }, { s: 'S24' }, 2);             // S31 13:55–14:45
  neu(13, 1, 'platz', 'Finale', { s: 'S28' }, { s: 'S30' }, { s: 'S29' }, 2);                       // S32 14:20–15:10
  neu(13, 2, 'platz', 'Spiel um Platz 3', { v: 'S28' }, { v: 'S30' }, { v: 'S29' }, 2);             // S33
  return spiele;
}

function planZehn() {
  const spiele = [];
  let nr = 0;
  const neu = (runde, feld, phase, titel, heim, gast, schiri, gewinnsaetze = 1) => spiele.push({ id: `S${++nr}`, nr, runde, feld, phase, titel, heim, gast, schiri, gewinnsaetze });
  // Runden mit nur zwei Spielen laufen auf Feld 1 und 3, Feld 2 bleibt frei (Simons Wunsch 25.11.)
  const FELD_ZU_ZWEIT = [1, 3];
  for (const r of PLAN_10) r.spiele.forEach(([a, b], f) => neu(r.runde, r.spiele.length === 2 ? FELD_ZU_ZWEIT[f] : f + 1, 'gruppe', `Gruppe ${a[0]}`, { t: a }, { t: b }, { t: r.schiri[f] }));
  // Nach der Vorrunde 20 min Pause für die Auswertung (turnier.json „pause“), dann Überkreuz 3./4. und Halbfinale auf Feld 1+3.
  // Halbfinalisten haben bis zum Halbfinale frei, Überkreuz-Teams danach. Schiri: Überkreuz die Gruppenfünften,
  // Halbfinale die Überkreuz-Sieger (bleiben auf ihrem Feld, Simons Wunsch 25.11.).
  neu(8, 1, 'kreuz', 'Überkreuz Platz 5–8', { g: 'A', p: 3 }, { g: 'B', p: 4 }, { g: 'A', p: 5 });   // S21
  neu(8, 3, 'kreuz', 'Überkreuz Platz 5–8', { g: 'B', p: 3 }, { g: 'A', p: 4 }, { g: 'B', p: 5 });   // S22
  neu(9, 1, 'kreuz', 'Halbfinale', { g: 'A', p: 1 }, { g: 'B', p: 2 }, { s: 'S21' });                // S23
  neu(9, 3, 'kreuz', 'Halbfinale', { g: 'B', p: 1 }, { g: 'A', p: 2 }, { s: 'S22' });                // S24
  // Platzierung auf 2 Gewinnsätze: um Platz 9, 7, 5, dann um Platz 3 und Finale
  neu(10, 1, 'platz', 'Spiel um Platz 9', { g: 'A', p: 5 }, { g: 'B', p: 5 }, { v: 'S23' }, 2);       // S25
  neu(10, 2, 'platz', 'Spiel um Platz 7', { v: 'S21' }, { v: 'S22' }, { v: 'S24' }, 2);               // S26
  neu(10, 3, 'platz', 'Spiel um Platz 5', { s: 'S21' }, { s: 'S22' }, { s: 'S24' }, 2);               // S27
  neu(11, 3, 'platz', 'Spiel um Platz 3', { v: 'S23' }, { v: 'S24' }, { s: 'S26' }, 2);               // S28
  neu(11, 1, 'platz', 'Finale', { s: 'S23' }, { s: 'S24' }, { s: 'S27' }, 2);                         // S29
  // Anzeige um 14:00: Finale zuerst
  spiele.push(spiele.splice(spiele.findIndex((sp) => sp.id === 'S28'), 1)[0]);
  return spiele;
}

function planRechnen() {
  const spiele = [];
  let nr = 0;
  const neu = (runde, feld, phase, titel, heim, gast, schiri) => spiele.push({ id: `S${++nr}`, nr, runde, feld, phase, titel, heim, gast, schiri });
  const R = rundenSechs();
  // Gruppenphase: Runde 1, 3, 5, 7, 9 Gruppe A, Runde 2, 4, … 10 Gruppe B.
  // Schiedsgericht: ein Team, das in der nächsten Runde auf demselben Feld spielt (also aus der anderen Gruppe) –
  // welches der beiden, ist so gewählt, dass die Einsätze möglichst gleich verteilt sind (schiriWahl).
  const gruppenSpiele = [];
  for (let r = 0; r < 5; r++) {
    for (const [g, runde] of [['A', r * 2 + 1], ['B', r * 2 + 2]]) {
      R[r].forEach(([a, b], feld) => gruppenSpiele.push({ runde, feld: feld + 1, g, heim: `${g}${a + 1}`, gast: `${g}${b + 1}` }));
    }
  }
  const nachfolger = (sp) => gruppenSpiele.find((x) => x.runde === sp.runde + 1 && x.feld === sp.feld);
  const wahl = schiriWahl(gruppenSpiele.filter((sp) => sp.runde < 10).map((sp) => { const n = nachfolger(sp); return [n.heim, n.gast]; }));
  // Runde 10 (letzte der Gruppe B): Teams aus Gruppe A, die in Runde 11 auf demselben Feld spielen – die Platzierung
  // der Gruppe A steht da schon fest (sie ist nach Runde 9 fertig)
  const NACH_RUNDE_10 = { 1: { g: 'A', p: 5 }, 2: { g: 'A', p: 6 }, 3: { g: 'A', p: 3 } };
  let i = 0;
  for (const sp of gruppenSpiele) {
    neu(sp.runde, sp.feld, 'gruppe', `Gruppe ${sp.g}`, { t: sp.heim }, { t: sp.gast }, sp.runde < 10 ? { t: wahl[i++] } : NACH_RUNDE_10[sp.feld]);
  }
  // Schiedsgericht in Runde 11 und 12 wie in der Vorrunde: ein Team, das danach auf demselben Feld spielt.
  // Überkreuz und Platzierung streng von hinten nach vorne: Platz 9–12, 5–8, Halbfinale, dann um Platz 11, 9, 7, 5, 3, Finale.
  // Runde 14 (Platz 5, Platz 3, Finale) ohne Feld – das wird am Turniertag spontan entschieden.
  neu(11, 1, 'kreuz', 'Überkreuz Platz 9–12', { g: 'A', p: 5 }, { g: 'B', p: 6 }, { g: 'B', p: 3 });  // S31
  neu(11, 2, 'kreuz', 'Überkreuz Platz 9–12', { g: 'B', p: 5 }, { g: 'A', p: 6 }, { g: 'B', p: 2 });  // S32
  neu(11, 3, 'kreuz', 'Überkreuz Platz 5–8', { g: 'A', p: 3 }, { g: 'B', p: 4 }, { g: 'A', p: 2 });   // S33
  neu(12, 1, 'kreuz', 'Überkreuz Platz 5–8', { g: 'B', p: 3 }, { g: 'A', p: 4 }, { v: 'S31' });   // S34
  neu(12, 2, 'kreuz', 'Halbfinale', { g: 'A', p: 1 }, { g: 'B', p: 2 }, { s: 'S32' });            // S35
  neu(12, 3, 'kreuz', 'Halbfinale', { g: 'B', p: 1 }, { g: 'A', p: 2 }, { v: 'S33' });            // S36
  neu(13, 1, 'platz', 'Spiel um Platz 11', { v: 'S31' }, { v: 'S32' }, { s: 'S35' });  // S37
  neu(13, 2, 'platz', 'Spiel um Platz 9', { s: 'S31' }, { s: 'S32' }, { v: 'S35' });   // S38
  neu(13, 3, 'platz', 'Spiel um Platz 7', { v: 'S33' }, { v: 'S34' }, { s: 'S33' });   // S39
  neu(14, null, 'platz', 'Spiel um Platz 5', { s: 'S33' }, { s: 'S34' }, { s: 'S39' });   // S40
  neu(14, null, 'platz', 'Spiel um Platz 3', { v: 'S35' }, { v: 'S36' }, { s: 'S38' }); // S41
  neu(14, null, 'platz', 'Finale', { s: 'S35' }, { s: 'S36' }, { s: 'S37' });          // S42
  // Anzeige um 14:25: Finale zuerst, Platz 5 zuletzt – die Spielnummern bleiben.
  // Schiedsgericht 14:00 und 14:25 so, dass niemand das Feld wechseln muss: um 14:00 pfeift ein Team, das um 14:25 dort
  // spielt (Feld 1 Finale, Feld 2 Platz 3, Feld 3 Platz 5), um 14:25 pfeift der Sieger des Spiels davor auf diesem Feld.
  const i40 = spiele.findIndex((sp) => sp.id === 'S40'), i42 = spiele.findIndex((sp) => sp.id === 'S42');
  [spiele[i40], spiele[i42]] = [spiele[i42], spiele[i40]];
  return spiele;
}

/** Rangfolge der Plätze aus den Platzierungsspielen: Spiel-ID -> [Platz Sieger, Platz Verlierer] */
const PLAETZE = { '12': { S42: [1, 2], S41: [3, 4], S40: [5, 6], S39: [7, 8], S38: [9, 10], S37: [11, 12] }, '9': { S37: [1, 2] },
  '10': { S29: [1, 2], S28: [3, 4], S27: [5, 6], S26: [7, 8], S25: [9, 10] },
  '10v': { S32: [1, 2], S33: [3, 4], S31: [5, 6], S29: [7, 8], S24: [9, 10] } };
// Formate im 25-min-Raster: Spiele auf 2 Gewinnsätze laufen über mehrere Zeilen, die Zeile selbst bleibt 25 min
const RASTER = { '10v': true };

const satzOk = (e) => Array.isArray(e) && e.length === 2 && Number.isInteger(e[0]) && Number.isInteger(e[1]) && e[0] !== e[1];
/** fertiges Ergebnis? 1 Satz: [Heim, Gast]; 2 Gewinnsätze: [[Heim, Gast], …] bis ein Team 2 Sätze hat */
const fertig = (e, gs = 1) => {
  if (gs === 1) return satzOk(e);
  if (!Array.isArray(e) || !e.length || !e.every(satzOk)) return false;
  let h = 0, a = 0;
  for (const [x, y] of e) { if (h === gs || a === gs) return false; x > y ? h++ : a++; }
  return h === gs || a === gs;
};
/** gewonnene Sätze [Heim, Gast] (1 Satz: die Punkte selbst) */
const stand2 = (e, gs = 1) => gs === 1 ? e : e.reduce((n, [x, y]) => (x > y ? n[0]++ : n[1]++, n), [0, 0]);

/**
 * Tabelle einer Gruppe. Reihung: Siege, dann direkter Vergleich, dann Ballpunkt-Differenz.
 * Direkter Vergleich auch bei 3 oder mehr Teams mit gleich vielen Siegen: Es zählen nur die Spiele dieser Teams
 * untereinander (Siege in dieser „Mini-Tabelle“). Trennt das nur einen Teil, wird für die übrigen gleichauf liegenden
 * Teams wieder ihr direkter Vergleich genommen; bleibt es gleich (z. B. A schlägt B, B schlägt C, C schlägt A),
 * entscheidet die Ballpunkt-Differenz aus den Spielen dieser Teams untereinander, danach die aus allen Gruppenspielen.
 */
export function tabelle(g, spiele, ergebnisse, teams) {
  const z = {};
  const ids = [...new Set(spiele.filter((sp) => sp.titel === `Gruppe ${g}`).flatMap((sp) => [sp.heim.t, sp.gast.t]))].sort((a, b) => a.localeCompare(b, 'de', { numeric: true }));
  for (const id of ids) z[id] = { id, name: teams[id] || `Team ${id}`, sp: 0, s: 0, n: 0, bp: 0, bm: 0 };
  const sieg = {};   // „Sieger>Verlierer“
  const baelle = {};   // „X>Y“ = Bälle von X im Spiel gegen Y
  for (const sp of spiele) {
    if (sp.phase !== 'gruppe' || sp.titel !== `Gruppe ${g}`) continue;
    const e = ergebnisse[sp.id];
    if (!fertig(e)) continue;
    const [h, a] = [z[sp.heim.t], z[sp.gast.t]];
    h.sp++; a.sp++; h.bp += e[0]; h.bm += e[1]; a.bp += e[1]; a.bm += e[0];
    const sieger = e[0] > e[1] ? h : a, verlierer = sieger === h ? a : h;
    sieger.s++; verlierer.n++;
    sieg[`${sieger.id}>${verlierer.id}`] = true;
    baelle[`${h.id}>${a.id}`] = e[0]; baelle[`${a.id}>${h.id}`] = e[1];
  }
  const balle = (x, y) => (y.bp - y.bm) - (x.bp - x.bm) || y.bp - x.bp || x.id.localeCompare(y.id);
  // Teams mit gleich vielen Siegen: direkter Vergleich (rekursiv), sonst Bälle
  const reihen = (gruppe) => {
    if (gruppe.length < 2) return gruppe;
    const mini = new Map(gruppe.map((t) => [t.id, gruppe.filter((o) => o !== t && sieg[`${t.id}>${o.id}`]).length]));
    const stufen = [...new Set(mini.values())].sort((a, b) => b - a);
    if (stufen.length === 1) {   // Kreis: Ballpunkt-Differenz aus den Spielen untereinander, dann aus allen Spielen
      const diff = (t) => gruppe.reduce((n, o) => n + (o === t ? 0 : (baelle[`${t.id}>${o.id}`] || 0) - (baelle[`${o.id}>${t.id}`] || 0)), 0);
      return [...gruppe].sort((x, y) => diff(y) - diff(x) || balle(x, y));
    }
    return stufen.flatMap((w) => reihen(gruppe.filter((t) => mini.get(t.id) === w)));
  };
  const nachSiegen = [...new Set(Object.values(z).map((t) => t.s))].sort((a, b) => b - a);
  const liste = nachSiegen.flatMap((w) => reihen(Object.values(z).filter((t) => t.s === w)));
  const komplett = spiele.filter((sp) => sp.titel === `Gruppe ${g}`).every((sp) => fertig(ergebnisse[sp.id]));
  return { komplett, zeilen: liste.map((t, i) => ({ ...t, platz: i + 1 })) };
}

/** Kompletter Stand: Spiele mit aufgelösten Teams, Tabellen, Endstand */
export function stand(turnier, ergebnisse) {
  const teams = turnier.teams || {};
  const spiele = spielplan();
  const gruppen = [...new Set(spiele.filter((sp) => sp.phase === 'gruppe').map((sp) => sp.titel.replace('Gruppe ', '')))];
  const tab = Object.fromEntries(gruppen.map((g) => [g, tabelle(g, spiele, ergebnisse, teams)]));
  const aufloesen = (x) => {
    if (!x) return null;
    if (x.t) return x.t;
    if (x.g) return tab[x.g].komplett ? tab[x.g].zeilen[x.p - 1].id : null;
    const id = x.s || x.v, sp = spiele.find((s) => s.id === id), e = ergebnisse[id];
    if (!sp || !fertig(e, sp.gewinnsaetze || 1)) return null;
    const h = aufloesen(sp.heim), a = aufloesen(sp.gast);
    if (!h || !a) return null;
    const st = stand2(e, sp.gewinnsaetze || 1);
    return (st[0] > st[1]) === !!x.s ? h : a;
  };
  const text = (x) => x.t ? null : x.g ? (gruppen.length > 1 ? `${x.p}. Gruppe ${x.g}` : `${x.p}. der Tabelle`) : `${x.s ? 'Sieger' : 'Verlierer'} Spiel ${x.s ? x.s.slice(1) : x.v.slice(1)}`;
  const [hh, mm] = String(turnier.beginn || '09:00').split(':').map(Number);
  const takt = turnier.minuten || 25;
  const pause = turnier.pause && turnier.pause.nach ? turnier.pause : null;   // { nach: Runde, minuten }
  const uhr = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  // Runden mit Spielen auf 2 Gewinnsätze dauern doppelt so lang (turnier.json „takte“ kann einzelne Runden überschreiben)
  const dauer = (runde) => (turnier.takte && turnier.takte[runde]) || (!RASTER[FORMAT] && spiele.some((sp) => sp.runde === runde && (sp.gewinnsaetze || 1) > 1) ? 2 * takt : takt);
  const spielEnde = (sp) => minute(sp.runde) + (RASTER[FORMAT] ? takt * (sp.gewinnsaetze || 1) : dauer(sp.runde));
  const minute = (runde) => { let m = hh * 60 + mm + (pause && runde > pause.nach ? pause.minuten : 0); for (let r = 1; r < runde; r++) m += dauer(r); return m; };
  const zeit = (runde) => uhr(minute(runde));
  const raus = spiele.map((sp) => {
    const heim = aufloesen(sp.heim), gast = aufloesen(sp.gast), schiri = aufloesen(sp.schiri);
    return { id: sp.id, nr: sp.nr, runde: sp.runde, feld: sp.feld, zeit: zeit(sp.runde), bis: uhr(spielEnde(sp)), phase: sp.phase, titel: sp.titel,
      heim, gast, schiri, heimText: heim ? null : text(sp.heim), gastText: gast ? null : text(sp.gast), schiriText: schiri ? null : text(sp.schiri),
      gewinnsaetze: sp.gewinnsaetze || 1,
      ergebnis: fertig(ergebnisse[sp.id], sp.gewinnsaetze || 1) ? stand2(ergebnisse[sp.id], sp.gewinnsaetze || 1) : null,
      saetze: (sp.gewinnsaetze || 1) > 1 && fertig(ergebnisse[sp.id], sp.gewinnsaetze) ? ergebnisse[sp.id] : null };
  });
  // Endstand: Plätze aus den Platzierungsspielen
  const endstand = [];
  for (const [id, [p1, p2]] of Object.entries(PLAETZE[FORMAT])) {
    const sp = raus.find((s) => s.id === id);
    if (!sp.ergebnis || !sp.heim || !sp.gast) continue;
    const [s, v] = sp.ergebnis[0] > sp.ergebnis[1] ? [sp.heim, sp.gast] : [sp.gast, sp.heim];
    endstand.push({ platz: p1, team: s }, { platz: p2, team: v });
  }
  // 9 Teams: ab Platz 3 zählt die Tabelle (sobald alle Gruppenspiele gespielt sind)
  if (FORMAT === '9' && tab.A.komplett) tab.A.zeilen.slice(2).forEach((z) => endstand.push({ platz: z.platz, team: z.id }));
  endstand.sort((a, b) => a.platz - b.platz);
  return { format: FORMAT, name: turnier.name, datum: turnier.datum, ort: turnier.ort, beginn: zeit(1), ende: uhr(Math.max(...spiele.map(spielEnde))),
    pause: pause ? { nach: pause.nach, von: uhr(minute(pause.nach) + dauer(pause.nach)), bis: uhr(minute(pause.nach) + dauer(pause.nach) + pause.minuten), text: pause.text || 'Mittagspause' } : null,
    erklaerung: turnier.erklaerung || null, zeitraum: turnier.zeitraum || null, zurueck: turnier.zurueck || null, jimdoKopfAusblenden: !!turnier.jimdoKopfAusblenden, minuten: takt,
    modus: turnier.modus, teams: Object.fromEntries(Object.values(tab).flatMap((t) => t.zeilen).map((z) => z.id).sort((a, b) => a.localeCompare(b, 'de', { numeric: true })).map((id) => [id, teams[id] || `Team ${id}`])),
    spiele: raus, tabellen: tab, endstand };
}

/** Ergebnis prüfen: 1 Satz = zwei ganze Zahlen 0–60, kein Unentschieden; 2 Gewinnsätze = Sätze, bis ein Team 2 hat */
export function pruefen(e, gs = 1) {
  const satz = (x, n) => {
    if (!Array.isArray(x) || x.length !== 2) return `Bitte beide Punktzahlen${n ? ' im ' + n + '. Satz' : ''} eintragen.`;
    if (!x.every((v) => Number.isInteger(v) && v >= 0 && v <= 60)) return 'Nur ganze Zahlen von 0 bis 60.';
    if (x[0] === x[1]) return 'Ein Satz kann nicht unentschieden enden.';
    return null;
  };
  if (gs === 1) return satz(e, 0);
  if (!Array.isArray(e) || e.length < 2 || e.length > 3) return 'Bitte 2 oder 3 Sätze eintragen.';
  for (let i = 0; i < e.length; i++) { const f = satz(e[i], i + 1); if (f) return f; }
  return fertig(e, gs) ? null : (e.length === 3 ? 'Nach 2:0 Sätzen gibt es keinen 3. Satz.' : 'Bei 1:1 Sätzen fehlt der 3. Satz.');
}
