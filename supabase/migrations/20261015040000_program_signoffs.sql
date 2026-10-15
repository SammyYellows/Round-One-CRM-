-- Meta refuses a template that ends with a placeholder, so the Program
-- WhatsApp templates sign off with the words, not {team} (15/10/2026).

update public.templates set body = regexp_replace(body, '\{team\}\s*$', 'The Round One team'), updated_at = now()
where name like 'program_%' and meta_status = 'draft' and body ~ '\{team\}\s*$';
