create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.cogs_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  sort_order integer not null default 1000,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.cogs_workbook_cells (
  ref text primary key,
  raw_value text,
  numeric_value numeric,
  formula_expression text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.cogs_cost_items (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references public.cogs_categories(id) on delete set null,
  name text not null,
  supplier text,
  purchase_price numeric,
  purchase_quantity numeric,
  purchase_unit text,
  cost_per_oz numeric,
  cost_per_gram numeric,
  cost_per_unit numeric,
  source_name_cell text,
  source_cells jsonb not null default '{}'::jsonb,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (category_id, name)
);

create table if not exists public.cogs_formulas (
  id uuid primary key default gen_random_uuid(),
  category text not null default 'Uncategorized',
  name text not null,
  label text,
  source_cell text unique,
  formula_expression text,
  workbook_value numeric,
  yield_quantity numeric,
  yield_unit text,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.cogs_formula_lines (
  id uuid primary key default gen_random_uuid(),
  formula_id uuid not null references public.cogs_formulas(id) on delete cascade,
  cost_item_id uuid references public.cogs_cost_items(id) on delete set null,
  source_cell_ref text,
  source_item_name text,
  quantity numeric,
  unit text,
  sort_order integer not null default 1000,
  created_at timestamptz not null default now()
);

create table if not exists public.cogs_price_history (
  id uuid primary key default gen_random_uuid(),
  cost_item_id uuid not null references public.cogs_cost_items(id) on delete cascade,
  old_cost_per_oz numeric,
  new_cost_per_oz numeric,
  old_cost_per_gram numeric,
  new_cost_per_gram numeric,
  old_cost_per_unit numeric,
  new_cost_per_unit numeric,
  changed_by uuid references auth.users(id) on delete set null,
  changed_at timestamptz not null default now()
);

create index if not exists cogs_cost_items_category_idx
  on public.cogs_cost_items(category_id);

create index if not exists cogs_formula_lines_formula_idx
  on public.cogs_formula_lines(formula_id);

create index if not exists cogs_formula_lines_cost_item_idx
  on public.cogs_formula_lines(cost_item_id);

drop trigger if exists set_cogs_categories_updated_at on public.cogs_categories;
create trigger set_cogs_categories_updated_at
before update on public.cogs_categories
for each row execute function public.set_updated_at();

drop trigger if exists set_cogs_workbook_cells_updated_at on public.cogs_workbook_cells;
create trigger set_cogs_workbook_cells_updated_at
before update on public.cogs_workbook_cells
for each row execute function public.set_updated_at();

drop trigger if exists set_cogs_cost_items_updated_at on public.cogs_cost_items;
create trigger set_cogs_cost_items_updated_at
before update on public.cogs_cost_items
for each row execute function public.set_updated_at();

drop trigger if exists set_cogs_formulas_updated_at on public.cogs_formulas;
create trigger set_cogs_formulas_updated_at
before update on public.cogs_formulas
for each row execute function public.set_updated_at();

alter table public.cogs_categories enable row level security;
alter table public.cogs_workbook_cells enable row level security;
alter table public.cogs_cost_items enable row level security;
alter table public.cogs_formulas enable row level security;
alter table public.cogs_formula_lines enable row level security;
alter table public.cogs_price_history enable row level security;

alter table public.cogs_categories force row level security;
alter table public.cogs_workbook_cells force row level security;
alter table public.cogs_cost_items force row level security;
alter table public.cogs_formulas force row level security;
alter table public.cogs_formula_lines force row level security;
alter table public.cogs_price_history force row level security;

revoke all on table public.cogs_categories from anon;
revoke all on table public.cogs_workbook_cells from anon;
revoke all on table public.cogs_cost_items from anon;
revoke all on table public.cogs_formulas from anon;
revoke all on table public.cogs_formula_lines from anon;
revoke all on table public.cogs_price_history from anon;

grant select, insert, update, delete on table public.cogs_categories to authenticated;
grant select, insert, update, delete on table public.cogs_workbook_cells to authenticated;
grant select, insert, update, delete on table public.cogs_cost_items to authenticated;
grant select, insert, update, delete on table public.cogs_formulas to authenticated;
grant select, insert, update, delete on table public.cogs_formula_lines to authenticated;
grant select, insert on table public.cogs_price_history to authenticated;

drop policy if exists cogs_categories_shared_access on public.cogs_categories;
create policy cogs_categories_shared_access
  on public.cogs_categories
  for all
  to authenticated
  using (auth.uid() is not null)
  with check (auth.uid() is not null);

drop policy if exists cogs_workbook_cells_shared_access on public.cogs_workbook_cells;
create policy cogs_workbook_cells_shared_access
  on public.cogs_workbook_cells
  for all
  to authenticated
  using (auth.uid() is not null)
  with check (auth.uid() is not null);

drop policy if exists cogs_cost_items_shared_access on public.cogs_cost_items;
create policy cogs_cost_items_shared_access
  on public.cogs_cost_items
  for all
  to authenticated
  using (auth.uid() is not null)
  with check (auth.uid() is not null);

drop policy if exists cogs_formulas_shared_access on public.cogs_formulas;
create policy cogs_formulas_shared_access
  on public.cogs_formulas
  for all
  to authenticated
  using (auth.uid() is not null)
  with check (auth.uid() is not null);

drop policy if exists cogs_formula_lines_shared_access on public.cogs_formula_lines;
create policy cogs_formula_lines_shared_access
  on public.cogs_formula_lines
  for all
  to authenticated
  using (auth.uid() is not null)
  with check (auth.uid() is not null);

drop policy if exists cogs_price_history_shared_select on public.cogs_price_history;
create policy cogs_price_history_shared_select
  on public.cogs_price_history
  for select
  to authenticated
  using (auth.uid() is not null);

drop policy if exists cogs_price_history_shared_insert on public.cogs_price_history;
create policy cogs_price_history_shared_insert
  on public.cogs_price_history
  for insert
  to authenticated
  with check (auth.uid() is not null);
