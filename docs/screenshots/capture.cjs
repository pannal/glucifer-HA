// SPDX-License-Identifier: GPL-3.0-or-later
// Capture the actual card with synthetic states; no HA instance or secrets needed.
// From the repository root after npm ci and npx playwright install chromium:
// node docs/screenshots/capture.cjs
const { chromium } = require('playwright');
const path = require('node:path');

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({
      viewport: { width: 680, height: 650 }, deviceScaleFactor: 2,
      locale: 'en-GB', timezoneId: 'UTC',
    });
    const errors = [];
    page.on('pageerror', error => errors.push(String(error)));
    // Freeze the clock so dates and the chart stay reproducible.
    await page.clock.install({ time: new Date('2026-09-06T12:00:00Z') });
    await page.clock.pauseAt(new Date('2026-09-06T12:00:00Z'));
    await page.setContent(`<style>
      body { margin: 0; font: 16px Arial, sans-serif; }
      main { padding: 24px; background: var(--background); color: var(--text); }
      header { margin-bottom: 16px; color: var(--secondary-text-color); font-size: 13px; }
      glucifer-card { display: block; }
    </style><main><header>Glucifer HA · Sample data</header><glucifer-card></glucifer-card></main>`);
    // Supply the card container normally provided by the HA frontend.
    await page.evaluate(() => customElements.define('ha-card', class extends HTMLElement {
      constructor() {
        super();
        this.attachShadow({ mode: 'open' }).innerHTML = `<style>
          :host { display: block; background: var(--card-background); border-radius: 12px;
            border: 1px solid var(--border); }
        </style><slot></slot>`;
      }
    }));
    await page.addScriptTag({ path: path.join(__dirname, '../../custom_components/glucifer/frontend/glucifer-card.js') });
    for (const dark of [false, true]) {
      await page.evaluate(dark => {
        const colors = dark ? ['#111820', '#1c2631', '#edf2f7', '#aab7c4', '#65cbd1', '#ffb74d', '#344353']
          : ['#f3f6f8', '#ffffff', '#172b3a', '#586773', '#00868c', '#a05300', '#dce4e9'];
        ['background', 'card-background', 'text', 'secondary-text-color', 'primary-color', 'warning-color', 'border']
          .forEach((name, i) => document.documentElement.style.setProperty(`--${name}`, colors[i]));
        const now = Date.now();
        const state = (value, attributes = {}) => ({ state: value, attributes });
        const unit = dark ? 'mmol/L' : 'mg/dL';
        const entities = { glucose: 'sensor.sample_glucose', trend: 'sensor.sample_trend',
          delta_mgdl: 'sensor.sample_delta', reading_age: 'sensor.sample_age',
          connected: 'binary_sensor.sample_connected', stale: 'binary_sensor.sample_stale' };
        const readings = Array.from({ length: 361 }, (_, i) => ({
          time_ms: now - (360 - i) * 60000,
          mgdl: Math.round(115 + 15 * Math.sin(i / 40) + 7 * Math.sin(i / 17)),
        })).filter((_, i) => !(i > 160 && i < 190) && (!dark || i <= 342));
        if (!dark) readings[readings.length - 1].mgdl = 123;
        const fixture = { states: {
          [entities.glucose]: state(dark ? 'unavailable' : '123', { unit_of_measurement: unit }),
          [entities.trend]: state(dark ? 'unavailable' : 'Flat'),
          [entities.delta_mgdl]: state(dark ? 'unavailable' : '0', { unit_of_measurement: unit }),
          [entities.reading_age]: state(dark ? '1080' : '0'),
          [entities.connected]: state('on'), [entities.stale]: state(dark ? 'on' : 'off'),
        }, callWS: async () => ({ entities, unit, readings }) };
        const card = document.querySelector('glucifer-card');
        card.setConfig({ entity: entities.glucose, title: 'Glucose', hours: 6 });
        card.hass = fixture;
      }, dark);
      await page.waitForFunction(() => {
        const card = document.querySelector('glucifer-card');
        return card.data && !card.loading;
      });
      await page.locator('main').screenshot({
        path: path.join(__dirname, dark ? 'dashboard-mmol-stale.png' : 'dashboard-mgdl.png'),
      });
    }
    if (errors.length) throw new Error(errors.join('\n'));
    console.log('Captured both dashboard previews from the bundled card using synthetic data.');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
