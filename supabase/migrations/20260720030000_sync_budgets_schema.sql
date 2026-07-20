alter table public.budgets
  add column if not exists title text,
  add column if not exists document_type text default 'quick',
  add column if not exists client_name text,
  add column if not exists client_tax_id text,
  add column if not exists client_email text,
  add column if not exists client_phone text,
  add column if not exists client_address text,
  add column if not exists issue_date date,
  add column if not exists notes text,
  add column if not exists technical_report jsonb default '{}'::jsonb,
  add column if not exists tax_rate numeric default 0,
  add column if not exists discount_rate numeric default 0,
  add column if not exists subtotal numeric default 0,
  add column if not exists discount_amount numeric default 0,
  add column if not exists tax_amount numeric default 0,
  add column if not exists total numeric default 0;

update public.budgets
set
  title = coalesce(title, project_name, 'Presupuesto de obra'),
  issue_date = coalesce(issue_date, budget_date),
  tax_rate = coalesce(tax_rate, vat_percentage, 0),
  discount_rate = coalesce(discount_rate, discount_percentage, 0),
  client_name = coalesce(
    client_name,
    client_snapshot->>'name',
    client_snapshot->>'client_name'
  ),
  client_tax_id = coalesce(
    client_tax_id,
    client_snapshot->>'tax_id',
    client_snapshot->>'taxId',
    client_snapshot->>'client_tax_id'
  ),
  client_email = coalesce(
    client_email,
    client_snapshot->>'email'
  ),
  client_phone = coalesce(
    client_phone,
    client_snapshot->>'phone'
  ),
  client_address = coalesce(
    client_address,
    client_snapshot->>'address'
  );

alter table public.budgets
  alter column document_type set default 'quick',
  alter column technical_report set default '{}'::jsonb,
  alter column tax_rate set default 0,
  alter column discount_rate set default 0,
  alter column subtotal set default 0,
  alter column discount_amount set default 0,
  alter column tax_amount set default 0,
  alter column total set default 0;

notify pgrst, 'reload schema';
