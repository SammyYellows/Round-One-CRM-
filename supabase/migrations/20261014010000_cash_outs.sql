-- Cashing out the till from the CRM (Sammy, 14/10/2026): each time
-- management counts the till, how much was there, what the CRM expected
-- (the float left last time plus cash sales since, from Epos Now), and how
-- much was left in as float. The first one has no expected amount: it's the
-- starting count.
create table if not exists public.cash_outs (
  id uuid primary key default gen_random_uuid(),
  at timestamptz not null default now(),
  "by" text not null,
  counted numeric(10,2) not null,
  expected numeric(10,2),
  float_left numeric(10,2) not null default 0,
  cash_sales numeric(10,2),
  cash_sales_count integer,
  note text
);
alter table public.cash_outs enable row level security;
create index if not exists cash_outs_at_idx on public.cash_outs (at desc);
