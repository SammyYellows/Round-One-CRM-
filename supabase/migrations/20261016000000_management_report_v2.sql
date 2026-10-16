-- The reports' WhatsApp message signed by Champ (Sammy, 16/10/2026, version B).
-- reports.ts uses it once Meta has approved it, the old one until then.
-- {report}, {date} and {headline} are filled by sendReport; the PDF is the
-- document header above the message.

insert into public.templates (name, body, category, meta_status, header_document) values
  ('management_report_v2', $b$Morning, it's Champ. Here's your {report} for Round One, {date}.

{headline}

Everything's in the PDF above. Any questions, ask me in Ask Champ.

Champ, Round One's AI helper$b$, 'utility', 'draft', true)
on conflict (name) do nothing;
