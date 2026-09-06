# SPDX-License-Identifier: GPL-3.0-or-later
"""Register the bundled card in UI-managed dashboard resources."""

from urllib.parse import urlsplit

from homeassistant.components.lovelace.const import LOVELACE_DATA
from homeassistant.components.lovelace.resources import ResourceStorageCollection
from homeassistant.loader import async_get_integration

from .const import DOMAIN

CARD_PATH = "/glucifer/glucifer-card.js"


def _is_bundled_card(url):
    """Only adopt this integration's local route, regardless of cache suffix."""
    try:
        parsed = urlsplit(url)
    except ValueError:
        return False
    return not parsed.scheme and not parsed.netloc and parsed.path == CARD_PATH


async def async_register_card(hass):
    resources = hass.data[LOVELACE_DATA].resources
    if not isinstance(resources, ResourceStorageCollection):
        # YAML is authoritative for this collection; do not edit the user's files.
        return

    # The collection loads lazily. Read stored resources before checking for matches
    # so startup cannot create a duplicate or replace other cards' registrations.
    await resources.async_get_info()
    integration = await async_get_integration(hass, DOMAIN)
    url = f"{CARD_PATH}?v={integration.version}"
    matches = [item for item in resources.async_items() if _is_bundled_card(item["url"])]
    if not matches:
        await resources.async_create_item({"res_type": "module", "url": url})
        return

    first, *duplicates = matches
    if first["url"] != url or first["type"] != "module":
        await resources.async_update_item(first["id"], {"res_type": "module", "url": url})
    for duplicate in duplicates:
        await resources.async_delete_item(duplicate["id"])
