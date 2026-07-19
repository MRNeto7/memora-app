-- ============================================
-- MEMORA — Make Mimora-ID lookup and friend profiles work under RLS
-- Run this in Supabase SQL Editor
-- ============================================
-- The users table is readable only for your own row (001) or rows with
-- profile_public = true — so searching a friend's exact Mimora ID returned
-- nothing, and even accepted friends couldn't read each other's names
-- (friend lists, tag notifications). Two additions:

-- 1. Exact-ID lookup, security definer, MINIMAL fields — returns only
--    id / memora_id / display_name for an exact match. No enumeration
--    beyond guessing full IDs, and never exposes email or other columns.
create or replace function public.find_user_by_memora_id(search_id text)
returns table (id uuid, memora_id text, display_name text)
language sql
security definer
stable
set search_path = public
as $$
  select u.id, u.memora_id, u.display_name
  from public.users u
  where u.memora_id = upper(trim(search_id));
$$;

-- 2. Users linked by ANY friend request (pending or accepted, either
--    direction) can read each other's profiles — names in friend lists,
--    "X wants to add you", tagger names in notifications.
create or replace function public.has_friend_link(a uuid, b uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.friend_requests
    where (from_user_id = a and to_user_id = b)
       or (from_user_id = b and to_user_id = a)
  );
$$;

drop policy if exists "Users linked by a friend request can read each other" on public.users;
create policy "Users linked by a friend request can read each other"
  on public.users for select
  using (public.has_friend_link(auth.uid(), id));
