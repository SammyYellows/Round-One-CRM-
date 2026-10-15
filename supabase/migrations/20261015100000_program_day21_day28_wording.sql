-- Program days 21 and 28 wording, picked by Sammy (15/10/2026), using the
-- facts from his 2-days-before template: the commitment fee is credited back
-- over 6 months on a membership with gym access and classes. Day 28 links to
-- TeamUp's Post Program Discounted Memberships (id 278693). Still OFF.

update public.automations set steps = jsonb_set(steps, '{0}', jsonb_build_object('kind', 'email', 'to', 'contact', 'subject', 'Keep your routine going, {first}', 'body', 'Hi {first},

One week left of your 28 Day Program. The routine you’ve built is the hard part, and it’d be a shame to lose it.

When you move onto one of our memberships with gym access and classes, your commitment fee is fully credited back over 6 months, so your program ends up essentially free.

Reply to this email or ask at the desk and we’ll set it up before your last session.

The Round One team'::text))
where id = 'program_ending' and steps->0->>'kind' = 'email';

update public.automations set steps = jsonb_set(steps, '{1}', jsonb_build_object('kind', 'email', 'to', 'contact', 'subject', 'You did it, {first}', 'body', 'Hi {first},

That’s your 28 Day Program complete. Huge well done, you showed up and saw it through.

Ready to keep going? You can move onto your membership here:
https://goteamup.com/p/10418134-round-one/memberships/278693/
Remember, your commitment fee is credited back to you over 6 months.

We’d also love your feedback: reply with the best thing about the program and one thing we could do better.

See you in the gym,
The Round One team'::text))
where id = 'program_day_28' and steps->1->>'kind' = 'email';

update public.templates set body = 'Hi {first}, one week to go. Don’t lose the routine you’ve built: move onto a membership with gym access and classes and your commitment fee is credited back over 6 months. Reply here and we’ll set it up before your last session.

The Round One team', updated_at = now() where name = 'program_day_21' and meta_status = 'draft';
update public.templates set body = 'Hi {first}, your 28 Day Program is complete, huge well done. Keep your routine going: tap below to move onto your membership, and your commitment fee is credited back over 6 months. We’d love to hear how you found it too, just reply here.

The Round One team', button_text = 'Choose your membership', button_url = 'https://goteamup.com/p/10418134-round-one/memberships/278693/', updated_at = now() where name = 'program_day_28' and meta_status = 'draft';
