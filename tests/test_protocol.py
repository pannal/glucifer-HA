# SPDX-License-Identifier: GPL-3.0-or-later
"""Reject malformed payloads and prevent stale retry replacement."""

from copy import deepcopy

import pytest

from custom_components.glucifer.protocol import (
    InvalidSnapshot,
    classify_snapshot,
    validate_snapshot,
)


def test_glucose_is_mandatory(snapshot):
    snapshot.pop("glucose")
    with pytest.raises(InvalidSnapshot, match="glucose_required"):
        validate_snapshot(snapshot, snapshot["sent_at_ms"])


@pytest.mark.parametrize("value", [True, "123", None, float("nan"), float("inf"), 0, -1, 1001])
def test_invalid_glucose(snapshot, value):
    snapshot["glucose"]["mgdl"] = value
    with pytest.raises(InvalidSnapshot):
        validate_snapshot(snapshot, snapshot["sent_at_ms"])


@pytest.mark.parametrize("value", [0, 1, "false", [], {}])
def test_alerts_require_booleans(snapshot, value):
    snapshot["alerts"]["low"] = value
    with pytest.raises(InvalidSnapshot, match="invalid_alert"):
        validate_snapshot(snapshot, snapshot["sent_at_ms"])


def test_optional_absent_and_null(snapshot):
    snapshot.pop("fields")
    snapshot["alerts"] = {"low": None}
    result = validate_snapshot(snapshot, snapshot["sent_at_ms"])
    assert result["fields"] == {}
    assert result["alerts"] == {"low": None}


def test_retries_and_out_of_order(snapshot):
    assert classify_snapshot(None, snapshot) == "accepted"
    assert classify_snapshot(snapshot, deepcopy(snapshot)) == "duplicate"
    newer = deepcopy(snapshot)
    newer["sequence"] += 1
    assert classify_snapshot(newer, snapshot) == "superseded"
    snapshot["alerts"]["low"] = True
    with pytest.raises(InvalidSnapshot, match="sequence_conflict"):
        classify_snapshot(newer | {"sequence": 1}, snapshot)


def test_sender_identity_cannot_change(snapshot):
    other = snapshot | {"source_id": "other-phone", "sequence": 2}
    with pytest.raises(InvalidSnapshot, match="source_mismatch"):
        classify_snapshot(snapshot, other)


def test_glucose_time_cannot_regress(snapshot):
    older = deepcopy(snapshot)
    older["sequence"] += 1
    older["glucose"]["time_ms"] -= 60000
    with pytest.raises(InvalidSnapshot, match="older_glucose"):
        classify_snapshot(snapshot, older)


@pytest.mark.parametrize(
    "key,value",
    [("sequence", True), ("sequence", 0), ("schema_version", True), ("schema_version", 2)],
)
def test_envelope_types(snapshot, key, value):
    snapshot[key] = value
    with pytest.raises(InvalidSnapshot):
        validate_snapshot(snapshot, snapshot["sent_at_ms"])


def test_future_timestamp(snapshot):
    with pytest.raises(InvalidSnapshot):
        validate_snapshot(snapshot, snapshot["sent_at_ms"] - 120001)


def test_extreme_numbers_are_validation_errors(snapshot):
    snapshot["glucose"]["mgdl"] = 10**500
    with pytest.raises(InvalidSnapshot, match="invalid_glucose"):
        validate_snapshot(snapshot, snapshot["sent_at_ms"])
    snapshot["glucose"]["mgdl"] = 123
    snapshot["fields"]["iob_u"] = 10**500
    with pytest.raises(InvalidSnapshot, match="invalid_number"):
        validate_snapshot(snapshot, snapshot["sent_at_ms"])
