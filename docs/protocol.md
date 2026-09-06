# Glucifer HA protocol, versions 1 and 2

Send UTF-8 JSON with HTTP POST to the private receiver URL. The integration
accepts at most 32 KiB per request. A snapshot replaces all optional fields
from the preceding snapshot; this is not a partial update protocol.

```json
{
  "schema_version": 1,
  "source_id": "c97efb6d-448b-4ae1-bffc-c88be23e4983",
  "sequence": 1,
  "sent_at_ms": 1788696000000,
  "glucose": {"time_ms": 1788695990000, "mgdl": 123},
  "fields": {"trend": "Flat", "iob_u": 0.5},
  "alerts": {"low": false, "high": false}
}
```

`source_id` is a stable identifier for one sender destination, not a sensor
identifier. It contains 1 to 64 ASCII letters, digits, hyphens, or underscores.
`sequence` is a positive integer no larger than 2^53 - 1, persisted across
sender restarts and incremented for every new snapshot. A retry preserves the
entire original snapshot, including sequence number and timestamps.

All timestamps are Unix milliseconds. `sent_at_ms` is the time the snapshot
was produced, not the time of a retry. The glucose timestamp must not regress
within a receiver entry. The receiver permits two minutes of positive clock
skew. Old data remains old when received; it is not stamped with receipt time.

Glucose is mandatory, finite, numeric, positive, and no greater than 1000
mg/dL. That upper limit is an input validation bound, not a clinical range.

`fields` and `alerts` are optional objects. Individual absent keys mean
disabled/not sent; null means selected but unavailable. Neither implies a
numeric zero or a cleared alert. Alerts accept only JSON booleans or null.

Supported field names and units are defined in
[`const.py`](../custom_components/glucifer/const.py). Unknown field names,
unknown alert names, and unsupported schema versions are rejected. Version 2 adds `sensor_started_ms` and `sensor_expires_ms` as positive Unix
milliseconds, plus `sensor_warmup` as boolean or null. Version 1 does not
accept these fields. All new lifecycle fields remain optional. Receipts echo
the request version and advertise `supported_versions: [1, 2]`.

An accepted request returns:

```json
{"schema_version":1,"source_id":"c97efb6d-448b-4ae1-bffc-c88be23e4983","sequence":1,"status":"accepted"}
```

The sender must verify all four fields. HTTP 200 alone is insufficient.
`duplicate` confirms an identical retry of the current snapshot. `superseded`
confirms receipt of an older sequence without applying it. Reusing the current
sequence with different content is an error. The first accepted snapshot
binds a receiver to its source identifier.

Errors return JSON with an `error` string: malformed JSON uses HTTP 400,
oversized bodies 413, invalid snapshots 422, and storage failures 503.
Acceptance is acknowledged only after saving the snapshot. Implementations
must not log payloads or private endpoint URLs on validation failures.


## Historical batches (version 2)

A sender enables history separately from its live optional fields. It first
establishes its source binding with a current snapshot. It then posts bounded,
strictly ordered batches to the same URL:

```json
{
  "schema_version": 2,
  "type": "history",
  "source_id": "c97efb6d-448b-4ae1-bffc-c88be23e4983",
  "batch_id": "d8b99c03-22e2-433f-aa27-b3dcba314564",
  "readings": [{"time_ms": 1788695900000, "mgdl": 120}]
}
```

The source and batch identifiers use the same character and length bounds.
There must be 1 to 256 readings; each contains exactly `time_ms` and `mgdl`.
The glucose bounds match snapshots. Future timestamps beyond the clock-skew
allowance and readings newer than the receiver's current measurement are
rejected. Additional envelope fields, including alerts, are rejected.

A receipt echoes `schema_version`, `type`, `source_id`, and `batch_id`, with
`status: "accepted"` and `through_ms` equal to the final reading timestamp.
The sender verifies all fields before advancing its saved history cursor.
The receiver saves the merged history before issuing this receipt.

History is keyed by original timestamp. Existing values win on duplicate
or conflicting timestamps, making retries idempotent without keeping an
unbounded set of batch IDs. Readings older than seven days are acknowledged
but discarded; the most recent 20,160 points are retained. The import only
updates history and contact diagnostics, never current glucose or alert states.

The authenticated `glucifer/history` WebSocket command accepts the receiver's
glucose `entity_id` and returns retained readings, entity IDs, and the configured
unit. Home Assistant read permission for that glucose entity is required.
Private endpoint URLs and source identifiers are not returned.


## Backfill activity status

Receivers supporting diagnostic transfer state advertise
`"capabilities": ["backfill_status"]` in live snapshot acknowledgements.
Senders must negotiate this capability before posting a status transition:

```json
{
  "schema_version": 2,
  "type": "backfill_status",
  "source_id": "phone-example",
  "status_id": "transition-example",
  "active": true
}
```

`active` is a strict boolean. The source must already be bound by a live
snapshot. The receiver durably saves the state and replies with the same fields
plus `"status": "accepted"`. Retries preserve `status_id`; a changed state gets
a new ID. A status message cannot contain glucose, history readings, or alerts.
It updates contact time without changing the live snapshot or its measurement
time. Senders report transitions, not periodic copies of the same state.
