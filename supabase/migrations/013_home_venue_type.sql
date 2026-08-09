-- ============================================
-- MEMORA — 'home' venue type (home-cooked memories)
-- Run this in Supabase SQL Editor
-- ============================================
-- venue_type was added outside the migrations folder, so the constraint
-- (if any) is located dynamically and rebuilt to include 'home'.

do $$
declare c text;
begin
  select conname into c
  from pg_constraint
  where conrelid = 'public.memories'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) ilike '%venue_type%';
  if c is not null then
    execute format('alter table public.memories drop constraint %I', c);
  end if;
end $$;

alter table public.memories
  add constraint memories_venue_type_check
  check (venue_type is null or venue_type in
    ('fast_food', 'cafe', 'restaurant', 'high_end', 'street_food', 'pub', 'home'));
