# Foreign Affairs — Product Requirements (living doc)

## Original Problem Statement
Build a sleek, simple mobile app that embodies booking a flight with an airline, for
"Foreign Affairs" — a Philippines event-planning company bringing new culture & music
via DJ events. Each event is a "flight" to a "destination"; DJs are the "pilots".
Users book "seats" individually, or a table with a bottle ("First Class seats") that
must be paid for.

## User Choices
- Payment: MOCK/simulated (real gateway later)
- Auth: none — book with name + phone
- Events: pre-seeded by backend now; admin panel later
- Seat classes: Economy (individual seats) + Business Class (cocktail table + bottle) + First Class (premium booth + bottle)
- Vibe: dark, premium nightlife, boarding-pass aesthetic, sleek

## Architecture
- Frontend: Expo Router (file-based), React Native. Fonts: Space Grotesk (display), JetBrains Mono (aviation metadata). Tabs: Departures + My Trips.
- Backend: FastAPI + MongoDB (motor). UUID string ids. Routes under /api.
- Local storage: `@/src/utils/storage` persists passenger phone/name for My Trips auto-load.

## User Personas
- Nightlife-goer booking a solo ticket (Economy).
- Group host reserving a table + bottle (Business / First Class).

## Core Requirements (static)
- Browse upcoming "flights" (DJ events) with destination, pilot, gate, time, price.
- View flight detail + choose seat class + quantity.
- Checkout with name + phone, mock payment.
- Boarding-pass confirmation + persistent My Trips wallet, retrievable by phone.

## Implemented (2026-07-05)
- Backend: seeded 4 flights (Tokyo/Lagos/Berlin/Rio). Per-flight seat classes + per-seat inventory
  (16 seats: 12 Business tables "1".."12" + 4 First Class booths "FC1".."FC4", each with x/y floor-plan
  coords + status). Endpoints: GET /api/flights, GET /api/flights/{id},
  POST /api/bookings (seat-aware: Economy=free walk-in by quantity; Business/First=specific seat_labels,
  marks seats booked, 409 on already-booked), GET /api/bookings?phone=, GET /api/bookings/{id}.
- Pricing: Economy FREE (walk-in, no table), Business ₱2,500/table (cocktail table 3–6 + bottle),
  First ₱15,000/booth (private booth up to 10 + 2 bottles).
- Frontend: Departures board, Flight detail (FREE ribbon on Economy under "GENERAL ADMISSION";
  "TABLES & BOTTLES" section for paid tiers with UPGRADE pill), interactive Stardust floor-plan
  seat picker (/seatmap — DJ booth/bar/entrance/WC context, tap to select, booked=greyed, multi-select),
  Checkout (keyboard-aware, shows chosen tables, mock payment), Confirmation (physical boarding pass),
  My Trips wallet + phone lookup. Staggered entrance + press-scale animations throughout.
- Fonts: Space Grotesk (display) + JetBrains Mono (metadata), fixed valid TTFs.
- Tested: backend 18/18 pytest passed; frontend full seat-selection + booking flow passed.

## Backlog (prioritized)
- P0: (none — MVP complete)
- P1: Admin panel to create/edit flights; real payment (Stripe/PayPal); booking cancellation.
- P2: Flight search/filter by destination or genre; capacity/sold-out badges on cards;
  seat map for Economy; add-to-calendar; promo codes.

## Next Tasks
- Await user feedback. Optional: raise on missing ADMIN_PIN in production; real payments.

## Iteration 3 (2026-07-05) — Admin panel + past flights + live availability
- Admin PIN gate (X-Admin-PIN header, secrets.compare_digest; PIN in backend .env = 602214).
  Endpoints: POST /api/admin/verify-pin, GET/POST /api/admin/flights, PUT/DELETE /api/admin/flights/{id},
  POST /api/admin/flights/{id}/reset-seats. Seats auto-generated from business_tables(≤12)+first_booths(≤4),
  preserving booked seats on edit.
- Frontend admin: hidden entry via long-press on "FOREIGN AFFAIRS" logo → /admin-login (PIN) → "Crew" tab
  appears (adminStore + useSyncExternalStore). Dashboard lists flights (LANDED/UPCOMING, table/booth counts),
  Add/Edit form (/admin-flight) with preset gallery + device photo upload (expo-image-picker, permission-handled),
  Reset seats, Delete, Lock.
- Past flights are shown (not hidden), labeled "LANDED"; flight detail hides booking and shows a
  "View photos from the night" button linking to the admin-set Google Drive gallery_url. Booking a past
  flight is blocked (400). Seeded past flight: Seoul FA 019.
- Live availability heat indicator: seat map banner ("N of M tables left · selling fast 🔥") + gold glow on
  remaining seats when low; flight-detail class rows show dynamic "selling fast" urgency.
- Tested: backend 20/20 pytest passed; full admin + guest flows passed.
