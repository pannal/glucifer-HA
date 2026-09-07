// SPDX-License-Identifier: GPL-3.0-or-later
// No remote resources; measurements remain within the authenticated HA connection.
// Wire names match JugglucoNG's optional fields. These switches affect display only.
const GLUCIFER_FIELDS = {
  trend: "Trend", delta_mgdl: "Glucose delta (5 min)", rate_mgdl_min: "Rate of change",
  raw_mgdl: "Raw glucose", auto_mgdl: "Automatically calibrated glucose",
  iob_u: "Insulin on board", eiob_u: "Active insulin (eIOB)", cob_g: "Carbs on board", battery_percent: "Phone battery level",
  sensor_id: "Sensor identifier", sensor_generation: "Sensor generation",
  sensor_started_ms: "Started", sensor_expires_ms: "Expected end", sensor_warmup: "Sensor warming up",
};
// Card translations are bundled locally. Unknown languages fall back to English.
const GLUCIFER_HISTORY_CACHE = new WeakMap();
const GLUCIFER_HISTORY_CACHE_MS = 300000;
const GLUCIFER_DE = {
  "Show prediction curves": "Prognosekurven anzeigen",
  "Prediction (raw)": "Prognose (Rohwerte)",
  "Prediction (auto)": "Prognose (Auto)",
  "Prediction (calibrated)": "Prognose (kalibriert)",
  "Use Home Assistant": "Home Assistant verwenden",
  "Glucose": "Glukose",
  "Glucose history": "Glukoseverlauf",
  "Trend": "Trend",
  "Glucose delta (5 min)": "Glukoseänderung (5 Min.)",
  "Rate of change": "Änderungsrate",
  "Raw glucose": "Rohwert",
  "Automatically calibrated glucose": "Automatisch kalibrierte Glukose",
  "Insulin on board": "Aktives Insulin",
  "Active insulin (eIOB)": "Effektives Insulin (eIOB)",
  "Carbs on board": "Aktive Kohlenhydrate",
  "Phone battery level": "Telefonakku",
  "Sensor identifier": "Sensorkennung",
  "Sensor generation": "Sensorgeneration",
  "Started": "Gestartet",
  "Expected end": "Erwartetes Ende",
  "Sensor warming up": "Sensor in Aufwärmphase",
  "Loading history…": "Verlauf wird geladen…",
  "Unavailable": "Nicht verfügbar",
  "Yes": "Ja",
  "No": "Nein",
  "U": "E",
  "Insulin": "Insulin",
  "Carbohydrates": "Kohlenhydrate",
  "Note": "Notiz",
  "Notes": "Notizen",
  "Journal": "Tagebuch",
  "Close": "Schließen",
  "More details": "Weitere Details",
  "to": "bis",
  "No history": "Kein Verlauf",
  "Phone has not contacted Home Assistant recently": "Das Telefon hat sich seit Längerem nicht bei Home Assistant gemeldet",
  "Glucose reading is stale": "Der Glukosewert ist veraltet",
  "History is unavailable. Check the integration and selected entity.": "Der Verlauf ist nicht verfügbar. Prüfe die Integration und die gewählte Entität.",
  "Reading {duration} old": "Messwert {duration} alt",
  "{count} readings at their measurement times. Gaps over 10 min remain visible.": "{count} Messwerte mit ihrem Messzeitpunkt. Lücken über 10 Min. bleiben sichtbar.",
  "{count} entry": "{count} Eintrag",
  "{count} entries": "{count} Einträge",
  "{visible} of {total} entries in {days} days. Sender retains up to {retained} days.": "{visible} von {total} Einträgen in {days} Tagen. Das Telefon speichert bis zu {retained} Tage.",
  "Enable journal sync in JugglucoNG to display entries.": "Aktiviere die Tagebuchsynchronisierung in JugglucoNG, um Einträge anzuzeigen.",
  "Glucose entity": "Glukose-Entität",
  "Title": "Titel",
  "Locale": "Sprache und Region",
  "Chart hours": "Diagrammzeitraum (Stunden)",
  "Display": "Darstellung",
  "Glucose font size (px)": "Glukose-Schriftgröße (px)",
  "Glucose font weight": "Glukose-Schriftstärke",
  "Light": "Leicht",
  "Normal": "Normal",
  "Medium": "Mittel",
  "Semibold": "Halbfett",
  "Bold": "Fett",
  "Black": "Sehr fett",
  "Glucose font style": "Glukose-Schriftstil",
  "Italic": "Kursiv",
  "Glucose font family": "Glukose-Schriftart",
  "Arrow length (px)": "Pfeillänge (px)",
  "Arrow stroke width (px)": "Pfeilstrichstärke (px)",
  "Glucose alignment": "Glukose-Ausrichtung",
  "Left": "Links",
  "Center": "Zentriert",
  "Arrow size (px)": "Pfeilgröße (px)",
  "Arrow position": "Pfeilposition",
  "Beside glucose": "Neben dem Glukosewert",
  "Lower, beside delta and IOB": "Darunter, neben Glukoseänderung und IOB",
  "Show logo": "Logo anzeigen",
  "Glucose chart": "Glukosediagramm",
  "Show glucose unit": "Glukoseeinheit anzeigen",
  "Reading age": "Alter des Messwerts",
  "Active alerts": "Aktive Alarme",
  "Glucose and phone data": "Glukose- und Telefondaten",
  "Sensor data": "Sensordaten",
  "Show journal pills on chart": "Tagebucheinträge im Diagramm anzeigen",
  "Show chart marker symbols and legend": "Markierungssymbole und Legende anzeigen",
  "Show journal history list": "Tagebuchliste anzeigen",
  "Compact journal list": "Kompakte Tagebuchliste",
  "Journal history days": "Tagebuchzeitraum (Tage)",
  "Maximum entries in the list": "Maximale Anzahl an Listeneinträgen",
  "Journal entry types": "Arten von Tagebucheinträgen",
  "Glucose value colors": "Farben des Glukosewerts",
  "Color glucose by range": "Glukosewert nach Bereich einfärben",
  "very low boundary (mg/dL)": "Grenze für sehr niedrige Werte (mg/dL)",
  "low boundary (mg/dL)": "Grenze für niedrige Werte (mg/dL)",
  "high boundary (mg/dL)": "Grenze für hohe Werte (mg/dL)",
  "very high boundary (mg/dL)": "Grenze für sehr hohe Werte (mg/dL)",
  "very low glucose": "Sehr niedrige Glukose",
  "low glucose": "Niedrige Glukose",
  "normal glucose": "Glukose im Zielbereich",
  "high glucose": "Hohe Glukose",
  "very high glucose": "Sehr hohe Glukose",
  "Trend arrow colors": "Farben des Trendpfeils",
  "Color the trend arrow": "Trendpfeil einfärben",
  "Stable →": "Stabil →",
  "Rising ↗ ↑": "Steigend ↗ ↑",
  "Falling ↘ ↓": "Fallend ↘ ↓",
  "Rapid change ↑↑ ↓↓": "Schnelle Änderung ↑↑ ↓↓",
  "Default {value} mg/dL. Boundaries use mg/dL even when the card displays mmol/L.": "Standard: {value} mg/dL. Grenzwerte werden auch bei einer Anzeige in mmol/L in mg/dL angegeben.",
  "Default 7 days. Limited by journal history enabled in JugglucoNG; this only changes what this card shows.": "Standard: 7 Tage. Begrenzt durch den in JugglucoNG aktivierten Tagebuchzeitraum; ändert nur die Anzeige dieser Karte.",
  "Default 25 entries, newest first.": "Standard: 25 Einträge, neueste zuerst.",
  "Leave empty to follow Home Assistant. Formats numbers and dates; card and editor labels support English and German. Glucose units and time zone stay unchanged.": "Leer lassen, um Home Assistant zu folgen. Formatiert Zahlen und Datumsangaben; Karte und Editor unterstützen Deutsch und Englisch. Glukoseeinheit und Zeitzone bleiben unverändert.",
  "Leave empty for the dashboard font. Use a locally available font, for example Arial, Georgia or monospace. No fonts are downloaded.": "Leer lassen, um die Dashboard-Schriftart zu verwenden. Nutze eine lokal verfügbare Schriftart, etwa Arial, Georgia oder monospace. Es werden keine Schriften heruntergeladen.",
  "Leave empty to follow arrow size. Changes the length along the arrow's direction.": "Leer lassen, um der Pfeilgröße zu folgen. Ändert die Länge in Pfeilrichtung.",
  "Leave empty to scale thickness with arrow size. Set a width to control the stroke separately.": "Leer lassen, um die Strichstärke mit der Pfeilgröße zu skalieren. Ein Wert steuert die Strichstärke separat.",
  "Default 42 px. Large values scale down to fit narrow cards.": "Standard: 42 px. Große Werte werden an schmale Karten angepasst.",
  "Show Active insulin (eIOB) beside IOB. Enable this field in JugglucoNG too.": "Zeigt effektives Insulin (eIOB) neben IOB an. Aktiviere dieses Feld auch in JugglucoNG.",
  "Keep the arrow on the right, beside the glucose value or lower beside the delta and IOB lines.": "Zeigt den Pfeil rechts neben dem Glukosewert oder darunter neben der Glukoseänderung und IOB an.",
  "Default 84 px. The arrow scales down on narrow cards to leave room for the glucose value.": "Standard: 84 px. Auf schmalen Karten wird der Pfeil verkleinert, damit der Glukosewert Platz hat.",
  "Default 24 hours. Glucose history is retained for up to 7 days.": "Standard: 24 Stunden. Der Glukoseverlauf wird bis zu 7 Tage gespeichert.",
  "Display this field when enabled in JugglucoNG and available in Home Assistant. This does not change what the phone sends.": "Zeigt dieses Feld an, wenn es in JugglucoNG aktiviert und in Home Assistant verfügbar ist. Ändert nicht, was das Telefon sendet."
};
function gluciferText(language, text, values = {}) {
  const translated = String(language || "en").toLowerCase().split("-")[0] === "de" ? GLUCIFER_DE[text] ?? text : text;
  return translated?.replace(/\{(\w+)\}/g, (match, key) => values[key] ?? match);
}
const GLUCIFER_SENSOR_FIELDS = Object.keys(GLUCIFER_FIELDS).filter(key => key.startsWith("sensor_"));
const GLUCIFER_DEFAULTS = {
  ...Object.fromEntries(Object.keys(GLUCIFER_FIELDS).map(key => [`show_${key}`, true])),
  show_reading_age: true, show_glucose_unit: true, show_logo: true, arrow_size: 84, arrow_length: null, arrow_width: null, arrow_position: "glucose", glucose_size: 42, glucose_weight: 600, glucose_style: "normal", glucose_font: "", locale: "", glucose_alignment: "left", show_eiob_u: false,
  hours: 24, show_history: true, show_details: true, show_alerts: true, show_lifecycle: true,
  show_predictions: false, show_journal: false, journal_compact: true, show_journal_markers: true, show_journal_symbols: false, journal_days: 7, journal_limit: 25,
  journal_types: ["insulin", "carbs", "note"], color_glucose: true, color_trend: true,
  very_low: 54, low: 70, high: 180, very_high: 250,
  glucose_very_low_color: [183,28,28], glucose_low_color: [229,57,53],
  glucose_normal_color: [67,160,71], glucose_high_color: [251,140,0], glucose_very_high_color: [229,57,53],
  trend_stable_color: [67,160,71], trend_rising_color: [251,140,0],
  trend_falling_color: [251,140,0], trend_fast_color: [229,57,53],
};
function gluciferConfig(config) {
  const result = {...GLUCIFER_DEFAULTS, ...config};
  for (const [key,min,max] of [["glucose_weight",100,900],["hours",1,168],["arrow_size",24,160],["glucose_size",24,96],["journal_days",1,90],["journal_limit",1,200],
    ["very_low",1,1000],["low",1,1000],["high",1,1000],["very_high",1,1000]]) {
    const value = config[key] == null || config[key] === "" ? GLUCIFER_DEFAULTS[key] : Number(config[key]);
    if (!Number.isFinite(value) || value < min || value > max) throw new Error(`${key.replaceAll("_", " ")} must be between ${min} and ${max}.`);
    result[key] = value;
  }
  for (const [key,min,max] of [["arrow_length",24,240],["arrow_width",1,16]]) {
    result[key] = config[key] == null || config[key] === "" ? null : Number(config[key]);
    if (result[key] !== null && (!Number.isFinite(result[key]) || result[key] < min || result[key] > max))
      throw new Error(`${key.replaceAll("_", " ")} must be between ${min} and ${max}.`);
  }
  if (!["normal", "italic"].includes(result.glucose_style)) throw new Error("Choose normal or italic glucose text.");
  for (const key of ["glucose_font", "locale"]) result[key] = String(result[key] || "").trim();
  if (result.glucose_font && !CSS.supports("font-family", result.glucose_font)) throw new Error("Enter a font family available in your browser.");
  if (["auto", "Home Assistant"].includes(result.locale)) result.locale = "";
  if (result.locale) {
    try {
      result.locale = Intl.getCanonicalLocales(result.locale)[0];
      if (!Intl.NumberFormat.supportedLocalesOf(result.locale).length) throw new Error();
    } catch { throw new Error("Enter a supported locale such as en-GB, de-DE or fr-FR, or leave it empty for Home Assistant preferences."); }
  }
  if (!["glucose", "details"].includes(result.arrow_position)) throw new Error("Choose an arrow position beside glucose or details.");
  if (!["left", "center"].includes(result.glucose_alignment)) throw new Error("Choose left or center glucose alignment.");
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
function gluciferForm(language = "en") {
  const t = (text, values) => gluciferText(language, text, values);
  const field = (name, label, selector) => ({name, label:t(label), selector:selector.select
    ? {select:{...selector.select,options:selector.select.options.map(option => ({...option,label:t(option.label)}))}} : selector});
  const toggle = (name,label) => ({...field(name,label,{boolean:{}}),default:GLUCIFER_DEFAULTS[name]});
  const number = (name,label,min,max) => field(name,label,{number:{min,max,step:1,mode:"slider"}});
  const color = (name,label) => field(name,label,{color_rgb:{}});
  const panel = (name,title,schema) => ({name,type:"expandable",title:t(title),flatten:true,schema});
  const form = {
    schema: [field("entity","Glucose entity",{entity:{filter:{domain:"sensor",device_class:"blood_glucose_concentration"}}}),
      field("title","Title",{text:{}}), field("locale","Locale",{select:{mode:"dropdown",custom_value:true,options:[{value:"Home Assistant",label:"Use Home Assistant"},{value:"de-DE",label:"Deutsch (Deutschland)"},{value:"de-AT",label:"Deutsch (Österreich)"},{value:"de-CH",label:"Deutsch (Schweiz)"},{value:"en-GB",label:"English (United Kingdom)"},{value:"en-US",label:"English (United States)"}]}}), number("hours","Chart hours",1,168),
      panel("display","Display",[{...number("glucose_size","Glucose font size (px)",24,96),default:42},
        field("glucose_weight","Glucose font weight",{select:{options:[{value:"300",label:"Light"},{value:"400",label:"Normal"},{value:"500",label:"Medium"},{value:"600",label:"Semibold"},{value:"700",label:"Bold"},{value:"900",label:"Black"}]}}),
        field("glucose_style","Glucose font style",{select:{options:[{value:"normal",label:"Normal"},{value:"italic",label:"Italic"}]}}),
        field("glucose_font","Glucose font family",{text:{}}),
        number("arrow_length","Arrow length (px)",24,240), number("arrow_width","Arrow stroke width (px)",1,16),
        {...field("glucose_alignment","Glucose alignment",{select:{options:[{value:"left",label:"Left"},{value:"center",label:"Center"}]}}),default:"left"},{...number("arrow_size","Arrow size (px)",24,160),default:84},
        {...field("arrow_position","Arrow position",{select:{options:[{value:"glucose",label:"Beside glucose"},{value:"details",label:"Lower, beside delta and IOB"}]}}),default:"glucose"},toggle("show_logo","Show logo"),toggle("show_history","Glucose chart"),toggle("show_predictions","Show prediction curves"),toggle("show_glucose_unit","Show glucose unit"),toggle("show_reading_age","Reading age"),toggle("show_alerts","Active alerts")]),
      panel("values","Glucose and phone data",Object.entries(GLUCIFER_FIELDS).filter(([key]) => !key.startsWith("sensor_")).map(([key,label]) => toggle(`show_${key}`,label))),
      panel("sensor","Sensor data",GLUCIFER_SENSOR_FIELDS.map(key => toggle(`show_${key}`,GLUCIFER_FIELDS[key]))),
      panel("journal","Journal",[toggle("show_journal_markers","Show journal pills on chart"),toggle("show_journal_symbols","Show chart marker symbols and legend"),toggle("show_journal","Show journal history list"),toggle("journal_compact","Compact journal list"),
        number("journal_days","Journal history days",1,90),number("journal_limit","Maximum entries in the list",1,200),
        field("journal_types","Journal entry types",{select:{multiple:true,options:[{value:"insulin",label:"Insulin"},{value:"carbs",label:"Carbohydrates"},{value:"note",label:"Notes"}]}})]),
      panel("glucose_colors","Glucose value colors",[toggle("color_glucose","Color glucose by range"),
        ...["very_low","low","high","very_high"].map(k=>number(k,`${k.replaceAll("_"," ")} boundary (mg/dL)`,1,1000)),
        ...["very_low","low","normal","high","very_high"].map(k=>color(`glucose_${k}_color`,`${k.replaceAll("_"," ")} glucose`))]),
      panel("trend_colors","Trend arrow colors",[toggle("color_trend","Color the trend arrow"),color("trend_stable_color","Stable →"),
        color("trend_rising_color","Rising ↗ ↑"),color("trend_falling_color","Falling ↘ ↓"),color("trend_fast_color","Rapid change ↑↑ ↓↓")])],
    computeLabel: schema => schema.label,
    computeHelper: schema => {
      if (["very_low","low","high","very_high"].includes(schema.name)) return t("Default {value} mg/dL. Boundaries use mg/dL even when the card displays mmol/L.", {value:GLUCIFER_DEFAULTS[schema.name]});
      if (schema.name === "journal_days") return "Default 7 days. Limited by journal history enabled in JugglucoNG; this only changes what this card shows.";
      if (schema.name === "journal_limit") return "Default 25 entries, newest first.";
      if (schema.name === "locale") return "Leave empty to follow Home Assistant. Formats numbers and dates; card and editor labels support English and German. Glucose units and time zone stay unchanged.";
      if (schema.name === "glucose_font") return "Leave empty for the dashboard font. Use a locally available font, for example Arial, Georgia or monospace. No fonts are downloaded.";
      if (schema.name === "arrow_length") return "Leave empty to follow arrow size. Changes the length along the arrow's direction.";
      if (schema.name === "arrow_width") return "Leave empty to scale thickness with arrow size. Set a width to control the stroke separately.";
      if (schema.name === "glucose_size") return "Default 42 px. Large values scale down to fit narrow cards.";
      if (schema.name === "show_eiob_u") return "Show Active insulin (eIOB) beside IOB. Enable this field in JugglucoNG too.";
      if (schema.name === "arrow_position") return "Keep the arrow on the right, beside the glucose value or lower beside the delta and IOB lines.";
      if (schema.name === "arrow_size") return "Default 84 px. The arrow scales down on narrow cards to leave room for the glucose value.";
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
  const helper = form.computeHelper;
  form.computeHelper = schema => t(helper(schema));
  return form;
}

class GluciferCard extends HTMLElement {
  static getConfigForm() { return gluciferForm(); }
  static async getConfigElement() {
    if (!customElements.get("ha-form")) {
      const helpers = await window.loadCardHelpers();
      const card = helpers.createCardElement({type:"entities", entities:[]});
      await card.constructor.getConfigElement();
    }
    return document.createElement("glucifer-card-editor");
  }
  static getStubConfig(hass) {
    const entity = Object.keys(hass?.states || {}).find(id => hass.entities?.[id]?.platform === "glucifer" && hass.states[id].attributes.device_class === "blood_glucose_concentration")
      || Object.keys(hass?.states || {}).find(id => hass.states[id].attributes.device_class === "blood_glucose_concentration") || "";
    return {...GLUCIFER_DEFAULTS, entity};
  }
  setConfig(config) {
    if (!config.entity) throw new Error("Choose this receiver's glucose entity.");
    const normalized = gluciferConfig(config);
    const entityChanged = this.config?.entity !== normalized.entity;
    this.config = normalized;
    if (entityChanged) {
      this.stopSubscription();
      this.data = null;
      this.error = null;
      this.selectedJournalId = null;
      this.chartSignature = null;
      this.historySignature = null;
      this.ageKey = null;
      this.chartElement?.zoom(0, 100);
      this.updated = 0;
    }
    const restored = entityChanged && this.restoreCachedHistory();
    this.render();
    this.ensureSubscription();
    if (entityChanged) this.refresh(!restored);
  }
  set hass(hass) {
    this._hass = hass;
    if (!this.data) this.restoreCachedHistory();
    this.scheduleThemeUpdate();
    this.ensureSubscription();
    if (this.stateSignature() !== this.renderedStates) this.render();
    this.updateAge();
    if (!this.data || this.historyCache()?.request) this.refresh();
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
    // HA applies dashboard themes on ancestors, including across shadow roots.
    this.themeObserver = new MutationObserver(() => this.scheduleThemeUpdate());
    for (let node = this; node; node = node.parentElement || node.getRootNode()?.host) {
      this.themeObserver.observe(node, {attributes:true, attributeFilter:["style", "class"]});
    }
    this.layoutObserver = new ResizeObserver(() => this.fitReading());
    this.layoutObserver.observe(this);
    this.scheduleThemeUpdate();
    this.ensureSubscription();
    this.ageTimer = setInterval(() => this.updateAge(), 1000);
    this.timer = setInterval(() => { this.ensureSubscription(); this.refresh(); }, 60000);
    this.refresh();
    this.loadChart();
  }
  disconnectedCallback() {
    clearInterval(this.timer); clearInterval(this.ageTimer); this.stopSubscription();
    this.themeObserver?.disconnect();
    this.layoutObserver?.disconnect();
    cancelAnimationFrame(this.themeFrame); this.themeFrame = null;
  }
  scheduleThemeUpdate() {
    if (!this.isConnected || this.themeFrame != null) return;
    this.themeFrame = requestAnimationFrame(() => {
      this.themeFrame = null;
      if (!this.chartElement?.data) return;
      const [background, text] = this.journalColors();
      const journal = this.chartElement.data.find(series => series.id === "insulin");
      if (journal?.label.backgroundColor === background && journal?.label.color === text) return;
      // Update only the journal paint. Keep selection, zoom and history intact.
      this.chartElement.data = this.chartElement.data.map(series => !["insulin","carbs","note"].includes(series.id) ? series : {
        ...series, label:{...series.label, backgroundColor:background, color:text,
          rich:{...series.label.rich, value:{...series.label.rich.value, color:text}}},
      });
      this.chartSignature = null;
    });
  }
  journalColors() {
    if (!this.themeProbe) {
      this.themeProbe = document.createElement("span");
      this.themeProbe.hidden = true;
      this.themeProbe.setAttribute("aria-hidden", "true");
      this.shadowRoot.append(this.themeProbe);
    }
    const dark = this._hass?.themes?.darkMode;
    this.themeProbe.style.backgroundColor = `var(--ha-card-background, var(--card-background-color, ${dark ? "#1c1c1c" : "#fff"}))`;
    this.themeProbe.style.color = `var(--primary-text-color, ${dark ? "#e1e1e1" : "#222"})`;
    // Resolve nested CSS variables to real colors before handing them to canvas.
    const style = getComputedStyle(this.themeProbe);
    return [style.backgroundColor, style.color];
  }
  toggleJournal(id) {
    this.selectedJournalId = this.selectedJournalId === id ? null : id;
    this.renderSelection();
  }
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
  historyCache() {
    const connection = this._hass?.connection || this._hass?.callWS;
    if (!connection || !this.config?.entity) return null;
    let cache = GLUCIFER_HISTORY_CACHE.get(connection);
    if (!cache) { cache = new Map(); GLUCIFER_HISTORY_CACHE.set(connection, cache); }
    const key = `${this._hass.user?.id || ""}:${this.config.entity}`;
    let entry = cache.get(key);
    if (!entry) {
      entry = {};
      cache.set(key, entry);
      if (cache.size > 8) cache.delete(cache.keys().next().value);
    }
    return entry;
  }
  restoreCachedHistory() {
    const entry = this.historyCache();
    if (!this._hass?.states[this.config?.entity] || !entry?.data || Date.now() - entry.updated >= GLUCIFER_HISTORY_CACHE_MS) return false;
    this.data = entry.data;
    this.updated = entry.request ? 0 : entry.updated;
    return true;
  }
  async refresh(force = false) {
    if (force) this.updated = 0;
    if (this.loading) { if (force) this.refreshAgain = true; return; }
    if (!this.isConnected || !this._hass || !this.config || this.loading || Date.now() - this.updated < 15000) return;
    this.loading = true;
    const entity = this.config.entity;
    try {
      const cache = this.historyCache();
      // HA replaces preview elements on config edits. Reuse their pending request.
      if (!cache.request) {
        cache.request = this._hass.callWS({ type: "glucifer/history", entity_id: entity })
          .then(data => { cache.data = data; cache.updated = Date.now(); return data; })
          .finally(() => { cache.request = null; });
      }
      const data = await cache.request;
      if (this.config.entity === entity) { this.data = data; this.error = null; }
    } catch (_) { if (this.config.entity === entity) this.error = "History is unavailable. Check the integration and selected entity."; }
    finally { this.loading = false; this.updated = Date.now(); this.render(); if (this.refreshAgain) { this.refreshAgain = false; this.refresh(true); } }
  }
  render() {
    if (!this._hass || !this.config) return;
    if (!this.shadowRoot) this.attachShadow({ mode: "open" });
    // All dynamic labels and states are assigned through textContent.
    if (!this.shadowRoot.hasChildNodes()) this.shadowRoot.innerHTML = `<style>
      ha-card {display:block;padding:20px;container-type:inline-size} .title-row {display:flex;align-items:center;gap:12px;margin-bottom:12px} h2 {margin:0;font-size:20px;flex:1;min-width:0} .brand-logo {width:32px;height:32px;object-fit:contain;flex:none} .reading {display:flex;align-items:center;justify-content:space-between;gap:12px}
      .glucose,.trend {font-size:42px;font-weight:600} .trend {white-space:nowrap;flex:none;font-size:min(var(--glucifer-arrow-size,84px),26cqw);line-height:1;margin-left:auto;width:1em;height:1em;display:flex;align-items:center;justify-content:center} .glucose {min-width:0;flex:1;font-size:var(--glucifer-glucose-size,42px)}
      .details-row {display:flex;align-items:center;gap:12px} .details-copy {flex:1;min-width:0;overflow-wrap:anywhere}
      .detail {color:var(--secondary-text-color);margin:8px 0} .warning {color:var(--warning-color)}
      .reading.centered {display:grid;gap:0;grid-template-columns:var(--glucifer-trend-space,0px) minmax(0,1fr) var(--glucifer-trend-space,0px)}
      .reading.centered.has-trend {--glucifer-trend-space:calc(var(--glucifer-arrow-width,84px) + 12px)}
      .reading.centered .glucose {grid-area:1 / 2;overflow-wrap:normal} .reading.centered .trend {grid-area:1 / 3;justify-self:end}
      .trend svg {display:block;width:100%;height:100%;overflow:visible} .trend path {fill:none;stroke:currentColor;stroke-width:7;stroke-linecap:round;stroke-linejoin:round}
      .trend-label {position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%)}
      .history-chart {width:100%;height:180px;overflow:visible} .history-chart path {fill:none;stroke:var(--primary-color);stroke-width:2}
      .axis {display:flex;justify-content:space-between;font-size:12px;color:var(--secondary-text-color)}
      ul {padding-left:20px} button {margin-top:12px;border:0;background:none;color:var(--primary-color);cursor:pointer}
      .journal-marker {stroke:var(--card-background-color,#fff);stroke-width:1.5;cursor:pointer}
      .journal-marker:focus {outline:none;stroke:var(--primary-text-color);stroke-width:3}
      .journal-list {display:grid;gap:6px} .journal-list button, .journal-entry-label {box-sizing:border-box;display:block;font-size:14px;line-height:20px;text-align:left;margin:0;padding:8px;border:1px solid var(--divider-color);border-radius:6px}
      .journal-section {margin-top:12px} .journal-section summary {display:flex;align-items:center;gap:8px;cursor:pointer;list-style:none;font-weight:600;padding:8px 0}
      .journal-section summary::-webkit-details-marker {display:none} .journal-section summary::before {content:"▸"} .journal-section[open] summary::before {content:"▾"}
      .journal-summary-count {margin-left:auto;font-size:12px;font-weight:400;color:var(--secondary-text-color)}
      .journal-section.compact .journal-count {display:none} .journal-section.compact .journal-list {gap:0}
      .journal-section.compact .journal-list button, .journal-section.compact .journal-entry-label {border:0;border-radius:0;padding:4px 0;min-height:28px;font-size:14px;line-height:20px}
      .journal-entry.selected > .journal-entry-label {background:var(--secondary-background-color);border-radius:4px}
      .journal-selection {padding:12px;border:1px solid var(--divider-color);border-radius:8px;white-space:pre-wrap}
      .journal-entry .journal-selection {padding:8px 0 8px 12px;margin:2px 0 6px;border:0;border-left:2px solid var(--divider-color);border-radius:0}
      .journal-selection button {margin:8px 0 0;padding:0;border:0}
      [hidden] {display:none!important}
    </style><ha-card><div class="title-row"><h2></h2><img class="brand-logo" alt="Glucifer" width="32" height="32"></div><div class="reading"><div class="glucose"></div><span class="trend"></span></div><div class="details-row"><div class="details-copy"><div class="detail summary"><span class="delta"></span><span class="reading-age"></span></div><div class="detail optional-values"></div></div></div>
      <div class="warning health"></div><div class="native-chart" hidden></div><svg class="history-chart" viewBox="0 0 600 180" role="img" aria-label="Glucose history"><path></path><g class="journal-markers"></g></svg>
      <div class="axis"><span class="start"></span><span class="range"></span><span class="end"></span></div>
      <div class="detail journal-legend" hidden>▲ Insulin · ● Carbohydrates · ■ Note</div><div class="detail history"></div><div class="journal-selection" hidden><div class="selection-label"></div><div class="selection-note"></div><button>Close</button></div><details class="journal-section" hidden><summary><span class="journal-title"></span><span class="journal-summary-count"></span></summary><div class="journal-count detail"></div><div class="journal-list"></div></details><ul></ul><div class="detail lifecycle"></div><button>More details</button></ha-card>`;
    const root = this.shadowRoot;
    const text = (selector, value) => { root.querySelector(selector).textContent = value; };
    root.querySelector("ha-card").lang = this.config.locale || this._hass.locale?.language || "en";
    text(".journal-title", this.t("Journal"));
    text(".journal-selection button", this.t("Close"));
    text("ha-card > button", this.t("More details"));
    root.querySelector(".history-chart").setAttribute("aria-label", this.t("Glucose history"));
    text(".journal-legend", `▲ ${this.t("Insulin")} · ● ${this.t("Carbohydrates")} · ■ ${this.t("Note")}`);
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
    if (this.config.show_logo && !logo.hasAttribute("src")) logo.src = "/glucifer/mark.svg";
    this.restoreJournalState();
    text(".glucose", Number.isFinite(value) ? `${this.formatNumber(value, glucosePrecision, glucosePrecision)}${this.config.show_glucose_unit ? ` ${unit}` : ""}` : this.t("Unavailable"));
    const trend = state("trend")?.state;
    const trendArrow = new Map([
      ["DoubleUp", "↑↑"], ["SingleUp", "↑"], ["FortyFiveUp", "↗"],
      ["Flat", "→"], ["FortyFiveDown", "↘"], ["SingleDown", "↓"], ["DoubleDown", "↓↓"],
    ]).get(trend);
    const arrow = root.querySelector(".trend");
    arrow.replaceChildren();
    if (Number.isFinite(value) && trendArrow) {
      const label = document.createElement("span"); label.className = "trend-label"; label.textContent = trendArrow;
      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.setAttribute("viewBox", "0 0 100 100"); svg.setAttribute("aria-hidden", "true");
      const path = document.createElementNS(svg.namespaceURI, "path");
      const double = trend === "DoubleUp" || trend === "DoubleDown";
      path.setAttribute("d", double ? "M12 33H88M68 13L88 33L68 53M12 67H88M68 47L88 67L68 87" : "M10 50H90M68 28L90 50L68 72");
      path.setAttribute("transform", `rotate(${({Flat:0,FortyFiveUp:-45,SingleUp:-90,DoubleUp:-90,FortyFiveDown:45,SingleDown:90,DoubleDown:90})[trend]} 50 50)`);
      const length = (this.config.arrow_length ?? this.config.arrow_size) / this.config.arrow_size * 100;
      const extension = (length - 100) / 2;
      if (this.config.arrow_length != null) {
        const left = 10 - extension, right = 90 + extension, head = Math.min(22, length * .22);
        path.setAttribute("d", double
          ? `M${left} 33H${right}M${right-head} 13L${right} 33L${right-head} 53M${left} 67H${right}M${right-head} 47L${right} 67L${right-head} 87`
          : `M${left} 50H${right}M${right-head} ${50-head}L${right} 50L${right-head} ${50+head}`);
      }
      const angle = ({Flat:0,FortyFiveUp:-45,SingleUp:-90,DoubleUp:-90,FortyFiveDown:45,SingleDown:90,DoubleDown:90})[trend] * Math.PI / 180;
      const extra = Math.max(0, length - 100), margin = Math.max(0, (this.config.arrow_width ?? this.config.arrow_size * .07) / this.config.arrow_size * 100 - 7);
      this.arrowBox = {width:100 + extra * Math.abs(Math.cos(angle)) + margin, height:100 + extra * Math.abs(Math.sin(angle)) + margin};
      svg.setAttribute("viewBox", `${50-this.arrowBox.width/2} ${50-this.arrowBox.height/2} ${this.arrowBox.width} ${this.arrowBox.height}`);
      path.style.strokeWidth = (this.config.arrow_width ?? this.config.arrow_size * .07) / this.config.arrow_size * 100;
      svg.append(path); arrow.append(label, svg);
    }
    root.querySelector(".glucose").style.setProperty("--glucifer-glucose-size", `${this.config.glucose_size}px`);
    root.querySelector(".glucose").style.fontWeight = this.config.glucose_weight;
    root.querySelector(".glucose").style.fontStyle = this.config.glucose_style;
    root.querySelector(".glucose").style.fontFamily = this.config.glucose_font || "inherit";
    root.querySelector(".glucose").style.textAlign = this.config.glucose_alignment;
    root.querySelector(".glucose").style.color = gluciferGlucoseColor(value, unit, this.config);
    root.querySelector(".trend").style.color = gluciferTrendColor(Number.isFinite(value) ? trend : null, this.config);
    root.querySelector(".trend").hidden = !this.config.show_trend;
    const reading = root.querySelector(".reading");
    reading.classList.toggle("centered", this.config.glucose_alignment === "center");
    const arrowHost = this.config.arrow_position === "details" ? root.querySelector(".details-row") : reading;
    if (arrow.parentElement !== arrowHost) arrowHost.append(arrow);
    reading.classList.toggle("has-trend", this.config.arrow_position === "glucose" && this.config.show_trend && Number.isFinite(value) && Boolean(trendArrow));
    root.querySelector("ha-card").style.setProperty("--glucifer-arrow-size", `${this.config.arrow_size}px`);
    root.querySelector(".summary").hidden = !this.config.show_delta_mgdl && !this.config.show_reading_age;
    root.querySelector("ul").hidden = !this.config.show_alerts;
    const delta = state("delta_mgdl");
    text(".delta", this.config.show_delta_mgdl && delta && Number.isFinite(Number(delta.state))
      ? `Δ ${this.formatNumber(Number(delta.state), 1, 1)} ${delta.attributes.unit_of_measurement}` : "");
    this.updateAge();
    text(".health", state("connected")?.state === "off" ? this.t("Phone has not contacted Home Assistant recently") : state("stale")?.state === "on" ? this.t("Glucose reading is stale") : "");
    const historySignature = JSON.stringify([this.data?.readings, this.data?.predictions, this.data?.journal, this.data?.journal_enabled, this.data?.journal_history_days,
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
      root.querySelector(".history-chart path").setAttribute("d", path);
      text(".start", this.formatDateTime(since));
      text(".end", this.formatDateTime(until, true));
      text(".range", points.length ? `${this.formatNumber(min, glucosePrecision, glucosePrecision)} ${this.t("to")} ${this.formatNumber(max, glucosePrecision, glucosePrecision)} ${unit}` : this.t("No history"));
      this.renderJournal(root, points, since, until, convert, min, max);
      this.renderChart(points, since, until, convert, unit, min);
      text(".history", this.error ? this.t(this.error) : !this.data ? this.t("Loading history…") : this.t("{count} readings at their measurement times. Gaps over 10 min remain visible.", {count:this.formatNumber(points.length, 0)}));
    }
    root.querySelector("ul").replaceChildren();
    Object.keys(entities).filter(key => key.startsWith("alert_") && state(key)?.state === "on").forEach(key => {
      const li = document.createElement("li"); li.textContent = state(key).attributes.friendly_name; root.querySelector("ul").append(li);
    });
    const available = key => this.config[`show_${key}`] && state(key) && !["unknown", "unavailable", ""].includes(state(key).state);
    const formatted = key => {
      const s = state(key);
      if (key.endsWith("_ms")) return this.formatDateTime(s.state);
      if (key === "sensor_warmup") return this.t(s.state === "on" ? "Yes" : "No");
      const numeric = !GLUCIFER_SENSOR_FIELDS.includes(key) && Number.isFinite(Number(s.state));
      const value = `${numeric ? this.formatNumber(Number(s.state), 1, s.state.includes(".") ? 1 : 0) : s.state}${s.attributes.unit_of_measurement ? ` ${["iob_u", "eiob_u"].includes(key) ? this.t("U") : s.attributes.unit_of_measurement}` : ""}`;
      return key === "iob_u" && available("eiob_u") ? `${value} (eIOB: ${formatted("eiob_u")})` : value;
    };
    for (const [selector, keys] of [[".lifecycle", GLUCIFER_SENSOR_FIELDS], [".optional-values", ["rate_mgdl_min", "raw_mgdl", "auto_mgdl", "iob_u", ...(!available("iob_u") ? ["eiob_u"] : []), "cob_g", "battery_percent"]]]) {
      text(selector, keys.filter(available).map(key => `${key === "iob_u" ? "IOB" : key === "eiob_u" ? "eIOB" : this.t(GLUCIFER_FIELDS[key])}: ${formatted(key)}`).join(" · "));
      root.querySelector(selector).hidden = !root.querySelector(selector).textContent;
    }
    this.fitReading();
    this.renderedStates = this.stateSignature();
    root.querySelector("ha-card > button").onclick = () => this.dispatchEvent(new CustomEvent("hass-more-info", {detail: {entityId: this.config.entity}, bubbles: true, composed: true}));
  }
  renderJournal(root, points, since, until, convert, min, max) {
    const cutoff = until - this.config.journal_days * 86400000;
    const entries = (this.data?.journal || []).filter(e => e.time_ms >= cutoff && e.time_ms <= until && this.config.journal_types.includes(e.kind));
    const number = value => this.formatNumber(value, 2);
    const description = entry => `${this.journalLabel(entry)}${entry.amount != null ? ` · ${number(entry.amount)} ${entry.kind === "insulin" ? this.t("U") : "g"}` : ""} · ${this.formatDateTime(entry.time_ms)}`;
    this.journalEntries = entries;
    this.journalDescription = description;
    const select = entry => this.toggleJournal(entry.id);
    // Park the one details panel before rebuilding rows, preserving its Close button.
    root.querySelector(".journal-section").before(root.querySelector(".journal-selection"));
    root.querySelector(".journal-markers").replaceChildren();
    root.querySelector(".journal-list").replaceChildren();
    if (this.config.show_journal_markers) {
      const group = root.querySelector(".journal-markers");
      group.toggleAttribute("hidden", !this.config.show_journal_symbols);
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
    root.querySelector(".journal-legend").hidden = !this.config.show_history || !this.config.show_journal_symbols || !root.querySelector(".journal-marker");
    const section = root.querySelector(".journal-section"); section.hidden = !this.config.show_journal;
    section.classList.toggle("compact", this.config.journal_compact);
    if (this.config.show_journal) {
      const visible = [...entries].sort((a,b) => b.time_ms-a.time_ms || b.id.localeCompare(a.id)).slice(0,this.config.journal_limit);
      root.querySelector(".journal-summary-count").textContent = this.t(visible.length === 1 ? "{count} entry" : "{count} entries", {count:this.formatNumber(visible.length, 0)});
      root.querySelector(".journal-count").textContent = this.data?.journal_enabled
        ? this.t("{visible} of {total} entries in {days} days. Sender retains up to {retained} days.", {visible:this.formatNumber(visible.length, 0),total:this.formatNumber(entries.length, 0),days:this.formatNumber(this.config.journal_days, 0),retained:this.formatNumber(this.data.journal_history_days ?? this.config.journal_days, 0)})
        : this.t("Enable journal sync in JugglucoNG to display entries.");
      for (const entry of visible) {
        const row = document.createElement("div"); row.className = "journal-entry"; row.dataset.journalId = entry.id;
        const expandable = Boolean(this.journalNote(entry));
        const button = document.createElement(expandable ? "button" : "span");
        button.className = `journal-entry-label${expandable ? " journal-entry-toggle" : ""}`;
        button.textContent = description(entry);
        if (expandable) button.onclick = () => select(entry);
        row.append(button); root.querySelector(".journal-list").append(row);
      }
    }
    this.renderSelection();
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
      this.renderSelection();
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
    root.querySelector(".history-chart").toggleAttribute("hidden", !this.config.show_history || native);
    root.querySelector(".axis").hidden = !this.config.show_history || native;
    if (!native || !this.config.show_history) return;
    if (!this.chartElement) {
      this.chartElement = document.createElement("ha-chart-base");
      this.chartElement.height = "240px";
      this.chartElement.addEventListener("chart-click", event => {
        const id = event.detail?.data?.journalId;
        if (id) this.toggleJournal(id);
      });
      // Bind lazily: HA initializes (and may replace) its ECharts instance asynchronously.
      this.chartElement.addEventListener("mousemove", () => this.bindJournalHover(), true);
      this.chartElement.addEventListener("mousemove", event => {
        if (this.journalHovered) this.chartElement.chart?.dispatchAction({type:"hideTip"});
        this.updateChartCursor(event);
      });
      this.chartElement.addEventListener("chart-zoom", event => {
        this.chartZoomed = event.detail.start > 0 || event.detail.end < 100;
        this.updateChartCursor();
      });
      this.chartElement.addEventListener("mouseleave", () => { this.journalHovered = false; });
      host.append(this.chartElement);
    }
    this.chartElement.hass = this._hass;
    const predictions = this.config.show_predictions ? (this.data?.predictions || []).filter(curve =>
      ["raw","auto","calibrated"].includes(curve.kind) && curve.points?.length >= 2 &&
      curve.points[0].time_ms >= Date.now() - 600000 && curve.points.at(-1).time_ms > Date.now()) : [];
    const chartUntil = Math.max(until, ...predictions.map(curve => curve.points.at(-1).time_ms));
    const entries = this.config.show_journal_markers ? this.journalEntries.filter(e => e.time_ms >= since) : [];
    const [chipBackground, chipText] = this.journalColors();
    const signature = JSON.stringify([points, predictions, entries, unit, this.config.hours, this.config.show_journal_symbols, this.config.locale, this._hass.locale, this._hass.config?.time_zone, chipBackground, chipText]);
    if (signature === this.chartSignature) return;
    this.chartSignature = signature;
    const data = [];
    let previous;
    for (const point of points) {
      if (previous && point.time_ms - previous > 600000) data.push([previous+1, null]);
      data.push([point.time_ms, convert(point.mgdl)]);
      previous = point.time_ms;
    }
    const series = [{id:"glucose", name:this.t("Glucose"), type:"line", showSymbol:false, connectNulls:false, sampling:"minmax", data, lineStyle:{width:2}}];
    for (const curve of predictions) {
      series.push({id:`prediction_${curve.kind}`,name:this.t(`Prediction (${curve.kind})`),type:"line",
        showSymbol:false,connectNulls:false,lineStyle:{type:"dashed",width:2,opacity:0.8},
        itemStyle:{color:({raw:"#26a69a",auto:"#42a5f5",calibrated:"#ab47bc"})[curve.kind]},
        data:curve.points.map(point => [point.time_ms,convert(point.mgdl)])});
    }
    // Small local line icons keep journal chips readable without external assets.
    const icons = {
      insulin:"M5 19l3-3m-1-3 4 4 8-8-4-4zm6-10 8 8m-4-8 4 4M9 11l2 2m0-4 2 2",
      carbs:"M5 3v6c0 3 4 3 4 0V3M7 3v18M17 3c-4 3-4 9 0 9V3zm0 9v9",
      note:"M3 5h12l6 7-6 7H3zm5 5v4",
    };
    for (const [kind,symbol,color] of [["insulin","triangle","#7e57c2"],["carbs","circle","#fb8c00"],["note","rect","#00838f"]]) {
      const icon = `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path d="${icons[kind]}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`)}`;
      series.push({id:kind, name:this.t(({insulin:"Insulin",carbs:"Carbohydrates",note:"Note"})[kind]), type:"line", lineStyle:{opacity:0}, symbol, symbolSize:this.config.show_journal_symbols ? 12 : 0, showSymbol:true, showAllSymbol:true, itemStyle:{color}, z:5, tooltip:{trigger:"item",show:false},
        // Keep the rich icon alignment stable when labels shift, so cached image bounds match the pill.
        label:{show:true,position:"top",distance:24,verticalAlign:"middle",backgroundColor:chipBackground,borderColor:`${color}55`,borderWidth:1,borderRadius:14,padding:[5,8],color:chipText,
          rich:{icon:{width:14,height:14,backgroundColor:{image:icon}},value:{fontSize:12,color:chipText}},
          formatter:params => {
            const entry = entries.find(e => e.id === params.data.journalId);
            const value = entry?.amount != null ? `${this.formatNumber(entry.amount, 2)} ${kind === "insulin" ? this.t("U") : "g"}` : this.journalLabel(entry || {kind:"note"}).slice(0,16);
            return `{icon| } {value|${value.replaceAll("{","（").replaceAll("}","）")}}`;
          }},
        labelLine:{show:true,lineStyle:{color,opacity:0.8,width:1.5}},
        labelLayout:params => ({moveOverlap:"shiftY",hideOverlap:true,
          x:Math.max(45+params.labelRect.width/2,Math.min(this.chartElement.clientWidth-15-params.labelRect.width/2,params.rect.x+params.rect.width/2)),
          align:"center",verticalAlign:"middle"}),
        data:entries.filter(e => e.kind === kind).map(entry => {
          let left=0,right=points.length;
          while(left<right) { const middle=(left+right)>>>1; if(points[middle].time_ms<entry.time_ms) left=middle+1; else right=middle; }
          const nearest=[points[left-1],points[left]].filter(Boolean).sort((a,b)=>Math.abs(a.time_ms-entry.time_ms)-Math.abs(b.time_ms-entry.time_ms))[0];
          return {value:[entry.time_ms,nearest && Math.abs(nearest.time_ms-entry.time_ms)<=600000 ? convert(nearest.mgdl) : min],journalId:entry.id};
        })});
    }
    this.chartElement.options = {
      animation:false, grid:{left:45,right:15,top:20,bottom:35},
      xAxis:{type:"time",min:since,max:chartUntil,axisLabel:{formatter:value => this.formatDateTime(value, this.config.hours <= 24)}}, yAxis:{type:"value",scale:true,name:unit,axisLabel:{formatter:value => this.formatNumber(value, unit === "mg/dL" ? 0 : 1)}},
      tooltip:{trigger:"axis",confine:true,transitionDuration:0,formatter:params => {
        if (this.journalHovered) return "";
        const box = document.createElement("div");
        for (const p of Array.isArray(params) ? params : [params]) {
          const entry = this.journalEntries.find(e => e.id === p.data?.journalId);
          const row = document.createElement("div");
          row.textContent = entry ? this.journalDescription(entry) : `${p.seriesId?.startsWith("prediction_") ? `${p.seriesName} · ` : ""}${this.formatDateTime(p.value[0])} · ${this.formatNumber(Number(p.value[1]), unit === "mg/dL" ? 0 : 1, unit === "mg/dL" ? 0 : 1)} ${unit}`;
          box.append(row);
        }
        return box;
      }},
    };
    this.chartElement.data = series;
  }
  updateChartCursor(event) {
    const chart = this.chartElement?.chart;
    if (!chart || this.journalHovered || event?.ctrlKey || event?.metaKey) return;
    if (!this.chartZoomed) chart.getZr().setCursorStyle("default");
  }
  bindJournalHover() {
    const chart = this.chartElement?.chart;
    if (!chart || chart === this.hoverChart) return;
    this.hoverChart = chart;
    const zoom = chart.getOption().dataZoom?.find(option => option.type === "inside");
    this.chartZoomed = (zoom?.start ?? 0) > 0 || (zoom?.end ?? 100) < 100;
    this.journalHovered = false;
    chart.on("mouseover", event => { this.journalHovered = Boolean(event.data?.journalId); });
    chart.on("mouseout", () => { this.journalHovered = false; });
  }
  renderSelection() {
    const root = this.shadowRoot;
    const entry = (this.config.show_journal || (this.config.show_history && this.config.show_journal_markers)) && this.journalEntries?.find(e => e.id === this.selectedJournalId);
    if (!entry) this.selectedJournalId = null;
    const panel = root.querySelector(".journal-selection"), section = root.querySelector(".journal-section");
    const rows = [...root.querySelectorAll(".journal-entry")];
    const row = entry && this.config.show_journal && section.open && rows.find(row => row.dataset.journalId === entry.id);
    if (row) { if (panel.parentElement !== row) row.append(panel); }
    else if (panel.parentElement !== section.parentElement) section.before(panel);
    for (const item of rows) {
      item.classList.toggle("selected", item === row);
      item.querySelector(".journal-entry-toggle")?.setAttribute("aria-expanded", String(item === row));
    }
    const note = entry ? this.journalNote(entry) : "";
    panel.hidden = !entry || Boolean(row && !note);
    // The inline row already contains the name, amount and time.
    root.querySelector(".selection-label").textContent = entry && !row ? this.journalDescription(entry) : "";
    root.querySelector(".selection-note").textContent = note;
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
      value = `${this.shadowRoot.querySelector(".delta").textContent ? " · " : ""}${this.t("Reading {duration} old", {duration})}`;
    }
    if (label.textContent !== value) label.textContent = value;
  }
  fitReading() {
    const root = this.shadowRoot;
    if (!root || !this.config) return;
    const reading = root.querySelector(".reading"), glucose = root.querySelector(".glucose"), arrow = root.querySelector(".trend");
    if (!reading?.clientWidth) return;
    const box = this.arrowBox || {width:100,height:100};
    const size = this.config.arrow_size;
    const scale = Math.min(size / 100, reading.clientWidth * (this.config.arrow_length == null ? .26 : .4) / box.width);
    arrow.style.width = `${box.width * scale}px`;
    arrow.style.height = `${box.height * scale}px`;
    arrow.style.fontSize = `${100 * scale}px`;
    root.querySelector("ha-card").style.setProperty("--glucifer-arrow-width", `${box.width * scale}px`);
    // Measure the longest token so a unit may wrap, but the glucose number never splits.
    this.measureCanvas ??= document.createElement("canvas");
    const context = this.measureCanvas.getContext("2d"), style = getComputedStyle(glucose);
    context.font = `${style.fontStyle} ${style.fontWeight} ${this.config.glucose_size}px ${style.fontFamily}`;
    const widest = Math.max(...glucose.textContent.split(/\s+/).map(token => context.measureText(token).width));
    const fit = Math.min(this.config.glucose_size, this.config.glucose_size * Math.max(1, glucose.clientWidth - 1) / Math.max(1, widest));
    glucose.style.fontSize = `${fit}px`;
  }
  t(text, values) { return gluciferText(this.config?.locale || this._hass?.locale?.language, text, values); }
  journalNote(entry) {
    const note = entry.note?.trim() || "";
    return note === (entry.label || "").trim() || note === this.journalLabel(entry).trim() ? "" : note;
  }
  journalLabel(entry) {
    const fallback = ({insulin:"Insulin",carbs:"Carbohydrates",note:"Note"})[entry.kind] || entry.kind;
    // Only translate generic protocol labels; custom names and note text are user data.
    return !entry.label || entry.label.toLowerCase() === fallback.toLowerCase() || entry.label.toLowerCase() === entry.kind
      ? this.t(fallback) : entry.label;
  }
  formatNumber(value, maximumFractionDigits = 1, minimumFractionDigits = 0) {
    const ha = this._hass?.locale || {};
    const formats = {comma_decimal:"en-US", decimal_comma:"de", space_comma:"fr", quote_decimal:"de-CH", none:"en-US"};
    const locale = this.config.locale || (ha.number_format === "system" ? undefined : formats[ha.number_format] || ha.language);
    return new Intl.NumberFormat(locale, {maximumFractionDigits, minimumFractionDigits, useGrouping:this.config.locale ? true : ha.number_format !== "none"}).format(value);
  }
  formatDateTime(value, timeOnly = false) {
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return this.t("Unavailable");
    const locale = this.config.locale ? {...this._hass?.locale, language:this.config.locale, date_format:"language", time_format:"language"} : this._hass?.locale || {};
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
// Keep HA's native controls, supplying effective values instead of placeholder defaults.
class GluciferCardEditor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({mode:"open"});
    this.form = document.createElement("ha-form");
    const definition = gluciferForm();
    Object.assign(this.form, {schema:definition.schema, computeLabel:definition.computeLabel, computeHelper:definition.computeHelper});
    this.form.addEventListener("value-changed", event => {
      event.stopPropagation();
      const next = {...this.config};
      for (const [key, value] of Object.entries(event.detail.value)) {
        if (JSON.stringify(value) === JSON.stringify(this.formData[key])) continue;
        if (value == null || value === "" || (key === "locale" && value === "Home Assistant")) delete next[key]; else next[key] = value;
      }
      this.setConfig(next);
      this.dispatchEvent(new CustomEvent("config-changed", {detail:{config:next}, bubbles:true, composed:true}));
    });
    this.shadowRoot.append(this.form);
  }
  set hass(value) { this._hass = value; this.form.hass = value; this.updateLanguage(); }
  updateLanguage() {
    const language = this.config?.locale || this._hass?.locale?.language || "en";
    if (this.formLanguage === language) return;
    this.formLanguage = language;
    this.form.lang = language;
    const definition = gluciferForm(language);
    Object.assign(this.form, {schema:definition.schema,computeLabel:definition.computeLabel,computeHelper:definition.computeHelper});
  }
  setConfig(value) {
    let effective;
    try { effective = gluciferConfig(value); }
    catch { effective = {...GLUCIFER_DEFAULTS, ...value}; }
    this.config = {...value};
    this.formData = {...effective, locale:effective.locale || "Home Assistant", glucose_weight:String(effective.glucose_weight)};
    this.updateLanguage();
    this.form.data = this.formData;
  }
}
if (!customElements.get("glucifer-card-editor")) customElements.define("glucifer-card-editor", GluciferCardEditor);
if (!customElements.get("glucifer-card")) customElements.define("glucifer-card", GluciferCard);
window.customCards = window.customCards || [];
window.customCards.push({type: "glucifer-card", name: "Glucifer HA", description: "Glucose, freshness, active alerts and timestamped history."});
