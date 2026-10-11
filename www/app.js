(function () {
  const M = window.CROP_MODEL;
  const $ = (id) => document.getElementById(id);

  const FIELDS = [
    { id: "N", label: "Nitrogen (N)", unit: "kg/ha", min: 0, max: 150, step: 1 },
    { id: "P", label: "Phosphorus (P)", unit: "kg/ha", min: 0, max: 150, step: 1 },
    { id: "K", label: "Potassium (K)", unit: "kg/ha", min: 0, max: 205, step: 1 },
    { id: "ph", label: "Soil pH", unit: "", min: 0, max: 14, step: 0.1 },
    { id: "temperature", label: "Temperature", unit: "°C", min: 0, max: 60, step: 0.1 },
    { id: "humidity", label: "Humidity", unit: "%", min: 0, max: 100, step: 0.1 },
    { id: "rainfall", label: "Rainfall", unit: "mm", min: 0, max: 400, step: 0.1 },
  ];
  // values: N, P, K, temperature, humidity, ph, rainfall (same presets as the Streamlit app)
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
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

  // ---- build form ----
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
  const ORDER = ["N", "P", "K", "temperature", "humidity", "ph", "rainfall"];
  function setValues(arr) {
    ORDER.forEach((id, i) => { $(id).value = arr[i]; $(id + "_r").value = arr[i]; });
  }
  function readValues() {
    const out = [];
    for (const id of ORDER) {
      const f = FIELDS.find((x) => x.id === id);
      let v = parseFloat($(id).value);
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

  // ---- advice (same rules as the original Streamlit app) ----
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
  function fertilizer(v) {
    const [n, p, k, , , ph] = v;
    const a = [];
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

  // ---- predict ----
  $("predict").addEventListener("click", () => {
    const err = $("error");
    const r = readValues();
    if (r.error) { err.textContent = r.error; err.hidden = false; $("result").hidden = true; return; }
    err.hidden = true;
    const v = r.values;
    const res = CropEngine.predict(M, v);
    const conf = res.probs[res.index] * 100;
    $("emoji").textContent = EMOJI[res.label] || "🌱";
    $("crop").textContent = cap(res.label);
    $("conf").textContent = `Confidence: ${conf.toFixed(2)}%`;
    $("why").textContent = explain(res.label, v);
    $("fert").innerHTML = fertilizer(v).map(([t, s]) => `<li class="${t}">${s}</li>`).join("");
    const top = res.probs.map((p, i) => [p, i]).sort((a, b) => b[0] - a[0]).slice(0, 3);
    $("top3").innerHTML = top.map(([p, i]) =>
      `<div class="bar"><div class="bn">${cap(M.classes[i])}</div>` +
      `<div class="bt"><div class="bf" style="width:${(p * 100).toFixed(1)}%"></div></div>` +
      `<div class="bp">${(p * 100).toFixed(2)}%</div></div>`).join("");
    $("result").hidden = false;
    $("result").scrollIntoView({ behavior: "smooth", block: "start" });
  });

  // ---- PWA: offline + installable in a browser (not needed inside the Android app) ----
  if ("serviceWorker" in navigator && /^https?:$/.test(location.protocol) && !window.Capacitor) {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
})();
