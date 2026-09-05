# SPDX-License-Identifier: GPL-3.0-or-later
"""Exercise the custom integration in Home Assistant's real test harness."""

from copy import deepcopy

import pytest
from homeassistant.util import dt as dt_util


@pytest.fixture(autouse=True)
def enable_integration(enable_custom_integrations):
    yield


@pytest.fixture
def snapshot():
    now = int(dt_util.utcnow().timestamp() * 1000)
    data = {
        "schema_version": 1,
        "source_id": "phone-test",
        "sequence": 1,
        "sent_at_ms": now,
        "glucose": {"mgdl": 123, "time_ms": now},
        "fields": {"trend": "Flat", "iob_u": 0.0},
        "alerts": {"low": False, "high": True},
    }
    return deepcopy(data)
