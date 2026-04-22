# Deployment

The app is a static frontend backed by a dedicated Supabase project.

## Supabase

1. Create a new Supabase project for Bathhouse COGS.
2. Apply `supabase/migrations/202604220001_cogs_shared_workspace.sql`.
3. Create at least one Auth user for access.
4. Copy the project URL and anon key into `assets/config.js`.

## Static Hosting

Serve the repo root. No build command is required.

Good options:

- GitHub Pages
- Vercel
- Netlify
- Cloudflare Pages

## Before Production

- Confirm Supabase RLS policies are applied.
- Import the current Excel workbook.
- Spot-check formula totals against the spreadsheet.
- Commit the public Supabase config only after the dedicated project is ready.
