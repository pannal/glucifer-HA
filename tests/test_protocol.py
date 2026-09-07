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
    [("sequence", True), ("sequence", 0), ("schema_version", True), ("schema_version", 3)],
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


@pytest.mark.parametrize(
    "field,value",
    [
        ("sensor_warmup", 1),
        ("sensor_warmup", "false"),
        ("sensor_started_ms", True),
        ("sensor_expires_ms", -1),
        ("sensor_expires_ms", 1.5),
    ],
)
def test_lifecycle_types(snapshot, field, value):
    snapshot["schema_version"] = 2
    snapshot["fields"][field] = value
    with pytest.raises(InvalidSnapshot):
        validate_snapshot(snapshot, snapshot["sent_at_ms"])


def test_history_batch_bounds_and_order(snapshot):
    from custom_components.glucifer.protocol import validate_history

    point = snapshot["glucose"]
    batch = {
        "schema_version": 2,
        "type": "history",
        "source_id": "phone",
        "batch_id": "batch",
        "readings": [point],
    }
    assert validate_history(batch, snapshot["sent_at_ms"])["readings"] == [point]
    for readings in [
        [],
        [point, point],
        [point] * 257,
        [{**point, "mgdl": True}],
        [{**point, "mgdl": float("nan")}],
        [{**point, "time_ms": snapshot["sent_at_ms"] + 120001}],
    ]:
        with pytest.raises(InvalidSnapshot):
            validate_history({**batch, "readings": readings}, snapshot["sent_at_ms"])


def prediction(snapshot):
    baseline = snapshot["glucose"]["time_ms"]
    return [
        {
            "kind": "auto",
            "points": [
                {"time_ms": baseline, "mgdl": 123},
                {"time_ms": baseline + 300000, "mgdl": 130.5},
            ],
        }
    ]


def test_predictions_are_optional_copied_and_replaced(snapshot):
    snapshot["predictions"] = prediction(snapshot)
    validated = validate_snapshot(snapshot, snapshot["sent_at_ms"])
    snapshot["predictions"][0]["points"][1]["mgdl"] = 135
    assert validated["predictions"][0]["points"][1]["mgdl"] == 130.5
    assert validated["glucose"] == snapshot["glucose"]
    changed = snapshot | {"sequence": 2}
    assert (
        classify_snapshot(validated, validate_snapshot(changed, snapshot["sent_at_ms"]))
        == "accepted"
    )
    changed["predictions"] = []
    assert validate_snapshot(changed, snapshot["sent_at_ms"])["predictions"] == []
    changed.pop("predictions")
    assert "predictions" not in validate_snapshot(changed, snapshot["sent_at_ms"])


@pytest.mark.parametrize(
    "case",
    [
        "null",
        "object",
        "kind",
        "duplicate",
        "size",
        "empty",
        "long",
        "past",
        "future_baseline",
        "order",
        "horizon",
        "nan",
        "bool",
        "zero",
    ],
)
def test_invalid_prediction_curves(snapshot, case):
    curves = prediction(snapshot)
    points = curves[0]["points"]
    if case == "null":
        curves = None
    elif case == "object":
        curves = {}
    elif case == "kind":
        curves[0]["kind"] = "invented"
    elif case == "duplicate":
        curves += deepcopy(curves)
    elif case == "size":
        curves *= 4
    elif case == "empty":
        points.clear()
    elif case == "long":
        points.extend(deepcopy(points) * 61)
    elif case == "past":
        points[0]["time_ms"] -= 120001
    elif case == "future_baseline":
        points[0]["time_ms"] += 1
    elif case == "order":
        points[1]["time_ms"] = points[0]["time_ms"]
    elif case == "horizon":
        points[1]["time_ms"] = points[0]["time_ms"] + 21600001
    elif case == "nan":
        points[1]["mgdl"] = float("nan")
    elif case == "bool":
        points[1]["mgdl"] = True
    elif case == "zero":
        points[1]["mgdl"] = 0
    snapshot["predictions"] = curves
    with pytest.raises(InvalidSnapshot, match="invalid_predictions"):
        validate_snapshot(snapshot, snapshot["sent_at_ms"])
