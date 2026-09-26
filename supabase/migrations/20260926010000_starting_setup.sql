-- Starting setup for a new CRM: the free-trial calendar, the two trial forms,
-- the three automations and their WhatsApp templates, copied from the
-- prototype's src/lib/seed.ts. No people: contacts start empty.
-- Also adds a response counter to forms, which the Forms screen shows.
-- Safe to run on a database that already has these rows.

alter table public.forms add column if not exists responses integer not null default 0;

insert into public.calendars (id, name, duration_min, style, book_trial) values
  ('trial', 'Free trial', 60, 'trial', true)
on conflict (id) do nothing;

insert into public.templates (name, body, category) values
  ('trial_welcome', 'Hi {first}, thanks for asking about a free trial at Round One. Which evening suits you: Tuesday, Wednesday or Thursday?', 'utility'),
  ('trial_nudge', 'Hi {first}, just checking in. Would you like to book your free trial this week? Reply with a day and we’ll sort it.', 'marketing'),
  ('trial_confirmed', 'You’re booked in, {first}. Your free trial is on {trial}. Bring trainers and water, and we’ll lend you gloves.', 'utility'),
  ('trial_reminder', 'See you soon, {first}. Your trial starts at {trialTime}.', 'utility'),
  ('missed_you', 'Sorry we missed you, {first}. Want to rebook your free trial? Reply with a day that works.', 'utility')
on conflict (name) do nothing;

insert into public.forms (id, slug, name, thanks, questions) values
  ('free-trial', 'free-trial', 'Free trial', 'We’ll message you on WhatsApp shortly to book your free trial.', '[{"id": "q1", "type": "text", "field": "name", "text": "What’s your name?"}, {"id": "q2", "type": "phone", "field": "phone", "text": "What’s your mobile number?", "help": "We’ll message you on WhatsApp to book your trial."}, {"id": "q3", "type": "email", "field": "email", "text": "And your email?"}, {"id": "q4", "type": "choice", "text": "What’s your main goal?", "options": ["Get fitter", "Learn to box", "Build confidence", "Compete"]}, {"id": "q5", "type": "choice", "text": "Have you boxed before?", "options": ["Never", "A little", "Yes, regularly"]}, {"id": "q6", "type": "choice", "text": "When could you train?", "options": ["Weekday mornings", "Weekday evenings", "Weekends"]}]'::jsonb),
  ('kids', 'kids-trial', 'Kids’ free trial', 'Thanks. We’ll be in touch shortly to book your child’s free trial.', '[{"id": "k1", "type": "text", "field": "name", "text": "What’s your name?"}, {"id": "k2", "type": "phone", "field": "phone", "text": "Your mobile number"}, {"id": "k3", "type": "choice", "text": "How old is your child?", "options": ["5–7", "8–12", "13–16"]}]'::jsonb)
on conflict (id) do nothing;

insert into public.automations (id, name, summary, trigger, steps) values
  ('new_trial', 'New trial lead', 'Welcomes a new trial lead on WhatsApp, tells the front desk, then nudges if they haven’t booked.', '{"type": "form.submitted", "formId": "free-trial"}'::jsonb, '[{"kind": "whatsapp", "template": "trial_welcome"}, {"kind": "email", "to": "staff", "subject": "New trial lead: {name}"}, {"kind": "wait", "hours": 24}, {"kind": "if_stage_in", "stages": ["new", "contacted"]}, {"kind": "whatsapp", "template": "trial_nudge"}]'::jsonb),
  ('trial_reminder', 'Trial reminder', 'Confirms the booking, then reminds them on the day.', '{"type": "stage.changed", "to": "booked"}'::jsonb, '[{"kind": "whatsapp", "template": "trial_confirmed"}, {"kind": "wait_until_trial", "hoursBefore": 2}, {"kind": "whatsapp", "template": "trial_reminder"}]'::jsonb),
  ('no_show', 'Trial no-show', 'Gets back in touch with anyone who missed their trial.', '{"type": "tag.added", "tag": "no-show"}'::jsonb, '[{"kind": "whatsapp", "template": "missed_you"}, {"kind": "wait", "hours": 48}, {"kind": "if_stage_in", "stages": ["no_show"]}, {"kind": "task", "text": "Call {name} about rebooking their trial"}]'::jsonb)
on conflict (id) do nothing;
