-- WhatsApp mailouts (Sammy, 13/10/2026): one approved template to many
-- people, from the Mailouts screen, behind the same Send and confirm.
alter table public.mailouts add column if not exists channel text not null default 'email' check (channel in ('email', 'whatsapp'));
alter table public.mailouts add column if not exists template text;
alter table public.mailout_recipients alter column email drop not null;
alter table public.mailout_recipients add column if not exists phone text;
