// Háttér-frissítő: football-data.org élő + befejezett eredmények → results.json
// Futtatja a GitHub Action (cron). Token: FOOTBALL_DATA_TOKEN környezeti változó.
// A meglévő (kézi/seed) eredmények megmaradnak, csak a megtalált meccseket írja felül.
import fs from "node:fs";

// data.js betöltése (window.VB_DATA)
globalThis.window = {};
await import("../data.js");
const D = globalThis.window.VB_DATA;

const TOKEN = process.env.FOOTBALL_DATA_TOKEN;

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
  console.error("Nincs FOOTBALL_DATA_TOKEN — csak a meglévő results.json marad.");
  process.exit(0);
}

const r = await fetch("https://api.football-data.org/v4/competitions/WC/matches", {
  headers: { "X-Auth-Token": TOKEN },
});
if (!r.ok) {
  console.error("API hiba:", r.status, await r.text());
  process.exit(0);
}
const data = await r.json();
const all = data.matches || [];
console.log(`Meccsek az API-ból: ${all.length}`);

const FINISHED = ["FINISHED", "AWARDED"];
const LIVE = ["IN_PLAY", "PAUSED", "SUSPENDED"];

const apiList = all
  .filter((m) => (FINISHED.includes(m.status) || LIVE.includes(m.status)) && m.score?.fullTime?.home != null)
  .map((m) => ({
    h: norm(m.homeTeam?.name),
    a: norm(m.awayTeam?.name),
    gh: m.score.fullTime.home,
    ga: m.score.fullTime.away,
    live: LIVE.includes(m.status),
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
    // Kézzel ZÁROLT eredményt (manual:true) az API soha ne írjon felül (pl. 11-essel eldőlt meccs).
    if (results[m.no] && results[m.no].manual === true) { continue; }
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
  source: "football-data.org",
  results,
};
fs.writeFileSync(new URL("../results.json", import.meta.url), JSON.stringify(out, null, 2));
console.log(`Kész. Összes eredmény: ${Object.keys(results).length}`);
