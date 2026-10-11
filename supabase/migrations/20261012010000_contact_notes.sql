-- Staff notes on a contact (Sammy, 12/10/2026): a list of
-- { id, at, by, text }, newest first. Added from the contact page.
alter table contacts add column if not exists notes jsonb;
