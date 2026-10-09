-- Sammy, 09/10/2026: the win-back also goes as a WhatsApp to the number on
-- the account (marketing template, needs Meta's approval; skipped for
-- opt-outs and for anyone without a mobile), and a weekly "who hasn't
-- paid" report joins the managers' reports (off until switched on in
-- Reports → Settings; WhatsApp's API can't post into groups, so it goes
-- to the managers' numbers).
insert into public.templates (name, body, category, meta_status) values
  ('win_back', 'Hi {first}, we saw you’ve given notice on your membership. No hard feelings. If it’s about time or money there may be a membership that fits better, or a hold for a while. If something put you off, tell us, we’d rather hear it than guess. Reply here or grab a coach next time you’re in.

{team}', 'marketing', 'draft')
on conflict (name) do nothing;

update public.automations
   set steps = steps || '[{"kind": "whatsapp", "template": "win_back"}]'::jsonb
 where id = 'win_back'
   and not exists (select 1 from jsonb_array_elements(steps) st where st->>'kind' = 'whatsapp');
