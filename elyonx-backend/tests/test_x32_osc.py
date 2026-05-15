from __future__ import annotations

import math
import time

import pytest

from app.services.x32_osc import (
    X32_EQ_TYPE,
    X32OscService,
    db_to_x32_fader,
    decode_osc_message,
    encode_osc_message,
    eq_gain_to_x32,
    frequency_to_x32,
    q_to_x32,
    trim_db_to_x32,
)


class FakeTransport:
    def __init__(self) -> None:
        self.packets: list[bytes] = []
        self.closed = False

    def sendto(self, payload: bytes) -> None:
        self.packets.append(payload)

    def close(self) -> None:
        self.closed = True


def test_osc_codec_round_trips_x32_style_message() -> None:
    payload = encode_osc_message("/ch/01/eq/1", [2, 0.265, 0.5, 0.4648])

    message = decode_osc_message(payload)

    assert message.address == "/ch/01/eq/1"
    assert message.args[0] == 2
    assert message.args[1] == pytest.approx(0.265, abs=1e-6)
    assert message.args[2] == pytest.approx(0.5, abs=1e-6)
    assert message.args[3] == pytest.approx(0.4648, abs=1e-6)


def test_x32_normalized_value_conversions_match_protocol_ranges() -> None:
    assert db_to_x32_fader(0.0) == pytest.approx(0.75)
    assert db_to_x32_fader(-10.0) == pytest.approx(0.5)
    assert eq_gain_to_x32(0.0) == pytest.approx(0.5)
    assert trim_db_to_x32(0.0) == pytest.approx(0.5)
    assert frequency_to_x32(20.0) == pytest.approx(0.0)
    assert frequency_to_x32(20000.0) == pytest.approx(1.0)
    assert frequency_to_x32(math.sqrt(20.0 * 20000.0)) == pytest.approx(0.5)
    assert q_to_x32(10.0) == pytest.approx(0.0)
    assert q_to_x32(0.3) == pytest.approx(1.0)


@pytest.mark.asyncio
async def test_x32_service_registers_channel_without_connected_mixer() -> None:
    service = X32OscService(host="192.168.1.50", port=10023)

    status = await service.register_channel(
        7,
        name="Snare",
        instrument="snare",
        input_source=7,
    )

    assert status.connected is False
    assert status.state == "disconnected"
    assert service._transport is None
    assert status.registered_channels[0].channel == 7
    assert status.registered_channels[0].name == "Snare"
    assert status.registered_channels[0].instrument == "snare"
    assert status.registered_channels[0].input_source == 7


@pytest.mark.asyncio
async def test_x32_service_sends_expected_channel_commands() -> None:
    service = X32OscService(host="192.168.1.50", port=10023)
    transport = FakeTransport()
    service._transport = transport
    service._state = "connected"
    service._last_seen_at = time.time()

    await service.set_channel_fader(5, -10.0)
    await service.set_channel_gain(5, 6.0, target="trim")
    await service.set_channel_eq_band(
        5,
        2,
        eq_type="bell",
        frequency=1000.0,
        gain=-3.0,
        q=1.2,
    )

    messages = [decode_osc_message(packet) for packet in transport.packets]

    assert messages[0].address == "/ch/05/mix/fader"
    assert messages[0].args == [pytest.approx(0.5)]
    assert messages[1].address == "/ch/05/preamp/trim"
    assert messages[1].args == [pytest.approx(24 / 36)]
    assert messages[2].address == "/ch/05/eq/2/type"
    assert messages[2].args == [X32_EQ_TYPE["bell"]]
    assert messages[3].address == "/ch/05/eq/2/f"
    assert messages[4].address == "/ch/05/eq/2/g"
    assert messages[4].args == [pytest.approx(0.4)]
    assert messages[5].address == "/ch/05/eq/2/q"
    assert messages[6].address == "/ch/05/eq/on"
    assert messages[6].args == [1]
