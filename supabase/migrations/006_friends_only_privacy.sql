-- ============================================
-- MEMORA — Align RLS with the privacy policy
-- Run this in Supabase SQL Editor
-- ============================================
-- Two changes so the database enforces what the app promises:
--   1. "Shared" memories are readable only by accepted friends, not by
--      every logged-in user.
--   2. Remove the open public_profiles view that let any user enumerate
--      every account's profile fields.
-- No app code changes are required — friends still satisfy the new
-- policies, and the app never queried public_profiles.

-- Helper: are two users accepted friends? (security definer so it can read
-- friend_requests regardless of the caller's row-level access)
create or replace function public.are_friends(a uuid, b uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.friend_requests
    where status = 'accepted'
      and (
        (from_user_id = a and to_user_id = b) or
        (from_user_id = b and to_user_id = a)
      )
  );
$$;

-- 1a. Memories: replace "readable by all" with "readable by friends".
-- (The owner keeps full access via the existing "do anything with own" policy.)
drop policy if exists "Public memories are readable by all" on public.memories;

create policy "Friends can read shared memories"
  on public.memories for select
  using (is_public = true and public.are_friends(auth.uid(), user_id));

-- 1b. Memory photos: same friends-only rule for shared memories.
drop policy if exists "Public memory photos are readable" on public.memory_photos;

create policy "Friends can read shared memory photos"
  on public.memory_photos for select
  using (
    exists (
      select 1 from public.memories m
      where m.id = memory_photos.memory_id
        and m.is_public = true
        and public.are_friends(auth.uid(), m.user_id)
    )
  );

-- 2. Drop the enumerable public_profiles view. The app finds users via the
-- RLS-protected users table (by exact Memora ID), so nothing depends on it.
drop view if exists public.public_profiles;
