-- The Program messages switched on (Sammy, 17/10/2026, "1a, 2a"):
-- everyone on a Program gets the full set however they signed up (no "came
-- through the CRM" / "signed up in TeamUp" split), and day 21 is timed from
-- the start date like the rest (it hung off "membership ends in 7 days",
-- which fires at the 03:00 sync and at once for anyone already past it).
-- People already on a Program are started separately, from where they are.

update public.automations set trigger = trigger - 'via'
where id like 'program\_%' and trigger->>'type' = 'membership.started';

update public.automations
set trigger = '{"type":"membership.started","category":"Program Memberships"}'::jsonb,
    steps = '[{"kind":"wait_until_start","daysBefore":-20,"skipIfLate":true}]'::jsonb || steps
where id = 'program_ending' and trigger->>'type' = 'membership.ending';

update public.automations set enabled = true
where id in ('program_pre_start','program_day_1','program_day_3','program_day_7','program_day_10','program_check_in','program_day_17','program_ending','program_day_24','program_day_28');
