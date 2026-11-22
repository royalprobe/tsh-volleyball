/*
 * Volleyball-Seite der TS Hohenems – Widget für die Jimdo-Homepage (Element „Widget/HTML“, als einziges Element der Seite):
 *
 *   <div id="tsh-volleyball"></div>
 *   <script src="https://royalprobe.github.io/tsh-volleyball/tsh-volleyball.js" defer></script>
 *
 * Kopf mit Logo und nächstem Heimspiel, Teams (Tabellenplatz, Form, Tabelle, Kader, Kalender), letzte und nächste Spiele mit
 * Live-Spielstand (VolleyStation), Trainingszeiten und Kontakt. Texte, Training und Kontakt stehen in inhalt.json im Repo,
 * die Spieldaten sammelt alle 15 Minuten ein GitHub-Workflow (holen.mjs) – beides kommt zusammen in daten.json.
 * Das Widget lebt in einem Shadow DOM: die Stile der Homepage greifen nicht hinein, nur die Schrift wird übernommen.
 */
(function () {
  'use strict';
  var skript = document.currentScript;
  var BASIS = skript ? skript.src.replace(/[^/]*(\?.*)?$/, '') : './';
  var MAX = 6;                                  // je Spiele-Kachel, solange „Alle Teams“ gewählt ist
  var VOR = 5 * 60000;                          // Live: ab 5 Minuten vor dem Anpfiff …
  var NACHSCHAU = 6 * 3600000;                  // … bis 6 Stunden danach, solange das Ergebnis fehlt
  var NEU_LADEN = 5 * 60000;                    // daten.json im Hintergrund neu holen
  var VS = { host: 'https://live.widgets.volleystation.com', pfad: '/api/socket.io',
             token: 'PhodQuahof1ShmunWoifdedgasvuipki',   // steht offen im Widget-Bundle von VolleyStation
             dienst: 'widget/play-by-play' };
  var TAGE = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
  var TAGE_LANG = { Mo: 'Montag', Di: 'Dienstag', Mi: 'Mittwoch', Do: 'Donnerstag', Fr: 'Freitag', Sa: 'Samstag', So: 'Sonntag' };

  var CSS = [
    ':host{all:initial;display:block;font-family:inherit;color:#1e293b;--blau:#002266;--blau-2:#0b3f8f;--akzent:#6592a7;--hell:#eef3f9;--flaeche:#f1f5f9;--rand:#e1e7ef;--grau:#64748b;--grau-2:#7d8ca3;--gruen:#16803c;--rot:#c81e1e;--live:#e0001b;--r:14px}',
    '*{box-sizing:border-box}',
    '.w{container-type:inline-size;display:flex;flex-direction:column;gap:22px;font-size:15px;line-height:1.5}',
    'button{font:inherit;color:inherit;background:none;border:0;padding:0;cursor:pointer}',
    'a{color:inherit;text-decoration:none}',
    'b,strong{font-weight:700}',
    // ---- Kopf
    '.hero{position:relative;overflow:hidden;display:grid;grid-template-columns:1.35fr 1fr;gap:28px;align-items:center;padding:36px 36px 32px;border-radius:calc(var(--r) + 6px);color:#fff;',
    'background:radial-gradient(120% 140% at 0% 0%,#123f8c 0%,var(--blau) 55%,#00133d 100%)}',
    // altes Vereinslogo (Ball mit Flammen) in Blautönen schimmert rechts durch
    '.hero .zeichen{position:absolute;right:-10px;top:50%;width:330px;aspect-ratio:1;transform:translateY(-50%);background:var(--zeichen) center/contain no-repeat;opacity:.16;pointer-events:none;-webkit-mask:linear-gradient(to top,transparent 4%,#000 28%);mask:linear-gradient(to top,transparent 4%,#000 28%)}',
    '.h-spiel{z-index:1}',
    '.h-links{position:relative;display:flex;flex-direction:column;gap:18px;min-width:0}',
    '.heim{align-self:flex-start;display:inline-flex;align-items:center;gap:4px;margin:-8px 0 2px -4px;padding:4px 10px 4px 6px;border-radius:999px;font-size:.8em;font-weight:700;color:rgba(255,255,255,.8)}',
    '.heim:hover{background:rgba(255,255,255,.1);color:#fff}.heim svg{width:16px;height:16px}',
    '.logo{display:block;width:min(100%,460px);aspect-ratio:640/115;background:#fff;-webkit-mask:var(--logo) left center/contain no-repeat;mask:var(--logo) left center/contain no-repeat}',
    '.saison{align-self:flex-start;padding:4px 12px;border-radius:999px;background:rgba(255,255,255,.12);font-size:.78em;font-weight:700;letter-spacing:.08em;text-transform:uppercase}',
    '.einladung{margin:0;max-width:34em;font-size:1.08em;line-height:1.5;color:rgba(255,255,255,.88)}',
    '.knoepfe{display:flex;flex-wrap:wrap;gap:8px}',
    '.knopf{display:inline-flex;align-items:center;gap:8px;padding:10px 18px;border-radius:999px;font-weight:700;font-size:.9em;transition:transform .15s,background .15s,box-shadow .15s}',
    '.knopf.voll{background:#fff;color:var(--blau)}.knopf.voll:hover{box-shadow:0 6px 18px rgba(0,0,0,.25);transform:translateY(-1px)}',
    '.knopf.rand{border:1px solid rgba(255,255,255,.35)}.knopf.rand:hover{background:rgba(255,255,255,.1)}',
    '.knopf svg{width:16px;height:16px}.knopf .kurz{display:none}',
    '.h-spiel{position:relative;display:flex;flex-direction:column;gap:10px;padding:18px 20px;border-radius:var(--r);background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.16)}',
    '.h-spiel[data-link]{cursor:pointer}.h-spiel[data-link]:hover{background:rgba(255,255,255,.12)}',
    '.h-titel{display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:.72em;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:rgba(255,255,255,.7)}',
    '.h-wann{font-size:1.5em;font-weight:800;line-height:1.1}',
    '.h-teams{display:flex;flex-direction:column;border-top:1px solid rgba(255,255,255,.14)}',
    '.h-team{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:8px 0;border-bottom:1px solid rgba(255,255,255,.14);font-weight:700;font-size:1.05em;line-height:1.25}',
    '.h-team small{flex:none;font-size:.62em;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:rgba(255,255,255,.5)}',
    '.h-rel{padding:2px 9px;border-radius:999px;background:#fff;color:var(--blau);letter-spacing:.06em}',
    '.h-fuss{display:flex;flex-wrap:wrap;align-items:center;gap:6px 12px}',
    '.h-stand em{font-style:normal;font-weight:800;color:#fff;background:var(--live);padding:0 6px;border-radius:5px}.h-stand{display:flex;align-items:baseline;gap:10px}.h-stand b{font-size:2.2em;line-height:1}.h-stand span{font-size:.85em;color:rgba(255,255,255,.75)}',
    '.h-ort{display:inline-flex;align-items:center;gap:5px;font-size:.82em;color:rgba(255,255,255,.8)}.h-ort svg{width:14px;height:14px;flex:none}a.h-ort:hover{color:#fff;text-decoration:underline;text-underline-offset:2px}',
    '.h-bewerb{padding:2px 9px;border-radius:999px;background:rgba(255,255,255,.14);font-size:.72em;font-weight:700}',
    // ---- Abschnitte
    '.abschnitt{display:flex;flex-direction:column;gap:16px;scroll-margin-top:90px;padding:28px 30px 30px;border-radius:calc(var(--r) + 6px);background:var(--flaeche)}',
    '.a-kopf{display:flex;flex-wrap:wrap;align-items:flex-end;justify-content:space-between;gap:8px 20px}',
    '.a-kopf small{display:block;font-size:.72em;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:var(--akzent)}',
    '.a-kopf .t{font-size:1.75em;font-weight:800;line-height:1.1;color:var(--blau);letter-spacing:-.01em}',
    '.a-kopf p{margin:0;font-size:.85em;color:var(--grau)}',
    // ---- Teams
    '.pillen{display:flex;flex-wrap:wrap;gap:6px}',
    '.pille{padding:7px 15px;border-radius:999px;border:1px solid #d6dee8;background:#fff;font-weight:600;font-size:.86em;white-space:nowrap;transition:background .15s,color .15s,border-color .15s}',
    '.pille:hover{border-color:var(--blau);color:var(--blau)}',
    '.pille[aria-pressed=true]{background:var(--blau);border-color:var(--blau);color:#fff}',
    '.karten{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}',
    '.karte{position:relative;display:flex;flex-direction:column;gap:10px;padding:16px 18px;text-align:left;background:#fff;border:1px solid transparent;border-radius:var(--r);box-shadow:0 1px 2px rgba(0,34,102,.06),0 6px 16px rgba(0,34,102,.06);transition:box-shadow .2s,transform .2s,border-color .2s}',
    '.karte:hover{border-color:#c9d6e6;box-shadow:0 10px 26px rgba(0,34,102,.10);transform:translateY(-2px)}',
    '.karte::after{content:"";position:absolute;right:16px;top:18px;width:8px;height:8px;border-top:2px solid var(--grau-2);border-right:2px solid var(--grau-2);transform:rotate(45deg);transition:transform .2s,border-color .2s}',
    '.karte:hover::after{border-color:var(--blau);transform:translateX(3px) rotate(45deg)}',
    '.karte:focus-visible,.pille:focus-visible,.zeile:focus-visible,.knopf:focus-visible,.h-spiel:focus-visible{outline:2px solid var(--akzent);outline-offset:2px}',
    '.k-titel{font-size:1.15em;font-weight:800;color:var(--blau);line-height:1.15;padding-right:20px}',
    '.k-bewerb{margin-top:-6px;font-size:.78em;color:var(--grau)}',
    '.k-stand{display:flex;align-items:center;flex-wrap:wrap;gap:4px 10px;font-variant-numeric:tabular-nums}',
    '.k-platz{font-size:.8em;color:var(--grau)}',
    '.k-platz b{font-size:1.9em;font-weight:800;color:var(--blau);line-height:1;margin-right:3px}',
    '.k-bilanz{font-size:.8em;font-weight:600;color:#334155}.k-noch{font-size:.8em;color:var(--grau)}',
    '.form{display:inline-flex;gap:3px;margin-left:auto}',
    '.form i{width:18px;height:18px;display:inline-grid;place-items:center;border-radius:5px;font-style:normal;font-size:.62em;font-weight:800;color:#fff}',
    '.form .s{background:var(--gruen)}.form .n{background:var(--rot)}',
    '.k-naechstes{margin-top:auto;padding-top:10px;border-top:1px solid var(--rand);font-size:.83em;line-height:1.35}',
    '.k-naechstes small{display:block;font-size:.8em;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:var(--grau-2)}',
    '.detail{display:flex;flex-direction:column;gap:12px}',
    '.d-kopf{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:12px 20px;padding:18px 22px;color:#fff;border-radius:var(--r);background:linear-gradient(120deg,var(--blau),var(--blau-2))}',
    '.d-kopf .t{font-size:1.45em;font-weight:800;line-height:1.1}',
    '.d-kopf p{margin:3px 0 0;font-size:.82em;opacity:.8}',
    '.zahlen{display:flex;gap:22px}',
    '.zahlen span{display:flex;flex-direction:column;align-items:center}',
    '.zahlen b{font-size:1.8em;font-weight:800;line-height:1;font-variant-numeric:tabular-nums}',
    '.zahlen small{font-size:.64em;font-weight:700;letter-spacing:.08em;text-transform:uppercase;opacity:.75}',
    '.d-raster{display:grid;grid-template-columns:1.4fr 1fr;gap:12px;align-items:start}',
    '.d-raster>.voll{grid-column:1/-1}',
    '.foto{margin:0;overflow:hidden;border-radius:var(--r);background:var(--hell);box-shadow:0 1px 2px rgba(0,34,102,.06),0 6px 16px rgba(0,34,102,.06)}',
    '.foto img{display:block;width:100%;height:auto;aspect-ratio:4/3;object-fit:cover}',
    '.d-raster.mitfoto{grid-template-columns:1fr 1fr}',
    '.kachel{min-width:0;padding:16px 18px;background:#fff;border-radius:var(--r);box-shadow:0 1px 2px rgba(0,34,102,.06),0 6px 16px rgba(0,34,102,.06)}',
    '.k-kopf{display:flex;justify-content:space-between;gap:10px;margin:0 0 10px;padding-bottom:8px;border-bottom:1px solid var(--rand);font-size:.74em;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:var(--blau)}',
    '.k-kopf span{color:var(--grau-2);letter-spacing:.04em}',
    '.tab{overflow-x:auto}',
    'table{width:100%;border-collapse:collapse;font-size:.86em;font-variant-numeric:tabular-nums}',
    'th{padding:4px 6px;text-align:right;font-size:.74em;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:var(--grau-2)}',
    'td{padding:7px 6px;text-align:right;border-top:1px solid var(--rand);white-space:nowrap}',
    '.team{text-align:left;width:100%;white-space:normal;font-weight:600}',
    'td.pl{color:var(--grau-2);width:1.6em}td.pk{font-weight:800}',
    'tr.ich td{background:var(--hell)}tr.ich td:first-child{border-radius:8px 0 0 8px}tr.ich td:last-child{border-radius:0 8px 8px 0}tr.ich .team,tr.ich .pk{color:var(--blau);font-weight:800}',
    '.kader{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:0 20px}',
    '.kader li{display:flex;align-items:baseline;gap:10px;padding:5px 0;border-top:1px solid var(--rand);font-size:.9em}',
    '.kader li:first-child{border-top:0}',
    '.kader .nr{flex:none;width:1.7em;text-align:right;font-weight:800;color:var(--blau);font-variant-numeric:tabular-nums}',
    '.kader .nm{font-weight:600}.kader .pos{margin-left:auto;font-size:.78em;color:var(--grau-2);white-space:nowrap}',
    '.betreuer{margin:10px 0 0;font-size:.82em;color:var(--grau)}',
    '.kal{display:flex;flex-wrap:wrap;align-items:center;gap:6px 8px;font-size:.84em;color:var(--grau)}',
    '.kal a{padding:5px 12px;border-radius:999px;border:1px solid var(--rand);background:#fff;font-weight:600;color:var(--blau)}',
    '.kal a:hover{border-color:var(--blau)}',
    // ---- Spiele
    '.spiele{display:grid;grid-template-columns:1fr 1fr;gap:12px;align-items:start}',
    '.zeile{display:grid;grid-template-columns:3em 1fr auto;align-items:center;gap:2px 12px;padding:9px 8px;margin:0 -8px;border-radius:10px;font-size:.9em}',
    '.zeile+.zeile{border-top:1px solid var(--rand);border-radius:0}',
    '.zeile[data-link]{cursor:pointer}.zeile[data-link]:hover{background:var(--hell);border-radius:10px}',
    '.zeile[data-link]:hover+.zeile{border-top-color:transparent}',
    '.dt{display:flex;flex-direction:column;align-items:center;justify-content:center;height:3em;border-radius:9px;background:var(--hell);line-height:1.15;font-size:.78em;color:var(--grau);font-variant-numeric:tabular-nums}',
    '.dt b{font-size:1.05em;color:var(--blau)}',
    '.mi{min-width:0;display:flex;flex-wrap:wrap;align-items:center;gap:3px 6px}',
    '.tm{flex:1 1 100%;min-width:0;display:flex;flex-wrap:wrap;column-gap:5px;font-weight:600;color:#0f172a}',
    '.tm .gg{color:var(--grau-2);font-weight:400}',
    '.tm .ich{color:var(--blau);font-weight:800}',
    '.bw{padding:1px 8px;border-radius:999px;font-size:.72em;font-weight:700;color:var(--blau);background:var(--hell);white-space:nowrap}',
    '.ort{font-size:.75em;color:var(--grau)}',
    'a.ort:hover{color:var(--blau);text-decoration:underline}',
    '.wt{text-align:right;white-space:nowrap}',
    '.erg{font-size:1.2em;font-weight:800;color:#0f172a;line-height:1}',
    '.wt small{display:block;max-width:12em;margin-left:auto;white-space:normal;font-size:.74em;line-height:1.25;color:var(--grau)}',
    '.wt small span{display:inline-block;white-space:nowrap}.wt small span+span{margin-left:.45em}',
    '.wt .ls{color:var(--live);font-weight:700}',
    '.sieg .erg{color:var(--gruen)}.nied .erg{color:var(--rot)}',
    '.zt{font-weight:700;color:var(--blau)}',
    '.fehlt{font-size:.8em;color:var(--grau-2)}',
    '.live{display:inline-flex;align-items:center;gap:5px;padding:1px 8px;border-radius:999px;font-size:.68em;font-weight:800;letter-spacing:.08em;color:#fff;background:var(--live)}',
    '.live i{width:6px;height:6px;border-radius:50%;background:#fff;animation:p 1.4s ease-in-out infinite}',
    '@keyframes p{50%{opacity:.25}}',
    '.leer{margin:6px 0;color:var(--grau-2)}',
    '.mehr{margin-top:10px}',
    // Teamauswahl am PC in einer Reihe: Knöpfe teilen sich die Breite
    '@container (min-width:860px){.teamwahl{flex-wrap:nowrap;gap:5px}.teamwahl .pille{flex:1 1 auto;padding:7px 8px;text-align:center;font-size:.84em}}',
    // Archiv: am PC alle Saisonen in einer Reihe, mittel 2 × 5, am Handy 2 Spalten
    '.pillen.archiv{display:grid !important;grid-template-columns:repeat(10,minmax(0,1fr));gap:6px;overflow:visible !important;margin:0;padding:0}',
    '.archiv .pille{text-align:center;padding:7px 4px;font-size:.84em}',
    '@container (max-width:860px){.pillen.archiv{grid-template-columns:repeat(5,minmax(0,1fr))}}',
    '@container (max-width:540px){.pillen.archiv{grid-template-columns:repeat(2,minmax(0,1fr))}}',
    // ---- Training
    '.training{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:12px}',
    '.tr-karte{display:flex;flex-direction:column;gap:10px;padding:16px 18px;background:#fff;border-radius:var(--r);box-shadow:0 1px 2px rgba(0,34,102,.06),0 6px 16px rgba(0,34,102,.06)}',
    '.tr-kopf b{display:block;font-size:1.08em;font-weight:800;color:var(--blau);line-height:1.2}',
    '.tr-kopf span{font-size:.8em;color:var(--grau)}',
    '.tr-zeiten{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(134px,1fr));gap:8px 10px}',
    '.tr-zeiten li{display:grid;grid-template-columns:2.6em 1fr auto;align-items:center;gap:10px;font-size:.88em}',
    '.tr-tag{position:relative;display:grid;place-items:center;height:2.1em;border-radius:8px;background:var(--hell);font-weight:800;font-size:.86em;color:var(--blau)}',
    '.tr-zeiten li{grid-template-columns:2.6em 1fr;gap:8px}',
    '.trainer{margin:-2px 0 2px;padding:8px 10px;border-radius:9px;background:var(--hell);font-size:.84em;font-weight:700;color:#0f172a;line-height:1.35}',
    '.trainer small{display:block;font-size:.78em;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--akzent)}',
    '.kachel .trainer{margin:0 0 10px;display:inline-block}',
    '.tr-info{display:flex;flex-direction:column;line-height:1.25;min-width:0}',
    '.tr-zeit{font-weight:700;font-variant-numeric:tabular-nums;white-space:nowrap}',
    '.tr-halle{align-self:flex-start;font-size:.8em;color:var(--grau)}a.tr-halle:hover{color:var(--blau);text-decoration:underline}',
    '.tr-zeiten li.heute .tr-tag{background:var(--blau);color:#fff}',
    '.tr-zeiten li.heute .tr-tag::after{content:"";position:absolute;top:-3px;right:-3px;width:10px;height:10px;border-radius:50%;background:#22c55e;border:2px solid #fff}.tr-zeiten li.heute .tr-zeit{color:var(--gruen)}',
    // ---- Kontakt
    '.kontakt{display:grid;grid-template-columns:1.2fr 1fr 1fr;gap:12px}',
    '.ko-mail{display:flex;flex-direction:column;justify-content:center;gap:10px;padding:22px 24px;border-radius:var(--r);color:#fff;background:linear-gradient(120deg,var(--blau),var(--blau-2))}',
    '.ko-mail b{font-size:1.2em;line-height:1.25}.ko-mail p{margin:0;font-size:.88em;opacity:.85}',
    '.ko-mail .knopf{align-self:flex-start}.ko-mail .knopf.rand{color:#fff}',
    '.ko-karte{display:grid;grid-template-columns:1fr auto;gap:20px 32px;align-items:center;padding:24px 28px;border-radius:var(--r);color:#fff;background:linear-gradient(120deg,var(--blau),var(--blau-2))}',
    '.ko-text>b{display:block;font-size:1.35em;line-height:1.2}',
    '.ko-text>p{margin:4px 0 0;font-size:.95em;color:rgba(255,255,255,.85)}',
    '.ko-personen{display:flex;flex-wrap:wrap;gap:10px 28px;margin-top:16px}',
    '.ko-person{display:flex;align-items:center;gap:10px}',
    '.ko-person .initialen{width:40px;height:40px;font-size:.85em;background:rgba(255,255,255,.14);color:#fff}',
    '.ko-person b{display:block;font-size:.98em}.ko-person small{display:block;font-size:.72em;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:rgba(255,255,255,.65)}',
    '.ko-knoepfe{display:flex;flex-direction:column;align-items:stretch;gap:8px}',
    '.ko-knoepfe .knopf{justify-content:center}.ko-knoepfe .knopf.rand{color:#fff}',
    '@container (max-width:540px){.ko-karte{padding:20px 18px}.ko-knoepfe{flex-direction:column}.ko-knoepfe .knopf{width:100%}.ko-personen{flex-direction:column;gap:10px}}',
    '.person{display:flex;align-items:center;gap:14px;padding:18px 20px;background:#fff;border-radius:var(--r);box-shadow:0 1px 2px rgba(0,34,102,.06),0 6px 16px rgba(0,34,102,.06)}',
    '.initialen{flex:none;width:52px;height:52px;display:grid;place-items:center;border-radius:50%;background:var(--hell);color:var(--blau);font-weight:800;font-size:1.05em;letter-spacing:.02em}',
    '.person small{display:block;font-size:.72em;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--akzent)}',
    '.person b{display:block;font-size:1.05em;color:#0f172a}',
    '.person a{font-size:.84em;color:var(--blau);text-decoration:underline;text-underline-offset:2px;word-break:break-all}',
    '.fuss{margin:-8px 4px 0 0;font-size:.72em;color:var(--grau-2);text-align:right}',
    '.fehler{padding:16px 18px;border-radius:var(--r);background:var(--hell);color:var(--grau)}',
    '@media (prefers-reduced-motion:reduce){.live i{animation:none}.karte,.knopf{transition:none}}',
    '@container (max-width:860px){.ko-karte{grid-template-columns:1fr}.ko-knoepfe{flex-direction:row;flex-wrap:wrap}.hero{grid-template-columns:1fr;padding:28px 24px 24px}.kontakt{grid-template-columns:1fr 1fr}.d-raster,.d-raster.mitfoto{grid-template-columns:1fr}}',
    '@container (max-width:720px){.spiele{grid-template-columns:1fr}}@container (max-width:640px){.karten{grid-template-columns:1fr 1fr}}',
    '@container (max-width:540px){.w{font-size:14px;gap:16px}.abschnitt{padding:20px 14px 18px;border-radius:var(--r)}.hero{padding:24px 18px 20px;border-radius:var(--r)}.hero .zeichen{width:230px;right:-70px;top:36%}.karten{grid-template-columns:1fr;gap:8px}',
    '.pillen{flex-wrap:nowrap;overflow-x:auto;scrollbar-width:none;margin:0 -2px;padding:1px 2px}.pillen::-webkit-scrollbar{display:none}',
    '.knoepfe{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}.knoepfe .knopf{justify-content:center;padding:10px 6px}.knoepfe .knopf.voll{grid-column:1/-1}.knoepfe .knopf.rand svg,.knoepfe .lang{display:none}.knoepfe .kurz{display:inline}',
    '.teamwahl{padding-right:28px;-webkit-mask:linear-gradient(90deg,#000 calc(100% - 32px),transparent);mask:linear-gradient(90deg,#000 calc(100% - 32px),transparent)}',
    '.kachel{padding:14px}.tm{flex-direction:column}.tm .gg{display:none}.tm>span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.wt small{max-width:6.2em}',
    'th.bl,td.bl{display:none}.d-kopf{padding:16px}.d-kopf .t{font-size:1.25em}.zahlen{gap:14px}.a-kopf .t{font-size:1.45em}}'
  ].join('\n');

  // ------------------------------------------------------------------ Zustand
  var host, wurzel, daten = null, team = null, alleAuf = { letzte: false, naechste: false };
  var live = {};          // Match-ID -> { stand, aus }
  var sockets = {};       // Match-ID -> socket
  var ioLaedt = false, zeichnenGeplant = false;

  function h(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function klein(s) { return String(s || '').toLowerCase().replace(/\s+/g, ' ').trim(); }
  function zwei(n) { return ('0' + n).slice(-2); }
  function heute() { var d = new Date(); return d.getFullYear() + '-' + zwei(d.getMonth() + 1) + '-' + zwei(d.getDate()); }
  function anpfiff(s) { return new Date(s.datum + 'T' + (s.zeit || '20:00') + ':00').getTime(); }   // Ortszeit des Browsers
  function eigen(name) { return daten && daten.teams.some(function (t) { return klein(t.name) === klein(name); }); }
  function teamVon(id) { for (var i = 0; i < daten.teams.length; i++) if (daten.teams[i].id === id) return daten.teams[i]; return null; }
  function karte(q) { return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(q); }
  function datumKurz(s) { var d = new Date(s.datum + 'T12:00:00'); return { tag: TAGE[d.getDay()], datum: zwei(d.getDate()) + '.' + zwei(d.getMonth() + 1) + '.' }; }

  /** vorbei = Ergebnis da, Live-Spiel beendet oder Tag vorbei */
  function vorbei(s) { return s.ergebnis != null || (s.vs && live[s.vs] && live[s.vs].aus) || s.datum < heute(); }
  function sichtbar(s) { return !team || s.teams.indexOf(team) >= 0; }
  function laeuft(s) { return s.vs && live[s.vs] && live[s.vs].stand && !live[s.vs].aus; }

  // ------------------------------------------------------------------ Darstellung
  function zeichnen() {
    zeichnenGeplant = false;
    if (!daten) return;
    var p = wurzel.querySelector('.pillen'), scroll = p ? p.scrollLeft : 0;
    var inhalt = daten.inhalt || {};
    wurzel.querySelector('.inhalt').innerHTML = '<div class="w">'
      + heroHtml(inhalt) + trainingHtml(inhalt) + kontaktHtml(inhalt)
      + '<section class="abschnitt" id="teams"><div class="a-kopf"><div><div class="t">Unsere Teams</div></div>'
      + '</div>'
      + '<div class="pillen teamwahl" role="group" aria-label="Team wählen">'
      + '<button class="pille" data-team="" aria-pressed="' + !team + '">Alle Teams</button>'
      + daten.teams.map(function (t) { return '<button class="pille" data-team="' + h(t.id) + '" aria-pressed="' + (team === t.id) + '">' + h(t.titel) + '</button>'; }).join('')
      + '</div>' + (team ? detailHtml(teamVon(team), inhalt) : kartenHtml()) + '</section>'
      + '<section class="abschnitt" id="spiele"><div class="a-kopf"><div><div class="t">Ergebnisse &amp; Termine' + (team ? ' · ' + h(teamVon(team).titel) : '') + '</div></div>'
      + (team ? kalenderHtml(teamVon(team)) : '') + '</div>'
      + spieleHtml() + '</section>' + archivHtml(inhalt) + '</div>';
    p = wurzel.querySelector('.pillen');
    if (p) {
      p.scrollLeft = scroll;
      var aktiv = p.querySelector('[aria-pressed="true"]');
      if (aktiv && (aktiv.offsetLeft < p.scrollLeft || aktiv.offsetLeft + aktiv.offsetWidth > p.scrollLeft + p.clientWidth)) p.scrollLeft = aktiv.offsetLeft - 16;
    }
  }
  function spaeter() { if (!zeichnenGeplant) { zeichnenGeplant = true; requestAnimationFrame(zeichnen); } }

  var MAIL_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>';
  var INSTA_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r=".6" fill="currentColor"/></svg>';
  var YT_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"><rect x="2.5" y="5" width="19" height="14" rx="4"/><path d="M10 9.2v5.6l5-2.8z" fill="currentColor"/></svg>';
  var PFEIL_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>';
  var ORT_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg>';
  var UHR_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>';

  function heroHtml(inhalt) {
    // rechts: das laufende Spiel (live), sonst das nächste Heimspiel, sonst das nächste Spiel
    var offen = daten.spiele.filter(function (s) { return !vorbei(s); });
    var s = offen.filter(laeuft)[0] || offen.filter(function (x) { return eigen(x.heim); })[0] || offen[0];
    var box = '';
    if (s) {
      var l = laeuft(s), d = datumKurz(s);
      var wert = l
        ? '<div class="h-stand"><b>' + live[s.vs].stand.gewonnen.home + ':' + live[s.vs].stand.gewonnen.away + '</b><span>' + live[s.vs].stand.liste.map(function (x) { return x.fertig ? x.h + ':' + x.a : '<em>' + x.h + ':' + x.a + '</em>'; }).join(' · ') + '</span></div>'
        : '<div class="h-wann">' + h(TAGE_LANG[d.tag] || d.tag) + ', ' + h(d.datum) + (s.zeit ? ' · ' + h(s.zeit) : '') + '</div>';
      var rel = l ? '' : relativ(s);
      box = '<div class="h-spiel"' + (s.link ? ' data-link="' + h(s.link) + '" role="link" tabindex="0"' : '') + '>'
        + '<div class="h-titel">' + (l ? 'Jetzt live' : eigen(s.heim) ? 'Nächstes Heimspiel' : 'Nächstes Spiel') + (l ? '<span class="live"><i></i>LIVE</span>' : rel ? '<span class="h-rel">' + rel + '</span>' : '') + '</div>'
        + wert + '<div class="h-teams"><div class="h-team"><span>' + h(s.heim) + '</span><small>Heim</small></div><div class="h-team"><span>' + h(s.gast) + '</span><small>Gast</small></div></div>'
        + '<div class="h-fuss"><span class="h-bewerb">' + h(s.bewerb) + '</span>'
        + (s.halle ? '<a class="h-ort" href="' + h(karte(s.halle + (s.adresse ? ', ' + s.adresse : ''))) + '" target="_blank" rel="noopener">' + ORT_ICON + h(s.halle) + '</a>' : '')
        + '</div></div>';
    }
    return '<header class="hero"><span class="zeichen" aria-hidden="true"></span><div class="h-links">'
      + (inhalt.startseite ? '<a class="heim" href="' + h(inhalt.startseite) + '">' + PFEIL_ICON + 'Turnerschaft Hohenems</a>' : '')
      + '<span class="logo" role="img" aria-label="Turnerschaft Hohenems Volleyball"></span>'
      + '<span class="saison">Saison ' + h(daten.saison) + '</span>'
      + '<div class="knoepfe">' + (inhalt.mail ? '<a class="knopf voll" href="mailto:' + h(inhalt.mail) + '">' + MAIL_ICON + 'Schreib uns</a>' : '')
      + (inhalt.training ? '<button class="knopf rand" data-ziel="training">' + UHR_ICON + '<span class="lang">Trainingszeiten</span><span class="kurz">Training</span></button>' : '')
      + '<button class="knopf rand" data-ziel="teams">Teams</button><button class="knopf rand" data-ziel="spiele">Spiele</button></div>'
      + '</div>' + box + '</header>';
  }

  // „Heute“, „Morgen“, „In 3 Tagen“ – nur in der kommenden Woche
  function relativ(s) {
    var a = new Date(s.datum + 'T12:00:00'), b = new Date(heute() + 'T12:00:00'), n = Math.round((a - b) / 86400000);
    return n === 0 ? 'Heute' : n === 1 ? 'Morgen' : n > 1 && n < 7 ? 'In ' + n + ' Tagen' : '';
  }
  function ohneAltersklasse(n) { return String(n).replace(/\s+U\d\d\s+(weiblich|männlich)$/i, ''); }

  function form(t) {
    return daten.spiele.filter(function (s) { return s.teams.indexOf(t.id) >= 0 && /^\d+:\d+$/.test(s.ergebnis || ''); }).slice(-5).map(function (s) {
      var e = s.ergebnis.split(':').map(Number), heim = klein(s.heim) === klein(t.name);
      var sieg = heim ? e[0] > e[1] : e[1] > e[0];
      return '<i class="' + (sieg ? 's' : 'n') + '" title="' + h((heim ? s.gast : s.heim) + ' ' + (heim ? e[0] + ':' + e[1] : e[1] + ':' + e[0])) + '">' + (sieg ? 'S' : 'N') + '</i>';
    }).join('');
  }
  function naechstes(t) { return daten.spiele.filter(function (s) { return s.teams.indexOf(t.id) >= 0 && !vorbei(s); })[0] || null; }

  function kartenHtml() {
    return '<div class="karten">' + daten.teams.map(function (t) {
      var p = t.platz, n = naechstes(t), f = form(t);
      var stand = p && p.sp > 0
        ? '<span class="k-platz"><b>' + h(p.platz) + '.</b> von ' + p.von + '</span><span class="k-bilanz">' + (p.pkt !== '' ? h(p.pkt) + ' Pkt · ' : '') + p.s + ' S, ' + p.n + ' N</span>'
        : '<span class="k-noch">Saisonstart steht noch bevor</span>';
      var nae = 'Kein Spiel mehr angesetzt';
      if (n) {
        var d = datumKurz(n), heim = klein(n.heim) === klein(t.name);
        nae = '<small>' + (laeuft(n) ? '<span class="live"><i></i>LIVE</span>' : 'Nächstes Spiel · ' + h(d.tag + ' ' + d.datum) + (n.zeit ? ' · ' + h(n.zeit) : '')) + '</small>'
          + (heim ? 'Heim gegen ' : 'Auswärts bei ') + '<b>' + h(ohneAltersklasse(heim ? n.gast : n.heim)) + '</b>';
      }
      return '<button class="karte" data-team="' + h(t.id) + '"><span class="k-titel">' + h(t.titel) + '</span>'
        + (klein(t.bewerbe.join(' · ')) !== klein(t.titel) ? '<span class="k-bewerb">' + h(t.bewerbe.join(' · ')) + '</span>' : '')
        + '<span class="k-stand">' + stand + (f ? '<span class="form" aria-label="Letzte Spiele">' + f + '</span>' : '') + '</span>'
        + '<span class="k-naechstes">' + nae + '</span></button>';
    }).join('') + '</div>';
  }

  // Betreuer von volleynet: die Trainer aus inhalt.json zuerst, in deren Reihenfolge (Herren 2: Frank Brandenburg vorne)
  function betreuer(t, inhalt) {
    var tr = trainingVon(t, inhalt)[0], namen = tr && tr.trainer ? tr.trainer.split('/').map(klein) : [];
    var rang = function (b) { var i = namen.indexOf(klein(b[0])); return i < 0 ? 99 : i; };
    return t.kader.betreuer.map(function (b, i) { return [b, i]; })
      .sort(function (x, y) { return rang(x[0]) - rang(y[0]) || x[1] - y[1]; }).map(function (x) { return x[0]; });
  }
  function trainingVon(t, inhalt) {
    return (inhalt.training || []).filter(function (g) { return g.team && klein(g.team) === klein(t.titel); });
  }

  function detailHtml(t, inhalt) {
    if (!t) return '';
    var p = t.platz, out = '<div class="detail"><div class="d-kopf"><div><div class="t">' + h(t.titel) + '</div><p>' + h(t.name) + ' · ' + h(t.bewerbe.join(' · ')) + '</p></div>';
    if (p && p.sp > 0) {
      out += '<div class="zahlen"><span><b>' + h(p.platz) + '.</b><small>Platz</small></span>' + (p.pkt !== '' ? '<span><b>' + h(p.pkt) + '</b><small>Punkte</small></span>' : '')
        + '<span><b>' + p.s + ':' + p.n + '</b><small>Siege</small></span></div>';
    }
    // mit Mannschaftsfoto: Foto (ganz, 4:3) links, Tabelle rechts, Kader darunter über die ganze Breite
    var foto = (inhalt.fotos || {})[t.titel];
    out += '</div><div class="d-raster' + (foto ? ' mitfoto' : '') + '">';
    if (foto) out += '<figure class="foto"><img src="' + h(new URL(foto, BASIS).href) + '" alt="Mannschaftsfoto ' + h(t.titel) + '" loading="lazy" decoding="async"></figure>';
    if (t.tabelle) {
      var tb = t.tabelle, ende = tb.endstand;
      var titel = t.quelle === 'lk' ? tb.name : t.bewerbe[0] + (/^(Meisterschaftsphase|Landesmeisterschaft|Nachwuchsliga)$/.test(tb.name) ? '' : ' · ' + tb.name);
      out += '<div class="kachel' + (t.kader && !foto ? '' : foto ? '' : ' voll') + '"><div class="k-kopf">' + (ende ? 'Endstand' : 'Tabelle') + '<span>' + h(titel) + '</span></div><div class="tab"><table><thead><tr><th></th><th class="team">Team</th><th>Sp</th><th>S</th><th>N</th><th>Sätze</th><th class="bl">Bälle</th>'
        + (ende ? '' : '<th>Pkt</th>') + '</tr></thead><tbody>' + tb.zeilen.map(function (z) {
          return '<tr' + (klein(z[1]) === klein(t.name) ? ' class="ich"' : '') + '><td class="pl">' + h(z[0]) + '</td><td class="team">' + h(z[1].replace(/\s+U\d\d\s+(weiblich|männlich)$/i, ''))
            + '</td><td>' + h(z[2]) + '</td><td>' + h(z[3]) + '</td><td>' + h(z[4]) + '</td><td>' + h(z[5] + ':' + z[6]) + '</td><td class="bl">' + h(z[7] + ':' + z[8]) + '</td>'
            + (ende ? '' : '<td class="pk">' + h(z[9]) + '</td>') + '</tr>';
        }).join('') + '</tbody></table></div></div>';
    }
    if (t.kader) {
      out += '<div class="kachel' + (foto ? ' voll' : '') + '"><div class="k-kopf">Kader<span>' + t.kader.spieler.length + ' Spieler' + (/Damen|weiblich|Mädchen/i.test(t.titel) ? 'innen' : '') + '</span></div><ul class="kader">' + t.kader.spieler.map(function (s) {
        return '<li><span class="nr">' + h(s[0]) + '</span><span class="nm">' + h(s[1]) + '</span>' + (s[2] ? '<span class="pos">' + h(s[2]) + '</span>' : '') + '</li>';
      }).join('') + '</ul>' + (t.kader.betreuer.length ? '<p class="betreuer">' + betreuer(t, inhalt).map(function (b) { return h(b[0]) + (b[1] ? ' (' + h(b[1].charAt(0).toUpperCase() + b[1].slice(1)) + ')' : ''); }).join(' · ') + '</p>' : '') + '</div>';
    }
    var tr = trainingVon(t, inhalt);
    if (tr.length) out += '<div class="kachel voll"><div class="k-kopf">Training</div>' + trainerHtml(tr[0]) + zeitenHtml(tr[0].zeiten, inhalt) + '</div>';
    out += '</div>';
    return out + '</div>';
  }

  // Kalender-Abo eines Teams – steht bei „Ergebnisse & Termine“, sobald ein Team gewählt ist
  function kalenderHtml(t) {
    if (!t || !t.kalender) return '';
    var ics = new URL(t.kalender, BASIS).href, webcal = ics.replace(/^https?:/, 'webcal:');
    return '<div class="kal">Termine in den eigenen Kalender: <a href="' + h(webcal) + '">iPhone / Outlook</a>'
      + '<a href="https://calendar.google.com/calendar/r?cid=' + encodeURIComponent(webcal) + '" target="_blank" rel="noopener">Google</a><a href="' + h(ics) + '" download>Datei</a></div>';
  }

  function spieleHtml() {
    var liste = daten.spiele.filter(sichtbar);
    var letzte = liste.filter(vorbei).reverse(), naechste = liste.filter(function (s) { return !vorbei(s); });
    return '<div class="spiele">' + kachel('letzte', 'Letzte Spiele', letzte, 'Noch keine Ergebnisse.') + kachel('naechste', 'Nächste Spiele', naechste, 'Keine anstehenden Spiele.') + '</div>';
  }
  function kachel(art, titel, liste, leer) {
    var alle = !!team || alleAuf[art], zeigen = alle ? liste : liste.slice(0, MAX);
    return '<div class="kachel"><div class="k-kopf">' + titel + '<span>' + liste.length + '</span></div>' + (zeigen.length ? zeigen.map(zeile).join('') : '<p class="leer">' + leer + '</p>')
      + (!team && liste.length > MAX ? '<button class="pille mehr" data-mehr="' + art + '">' + (alleAuf[art] ? 'Weniger anzeigen' : 'Alle ' + liste.length + ' anzeigen') + '</button>' : '')
      + '</div>';
  }
  function zeile(s) {
    var l = s.vs ? live[s.vs] : null, wert, klasse = '';
    var name = function (n) { return '<span' + (eigen(n) ? ' class="ich"' : '') + '>' + h(n) + '</span>'; };
    if (l && l.stand) {
      wert = '<b class="erg">' + l.stand.gewonnen.home + ':' + l.stand.gewonnen.away + '</b><small>' + l.stand.liste.map(function (x) {
        return '<span' + (x.fertig ? '' : ' class="ls"') + '>' + x.h + ':' + x.a + '</span>'; }).join('') + '</small>';
    } else if (s.ergebnis) {
      var e = s.ergebnis.split(':').map(Number), ichHeim = eigen(s.heim), ichGast = eigen(s.gast);
      if (ichHeim !== ichGast) klasse = (ichHeim ? e[0] > e[1] : e[1] > e[0]) ? ' sieg' : ' nied';
      wert = '<b class="erg">' + h(s.ergebnis) + '</b>' + (s.saetze ? '<small>' + s.saetze.split(',').map(function (x) { return '<span>' + h(x.trim()) + '</span>'; }).join('') + '</small>' : '');
    } else if (s.datum < heute() || (l && l.aus)) {
      wert = '<span class="fehlt">Ergebnis fehlt</span>';
    } else {
      wert = '<span class="zt">' + (s.zeit ? h(s.zeit) : '–') + '</span>';
    }
    var d = datumKurz(s);
    var ort = !vorbei(s) && s.halle ? (s.adresse
      ? '<a class="ort" href="' + h(karte(s.halle + ', ' + s.adresse)) + '" target="_blank" rel="noopener">' + h(s.halle) + '</a>'
      : '<span class="ort">' + h(s.halle) + '</span>') : '';
    return '<div class="zeile' + klasse + '"' + (s.link ? ' data-link="' + h(s.link) + '" role="link" tabindex="0" title="Spiel bei ' + (s.quelle === 'lk' ? 'der Landesklasse' : 'VolleyStation') + ' ansehen"' : '') + '>'
      + '<span class="dt"><b>' + d.tag + '</b>' + d.datum + '</span>'
      + '<span class="mi"><span class="tm">' + name(s.heim) + '<span class="gg">–</span>' + name(s.gast) + '</span>'
      + '<span class="bw">' + h(s.bewerb) + '</span>' + (laeuft(s) ? '<span class="live"><i></i>LIVE</span>' : '') + ort + '</span>'
      + '<span class="wt">' + wert + '</span></div>';
  }

  function zeitenHtml(zeiten, inhalt) {
    var heuteTag = TAGE[new Date().getDay()];
    return '<ul class="tr-zeiten">' + zeiten.map(function (z) {
      var halle = (inhalt.hallen || {})[z[3]] || { name: z[3] };
      return '<li' + (z[0] === heuteTag ? ' class="heute"' : '') + '><span class="tr-tag" title="' + h(TAGE_LANG[z[0]] || z[0]) + (z[0] === heuteTag ? ' (heute)' : '') + '">' + h(z[0]) + '</span>'
        + '<span class="tr-info"><span class="tr-zeit">' + h(z[1]) + '–' + h(z[2]) + '</span>'
        + (halle.karte ? '<a class="tr-halle" href="' + h(karte(halle.karte)) + '" target="_blank" rel="noopener">' + h(halle.name) + '</a>' : '<span class="tr-halle">' + h(halle.name) + '</span>') + '</span></li>';
    }).join('') + '</ul>';
  }
  function trainerHtml(g) {
    if (!g.trainer) return '';
    return '<p class="trainer"><small>' + 'Trainer' + '</small>' + h(g.trainer).replace(/ \/ /g, ' · ') + '</p>';
  }
  function trainingHtml(inhalt) {
    if (!inhalt.training || !inhalt.training.length) return '';
    return '<section class="abschnitt" id="training"><div class="a-kopf"><div><div class="t">Trainingszeiten</div></div></div>'
      + '<div class="training">' + inhalt.training.map(function (g) {
        return '<div class="tr-karte"><div class="tr-kopf"><b>' + h(g.gruppe) + '</b>' + (g.zusatz ? '<span>' + h(g.zusatz) + '</span>' : '') + '</div>'
          + trainerHtml(g) + zeitenHtml(g.zeiten, inhalt) + '</div>';
      }).join('') + '</div></section>';
  }
  // Kontakt in einer Karte: Einladung, die Riegenleiter darunter, rechts Mail, Instagram, YouTube
  function kontaktHtml(inhalt) {
    if (!inhalt.mail && !(inhalt.personen || []).length) return '';
    var initialen = function (n) { return n.split(/\s+/).map(function (w) { return w.charAt(0); }).join('').slice(0, 2).toUpperCase(); };
    var e = String(inhalt.einladung || '').match(/^(.*?\?)\s*(.*)$/) || [null, inhalt.einladung || 'Kontakt', ''];
    var knoepfe = (inhalt.mail ? '<a class="knopf voll" href="mailto:' + h(inhalt.mail) + '">' + MAIL_ICON + h(inhalt.mail) + '</a>' : '')
      + (inhalt.instagram ? '<a class="knopf rand" href="' + h(inhalt.instagram) + '" target="_blank" rel="noopener">' + INSTA_ICON + '@' + h(inhalt.instagram.replace(/\/+$/, '').split('/').pop()) + '</a>' : '')
      + (inhalt.youtube ? '<a class="knopf rand" href="' + h(inhalt.youtube) + '" target="_blank" rel="noopener">' + YT_ICON + 'YouTube</a>' : '');
    return '<section class="abschnitt" id="kontakt"><div class="a-kopf"><div><div class="t">Kontakt</div></div></div>'
      + '<div class="ko-karte"><div class="ko-text"><b>' + h(e[1]) + '</b>' + (e[2] ? '<p>' + h(e[2]) + '</p>' : '')
      + '<div class="ko-personen">' + (inhalt.personen || []).map(function (p) {
        return '<div class="ko-person"><span class="initialen">' + h(initialen(p.name)) + '</span><span><b>' + h(p.name) + '</b><small>' + h(p.rolle) + '</small></span></div>';
      }).join('') + '</div></div><div class="ko-knoepfe">' + knoepfe + '</div></div></section>';
  }

  function archivHtml(inhalt) {
    if (!inhalt.archiv || !inhalt.archiv.length) return '';
    return '<section class="abschnitt" id="archiv"><div class="a-kopf"><div><div class="t">Archiv</div></div></div>'
      + '<div class="pillen archiv">' + inhalt.archiv.map(function (a) { return '<a class="pille" href="' + h(a.link) + '">' + h(a.saison) + '</a>'; }).join('') + '</div></section>';
  }

  // ------------------------------------------------------------------ Live-Spielstand (VolleyStation)
  // Beendete Sätze haben einen fertigen Stand, der laufende wird aus den Ballwechseln gezählt (ab der letzten Korrektur
  // des Schreibers, manualChange). Wie assets/js/startseite-spiele.js auf volley-ball.at.
  function stand(doc) {
    var cfg = doc.settings || {}, saetze = (doc.scout && doc.scout.sets) || [];
    var gewinn = cfg.winningScore || 3, gewonnen = { home: 0, away: 0 }, liste = [];
    saetze.forEach(function (satz, i) {
      var p = { home: 0, away: 0 };
      (satz.events || []).forEach(function (ev) {
        if (ev.manualChange && ev.manualChange.score) p = { home: ev.manualChange.score.home || 0, away: ev.manualChange.score.away || 0 };
        else if (ev.rally && ev.rally.point) p[ev.rally.point]++;
      });
      if (satz.endTime && satz.score) p = { home: satz.score.home || 0, away: satz.score.away || 0 };
      var ziel = i + 1 === gewinn * 2 - 1 ? (cfg.decidingSetWin || 15) : (cfg.regularSetWin || 25);
      var fertig = !!(satz.endTime && satz.score) || (Math.max(p.home, p.away) >= ziel && Math.abs(p.home - p.away) >= 2);
      if (fertig) gewonnen[p.home > p.away ? 'home' : 'away']++;
      liste.push({ h: p.home, a: p.away, fertig: fertig });
    });
    return { liste: liste, gewonnen: gewonnen, aus: Math.max(gewonnen.home, gewonnen.away) >= gewinn || !!(doc.scout && doc.scout.ended) };
  }
  function standNeu(id, doc) {
    var s = stand(doc), punkte = s.liste.reduce(function (n, x) { return n + x.h + x.a; }, 0);
    if (!punkte) return;   // angesetzt, aber noch kein Punkt
    live[id] = { stand: s, aus: s.aus };
    spaeter();
  }
  function verbinden(id) {
    if (sockets[id] || typeof window.io !== 'function') return;
    var socket = window.io(VS.host, { path: VS.pfad, transports: ['websocket'], reconnection: true, reconnectionDelayMax: 10000,
      query: { connectionPathName: '/app/widget/scoreboard/' + id, token: VS.token } });
    sockets[id] = socket;
    socket.on('connect', function () {
      socket.emit('find', VS.dienst, { matchId: id, $limit: 1 }, function (err, res) {
        var doc = res && Array.isArray(res.data) ? res.data[0] : res;
        if (!err && doc) standNeu(id, doc);
      });
    });
    ['created', 'updated', 'patched'].forEach(function (art) {
      socket.on(VS.dienst + ' ' + art, function (doc) { if (doc && Number(doc.matchId) === id) standNeu(id, doc); });
    });
  }
  function liveSuchen() {
    if (!daten) return;
    var jetzt = Date.now(), ids = [];
    daten.spiele.forEach(function (s) {
      if (!s.vs || s.vs < 0) return;   // < 0: Vorführung
      var t = anpfiff(s);
      if (!s.ergebnis && jetzt >= t - VOR && jetzt <= t + NACHSCHAU) ids.push(s.vs);
      else if (sockets[s.vs]) { sockets[s.vs].close(); delete sockets[s.vs]; }
    });
    if (!ids.length) return;
    if (typeof window.io === 'function') { ids.forEach(verbinden); return; }
    if (ioLaedt) return;
    ioLaedt = true;   // socket.io nur laden, wenn wirklich ein Spiel läuft (VolleyStation spricht socket.io 4)
    var sc = document.createElement('script');
    sc.src = 'https://cdnjs.cloudflare.com/ajax/libs/socket.io/4.7.5/socket.io.min.js';
    sc.onload = liveSuchen;
    document.head.appendChild(sc);
  }

  // ------------------------------------------------------------------ Vorführung: ?livedemo in der Adresse
  // Tut so, als liefe gerade das nächste Heimspiel (ohne VolleyStation), und zählt alle paar Sekunden einen Punkt weiter.
  var DEMO = /[?&]livedemo(&|=|$)/.test(location.search), DEMO_ID = -1, demoTakt = null;
  function demo() {
    var s = daten.spiele.filter(function (x) { return x.ergebnis == null && eigen(x.heim) && x.datum >= heute(); })[0];
    if (!s) return;
    var vor40 = new Date(Date.now() - 40 * 60000);
    s.vs = DEMO_ID; s.datum = heute(); s.zeit = zwei(vor40.getHours()) + ':' + zwei(vor40.getMinutes());
    if (!live[DEMO_ID]) live[DEMO_ID] = { aus: false, stand: { gewonnen: { home: 1, away: 1 },
      liste: [{ h: 25, a: 21, fertig: true }, { h: 23, a: 25, fertig: true }, { h: 17, a: 15, fertig: false }] } };
    if (demoTakt) return;
    demoTakt = setInterval(function () {
      var st = live[DEMO_ID].stand, satz = st.liste[st.liste.length - 1];
      if (live[DEMO_ID].aus) return;
      if (Math.random() < 0.55) satz.h++; else satz.a++;
      var ziel = st.liste.length === 5 ? 15 : 25;
      if (Math.max(satz.h, satz.a) >= ziel && Math.abs(satz.h - satz.a) >= 2) {
        satz.fertig = true;
        st.gewonnen[satz.h > satz.a ? 'home' : 'away']++;
        if (Math.max(st.gewonnen.home, st.gewonnen.away) >= 3) { live[DEMO_ID].aus = true; st.aus = true; }
        else st.liste.push({ h: 0, a: 0, fertig: false });
      }
      spaeter();
    }, 2500);
  }

  // ------------------------------------------------------------------ Laden
  function laden(erstes) {
    return fetch(BASIS + 'daten.json?t=' + Math.floor(Date.now() / 60000), { cache: 'no-cache' }).then(function (a) {
      if (!a.ok) throw new Error(a.status);
      return a.json();
    }).then(function (d) {
      daten = d;
      jimdoKopf(d.inhalt || {});
      if (DEMO) demo();
      if (team && !teamVon(team)) team = null;
      zeichnen();
      liveSuchen();
    }).catch(function () {
      if (erstes) wurzel.querySelector('.inhalt').innerHTML = '<div class="fehler">Spiele und Tabellen konnten gerade nicht geladen werden. Bitte später noch einmal versuchen.</div>';
    });
  }
  function hin(id) { var el = wurzel.getElementById ? wurzel.getElementById(id) : wurzel.querySelector('#' + id); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }

  // Auf der Volleyball-Seite Kopfbild und Menü von Jimdo ausblenden – zurück geht es über den Link „Turnerschaft Hohenems“
  // im Widget. Fuß mit Impressum und Datenschutz bleibt. Schalter: inhalt.json → jimdoKopfAusblenden
  function jimdoKopf(inhalt) {
    var id = 'tsh-volleyball-jimdo-kopf', alt = document.getElementById(id);
    if (!inhalt.jimdoKopfAusblenden) { if (alt) alt.remove(); return; }
    if (alt) return;
    var st = document.createElement('style');
    st.id = id;
    st.textContent = '.jtpl-header,.jtpl-navigation,.jtpl-mobile-topbar,.jtpl-mobile-navigation{display:none!important}'
      + '.jtpl-content{padding-top:24px!important}.jtpl-content__inner{padding-top:0!important}';
    document.head.appendChild(st);
  }

  function start() {
    host = document.getElementById('tsh-volleyball');
    if (!host) { host = document.createElement('div'); host.id = 'tsh-volleyball'; skript.parentNode.insertBefore(host, skript); }
    wurzel = host.attachShadow ? host.attachShadow({ mode: 'open' }) : host;
    wurzel.innerHTML = '<style>' + CSS + '\n.logo{--logo:url("' + BASIS + 'logo.png")}.zeichen{--zeichen:url("' + BASIS + 'ball-zeichen.png")}</style><div class="inhalt"><p class="leer">Wird geladen …</p></div>';
    wurzel.addEventListener('click', function (e) {
      var ziel = e.target.closest('[data-team],[data-mehr],[data-link],[data-ziel],a');
      if (!ziel || ziel.tagName === 'A') return;
      if (ziel.hasAttribute('data-team')) {
        team = ziel.getAttribute('data-team') || null;
        zeichnen();
        if (ziel.classList.contains('karte')) hin('teams');
      } else if (ziel.hasAttribute('data-mehr')) {
        alleAuf[ziel.getAttribute('data-mehr')] = !alleAuf[ziel.getAttribute('data-mehr')];
        zeichnen();
      } else if (ziel.hasAttribute('data-ziel')) {
        hin(ziel.getAttribute('data-ziel'));
      } else if (ziel.hasAttribute('data-link')) {
        window.open(ziel.getAttribute('data-link'), '_blank', 'noopener');
      }
    });
    wurzel.addEventListener('keydown', function (e) {
      if ((e.key === 'Enter' || e.key === ' ') && e.target.hasAttribute && e.target.hasAttribute('data-link')) { e.preventDefault(); window.open(e.target.getAttribute('data-link'), '_blank', 'noopener'); }
    });
    laden(true);
    setInterval(function () { if (!document.hidden) laden(false); }, NEU_LADEN);
    setInterval(function () { liveSuchen(); spaeter(); }, 60000);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
