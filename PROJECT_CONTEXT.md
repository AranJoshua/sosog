# SOSOG: project context (read this first)

This file lets someone, human or AI, pick the project up cold. It is written to be safe in a public repository: no emails, prices, or credentials. Keep it that way. Last updated **October 16, 2026**. The working rules for the code are in `AGENTS.md`; the original reasoning is in `sosog-tech-plan.md` (where it disagrees with `AGENTS.md`, `AGENTS.md` wins).

## 1. What this is

SOSOG is a browsing-only website documenting the historical structures of Sorsogon province, Philippines: old schools, churches, ancestral houses, watchtowers, lighthouses, and ruins. It was commissioned from Aran (the builder) by a Civil Engineering student research team at Bicol University for their course project. The team did the fieldwork: site visits, GPS-stamped photos, a technical checklist per structure, written descriptions, and interviews with local residents. Aran builds the site from their materials.

The site has: a Netflix-style home page, an Explore carousel of municipalities, an interactive province map with icon pins and popups, a page per structure (History, Feature Story, Technical Description tabs), index pages for technical descriptions, histories, and feature stories, a Glimpse of Sorsogon photo feed, and an About Us page. There are no accounts, forms, or comments, and none should be added.

## 2. People

- **Aran**: the builder and the person you are working with. Decides scope and talks to the client.
- **Micah**: the client team's contact. Owns the content (sheet, photos, history, feature stories).
- **The client team**: four BSCE students plus a research adviser (their names are on the About page).

## 3. Status

- **Code: essentially complete.** The site builds 63 pages from the sample data, which is now a snapshot of the client's real sheet (41 structures, 31 October 2026). Verified: 121 unit tests pass, the typecheck is clean, the link checker is clean, and a headless-browser pass covered home, explore, map (province, municipality, popup, offshore pin, phone width), a structure page, and glimpse.
- **Not verified**: a real phone, the Cloudflare deployment, and the Cloudflare side of the connection. The `SITE_FEED` tab now exists in the client's sheet and is published as CSV (1 November 2026); the downloaded copy of that published CSV passes validation and builds all 63 pages, and it is the snapshot in `sample-data/site_feed.csv`.
- **Content state (client side)**: 33 of 41 structures have a history and 10 have a feature story. Eight histories are N/A because DepEd has not replied about some Gabaldon buildings; the team's plan is N/A, or the feature story where one exists. Four structures have a story but no history (Bulan South Central, Bulan North Central, San Ramon, Cumadcad), so their History tab shows the limited-records line. San Rafael Elementary has no photo and no year. The About Us description is written; the team's emails and portraits are still to be added.

## 4. How the pieces fit

```
Client Google Sheet (tabs: FOR WEBSITE INPUT, CHECKLIST RESPONSES)
        |  formulas copy the public fields (docs/SHEET_SETUP.md)
        v
SITE_FEED tab  --publish to web (CSV)-->  scripts/sync-sheet.ts (validates, writes src/content/structures/*.json)
        v
Astro static build (+ React island for the map)  -->  Cloudflare Workers static assets
        ^
nightly Cloudflare cron Worker triggers a Deploy Hook so sheet edits go live overnight
```

Photos are **not** in that flow. They are prepared on Aran's laptop with `scripts/sosog_prep_photos.py` and committed to `public/structures/` and `public/glimpse/`.

The client's workbook ("SORSOGON HISTORICAL STRUCTURE ASSESSMENT"): `FOR WEBSITE INPUT` has its header on row 2 and structures from row 3 (columns B to N: number, name, main photo file name, close-up file name, location, GPS, year, classification, level of intervention, technical description, feature story, history, database source). `CHECKLIST RESPONSES` is a Google Form response sheet (structure name in column B, occupancy status in N, exterior walls in V). It currently holds **41 structures across 13 of the 15 municipalities** (Matnog and Santa Magdalena have none; Punta de Piedra was removed).

## 5. Repository map

| Path | What it is |
|---|---|
| `AGENTS.md` | Working rules, stack, and the "Changes since the original plan" decision log |
| `docs/SHEET_SETUP.md` | Exact `SITE_FEED` headers and formulas (tested on the client workbook) |
| `docs/SOSOG_fix_list_for_Micah.xlsx` | The 26 data issues sent to the client |
| `DEPLOYMENT.md` | Step-by-step Cloudflare Workers + GitHub runbook |
| `sample-data/site_feed.csv` | The client's sheet converted to the site's format, for local builds |
| `scripts/sync-sheet.ts`, `scripts/lib/validate-row.ts` | Sheet fetch and validation (required and optional columns, content cleanup) |
| `scripts/sosog_prep_photos.py` | Local photo tool (HEIC, DNG, JPG to web JPEGs, metadata stripped, manifest CSV) |
| `src/components/Map.tsx`, `src/lib/map-geometry.ts` | The map and its tested geometry |
| `src/components/ScrapbookTemplate.astro` | Structure page body with tabs |
| `src/styles/global.css`, `public/fonts/` | Palette tokens, shared interface classes (buttons, arch buttons, rails, prints, arcade parapet, scrollbars, page transitions), fonts, and the Maragsa license note |
| `src/data/about.ts` | About page content. Team emails are deliberately not stored here (the repo is public); add them only after the team confirms, then set `SHOW_EMAILS = true` |

## 6. Decisions already made (do not reopen without a reason)

- **Hosting**: Cloudflare Workers static assets, free tier only. No recurring costs. A free domain is acceptable if it is reliable (a similar past site had bugs on a paid one).
- **Photos are committed to the repo**, not synced from Drive. About 36 MB today, far inside Cloudflare's limits (20,000 files, 25 MiB each).
- **History and Feature Story are separate.** Feature stories hold only interviews with local residents and are optional. A structure with no history shows "Historical records for this structure are limited." and one with no feature story simply has no Feature Story tab.
- **Palette** (from the client's guide): maroon `#461717`, cream `#F1EACE`, navy `#2F4461`, ink `#211112`. Dark theme.
- **Fonts**: wordmark and headings in Maragsa, installed as `public/fonts/Maragsa.woff2` with the creator's free-license note beside it (the full EULA, linked in that note, should be read for web-embedding terms). Body in Josefin Sans, a free stand-in, because the guide's Copperplate Gothic is commercial.
- **Explore follows the guide's sequence**: municipality arcade, then that municipality's structures, then a structure. The earlier tap-to-reveal idea was dropped. Municipality names show on the open arch (hover or focus on a desktop, the centred slide on touch screens).
- **Interface design** was rebuilt on October 17 and again on October 18, 2026 and follows the "Design system" section of `AGENTS.md`.
- **Map**: whole-province view shows dots; selecting a municipality raises it, recolors it, zooms in, and shows full icons (spread apart where coordinates coincide, with a line back to the true spot). The view widens for offshore structures. `/map?s=<structure id>` deep-links. Pin icons are placeholders; the client plans to supply their own (swap `src/components/map/icons.ts`).
- **Photo matching** goes through the sheet's main photo file name, not the structure's id, so renaming a structure does not orphan its photo. The committed images in `public/structures/` are named after those sheet names (for example `barcelona-watch-tower-baluarte-large.jpg`). The close-up column is not used.
- **N/A cells** in any content column count as empty, so the site never prints the letters N/A.
- **Emails stay out of the repo** and off the About page until the team confirms.

## 7. Known data issues (client side)

The client has marked every item of the original fix list as done (`docs/SOSOG_fix_list_for_Micah.xlsx` is the older copy). What remains in the sheet as of 31 October 2026:

- **Two names differ between tabs**: `Lee Building` and `Sorsogon National High School Building` are spelled that way on `FOR WEBSITE INPUT` but `Lee Bulding` and `Sorsogon Provincial High School Building` in `CHECKLIST RESPONSES`, so those two structures show no materials or occupancy until the two cells in column B are edited.
- **One photo name**: the sheet's main photo file name for St. John the Baptist Parish (Castilla) reads `St. Joseph the Baptist Parish`, which is the wrong saint (the parish is St. John the Baptist, and the client's own close-up names spell it that way). The committed photo files use the correct name, so the cell `D19` on `FOR WEBSITE INPUT` must be changed to `St. John the Baptist Parish`, otherwise that structure shows no photo.
- **Text that disagrees with its year**: San Bernardino Lighthouse lists 1887 with a description that says 1893, and the Old Spanish Presidencia description still says its record lists 1996 while the year is 1878.
- **San Bernardino Lighthouse** sits on San Bernardino Island, about 15 km off Bulusan, and is drawn offshore. It was documented from online sources.
- **Photos**: San Rafael Elementary has none. The Bagatao Island Lighthouse picture comes from an online source the client credited in the fix list.

## 8. Open items

**Client (Micah):** the remaining histories (or N/A); the two name edits in `CHECKLIST RESPONSES`; the photo-name edit in cell `D19` of `FOR WEBSITE INPUT`; the team's emails and portraits for About Us.

**Aran:**
1. Read Maragsa's EULA (link in `public/fonts/Maragsa-LICENSE.txt`) for the web-embedding terms, or ask the creator.
2. Done: the `SITE_FEED` tab is in the client's Google Sheet and published as CSV. Its published URL is the `SHEET_CSV_URL` for step 4 (`docs/SHEET_SETUP.md` explains how it was made).
3. Preview on a real laptop and phone.
4. Create the GitHub repo and Cloudflare Worker per `DEPLOYMENT.md`, then run its smoke test, including the deliberate-failure email test.
5. History is already wired: column D of `SITE_FEED` reads column M of `FOR WEBSITE INPUT`.

## 9. Verifying work

```
npm ci
npm test                 # 121 unit tests, including the map in a simulated browser
npm run typecheck
# build against the sample data (serve it, then build):
cd sample-data && python -m http.server 8765      # leave running
set SHEET_CSV_URL=http://localhost:8765/site_feed.csv    # Windows cmd; use export on macOS/Linux
npm run build
npm run check:links
```

For visual checks, a headless Chromium (`puppeteer-core` with `@sparticuz/chromium`) worked for screenshots in the build session; it is not a project dependency. Be honest about what was and was not verified, and never claim a deployment or a live-sheet check that has not happened.

## 10. Working with Aran

- Keep replies short and one step at a time. Aran has said long, many-part answers are overwhelming.
- During terminal troubleshooting, give just the next command.
- Ask for decisions as simple yes or no questions, with a recommendation.
- English only, including drafted messages to the client.
- Do what can be done independently before asking him to do anything, and say plainly when something cannot be done (for example, downloads from sites the sandbox cannot reach).
- Changing the schema or sheet pipeline, adding a dependency, or switching hosting needs his approval (see "Ask before doing" in `AGENTS.md`).

## 11. The client's guide, in brief (the PDF is not in the repo because it contains personal emails)

Home page inspired by Netflix's home tab. Explore: municipality slides whose names appear on hover; sequence is municipality, then its structures, then a structure (History first, Feature Story as an option). Map: Sorsogon province only, clicking a municipality raises it and changes its color and shows a preview; pins use icons per structure; the popup shows name, photo (one main GPS Camera photo, plus a close-up of materials if there is one), location, a summary of the technical description, and a See more button. Navigation: Home, Map, Technical Description of Structures, History of Structures, Feature Stories (scrapbook style), Glimpse of Sorsogon (photo dump, Instagram-feed style), About Us. Responsive for desktop and mobile.

## 12. Starter message for a new Claude chat

> I'm Aran. I'm building the SOSOG website. I'm attaching the project zip. Read `PROJECT_CONTEXT.md` and then `AGENTS.md`, tell me in five lines where the project stands, and then help me with: [what you need]. Keep answers short and one step at a time.
