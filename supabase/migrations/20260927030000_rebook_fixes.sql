-- From Sammy's phone test (27/09/2026):
-- - Filling the form in again while already booked sent the "please book"
--   WhatsApp and email again. The booking push now only runs for people who
--   haven't booked (staff still get the new-lead alert).
-- - Moving a booked trial to a new time now confirms the new time
--   (new automation "Trial moved – new time", trigger appointment.moved).

insert into public.automations (id, name, summary, enabled, trigger, steps, stop_on_reply) values
  ('new_lead', 'New lead – booking push', 'Tells the front desk, emails and WhatsApps the lead a booking link, then nudges twice, two days apart, until they book or reply. GymGrow workflow 1.', true, '{"type":"form.submitted","formId":"free-trial"}'::jsonb, '[{"kind":"email","to":"staff","subject":"New trial lead: {name}"},{"kind":"if_stage_in","stages":["new","contacted","no_show","nurture","lost"]},{"kind":"email","to":"contact","subject":"{gym} next steps","body":"Hi {first},\n\nThanks for your enquiry! We’re excited to help you get started.\n\nThe next step is to book your onsite intro session. This gives us a chance to learn more about your goals, show you around, and explain how everything works.\n\nYou can choose a time that suits you here:\n{bookLink}\n\nIf you have any questions before booking, just reply to this email and we’ll help you out.\n\nSpeak soon,\nThe Round One team"},{"kind":"whatsapp","template":"leads_1"},{"kind":"wait","hours":48},{"kind":"if_stage_in","stages":["new","contacted"]},{"kind":"whatsapp","template":"leads_2"},{"kind":"wait","hours":48},{"kind":"if_stage_in","stages":["new","contacted"]},{"kind":"whatsapp","template":"leads_3"}]'::jsonb, true),
  ('trial_moved', 'Trial moved – new time', 'When a booked free trial moves to a new time (by them on their booking page, or by staff), confirms the new time. The reminders move with it.', true, '{"type":"appointment.moved"}'::jsonb, '[{"kind":"email","to":"staff","subject":"Trial moved: {name}, now {date} at {time}"},{"kind":"whatsapp","template":"discovery_1"}]'::jsonb, false)
on conflict (id) do update set name = excluded.name, summary = excluded.summary, trigger = excluded.trigger,
  steps = excluded.steps, stop_on_reply = excluded.stop_on_reply;
