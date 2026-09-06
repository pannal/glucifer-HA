# SPDX-License-Identifier: GPL-3.0-or-later
"""Exercise card registration against HA's real resource collections."""

from copy import deepcopy
from types import SimpleNamespace
from unittest.mock import patch

from homeassistant.components.lovelace.const import LOVELACE_DATA
from homeassistant.setup import async_setup_component

from custom_components.glucifer.dashboard import CARD_PATH, async_register_card


async def test_register_loads_saved_resources_and_preserves_existing_cards(hass, hass_storage):
    original = [
        {"id": "other", "url": "/hacsfiles/other/card.js", "type": "module"},
        {"id": "glucifer", "url": f"{CARD_PATH}?v=0.2.2", "type": "module"},
    ]
    hass_storage["lovelace_resources"] = {
        "version": 1,
        "key": "lovelace_resources",
        "data": {"items": deepcopy(original)},
    }
    assert await async_setup_component(hass, "lovelace", {})
    resources = hass.data[LOVELACE_DATA].resources
    assert not resources.loaded
    with patch(
        "custom_components.glucifer.dashboard.async_get_integration",
        return_value=SimpleNamespace(version="0.3.1"),
    ):
        await async_register_card(hass)
    items = resources.async_items()
    assert len(items) == 2
    assert next(item for item in items if item["id"] == "other") == original[0]
    assert next(item for item in items if item["id"] == "glucifer") == {
        "id": "glucifer",
        "url": f"{CARD_PATH}?v=0.3.1",
        "type": "module",
    }


async def test_register_adopts_manual_entry_and_only_removes_own_duplicates(hass):
    assert await async_setup_component(hass, "lovelace", {})
    resources = hass.data[LOVELACE_DATA].resources
    first = await resources.async_create_item({"url": CARD_PATH, "res_type": "js"})
    await resources.async_create_item({"url": f"{CARD_PATH}?v=old", "res_type": "module"})
    unrelated = []
    for url in [f"https://example.com{CARD_PATH}", "/other/glucifer-card.js", "/glucifer/other.js"]:
        unrelated.append(await resources.async_create_item({"url": url, "res_type": "module"}))
    await async_register_card(hass)
    items = resources.async_items()
    assert len(items) == 4
    kept = next(item for item in items if item["id"] == first["id"])
    assert kept["type"] == "module"
    assert kept["url"].startswith(f"{CARD_PATH}?v=")
    assert all(item in items for item in unrelated)


async def test_register_is_idempotent_and_changes_version_in_place(hass):
    assert await async_setup_component(hass, "lovelace", {})
    resources = hass.data[LOVELACE_DATA].resources
    with patch(
        "custom_components.glucifer.dashboard.async_get_integration",
        return_value=SimpleNamespace(version="0.3.1"),
    ):
        await async_register_card(hass)
        before = deepcopy(resources.async_items())
        with (
            patch.object(resources, "async_create_item") as create,
            patch.object(resources, "async_update_item") as update,
        ):
            await async_register_card(hass)
        create.assert_not_called()
        update.assert_not_called()
    with patch(
        "custom_components.glucifer.dashboard.async_get_integration",
        return_value=SimpleNamespace(version="0.3.2"),
    ):
        await async_register_card(hass)
    assert resources.async_items() == [{**before[0], "url": f"{CARD_PATH}?v=0.3.2"}]


async def test_yaml_resources_remain_authoritative(hass):
    original = [{"url": CARD_PATH, "type": "module"}]
    assert await async_setup_component(
        hass, "lovelace", {"lovelace": {"resource_mode": "yaml", "resources": deepcopy(original)}}
    )
    await async_register_card(hass)
    assert hass.data[LOVELACE_DATA].resources.async_items() == original
