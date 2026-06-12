-- ============================================
-- MEMORA — Backfill fuzzed public coordinates
-- Run this in Supabase SQL Editor
-- ============================================

-- Memories created before the app populated public_lat/public_lng have
-- nulls there. Backfill from the venue's coords, rounded to 2 decimal
-- places (~1km) — the same fuzzing the app applies (lib/exif.ts).
update public.memories m
set
  public_lat = round(v.lat::numeric, 2),
  public_lng = round(v.lng::numeric, 2)
from public.venues v
where m.venue_id = v.id
  and m.public_lat is null;
