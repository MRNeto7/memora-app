-- ============================================
-- MEMORA — Take the display name from the signup form
-- Run this in Supabase SQL Editor
-- ============================================
-- The signup form now sends a chosen name via auth metadata; the email
-- prefix (009) remains the fallback when it's blank.

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
  values (
    new.id,
    new.email,
    new_memora_id,
    coalesce(
      nullif(trim(new.raw_user_meta_data->>'display_name'), ''),
      split_part(new.email, '@', 1)
    )
  );
  return new;
end;
$$ language plpgsql security definer set search_path = public;
