# Glucifer for Home Assistant

<img src="https://raw.githubusercontent.com/pannal/glucifer-ha/main/docs/brand/banner.png?v=0.5.1" alt="Glucifer HA: horned glucose drop and insulin pen beside the Home Assistant icon and Glucifer HA lettering" width="100%">

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

| mg/dL with journal markers and history | mmol/L with journal markers and history |
| --- | --- |
| <img src="https://raw.githubusercontent.com/pannal/glucifer-ha/main/docs/screenshots/dashboard-mgdl-interactive.png?v=0.5.1" alt="Glucifer card displaying 123 mg/dL, a colored trend arrow, insulin and carbohydrate chart markers, and a journal history list" width="400"> | <img src="https://raw.githubusercontent.com/pannal/glucifer-ha/main/docs/screenshots/dashboard-mmol-interactive.png?v=0.5.1" alt="Glucifer card in dark mode displaying 6.8 mmol/L, a colored trend arrow, journal markers, and a journal history list" width="400"> |

<details>
<summary><strong>More card layouts</strong></summary>

| Centered value, hidden unit and active insulin | Expanded journal, optional markers and hidden logo |
| --- | --- |
| <img src="https://raw.githubusercontent.com/pannal/glucifer-ha/main/docs/screenshots/dashboard-centered-active-insulin.png?v=0.5.1" alt="Dark card with a centered 6.8 glucose value and Insulin on board: 5.2 U (Active: 1.7 U)" width="400"> | <img src="https://raw.githubusercontent.com/pannal/glucifer-ha/main/docs/screenshots/dashboard-expanded-journal.png?v=0.5.1" alt="Light card with a larger 123 mg/dL value, optional chart markers and padded journal rows" width="400"> |

**Arrow position: lower, beside delta and IOB** keeps the arrow on the right
while giving the glucose value its own row.

<img src="https://raw.githubusercontent.com/pannal/glucifer-ha/main/docs/screenshots/dashboard-lower-arrow.png?v=0.5.1" alt="Centered glucose above the delta and active insulin details, with the trend arrow at the right of the details" width="400">

These options are available in the card's visual editor.

</details>

## Setup details

<details>
<summary><strong>Add the dashboard card</strong></summary>

Glucifer registers its card automatically when the integration starts.
Refresh the browser, edit your dashboard, and choose **Add card > Glucifer HA**.
Select your phone's glucose entity in the visual editor. Its expandable
sections control glucose size and alignment, chart length, journal display, visible details, glucose
ranges, and separate colors for the value and arrow.

Existing resource entries are reused and their versioned URLs update with the
integration. Existing manual cards keep working. If you manage dashboard
resources explicitly in YAML, use the [YAML resource setup](docs/guide.md#yaml-dashboard-resources).

The card finds the receiver's other entities automatically. Enable history
backfill in JugglucoNG to recover up to seven days of retained readings.
The chart uses HA’s hover, zoom, and reset controls. Reading age shows seconds;
the trend arrow sits on the right. **Arrow size** defaults to 84 px; all
single arrows use the same SVG shape. **Arrow position** keeps it beside glucose
or moves it lower beside the delta/IOB lines. **Glucose font size** defaults to 42 px.
**Glucose alignment** can be left or centered across the whole card. **Show glucose unit** controls
the unit beside the main value. Large sizes scale down on narrow cards.

For eIOB, enable **Show effective IOB (eIOB)** in NG's Glucifer destination
and **Active insulin (eIOB)** in the card editor. With IOB visible, the card
shows `Insulin on board: 5.2 U (Active: 1.7 U)`. Both switches default to off;
this requires the NG sender with eIOB support and Glucifer 0.5.0 or later.

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

The chart shows journal pills with colored icons, amounts and connector lines.
**Show chart marker symbols and legend** adds the triangle/circle/square markers
and their legend; it is off by default. Select a pill
(or a marker when enabled) for details; select it again to close them. Hovering a journal
entry hides the glucose tooltip. In the visual editor's **Journal**
section, enable the optional history list, choose entry types and days,
and set its maximum length (25 entries by default). **Compact journal list**
is enabled by default; turn it off for padded, bordered rows. Click the
**Journal** heading to collapse the list. Your browser remembers that choice.

Turning off journal sync clears the copy in HA after the phone's next
successful journal request. Hiding the list only changes the card's display.

[Journal settings and limits](docs/guide.md#journal)

</details>

<details>
<summary><strong>Fields, alerts, and automations</strong></summary>

Each optional field and alert has its own toggle in JugglucoNG. The card’s
**Glucose and phone data** and **Sensor data** controls use the same field names
and only change what the card displays. Sensor dates follow your HA profile’s
date, time, and time-zone preferences. Disabled or
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
