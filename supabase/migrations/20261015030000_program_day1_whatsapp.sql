-- Program day 1 WhatsApp (Sammy, 15/10/2026, version A), after the day 1
-- email. Utility template; goes to Meta for approval. Still OFF.

insert into public.templates (name, body, category, meta_status) values
  ('program_day_1', 'Hi {first}, welcome to Round One. Today’s the first day of your 28 Day Program and we can’t wait to see what you achieve. Book this week’s sessions in the TeamUp app, and reply here if there’s anything the coaches should know.

{team}', 'utility', 'draft')
on conflict (name) do nothing;

update public.automations set steps = steps || '[{"kind": "whatsapp", "template": "program_day_1"}]'::jsonb
where id = 'program_day_1' and not steps::text like '%"program_day_1"%';
