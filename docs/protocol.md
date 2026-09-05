# Glucifer HA snapshot protocol, version 1

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
unknown alert names, and unsupported schema versions are rejected. A sender
must negotiate a future protocol version before introducing new keys.

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
