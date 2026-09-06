# SPDX-License-Identifier: GPL-3.0-or-later
"""Validate complete blueprints and their quiet-hour/cooldown behavior."""

from datetime import UTC, datetime, timedelta
from pathlib import Path

import pytest
from homeassistant.components.automation.config import (
    AUTOMATION_BLUEPRINT_SCHEMA,
    async_validate_config_item,
)
from homeassistant.components.blueprint.models import Blueprint, BlueprintInputs
from homeassistant.helpers.template import Template
from homeassistant.util.yaml import load_yaml


@pytest.mark.parametrize(
    "filename,input_key",
    [("alert_actions.yaml", "alert_entity"), ("stale_actions.yaml", "stale_entity")],
)
async def test_blueprint_schema_and_actual_automation(hass, filename, input_key):
    data = load_yaml(str(Path(__file__).parents[1] / "blueprints/automation" / filename))
    blueprint = Blueprint(data, expected_domain="automation", schema=AUTOMATION_BLUEPRINT_SCHEMA)
    inputs = BlueprintInputs(
        blueprint,
        {
            "use_blueprint": {
                "path": filename,
                "input": {
                    input_key: "binary_sensor.phone_high_glucose_alert",
                    "actions": [{"event": "informational_display"}],
                },
            }
        },
    )
    inputs.validate()
    config = inputs.async_substitute()
    validated = await async_validate_config_item(hass, "automation", config)
    assert validated["triggers"][0]["from"] == "off"
    assert validated["triggers"][0]["to"] == "on"


@pytest.mark.parametrize(
    "hour,quiet,start,end,expected",
    [
        (23, True, "22:00:00", "07:00:00", False),
        (6, True, "22:00:00", "07:00:00", False),
        (12, True, "22:00:00", "07:00:00", True),
        (23, False, "22:00:00", "07:00:00", True),
        (12, True, "10:00:00", "14:00:00", False),
        (8, True, "10:00:00", "14:00:00", True),
    ],
)
async def test_quiet_hours(hass, freezer, hour, quiet, start, end, expected):
    await hass.config.async_set_time_zone("UTC")
    freezer.move_to(datetime(2026, 9, 6, hour, tzinfo=UTC))
    data = load_yaml(str(Path(__file__).parents[1] / "blueprints/automation/alert_actions.yaml"))
    result = Template(data["conditions"][0]["value_template"], hass).async_render(
        {"quiet_enabled": quiet, "quiet_start": start, "quiet_end": end}
    )
    assert result is expected


async def test_cooldown(hass, freezer):
    now = datetime(2026, 9, 6, 12, tzinfo=UTC)
    freezer.move_to(now)
    data = load_yaml(str(Path(__file__).parents[1] / "blueprints/automation/alert_actions.yaml"))
    condition = Template(data["conditions"][1]["value_template"], hass)
    for previous, expected in [
        (None, True),
        (now - timedelta(minutes=1), False),
        (now - timedelta(minutes=15), True),
    ]:
        assert (
            condition.async_render(
                {"this": {"attributes": {"last_triggered": previous}}, "cooldown": 15}
            )
            is expected
        )
