# SPDX-License-Identifier: GPL-3.0-or-later
"""Validate complete snapshots without depending on Home Assistant."""

import math
import re
from copy import deepcopy

from .const import ALERTS, FIELDS, LIFECYCLE_FIELDS, MAX_HISTORY_BATCH


class InvalidSnapshot(ValueError):
    """A payload cannot be safely used as a snapshot."""


def _integer(value, minimum=1, maximum=9007199254740991):
    return type(value) is int and minimum <= value <= maximum


def validate_snapshot(payload: object, now_ms: int) -> dict:
    """Return a validated copy. Absence and null never mean zero or false."""
    if not isinstance(payload, dict) or type(payload.get("schema_version")) is not int:
        raise InvalidSnapshot("invalid_envelope")
    if payload["schema_version"] not in (1, 2):
        raise InvalidSnapshot("unsupported_version")
    source = payload.get("source_id")
    if not isinstance(source, str) or not re.fullmatch(r"[A-Za-z0-9_-]{1,64}", source):
        raise InvalidSnapshot("invalid_source")
    if not _integer(payload.get("sequence")):
        raise InvalidSnapshot("invalid_sequence")
    sent = payload.get("sent_at_ms")
    if not _integer(sent) or sent > now_ms + 120000:
        raise InvalidSnapshot("invalid_timestamp")
    glucose = payload.get("glucose")
    if not isinstance(glucose, dict):
        raise InvalidSnapshot("glucose_required")
    measured = glucose.get("time_ms")
    value = glucose.get("mgdl")
    if not _integer(measured) or measured > sent + 120000:
        raise InvalidSnapshot("invalid_glucose_timestamp")
    if type(value) not in (int, float) or not 0 < value <= 1000 or not math.isfinite(value):
        raise InvalidSnapshot("invalid_glucose")
    fields = payload.get("fields", {})
    alerts = payload.get("alerts", {})
    if not isinstance(fields, dict) or not isinstance(alerts, dict):
        raise InvalidSnapshot("invalid_fields")
    if fields.keys() - FIELDS.keys() or alerts.keys() - ALERTS.keys():
        raise InvalidSnapshot("unsupported_field")
    if payload["schema_version"] == 1 and fields.keys() & LIFECYCLE_FIELDS:
        raise InvalidSnapshot("unsupported_field")
    for key, field in fields.items():
        if field is None:
            continue
        if FIELDS[key][2] == "boolean":
            if type(field) is not bool:
                raise InvalidSnapshot("invalid_boolean")
        elif FIELDS[key][2] == "timestamp":
            if not _integer(field, maximum=32503680000000):
                raise InvalidSnapshot("invalid_timestamp")
        elif FIELDS[key][2] == "text":
            if not isinstance(field, str) or len(field) > 128:
                raise InvalidSnapshot("invalid_text")
        elif (
            type(field) not in (int, float)
            or not -1e12 <= field <= 1e12
            or not math.isfinite(field)
        ):
            raise InvalidSnapshot("invalid_number")
        if key == "battery_percent" and not 0 <= field <= 100:
            raise InvalidSnapshot("invalid_battery")
    if any(value is not None and type(value) is not bool for value in alerts.values()):
        raise InvalidSnapshot("invalid_alert")
    predictions = validate_predictions(payload.get("predictions", []), measured)
    return deepcopy(
        {
            "schema_version": payload["schema_version"],
            "source_id": source,
            "sequence": payload["sequence"],
            "sent_at_ms": sent,
            "glucose": {"time_ms": measured, "mgdl": value},
            "fields": fields,
            "alerts": alerts,
            **({"predictions": predictions} if "predictions" in payload else {}),
        }
    )


def classify_snapshot(current: dict | None, incoming: dict) -> str:
    """Reject source changes and conflicting retries before replacing state."""
    if current is None:
        return "accepted"
    if incoming["source_id"] != current["source_id"]:
        raise InvalidSnapshot("source_mismatch")
    if incoming["sequence"] < current["sequence"]:
        return "superseded"
    if incoming["sequence"] == current["sequence"]:
        if incoming != current:
            raise InvalidSnapshot("sequence_conflict")
        return "duplicate"
    if incoming["glucose"]["time_ms"] < current["glucose"]["time_ms"]:
        raise InvalidSnapshot("older_glucose")
    return "accepted"


def validate_history(payload, now_ms):
    """History cannot carry live fields or alert state."""
    if (
        not isinstance(payload, dict)
        or type(payload.get("schema_version")) is not int
        or payload["schema_version"] != 2
    ):
        raise InvalidSnapshot("unsupported_version")
    if (
        set(payload) != {"schema_version", "type", "source_id", "batch_id", "readings"}
        or payload["type"] != "history"
    ):
        raise InvalidSnapshot("invalid_history")
    for key in ("source_id", "batch_id"):
        if not isinstance(payload[key], str) or not re.fullmatch(
            r"[A-Za-z0-9_-]{1,64}", payload[key]
        ):
            raise InvalidSnapshot("invalid_history_identifier")
    readings = payload["readings"]
    if not isinstance(readings, list) or not 1 <= len(readings) <= MAX_HISTORY_BATCH:
        raise InvalidSnapshot("invalid_history_size")
    previous = 0
    for point in readings:
        if not isinstance(point, dict) or set(point) != {"time_ms", "mgdl"}:
            raise InvalidSnapshot("invalid_history_point")
        stamp, value = point["time_ms"], point["mgdl"]
        if not _integer(stamp) or not previous < stamp <= now_ms + 120000:
            raise InvalidSnapshot("invalid_history_timestamp")
        if type(value) not in (int, float) or not 0 < value <= 1000 or not math.isfinite(value):
            raise InvalidSnapshot("invalid_glucose")
        previous = stamp
    return deepcopy(payload)


def validate_backfill_status(payload):
    """Validate a diagnostic transition without accepting readings or alerts."""
    if not isinstance(payload, dict) or set(payload) != {
        "schema_version",
        "type",
        "source_id",
        "status_id",
        "active",
    }:
        raise InvalidSnapshot("invalid_backfill_status")
    if type(payload["schema_version"]) is not int or payload["schema_version"] != 2:
        raise InvalidSnapshot("unsupported_version")
    if payload["type"] != "backfill_status" or type(payload["active"]) is not bool:
        raise InvalidSnapshot("invalid_backfill_status")
    for key in ("source_id", "status_id"):
        if not isinstance(payload[key], str) or not re.fullmatch(
            r"[A-Za-z0-9_-]{1,64}", payload[key]
        ):
            raise InvalidSnapshot("invalid_backfill_status")
    return deepcopy(payload)


def validate_predictions(curves, measured):
    """Bound forward display curves separately from measured history."""
    if not isinstance(curves, list) or len(curves) > 3:
        raise InvalidSnapshot("invalid_predictions")
    kinds = set()
    for curve in curves:
        if not isinstance(curve, dict) or set(curve) != {"kind", "points"}:
            raise InvalidSnapshot("invalid_predictions")
        kind = curve["kind"]
        if not isinstance(kind, str) or kind not in {"raw", "auto", "calibrated"} or kind in kinds:
            raise InvalidSnapshot("invalid_predictions")
        kinds.add(kind)
        points = curve["points"]
        if not isinstance(points, list) or not 2 <= len(points) <= 121:
            raise InvalidSnapshot("invalid_predictions")
        previous = 0
        baseline = None
        for point in points:
            if not isinstance(point, dict) or set(point) != {"time_ms", "mgdl"}:
                raise InvalidSnapshot("invalid_predictions")
            stamp, value = point["time_ms"], point["mgdl"]
            if not _integer(stamp) or stamp <= previous:
                raise InvalidSnapshot("invalid_predictions")
            if baseline is None:
                baseline = stamp
                if not measured - 120000 <= baseline <= measured:
                    raise InvalidSnapshot("invalid_predictions")
            if stamp > baseline + 21600000:
                raise InvalidSnapshot("invalid_predictions")
            if type(value) not in (int, float) or not math.isfinite(value) or not 0 < value <= 1000:
                raise InvalidSnapshot("invalid_predictions")
            previous = stamp
    return curves
