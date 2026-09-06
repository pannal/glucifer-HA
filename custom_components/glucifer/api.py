# SPDX-License-Identifier: GPL-3.0-or-later
"""Authenticated history access and a bundled dashboard card."""

from pathlib import Path

import voluptuous as vol
from homeassistant.auth.permissions.const import POLICY_READ
from homeassistant.components import websocket_api
from homeassistant.components.http import StaticPathConfig
from homeassistant.core import callback
from homeassistant.helpers import entity_registry as er

from .const import DOMAIN
from .journal import retained_entries


async def async_register(hass):
    websocket_api.async_register_command(hass, history)
    websocket_api.async_register_command(hass, subscribe)
    await hass.http.async_register_static_paths(
        [
            StaticPathConfig(
                "/glucifer/glucifer-card.js",
                str(Path(__file__).parent / "frontend/glucifer-card.js"),
                False,
            )
        ]
    )


@websocket_api.websocket_command(
    {vol.Required("type"): "glucifer/history", vol.Required("entity_id"): str}
)
@callback
def history(hass, connection, msg):
    registry = er.async_get(hass)
    entity = registry.async_get(msg["entity_id"])
    if (
        entity is None
        or entity.platform != DOMAIN
        or entity.unique_id != f"{entity.config_entry_id}_glucose"
        or not connection.user.permissions.check_entity(entity.entity_id, POLICY_READ)
    ):
        connection.send_error(msg["id"], "not_found", "Receiver not available")
        return
    entry = hass.config_entries.async_get_entry(entity.config_entry_id)
    if entry is None or not getattr(entry, "runtime_data", None):
        connection.send_error(msg["id"], "not_found", "Receiver not loaded")
        return
    coordinator = entry.runtime_data
    prefix = f"{entry.entry_id}_"
    entities = {
        item.unique_id.removeprefix(prefix): item.entity_id
        for item in er.async_entries_for_config_entry(registry, entry.entry_id)
        if connection.user.permissions.check_entity(item.entity_id, POLICY_READ)
    }
    connection.send_result(
        msg["id"],
        {
            "readings": coordinator.merge_history(coordinator.history, []),
            "journal": retained_entries(coordinator.journal, coordinator.now_ms),
            "journal_enabled": coordinator.journal["enabled"],
            "journal_history_days": coordinator.journal["history_days"],
            "entities": entities,
            "unit": entry.options.get("glucose_unit", "mg/dL"),
        },
    )


@websocket_api.websocket_command(
    {vol.Required("type"): "glucifer/subscribe", vol.Required("entity_id"): str}
)
@callback
def subscribe(hass, connection, msg):
    registry = er.async_get(hass)
    entity = registry.async_get(msg["entity_id"])
    if (
        entity is None
        or entity.platform != DOMAIN
        or entity.unique_id != f"{entity.config_entry_id}_glucose"
        or not connection.user.permissions.check_entity(entity.entity_id, POLICY_READ)
    ):
        connection.send_error(msg["id"], "not_found", "Receiver not available")
        return
    entry = hass.config_entries.async_get_entry(entity.config_entry_id)
    if entry is None or not getattr(entry, "runtime_data", None):
        connection.send_error(msg["id"], "not_found", "Receiver not loaded")
        return
    coordinator = entry.runtime_data
    revision = coordinator.revision

    @callback
    def changed():
        nonlocal revision
        if coordinator.revision != revision:
            revision = coordinator.revision
            if connection.user.permissions.check_entity(entity.entity_id, POLICY_READ):
                connection.send_event(msg["id"], {"changed": True})

    listener = coordinator.async_add_listener(changed)

    @callback
    def remove():
        nonlocal listener
        if listener is not None:
            listener()
            listener = None

    @callback
    def unloaded():
        if listener is not None:
            connection.send_event(msg["id"], {"changed": True, "reload": True})
        remove()

    connection.subscriptions[msg["id"]] = remove
    entry.async_on_unload(unloaded)
    connection.send_result(msg["id"])
