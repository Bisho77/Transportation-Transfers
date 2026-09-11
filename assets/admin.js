/* ============================================================
   Transportation & Transfers — owner admin panel logic
   ============================================================ */
(function () {
  "use strict";

  let cfg = loadConfig();
  const $ = (id) => document.getElementById(id);

  const toastEl = $("toast");
  let toastTimer = null;
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove("show"), 2800);
  }

  /* ---------- Render forms ---------- */
  function renderBusiness() {
    const b = cfg.business;
    $("biz-name").value = b.name;
    $("biz-phone-display").value = b.phoneDisplay;
    $("biz-phone-tel").value = b.phoneTel;
    $("biz-whatsapp").value = b.whatsapp;
    $("biz-email").value = b.email;
    $("biz-abn").value = b.abn;
    $("biz-deposit").value = b.depositPct;
  }

  function renderNight() {
    $("night-start").value = cfg.night.start;
    $("night-end").value = cfg.night.end;
    $("night-pct").value = cfg.night.pct;
  }

  function renderVehicles() {
    const tb = document.querySelector("#vehicle-table tbody");
    tb.innerHTML = "";
    cfg.vehicles.forEach((v, i) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td><input data-v="${i}" data-k="name" value="${esc(v.name)}" style="min-width:210px"></td>
        <td><input data-v="${i}" data-k="pax" type="number" min="1" max="16" value="${v.pax}" style="width:64px"></td>
        <td><input data-v="${i}" data-k="bags" type="number" min="0" max="20" value="${v.bags}" style="width:64px"></td>
        <td><input data-v="${i}" data-k="base" type="number" step="0.1" min="0" value="${v.base}" style="width:84px"></td>
        <td><input data-v="${i}" data-k="perKm" type="number" step="0.05" min="0" value="${v.perKm}" style="width:84px"></td>
        <td><input data-v="${i}" data-k="perMin" type="number" step="0.05" min="0" value="${v.perMin}" style="width:84px"></td>
        <td><input data-v="${i}" data-k="minFare" type="number" step="0.5" min="0" value="${v.minFare}" style="width:84px"></td>`;
      tb.appendChild(tr);
    });
  }

  function renderExtras() {
    const tb = document.querySelector("#extras-table tbody");
    tb.innerHTML = "";
    cfg.extras.forEach((ex, i) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td><input data-x="${i}" data-k="label" value="${esc(ex.label)}" style="min-width:170px"></td>
        <td><input data-x="${i}" data-k="unit" value="${esc(ex.unit)}" style="width:90px"></td>
        <td><input data-x="${i}" data-k="price" type="number" step="0.5" min="0" value="${ex.price}" style="width:84px"></td>
        <td style="text-align:right"><button class="del-btn" data-delx="${i}">Remove</button></td>`;
      tb.appendChild(tr);
    });
    tb.querySelectorAll("[data-delx]").forEach(btn =>
      btn.addEventListener("click", () => {
        cfg.extras.splice(parseInt(btn.dataset.delx, 10), 1);
        renderExtras();
      }));
  }

  function renderFixed() {
    const tb = document.querySelector("#fixed-table tbody");
    tb.innerHTML = "";
    cfg.fixedFares.forEach((f, i) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${locSelect(`data-f="${i}" data-k="from"`, f.from)}</td>
        <td>${locSelect(`data-f="${i}" data-k="to"`, f.to)}</td>
        <td><input data-f="${i}" data-k="standard" type="number" step="1" min="0" value="${f.standard}" style="width:80px"></td>
        <td><input data-f="${i}" data-k="premium" type="number" step="1" min="0" value="${f.premium}" style="width:80px"></td>
        <td style="text-align:right"><button class="del-btn" data-delf="${i}">Remove</button></td>`;
      tb.appendChild(tr);
    });
    tb.querySelectorAll("[data-delf]").forEach(btn =>
      btn.addEventListener("click", () => {
        cfg.fixedFares.splice(parseInt(btn.dataset.delf, 10), 1);
        renderFixed();
      }));
  }

  function locSelect(attrs, selected) {
    const opts = LOCATIONS.map(l =>
      `<option value="${l.id}" ${l.id === selected ? "selected" : ""}>${esc(l.name)}</option>`).join("");
    return `<select ${attrs}>${opts}</select>`;
  }

  function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
  }

  async function renderBookings() {
    const tb = document.querySelector("#bookings-table tbody");
    tb.innerHTML = "";
    const waDigits = String(cfg.business.whatsapp || "").replace(/[^0-9]/g, "");
    const bookings = await loadRemoteBookings();
    if (!bookings.length) {
      tb.innerHTML = `<tr><td colspan="7" style="color:var(--muted);padding:14px 8px">No bookings yet. Bookings made on the website appear here.</td></tr>`;
      return;
    }
    bookings.forEach((b, i) => {
      const tr = document.createElement("tr");
      const when = new Date(b.ts).toLocaleString("en-AU", { day: "2-digit", month: "short", hour: "numeric", minute: "2-digit" });
      tr.innerHTML = `
        <td><b>${esc(b.ref)}</b></td>
        <td>${esc(b.dateLabel || when)}<br><span style="color:var(--muted);font-size:.78rem">booked ${when}</span></td>
        <td>${esc(b.name)}<br><span style="color:var(--muted);font-size:.78rem">${esc(b.phone)}</span></td>
        <td style="font-size:.82rem">${esc(b.pickupLabel)} → ${esc(b.dropoffLabel)}<br><span style="color:var(--muted)">${b.km || "?"} km</span></td>
        <td style="font-size:.82rem">${esc(b.vehicleName)}</td>
        <td><b>${money(b.total)}</b></td>
        <td style="text-align:right;white-space:nowrap">
          <a class="btn btn-whatsapp btn-sm" ${waDigits ? `target="_blank" rel="noopener" href="${whatsappLink(waDigits, buildBookingText(b))}"` : 'href="#"'}>WhatsApp</a>
          <button class="del-btn" data-delb="${esc(b.ref)}">Delete</button>
        </td>`;
      tb.appendChild(tr);
    });
    tb.querySelectorAll("[data-delb]").forEach(btn =>
      btn.addEventListener("click", async () => {
        const ref = btn.dataset.delb;
        // remove from browser mirror too, then from the database
        const all = getBookings().filter(b => b.ref !== ref);
        localStorage.setItem(STORAGE_BOOKINGS_KEY, JSON.stringify(all));
        await deleteRemoteBooking(ref);
        renderBookings();
        toast("Booking deleted.");
      }));
  }

  /* ---------- Collect form state back into cfg ---------- */
  function collect() {
    cfg.business = {
      name: $("biz-name").value.trim() || DEFAULT_CONFIG.business.name,
      phoneDisplay: $("biz-phone-display").value.trim(),
      phoneTel: $("biz-phone-tel").value.trim(),
      whatsapp: $("biz-whatsapp").value.replace(/[^0-9]/g, ""),
      email: $("biz-email").value.trim(),
      abn: $("biz-abn").value.trim(),
      depositPct: clampNum($("biz-deposit").value, 0, 100, 20)
    };
    cfg.night = {
      start: $("night-start").value || "22:00",
      end: $("night-end").value || "05:00",
      pct: clampNum($("night-pct").value, 0, 100, 15),
      label: DEFAULT_CONFIG.night.label
    };

    document.querySelectorAll("#vehicle-table input[data-v]").forEach(inp => {
      const i = parseInt(inp.dataset.v, 10), k = inp.dataset.k;
      if (k === "name") cfg.vehicles[i].name = inp.value;
      else if (k === "pax" || k === "bags") cfg.vehicles[i][k] = clampNum(inp.value, 0, 99, cfg.vehicles[i][k]);
      else cfg.vehicles[i][k] = clampNum(inp.value, 0, 9999, cfg.vehicles[i][k]);
    });

    cfg.extras = cfg.extras.map(ex => ({ ...ex }));
    document.querySelectorAll("#extras-table input[data-x]").forEach(inp => {
      const i = parseInt(inp.dataset.x, 10), k = inp.dataset.k;
      if (!cfg.extras[i]) return;
      cfg.extras[i][k] = k === "price" ? clampNum(inp.value, 0, 9999, 0) : inp.value;
    });
    cfg.extras = cfg.extras.filter(ex => ex.label && ex.label.trim());

    document.querySelectorAll("#fixed-table [data-f]").forEach(inp => {
      const i = parseInt(inp.dataset.f, 10), k = inp.dataset.k;
      if (!cfg.fixedFares[i]) return;
      cfg.fixedFares[i][k] = (k === "standard" || k === "premium") ? clampNum(inp.value, 0, 99999, 0) : inp.value;
    });
  }

  function clampNum(val, min, max, fallback) {
    const n = parseFloat(val);
    if (isNaN(n)) return fallback;
    return Math.max(min, Math.min(max, n));
  }

  /* ---------- Actions ---------- */
  $("save-all").addEventListener("click", () => {
    collect();
    pushConfig(cfg).then(ok => {
      $("save-note").textContent = ok
        ? "💾 Saved to the database at " + new Date().toLocaleTimeString("en-AU") + " — live on the website now."
        : "💾 Saved to this browser at " + new Date().toLocaleTimeString("en-AU") + " (database not reachable).";
      $("db-badge").textContent = ok ? "Database: connected ✅" : "Database: offline — using browser storage";
      toast(ok ? "✅ Settings saved to database." : "✅ Settings saved (browser).");
    });
  });

  $("add-extra").addEventListener("click", () => {
    cfg.extras.push({ id: "extra-" + Date.now(), label: "New charge", unit: "per trip", price: 5 });
    renderExtras();
  });

  $("add-fixed").addEventListener("click", () => {
    cfg.fixedFares.push({ from: "bne-dom", to: "brisbane-cbd", standard: 65, premium: 85 });
    renderFixed();
  });

  $("export-cfg").addEventListener("click", () => {
    collect();
    const blob = new Blob([JSON.stringify(cfg, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "settings-backup.json";
    a.click();
    URL.revokeObjectURL(a.href);
  });

  $("import-cfg").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        cfg = deepMerge(JSON.parse(JSON.stringify(DEFAULT_CONFIG)), parsed);
        saveConfig(cfg);
        renderAll();
        toast("✅ Settings imported & saved.");
      } catch (err) {
        toast("⚠️ That file doesn't look like a valid settings export.");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  });

  $("reset-cfg").addEventListener("click", () => {
    if (!confirm("Reset ALL rates and settings back to defaults? This cannot be undone.")) return;
    localStorage.removeItem(STORAGE_CONFIG_KEY);
    cfg = loadConfig();
    renderAll();
    toast("Settings reset to defaults.");
  });

  /* ---------- Init ---------- */
  function renderAll() {
    renderBusiness();
    renderNight();
    renderVehicles();
    renderExtras();
    renderFixed();
    renderBookings();
  }
  renderAll();
  // Refresh from the database, then re-render with the authoritative data
  loadRemoteConfig().then(c => {
    cfg = c;
    renderAll();
    $("db-badge").textContent = API_OK ? "Database: connected ✅" : "Database: offline — using browser storage";
  });
})();
