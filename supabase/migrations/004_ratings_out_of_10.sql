-- ============================================
-- MEMORA — Ratings out of 10 with decimals
-- Run this in Supabase SQL Editor
-- ============================================

-- The original schema stored rating as smallint 1-5, and the app halved
-- and rounded the 10-scale input before saving. Ratings are meant to be:
-- three categories rated 1-10, overall = average to one decimal (e.g. 7.3).

-- 1) Widen the overall rating to one-decimal numeric on the 10-scale
alter table public.memories
  drop constraint if exists memories_rating_check;

alter table public.memories
  alter column rating type numeric(3,1) using rating::numeric(3,1);

alter table public.memories
  add constraint memories_rating_check check (rating >= 0 and rating <= 10);

-- 2) Persist the three category ratings so editing a memory can show and
--    update them (previously only the computed overall was stored, which is
--    why edits scrambled ratings)
alter table public.memories
  add column if not exists rating_food smallint check (rating_food >= 1 and rating_food <= 10),
  add column if not exists rating_service smallint check (rating_service >= 1 and rating_service <= 10),
  add column if not exists rating_ambiance smallint check (rating_ambiance >= 1 and rating_ambiance <= 10);

-- NOTE on existing data: category ratings were never stored, so original
-- inputs can't be recovered. Overalls saved by the buggy app were halved
-- and rounded (a true 7.3 was stored as 4). If a memory's rating looks
-- wrong and is 5 or below, it was probably saved by the buggy path —
-- re-rate it in the app, or double it manually:
--   update public.memories set rating = least(rating * 2, 10)
--   where rating <= 5 and rating > 0;  -- review before running!
