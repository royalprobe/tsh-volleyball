// Spielplan und Wertung des U14-Turniers: 12 Teams in zwei 6er-Gruppen (jeder gegen jeden), danach Überkreuz-Spiele
// (1./2., 3./4., 5./6. der Gruppen) und alle Platzierungsspiele – 42 Spiele, 14 Runden, 3 Felder.
// Ein Spiel = 1 Satz auf 25. Schiedsgericht: in der Gruppenphase pfeift die jeweils andere Gruppe.
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

/** Alle 42 Spiele mit Runde, Feld, Phase, Teilnehmern und Schiedsgericht */
export function spielplan() {
  const spiele = [];
  let nr = 0;
  const neu = (runde, feld, phase, titel, heim, gast, schiri) => spiele.push({ id: `S${++nr}`, nr, runde, feld, phase, titel, heim, gast, schiri });
  const R = rundenSechs();
  // Gruppenphase: Runde 1, 3, 5, 7, 9 Gruppe A, Runde 2, 4, … 10 Gruppe B. Pfeifen: Teams der anderen Gruppe, reihum.
  for (let r = 0; r < 5; r++) {
    for (const [g, andere, runde] of [['A', 'B', r * 2 + 1], ['B', 'A', r * 2 + 2]]) {
      R[r].forEach(([a, b], feld) => neu(runde, feld + 1, 'gruppe', `Gruppe ${g}`, { t: `${g}${a + 1}` }, { t: `${g}${b + 1}` },
        { t: `${andere}${((r * 3 + feld) % 6) + 1}` }));
    }
  }
  // Überkreuz (Runde 11 und 12) – von hinten nach vorne: zuerst um Platz 9–12, dann 5–8, die Halbfinale zuletzt
  neu(11, 1, 'kreuz', 'Überkreuz Platz 9–12', { g: 'A', p: 5 }, { g: 'B', p: 6 }, { g: 'A', p: 4 });  // S31
  neu(11, 2, 'kreuz', 'Überkreuz Platz 9–12', { g: 'B', p: 5 }, { g: 'A', p: 6 }, { g: 'B', p: 3 });  // S32
  neu(11, 3, 'kreuz', 'Überkreuz Platz 5–8', { g: 'A', p: 3 }, { g: 'B', p: 4 }, { g: 'B', p: 1 });   // S33
  neu(12, 1, 'kreuz', 'Halbfinale', { g: 'A', p: 1 }, { g: 'B', p: 2 }, { g: 'A', p: 3 });            // S34
  neu(12, 2, 'kreuz', 'Halbfinale', { g: 'B', p: 1 }, { g: 'A', p: 2 }, { g: 'B', p: 4 });            // S35
  neu(12, 3, 'kreuz', 'Überkreuz Platz 5–8', { g: 'B', p: 3 }, { g: 'A', p: 4 }, { g: 'A', p: 5 });   // S36
  // Platzierungsspiele (Runde 13 und 14) – ebenfalls von hinten: Platz 11, 9, 7, dann 5, 3 und das Finale zuletzt auf Feld 1
  neu(13, 1, 'platz', 'Spiel um Platz 7', { v: 'S33' }, { v: 'S36' }, { s: 'S33' });   // S37
  neu(13, 2, 'platz', 'Spiel um Platz 9', { s: 'S31' }, { s: 'S32' }, { v: 'S35' });   // S38
  neu(13, 3, 'platz', 'Spiel um Platz 11', { v: 'S31' }, { v: 'S32' }, { v: 'S34' });  // S39
  neu(14, 1, 'platz', 'Finale', { s: 'S34' }, { s: 'S35' }, { s: 'S38' });             // S40
  neu(14, 2, 'platz', 'Spiel um Platz 3', { v: 'S34' }, { v: 'S35' }, { s: 'S37' });   // S41
  neu(14, 3, 'platz', 'Spiel um Platz 5', { s: 'S33' }, { s: 'S36' }, { s: 'S39' });   // S42
  return spiele;
}

/** Rangfolge der Plätze aus den Platzierungsspielen: Spiel-ID -> [Platz Sieger, Platz Verlierer] */
const PLAETZE = { S40: [1, 2], S41: [3, 4], S42: [5, 6], S37: [7, 8], S38: [9, 10], S39: [11, 12] };

const fertig = (e) => Array.isArray(e) && e.length === 2 && Number.isInteger(e[0]) && Number.isInteger(e[1]) && e[0] !== e[1];

/** Tabelle einer Gruppe: Siege, dann Ballpunkte-Differenz, dann erzielte Bälle, dann direkter Vergleich */
export function tabelle(g, spiele, ergebnisse, teams) {
  const z = {};
  for (let i = 1; i <= 6; i++) z[`${g}${i}`] = { id: `${g}${i}`, name: teams[`${g}${i}`] || `Team ${g}${i}`, sp: 0, s: 0, n: 0, bp: 0, bm: 0 };
  const direkt = {};
  for (const sp of spiele) {
    if (sp.phase !== 'gruppe' || sp.titel !== `Gruppe ${g}`) continue;
    const e = ergebnisse[sp.id];
    if (!fertig(e)) continue;
    const [h, a] = [z[sp.heim.t], z[sp.gast.t]];
    h.sp++; a.sp++; h.bp += e[0]; h.bm += e[1]; a.bp += e[1]; a.bm += e[0];
    const sieger = e[0] > e[1] ? h : a, verlierer = sieger === h ? a : h;
    sieger.s++; verlierer.n++;
    direkt[`${sieger.id}>${verlierer.id}`] = true;
  }
  const liste = Object.values(z);
  liste.sort((x, y) => y.s - x.s || (y.bp - y.bm) - (x.bp - x.bm) || y.bp - x.bp
    || (direkt[`${x.id}>${y.id}`] ? -1 : direkt[`${y.id}>${x.id}`] ? 1 : 0) || x.id.localeCompare(y.id));
  const komplett = spiele.filter((sp) => sp.titel === `Gruppe ${g}`).every((sp) => fertig(ergebnisse[sp.id]));
  return { komplett, zeilen: liste.map((t, i) => ({ ...t, platz: i + 1 })) };
}

/** Kompletter Stand: Spiele mit aufgelösten Teams, Tabellen, Endstand */
export function stand(turnier, ergebnisse) {
  const teams = turnier.teams || {};
  const spiele = spielplan();
  const tab = { A: tabelle('A', spiele, ergebnisse, teams), B: tabelle('B', spiele, ergebnisse, teams) };
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
  const text = (x) => x.t ? null : x.g ? `${x.p}. Gruppe ${x.g}` : `${x.s ? 'Sieger' : 'Verlierer'} Spiel ${x.s ? x.s.slice(1) : x.v.slice(1)}`;
  const [hh, mm] = String(turnier.beginn || '09:00').split(':').map(Number);
  const takt = turnier.minuten || 25;
  const zeit = (runde) => { const m = hh * 60 + mm + (runde - 1) * takt; return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; };
  const raus = spiele.map((sp) => {
    const heim = aufloesen(sp.heim), gast = aufloesen(sp.gast), schiri = aufloesen(sp.schiri);
    return { id: sp.id, nr: sp.nr, runde: sp.runde, feld: sp.feld, zeit: zeit(sp.runde), phase: sp.phase, titel: sp.titel,
      heim, gast, schiri, heimText: heim ? null : text(sp.heim), gastText: gast ? null : text(sp.gast), schiriText: schiri ? null : text(sp.schiri),
      ergebnis: fertig(ergebnisse[sp.id]) ? ergebnisse[sp.id] : null };
  });
  // Endstand: Plätze aus den Platzierungsspielen
  const endstand = [];
  for (const [id, [p1, p2]] of Object.entries(PLAETZE)) {
    const sp = raus.find((s) => s.id === id);
    if (!sp.ergebnis || !sp.heim || !sp.gast) continue;
    const [s, v] = sp.ergebnis[0] > sp.ergebnis[1] ? [sp.heim, sp.gast] : [sp.gast, sp.heim];
    endstand.push({ platz: p1, team: s }, { platz: p2, team: v });
  }
  endstand.sort((a, b) => a.platz - b.platz);
  return { name: turnier.name, datum: turnier.datum, ort: turnier.ort, beginn: zeit(1), ende: zeit(15), minuten: takt,
    modus: turnier.modus, teams: Object.fromEntries(Object.keys(tab.A.zeilen.concat(tab.B.zeilen).reduce((o, z) => (o[z.id] = 1, o), {})).map((id) => [id, teams[id] || `Team ${id}`])),
    spiele: raus, tabellen: tab, endstand };
}

/** Ergebnis prüfen: zwei ganze Zahlen 0–60, kein Unentschieden */
export function pruefen(e) {
  if (!Array.isArray(e) || e.length !== 2) return 'Bitte beide Punktzahlen eintragen.';
  if (!e.every((x) => Number.isInteger(x) && x >= 0 && x <= 60)) return 'Nur ganze Zahlen von 0 bis 60.';
  if (e[0] === e[1]) return 'Ein Satz kann nicht unentschieden enden.';
  return null;
}
