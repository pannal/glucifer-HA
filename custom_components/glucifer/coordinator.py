# SPDX-License-Identifier: GPL-3.0-or-later
"""Durable reception, contact tracking, and bounded measurement history."""

import asyncio
import logging
from datetime import timedelta

from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers.event import async_track_time_interval
from homeassistant.helpers.storage import Store
from homeassistant.helpers.update_coordinator import DataUpdateCoordinator
from homeassistant.util import dt as dt_util

from .const import DEFAULT_STALE_SECONDS, DOMAIN, HISTORY_DAYS, MAX_HISTORY_POINTS
from .protocol import InvalidSnapshot, classify_snapshot, validate_history, validate_snapshot

LOGGER = logging.getLogger(__name__)


class JugglucoCoordinator(DataUpdateCoordinator):
    """Publish validated snapshots only after saving them."""

    def __init__(self, hass: HomeAssistant, entry):
        super().__init__(hass, LOGGER, name=DOMAIN, config_entry=entry)
        self.entry = entry
        self.store = Store(hass, 1, f"{DOMAIN}.{entry.entry_id}", private=True)
        self.lock = asyncio.Lock()
        self.data = None
        self.history = []
        self.last_contact_ms = None
        # Capture the registered secret; entry.data may change before unload.
        self.webhook_id = entry.data["webhook_id"]

    async def async_initialize(self):
        saved = await self.store.async_load()
        if saved is not None:
            try:
                # Version 0.1 saved the snapshot directly.
                self.data = validate_snapshot(saved.get("snapshot", saved), self.now_ms)
                contact = saved.get("last_contact_ms")
                if type(contact) is int and 0 < contact <= self.now_ms + 120000:
                    self.last_contact_ms = contact
                points = saved.get("history", [])
                # Apply the same validation to saved history in bounded chunks.
                validated = []
                for index in range(0, min(len(points), MAX_HISTORY_POINTS), 256):
                    batch = validate_history(
                        {
                            "schema_version": 2,
                            "type": "history",
                            "source_id": self.data["source_id"],
                            "batch_id": "restore",
                            "readings": points[index : index + 256],
                        },
                        self.now_ms,
                    )
                    validated.extend(batch["readings"])
                self.history = self.merge_history(validated, [self.data["glucose"]])
            except InvalidSnapshot, TypeError, KeyError:
                LOGGER.warning("Ignoring invalid saved Glucifer data")
                self.data = None
                self.history = []
                self.last_contact_ms = None
        self.entry.async_on_unload(
            async_track_time_interval(self.hass, self._tick, timedelta(seconds=15))
        )

    @property
    def now_ms(self):
        return int(dt_util.utcnow().timestamp() * 1000)

    @property
    def connected(self):
        limit = self.entry.options.get("stale_seconds", DEFAULT_STALE_SECONDS) * 1000
        return (
            self.last_contact_ms is not None
            and -120000 <= self.now_ms - self.last_contact_ms <= limit
        )

    def fresh(self, *, glucose=False):
        if self.data is None:
            return False
        limit = self.entry.options.get("stale_seconds", DEFAULT_STALE_SECONDS) * 1000
        stamp = self.data["glucose"]["time_ms"] if glucose else self.data["sent_at_ms"]
        return -120000 <= self.now_ms - stamp <= limit and (glucose is False or self.fresh())

    @callback
    def _tick(self, _now):
        self.async_update_listeners()

    def merge_history(self, current, incoming):
        cutoff = self.now_ms - HISTORY_DAYS * 86400000
        # First recorded value wins for a timestamp, including across retries.
        points = {point["time_ms"]: point for point in current if point["time_ms"] >= cutoff}
        for point in incoming:
            if point["time_ms"] >= cutoff:
                points.setdefault(point["time_ms"], point)
        return [points[key] for key in sorted(points)[-MAX_HISTORY_POINTS:]]

    async def _save(self, snapshot, history, contact):
        await self.store.async_save(
            {"snapshot": snapshot, "history": history, "last_contact_ms": contact}
        )

    async def async_accept(self, payload):
        if isinstance(payload, dict) and payload.get("type") == "history":
            return await self.async_accept_history(payload)
        incoming = validate_snapshot(payload, self.now_ms)
        async with self.lock:
            status = classify_snapshot(self.data, incoming)
            snapshot = incoming if status == "accepted" else self.data
            history = (
                self.merge_history(self.history, [incoming["glucose"]])
                if status == "accepted"
                else self.history
            )
            contact = self.now_ms
            await self._save(snapshot, history, contact)
            self.history, self.last_contact_ms = history, contact
            self.async_set_updated_data(snapshot)
            return {
                "schema_version": incoming["schema_version"],
                "source_id": incoming["source_id"],
                "sequence": incoming["sequence"],
                "status": status,
                "supported_versions": [1, 2],
                "history_days": HISTORY_DAYS,
            }

    async def async_accept_history(self, payload):
        incoming = validate_history(payload, self.now_ms)
        async with self.lock:
            if self.data is None or incoming["source_id"] != self.data["source_id"]:
                raise InvalidSnapshot("source_mismatch")
            if incoming["readings"][-1]["time_ms"] > self.data["glucose"]["time_ms"]:
                raise InvalidSnapshot("history_newer_than_current")
            history = self.merge_history(self.history, incoming["readings"])
            contact = self.now_ms
            await self._save(self.data, history, contact)
            self.history, self.last_contact_ms = history, contact
            self.async_update_listeners()
            return {
                "schema_version": 2,
                "type": "history",
                "source_id": incoming["source_id"],
                "batch_id": incoming["batch_id"],
                "status": "accepted",
                "through_ms": incoming["readings"][-1]["time_ms"],
            }
