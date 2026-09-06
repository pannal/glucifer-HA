# Glucifer for Home Assistant

<img src="https://raw.githubusercontent.com/pannal/glucifer-ha/e6475a0ff13b750936a37f4d0ea238efa1d1c5c3/docs/brand/banner.png" alt="Glucifer HA: horned glucose drop, chart, and insulin pen beside the Home Assistant icon and Glucifer HA lettering" width="100%">

Bring [JugglucoNG](https://github.com/ctqvva/JugglucoNG) glucose readings into
Home Assistant through a private webhook. Includes mg/dL and mmol/L,
boolean alert sensors, connection diagnostics, a dashboard card, and optional
history backfill. No separate server or MQTT broker required.

**Alpha:** requires Home Assistant **2026.9.1+** and a JugglucoNG build with the
**Glucifer HA** outbound API preset. That sender is not in an upstream release
yet. Live phone-to-Home-Assistant testing is still pending.

> [!CAUTION]
> **Not a medical device.** Do not use readings, alerts, or automations for
> treatment decisions, medication delivery, or emergency monitoring. Data may
> be delayed, missing, stale, or incorrect. An alert being off does not establish
> that glucose is safe. [Full disclaimer](docs/guide.md#medical-disclaimer).

## Quick setup

Pair with a QR code from Home Assistant. Have HA open on a computer or another
screen so your phone can scan it. Use the matching JugglucoNG build noted above.

1. In **HACS > Custom repositories**, add
   `https://github.com/pannal/glucifer-ha` as an **Integration**. Enable
   pre-release versions, download Glucifer HA, and restart Home Assistant.
2. In HA, open **Settings > Devices & services > Add integration > Glucifer HA**.
   Name the phone, choose your glucose unit, and finish receiver setup.
3. **Display the QR code:** open that receiver's integration options in HA.
   Leave the QR code visible on screen.
4. **Scan it in JugglucoNG:** open **API destinations**, add a **Glucifer HA**
   destination, and tap **Scan QR Code**. Scan the code, confirm the Home
   Assistant host, then enable and save the destination.
5. Choose what to send. Glucose and measurement time are always enabled;
   trend, delta, and alerts start enabled. Other fields and history backfill
   start disabled.
6. Tap **Send test message** in JugglucoNG. Check that HA shows the glucose
   value and measurement time.

The phone must be able to reach Home Assistant. If you cannot scan the code,
paste the complete receiver URL into the destination instead. If HA shows only
`/api/webhook/...`, prepend your Home Assistant URL and use manual entry.
Keep the receiver URL and QR code private: they contain the receiver secret.

## Screenshots

Browser captures of the bundled card with **synthetic data**, shown in light
and dark themes. These are card previews, not captures from a live HA installation.

| mg/dL with history | mmol/L with stale data |
| --- | --- |
| <img src="https://raw.githubusercontent.com/pannal/glucifer-ha/main/docs/screenshots/dashboard-mgdl.png" alt="Glucifer card displaying 123 mg/dL and a six-hour history chart" width="400"> | <img src="https://raw.githubusercontent.com/pannal/glucifer-ha/main/docs/screenshots/dashboard-mmol-stale.png" alt="Glucifer card displaying unavailable glucose, a stale-data warning, and history in mmol/L" width="400"> |

## Setup details

<details>
<summary><strong>Add the dashboard card</strong></summary>

Enable advanced mode in your Home Assistant profile, then open
**Settings > Dashboards > Resources**. Add `/glucifer/glucifer-card.js` as a
**JavaScript module**. Add a manual card and replace the example entity ID:

```yaml
type: custom:glucifer-card
entity: sensor.phone_glucose
title: Glucose
hours: 24
```

The card finds the receiver's other entities automatically. Enable history
backfill in JugglucoNG to recover up to seven days of retained readings.
Imported readings appear in this card; they do not rewrite HA Recorder history.

[Full dashboard example](examples/dashboard.yaml) ·
[Dashboard and history details](docs/guide.md#dashboard)

</details>

<details>
<summary><strong>Fields, alerts, and automations</strong></summary>

Each optional field and alert has its own toggle in JugglucoNG. Disabled or
unknown fields become unavailable, never an invented zero or false value.
Alerts reflect JugglucoNG's active episodes as `on` or `off`; stale alerts
become unavailable. The default stale interval is five minutes.

Import [Alert actions](blueprints/automation/alert_actions.yaml) or
[Stale data actions](blueprints/automation/stale_actions.yaml) under
**Settings > Automations & scenes > Blueprints > Import blueprint**, using
the file's GitHub URL. Both support quiet hours and a cooldown.

[Field defaults](docs/guide.md#data-selection) ·
[Alert behavior](docs/guide.md#alert-states) ·
[Blueprint behavior](docs/guide.md#automation-blueprints)

</details>

<details>
<summary><strong>Installation help, remote access, and troubleshooting</strong></summary>

- Alpha missing in HACS? Enable the repository's pre-release switch entity,
  turn it on, and refresh repository information.
- Installing manually? Copy `custom_components/glucifer` into your HA
  configuration directory and restart HA.
- Works only on Wi-Fi? Use a reachable HTTPS endpoint or VPN and check
  **Accept local requests only** in the integration options.
- No updates? Verify the full receiver URL and send a test snapshot.
- Optional entity missing? Enable its field and wait for an accepted snapshot.
- Replacing a secret? Select **Replace the receiver secret** in the options,
  complete the flow, then update the phone's destination with the new QR code.
- Adding another phone? Create a separate receiver for each phone.

[Installation](docs/guide.md#installation) ·
[Remote access](docs/guide.md#access-away-from-home) ·
[Troubleshooting](docs/guide.md#troubleshooting) ·
[Secret rotation](docs/guide.md#qr-setup-and-secret-rotation)

</details>

## Development disclosure

This project is developed with AI assistance, guided by a software developer
with 24+ years of experience.

## Reference and license

[Full guide](docs/guide.md) · [Protocol](docs/protocol.md) ·
[Development](docs/guide.md#development) ·
[Releases](https://github.com/pannal/glucifer-ha/releases)

Licensed under [GPL-3.0-or-later](LICENSE), matching JugglucoNG.
Copyright (C) 2026 pannal and contributors. Reused assets retain their
respective copyrights.
