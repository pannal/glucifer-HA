// SPDX-License-Identifier: GPL-3.0-or-later
// Capture the actual card with synthetic states; no HA instance or secrets needed.
// From the repository root after npm ci and npx playwright install chromium:
// Set GLUCIFER_HA_FRONTEND as described in tests/frontend/README.md, then run:
// node docs/screenshots/capture.cjs
const { chromium } = require('playwright');
const path = require('node:path');
const {loadNativeChart} = require('../../tests/frontend/ha-native.cjs');

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({
      viewport: { width: 528, height: 1100 }, deviceScaleFactor: 2,
      locale: 'en-GB', timezoneId: 'UTC',
    });
    await loadNativeChart(page);
    const errors = [];
    page.on('pageerror', error => errors.push(String(error)));
    // Freeze the clock so dates and the chart stay reproducible.
    await page.clock.install({ time: new Date('2026-09-06T12:00:00Z') });
    await page.clock.pauseAt(new Date('2026-09-06T12:00:00Z'));
    await page.evaluate(html => {document.body.innerHTML = html;}, `<style>
      body { margin: 0; font: 16px Arial, sans-serif; }
      main { padding: 24px; background: var(--background); color: var(--text); --primary-text-color:var(--text); --card-background-color:var(--card-background); --divider-color:var(--border); }
      header { margin-bottom: 16px; color: var(--secondary-text-color); font-size: 13px; }
      glucifer-card { display: block; }
    </style><main><header>Glucifer HA · Sample data</header><glucifer-card></glucifer-card></main>`);
    // Supply the card container normally provided by the HA frontend.
    await page.evaluate(() => customElements.get('ha-card') || customElements.define('ha-card', class extends HTMLElement {
      constructor() {
        super();
        this.attachShadow({ mode: 'open' }).innerHTML = `<style>
          :host { display: block; background: var(--card-background); border-radius: 12px;
            border: 1px solid var(--border); }
        </style><slot></slot>`;
      }
    }));
    await page.addScriptTag({ path: path.join(__dirname, '../../custom_components/glucifer/frontend/glucifer-card.js') });
    for (const variant of [
      {dark:false, name:'dashboard-mgdl-interactive', config:{}},
      {dark:true, name:'dashboard-mmol-interactive', config:{}},
      {dark:true, name:'dashboard-centered-active-insulin', config:{glucose_size:64,glucose_alignment:'center',show_glucose_unit:false,show_eiob_u:true}},
      {dark:true, name:'dashboard-lower-arrow', config:{glucose_size:64,glucose_alignment:'center',show_glucose_unit:false,show_eiob_u:true,arrow_position:'details'}},
      {dark:true, name:'dashboard-typography-locale', config:{glucose_size:96,glucose_alignment:'center',show_glucose_unit:false,arrow_position:'details',arrow_length:140,arrow_width:4,glucose_font:'Georgia',glucose_weight:400,glucose_style:'italic',locale:'de-DE',show_eiob_u:true}},
      {dark:false, name:'dashboard-expanded-journal', config:{glucose_size:48,arrow_size:64,journal_compact:false,show_logo:false,show_journal_symbols:true}},
    ]) {
      await page.evaluate(({dark,config}) => {
        document.documentElement.dataset.theme = dark ? "dark" : "light";
        document.querySelector("glucifer-card").replaceWith(document.createElement("glucifer-card"));
        const colors = dark ? ['#111820', '#1c2631', '#edf2f7', '#aab7c4', '#65cbd1', '#ffb74d', '#344353']
          : ['#f3f6f8', '#ffffff', '#172b3a', '#586773', '#00868c', '#a05300', '#dce4e9'];
        ['background', 'card-background', 'text', 'secondary-text-color', 'primary-color', 'warning-color', 'border']
          .forEach((name, i) => document.documentElement.style.setProperty(`--${name}`, colors[i]));
        document.documentElement.style.setProperty("--graph-color-1", colors[4]);
        document.documentElement.style.setProperty("--color-1", colors[4]);
        document.documentElement.style.setProperty("--info-color", colors[4]);
        const now = Date.now();
        const state = (value, attributes = {}) => ({ state: value, attributes });
        const unit = dark ? 'mmol/L' : 'mg/dL';
        const entities = { glucose: 'sensor.sample_glucose', trend: 'sensor.sample_trend',
          delta_mgdl: 'sensor.sample_delta', reading_age: 'sensor.sample_age', measurement_time:'sensor.sample_measurement_time',
          connected: 'binary_sensor.sample_connected', stale: 'binary_sensor.sample_stale', iob_u:'sensor.sample_iob', eiob_u:'sensor.sample_eiob', cob_g:'sensor.sample_cob' };
        const readings = Array.from({ length: 361 }, (_, i) => ({
          time_ms: now - (360 - i) * 60000 - 42000,
          mgdl: Math.round(115 + 15 * Math.sin(i / 40) + 7 * Math.sin(i / 17)),
        })).filter((_, i) => !(i > 160 && i < 190));
        readings[readings.length - 1].mgdl = 123;
        const journal = [
          {id:'j1',time_ms:now-300*60000,kind:'carbs',amount:35,label:'Carbohydrates'},
          {id:'j2',time_ms:now-295*60000,kind:'insulin',amount:2.5,label:'Insulin'},
          {id:'j3',time_ms:now-90*60000,kind:'note',label:'Note',note:'Sample journal note'},
          {id:'j4',time_ms:now-55*60000,kind:'carbs',amount:12,label:'Carbohydrates'},
        ];
        const fixture = {locale:{language:"en-GB",time_format:"24",date_format:"DMY",time_zone:"server"},config:{time_zone:"Europe/Berlin"},localize:key=>key, states: {
          [entities.glucose]: state(dark ? (123 / 18.016).toFixed(1) : '123', { unit_of_measurement: unit }),
          [entities.trend]: state('FortyFiveDown'),
          [entities.iob_u]: state('5.2',{unit_of_measurement:'U'}),
          [entities.eiob_u]: state('1.7',{unit_of_measurement:'U'}),
          [entities.cob_g]: state('0',{unit_of_measurement:'g'}),
          [entities.delta_mgdl]: state('0', { unit_of_measurement: unit }),
          [entities.reading_age]: state('42'), [entities.measurement_time]:state(new Date(now-42000).toISOString()),
          [entities.connected]: state('on'), [entities.stale]: state('off'),
        }, callWS: async () => ({ entities, unit, readings, journal, journal_enabled:true, journal_history_days:7 }) };
        const card = document.querySelector('glucifer-card');
        card.hass = fixture;
        card.setConfig({ entity: entities.glucose, title: 'Glucose', hours: 6, show_journal:true, journal_limit:4, ...config });
      }, variant);
      await page.waitForFunction(() => {
        const card = document.querySelector('glucifer-card');
        return card.data && !card.loading && card.chartElement?.chart?.getOption().series?.length === 4;
      });
      await page.clock.runFor(200);
      await page.waitForFunction(()=>{const logo=document.querySelector('glucifer-card').shadowRoot.querySelector('.brand-logo');return logo.hidden || logo.naturalWidth > 0;});
      await page.locator('main').screenshot({
        path: path.join(__dirname, `${variant.name}.png`),
      });
    }
    if (errors.length) throw new Error(errors.join('\n'));
    console.log('Captured six dashboard previews from the bundled card using synthetic data.');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
