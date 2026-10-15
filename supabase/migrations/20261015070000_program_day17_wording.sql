-- Program day 17 WhatsApp, picked by Sammy (15/10/2026): B. The email stays as it is.

update public.templates set body = E'Hi {first}, you’re into the second half, great work. Keep booking your sessions ahead, and ask a coach for one thing to work on in your technique. 11 days left, let’s make them count.\n\nThe Round One team', updated_at = now()
where name = 'program_day_17' and meta_status = 'draft';
