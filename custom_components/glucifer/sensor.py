# SPDX-License-Identifier: GPL-3.0-or-later
"""Glucose and individually selected optional measurements."""

from datetime import UTC, datetime

from homeassistant.components.sensor import SensorDeviceClass, SensorEntity, SensorStateClass
from homeassistant.const import EntityCategory
from homeassistant.core import callback
from homeassistant.helpers import entity_registry as er
from homeassistant.util.unit_conversion import BloodGlucoseConcentrationConverter

from .const import FIELDS, GLUCOSE_FIELDS, READING_FIELDS
from .entity import JugglucoEntity


async def async_setup_entry(hass, entry, async_add_entities):
    coordinator = entry.runtime_data
    registry = er.async_get(hass)
    for item in er.async_entries_for_config_entry(registry, entry.entry_id):
        if item.unique_id.removeprefix(f"{entry.entry_id}_") in GLUCOSE_FIELDS:
            registry.async_update_entity_options(
                item.entity_id,
                "sensor",
                {
                    **item.options.get("sensor", {}),
                    "unit_of_measurement": entry.options.get("glucose_unit", "mg/dL"),
                },
            )
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
        new = {key for key in coordinator.data["fields"] if FIELDS[key][2] != "boolean"} - known
        known.update(new)
        async_add_entities([JugglucoSensor(coordinator, key, *FIELDS[key]) for key in sorted(new)])

    async_add_entities(
        [
            JugglucoDiagnostic(coordinator, key, name, unit, kind)
            for key, name, unit, kind in [
                ("connection_status", "Connection status", None, "text"),
                ("alert_status", "Alert data status", None, "text"),
                ("snapshot_age", "Snapshot age", "s", "number"),
                ("observed_interval", "Observed reading interval", "s", "number"),
                ("background_interval", "Background sending interval", "s", "number"),
                ("last_contact", "Last contact", None, "timestamp"),
                ("reading_age", "Reading age", "s", "number"),
                ("history_count", "Stored history readings", None, "number"),
            ]
        ]
    )
    entry.async_on_unload(coordinator.async_add_listener(add_fields))
    add_fields()


class JugglucoSensor(JugglucoEntity, SensorEntity):
    def __init__(self, coordinator, key, name, unit, kind):
        super().__init__(coordinator, key, name)
        self.kind = kind
        self.display_unit = coordinator.entry.options.get("glucose_unit", "mg/dL")
        if key in GLUCOSE_FIELDS:
            unit = self.display_unit
            self._attr_suggested_unit_of_measurement = unit
            self._attr_device_class = SensorDeviceClass.BLOOD_GLUCOSE_CONCENTRATION
        elif key == "rate_mgdl_min":
            unit = f"{self.display_unit}/min"
        if kind == "number" and key not in {"sensor_generation", "reading_age", "history_count"}:
            self._attr_suggested_display_precision = (
                0 if key in {"glucose", "raw_mgdl", "auto_mgdl"} and unit == "mg/dL" else 1
            )
        self._attr_native_unit_of_measurement = unit
        if kind == "number" and key not in ("sensor_generation", "rate_mgdl_min"):
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
            return convert_glucose(data["glucose"]["mgdl"], self.display_unit)
        if self.key == "measurement_time":
            return datetime.fromtimestamp(data["glucose"]["time_ms"] / 1000, UTC)
        value = data["fields"].get(self.key)
        if value is not None:
            if self.key in GLUCOSE_FIELDS | {"rate_mgdl_min"}:
                return convert_glucose(value, self.display_unit)
            if self.kind == "timestamp":
                return datetime.fromtimestamp(value / 1000, UTC)
            if self.kind == "number" and self.key != "sensor_generation":
                return round(value, 1)
        return value


def convert_glucose(value, unit):
    converted = (
        value
        if unit == "mg/dL"
        else BloodGlucoseConcentrationConverter.convert(value, "mg/dL", unit)
    )
    return round(converted, 1)


class JugglucoDiagnostic(JugglucoSensor):
    _attr_entity_category = EntityCategory.DIAGNOSTIC
    _attr_state_class = None

    def __init__(self, *args):
        super().__init__(*args)
        self._attr_state_class = None
        if self.key in {
            "connection_status",
            "alert_status",
            "snapshot_age",
            "observed_interval",
            "background_interval",
        }:
            self._attr_translation_key = self.key
            del self._attr_name
        if self.key in {"connection_status", "alert_status"}:
            self._attr_device_class = SensorDeviceClass.ENUM
            self._attr_options = [
                "waiting_for_first_snapshot",
                "sender_timeout",
                "snapshot_stale",
                "glucose_stale",
                "current",
                "fields_disabled",
                "alert_state_unknown",
            ]

    @property
    def available(self):
        return True

    @property
    def native_value(self):
        coordinator = self.coordinator
        if self.key == "connection_status":
            return coordinator.availability_reason(glucose=True)
        if self.key == "alert_status":
            reason = coordinator.availability_reason()
            if reason != "current":
                return reason
            alerts = coordinator.data["alerts"]
            if not alerts:
                return "fields_disabled"
            return "alert_state_unknown" if any(v is None for v in alerts.values()) else "current"
        if self.key == "snapshot_age":
            return (
                max(0, (coordinator.now_ms - coordinator.data["sent_at_ms"]) // 1000)
                if coordinator.data
                else None
            )
        if self.key == "observed_interval":
            return coordinator.observed_interval_seconds
        if self.key == "background_interval":
            return (coordinator.data or {}).get("reporting", {}).get("background_interval_seconds")
        if self.key == "last_contact":
            return (
                datetime.fromtimestamp(coordinator.last_contact_ms / 1000, UTC)
                if coordinator.last_contact_ms
                else None
            )
        if self.key == "reading_age":
            return (
                max(0, (coordinator.now_ms - coordinator.data["glucose"]["time_ms"]) // 1000)
                if coordinator.data
                else None
            )
        return len(coordinator.history)

    @property
    def extra_state_attributes(self):
        if self.key in {"connection_status", "alert_status"}:
            return {
                "alerts": {
                    key: self.coordinator.availability_reason(alert=key)
                    for key in sorted(self.coordinator.known_alerts)
                },
                "stale_after_seconds": self.coordinator.entry.options.get("stale_seconds", 300),
                "live_events_bypass_interval": (self.coordinator.data or {})
                .get("reporting", {})
                .get("live_bypass"),
            }
        return None
