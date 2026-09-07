Browser checks run against the bundled card. `check.cjs` covers standalone
fallback rendering, editor controls, localization, subscriptions, and races.
`native-check.cjs` uses the real chart and ECharts modules from HA 2026.9.1's
frontend package. It checks canvas clicks, tooltips, gaps, zoom, and updates.
It also runs `editor-check.cjs` against HA's native form: default radio selection,
slider dragging and keyboard input, numeric entry, typography and locale edits,
configuration round trips, and retained preview data during an incoming push.
`preview-check.cjs` destroys and recreates cards like HA's preview wrapper. It
checks immediate history reuse, shared pending requests, receiver/user/connection
isolation, cache expiry and authoritative empty history responses. Native chart
checks cover inline details and fallbacks, German pills, and cursor changes when
zooming and resetting.

Use Python 3.14 or newer to prepare the official frontend package without
installing it into HA:

```sh
python3 -m pip download --no-deps home-assistant-frontend==20260826.6 -d /tmp/glucifer-frontend
python3 -m zipfile -e /tmp/glucifer-frontend/home_assistant_frontend-20260826.6-py3-none-any.whl /tmp/glucifer-frontend/unpacked
export GLUCIFER_HA_FRONTEND=/tmp/glucifer-frontend/unpacked/hass_frontend
npm ci
npx playwright install chromium
npm test
node tests/frontend/native-check.cjs
node docs/screenshots/capture.cjs
```

The native harness replaces only the frontend application's startup entry to
avoid requiring a login or live server. It supplies dashboard theme context
and synthetic states; chart code and interaction handlers are unmodified.
The pinned chunk map in `ha-native.cjs` must be updated when the frontend
version changes. No frontend binaries are committed or shipped with the card.

Prediction checks exercise real HA dashed series, opt-in and clearing, future time bounds, German labels, mmol/L conversion, live curve replacement and stale suppression.
