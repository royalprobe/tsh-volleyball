// Sucht einen Spielplan für 9 Teams, jeder gegen jeden (36 Spiele), auf 3 Feldern in 12 Runden, Mittagspause nach Runde 6.
// Ausgabe: JSON zum Eintragen in plan.mjs (PLAN_9). Aufruf: node turnier/werkzeuge/plan9-erzeugen.mjs
//
// Feste Bedingungen: je Runde 3 Spiele mit 6 verschiedenen Teams; jedes Team spielt vor und nach der Pause je 4-mal.
// Die 3 Teams ohne Spiel pfeifen (jedes Team pfeift damit genau 4-mal).
// Bewertet wird: höchstens 2 Spiele hintereinander, keine langen Wartezeiten, und möglichst oft pfeift ein Team auf dem
// Feld, auf dem es in der nächsten Runde selbst spielt (Felder und Schiris werden dafür je Runde passend verteilt).
let seed = 3333;
const zufall = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
const N = 9, RUNDEN = 12, PAUSE_NACH = 6;
const paare = [];
for (let a = 1; a <= N; a++) for (let b = a + 1; b <= N; b++) paare.push([a, b]);
// Vereinsduelle zuerst (Simons Wunsch): Teams A1 Dornbirn 1, A2 Dornbirn 2, A3 Dornbirn Jungs, A4/A5 Hohenems 1/2,
// A6/A7 Montafon 1/2, A8 Egg, A9 Wolfurt. Runde 1: alle drei Zweier-Duelle, Runde 2 und 3: die übrigen Dornbirner Duelle.
const FEST = [[0, [1, 2]], [0, [4, 5]], [0, [6, 7]], [1, [1, 3]], [2, [2, 3]]];
const istFest = (p) => FEST.some(([, q]) => q[0] === p[0] && q[1] === p[1]);

/** zufällige gültige Verteilung der 36 Paare auf 12 Runden (Backtracking) */
function verteilen() {
  const runden = Array.from({ length: RUNDEN }, () => []);
  for (const [r, p] of FEST) runden[r].push(p);
  const offen = paare.filter((p) => !istFest(p)).sort(() => zufall() - 0.5);
  const zahl = (t, haelfte) => runden.slice(haelfte * PAUSE_NACH, (haelfte + 1) * PAUSE_NACH).flat().filter((p) => p.includes(t)).length;
  let schritte = 0;
  const versuch = (i) => {
    if (i === offen.length) return true;
    if (++schritte > 20000) return false;   // festgefahren: neu würfeln
    const p = offen[i];
    const reihe = [...runden.keys()].sort(() => zufall() - 0.5);
    for (const r of reihe) {
      const h = r < PAUSE_NACH ? 0 : 1;
      if (runden[r].length >= 3 || runden[r].some((q) => q.includes(p[0]) || q.includes(p[1]))) continue;
      if (zahl(p[0], h) >= 4 || zahl(p[1], h) >= 4) continue;
      runden[r].push(p);
      if (versuch(i + 1)) return true;
      runden[r].pop();
    }
    return false;
  };
  return versuch(0) ? runden : null;
}

/** spielt Team t in Runde r? */
const spielt = (runden, r, t) => runden[r].some((p) => p.includes(t));
function strafe(runden) {
  let s = 0;
  for (let t = 1; t <= N; t++) {
    let folge = 0, warten = 0;
    for (let r = 0; r < RUNDEN; r++) {
      if (r === PAUSE_NACH) { folge = 0; warten = 0; }
      if (spielt(runden, r, t)) { folge++; warten = 0; if (folge >= 3) s += 10; }
      else { warten++; folge = 0; if (warten >= 2) s += 6; }
    }
  }
  return s;
}

/** Felder und Schiris je Runde so legen, dass möglichst viele Schiris danach auf demselben Feld spielen */
function felderUndSchiris(runden) {
  const perms = [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]];
  const plan = [];
  // rückwärts: die Felder der nächsten Runde stehen dann schon fest
  let naechste = null;
  for (let r = RUNDEN - 1; r >= 0; r--) {
    const frei = []; for (let t = 1; t <= N; t++) if (!spielt(runden, r, t)) frei.push(t);
    let beste = null;
    for (const pf of perms) for (const ps of perms) {
      const spiele = pf.map((i) => runden[r][i]);   // Feld 1..3
      const schiri = ps.map((i) => frei[i]);
      let treffer = 0;
      if (naechste) schiri.forEach((t, f) => { if (naechste.spiele[f].includes(t)) treffer++; });
      if (!beste || treffer > beste.treffer) beste = { spiele, schiri, treffer };
    }
    plan[r] = beste;
    naechste = beste;
  }
  return plan;
}

/** Verbessern: Spiele zwischen zwei Runden derselben Hälfte tauschen, solange die Strafe nicht steigt */
function verbessern(runden) {
  let s = strafe(runden);
  for (let i = 0; i < 30000 && s > 0; i++) {
    const h = zufall() < 0.5 ? 0 : PAUSE_NACH;
    const r1 = h + Math.floor(zufall() * PAUSE_NACH), r2 = h + Math.floor(zufall() * PAUSE_NACH);
    if (r1 === r2) continue;
    const i1 = Math.floor(zufall() * 3), i2 = Math.floor(zufall() * 3);
    const a = runden[r1][i1], b = runden[r2][i2];
    if (istFest(a) || istFest(b)) continue;   // Vereinsduelle bleiben, wo sie sind
    const passt = (r, raus, rein) => runden[r].every((q) => q === raus || !(q.includes(rein[0]) || q.includes(rein[1])));
    if (!passt(r1, a, b) || !passt(r2, b, a)) continue;
    runden[r1][i1] = b; runden[r2][i2] = a;
    const neu = strafe(runden);
    if (neu <= s) s = neu; else { runden[r1][i1] = a; runden[r2][i2] = b; }
  }
  return runden;
}

let bester = null;
for (let lauf = 0; lauf < 1500; lauf++) {
  let r = verteilen();
  if (!r) continue;
  r = verbessern(r);
  const fs = felderUndSchiris(r);
  const treffer = fs.reduce((n, x) => n + x.treffer, 0);
  const wert = strafe(r) - treffer * 4;
  if (!bester || wert < bester.wert) bester = { wert, strafe: strafe(r), treffer, plan: fs };
}
console.error(`Strafe ${bester.strafe}, Schiri spielt danach am selben Feld: ${bester.treffer} von 33 möglichen`);
const raus = bester.plan.map((x, r) => ({ runde: r + 1, spiele: x.spiele, schiri: x.schiri }));
// Kontrolle: Folgen und Wartezeiten je Team
for (let t = 1; t <= N; t++) console.error(`A${t}: ` + raus.map((x) => x.spiele.findIndex((p) => p.includes(t)) >= 0 ? 'S' : x.schiri.includes(t) ? 'p' : '·').join('').replace(/^(.{6})/, '$1 | '));
console.log(JSON.stringify(raus));
