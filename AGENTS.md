<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Mimora — food memory mapping app

Users pin restaurant memories to a map, rate them out of 10, keep wishlists, and
connect with friends via Mimora IDs. Solo founder project, on TestFlight,
targeting App Store launch. The app must feel Apple-premium: glass materials,
spring motion, teal/gold palette.

## Stack & deploy model

- Next.js 16 (Turbopack) + TypeScript + Tailwind, Supabase (Postgres/Storage/Auth),
  Google Maps via @vis.gl/react-google-maps, Vercel hosting, Capacitor iOS wrapper.
- **The iOS app loads the live Vercel URL.** Pushing to `main` auto-deploys and the
  app picks it up on next hard-close/reopen — no Xcode rebuild for web changes.
- Xcode rebuild (`npx cap sync ios` → Product → Archive → Upload) is ONLY needed for:
  app icon, splash, capacitor.config.ts, Info.plist, or native plugin changes.
- The `ios/` folder IS committed (required for Xcode Cloud). After regenerating it,
  signing team + icon/splash in Assets.xcassets must be re-set by hand in Xcode.
- Env vars live in `.env.local` (gitignored) — Supabase URL/anon key, Maps key/Map ID.
  Vercel has its own copies.
- `npm run build` must pass before every push — Vercel build failures block the
  iPhone from updating and have bitten us repeatedly.

## Hard-won iOS/Capacitor rules (do not relearn these)

1. Safe areas: use `env(safe-area-inset-*)` DIRECTLY in styles/classes. Putting
   env() inside CSS custom properties silently fails in the Capacitor WebView.
   `.page-header` class handles notch padding for teal page headers.
2. `contentInset: 'never'` + body position:fixed + a dedicated scroll container.
   Never rely on body scroll.
3. NEVER call `.click()` on a file input from JS — it crashes the WebView.
   Use `<label htmlFor>`, direct-tap inputs, or @capacitor/camera.
4. After the iOS photo picker's tick is tapped there's a silent multi-second gap
   while iOS copies files (worse with iCloud). Bulk upload arms a "Preparing your
   photos…" overlay on window focus, cleared by the input's change/cancel events.
5. `alert()` shows a native dialog titled with the Vercel URL — always use the
   glass toast system instead: `import { toast } from '@/lib/toast'`.

## Recurring self-inflicted bug

Duplicate `style` or `className` JSX attributes from bad merges/patches have broken
the Vercel build multiple times. Check for them before committing.

## Data model notes

- `memories.rating` is `numeric(4,1)`, 0–10, one decimal (display "7.6 ⭐").
  Per-category columns: rating_food / rating_service / rating_ambiance (1–10 ints).
- Categories: `memories.venue_type` (fast_food|cafe|restaurant|high_end|street_food|pub)
  and `memories.meal_type` (breakfast|lunch|dinner). Auto-suggested from Google place
  types and photo EXIF time — see `src/lib/categories.ts`.
- Venues dedupe on `google_place_id`. Deleting a memory must remove its Storage
  files first (see DeleteMemoryButton) or files orphan and cost money.
- Photos: compress with `compressImage()` before every upload; previews via
  `URL.createObjectURL` must be revoked (leaks crash older iPhones).
- Signed URLs cached in sessionStorage via `src/lib/storage.ts`.

## Cost guardrails

- The Google Map mounts ONCE in `PersistentMapShell` at layout level; tab switches
  only toggle visibility so they don't trigger billed map loads. Don't remount it.
- Maps JS API ~$7/1k loads is the biggest scaling cost. Places autocomplete uses
  the widget (session-priced). Legacy PlacesService deprecation warnings in console
  are known and non-urgent.

## Monetisation (decided)

Pro-first, ads deferred. £3.99/mo or £24.99/yr via Apple IAP (RevenueCat, Week 3).
Free limits in `src/lib/pro.ts`: 50 memories, 3 photos/memory, 10-photo bulk
imports. Never paywall the core loop (save memory / map / social). Privacy policy
currently promises no ads — don't contradict it.

## Design system

Palette: deep teal #0D4F57, champagne gold #C9A86A, stone #EAE5DD, slate #7D878D.
Verdict: keep palette, add depth — tonal ramps, 3-level elevation scale, ONE glass
material recipe everywhere, spring motion language. This "Week 1 polish pass" is
the current workstream.

## Roadmap (4-week launch plan, Week 1 in progress)

- W1: design tokens, glass everywhere, haptics, skeletons, optimistic saves,
  pin-drop save animation, seductive empty states.
- W2: thumbnails generated on upload + served in lists (biggest perf/cost win),
  prefetching.
- W3: RevenueCat + IAP wired to users.is_pro, paywalls, shareable map card, push.
- W4: onboarding, App Store assets, TestFlight beta, Sentry, submission.
