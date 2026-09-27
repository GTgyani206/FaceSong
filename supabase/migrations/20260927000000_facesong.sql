-- FaceSong: songs table + private face-photo bucket, locked down with RLS.
-- Run in Supabase → SQL Editor (or `supabase db push`). Also enable
-- Authentication → Sign In / Providers → "Allow anonymous sign-ins".

-- ── Songs ──────────────────────────────────────────────────────────────────
create table if not exists public.songs (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at       timestamptz not null default now(),
  title            text not null check (char_length(title) between 1 and 120),
  spec             jsonb not null,
  identity         jsonb not null,
  photo_path       text,
  photo_consent_at timestamptz,
  -- A photo may only be stored with a recorded consent time…
  constraint photo_requires_consent check (photo_path is null or photo_consent_at is not null),
  -- …and only inside the owner's own folder.
  constraint photo_in_own_folder check (photo_path is null or photo_path like user_id::text || '/%')
);

create index if not exists songs_user_created_idx on public.songs (user_id, created_at desc);

alter table public.songs enable row level security;

drop policy if exists "songs: owner can read" on public.songs;
create policy "songs: owner can read" on public.songs
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "songs: owner can insert" on public.songs;
create policy "songs: owner can insert" on public.songs
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "songs: owner can update" on public.songs;
create policy "songs: owner can update" on public.songs
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "songs: owner can delete" on public.songs;
create policy "songs: owner can delete" on public.songs
  for delete to authenticated using (user_id = auth.uid());

-- ── Face photos (private bucket, one folder per user) ───────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('face-photos', 'face-photos', false, 2097152, array['image/jpeg'])
on conflict (id) do update
  set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "face-photos: owner can read" on storage.objects;
create policy "face-photos: owner can read" on storage.objects
  for select to authenticated
  using (bucket_id = 'face-photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "face-photos: owner can upload" on storage.objects;
create policy "face-photos: owner can upload" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'face-photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "face-photos: owner can delete" on storage.objects;
create policy "face-photos: owner can delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'face-photos' and (storage.foldername(name))[1] = auth.uid()::text);
