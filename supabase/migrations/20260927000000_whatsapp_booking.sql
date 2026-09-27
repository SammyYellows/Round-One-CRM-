-- WhatsApp sending, self-booking and the real trial form.
-- Mirrors the changes to src/lib/types.ts on 27/09/2026.

-- Why a WhatsApp message failed (Meta's reason), shown in the thread.
alter table public.messages add column if not exists error text;

-- People who message us on WhatsApp first become contacts too.
alter table public.contacts drop constraint if exists contacts_source_check;
alter table public.contacts add constraint contacts_source_check
  check (source in ('meta_ad', 'walk_in', 'referral', 'website', 'whatsapp'));

-- A WhatsApp reply from the contact ends their run of this automation.
alter table public.automations add column if not exists stop_on_reply boolean not null default false;

-- The form's end screen: a headline and an optional "Book a meeting" button.
alter table public.forms add column if not exists thanks_title text;
alter table public.forms add column if not exists book_button text;

-- What a template sends besides its text: a header video (a file in the
-- whatsapp-media storage bucket) and a link button, whose path ends in {{1}}
-- (the contact's id, for their booking page).
alter table public.templates add column if not exists header_video text;
alter table public.templates add column if not exists button_text text;
alter table public.templates add column if not exists button_url text;
