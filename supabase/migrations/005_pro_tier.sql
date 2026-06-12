-- ============================================
-- MEMORA — Pro tier flag
-- Run this in Supabase SQL Editor
-- ============================================

-- Pro entitlement. Set by the purchase flow later (RevenueCat webhook);
-- until then it can be toggled manually for testing:
--   update public.users set is_pro = true where email = 'you@example.com';
alter table public.users
  add column if not exists is_pro boolean not null default false;
