// Real HA frontend 20260826.6 (HA 2026.9.1), downloaded separately for tests.
// Only application startup is replaced so tests need no login or live HA server.
// Component modules, ECharts, tooltips and interaction handlers are unmodified.
const fs = require('node:fs');
const path = require('node:path');
async function loadNativeChart(page) {
  const base = process.env.GLUCIFER_HA_FRONTEND;
  if (!base) throw new Error('Set GLUCIFER_HA_FRONTEND to the extracted hass_frontend directory.');
  const latest = path.join(base, 'frontend_latest');
  const app = 'app.9b4b1551e3718430.js';
  await page.route('http://glucifer.test/**', async route => {
    const pathname = new URL(route.request().url()).pathname;
    if (pathname === '/') return route.fulfill({contentType:'text/html',body:'<body></body>'});
    if (pathname === '/glucifer/icon.png') return route.fulfill({contentType:'image/png',path:path.join(__dirname,'../../custom_components/glucifer/brand/icon.png')});
    const file = path.join(base, pathname);
    let body = fs.readFileSync(file);
    if (path.basename(file) === app) {
      const source = body.toString();
      if (!source.includes('o(91535);')) throw new Error('Unexpected HA frontend build');
      body = source.replace('o(91535);', 'window.haTestRequire=o;');
    }
    return route.fulfill({contentType:file.endsWith('.json') ? 'application/json' : 'application/javascript',body});
  });
  await page.goto('http://glucifer.test/');
  await page.addScriptTag({type:'module',url:`http://glucifer.test/frontend_latest/${app}`});
  const chunks = [1990,35583,56418,41825,91121,94964,45995,96264,75644];
  const shared = [59050,13969,13471,10124,10077,11361,42725,12469,52621,13178]
    .map(id=>fs.readdirSync(latest).find(file=>file.startsWith(`${id}.`) && file.endsWith('.js')));
  await page.evaluate(async ({chunks, shared}) => {
    const require = window.haTestRequire;
    await Promise.all(chunks.map(id=>require.e(id)));
    const missing = {};
    for (const file of shared) {
      const module = await import(`/frontend_latest/${file}`);
      for (const [id, fn] of Object.entries(module.__webpack_modules__ || {})) {
        // Shared chunks may carry a subset of exports; use the complete definition.
        if (!require.m[id] && (!missing[id] || missing[id].toString().length < fn.toString().length)) missing[id] = fn;
      }
    }
    Object.assign(require.m, missing);
    await require(75206);
    // A dashboard normally supplies this Lit context to the chart.
    document.addEventListener('context-request', event => {
      if (event.context !== 'hassUi') return;
      event.stopPropagation();
      event.callback({themes:{darkMode:document.documentElement.dataset.theme === 'dark'}},()=>{});
    });
  }, {chunks, shared});
}
module.exports = {loadNativeChart};
