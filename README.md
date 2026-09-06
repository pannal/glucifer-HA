# Glucifer for Home Assistant

<img src="https://raw.githubusercontent.com/pannal/glucifer-ha/v0.2.1/docs/brand/banner.png" alt="Glucifer HA: horned glucose drop and insulin pen beside the Home Assistant icon and Glucifer HA lettering" width="100%">

Bring [JugglucoNG](https://github.com/ctqvva/JugglucoNG) glucose readings into
Home Assistant through a private webhook. Includes mg/dL and mmol/L,
boolean alert sensors, connection diagnostics, a dashboard card, and optional
history backfill and live journal sync. No separate server or MQTT broker required.

**Requirements:** Home Assistant **2026.9.1+** and a JugglucoNG build with the
**Glucifer HA** outbound API preset. The sender contribution is available in
[JugglucoNG PR #275](https://github.com/ctqvva/JugglucoNG/pull/275); it is not
in an upstream release yet.

> [!CAUTION]
> **Not a medical device.** Do not use readings, alerts, or automations for
> treatment decisions, medication delivery, or emergency monitoring. Data may
> be delayed, missing, stale, or incorrect. An alert being off does not establish
> that glucose is safe. [Full disclaimer](docs/guide.md#medical-disclaimer).

## Quick setup

Connect by scanning a QR code or copying a connection URL. Manual setup works
on the same phone, without a camera or second screen. Use the matching
JugglucoNG build noted above.

1. In **HACS > Custom repositories**, add
   `https://github.com/pannal/glucifer-ha` as an **Integration**. Open its
   download dialog, select the latest stable release, download it, and restart
   Home Assistant. Pre-release tracking is not required.
2. In HA, open **Settings > Devices & services > Add integration > Glucifer HA**.
   Name the phone, choose your glucose unit, and select **Submit**.
3. **Pair the phone:** HA continues directly to the QR code and connection URL.
   The connection is already active. You can reopen these details later through
   **Configure** for that phone; no further submit is needed unless you change settings.
4. In JugglucoNG, open **API destinations** and add a **Glucifer HA** destination.
   **Manual:** copy the connection URL from HA and paste it into **POST URL**.
   **QR:** tap **Scan QR Code**, scan from another screen, and confirm the HA host.
   Turn the destination on. NG saves changes automatically.
5. Choose what to send. Glucose and measurement time are always enabled;
   trend, delta, and alerts start enabled. Other fields and history backfill
   start disabled. **Live events bypass the background interval** starts on:
   glucose, journal, and alert changes send promptly, with a one-second minimum.
   Background sends default to one-second spacing; inactivity checks default
   to **1 hour**. Both controls offer intervals up to **24 hours**. Unchanged,
   acknowledged data is skipped. HA's **Backfill active** sensor shows transfers.
   For journal entries, enable **Sync journal entries**: insulin and carbs are included,
   notes are opt-in, and history defaults to **7 days**.
6. Tap **Send test message** in JugglucoNG. Check that HA shows the glucose
   value and measurement time, then tap **Done** in NG.
7. Refresh your HA browser, edit the dashboard, and choose **Add card > Glucifer HA**.
   Pick the phone's glucose entity. The card registers automatically.

The phone must be able to reach Home Assistant. **Accept local requests only**
starts off for new connections. If HA shows only `/api/webhook/...`, prepend
your Home Assistant URL and paste the complete address into **POST URL**.
Keep the connection URL and QR code private: they contain a secret.

## Screenshots

Browser captures of the bundled card with **synthetic data**, shown in light
and dark themes. These are card previews, not captures from a live HA installation.

| mg/dL with journal markers and history | mmol/L with stale data and journal |
| --- | --- |
| <img src="https://raw.githubusercontent.com/pannal/glucifer-ha/v0.3.0/docs/screenshots/dashboard-mgdl.png" alt="Glucifer card displaying 123 mg/dL, a colored trend arrow, insulin and carbohydrate chart markers, and a journal history list" width="400"> | <img src="https://raw.githubusercontent.com/pannal/glucifer-ha/v0.3.0/docs/screenshots/dashboard-mmol-stale.png" alt="Glucifer card in dark mode with unavailable glucose, a stale-data warning, journal markers, and history in mmol/L" width="400"> |

## Setup details

<details>
<summary><strong>Add the dashboard card</strong></summary>

Glucifer registers its card automatically when the integration starts.
Refresh the browser, edit your dashboard, and choose **Add card > Glucifer HA**.
Select your phone's glucose entity in the visual editor. Its expandable
sections control chart length, journal display, visible details, glucose
ranges, and separate colors for the value and arrow.

Existing resource entries are reused and their versioned URLs update with the
integration. Existing manual cards keep working. If you manage dashboard
resources explicitly in YAML, use the [YAML resource setup](docs/guide.md#yaml-dashboard-resources).

The card finds the receiver's other entities automatically. Enable history
backfill in JugglucoNG to recover up to seven days of retained readings.
Imported readings appear in this card; they do not rewrite HA Recorder history.

[Full dashboard example](examples/dashboard.yaml) ·
[Dashboard and history details](docs/guide.md#dashboard)

</details>

<details>
<summary><strong>Live journal entries</strong></summary>

Enable **Sync journal entries** in the phone's Glucifer destination. Insulin and
carbohydrate entries sync when created, edited, or deleted, without waiting
for a glucose reading. **Include notes and note entries** is a separate opt-in.
Choose how much history to send, from 1 to 90 days; the default is 7 days.

The card shows **▲ insulin**, **● carbohydrates**, and **■ notes** on the
chart. Select a point for its details. In the visual editor's **Journal**
section, enable the optional history list, choose entry types and days,
and set its maximum length (25 entries by default).

Turning off journal sync clears the copy in HA after the phone's next
successful journal request. Hiding the list only changes the card's display.

[Journal settings and limits](docs/guide.md#journal)

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

- Upgrading from an alpha? Select **Update information** in the HACS
  repository menu, then install **v0.2.0** or newer. You can turn off the
  HACS-managed **Pre-release** switch to follow stable releases.
- Want preview releases? Open **Settings > Devices & services > HACS >
  Devices > Glucifer HA**, show disabled entities, enable **Pre-release**,
  and turn it on. HACS creates this switch after downloading and restarting;
  connecting a phone first is not required. Installing an alpha manually
  does not enable prerelease tracking.
- Installing manually? Copy `custom_components/glucifer` into your HA
  configuration directory and restart HA.
- Works only on Wi-Fi? Use a reachable HTTPS endpoint or VPN and check
  **Accept local requests only** in the integration options.
- No updates? Verify the full receiver URL and send a test snapshot.
- Card still looks old? Restart HA after updating and refresh the browser.
  Glucifer updates its resource version automatically for UI-managed resources.
- Optional entity missing? Enable its field and wait for an accepted snapshot.
- Replacing a secret? Select **Replace the connection URL** in the options,
  complete the flow, then update the phone's destination with the new QR code.
- Adding another phone? Add a separate integration entry for each phone.

[Installation](docs/guide.md#installation) ·
[Remote access](docs/guide.md#access-away-from-home) ·
[Troubleshooting](docs/guide.md#troubleshooting) ·
[Secret rotation](docs/guide.md#qr-setup-and-secret-rotation)

</details>

## Donations

[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/Z8Z8X6P9T)

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
