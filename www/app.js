(function () {
  const M = window.CROP_MODEL, INFO = window.CROP_INFO, MI = window.MODEL_INFO, L = window.CropLogic;
  const $ = (id) => document.getElementById(id);
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

  const FIELDS = [
    { id: "N", label: "Nitrogen (N)", unit: "kg/ha", min: 0, max: 150, step: 1 },
    { id: "P", label: "Phosphorus (P)", unit: "kg/ha", min: 0, max: 150, step: 1 },
    { id: "K", label: "Potassium (K)", unit: "kg/ha", min: 0, max: 205, step: 1 },
    { id: "ph", label: "Soil pH", unit: "", min: 0, max: 14, step: 0.1 },
    { id: "temperature", label: "Temperature", unit: "°C", min: 0, max: 60, step: 0.1 },
    { id: "humidity", label: "Humidity", unit: "%", min: 0, max: 100, step: 0.1 },
    { id: "rainfall", label: "Rainfall (last 30 days)", unit: "mm", min: 0, max: 400, step: 0.1 },
  ];
  const ORDER = ["N", "P", "K", "temperature", "humidity", "ph", "rainfall"];
  const PRESETS = {
    Rice: [90, 42, 43, 20.88, 82, 6.5, 202.94],
    Maize: [71, 54, 16, 22.61, 63.69, 5.75, 87.76],
    Chickpea: [40, 72, 77, 17.02, 16.99, 7.49, 88.55],
    Cotton: [133, 47, 24, 24.4, 79.2, 7.23, 90.8],
    Coffee: [91, 21, 26, 26.33, 57.36, 7.26, 191.65],
  };
  const EMOJI = { apple:"🍎", banana:"🍌", blackgram:"🫘", chickpea:"🫘", coconut:"🥥", coffee:"☕", cotton:"🌿",
    grapes:"🍇", jute:"🌾", kidneybeans:"🫘", lentil:"🫘", maize:"🌽", mango:"🥭", mothbeans:"🫘", mungbean:"🫘",
    muskmelon:"🍈", orange:"🍊", papaya:"🥭", pigeonpeas:"🫛", pomegranate:"🍎", rice:"🌾", watermelon:"🍉" };
  let last = null; // last prediction {crop, v}

  // ---------- tabs ----------
  document.querySelectorAll(".tab").forEach((b) => b.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((x) => x.classList.toggle("on", x === b));
    document.querySelectorAll(".pane").forEach((p) => (p.hidden = p.id !== "pane-" + b.dataset.tab));
    window.scrollTo({ top: 0 });
  }));

  // ---------- inputs ----------
  const form = $("fields");
  FIELDS.forEach((f) => {
    const w = document.createElement("div");
    w.className = "field";
    w.innerHTML =
      `<label for="${f.id}">${f.label}${f.unit ? ` <span class="unit">${f.unit}</span>` : ""}</label>` +
      `<div class="row"><input type="range" id="${f.id}_r" min="${f.min}" max="${f.max}" step="${f.step}">` +
      `<input type="number" id="${f.id}" inputmode="decimal" min="${f.min}" max="${f.max}" step="${f.step}"></div>`;
    form.appendChild(w);
    const num = w.querySelector("#" + f.id), rng = w.querySelector("#" + f.id + "_r");
    num.addEventListener("input", () => { rng.value = num.value; });
    rng.addEventListener("input", () => { num.value = rng.value; });
  });
  function setValue(id, val) { $(id).value = val; $(id + "_r").value = val; }
  function setValues(arr) { ORDER.forEach((id, i) => setValue(id, arr[i])); }
  function readValues() {
    const out = [];
    for (const id of ORDER) {
      const f = FIELDS.find((x) => x.id === id);
      const v = parseFloat($(id).value);
      if (isNaN(v)) return { error: `Please enter a value for ${f.label}.` };
      if (v < f.min || v > f.max) return { error: `${f.label} must be between ${f.min} and ${f.max}.` };
      out.push(v);
    }
    return { values: out };
  }
  const chips = $("presets");
  Object.keys(PRESETS).forEach((name) => {
    const b = document.createElement("button");
    b.type = "button"; b.className = "chip"; b.textContent = name;
    b.onclick = () => {
      setValues(PRESETS[name]);
      chips.querySelectorAll(".chip").forEach((c) => c.classList.toggle("on", c === b));
      $("result").hidden = true;
    };
    chips.appendChild(b);
  });
  setValues(PRESETS.Rice);

  // ---------- 1) weather auto-fill (Open-Meteo, free, no key) ----------
  function wStatus(msg, kind) { const e = $("wStatus"); e.textContent = msg; e.className = "wstatus " + (kind || ""); e.hidden = !msg; }
  async function getJSON(url) {
    const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 12000);
    try {
      const r = await fetch(url, { signal: ctl.signal });
      if (!r.ok) throw new Error("HTTP " + r.status);
      return await r.json();
    } finally { clearTimeout(t); }
  }
  async function fillFromWeather(lat, lon, label) {
    wStatus("Fetching weather…", "");
    try {
      const j = await getJSON(
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
        `&current=temperature_2m,relative_humidity_2m&daily=precipitation_sum&past_days=30&forecast_days=1&timezone=auto`);
      const w = L.parseWeather(j);
      setValue("temperature", w.temperature); setValue("humidity", w.humidity); setValue("rainfall", w.rainfall);
      chips.querySelectorAll(".chip").forEach((c) => c.classList.remove("on"));
      $("result").hidden = true;
      let msg = `Filled for ${label}: ${w.temperature} °C, ${w.humidity}% humidity, ${w.rainfall} mm rain in the last ${w.days} days.`;
      if (w.rainfallRaw > 400) msg += " (Rainfall capped at 400 mm, the model's maximum.)";
      wStatus(msg + " Now enter your soil values (N, P, K, pH).", "ok");
    } catch (e) {
      wStatus("Couldn't get weather. Check your internet connection, or enter the values by hand.", "err");
    }
  }
  $("geoBtn").addEventListener("click", () => {
    if (!navigator.geolocation) { wStatus("Location isn't available here. Search your city instead.", "err"); return; }
    wStatus("Getting your location…", "");
    navigator.geolocation.getCurrentPosition(
      (p) => fillFromWeather(p.coords.latitude.toFixed(3), p.coords.longitude.toFixed(3), "your location"),
      () => wStatus("Couldn't get your location (permission denied or GPS off). Search your city instead.", "err"),
      { timeout: 15000, maximumAge: 600000 });
  });
  async function searchCity() {
    const q = $("cityInput").value.trim(), box = $("cityResults");
    box.innerHTML = "";
    if (q.length < 2) { wStatus("Type at least 2 letters of a city name.", "err"); return; }
    wStatus("Searching…", "");
    try {
      const j = await getJSON(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=5&language=en&format=json`);
      if (!j.results || !j.results.length) { wStatus("No city found. Try another spelling.", "err"); return; }
      wStatus("Tap your city:", "");
      j.results.forEach((r) => {
        const b = document.createElement("button");
        b.type = "button"; b.className = "chip";
        const label = [r.name, r.admin1, r.country].filter(Boolean).join(", ");
        b.textContent = label;
        b.onclick = () => { box.innerHTML = ""; fillFromWeather(r.latitude, r.longitude, label); };
        box.appendChild(b);
      });
    } catch (e) {
      wStatus("Couldn't search. Check your internet connection.", "err");
    }
  }
  $("cityBtn").addEventListener("click", searchCity);
  $("cityInput").addEventListener("keydown", (e) => { if (e.key === "Enter") searchCity(); });

  // ---------- advice rules (same as the original Streamlit app) ----------
  function explain(crop, v) {
    const [n, p, k, temp, hum, ph, rain] = v;
    const r = [];
    if (rain > 200) r.push(`High rainfall (${rain} mm) supports water-intensive growth.`);
    else if (rain < 100) r.push(`Moderate to low rainfall (${rain} mm) prevents waterlogging.`);
    else r.push(`Balanced rainfall (${rain} mm) meets standard irrigation needs.`);
    if (temp > 25) r.push(`Warm temperature (${temp} °C) accelerates metabolic processes.`);
    else r.push(`Cooler temperature (${temp} °C) suits temperate crop requirements.`);
    if (ph < 6) r.push(`Acidic soil pH (${ph}) matches specific nutrient absorption needs.`);
    else if (ph > 7.5) r.push(`Alkaline soil pH (${ph}) provides suitable chemical balance.`);
    else r.push(`Neutral soil pH (${ph}) ensures optimal nutrient availability.`);
    return `${cap(crop)} was recommended because: ${r.join(" ")} Soil nutrient levels (N:${n}, P:${p}, K:${k}) and humidity (${hum}%) align with optimal historical thresholds.`;
  }
  function advice(v) {
    const [n, p, k, , , ph] = v, a = [];
    if (n < 50) a.push(["warn", "Nitrogen is low: consider Urea or Ammonium Sulphate to boost vegetative growth."]);
    else if (n > 120) a.push(["warn", "Nitrogen is high: avoid excess nitrogen to prevent lodging."]);
    else a.push(["ok", "Nitrogen level is optimal."]);
    if (p < 30) a.push(["warn", "Phosphorus is low: apply Single Super Phosphate (SSP) or DAP to enhance root development."]);
    else a.push(["ok", "Phosphorus level is optimal."]);
    if (k < 30) a.push(["warn", "Potassium is low: apply Muriate of Potash (MOP) to improve disease resistance and grain filling."]);
    else a.push(["ok", "Potassium level is optimal."]);
    if (ph < 5.5) a.push(["warn", "Soil is acidic: apply Agricultural Lime to raise pH towards neutral."]);
    else if (ph > 8) a.push(["warn", "Soil is alkaline: apply Gypsum or elemental sulfur to lower pH."]);
    else a.push(["ok", "Soil pH is within healthy agricultural range."]);
    return a;
  }

  // ---------- 2) season guide for the recommended crop ----------
  function seasonCardHTML(crop) {
    const c = INFO[crop], month = new Date().getMonth() + 1;
    const st = L.sowStatus(c.sow, month);
    const badges = c.seasons.map((s) => `<span class="badge ${s.toLowerCase()}">${s}</span>`).join("");
    const verb = c.seasons[0] === "Perennial" ? "Planting" : "Sowing";
    const now = st.now
      ? `<div class="now ok">✅ Good time to ${verb.toLowerCase() === "planting" ? "plant" : "sow"} now (${L.MONTHS[month - 1]}).</div>`
      : `<div class="now warn">⚠️ Not the usual ${verb.toLowerCase()} time now (${L.MONTHS[month - 1]}). Next window starts in ${L.MONTHS[st.next - 1]}.</div>`;
    return `<h2>📅 Suitable season for ${cap(crop)}</h2><div class="badges">${badges}</div>
      <div class="kv"><span>${verb} months</span><b>${L.monthList(c.sow)}</b></div>
      <div class="kv"><span>Harvest</span><b>${c.harvest}</b></div>${now}
      <p class="hint">${c.note} General guidance for India; exact dates vary by region and variety.</p>`;
  }

  // ---------- 3) fertilizer quantity ----------
  function bags(kg, size) { return kg > 0 ? ` (≈ ${(kg / size).toFixed(1)} bags of ${size} kg)` : ""; }
  function renderFert() {
    const out = $("fertOut");
    if (!last) return;
    const area = parseFloat($("area").value), unit = $("unit").value;
    const ha = L.areaToHa(area, unit);
    if (!isFinite(ha)) { out.innerHTML = `<div class="err">Enter a field size greater than 0.</div>`; return; }
    const npk = INFO[last.crop].npk, p = L.fertPlan(npk, last.v, ha);
    const row = (n, mine, typ, gap) => `<tr><td>${n}</td><td>${mine}</td><td>${typ}</td><td class="${gap > 0 ? "gap" : ""}">${gap > 0 ? "+" + gap.toFixed(1) : "OK"}</td></tr>`;
    const table = `<div class="scroll"><table><tr><th>Nutrient</th><th>Your soil</th><th>Typical for ${cap(last.crop)}</th><th>Gap (kg/ha)</th></tr>` +
      row("Nitrogen (N)", last.v[0], npk.N, p.gap.N) + row("Phosphorus (P)", last.v[1], npk.P, p.gap.P) +
      row("Potassium (K)", last.v[2], npk.K, p.gap.K) + `</table></div>`;
    const f = p.field;
    let prods;
    if (f.urea + f.dap + f.mop === 0) prods = `<div class="now ok">✅ Your N, P and K are already at or above the typical level for this crop. No extra NPK fertilizer needed.</div>`;
    else prods = `<div class="kv"><span>Urea (46% N)</span><b>${f.urea} kg${bags(f.urea, 45)}</b></div>
      <div class="kv"><span>DAP (18% N, 46% P₂O₅)</span><b>${f.dap} kg${bags(f.dap, 50)}</b></div>
      <div class="kv"><span>MOP (60% K₂O)</span><b>${f.mop} kg${bags(f.mop, 50)}</b></div>
      <p class="hint">Total for ${area} ${unit}${area === 1 ? "" : "s"}. DAP's nitrogen is counted before calculating Urea.</p>`;
    out.innerHTML = table + prods;
  }
  $("area").addEventListener("input", renderFert);
  $("unit").addEventListener("change", renderFert);

  // ---------- predict ----------
  $("predict").addEventListener("click", () => {
    const err = $("error"), r = readValues();
    if (r.error) { err.textContent = r.error; err.hidden = false; $("result").hidden = true; return; }
    err.hidden = true;
    const v = r.values, res = CropEngine.predict(M, v), conf = res.probs[res.index] * 100;
    last = { crop: res.label, v };
    $("emoji").textContent = EMOJI[res.label] || "🌱";
    $("crop").textContent = cap(res.label);
    $("conf").textContent = `Confidence: ${conf.toFixed(2)}%`;
    $("why").textContent = explain(res.label, v);
    $("seasonCard").innerHTML = seasonCardHTML(res.label);
    $("fert").innerHTML = advice(v).map(([t, s]) => `<li class="${t}">${s}</li>`).join("");
    renderFert();
    const top = res.probs.map((p, i) => [p, i]).sort((a, b) => b[0] - a[0]).slice(0, 3);
    $("top3").innerHTML = top.map(([p, i]) =>
      `<div class="bar"><div class="bn">${cap(M.classes[i])}</div><div class="bt"><div class="bf" style="width:${(p * 100).toFixed(1)}%"></div></div><div class="bp">${(p * 100).toFixed(2)}%</div></div>`).join("");
    $("result").hidden = false;
    $("result").scrollIntoView({ behavior: "smooth", block: "start" });
  });

  // ---------- season guide tab ----------
  let seasonFilter = "All";
  const SF = ["All", "Kharif", "Rabi", "Zaid", "Perennial"];
  SF.forEach((s) => {
    const b = document.createElement("button");
    b.type = "button"; b.className = "chip" + (s === "All" ? " on" : ""); b.textContent = s;
    b.onclick = () => { seasonFilter = s; $("sfilters").querySelectorAll(".chip").forEach((c) => c.classList.toggle("on", c === b)); renderSeasonList(); };
    $("sfilters").appendChild(b);
  });
  function renderSeasonList() {
    const q = $("sSearch").value.trim().toLowerCase(), month = new Date().getMonth() + 1;
    const html = M.classes.filter((c) => (seasonFilter === "All" || INFO[c].seasons.includes(seasonFilter)) && c.includes(q)).map((c) => {
      const i = INFO[c], st = L.sowStatus(i.sow, month);
      return `<div class="crop"><div class="ch"><span class="ce">${EMOJI[c] || "🌱"}</span><b>${cap(c)}</b>${st.now ? `<span class="badge sownow">Sow now</span>` : ""}</div>
        <div class="badges">${i.seasons.map((s) => `<span class="badge ${s.toLowerCase()}">${s}</span>`).join("")}</div>
        <div class="kv"><span>${i.seasons[0] === "Perennial" ? "Planting" : "Sowing"}</span><b>${L.monthList(i.sow)}</b></div>
        <div class="kv"><span>Harvest</span><b>${i.harvest}</b></div><p class="hint">${i.note}</p></div>`;
    }).join("");
    $("sList").innerHTML = html || `<p class="hint">No crops match.</p>`;
  }
  $("sSearch").addEventListener("input", renderSeasonList);
  renderSeasonList();

  // ---------- 4) about the model ----------
  (function about() {
    const imp = Object.entries(MI.importance).sort((a, b) => b[1] - a[1]);
    const max = imp[0][1], nice = { N: "Nitrogen", P: "Phosphorus", K: "Potassium", temperature: "Temperature", humidity: "Humidity", ph: "Soil pH", rainfall: "Rainfall" };
    $("aboutStats").innerHTML = [[MI.accuracy + "%", "Test accuracy"], [MI.trees, "Decision trees"], [MI.classes, "Crops"], [MI.rows, "Dataset rows"]]
      .map(([a, b]) => `<div class="stat"><div class="sv">${a}</div><div class="sl">${b}</div></div>`).join("");
    $("aboutImp").innerHTML = imp.map(([k, v]) =>
      `<div class="bar"><div class="bn">${nice[k]}</div><div class="bt"><div class="bf" style="width:${(v / max * 100).toFixed(0)}%"></div></div><div class="bp">${(v * 100).toFixed(1)}%</div></div>`).join("");
    $("aboutCrops").textContent = M.classes.map(cap).join(", ");
    $("aboutSplit").textContent = `${MI.train} rows for training and ${MI.test} rows for testing (80/20 split), ${MI.perCrop} rows per crop.`;
  })();
})();
