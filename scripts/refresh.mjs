// Háttér-frissítő: API-Football (v3) élő + befejezett eredmények → results.json
// Futtatja a GitHub Action (cron). Token: API_FOOTBALL_TOKEN környezeti változó.
// A meglévő (kézi/seed) eredmények megmaradnak, csak a megtalált meccseket írja felül.
import fs from "node:fs";

// data.js betöltése (window.VB_DATA)
globalThis.window = {};
await import("../data.js");
const D = globalThis.window.VB_DATA;

const TOKEN = process.env.API_FOOTBALL_TOKEN;
const LEAGUE = process.env.AF_LEAGUE || "1"; // 1 = World Cup
const SEASON = process.env.AF_SEASON || "2026";

const norm = (s) =>
  (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z]/g, "");

// leghosszabb közös részszó hossza (rugalmas névpárosításhoz)
function lcsLen(a, b) {
  let best = 0;
  const n = b.length;
  const dp = new Array(n + 1).fill(0);
  for (let i = 1; i <= a.length; i++) {
    let prev = 0;
    for (let j = 1; j <= n; j++) {
      const tmp = dp[j];
      if (a[i - 1] === b[j - 1]) {
        dp[j] = prev + 1;
        if (dp[j] > best) best = dp[j];
      } else dp[j] = 0;
      prev = tmp;
    }
  }
  return best;
}
// két csapatnév egyezik-e (pl. "Korea Republic" ~ "South Korea" → közös "korea")
const nameMatch = (x, y) =>
  !!x && !!y && (x === y || x.includes(y) || y.includes(x) || lcsLen(x, y) >= 4);

// meglévő results.json beolvasása (hogy a kézi/seed eredmények megmaradjanak)
let prev = { results: {} };
try { prev = JSON.parse(fs.readFileSync(new URL("../results.json", import.meta.url))); } catch (e) {}
const results = { ...(prev.results || {}) };

if (!TOKEN) {
  console.error("Nincs API_FOOTBALL_TOKEN — csak a meglévő results.json marad.");
  process.exit(0);
}

const r = await fetch(`https://v3.football.api-sports.io/fixtures?league=${LEAGUE}&season=${SEASON}`, {
  headers: { "x-apisports-key": TOKEN },
});
if (!r.ok) {
  console.error("API hiba:", r.status, await r.text());
  process.exit(0);
}
const data = await r.json();
if (data.errors && (Array.isArray(data.errors) ? data.errors.length : Object.keys(data.errors).length)) {
  console.error("API errors:", JSON.stringify(data.errors));
}
const fixtures = data.response || [];
console.log(`Fixtures kapott (league=${LEAGUE}, season=${SEASON}): ${fixtures.length}`);

const FINISHED = ["FT", "AET", "PEN"];
const LIVE = ["1H", "2H", "HT", "ET", "BT", "P", "LIVE", "SUSP", "INT"];

const apiList = fixtures
  .filter((f) => f?.goals && f.goals.home != null &&
    (FINISHED.includes(f.fixture?.status?.short) || LIVE.includes(f.fixture?.status?.short)))
  .map((f) => ({
    h: norm(f.teams?.home?.name),
    a: norm(f.teams?.away?.name),
    gh: f.goals.home,
    ga: f.goals.away,
    live: !FINISHED.includes(f.fixture.status.short),
  }));

let matched = 0, updated = 0;
const unmatched = [];
for (const m of D.matches) {
  const enH = norm(D.hu2en[m.home]);
  const enA = norm(D.hu2en[m.away]);
  if (!enH || !enA) continue;
  const hit = apiList.find((x) => nameMatch(x.h, enH) && nameMatch(x.a, enA));
  if (hit) {
    matched++;
    const ah = hit.gh, aa = hit.ga, live = hit.live;
    const cur = results[m.no];
    // Egy már LEZÁRT (nem élő) eredményt ne írjon felül egy élő API-állapot.
    // Az API néha órákig "beragad" élőben egy már véget ért meccsnél – ezt kihagyjuk.
    if (cur && cur.live !== true && live) { continue; }
    if (!cur || cur.ah !== ah || cur.aa !== aa || !!cur.live !== live) updated++;
    results[m.no] = live ? { ah, aa, live: true } : { ah, aa };
  } else {
    unmatched.push(`${m.no}. ${m.home}-${m.away}`);
  }
}
console.log(`Párosítva: ${matched}/${D.matches.length}, változott/új: ${updated}`);
if (unmatched.length) console.log("Nem párosított:", unmatched.join(" | "));

const out = {
  updated: new Date().toISOString(),
  source: "api-football",
  results,
};
fs.writeFileSync(new URL("../results.json", import.meta.url), JSON.stringify(out, null, 2));
console.log(`Kész. Összes eredmény: ${Object.keys(results).length}`);
