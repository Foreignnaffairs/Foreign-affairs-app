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
- Backend: seeded 4 flights (Tokyo/Lagos/Berlin/Rio) each with 3 seat classes; endpoints:
  GET /api/flights, GET /api/flights/{id}, POST /api/bookings (decrements availability,
  generates reference + seat/table label + total), GET /api/bookings?phone=, GET /api/bookings/{id}.
- Frontend: Departures board, Flight detail (parallax hero, class selector, perks, qty stepper,
  sticky Book CTA), Checkout (keyboard-aware form, mock payment), Confirmation (physical
  off-white boarding pass with barcode + share), My Trips (boarding-pass wallet + phone lookup).
- Full-stack tested: backend 13/13 pytest passed; frontend 7/7 flows passed. Fonts fixed.

## Backlog (prioritized)
- P0: (none — MVP complete)
- P1: Admin panel to create/edit flights; real payment (Stripe/PayPal); booking cancellation.
- P2: Flight search/filter by destination or genre; capacity/sold-out badges on cards;
  seat map for Economy; add-to-calendar; promo codes.

## Next Tasks
- Await user feedback; likely next: admin panel for managing flights, then real payments.
