# SPDX-License-Identifier: GPL-3.0-or-later
"""Alert activity in HA's native event history; never replay on reload."""

from homeassistant.components.event import EventEntity
from homeassistant.core import callback

from .alerts import REASONS
from .const import ALERTS
from .entity import JugglucoEntity


async def async_setup_entry(hass, entry, async_add_entities):
    async_add_entities(
        [JugglucoAlertActivity(entry.runtime_data, "alert_activity", "Alert activity")]
    )


class JugglucoAlertActivity(JugglucoEntity, EventEntity):
    _attr_event_types = list(REASONS)
    _attr_icon = "mdi:bell-outline"

    def __init__(self, *args):
        super().__init__(*args)
        self._attr_translation_key = "alert_activity"
        del self._attr_name

    @property
    def available(self):
        return True

    @callback
    def _handle_coordinator_update(self):
        for event in self.coordinator.new_alert_events:
            self._trigger_event(event["reason"], {**event, "alert_name": ALERTS[event["alert"]]})
            self.async_write_ha_state()
