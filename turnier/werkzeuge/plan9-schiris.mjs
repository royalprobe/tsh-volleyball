// Schiris + Felder zu einem Spiel-Raster (Ausgabe von exakt.mjs)
import { readFileSync } from 'node:fs';
const run = JSON.parse(readFileSync(process.argv[2], 'utf8')).map((r) => r.map((p) => [...p].sort((a, b) => a - b)));
const N = 9, KAP = run.map((r) => r.length), R = run.length, ZWEI = [6, 7, 8];
const T = [...Array(N)].map((_, i) => i + 1);
const spielt = (r, t) => run[r].some((p) => p.includes(t));
const kombi = (a, k) => k === 0 ? [[]] : a.flatMap((x, i) => kombi(a.slice(i + 1), k - 1).map((c) => [x, ...c]));
const sch = []; for (let r = 0; r < R; r++) if (!ZWEI.includes(r)) sch[r] = T.filter((t) => !spielt(r, t));
const frei = ZWEI.map((r) => T.filter((t) => !spielt(r, t)));
let best = null;
for (const a of kombi(frei[0], 2)) for (const b of kombi(frei[1], 2)) for (const c of kombi(frei[2], 2)) {
  const s = [...sch]; s[6] = a; s[7] = b; s[8] = c;
  const z = Object.fromEntries(T.map((t) => [t, 0])); s.forEach((x) => x.forEach((t) => z[t]++));
  if (!T.every((t) => z[t] === 4)) continue;
  const idle = ZWEI.flatMap((r, i) => frei[i].filter((t) => !s[r].includes(t)));
  if (new Set(idle).size !== 9) continue;
  let p = 0; for (const t of T) for (let r = 1; r < R; r++) if (s[r].includes(t) && s[r - 1].includes(t)) p++;
  if (!best || p < best.p) best = { p, s };
}
const perms = (a) => a.length <= 1 ? [a] : a.flatMap((x, i) => perms([...a.slice(0, i), ...a.slice(i + 1)]).map((p) => [x, ...p]));
const FELDER = (r) => KAP[r] === 2 ? [1, 3] : [1, 2, 3];
let naechste = null; const out = [];
for (let r = R - 1; r >= 0; r--) {
  let b = null;
  for (const ps of perms(run[r])) for (const ss of perms(best.s[r])) {
    let tr = 0;
    if (naechste) ss.forEach((t, i) => { const f = FELDER(r)[i], k = FELDER(r + 1).indexOf(f); if (k >= 0 && naechste.spiele[k] && naechste.spiele[k].includes(t)) tr++; });
    if (r === 0 && !(ps[0][0] === 1 && ps[0][1] === 2)) tr -= 10;
    if (!b || tr > b.tr) b = { tr, spiele: ps, schiri: ss };
  }
  out.unshift({ runde: r + 1, spiele: b.spiele, schiri: b.schiri }); naechste = b;
}
console.error('2x hintereinander pfeifen:', best.p);
for (const t of T) console.error(String(t), out.map((r, i) => { const k = r.spiele.findIndex((p) => p.includes(t)); if (k >= 0) return String(FELDER(i)[k]); const j = r.schiri.indexOf(t); return j >= 0 ? 'abc'[FELDER(i)[j] - 1] : '·'; }).join(' '));
console.log(JSON.stringify(out));
