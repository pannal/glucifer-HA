# SPDX-License-Identifier: GPL-3.0-or-later
"""Use actual config entries, HTTP requests, entities and reloads."""

from copy import deepcopy
from datetime import timedelta
from unittest.mock import AsyncMock, patch

import pytest
from homeassistant.setup import async_setup_component
from homeassistant.util import dt as dt_util
from pytest_homeassistant_custom_component.common import MockConfigEntry, async_fire_time_changed

from custom_components.glucifer.const import DOMAIN


@pytest.fixture
async def receiver(hass, hass_client):
    assert await async_setup_component(hass, "http", {})
    assert await async_setup_component(hass, "webhook", {})
    entry = MockConfigEntry(
        domain=DOMAIN,
        title="Phone",
        data={"webhook_id": "private-test-hook"},
        options={"local_only": False, "stale_seconds": 300},
    )
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    client = await hass_client()
    return entry, client


async def send(hass, client, payload):
    response = await client.post("/api/webhook/private-test-hook", json=payload)
    await hass.async_block_till_done()
    return response


async def test_receive_clear_disable_and_stale(hass, receiver, snapshot, freezer):
    entry, client = receiver
    response = await send(hass, client, snapshot)
    assert response.status == 200
    assert (await response.json())["status"] == "accepted"
    assert hass.states.get("sensor.phone_glucose").state == "123"
    assert hass.states.get("sensor.phone_insulin_on_board").state == "0.0"
    assert hass.states.get("binary_sensor.phone_high_glucose_alert").state == "on"
    assert hass.states.get("binary_sensor.phone_low_glucose_alert").state == "off"
    assert hass.states.get("sensor.phone_phone_battery") is None

    snapshot["sequence"] += 1
    snapshot["alerts"]["high"] = False
    snapshot["fields"] = {}
    await send(hass, client, snapshot)
    assert hass.states.get("binary_sensor.phone_high_glucose_alert").state == "off"
    assert hass.states.get("sensor.phone_insulin_on_board").state == "unavailable"

    snapshot["sequence"] += 1
    snapshot["alerts"].pop("high")
    await send(hass, client, snapshot)
    assert hass.states.get("binary_sensor.phone_high_glucose_alert").state == "unavailable"

    freezer.tick(timedelta(seconds=301))
    async_fire_time_changed(hass, dt_util.utcnow())
    await hass.async_block_till_done()
    assert hass.states.get("sensor.phone_glucose").state == "unavailable"
    assert hass.states.get("binary_sensor.phone_low_glucose_alert").state == "unavailable"


async def test_duplicate_out_of_order_reload(hass, receiver, snapshot):
    entry, client = receiver
    await send(hass, client, snapshot)
    assert (await (await send(hass, client, snapshot)).json())["status"] == "duplicate"
    old = deepcopy(snapshot)
    snapshot["sequence"] = 2
    snapshot["glucose"]["mgdl"] = 130
    await send(hass, client, snapshot)
    assert (await (await send(hass, client, old)).json())["status"] == "superseded"
    assert hass.states.get("sensor.phone_glucose").state == "130"
    assert await hass.config_entries.async_reload(entry.entry_id)
    await hass.async_block_till_done()
    assert hass.states.get("sensor.phone_glucose").state == "130"
    assert (await (await send(hass, client, old)).json())["status"] == "superseded"


async def test_malformed_and_oversized_requests(hass, receiver, snapshot):
    _, client = receiver
    response = await client.post("/api/webhook/private-test-hook", data="{")
    assert response.status == 400
    response = await client.post("/api/webhook/private-test-hook", data="x" * 32769)
    assert response.status == 413
    snapshot["alerts"]["high"] = 1
    assert (await send(hass, client, snapshot)).status == 422
    assert hass.states.get("sensor.phone_glucose").state == "unavailable"


async def test_storage_failure_is_not_acknowledged(hass, receiver, snapshot):
    entry, client = receiver
    with patch.object(entry.runtime_data.store, "async_save", side_effect=OSError):
        response = await send(hass, client, snapshot)
    assert response.status == 503
    assert entry.runtime_data.data is None


async def test_missing_webhook_does_not_acknowledge(hass, receiver, snapshot):
    _, client = receiver
    response = await client.post("/api/webhook/wrong-hook", json=snapshot)
    assert response.status == 200
    assert await response.text() == ""


async def test_old_glucose_does_not_become_fresh_with_alert_update(hass, receiver, snapshot):
    _, client = receiver
    snapshot["glucose"]["time_ms"] -= 360000
    await send(hass, client, snapshot)
    assert hass.states.get("sensor.phone_glucose").state == "unavailable"
    assert hass.states.get("binary_sensor.phone_high_glucose_alert").state == "on"


async def test_config_flow(hass):
    result = await hass.config_entries.flow.async_init(DOMAIN, context={"source": "user"})
    assert result["step_id"] == "user"
    result = await hass.config_entries.flow.async_configure(result["flow_id"], {"name": "Phone"})
    assert result["step_id"] == "receiver"
    assert "/api/webhook/" in result["description_placeholders"]["url"]
    with patch("custom_components.glucifer.async_setup_entry", new=AsyncMock(return_value=True)):
        result = await hass.config_entries.flow.async_configure(
            result["flow_id"], {"local_only": True, "stale_seconds": 300}
        )
        await hass.async_block_till_done()
    assert result["type"] == "create_entry"
    assert len(result["data"]["webhook_id"]) == 64


async def test_receiver_entries_are_isolated(hass, receiver, snapshot):
    first, client = receiver
    second = MockConfigEntry(
        domain=DOMAIN,
        title="Second phone",
        data={"webhook_id": "second-hook"},
        options={"local_only": False, "stale_seconds": 300},
    )
    second.add_to_hass(hass)
    assert await hass.config_entries.async_setup(second.entry_id)
    await hass.async_block_till_done()
    await send(hass, client, snapshot)
    other = deepcopy(snapshot)
    other["source_id"] = "second-phone"
    other["glucose"]["mgdl"] = 99
    response = await client.post("/api/webhook/second-hook", json=other)
    assert response.status == 200
    await hass.async_block_till_done()
    assert hass.states.get("sensor.phone_glucose").state == "123"
    assert hass.states.get("sensor.second_phone_glucose").state == "99"
    assert (await send(hass, client, other)).status == 422
    assert first.runtime_data.data["source_id"] == "phone-test"


async def test_options_preserve_endpoint(hass, receiver):
    entry, _ = receiver
    flow = await hass.config_entries.options.async_init(entry.entry_id)
    assert "private-test-hook" in flow["description_placeholders"]["url"]
    result = await hass.config_entries.options.async_configure(
        flow["flow_id"], {"local_only": False, "stale_seconds": 600}
    )
    await hass.async_block_till_done()
    assert result["type"] == "create_entry"
    assert entry.options["stale_seconds"] == 600
    assert entry.data["webhook_id"] == "private-test-hook"


async def test_unload_revokes_endpoint(hass, receiver, snapshot):
    entry, client = receiver
    await send(hass, client, snapshot)
    assert await hass.config_entries.async_unload(entry.entry_id)
    response = await client.post("/api/webhook/private-test-hook", json=snapshot)
    assert response.status == 200
    assert await response.text() == ""


async def test_units_diagnostics_and_private_export(hass, receiver, snapshot, freezer):
    from custom_components.glucifer.diagnostics import async_get_config_entry_diagnostics

    entry, client = receiver
    hass.config_entries.async_update_entry(
        entry, options={**entry.options, "glucose_unit": "mmol/L"}
    )
    await hass.async_block_till_done()
    snapshot["fields"].update(delta_mgdl=18.016, rate_mgdl_min=-1.8016, raw_mgdl=180.16)
    await send(hass, client, snapshot)
    assert float(hass.states.get("sensor.phone_glucose").state) == pytest.approx(123 / 18.016)
    assert float(hass.states.get("sensor.phone_glucose_delta").state) == pytest.approx(1)
    assert float(hass.states.get("sensor.phone_rate_of_change").state) == pytest.approx(-0.1)
    assert hass.states.get("binary_sensor.phone_connected").state == "on"
    assert hass.states.get("binary_sensor.phone_glucose_stale").state == "off"
    freezer.tick(timedelta(seconds=301))
    # A successful retry establishes contact but cannot rejuvenate the reading.
    await send(hass, client, snapshot)
    assert hass.states.get("binary_sensor.phone_connected").state == "on"
    assert hass.states.get("binary_sensor.phone_glucose_stale").state == "on"
    assert hass.states.get("sensor.phone_reading_age").state == "301"
    diagnostics = await async_get_config_entry_diagnostics(hass, entry)
    assert diagnostics["connected"] and not diagnostics["glucose_fresh"]
    serialized = str(diagnostics)
    assert "private-test-hook" not in serialized and "phone-test" not in serialized
    assert "123" not in serialized


async def test_lifecycle_fields_remain_optional(hass, receiver, snapshot):
    _, client = receiver
    snapshot["schema_version"] = 2
    snapshot["fields"].update(
        sensor_started_ms=snapshot["sent_at_ms"] - 86400000,
        sensor_expires_ms=snapshot["sent_at_ms"] + 86400000,
        sensor_warmup=False,
    )
    response = await send(hass, client, snapshot)
    assert (await response.json())["schema_version"] == 2
    assert hass.states.get("binary_sensor.phone_sensor_warming_up").state == "off"
    assert hass.states.get("sensor.phone_sensor_activation").state != "unavailable"
    snapshot["sequence"] += 1
    snapshot["fields"] = {}
    await send(hass, client, snapshot)
    assert hass.states.get("sensor.phone_sensor_activation").state == "unavailable"
    assert hass.states.get("binary_sensor.phone_sensor_warming_up").state == "unavailable"


def history_batch(snapshot):
    return {
        "schema_version": 2,
        "type": "history",
        "source_id": snapshot["source_id"],
        "batch_id": "batch-1",
        "readings": [{"time_ms": snapshot["glucose"]["time_ms"] - 60000, "mgdl": 100}],
    }


async def test_backfill_persistence_and_no_live_alert_replay(hass, receiver, snapshot):
    entry, client = receiver
    await send(hass, client, snapshot)
    batch = history_batch(snapshot)
    assert (await (await send(hass, client, batch)).json())["through_ms"] == batch["readings"][0][
        "time_ms"
    ]
    assert (await send(hass, client, batch)).status == 200
    assert len(entry.runtime_data.history) == 2
    assert hass.states.get("sensor.phone_glucose").state == "123"
    assert hass.states.get("binary_sensor.phone_high_glucose_alert").state == "on"
    batch["readings"][0]["mgdl"] = 50
    await send(hass, client, batch)
    assert entry.runtime_data.history[0]["mgdl"] == 100
    assert await hass.config_entries.async_reload(entry.entry_id)
    await hass.async_block_till_done()
    assert entry.runtime_data.history[0]["time_ms"] == batch["readings"][0]["time_ms"]
    assert len(entry.runtime_data.history) == 2


async def test_backfill_rejects_wrong_source_and_alerts(hass, receiver, snapshot):
    entry, client = receiver
    batch = history_batch(snapshot)
    assert (await send(hass, client, batch)).status == 422
    await send(hass, client, snapshot)
    batch["source_id"] = "different-phone"
    assert (await send(hass, client, batch)).status == 422
    batch = history_batch(snapshot)
    batch["alerts"] = {"high": False}
    assert (await send(hass, client, batch)).status == 422
    batch = history_batch(snapshot)
    batch["readings"][0]["time_ms"] += 120000
    assert (await send(hass, client, batch)).status == 422
    assert len(entry.runtime_data.history) == 1


async def test_backfill_disk_failure_and_retention(hass, receiver, snapshot):
    entry, client = receiver
    await send(hass, client, snapshot)
    batch = history_batch(snapshot)
    with patch.object(entry.runtime_data.store, "async_save", side_effect=OSError):
        assert (await send(hass, client, batch)).status == 503
    assert len(entry.runtime_data.history) == 1
    batch["readings"][0]["time_ms"] -= 8 * 86400000
    assert (await send(hass, client, batch)).status == 200
    assert len(entry.runtime_data.history) == 1


async def test_secret_rotation_preserves_data_and_revokes_old_url(hass, receiver, snapshot):
    entry, client = receiver
    await send(hass, client, snapshot)
    flow = await hass.config_entries.options.async_init(entry.entry_id)
    result = await hass.config_entries.options.async_configure(
        flow["flow_id"],
        {"local_only": False, "stale_seconds": 300, "glucose_unit": "mg/dL", "rotate_secret": True},
    )
    assert result["step_id"] == "rotate"
    assert entry.data["webhook_id"] == "private-test-hook"
    new_id = result["description_placeholders"]["url"].split("/")[-1]
    await hass.config_entries.options.async_configure(flow["flow_id"], {})
    await hass.async_block_till_done()
    assert entry.data["webhook_id"] == new_id
    assert await (await send(hass, client, snapshot)).text() == ""
    response = await client.post(f"/api/webhook/{new_id}", json=snapshot)
    assert (await response.json())["status"] == "duplicate"
    assert len(entry.runtime_data.history) == 1
    assert hass.states.get("sensor.phone_glucose").state == "123"


async def test_history_websocket_and_card_resource(hass, receiver, snapshot, hass_ws_client):
    _, client = receiver
    await send(hass, client, snapshot)
    ws = await hass_ws_client(hass)
    await ws.send_json({"id": 1, "type": "glucifer/history", "entity_id": "sensor.phone_glucose"})
    result = await ws.receive_json()
    assert result["success"]
    assert result["result"]["readings"] == [snapshot["glucose"]]
    assert result["result"]["entities"]["glucose"] == "sensor.phone_glucose"
    assert "private-test-hook" not in str(result)
    await ws.send_json({"id": 2, "type": "glucifer/history", "entity_id": "sensor.nonexistent"})
    assert not (await ws.receive_json())["success"]
    response = await client.get("/glucifer/glucifer-card.js")
    assert response.status == 200
    assert "class GluciferCard" in await response.text()


async def test_history_requires_glucose_access_not_diagnostic_entity(
    hass, receiver, snapshot, hass_ws_client
):
    _, client = receiver
    await send(hass, client, snapshot)
    ws = await hass_ws_client(hass)
    await ws.send_json(
        {"id": 1, "type": "glucifer/history", "entity_id": "sensor.phone_last_contact"}
    )
    assert not (await ws.receive_json())["success"]


async def test_old_storage_format_migrates_without_losing_reading(hass, receiver, snapshot):
    entry, _ = receiver
    store = entry.runtime_data.store
    assert await hass.config_entries.async_unload(entry.entry_id)
    await store.async_save(snapshot)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    assert entry.runtime_data.data == snapshot
    assert entry.runtime_data.history == [snapshot["glucose"]]
    assert entry.runtime_data.last_contact_ms is None
