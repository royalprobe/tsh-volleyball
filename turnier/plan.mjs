// Spielplan und Wertung des U14-Turniers. Zwei Formate (turnier.json → "format"):
//  "12": 12 Teams in zwei 6er-Gruppen (jeder gegen jeden), danach Überkreuz-Spiele (1./2., 3./4., 5./6. der Gruppen)
//        und alle Platzierungsspiele – 42 Spiele, 14 Runden, 3 Felder. (Stand 22.11.2026, auch als Git-Tag u14-12-teams)
//  "9":  9 Teams jeder gegen jeden (36 Spiele, 12 Runden, Mittagspause nach Runde 6), danach Finale 1. gegen 2.
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
  if (!plan) plan = FORMAT === '9' ? planNeun() : planRechnen();
  return plan.map((sp) => ({ ...sp }));
}

// 9 Teams: Runden, Felder und Schiedsgericht von werkzeuge/plan9-erzeugen.mjs gesucht (jedes Team 4 Spiele vor und 4 nach
// der Pause, höchstens einmal 3 Spiele in Folge, die 3 freien Teams pfeifen – meist dort, wo sie danach spielen).
// Je Runde: spiele = [[Heim, Gast] auf Feld 1, 2, 3], schiri = [Team auf Feld 1, 2, 3]; Zahlen = Team A1 … A9.
const PLAN_9 = [{"runde":1,"spiele":[[8,9],[5,6],[4,7]],"schiri":[1,2,3]},{"runde":2,"spiele":[[1,9],[2,8],[3,6]],"schiri":[5,4,7]},{"runde":3,"spiele":[[2,5],[1,4],[3,7]],"schiri":[6,8,9]},{"runde":4,"spiele":[[6,8],[3,5],[4,9]],"schiri":[1,2,7]},{"runde":5,"spiele":[[1,8],[2,9],[6,7]],"schiri":[4,5,3]},{"runde":6,"spiele":[[1,7],[4,5],[2,3]],"schiri":[6,9,8]},{"runde":7,"spiele":[[1,3],[6,9],[5,8]],"schiri":[7,2,4]},{"runde":8,"spiele":[[7,9],[2,6],[3,4]],"schiri":[1,8,5]},{"runde":9,"spiele":[[2,4],[7,8],[1,5]],"schiri":[3,9,6]},{"runde":10,"spiele":[[3,8],[5,9],[1,6]],"schiri":[2,4,7]},{"runde":11,"spiele":[[3,9],[4,6],[2,7]],"schiri":[5,8,1]},{"runde":12,"spiele":[[5,7],[4,8],[1,2]],"schiri":[3,6,9]}];
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
const PLAETZE = { '12': { S42: [1, 2], S41: [3, 4], S40: [5, 6], S39: [7, 8], S38: [9, 10], S37: [11, 12] }, '9': { S37: [1, 2] } };

const fertig = (e) => Array.isArray(e) && e.length === 2 && Number.isInteger(e[0]) && Number.isInteger(e[1]) && e[0] !== e[1];

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
    if (!sp || !fertig(e)) return null;
    const h = aufloesen(sp.heim), a = aufloesen(sp.gast);
    if (!h || !a) return null;
    return (e[0] > e[1]) === !!x.s ? h : a;
  };
  const text = (x) => x.t ? null : x.g ? (gruppen.length > 1 ? `${x.p}. Gruppe ${x.g}` : `${x.p}. der Tabelle`) : `${x.s ? 'Sieger' : 'Verlierer'} Spiel ${x.s ? x.s.slice(1) : x.v.slice(1)}`;
  const [hh, mm] = String(turnier.beginn || '09:00').split(':').map(Number);
  const takt = turnier.minuten || 25;
  const pause = turnier.pause && turnier.pause.nach ? turnier.pause : null;   // { nach: Runde, minuten }
  const uhr = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  const minute = (runde) => hh * 60 + mm + (runde - 1) * takt + (pause && runde > pause.nach ? pause.minuten : 0);
  const zeit = (runde) => uhr(minute(runde));
  const letzte = Math.max(...spiele.map((sp) => sp.runde));
  const raus = spiele.map((sp) => {
    const heim = aufloesen(sp.heim), gast = aufloesen(sp.gast), schiri = aufloesen(sp.schiri);
    return { id: sp.id, nr: sp.nr, runde: sp.runde, feld: sp.feld, zeit: zeit(sp.runde), phase: sp.phase, titel: sp.titel,
      heim, gast, schiri, heimText: heim ? null : text(sp.heim), gastText: gast ? null : text(sp.gast), schiriText: schiri ? null : text(sp.schiri),
      ergebnis: fertig(ergebnisse[sp.id]) ? ergebnisse[sp.id] : null };
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
  return { format: FORMAT, name: turnier.name, datum: turnier.datum, ort: turnier.ort, beginn: zeit(1), ende: uhr(minute(letzte) + takt),
    pause: pause ? { nach: pause.nach, von: uhr(minute(pause.nach) + takt), bis: uhr(minute(pause.nach) + takt + pause.minuten) } : null,
    erklaerung: turnier.erklaerung || null, zeitraum: turnier.zeitraum || null, zurueck: turnier.zurueck || null, jimdoKopfAusblenden: !!turnier.jimdoKopfAusblenden, minuten: takt,
    modus: turnier.modus, teams: Object.fromEntries(Object.values(tab).flatMap((t) => t.zeilen).map((z) => z.id).sort((a, b) => a.localeCompare(b, 'de', { numeric: true })).map((id) => [id, teams[id] || `Team ${id}`])),
    spiele: raus, tabellen: tab, endstand };
}

/** Ergebnis prüfen: zwei ganze Zahlen 0–60, kein Unentschieden */
export function pruefen(e) {
  if (!Array.isArray(e) || e.length !== 2) return 'Bitte beide Punktzahlen eintragen.';
  if (!e.every((x) => Number.isInteger(x) && x >= 0 && x <= 60)) return 'Nur ganze Zahlen von 0 bis 60.';
  if (e[0] === e[1]) return 'Ein Satz kann nicht unentschieden enden.';
  return null;
}
