-- Accountability step 5 (docs/accountability.md): the mid-week nudge, OFF
-- until approved on the Accountability screen. Claude's read of each
-- check-in and the silence signal live in contacts.accountability (jsonb).
insert into public.automations (id, name, summary, enabled, trigger, steps)
values ('accountability_nudge', 'Accountability – mid-week nudge', 'Thursday afternoon for members who asked for a pulse or are under their floor (daily for those who asked for daily): one line on where they are, in their tone. Off until Sammy approves the wording.', false,
  '{"type": "accountability.nudge"}'::jsonb,
  '[{"kind": "email", "to": "contact", "subject": "Midweek, {first}", "body": "{first},\n\n{paceLine}\n\n{team}"}]'::jsonb)
on conflict (id) do nothing;
