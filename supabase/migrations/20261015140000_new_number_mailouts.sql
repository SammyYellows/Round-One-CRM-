-- The new number mailouts (Sammy, 15/10/2026): both go to everyone who has
-- messaged us on WhatsApp plus every current member, and the email's link
-- opens the contact card itself, shown as a Save our number button. Still
-- drafts: nothing goes until staff press Send and confirm the count.

update public.mailouts
set audience = '{"membership":"active","categories":[],"leadStages":[],"chattedOnWhatsApp":true}'::jsonb
where id in ('22c8d2e5-90b4-48be-9458-65d262967a6e', 'a9d08d29-3ed8-4789-921d-1bcbdf43fb30') and status = 'draft';

update public.mailouts
set body = replace(body, 'Save it in one tap: https://crm.round1boxfit.co.uk/contact', 'Save it in one tap:
https://crm.round1boxfit.co.uk/contact.vcf')
where id = '22c8d2e5-90b4-48be-9458-65d262967a6e' and status = 'draft';
