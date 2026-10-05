-- Win-back email the day after someone gives notice (improvement list
-- item 7, Sammy 06/10/2026). The sync now records TeamUp's
-- is_set_for_cancellation on contact.membership.cancelling and fires
-- membership.cancelling when it flips. This automation is OFF until Sammy
-- has approved the wording (edit it on the Automations screen, then switch on).

insert into public.automations (id, name, summary, enabled, trigger, steps)
values ('win_back', 'Gave notice – win-back', 'The day after someone gives notice to cancel in TeamUp, emails them to see if anything would change their mind. Off until Sammy approves the wording.', false,
  '{"type": "membership.cancelling"}'::jsonb,
  '[{"kind": "wait", "hours": 24}, {"kind": "email", "to": "contact", "marketing": true, "subject": "Sorry to see you go, {first}", "body": "Hi {first},\n\nWe saw you’ve given notice on your membership. No hard feelings, and thank you for training with us.\n\nBefore you go, a couple of things worth knowing:\n\nIf it’s about time or money, there may be a membership that fits better. Facility access only, classes only, or putting your membership on hold for a while are all options.\n\nIf something put you off, tell us. We’d much rather hear it than guess.\n\nIf you’d like to talk it through, just reply to this email or grab one of the coaches next time you’re in. Your membership runs until the end of your notice, so there’s time to decide.\n\n{team}"}]'::jsonb)
on conflict (id) do nothing;
