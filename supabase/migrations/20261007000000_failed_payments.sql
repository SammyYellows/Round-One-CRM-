-- Failed payments (Sammy, 07/10/2026): the sync records TeamUp's failed
-- payment attempts and open invoices on contact.membership, and fires
-- payment.failed when the attempts reach three. This automation emails the
-- member; OFF until approved on the Failed payments screen.

insert into public.automations (id, name, summary, enabled, trigger, steps) values
  ('payment_failed', 'Payment failed – update your details', 'When TeamUp has logged three failed payment attempts, asks them to update their payment details. Off until approved on the Failed payments screen.', false,
   '{"type": "payment.failed"}'::jsonb,
   '[{"kind": "email", "to": "contact", "subject": "Your payment didn’t go through, {first}", "body": "Hi {first},\n\nYour membership payment has failed a few times now, so we wanted to check in before it causes a problem with your membership.\n\nUsually it’s an expired card or a change of bank. You can update your payment details in the TeamUp app, or reply to this email and we’ll sort it with you.\n\nIf something’s changed and you’d rather talk it through, just reply. We’d rather know than guess.\n\n{team}"}]'::jsonb)
on conflict (id) do nothing;
