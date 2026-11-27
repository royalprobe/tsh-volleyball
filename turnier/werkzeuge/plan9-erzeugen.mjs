// 9er-Plan: Tiefensuche Runde für Runde mit harten Regeln (kein Team 3-mal hintereinander, Runde 7–9 nur 2 Spiele, Vereinsduelle fest).
// Aufruf: node werkzeuge/plan9-erzeugen.mjs '[[0,[1,2]],[0,[6,7]],[1,[1,3]],[2,[2,3]]]' 1 > raster.json  (Seed 1 = Plan vom 27.11.)
// danach: node werkzeuge/plan9-schiris.mjs raster.json
const N = 9, KAP = [3, 3, 3, 3, 3, 3, 2, 2, 2, 3, 3, 3, 3], R = KAP.length, ZWEI = [6, 7, 8];
const FEST = JSON.parse(process.argv[2] || '[[0,[1,2]],[1,[1,3]],[2,[2,3]]]');
let seed = Number(process.argv[3] || 1);
const zuf = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
const misch = (a) => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(zuf() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const T = [...Array(N)].map((_, i) => i + 1);
const benutzt = new Set(), key = (a, b) => a < b ? a + '-' + b : b + '-' + a;
const spiele = Array(N + 1).fill(0), lauf = Array(N + 1).fill(0), run = [];
const festIn = (r) => FEST.filter(([x]) => x === r).map(([, p]) => p);
FEST.forEach(([, p]) => benutzt.add(key(...p)));
// max. Spiele in k Runden ohne 3 in Folge, wenn schon s in Folge gespielt
const maxSp = (k, s) => { let n = 0; for (let i = 0; i < k; i++) { if (s < 2) { n++; s++; } else s = 0; } return n; };
let knoten = 0;
function runde(r) {
  if (r === R) return true;
  // Machbarkeit
  for (const t of T) if (8 - spiele[t] > maxSp(R - r, lauf[t])) return false;
  const pflicht = festIn(r);
  const frei = T.filter((t) => lauf[t] < 2 && !pflicht.some((p) => p.includes(t)));
  // Teams, die in dieser Runde spielen MÜSSEN (sonst nicht mehr machbar)
  const muss = T.filter((t) => 8 - spiele[t] > maxSp(R - r - 1, 0));
  const kombis = [];
  const wahl = (rest, gew, n) => {
    if (kombis.length > 40) return;
    if (n === 0) { kombis.push([...gew]); return; }
    if (!rest.length) return;
    const [a, ...weiter] = rest;
    for (const b of misch(weiter)) {
      if (benutzt.has(key(a, b))) continue;
      gew.push([a, b]); wahl(weiter.filter((x) => x !== b), gew, n - 1); gew.pop();
    }
    if (rest.length > 2 * n) wahl(weiter, gew, n);   // a spielt nicht
  };
  wahl(misch(frei), [], KAP[r] - pflicht.length);
  for (const k of kombis) {
    if (++knoten > 3e6) return false;
    const alle = [...pflicht, ...k], spielen = new Set(alle.flat());
    if (muss.some((t) => !spielen.has(t))) continue;
    if (alle.some((p) => p.some((t) => lauf[t] >= 2))) continue;
    const alt = T.map((t) => lauf[t]);
    k.forEach((p) => benutzt.add(key(...p)));
    T.forEach((t) => { if (spielen.has(t)) { spiele[t]++; lauf[t]++; } else lauf[t] = 0; });
    run[r] = alle;
    // Regel: jedes Team muss in Runde 7–9 mind. 1-mal nicht spielen; Schiri-Zahl = Nicht-Spiel-Runden in 3er-Runden <= 4
    let ok = true;
    if (r === 8) ok = T.every((t) => ZWEI.some((x) => !run[x].flat().includes(t)));
    if (ok && runde(r + 1)) return true;
    k.forEach((p) => benutzt.delete(key(...p)));
    T.forEach((t, i) => { if (spielen.has(t)) spiele[t]--; lauf[t] = alt[i]; });
  }
  return false;
}
// Idle-Partition prüfen (jedes Team genau 1 Runde frei in 7–9, je Runde 3)
function idleOk() {
  const nicht = T.map((t) => ZWEI.filter((x) => !run[x].flat().includes(t)));
  const zahl = [0, 0, 0];
  const v = (i) => { if (i === N) return true; for (const x of nicht[i]) { const k = x - 6; if (zahl[k] < 3) { zahl[k]++; if (v(i + 1)) return true; zahl[k]--; } } return false; };
  return v(0);
}
const start = Date.now();
for (let versuch = 0; Date.now() - start < 25000; versuch++) {
  benutzt.clear(); FEST.forEach(([, p]) => benutzt.add(key(...p))); spiele.fill(0); lauf.fill(0); run.length = 0; knoten = 0;
  if (runde(0) && idleOk()) { console.log(JSON.stringify(run)); for (const t of T) console.error(t, run.map((x) => x.flat().includes(t) ? 'S' : '-').join('')); process.exit(0); }
}
console.error('nichts gefunden');
