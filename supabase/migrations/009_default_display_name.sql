-- ============================================
-- MEMORA — Default display names at signup
-- Run this in Supabase SQL Editor
-- ============================================
-- New accounts had display_name NULL until the user visited Settings, so
-- they appeared as raw Mimora IDs in search results, friend lists and tag
-- notifications. Default to the email prefix (visible only to connected
-- friends under RLS; users can change it any time in Settings).

create or replace function public.handle_new_user()
returns trigger as $$
declare
  new_memora_id text;
  attempts int := 0;
begin
  loop
    new_memora_id := public.generate_memora_id();
    exit when not exists (select 1 from public.users where memora_id = new_memora_id);
    attempts := attempts + 1;
    exit when attempts > 10;
  end loop;

  insert into public.users (id, email, memora_id, display_name)
  values (new.id, new.email, new_memora_id, split_part(new.email, '@', 1));
  return new;
end;
$$ language plpgsql security definer set search_path = public;

-- Backfill accounts created before this default existed
update public.users
set display_name = split_part(email, '@', 1)
where display_name is null or display_name = '';
