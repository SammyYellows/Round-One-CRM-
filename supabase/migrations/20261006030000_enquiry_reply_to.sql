-- Where the reply should go when it isn't the sender (Sammy, 06/10/2026):
-- website contact-form notifications come from a no-reply address with the
-- real person's email in the body. The AI picks it out; staff can change it.
alter table public.enquiries add column if not exists reply_to text;
