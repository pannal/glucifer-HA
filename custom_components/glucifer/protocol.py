# SPDX-License-Identifier: GPL-3.0-or-later
"""Validate complete snapshots without depending on Home Assistant."""

import math
import re
from copy import deepcopy

from .const import ALERTS, FIELDS


class InvalidSnapshot(ValueError):
    """A payload cannot be safely used as a snapshot."""


def _integer(value, minimum=1, maximum=9007199254740991):
    return type(value) is int and minimum <= value <= maximum


def validate_snapshot(payload: object, now_ms: int) -> dict:
    """Return a validated copy. Absence and null never mean zero or false."""
    if not isinstance(payload, dict) or type(payload.get("schema_version")) is not int:
        raise InvalidSnapshot("invalid_envelope")
    if payload["schema_version"] != 1:
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
    for key, field in fields.items():
        if field is None:
            continue
        if FIELDS[key][2] == "text":
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
    return deepcopy(
        {
            "schema_version": 1,
            "source_id": source,
            "sequence": payload["sequence"],
            "sent_at_ms": sent,
            "glucose": {"time_ms": measured, "mgdl": value},
            "fields": fields,
            "alerts": alerts,
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
