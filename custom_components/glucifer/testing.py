# SPDX-License-Identifier: GPL-3.0-or-later
"""Bounded test sessions never write production state or phone data."""

import voluptuous as vol
from homeassistant.core import callback
from homeassistant.exceptions import ServiceValidationError

from .const import DOMAIN


@callback
def async_register_test_service(hass):
    async def run(call):
        entry = hass.config_entries.async_get_entry(call.data["config_entry_id"])
        if entry is None or entry.domain != DOMAIN or not getattr(entry, "runtime_data", None):
            raise ServiceValidationError("Glucifer receiver is not loaded")
        entry.runtime_data.set_test(call.data["phase"], call.data["duration_seconds"])

    hass.services.async_register(
        DOMAIN,
        "test_alert",
        run,
        schema=vol.Schema(
            {
                vol.Required("config_entry_id"): str,
                vol.Required("phase"): vol.In(
                    ["fired", "acknowledged", "snoozed", "cleared", "connection_lost"]
                ),
                vol.Optional("duration_seconds", default=60): vol.All(
                    vol.Coerce(int), vol.Range(min=1, max=300)
                ),
            }
        ),
    )
