# Glucifer HA

<img src="custom_components/glucifer/brand/icon.png" alt="JugglucoNG icon" width="96">

Glucifer HA receives glucose readings and selected status data from
[JugglucoNG](https://github.com/ctqvva/JugglucoNG) and exposes them as Home
Assistant entities. JugglucoNG sends a small JSON snapshot to a private HTTP
endpoint whenever its data changes. No Nightscout server or MQTT broker is
required.

**Development status:** this is an initial implementation. The matching
JugglucoNG sender preset is being developed separately and is not part of an
upstream release yet. Installing this integration alone does not enable data
sharing from existing JugglucoNG releases.

## Medical disclaimer

**Glucifer HA is not a medical device.** It is experimental software for
displaying data and experimenting with Home Assistant automations. It is not
intended to diagnose, treat, cure, or prevent any disease, or to replace a
glucose monitor, medical advice, or a medical alert system.

Do not use its readings, alert entities, or automations to make insulin dosing
or other treatment decisions, control medication delivery, or provide
emergency monitoring. Use your prescribed monitoring equipment and follow
your clinician's guidance.

Data can be delayed, missing, stale, or incorrect. Network outages, phone
restrictions, restarts, and software faults can prevent both readings and
alerts from arriving. An alert shown as off does not establish that your
glucose is safe. The software is provided without warranty, as described in
the [license](LICENSE).

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

Once the implementation has been published to the repository:

1. Open HACS, then its menu and **Custom repositories**.
2. Add `https://github.com/pannal/glucifer-HA` with type **Integration**.
3. Download **Glucifer HA** and restart Home Assistant.

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
3. Copy the receiver URL and finish setup. If the integration shows only
   `/api/webhook/...`, prepend your Home Assistant URL.
4. In the matching JugglucoNG build, open its **API destinations** settings,
   add a **Glucifer HA** destination, and paste the complete URL.
5. Choose the optional fields and alerts to send. Glucose remains enabled.
6. Send a test snapshot and check that Home Assistant shows its glucose value
   and measurement time.

Create a separate integration entry and destination for each phone. A receiver
binds to the source identifier in its first accepted snapshot. To replace
that source, remove the entry and create a new one.

The receiver URL contains its secret. Anyone with the complete URL can send
data to that receiver. Do not include it in screenshots, logs, or issue
reports. Removing the integration entry revokes the URL and deletes the
integration's saved snapshot. Home Assistant Recorder has its own retention
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
| Each supported alert | Enabled | Binary sensor |

Glucose values use `mg/dL` on the wire. Rate of change uses `mg/dL/min`, insulin
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

## Access away from home

Local reception is enabled by default. For remote reception, use an HTTPS
Home Assistant endpoint or a VPN and configure **Accept local requests
only** accordingly. A LAN URL will stop working when the phone leaves that
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

The wire contract is described in [docs/protocol.md](docs/protocol.md).
Tests use Home Assistant's custom integration test harness and exercise real
HTTP handling, config flows, entity states, persistence, and freshness.
The test target is Home Assistant 2026.9.1 on Python 3.14.2 or newer.
Install [uv](https://docs.astral.sh/uv/getting-started/installation/) first.
The override file selects the current stable patch because the latest test
harness still pins 2026.9.0. Update both pins when upgrading Home Assistant.

```sh
uv venv --python 3.14
uv pip install -r requirements-test.txt --override requirements-test-overrides.txt
.venv/bin/python -m pytest
.venv/bin/ruff check .
```

## License

Glucifer HA is licensed under the **GNU General Public License, version 3
or any later version** (`GPL-3.0-or-later`). See [LICENSE](LICENSE) for the
full license text. This matches JugglucoNG's licensing and allows compatible
code sharing between the sender and receiver.

Copyright (C) 2026 pannal and contributors. JugglucoNG and any reused assets
retain their respective copyrights.
