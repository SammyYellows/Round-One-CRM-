-- Program WhatsApps now read the same as their emails, word for word and
-- paragraph for paragraph, with "reply in this chat" for "reply to this
-- email" (Sammy, 15/10/2026). The 2-days-before one is Sammy's shorter
-- version A, because the email is over WhatsApp's 1,024 characters. Days 21
-- and 28 also get a Choose your membership button (Post Program Discounted,
-- 278693). New names, because the earlier ones are already with Meta.
-- The automations stay OFF.

insert into public.templates (name, body, category, meta_status) values
  ('program_day_14_v2', $b$Hi {first},

You’re halfway through the 28 Day Program. This is usually the point where it starts to feel normal, or where life gets in the way.

Either way, a quick check-in: how many sessions have you managed so far, and is anything getting in the way? Reply in this chat and one of the coaches will come back to you.

The second half is where the results show. See you in the gym.

The Round One team$b$, 'utility', 'draft')
on conflict (name) do nothing;
update public.automations set steps = (
  select jsonb_agg(case when e->>'kind' = 'whatsapp' and e->>'template' = 'program_day_14' then jsonb_set(e, '{template}', '"program_day_14_v2"') else e end order by i)
  from jsonb_array_elements(steps) with ordinality t(e, i)
) where id = 'program_check_in';

insert into public.templates (name, body, category, meta_status) values
  ('program_day_1_v2', $b$Hi {first},

Welcome to Round One. We’re really glad you’ve joined the 28 Day Program, and we can’t wait to see what you achieve.

To get the most from it, book your sessions in the TeamUp app a week at a time, on the days you know you can make. If you’ve got an injury or anything the coaches should know, reply and tell us.

Any questions, just reply in this chat.

The Round One team$b$, 'utility', 'draft')
on conflict (name) do nothing;
update public.automations set steps = (
  select jsonb_agg(case when e->>'kind' = 'whatsapp' and e->>'template' = 'program_day_1' then jsonb_set(e, '{template}', '"program_day_1_v2"') else e end order by i)
  from jsonb_array_elements(steps) with ordinality t(e, i)
) where id = 'program_day_1';

insert into public.templates (name, body, category, meta_status) values
  ('program_day_10_v2', $b$Hi {first},

You’re 10 days in. Around now the newness wears off and it can feel harder to get in. That’s completely normal, everyone feels it, and it’s a sign you’re doing the work.

Keep it simple: just focus on your next session. If you’ve missed one, don’t worry, just book the next.

Want a chat with a coach? Reply here or catch us at the desk.

The Round One team$b$, 'utility', 'draft')
on conflict (name) do nothing;
update public.automations set steps = (
  select jsonb_agg(case when e->>'kind' = 'whatsapp' and e->>'template' = 'program_day_10' then jsonb_set(e, '{template}', '"program_day_10_v2"') else e end order by i)
  from jsonb_array_elements(steps) with ordinality t(e, i)
) where id = 'program_day_10';

insert into public.templates (name, body, category, meta_status) values
  ('program_day_17_v2', $b$Hi {first},

You’re into the second half. If you’ve kept the sessions going, you’ll probably notice things feel a bit easier than they did on day one. That’s the point.

Two things for the rest of the Program: keep the booking habit, and ask the coaches for one thing to work on. A single cue in your technique goes a long way.

Eleven days left. Make them count.

The Round One team$b$, 'utility', 'draft')
on conflict (name) do nothing;
update public.automations set steps = (
  select jsonb_agg(case when e->>'kind' = 'whatsapp' and e->>'template' = 'program_day_17' then jsonb_set(e, '{template}', '"program_day_17_v2"') else e end order by i)
  from jsonb_array_elements(steps) with ordinality t(e, i)
) where id = 'program_day_17';

insert into public.templates (name, body, category, meta_status) values
  ('program_day_24_v2', $b$Hi {first},

Four days left on the Program. Book your last sessions now so they actually happen.

Have a think about what comes next too. If you want to keep training with us, reply in this chat or ask at the desk and we’ll set up whichever membership suits you, with no gap after your last day.

Nearly there.

The Round One team$b$, 'utility', 'draft')
on conflict (name) do nothing;
update public.automations set steps = (
  select jsonb_agg(case when e->>'kind' = 'whatsapp' and e->>'template' = 'program_day_24' then jsonb_set(e, '{template}', '"program_day_24_v2"') else e end order by i)
  from jsonb_array_elements(steps) with ordinality t(e, i)
) where id = 'program_day_24';

insert into public.templates (name, body, category, meta_status, button_text, button_url) values
  ('program_day_28_v2', $b$Hi {first},

That’s your 28 Day Program complete. Huge well done, you showed up and saw it through.

Ready to keep going? You can move onto your membership here:
https://goteamup.com/p/10418134-round-one/memberships/278693/
Remember, your commitment fee is credited back to you over 6 months.

We’d also love your feedback: reply with the best thing about the program and one thing we could do better.

See you in the gym,
The Round One team$b$, 'utility', 'draft', 'Choose your membership', 'https://goteamup.com/p/10418134-round-one/memberships/278693/')
on conflict (name) do nothing;
update public.automations set steps = (
  select jsonb_agg(case when e->>'kind' = 'whatsapp' and e->>'template' = 'program_day_28' then jsonb_set(e, '{template}', '"program_day_28_v2"') else e end order by i)
  from jsonb_array_elements(steps) with ordinality t(e, i)
) where id = 'program_day_28';

insert into public.templates (name, body, category, meta_status) values
  ('program_day_3_v2', $b$Hi {first},

Three days into your 28 Day Program, nice work. Here’s the one habit that makes the biggest difference: book your sessions before the week starts, rather than deciding on the day.

Take two minutes now to book this week’s sessions in the TeamUp app, on the days you know you can make.

Stuck with booking or anything else? Just reply and we’ll help.

The Round One team$b$, 'utility', 'draft')
on conflict (name) do nothing;
update public.automations set steps = (
  select jsonb_agg(case when e->>'kind' = 'whatsapp' and e->>'template' = 'program_day_3' then jsonb_set(e, '{template}', '"program_day_3_v2"') else e end order by i)
  from jsonb_array_elements(steps) with ordinality t(e, i)
) where id = 'program_day_3';

insert into public.templates (name, body, category, meta_status) values
  ('program_day_7_v2', $b$Hi {first},

Well done on finishing your first week. Turning up is the hardest part, and you’ve done it.

We’d love to know how it’s gone: what’s been the hardest bit so far? Reply with a line or two. The coaches read every one.

For week two, book your sessions in the TeamUp app before the week starts.

The Round One team$b$, 'utility', 'draft')
on conflict (name) do nothing;
update public.automations set steps = (
  select jsonb_agg(case when e->>'kind' = 'whatsapp' and e->>'template' = 'program_day_7' then jsonb_set(e, '{template}', '"program_day_7_v2"') else e end order by i)
  from jsonb_array_elements(steps) with ordinality t(e, i)
) where id = 'program_day_7';

insert into public.templates (name, body, category, meta_status, button_text, button_url) values
  ('program_day_21_v2', $b$Hi {first},

One week left of your 28 Day Program. The routine you’ve built is the hard part, and it’d be a shame to lose it.

When you move onto one of our memberships with gym access and classes, your commitment fee is fully credited back over 6 months, so your program ends up essentially free.

You can move onto your membership here:
https://goteamup.com/p/10418134-round-one/memberships/278693/

Or reply in this chat or ask at the desk and we’ll set it up before your last session.

The Round One team$b$, 'utility', 'draft', 'Choose your membership', 'https://goteamup.com/p/10418134-round-one/memberships/278693/')
on conflict (name) do nothing;
update public.automations set steps = (
  select jsonb_agg(case when e->>'kind' = 'whatsapp' and e->>'template' = 'program_day_21' then jsonb_set(e, '{template}', '"program_day_21_v2"') else e end order by i)
  from jsonb_array_elements(steps) with ordinality t(e, i)
) where id = 'program_ending';

insert into public.templates (name, body, category, meta_status) values
  ('program_pre_start_v2', $b$Hi {first},

We’re so excited to have you joining the program and becoming part of Round One! 💪

A quick recap before you start:

Your commitment fee is fully credited back over 6 months once you move onto one of our memberships with gym access and classes, so your 28-day program is essentially free.

The most important thing is building a routine with our normal group classes and the gym, at times that fit your life. Your small group PT sessions are a great extra to get you used to the gym and the coaches:
📅 Tuesday at 10:00 AM
📅 Thursday at 10:00 AM
If these times don’t work, just message us and we’ll chat.

You should also have an invitation to TeamUp, our gym management system. Please set up your account before your first session.

Looking forward to getting started with you! 😊

The Round One team$b$, 'utility', 'draft')
on conflict (name) do nothing;
update public.automations set steps = (
  select jsonb_agg(case when e->>'kind' = 'whatsapp' and e->>'template' = 'program_pre_start' then jsonb_set(e, '{template}', '"program_pre_start_v2"') else e end order by i)
  from jsonb_array_elements(steps) with ordinality t(e, i)
) where id = 'program_pre_start';
