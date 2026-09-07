# SPDX-License-Identifier: GPL-3.0-or-later
"""Durable reception, contact tracking, and bounded measurement history."""

import asyncio
import logging
from datetime import timedelta
from statistics import median

from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers.event import async_track_time_interval
from homeassistant.helpers.storage import Store
from homeassistant.helpers.update_coordinator import DataUpdateCoordinator
from homeassistant.util import dt as dt_util

from .alerts import merge_events, validate_change
from .const import ALERTS, DEFAULT_STALE_SECONDS, DOMAIN, HISTORY_DAYS, MAX_HISTORY_POINTS
from .journal import apply_journal, empty_journal, restore_journal, validate_journal
from .protocol import (
    InvalidSnapshot,
    classify_snapshot,
    validate_backfill_status,
    validate_history,
    validate_snapshot,
)

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
        self.journal = empty_journal()
        self.alert_history = []
        self.known_alerts = set()
        self.new_alert_events = []
        self.reading_intervals = []
        self.test_state = "off"
        self.test_reason = "idle"
        self.test_cancel = None
        self.revision = 0
        self.last_contact_ms = None
        self.backfill_active = None
        # Capture the registered secret; entry.data may change before unload.
        self.webhook_id = entry.data["webhook_id"]

    async def async_initialize(self):
        saved = await self.store.async_load()
        if saved is not None:
            try:
                # Version 0.1 saved the snapshot directly.
                self.data = validate_snapshot(saved.get("snapshot", saved), self.now_ms)
                self.known_alerts = set(saved.get("known_alerts", [])) & ALERTS.keys()
                self.known_alerts.update(self.data["alerts"])
                contact = saved.get("last_contact_ms")
                if type(contact) is int and 0 < contact <= self.now_ms + 120000:
                    self.last_contact_ms = contact
                if type(saved.get("backfill_active")) is bool:
                    self.backfill_active = saved["backfill_active"]
                try:
                    events = saved.get("alert_history", [])
                    if not isinstance(events, list) or len(events) > 256:
                        raise InvalidSnapshot("invalid_alert_history")
                    self.alert_history, _ = merge_events(
                        [], [validate_change(event, self.now_ms) for event in events], self.now_ms
                    )
                    intervals = saved.get("reading_intervals", [])
                    if isinstance(intervals, list):
                        self.reading_intervals = [
                            v for v in intervals[-8:] if type(v) is int and 1 <= v <= 900
                        ]
                except InvalidSnapshot, TypeError, KeyError:
                    LOGGER.warning("Ignoring invalid saved Glucifer alert history")
                    self.alert_history = []
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
                try:
                    self.journal = restore_journal(saved.get("journal"), self.now_ms)
                    receipt = self.journal["last_payload"]
                    if receipt is not None and receipt["source_id"] != self.data["source_id"]:
                        raise InvalidSnapshot("source_mismatch")
                except InvalidSnapshot, TypeError, KeyError:
                    LOGGER.warning("Ignoring invalid saved Glucifer journal")
                    self.journal = empty_journal()
            except InvalidSnapshot, TypeError, KeyError:
                LOGGER.warning("Ignoring invalid saved Glucifer data")
                self.data = None
                self.history = []
                self.journal = empty_journal()
                self.last_contact_ms = None
        self.entry.async_on_unload(self.cancel_test)
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

    def availability_reason(self, *, glucose=False, alert=None):
        if self.data is None:
            return "waiting_for_first_snapshot"
        if alert is not None:
            if alert not in self.data["alerts"]:
                return "field_disabled"
            if self.data["alerts"][alert] is None:
                return "alert_state_unknown"
        if not self.connected:
            return "sender_timeout"
        if not self.fresh():
            return "snapshot_stale"
        if glucose and not self.fresh(glucose=True):
            return "glucose_stale"
        return "current"

    @property
    def observed_interval_seconds(self):
        return round(median(self.reading_intervals)) if len(self.reading_intervals) >= 3 else None

    @callback
    def cancel_test(self):
        if self.test_cancel:
            self.test_cancel()
            self.test_cancel = None

    @callback
    def set_test(self, phase, seconds=60):
        from homeassistant.helpers.event import async_call_later

        self.cancel_test()
        self.test_state = {"fired": "on", "connection_lost": "unavailable"}.get(phase, "off")
        self.test_reason = phase
        if phase in {"fired", "connection_lost"}:
            self.test_cancel = async_call_later(self.hass, seconds, self._expire_test)
        self.async_update_listeners()

    @callback
    def _expire_test(self, _now):
        self.set_test("expired")

    @callback
    def _tick(self, _now):
        events, _ = merge_events(self.alert_history, [], self.now_ms)
        if events != self.alert_history:
            self.alert_history = events
            self.revision += 1
        self.async_update_listeners()

    def merge_history(self, current, incoming):
        cutoff = self.now_ms - HISTORY_DAYS * 86400000
        # First recorded value wins for a timestamp, including across retries.
        points = {point["time_ms"]: point for point in current if point["time_ms"] >= cutoff}
        for point in incoming:
            if point["time_ms"] >= cutoff:
                points.setdefault(point["time_ms"], point)
        return [points[key] for key in sorted(points)[-MAX_HISTORY_POINTS:]]

    async def _save(
        self,
        snapshot,
        history,
        contact,
        backfill_active=None,
        journal=None,
        alert_history=None,
        reading_intervals=None,
    ):
        await self.store.async_save(
            {
                "snapshot": snapshot,
                "known_alerts": sorted(self.known_alerts | snapshot["alerts"].keys()),
                "alert_history": self.alert_history if alert_history is None else alert_history,
                "reading_intervals": self.reading_intervals
                if reading_intervals is None
                else reading_intervals,
                "journal": self.journal if journal is None else journal,
                "history": history,
                "last_contact_ms": contact,
                "backfill_active": self.backfill_active
                if backfill_active is None
                else backfill_active,
            }
        )

    async def async_accept(self, payload):
        if isinstance(payload, dict) and payload.get("type") == "journal":
            return await self.async_accept_journal(payload)
        if isinstance(payload, dict) and payload.get("type") == "backfill_status":
            return await self.async_accept_backfill_status(payload)
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
            events, new_events = merge_events(
                self.alert_history,
                incoming.get("alert_events", []) if status == "accepted" else [],
                contact,
            )
            intervals = self.reading_intervals.copy()
            if status == "accepted" and self.data:
                delta = (incoming["glucose"]["time_ms"] - self.data["glucose"]["time_ms"]) // 1000
                if 1 <= delta <= 900:
                    intervals = (intervals + [delta])[-8:]
            await self._save(
                snapshot, history, contact, alert_history=events, reading_intervals=intervals
            )
            self.known_alerts.update(snapshot["alerts"])
            self.alert_history, self.reading_intervals = events, intervals
            self.new_alert_events = new_events
            self.history, self.last_contact_ms = history, contact
            if status == "accepted":
                self.revision += 1
            self.async_set_updated_data(snapshot)
            self.new_alert_events = []
            return {
                "schema_version": incoming["schema_version"],
                "source_id": incoming["source_id"],
                "sequence": incoming["sequence"],
                "status": status,
                "supported_versions": [1, 2],
                "capabilities": ["backfill_status", "journal_v1"],
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
            if history != self.history:
                self.revision += 1
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

    async def async_accept_backfill_status(self, payload):
        incoming = validate_backfill_status(payload)
        async with self.lock:
            if self.data is None or incoming["source_id"] != self.data["source_id"]:
                raise InvalidSnapshot("source_mismatch")
            contact = self.now_ms
            await self._save(self.data, self.history, contact, incoming["active"])
            self.backfill_active = incoming["active"]
            self.last_contact_ms = contact
            self.async_update_listeners()
            return {**incoming, "status": "accepted"}

    async def async_accept_journal(self, payload):
        incoming = validate_journal(payload, self.now_ms)
        async with self.lock:
            if self.data is None or incoming["source_id"] != self.data["source_id"]:
                raise InvalidSnapshot("source_mismatch")
            journal, status = apply_journal(self.journal, incoming, self.now_ms)
            contact = self.now_ms
            await self._save(self.data, self.history, contact, journal=journal)
            self.journal, self.last_contact_ms = journal, contact
            if status == "accepted":
                self.revision += 1
            self.async_update_listeners()
            return {
                "schema_version": 2,
                "type": "journal",
                "source_id": incoming["source_id"],
                "sequence": incoming["sequence"],
                "status": status,
            }
