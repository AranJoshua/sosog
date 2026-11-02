# SOSOG

Sorsogon historical-structures documentation site. Full spec and reasoning
in `AGENTS.md` and `sosog-tech-plan.md`. Read those before changing
anything, especially the "Ask before doing" list at the bottom of
`AGENTS.md`.

## Setup

```
npm install
cp .env.example .env   # fill in SHEET_CSV_URL at minimum for local dev
```

`cron-worker/` is a separate deployable package with its own
`.env.example`; see its comment for what it needs and why it's a Worker
secret, not a local `.env`.
The main site's own values (sheet URL, Gmail) are Workers Builds *build* secrets; see
DEPLOYMENT.md step 3.

```
npm run dev
```

`npm run build` runs `sync:sheet` first, so it needs `SHEET_CSV_URL` set
(plus `GMAIL_USER`, `GMAIL_APP_PASSWORD`, `ALERT_EMAIL_TO` for failure
emails, optional locally, required in production, see `.env.example`).

`npm run typecheck` runs `astro check`. Worth running before pushing,
it's already caught two real bugs during scaffolding (a silently missing
map image, and an untyped Cloudflare Worker) that a successful `astro
build` alone didn't surface.

`npm test` runs the automated test suite (Node's built-in test runner,
no new dependency) against the validation logic: every failure mode
called out in `sosog-tech-plan.md`'s Section 1, a bad municipality, an
out-of-range coordinate, an empty name, a renamed column, a duplicate id,
plus the two-tier schema's "coming soon" behavior, each as a real,
repeatable test rather than something that has to be re-verified by hand
after every change.

`npm run check:links` runs against a built `dist/` (so `astro build`
first), checking every internal link and image actually resolves. This
is the link/image checker sosog-tech-plan.md's Testing section calls for.

When it's time to actually go live, `DEPLOYMENT.md` has the exact
commands, GitHub push, Workers Builds setup, secrets, the cron worker,
and a first-deploy smoke test checklist. `AGENTS.md`'s Deployment section
has the reasoning behind each piece; `DEPLOYMENT.md` is just the runbook.

## What's real vs. stubbed

Real, tested end-to-end:
- Astro 7 + Tailwind 4 (`@tailwindcss/vite`), React island for the map
- `src/content.config.ts` — two-tier schema, no `slug` field, id is
  `<municipality>-<name>` set by the glob loader
- `scripts/sync-sheet.ts` — fetch, header check, structural validation,
  per-structure JSON output, Gmail SMTP failure email, exit 1 on any
  structural problem. Verified against clean data, a bad-coordinates /
  bad-municipality / empty-name row, and a renamed column, each failing
  correctly with the row and field named.
- `scripts/validate-data.ts` — same validation, local check only, no
  writes or email. Shares `sync-sheet.ts`'s duplicate-id check too (see
  Third audit pass below), not just the per-row structural checks, so a
  clean `validate:data` run means the real build won't fail on that data
- All six pages (`/`, `/map`, `/explore`, `/structures/[id]`, `/glimpse`,
  `/about`) build and render off the content collection
- `src/components/map/boundaries.ts` and `.svg` — the real 15 Sorsogon
  municipal boundaries (PSA/PSGC data via faeldon/philippines-json-maps,
  MIT licensed), not a placeholder. `Map.tsx` renders them as interactive
  paths and projects structure pins onto the same coordinate space, both
  share one `BOUNDS` constant so they can't drift apart. Hovering or
  focusing a pin highlights its municipality's shape.
- The Explore tab's tap-to-reveal: a card is always a real working link
  (no-JS fallback works), a first tap reveals a history snippet, a second
  commits the navigation. Implemented as a small page-level script, not a
  React island, per AGENTS.md's "keep the map's JS isolated" convention.
- The scrapbook template's swappable feature-story elements (accent
  color, photo layout, pull-quote): each picked deterministically from
  the structure's own name, so no new column is needed in the client's
  Sheet and the same structure always renders the same way.
- `src/lib/photos.ts` — checks `public/structures/` at build time for
  `<id>-thumb.jpg` / `<id>-large.jpg` and returns the real photo's URL
  when one exists, `null` otherwise. `StructureCard.astro`,
  `ScrapbookTemplate.astro`, and `glimpse.astro` all render the real photo
  the moment a matching file exists in `public/structures/`, falling back to
  "No photo available" otherwise. Photos are now committed to the repo (see
  AGENTS.md) rather than synced from Drive.
- A plain-text "SOSOG" wordmark in the nav (linking home) and the home
  hero, reading a `--font-wordmark` CSS variable so swapping in the real
  Maragsa font later, once it's self-hosted, is a one-line change.
- `scripts/lib/validate-row.test.ts`, `scripts/sync-sheet.test.ts`,
  `scripts/validate-data.test.ts`, and `src/lib/photos.test.ts` — 35
  automated tests (`npm test`) covering every validation rule and failure
  path (including a blank spacer row in the sheet, which used to fail the
  whole build, see below) and the photo helper, a local HTTP server
  stands in for the real Sheet so no network or credentials are needed to
  run them
- `scripts/check-links.ts` (`npm run check:links`) — walks a built
  `dist/`, confirms every internal link and image actually resolves;
  verified to both pass on a clean build and correctly catch a
  deliberately broken link and a missing image
- `wrangler.jsonc`, `cron-worker/`, `.node-version`, `DEPLOYMENT.md`

Fixed during this audit (see git history / the audit notes for detail):
- **Real bug**: a blank row in the sheet (a spacer row, or the trailing
  blank row Google Sheets exports routinely include) used to fail the
  entire nightly build, reporting a structure with a missing name,
  municipality, and coordinates. It's now skipped silently, and the row
  number reported for a genuinely bad row later in the sheet is no longer
  thrown off by a blank row above it.
- The nav had no wordmark or home link at all (fixed, see above).
- `favicon.svg` / `favicon.ico` existed in `public/` but neither was
  referenced from `<head>`; added explicit `<link rel="icon">` tags.
- `public/structures/` (synced photos) wasn't in `.gitignore`, so the
  first real `sync:photos` run would have offered to commit binary photo
  blobs into git history, which AGENTS.md explicitly says not to do.
- `structures/[id].astro` never passed the structure's `id` to
  `ScrapbookTemplate`, so there was no way for that template to look up
  a photo by id even after a photo pipeline exists.

Second audit pass (Sept 25, 2026), verified by actually running the
toolchain rather than re-reading claims:
- `npm install`, `npm run typecheck` (0 errors), `npm test` (31/31
  passing), `npx astro build` (both with empty content and with a
  temporary 3-structure fixture used only to exercise the pipeline,
  then removed), `npm run check:links` (0 broken references), and
  `npx astro dev` (home and map pages both serve 200, the map island
  hydrates with real props) all confirmed clean. The map's pin
  projection was hand-checked against three municipalities' boundary
  paths and lands inside the correct shape each time.
- Fixed two stale doc claims found in this pass: `sosog-tech-plan.md`
  said `validate:data` "should run before every build," which no
  longer matches the actual pipeline (`sync-sheet.ts` validates as
  part of `npm run build` itself; `validate:data` is a local-only
  convenience) — reworded. This README overstated the test count as
  34; the suite actually runs 31 — corrected above.
- Added `wrangler` to the root `package.json` as a devDependency
  (matching `cron-worker/`'s version), so `wrangler.jsonc`'s own
  `$schema` reference resolves locally instead of pointing at a
  `node_modules/wrangler/` path that didn't exist at the root. See
  the note at the end of AGENTS.md's "Ask before doing" section for
  why this one dependency addition didn't wait for a check-in.
- No other functional bugs or spec conflicts found. Everything else
  in this file's "real, tested end-to-end" list above was independently
  re-verified, not just re-read.

Third audit pass (Sept 25, 2026), same standard — ran the toolchain
rather than trusting the prior passes' claims, then fixed what that
turned up:
- Re-verified from scratch: `npm install`, `npm run typecheck` (0
  errors), `npm test` (31/31 passing at the time), a real
  `SHEET_CSV_URL` build against a fresh 4-structure fixture (one row
  with every content field blank, one with two blank), `npm run
  check:links` (0 broken references) on that build, and
  `cron-worker/`'s own install + `tsc --noEmit` (0 errors) as a
  separate package.
- Went further than the second pass's "three municipalities, hand-checked"
  on the map: computed the centroid of all 15 boundary polygons in
  `boundaries.ts` and confirmed their north-to-south screen-space
  ordering matches real Sorsogon geography (Matnog correctly lands
  southernmost, Prieto Diaz and Sorsogon City correctly land
  northernmost). Also confirmed the municipality list itself against
  PSA's official Sorsogon breakdown (14 municipalities + Sorsogon City)
  and confirmed the boundary data has exactly the 336 coordinate pairs
  `sosog-tech-plan.md` says it does.
- **Real gap, fixed**: `validate-data.ts` checked every per-row
  structural rule but not the duplicate-id rule (same municipality +
  name), even though that rule is a real build gate in `sync-sheet.ts`.
  A client could run `validate:data`, see "OK", and still have the real
  `build` fail on that same data. Refactored `validate-data.ts` to the
  same shape as `sync-sheet.ts` (a testable `runValidate()` throwing a
  `ValidationFailure`, a thin `main()`), added the same duplicate-id
  check with the same message, and added `scripts/validate-data.test.ts`
  (4 tests, including the duplicate case) so it can't silently regress.
  Verified by hand too: a real duplicate-id sheet now exits 1 from
  `validate:data` with the row number and both structure names named,
  instead of reporting OK. Test count is 35, not 31, from here on.
- No other functional bugs, spec conflicts, or stale doc claims found.
  `.gitkeep` placeholders in `src/content/structures/` and
  `public/structures/` were regenerated after this pass's own test
  builds deleted them (expected: `sync-sheet.ts`'s `rm -rf` + `mkdir`
  doesn't know about `.gitkeep`, only matters for a real git checkout).

Fourth audit pass (Sept 26, 2026), same standard again — full toolchain
re-run from a clean `npm ci`, plus harder fixtures than prior passes used:
- Re-verified from scratch: `npm ci` (both the root package and
  `cron-worker/`, confirming both lockfiles are still exactly in sync
  with their `package.json`, not just installable via the looser
  `npm install`), `npm run typecheck` (0 errors), `npm test` (35/35),
  a real `SHEET_CSV_URL` build against a 5-row fixture (one clean row,
  one row with every content field blank, one fully blank spacer row,
  two more clean rows), `npm run check:links` (0 broken references) on
  that build, and `cron-worker/`'s `tsc --noEmit` (0 errors).
- Went past the unit tests to stress the real `npm run sync:sheet` path
  by hand with fixtures the test suite doesn't run verbatim: a renamed
  `coordinates` column (correctly fails loudly, names the missing
  column), a duplicate id from two same-name/same-municipality rows
  (correctly fails, names both rows), out-of-range coordinates
  (correctly fails, names the row), the two-column split coordinate
  format the spec explicitly says to reject (correctly fails), and a
  sheet with extra workflow-style columns (`assignee`, `status`)
  alongside the six expected ones (correctly ignored, build succeeds) —
  all five behaved exactly as `AGENTS.md` and `sosog-tech-plan.md`
  describe.
- Cross-checked `sosog-tech-plan.md` against the current code and
  found it already consistent (Astro 7, Workers over Pages,
  `validate:data` as a local convenience rather than a build gate) —
  no further stale claims turned up beyond the one the third pass
  already fixed.
- **Cleanup, not a bug**: removed a stray `"allowScripts": { "esbuild":
  true }` field from the root `package.json`. It isn't a real npm
  config key (npm has no such gate; that's a different tool's
  convention), so it was a no-op — confirmed by `npm ci` behaving
  identically with it removed. Everything else in `package.json` is
  unchanged.
- No other functional bugs, spec conflicts, or stale doc claims found.
  `.gitkeep` placeholders were again regenerated after this pass's own
  test builds consumed them, same as the third pass.

Superseded (October 2026): `scripts/sync-photos.ts` and the Drive
service-account plan were dropped in favour of committed photos prepared
with `scripts/sosog_prep_photos.py`. See AGENTS.md, "Changes since the
original plan".
- The Maragsa font itself isn't wired in yet (a plain-text placeholder
  wordmark exists in the meantime, see above). The font isn't on a
  CDN, only downloadable from Gumroad/FontSpace, so it needs to be
  fetched and self-hosted (`public/fonts/`, an `@font-face` rule in
  `global.css` setting `--font-wordmark`) by whoever has that network
  access. The wordmark logo asset itself hasn't been exported by the
  client yet either.
- Beyond the feature-story accent/layout variety, no broader visual
  design pass has happened, spacing, type scale, and the rest of the
  site's look are still Tailwind defaults.
- The Gmail SMTP failure email path is written but unverified — AGENTS.md
  flags that the build container's outbound SMTP access on 587/465 isn't
  confirmed yet. Send one real test email from an actual build before
  relying on it; swap to Resend if it doesn't go through (see AGENTS.md
  Deployment section).
- No real structure data. `src/content/structures/` is empty
  (`.gitkeep` only) until `sync:sheet` runs against the real sheet.

## Local preview with the sample sheet data

`sample-data/site_feed.csv` is the client's sheet converted to the columns this site reads (name, municipality, coordinates, history, technical_description, feature_story, plus the optional year_built, classification, materials, occupancy, intervention_level, photo). To build against it without the real Sheet:

```
cd sample-data && python -m http.server 8765
# in a second terminal, from the project root:
set SHEET_CSV_URL=http://localhost:8765/site_feed.csv      (Windows cmd)
npm run build
npm run preview
```

The optional `photo` column holds a photo file name exactly as it appears in the FINAL WEBSITE PICS folder (for example `BULAN SOUTH CENTRAL.png`). The site reduces it to the same stem that `sosog_prep_photos.py` writes into `public/structures/`, so a structure keeps its photo even if its name is edited later. Photos are committed to the repo (`public/structures/`, `public/glimpse/`), not synced from Drive.
