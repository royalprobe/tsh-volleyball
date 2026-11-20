/*
 * Volleyball der TS Hohenems – Widget für die Jimdo-Homepage (Element „Widget/HTML“):
 *
 *   <div id="tsh-volleyball"></div>
 *   <script src="https://royalprobe.github.io/tsh-volleyball/tsh-volleyball.js" defer></script>
 *
 * Zeigt alle Teams mit Tabellenplatz, Form und nächstem Spiel, je Team Tabelle, Kader und Kalender, dazu die letzten und
 * nächsten Spiele. Läuft ein Spiel, das mit VolleyStation gescort wird, steht der Spielstand live in der Zeile.
 * Die Daten (daten.json) sammelt alle 15 Minuten ein GitHub-Workflow (holen.mjs). Das Widget lebt in einem Shadow DOM:
 * die Stile der Homepage greifen nicht hinein, nur die Schrift wird übernommen.
 */
(function () {
  'use strict';
  var skript = document.currentScript;
  var BASIS = skript ? skript.src.replace(/[^/]*(\?.*)?$/, '') : './';
  var MAX = 8;                                  // je Kachel, solange „Alle Teams“ gewählt ist
  var VOR = 5 * 60000, NACH = 150 * 60000;      // Live-Fenster rund um den Anpfiff
  var NACHSCHAU = 6 * 3600000;                  // so lange ohne Ergebnis den Endstand aus dem Live-Spielstand zeigen
  var NEU_LADEN = 5 * 60000;                    // daten.json im Hintergrund neu holen
  var VS = { host: 'https://live.widgets.volleystation.com', pfad: '/api/socket.io',
             token: 'PhodQuahof1ShmunWoifdedgasvuipki',   // steht offen im Widget-Bundle von VolleyStation
             dienst: 'widget/play-by-play' };
  var TAGE = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

  var CSS = [
    ':host{all:initial;display:block;font-family:inherit;color:#1f2937;--blau:#002266;--blau-2:#6592a7;--blau-hell:#eef3f8;--rand:#dfe6ee;--grau:#64748b;--grau-2:#94a3b8;--gruen:#15803d;--rot:#c81e1e;--live:#d6001c}',
    '*{box-sizing:border-box}',
    '.w{container-type:inline-size;display:flex;flex-direction:column;gap:18px;font-size:15px;line-height:1.45}',
    'button{font:inherit;color:inherit;background:none;border:0;padding:0;cursor:pointer}',
    'a{color:inherit;text-decoration:none}',
    '.kopf{display:flex;flex-wrap:wrap;align-items:flex-end;justify-content:space-between;gap:8px 20px;padding-bottom:14px;border-bottom:3px solid var(--blau)}',
    '.logo{display:block;width:min(100%,420px);aspect-ratio:640/115;background:var(--blau);-webkit-mask:var(--logo) center/contain no-repeat;mask:var(--logo) center/contain no-repeat}',
    '.kopf p{margin:0;color:var(--grau);font-size:.85em;font-weight:600;letter-spacing:.02em}',
    '.pillen{display:flex;flex-wrap:wrap;gap:6px}',
    '.pille{padding:7px 14px;border-radius:999px;border:1px solid var(--rand);background:#fff;font-weight:600;font-size:.88em;white-space:nowrap;transition:background .15s,color .15s,border-color .15s}',
    '.pille:hover{border-color:var(--blau);color:var(--blau)}',
    '.pille[aria-pressed=true]{background:var(--blau);border-color:var(--blau);color:#fff}',
    '.karten{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:12px}',
    '.karte{display:flex;flex-direction:column;gap:10px;padding:14px 16px;text-align:left;background:#fff;border:1px solid var(--rand);border-top:4px solid var(--blau);border-radius:10px;transition:box-shadow .15s,transform .15s}',
    '.karte:hover{box-shadow:0 8px 22px rgba(0,34,102,.12);transform:translateY(-1px)}',
    '.karte:focus-visible,.pille:focus-visible,.zeile:focus-visible{outline:2px solid var(--blau);outline-offset:2px}',
    '.k-titel{font-size:1.2em;font-weight:800;color:var(--blau);line-height:1.15;text-transform:uppercase;letter-spacing:.01em}',
    '.k-bewerb{font-size:.78em;color:var(--grau)}',
    '.k-stand{display:flex;align-items:center;flex-wrap:wrap;gap:4px 10px;font-variant-numeric:tabular-nums}',
    '.k-platz{font-size:.82em;color:var(--grau)}',
    '.k-platz b{font-size:1.9em;font-weight:800;color:var(--blau);line-height:1;margin-right:2px}',
    '.k-bilanz{font-size:.82em;font-weight:600}',
    '.form{display:inline-flex;gap:3px;margin-left:auto}',
    '.form i{width:19px;height:19px;display:inline-grid;place-items:center;border-radius:4px;font-style:normal;font-size:.66em;font-weight:800;color:#fff}',
    '.form .s{background:var(--gruen)}.form .n{background:var(--rot)}',
    '.k-naechstes{margin-top:auto;padding-top:9px;border-top:1px solid var(--rand);font-size:.84em;line-height:1.35}',
    '.k-naechstes small{display:block;font-size:.82em;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:var(--grau-2)}',
    '.k-naechstes b{font-weight:700}',
    '.k-live{display:inline-flex;margin-left:6px}',
    '.detail{display:flex;flex-direction:column;gap:14px}',
    '.d-kopf{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:10px 20px;padding:14px 18px;color:#fff;background:var(--blau);border-radius:10px}',
    '.d-kopf .t{font-size:1.5em;font-weight:800;text-transform:uppercase;line-height:1.1}',
    '.d-kopf p{margin:2px 0 0;font-size:.82em;opacity:.8}',
    '.zahlen{display:flex;gap:20px}',
    '.zahlen span{display:flex;flex-direction:column;align-items:center}',
    '.zahlen b{font-size:1.8em;font-weight:800;line-height:1;font-variant-numeric:tabular-nums}',
    '.zahlen small{font-size:.66em;font-weight:700;letter-spacing:.06em;text-transform:uppercase;opacity:.75}',
    '.kachel{min-width:0;padding:16px 18px;background:#fff;border:1px solid var(--rand);border-radius:10px}',
    '.k-kopf{margin:0 0 10px;padding-bottom:7px;border-bottom:2px solid var(--blau);font-size:.8em;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--blau)}',
    '.spiele{display:grid;grid-template-columns:1fr 1fr;gap:14px;align-items:start}',
    '.tab{overflow-x:auto}',
    'table{width:100%;border-collapse:collapse;font-size:.88em;font-variant-numeric:tabular-nums}',
    'th{padding:5px 7px;text-align:right;font-size:.75em;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:var(--grau-2);border-bottom:1px solid var(--rand)}',
    'td{padding:8px 7px;text-align:right;border-bottom:1px solid var(--rand);white-space:nowrap}',
    'tr:last-child td{border-bottom:0}',
    '.team{text-align:left;width:100%;white-space:normal;font-weight:600}',
    'td.pl{color:var(--grau-2)}td.pk{font-weight:800}',
    'tr.ich td{background:var(--blau-hell)}tr.ich .team,tr.ich .pk{color:var(--blau);font-weight:800}',
    '.kader{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:0 22px}',
    '.kader li{display:flex;align-items:baseline;gap:10px;padding:6px 0;border-bottom:1px solid var(--rand)}',
    '.kader .nr{flex:none;width:1.8em;text-align:right;font-weight:800;color:var(--blau);font-variant-numeric:tabular-nums}',
    '.kader .nm{font-weight:600}.kader .pos{margin-left:auto;font-size:.8em;color:var(--grau-2);white-space:nowrap}',
    '.betreuer{margin:10px 0 0;font-size:.85em;color:var(--grau)}',
    '.kal{margin:0;font-size:.82em;color:var(--grau)}',
    '.kal a{color:var(--blau);text-decoration:underline;text-underline-offset:2px;font-weight:600}',
    '.zeile{display:grid;grid-template-columns:3.1em 1fr auto;align-items:center;gap:2px 12px;padding:8px 6px;margin:0 -6px;border-top:1px solid var(--rand);border-radius:6px;font-size:.92em}',
    '.k-kopf+.zeile{border-top-color:transparent}',
    '.zeile[data-link]{cursor:pointer}.zeile[data-link]:hover{background:var(--blau-hell)}',
    '.dt{display:flex;flex-direction:column;align-items:center;line-height:1.2;font-size:.82em;color:var(--grau);font-variant-numeric:tabular-nums}',
    '.dt b{font-size:1.1em;color:#111827}',
    '.mi{min-width:0;display:flex;flex-wrap:wrap;align-items:center;gap:3px 6px}',
    '.tm{flex:1 1 100%;min-width:0;display:flex;flex-wrap:wrap;column-gap:5px;font-weight:600;color:#111827}',
    '.tm .gg{color:var(--grau-2);font-weight:400}',
    '.tm .ich{color:var(--blau);font-weight:800}',
    '.bw{padding:1px 8px;border-radius:999px;font-size:.74em;font-weight:600;color:var(--blau);background:var(--blau-hell);white-space:nowrap}',
    '.ort{font-size:.76em;color:var(--grau)}',
    'a.ort:hover{color:var(--blau);text-decoration:underline}',
    '.wt{text-align:right;white-space:nowrap}',
    '.erg{font-size:1.2em;font-weight:800;color:#111827;line-height:1}',
    '.wt small{display:block;max-width:12em;margin-left:auto;white-space:normal;font-size:.7em;line-height:1.15;color:var(--grau-2)}',
    '.wt small span{display:inline-block;white-space:nowrap}.wt small span+span{margin-left:.45em}',
    '.wt .ls{color:var(--live);font-weight:700}',
    '.sieg .erg{color:var(--gruen)}.nied .erg{color:var(--rot)}',
    '.zt{font-weight:700;color:var(--grau)}',
    '.fehlt{font-size:.82em;color:var(--grau-2)}',
    '.live{display:inline-flex;align-items:center;gap:5px;padding:1px 8px;border-radius:999px;font-size:.7em;font-weight:800;letter-spacing:.06em;color:#fff;background:var(--live)}',
    '.live i{width:6px;height:6px;border-radius:50%;background:#fff;animation:p 1.4s ease-in-out infinite}',
    '@keyframes p{50%{opacity:.25}}',
    '@media (prefers-reduced-motion:reduce){.live i{animation:none}.karte{transition:none}}',
    '.leer{margin:6px 0;color:var(--grau-2)}',
    '.mehr{margin-top:10px}',
    '.fuss{margin:-6px 0 0;font-size:.72em;color:var(--grau-2);text-align:right}',
    '.fehler{padding:14px 16px;border-radius:10px;background:var(--blau-hell);color:var(--grau)}',
    '@container (max-width:720px){.spiele{grid-template-columns:1fr}.karten{grid-template-columns:1fr 1fr}}',
    '@container (max-width:520px){.w{font-size:14px}.karten{grid-template-columns:1fr;gap:8px}.pillen{flex-wrap:nowrap;overflow-x:auto;scrollbar-width:none;margin:0 -2px;padding:1px 2px}.pillen::-webkit-scrollbar{display:none}',
    '.kachel{padding:14px}.tm{flex-direction:column}.tm .gg{display:none}.tm>span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.wt small{max-width:6.2em}th.bl,td.bl{display:none}.d-kopf .t{font-size:1.25em}.zahlen{gap:14px}}'
  ].join('\n');

  // ------------------------------------------------------------------ Zustand
  var host, wurzel, daten = null, team = null, alleAuf = { letzte: false, naechste: false };
  var live = {};          // Match-ID -> { stand, aus }
  var sockets = {};       // Match-ID -> socket
  var ioLaedt = false, zeichnenGeplant = false;

  function h(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function klein(s) { return String(s || '').toLowerCase().replace(/\s+/g, ' ').trim(); }
  function heute() { var d = new Date(); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  function anpfiff(s) { return new Date(s.datum + 'T' + (s.zeit || '20:00') + ':00').getTime(); }   // Ortszeit des Browsers
  function eigen(name) { return daten && daten.teams.some(function (t) { return klein(t.name) === klein(name); }); }
  function teamVon(id) { for (var i = 0; i < daten.teams.length; i++) if (daten.teams[i].id === id) return daten.teams[i]; return null; }

  /** vorbei = Ergebnis da, Live-Spiel beendet oder Tag vorbei */
  function vorbei(s) { return s.ergebnis != null || (s.vs && live[s.vs] && live[s.vs].aus) || s.datum < heute(); }
  function sichtbar(s) { return !team || s.teams.indexOf(team) >= 0; }

  // ------------------------------------------------------------------ Darstellung
  function zeichnen() {
    zeichnenGeplant = false;
    if (!daten) return;
    var scroll = wurzel.querySelector('.pillen'); scroll = scroll ? scroll.scrollLeft : 0;
    var html = '<div class="w">'
      + '<div class="kopf"><span class="logo" role="img" aria-label="Turnerschaft Hohenems Volleyball"></span>'
      + '<p>Saison ' + h(daten.saison) + ' · Spiele, Ergebnisse, Tabellen</p></div>'
      + '<div class="pillen" role="group" aria-label="Team wählen">'
      + '<button class="pille" data-team="" aria-pressed="' + !team + '">Alle Teams</button>'
      + daten.teams.map(function (t) { return '<button class="pille" data-team="' + h(t.id) + '" aria-pressed="' + (team === t.id) + '">' + h(t.titel) + '</button>'; }).join('')
      + '</div>'
      + (team ? detailHtml(teamVon(team)) : kartenHtml())
      + spieleHtml()
      + '<p class="fuss">Stand ' + h(new Date(daten.stand).toLocaleString('de-AT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }))
      + ' · Daten: vvv.volleynet.at, VolleyStation</p>'
      + '</div>';
    wurzel.querySelector('.inhalt').innerHTML = html;
    var p = wurzel.querySelector('.pillen');
    if (p) {
      p.scrollLeft = scroll;
      var aktiv = p.querySelector('[aria-pressed="true"]');
      if (aktiv && (aktiv.offsetLeft < p.scrollLeft || aktiv.offsetLeft + aktiv.offsetWidth > p.scrollLeft + p.clientWidth)) p.scrollLeft = aktiv.offsetLeft - 16;
    }
  }
  function spaeter() { if (!zeichnenGeplant) { zeichnenGeplant = true; requestAnimationFrame(zeichnen); } }

  function form(t) {
    return daten.spiele.filter(function (s) { return s.teams.indexOf(t.id) >= 0 && /^\d+:\d+$/.test(s.ergebnis || ''); }).slice(-5).map(function (s) {
      var e = s.ergebnis.split(':').map(Number), heim = klein(s.heim) === klein(t.name);
      var sieg = heim ? e[0] > e[1] : e[1] > e[0];
      return '<i class="' + (sieg ? 's' : 'n') + '" title="' + h((heim ? s.gast : s.heim) + ' ' + (heim ? e[0] + ':' + e[1] : e[1] + ':' + e[0])) + '">' + (sieg ? 'S' : 'N') + '</i>';
    }).join('');
  }
  function naechstes(t) {
    var offen = daten.spiele.filter(function (s) { return s.teams.indexOf(t.id) >= 0 && !vorbei(s); });
    return offen[0] || null;
  }
  function wann(s, kurz) {
    var d = new Date(s.datum + 'T12:00:00');
    return TAGE[d.getDay()] + ' ' + ('0' + d.getDate()).slice(-2) + '.' + ('0' + (d.getMonth() + 1)).slice(-2) + '.' + (s.zeit && !kurz ? ' · ' + s.zeit : '');
  }

  function kartenHtml() {
    return '<div class="karten">' + daten.teams.map(function (t) {
      var p = t.platz, n = naechstes(t), f = form(t);
      var stand = p && p.sp > 0
        ? '<span class="k-platz"><b>' + h(p.platz) + '.</b> von ' + p.von + '</span><span class="k-bilanz">' + (p.pkt !== '' ? h(p.pkt) + ' Pkt · ' : '') + p.s + ' S, ' + p.n + ' N</span>'
        : '<span class="k-bilanz">noch kein Spiel</span>';
      var nae = n ? '<small>Nächstes Spiel · ' + h(wann(n)) + '</small>' + (klein(n.heim) === klein(t.name) ? 'Heim gegen ' : 'Auswärts bei ')
          + '<b>' + h(klein(n.heim) === klein(t.name) ? n.gast : n.heim) + '</b>' + (n.vs && live[n.vs] && live[n.vs].stand ? '<span class="k-live"><span class="live"><i></i>LIVE</span></span>' : '')
        : '<small>Kein Spiel mehr angesetzt</small>';
      return '<button class="karte" data-team="' + h(t.id) + '"><span class="k-titel">' + h(t.titel) + '</span>'
        + '<span class="k-bewerb">' + h(t.bewerbe.join(' · ')) + '</span>'
        + '<span class="k-stand">' + stand + (f ? '<span class="form" aria-label="Letzte Spiele">' + f + '</span>' : '') + '</span>'
        + '<span class="k-naechstes">' + nae + '</span></button>';
    }).join('') + '</div>';
  }

  function detailHtml(t) {
    if (!t) return '';
    var p = t.platz, out = '<div class="detail"><div class="d-kopf"><div><div class="t">' + h(t.titel) + '</div><p>' + h(t.name) + ' · ' + h(t.bewerbe.join(' · ')) + '</p></div>';
    if (p && p.sp > 0) {
      out += '<div class="zahlen"><span><b>' + h(p.platz) + '.</b><small>Platz</small></span>' + (p.pkt !== '' ? '<span><b>' + h(p.pkt) + '</b><small>Punkte</small></span>' : '')
        + '<span><b>' + p.s + ':' + p.n + '</b><small>Siege</small></span></div>';
    }
    out += '</div>';
    if (t.tabelle) {
      var tb = t.tabelle, ende = tb.endstand;
      var titel = (ende ? 'Endstand' : 'Tabelle') + ' · ' + (t.quelle === 'lk' ? tb.name : t.bewerbe[0] + (/^(Meisterschaftsphase|Landesmeisterschaft|Nachwuchsliga)$/.test(tb.name) ? '' : ' · ' + tb.name));
      out += '<div class="kachel"><div class="k-kopf">' + h(titel) + '</div><div class="tab"><table><thead><tr><th>#</th><th class="team">Team</th><th>Sp</th><th>S</th><th>N</th><th>Sätze</th><th class="bl">Bälle</th>'
        + (ende ? '' : '<th>Pkt</th>') + '</tr></thead><tbody>' + tb.zeilen.map(function (z) {
          return '<tr' + (klein(z[1]) === klein(t.name) ? ' class="ich"' : '') + '><td class="pl">' + h(z[0]) + '</td><td class="team">' + h(z[1].replace(/\s+U\d\d\s+(weiblich|männlich)$/i, ''))
            + '</td><td>' + h(z[2]) + '</td><td>' + h(z[3]) + '</td><td>' + h(z[4]) + '</td><td>' + h(z[5] + ':' + z[6]) + '</td><td class="bl">' + h(z[7] + ':' + z[8]) + '</td>'
            + (ende ? '' : '<td class="pk">' + h(z[9]) + '</td>') + '</tr>';
        }).join('') + '</tbody></table></div></div>';
    }
    if (t.kader) {
      out += '<div class="kachel"><div class="k-kopf">Kader</div><ul class="kader">' + t.kader.spieler.map(function (s) {
        return '<li><span class="nr">' + h(s[0]) + '</span><span class="nm">' + h(s[1]) + '</span>' + (s[2] ? '<span class="pos">' + h(s[2]) + '</span>' : '') + '</li>';
      }).join('') + '</ul>' + (t.kader.betreuer.length ? '<p class="betreuer">' + t.kader.betreuer.map(function (b) { return h(b[0]) + (b[1] ? ' (' + h(b[1]) + ')' : ''); }).join(' · ') + '</p>' : '') + '</div>';
    }
    var ics = new URL(t.kalender, BASIS).href, webcal = ics.replace(/^https?:/, 'webcal:');
    out += '<p class="kal">Termine von ' + h(t.titel) + ' in den eigenen Kalender: <a href="' + h(webcal) + '">iPhone/Outlook</a> · '
      + '<a href="https://calendar.google.com/calendar/r?cid=' + encodeURIComponent(webcal) + '" target="_blank" rel="noopener">Google</a> · <a href="' + h(ics) + '" download>Datei</a></p>';
    return out + '</div>';
  }

  function spieleHtml() {
    var liste = daten.spiele.filter(sichtbar);
    var letzte = liste.filter(vorbei).reverse(), naechste = liste.filter(function (s) { return !vorbei(s); });
    return '<div class="spiele">' + kachel('letzte', 'Letzte Spiele', letzte, 'Noch keine Ergebnisse.') + kachel('naechste', 'Nächste Spiele', naechste, 'Keine anstehenden Spiele.') + '</div>';
  }
  function kachel(art, titel, liste, leer) {
    var alle = !!team || alleAuf[art], zeigen = alle ? liste : liste.slice(0, MAX);
    return '<div class="kachel"><div class="k-kopf">' + titel + '</div>' + (zeigen.length ? zeigen.map(zeile).join('') : '<p class="leer">' + leer + '</p>')
      + (!team && liste.length > MAX ? '<button class="pille mehr" data-mehr="' + art + '">' + (alleAuf[art] ? 'Weniger anzeigen' : 'Alle ' + liste.length + ' Spiele anzeigen') + '</button>' : '')
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
    var d = new Date(s.datum + 'T12:00:00');
    var ort = !vorbei(s) && s.halle ? (s.adresse
      ? '<a class="ort" href="https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(s.halle + ', ' + s.adresse) + '" target="_blank" rel="noopener">' + h(s.halle) + '</a>'
      : '<span class="ort">' + h(s.halle) + '</span>') : '';
    return '<div class="zeile' + klasse + '"' + (s.link ? ' data-link="' + h(s.link) + '" role="link" tabindex="0" title="Spiel bei ' + (s.quelle === 'lk' ? 'der Landesklasse' : 'VolleyStation') + ' ansehen"' : '') + '>'
      + '<span class="dt"><b>' + TAGE[d.getDay()] + '</b>' + ('0' + d.getDate()).slice(-2) + '.' + ('0' + (d.getMonth() + 1)).slice(-2) + '.</span>'
      + '<span class="mi"><span class="tm">' + name(s.heim) + '<span class="gg">–</span>' + name(s.gast) + '</span>'
      + '<span class="bw">' + h(s.bewerb) + '</span>' + (l && l.stand && !l.aus ? '<span class="live"><i></i>LIVE</span>' : '') + ort + '</span>'
      + '<span class="wt">' + wert + '</span></div>';
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
    return { liste: liste, gewonnen: gewonnen, aus: Math.max(gewonnen.home, gewonnen.away) >= gewinn || !!doc.scout && !!doc.scout.ended };
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
      if (!s.vs) return;
      var t = anpfiff(s);
      // ab 5 Minuten vor dem Anpfiff; ohne Ergebnis bis 6 Stunden danach (Überlänge, Endstand bis volleynet ihn hat)
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

  // ------------------------------------------------------------------ Laden
  function laden(erstes) {
    return fetch(BASIS + 'daten.json?t=' + Math.floor(Date.now() / 60000), { cache: 'no-cache' }).then(function (a) {
      if (!a.ok) throw new Error(a.status);
      return a.json();
    }).then(function (d) {
      daten = d;
      if (team && !teamVon(team)) team = null;
      zeichnen();
      liveSuchen();
    }).catch(function () {
      if (erstes) wurzel.querySelector('.inhalt').innerHTML = '<div class="fehler">Spiele und Tabellen konnten gerade nicht geladen werden. Bitte später noch einmal versuchen.</div>';
    });
  }

  function start() {
    host = document.getElementById('tsh-volleyball');
    if (!host) { host = document.createElement('div'); host.id = 'tsh-volleyball'; skript.parentNode.insertBefore(host, skript); }
    wurzel = host.attachShadow ? host.attachShadow({ mode: 'open' }) : host;
    wurzel.innerHTML = '<style>' + CSS + '\n.logo{--logo:url("' + BASIS + 'logo.png")}</style><div class="inhalt"><p class="leer">Spiele werden geladen …</p></div>';
    wurzel.addEventListener('click', function (e) {
      var ziel = e.target.closest('[data-team],[data-mehr],[data-link],a');
      if (!ziel || ziel.tagName === 'A') return;
      if (ziel.hasAttribute('data-team')) {
        team = ziel.getAttribute('data-team') || null;
        zeichnen();
        if (ziel.classList.contains('karte')) { var p = wurzel.querySelector('.pillen'); if (p && p.getBoundingClientRect().top < 0) p.scrollIntoView({ block: 'start', behavior: 'smooth' }); }
      } else if (ziel.hasAttribute('data-mehr')) {
        alleAuf[ziel.getAttribute('data-mehr')] = !alleAuf[ziel.getAttribute('data-mehr')];
        zeichnen();
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
