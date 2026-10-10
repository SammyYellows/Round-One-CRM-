-- What a contact has told us in their WhatsApp replies, read by Claude
-- (improvement item 16, Sammy 09/10/2026). Shape: Insight in types.ts.
alter table public.contacts add column if not exists insight jsonb;
