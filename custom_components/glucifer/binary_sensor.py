# SPDX-License-Identifier: GPL-3.0-or-later
"""Boolean alert episode states reported by JugglucoNG."""

from homeassistant.components.binary_sensor import BinarySensorDeviceClass, BinarySensorEntity
from homeassistant.const import EntityCategory
from homeassistant.core import callback

from .const import ALERTS
from .entity import JugglucoEntity


async def async_setup_entry(hass, entry, async_add_entities):
    coordinator = entry.runtime_data
    known = set()
    async_add_entities(
        [
            JugglucoHealth(coordinator, "connected", "Connected"),
            JugglucoHealth(coordinator, "stale", "Glucose stale"),
            JugglucoWarmup(coordinator, "sensor_warmup", "Sensor warming up"),
            JugglucoBackfill(coordinator, "backfill_active", "Backfill active"),
        ]
    )

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


class JugglucoHealth(JugglucoEntity, BinarySensorEntity):
    _attr_entity_category = EntityCategory.DIAGNOSTIC

    def __init__(self, *args):
        super().__init__(*args)
        self._attr_device_class = (
            BinarySensorDeviceClass.CONNECTIVITY
            if self.key == "connected"
            else BinarySensorDeviceClass.PROBLEM
        )

    @property
    def available(self):
        return True

    @property
    def is_on(self):
        if self.key == "connected":
            return self.coordinator.connected
        return not self.coordinator.fresh(glucose=True)


class JugglucoWarmup(JugglucoEntity, BinarySensorEntity):
    @property
    def available(self):
        return (
            super().available and self.coordinator.data["fields"].get("sensor_warmup") is not None
        )

    @property
    def is_on(self):
        return (
            self.coordinator.data["fields"].get("sensor_warmup") if self.coordinator.data else None
        )


class JugglucoBackfill(JugglucoEntity, BinarySensorEntity):
    _attr_entity_category = EntityCategory.DIAGNOSTIC
    _attr_icon = "mdi:database-arrow-up"

    @property
    def available(self):
        return self.coordinator.connected and self.coordinator.backfill_active is not None

    @property
    def is_on(self):
        return self.coordinator.backfill_active
