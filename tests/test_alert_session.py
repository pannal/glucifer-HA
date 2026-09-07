# SPDX-License-Identifier: GPL-3.0-or-later
"""Exercise the real expanded blueprint with HA automation execution."""

import asyncio
from datetime import timedelta
from pathlib import Path

from homeassistant.components.automation.config import AUTOMATION_BLUEPRINT_SCHEMA
from homeassistant.components.blueprint.models import Blueprint, BlueprintInputs
from homeassistant.setup import async_setup_component
from homeassistant.util import dt as dt_util
from homeassistant.util.yaml import load_yaml
from pytest_homeassistant_custom_component.common import async_fire_time_changed


async def settle():
    # A session intentionally remains running in wait_template. Drain callbacks
    # without waiting for that whole automation to finish before acknowledging it.
    for _ in range(30):
        await asyncio.sleep(0)


def session_config(**inputs):
    data = load_yaml(str(Path(__file__).parents[1] / "blueprints/automation/alert_session.yaml"))
    blueprint = Blueprint(data, expected_domain="automation", schema=AUTOMATION_BLUEPRINT_SCHEMA)
    configured = BlueprintInputs(
        blueprint,
        {
            "use_blueprint": {
                "path": "alert_session.yaml",
                "input": {
                    "alert_entities": ["binary_sensor.first", "binary_sensor.second"],
                    "start_actions": [{"event": "test_started"}],
                    "repeat_actions": [{"event": "test_repeated"}],
                    "stop_actions": [{"event": "test_stopped"}],
                    "clear_actions": [{"event": "test_cleared"}],
                    "lost_actions": [{"event": "test_lost"}],
                    **inputs,
                },
            }
        },
    )
    configured.validate()
    return configured.async_substitute()


async def test_session_multiple_alerts_repeat_and_acknowledgement(hass, freezer):
    await hass.config.async_set_time_zone("UTC")
    freezer.move_to("2026-09-08 23:00:00+00:00")  # Enabled overnight by default.
    events = []
    for name in ("started", "stopped", "cleared", "lost", "repeated"):
        hass.bus.async_listen("test_" + name, lambda event: events.append(event.event_type))
    for entity in ("binary_sensor.first", "binary_sensor.second"):
        hass.states.async_set(entity, "off")
    assert await async_setup_component(
        hass, "automation", {"automation": session_config(repeat_seconds=5)}
    )
    await settle()
    hass.states.async_set("binary_sensor.first", "on")
    await settle()
    assert events == ["test_started"]
    freezer.tick(timedelta(seconds=6))
    async_fire_time_changed(hass, dt_util.utcnow())
    await settle()
    assert "test_repeated" in events
    hass.states.async_set("binary_sensor.second", "on")
    hass.states.async_set("binary_sensor.first", "off")
    await settle()
    assert "test_stopped" not in events
    hass.states.async_set("binary_sensor.second", "off")
    await settle()
    assert events[-2:] == ["test_stopped", "test_cleared"]
    count = len(events)
    freezer.tick(timedelta(seconds=20))
    async_fire_time_changed(hass, dt_util.utcnow())
    await settle()
    assert len(events) == count


async def test_session_connection_loss_is_not_acknowledgement(hass):
    events = []
    for name in ("started", "stopped", "cleared", "lost"):
        hass.bus.async_listen("test_" + name, lambda event: events.append(event.event_type))
    for entity in ("binary_sensor.first", "binary_sensor.second"):
        hass.states.async_set(entity, "off")
    assert await async_setup_component(hass, "automation", {"automation": session_config()})
    await settle()
    hass.states.async_set("binary_sensor.first", "on")
    await settle()
    hass.states.async_set("binary_sensor.first", "unavailable")
    await settle()
    assert events == ["test_started", "test_stopped", "test_lost"]
    hass.states.async_set("binary_sensor.first", "on")
    await settle()
    assert events[-1] == "test_started"
    hass.states.async_set("binary_sensor.first", "off")
    await settle()
    assert events[-2:] == ["test_stopped", "test_cleared"]


async def test_session_restores_selected_lights_and_cleans_up_scene(hass):
    from homeassistant.components.light import ColorMode, LightEntity
    from pytest_homeassistant_custom_component.common import MockPlatform, mock_platform

    class Lamp(LightEntity):
        _attr_name = "Bedroom"
        _attr_supported_color_modes = {ColorMode.ONOFF}
        _attr_color_mode = ColorMode.ONOFF
        _attr_is_on = False

        async def async_turn_on(self, **kwargs):
            self._attr_is_on = True
            self.async_write_ha_state()

        async def async_turn_off(self, **kwargs):
            self._attr_is_on = False
            self.async_write_ha_state()

    async def setup_lamp(hass, config, add_entities, discovery_info=None):
        add_entities([Lamp()])

    mock_platform(hass, "test.light", MockPlatform(async_setup_platform=setup_lamp))
    assert await async_setup_component(hass, "light", {"light": {"platform": "test"}})
    assert await async_setup_component(hass, "scene", {})
    await hass.async_block_till_done()
    for entity in ("binary_sensor.first", "binary_sensor.second"):
        hass.states.async_set(entity, "off")
    config = session_config(
        restore_lights=["light.bedroom"],
        start_actions=[{"action": "light.turn_on", "target": {"entity_id": "light.bedroom"}}],
    )
    assert await async_setup_component(hass, "automation", {"automation": config})
    await settle()
    assert hass.states.get("light.bedroom").state == "off"
    hass.states.async_set("binary_sensor.first", "on")
    await settle()
    assert hass.states.get("light.bedroom").state == "on"
    hass.states.async_set("binary_sensor.first", "off")
    await settle()
    await hass.async_block_till_done()
    assert hass.states.get("light.bedroom").state == "off"
    assert hass.states.get("scene.glucifer_automation_0") is None


async def test_session_quiet_hours_suppress_start(hass, freezer):
    await hass.config.async_set_time_zone("UTC")
    freezer.move_to("2026-09-08 23:00:00+00:00")
    events = []
    hass.bus.async_listen("test_started", lambda event: events.append(event))
    for entity in ("binary_sensor.first", "binary_sensor.second"):
        hass.states.async_set(entity, "off")
    assert await async_setup_component(
        hass, "automation", {"automation": session_config(quiet_enabled=True)}
    )
    await settle()
    hass.states.async_set("binary_sensor.first", "on")
    await settle()
    assert events == []
