# SPDX-License-Identifier: GPL-3.0-or-later
"""Glucose and individually selected optional measurements."""

from datetime import UTC, datetime

from homeassistant.components.sensor import SensorDeviceClass, SensorEntity, SensorStateClass
from homeassistant.core import callback

from .const import FIELDS, READING_FIELDS
from .entity import JugglucoEntity


async def async_setup_entry(hass, entry, async_add_entities):
    coordinator = entry.runtime_data
    known = {"glucose", "measurement_time"}
    async_add_entities(
        [
            JugglucoSensor(coordinator, "glucose", "Glucose", "mg/dL", "number"),
            JugglucoSensor(coordinator, "measurement_time", "Measurement time", None, "timestamp"),
        ]
    )

    @callback
    def add_fields():
        if coordinator.data is None:
            return
        new = coordinator.data["fields"].keys() - known
        known.update(new)
        async_add_entities([JugglucoSensor(coordinator, key, *FIELDS[key]) for key in sorted(new)])

    entry.async_on_unload(coordinator.async_add_listener(add_fields))
    add_fields()


class JugglucoSensor(JugglucoEntity, SensorEntity):
    def __init__(self, coordinator, key, name, unit, kind):
        super().__init__(coordinator, key, name)
        self._attr_native_unit_of_measurement = unit
        if kind == "number" and key != "sensor_generation":
            self._attr_state_class = SensorStateClass.MEASUREMENT
        if kind == "timestamp":
            self._attr_device_class = SensorDeviceClass.TIMESTAMP
        if key == "battery_percent":
            self._attr_device_class = SensorDeviceClass.BATTERY
        self._attr_icon = "mdi:water" if key == "glucose" else None

    @property
    def available(self):
        if self.key == "measurement_time":
            return self.coordinator.data is not None
        if not self.coordinator.fresh(glucose=self.key in READING_FIELDS | {"glucose"}):
            return False
        return self.key == "glucose" or self.coordinator.data["fields"].get(self.key) is not None

    @property
    def native_value(self):
        data = self.coordinator.data
        if data is None:
            return None
        if self.key == "glucose":
            return data["glucose"]["mgdl"]
        if self.key == "measurement_time":
            return datetime.fromtimestamp(data["glucose"]["time_ms"] / 1000, UTC)
        return data["fields"].get(self.key)
