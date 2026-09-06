# SPDX-License-Identifier: GPL-3.0-or-later
"""Receive JugglucoNG snapshots through a private Home Assistant webhook."""

import json

from aiohttp import web
from homeassistant.components import webhook
from homeassistant.const import Platform
from homeassistant.helpers import config_validation as cv

from .const import DOMAIN, MAX_BODY_BYTES
from .coordinator import JugglucoCoordinator
from .protocol import InvalidSnapshot


async def async_setup(hass, config):
    from .api import async_register

    await async_register(hass)
    return True


CONFIG_SCHEMA = cv.config_entry_only_config_schema(DOMAIN)
PLATFORMS = [Platform.SENSOR, Platform.BINARY_SENSOR]


async def async_setup_entry(hass, entry):
    coordinator = JugglucoCoordinator(hass, entry)
    await coordinator.async_initialize()
    entry.runtime_data = coordinator

    async def receive(_hass, _webhook_id, request):
        try:
            chunks = bytearray()
            while chunk := await request.content.read(4096):
                chunks.extend(chunk)
                if len(chunks) > MAX_BODY_BYTES:
                    return web.json_response({"error": "payload_too_large"}, status=413)
            payload = json.loads(chunks)
            acknowledgement = await coordinator.async_accept(payload)
        except json.JSONDecodeError, UnicodeDecodeError, RecursionError:
            return web.json_response({"error": "invalid_json"}, status=400)
        except InvalidSnapshot as error:
            return web.json_response({"error": str(error)}, status=422)
        except OSError:
            return web.json_response({"error": "storage_unavailable"}, status=503)
        return web.json_response(acknowledgement)

    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)
    webhook.async_register(
        hass,
        DOMAIN,
        entry.title,
        entry.data["webhook_id"],
        receive,
        local_only=entry.options.get("local_only", True),
        allowed_methods=["POST"],
    )
    entry.async_on_unload(entry.add_update_listener(_reload))
    return True


async def _reload(hass, entry):
    await hass.config_entries.async_reload(entry.entry_id)


async def async_unload_entry(hass, entry):
    if await hass.config_entries.async_unload_platforms(entry, PLATFORMS):
        webhook.async_unregister(hass, entry.runtime_data.webhook_id)
        return True
    return False


async def async_remove_entry(hass, entry):
    from homeassistant.helpers.storage import Store

    await Store(hass, 1, f"{DOMAIN}.{entry.entry_id}").async_remove()
