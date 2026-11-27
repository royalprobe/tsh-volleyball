import { readFileSync } from 'node:fs';
// Nummeriert die Teams eines fertigen 9er-Plans so um, dass die Vereinsduelle (Dornbirn 1–2, Montafon 1–2, Dornbirn – Jungs) früh liegen.
const plan = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const runde = (a, b) => plan.findIndex((r) => r.spiele.some((p) => p.includes(a) && p.includes(b)));
const perms = (a) => a.length <= 1 ? [a] : a.flatMap((x, i) => perms([...a.slice(0, i), ...a.slice(i + 1)]).map((p) => [x, ...p]));
// pi[neu-1] = alte Nummer: Team "neu" spielt die Rolle der alten Nummer
let best = null;
for (const pi of perms([1,2,3,4,5,6,7,8,9])) {
  const r = (x, y) => runde(pi[x - 1], pi[y - 1]);
  const s = r(1, 2) * 10 + r(6, 7) * 10 + r(1, 3) * 3 + r(2, 3) * 3;
  if (!best || s < best.s) best = { s, pi, d: [r(1, 2), r(6, 7), r(1, 3), r(2, 3)] };
}
console.error(best);
const inv = {}; best.pi.forEach((alt, i) => inv[alt] = i + 1);
const neu = plan.map((r) => ({ runde: r.runde, spiele: r.spiele.map((p) => p.map((t) => inv[t])), schiri: r.schiri.map((t) => inv[t]) }));
console.log(JSON.stringify(neu));
