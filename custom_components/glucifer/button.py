# SPDX-License-Identifier: GPL-3.0-or-later
"""Explicit controls for an isolated HA automation test."""

from homeassistant.components.button import ButtonEntity
from homeassistant.const import EntityCategory

from .entity import JugglucoEntity


async def async_setup_entry(hass, entry, async_add_entities):
    async_add_entities(
        [
            JugglucoTestButton(entry.runtime_data, phase, name)
            for phase, name in [
                ("fired", "Start test alert"),
                ("acknowledged", "Acknowledge test alert"),
                ("connection_lost", "Test connection loss"),
            ]
        ]
    )


class JugglucoTestButton(JugglucoEntity, ButtonEntity):
    _attr_entity_category = EntityCategory.DIAGNOSTIC
    _attr_icon = "mdi:test-tube"

    def __init__(self, coordinator, phase, name):
        super().__init__(coordinator, f"test_{phase}", name)
        self.phase = phase
        self._attr_translation_key = self.key
        del self._attr_name

    @property
    def available(self):
        return True

    async def async_press(self):
        self.coordinator.set_test(self.phase)
