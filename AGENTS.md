# Bathhouse COGS

This is a standalone internal app for Bathhouse Trading Company cost-of-goods work.

## Operating Rules

- Treat this repo as independent from the Shopify theme repo.
- Do not add Shopify app config, OAuth scopes, or embedded app assumptions unless explicitly requested.
- Keep secrets out of git. Supabase anon keys are public, but service-role keys and database passwords must never be committed.
- Preserve the static-site shape unless there is a clear product reason to add a build step.
- Use the Supabase migration files as the source of truth for shared workspace tables and RLS.

## Commands

- Open `index.html` directly for local UI checks.
- Run Supabase migrations against the dedicated COGS project before using login/import.
