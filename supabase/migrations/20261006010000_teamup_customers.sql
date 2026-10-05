-- Every TeamUp customer, not just those with a membership (Sammy,
-- 06/10/2026): the 700-odd people who made a TeamUp account for a free
-- class or an enquiry and never bought. They become contacts (source
-- teamup, off the Pipeline) so mailouts can reach them, filtered and sorted
-- by when they came in. TeamUp's own customer status is kept here.

alter table public.contacts add column if not exists teamup jsonb;   -- shape: TeamUpCustomer in types.ts
create index if not exists contacts_teamup_customer_idx on public.contacts ((teamup->>'customerId'));
