# SPDX-License-Identifier: GPL-3.0-or-later
"""Bounded journal changes with durable, independent acknowledgements."""

import math
import re
from copy import deepcopy

from .protocol import InvalidSnapshot, _integer

MAX_ENTRIES = 5000
MAX_BATCH = 16
MAX_DAYS = 90


def empty_journal():
    return {"enabled": False, "history_days": 7, "sequence": 0, "entries": [], "last_payload": None}


def identifier(value):
    return isinstance(value, str) and re.fullmatch(r"[A-Za-z0-9_-]{1,64}", value)


def validate_entry(entry, now_ms):
    if not isinstance(entry, dict) or set(entry) - {
        "id",
        "time_ms",
        "kind",
        "amount",
        "label",
        "note",
    }:
        raise InvalidSnapshot("invalid_journal_entry")
    if not identifier(entry.get("id")) or not _integer(
        entry.get("time_ms"), maximum=now_ms + 120000
    ):
        raise InvalidSnapshot("invalid_journal_entry")
    if not isinstance(entry.get("kind"), str) or entry["kind"] not in {"insulin", "carbs", "note"}:
        raise InvalidSnapshot("invalid_journal_kind")
    if not isinstance(entry.get("label"), str) or len(entry["label"]) > 128:
        raise InvalidSnapshot("invalid_journal_label")
    if "note" in entry and (not isinstance(entry["note"], str) or len(entry["note"]) > 256):
        raise InvalidSnapshot("invalid_journal_note")
    amount = entry.get("amount")
    if entry["kind"] != "note":
        if (
            type(amount) not in (int, float)
            or not math.isfinite(amount)
            or not 0 < amount <= 100000
        ):
            raise InvalidSnapshot("invalid_journal_amount")
    elif "amount" in entry:
        raise InvalidSnapshot("invalid_journal_amount")


def validate_journal(payload, now_ms):
    expected = {
        "schema_version",
        "type",
        "source_id",
        "sequence",
        "sent_at_ms",
        "enabled",
        "history_days",
        "entries",
        "deleted_ids",
    }
    if not isinstance(payload, dict) or set(payload) != expected:
        raise InvalidSnapshot("invalid_journal")
    if (
        type(payload["schema_version"]) is not int
        or payload["schema_version"] != 2
        or payload["type"] != "journal"
    ):
        raise InvalidSnapshot("invalid_journal")
    if not identifier(payload["source_id"]) or not _integer(payload["sequence"]):
        raise InvalidSnapshot("invalid_journal_sequence")
    if not _integer(payload["sent_at_ms"], maximum=now_ms + 120000):
        raise InvalidSnapshot("invalid_journal_timestamp")
    if type(payload["enabled"]) is not bool or not _integer(
        payload["history_days"], maximum=MAX_DAYS
    ):
        raise InvalidSnapshot("invalid_journal_settings")
    entries, deleted = payload["entries"], payload["deleted_ids"]
    if (
        not isinstance(entries, list)
        or not isinstance(deleted, list)
        or len(entries) + len(deleted) > MAX_BATCH
    ):
        raise InvalidSnapshot("invalid_journal_size")
    if not payload["enabled"] and (entries or deleted):
        raise InvalidSnapshot("invalid_journal_disabled")
    ids = set()
    for entry in entries:
        validate_entry(entry, payload["sent_at_ms"])
        if entry["id"] in ids:
            raise InvalidSnapshot("duplicate_journal_id")
        ids.add(entry["id"])
    for value in deleted:
        if not identifier(value) or value in ids:
            raise InvalidSnapshot("invalid_journal_delete")
        ids.add(value)
    return deepcopy(payload)


def retained_entries(state, now_ms):
    if not state["enabled"]:
        return []
    cutoff = now_ms - state["history_days"] * 86400000
    return sorted(
        (e for e in state["entries"] if cutoff <= e["time_ms"] <= now_ms + 120000),
        key=lambda e: (e["time_ms"], e["id"]),
    )[-MAX_ENTRIES:]


def apply_journal(current, incoming, now_ms):
    if incoming["sequence"] < current["sequence"]:
        return current, "superseded"
    if incoming["sequence"] == current["sequence"]:
        if incoming != current["last_payload"]:
            raise InvalidSnapshot("journal_sequence_conflict")
        return current, "duplicate"
    entries = {e["id"]: e for e in current["entries"]}
    for key in incoming["deleted_ids"]:
        entries.pop(key, None)
    entries.update({e["id"]: e for e in incoming["entries"]})
    state = {
        "enabled": incoming["enabled"],
        "history_days": incoming["history_days"],
        "sequence": incoming["sequence"],
        "entries": list(entries.values()),
        "last_payload": incoming,
    }
    state["entries"] = retained_entries(state, now_ms)
    return state, "accepted"


def restore_journal(saved, now_ms):
    if saved is None:
        return empty_journal()
    if not isinstance(saved, dict) or set(saved) != set(empty_journal()):
        raise InvalidSnapshot("invalid_saved_journal")
    if (
        type(saved["enabled"]) is not bool
        or not _integer(saved["history_days"], maximum=MAX_DAYS)
        or not _integer(saved["sequence"], minimum=0)
    ):
        raise InvalidSnapshot("invalid_saved_journal")
    if not isinstance(saved["entries"], list) or len(saved["entries"]) > MAX_ENTRIES:
        raise InvalidSnapshot("invalid_saved_journal")
    for entry in saved["entries"]:
        validate_entry(entry, now_ms)
    if saved["last_payload"] is not None:
        payload = validate_journal(saved["last_payload"], now_ms)
        if payload["sequence"] != saved["sequence"]:
            raise InvalidSnapshot("invalid_saved_journal")
    elif saved["sequence"] != 0:
        raise InvalidSnapshot("invalid_saved_journal")
    result = deepcopy(saved)
    result["entries"] = retained_entries(result, now_ms)
    return result
