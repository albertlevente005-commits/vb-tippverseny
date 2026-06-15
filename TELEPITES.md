# VB 2026 Tippverseny – platform (automatikus háttér-frissítéssel)

Webes platform, amely a beírt tippek alapján **automatikusan** számolja a pontokat (pontosan az
eredeti Excel logikája), és a VB-eredményeket **magától, a háttérben frissíti** – akkor is, ha
épp senki nincs az oldalon. Mindenki ugyanazt az állást látja.

## Hogyan működik az automatizmus?

1. Egy időzített **GitHub Action** 2 óránként lefut (akkor is, ha senki nem nézi az oldalt).
2. Lehúzza a VB 2026 végeredményeket az ingyenes football-data.org adatbázisból.
3. Beírja a közös `results.json` fájlba, és visszatölti a tárhelyre.
4. A **Netlify** automatikusan újra közzéteszi az oldalt a friss eredményekkel.
5. A megnyitott oldal 5 percenként magától is újratölti a `results.json`-t.

A 11 játékos tippje és a 72 csoportmérkőzés már be van építve. A `results.json` indulásból
tartalmazza a 12 eddigi eredményt, így azonnal működik.

---

## Beállítás lépésről lépésre (kb. 15 perc, egyszeri)

Az automatikus háttér-frissítéshez **GitHub + Netlify** páros kell (mindkettő ingyenes).

### 1) Ingyenes API-kulcs (2 perc)
- Menj a https://www.football-data.org/client/register oldalra, add meg az e-mailed.
- E-mailben kapsz egy **API token**-t (hosszú kód) – ezt később beilleszted.

### 2) GitHub repó (5 perc)
- Regisztrálj/lépj be: https://github.com
- Jobb fent **+ → New repository** → adj nevet (pl. `vb-tippverseny`) → **Create repository**.
- A repó oldalán: **uploading an existing file** → húzd be a **`tippverseny` mappa teljes
  tartalmát** (az `index.html`, `data.js`, `results.json`, `scripts/`, `.github/` mappákkal együtt).
- **Commit changes**.

> Fontos: a `.github/workflows/refresh.yml` mappa is töltődjön fel – ez az időzített feladat.

### 3) Az API-kulcs eltárolása a GitHubon (titokként)
- A repóban: **Settings → Secrets and variables → Actions → New repository secret**.
- Name: `FOOTBALL_DATA_TOKEN`
- Secret: a football-data.org-tól kapott token → **Add secret**.

### 4) Az időzítő bekapcsolása / első futtatás
- A repóban: **Actions** fül → ha kéri, engedélyezd a workflow-kat.
- Bal oldalt „VB eredmények frissítése” → **Run workflow** (kézi első indítás).
- Lefutás után a `results.json` frissül a legfrissebb eredményekkel. Innentől 2 óránként magától fut.

### 5) Közzététel Netlify- on (5 perc)
- Regisztrálj/lépj be **GitHub fiókkal**: https://app.netlify.com
- **Add new site → Import an existing project → GitHub** → válaszd ki a `vb-tippverseny` repót.
- Build beállítások: **Publish directory** = `.` (pont), build parancs üres → **Deploy**.
- Pár másodperc múlva kész a nyilvános link, pl. `https://vb-tippverseny.netlify.app`
  (átnevezhető: Site configuration → Change site name).

Mostantól: a GitHub Action frissíti az eredményeket → a Netlify automatikusan újra közzéteszi →
a látogatók a friss állást látják, kézi beavatkozás nélkül.

---

## Gyors kipróbálás telepítés nélkül
Kattints duplán az `index.html`-re. A 12 beépített eredmény látszik, és kézzel bármit beírhatsz
(a böngésződben mentődik). A közös/automata frissítés csak az éles (Netlify) oldalon működik.

## Kézi felülírás
Bármelyik meccsnél beírhatsz eredményt – ez felülírja az automatikust (pl. ha egy meccs neve
nem párosult). A „Saját módosítások törlése” gomb visszaadja az automatikus értékeket.

## Saját domain (opcionális)
Ha `vbtipp.hu`-szerű cím kell: végy domaint (pár ezer Ft/év), majd Netlify → Domain settings →
Add a domain, és kövesd a DNS-lépéseket.

## Fájlok
- `index.html` – a platform
- `data.js` – tippek + meccsek (Excelből, ellenőrzött)
- `results.json` – közös eredmények (a háttér-frissítő tölti)
- `scripts/refresh.mjs` – az eredménylehúzó script
- `.github/workflows/refresh.yml` – az időzített GitHub Action (2 óránként)
- `netlify.toml` – Netlify konfiguráció

## Frissítési gyakoriság módosítása
A `.github/workflows/refresh.yml` fájlban a `cron: "0 */2 * * *"` sor a 2 órát jelenti.
Pl. 6 óránként: `0 */6 * * *`. (Sűrűbb futás is mehet, de az ingyenes API napi limitált.)
