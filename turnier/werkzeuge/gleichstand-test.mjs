// Prüft die Reihung bei Punktegleichstand (Siege → direkter Vergleich → Ballpunkt-Differenz) mit konstruierten Ergebnissen.
const m = await import('../plan.mjs');
m.format('10');
const sp = m.spielplan().filter((s) => s.phase === 'gruppe');
const id = (a, b) => { const s = sp.find((x) => (x.heim.t === a && x.gast.t === b) || (x.heim.t === b && x.gast.t === a)); return s; };
// ergebnis(a, b, pa, pb): a macht pa Punkte, b macht pb
const setze = (erg, a, b, pa, pb) => { const s = id(a, b); erg[s.id] = s.heim.t === a ? [pa, pb] : [pb, pa]; };
const zeig = (titel, g, erg, erwartet) => {
  const t = m.tabelle(g, sp, erg, {});
  const ist = t.zeilen.map((z) => z.id);
  const ok = JSON.stringify(ist) === JSON.stringify(erwartet);
  console.log(`\n${ok ? 'OK  ' : 'FEHLER'} ${titel}`);
  for (const z of t.zeilen) console.log(`   ${z.platz}. ${z.id}  Siege ${z.s}  Bälle ${z.bp}:${z.bm} (${z.bp - z.bm >= 0 ? '+' : ''}${z.bp - z.bm})`);
  if (!ok) console.log('   erwartet:', erwartet.join(' '));
  return ok;
};
let alleOk = true;

// 1) Gruppe A: 3 Teams mit 3 Siegen im Kreis (A1>A2, A2>A3, A3>A1). Gegenseitige Bälle: A1 +10, A3 +3, A2 -13.
//    A2 hat aber insgesamt die beste Differenz (schlägt A4/A5 hoch) → zeigt, dass die gegenseitigen Bälle vorgehen.
{
  const e = {};
  setze(e, 'A1', 'A2', 25, 10); setze(e, 'A2', 'A3', 25, 23); setze(e, 'A3', 'A1', 25, 20);
  setze(e, 'A1', 'A4', 25, 23); setze(e, 'A1', 'A5', 25, 23);
  setze(e, 'A2', 'A4', 25, 2); setze(e, 'A2', 'A5', 25, 2);
  setze(e, 'A3', 'A4', 25, 20); setze(e, 'A3', 'A5', 25, 20);
  setze(e, 'A4', 'A5', 25, 18);
  alleOk &= zeig('Gruppe A – Dreier-Gleichstand im Kreis → gegenseitige Ballpunkt-Differenz', 'A', e, ['A1', 'A3', 'A2', 'A4', 'A5']);
}
// 2) Gruppe A: 3 Teams mit 3 Siegen, aber KEIN Kreis im direkten Vergleich? Geht bei 3 Siegen nicht (jeder schlägt A4/A5,
//    also 1 Sieg untereinander je Team = immer Kreis). Daher 3 Teams mit 2 Siegen: A3 und A4 schlagen sich gegenseitig nicht im Kreis.
//    A2: 2 Siege (A3, A4), A3: 2 Siege (A4, A5), A4: 2 Siege (A1, A5)? – Mini-Tabelle A2/A3/A4: A2 2, A3 1, A4 0 → A2, A3, A4,
//    obwohl A4 insgesamt die beste Differenz hat.
{
  const e = {};
  setze(e, 'A1', 'A2', 25, 20); setze(e, 'A1', 'A3', 25, 20); setze(e, 'A1', 'A5', 25, 20); setze(e, 'A4', 'A1', 25, 5);   // A1 3 Siege
  setze(e, 'A2', 'A3', 25, 23); setze(e, 'A2', 'A4', 25, 23); setze(e, 'A5', 'A2', 25, 23);                               // A2 2 Siege
  setze(e, 'A3', 'A4', 25, 23); setze(e, 'A3', 'A5', 25, 23);                                                           // A3 2 Siege
  setze(e, 'A4', 'A5', 25, 3);                                                                                         // A4 2 Siege
  alleOk &= zeig('Gruppe A – Dreier-Gleichstand (2 Siege), Mini-Tabelle entscheidet eindeutig', 'A', e, ['A1', 'A2', 'A3', 'A4', 'A5']);
}
// 3) Gruppe B: alle Spiele gespielt, 4 Teams gleichauf geht mit 5 Teams nicht (dann haben alle 5 je 2 Siege).
//    Daher: alle 5 mit 2 Siegen → Mini-Tabelle = Gesamttabelle → Ballpunkt-Differenz.
{
  const e = {};
  // Kreis-Muster: Bi schlägt B(i+1) und B(i+2)
  const T = ['B1', 'B2', 'B3', 'B4', 'B5'];
  const diff = { B1: 1, B2: 9, B3: 4, B4: 12, B5: 6 };   // Siegerpunkte 25, Verlierer 25-diff
  for (let i = 0; i < 5; i++) for (const k of [1, 2]) setze(e, T[i], T[(i + k) % 5], 25, 25 - diff[T[i]]);
  const t = m.tabelle('B', sp, e, {});
  const erw = [...t.zeilen].sort((x, y) => (y.bp - y.bm) - (x.bp - x.bm)).map((z) => z.id);
  alleOk &= zeig('Gruppe B – Fünfer-Gleichstand (alle 2 Siege) → Ballpunkt-Differenz', 'B', e, erw);
}
// 4) Gruppe B während der Vorrunde (noch nicht alle Spiele): 4 Teams mit je 1 Sieg, Mini-Tabelle teilt in 2+2,
//    innerhalb der Paare entscheidet wieder der direkte Vergleich (rekursiv), auch gegen die Ballpunkte.
{
  const e = {};
  // B1>B2 knapp, B3>B4 knapp; B2 und B4 haben sonst nichts; B1 verliert gegen B3? → B3 2 Siege. Stattdessen:
  // gespielt: B1>B2 (25:23), B2>B3 (25:5), B3>B4 (25:23), B4>B1 (25:5) → Kreis mit je 1 Sieg; dazu B5 ohne Spiel
  setze(e, 'B1', 'B2', 25, 23); setze(e, 'B2', 'B3', 25, 5); setze(e, 'B3', 'B4', 25, 23); setze(e, 'B4', 'B1', 25, 5);
  // Gegenseitige Differenz: B1 +2-20=-18, B2 -2+20=+18, B3 -20+2=-18, B4 -2+20=+18 → B2/B4 vor B1/B3; dann Gesamt-Bälle
  alleOk &= zeig('Gruppe B – Vierer-Gleichstand im Kreis (laufende Vorrunde)', 'B', e, ['B2', 'B4', 'B1', 'B3', 'B5']);
}
// 5) Gruppe B, laufend: 4 Teams mit 1 Sieg, Mini-Tabelle B1 2 Siege? Nicht möglich bei 1 Sieg gesamt. Stattdessen
//    4 Teams mit 2 Siegen (B5 hat 0 aus 2 Spielen, ein Spiel fehlt noch):
//    B1>B2, B1>B3, B2>B4, B3>B4? dann B4 0… → Konstruktion: Mini-Tabelle B1 2, B2 1, B3 1, B4 0 → B2/B3 per direktem Duell.
{
  const e = {};
  setze(e, 'B1', 'B2', 25, 20); setze(e, 'B1', 'B3', 25, 20);          // B1 2 Siege
  setze(e, 'B3', 'B2', 25, 23); setze(e, 'B2', 'B4', 25, 10); setze(e, 'B2', 'B5', 25, 0); // B2 2 Siege (B4, B5), verliert knapp gg. B3
  setze(e, 'B3', 'B5', 25, 24);                                         // B3 2 Siege (B2, B5)
  setze(e, 'B4', 'B1', 25, 22); setze(e, 'B4', 'B3', 25, 21);           // B4 2 Siege (B1, B3)
  // Siege: B1 2, B2 2, B3 2, B4 2, B5 0 (B4–B5 noch offen)
  // Mini-Tabelle B1–B4: B1 2 (B2,B3), B2 1 (B4), B3 1 (B2), B4 2 (B1,B3) → B1/B4 2, B2/B3 1
  //   B1 vs B4: B4 gewann → B4, B1;  B2 vs B3: B3 gewann → B3, B2 (obwohl B2 insgesamt viel bessere Bälle hat)
  alleOk &= zeig('Gruppe B – Vierer-Gleichstand, Mini-Tabelle teilt 2+2, dann direktes Duell', 'B', e, ['B4', 'B1', 'B3', 'B2', 'B5']);
}
// 6) Gruppe B: Fünfer-Gleichstand (je 2 Siege), zwei Teams nach den Bällen gleich → dann deren direktes Duell
{
  const e = {};
  // B1>B2, B1>B3; B2>B3, B2>B4; B3>B4, B3>B5; B4>B5, B4>B1; B5>B1, B5>B2
  setze(e, 'B1', 'B2', 25, 15); setze(e, 'B1', 'B3', 25, 15);   // B1 +20
  setze(e, 'B4', 'B1', 25, 15); setze(e, 'B5', 'B1', 25, 15);   // B1 -20 → B1 0
  setze(e, 'B2', 'B3', 25, 15); setze(e, 'B2', 'B4', 25, 15);   // B2 +20, -10 (gg B1) → +10, verliert gg B5:
  setze(e, 'B5', 'B2', 25, 15);                                  // B2 0
  setze(e, 'B3', 'B4', 25, 20); setze(e, 'B3', 'B5', 25, 20);   // B3 +10 -10 -10 → -10
  setze(e, 'B4', 'B5', 25, 20);                                  // B4 +10 +5 -10 -5 → 0
  // B5: +10 +10 -5 -5 → +10
  // Differenzen: B5 +10, B1 0, B2 0, B4 0, B3 -10 → B1/B2/B4 gleich: Mini B1>B2, B2>B4, B4>B1 = Kreis, Bälle untereinander:
  // B1: +10 -10 = 0, B2: -10 +10 = 0, B4: -10(gg B2) +10(gg B1) = 0 → alle gleich → Gesamtbälle (mehr Bälle) → nach Namen
  alleOk &= zeig('Gruppe B – Fünfer-Gleichstand, Teilgruppe wieder im Kreis', 'B', e, ['B5', 'B4', 'B1', 'B2', 'B3']);   // B4 hat bei gleicher Differenz mehr Bälle
}
{
  const e = {};
  // wie oben, aber B2–B4 knapper: B2>B4 25:23 → B2 +8, B4 +2 … Teilgruppe B1/B2/B4 nicht mehr gleich
  setze(e, 'B1', 'B2', 25, 15); setze(e, 'B1', 'B3', 25, 15); setze(e, 'B4', 'B1', 25, 15); setze(e, 'B5', 'B1', 25, 15);
  setze(e, 'B2', 'B3', 25, 13); setze(e, 'B2', 'B4', 25, 23); setze(e, 'B5', 'B2', 25, 15);
  setze(e, 'B3', 'B4', 25, 20); setze(e, 'B3', 'B5', 25, 20); setze(e, 'B4', 'B5', 25, 17);
  // Differenzen: B1 0; B2 +12 +2 -10 -10 = -6; B3 -12 +5 +5 -10 = -12; B4 -2 -5 +10 +8 = +11; B5 +10 +10 -5 -8 = +7
  // alle verschieden → nur nach Bällen: B4, B5, B1, B2, B3 (Probe, dass die Ballreihung stimmt)
  alleOk &= zeig('Gruppe B – Fünfer-Gleichstand, Differenzen alle verschieden', 'B', e, ['B4', 'B5', 'B1', 'B2', 'B3']);
}
// 7) Gruppe A: Dreier-Kreis, nach den Bällen untereinander sind A1 und A2 gleich (je -4) → ihr direktes Duell (A1 schlug A2),
//    obwohl A2 insgesamt die viel bessere Differenz hat
{
  const e = {};
  setze(e, 'A1', 'A2', 25, 19); setze(e, 'A2', 'A3', 25, 23); setze(e, 'A3', 'A1', 25, 15);
  for (const t of ['A1', 'A3']) { setze(e, t, 'A4', 25, 22); setze(e, t, 'A5', 25, 22); }
  setze(e, 'A2', 'A4', 25, 0); setze(e, 'A2', 'A5', 25, 0); setze(e, 'A4', 'A5', 25, 20);
  alleOk &= zeig('Gruppe A – Kreis, zwei Teams nach Bällen untereinander gleich → direktes Duell', 'A', e, ['A3', 'A1', 'A2', 'A4', 'A5']);
}
console.log(alleOk ? '\nAlle Fälle wie erwartet.' : '\nMindestens ein Fall weicht ab!');
