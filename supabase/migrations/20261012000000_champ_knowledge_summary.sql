-- Champ's knowledge as a contents list (Sammy, 11/10/2026): a short summary
-- of each entry, written once by Claude, is what Champ sees on every
-- question; it opens the full text only when a question needs it. Null
-- means not written yet (it's filled in the next time Champ is asked).
alter table champ_knowledge add column if not exists summary text;
