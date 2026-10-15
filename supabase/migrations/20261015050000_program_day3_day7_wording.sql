-- Program day 3 and day 7 wording, picked by Sammy (15/10/2026): both B.

update public.automations set steps = jsonb_set(steps, '{1}', jsonb_build_object('kind', 'email', 'to', 'contact', 'subject', 'Three days in, {first}', 'body', E'Hi {first},\n\nThree days into your 28 Day Program, nice work. Here’s the one habit that makes the biggest difference: book your sessions before the week starts, rather than deciding on the day.\n\nTake two minutes now to book this week’s sessions in the TeamUp app, on the days you know you can make.\n\nStuck with booking or anything else? Just reply and we’ll help.\n\nThe Round One team'))
where id = 'program_day_3' and steps->1->>'kind' = 'email';

update public.automations set steps = jsonb_set(steps, '{1}', jsonb_build_object('kind', 'email', 'to', 'contact', 'subject', 'Week one done, well done {first}', 'body', E'Hi {first},\n\nWell done on finishing your first week. Turning up is the hardest part, and you’ve done it.\n\nWe’d love to know how it’s gone: what’s been the hardest bit so far? Reply with a line or two. The coaches read every one.\n\nFor week two, book your sessions in the TeamUp app before the week starts.\n\nThe Round One team'))
where id = 'program_day_7' and steps->1->>'kind' = 'email';

update public.templates set body = E'Hi {first}, three days in, nice work. Quick tip: book this week’s sessions in the TeamUp app now, on the days you know you can make. It’s the habit that makes the biggest difference. Any questions, just reply here.\n\nThe Round One team', updated_at = now()
where name = 'program_day_3' and meta_status = 'draft';

update public.templates set body = E'Hi {first}, week one done, well done. How’s it gone? Reply with the hardest bit so far, the coaches read every one. For week two, book your sessions in the TeamUp app before the week starts.\n\nThe Round One team', updated_at = now()
where name = 'program_day_7' and meta_status = 'draft';
