// Druckansicht fürs U14-Turnier (A4, schwarz-weiß-tauglich): Vorrunden-Spielplan, Gruppentabellen als Kreuztabellen und
// Playoff-Spielplan. Eingetragene Ergebnisse, bekannte Teams und Plätze sind ausgefüllt, der Rest bleibt zum Ausfüllen leer.
// Wird vom Server unter /druck?teil=vorrunde|tabellen|playoff|alle ausgeliefert und von werkzeuge/druck.mjs als PDF gespeichert.

const h = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const TAGE = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
const MONATE = ['Jänner', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
export const TEILE = { vorrunde: 'Vorrunde', tabellen: 'Gruppentabellen', playoff: 'Playoff' };

/**
 * @param d       Stand wie /api/stand
 * @param teile   z. B. ['vorrunde'] oder alle drei
 * @param logo    URL oder data:-URL des Logos (wird schwarz eingefärbt)
 * @param knopf   true: Leiste mit „Drucken / als PDF speichern“ und Druckdialog beim Öffnen
 */
export function druckHtml(d, { teile = Object.keys(TEILE), logo = 'logo.png', knopf = false } = {}) {
  const name = (id) => d.teams[id] || id;
  const dt = new Date(d.datum + 'T12:00:00');
  const datum = `${TAGE[dt.getDay()]}, ${dt.getDate()}. ${MONATE[dt.getMonth()]} ${dt.getFullYear()}`;
  const uhr = (z) => z.replace(/^0/, '');
  const box = (v, fett) => `<span class="box${fett ? ' fett' : ''}">${v ?? ''}</span>`;
  const kopf = (titel, zusatz) => `<header><span class="logo"></span><div><div class="t">${h(titel)}</div>
    <div class="u">${h(d.name)} weiblich · ${h(datum)}${zusatz ? ' · ' + h(zusatz) : ''}</div></div></header>`;
  const gruppen = Object.keys(d.tabellen).sort();
  const vor = d.spiele.filter((s) => s.phase === 'gruppe');
  const ko = d.spiele.filter((s) => s.phase !== 'gruppe').sort((a, b) => a.zeit.localeCompare(b.zeit) || (a.feld || 9) - (b.feld || 9));
  const zeiten = (liste) => [...new Set(liste.map((s) => s.zeit))];
  const teil = (id, text) => id ? `<b>${h(name(id))}</b>` : `<span class="platzhalter">${h(text)}</span><span class="linie"></span>`;
  const schiri = (s) => s.schiri ? h(name(s.schiri)) : s.schiriText === 'offen' ? '<span class="linie"></span>' : `<span class="platzhalter">${h(s.schiriText)}</span><span class="linie"></span>`;
  const seiten = {};

  // ---- Vorrunde
  seiten.vorrunde = () => {
    const zeilen = zeiten(vor).map((z) => {
      const sp = vor.filter((s) => s.zeit === z);
      return sp.map((s, i) => {
        const e = s.ergebnis;
        return `<tr class="${i === 0 ? 'neu' : ''}">${i === 0 ? `<td class="zeit" rowspan="${sp.length}">${uhr(z)}</td>` : ''}
        <td class="c">${s.feld}</td><td class="c">${s.nr}</td><td class="c">${h(s.titel.replace('Gruppe ', ''))}</td>
        <td${e && e[0] > e[1] ? ' class="sieger"' : ''}>${h(name(s.heim))}</td><td${e && e[1] > e[0] ? ' class="sieger"' : ''}>${h(name(s.gast))}</td>
        <td class="erg">${box(e && e[0], e && e[0] > e[1])}:${box(e && e[1], e && e[1] > e[0])}</td><td class="klein">${schiri(s)}</td></tr>`;
      }).join('');
    }).join('');
    return `<section>${kopf('Vorrunde – Spielplan', '1 Satz auf 25')}
    <table class="plan vr"><thead><tr><th>Zeit</th><th>Feld</th><th>Spiel</th><th>Gr.</th><th>Heim</th><th>Gast</th><th>Ergebnis</th><th>Schiedsgericht</th></tr></thead>
    <tbody>${zeilen}</tbody></table></section>`;
  };

  // ---- Gruppentabellen (Kreuztabellen, Teams in fester Reihenfolge, Platz sobald die Gruppe fertig ist)
  seiten.tabellen = () => {
    const kreuz = (g) => {
      const t = d.tabellen[g];
      const ids = t.zeilen.map((z) => z.id).sort();
      const zeile = (id) => t.zeilen.find((z) => z.id === id);
      const spiel = (a, b) => vor.find((s) => (s.heim === a && s.gast === b) || (s.heim === b && s.gast === a));
      const feld = (a, b) => {
        const s = spiel(a, b), e = s.ergebnis;
        const pa = e ? (s.heim === a ? e[0] : e[1]) : null, pb = e ? (s.heim === a ? e[1] : e[0]) : null;
        return `<td class="feld${e ? (pa > pb ? ' gew' : ' verl') : ''}"><span class="spnr">Sp. ${s.nr}</span><span class="doppel">${box(pa, e && pa > pb)}:${box(pb)}</span></td>`;
      };
      return `<h2>Gruppe ${g}${t.komplett ? ' <small>– abgeschlossen</small>' : ''}</h2><table class="kreuz"><thead><tr><th class="tm"></th>${ids.map((id, i) => `<th class="sp">${i + 1}</th>`).join('')}<th>Siege</th><th>Bälle</th><th>Diff.</th><th>Platz</th></tr></thead><tbody>
      ${ids.map((a, i) => {
        const z = zeile(a), gespielt = z && z.sp > 0;
        return `<tr><th class="tm"><span class="nr">${i + 1}</span>${h(name(a))}</th>${ids.map((b) => a === b ? '<td class="leer"></td>' : feld(a, b)).join('')}
        <td class="wert">${gespielt ? z.s : ''}</td><td class="wert baelle">${gespielt ? z.bp + ':' + z.bm : ':'}</td>
        <td class="wert">${gespielt ? (z.bp - z.bm > 0 ? '+' : '') + (z.bp - z.bm) : ''}</td><td class="wert platz">${t.komplett ? z.platz + '.' : ''}</td></tr>`;
      }).join('')}</tbody></table>`;
    };
    return `<section>${kopf('Gruppentabellen')}${gruppen.map(kreuz).join('')}
    <p class="hinweis">Je Zeile die eigenen Punkte links, die des Gegners rechts. Reihung: Siege, direkter Vergleich, Ballpunkt-Differenz.</p></section>`;
  };

  // ---- Playoff: je Spiel zwei Zeilen (Heim oben, Gast unten), pro Satz ein Kästchen je Team, dazu gewonnene Sätze
  seiten.playoff = () => {
    const gs = (s) => (s.gewinnsaetze || 1) > 1;
    const saetze = (s, k) => {
      const sieg = s.ergebnis && s.ergebnis[k] > s.ergebnis[1 - k];
      if (!gs(s)) {
        const e = s.ergebnis;
        return `<td class="b">${box(e && e[k], sieg)}</td><td class="b x"></td><td class="b x"></td><td class="b s">${box(e ? (sieg ? 1 : 0) : null, sieg)}</td>`;
      }
      const sa = s.saetze || [];
      return [0, 1, 2].map((i) => `<td class="b">${box(sa[i] ? sa[i][k] : null, sa[i] && sa[i][k] > sa[i][1 - k])}</td>`).join('')
        + `<td class="b s">${box(s.ergebnis ? s.ergebnis[k] : null, sieg)}</td>`;
    };
    const zeilen = zeiten(ko).map((z) => {
      const sp = ko.filter((s) => s.zeit === z);
      return sp.map((s, i) => `<tr class="${i === 0 ? 'neu' : 'spiel'}">${i === 0 ? `<td class="zeit" rowspan="${sp.length * 2}">${uhr(z)}</td>` : ''}
        <td class="c" rowspan="2">${s.feld || ''}</td><td class="c" rowspan="2">${s.nr}</td><td class="titel" rowspan="2">${h(s.titel).replace(/Platz (\d)/g, 'Platz&nbsp;$1')}</td>
        <td class="team">${teil(s.heim, s.heimText)}</td>${saetze(s, 0)}<td class="klein team" rowspan="2">${schiri(s)}</td></tr>
        <tr class="gast"><td class="team">${teil(s.gast, s.gastText)}</td>${saetze(s, 1)}</tr>`).join('');
    }).join('');
    const n = Object.keys(d.teams).length, haelfte = Math.ceil(n / 2);
    const platz = (p) => { const e = d.endstand.find((x) => x.platz === p); return e ? h(name(e.team)) : ''; };
    return `<section>${kopf('Playoff – Spielplan', d.modus && d.modus.includes('KO') ? 'alle Spiele 2 Gewinnsätze (3. Satz auf 15)' : '')}
    <table class="plan ko"><colgroup><col style="width:12mm"><col style="width:10mm"><col style="width:11mm"><col style="width:24mm"><col><col style="width:13mm"><col style="width:13mm"><col style="width:13mm"><col style="width:14mm"><col style="width:34mm"></colgroup>
    <thead><tr><th>Zeit</th><th>Feld</th><th>Spiel</th><th>Runde</th><th>Teams</th><th>1. Satz</th><th>2. Satz</th><th>3. Satz</th><th>Sätze</th><th>Schiedsgericht</th></tr></thead>
    <tbody>${zeilen}</tbody></table>
    <h2>Endstand</h2>
    <table class="end"><colgroup><col style="width:12mm"><col><col style="width:12mm"><col></colgroup><tbody>${Array.from({ length: haelfte }, (_, i) => `<tr><td class="c">${i + 1}.</td><td>${platz(i + 1)}</td><td class="c">${i + 1 + haelfte}.</td><td>${platz(i + 1 + haelfte)}</td></tr>`).join('')}</tbody></table>
    </section>`;
  };

  const titel = teile.length === 1 ? `${d.name} – ${TEILE[teile[0]]}` : `${d.name} – Druck`;
  return `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${h(titel)}</title><style>
@page{size:A4;margin:12mm 12mm 12mm}
*{box-sizing:border-box}html{-webkit-print-color-adjust:exact;print-color-adjust:exact}
body{margin:0;font-family:"Segoe UI",Arial,sans-serif;font-size:10.5pt;color:#000;background:#fff}
section{page-break-after:always}section:last-child{page-break-after:auto}
header{display:flex;align-items:center;gap:14px;padding-bottom:8px;margin-bottom:10px;border-bottom:2px solid #000}
.logo{flex:none;width:150px;height:36px;background:#000;-webkit-mask:url(${logo}) left center/contain no-repeat;mask:url(${logo}) left center/contain no-repeat}
header .t{font-size:17pt;font-weight:800;line-height:1.1}header .u{font-size:9.5pt;color:#333}
h2{font-size:13pt;margin:14px 0 6px}h2 small{font-size:9pt;font-weight:600;color:#444}
table{width:100%;border-collapse:collapse}
th,td{border:1px solid #000;padding:4px 6px;vertical-align:middle}
thead th{background:#f0f0f0;font-size:8.5pt;text-transform:uppercase;letter-spacing:.03em;text-align:left}
.c{text-align:center}.zeit{font-weight:800;text-align:center;width:13mm}
tr.neu td{border-top:2px solid #000}
.sieger{font-weight:800}
.box{display:inline-flex;align-items:center;justify-content:center;width:8.5mm;height:6.5mm;border:1px solid #555;border-radius:2px;vertical-align:middle;margin:0 3px;background:#fff;font-size:10pt;font-variant-numeric:tabular-nums}
.box.fett{font-weight:800;border:2px solid #000}
.plan td{height:8.4mm}.vr td{height:12.4mm}.vr td.erg .box{height:7.5mm;width:9.5mm}
.ko td{height:9.5mm}.ko{table-layout:fixed}.ko tr.gast td{border-top:1px dashed #888}.ko tr.spiel td{border-top:1.5px solid #000}
.ko td.b{text-align:center;padding:2px}.ko td.x{background:repeating-linear-gradient(45deg,#ccc 0 1px,#fff 1px 6px)}.ko .linie{height:4mm}
.erg{white-space:nowrap;text-align:center;width:24mm}.ko .box{width:8mm;height:6.5mm;margin:0}.ko td.team{font-size:9.5pt}
.klein{font-size:8.5pt}.titel{font-size:8.5pt;font-weight:700;width:24mm}
.team{line-height:1.15}.platzhalter{display:block;font-size:7.5pt;color:#444;font-style:italic}.linie{display:block;border-bottom:1px solid #777;height:5mm}
.hinweis{font-size:8.5pt;color:#333;margin:6px 0 0}
.kreuz th.tm{text-align:left;width:52mm;white-space:nowrap;background:#fff;font-size:9.5pt}.kreuz .nr{display:inline-block;width:5mm;font-weight:800}
.kreuz th.sp{text-align:center;width:20mm}.kreuz td{height:15mm;text-align:center}
.kreuz td.leer{background:repeating-linear-gradient(45deg,#c8c8c8 0 1px,#fff 1px 8px)}
.kreuz td.feld{position:relative;padding-top:10px}.spnr{position:absolute;top:2px;left:4px;font-size:6.5pt;color:#555}
.doppel{display:inline-flex;align-items:center;gap:2px}.doppel .box{width:7.5mm;margin:0}
.wert{font-weight:700;font-variant-numeric:tabular-nums}.baelle{white-space:nowrap}.platz{font-size:12pt;font-weight:800}
.end{table-layout:fixed}.end td{height:9mm;font-weight:700}.end td.c{width:12mm;font-weight:800}
.leiste{display:flex;flex-wrap:wrap;align-items:center;gap:10px;margin:0 0 16px;padding:12px 16px;border-radius:10px;background:#eef3f9;font-size:10pt}
.leiste button{font:inherit;font-weight:700;padding:8px 16px;border-radius:999px;border:0;background:#002266;color:#fff;cursor:pointer}
@media screen{body{max-width:210mm;margin:16px auto;padding:0 12px}section{margin-bottom:40px}}
@media print{.leiste{display:none}}
</style></head><body>
${knopf ? '<div class="leiste"><button onclick="print()">Drucken / als PDF speichern</button><span>Im Druckdialog als Ziel „Als PDF speichern“ wählen, um eine Datei zu bekommen.</span></div>' : ''}
${teile.map((t) => seiten[t]()).join('')}
${knopf ? '<script>addEventListener("load",function(){setTimeout(function(){print()},400)})</script>' : ''}
</body></html>`;
}
