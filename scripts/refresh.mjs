// Háttér-frissítő: lehúzza a VB 2026 eredményeket és közös results.json-be írja.
// Futtatja a GitHub Action (cron). Token: FOOTBALL_DATA_TOKEN környezeti változó.
import fs from "node:fs";

// data.js betöltése (window.VB_DATA)
globalThis.window = {};
await import("../data.js");
const D = globalThis.window.VB_DATA;

const TOKEN = process.env.FOOTBALL_DATA_TOKEN;
const norm = (s) =>
  (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z]/g, "");

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
// Befejezett ÉS élő (folyamatban lévő / félidős) meccsek is
const LIVE = ["IN_PLAY", "PAUSED", "SUSPENDED"];
const api = (data.matches || []).filter(
  (m) => (m.status === "FINISHED" || LIVE.includes(m.status)) && m.score?.fullTime?.home != null
);

let updated = 0;
for (const m of D.matches) {
  const enH = norm(D.hu2en[m.home]);
  const enA = norm(D.hu2en[m.away]);
  if (!enH || !enA) continue;
  const hit = api.find((x) => {
    const xh = norm(x.homeTeam?.name);
    const xa = norm(x.awayTeam?.name);
    return (xh.includes(enH) || enH.includes(xh)) && (xa.includes(enA) || enA.includes(xa));
  });
  if (hit) {
    const ah = hit.score.fullTime.home;
    const aa = hit.score.fullTime.away;
    const live = hit.status !== "FINISHED";
    const cur = results[m.no];
    if (!cur || cur.ah !== ah || cur.aa !== aa || !!cur.live !== live) updated++;
    results[m.no] = live ? { ah, aa, live: true } : { ah, aa };
  }
}

const out = {
  updated: new Date().toISOString(),
  source: "football-data.org",
  results,
};
fs.writeFileSync(new URL("../results.json", import.meta.url), JSON.stringify(out, null, 2));
console.log(`Kész. Összes eredmény: ${Object.keys(results).length}, ebből most változott/új: ${updated}`);
