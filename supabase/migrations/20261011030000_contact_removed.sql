-- Management can take someone off the CRM (Sammy, 11/10/2026). The row stays
-- (history, and so the TeamUp sync doesn't add them back); this marks it
-- hidden: { "at": <timestamp>, "by": <staff name> }. Null means on the CRM.
alter table contacts add column if not exists removed jsonb;
