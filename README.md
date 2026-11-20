# TSH-Volleyball

Volleyball-Widget der TS Hohenems für die Vereinshomepage (Jimdo, Seite [Sparten › Volleyball](https://www.ts-hohenems.at/sparten/volleyball/)):
alle Teams mit Tabellenplatz, Form und nächstem Spiel, je Team Tabelle, Kader und Kalender zum Abonnieren, dazu die letzten
und nächsten Spiele mit Live-Spielstand. Läuft komplett auf GitHub (kostenlos), nicht über volley-ball.at.

## Einbinden in Jimdo

Auf der Seite ein Element **Widget/HTML** einfügen und das hineinkopieren:

```html
<div id="tsh-volleyball"></div>
<script src="https://royalprobe.github.io/tsh-volleyball/tsh-volleyball.js" defer></script>
```

Das Widget lebt in einem Shadow DOM: Jimdo-Stile greifen nicht hinein, die Schrift der Homepage wird übernommen.
Farbe (Blau `#002266` wie die Homepage) und Logo stehen in `public/tsh-volleyball.js` bzw. `public/logo.png`.

## Wie es funktioniert

| Teil | Datei | |
|---|---|---|
| Datensammler | `holen.mjs` | schreibt `public/daten.json` (fürs Widget), `public/stand.json` (interner Stand), `public/kalender/*.ics` |
| Widget | `public/tsh-volleyball.js` | lädt `daten.json`, alle 5 min neu; Live-Spielstand direkt von VolleyStation |
| Panel-Zugang | `lib/panel.mjs` | VolleyStation-Match-IDs (für Live), einmal am Tag |
| Workflow | `.github/workflows/daten.yml` | alle 15 min `holen.mjs`, veröffentlicht `public/` auf GitHub Pages, nur bei Änderungen |
| Vorschau | `vorschau.mjs` | `npm run vorschau` → http://localhost:8097/ (echte Jimdo-Seite mit Widget), `/?leer` nur das Widget |

Quellen:

- **vvv.volleynet.at** (robots.txt erlaubt es): Termine, Ergebnisse, Kader. Die Seiten sind langsam, darum Termine und Kader
  nur einmal am Tag ab 18 Uhr, Ergebnisse nur für Phasen mit angepfiffenen Spielen ohne Ergebnis. Tabellen rechnet
  `holen.mjs` selbst (die volleynet-Tabellen sind fehlerhaft). Liga 3:0/3:1 = 3, 3:2 = 2, 2:3 = 1 Punkt; Nachwuchs 2-0.
- **volley-ball.at/landesklasse/api.php?p=liga** (nur lesen): Mixed-Teams der Landesklasse. 2:0 = 3, 2:1 = 2, 1:2 = 1 Punkt.
- **VolleyStation**: Panel-API mit dem Zugang `ts.hohenems.volleyball` für die Match-IDs (Secrets `VS_USER`/`VS_PASS`,
  lokal `.env`), der Live-Spielstand kommt im Browser aus dem öffentlichen Datenstrom hinter den VolleyStation-Widgets
  (inoffiziell, Details in `VScode\VolleyStation\README.md`). Ohne Zugang läuft alles, nur ohne Live.

Teams werden am Namensteil „Hohenems“ erkannt (`VEREIN`). Neue Saison: in `holen.mjs` die volleynet-Phasen (`PHASEN`) und die
VolleyStation-Ligen (`BEWERBE`) anpassen – stehen auch in `vvv-website/includes/volleynet.php` und `includes/config.php`.

Der Workflow macht alle 40 Tage einen leeren Commit, weil GitHub zeitgesteuerte Workflows in öffentlichen Repos nach
60 Tagen ohne Commit abschaltet.
