-- Facebook and Instagram messages in Enquiries (Sammy, 14/10/2026). Messages
-- carry their channel; people who message the Page or the Instagram account
-- become contacts with their Facebook or Instagram id (Meta gives no mobile
-- or email), and each channel has its own "No reply needed".

alter table public.messages drop constraint if exists messages_channel_check;
alter table public.messages add constraint messages_channel_check
  check (channel in ('whatsapp', 'email', 'sms', 'facebook', 'instagram'));

alter table public.contacts drop constraint if exists contacts_source_check;
alter table public.contacts add constraint contacts_source_check
  check (source in ('meta_ad', 'walk_in', 'referral', 'website', 'whatsapp', 'teamup', 'email', 'facebook', 'instagram'));

-- { facebookId, instagramId, instagramUsername }
alter table public.contacts add column if not exists social jsonb;
-- { facebook: { at, by }, instagram: { at, by } }
alter table public.contacts add column if not exists channel_done jsonb;
