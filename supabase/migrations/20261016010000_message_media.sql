-- Photos, stickers, videos, voice notes and documents people send on
-- WhatsApp, Facebook and Instagram (Sammy, 16/10/2026). Saved in a private
-- bucket (staff see them through /api/media) and listed on the message.

alter table public.messages add column if not exists media jsonb;

insert into storage.buckets (id, name, public, file_size_limit)
values ('message-media', 'message-media', false, 26214400)
on conflict (id) do nothing;
