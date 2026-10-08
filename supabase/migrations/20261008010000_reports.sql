-- Management reports (Sammy, 08/10/2026): a public bucket for the PDFs the
-- managers get on WhatsApp, and the template that carries them (a document
-- header; submitted to Meta with the Program templates). The schedule and
-- numbers live in settings 'growth_report', edited on the Reports screen,
-- and are off until Sammy switches them on there.
insert into storage.buckets (id, name, public, allowed_mime_types, file_size_limit)
values ('reports', 'reports', true, array['application/pdf'], 8388608)
on conflict (id) do nothing;

alter table public.templates add column if not exists header_document boolean not null default false;

insert into public.templates (name, body, language, category, meta_status, header_document)
values ('management_report', '{report} for Round One, {date}.

{headline}

The full report is attached.', 'en_GB', 'utility', 'draft', true)
on conflict (name) do nothing;
