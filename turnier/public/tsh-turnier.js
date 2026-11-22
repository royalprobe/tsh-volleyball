/*
 * U14-Turnier der TS Hohenems – Widget für die (versteckte) Jimdo-Seite „U14-Turnier“:
 *
 *   <div id="tsh-turnier"></div>
 *   <script src="https://<server>/tsh-turnier.js" defer></script>
 *
 * Spielplan (14 Runden, 3 Felder), Gruppentabellen, Endrunde und Endstand. Ergebnisse trägt ein, wer die PIN kennt;
 * alle offenen Seiten aktualisieren sich sofort (Server-Sent Events). Daten und Logik: server.mjs / plan.mjs.
 * Shadow DOM wie beim Volleyball-Widget: Jimdo-Stile greifen nicht hinein, die Schrift wird übernommen.
 */
(function () {
  'use strict';
  var skript = document.currentScript;
  var BASIS = skript ? skript.src.replace(/[^/]*(\?.*)?$/, '') : './';
  var SPEICHER = 'tsh-turnier-pin';
  var TAGE = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
  var MONATE = ['Jänner', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];

  var CSS = [
    ':host{all:initial;display:block;font-family:inherit;color:#1e293b;--blau:#002266;--blau-2:#0b3f8f;--akzent:#6592a7;--hell:#eef3f9;--flaeche:#f1f5f9;--rand:#e1e7ef;--grau:#64748b;--grau-2:#94a3b8;--gruen:#16803c;--rot:#c81e1e;--gold:#d4a017;--r:14px}',
    '*{box-sizing:border-box}',
    '.w{container-type:inline-size;display:flex;flex-direction:column;gap:22px;font-size:15px;line-height:1.5}',
    'button,input{font:inherit;color:inherit}button{background:none;border:0;padding:0;cursor:pointer}',
    'a{color:inherit}',
    '.schatten{box-shadow:0 1px 2px rgba(0,34,102,.06),0 6px 16px rgba(0,34,102,.06)}',
    // Kopf
    '.hero{position:relative;overflow:hidden;display:grid;grid-template-columns:1.3fr 1fr;gap:24px;align-items:center;padding:32px 34px;border-radius:calc(var(--r) + 6px);color:#fff;background:radial-gradient(120% 140% at 0% 0%,#123f8c 0%,var(--blau) 55%,#00133d 100%)}',
    '.zeichen{position:absolute;right:-20px;top:50%;width:300px;aspect-ratio:1;transform:translateY(-50%) rotate(-8deg);background:#fff;opacity:.1;pointer-events:none;-webkit-mask:var(--zeichen) center/contain no-repeat;mask:var(--zeichen) center/contain no-repeat}',
    '.h-links{position:relative;display:flex;flex-direction:column;gap:12px;min-width:0}',
    '.logo{display:block;width:min(100%,360px);aspect-ratio:640/115;background:#fff;-webkit-mask:var(--logo) left center/contain no-repeat;mask:var(--logo) left center/contain no-repeat}',
    '.h-titel{font-size:2.2em;font-weight:800;line-height:1.05;letter-spacing:-.01em}',
    '.h-info{display:flex;flex-wrap:wrap;gap:6px}',
    '.chip{padding:3px 11px;border-radius:999px;background:rgba(255,255,255,.13);font-size:.8em;font-weight:700}',
    '.jetzt{position:relative;z-index:1;display:flex;flex-direction:column;gap:8px;padding:16px 18px;border-radius:var(--r);background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.16)}',
    '.jetzt .t{font-size:.72em;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:rgba(255,255,255,.7)}',
    '.jetzt .z{font-size:1.4em;font-weight:800;line-height:1.1}',
    '.jetzt ul{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:5px;font-size:.86em}',
    '.jetzt li{display:grid;grid-template-columns:3.6em 1fr auto;gap:8px;align-items:baseline}',
    '.jetzt li small{color:rgba(255,255,255,.6);font-weight:700}',
    '.jetzt li b{font-weight:800}',
    // Abschnitte
    '.abschnitt{display:flex;flex-direction:column;gap:14px;padding:26px 28px 28px;border-radius:calc(var(--r) + 6px);background:var(--flaeche);scroll-margin-top:90px}',
    '.a-kopf{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:8px 16px}',
    '.a-kopf .t{font-size:1.75em;font-weight:800;line-height:1.1;color:var(--blau)}',
    'select{font:inherit;font-weight:600;padding:7px 34px 7px 14px;border-radius:999px;border:1px solid #d6dee8;background:#fff url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'8\'%3E%3Cpath d=\'M1 1l5 5 5-5\' fill=\'none\' stroke=\'%23002266\' stroke-width=\'2\'/%3E%3C/svg%3E") no-repeat right 13px center;appearance:none;color:var(--blau);cursor:pointer}',
    // Spielplan
    '.runden{display:flex;flex-direction:column;gap:10px}',
    '.runde{display:grid;grid-template-columns:5.2em 1fr;gap:10px;align-items:stretch}',
    '.r-zeit{display:flex;flex-direction:column;align-items:center;justify-content:center;border-radius:12px;background:#fff;color:var(--blau);font-weight:800;line-height:1.15}',
    '.r-zeit small{font-size:.7em;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--grau-2)}',
    '.runde.aktiv .r-zeit{background:var(--blau);color:#fff}.runde.aktiv .r-zeit small{color:rgba(255,255,255,.7)}',
    '.felder{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}',
    '.spiel{position:relative;display:flex;flex-direction:column;gap:4px;padding:10px 12px;border-radius:12px;background:#fff;text-align:left;border:2px solid transparent;min-width:0}',
    '.spiel.kann{cursor:pointer}.spiel.kann:hover{border-color:var(--akzent)}',
    // „Mein Team“: eigene Spiele blau gefüllt, Schiri-Einsätze nur blau umrandet, alles andere tritt zurück
    '.spiel.spielt{background:#dbe7f8;border-color:var(--blau)}',
    '.spiel.pfeift{background:#fff;border-color:var(--blau)}',
    '.spiel.pfeift .s-schiri{color:var(--blau);font-weight:800}',
    '.spiel.anders{opacity:.45}',
    '.s-team .ich{color:var(--blau);font-weight:800}',
    '.marke{align-self:flex-start;margin-top:2px;padding:1px 8px;border-radius:999px;font-size:.66em;font-weight:800;letter-spacing:.06em;text-transform:uppercase}',
    '.spielt .marke{background:var(--blau);color:#fff}.pfeift .marke{background:#fff;color:var(--blau);box-shadow:inset 0 0 0 1.5px var(--blau)}',
    '.legende{display:flex;flex-wrap:wrap;gap:6px 14px;font-size:.8em;color:var(--grau)}.legende i{display:inline-block;width:12px;height:12px;border-radius:3px;margin-right:6px;vertical-align:-1px}',
    '.s-kopf{display:flex;justify-content:space-between;gap:6px;font-size:.68em;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--grau-2)}',
    '.s-kopf .ph{color:var(--akzent)}',
    '.s-team{display:flex;justify-content:space-between;align-items:baseline;gap:8px;font-weight:600;line-height:1.25}',
    '.s-team span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '.s-team b{font-size:1.1em;font-variant-numeric:tabular-nums}',
    '.s-team.sieger{color:var(--blau);font-weight:800}.s-team.verlierer{color:var(--grau)}',
    '.s-team .offen{color:var(--grau-2);font-weight:500;font-style:italic}',
    '.s-schiri{margin-top:2px;font-size:.72em;color:var(--grau)}',
    // Tabellen
    '.gruppen{display:grid;grid-template-columns:1fr 1fr;gap:12px}',
    '.kachel{min-width:0;padding:16px 18px;background:#fff;border-radius:var(--r)}',
    '.k-kopf{display:flex;justify-content:space-between;gap:10px;margin:0 0 8px;padding-bottom:8px;border-bottom:1px solid var(--rand);font-size:.74em;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:var(--blau)}',
    '.k-kopf span{color:var(--grau-2);letter-spacing:.04em}',
    'table{width:100%;border-collapse:collapse;font-size:.9em;font-variant-numeric:tabular-nums}',
    'th{padding:4px 6px;text-align:right;font-size:.72em;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:var(--grau-2)}',
    'td{padding:7px 6px;text-align:right;border-top:1px solid var(--rand)}',
    '.tm{text-align:left;width:100%;font-weight:600}td.pl{color:var(--grau-2)}td.pk{font-weight:800}',
    'tr.mein td{background:var(--hell)}tr.mein .tm{color:var(--blau);font-weight:800}',
    // Endstand
    '.end{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}',
    '.end li{display:flex;align-items:center;gap:12px;padding:12px 14px;border-radius:12px;background:#fff;font-weight:700}',
    '.end li b{flex:none;width:2.2em;height:2.2em;display:grid;place-items:center;border-radius:50%;background:var(--hell);color:var(--blau);font-weight:800}',
    '.end li.p1 b{background:var(--gold);color:#fff}.end li.p2 b{background:#9ca3af;color:#fff}.end li.p3 b{background:#b0703a;color:#fff}',
    // Eintragen
    '.fuss{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:8px;font-size:.78em;color:var(--grau-2)}',
    '.knopf{display:inline-flex;align-items:center;gap:8px;padding:8px 16px;border-radius:999px;font-weight:700;font-size:.9em;border:1px solid #d6dee8;background:#fff;color:var(--blau)}',
    '.knopf.voll{background:var(--blau);border-color:var(--blau);color:#fff}',
    '.knopf.klein{padding:5px 12px;font-size:.8em}',
    '.leiste{display:flex;flex-wrap:wrap;align-items:center;gap:8px;padding:12px 16px;border-radius:var(--r);background:#e7f6ec;color:var(--gruen);font-weight:700;font-size:.88em}',
    '.dialog{position:fixed;inset:0;z-index:2147483000;display:grid;place-items:center;padding:16px;background:rgba(0,19,61,.55)}',
    '.box{width:min(100%,400px);padding:26px 24px 22px;border-radius:calc(var(--r) + 6px);background:#fff;box-shadow:0 24px 60px rgba(0,19,61,.35)}',
    '.box form{display:flex;flex-direction:column;gap:16px}',
    '.box .kopf{display:flex;flex-direction:column;gap:4px}',
    '.box .icon{width:44px;height:44px;display:grid;place-items:center;border-radius:12px;background:var(--hell);color:var(--blau);margin-bottom:6px}.box .icon svg{width:22px;height:22px}',
    '.box .zeile .knopf{flex:1;justify-content:center;padding:11px 16px}',
    'input.pin{letter-spacing:.5em;font-size:1.6em;padding:12px;text-indent:.5em}',
    '.hinweis{font-size:.78em;color:var(--grau-2)}',
    '.fehler:empty{display:none}',
    '.box input.name{font-size:1em;text-align:left;font-weight:600}',
    '.dialog.breit .box{width:min(100%,640px)}',
    '.protokoll{list-style:none;margin:0;padding:0;max-height:60vh;overflow:auto;display:flex;flex-direction:column}',
    '.protokoll li{display:grid;grid-template-columns:5.6em 8em 1fr;gap:4px 10px;padding:8px 0;border-top:1px solid var(--rand);font-size:.84em;line-height:1.35}',
    '.p-zeit{color:var(--grau);font-variant-numeric:tabular-nums}.p-wer{font-weight:700}.p-wer small{font-weight:400;color:var(--grau-2)}.rot{color:var(--rot)}',
    '@media (max-width:540px){.protokoll li{grid-template-columns:5.6em 1fr}.p-was{grid-column:1/-1}}',
    '.box .t{font-size:1.2em;font-weight:800;color:var(--blau)}',
    '.box small{color:var(--grau)}',
    '.eingabe{display:grid;grid-template-columns:1fr 4.5em;gap:8px 12px;align-items:center;font-weight:700}',
    '.box input{width:100%;padding:10px 12px;border:1px solid #cfd8e3;border-radius:10px;font-size:1.1em;font-weight:700;text-align:center}',
    '.box input:focus{outline:2px solid var(--akzent);border-color:transparent}',
    '.teams-form{display:grid;grid-template-columns:1fr 1fr;gap:6px 12px;max-height:60vh;overflow:auto}',
    '.teams-form label{display:flex;flex-direction:column;gap:2px;font-size:.75em;font-weight:700;color:var(--grau)}',
    '.teams-form input{font-size:.95em;text-align:left;padding:7px 10px}',
    '.zeile{display:flex;justify-content:flex-end;gap:8px;flex-wrap:wrap}',
    '.fehler{color:var(--rot);font-weight:700;font-size:.88em}',
    '@container (max-width:860px){.hero{grid-template-columns:1fr;padding:26px 22px}.felder{grid-template-columns:1fr}.runde{grid-template-columns:4.4em 1fr}.end{grid-template-columns:1fr 1fr}}',
    '@container (max-width:640px){.gruppen{grid-template-columns:1fr}}',
    '@container (max-width:540px){.w{font-size:14px;gap:16px}.abschnitt{padding:20px 14px}.h-titel{font-size:1.8em}.zeichen{width:220px;right:-60px}.end{grid-template-columns:1fr}.runde{grid-template-columns:1fr}.r-zeit{flex-direction:row;gap:8px;justify-content:flex-start;padding:6px 12px;background:transparent}.runde.aktiv .r-zeit{background:var(--blau)}}'
  ].join('\n');

  var host, wurzel, daten = null, mein = '', pin = '';
  try { pin = sessionStorage.getItem(SPEICHER) || localStorage.getItem(SPEICHER) || ''; } catch (e) {}
  try { mein = localStorage.getItem('tsh-turnier-team') || ''; } catch (e) {}

  function h(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function name(id) { return id ? (daten.teams[id] || id) : ''; }
  function heute() { var d = new Date(); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  function minuten(z) { var p = z.split(':'); return +p[0] * 60 + +p[1]; }
  /** laufende Runde nach der Uhr (nur am Turniertag), sonst die erste Runde ohne alle Ergebnisse */
  function aktiveRunde() {
    if (!daten) return 1;
    if (daten.datum === heute()) {
      var jetzt = new Date().getHours() * 60 + new Date().getMinutes();
      for (var r = 14; r >= 1; r--) {
        var sp = daten.spiele.filter(function (s) { return s.runde === r; })[0];
        if (jetzt >= minuten(sp.zeit)) return r;
      }
      return 1;
    }
    for (var r2 = 1; r2 <= 14; r2++) if (daten.spiele.some(function (s) { return s.runde === r2 && !s.ergebnis; })) return r2;
    return 14;
  }

  function zeichnen() {
    if (!daten) return;
    var akt = aktiveRunde();
    var d = new Date(daten.datum + 'T12:00:00');
    var datum = TAGE[d.getDay()] + ', ' + d.getDate() + '. ' + MONATE[d.getMonth()] + ' ' + d.getFullYear();
    var rundeSp = daten.spiele.filter(function (s) { return s.runde === akt; });
    var teamWahl = '<select data-mein aria-label="Mein Team hervorheben"><option value="">Mein Team …</option>'
      + Object.keys(daten.teams).sort(function (a, b) { return name(a).localeCompare(name(b), 'de'); }).map(function (id) {
        return '<option value="' + h(id) + '"' + (id === mein ? ' selected' : '') + '>' + h(name(id)) + '</option>'; }).join('') + '</select>';
    var html = '<div class="w">'
      + '<header class="hero"><span class="zeichen" aria-hidden="true"></span><div class="h-links">'
      + '<span class="logo" role="img" aria-label="Turnerschaft Hohenems Volleyball"></span>'
      + '<div class="h-titel">' + h(daten.name) + '</div>'
      + '<div class="h-info"><span class="chip">' + h(datum) + '</span><span class="chip">' + h(daten.zeitraum || daten.beginn + '–' + daten.ende + ' Uhr') + '</span>'
      + (daten.ort ? '<span class="chip">' + h(daten.ort) + '</span>' : '') + '<span class="chip">' + h(daten.modus) + '</span><span class="chip">12 Teams · 3 Felder</span></div></div>'
      + '<div class="jetzt"><div class="t">' + (daten.datum === heute() ? 'Jetzt' : 'Als Nächstes') + '</div><div class="z">' + h(rundeSp[0].zeit) + ' Uhr</div><ul>'
      + rundeSp.map(function (s) {
        return '<li><small>' + (s.feld ? 'Feld ' + s.feld : 'Feld offen') + '</small><span>' + h(name(s.heim) || s.heimText) + ' – ' + h(name(s.gast) || s.gastText) + '</span>'
          + (s.ergebnis ? '<b>' + s.ergebnis[0] + ':' + s.ergebnis[1] + '</b>' : '<span></span>') + '</li>'; }).join('')
      + '</ul></div></header>'
      + (pin ? '<div class="leiste">Eintragen ist an – Spiel antippen, um das Ergebnis einzutragen. <button class="knopf klein" data-teams>Teamnamen ändern</button><button class="knopf klein" data-protokoll>Protokoll</button><button class="knopf klein" data-aus>Beenden</button></div>' : '')
      + (daten.endstand.length ? endstandHtml() : '')
      + '<section class="abschnitt"><div class="a-kopf"><div class="t">Spielplan</div>' + teamWahl + '</div>'
      + (mein ? '<div class="legende"><span><i style="background:#dbe7f8;border:2px solid #002266"></i>' + h(name(mein)) + ' spielt</span><span><i style="background:#fff;border:2px solid #002266"></i>' + h(name(mein)) + ' pfeift</span></div>' : '')
      + '<div class="runden">'
      + [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14].map(function (r) { return rundeHtml(r, r === akt); }).join('') + '</div></section>'
      + '<section class="abschnitt"><div class="a-kopf"><div class="t">Gruppen</div></div><div class="gruppen">' + tabelleHtml('A') + tabelleHtml('B') + '</div>'
      + '<p style="margin:0;font-size:.78em;color:var(--grau)">Reihung: Siege, direkter Vergleich, Ballpunkt-Differenz (bei mehreren Teams im Kreis: zuerst aus den Spielen untereinander). Danach Überkreuz: 5. gegen 6., 3. gegen 4., 1. gegen 2. der anderen Gruppe. Die Endrunde wird erst eingetragen, wenn eine Gruppe ganz fertig ist.</p></section>'
      + (pin ? '' : '<div class="fuss"><span></span><button class="knopf klein" data-ein>Ergebnisse eintragen</button></div>')
      + '</div>';
    wurzel.querySelector('.inhalt').innerHTML = html;
  }

  function rundeHtml(r, aktiv) {
    var sp = daten.spiele.filter(function (s) { return s.runde === r; });
    var phase = sp[0].phase === 'gruppe' ? 'Gruppe ' + (r % 2 ? 'A' : 'B') : sp[0].phase === 'kreuz' ? 'Überkreuz' : 'Platzierung';
    return '<div class="runde' + (aktiv ? ' aktiv' : '') + '"><div class="r-zeit">' + h(sp[0].zeit) + '<small>Uhr</small></div><div class="felder">'
      + sp.map(function (s) {
        var spielt = mein && (s.heim === mein || s.gast === mein), pfeift = mein && s.schiri === mein;
        var art = !mein ? '' : spielt ? ' spielt' : pfeift ? ' pfeift' : ' anders';
        var team = function (id, text, i) {
          var cls = s.ergebnis ? ((s.ergebnis[i] > s.ergebnis[1 - i]) ? ' sieger' : ' verlierer') : '';
          return '<div class="s-team' + cls + '"><span' + (id ? (id === mein ? ' class="ich"' : '') : ' class="offen"') + '>' + h(id ? name(id) : text) + '</span>' + (s.ergebnis ? '<b>' + s.ergebnis[i] + '</b>' : '') + '</div>';
        };
        return '<' + (pin ? 'button' : 'div') + ' class="spiel schatten' + (pin ? ' kann' : '') + art + '"' + (pin ? ' data-spiel="' + s.id + '"' : '') + '>'
          + '<div class="s-kopf"><span>' + (s.feld ? 'Feld ' + s.feld + ' · ' : 'Feld offen · ') + 'Spiel ' + s.nr + '</span><span class="ph">' + h(s.phase === 'gruppe' ? '' : s.titel) + '</span></div>'
          + team(s.heim, s.heimText, 0) + team(s.gast, s.gastText, 1)
          + '<div class="s-schiri">Schiedsgericht: ' + h(s.schiri ? name(s.schiri) : s.schiriText) + '</div>'
          + (spielt ? '<span class="marke">Spielt</span>' : pfeift ? '<span class="marke">Pfeift</span>' : '')
          + '</' + (pin ? 'button' : 'div') + '>';
      }).join('') + '</div></div>';
  }

  function tabelleHtml(g) {
    var t = daten.tabellen[g];
    return '<div class="kachel schatten"><div class="k-kopf">Gruppe ' + g + '<span>' + (t.komplett ? 'abgeschlossen' : 'läuft') + '</span></div><table><thead><tr><th></th><th class="tm">Team</th><th>Sp</th><th>S</th><th>N</th><th>Bälle</th></tr></thead><tbody>'
      + t.zeilen.map(function (z) {
        return '<tr' + (z.id === mein ? ' class="mein"' : '') + '><td class="pl">' + z.platz + '</td><td class="tm">' + h(name(z.id)) + '</td><td>' + z.sp + '</td><td class="pk">' + z.s + '</td><td>' + z.n + '</td><td>' + z.bp + ':' + z.bm + '</td></tr>';
      }).join('') + '</tbody></table></div>';
  }

  function endstandHtml() {
    return '<section class="abschnitt"><div class="a-kopf"><div class="t">Endstand</div></div><ol class="end">'
      + daten.endstand.map(function (e) { return '<li class="p' + e.platz + '"><b>' + e.platz + '.</b>' + h(name(e.team)) + '</li>'; }).join('') + '</ol></section>';
  }

  // ------------------------------------------------------------------ Eintragen (mit PIN)
  function dialog(inhalt, fertig) {
    var d = document.createElement('div');
    d.className = 'dialog';
    d.innerHTML = '<div class="box" role="dialog" aria-modal="true">' + inhalt + '</div>';
    wurzel.appendChild(d);
    var zu = function () { d.remove(); };
    d.addEventListener('click', function (e) { if (e.target === d || e.target.hasAttribute('data-zu')) zu(); });
    var f = [].filter.call(d.querySelectorAll('input'), function (i) { return !i.value; })[0] || d.querySelector('input'); if (f) setTimeout(function () { f.focus(); f.select && f.select(); }, 50);
    d.querySelector('form').addEventListener('submit', function (e) { e.preventDefault(); fertig(d, zu); });
    return d;
  }
  // fürs Protokoll: wer einträgt (Name aus der Anmeldung) und eine zufällige Kennung dieses Geräts
  var wer = '', geraet = '';
  try { wer = localStorage.getItem('tsh-turnier-name') || ''; geraet = localStorage.getItem('tsh-turnier-geraet') || ''; } catch (e) {}
  if (!geraet) { geraet = Math.random().toString(36).slice(2, 8); try { localStorage.setItem('tsh-turnier-geraet', geraet); } catch (e) {} }
  function kopf(p) { return { 'Content-Type': 'application/json', 'X-PIN': p, 'X-Name': encodeURIComponent(wer), 'X-Geraet': geraet }; }
  function senden(pfad, body) {
    return fetch(BASIS + 'api/' + pfad, { method: 'POST', headers: kopf(pin), body: JSON.stringify(body || {}) })
      .then(function (a) { return a.json().then(function (j) { if (!a.ok) throw new Error(j.fehler || 'Fehler'); return j; }); });
  }
  function pinFragen() {
    dialog('<form><div class="kopf"><span class="icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg></span>'
      + '<div class="t">Ergebnisse eintragen</div><small>Dein Name (fürs Protokoll) und die PIN der Turnierleitung</small></div>'
      + '<input class="name" type="text" maxlength="40" autocomplete="name" placeholder="Dein Name" aria-label="Dein Name" value="' + h(wer) + '">'
      + '<input class="pin" type="password" inputmode="numeric" maxlength="8" autocomplete="off" placeholder="PIN" aria-label="PIN"><div class="fehler"></div>'
      + '<div class="zeile"><button type="button" class="knopf" data-zu>Abbrechen</button><button class="knopf voll">Anmelden</button></div>'
      + '</form>', function (d, zu) {
      var p = d.querySelector('input.pin').value.trim();
      wer = d.querySelector('input.name').value.trim();
      try { localStorage.setItem('tsh-turnier-name', wer); } catch (e) {}
      fetch(BASIS + 'api/pin', { method: 'POST', headers: kopf(p) }).then(function (a) { return a.json().then(function (j) { if (!a.ok) throw new Error(j.fehler); }); })
        .then(function () { pin = p; try { localStorage.setItem(SPEICHER, p); } catch (e) {} zu(); zeichnen(); })
        .catch(function (e) { d.querySelector('.fehler').textContent = e.message; });
    });
  }
  function ergebnisEintragen(id) {
    var s = daten.spiele.filter(function (x) { return x.id === id; })[0];
    if (!s.heim || !s.gast) {
      dialog('<form><div class="t">Spiel ' + s.nr + '</div><small>Die Teams stehen noch nicht fest (' + h(s.heimText || name(s.heim)) + ' – ' + h(s.gastText || name(s.gast)) + ').</small><div class="zeile"><button class="knopf voll">OK</button></div></form>', function (d, zu) { zu(); });
      return;
    }
    var e = s.ergebnis || ['', ''];
    dialog('<form><div class="kopf"><div class="t">Spiel ' + s.nr + (s.feld ? ' · Feld ' + s.feld : '') + '</div><small>' + h(s.zeit) + ' Uhr · ' + h(s.titel) + ' · 1 Satz auf 25</small></div>'
      + '<div class="eingabe"><span>' + h(name(s.heim)) + '</span><input type="number" inputmode="numeric" min="0" max="60" value="' + e[0] + '" aria-label="Punkte ' + h(name(s.heim)) + '">'
      + '<span>' + h(name(s.gast)) + '</span><input type="number" inputmode="numeric" min="0" max="60" value="' + e[1] + '" aria-label="Punkte ' + h(name(s.gast)) + '"></div><div class="fehler"></div>'
      + '<div class="zeile">' + (s.ergebnis ? '<button type="button" class="knopf" data-loeschen>Löschen</button>' : '') + '<button type="button" class="knopf" data-zu>Abbrechen</button><button class="knopf voll">Speichern</button></div></form>', function (d, zu) {
      var f = d.querySelectorAll('input');
      senden('ergebnis', { spiel: id, ergebnis: [parseInt(f[0].value, 10), parseInt(f[1].value, 10)] })
        .then(function (j) { daten = j; zu(); zeichnen(); })
        .catch(function (x) { d.querySelector('.fehler').textContent = x.message; if (/PIN/.test(x.message)) abmelden(); });
    });
    var l = wurzel.querySelector('[data-loeschen]');
    if (l) l.addEventListener('click', function () {
      senden('ergebnis', { spiel: id, ergebnis: null }).then(function (j) { daten = j; l.closest('.dialog').remove(); zeichnen(); });
    });
  }
  function teamsAendern() {
    var felder = Object.keys(daten.teams).map(function (id) {
      return '<label>' + h(id) + '<input name="' + h(id) + '" value="' + h(daten.teams[id] === 'Team ' + id ? '' : daten.teams[id]) + '" placeholder="Team ' + h(id) + '" maxlength="40"></label>';
    }).join('');
    dialog('<form><div class="t">Teamnamen</div><small>Gruppe A: A1–A6, Gruppe B: B1–B6. Leer = „Team A1“ usw.</small><div class="teams-form">' + felder + '</div><div class="fehler"></div>'
      + '<div class="zeile"><button type="button" class="knopf" data-zu>Abbrechen</button><button class="knopf voll">Speichern</button></div></form>', function (d, zu) {
      var t = {};
      d.querySelectorAll('input').forEach(function (i) { t[i.name] = i.value; });
      senden('teams', { teams: t }).then(function (j) { daten = j; zu(); zeichnen(); }).catch(function (x) { d.querySelector('.fehler').textContent = x.message; });
    });
  }
  function protokollZeigen() {
    senden('protokoll').then(function (j) {
      var heuteText = new Date().toDateString();
      var zeit = function (iso) { var d = new Date(iso); return (d.toDateString() === heuteText ? '' : d.toLocaleDateString('de-AT', { day: '2-digit', month: '2-digit' }) + ' ') + d.toLocaleTimeString('de-AT', { hour: '2-digit', minute: '2-digit', second: '2-digit' }); };
      var erg = function (e) { return e ? e[0] + ':' + e[1] : '–'; };
      var text = function (e) {
        if (e.art === 'anmeldung') return e.ok ? 'angemeldet' : '<b class="rot">falsche PIN</b>';
        if (e.art === 'ergebnis') return 'Spiel ' + h(e.spiel.nr) + ' (' + h(e.spiel.heim) + ' – ' + h(e.spiel.gast) + '): '
          + (!e.vorher ? 'eingetragen <b>' + erg(e.nachher) + '</b>' : !e.nachher ? '<b class="rot">gelöscht</b> (war ' + erg(e.vorher) + ')' : 'geändert ' + erg(e.vorher) + ' → <b>' + erg(e.nachher) + '</b>');
        if (e.art === 'teams') return 'Teamnamen: ' + e.aenderungen.map(function (a) { return h(a.team) + ' „' + h(a.vorher || 'Team ' + a.team) + '“ → „' + h(a.nachher || 'Team ' + a.team) + '“'; }).join(', ');
        return h(e.art);
      };
      var zeilen = j.eintraege.map(function (e) {
        var name = ''; try { name = decodeURIComponent(e.wer || ''); } catch (x) { name = e.wer; }
        return '<li><span class="p-zeit">' + h(zeit(e.zeit)) + '</span><span class="p-wer">' + h(name || 'ohne Name') + ' <small>' + h(e.geraet || '') + '</small></span><span class="p-was">' + text(e) + '</span></li>';
      }).join('');
      dialog('<form><div class="kopf"><div class="t">Protokoll</div><small>Alle Anmeldungen und Änderungen, neueste zuerst</small></div>'
        + (zeilen ? '<ul class="protokoll">' + zeilen + '</ul>' : '<small>Noch keine Einträge.</small>')
        + '<div class="zeile"><button class="knopf voll">Schließen</button></div></form>', function (d, zu) { zu(); }).classList.add('breit');
    }).catch(function (x) { if (/PIN/.test(x.message)) abmelden(); });
  }
  function abmelden() { pin = ''; try { localStorage.removeItem(SPEICHER); } catch (e) {} zeichnen(); }

  // ------------------------------------------------------------------ Laden und live bleiben
  var version = -1;
  function laden() {
    return fetch(BASIS + 'api/stand', { cache: 'no-store' }).then(function (a) { return a.json(); }).then(function (j) { daten = j; version = j.version; zeichnen(); })
      .catch(function () { if (!daten) wurzel.querySelector('.inhalt').innerHTML = '<p>Der Spielplan konnte gerade nicht geladen werden. Bitte gleich nochmal versuchen.</p>'; });
  }
  function live() {
    if (!window.EventSource) { setInterval(laden, 20000); return; }
    var es = new EventSource(BASIS + 'api/live');
    es.onmessage = function (e) { try { if (JSON.parse(e.data).version !== version) laden(); } catch (x) {} };
  }

  function start() {
    host = document.getElementById('tsh-turnier');
    if (!host) { host = document.createElement('div'); host.id = 'tsh-turnier'; skript.parentNode.insertBefore(host, skript); }
    wurzel = host.attachShadow ? host.attachShadow({ mode: 'open' }) : host;
    wurzel.innerHTML = '<style>' + CSS + '\n.logo{--logo:url("' + BASIS + 'logo.png")}.zeichen{--zeichen:url("' + BASIS + 'ts-zeichen.png")}</style><div class="inhalt"><p>Spielplan wird geladen …</p></div>';
    wurzel.addEventListener('click', function (e) {
      var z = e.target.closest('[data-spiel],[data-ein],[data-aus],[data-teams],[data-protokoll]');
      if (!z) return;
      if (z.hasAttribute('data-spiel')) ergebnisEintragen(z.getAttribute('data-spiel'));
      else if (z.hasAttribute('data-ein')) pinFragen();
      else if (z.hasAttribute('data-aus')) abmelden();
      else if (z.hasAttribute('data-teams')) teamsAendern();
      else if (z.hasAttribute('data-protokoll')) protokollZeigen();
    });
    wurzel.addEventListener('change', function (e) {
      if (e.target.hasAttribute('data-mein')) { mein = e.target.value; try { localStorage.setItem('tsh-turnier-team', mein); } catch (x) {} zeichnen(); }
    });
    laden().then(live);
    setInterval(function () { if (daten && daten.datum === heute()) zeichnen(); }, 60000);   // laufende Runde wandert mit der Uhr
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
