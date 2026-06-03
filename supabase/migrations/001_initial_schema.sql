-- ============================================
-- MEMORA — Full Database Migration
-- Run this in Supabase SQL Editor
-- ============================================

-- Enable PostGIS for geo queries
create extension if not exists "postgis";

-- ============================================
-- USERS
-- ============================================
create table public.users (
  id uuid references auth.users(id) on delete cascade primary key,
  email text not null unique,
  username text unique,
  display_name text,
  avatar_url text,
  profile_public boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.users enable row level security;

create policy "Users can read their own profile"
  on public.users for select
  using (auth.uid() = id);

create policy "Users can update their own profile"
  on public.users for update
  using (auth.uid() = id);

create policy "Public profiles are readable by all"
  on public.users for select
  using (profile_public = true);

-- Auto-create user row on sign up
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.users (id, email)
  values (new.id, new.email);
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================
-- VENUES
-- ============================================
create table public.venues (
  id uuid primary key default gen_random_uuid(),
  google_place_id text unique,
  name text not null,
  address text,
  lat double precision not null,
  lng double precision not null,
  category text,
  created_at timestamptz not null default now()
);

alter table public.venues enable row level security;

create policy "Venues are publicly readable"
  on public.venues for select
  using (true);

create policy "Authenticated users can insert venues"
  on public.venues for insert
  with check (auth.uid() is not null);

-- ============================================
-- MEMORIES
-- ============================================
create table public.memories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade not null,
  venue_id uuid references public.venues(id) on delete set null,
  dish_name text,
  notes text,
  rating smallint check (rating >= 1 and rating <= 5),
  is_public boolean not null default false,
  public_lat double precision,
  public_lng double precision,
  visited_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.memories enable row level security;

create policy "Users can do anything with their own memories"
  on public.memories for all
  using (auth.uid() = user_id);

create policy "Public memories are readable by all"
  on public.memories for select
  using (is_public = true);

-- ============================================
-- MEMORY PHOTOS
-- ============================================
create table public.memory_photos (
  id uuid primary key default gen_random_uuid(),
  memory_id uuid references public.memories(id) on delete cascade not null,
  storage_path text not null,
  lat double precision,
  lng double precision,
  taken_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.memory_photos enable row level security;

create policy "Users can access photos from their own memories"
  on public.memory_photos for all
  using (
    exists (
      select 1 from public.memories
      where memories.id = memory_photos.memory_id
      and memories.user_id = auth.uid()
    )
  );

create policy "Public memory photos are readable"
  on public.memory_photos for select
  using (
    exists (
      select 1 from public.memories
      where memories.id = memory_photos.memory_id
      and memories.is_public = true
    )
  );

-- ============================================
-- WISHLISTS
-- ============================================
create table public.wishlists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade not null,
  venue_id uuid references public.venues(id) on delete cascade not null,
  notes text,
  priority smallint not null default 0,
  added_at timestamptz not null default now(),
  unique(user_id, venue_id)
);

alter table public.wishlists enable row level security;

create policy "Users can manage their own wishlist"
  on public.wishlists for all
  using (auth.uid() = user_id);

-- ============================================
-- FOLLOWS (phase 2)
-- ============================================
create table public.follows (
  id uuid primary key default gen_random_uuid(),
  follower_id uuid references public.users(id) on delete cascade not null,
  following_id uuid references public.users(id) on delete cascade not null,
  created_at timestamptz not null default now(),
  unique(follower_id, following_id),
  check (follower_id != following_id)
);

alter table public.follows enable row level security;

create policy "Users can manage their own follows"
  on public.follows for all
  using (auth.uid() = follower_id);

create policy "Follows are publicly readable"
  on public.follows for select
  using (true);

-- ============================================
-- STORAGE BUCKETS
-- ============================================
insert into storage.buckets (id, name, public)
values ('memory-photos', 'memory-photos', false);

create policy "Users can upload their own photos"
  on storage.objects for insert
  with check (
    bucket_id = 'memory-photos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Users can read their own photos"
  on storage.objects for select
  using (
    bucket_id = 'memory-photos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Users can delete their own photos"
  on storage.objects for delete
  using (
    bucket_id = 'memory-photos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- ============================================
-- INDEXES
-- ============================================
create index memories_user_id_idx on public.memories(user_id);
create index memories_venue_id_idx on public.memories(venue_id);
create index memories_is_public_idx on public.memories(is_public);
create index memories_visited_at_idx on public.memories(visited_at desc);
create index memory_photos_memory_id_idx on public.memory_photos(memory_id);
create index wishlists_user_id_idx on public.wishlists(user_id);
create index follows_follower_id_idx on public.follows(follower_id);
create index follows_following_id_idx on public.follows(following_id);
