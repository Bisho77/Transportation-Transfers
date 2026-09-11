/* ============================================================
   Transportation & Transfers — core engine
   Shared by the public site (app.js) and the admin panel (admin.js)
   ============================================================ */

const STORAGE_CONFIG_KEY = "brizzy_config_v1";
const STORAGE_BOOKINGS_KEY = "brizzy_bookings_v1";

/* ---------- Known locations (local fallback for address search) ---------- */
const LOCATIONS = [
  // Brisbane Airport
  { id: "bne-dom", name: "Brisbane Airport — Domestic", area: "Brisbane", lat: -27.3986, lng: 153.1194, airport: "BNE" },
  { id: "bne-int", name: "Brisbane Airport — International", area: "Brisbane", lat: -27.3857, lng: 153.1230, airport: "BNE" },
  { id: "dfo-brisbane", name: "DFO Brisbane, Airport West", area: "Brisbane", lat: -27.3866, lng: 153.0778 },
  // Brisbane city
  { id: "brisbane-cbd", name: "Brisbane CBD (Queen St Mall)", area: "Brisbane", lat: -27.4689, lng: 153.0235 },
  { id: "south-bank", name: "South Bank Parklands", area: "Brisbane", lat: -27.4725, lng: 153.0281 },
  { id: "south-brisbane", name: "South Brisbane", area: "Brisbane", lat: -27.4776, lng: 153.0174 },
  { id: "fortitude-valley", name: "Fortitude Valley", area: "Brisbane", lat: -27.4566, lng: 153.0346 },
  { id: "howard-smith", name: "Howard Smith Wharves", area: "Brisbane", lat: -27.4632, lng: 153.0334 },
  { id: "kangaroo-point", name: "Kangaroo Point", area: "Brisbane", lat: -27.4735, lng: 153.0358 },
  { id: "new-farm", name: "New Farm", area: "Brisbane", lat: -27.4639, lng: 153.0437 },
  { id: "portside", name: "Portside Hamilton", area: "Brisbane", lat: -27.4478, lng: 153.0686 },
  { id: "suncorp", name: "Suncorp Stadium, Milton", area: "Brisbane", lat: -27.4642, lng: 153.0103 },
  { id: "gabba", name: "The Gabba, Woolloongabba", area: "Brisbane", lat: -27.4858, lng: 153.0377 },
  { id: "rbwh", name: "Royal Brisbane & Women's Hospital", area: "Brisbane", lat: -27.4476, lng: 153.0249 },
  { id: "qeii", name: "QEII Hospital, Upper Mt Gravatt", area: "Brisbane", lat: -27.4980, lng: 153.0530 },
  { id: "uq", name: "University of Queensland, St Lucia", area: "Brisbane", lat: -27.4974, lng: 153.0125 },
  // Brisbane suburbs
  { id: "toowong", name: "Toowong", area: "Brisbane", lat: -27.4849, lng: 152.9934 },
  { id: "indooroopilly", name: "Indooroopilly", area: "Brisbane", lat: -27.4989, lng: 152.9842 },
  { id: "chermside", name: "Chermside", area: "Brisbane", lat: -27.3868, lng: 153.0316 },
  { id: "carindale", name: "Carindale", area: "Brisbane", lat: -27.4989, lng: 153.1009 },
  { id: "mt-gravatt", name: "Mt Gravatt", area: "Brisbane", lat: -27.5367, lng: 153.0809 },
  { id: "sunnybank", name: "Sunnybank", area: "Brisbane", lat: -27.5832, lng: 153.0583 },
  // Around Brisbane
  { id: "ipswich", name: "Ipswich", area: "Moreton Bay & surrounds", lat: -27.6145, lng: 152.7594 },
  { id: "logan-central", name: "Logan Central", area: "Moreton Bay & surrounds", lat: -27.6370, lng: 153.1170 },
  { id: "redcliffe", name: "Redcliffe", area: "Moreton Bay & surrounds", lat: -27.2315, lng: 153.0900 },
  { id: "caboolture", name: "Caboolture", area: "Moreton Bay & surrounds", lat: -27.0830, lng: 152.9510 },
  { id: "maroochydore", name: "Maroochydore (Sunshine Coast)", area: "Sunshine Coast", lat: -26.6500, lng: 153.0930 },
  { id: "noosa", name: "Noosa Heads (Sunshine Coast)", area: "Sunshine Coast", lat: -26.4162, lng: 153.0886 },
  // Gold Coast Airport
  { id: "ool", name: "Gold Coast Airport (Coolangatta)", area: "Gold Coast", lat: -28.1651, lng: 153.5054, airport: "OOL" },
  // Gold Coast
  { id: "surfers-paradise", name: "Surfers Paradise", area: "Gold Coast", lat: -28.0020, lng: 153.4295 },
  { id: "broadbeach", name: "Broadbeach", area: "Gold Coast", lat: -28.0319, lng: 153.4298 },
  { id: "mermaid-beach", name: "Mermaid Beach", area: "Gold Coast", lat: -28.0434, lng: 153.4345 },
  { id: "nobbys-beach", name: "Nobby Beach", area: "Gold Coast", lat: -28.0270, lng: 153.4350 },
  { id: "burleigh-heads", name: "Burleigh Heads", area: "Gold Coast", lat: -28.0880, lng: 153.4510 },
  { id: "palm-beach", name: "Palm Beach", area: "Gold Coast", lat: -28.1150, lng: 153.4600 },
  { id: "currumbin", name: "Currumbin", area: "Gold Coast", lat: -28.1370, lng: 153.4840 },
  { id: "tugun", name: "Tugun", area: "Gold Coast", lat: -28.1500, lng: 153.5030 },
  { id: "robina", name: "Robina", area: "Gold Coast", lat: -28.0730, lng: 153.3850 },
  { id: "southport", name: "Southport", area: "Gold Coast", lat: -27.9670, lng: 153.4140 },
  { id: "main-beach", name: "Main Beach", area: "Gold Coast", lat: -27.9430, lng: 153.4280 },
  { id: "labrador", name: "Labrador", area: "Gold Coast", lat: -27.9350, lng: 153.4010 },
  { id: "helensvale", name: "Helensvale", area: "Gold Coast", lat: -27.9270, lng: 153.3330 },
  // Attractions / day trips
  { id: "dreamworld", name: "Dreamworld, Coomera", area: "Gold Coast", lat: -27.8630, lng: 153.3150 },
  { id: "movie-world", name: "Warner Bros. Movie World, Oxenford", area: "Gold Coast", lat: -27.9040, lng: 153.3110 },
  { id: "sea-world", name: "Sea World, Main Beach", area: "Gold Coast", lat: -27.9370, lng: 153.4250 },
  { id: "tamborine-mtn", name: "Tamborine Mountain", area: "Hinterland", lat: -27.8580, lng: 153.1890 },
  { id: "springbrook", name: "Springbrook Natural Bridge", area: "Hinterland", lat: -28.2060, lng: 153.2740 },
  { id: "byron-bay", name: "Byron Bay (NSW)", area: "Northern NSW", lat: -28.6440, lng: 153.6120 }
];

function locationById(id) {
  return LOCATIONS.find(l => l.id === id) || null;
}
function locationName(id) {
  const l = locationById(id);
  return l ? l.name : id;
}

/* ---------- Default configuration (owner-editable via /admin.html) ---------- */
const DEFAULT_CONFIG = {
  business: {
    name: "Transportation & Transfers",
    phoneDisplay: "example",
    phoneTel: "",                       // e.g. +614xxxxxxxx (left blank in template)
    whatsapp: "",                       // digits only, international format (left blank in template)
    email: "your email",
    abn: "example",
    depositPct: 20
  },
  vehicles: [
    { id: "standard", name: "Standard — Haval SUV", short: "Standard", desc: "Comfortable mid-size SUV, perfect for everyday rides and airport transfers.", img: "assets/img/standard-suv.jpg", pax: 4, bags: 3, base: 4.00, perKm: 2.40, perMin: 0.85, minFare: 35.00 },
    { id: "premium", name: "Premium — Mercedes Vito 8-Seater", short: "Premium", desc: "Luxury Mercedes Vito people mover for groups, families and VIP transfers.", img: "assets/img/premium-vito.jpg", pax: 8, bags: 8, base: 5.00, perKm: 3.10, perMin: 1.05, minFare: 55.00 }
  ],
  extras: [
    { id: "tolls", label: "Toll roads (estimated)", unit: "per trip", price: 6.50 },
    { id: "child-seat", label: "Child seat (4–7 yrs)", unit: "per seat", price: 10.00 },
    { id: "infant-seat", label: "Infant capsule (0–3 yrs)", unit: "per seat", price: 10.00 },
    { id: "booster", label: "Booster seat", unit: "per seat", price: 10.00 },
    { id: "meet-greet", label: "Meet & Greet at arrivals", unit: "per trip", price: 15.00 },
    { id: "extra-stop", label: "Extra stop en route", unit: "per stop", price: 12.00 }
  ],
  night: { start: "22:00", end: "05:00", pct: 15, label: "Late-night surcharge" },
  fixedFares: [
    { from: "bne-dom", to: "brisbane-cbd", standard: 65, premium: 85 },
    { from: "bne-int", to: "brisbane-cbd", standard: 65, premium: 85 },
    { from: "bne-dom", to: "south-bank", standard: 68, premium: 88 },
    { from: "bne-int", to: "south-bank", standard: 68, premium: 88 },
    { from: "bne-dom", to: "fortitude-valley", standard: 60, premium: 78 },
    { from: "ool", to: "surfers-paradise", standard: 55, premium: 72 },
    { from: "ool", to: "broadbeach", standard: 45, premium: 58 },
    { from: "ool", to: "burleigh-heads", standard: 39, premium: 52 },
    { from: "ool", to: "brisbane-cbd", standard: 219, premium: 275 },
    { from: "ool", to: "byron-bay", standard: 99, premium: 129 },
    { from: "bne-dom", to: "surfers-paradise", standard: 199, premium: 255 },
    { from: "bne-int", to: "surfers-paradise", standard: 199, premium: 255 }
  ]
};

/* ---------- Config storage ---------- */
function loadConfig() {
  try {
    const raw = localStorage.getItem(STORAGE_CONFIG_KEY);
    if (!raw) return JSON.parse(JSON.stringify(DEFAULT_CONFIG));
    const parsed = JSON.parse(raw);
    // merge over defaults so new fields never break older saved configs
    return deepMerge(JSON.parse(JSON.stringify(DEFAULT_CONFIG)), parsed);
  } catch (e) {
    return JSON.parse(JSON.stringify(DEFAULT_CONFIG));
  }
}
function saveConfig(cfg) {
  localStorage.setItem(STORAGE_CONFIG_KEY, JSON.stringify(cfg));
}
function deepMerge(base, extra) {
  for (const k of Object.keys(extra)) {
    if (extra[k] && typeof extra[k] === "object" && !Array.isArray(extra[k]) && base[k] && typeof base[k] === "object" && !Array.isArray(base[k])) {
      deepMerge(base[k], extra[k]);
    } else {
      base[k] = extra[k];
    }
  }
  return base;
}

/* ---------- Bookings storage (demo: browser storage; production: server DB) ---------- */
function getBookings() {
  try { return JSON.parse(localStorage.getItem(STORAGE_BOOKINGS_KEY)) || []; }
  catch (e) { return []; }
}
function saveBooking(booking) {
  const all = getBookings();
  all.unshift(booking);
  localStorage.setItem(STORAGE_BOOKINGS_KEY, JSON.stringify(all));
}

/* ---------- Server database sync (SQLite via /api; falls back to browser storage) ---------- */
let API_OK = null; // null = not tested yet, true = connected, false = unavailable
async function _api(method, path, body) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 2500);
  const res = await fetch(path, {
    method,
    signal: ctrl.signal,
    headers: body !== undefined ? { "Content-Type": "application/json" } : { "Accept": "application/json" },
    body: body !== undefined ? JSON.stringify(body) : undefined
  });
  clearTimeout(t);
  if (!res.ok) throw new Error("api " + res.status);
  return res.json();
}
async function loadRemoteConfig() {
  try {
    const remote = await _api("GET", "/api/config");
    API_OK = true;
    if (remote && Object.keys(remote).length) {
      localStorage.setItem(STORAGE_CONFIG_KEY, JSON.stringify(remote));
      return deepMerge(JSON.parse(JSON.stringify(DEFAULT_CONFIG)), remote);
    }
  } catch (e) { API_OK = false; }
  return loadConfig();
}
async function pushConfig(cfg) {
  saveConfig(cfg); // always keep a browser cache
  try { await _api("PUT", "/api/config", cfg); API_OK = true; return true; }
  catch (e) { API_OK = false; return false; }
}
async function loadRemoteBookings() {
  try {
    const list = await _api("GET", "/api/bookings");
    API_OK = true;
    return Array.isArray(list) ? list : [];
  } catch (e) { API_OK = false; return getBookings(); }
}
async function pushBooking(b) {
  saveBooking(b); // always keep a browser copy as fallback
  try { await _api("POST", "/api/bookings", b); API_OK = true; return true; }
  catch (e) { API_OK = false; return false; }
}
async function deleteRemoteBooking(ref) {
  try { await _api("DELETE", "/api/bookings?ref=" + encodeURIComponent(ref)); API_OK = true; return true; }
  catch (e) { API_OK = false; return false; }
}

/* ---------- Money / time helpers ---------- */
function money(n) {
  return "$" + Number(n || 0).toFixed(2);
}
function round2(n) {
  return Math.round(n * 100) / 100;
}
function gstComponent(total) {
  // Australian prices are GST-inclusive: GST = total / 11
  return round2(total - total / 1.1);
}
function parseTimeToMinutes(hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}
function isNightTime(cfg, dateStr, timeStr) {
  if (!cfg.night || cfg.night.pct <= 0 || !timeStr) return false;
  const t = parseTimeToMinutes(timeStr);
  const s = parseTimeToMinutes(cfg.night.start);
  const e = parseTimeToMinutes(cfg.night.end);
  if (s === e) return false;
  if (s > e) return t >= s || t < e;   // crosses midnight
  return t >= s && t < e;
}

/* ---------- Fixed-fare matching ---------- */
function matchFixedFare(cfg, a, b) {
  if (!a || !b) return null;
  const aid = a.id || a.locId || null;
  const bid = b.id || b.locId || null;
  if (!aid || !bid) return null;
  const hit = cfg.fixedFares.find(f =>
    (f.from === aid && f.to === bid) || (f.from === bid && f.to === aid));
  if (!hit) return null;
  return { standard: hit.standard, premium: hit.premium, label: `${locationName(aid)} ↔ ${locationName(bid)}` };
}

/* ---------- Distance / duration fallbacks ---------- */
function haversineKm(a, b) {
  const R = 6371, toRad = d => d * Math.PI / 180;
  const dLat = toRad(b.lat - a.lat), dLng = toRad(b.lng - a.lng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}
function estimateRoad(km) {
  // straight-line → road distance factor + typical SE QLD traffic time
  const roadKm = km * 1.32;
  const minutes = (roadKm / 46) * 60 + 6;
  return { km: round2(roadKm), min: Math.round(minutes) };
}

/* ---------- Fare engine ---------- */
function calculateQuote(cfg, vehicleId, distKm, durMin, extraSel, fixedFare, nightApplied) {
  const v = cfg.vehicles.find(x => x.id === vehicleId);
  if (!v) return null;

  const lines = [];
  let fare;
  if (fixedFare && Number(fixedFare[vehicleId]) > 0) {
    fare = Number(fixedFare[vehicleId]);
    lines.push({ label: `Fixed fare (${fixedFare.label})`, amount: fare });
  } else {
    const meter = v.base + v.perKm * distKm + v.perMin * durMin;
    fare = Math.max(meter, v.minFare);
    lines.push({ label: "Flagfall / base", amount: v.base });
    lines.push({ label: `${round2(distKm)} km × ${money(v.perKm)}`, amount: v.perKm * distKm });
    lines.push({ label: `${durMin} min × ${money(v.perMin)}`, amount: v.perMin * durMin });
    if (meter < v.minFare) lines.push({ label: "Minimum fare applied", amount: 0 });
  }

  let surcharge = null;
  if (nightApplied && cfg.night.pct > 0) {
    const amt = fare * cfg.night.pct / 100;
    surcharge = { label: `${cfg.night.label} (+${cfg.night.pct}%)`, amount: amt };
  }

  const extraLines = [];
  let extrasTotal = 0;
  (cfg.extras || []).forEach(ex => {
    const qty = (extraSel && extraSel[ex.id]) || 0;
    if (qty > 0) {
      extraLines.push({ label: qty > 1 ? `${ex.label} × ${qty}` : ex.label, amount: ex.price * qty });
      extrasTotal += ex.price * qty;
    }
  });

  const total = round2(fare + (surcharge ? surcharge.amount : 0) + extrasTotal);
  return {
    vehicleId,
    lines,
    fare: round2(fare),
    surcharge,
    extraLines,
    extrasTotal: round2(extrasTotal),
    total,
    gst: gstComponent(total)
  };
}

/* ---------- WhatsApp / booking text ---------- */
function whatsappLink(number, text) {
  return `https://wa.me/${String(number).replace(/[^0-9]/g, "")}?text=${encodeURIComponent(text)}`;
}
function buildBookingText(b) {
  const lines = [
    `🚖 NEW BOOKING ${b.ref} — Transportation & Transfers`,
    `Name: ${b.name}`,
    `Phone: ${b.phone}`,
    `Pick-up: ${b.pickupLabel}`,
    `Drop-off: ${b.dropoffLabel}`,
    `When: ${b.dateLabel}`,
    `Vehicle: ${b.vehicleName}`,
    `Passengers: ${b.pax}  |  Luggage: ${b.bags}`,
    b.flight ? `Flight: ${b.flight}` : null,
    b.extras.length ? `Extras: ${b.extras.map(e => `${e.label}${e.qty > 1 ? " ×" + e.qty : ""}`).join(", ")}` : null,
    b.km ? `Route: ${b.km} km (est. ${b.min} min)` : null,
    `Estimated fare: ${money(b.total)} incl. GST (GST ${money(b.gst)})`,
    b.requests ? `Requests: ${b.requests}` : null
  ].filter(Boolean);
  return lines.join("\n");
}
