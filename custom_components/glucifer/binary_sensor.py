# SPDX-License-Identifier: GPL-3.0-or-later
"""Boolean alert episode states reported by JugglucoNG."""

from homeassistant.components.binary_sensor import BinarySensorDeviceClass, BinarySensorEntity
from homeassistant.core import callback

from .const import ALERTS
from .entity import JugglucoEntity


async def async_setup_entry(hass, entry, async_add_entities):
    coordinator = entry.runtime_data
    known = set()

    @callback
    def add_alerts():
        if coordinator.data is None:
            return
        new = coordinator.data["alerts"].keys() - known
        known.update(new)
        async_add_entities([JugglucoAlert(coordinator, key) for key in sorted(new)])

    entry.async_on_unload(coordinator.async_add_listener(add_alerts))
    add_alerts()


class JugglucoAlert(JugglucoEntity, BinarySensorEntity):
    _attr_device_class = BinarySensorDeviceClass.PROBLEM

    def __init__(self, coordinator, key):
        super().__init__(coordinator, f"alert_{key}", ALERTS[key])
        self.alert_key = key

    @property
    def available(self):
        return super().available and self.coordinator.data["alerts"].get(self.alert_key) is not None

    @property
    def is_on(self):
        if self.coordinator.data is None:
            return None
        return self.coordinator.data["alerts"].get(self.alert_key)
