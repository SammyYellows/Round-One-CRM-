-- Sammy, 29/09/2026: remove the kids' free trial form. It came from the
-- prototype with made-up questions and nothing linked to it. A proper one can
-- be added later if needed.
delete from public.forms where id = 'kids';
