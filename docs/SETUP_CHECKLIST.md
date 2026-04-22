# Setup Checklist

Use this checklist to get the Bathhouse COGS app from local scaffold to a working shared website.

## Steven

- [x] Log in to Supabase CLI:

  ```sh
  supabase login
  ```

- [x] Tell Codex when Supabase login is complete.
- [x] Choose the Supabase organization if the CLI lists more than one.
- [x] Choose a project region. Recommended: `us-east-1` unless you prefer another US region.
- [x] Create or provide a database password for the new Supabase project. Do not commit it.
- [x] Create at least one Supabase Auth user for yourself after the project exists.
- [x] Open the app in a browser after config is added.
- [x] Import the current Excel workbook through the app's `Import Excel` button.
- [ ] Spot-check several formula totals against the spreadsheet before relying on the app.

## Codex

- [x] Create the dedicated Supabase project after CLI login is available.
- [x] Link the local repo to the new Supabase project.
- [x] Apply `supabase/migrations/202604220001_cogs_shared_workspace.sql`.
- [x] Add the new project's public URL and anon key to `assets/config.js`.
- [x] Verify login loads the app shell.
- [x] Verify workbook import creates categories, cost items, formulas, formula lines, and workbook cells.
- [ ] Commit and push the first working static site to `bathhousetradingco/cog-app`.

## Later Product Work

- [ ] Add manual create/edit flows for formulas, not just imported workbook formulas.
- [ ] Add price history views per cost item.
- [ ] Add an affected-products report after every cost update.
- [ ] Convert important workbook formulas into curated named recipe lines.
- [ ] Add CSV/Excel export for cost catalog and finished product COGS.
- [ ] Decide where the static site should be hosted.
