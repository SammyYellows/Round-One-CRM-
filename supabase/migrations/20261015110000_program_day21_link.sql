-- Day 21 email gets the Post Program Discounted link too (Sammy, 15/10/2026).
-- The WhatsApp version with a button waits for Sammy's OK before it goes to Meta.

update public.automations set steps = jsonb_set(steps, '{0}', jsonb_build_object('kind', 'email', 'to', 'contact', 'subject', 'Keep your routine going, {first}', 'body', 'Hi {first},

One week left of your 28 Day Program. The routine you’ve built is the hard part, and it’d be a shame to lose it.

When you move onto one of our memberships with gym access and classes, your commitment fee is fully credited back over 6 months, so your program ends up essentially free.

You can move onto your membership here:
https://goteamup.com/p/10418134-round-one/memberships/278693/

Or reply to this email or ask at the desk and we’ll set it up before your last session.

The Round One team'::text))
where id = 'program_ending' and steps->0->>'kind' = 'email';
