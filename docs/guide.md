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
3. Enable pre-release versions in HACS if selecting an alpha release, download
   **Glucifer HA**, and restart Home Assistant.

If the alpha is missing from HACS, enable the repository's pre-release switch
entity in Home Assistant, turn it on, and refresh the repository information.
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
2. Name the sender, for example `My phone`.
3. Finish receiver setup. The setup and options screens show its URL and a
   QR code. If only `/api/webhook/...` is shown, prepend your Home Assistant
   URL and use manual entry.
4. In the matching JugglucoNG build, open its **API destinations** settings,
   add a **Glucifer HA** destination, and choose **Scan QR Code** or paste the
   complete URL. Confirm the destination host after scanning.
5. Choose the optional fields and alerts to send. Glucose remains enabled.
6. Send a test snapshot and check that Home Assistant shows its glucose value
   and measurement time.

Create a separate integration entry and destination for each phone. A receiver
binds to the source identifier in its first accepted snapshot. To replace
that source, remove the entry and create a new one.

The receiver URL contains its secret. Anyone with the complete URL can send
data to that receiver. Do not include it in screenshots, logs, or issue
reports. Removing the integration entry revokes the URL and deletes the
integration's saved snapshot and backfilled history. Home Assistant Recorder has its own retention
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
engine. It reflects the alert episode reported by JugglucoNG.

- `on`: JugglucoNG reports an active alert episode.
- `off`: JugglucoNG explicitly reports that no episode is active.
- `unavailable`: the field is disabled, unknown, or stale.

An acknowledgement or silenced sound does not necessarily end an alert
episode. The sender reports the episode until its runtime clears it. Manual
alarm tests are not production episodes.

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
identifiers, glucose values, alert values, and measurement timestamps.

## Dashboard

The integration includes its dashboard card. It loads no external scripts and
reads history through your authenticated Home Assistant connection.

1. Enable advanced mode in your Home Assistant profile.
2. Open **Settings > Dashboards > Resources** and add
   `/glucifer/glucifer-card.js` as a **JavaScript module**.
3. Add a manual card with the YAML below, replacing the glucose entity ID.

```yaml
type: custom:glucifer-card
entity: sensor.phone_glucose
title: Glucose
hours: 24
```

The card finds the selected receiver's trend, delta, freshness, lifecycle, and
active alert entities automatically. Its chart supports 1 to 168 hours and
leaves gaps longer than ten minutes visible. Unknown values remain unknown.
The **More details** button opens the glucose entity.

For a complete dashboard, copy [examples/dashboard.yaml](../examples/dashboard.yaml)
into a new dashboard's raw configuration editor and replace its example entity
IDs. Refresh the browser after updating the integration's card.

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

## QR setup and secret rotation

Home Assistant renders the QR code locally. Its contents are the same private
receiver URL accepted by manual setup; no external QR service receives it.
JugglucoNG validates scanned URLs and asks you to confirm the host before
saving. Scanning leaves field selection and history preferences unchanged.

To replace a receiver secret, open the integration's options and select
**Replace the receiver secret**. The next screen shows the new URL and QR code.
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
It revisits the seven-day window hourly to catch readings that arrived late
from the sensor. Available history depends on what the phone has retained.

The receiver retains up to seven days or 20,160 readings, whichever is smaller,
including readings received live. Repeated timestamps retain the first recorded
value. The Glucifer card displays this history at measurement time. Home
Assistant's ordinary Recorder graph still records live entity changes; imported
readings are not injected into Recorder as new state changes. Removing a
receiver deletes its Glucifer history. Recorder retention is separate.

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
