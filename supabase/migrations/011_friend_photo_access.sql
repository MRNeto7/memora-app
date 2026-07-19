-- ============================================
-- MEMORA — Friends can load shared memory photos (the actual files)
-- Run this in Supabase SQL Editor
-- ============================================
-- 006 let friends read shared memories' DB rows, but no storage policy
-- ever covered the photo OBJECTS — so the friend profile view rendered
-- empty frames. Mirrors 007's linked-photos pattern: objects live at
-- {ownerId}/{memoryId}/(thumbs/){file}, so folder[2] identifies the
-- memory; grant read when that memory is shared by an accepted friend.

create or replace function public.is_friend_shared_memory(mem_id uuid, viewer uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.memories m
    where m.id = mem_id
      and m.is_public = true
      and public.are_friends(viewer, m.user_id)
  );
$$;

drop policy if exists "Friends can read shared memory photo objects" on storage.objects;
create policy "Friends can read shared memory photo objects"
  on storage.objects for select
  using (
    bucket_id = 'memory-photos'
    and array_length(storage.foldername(name), 1) >= 2
    and (storage.foldername(name))[2] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and public.is_friend_shared_memory(((storage.foldername(name))[2])::uuid, auth.uid())
  );
