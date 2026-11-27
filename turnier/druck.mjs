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
  if (gruppen.length === 1) teile = teile.filter((t) => t !== 'playoff');   // eine Gruppe: Finale steht im Spielplan
  const vor = d.spiele.filter((s) => s.phase === 'gruppe');
  const ko = d.spiele.filter((s) => s.phase !== 'gruppe').sort((a, b) => a.zeit.localeCompare(b.zeit) || (a.feld || 9) - (b.feld || 9));
  const zeiten = (liste) => [...new Set(liste.map((s) => s.zeit))];
  const teil = (id, text) => id ? `<b>${h(name(id))}</b>` : `<span class="platzhalter">${h(text)}</span><span class="linie"></span>`;
  const schiri = (s) => s.schiri ? h(name(s.schiri)) : s.schiriText === 'offen' ? '<span class="linie"></span>' : `<span class="platzhalter">${h(s.schiriText)}</span><span class="linie"></span>`;
  const seiten = {};
  const mehr = gruppen.length > 1;

  // ---- Vorrunde
  seiten.vorrunde = () => {
    const liste = mehr ? vor : [...vor, ...ko];
    const zeilen = zeiten(liste).map((z) => {
      const sp = liste.filter((s) => s.zeit === z);
      const pause = d.pause && !d.pause.text && sp[0].runde === d.pause.nach
        ? `<tr class="neu pause"><td class="zeit">${uhr(d.pause.von)}</td><td colspan="${mehr ? 7 : 6}">Mittagspause bis ${h(d.pause.bis)} Uhr</td></tr>` : '';
      return '<tbody>' + sp.map((s, i) => {
        const e = s.ergebnis;
        return `<tr class="${i === 0 ? 'neu' : ''}">${i === 0 ? `<td class="zeit" rowspan="${sp.length}">${uhr(z)}</td>` : ''}
        <td class="c">${s.feld}</td><td class="c">${s.nr}${s.phase !== 'gruppe' ? `<small class="rd">${h(s.titel)}</small>` : ''}</td>${mehr ? `<td class="c">${h(s.titel.replace('Gruppe ', ''))}</td>` : ''}
        <td class="t1${e && e[0] > e[1] ? ' sieger' : ''}">${s.heim ? h(name(s.heim)) : teil(null, s.heimText)}</td>
        <td class="erg">${box(e && e[0], e && e[0] > e[1])}:${box(e && e[1], e && e[1] > e[0])}</td>
        <td class="t2${e && e[1] > e[0] ? ' sieger' : ''}">${s.gast ? h(name(s.gast)) : teil(null, s.gastText)}</td><td class="klein sr">${schiri(s)}</td></tr>`;
      }).join('') + '</tbody>' + (pause ? '<tbody>' + pause + '</tbody>' : '');
    }).join('');
    return `<section>${kopf(mehr ? 'Vorrunde – Spielplan' : 'Spielplan', '1 Satz auf 25')}
    <table class="plan vr"><thead><tr><th>Zeit</th><th>Feld</th><th>Spiel</th>${mehr ? '<th>Gr.</th>' : ''}<th class="t1">Team 1</th><th class="erg">Ergebnis</th><th>Team 2</th><th class="sr">Schiedsgericht</th></tr></thead>
    ${zeilen}</table></section>`;
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
        return `<td class="feld${e ? (pa > pb ? ' gew' : ' verl') : ''}"><span class="spnr">Sp. ${s.nr}</span><span class="doppel"><span class="z${e && pa > pb ? ' fett' : ''}">${pa ?? ''}</span>:<span class="z${e && pb > pa ? ' fett' : ''}">${pb ?? ''}</span></span></td>`;
      };
      return `${mehr ? `<h2>Gruppe ${g}${t.komplett ? ' <small>– abgeschlossen</small>' : ''}</h2>` : t.komplett ? '<h2><small>abgeschlossen</small></h2>' : ''}<table class="kreuz"><colgroup><col style="width:46mm">${ids.map(() => '<col>').join('')}<col style="width:16mm"><col style="width:16mm"><col style="width:16mm"></colgroup><thead><tr><th class="tm"></th>${ids.map((id, i) => `<th class="sp">${i + 1}</th>`).join('')}<th class="aus">Siege</th><th>Diff.</th><th>Platz</th></tr></thead><tbody>
      ${ids.map((a, i) => {
        const z = zeile(a), gespielt = z && z.sp > 0;
        return `<tr><th class="tm"><span class="nr">${i + 1}</span>${h(name(a))}</th>${ids.map((b) => a === b ? '<td class="leer"></td>' : feld(a, b)).join('')}
        <td class="wert aus">${gespielt ? z.s : ''}</td>        <td class="wert">${gespielt ? (z.bp - z.bm > 0 ? '+' : '') + (z.bp - z.bm) : ''}</td><td class="wert platz">${t.komplett ? z.platz + '.' : ''}</td></tr>`;
      }).join('')}</tbody></table>`;
    };
    return `<section class="quer">${kopf(mehr ? 'Gruppentabellen' : 'Tabelle')}${gruppen.map(kreuz).join('')}</section>`;
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
      return '<tbody>' + sp.map((s, i) => `<tr class="${i === 0 ? 'neu' : 'spiel'}">${i === 0 ? `<td class="zeit" rowspan="${sp.length * 2}">${uhr(z)}</td>` : ''}
        <td class="c" rowspan="2">${s.feld || ''}</td><td class="c" rowspan="2">${s.nr}</td><td class="titel" rowspan="2">${h(s.titel).replace(/Platz (\d)/g, 'Platz&nbsp;$1')}</td>
        <td class="team">${teil(s.heim, s.heimText)}</td>${saetze(s, 0)}<td class="klein team" rowspan="2">${schiri(s)}</td></tr>
        <tr class="gast"><td class="team">${teil(s.gast, s.gastText)}</td>${saetze(s, 1)}</tr>`).join('') + '</tbody>';
    }).join('');
    const n = Object.keys(d.teams).length, haelfte = Math.ceil(n / 2);
    const platz = (p) => { const e = d.endstand.find((x) => x.platz === p); return e ? h(name(e.team)) : ''; };
    return `<section>${kopf(ko.length === 1 ? ko[0].titel : 'Playoff – Spielplan', d.modus && d.modus.includes('KO') ? 'alle Spiele 2 Gewinnsätze (3. Satz auf 15)' : '')}
    <table class="plan ko"><colgroup><col style="width:12mm"><col style="width:10mm"><col style="width:11mm"><col style="width:24mm"><col><col style="width:13mm"><col style="width:13mm"><col style="width:13mm"><col style="width:14mm"><col style="width:34mm"></colgroup>
    <thead><tr><th>Zeit</th><th>Feld</th><th>Spiel</th><th>Runde</th><th>Teams</th><th>1. Satz</th><th>2. Satz</th><th>3. Satz</th><th>Sätze</th><th>Schiedsgericht</th></tr></thead>
    ${zeilen}</table>
    <h2>Endstand</h2>
    <table class="end"><colgroup><col style="width:12mm"><col><col style="width:12mm"><col></colgroup><tbody>${Array.from({ length: haelfte }, (_, i) => `<tr><td class="c">${i + 1}.</td><td>${platz(i + 1)}</td>${i + 1 + haelfte <= n ? `<td class="c">${i + 1 + haelfte}.</td><td>${platz(i + 1 + haelfte)}</td>` : '<td class="leer" colspan="2"></td>'}</tr>`).join('')}</tbody></table>
    </section>`;
  };

  const titel = teile.length === 1 ? `${d.name} – ${TEILE[teile[0]]}` : `${d.name} – Druck`;
  return `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${h(titel)}</title><style>
@page{size:A4;margin:12mm 12mm 12mm}@page quer{size:A4 landscape;margin:12mm}section.quer{page:quer}.plan tbody{break-inside:avoid;page-break-inside:avoid}.quer .kreuz td{height:16mm}
*{box-sizing:border-box}html{-webkit-print-color-adjust:exact;print-color-adjust:exact}
body{margin:0;font-family:"Segoe UI",Arial,sans-serif;font-size:10.5pt;color:#000;background:#fff}
section+section{break-before:page;page-break-before:always}
section{padding:0 2px}   /* Tabellenränder ragen sonst rechts minimal aus dem Druckbereich */
header{display:flex;align-items:center;gap:14px;padding-bottom:8px;margin-bottom:10px;border-bottom:2px solid #000}
.logo{flex:none;width:150px;height:36px;background:#000;-webkit-mask:url(${logo}) left center/contain no-repeat;mask:url(${logo}) left center/contain no-repeat}
header .t{font-size:17pt;font-weight:800;line-height:1.1}header .u{font-size:9.5pt;color:#333}
h2{font-size:13pt;margin:14px 0 6px}h2 small{font-size:9pt;font-weight:600;color:#444}
table{width:100%;border-collapse:collapse}
th,td{border:1px solid #000;padding:4px 6px;vertical-align:middle}
thead th{background:#ddd;font-size:8.5pt;text-transform:uppercase;letter-spacing:.03em;text-align:left}
.c{text-align:center}.zeit{font-weight:800;text-align:center;width:13mm}
tr.neu td{border-top:2px solid #000}
.sieger{font-weight:800}
.box{display:inline-flex;align-items:center;justify-content:center;width:8.5mm;height:6.5mm;vertical-align:middle;margin:0 3px;font-size:11pt;font-variant-numeric:tabular-nums}
.box.fett{font-weight:800}
.plan td{height:8.4mm}.vr td{height:12mm}.vr td.erg .box{height:7.5mm;width:9.5mm}
.ko td{height:9.5mm}.ko{table-layout:fixed}.ko tr.gast td{border-top:1px dotted #aaa}.ko tr.spiel td{border-top:2.5px solid #000}.ko tr.neu td{border-top:2.5px solid #000}
.ko td.b{text-align:center;padding:2px}.ko td.x{background:repeating-linear-gradient(45deg,#ccc 0 1px,#fff 1px 6px)}.ko .linie{height:4mm}
.erg{white-space:nowrap;text-align:center;width:24mm}.ko .box{width:8mm;height:6.5mm;margin:0}.ko td.team{font-size:9.5pt}
.vr tr.pause td{height:7mm;text-align:center;font-weight:700;background:#eee}.vr tr.pause td.zeit{text-align:center}.end td.leer{border:0}
.klein{font-size:8.5pt}.titel{font-size:8.5pt;font-weight:700;width:24mm}
.team{line-height:1.15}.platzhalter{display:block;font-size:7.5pt;color:#444;font-style:italic}.linie{display:block;height:5mm}
.hinweis{font-size:8.5pt;color:#333;margin:6px 0 0}
.kreuz{table-layout:fixed}.kreuz th.tm{text-align:left;white-space:nowrap;overflow:hidden;background:#fff;font-size:9.5pt}.kreuz .nr{display:inline-block;width:5mm;font-weight:800}
.kreuz th.sp{text-align:center}.kreuz thead th{padding:4px 2px;text-align:center}.kreuz td{height:15mm;text-align:center}
.kreuz td.leer{background:#ccc}
.kreuz td.feld{position:relative;padding:10px 0 2px}.kreuz thead th{border-bottom:2.5px solid #000}.kreuz th.tm{border-right:2.5px solid #000}.kreuz .aus{border-left:2.5px solid #000}
.vr .t1{text-align:right}.vr th.erg{text-align:center}.vr .sr{border-left:3px solid #000}.vr td.sr{padding-left:8px}
.vr .rd{display:block;font-size:7pt;font-weight:700;text-transform:uppercase}.spnr{position:absolute;top:2px;left:4px;font-size:6.5pt;color:#555}
.doppel{display:inline-flex;align-items:center;gap:2px;font-size:11pt}.doppel .z{display:inline-block;width:6.5mm;font-variant-numeric:tabular-nums}.doppel .z:first-child{text-align:right}.doppel .z:last-child{text-align:left}.doppel .z.fett{font-weight:800}
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
