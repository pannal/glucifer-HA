# SPDX-License-Identifier: GPL-3.0-or-later
"""Wire field definitions for JugglucoNG."""

DOMAIN = "glucifer"
DEFAULT_STALE_SECONDS = 300
MAX_BODY_BYTES = 32768
HISTORY_DAYS = 7
MAX_HISTORY_POINTS = 20160
MAX_HISTORY_BATCH = 256
GLUCOSE_FIELDS = {"glucose", "delta_mgdl", "raw_mgdl", "auto_mgdl"}
LIFECYCLE_FIELDS = {"sensor_started_ms", "sensor_expires_ms", "sensor_warmup"}
FIELDS = {
    "trend": ("Trend", None, "text"),
    "rate_mgdl_min": ("Rate of change", "mg/dL/min", "number"),
    "delta_mgdl": ("Glucose delta", "mg/dL", "number"),
    "raw_mgdl": ("Raw glucose", "mg/dL", "number"),
    "auto_mgdl": ("Automatically calibrated glucose", "mg/dL", "number"),
    "iob_u": ("Insulin on board", "U", "number"),
    "cob_g": ("Carbohydrates on board", "g", "number"),
    "battery_percent": ("Phone battery", "%", "number"),
    "sensor_id": ("Sensor identifier", None, "text"),
    "sensor_started_ms": ("Sensor activation", None, "timestamp"),
    "sensor_expires_ms": ("Sensor estimated expiry", None, "timestamp"),
    "sensor_warmup": ("Sensor warming up", None, "boolean"),
    "sensor_generation": ("Sensor generation", None, "number"),
}
ALERTS = {
    "low": "Low glucose alert",
    "high": "High glucose alert",
    "very_low": "Very low glucose alert",
    "very_high": "Very high glucose alert",
    "pre_low": "Forecast low alert",
    "pre_high": "Forecast high alert",
    "missed_reading": "Missed reading alert",
    "persistent_high": "Persistent high alert",
    "loss": "Signal loss alert",
    "sensor_expiry": "Sensor expiry alert",
    "falling_fast": "Falling fast alert",
    "rising_fast": "Rising fast alert",
    "sensor_pressure": "Sensor pressure alert",
}
READING_FIELDS = {"trend", "rate_mgdl_min", "delta_mgdl", "raw_mgdl", "auto_mgdl"}
