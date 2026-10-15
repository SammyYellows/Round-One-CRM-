-- Program days timed from the Program membership's start date in TeamUp,
-- not from when it first showed up (usually the purchase) (Sammy,
-- 15/10/2026: "the program starts from the start of the program membership
-- they are associated with in TeamUp"). Each day-N message waits until 09:00
-- on day N; more than a day late, it sends nothing. Wording unchanged; all
-- still OFF until approved.

update public.automations set steps = jsonb_set(steps, '{0}', jsonb_build_object('kind', 'wait_until_start', 'daysBefore', d.offset_days, 'skipIfLate', true))
from (values ('program_day_3', -2), ('program_day_7', -6), ('program_day_10', -9), ('program_check_in', -14), ('program_day_17', -16), ('program_day_24', -23), ('program_day_28', -27)) as d(id, offset_days)
where automations.id = d.id and automations.steps->0->>'kind' = 'wait';
