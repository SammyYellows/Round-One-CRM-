-- First and last name on the questionnaire (Sammy, 08/10/2026). The form's
-- name question becomes two boxes; the first box is kept on the contact so
-- "Hi {first}" never has to guess.
alter table public.contacts add column if not exists first_name text;

update public.forms
   set questions = (
     select jsonb_agg(case when q->>'id' = 'q10' and q->>'field' = 'name'
                           then q || '{"type":"name","text":"What’s your name?"}'::jsonb
                           else q end)
       from jsonb_array_elements(questions) q)
 where slug = 'free-trial';
