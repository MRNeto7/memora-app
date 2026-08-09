-- ============================================
-- MEMORA — Close the profile_public exposure
-- Run this in Supabase SQL Editor
-- ============================================
-- The 001-era "Public profiles are readable by all" policy made a user's
-- ENTIRE row (including email) readable by any signed-in user whenever
-- profile_public was true. Nothing legitimate depends on it any more:
-- ID lookup goes through find_user_by_memora_id (008) and friends read
-- each other via has_friend_link (008). The misleading settings toggle
-- that flipped the flag has been removed from the app.

drop policy if exists "Public profiles are readable by all" on public.users;

-- Neutralize any rows that had the flag on
update public.users set profile_public = false where profile_public = true;
