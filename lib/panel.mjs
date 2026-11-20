// VolleyStation-Panel (panel.volleystation.com, Django-REST-API, Anmeldung per Session-Cookie): Liste der Spiele mit ihrer
// Match-ID. Die ID braucht das Widget für den Live-Spielstand (öffentlicher Datenstrom hinter den VolleyStation-Widgets).
// Nur lesen, einmal am Tag. Login-Ablauf wie VScode\VolleyStation\explore.mjs.
const BASE = 'https://panel.volleystation.com';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';

const jar = new Map();
const merken = (a) => { for (const roh of a.headers.getSetCookie?.() ?? []) { const [paar] = roh.split(';'); const i = paar.indexOf('='); if (i > 0) jar.set(paar.slice(0, i).trim(), paar.slice(i + 1).trim()); } };
const kekse = () => [...jar].map(([k, v]) => `${k}=${v}`).join('; ');

async function get(url, accept = 'application/json') {
  const a = await fetch(url, { headers: { 'User-Agent': UA, Accept: accept, Cookie: kekse() }, redirect: 'manual', signal: AbortSignal.timeout(60000) });
  merken(a);
  return a;
}

async function anmelden(user, pass) {
  const seite = await (await get(`${BASE}/accounts/login/?next=/season/`, 'text/html')).text();
  const token = seite.match(/name="csrfmiddlewaretoken"\s+value="([^"]+)"/)?.[1];
  if (!token) throw new Error('Panel: Login-Seite ohne CSRF-Token');
  const a = await fetch(`${BASE}/accounts/login/`, {
    method: 'POST', redirect: 'manual', signal: AbortSignal.timeout(60000),
    headers: { 'User-Agent': UA, 'Content-Type': 'application/x-www-form-urlencoded', Referer: `${BASE}/accounts/login/?next=/season/`, Cookie: kekse() },
    body: new URLSearchParams({ csrfmiddlewaretoken: token, username: user, password: pass, next: '/season/' }),
  });
  merken(a);
  if (!jar.has('sessionid')) throw new Error('Panel: Anmeldung fehlgeschlagen');
}

/** alle Seiten eines DRF-Endpunkts (results/next) bzw. die Liste selbst */
async function alle(url, max = 40) {
  const raus = [];
  for (let i = 0; url && i < max; i++) {
    const a = await get(url);
    if (!a.ok) throw new Error(`Panel: ${url} -> ${a.status}`);
    const d = await a.json();
    if (Array.isArray(d)) return d;
    raus.push(...(d.results ?? []));
    url = d.next;
  }
  return raus;
}

/** Wert unter dem ersten passenden Feldnamen (auch verschachtelt mit Punkt) */
const feld = (o, ...namen) => { for (const n of namen) { const v = n.split('.').reduce((x, k) => x?.[k], o); if (v !== undefined && v !== null && v !== '') return v; } return null; };

/**
 * [{ id, datum: 'JJJJ-MM-TT', heim, gast, nummer: '0010' | null, kuerzel: '1LLH' | null }]
 * Mit ERKUNDEN=1 werden die ersten Einträge roh ausgegeben (Aufbau der API prüfen).
 */
export async function holeMatches(user, pass) {
  await anmelden(user, pass);
  const roh = await alle(`${BASE}/api/Matches/?format=json&page_size=500`);
  if (process.env.ERKUNDEN) console.log(JSON.stringify(roh.slice(0, 3), null, 2));
  return roh.map((m) => {
    const nr = String(feld(m, 'match_number', 'matchNumber', 'number', 'code') ?? '');
    const n = nr.match(/^([A-Za-z0-9]+)-(\d{3,4})$/);
    return {
      id: Number(feld(m, 'id', 'pk', 'match_id', 'matchId')),
      datum: String(feld(m, 'date', 'start_date', 'startDate', 'datetime', 'match_date') ?? '').slice(0, 10),
      heim: String(feld(m, 'home_team.name', 'homeTeam.name', 'team_home.name', 'home_team_name', 'home') ?? ''),
      gast: String(feld(m, 'away_team.name', 'awayTeam.name', 'team_away.name', 'away_team_name', 'away') ?? ''),
      nummer: n ? (n[2].length === 3 ? nr : n[2]) : null,
      kuerzel: n ? n[1] : null,
    };
  }).filter((m) => m.id);
}
