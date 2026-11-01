# Setting up the SITE_FEED tab

The site reads one published CSV. Point it at a dedicated `SITE_FEED` tab, not
the client's working tabs, so the layout of `FOR WEBSITE INPUT` and the workflow
columns of `CHECKLIST RESPONSES` can change without breaking the build and are
never exposed by publish-to-web.

`SITE_FEED` is a plain set of formulas that copy from the client's tabs. Nobody
types into it.

The client's sheet is "SORSOGON HISTORICAL STRUCTURE ASSESSMENT"
(`https://docs.google.com/spreadsheets/d/1SUs0sh9Pw5rLb7s9cG3ipC2q5QnfEneq9Vi6-hQibvc`).
This guide matches its layout as of 31 October 2026: on `FOR WEBSITE INPUT` the
header is on row 2 and the first structure is on row 3.

## Fastest way: import the ready-made tab

1. Open the Google Sheet and choose File > Import > Upload, and pick
   `docs/SITE_FEED.csv` from this repo.
2. Import location: **Insert new sheet(s)**. Leave "Convert text to numbers,
   dates, and formulas" ticked. The new tab is named `SITE_FEED` after the file.
3. Check the tab: row 1 holds the twelve headers and rows 2 to 101 hold the
   formulas below. Row 2 should show the first structure, Barcelona Watch Tower
   (Baluarte).
4. Publish it (see "Publishing" at the end).

## By hand

1. Add a tab named `SITE_FEED`.
2. Paste these headers into row 1, columns A to L, exactly as written:

   `name`, `municipality`, `coordinates`, `history`, `technical_description`, `feature_story`, `year_built`, `classification`, `materials`, `occupancy`, `photo`, `intervention_level`

3. Paste these formulas into row 2. Row 2 reads row 3 of `FOR WEBSITE INPUT`,
   the first structure.

| Cell | Formula |
|---|---|
| A2 name | `=TRIM('FOR WEBSITE INPUT'!C3)` |
| B2 municipality | `=TRIM('FOR WEBSITE INPUT'!F3)` |
| C2 coordinates | `=TRIM('FOR WEBSITE INPUT'!G3)` |
| D2 history | `=TRIM('FOR WEBSITE INPUT'!M3)` |
| E2 technical_description | `=TRIM('FOR WEBSITE INPUT'!K3)` |
| F2 feature_story | `=TRIM('FOR WEBSITE INPUT'!L3)` |
| G2 year_built | `=IF(OR('FOR WEBSITE INPUT'!H3="",UPPER('FOR WEBSITE INPUT'!H3&"")="N/A"),"",'FOR WEBSITE INPUT'!H3&"")` |
| H2 classification | `=TRIM('FOR WEBSITE INPUT'!I3)` |
| I2 materials | `=IF($A2="","",IFERROR(INDEX('CHECKLIST RESPONSES'!V:V,MATCH($A2,'CHECKLIST RESPONSES'!B:B,0)),IFERROR(INDEX('CHECKLIST RESPONSES'!V:V,MATCH($A2&"*",'CHECKLIST RESPONSES'!B:B,0)),"")))` |
| J2 occupancy | `=IF($A2="","",IFERROR(INDEX('CHECKLIST RESPONSES'!N:N,MATCH($A2,'CHECKLIST RESPONSES'!B:B,0)),IFERROR(INDEX('CHECKLIST RESPONSES'!N:N,MATCH($A2&"*",'CHECKLIST RESPONSES'!B:B,0)),"")))` |
| K2 photo | `=TRIM('FOR WEBSITE INPUT'!D3)` |
| L2 intervention_level | `=TRIM('FOR WEBSITE INPUT'!J3)` |

4. Select A2:L2 and drag the fill handle down to row 101. Rows with no
   structure come out blank and are skipped by the build.

## Publishing

File > Share > Publish to web. Choose the `SITE_FEED` tab only and the CSV
format. Copy the URL: it is the `SHEET_CSV_URL` for the build.

## Things to know

- **"N/A" means nothing to show.** A cell that holds only N/A (any case) in
  History, Technical Description, Feature Story, Year, or any other column is
  treated as empty by the build. A structure with no history shows "Historical
  records for this structure are limited." and one with no feature story has no
  Feature Story tab. "Unknown" in the year column is shown as typed.
- **Materials and occupancy** are matched by structure name, so a structure's
  name must be spelled the same in `FOR WEBSITE INPUT` and
  `CHECKLIST RESPONSES` (column B). The formula tries an exact match first, then
  a match that ignores stray trailing text. A real spelling mismatch leaves those
  two cells blank; the page just omits them and nothing breaks. `CHECKLIST
  RESPONSES` holds Google Form answers, so a name there is fixed by editing the
  cell in column B.
- **Intervention level** takes the team's own words for the eight levels and
  reads the level from them. A bare number (`5`), `Level 5`, the name
  (`Restoration`), the adjective (`Restored`), or a number with its name
  (`Level 5 - Restoration`) all work, and a small misspelling is fine when the
  number is there (`Level 4 - Rehabiliation`). The structure page then shows the
  level on its plaque and, on the Technical Description sheet, a gauge of all
  eight levels with this structure's level named beside it. Text that names no
  level, or two different levels, is shown as typed on the plaque and the gauge
  is left out. An empty cell shows nothing. The site builds the same whether this
  column exists or not.
- **Photo** is `MAIN PHOTO FILE NAME`. The build turns a name like
  `Barcelona Watch Tower (Baluarte)` or `BULAN SOUTH CENTRAL.png` into the
  photo stem `barcelona-watch-tower-baluarte` or `bulan-south-central`, which
  must match the files in `public/structures/`, which
  `scripts/sosog_prep_photos.py` writes from the same file names. Rename a photo in the sheet and its prepared files must be
  renamed to match. N/A or an empty cell means no photo. `CLOSE-UP FILE NAME`
  is not used by the site.
- **History** is column M (`HISTORY TAB`) of `FOR WEBSITE INPUT`. Where the team
  has no history, the cell can hold N/A. Putting the feature story text there
  is also fine, and it then appears under both tabs.
- **Feature story** should hold only the interviews with local residents.
- **Row 3 assumption.** If the client inserts rows above the first structure in
  `FOR WEBSITE INPUT`, the formulas keep pointing at the old row numbers, so
  ask them not to insert rows above row 3.
- **The headers in row 1 of `SITE_FEED` must not change.** The build fails
  loudly, by column name, if a required header is missing.
