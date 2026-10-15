-- Program intro, two days before the 28 Day Program starts (Sammy,
-- 15/10/2026). Both routes (CRM and straight-in-TeamUp). Waits until 09:00
-- two days before the membership's start date; bought later than that, it
-- sends nothing. OFF until approved on the Program members screen; the
-- WhatsApp template is a draft until it is submitted to Meta.

insert into public.templates (name, body, category, meta_status) values
  ('program_pre_start', 'Hi {first}, it’s Round One. Your 28 Day Program starts in two days. Book your first week’s sessions in the TeamUp app now, on the days you know you can make, and reply here if there’s anything the coaches should know before you start.

{team}', 'utility', 'draft')
on conflict (name) do nothing;

insert into public.automations (id, name, summary, enabled, trigger, steps) values
  ('program_pre_start', 'Program – 2 days before: get ready', 'Two days before the 28 Day Program starts (from TeamUp), how to get ready. Off until approved on the Program members screen.', false,
   '{"type": "membership.started", "category": "Program Memberships"}'::jsonb,
   '[{"kind": "wait_until_start", "daysBefore": 2, "skipIfLate": true}, {"kind": "email", "to": "contact", "subject": "Your 28 Day Program starts in two days, {first}", "body": "Hi {first},\n\nYour 28 Day Program starts in two days, so here’s how to get ready.\n\n1. Book your first week’s sessions in the TeamUp app now, on the days you know you can make.\n2. Wear comfortable gym clothes and trainers, and bring a water bottle.\n3. If you have an injury or anything the coaches should know about, reply to this email and tell us, so they can plan around it.\n\nAny questions before you start, just reply here.\n\nSee you soon.\n\n{team}"}, {"kind": "whatsapp", "template": "program_pre_start"}]'::jsonb)
on conflict (id) do nothing;
