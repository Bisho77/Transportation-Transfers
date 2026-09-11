# Transportation & Transfers — Website Prototype

Working prototype of a professional taxi / airport-transfer booking platform for
Brisbane & the Gold Coast. Includes a tiny built-in backend (`server.py`, Python
standard library only) with a **SQLite database** (`data/transfers.db`) that stores
owner settings and customer bookings. The front-end falls back to browser storage
automatically when served as plain static files.

Run with: `python3 server.py`  →  http://localhost:8080

## What's included

| Requirement | Status in prototype |
|---|---|
| Professional redesign | ✅ Modern navy + gold design, fully mobile-friendly, existing branding/business info centralised in one config |
| Pick-up / drop-off system | ✅ Address search (local place database + live OpenStreetMap geocoding), swap button, automatic distance & travel-time calculation (OSRM road routing with fallback) |
| Taxi-meter fare calculator | ✅ Fare shown **before** booking. Metered formula: flagfall + $/km + $/min, with minimum fare. Fixed fares override the meter on airport routes. Late-night surcharge window. GST component itemised on every quote |
| Owner-editable rates | ✅ Owner admin panel at `/admin.html` — edit all rates, extras, fixed fares, contact details, deposit %, export/import settings |
| Two vehicle classes | ✅ Standard (Haval SUV) and Premium (Mercedes Vito 8-seater), each with its own rates, capacity checks and price |
| Extras | ✅ Tolls, child seat, infant capsule, booster, Meet & Greet, extra stops — all owner-editable, quantity steppers |
| Vehicle selection | ✅ Customer picks vehicle during booking; vehicles that can't fit passengers/luggage are flagged automatically |
| Online booking form | ✅ Pick-up/drop-off, date & time, passengers, luggage, flight number, child seats, special requests |
| WhatsApp integration | ✅ One-tap "Send booking details on WhatsApp" with the full booking summary pre-filled; floating WhatsApp button site-wide |
| Payment options | ✅ Deposit option surfaced at confirmation (demo button). Production build plugs in Stripe/PayPal/PayID. GST included everywhere |
| Notifications | ✅ Booking reference + summary instantly. In production: automatic email confirmations, owner notifications, SMS/WhatsApp reminders |
| SEO / local search | ✅ Meta tags, Open Graph, structured data (TaxiService + FAQ schema), semantic headings, Brisbane/Gold Coast keyword coverage, robots.txt + sitemap.xml |

## File map

```
server.py           web server + JSON API (/api/config, /api/bookings) on SQLite
data/transfers.db      SQLite database (config + bookings tables)
index.html          public website (hero + booking widget + all sections)
admin.html          owner admin panel (rates, extras, fixed fares, bookings)
assets/core.js      shared engine: config, locations, fare math, storage, db sync
assets/app.js       public site logic (autocomplete, routing, booking flow)
assets/admin.js     admin panel logic
assets/style.css    design system
assets/img/         generated imagery (replace with real photos)
robots.txt / sitemap.xml
```

## Demo limitations (by design)

- **Database**: SQLite via `server.py` stores settings + bookings and works well for a
  single-server site. At higher scale / multi-server hosting, migrate the same API to
  PostgreSQL or a managed DB (Supabase/Firebase) without changing the front-end.
- **Map & geocoding** use free OpenStreetMap services, biased to South East QLD.
  Production should use Google Maps Platform (Places Autocomplete + Directions +
  Distance Matrix) for exact addresses and toll-aware routing.
- **Online payments** are stubbed — production uses Stripe Checkout (or PayPal/PayID
  links) for deposits; balance to the driver.
- **Email/SMS/WhatsApp notifications** are simulated — production options:
  transactional email (e.g. SendGrid/Postmark), SMS (Twilio), and WhatsApp Cloud API
  or a WhatsApp link-based flow (already working in this prototype).

## Going live — recommended path

1. **Backend**: small Node.js/Next.js service for bookings, config storage, and webhooks.
2. **Google Maps API keys** for address autocomplete + toll-aware routes.
3. **Payments**: Stripe account → deposit links; keep cash/PayID to driver.
4. **Notifications**: email + WhatsApp Cloud API templates for confirmations & reminders.
5. **Hosting**: any static host + the small API (Vercel/Netlify + serverless, or a VPS).
6. **Local SEO**: claim/optimise Google Business Profile for "Transportation & Transfers",
   add real photos, collect reviews, submit sitemap in Google Search Console.
7. Replace placeholder contact details, ABN and rates via the admin panel.
