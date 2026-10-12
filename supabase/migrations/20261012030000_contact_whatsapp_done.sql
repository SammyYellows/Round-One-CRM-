-- "No reply needed" on a contact's WhatsApp conversation (Sammy, 12/10/2026):
-- { at, by }. The Enquiries page's WhatsApp tab stops showing it as waiting
-- until they message again.
alter table contacts add column if not exists whatsapp_done jsonb;
