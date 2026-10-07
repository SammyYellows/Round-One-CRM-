-- Two routes (Sammy, 07/10/2026). "Sold – Programme" on the pipeline means
-- they bought the 28 Day Program (£79 upfront; finish it, move to recurring
-- and the £79 is refunded against the membership). Sammy then sets them up
-- in TeamUp, matched to the CRM contact on email: that is the CRM route,
-- which gets the pipeline welcome at the sale and days 3–28 from TeamUp.
-- People who sign up straight in TeamUp are the other route, with their own
-- schedule (day 1 welcome so far; the rest to come from Sammy).

update public.automations set trigger = trigger || '{"via":"crm"}'::jsonb
 where id in ('program_day_3','program_day_7','program_day_10','program_check_in','program_day_17','program_ending','program_day_24','program_day_28');
update public.automations set trigger = trigger || '{"via":"teamup"}'::jsonb where id = 'program_day_1';

-- The week-to-go offer mentions the refund.
update public.automations
   set steps = jsonb_set(steps, '{0,body}', to_jsonb('Hi {first},

Your 28 Day Program finishes in a week. Thank you for putting the work in.

If you’d like to carry on, you can move straight onto a recurring membership so there’s no gap: Premium for full access plus classes, Classes Only, or Facility Access Only if you’d rather train on your own. And because you finished the Program, the £79 you paid for it comes back off your membership, so your first 28 days end up free. No joining fee, and you can cancel any time with 30 days’ notice.

Reply to this email or ask at the desk and we’ll set it up before your last session.

{team}'::text))
 where id = 'program_ending' and steps->0->>'kind' = 'email';

-- The facts sheet learns what the Program actually is.
update public.settings
   set value = to_jsonb(replace(value #>> '{}',
     '- 28 Day Program: a four-week intro programme for beginners. Price and start dates: ask staff.',
     '- 28 Day Program: £79 paid upfront for four weeks. Anyone who finishes it and moves onto a recurring membership gets the £79 refunded against that membership, so their first 28 days end up free. Start dates: ask staff.')),
       updated_at = now()
 where id = 'gym_facts';
