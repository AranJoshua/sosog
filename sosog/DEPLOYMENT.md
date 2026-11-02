# Deployment runbook

One-time setup for taking this from a local repo to a live, self-updating
site. Do this once real content exists (`npm run sync:sheet` succeeds
against the real Sheet) and the build passes clean (`npm run build`,
`npm run check:links`, `npm run typecheck`).

## 0. Prerequisites

- A GitHub account, and this repo pushed there as a **public** repo (see
  AGENTS.md for why public: free secret-scanning push protection).
- A Cloudflare account (free plan is enough, see AGENTS.md for the
  specific free-tier numbers this relies on).
- A dedicated Gmail account for failure notifications, 2FA enabled, with
  an app password generated (myaccount.google.com > Security > 2-Step
  Verification > App passwords). Not the same account as anyone's
  personal Gmail.
- `SHEET_CSV_URL` for the client's published sheet (see AGENTS.md's
  `sync-sheet.ts` bullet for exactly what to check before publishing it).

## 1. Push to GitHub

```
git init
git add .
git commit -m "Initial scaffold"
gh repo create sosog --public --source=. --push
# or, without the gh CLI: create the repo on github.com first, then
git remote add origin https://github.com/<you>/sosog.git
git push -u origin main
```

## 2. Connect the main site to Workers Builds

In the Cloudflare dashboard, under Workers & Pages, create a new Worker
and connect it to the GitHub repo you just pushed (Cloudflare's own
"deploy from a repo" flow). When it asks for build settings:

- Build command: `npm run build`
- Deploy command: leave as Cloudflare's default for a static-assets
  Worker (it reads `wrangler.jsonc`'s `assets.directory`)
- Root directory: `/` (this repo's root, not `cron-worker/`)

This first build will fail until the build secrets below are set, that's
expected, not a sign anything is broken.

## 3. Set the main site's build secrets

The sheet URL and the Gmail details are read by `npm run build`, so they must
be **build** variables and secrets. These are a separate list from the Worker's
runtime secrets: a value saved with `wrangler secret put` on the main site is
only visible to the running Worker and never reaches the build, so the build
would fail with "SHEET_CSV_URL is not set".

In the Cloudflare dashboard: the sosog Worker > Settings > Build > Variables
and secrets. Add each of these as a **Secret** (they stay hidden after saving):

- `SHEET_CSV_URL`
- `GMAIL_USER`
- `GMAIL_APP_PASSWORD`
- `ALERT_EMAIL_TO`

Then re-run the build from the dashboard (or push a commit). The cron worker in
step 5 is different: it runs as a Worker at request time, so its
`DEPLOY_HOOK_URL` does use `wrangler secret put`.

## 4. Get the Deploy Hook URL

In the Cloudflare dashboard: the sosog Worker > Settings > Builds > Deploy
Hooks > create one. Copy the URL, it's a bearer credential (anyone with it
can trigger a rebuild), so treat it like a secret, not a note-to-self.

## 5. Deploy the cron worker

```
cd cron-worker
npm install
npx wrangler deploy
npx wrangler secret put DEPLOY_HOOK_URL
# paste the URL from step 4 when prompted
```

Confirm the cron schedule landed: Cloudflare dashboard > sosog-cron
Worker > Settings > Triggers, should show the daily cron from
`wrangler.jsonc`.

## 6. First real smoke test

- Visit the `*.workers.dev` URL Cloudflare gives the main site. Check the
  home page, map, explore, and a couple of structure pages actually show
  real content. Every structure with no history text should show "Historical
  records for this structure are limited.", and structures without a photo
  show "No photo available".
- Manually trigger the Deploy Hook once (`curl -X POST <the hook URL>`)
  and confirm a new build kicks off in the dashboard, this proves the
  whole nightly mechanism end to end without waiting for the actual cron
  time to roll around.
- Deliberately break one row in the real Sheet (a bad municipality name,
  say), trigger a build, and confirm the failure email actually arrives.
  This is the one thing AGENTS.md flags as unverified (whether the build
  container's outbound SMTP access covers Gmail's ports), so don't treat
  the email path as working until this succeeds for real. If it doesn't
  arrive, see AGENTS.md's Deployment section for the Resend fallback.
- Fix the row back afterward and confirm a clean build restores the site.

## Photos

Photos are committed to the repo, so there is no photo credential to set up
here. To add or replace photos, run `scripts/sosog_prep_photos.py` on the
originals (see AGENTS.md), copy the resulting `-large.jpg` and `-thumb.jpg`
files into `public/structures/` (or `public/glimpse/`), commit, and push.
The build picks them up automatically.

## Before launch

- Maragsa's EULA (link in `public/fonts/Maragsa-LICENSE.txt`) has been read and allows use on a website.
- The `SITE_FEED` tab is already in the client's sheet and published as CSV
  (`docs/SHEET_SETUP.md` explains how it was made). Use its published URL as
  `SHEET_CSV_URL`.
- Add each team member's `email` to `src/data/about.ts` (the team agreed to show them; `SHOW_EMAILS` is already on) and put their portraits in `public/team/`.
