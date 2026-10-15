-- Program day 10 wording, picked by Sammy (15/10/2026): B. Day 14 stays as it is.

update public.automations set steps = jsonb_set(steps, '{1}', jsonb_build_object('kind', 'email', 'to', 'contact', 'subject', 'Day 10, {first}: keep going', 'body', E'Hi {first},\n\nYou’re 10 days in. Around now the newness wears off and it can feel harder to get in. That’s completely normal, everyone feels it, and it’s a sign you’re doing the work.\n\nKeep it simple: just focus on your next session. If you’ve missed one, don’t worry, just book the next.\n\nWant a chat with a coach? Reply here or catch us at the desk.\n\nThe Round One team'))
where id = 'program_day_10' and steps->1->>'kind' = 'email';

update public.templates set body = E'Hi {first}, 10 days in, keep going. This is when it can start to feel harder, and that’s normal. Just focus on your next session and get it booked. Fancy a chat with a coach? Reply here.\n\nThe Round One team', updated_at = now()
where name = 'program_day_10' and meta_status = 'draft';
