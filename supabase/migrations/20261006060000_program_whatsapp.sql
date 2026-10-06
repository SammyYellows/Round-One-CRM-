-- WhatsApp versions of the Program schedule (Sammy, 06/10/2026: they are
-- WhatsApp messages). Utility templates, one per email; each Program
-- automation gets a whatsapp step after its email. Templates need Meta's
-- approval (npm run wa:templates) and the real number at go-live; until
-- then they only reach the test phone. Automations stay OFF.

insert into public.templates (name, body, category, meta_status) values
  ('program_day_3', 'Hi {first}, three days into the Program. The one thing that decides how it goes: book this week’s sessions in the TeamUp app now, on the days you know you can make. Anything unclear, just reply here.

{team}', 'utility', 'draft'),
  ('program_day_7', 'Hi {first}, that’s week one done. Quick one: what was the hardest bit, fitting it in or the sessions themselves? Reply with a line, the coaches read these. Week two: book the sessions first.

{team}', 'utility', 'draft'),
  ('program_day_10', 'Hi {first}, day 10 is where the newness wears off and the excuses get louder. Everyone hits it. Just book the next session, not the next 18 days. Want a word with a coach? Reply here.

{team}', 'utility', 'draft'),
  ('program_day_14', 'Hi {first}, you’re halfway through the 28 Day Program. How many sessions have you managed so far, and is anything getting in the way? Reply here and a coach will come back to you.

{team}', 'utility', 'draft'),
  ('program_day_17', 'Hi {first}, you’re into the second half. Keep the booking habit, and ask the coaches for one thing to work on in your technique. Eleven days left, make them count.

{team}', 'utility', 'draft'),
  ('program_day_21', 'Hi {first}, your 28 Day Program finishes in a week. If you’d like to carry on with no gap, reply here or ask at the desk and we’ll set up the membership that suits you. No joining fee.

{team}', 'utility', 'draft'),
  ('program_day_24', 'Hi {first}, four days left. Book your last sessions now so they happen. If you want to keep training with us, reply here and we’ll sort what comes next before your last day.

{team}', 'utility', 'draft'),
  ('program_day_28', 'Hi {first}, 28 days, done. Well done for seeing it through. Reply with the one thing that was best and the one thing we could do better. And if you’re staying, see you next week.

{team}', 'utility', 'draft')
on conflict (name) do nothing;

update public.automations set steps = steps || '[{"kind": "whatsapp", "template": "program_day_3"}]'::jsonb where id = 'program_day_3' and not (steps @> '[{"kind": "whatsapp", "template": "program_day_3"}]'::jsonb);
update public.automations set steps = steps || '[{"kind": "whatsapp", "template": "program_day_7"}]'::jsonb where id = 'program_day_7' and not (steps @> '[{"kind": "whatsapp", "template": "program_day_7"}]'::jsonb);
update public.automations set steps = steps || '[{"kind": "whatsapp", "template": "program_day_10"}]'::jsonb where id = 'program_day_10' and not (steps @> '[{"kind": "whatsapp", "template": "program_day_10"}]'::jsonb);
update public.automations set steps = steps || '[{"kind": "whatsapp", "template": "program_day_14"}]'::jsonb where id = 'program_check_in' and not (steps @> '[{"kind": "whatsapp", "template": "program_day_14"}]'::jsonb);
update public.automations set steps = steps || '[{"kind": "whatsapp", "template": "program_day_17"}]'::jsonb where id = 'program_day_17' and not (steps @> '[{"kind": "whatsapp", "template": "program_day_17"}]'::jsonb);
update public.automations set steps = steps || '[{"kind": "whatsapp", "template": "program_day_21"}]'::jsonb where id = 'program_ending' and not (steps @> '[{"kind": "whatsapp", "template": "program_day_21"}]'::jsonb);
update public.automations set steps = steps || '[{"kind": "whatsapp", "template": "program_day_24"}]'::jsonb where id = 'program_day_24' and not (steps @> '[{"kind": "whatsapp", "template": "program_day_24"}]'::jsonb);
update public.automations set steps = steps || '[{"kind": "whatsapp", "template": "program_day_28"}]'::jsonb where id = 'program_day_28' and not (steps @> '[{"kind": "whatsapp", "template": "program_day_28"}]'::jsonb);
