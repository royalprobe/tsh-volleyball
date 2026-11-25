// Sucht die Gruppenphase für 10 Teams in zwei 5er-Gruppen (je jeder gegen jeden = 20 Spiele):
// Runde 1–4 auf 3 Feldern, Runde 5–8 („Mittagszeit“) nur auf Feld 1 und 2. Ausgabe: JSON für plan.mjs (PLAN_10).
// Aufruf: node turnier/werkzeuge/plan10-erzeugen.mjs
//
// Teams: A1 Dornbirn 1, A2 Hohenems 1, A3 Montafon 1, A4 Egg, A5 Wolfurt | B1 Dornbirn 2, B2 Dornbirn Jungs, B3 Hohenems 2,
// B4 Montafon 2, B5 Nenzing. Fest: Dornbirn 2 – Dornbirn Jungs in Runde 1.
// Muss: kein Team zweimal in einer Runde, jedes Team pfeift genau 2-mal, jedes Team hat in Runde 5–8 zwei Runden hintereinander
// kein eigenes Spiel und davon mindestens eine ganz frei (Mittagspause). Zwei ganz freie Runden für alle gehen sich nicht aus:
// in den 4 Runden auf 2 Feldern sind je 6 Teams im Einsatz (4 spielen, 2 pfeifen), es bleiben nur 16 freie Plätze für 10 Teams.
// Soll: möglichst viele Teams 2 Runden ganz frei, nie 3 Spiele hintereinander, Schiri spielt danach am selben Feld.
let seed = 28112026;
const zufall = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
const mischen = (a) => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(zufall() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
const TEAMS = ['A1', 'A2', 'A3', 'A4', 'A5', 'B1', 'B2', 'B3', 'B4', 'B5'];
const FELDER = [3, 3, 3, 3, 2, 2, 2, 2];   // Spiele je Runde
const MITTAG = [4, 5, 6, 7];                // Runden 5–8 (Index)
const paare = [];
for (const g of ['A', 'B']) for (let a = 1; a <= 5; a++) for (let b = a + 1; b <= 5; b++) paare.push([`${g}${a}`, `${g}${b}`]);
const FEST = ['B1', 'B2'];
const gleich = (p, q) => p[0] === q[0] && p[1] === q[1];

function verteilen() {
  const runden = FELDER.map(() => []);
  runden[0].push(FEST);
  const offen = mischen(paare.filter((p) => !gleich(p, FEST)));
  let schritte = 0;
  const versuch = (i) => {
    if (i === offen.length) return true;
    if (++schritte > 5000) return false;
    const p = offen[i];
    for (const r of mischen([...runden.keys()])) {
      if (runden[r].length >= FELDER[r] || runden[r].some((q) => q.includes(p[0]) || q.includes(p[1]))) continue;
      runden[r].push(p);
      if (versuch(i + 1)) return true;
      runden[r].pop();
    }
    return false;
  };
  return versuch(0) ? runden : null;
}

const spielt = (runden, r, t) => runden[r].some((p) => p.includes(t));
function strafeSpiele(runden) {
  let s = 0;
  for (const t of TEAMS) {
    let folge = 0;
    for (let r = 0; r < runden.length; r++) { if (spielt(runden, r, t)) { if (++folge >= 3) s += 10; } else folge = 0; }
    // Mittagspause muss möglich sein: zwei Runden in Folge (5–8) ohne Spiel
    let pause = false;
    for (let i = 0; i < MITTAG.length - 1; i++) if (!spielt(runden, MITTAG[i], t) && !spielt(runden, MITTAG[i + 1], t)) pause = true;
    if (!pause) s += 50;
  }
  return s;
}

/** Felder + Schiris: rückwärts, je Runde zufällig unter den besten Varianten; prüft Pfeif-Anzahl und Mittagspause */
function schiris(runden) {
  let beste = null;
  for (let versuch = 0; versuch < 300; versuch++) {
    const zahl = Object.fromEntries(TEAMS.map((t) => [t, 0]));
    const plan = [];
    let naechste = null, treffer = 0, ok = true;
    for (let r = runden.length - 1; r >= 0 && ok; r--) {
      const frei = mischen(TEAMS.filter((t) => !spielt(runden, r, t)).filter((t) => zahl[t] < 2));
      const spiele = mischen(runden[r]);
      if (frei.length < spiele.length) { ok = false; break; }
      // Felder der Spiele: zufällig; Schiri je Feld: bevorzugt, wer in der nächsten Runde dort spielt
      const schiri = [];
      for (let f = 0; f < spiele.length; f++) {
        const kandidat = frei.filter((t) => !schiri.includes(t));
        const gut = naechste && naechste.spiele[f] ? kandidat.filter((t) => naechste.spiele[f].includes(t)) : [];
        const t = (gut.length && zufall() < 0.9 ? gut : kandidat).sort((a, b) => zahl[a] - zahl[b])[0];
        if (!t) { ok = false; break; }
        if (gut.includes(t)) treffer++;
        schiri.push(t); zahl[t]++;
      }
      plan[r] = { spiele, schiri };
      naechste = plan[r];
    }
    if (!ok || Object.values(zahl).some((n) => n !== 2)) continue;
    // Mittagspause: zwei Runden in Folge (5–8) ohne Spiel, mindestens eine davon auch ohne Pfeifen
    const ganz = (t, r) => !spielt(runden, r, t) && !plan[r].schiri.includes(t);
    const block = (t, r1, r2) => !spielt(runden, r1, t) && !spielt(runden, r2, t) && (ganz(t, r1) || ganz(t, r2));
    if (!TEAMS.every((t) => MITTAG.slice(0, -1).some((r, i) => block(t, r, MITTAG[i + 1])))) continue;
    const voll = TEAMS.filter((t) => MITTAG.slice(0, -1).some((r, i) => ganz(t, r) && ganz(t, MITTAG[i + 1]))).length;
    const wert = voll * 3 + treffer;
    if (!beste || wert > beste.wert) beste = { plan, treffer, voll, wert };
  }
  return beste;
}

function verbessern(runden) {
  let s = strafeSpiele(runden);
  for (let i = 0; i < 20000 && s > 0; i++) {
    const r1 = Math.floor(zufall() * runden.length), r2 = Math.floor(zufall() * runden.length);
    if (r1 === r2) continue;
    const i1 = Math.floor(zufall() * runden[r1].length), i2 = Math.floor(zufall() * runden[r2].length);
    const a = runden[r1][i1], b = runden[r2][i2];
    if (gleich(a, FEST) || gleich(b, FEST)) continue;
    const passt = (r, raus, rein) => runden[r].every((q) => q === raus || !(q.includes(rein[0]) || q.includes(rein[1])));
    if (!passt(r1, a, b) || !passt(r2, b, a)) continue;
    runden[r1][i1] = b; runden[r2][i2] = a;
    const neu = strafeSpiele(runden);
    if (neu <= s) s = neu; else { runden[r1][i1] = a; runden[r2][i2] = b; }
  }
  return runden;
}

let bester = null;
for (let lauf = 0; lauf < 400; lauf++) {
  let r = verteilen();
  if (!r) continue;
  r = verbessern(r);
  const st = strafeSpiele(r);
  if (st > 0 && bester && bester.strafe === 0) continue;
  const sch = schiris(r);
  if (!sch) continue;
  const wert = st * 10 - sch.wert;
  if (!bester || wert < bester.wert) bester = { wert, strafe: st, treffer: sch.treffer, voll: sch.voll, plan: sch.plan };
}
if (!bester) { console.error('kein Plan gefunden'); process.exit(1); }
console.error(`Strafe ${bester.strafe}, Schiri spielt danach am selben Feld: ${bester.treffer}, Teams mit 2 ganz freien Mittagsrunden: ${bester.voll}`);
const raus = bester.plan.map((x, r) => ({ runde: r + 1, spiele: x.spiele, schiri: x.schiri }));
for (const t of TEAMS) console.error(`${t}: ` + raus.map((x) => x.spiele.some((p) => p.includes(t)) ? 'S' : x.schiri.includes(t) ? 'p' : '·').join(''));
console.log(JSON.stringify(raus));
