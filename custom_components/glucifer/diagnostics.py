# SPDX-License-Identifier: GPL-3.0-or-later
"""Export operational information without readings, identity, or credentials."""

from .const import DEFAULT_STALE_SECONDS


async def async_get_config_entry_diagnostics(hass, entry):
    coordinator = entry.runtime_data
    return {
        "local_only": entry.options.get("local_only", True),
        "stale_seconds": entry.options.get("stale_seconds", DEFAULT_STALE_SECONDS),
        "glucose_unit": entry.options.get("glucose_unit", "mg/dL"),
        "has_snapshot": coordinator.data is not None,
        "connected": coordinator.connected,
        "availability_reason": coordinator.availability_reason(glucose=True),
        "observed_reading_interval_seconds": coordinator.observed_interval_seconds,
        "reporting": (coordinator.data or {}).get("reporting"),
        "glucose_fresh": coordinator.fresh(glucose=True),
        "history_points": len(coordinator.history),
        "selected_fields": sorted(coordinator.data["fields"]) if coordinator.data else [],
        "selected_alerts": sorted(coordinator.data["alerts"]) if coordinator.data else [],
    }
