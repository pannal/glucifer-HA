// SPDX-License-Identifier: GPL-3.0-or-later
// No remote resources; measurements remain within the authenticated HA connection.
const GLUCIFER_DEFAULTS = {
  hours: 24, show_history: true, show_details: true, show_alerts: true, show_lifecycle: true,
  show_journal: false, show_journal_markers: true, journal_days: 7, journal_limit: 25,
  journal_types: ["insulin", "carbs", "note"], color_glucose: true, color_trend: true,
  very_low: 54, low: 70, high: 180, very_high: 250,
  glucose_very_low_color: [183,28,28], glucose_low_color: [229,57,53],
  glucose_normal_color: [67,160,71], glucose_high_color: [251,140,0], glucose_very_high_color: [229,57,53],
  trend_stable_color: [67,160,71], trend_rising_color: [251,140,0],
  trend_falling_color: [251,140,0], trend_fast_color: [229,57,53],
};
function gluciferConfig(config) {
  const result = {...GLUCIFER_DEFAULTS, ...config};
  for (const [key,min,max] of [["hours",1,168],["journal_days",1,90],["journal_limit",1,200],
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
  const toggle = (name,label) => field(name,label,{boolean:{}});
  const number = (name,label,min,max) => field(name,label,{number:{min,max,step:1,mode:"box"}});
  const color = (name,label) => field(name,label,{color_rgb:{}});
  const panel = (name,title,schema) => ({name,type:"expandable",title,flatten:true,schema});
  return {
    schema: [field("entity","Glucose entity",{entity:{filter:{domain:"sensor",device_class:"blood_glucose_concentration"}}}),
      field("title","Title",{text:{}}), number("hours","Chart hours",1,168),
      panel("display","Display",[toggle("show_history","Show glucose chart"),toggle("show_details","Show delta and reading age"),toggle("show_alerts","Show active alerts"),toggle("show_lifecycle","Show sensor details")]),
      panel("journal","Journal",[toggle("show_journal_markers","Show journal points on chart"),toggle("show_journal","Show journal history list"),
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
      if (schema.name === "hours") return "Default 24 hours. Glucose history is retained for up to 7 days.";
      return undefined;
    },
    assertConfig: config => { gluciferConfig(config); },
  };
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
    this.updated = 0;
    this.render();
    this.ensureSubscription();
    this.refresh(true);
  }
  set hass(hass) {
    this._hass = hass;
    this.ensureSubscription();
    this.render();
    this.refresh();
  }
  connectedCallback() {
    this.ensureSubscription();
    this.timer = setInterval(() => { this.ensureSubscription(); this.refresh(); }, 60000);
    this.refresh();
  }
  disconnectedCallback() { clearInterval(this.timer); this.stopSubscription(); }
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
    this.shadowRoot.innerHTML = `<style>
      ha-card {display:block;padding:20px} h2 {margin:0 0 12px;font-size:20px} .reading {display:flex;align-items:baseline;gap:12px;flex-wrap:wrap}
      .glucose,.trend {font-size:42px;font-weight:600} .trend {white-space:nowrap}
      .detail {color:var(--secondary-text-color);margin:8px 0} .warning {color:var(--warning-color)}
      svg {width:100%;height:180px;overflow:visible} path {fill:none;stroke:var(--primary-color);stroke-width:2}
      .axis {display:flex;justify-content:space-between;font-size:12px;color:var(--secondary-text-color)}
      ul {padding-left:20px} button {margin-top:12px;border:0;background:none;color:var(--primary-color);cursor:pointer}
      .journal-marker {stroke:var(--card-background-color,#fff);stroke-width:1.5;cursor:pointer}
      .journal-marker:focus {outline:none;stroke:var(--primary-text-color);stroke-width:3}
      .journal-list {display:grid;gap:6px} .journal-list button {text-align:left;margin:0;padding:8px;border:1px solid var(--divider-color);border-radius:6px}
      .journal-selection {padding:12px;border:1px solid var(--divider-color);border-radius:8px;white-space:pre-wrap}
      [hidden] {display:none!important}
    </style><ha-card><h2></h2><div class="reading"><div class="glucose"></div><span class="trend"></span></div><div class="detail summary"></div>
      <div class="warning health"></div><svg viewBox="0 0 600 180" role="img" aria-label="Glucose history"><path></path><g class="journal-markers"></g></svg>
      <div class="axis"><span class="start"></span><span class="range"></span><span class="end"></span></div>
      <div class="detail journal-legend" hidden>▲ Insulin · ● Carbohydrates · ■ Note</div><div class="detail history"></div><div class="journal-selection" hidden></div><section class="journal-section" hidden><h3>Journal</h3><div class="journal-count detail"></div><div class="journal-list"></div></section><ul></ul><div class="detail lifecycle"></div><button>More details</button></ha-card>`;
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
    text(".glucose", Number.isFinite(value) ? `${value.toFixed(glucosePrecision)} ${unit}` : "Unavailable");
    const age = state("reading_age")?.state;
    const trend = state("trend")?.state;
    const trendArrow = new Map([
      ["DoubleUp", "↑↑"], ["SingleUp", "↑"], ["FortyFiveUp", "↗"],
      ["Flat", "→"], ["FortyFiveDown", "↘"], ["SingleDown", "↓"], ["DoubleDown", "↓↓"],
    ]).get(trend);
    text(".trend", Number.isFinite(value) ? trendArrow || "" : "");
    root.querySelector(".glucose").style.color = gluciferGlucoseColor(value, unit, this.config);
    root.querySelector(".trend").style.color = gluciferTrendColor(Number.isFinite(value) ? trend : null, this.config);
    root.querySelector(".summary").hidden = !this.config.show_details;
    for (const selector of ["svg", ".axis", ".history"]) root.querySelector(selector).toggleAttribute("hidden", !this.config.show_history);
    root.querySelector("ul").hidden = !this.config.show_alerts;
    root.querySelector(".lifecycle").hidden = !this.config.show_lifecycle;
    const delta = state("delta_mgdl");
    text(".summary", [
      delta && Number.isFinite(Number(delta.state)) ? `Δ ${Number(delta.state).toFixed(1)} ${delta.attributes.unit_of_measurement}` : null,
      age && Number.isFinite(Number(age)) ? `Reading ${Math.floor(Number(age) / 60)} min old` : null].filter(Boolean).join(" · "));
    text(".health", state("connected")?.state === "off" ? "Phone has not contacted Home Assistant recently" : state("stale")?.state === "on" ? "Glucose reading is stale" : "");
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
    text(".start", new Date(since).toLocaleString());
    text(".end", new Date(until).toLocaleTimeString());
    text(".range", points.length ? `${min.toFixed(glucosePrecision)} to ${max.toFixed(glucosePrecision)} ${unit}` : "No history");
    this.renderJournal(root, points, since, until, convert, min, max);
    text(".history", this.error || `${points.length} readings at their measurement times. Gaps over 10 min remain visible.`);
    Object.keys(entities).filter(key => key.startsWith("alert_") && state(key)?.state === "on").forEach(key => {
      const li = document.createElement("li"); li.textContent = state(key).attributes.friendly_name; root.querySelector("ul").append(li);
    });
    const lifecycle = ["sensor_started_ms", "sensor_expires_ms", "sensor_warmup"].map(key => state(key)).filter(s => s && !["unknown", "unavailable"].includes(s.state));
    text(".lifecycle", lifecycle.map(s => `${s.attributes.friendly_name}: ${s.state}`).join(" · "));
    root.querySelector("ha-card > button").onclick = () => this.dispatchEvent(new CustomEvent("hass-more-info", {detail: {entityId: this.config.entity}, bubbles: true, composed: true}));
  }
  renderJournal(root, points, since, until, convert, min, max) {
    const cutoff = until - this.config.journal_days * 86400000;
    const entries = (this.data?.journal || []).filter(e => e.time_ms >= cutoff && e.time_ms <= until && this.config.journal_types.includes(e.kind));
    const number = value => new Intl.NumberFormat(this._hass?.locale?.language, {maximumFractionDigits:2}).format(value);
    const description = entry => `${entry.label || entry.kind}${entry.amount != null ? ` · ${number(entry.amount)} ${entry.kind === "insulin" ? "U" : "g"}` : ""} · ${new Date(entry.time_ms).toLocaleString()}`;
    const select = entry => {
      const details = root.querySelector(".journal-selection");
      details.replaceChildren(); details.hidden = false;
      const label = document.createElement("div"); label.textContent = description(entry); details.append(label);
      if (entry.note) { const note = document.createElement("div"); note.textContent = entry.note; details.append(note); }
      const close = document.createElement("button"); close.textContent = "Close"; close.onclick = () => { details.hidden = true; }; details.append(close);
    };
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
    if (this.config.show_journal) {
      const visible = [...entries].sort((a,b) => b.time_ms-a.time_ms || b.id.localeCompare(a.id)).slice(0,this.config.journal_limit);
      root.querySelector(".journal-count").textContent = this.data?.journal_enabled
        ? `${visible.length} of ${entries.length} entries in ${this.config.journal_days} days. Sender retains up to ${this.data.journal_history_days} days.`
        : "Enable journal sync in JugglucoNG to display entries.";
      for (const entry of visible) { const button = document.createElement("button"); button.textContent = description(entry); button.onclick = () => select(entry); root.querySelector(".journal-list").append(button); }
    }
  }
  getCardSize() { return (this.config?.show_history === false ? 2 : 6) + (this.config?.show_journal ? 4 : 0); }
}
if (!customElements.get("glucifer-card")) customElements.define("glucifer-card", GluciferCard);
window.customCards = window.customCards || [];
window.customCards.push({type: "glucifer-card", name: "Glucifer HA", description: "Glucose, freshness, active alerts and timestamped history."});
