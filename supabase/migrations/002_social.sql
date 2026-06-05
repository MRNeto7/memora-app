-- ============================================
-- MEMORA — Social Features Migration
-- Run this in Supabase SQL Editor
-- ============================================

-- Add Memora ID and social settings to users
alter table public.users
  add column if not exists memora_id text unique,
  add column if not exists wishlist_public boolean not null default false,
  add column if not exists bio text;

-- Auto-generate a unique Memora ID on signup
-- Format: 2 letters + 4 digits e.g. MA4829
create or replace function public.generate_memora_id()
returns text as $$
declare
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result text := '';
  i int;
begin
  -- 2 letters
  for i in 1..2 loop
    result := result || substr(chars, floor(random() * 24 + 1)::int, 1);
  end loop;
  -- 4 digits
  for i in 1..4 loop
    result := result || substr('0123456789', floor(random() * 10 + 1)::int, 1);
  end loop;
  return result;
end;
$$ language plpgsql;

-- Update existing users without a memora_id
update public.users
set memora_id = public.generate_memora_id()
where memora_id is null;

-- Update the handle_new_user trigger to assign memora_id on signup
create or replace function public.handle_new_user()
returns trigger as $$
declare
  new_memora_id text;
  attempts int := 0;
begin
  -- Generate unique memora_id with collision avoidance
  loop
    new_memora_id := public.generate_memora_id();
    exit when not exists (select 1 from public.users where memora_id = new_memora_id);
    attempts := attempts + 1;
    exit when attempts > 10;
  end loop;

  insert into public.users (id, email, memora_id)
  values (new.id, new.email, new_memora_id);
  return new;
end;
$$ language plpgsql security definer;

-- Friend requests table
create table if not exists public.friend_requests (
  id uuid primary key default gen_random_uuid(),
  from_user_id uuid references public.users(id) on delete cascade not null,
  to_user_id uuid references public.users(id) on delete cascade not null,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(from_user_id, to_user_id),
  check (from_user_id != to_user_id)
);

alter table public.friend_requests enable row level security;

create policy "Users can see their own friend requests"
  on public.friend_requests for select
  using (auth.uid() = from_user_id or auth.uid() = to_user_id);

create policy "Users can send friend requests"
  on public.friend_requests for insert
  with check (auth.uid() = from_user_id);

create policy "Users can update requests sent to them"
  on public.friend_requests for update
  using (auth.uid() = to_user_id);

-- Friends view (accepted requests in both directions)
create or replace view public.friends as
select
  case when from_user_id = auth.uid() then to_user_id else from_user_id end as friend_id,
  created_at
from public.friend_requests
where status = 'accepted'
  and (from_user_id = auth.uid() or to_user_id = auth.uid());

-- Public users view (safe subset for searching by Memora ID)
create or replace view public.public_profiles as
select
  id,
  memora_id,
  display_name,
  username,
  avatar_url,
  profile_public,
  wishlist_public,
  bio
from public.users;

-- RLS on memories: public memories readable by friends and everyone if profile_public
-- Already handled by is_public flag on memories table

-- Index for memora_id lookups
create index if not exists users_memora_id_idx on public.users(memora_id);
create index if not exists friend_requests_from_idx on public.friend_requests(from_user_id);
create index if not exists friend_requests_to_idx on public.friend_requests(to_user_id);
create index if not exists friend_requests_status_idx on public.friend_requests(status);
