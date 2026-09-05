# SPDX-License-Identifier: GPL-3.0-or-later
"""Durable reception and freshness tracking."""

import asyncio
import logging
from datetime import timedelta

from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers.event import async_track_time_interval
from homeassistant.helpers.storage import Store
from homeassistant.helpers.update_coordinator import DataUpdateCoordinator
from homeassistant.util import dt as dt_util

from .const import DEFAULT_STALE_SECONDS, DOMAIN
from .protocol import InvalidSnapshot, classify_snapshot, validate_snapshot

LOGGER = logging.getLogger(__name__)


class JugglucoCoordinator(DataUpdateCoordinator):
    """Publish only validated, persisted snapshots."""

    def __init__(self, hass: HomeAssistant, entry):
        super().__init__(hass, LOGGER, name=DOMAIN, config_entry=entry)
        self.entry = entry
        self.store = Store(hass, 1, f"{DOMAIN}.{entry.entry_id}", private=True)
        self.lock = asyncio.Lock()
        self.data = None

    async def async_initialize(self):
        saved = await self.store.async_load()
        if saved is not None:
            try:
                self.data = validate_snapshot(saved, self.now_ms)
            except InvalidSnapshot:
                LOGGER.warning("Ignoring invalid saved JugglucoNG snapshot")
        self.entry.async_on_unload(
            async_track_time_interval(self.hass, self._tick, timedelta(seconds=15))
        )

    @property
    def now_ms(self):
        return int(dt_util.utcnow().timestamp() * 1000)

    def fresh(self, *, glucose=False):
        if self.data is None:
            return False
        limit = self.entry.options.get("stale_seconds", DEFAULT_STALE_SECONDS) * 1000
        stamp = self.data["glucose"]["time_ms"] if glucose else self.data["sent_at_ms"]
        return -120000 <= self.now_ms - stamp <= limit and (glucose is False or self.fresh())

    @callback
    def _tick(self, _now):
        self.async_update_listeners()

    async def async_accept(self, payload):
        incoming = validate_snapshot(payload, self.now_ms)
        async with self.lock:
            status = classify_snapshot(self.data, incoming)
            if status == "accepted":
                # A failed disk write must not produce an acceptance acknowledgement.
                await self.store.async_save(incoming)
                self.async_set_updated_data(incoming)
            return {
                "schema_version": 1,
                "source_id": incoming["source_id"],
                "sequence": incoming["sequence"],
                "status": status,
            }
