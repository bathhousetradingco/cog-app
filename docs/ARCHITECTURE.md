# Architecture

## Current Shape

- Static browser app using `index.html`, `assets/app.css`, and `assets/app.js`.
- Supabase Auth protects the UI.
- Supabase Postgres stores the shared Bathhouse COGS workspace.
- SheetJS parses the existing Excel workbook in the browser for import/bootstrap.

## Boundaries

- The app is not currently connected to Shopify.
- The app should not share database tables with `amazon-categorizer`.
- Every authenticated Bathhouse user sees the same COGS catalog.
- Anonymous users cannot read or write COGS tables.

## Data Model

- `cogs_categories` stores item and formula categories.
- `cogs_cost_items` stores raw ingredient, packaging, accessory, fragrance, and kit costs.
- `cogs_formulas` stores workbook formulas and product formula outputs.
- `cogs_formula_lines` links parsed cell references back to cost items where possible.
- `cogs_workbook_cells` stores workbook cell values/formulas for recalculation compatibility.
- `cogs_price_history` records cost edits.

## Formula Strategy

The first migration preserves workbook formulas and cell references so the current spreadsheet can be imported quickly. Over time, formulas should be converted from cell-coordinate expressions into curated named recipes.
