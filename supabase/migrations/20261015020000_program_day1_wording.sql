-- Program day 1 (Sammy, 15/10/2026): goes at 09:00 on the Program
-- membership's start date in TeamUp (not when it's bought), with the new
-- welcome email (version B). The WhatsApp step comes off: intro_programme_1
-- is the move-to-recurring message, not the Program start; the new day 1
-- WhatsApp is added once Sammy picks its wording. Still OFF until approved.

update public.automations set steps = '[
  {"kind": "wait_until_start", "daysBefore": 0, "skipIfLate": true},
  {"kind": "email", "to": "contact", "subject": "Welcome to Round One, {first}", "body": "Hi {first},\n\nWelcome to Round One. We’re really glad you’ve joined the 28 Day Program, and we can’t wait to see what you achieve.\n\nTo get the most from it, book your sessions in the TeamUp app a week at a time, on the days you know you can make. If you’ve got an injury or anything the coaches should know, reply and tell us.\n\nAny questions, just reply to this email.\n\nThe Round One team"}
]'::jsonb
where id = 'program_day_1';
