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
    '.hero{position:relative;overflow:hidden;display:grid;grid-template-columns:1fr;gap:24px;align-items:center;padding:32px 34px;border-radius:calc(var(--r) + 6px);color:#fff;background:radial-gradient(120% 140% at 0% 0%,#123f8c 0%,var(--blau) 55%,#00133d 100%)}',
    // altes Vereinslogo (Ball mit Flammen) in Blautönen, schimmert rechts durch
    '.zeichen{position:absolute;right:-10px;top:50%;width:330px;aspect-ratio:1;transform:translateY(-50%);background:var(--zeichen) center/contain no-repeat;opacity:.16;pointer-events:none}',
    '.h-links{position:relative;display:flex;flex-direction:column;gap:12px;min-width:0}',
    '.heim{align-self:flex-start;display:inline-flex;align-items:center;gap:4px;margin:-8px 0 2px -4px;padding:4px 10px 4px 6px;border-radius:999px;font-size:.8em;font-weight:700;color:rgba(255,255,255,.8);text-decoration:none}',
    '.heim:hover{background:rgba(255,255,255,.1);color:#fff}.heim svg{width:16px;height:16px}',
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
    // Mein Team: eigene Auswahlliste statt <select>
    '.wahl{position:relative}',
    '.wahl-knopf{display:inline-flex;align-items:center;gap:8px;padding:8px 14px 8px 12px;border-radius:999px;border:1px solid var(--rand);background:#fff;color:var(--blau);font-weight:700;font-size:.92em;box-shadow:0 1px 2px rgba(0,34,102,.06)}',
    '.wahl-knopf:hover{border-color:#b9c7da}.wahl-knopf svg{width:16px;height:16px;flex:none}',
    '.wahl-knopf.gewaehlt{background:var(--blau);border-color:var(--blau);color:#fff}',
    '.wahl-knopf .pfeil{width:14px;height:14px;opacity:.7;transition:transform .15s}.wahl.offen .pfeil{transform:rotate(180deg)}',
    '.wahl-liste{display:none;position:absolute;right:0;top:calc(100% + 6px);z-index:20;width:250px;max-height:min(430px,70vh);overflow:auto;padding:6px;border-radius:14px;background:#fff;border:1px solid var(--rand);box-shadow:0 14px 36px rgba(0,34,102,.2)}',
    '.wahl.offen .wahl-liste{display:block}',
    '.wahl-gruppe{padding:10px 10px 4px;font-size:.68em;font-weight:800;letter-spacing:.09em;text-transform:uppercase;color:var(--grau-2)}',
    '.wahl-liste button{display:flex;align-items:center;justify-content:space-between;gap:10px;width:100%;padding:9px 10px;border-radius:9px;font-size:.92em;font-weight:600;color:#1e293b;text-align:left}',
    '.wahl-liste button:hover{background:var(--hell)}',
    '.wahl-liste button.an{background:#e3ecfa;color:var(--blau);font-weight:800}.wahl-liste button.an::after{content:"\\2713";font-weight:800}',
    '.wahl-liste .alle{color:var(--grau)}',
    // Varianten-Umschalter im Kopf
    '.seg{align-self:flex-start;display:inline-flex;flex-wrap:wrap;gap:4px;padding:4px;border-radius:16px;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.18)}',
    '.seg button{display:flex;flex-direction:column;align-items:flex-start;text-align:left;padding:7px 16px;border-radius:12px;color:rgba(255,255,255,.82);font-weight:800;font-size:.88em;line-height:1.2}',
    '.seg button small{font-weight:600;font-size:.8em;opacity:.75}',
    '.seg button:hover{background:rgba(255,255,255,.08);color:#fff}',
    '.seg button.an{background:#fff;color:var(--blau);box-shadow:0 2px 8px rgba(0,0,0,.18)}.seg button.an small{opacity:.7}',
    // Spielplan
    '.runden{display:flex;flex-direction:column;gap:10px}',
    '.runde{display:grid;grid-template-columns:5.2em 1fr;gap:10px;align-items:stretch}',
    '.r-zeit{display:flex;flex-direction:column;align-items:center;justify-content:center;border-radius:12px;background:#fff;color:var(--blau);font-weight:800;line-height:1.15}',
    '.r-zeit small{font-size:.7em;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--grau-2)}',
    '.runde.aktiv .r-zeit{background:var(--blau);color:#fff}.runde.aktiv .r-zeit small{color:rgba(255,255,255,.7)}',
    '.felder{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));grid-auto-flow:row dense;gap:10px}.felder .f1{grid-column:1}.felder .f2{grid-column:2}.felder .f3{grid-column:3}',
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
    '.s-team.sieger,.s-team.verlierer{margin:0 -6px;padding:2px 6px;border-radius:7px;align-items:center}',
    '.s-team.sieger{color:var(--blau);font-weight:800;background:#e3ecfa}',
    '.s-team.sieger b{background:var(--blau);color:#fff;border-radius:6px;padding:1px 8px;min-width:1.9em;text-align:center}',
    '.s-team.verlierer{color:#8a94a6;font-weight:500}.s-team.verlierer b{padding:1px 8px;min-width:1.9em;text-align:center;font-weight:600}',
    '.s-team .offen{color:var(--grau-2);font-weight:500;font-style:italic;padding-right:.25em}',
    '.s-schiri{margin-top:2px;font-size:.72em;color:var(--grau)}',
    // Tabellen
    '.gruppen{display:grid;grid-template-columns:1fr 1fr;gap:12px}.gruppen.eine{grid-template-columns:minmax(0,640px)}',
    '.runde.pause .r-zeit{background:transparent;color:var(--grau)}.runde.pause .r-zeit small{color:var(--grau-2)}',
    '.p-text{display:flex;align-items:center;padding:12px 16px;border-radius:12px;border:2px dashed #cfd8e3;color:var(--grau);font-weight:700}',
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
    '.laeuft{display:flex;align-items:center;justify-content:center;text-align:center;padding:10px;border:2px dashed #cfd8e6;border-radius:12px;color:var(--grau);font-size:.8em;font-weight:600}',
    '.s-saetze{font-size:.74em;color:var(--grau);font-variant-numeric:tabular-nums}',
    '.saetze{display:grid;grid-template-columns:auto 1fr 1fr;gap:8px 10px;align-items:center;font-size:.9em}',
    '.saetze b{font-size:.85em;text-align:center;color:var(--blau);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '.saetze span{font-weight:700;white-space:nowrap}.saetze small{font-weight:400;color:var(--grau-2)}',
    '.box .saetze input{font-size:1em;padding:8px}',
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
    '@container (max-width:860px){.hero{grid-template-columns:1fr;padding:26px 22px}.felder{grid-template-columns:1fr}.felder .spiel,.felder .laeuft{grid-column:auto}.runde{grid-template-columns:4.4em 1fr}.end{grid-template-columns:1fr 1fr}}',
    '@container (max-width:640px){.gruppen{grid-template-columns:1fr}}',
    '@container (max-width:540px){.wahl-liste{left:0;right:auto}.seg{display:grid;grid-template-columns:1fr 1fr;align-self:stretch}.seg button{padding:7px 10px}.w{font-size:14px;gap:16px}.abschnitt{padding:20px 14px}.h-titel{font-size:1.8em}.zeichen{width:220px;right:-60px}.end{grid-template-columns:1fr}.runde{grid-template-columns:1fr}.r-zeit{flex-direction:row;gap:8px;justify-content:flex-start;padding:6px 12px;background:transparent}.runde.aktiv .r-zeit{background:var(--blau)}}'
  ].join('\n');

  var host, wurzel, daten = null, mein = '', pin = '', variante = '', wahlOffen = false;
  try { variante = new URLSearchParams(location.search).get('variante') || localStorage.getItem('tsh-turnier-variante') || ''; } catch (e) {}
  try { pin = sessionStorage.getItem(SPEICHER) || localStorage.getItem(SPEICHER) || ''; } catch (e) {}
  try { mein = localStorage.getItem('tsh-turnier-team') || ''; } catch (e) {}

  function h(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function name(id) { return id ? (daten.teams[id] || id) : ''; }
  function heute() { var d = new Date(); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  function minuten(z) { var p = z.split(':'); return +p[0] * 60 + +p[1]; }
  /** laufende Runde nach der Uhr (nur am Turniertag), sonst die erste Runde ohne alle Ergebnisse */
  function runden() { var r = []; daten.spiele.forEach(function (s) { if (r.indexOf(s.runde) < 0) r.push(s.runde); }); return r.sort(function (a, b) { return a - b; }); }
  function aktiveRunde() {
    if (!daten) return 1;
    var letzte = runden().slice(-1)[0];
    if (daten.datum === heute()) {
      var jetzt = new Date().getHours() * 60 + new Date().getMinutes();
      for (var r = letzte; r >= 1; r--) {
        var sp = daten.spiele.filter(function (s) { return s.runde === r; })[0];
        if (jetzt >= minuten(sp.zeit)) return r;
      }
      return 1;
    }
    for (var r2 = 1; r2 <= letzte; r2++) if (daten.spiele.some(function (s) { return s.runde === r2 && !s.ergebnis; })) return r2;
    return letzte;
  }

  function zeichnen() {
    if (!daten) return;
    var akt = aktiveRunde();
    var d = new Date(daten.datum + 'T12:00:00');
    var datum = TAGE[d.getDay()] + ', ' + d.getDate() + '. ' + MONATE[d.getMonth()] + ' ' + d.getFullYear();
    var rundeSp = daten.spiele.filter(function (s) { return s.runde === akt; });
    var ids = Object.keys(daten.teams), gruppen = Object.keys(daten.tabellen).sort();
    var eintrag = function (id) { return '<button type="button" role="option" data-team="' + h(id) + '"' + (id === mein ? ' class="an" aria-selected="true"' : '') + '>' + h(name(id)) + '</button>'; };
    var sortiert = function (l) { return l.sort(function (a, b) { return name(a).localeCompare(name(b), 'de'); }); };
    var teamWahl = '<div class="wahl' + (wahlOffen ? ' offen' : '') + '"><button type="button" class="wahl-knopf' + (mein ? ' gewaehlt' : '') + '" data-wahl aria-haspopup="listbox" aria-expanded="' + wahlOffen + '">'
      + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/></svg>'
      + h(mein ? name(mein) : 'Mein Team')
      + '<svg class="pfeil" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg></button>'
      + '<div class="wahl-liste" role="listbox" aria-label="Mein Team hervorheben"><button type="button" role="option" class="alle' + (mein ? '' : ' an') + '" data-team="">Alle Teams</button>'
      + (gruppen.length > 1
        ? gruppen.map(function (g) { return '<div class="wahl-gruppe">Gruppe ' + h(g) + '</div>' + sortiert(ids.filter(function (id) { return id.charAt(0) === g; })).map(eintrag).join(''); }).join('')
        : sortiert(ids).map(eintrag).join(''))
      + '</div></div>';
    var vari = daten.varianten || [];
    var umschalter = vari.length > 1 ? '<div class="seg" role="tablist" aria-label="Turnierablauf">' + vari.map(function (v) {
      var an = v.format === daten.variante;
      return '<button type="button" role="tab" aria-selected="' + an + '" data-variante="' + h(v.format) + '"' + (an ? ' class="an"' : '') + '>' + h(v.name || v.format) + (v.ende ? '<small>bis ' + h(v.ende) + ' Uhr</small>' : '') + '</button>';
    }).join('') + '</div>' : '';
    var html = '<div class="w">'
      + '<header class="hero"><span class="zeichen" aria-hidden="true"></span><div class="h-links">'
      + (daten.zurueck ? '<a class="heim" href="' + h(daten.zurueck.link) + '"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>' + h(daten.zurueck.text) + '</a>' : '')
      + '<span class="logo" role="img" aria-label="Turnerschaft Hohenems Volleyball"></span>'
      + '<div class="h-titel">' + h(daten.name) + '</div>'
      + '<div class="h-info"><span class="chip">' + h(datum) + '</span><span class="chip">' + h(vari.length > 1 || !daten.zeitraum ? daten.beginn.replace(/^0/, '') + '–' + daten.ende + ' Uhr' : daten.zeitraum) + '</span>'
      + (daten.ort ? '<span class="chip">' + h(daten.ort) + '</span>' : '') + '<span class="chip">' + h(daten.modus) + '</span><span class="chip">' + Object.keys(daten.teams).length + ' Teams · 3 Felder</span></div>' + umschalter + '</div>'
      + '</header>'
      + (pin ? '<div class="leiste">Eintragen ist an – Spiel antippen, um das Ergebnis einzutragen. <button class="knopf klein" data-teams>Teamnamen ändern</button><button class="knopf klein" data-protokoll>Protokoll</button><button class="knopf klein" data-aus>Beenden</button></div>' : '')
      + (daten.endstand.length ? endstandHtml() : '')
      + '<section class="abschnitt"><div class="a-kopf"><div class="t">' + (Object.keys(daten.tabellen).length > 1 ? 'Gruppen' : 'Tabelle') + '</div></div>'
      + '<div class="gruppen' + (Object.keys(daten.tabellen).length > 1 ? '' : ' eine') + '">' + Object.keys(daten.tabellen).map(tabelleHtml).join('') + '</div>'
      + '<p style="margin:0;font-size:.78em;color:var(--grau)">' + h(daten.erklaerung || 'Reihung: Siege, direkter Vergleich, Ballpunkt-Differenz. Danach Überkreuz: 5. gegen 6., 3. gegen 4., 1. gegen 2. der anderen Gruppe.') + '</p></section>'
      + '<section class="abschnitt"><div class="a-kopf"><div class="t">Spielplan</div>' + teamWahl + '</div>'
      + (mein ? '<div class="legende"><span><i style="background:#dbe7f8;border:2px solid #002266"></i>' + h(name(mein)) + ' spielt</span><span><i style="background:#fff;border:2px solid #002266"></i>' + h(name(mein)) + ' pfeift</span></div>' : '')
      + '<div class="runden">'
      + runden().map(function (r) {
        return rundeHtml(r, r === akt) + (daten.pause && r === daten.pause.nach
          ? '<div class="runde pause"><div class="r-zeit">' + h(daten.pause.von) + '<small>Uhr</small></div><div class="p-text">' + h(daten.pause.text || 'Mittagspause') + ' bis ' + h(daten.pause.bis) + ' Uhr</div></div>' : '');
      }).join('') + '</div></section>'
      + (pin ? '' : '<div class="fuss"><span></span><button class="knopf klein" data-ein>Ergebnisse eintragen</button></div>')
      + '</div>';
    wurzel.querySelector('.inhalt').innerHTML = html;
  }

  function rundeHtml(r, aktiv) {
    var sp = daten.spiele.filter(function (s) { return s.runde === r; });
    return '<div class="runde' + (aktiv ? ' aktiv' : '') + '"><div class="r-zeit">' + h(sp[0].zeit) + '<small>Uhr</small></div><div class="felder">'
      + sp.map(function (s) {
        var spielt = mein && (s.heim === mein || s.gast === mein), pfeift = mein && s.schiri === mein;
        var art = !mein ? '' : spielt ? ' spielt' : pfeift ? ' pfeift' : ' anders';
        var team = function (id, text, i) {
          var cls = s.ergebnis ? ((s.ergebnis[i] > s.ergebnis[1 - i]) ? ' sieger' : ' verlierer') : '';
          return '<div class="s-team' + cls + '"><span' + (id ? (id === mein ? ' class="ich"' : '') : ' class="offen"') + '>' + h(id ? name(id) : text) + '</span>' + (s.ergebnis ? '<b>' + s.ergebnis[i] + '</b>' : '') + '</div>';
        };
        return '<' + (pin ? 'button' : 'div') + ' class="spiel schatten' + (s.feld ? ' f' + s.feld : '') + (pin ? ' kann' : '') + art + '"' + (pin ? ' data-spiel="' + s.id + '"' : '') + '>'
          + '<div class="s-kopf"><span>' + (s.feld ? 'Feld ' + s.feld + ' · ' : '') + 'Spiel ' + s.nr + '</span><span class="ph">' + h(s.phase === 'gruppe' ? '' : s.titel) + '</span></div>'
          + team(s.heim, s.heimText, 0) + team(s.gast, s.gastText, 1)
          + (s.saetze ? '<div class="s-saetze">' + s.saetze.map(function (x) { return x[0] + ':' + x[1]; }).join(' · ') + '</div>' : '')
          + '<div class="s-schiri">Schiedsgericht: ' + h(s.schiri ? name(s.schiri) : s.schiriText) + '</div>'
          + '</' + (pin ? 'button' : 'div') + '>';
      }).join('') + daten.spiele.filter(function (x) { return x.feld && x.runde < r && x.bis && x.bis > sp[0].zeit; }).map(function (x) {
        return '<div class="laeuft f' + x.feld + '">Feld ' + x.feld + ' · Spiel ' + x.nr + ' läuft bis ' + h(x.bis) + ' Uhr</div>';
      }).join('') + '</div></div>';
  }

  function tabelleHtml(g) {
    var t = daten.tabellen[g];
    return '<div class="kachel schatten"><div class="k-kopf">' + (Object.keys(daten.tabellen).length > 1 ? 'Gruppe ' + g : 'Gruppenphase') + '<span>' + (t.komplett ? 'abgeschlossen' : t.zeilen.some(function (z) { return z.sp > 0; }) ? 'läuft' : '') + '</span></div><table><thead><tr><th></th><th class="tm">Team</th><th>Sp</th><th>S</th><th>N</th><th>Bälle</th></tr></thead><tbody>'
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
    body = body || {};
    if (daten && daten.variante) body.format = daten.variante;   // Ergebnisse gehören zur angezeigten Variante
    return fetch(BASIS + 'api/' + pfad, { method: 'POST', headers: kopf(pin), body: JSON.stringify(body) })
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
    var gs = s.gewinnsaetze || 1, e = s.ergebnis || ['', ''], saetze = s.saetze || [];
    var zahl = function (v, label) { return '<input type="number" inputmode="numeric" min="0" max="60" value="' + (v === undefined ? '' : v) + '" aria-label="' + h(label) + '">'; };
    var felder = gs === 1
      ? '<div class="eingabe"><span>' + h(name(s.heim)) + '</span>' + zahl(e[0], 'Punkte ' + name(s.heim)) + '<span>' + h(name(s.gast)) + '</span>' + zahl(e[1], 'Punkte ' + name(s.gast)) + '</div>'
      : '<div class="saetze"><span></span><b>' + h(name(s.heim)) + '</b><b>' + h(name(s.gast)) + '</b>'
        + [0, 1, 2].map(function (i) { var x = saetze[i] || []; return '<span>' + (i + 1) + '. Satz' + (i === 2 ? ' <small>(falls nötig)</small>' : '') + '</span>' + zahl(x[0], (i + 1) + '. Satz ' + name(s.heim)) + zahl(x[1], (i + 1) + '. Satz ' + name(s.gast)); }).join('') + '</div>';
    dialog('<form><div class="kopf"><div class="t">Spiel ' + s.nr + (s.feld ? ' · Feld ' + s.feld : '') + '</div><small>' + h(s.zeit) + ' Uhr · ' + h(s.titel) + ' · ' + (gs === 1 ? '1 Satz auf 25' : '2 Gewinnsätze') + '</small></div>'
      + felder + '<div class="fehler"></div>'
      + '<div class="zeile">' + (s.ergebnis ? '<button type="button" class="knopf" data-loeschen>Löschen</button>' : '') + '<button type="button" class="knopf" data-zu>Abbrechen</button><button class="knopf voll">Speichern</button></div></form>', function (d, zu) {
      var f = [].map.call(d.querySelectorAll('input'), function (i) { return i.value.trim() === '' ? null : parseInt(i.value, 10); });
      var wert = gs === 1 ? [f[0], f[1]] : [[f[0], f[1]], [f[2], f[3]], [f[4], f[5]]].filter(function (x) { return x[0] !== null || x[1] !== null; });
      senden('ergebnis', { spiel: id, ergebnis: wert })
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
    dialog('<form><div class="t">Teamnamen</div><small>' + (Object.keys(daten.tabellen).length > 1 ? 'Gruppe A: A1–A6, Gruppe B: B1–B6.' : 'Teams A1–A' + Object.keys(daten.teams).length + '.') + ' Leer = „Team A1“ usw.</small><div class="teams-form">' + felder + '</div><div class="fehler"></div>'
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
      var erg = function (e) { return !e ? '–' : Array.isArray(e[0]) ? e.map(function (x) { return x[0] + ':' + x[1]; }).join(', ') : e[0] + ':' + e[1]; };
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
    return fetch(BASIS + 'api/stand' + (variante ? '?format=' + encodeURIComponent(variante) : ''), { cache: 'no-store' }).then(function (a) { return a.json(); }).then(function (j) { daten = j; version = j.version; jimdoKopf(j); zeichnen(); })
      .catch(function () { if (!daten) wurzel.querySelector('.inhalt').innerHTML = '<p>Der Spielplan konnte gerade nicht geladen werden. Bitte gleich nochmal versuchen.</p>'; });
  }
  function live() {
    if (!window.EventSource) { setInterval(laden, 20000); return; }
    var es = new EventSource(BASIS + 'api/live');
    es.onmessage = function (e) { try { if (JSON.parse(e.data).version !== version) laden(); } catch (x) {} };
  }

  // Kopfbild und Menü von Jimdo auf dieser Seite ausblenden (turnier.json: jimdoKopfAusblenden); Fuß mit Impressum bleibt
  function jimdoKopf(d) {
    var id = 'tsh-turnier-jimdo-kopf', alt = document.getElementById(id);
    if (!d.jimdoKopfAusblenden) { if (alt) alt.remove(); return; }
    if (alt) return;
    var st = document.createElement('style');
    st.id = id;
    st.textContent = '.jtpl-header,.jtpl-navigation,.jtpl-mobile-topbar,.jtpl-mobile-navigation{display:none!important}'
      + '.jtpl-content{padding-top:24px!important}.jtpl-content__inner{padding-top:0!important}';
    document.head.appendChild(st);
  }

  function start() {
    host = document.getElementById('tsh-turnier');
    if (!host) { host = document.createElement('div'); host.id = 'tsh-turnier'; skript.parentNode.insertBefore(host, skript); }
    wurzel = host.attachShadow ? host.attachShadow({ mode: 'open' }) : host;
    wurzel.innerHTML = '<style>' + CSS + '\n.logo{--logo:url("' + BASIS + 'logo.png")}.zeichen{--zeichen:url("' + BASIS + 'ball-zeichen.png")}</style><div class="inhalt"><p>Spielplan wird geladen …</p></div>';
    wurzel.addEventListener('click', function (e) {
      var w = e.target.closest('[data-wahl],[data-team],[data-variante]');
      if (w && w.hasAttribute('data-wahl')) { wahlOffen = !wahlOffen; zeichnen(); return; }
      if (w && w.hasAttribute('data-team')) { mein = w.getAttribute('data-team'); wahlOffen = false; try { localStorage.setItem('tsh-turnier-team', mein); } catch (x) {} zeichnen(); return; }
      if (wahlOffen) { wahlOffen = false; zeichnen(); }
      if (w && w.hasAttribute('data-variante')) {
        variante = w.getAttribute('data-variante');
        try { localStorage.setItem('tsh-turnier-variante', variante); } catch (x) {}
        laden();
        return;
      }
      var z = e.target.closest('[data-spiel],[data-ein],[data-aus],[data-teams],[data-protokoll]');
      if (!z) return;
      if (z.hasAttribute('data-spiel')) ergebnisEintragen(z.getAttribute('data-spiel'));
      else if (z.hasAttribute('data-ein')) pinFragen();
      else if (z.hasAttribute('data-aus')) abmelden();
      else if (z.hasAttribute('data-teams')) teamsAendern();
      else if (z.hasAttribute('data-protokoll')) protokollZeigen();
    });
    // Liste schließen bei Klick außerhalb oder Escape
    document.addEventListener('click', function (e) { if (wahlOffen && e.composedPath && e.composedPath().indexOf(host) < 0) { wahlOffen = false; zeichnen(); } });
    document.addEventListener('keydown', function (e) { if (wahlOffen && e.key === 'Escape') { wahlOffen = false; zeichnen(); } });
    laden().then(live);
    setInterval(function () { if (daten && daten.datum === heute()) zeichnen(); }, 60000);   // laufende Runde wandert mit der Uhr
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
