# Glucifer HA guide

[Back to quick setup](../README.md#quick-setup)

## Medical disclaimer

> [!CAUTION]
> **Glucifer HA is not a medical device.** It is experimental software for
> displaying data and experimenting with Home Assistant automations. It is not
> intended to diagnose, treat, cure, or prevent any disease, or to replace a
> glucose monitor, medical advice, or a medical alert system.
>
> Do not use its readings, alert entities, or automations to make insulin dosing
> or other treatment decisions, control medication delivery, or provide
> emergency monitoring. Use your prescribed monitoring equipment and follow
> your clinician's guidance.
>
> Data can be delayed, missing, stale, or incorrect. Network outages, phone
> restrictions, restarts, and software faults can prevent both readings and
> alerts from arriving. An alert shown as off does not establish that your
> glucose is safe. The software is provided without warranty, as described in
> the [license](../LICENSE).

## Requirements

- Home Assistant 2026.9.1 or newer.
- A JugglucoNG build with the **Glucifer HA** outbound API preset.
- A network path from the phone to Home Assistant.
- HACS for managed installation, or access to Home Assistant's configuration
  directory for manual installation.

The integration runs inside Home Assistant. It does not need a separate
container, add-on, or listening port.

## Installation

### HACS custom repository

1. Open HACS, then its menu and **Custom repositories**.
2. Add `https://github.com/pannal/glucifer-ha` with type **Integration**.
3. Download the latest stable release of **Glucifer HA** and restart Home
   Assistant. Pre-release tracking is not required.

To try preview releases, enable the repository's pre-release switch entity
in Home Assistant, turn it on, and refresh the repository information. Turn
it off to follow stable releases.
HACS documents this under [switch entities](https://www.hacs.dev/docs/use/entities/switch/).

The project has not been submitted to the HACS default catalog. A custom
repository installation does not require catalog inclusion.

### Manual installation

Copy `custom_components/glucifer` into your Home Assistant configuration
directory, preserving the path:

```text
config/
└── custom_components/
    └── glucifer/
        ├── __init__.py
        ├── manifest.json
        └── ...
```

Restart Home Assistant after copying the files.

## Connect a phone

1. In Home Assistant, open **Settings > Devices & services > Add integration**
   and search for **Glucifer HA**.
2. Name the phone, for example `My phone`.
3. Select **Submit** to activate the connection. HA continues directly to its
   URL and QR code; scanning does not require another submit. To reopen the
   pairing details later, select **Configure** for the phone. If only
   `/api/webhook/...` is shown, prepend your Home Assistant URL and use manual entry.
4. In the matching JugglucoNG build, open its **API destinations** settings,
   add a **Glucifer HA** destination. For manual setup, copy the connection URL
   from HA and paste it into **POST URL**. You can do this on the same phone;
   no camera or second screen is needed. Alternatively, choose **Scan QR Code**
   and confirm the destination host after scanning.
5. Turn the NG destination on and choose the optional fields and alerts.
   Glucose remains enabled. Changes are saved automatically.
6. Send a test snapshot, check Last success and the glucose value in HA,
   then tap **Done** in NG.

Create a separate integration entry and destination for each phone. A receiver
binds to the source identifier in its first accepted snapshot. To replace
that source, remove the entry and create a new one.

The receiver URL contains its secret. Anyone with the complete URL can send
data to that receiver. Do not include it in screenshots, logs, or issue
reports. Removing the integration entry revokes the URL and deletes the
integration's saved snapshot, glucose history, and journal. Home Assistant Recorder has its own retention
settings for entity history.

## Data selection

Selection belongs to the JugglucoNG destination: disabling a field stops it
being sent, rather than merely hiding its entity in Home Assistant. Each
optional field and each alert type has its own toggle.

| Data | Initial setting | Home Assistant representation |
| --- | --- | --- |
| Glucose and measurement time | Always enabled | Numeric sensor and timestamp sensor |
| Trend | Enabled | Text sensor |
| Glucose delta | Enabled | Numeric sensor |
| Rate of change | Disabled | Numeric sensor |
| Raw glucose | Disabled | Numeric sensor |
| Automatically calibrated glucose | Disabled | Numeric sensor |
| Insulin on board | Disabled | Numeric sensor |
| Carbohydrates on board | Disabled | Numeric sensor |
| Phone battery | Disabled | Battery sensor |
| Sensor identifier | Disabled | Text sensor |
| Sensor generation | Disabled | Numeric sensor |
| Sensor activation and estimated expiry | Disabled individually | Timestamp sensors |
| Sensor warming up | Disabled | Binary sensor |
| History backfill | Disabled | Timestamped readings in the Glucifer dashboard |
| Journal insulin and carbs | Disabled | Chart markers and optional card history list |
| Journal notes | Disabled separately | Note entries and attached notes in the card |
| Each supported alert | Enabled | Binary sensor |

Select **mg/dL** or **mmol/L** in the receiver options. This applies to glucose,
raw and calibrated glucose, delta, and rate of change. Glucose values use
`mg/dL` on the wire. Rate of change uses `mg/dL/min`, insulin
uses units, and carbohydrates use grams. Optional values that the sender
cannot determine are null. They are never replaced with an invented zero.

The protocol envelope also requires a source identifier, sequence number,
schema version, and snapshot timestamp. These identify and order deliveries;
they do not contain a person's name or sensor serial number.

Optional entities appear after their field is first sent. Turning a field
off makes an existing entity unavailable on the next accepted snapshot.
Entities remain in Home Assistant's registry so their identifiers and
automation references survive re-enabling the field.

## Alert states

Alerts are **binary sensors**, with a boolean value in the payload. The
integration does not recalculate glucose thresholds or run a second alert
engine. It follows the alert state reported by JugglucoNG.

- `on`: a production alert fired and is awaiting acknowledgement.
- `off`: the alert was acknowledged, snoozed, or cleared by NG's runtime.
- `unavailable`: the field is disabled, unknown, or stale. This is not an acknowledgement.

With the updated NG sender, Stop/dismiss requests a live `off` push without
waiting for another glucose reading. Phone and watch snooze actions also clear
the exported state. A later actual firing sends `on` again. This lets an HA
automation start lights or sound on `on` and stop them when you acknowledge the
alert on your phone. The live-event option bypasses the background interval by
default; delivery still needs a working connection.

NG keeps its internal episode suppression after dismissal, so acknowledgement
does not immediately re-arm the same alert. Manual alarm tests do not change
production alert values. Older NG builds can leave the value `on` after
Stop/dismiss; install the sender acknowledgement fix from
[NG PR #275](https://github.com/ctqvva/JugglucoNG/pull/275). No HA update is needed
for this sender change.

Supported fields cover low, very low, high, very high, forecast low, forecast
high, missed reading, persistent high, signal loss, sensor expiry, falling
fast, rising fast, and sensor pressure. Availability depends on the sender
build and its enabled features.

## Freshness, retries, and restarts

The default stale interval is five minutes and is configurable in the
integration options. Freshness is checked every 15 seconds. Glucose and its
derived values also use the original measurement timestamp, so a new alert
snapshot cannot make an old glucose reading appear fresh.

The receiver saves a validated snapshot before acknowledging it. Duplicate
deliveries do not refresh the data timestamp, and older sequence numbers do
not overwrite newer state. Restarting or reloading the integration restores
the saved snapshot with its original timestamps.

Home Assistant can return HTTP 200 even for an unknown webhook. The sender
must check Glucifer HA's JSON acknowledgement, including the source and
sequence number, before reporting delivery success.

## Connection diagnostics

Every receiver includes **Connected**, **Glucose stale**, **Last contact**,
**Reading age**, and **Stored history readings**. Connected means a valid
request reached this receiver within the configured stale interval. A phone
can be connected while its glucose is stale. An identical retry updates last
contact without changing the measurement or snapshot time.

The Home Assistant diagnostics download contains configuration flags, selected
field names, and operational status. It omits receiver URLs, source and sensor
identifiers, glucose values, alert values, journal entries, and measurement timestamps.

## Dashboard

The integration includes its dashboard card. It loads no external scripts and
reads history through your authenticated Home Assistant connection.

1. Set up the Glucifer integration and refresh your HA browser.
2. Edit your dashboard, then choose **Add card > Glucifer HA**.
3. Select the phone's glucose entity. Expand **Display**, **Glucose and phone data**, **Sensor data**, **Journal**,
   **Glucose value colors**, or **Trend arrow colors** to adjust the card.
   Save the card when finished.

The integration automatically registers the card in HA's UI-managed dashboard
resources. It reuses existing entries, removes duplicates for its own local
card URL, and updates the version suffix when the integration changes.
Other cards' resources are preserved. No advanced mode or manual JavaScript
resource step is needed for this setup. Restart HA after updating the
integration, then refresh the browser to load the updated card.

The visual editor uses Home Assistant's native controls, including color
pickers. Existing YAML configurations still work; the smallest example is:

```yaml
type: custom:glucifer-card
entity: sensor.phone_glucose
title: Glucose
hours: 24
```

The card finds the selected receiver's trend, delta, freshness, lifecycle, and
active alert entities automatically. Its chart supports 1 to 168 hours and
leaves gaps longer than ten minutes visible. Unknown values remain unknown.
The **More details** button opens the glucose entity. The editor has individual
controls matching each optional field in JugglucoNG, including sensor identifier,
generation, activation, expected end, and warmup. They control display; enabling
one does not enable transmission on the phone. Fields that have not been sent or
are unavailable are omitted. Existing `show_details: false` and
`show_lifecycle: false` YAML settings remain supported.

The main value defaults to left alignment, with the trend arrow on the right.
Under **Display**, **Glucose font size (px)** accepts 24 to 96 pixels (default 42),
and **Glucose alignment** offers left or centered across the whole card. **Arrow size (px)** accepts
24 to 160 pixels (default 84). **Arrow length (px)** accepts 24 to 240 pixels
along the arrow direction; **Arrow stroke width (px)** accepts 1 to 16 pixels.
Leave either empty to scale it with arrow size. Numeric settings have sliders
and entry fields. The selected glucose font size applies whenever it fits;
text and arrows shrink when needed on narrow cards.
**Glucose font weight** and **Glucose font style** control weight and italics.
**Glucose font family** accepts a browser font such as `Arial`, `Georgia` or
`monospace`, including CSS fallback lists. Leave it empty for the dashboard font.
No fonts are downloaded, so availability depends on the device. All single
arrows use the same centered SVG shape, rotated for their direction.
**Arrow position** keeps the arrow at the right edge, either beside glucose
(the default) or lower beside the delta and IOB lines.
**Show logo**, enabled by default, displays the transparent Glucifer mark at the
right of the title. **Show glucose unit**, also enabled by default, controls
the unit beside the main value.
Chart and detail units stay visible. Reading age shows seconds from the original
measurement time. Only that label updates every second; unrelated HA state
changes do not redraw the chart or request history. Journal details stay open
until closed, removed, or hidden by a filter.

Sensor and journal dates use your HA profile's language, date order, 12/24-hour
format, and browser/server time-zone preference. UTC timestamps are converted
before display. **Locale** is a dropdown with **Use Home Assistant**, German
and English variants, plus custom locale codes. German locales translate card
and editor labels and display insulin units as `E`, including IOB, eIOB and
journal entries. Generic “Note” entries become “Notiz”; custom names and notes
stay unchanged. Other locales currently fall back to English labels while
formatting numbers and dates for the selected region. Glucose units and time
zone stay as configured in HA.
Display edits keep the loaded history, subscription, zoom and journal selection;
a change of glucose entity clears the old receiver's data. Because HA recreates
preview elements after config edits, recent history and pending requests are
shared by connection, user and receiver. This memory-only cache retains at most
eight receiver/user combinations per connection for five minutes. It preserves
original measurement timestamps and never substitutes old history for an
explicitly empty response.

The card reuses HA's native chart component with Glucifer's stored readings.
Hover to inspect values, hold Ctrl (Command on Mac) while scrolling to zoom,
drag to pan once zoomed, and use HA's reset control to restore the full window.
The cursor is normal at the full range and becomes a grab cursor when zoomed. Touch
screens support pinch zoom. Journal pills remain selectable while zoomed. Click an entry again to close
its details. Hovering journal markers or chips suppresses the glucose tooltip.
A journal row is expandable when it has an additional note. Its expanded area
shows the note without repeating the name, amount or time. Rows without extra
information are plain text. Selecting a chart pill highlights its visible row
and opens the note, if present. When the row is hidden, collapsed or excluded
by the list limit, the separate panel shows the full entry. Selecting the same
chart pill again clears the selection.

Colored pills show insulin units, carbohydrate grams, or the note label, with
connector lines to their glucose anchors. Nearby pills are staggered; crowded
labels are hidden when they cannot fit. Zoom in to see more labels.
**Show chart marker symbols and legend** optionally adds clickable triangles,
circles and squares at the anchors, plus their legend. Both are hidden by default.
If HA's chart module cannot load, a basic chart remains available.

Under **Journal**, **Compact journal list** is enabled by default. Turn it off
to restore padded, bordered rows. The **Journal** heading expands or collapses
the list in either mode. Your browser remembers the choice for that receiver
and dashboard view. It does not change journal sync or chart markers.

The glucose value and trend arrow have separate color controls. Default
value boundaries are **54, 70, 180, and 250 mg/dL**: dark red below 54, red
below 70, green from 70 through 180, amber above 180, and red above 250.
Boundaries are always entered in mg/dL; mmol/L values are converted for the
color comparison. These are display settings, not treatment targets or
changes to JugglucoNG's alerts.

The arrow defaults to green for stable, amber for rising or falling, and red
for rapid changes (double arrows). Each group has its own color picker.
Either color system can be disabled independently.

For a complete dashboard, copy [examples/dashboard.yaml](../examples/dashboard.yaml)
into a new dashboard's raw configuration editor and replace its example entity
IDs. Refresh the browser after updating the integration's card.

### Active insulin (eIOB)

With a compatible NG sender, select **Show effective IOB (eIOB)** in the Glucifer destination to send the optional `eiob_u` field. Enable **Active insulin (eIOB)** in the card editor to display `IOB: 5.2 U (eIOB: 1.7 U)`. If IOB is hidden, eIOB appears on its own. Missing values stay hidden; zero remains a valid value. Update HA to Glucifer 0.5.0 or later before enabling this sender field.

### YAML dashboard resources

If you explicitly manage resources in YAML, that configuration remains
authoritative. Add this entry to your existing resource list:

```yaml
- url: /glucifer/glucifer-card.js?v=0.4.1
  type: module
```

Reload the YAML resources and refresh the browser. Update the version suffix
after an integration upgrade if the browser keeps an older card. Glucifer
does not rewrite YAML files. A dashboard written in YAML can still use
UI-managed resources; the exception depends on the resource collection's
mode, not on the dashboard itself.

## Automation blueprints

Two blueprints provide configurable actions for informational lights, displays,
and notifications:

- [Alert actions](../blueprints/automation/alert_actions.yaml)
- [Stale data actions](../blueprints/automation/stale_actions.yaml)

Import the desired file's GitHub URL under **Settings > Automations & scenes >
Blueprints > Import blueprint**, or copy the files into
`config/blueprints/automation/glucifer/` and reload automations. Select one
receiver alert or its glucose-stale indicator, then configure the actions.

Both blueprints trigger only on an explicit **off to on** transition. Becoming
available in an already active state does not trigger them. Quiet hours default
to 22:00 through 07:00; the cooldown defaults to 15 minutes. Overnight and
same-day quiet periods are supported. Equal start and end times disable the
quiet period. Suppressed actions are not queued for later replay.

## Sensor lifecycle

Activation and estimated expiry come from the selected sensor's existing
metadata. Missing dates are unknown; the sender does not invent a lifespan.
Warmup is boolean where the sensor runtime can determine it. Current support
includes iCan, Ottai, Anytime CT5, and native Dexcom warmup. Other sensor types
may report null for warmup while still providing activation and expiry.
These fields are individually disabled by default and refer to the selected
glucose source. A receiver still needs a glucose reading to accept a snapshot.

## Update timing and precision

New glucose readings, journal changes, alert changes, and destination edits
trigger updates. Normal cadence follows the connected glucose source.

| Setting | Default | Behavior |
| --- | --- | --- |
| Live events bypass the background interval | On | Live events can send with a one-second minimum, independently of background pacing. Turn off to apply the selected interval to live events too. |
| Check for missed updates after | 1 hour | Rechecks the data after no successful live push for this period. A successful live push restarts the timer. |
| Minimum gap between background requests | 1 second | Paces history batches and changed snapshots found by background checks. Pending live updates take priority. |

The timing controls offer 1, 5, 10, 30, 60, 120, 360, 900, and 1800 seconds,
plus 1, 6, 12, and 24 hours. Existing selected intervals survive upgrades.
The request pause limits pending work; it does not schedule continuous sends.
With live bypass off, the screen labels it **Minimum gap between all requests**.
All requests remain at least one second apart. History waits for its next slot
without polling every second during a long background interval.

Unchanged, acknowledged snapshots are skipped regardless of elapsed time.
A new measurement timestamp counts as changed data even if its glucose value
is identical. Explicit manual tests and retries of unacknowledged deliveries
can resend data. Neither changes an old reading's measurement time.

Live numeric fields are rounded to one decimal before sending and in HA,
including after unit conversion. The card displays glucose as whole mg/dL or
one decimal in mmol/L. Journal amounts preserve the recorded value on the
wire and display up to two decimal places. Timestamps, identifiers, and boolean alerts retain
their original types. Unchanged rounded measurements do not trigger extra
sends. Delivery status refreshes while the NG settings screen is visible.

## QR setup and secret rotation

Home Assistant renders the QR code locally. Its contents are the same private
receiver URL accepted by manual setup; no external QR service receives it.
JugglucoNG validates scanned URLs and asks you to confirm the host before
saving. Scanning leaves field selection and history preferences unchanged.

To replace a receiver secret, open the integration's options and select
**Replace the connection URL**. The next screen shows the new URL and QR code.
Submitting that screen revokes the old URL. Update the existing JugglucoNG
destination with the new QR code or URL. Entity IDs, source binding, and stored
readings are preserved. Closing the flow before submitting leaves the old URL
active. A replacement phone still requires a new receiver entry.

## History backfill

Enable **Backfill glucose history (up to 7 days)** on a JugglucoNG destination
to fill gaps from the phone's selected sensor history. It requires the 0.2
receiver and matching sender. Live snapshots continue to contain mandatory
glucose regardless of this setting.

Historical batches contain only glucose and original measurement timestamps.
They cannot carry alerts, replace the current reading, or make stale data
fresh. Each batch contains at most 256 readings. The sender saves a pending
batch before delivery and advances its cursor only after a matching receipt.
It revisits the seven-day window hourly to catch late arrivals and skips
acknowledged timestamps, including readings already sent live. The acknowledgement
record is bounded to the receiver's 20,160-reading limit. When upgrading from a
sender that only stored a cursor, the already acknowledged prefix is kept;
that old prefix is not scanned for gaps. Available history depends on what the
phone has retained.

The diagnostic binary sensor **Backfill active** is on during a transfer and
off when it finishes or backfill is turned off. It stays on between paced batches.
If contact is lost, it becomes unavailable. This requires the matching sender;
older senders leave its state unavailable. Status messages contain no glucose
or alert values and are sent only when the state changes or a receipt needs retrying.

The receiver retains up to seven days or 20,160 readings, whichever is smaller,
including readings received live. Repeated timestamps retain the first recorded
value. The Glucifer card displays this history at measurement time. Home
Assistant's ordinary Recorder graph still records live entity changes; imported
readings are not injected into Recorder as new state changes. Removing a
receiver deletes its Glucifer history. Recorder retention is separate.

## Journal

Journal sync requires Glucifer HA **0.3.0+** and a matching JugglucoNG build.
Enable **Sync journal entries** in the Glucifer destination on the phone. It starts
off. Enabling it sends insulin and carbohydrate entries, including their
amounts, preset labels, and original timestamps. **Include notes and note entries**
starts off separately; turn it on to include note entries and notes attached
to insulin or carbohydrate entries.

Creating, editing, or deleting an entry wakes the sender. Journal changes
have their own delivery sequence and do not wait for a new glucose reading.
The existing **Live events bypass the background interval** option applies;
all requests still share a one-second minimum gap. Retries preserve the
pending change, and acknowledged entries are only sent again if they change.

The sender offers **1, 3, 7, 14, 30, 60, or 90 days** of journal history,
with **7 days** selected initially. HA stores at most **5,000 entries** within
that window, retaining the newest. Changes travel in batches of at most
16 entries or deletions. Initial journal transfer and glucose history backfill
are separate; **Backfill active** describes glucose history transfers.

In the card's visual editor, the **Journal** section controls:

| Option | Default | Effect |
| --- | --- | --- |
| Show journal points on chart | On | Marks entries at their original time within the chart window. |
| Show journal history list | Off | Adds a selectable list, newest first. |
| Journal history days | 7 | Filters the card to 1 through 90 days, limited by the sender's retained data. |
| Maximum entries in the list | 25 | Shows up to 1 through 200 entries. |
| Journal entry types | All three | Filters insulin, carbohydrates, and notes locally. |

Markers use a purple triangle for insulin, an orange circle for carbs, and a
teal square for notes. Select a marker or list entry to read its details.
Markers use the nearest measured glucose within ten minutes for their height;
without a nearby reading they sit along the bottom of the chart. They do not
create glucose measurements or fill gaps. Open cards receive change
notifications through the authenticated HA connection, so journal edits
appear without waiting for the chart's background refresh.

Hiding a card section does not stop sync. Turning **Sync journal entries** off on the
phone clears HA's journal after the next successful journal request. Turning
notes off removes them as entries are updated or deleted in subsequent
batches. If the phone cannot reach HA, its previously delivered data remains
until it expires or the integration entry is removed. Journal data is stored
by Glucifer, outside HA Recorder; removing the integration deletes that copy.

## Access away from home

**Accept local requests only** is off by default for new receivers. Existing
receivers keep their saved setting. For remote reception, use a reachable HTTPS
Home Assistant endpoint or a VPN. A LAN URL will stop working when the phone leaves that
network unless the VPN provides a route back to it.

This integration does not provide Clone pairing, ICE/TURN connectivity,
automatic public access, or Nabu Casa cloudhook registration. It does not
expose the phone's HTTP server.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| No entities update | Finish integration setup, verify the full receiver URL, and send a test snapshot. |
| HTTP 200 but no delivery confirmation | Check the URL. A generic webhook success response is not a Glucifer HA acknowledgement. |
| Works on Wi-Fi only | Verify the phone can reach Home Assistant from its other network and check local-only reception. |
| Glucose is unavailable but alerts update | Check the measurement time. The glucose reading may be stale even though the phone is communicating. |
| Optional entity is missing | Enable that field in JugglucoNG and wait for an accepted snapshot. |
| Alert becomes unavailable after disabling it | Expected: disabled does not mean the alert condition is false. |
| Journal does not appear | Update both HA and the phone, enable Sync journal entries, and check the card's journal filters. |
| Visual editor or arrows are missing | Restart HA after updating and refresh the browser. Resource versions update automatically; explicitly managed YAML resources need the declaration above. |
| Source mismatch | The endpoint already belongs to another source. Create a separate receiver entry. |

When reporting a problem, include both software versions and the error code.
Remove webhook URLs, credentials, sensor identifiers, and personal glucose
data from logs and screenshots.

## Development

The wire contract is described in [docs/protocol.md](protocol.md).
Tests use Home Assistant's custom integration test harness and exercise real
HTTP handling, config flows, entity states, persistence, freshness, historical
batches, and blueprint validation. Browser tests exercise the bundled card
with synthetic data.
The test target is Home Assistant 2026.9.1 on Python 3.14.2 or newer.
Install [uv](https://docs.astral.sh/uv/getting-started/installation/) first.
The override file selects the current stable patch because the latest test
harness still pins 2026.9.0. Update both pins when upgrading Home Assistant.

```sh
uv venv --python 3.14
uv pip install -r requirements-test.txt --override requirements-test-overrides.txt
.venv/bin/python -m pytest
.venv/bin/ruff check .
npm ci
npx playwright install chromium
npm test
```

## License

Glucifer HA is licensed under the **GNU General Public License, version 3
or any later version** (`GPL-3.0-or-later`). See [LICENSE](../LICENSE) for the
full license text. This matches JugglucoNG's licensing and allows compatible
code sharing between the sender and receiver.

Copyright (C) 2026 pannal and contributors. JugglucoNG and any reused assets
retain their respective copyrights.


## Prediction curves

Requires Glucifer **0.6.0+** and a JugglucoNG build with prediction export.
In NG's Glucifer API destination, enable **Prediction** (**Prognose** in German).
Keep NG's main prediction setting enabled. In the card editor, under **Display**,
enable **Show prediction curves** (**Prognosekurven anzeigen**). Both export and
card display are off by default.

The dashed lines extend into the future using NG's current raw, auto and
calibrated curves, according to its sensor display mode and calibration settings.
The horizon and model settings come from NG. Hover a curve to see its name, time
and projected value. These are model projections, separate from stored glucose
readings. The card hides them when their baseline is over ten minutes old.
Journal saves can change the curves immediately, without waiting for new glucose.

## Alert automation sessions

For lights or sound that should stop after phone acknowledgement, import
[Glucifer alert start and stop](../blueprints/automation/alert_session.yaml).
Select all alerts that share those outputs in one automation. Configure Start
and Cleanup actions, then optionally add Repeat actions, an interval, and lights
to restore. HA's action editor lets you choose devices, entities or an area such
as the bedroom. Quiet hours are disabled by default in this blueprint.

The session continues while any selected alert is on. Once none is on, Cleanup
runs. If every selected alert is explicitly off, the Acknowledged or cleared
actions run next; otherwise the Connection-loss actions run. An unavailable
alert is never treated as acknowledgement. Recovered active alerts can start a
new session. Repeated sounds stop waiting immediately when no alert remains on.
Keep action sequences short; long delays or loops inside your own actions delay
cleanup. Use Repeat actions for repeated sounds.

Optional light restoration captures their state once at session start, then
restores it after cleanup. Use one automation for outputs shared by several
alerts to avoid competing light snapshots. HA reloads/restarts discard temporary
scene snapshots and running actions. After a restart, an alert that is still on
can start a new session, but the original pre-restart light state is not restored.

The older Alert actions and Stale data actions blueprints keep their existing
activation-only behavior, quiet hours and cooldown settings. Importing the new
blueprint does not replace your existing automations.

## Alert reasons and timeline

With the updated NG sender, each alert boolean has `reason`, `changed_at_ms`,
and `snoozed_until_ms` attributes while available. Reasons are:

| Reason | What NG reported |
| --- | --- |
| `fired` | An actual production alert fired. |
| `acknowledged` | The user acknowledged the alert. |
| `snoozed` | NG accepted a snooze, with its deadline. |
| `cleared` | NG reset an active episode or first evaluated it as inactive. |

These describe the last reported action. A past snooze deadline does not imply
that NG fired again. `cleared` can also result from an active window ending;
it does not establish a particular glucose condition.

**Alert activity** is a native HA event entity with the alert name, reason,
phone event timestamp and stable event ID. Its HA state timestamp is reception
time; `time_ms` is when the event happened on the phone. A buffered event may
arrive later. Use the booleans for current-state actions, and the event entity
when you need a particular reported reason.

Enable **Show alert history** in the card editor for a collapsible timeline.
**Alert history entries** selects 1 to 100 rows, default 20. HA retains at most
256 received events for seven days, separately from glucose and journal data.
Duplicates and reloads do not replay events. NG sends the latest 32 changes in
its current process, preserving quick fire/acknowledge pairs that share a data
push. This is a bounded activity history, not a complete alert archive.

Existing senders still work; they provide booleans without reasons. Install the
NG build with lifecycle metadata and Glucifer HA 0.7.0 for the timeline.

## Understanding connection status

The device's diagnostic entities distinguish the following conditions:

| Status | Meaning |
| --- | --- |
| Waiting for first snapshot | This receiver has not accepted initial data. |
| Sender has not contacted HA | No accepted request within the configured stale interval. |
| Snapshot is stale | Recent contact exists, but the live snapshot is too old. History or journal traffic can cause this. |
| Glucose is stale | The snapshot is current, but its glucose measurement is old. |
| Some alert states are unknown | NG included an alert without a known boolean. |
| Alerts disabled | No alerts are selected in the current snapshot. |

**Alert data status** also has an `alerts` attribute with a reason for each
previously seen alert, including `field_disabled` and `alert_state_unknown`.
HA removes extra attributes from unavailable entities, so use this diagnostic
to investigate an unavailable alert. Unloading the integration makes its
entities unavailable; a stopped integration cannot publish its own diagnosis.

**Snapshot age** measures the age of the latest live snapshot. **Reading age**
measures the glucose timestamp. **Background sending interval** comes from NG;
`live_events_bypass_interval` is available on the status entities. An old sender
leaves that reporting information unknown. The interval is a fallback, not a
heartbeat: unchanged data is still skipped.

**Observed reading interval** is the median of the last eight positive gaps
between live glucose timestamps, available after three gaps. Gaps over fifteen
minutes, duplicate timestamps and history backfill are excluded. This estimate
can include missed readings; it is not a sensor specification and does not
change the configured stale threshold.

## Test an automation without a real alert

1. Include this receiver's **Test alert** sensor in the new session blueprint's
   selected alerts. Set the actions you want to exercise.
2. On the Glucifer device page, press **Start test alert**. Its separate sensor
   turns on, allowing that automation to run the configured actions.
3. Press **Acknowledge test alert**. The test sensor turns off and cleanup runs,
   provided no other selected alert remains on.
4. Start another test and press **Test connection loss** to check the separate
   connection-loss path.

Active and disconnected tests reset after 60 seconds. The **Glucifer: Test alert
automation** action also offers snooze/clear phases and a reset duration from
1 to 300 seconds. Tests reset on integration reload and do not survive restart.
They never send commands to NG, change production alert booleans, refresh contact
or measurement timestamps, or add glucose, journal or production alert history.
The selected automation can operate real lights and speakers during the test.
