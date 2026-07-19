-- ============================================
-- MEMORA — Tag friends in memories (copy-on-tag)
-- Run this in Supabase SQL Editor
-- ============================================
-- Model: tagging never shares a live memory. The tagged friend gets a
-- notification and can SAVE THEIR OWN COPY (linked back to the original
-- via origin_memory_id). Everyone owns their version — own ratings, own
-- notes, own photos — and linked versions can copy photos across.
--
-- Tagging is friends-only, enforced here via are_friends() (006), which
-- itself rides on the Mimora-ID friend system.

-- 1. Lineage link between an original memory and saved copies.
--    on delete set null: deleting the original never touches copies.
alter table public.memories
  add column origin_memory_id uuid references public.memories(id) on delete set null;

create index memories_origin_memory_id_idx on public.memories(origin_memory_id);

-- 2. Tags
create table public.memory_tags (
  id uuid primary key default gen_random_uuid(),
  memory_id uuid not null references public.memories(id) on delete cascade,
  tagger_id uuid not null references public.users(id) on delete cascade,
  tagged_user_id uuid not null references public.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'saved', 'dismissed')),
  created_at timestamptz not null default now(),
  unique (memory_id, tagged_user_id)
);

create index memory_tags_tagged_user_idx on public.memory_tags(tagged_user_id, status);
create index memory_tags_memory_id_idx on public.memory_tags(memory_id);

alter table public.memory_tags enable row level security;

create policy "Users can tag friends in their own memories"
  on public.memory_tags for insert
  with check (
    tagger_id = auth.uid()
    and public.are_friends(tagger_id, tagged_user_id)
    and exists (
      select 1 from public.memories m
      where m.id = memory_id and m.user_id = auth.uid()
    )
  );

create policy "Participants can read their tags"
  on public.memory_tags for select
  using (tagger_id = auth.uid() or tagged_user_id = auth.uid());

create policy "Tagged users can respond to their tags"
  on public.memory_tags for update
  using (tagged_user_id = auth.uid())
  with check (tagged_user_id = auth.uid());

create policy "Taggers can untag"
  on public.memory_tags for delete
  using (tagger_id = auth.uid());

-- 3. Helper: may `viewer` see this memory through a tag or a lineage link?
--    security definer (like are_friends) so it can read memories/memory_tags
--    without recursing into their own policies. Dismissed tags grant nothing.
create or replace function public.is_memory_linked(mem_id uuid, viewer uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select
    exists (
      select 1 from public.memory_tags t
      where t.memory_id = mem_id
        and t.tagged_user_id = viewer
        and t.status in ('pending', 'saved')
    )
    or exists ( -- viewer owns a copy of this memory
      select 1 from public.memories mine
      where mine.user_id = viewer and mine.origin_memory_id = mem_id
    )
    or exists ( -- this memory is a copy of one of viewer's
      select 1 from public.memories copy
      join public.memories mine on mine.id = copy.origin_memory_id
      where copy.id = mem_id and mine.user_id = viewer
    );
$$;

-- 4. Tagged/linked users can read the memory and its photo rows
--    (policies OR with the existing owner + friends-shared policies).
create policy "Tagged and linked users can read memories"
  on public.memories for select
  using (public.is_memory_linked(id, auth.uid()));

create policy "Tagged and linked users can read memory photos"
  on public.memory_photos for select
  using (public.is_memory_linked(memory_id, auth.uid()));

-- 5. Storage: photo objects live at {ownerId}/{memoryId}/{file}. Grant read
--    on linked memories' objects so previews sign and storage.copy() can
--    read the source (the copy destination is covered by the existing
--    own-folder insert policy). The regex guards the uuid cast against
--    malformed paths.
create policy "Linked users can read linked memory photos"
  on storage.objects for select
  using (
    bucket_id = 'memory-photos'
    and array_length(storage.foldername(name), 1) >= 2
    and (storage.foldername(name))[2] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and public.is_memory_linked(((storage.foldername(name))[2])::uuid, auth.uid())
  );
