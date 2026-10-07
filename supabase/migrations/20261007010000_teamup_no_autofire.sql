-- Sales that TeamUp reports no longer fire the pipeline's Sold automations
-- (code change in importMembers, Sammy 07/10/2026: "I don't want it to fire
-- yet"). The TeamUp-driven day-1 Program welcome is its own automation, OFF
-- until approved on the Program members screen.

insert into public.automations (id, name, summary, enabled, trigger, steps) values
  ('program_day_1', 'Program – day 1 welcome (from TeamUp)', 'When a Program membership starts in TeamUp, the welcome email and WhatsApp. Off until approved on the Program members screen.', false,
   '{"type": "membership.started", "category": "Program Memberships"}'::jsonb,
   '[{"kind": "email", "to": "contact", "subject": "Welcome to {gym}, {first}!", "body": "Hey {first},\n\nWe’re so excited to have you starting with us.\n\nYour first session is the beginning of something great - we’re really glad you’ve taken this step and we can’t wait to see what you achieve.\n\nIf you have any questions before your first session, just reach out and we’ll help you out.\n\nThe Round One team"}, {"kind": "whatsapp", "template": "intro_programme_1"}]'::jsonb)
on conflict (id) do nothing;
