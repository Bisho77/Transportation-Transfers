/* ============================================================
   Transportation & Transfers — public site logic
   ============================================================ */
(function () {
  "use strict";

  let cfg = loadConfig(); // browser cache; refreshed from the database below

  /* ---------- App state ---------- */
  const state = {
    pickup: null,        // {label, lat, lng, locId}
    dropoff: null,
    route: null,         // {km, min, coords|null, source}
    vehicle: "standard",
    extras: {},          // id -> qty
    lastBooking: null
  };

  const $ = (id) => document.getElementById(id);
  const toastEl = $("toast");
  let toastTimer = null;
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove("show"), 3200);
  }

  /* ---------- Populate header / contact / footer from config ---------- */
  function renderBusinessInfo() {
    const b = cfg.business;
    const phoneDigits = String(b.phoneTel || "").replace(/[^+0-9]/g, "");
    const waDigits = String(b.whatsapp || "").replace(/[^0-9]/g, "");
    const emailOk = String(b.email || "").includes("@");

    $("hdr-name").textContent = b.name;
    $("ft-name").textContent = b.name;
    // logo mark follows the first letter of the brand
    document.querySelectorAll(".logo-mark").forEach(el => {
      el.textContent = (b.name.trim().charAt(0) || "T").toUpperCase();
    });

    $("hdr-phone-text").textContent = b.phoneDisplay;
    $("hdr-phone").href = phoneDigits ? "tel:" + phoneDigits : "#";
    $("ct-phone").textContent = b.phoneDisplay;
    $("ct-phone").href = phoneDigits ? "tel:" + phoneDigits : "#";

    $("ct-email").textContent = b.email;
    if (emailOk) $("ct-email").href = "mailto:" + b.email;
    else $("ct-email").removeAttribute("href");

    const waMsg = "Hi " + b.name + "! I'd like to ask about a transfer.";
    $("ct-wa").href = waDigits ? whatsappLink(waDigits, waMsg) : "#";
    $("wa-float").href = waDigits ? whatsappLink(waDigits, "Hi " + b.name + "! I'd like to ask about a ride.") : "#";

    $("ft-abn").textContent = b.abn;
    $("ft-year").textContent = new Date().getFullYear();
    $("cm-deposit-btn").textContent = `Pay ${b.depositPct}% deposit online`;
  }

  function renderFixedFares() {
    const body = $("fixed-fares-body");
    body.innerHTML = "";
    cfg.fixedFares.forEach(f => {
      const tr = document.createElement("tr");
      const td1 = document.createElement("td");
      td1.textContent = `${locationName(f.from)} ↔ ${locationName(f.to)}`;
      const td2 = document.createElement("td"); td2.className = "num"; td2.textContent = money(f.standard);
      const td3 = document.createElement("td"); td3.className = "num"; td3.textContent = money(f.premium);
      tr.append(td1, td2, td3);
      body.appendChild(tr);
    });
  }

  function renderAreaChips() {
    const seen = new Set();
    const wrap = $("area-chips");
    wrap.innerHTML = "";
    const order = ["Brisbane", "Gold Coast", "Hinterland", "Moreton Bay & surrounds", "Sunshine Coast", "Northern NSW"];
    order.forEach(area => {
      LOCATIONS.filter(l => l.area === area).forEach(l => {
        if (seen.has(l.name)) return;
        seen.add(l.name);
        const c = document.createElement("span");
        c.className = "chip";
        c.textContent = l.name;
        wrap.appendChild(c);
      });
    });
  }

  function fillSelect(el, min, max) {
    el.innerHTML = "";
    for (let i = min; i <= max; i++) {
      const o = document.createElement("option");
      o.value = i; o.textContent = i;
      el.appendChild(o);
    }
  }

  /* ---------- Address autocomplete ---------- */
  function attachAutocomplete(inputEl, listEl, which) {
    let debounce = null;
    inputEl.addEventListener("input", () => {
      state[which] = null;
      updateEstimateButton();
      const q = inputEl.value.trim();
      clearTimeout(debounce);
      if (q.length < 2) { listEl.classList.remove("open"); return; }

      // 1) local known places — instant
      const local = LOCATIONS.filter(l =>
        l.name.toLowerCase().includes(q.toLowerCase()) ||
        l.area.toLowerCase().includes(q.toLowerCase())
      ).slice(0, 6);
      renderAcItems(listEl, local.map(l => ({
        name: l.name, area: l.area, badge: l.airport ? "AIRPORT" : null,
        pick: () => selectLocation(which, { label: l.name, lat: l.lat, lng: l.lng, locId: l.id }, inputEl, listEl)
      })));

      // 2) live map search (OpenStreetMap Nominatim) — results appended when they arrive
      debounce = setTimeout(() => fetchNominatim(q, listEl, which, inputEl), 350);
    });

    inputEl.addEventListener("blur", () => setTimeout(() => listEl.classList.remove("open"), 180));
    inputEl.addEventListener("focus", () => { if (listEl.children.length) listEl.classList.add("open"); });
  }

  // Live geocoding (kept separate so failures never break the UI)
  async function fetchNominatim(q, listEl, which, inputEl) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 4500);
      const url = "https://nominatim.openstreetmap.org/search?format=jsonv2&limit=4&countrycodes=au" +
        "&viewbox=152.4,-28.9,153.7,-26.4&q=" + encodeURIComponent(q);
      const res = await fetch(url, { signal: ctrl.signal });
      clearTimeout(t);
      if (!res.ok) return;
      const data = await res.json();
      const items = data.map(r => ({
        name: r.display_name.split(",").slice(0, 2).join(","),
        area: r.display_name.split(",").slice(2, 4).join(",").trim() || "Australia",
        badge: "MAP",
        pick: () => selectLocation(which, {
          label: r.display_name.split(",").slice(0, 3).join(","),
          lat: parseFloat(r.lat), lng: parseFloat(r.lon), locId: null
        }, inputEl, listEl)
      }));
      if (items.length) appendAcItems(listEl, items);
    } catch (e) { /* ignore */ }
  }

  function renderAcItems(listEl, items) {
    listEl.innerHTML = "";
    items.forEach(it => listEl.appendChild(acItemEl(it)));
    if (items.length) listEl.classList.add("open");
  }
  function appendAcItems(listEl, items) {
    items.forEach(it => listEl.appendChild(acItemEl(it)));
    listEl.classList.add("open");
  }
  function acItemEl(it) {
    const d = document.createElement("div");
    d.className = "ac-item";
    const n = document.createElement("div"); n.className = "ac-name"; n.textContent = it.name;
    const a = document.createElement("div"); a.className = "ac-area"; a.textContent = it.area;
    if (it.badge) {
      const b = document.createElement("span"); b.className = "ac-badge"; b.textContent = it.badge;
      n.appendChild(b);
    }
    d.append(n, a);
    d.addEventListener("pointerdown", (e) => { e.preventDefault(); it.pick(); });
    return d;
  }
  function selectLocation(which, loc, inputEl, listEl) {
    state[which] = loc;
    inputEl.value = loc.label;
    listEl.classList.remove("open");
    updateEstimateButton();
  }

  function updateEstimateButton() {
    $("estimate-btn").disabled = !(state.pickup && state.dropoff);
  }

  /* ---------- Swap ---------- */
  $("swap-btn").addEventListener("click", () => {
    const tmp = state.pickup; state.pickup = state.dropoff; state.dropoff = tmp;
    $("pickup-input").value = state.pickup ? state.pickup.label : "";
    $("dropoff-input").value = state.dropoff ? state.dropoff.label : "";
    updateEstimateButton();
  });

  /* ---------- Route calculation ---------- */
  async function getRoute() {
    const a = state.pickup, b = state.dropoff;
    // Try OSRM driving directions (real roads); fall back to straight-line estimate
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 5000);
      const url = `https://router.project-osrm.org/route/v1/driving/${a.lng},${a.lat};${b.lng},${b.lat}?overview=full&geometries=geojson&alternatives=false`;
      const res = await fetch(url, { signal: ctrl.signal });
      clearTimeout(t);
      if (res.ok) {
        const data = await res.json();
        if (data.routes && data.routes[0]) {
          const r = data.routes[0];
          return {
            km: Math.round((r.distance / 1000) * 10) / 10,
            min: Math.max(1, Math.round(r.duration / 60)),
            coords: r.geometry.coordinates,
            source: "road"
          };
        }
      }
    } catch (e) { /* fall through */ }
    const est = estimateRoad(haversineKm(a, b));
    return { km: est.km, min: est.min, coords: null, source: "estimate" };
  }

  /* ---------- Map ---------- */
  let map = null, mapLayer = null;
  function renderMap() {
    if (window.__leafletFailed || typeof L === "undefined") { $("map").style.display = "none"; return; }
    const el = $("map");
    el.style.display = "block";
    if (!map) {
      map = L.map("map", { scrollWheelZoom: false });
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 17, attribution: '© OpenStreetMap'
      }).addTo(map);
    }
    if (mapLayer) { map.removeLayer(mapLayer); mapLayer = null; }
    const g = L.layerGroup().addTo(map);
    mapLayer = g;
    const p = state.pickup, d = state.dropoff;
    L.circleMarker([p.lat, p.lng], { radius: 8, color: "#146c34", fillColor: "#1fae55", fillOpacity: .9, weight: 2 }).addTo(g)
      .bindTooltip("Pick-up: " + p.label, { direction: "top" });
    L.circleMarker([d.lat, d.lng], { radius: 8, color: "#8a5a00", fillColor: "#e8a33d", fillOpacity: .95, weight: 2 }).addTo(g)
      .bindTooltip("Drop-off: " + d.label, { direction: "top" });
    if (state.route && state.route.coords) {
      const latlngs = state.route.coords.map(c => [c[1], c[0]]);
      L.polyline(latlngs, { color: "#0e1f3d", weight: 4, opacity: .75 }).addTo(g);
      map.fitBounds(L.latLngBounds(latlngs).pad(0.2));
    } else {
      const bounds = L.latLngBounds([[p.lat, p.lng], [d.lat, d.lng]]);
      L.polyline([[p.lat, p.lng], [d.lat, d.lng]], { color: "#0e1f3d", weight: 2, dashArray: "6 8", opacity: .6 }).addTo(g);
      map.fitBounds(bounds.pad(0.3));
    }
    setTimeout(() => map.invalidateSize(), 120);
  }

  /* ---------- Estimate + results render ---------- */
  $("estimate-btn").addEventListener("click", async () => {
    const btn = $("estimate-btn");
    btn.disabled = true;
    btn.textContent = "Calculating route…";
    try {
      state.route = await getRoute();
      renderResults();
      $("results-section").style.display = "";
      setTimeout(() => $("results-section").scrollIntoView({ behavior: "smooth", block: "start" }), 60);
    } finally {
      btn.disabled = false;
      btn.textContent = "Calculate fare estimate";
      updateEstimateButton();
    }
  });

  function nightApplies() {
    return isNightTime(cfg, $("trip-date").value, $("trip-time").value);
  }

  function renderResults() {
    const r = state.route;
    const fixed = matchFixedFare(cfg, state.pickup, state.dropoff);
    const night = nightApplies();

    // route summary
    const rs = $("route-summary");
    rs.innerHTML = "";
    const fromTo = document.createElement("span");
    fromTo.className = "route-chip";
    fromTo.textContent = `${state.pickup.label} → ${state.dropoff.label}`;
    rs.appendChild(fromTo);
    const dist = document.createElement("span");
    dist.innerHTML = `📏 <b>${r.km} km</b>`;
    rs.appendChild(dist);
    const dur = document.createElement("span");
    dur.innerHTML = `⏱ est. <b>${r.min} min</b>`;
    rs.appendChild(dur);
    if (r.source === "estimate") {
      const note = document.createElement("span");
      note.style.color = "var(--muted)";
      note.style.fontSize = ".78rem";
      note.textContent = "(live route service busy — showing estimated distance)";
      rs.appendChild(note);
    }
    if (fixed) {
      const chip = document.createElement("span");
      chip.className = "fixed-chip";
      chip.textContent = "✔ Fixed fare route";
      rs.appendChild(chip);
    }
    if (night) {
      const chip = document.createElement("span");
      chip.className = "night-chip";
      chip.textContent = `🌙 ${cfg.night.label} +${cfg.night.pct}%`;
      rs.appendChild(chip);
    }

    renderVehicleCards(fixed, night);
    renderExtras();
    renderMap();
  }

  function renderVehicleCards(fixed, night) {
    const wrap = $("vehicle-cards");
    wrap.innerHTML = "";
    const pax = parseInt($("trip-pax").value, 10);
    const bags = parseInt($("trip-bags").value, 10);

    cfg.vehicles.forEach(v => {
      const fits = pax <= v.pax && bags <= v.bags;
      const q = calculateQuote(cfg, v.id, state.route.km, state.route.min, state.extras, fixed, night);
      const card = document.createElement("div");
      card.className = "vehicle-card" + (state.vehicle === v.id ? " selected" : "") + (!fits ? " disabled" : "");
      card.dataset.vehicle = v.id;

      const h4 = document.createElement("h4"); h4.textContent = v.name;
      const cap = document.createElement("div"); cap.className = "vc-cap";
      cap.textContent = `Up to ${v.pax} passengers · ${v.bags} large bags`;
      const total = document.createElement("div"); total.className = "vc-total"; total.textContent = money(q.total);
      const gst = document.createElement("div"); gst.className = "vc-gst"; gst.textContent = `incl. GST (${money(q.gst)})`;
      card.append(h4, cap, total, gst);

      if (state.vehicle === v.id) {
        const tag = document.createElement("span"); tag.className = "vc-selected-tag"; tag.textContent = "SELECTED";
        card.appendChild(tag);
      }

      const bd = document.createElement("div"); bd.className = "vc-breakdown";
      q.lines.forEach(l => {
        const row = document.createElement("div");
        const lbl = document.createElement("span"); lbl.textContent = l.label;
        const amt = document.createElement("span"); amt.textContent = money(l.amount);
        row.append(lbl, amt); bd.appendChild(row);
      });
      if (q.surcharge) {
        const row = document.createElement("div");
        const lbl = document.createElement("span"); lbl.textContent = q.surcharge.label;
        const amt = document.createElement("span"); amt.textContent = money(q.surcharge.amount);
        row.append(lbl, amt); bd.appendChild(row);
      }
      if (q.extrasTotal > 0) {
        const row = document.createElement("div");
        const lbl = document.createElement("span"); lbl.textContent = "Extras";
        const amt = document.createElement("span"); amt.textContent = money(q.extrasTotal);
        row.append(lbl, amt); bd.appendChild(row);
      }
      card.appendChild(bd);

      if (!fits) {
        const note = document.createElement("div"); note.className = "vc-fit-note";
        note.textContent = pax > v.pax ? `Not enough seats for ${pax} passengers` : `Not enough space for ${bags} bags`;
        card.appendChild(note);
      } else {
        card.addEventListener("click", () => {
          state.vehicle = v.id;
          renderVehicleCards(matchFixedFare(cfg, state.pickup, state.dropoff), nightApplies());
        });
      }
      wrap.appendChild(card);
    });

    // auto-nudge to premium if standard can't fit
    const sel = cfg.vehicles.find(v => v.id === state.vehicle);
    if (sel && (pax > sel.pax || bags > sel.bags)) {
      const bigger = cfg.vehicles.find(v => pax <= v.pax && bags <= v.bags);
      if (bigger) state.vehicle = bigger.id;
      renderVehicleCardsInnerOnly();
    }

    function renderVehicleCardsInnerOnly() {
      wrap.querySelectorAll(".vehicle-card").forEach(c => {
        const id = c.dataset.vehicle;
        c.classList.toggle("selected", id === state.vehicle);
        const tag = c.querySelector(".vc-selected-tag");
        if (id === state.vehicle && !tag) {
          const t = document.createElement("span"); t.className = "vc-selected-tag"; t.textContent = "SELECTED";
          c.appendChild(t);
        } else if (id !== state.vehicle && tag) tag.remove();
      });
    }
  }

  function renderExtras() {
    const wrap = $("extras-list");
    wrap.innerHTML = "";
    cfg.extras.forEach(ex => {
      const row = document.createElement("div");
      row.className = "extra-row";
      const lbl = document.createElement("span"); lbl.className = "ex-label"; lbl.textContent = ex.label;
      const price = document.createElement("span"); price.className = "ex-price";
      price.textContent = `${money(ex.price)} ${ex.unit}`;
      const step = document.createElement("span"); step.className = "stepper";
      const minus = document.createElement("button"); minus.type = "button"; minus.textContent = "−";
      const val = document.createElement("span"); val.textContent = state.extras[ex.id] || 0;
      const plus = document.createElement("button"); plus.type = "button"; plus.textContent = "+";
      minus.addEventListener("click", () => {
        state.extras[ex.id] = Math.max(0, (state.extras[ex.id] || 0) - 1);
        val.textContent = state.extras[ex.id];
        refreshTotals();
      });
      plus.addEventListener("click", () => {
        state.extras[ex.id] = Math.min(8, (state.extras[ex.id] || 0) + 1);
        val.textContent = state.extras[ex.id];
        refreshTotals();
      });
      step.append(minus, val, plus);
      row.append(lbl, price, step);
      wrap.appendChild(row);
    });
  }

  function refreshTotals() {
    // re-render just the totals on each vehicle card
    const fixed = matchFixedFare(cfg, state.pickup, state.dropoff);
    const night = nightApplies();
    document.querySelectorAll("#vehicle-cards .vehicle-card").forEach(card => {
      const id = card.dataset.vehicle;
      const q = calculateQuote(cfg, id, state.route.km, state.route.min, state.extras, fixed, night);
      card.querySelector(".vc-total").textContent = money(q.total);
      card.querySelector(".vc-gst").textContent = `incl. GST (${money(q.gst)})`;
      const extrasRow = card.querySelector(".vc-breakdown");
      // rebuild breakdown quickly
      extrasRow.innerHTML = "";
      q.lines.forEach(l => addRow(extrasRow, l.label, money(l.amount)));
      if (q.surcharge) addRow(extrasRow, q.surcharge.label, money(q.surcharge.amount));
      if (q.extrasTotal > 0) addRow(extrasRow, "Extras", money(q.extrasTotal));
    });
    if (state.lastBooking === null && $("book").style.display !== "none") renderBookingSummary();
    function addRow(parent, label, amount) {
      const row = document.createElement("div");
      const lbl = document.createElement("span"); lbl.textContent = label;
      const amt = document.createElement("span"); amt.textContent = amount;
      row.append(lbl, amt); parent.appendChild(row);
    }
  }

  /* ---------- Proceed to booking ---------- */
  $("proceed-btn").addEventListener("click", () => {
    $("book").style.display = "";
    renderBookingSummary();
    $("b-pax").value = $("trip-pax").value;
    $("b-bags").value = $("trip-bags").value;
    $("book").scrollIntoView({ behavior: "smooth", block: "start" });
  });

  function currentQuote() {
    const fixed = matchFixedFare(cfg, state.pickup, state.dropoff);
    return calculateQuote(cfg, state.vehicle, state.route.km, state.route.min, state.extras, fixed, nightApplies());
  }

  function renderBookingSummary() {
    const box = $("booking-summary");
    if (!state.route) { box.innerHTML = '<div class="bs-empty">Get a fare estimate first.</div>'; return; }
    const q = currentQuote();
    const v = cfg.vehicles.find(x => x.id === state.vehicle);
    const dt = fmtDateTime();
    const rows = [
      ["Route", `${state.pickup.label} → ${state.dropoff.label}`],
      ["Date & time", dt],
      ["Distance / time", `${state.route.km} km · est. ${state.route.min} min`],
      ["Vehicle", v.name],
      ["Passengers / luggage", `${$("trip-pax").value} pax · ${$("trip-bags").value} bags`]
    ];
    box.innerHTML = "";
    rows.forEach(([k, val]) => box.appendChild(bsRow(k, val)));
    q.extraLines.forEach(l => box.appendChild(bsRow(l.label, money(l.amount))));
    if (q.surcharge) box.appendChild(bsRow(q.surcharge.label, money(q.surcharge.amount)));
    const totalRow = bsRow("Estimated total (incl. GST)", money(q.total));
    totalRow.classList.add("total");
    box.appendChild(totalRow);
    const gstRow = document.createElement("div");
    gstRow.className = "bs-row";
    gstRow.style.fontSize = ".8rem"; gstRow.style.color = "var(--muted)";
    gstRow.innerHTML = `<span>GST component</span><span>${money(q.gst)}</span>`;
    box.appendChild(gstRow);
  }
  function bsRow(k, v) {
    const d = document.createElement("div"); d.className = "bs-row";
    const s1 = document.createElement("span"); s1.textContent = k;
    const s2 = document.createElement("span"); s2.textContent = v;
    d.append(s1, s2); return d;
  }

  function fmtDateTime() {
    const d = $("trip-date").value, t = $("trip-time").value;
    if (!d || !t) return "ASAP";
    const dt = new Date(d + "T" + t);
    return dt.toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short", year: "numeric" }) +
      " at " + dt.toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit" });
  }

  /* ---------- Booking submit ---------- */
  $("booking-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const name = $("b-name").value.trim();
    const phone = $("b-phone").value.trim();
    const email = $("b-email").value.trim();
    if (!name || !phone || !email) { toast("Please fill in your name, phone and email."); return; }
    if (!state.route) { toast("Please get a fare estimate first."); return; }

    const q = currentQuote();
    const v = cfg.vehicles.find(x => x.id === state.vehicle);
    const extras = cfg.extras
      .filter(ex => (state.extras[ex.id] || 0) > 0)
      .map(ex => ({ id: ex.id, label: ex.label, qty: state.extras[ex.id], price: ex.price }));

    const now = new Date();
    const ref = "BRZ-" + now.toISOString().slice(2, 10).replace(/-/g, "") + "-" +
      Math.random().toString(36).slice(2, 6).toUpperCase();

    const booking = {
      ref, ts: now.toISOString(),
      name, phone, email,
      pickupLabel: state.pickup.label, dropoffLabel: state.dropoff.label,
      date: $("trip-date").value, time: $("trip-time").value, dateLabel: fmtDateTime(),
      pax: parseInt($("b-pax").value, 10), bags: parseInt($("b-bags").value, 10),
      flight: $("b-flight").value.trim(),
      vehicle: state.vehicle, vehicleName: v.name,
      extras, km: state.route.km, min: state.route.min,
      total: q.total, gst: q.gst,
      requests: $("b-requests").value.trim()
    };
    state.lastBooking = booking;
    pushBooking(booking); // stores in the site database (and browser fallback)
    openConfirmModal(booking);
  });

  function openConfirmModal(b) {
    $("cm-ref").textContent = b.ref;
    $("cm-name").textContent = b.name.split(" ")[0];
    $("cm-email").textContent = b.email;
    const box = $("cm-summary");
    box.innerHTML = "";
    [
      ["Pick-up", b.pickupLabel],
      ["Drop-off", b.dropoffLabel],
      ["When", b.dateLabel],
      ["Vehicle", b.vehicleName],
      ["Passengers / luggage", `${b.pax} pax · ${b.bags} bags`],
      b.flight ? ["Flight", b.flight] : null,
      b.extras.length ? ["Extras", b.extras.map(e => `${e.label}${e.qty > 1 ? " ×" + e.qty : ""}`).join(", ")] : null,
      ["Estimated fare (incl. GST)", money(b.total)]
    ].filter(Boolean).forEach(([k, v]) => {
      const row = document.createElement("div"); row.className = "bs-row";
      const s1 = document.createElement("span"); s1.textContent = k;
      const s2 = document.createElement("span"); s2.textContent = v;
      row.append(s1, s2); box.appendChild(row);
    });

    const waDigits = String(cfg.business.whatsapp || "").replace(/[^0-9]/g, "");
    $("cm-whatsapp").href = waDigits ? whatsappLink(waDigits, buildBookingText(b)) : "#";
    if (String(cfg.business.email || "").includes("@")) {
      $("cm-email-btn").href = "mailto:" + cfg.business.email +
        "?subject=" + encodeURIComponent(`Booking ${b.ref} — ${b.pickupLabel} → ${b.dropoffLabel}`) +
        "&body=" + encodeURIComponent(buildBookingText(b));
    } else {
      $("cm-email-btn").setAttribute("href", "#");
    }
    $("confirm-modal").classList.add("open");
  }

  $("cm-close").addEventListener("click", () => $("confirm-modal").classList.remove("open"));
  $("confirm-modal").addEventListener("click", (e) => { if (e.target === $("confirm-modal")) $("confirm-modal").classList.remove("open"); });

  $("cm-deposit-btn").addEventListener("click", () => {
    const b = state.lastBooking;
    if (!b) return;
    const pct = cfg.business.depositPct;
    const amt = money(b.total * pct / 100);
    alert(
      `Online deposit: ${amt} (${pct}% of ${money(b.total)})\n\n` +
      `PROTOTYPE NOTE: In the production build this button launches a secure payment ` +
      `(Stripe / PayPal / PayID link) so customers can pay the deposit by card immediately. ` +
      `The remaining balance is paid to the driver.`
    );
  });

  /* ---------- Nav toggle ---------- */
  $("nav-toggle").addEventListener("click", () => $("main-nav").classList.toggle("open"));
  document.querySelectorAll("#main-nav a").forEach(a =>
    a.addEventListener("click", () => $("main-nav").classList.remove("open")));

  /* ---------- Init ---------- */
  function init() {
    renderBusinessInfo();
    renderFixedFares();
    renderAreaChips();
    fillSelect($("trip-pax"), 1, 8);
    fillSelect($("trip-bags"), 0, 10);
    fillSelect($("b-pax"), 1, 8);
    fillSelect($("b-bags"), 0, 10);
    $("trip-pax").value = "2"; $("trip-bags").value = "2";

    // sensible defaults: today + 2 hours
    const now = new Date(Date.now() + 2 * 3600 * 1000);
    $("trip-date").value = now.toISOString().slice(0, 10);
    $("trip-time").value = now.toTimeString().slice(0, 5);
    $("trip-date").min = new Date().toISOString().slice(0, 10);

    attachAutocomplete($("pickup-input"), $("pickup-list"), "pickup");
    attachAutocomplete($("dropoff-input"), $("dropoff-list"), "dropoff");

    // re-price if trip details change while results are visible
    const rep = () => {
      if ($("results-section").style.display === "none") return;
      const fixed = matchFixedFare(cfg, state.pickup, state.dropoff);
      renderVehicleCards(fixed, nightApplies());
      if ($("book").style.display !== "none") renderBookingSummary();
    };
    $("trip-date").addEventListener("change", rep);
    $("trip-time").addEventListener("change", rep);
    $("trip-pax").addEventListener("change", rep);
    $("trip-bags").addEventListener("change", rep);
  }
  // Load fresh settings from the database before wiring up the UI
  (async () => {
    cfg = await loadRemoteConfig();
    init();
  })();
})();
