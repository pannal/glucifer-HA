// SPDX-License-Identifier: GPL-3.0-or-later
// No remote resources; measurements remain within the authenticated HA connection.
class GluciferCard extends HTMLElement {
  setConfig(config) {
    if (!config.entity) throw new Error("Choose this receiver's glucose entity.");
    this.config = { hours: 24, ...config };
    this.data = null;
    this.updated = 0;
    this.render();
  }
  set hass(hass) {
    this._hass = hass;
    this.render();
    this.refresh();
  }
  connectedCallback() {
    this.timer = setInterval(() => this.refresh(), 60000);
    this.refresh();
  }
  disconnectedCallback() { clearInterval(this.timer); }
  async refresh() {
    if (!this.isConnected || !this._hass || !this.config || this.loading || Date.now() - this.updated < 15000) return;
    this.loading = true;
    const entity = this.config.entity;
    try {
      const data = await this._hass.callWS({ type: "glucifer/history", entity_id: entity });
      if (this.config.entity === entity) { this.data = data; this.error = null; }
    } catch (_) { this.error = "History is unavailable. Check the integration and selected entity."; }
    finally { this.loading = false; this.updated = Date.now(); this.render(); }
  }
  render() {
    if (!this._hass || !this.config) return;
    if (!this.shadowRoot) this.attachShadow({ mode: "open" });
    // All dynamic labels and states are assigned through textContent.
    this.shadowRoot.innerHTML = `<style>
      ha-card {padding:20px} h2 {margin:0 0 12px;font-size:20px} .reading {display:flex;align-items:baseline;gap:12px;flex-wrap:wrap}
      .glucose,.trend {font-size:42px;font-weight:600} .trend {white-space:nowrap}
      .detail {color:var(--secondary-text-color);margin:8px 0} .warning {color:var(--warning-color)}
      svg {width:100%;height:180px;overflow:visible} path {fill:none;stroke:var(--primary-color);stroke-width:2}
      .axis {display:flex;justify-content:space-between;font-size:12px;color:var(--secondary-text-color)}
      ul {padding-left:20px} button {margin-top:12px;border:0;background:none;color:var(--primary-color);cursor:pointer}
    </style><ha-card><h2></h2><div class="reading"><div class="glucose"></div><span class="trend"></span></div><div class="detail summary"></div>
      <div class="warning health"></div><svg viewBox="0 0 600 180" role="img" aria-label="Glucose history"><path></path></svg>
      <div class="axis"><span class="start"></span><span class="range"></span><span class="end"></span></div>
      <div class="detail history"></div><ul></ul><div class="detail lifecycle"></div><button>More details</button></ha-card>`;
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
    text(".history", this.error || `${points.length} readings at their measurement times. Gaps over 10 min remain visible.`);
    Object.keys(entities).filter(key => key.startsWith("alert_") && state(key)?.state === "on").forEach(key => {
      const li = document.createElement("li"); li.textContent = state(key).attributes.friendly_name; root.querySelector("ul").append(li);
    });
    const lifecycle = ["sensor_started_ms", "sensor_expires_ms", "sensor_warmup"].map(key => state(key)).filter(s => s && !["unknown", "unavailable"].includes(s.state));
    text(".lifecycle", lifecycle.map(s => `${s.attributes.friendly_name}: ${s.state}`).join(" · "));
    root.querySelector("button").onclick = () => this.dispatchEvent(new CustomEvent("hass-more-info", {detail: {entityId: this.config.entity}, bubbles: true, composed: true}));
  }
  getCardSize() { return 6; }
}
if (!customElements.get("glucifer-card")) customElements.define("glucifer-card", GluciferCard);
window.customCards = window.customCards || [];
window.customCards.push({type: "glucifer-card", name: "Glucifer HA", description: "Glucose, freshness, active alerts and timestamped history."});
