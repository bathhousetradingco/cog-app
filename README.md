# Bathhouse COGS

Shared cost-of-goods workspace for Bathhouse Trading Company.

This repository is intentionally separate from the Shopify theme and does not assume a Shopify app runtime. The application follows the same static-site pattern as `amazon-categorizer`: browser UI, Supabase Auth, and Supabase tables behind row-level security.

## Local Setup

See `docs/SETUP_CHECKLIST.md` for the full setup checklist.

1. Create a dedicated Supabase project for the COGS app.
2. Apply `supabase/migrations/202604220001_cogs_shared_workspace.sql`.
3. Copy the config template:

   ```sh
   cp assets/config.example.js assets/config.js
   ```

4. Fill `assets/config.js` with the new project's public URL and anon key.
5. Open `index.html` in a browser.

No build step is required.

## Current Scope

- Shared ingredient, packaging, and formula workspace.
- Excel workbook import for the current Bathhouse COGS spreadsheet.
- Searchable categories and formula list.
- Cost item price editing with formula recalculation.
- JSON export for backup/review.

## Next Decisions

- Supabase project region and credentials.
- Whether to host on GitHub Pages, Netlify, Vercel, or another static host.
- Whether formula cleanup should preserve every workbook formula or convert formulas into curated named recipes over time.
