// Aufruf: node werkzeuge/plan9-erzeugen.mjs 8 > plan.json  (Seed 8 ergab den Plan vom 27.11.), danach node werkzeuge/plan9-vereine.mjs plan.json
// 9 Teams komplett neu: 13 Runden, Runde 7–9 nur Feld 1+3 (jedes Team hat in genau einer davon ganz frei), Vereinsduelle zuerst.
const N = 9, KAP = [3, 3, 3, 3, 3, 3, 2, 2, 2, 3, 3, 3, 3], R = KAP.length, ZWEI = [6, 7, 8];
let seed = Number(process.argv[2] || 5);
const zuf = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
const misch = (a) => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(zuf() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const teams = [...Array(N)].map((_, i) => i + 1);
const paare = []; for (let a = 1; a <= N; a++) for (let b = a + 1; b <= N; b++) paare.push([a, b]);
// A1 Dornbirn 1, A2 Dornbirn 2, A3 Dornbirn Jungs, A4 Hohenems, A5 Nenzing, A6/A7 Montafon 1/2, A8 Egg, A9 Wolfurt
const FEST = [];
const istFest = (p) => FEST.some(([, q]) => q[0] === p[0] && q[1] === p[1]);
const kombi = (a, k) => k === 0 ? [[]] : a.flatMap((x, i) => kombi(a.slice(i + 1), k - 1).map((c) => [x, ...c]));
const spielt = (run, r, t) => run[r].some((p) => p.includes(t));

function verteilen() {
  const run = Array.from({ length: R }, () => []);
  for (const [r, p] of FEST) run[r].push(p);
  const offen = misch(paare.filter((p) => !istFest(p)));
  let n = 0;
  const v = (i) => {
    if (i === offen.length) return true;
    if (++n > 20000) return false;
    const p = offen[i];
    for (const r of misch([...Array(R).keys()])) {
      if (run[r].length >= KAP[r] || run[r].some((q) => q.includes(p[0]) || q.includes(p[1]))) continue;
      run[r].push(p); if (v(i + 1)) return true; run[r].pop();
    }
    return false;
  };
  return v(0) ? run : null;
}
function schiris(run) {
  const zahl = Object.fromEntries(teams.map((t) => [t, 0])), sch = [];
  for (let r = 0; r < R; r++) if (!ZWEI.includes(r)) { sch[r] = teams.filter((t) => !spielt(run, r, t)); sch[r].forEach((t) => zahl[t]++); }
  if (teams.some((t) => zahl[t] > 4)) return [];
  const frei = ZWEI.map((r) => teams.filter((t) => !spielt(run, r, t)));
  const loes = [];
  for (const a of kombi(frei[0], 2)) for (const b of kombi(frei[1], 2)) for (const c of kombi(frei[2], 2)) {
    const z = { ...zahl }; [...a, ...b, ...c].forEach((t) => z[t]++);
    if (!teams.every((t) => z[t] === 4)) continue;
    const idle = [...frei[0].filter((t) => !a.includes(t)), ...frei[1].filter((t) => !b.includes(t)), ...frei[2].filter((t) => !c.includes(t))];
    if (new Set(idle).size !== 9) continue;
    const s = [...sch]; s[6] = a; s[7] = b; s[8] = c; loes.push(s);
  }
  return loes;
}
function strafePlan(run, sch) {
  let s = 0;
  for (const t of teams) {
    let folge = 0, warten = 0, vor = '';
    for (let r = 0; r < R; r++) {
      const sp = spielt(run, r, t), pf = sch[r].includes(t);
      if (sp) { folge++; if (folge >= 3) s += 100; if (warten >= 3) s += (warten - 2) * 8; warten = 0; }
      else { folge = 0; warten++; }
      if (pf && vor === 'p') s += 6;
      vor = sp ? 's' : pf ? 'p' : '-';
    }
    let letzte = 0, erste = R; for (let r = 0; r < R; r++) if (spielt(run, r, t)) { letzte = r; erste = Math.min(erste, r); }
    s += Math.max(0, 11 - letzte) * 6 + erste * 6;
  }
  return s;
}
const bewerte = (run) => { let b = null; for (const sch of schiris(run)) { const s = strafePlan(run, sch); if (!b || s < b.s) b = { s, sch }; } return b || { s: 1e6, sch: null }; };
function klettern(run) {
  let cur = bewerte(run);
  for (let it = 0; it < 3000; it++) {
    const a = Math.floor(zuf() * R), b = Math.floor(zuf() * R); if (a === b) continue;
    const i = Math.floor(zuf() * run[a].length), j = Math.floor(zuf() * run[b].length);
    const pa = run[a][i], pb = run[b][j];
    if (istFest(pa) || istFest(pb)) continue;
    const A = run[a].filter((_, k) => k !== i), B = run[b].filter((_, k) => k !== j);
    if (A.some((q) => q.some((t) => pb.includes(t))) || B.some((q) => q.some((t) => pa.includes(t)))) continue;
    const neu = [...run]; neu[a] = [...A, pb]; neu[b] = [...B, pa];
    const nb = bewerte(neu);
    if (nb.s <= cur.s) { run = neu; cur = nb; }
  }
  return { run, ...cur };
}
let best = null;
const ende = Date.now() + 70000;
while (Date.now() < ende) { const r0 = verteilen(); if (!r0) continue; const e = klettern(r0); if (!best || e.s < best.s) { best = e; console.error('strafe', e.s); } }
const perms = (a) => a.length <= 1 ? [a] : a.flatMap((x, i) => perms([...a.slice(0, i), ...a.slice(i + 1)]).map((p) => [x, ...p]));
const FELDER = (r) => KAP[r] === 2 ? [1, 3] : [1, 2, 3];
let naechste = null; const out = [];
for (let r = R - 1; r >= 0; r--) {
  let b = null;
  for (const ps of perms(best.run[r])) for (const ss of perms(best.sch[r])) {
    let tr = 0;
    if (naechste) ss.forEach((t, i) => { const f = FELDER(r)[i], k = FELDER(r + 1).indexOf(f); if (k >= 0 && naechste.spiele[k] && naechste.spiele[k].includes(t)) tr++; });
       // Runde 1 Feld 1: Dornbirn 1 – Dornbirn 2
    if (!b || tr > b.tr) b = { tr, spiele: ps, schiri: ss };
  }
  out.unshift({ runde: r + 1, spiele: b.spiele, schiri: b.schiri }); naechste = b;
}
for (const t of teams) console.error(String(t), out.map((r, i) => { const k = r.spiele.findIndex((p) => p.includes(t)); if (k >= 0) return String(FELDER(i)[k]); const j = r.schiri.indexOf(t); return j >= 0 ? 'abc'[FELDER(i)[j] - 1] : '·'; }).join(' '));
console.log(JSON.stringify(out));
