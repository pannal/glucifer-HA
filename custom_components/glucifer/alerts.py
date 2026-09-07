# SPDX-License-Identifier: GPL-3.0-or-later
"""Optional alert lifecycle metadata, separate from authoritative booleans."""

import re
from copy import deepcopy

from .const import ALERTS
from .protocol import InvalidSnapshot, _integer

REASONS = ("fired", "acknowledged", "snoozed", "cleared")
MAX_EVENTS = 32
RETENTION_MS = 7 * 86400000


def validate_change(change, sent):
    if not isinstance(change, dict) or set(change) - {
        "id",
        "alert",
        "reason",
        "time_ms",
        "snoozed_until_ms",
    }:
        raise InvalidSnapshot("invalid_alert_details")
    if (
        not isinstance(change.get("id"), str)
        or not re.fullmatch(r"[A-Za-z0-9_-]{1,64}", change["id"])
        or not isinstance(change.get("alert"), str)
        or change["alert"] not in ALERTS
        or change.get("reason") not in REASONS
        or not _integer(change.get("time_ms"))
        or change["time_ms"] > sent + 120000
    ):
        raise InvalidSnapshot("invalid_alert_details")
    until = change.get("snoozed_until_ms")
    if "snoozed_until_ms" in change and (
        change["reason"] != "snoozed"
        or not _integer(until, maximum=32503680000000)
        or until < change["time_ms"]
    ):
        raise InvalidSnapshot("invalid_alert_details")
    if change["reason"] == "snoozed" and until is None:
        raise InvalidSnapshot("invalid_alert_details")
    return deepcopy(change)


def validate_alert_metadata(payload, sent, alerts):
    result = {}
    if "alert_details" in payload:
        details = payload["alert_details"]
        if not isinstance(details, dict) or details.keys() - alerts.keys():
            raise InvalidSnapshot("invalid_alert_details")
        for key, change in details.items():
            validate_change(change, sent)
            if change["alert"] != key or alerts[key] is not (change["reason"] == "fired"):
                raise InvalidSnapshot("alert_state_conflict")
        result["alert_details"] = deepcopy(details)
    if "alert_events" in payload:
        events = payload["alert_events"]
        if not isinstance(events, list) or len(events) > MAX_EVENTS:
            raise InvalidSnapshot("invalid_alert_events")
        ids = set()
        for change in events:
            validate_change(change, sent)
            if change["alert"] not in alerts or change["id"] in ids:
                raise InvalidSnapshot("invalid_alert_events")
            ids.add(change["id"])
        result["alert_events"] = deepcopy(events)
    if "reporting" in payload:
        reporting = payload["reporting"]
        if (
            not isinstance(reporting, dict)
            or set(reporting) != {"background_interval_seconds", "live_bypass"}
            or not _integer(reporting.get("background_interval_seconds"), maximum=86400)
            or type(reporting.get("live_bypass")) is not bool
        ):
            raise InvalidSnapshot("invalid_reporting")
        result["reporting"] = deepcopy(reporting)
    return result


def merge_events(current, incoming, now):
    known = {event["id"]: event for event in current}
    added = []
    for event in incoming:
        if event["id"] in known:
            if known[event["id"]] != event:
                raise InvalidSnapshot("alert_event_conflict")
        elif event["time_ms"] >= now - RETENTION_MS:
            known[event["id"]] = event
            added.append(event)
    merged = sorted(known.values(), key=lambda item: item["time_ms"])
    return [e for e in merged if e["time_ms"] >= now - RETENTION_MS][-256:], added
