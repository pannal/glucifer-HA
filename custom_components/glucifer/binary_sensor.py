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
            JugglucoTest(coordinator, "test_alert", "Test alert"),
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

    @property
    def extra_state_attributes(self):
        data = self.coordinator.data or {}
        detail = data.get("alert_details", {}).get(self.alert_key, {})
        return {
            "availability_reason": self.coordinator.availability_reason(alert=self.alert_key),
            "reason": detail.get("reason"),
            "changed_at_ms": detail.get("time_ms"),
            "snoozed_until_ms": detail.get("snoozed_until_ms"),
        }


class JugglucoTest(JugglucoEntity, BinarySensorEntity):
    _attr_entity_category = EntityCategory.DIAGNOSTIC
    _attr_device_class = BinarySensorDeviceClass.PROBLEM
    _attr_icon = "mdi:test-tube"

    def __init__(self, *args):
        super().__init__(*args)
        self._attr_translation_key = "test_alert"
        del self._attr_name

    @property
    def available(self):
        return self.coordinator.test_state != "unavailable"

    @property
    def is_on(self):
        return self.coordinator.test_state == "on"

    @property
    def extra_state_attributes(self):
        return {"test": True, "reason": self.coordinator.test_reason}


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
