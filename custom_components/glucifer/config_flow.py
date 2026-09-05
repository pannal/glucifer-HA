# SPDX-License-Identifier: GPL-3.0-or-later
"""Create a private receiver endpoint for each sender."""

import voluptuous as vol
from homeassistant import config_entries
from homeassistant.components import webhook
from homeassistant.core import callback
from homeassistant.helpers.network import NoURLAvailableError

from .const import DEFAULT_STALE_SECONDS, DOMAIN


def endpoint(hass, webhook_id):
    try:
        return webhook.async_generate_url(hass, webhook_id)
    except NoURLAvailableError:
        return webhook.async_generate_path(webhook_id)


def schema(options=None):
    options = options or {}
    return vol.Schema(
        {
            vol.Required("local_only", default=options.get("local_only", True)): bool,
            vol.Required(
                "stale_seconds", default=options.get("stale_seconds", DEFAULT_STALE_SECONDS)
            ): vol.All(vol.Coerce(int), vol.Range(min=60, max=3600)),
        }
    )


class JugglucoFlow(config_entries.ConfigFlow, domain=DOMAIN):
    VERSION = 1

    async def async_step_user(self, user_input=None):
        if user_input is not None:
            self._name = user_input["name"].strip()
            if not self._name:
                return self.async_show_form(
                    step_id="user",
                    data_schema=vol.Schema(
                        {
                            vol.Required("name"): str,
                        }
                    ),
                    errors={"name": "name_required"},
                )
            self._webhook_id = webhook.async_generate_id()
            return await self.async_step_receiver()
        return self.async_show_form(
            step_id="user",
            data_schema=vol.Schema(
                {
                    vol.Required("name", default="JugglucoNG"): str,
                }
            ),
        )

    async def async_step_receiver(self, user_input=None):
        if user_input is not None:
            return self.async_create_entry(
                title=self._name,
                data={"webhook_id": self._webhook_id},
                options=user_input,
            )
        return self.async_show_form(
            step_id="receiver",
            data_schema=schema(),
            description_placeholders={"url": endpoint(self.hass, self._webhook_id)},
        )

    @staticmethod
    @callback
    def async_get_options_flow(config_entry):
        return JugglucoOptions()


class JugglucoOptions(config_entries.OptionsFlow):
    async def async_step_init(self, user_input=None):
        if user_input is not None:
            return self.async_create_entry(title="", data=user_input)
        return self.async_show_form(
            step_id="init",
            data_schema=schema(self.config_entry.options),
            description_placeholders={
                "url": endpoint(self.hass, self.config_entry.data["webhook_id"]),
            },
        )
