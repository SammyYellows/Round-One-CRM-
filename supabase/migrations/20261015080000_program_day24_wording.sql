-- Program day 24 WhatsApp, picked by Sammy (15/10/2026): B. The email stays as it is.

update public.templates set body = E'Hi {first}, four days to go, you’re nearly there. Book your last sessions in the TeamUp app now and finish strong. Want to keep training with us? Reply here and we’ll set it up before your last day.\n\nThe Round One team', updated_at = now()
where name = 'program_day_24' and meta_status = 'draft';
