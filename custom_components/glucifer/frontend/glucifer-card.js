// SPDX-License-Identifier: GPL-3.0-or-later
// No remote resources; measurements remain within the authenticated HA connection.
// Wire names match JugglucoNG's optional fields. These switches affect display only.
const GLUCIFER_FIELDS = {
  trend: "Trend", delta_mgdl: "Glucose delta (5 min)", rate_mgdl_min: "Rate of change",
  raw_mgdl: "Raw glucose", auto_mgdl: "Automatically calibrated glucose",
  iob_u: "Insulin on board", cob_g: "Carbs on board", battery_percent: "Phone battery level",
  sensor_id: "Sensor identifier", sensor_generation: "Sensor generation",
  sensor_started_ms: "Started", sensor_expires_ms: "Expected end", sensor_warmup: "Sensor warming up",
};
const GLUCIFER_SENSOR_FIELDS = Object.keys(GLUCIFER_FIELDS).filter(key => key.startsWith("sensor_"));
const GLUCIFER_DEFAULTS = {
  ...Object.fromEntries(Object.keys(GLUCIFER_FIELDS).map(key => [`show_${key}`, true])),
  show_reading_age: true, show_glucose_unit: true, show_logo: true, arrow_size: 96,
  hours: 24, show_history: true, show_details: true, show_alerts: true, show_lifecycle: true,
  show_journal: false, journal_compact: true, show_journal_markers: true, journal_days: 7, journal_limit: 25,
  journal_types: ["insulin", "carbs", "note"], color_glucose: true, color_trend: true,
  very_low: 54, low: 70, high: 180, very_high: 250,
  glucose_very_low_color: [183,28,28], glucose_low_color: [229,57,53],
  glucose_normal_color: [67,160,71], glucose_high_color: [251,140,0], glucose_very_high_color: [229,57,53],
  trend_stable_color: [67,160,71], trend_rising_color: [251,140,0],
  trend_falling_color: [251,140,0], trend_fast_color: [229,57,53],
};
function gluciferConfig(config) {
  const result = {...GLUCIFER_DEFAULTS, ...config};
  for (const [key,min,max] of [["hours",1,168],["arrow_size",24,160],["journal_days",1,90],["journal_limit",1,200],
    ["very_low",1,1000],["low",1,1000],["high",1,1000],["very_high",1,1000]]) {
    const value = config[key] == null || config[key] === "" ? GLUCIFER_DEFAULTS[key] : Number(config[key]);
    if (!Number.isFinite(value) || value < min || value > max) throw new Error(`${key.replaceAll("_", " ")} must be between ${min} and ${max}.`);
    result[key] = value;
  }
  if (!(result.very_low < result.low && result.low < result.high && result.high < result.very_high))
    throw new Error("Glucose boundaries must increase from very low to very high.");
  for (const key of Object.keys(GLUCIFER_DEFAULTS).filter(k => k.endsWith("_color"))) {
    const color = result[key] ?? GLUCIFER_DEFAULTS[key];
    if (!Array.isArray(color) || color.length !== 3 || color.some(v => !Number.isInteger(v) || v < 0 || v > 255))
      throw new Error("Choose a valid color using the color picker.");
    result[key] = color;
  }
  if (!Array.isArray(result.journal_types) || result.journal_types.some(t => !["insulin","carbs","note"].includes(t)))
    throw new Error("Choose insulin, carbohydrates or notes for journal entries.");
  // Retain old YAML settings while exposing individual fields in the editor.
  for (const key of GLUCIFER_SENSOR_FIELDS) if (config[`show_${key}`] == null && config.show_lifecycle === false) result[`show_${key}`] = false;
  for (const key of ["delta_mgdl", "reading_age"]) if (config[`show_${key}`] == null && config.show_details === false) result[`show_${key}`] = false;
  return result;
}
const gluciferColor = (config, key) => `rgb(${config[key].join(",")})`;
function gluciferGlucoseColor(value, unit, config) {
  if (!Number.isFinite(value) || !config.color_glucose) return "var(--primary-text-color)";
  const mgdl = unit === "mmol/L" ? value * 18.016 : value;
  const range = mgdl < config.very_low ? "very_low" : mgdl < config.low ? "low" : mgdl > config.very_high ? "very_high" : mgdl > config.high ? "high" : "normal";
  return gluciferColor(config, `glucose_${range}_color`);
}
function gluciferTrendColor(trend, config) {
  if (!config.color_trend) return "var(--primary-text-color)";
  const ranges = new Map([["DoubleUp","fast"],["SingleUp","rising"],["FortyFiveUp","rising"],["Flat","stable"],["FortyFiveDown","falling"],["SingleDown","falling"],["DoubleDown","fast"]]);
  const range = ranges.get(trend);
  return range ? gluciferColor(config, `trend_${range}_color`) : "var(--primary-text-color)";
}
function gluciferForm() {
  const field = (name, label, selector) => ({name, label, selector});
  const toggle = (name,label) => ({...field(name,label,{boolean:{}}),default:GLUCIFER_DEFAULTS[name]});
  const number = (name,label,min,max) => field(name,label,{number:{min,max,step:1,mode:"box"}});
  const color = (name,label) => field(name,label,{color_rgb:{}});
  const panel = (name,title,schema) => ({name,type:"expandable",title,flatten:true,schema});
  const form = {
    schema: [field("entity","Glucose entity",{entity:{filter:{domain:"sensor",device_class:"blood_glucose_concentration"}}}),
      field("title","Title",{text:{}}), number("hours","Chart hours",1,168),
      panel("display","Display",[{...number("arrow_size","Arrow size (px)",24,160),default:96},toggle("show_logo","Show logo"),toggle("show_history","Glucose chart"),toggle("show_glucose_unit","Show glucose unit"),toggle("show_reading_age","Reading age"),toggle("show_alerts","Active alerts")]),
      panel("values","Glucose and phone data",Object.entries(GLUCIFER_FIELDS).filter(([key]) => !key.startsWith("sensor_")).map(([key,label]) => toggle(`show_${key}`,label))),
      panel("sensor","Sensor data",GLUCIFER_SENSOR_FIELDS.map(key => toggle(`show_${key}`,GLUCIFER_FIELDS[key]))),
      panel("journal","Journal",[toggle("show_journal_markers","Show journal points on chart"),toggle("show_journal","Show journal history list"),toggle("journal_compact","Compact journal list"),
        number("journal_days","Journal history days",1,90),number("journal_limit","Maximum entries in the list",1,200),
        field("journal_types","Journal entry types",{select:{multiple:true,options:[{value:"insulin",label:"Insulin"},{value:"carbs",label:"Carbohydrates"},{value:"note",label:"Notes"}]}})]),
      panel("glucose_colors","Glucose value colors",[toggle("color_glucose","Color glucose by range"),
        ...["very_low","low","high","very_high"].map(k=>number(k,`${k.replaceAll("_"," ")} boundary (mg/dL)`,1,1000)),
        ...["very_low","low","normal","high","very_high"].map(k=>color(`glucose_${k}_color`,`${k.replaceAll("_"," ")} glucose`))]),
      panel("trend_colors","Trend arrow colors",[toggle("color_trend","Color the trend arrow"),color("trend_stable_color","Stable →"),
        color("trend_rising_color","Rising ↗ ↑"),color("trend_falling_color","Falling ↘ ↓"),color("trend_fast_color","Rapid change ↑↑ ↓↓")])],
    computeLabel: schema => schema.label,
    computeHelper: schema => {
      if (["very_low","low","high","very_high"].includes(schema.name)) return `Default ${GLUCIFER_DEFAULTS[schema.name]} mg/dL. Boundaries use mg/dL even when the card displays mmol/L.`;
      if (schema.name === "journal_days") return "Default 7 days. Limited by journal history enabled in JugglucoNG; this only changes what this card shows.";
      if (schema.name === "journal_limit") return "Default 25 entries, newest first.";
      if (schema.name === "arrow_size") return "Default 96 px. The arrow scales down on narrow cards to leave room for the glucose value.";
      if (schema.name === "hours") return "Default 24 hours. Glucose history is retained for up to 7 days.";
      if (schema.name?.startsWith("show_") && GLUCIFER_FIELDS[schema.name.slice(5)]) return "Display this field when enabled in JugglucoNG and available in Home Assistant. This does not change what the phone sends.";
      return undefined;
    },
    assertConfig: config => {
      const normalized = gluciferConfig(config);
      // HA uses schema defaults for absent boolean values, including older YAML groups.
      for (const field of form.schema.flatMap(item => item.schema || [item])) {
        if (field.selector?.boolean) field.default = normalized[field.name];
      }
    },
  };
  return form;
}

class GluciferCard extends HTMLElement {
  static getConfigForm() { return gluciferForm(); }
  static getStubConfig(hass) {
    const entity = Object.keys(hass?.states || {}).find(id => hass.entities?.[id]?.platform === "glucifer" && hass.states[id].attributes.device_class === "blood_glucose_concentration")
      || Object.keys(hass?.states || {}).find(id => hass.states[id].attributes.device_class === "blood_glucose_concentration") || "";
    return {...GLUCIFER_DEFAULTS, entity};
  }
  setConfig(config) {
    if (!config.entity) throw new Error("Choose this receiver's glucose entity.");
    this.stopSubscription();
    this.config = gluciferConfig(config);
    this.data = null;
    this.selectedJournalId = null;
    this.chartSignature = null;
    this.historySignature = null;
    this.ageKey = null;
    this.chartElement?.zoom(0, 100);
    this.updated = 0;
    this.render();
    this.ensureSubscription();
    this.refresh(true);
  }
  set hass(hass) {
    this._hass = hass;
    this.ensureSubscription();
    if (this.stateSignature() !== this.renderedStates) this.render();
    this.updateAge();
    if (!this.data) this.refresh();
  }
  stateSignature() {
    const states = this._hass?.states || {};
    const entities = this.data?.entities || {};
    const keys = Object.keys(entities).filter(key =>
      ["connected", "stale"].includes(key) ||
      (key.startsWith("alert_") ? this.config?.show_alerts : this.config?.[`show_${key}`] && key !== "reading_age"));
    return JSON.stringify([this._hass?.locale, this._hass?.config?.time_zone, this._hass?.themes?.darkMode, this._hass?.user?.id,
      states[this.config?.entity]?.state, states[this.config?.entity]?.attributes.unit_of_measurement, ...keys.map(key => [key, states[entities[key]]?.state, states[entities[key]]?.attributes])]);
  }
  connectedCallback() {
    this.ensureSubscription();
    this.ageTimer = setInterval(() => this.updateAge(), 1000);
    this.timer = setInterval(() => { this.ensureSubscription(); this.refresh(); }, 60000);
    this.refresh();
    this.loadChart();
  }
  disconnectedCallback() { clearInterval(this.timer); clearInterval(this.ageTimer); this.stopSubscription(); }
  stopSubscription() {
    this.subscriptionGeneration = (this.subscriptionGeneration || 0) + 1;
    this.subscriptionKey = null;
    this.unsubscribe?.();
    this.unsubscribe = null;
  }
  ensureSubscription() {
    const connection = this._hass?.connection;
    const entity = this.config?.entity;
    if (!this.isConnected || !connection?.subscribeMessage || !entity || this.subscriptionKey === entity) return;
    this.stopSubscription();
    this.subscriptionKey = entity;
    const generation = this.subscriptionGeneration;
    connection.subscribeMessage(event => {
      if (event.reload) { this.stopSubscription(); this.updated = 0; }
      else this.refresh(true);
    }, {type:"glucifer/subscribe",entity_id:entity})
      .then(remove => { if (this.subscriptionGeneration === generation && this.subscriptionKey === entity && this.isConnected) this.unsubscribe = remove; else remove(); })
      .catch(() => { if (this.subscriptionGeneration === generation && this.subscriptionKey === entity) this.subscriptionKey = null; });
  }
  async refresh(force = false) {
    if (force) this.updated = 0;
    if (this.loading) { if (force) this.refreshAgain = true; return; }
    if (!this.isConnected || !this._hass || !this.config || this.loading || Date.now() - this.updated < 15000) return;
    this.loading = true;
    const entity = this.config.entity;
    try {
      const data = await this._hass.callWS({ type: "glucifer/history", entity_id: entity });
      if (this.config.entity === entity) { this.data = data; this.error = null; }
    } catch (_) { this.error = "History is unavailable. Check the integration and selected entity."; }
    finally { this.loading = false; this.updated = Date.now(); this.render(); if (this.refreshAgain) { this.refreshAgain = false; this.refresh(true); } }
  }
  render() {
    if (!this._hass || !this.config) return;
    if (!this.shadowRoot) this.attachShadow({ mode: "open" });
    // All dynamic labels and states are assigned through textContent.
    if (!this.shadowRoot.hasChildNodes()) this.shadowRoot.innerHTML = `<style>
      ha-card {display:block;padding:20px;container-type:inline-size} .title-row {display:flex;align-items:center;gap:12px;margin-bottom:12px} h2 {margin:0;font-size:20px;flex:1;min-width:0} .brand-logo {width:32px;height:32px;object-fit:contain;flex:none} .reading {display:flex;align-items:center;justify-content:space-between;gap:12px}
      .glucose,.trend {font-size:42px;font-weight:600} .trend {white-space:nowrap;flex:none;font-size:min(var(--glucifer-arrow-size,96px),26cqw);line-height:1;margin-left:auto} .glucose {min-width:0;font-size:clamp(28px,7vw,42px)}
      .detail {color:var(--secondary-text-color);margin:8px 0} .warning {color:var(--warning-color)}
      svg {width:100%;height:180px;overflow:visible} path {fill:none;stroke:var(--primary-color);stroke-width:2}
      .axis {display:flex;justify-content:space-between;font-size:12px;color:var(--secondary-text-color)}
      ul {padding-left:20px} button {margin-top:12px;border:0;background:none;color:var(--primary-color);cursor:pointer}
      .journal-marker {stroke:var(--card-background-color,#fff);stroke-width:1.5;cursor:pointer}
      .journal-marker:focus {outline:none;stroke:var(--primary-text-color);stroke-width:3}
      .journal-list {display:grid;gap:6px} .journal-list button {text-align:left;margin:0;padding:8px;border:1px solid var(--divider-color);border-radius:6px}
      .journal-section {margin-top:12px} .journal-section summary {display:flex;align-items:center;gap:8px;cursor:pointer;list-style:none;font-weight:600;padding:8px 0}
      .journal-section summary::-webkit-details-marker {display:none} .journal-section summary::before {content:"▸"} .journal-section[open] summary::before {content:"▾"}
      .journal-summary-count {margin-left:auto;font-size:12px;font-weight:400;color:var(--secondary-text-color)}
      .journal-section.compact .journal-count {display:none} .journal-section.compact .journal-list {gap:0}
      .journal-section.compact .journal-list button {border:0;border-radius:0;padding:4px 0;min-height:28px;font-size:14px;line-height:20px}
      .journal-selection {padding:12px;border:1px solid var(--divider-color);border-radius:8px;white-space:pre-wrap}
      [hidden] {display:none!important}
    </style><ha-card><div class="title-row"><h2></h2><img class="brand-logo" alt="Glucifer" width="32" height="32"></div><div class="reading"><div class="glucose"></div><span class="trend"></span></div><div class="detail summary"><span class="delta"></span><span class="reading-age"></span></div><div class="detail optional-values"></div>
      <div class="warning health"></div><div class="native-chart" hidden></div><svg viewBox="0 0 600 180" role="img" aria-label="Glucose history"><path></path><g class="journal-markers"></g></svg>
      <div class="axis"><span class="start"></span><span class="range"></span><span class="end"></span></div>
      <div class="detail journal-legend" hidden>▲ Insulin · ● Carbohydrates · ■ Note</div><div class="detail history"></div><div class="journal-selection" hidden><div class="selection-label"></div><div class="selection-note"></div><button>Close</button></div><details class="journal-section" hidden><summary>Journal<span class="journal-summary-count"></span></summary><div class="journal-count detail"></div><div class="journal-list"></div></details><ul></ul><div class="detail lifecycle"></div><button>More details</button></ha-card>`;
    const root = this.shadowRoot;
    const text = (selector, value) => { root.querySelector(selector).textContent = value; };
    const states = this._hass.states;
    const entities = this.data?.entities || {};
    const state = key => states[entities[key]];
    const glucose = states[this.config.entity];
    const valid = glucose && !["unknown", "unavailable"].includes(glucose.state);
    const unit = glucose?.attributes.unit_of_measurement || this.data?.unit || "mg/dL";
    const value = valid ? Number(glucose.state) : NaN;
    const glucosePrecision = unit === "mg/dL" ? 0 : 1;
    text("h2", this.config.title || "Glucifer HA");
    const logo = root.querySelector(".brand-logo");
    logo.hidden = !this.config.show_logo;
    if (this.config.show_logo && !logo.hasAttribute("src")) logo.src = "/glucifer/icon.png";
    this.restoreJournalState();
    text(".glucose", Number.isFinite(value) ? `${value.toFixed(glucosePrecision)}${this.config.show_glucose_unit ? ` ${unit}` : ""}` : "Unavailable");
    const trend = state("trend")?.state;
    const trendArrow = new Map([
      ["DoubleUp", "↑↑"], ["SingleUp", "↑"], ["FortyFiveUp", "↗"],
      ["Flat", "→"], ["FortyFiveDown", "↘"], ["SingleDown", "↓"], ["DoubleDown", "↓↓"],
    ]).get(trend);
    text(".trend", Number.isFinite(value) ? trendArrow || "" : "");
    root.querySelector(".glucose").style.color = gluciferGlucoseColor(value, unit, this.config);
    root.querySelector(".trend").style.color = gluciferTrendColor(Number.isFinite(value) ? trend : null, this.config);
    root.querySelector(".trend").hidden = !this.config.show_trend;
    root.querySelector(".trend").style.setProperty("--glucifer-arrow-size", `${this.config.arrow_size}px`);
    root.querySelector(".summary").hidden = !this.config.show_delta_mgdl && !this.config.show_reading_age;
    root.querySelector("ul").hidden = !this.config.show_alerts;
    const delta = state("delta_mgdl");
    text(".delta", this.config.show_delta_mgdl && delta && Number.isFinite(Number(delta.state))
      ? `Δ ${Number(delta.state).toFixed(1)} ${delta.attributes.unit_of_measurement}` : "");
    this.updateAge();
    text(".health", state("connected")?.state === "off" ? "Phone has not contacted Home Assistant recently" : state("stale")?.state === "on" ? "Glucose reading is stale" : "");
    const historySignature = JSON.stringify([this.data?.readings, this.data?.journal, this.data?.journal_enabled, this.data?.journal_history_days,
      this.config, unit, this._hass.locale, this._hass.config?.time_zone, this.error, this._hass.themes?.darkMode, Boolean(customElements.get("ha-chart-base")), Math.floor(Date.now()/60000)]);
    if (historySignature !== this.historySignature) {
      this.historySignature = historySignature;
      root.querySelector(".history").hidden = !this.config.show_history;
      const until = Date.now();
      const since = until - Math.max(1, Math.min(168, Number(this.config.hours) || 24)) * 3600000;
      const points = (this.data?.readings || []).filter(p => p.time_ms >= since && p.time_ms <= until);
      const convert = n => unit === "mmol/L" ? n / 18.016 : n;
      const values = points.map(p => convert(p.mgdl));
      const min = values.length ? Math.min(...values) : 0;
      const max = values.length ? Math.max(...values) : 1;
      let previous = 0;
      const path = points.map(p => {
        const command = p.time_ms - previous > 600000 ? "M" : "L";
        previous = p.time_ms;
        return `${command}${((p.time_ms-since)/(until-since)*600).toFixed(2)},${(170-(convert(p.mgdl)-min)/Math.max(max-min,1)*160).toFixed(2)}`;
      }).join(" ");
      root.querySelector("path").setAttribute("d", path);
      text(".start", this.formatDateTime(since));
      text(".end", this.formatDateTime(until, true));
      text(".range", points.length ? `${min.toFixed(glucosePrecision)} to ${max.toFixed(glucosePrecision)} ${unit}` : "No history");
      this.renderJournal(root, points, since, until, convert, min, max);
      this.renderChart(points, since, until, convert, unit, min);
      text(".history", this.error || `${points.length} readings at their measurement times. Gaps over 10 min remain visible.`);
    }
    root.querySelector("ul").replaceChildren();
    Object.keys(entities).filter(key => key.startsWith("alert_") && state(key)?.state === "on").forEach(key => {
      const li = document.createElement("li"); li.textContent = state(key).attributes.friendly_name; root.querySelector("ul").append(li);
    });
    const available = key => this.config[`show_${key}`] && state(key) && !["unknown", "unavailable", ""].includes(state(key).state);
    const formatted = key => {
      const s = state(key);
      if (key.endsWith("_ms")) return this.formatDateTime(s.state);
      if (key === "sensor_warmup") return s.state === "on" ? "Yes" : "No";
      return `${s.state}${s.attributes.unit_of_measurement ? ` ${s.attributes.unit_of_measurement}` : ""}`;
    };
    for (const [selector, keys] of [[".lifecycle", GLUCIFER_SENSOR_FIELDS], [".optional-values", ["rate_mgdl_min", "raw_mgdl", "auto_mgdl", "iob_u", "cob_g", "battery_percent"]]]) {
      text(selector, keys.filter(available).map(key => `${GLUCIFER_FIELDS[key]}: ${formatted(key)}`).join(" · "));
      root.querySelector(selector).hidden = !root.querySelector(selector).textContent;
    }
    this.renderedStates = this.stateSignature();
    root.querySelector("ha-card > button").onclick = () => this.dispatchEvent(new CustomEvent("hass-more-info", {detail: {entityId: this.config.entity}, bubbles: true, composed: true}));
  }
  renderJournal(root, points, since, until, convert, min, max) {
    const cutoff = until - this.config.journal_days * 86400000;
    const entries = (this.data?.journal || []).filter(e => e.time_ms >= cutoff && e.time_ms <= until && this.config.journal_types.includes(e.kind));
    const number = value => new Intl.NumberFormat(this._hass?.locale?.language, {maximumFractionDigits:2}).format(value);
    const description = entry => `${entry.label || entry.kind}${entry.amount != null ? ` · ${number(entry.amount)} ${entry.kind === "insulin" ? "U" : "g"}` : ""} · ${this.formatDateTime(entry.time_ms)}`;
    this.journalEntries = entries;
    this.journalDescription = description;
    const select = entry => { this.selectedJournalId = entry.id; this.renderSelection(); };
    this.renderSelection();
    root.querySelector(".journal-markers").replaceChildren();
    root.querySelector(".journal-list").replaceChildren();
    if (this.config.show_journal_markers) {
      const group = root.querySelector(".journal-markers");
      for (const entry of entries.filter(e => e.time_ms >= since)) {
        const x = (entry.time_ms - since) / (until - since) * 600;
        // Position at the closest measured glucose only within a 10-minute gap.
        // Entries without nearby glucose use the bottom marker lane.
        let left = 0, right = points.length;
        while (left < right) { const middle = (left+right) >>> 1; if (points[middle].time_ms < entry.time_ms) left = middle+1; else right = middle; }
        const nearest = [points[left-1],points[left]].filter(Boolean).reduce((best,p) => !best || Math.abs(p.time_ms-entry.time_ms)<Math.abs(best.time_ms-entry.time_ms) ? p : best, null);
        const y = nearest && Math.abs(nearest.time_ms-entry.time_ms)<=600000 ? 170-(convert(nearest.mgdl)-min)/Math.max(max-min,1)*160 : 177;
        const marker = document.createElementNS("http://www.w3.org/2000/svg", entry.kind === "insulin" ? "polygon" : entry.kind === "carbs" ? "circle" : "rect");
        if (entry.kind === "insulin") marker.setAttribute("points", `${x},${y-7} ${x-7},${y+6} ${x+7},${y+6}`);
        else if (entry.kind === "carbs") { marker.setAttribute("cx",x); marker.setAttribute("cy",y); marker.setAttribute("r",6); }
        else { marker.setAttribute("x",x-5); marker.setAttribute("y",y-5); marker.setAttribute("width",10); marker.setAttribute("height",10); }
        marker.setAttribute("class","journal-marker"); marker.setAttribute("fill",entry.kind === "insulin" ? "#7e57c2" : entry.kind === "carbs" ? "#fb8c00" : "#00838f");
        marker.setAttribute("role","button"); marker.setAttribute("tabindex","0"); marker.setAttribute("aria-label",description(entry));
        const title = document.createElementNS("http://www.w3.org/2000/svg","title"); title.textContent = description(entry); marker.append(title);
        marker.onclick = () => select(entry); marker.onkeydown = event => { if (["Enter"," "].includes(event.key)) { event.preventDefault(); select(entry); } }; group.append(marker);
      }
    }
    root.querySelector(".journal-legend").hidden = !this.config.show_history || !root.querySelector(".journal-marker");
    const section = root.querySelector(".journal-section"); section.hidden = !this.config.show_journal;
    section.classList.toggle("compact", this.config.journal_compact);
    if (this.config.show_journal) {
      const visible = [...entries].sort((a,b) => b.time_ms-a.time_ms || b.id.localeCompare(a.id)).slice(0,this.config.journal_limit);
      root.querySelector(".journal-summary-count").textContent = `${visible.length} entries`;
      root.querySelector(".journal-count").textContent = this.data?.journal_enabled
        ? `${visible.length} of ${entries.length} entries in ${this.config.journal_days} days. Sender retains up to ${this.data.journal_history_days} days.`
        : "Enable journal sync in JugglucoNG to display entries.";
      for (const entry of visible) { const button = document.createElement("button"); button.textContent = description(entry); button.onclick = () => select(entry); root.querySelector(".journal-list").append(button); }
    }
  }
  restoreJournalState() {
    const section = this.shadowRoot.querySelector(".journal-section");
    const key = `glucifer:journal:${JSON.stringify([this._hass?.user?.id || "", location.pathname, this.config.entity, this.config.title || ""])}`;
    if (key !== this.journalStorageKey) {
      this.journalStorageKey = key;
      try { this.journalOpen = localStorage.getItem(key) !== "closed"; }
      catch (_) { this.journalOpen = true; }
      section.open = this.journalOpen;
    }
    section.ontoggle = () => {
      this.journalOpen = section.open;
      try { localStorage.setItem(this.journalStorageKey, section.open ? "open" : "closed"); }
      catch (_) { /* Still collapsible when browser storage is unavailable. */ }
    };
  }
  async loadChart() {
    if (this.chartLoading || customElements.get("ha-chart-base")) return;
    if (!window.loadCardHelpers) return; // Standalone preview or an older HA frontend.
    this.chartLoading = true;
    let timeout;
    try {
      const helpers = await window.loadCardHelpers();
      // Load HA's history module without attaching a recorder card or requesting recorder data.
      helpers.createCardElement({type:"history-graph", entities:[this.config?.entity || "sensor.glucose"]});
      await Promise.race([customElements.whenDefined("ha-chart-base"), new Promise((_, reject) => { timeout = setTimeout(() => reject(new Error("Chart load timeout")), 15000); })]);
      if (this.isConnected) this.render();
    } catch (_) { /* The existing SVG remains available if the frontend module cannot load. */ }
    finally { clearTimeout(timeout); this.chartLoading = false; }
  }
  renderChart(points, since, until, convert, unit, min) {
    const root = this.shadowRoot, host = root.querySelector(".native-chart");
    const native = Boolean(customElements.get("ha-chart-base"));
    host.hidden = !this.config.show_history || !native;
    root.querySelector("svg").toggleAttribute("hidden", !this.config.show_history || native);
    root.querySelector(".axis").hidden = !this.config.show_history || native;
    if (!native || !this.config.show_history) return;
    if (!this.chartElement) {
      this.chartElement = document.createElement("ha-chart-base");
      this.chartElement.height = "240px";
      this.chartElement.addEventListener("chart-click", event => {
        const id = event.detail?.data?.journalId;
        if (id) { this.selectedJournalId = id; this.renderSelection(); }
      });
      host.append(this.chartElement);
    }
    this.chartElement.hass = this._hass;
    const entries = this.config.show_journal_markers ? this.journalEntries.filter(e => e.time_ms >= since) : [];
    const style = getComputedStyle(this);
    const chipBackground = style.getPropertyValue("--card-background-color").trim() || "#fff";
    const chipText = style.getPropertyValue("--primary-text-color").trim() || "#222";
    const signature = JSON.stringify([points, entries, unit, this.config.hours, this._hass.locale, this._hass.config?.time_zone, chipBackground, chipText]);
    if (signature === this.chartSignature) return;
    this.chartSignature = signature;
    const data = [];
    let previous;
    for (const point of points) {
      if (previous && point.time_ms - previous > 600000) data.push([previous+1, null]);
      data.push([point.time_ms, convert(point.mgdl)]);
      previous = point.time_ms;
    }
    const series = [{id:"glucose", name:"Glucose", type:"line", showSymbol:false, connectNulls:false, sampling:"minmax", data, lineStyle:{width:2}}];
    // Small local line icons keep journal chips readable without external assets.
    const icons = {
      insulin:"M5 19l3-3m-1-3 4 4 8-8-4-4zm6-10 8 8m-4-8 4 4M9 11l2 2m0-4 2 2",
      carbs:"M5 3v6c0 3 4 3 4 0V3M7 3v18M17 3c-4 3-4 9 0 9V3zm0 9v9",
      note:"M3 5h12l6 7-6 7H3zm5 5v4",
    };
    for (const [kind,symbol,color] of [["insulin","triangle","#7e57c2"],["carbs","circle","#fb8c00"],["note","rect","#00838f"]]) {
      const icon = `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path d="${icons[kind]}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`)}`;
      series.push({id:kind, name:kind, type:"line", lineStyle:{opacity:0}, symbol, symbolSize:12, showSymbol:true, showAllSymbol:true, itemStyle:{color}, z:5,
        label:{show:true,position:"top",distance:18,backgroundColor:chipBackground,borderColor:`${color}55`,borderWidth:1,borderRadius:14,padding:[5,8],color:chipText,
          rich:{icon:{width:14,height:14,backgroundColor:{image:icon}},value:{fontSize:12,color:chipText}},
          formatter:params => {
            const entry = entries.find(e => e.id === params.data.journalId);
            const value = entry?.amount != null ? `${new Intl.NumberFormat(this._hass?.locale?.language,{maximumFractionDigits:2}).format(entry.amount)} ${kind === "insulin" ? "U" : "g"}` : (entry?.label || "Note").slice(0,16);
            return `{icon| } {value|${value.replaceAll("{","（").replaceAll("}","）")}}`;
          }},
        labelLine:{show:true,lineStyle:{color,opacity:0.35,width:1}},
        labelLayout:params => ({moveOverlap:"shiftY",hideOverlap:true,
          x:Math.max(45+params.labelRect.width/2,Math.min(this.chartElement.clientWidth-15-params.labelRect.width/2,params.rect.x+params.rect.width/2)),
          align:"center"}),
        data:entries.filter(e => e.kind === kind).map(entry => {
          let left=0,right=points.length;
          while(left<right) { const middle=(left+right)>>>1; if(points[middle].time_ms<entry.time_ms) left=middle+1; else right=middle; }
          const nearest=[points[left-1],points[left]].filter(Boolean).sort((a,b)=>Math.abs(a.time_ms-entry.time_ms)-Math.abs(b.time_ms-entry.time_ms))[0];
          return {value:[entry.time_ms,nearest && Math.abs(nearest.time_ms-entry.time_ms)<=600000 ? convert(nearest.mgdl) : min],journalId:entry.id};
        })});
    }
    this.chartElement.options = {
      animation:false, grid:{left:45,right:15,top:20,bottom:35},
      xAxis:{type:"time",min:since,max:until}, yAxis:{type:"value",scale:true,name:unit},
      tooltip:{trigger:"axis",confine:true,formatter:params => {
        const box = document.createElement("div");
        for (const p of Array.isArray(params) ? params : [params]) {
          const entry = this.journalEntries.find(e => e.id === p.data?.journalId);
          const row = document.createElement("div");
          row.textContent = entry ? this.journalDescription(entry) : `${this.formatDateTime(p.value[0])} · ${Number(p.value[1]).toFixed(unit === "mg/dL" ? 0 : 1)} ${unit}`;
          box.append(row);
        }
        return box;
      }},
    };
    this.chartElement.data = series;
  }
  renderSelection() {
    const root = this.shadowRoot;
    const entry = (this.config.show_journal || (this.config.show_history && this.config.show_journal_markers)) && this.journalEntries?.find(e => e.id === this.selectedJournalId);
    if (!entry) this.selectedJournalId = null;
    root.querySelector(".journal-selection").hidden = !entry;
    root.querySelector(".selection-label").textContent = entry ? this.journalDescription(entry) : "";
    root.querySelector(".selection-note").textContent = entry?.note || "";
    root.querySelector(".journal-selection button").onclick = () => { this.selectedJournalId = null; this.renderSelection(); };
  }
  updateAge() {
    const label = this.shadowRoot?.querySelector(".reading-age");
    if (!label) return;
    const states = this._hass?.states || {}, entities = this.data?.entities || {};
    const measured = Date.parse(states[entities.measurement_time]?.state);
    const ageState = states[entities.reading_age];
    const ageKey = JSON.stringify([ageState?.state, ageState?.last_updated]);
    if (ageKey !== this.ageKey) {
      this.ageKey = ageKey;
      this.ageObservedAt = Date.parse(ageState?.last_updated) || Date.now();
    }
    const seconds = Number.isFinite(measured) ? (Date.now() - measured) / 1000
      : ageState && Number.isFinite(Number(ageState.state)) ? Number(ageState.state) + (Date.now() - this.ageObservedAt) / 1000 : NaN;
    let value = "";
    if (this.config.show_reading_age && Number.isFinite(seconds)) {
      const age = Math.max(0, Math.floor(seconds));
      const duration = age < 60 ? `${age}s` : age < 3600 ? `${Math.floor(age/60)}m ${age%60}s` : `${Math.floor(age/3600)}h ${Math.floor(age%3600/60)}m ${age%60}s`;
      value = `${this.shadowRoot.querySelector(".delta").textContent ? " · " : ""}Reading ${duration} old`;
    }
    if (label.textContent !== value) label.textContent = value;
  }
  formatDateTime(value, timeOnly = false) {
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return "Unavailable";
    const locale = this._hass?.locale || {};
    const timeZone = locale.time_zone === "local" ? undefined : this._hass?.config?.time_zone;
    const timeLocale = locale.time_format === "system" ? undefined : locale.language;
    const hour12 = locale.time_format === "12" ? true : locale.time_format === "24" ? false
      : new Intl.DateTimeFormat(timeLocale, {hour:"numeric"}).resolvedOptions().hour12;
    const time = new Intl.DateTimeFormat(timeLocale, {hour:hour12 ? "numeric" : "2-digit", minute:"2-digit", hourCycle:hour12 ? "h12" : "h23", timeZone}).format(date);
    if (timeOnly) return time;
    const formatter = new Intl.DateTimeFormat(locale.date_format === "system" ? undefined : locale.language, {year:"numeric",month:"numeric",day:"numeric",timeZone});
    const order = {DMY:["day","month","year"],MDY:["month","day","year"],YMD:["year","month","day"]}[locale.date_format];
    const parts = formatter.formatToParts(date);
    const part = type => parts.find(p => p.type === type)?.value || "";
    const lastLiteral = parts.at(-1)?.type === "literal" && !(locale.language === "bg" && locale.date_format === "YMD") ? parts.at(-1).value : "";
    return `${order ? order.map(part).join(part("literal")) + lastLiteral : formatter.format(date)}, ${time}`;
  }
  getCardSize() { return (this.config?.show_history === false ? 2 : 6) + (this.config?.show_journal ? this.journalOpen === false ? 1 : this.config.journal_compact ? 3 : 4 : 0); }
}
if (!customElements.get("glucifer-card")) customElements.define("glucifer-card", GluciferCard);
window.customCards = window.customCards || [];
window.customCards.push({type: "glucifer-card", name: "Glucifer HA", description: "Glucose, freshness, active alerts and timestamped history."});
