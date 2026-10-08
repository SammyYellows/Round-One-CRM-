-- Accountability steps 2 and 3 (docs/accountability.md): the weekly check-in
-- form and the check-in email, OFF until approved on the Accountability
-- screen. Attendance lives inside contacts.accountability (jsonb).
insert into public.forms (id, slug, name, questions, thanks, thanks_title, responses)
values ('check-in', 'check-in', 'Weekly check-in',
  '[
    {"id":"ci_feel","type":"choice","text":"How did this week actually feel?","options":["Strong","Solid","Scrappy, but I showed up","Struggled","Write-off"]},
    {"id":"ci_blocker","type":"long","text":"If it wasn’t the plan, what got in the way?","help":"Optional.","optional":true},
    {"id":"ci_play","type":"choice","text":"Next week, what’s the play?","options":["On track","Lower the target for a bit","Raise it, too easy","I want a word with a coach"]}
  ]'::jsonb,
  'We’ll factor it in. See you in the gym.', 'Noted', 0)
on conflict (id) do nothing;

insert into public.automations (id, name, summary, enabled, trigger, steps)
values ('accountability_checkin', 'Accountability – weekly check-in', 'At the member''s chosen time each week: how their week went against their floor, in their tone, with the 30-second check-in. Off until Sammy approves the wording.', false,
  '{"type": "accountability.checkin"}'::jsonb,
  '[{"kind": "email", "to": "contact", "subject": "Your week, {first}", "body": "Hi {first},\n\n{paceLine}\n\nThirty seconds, straight answers beat nice ones: {checkinLink}\n\n{team}"}]'::jsonb)
on conflict (id) do nothing;
