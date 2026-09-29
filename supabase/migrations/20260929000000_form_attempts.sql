-- Spam protection for the public trial form: each submission attempt, so the
-- server can limit how often one connection or one mobile number submits.
-- Only a hash of the connection's address is kept, and rows are deleted after
-- a day (src/lib/server/spam.ts).

create table public.form_attempts (
  id bigserial primary key,
  ip_hash text not null,
  phone text,                                -- digits only
  at timestamptz not null default now()
);
create index form_attempts_ip_idx on public.form_attempts (ip_hash, at);
create index form_attempts_phone_idx on public.form_attempts (phone, at);

alter table public.form_attempts enable row level security;
