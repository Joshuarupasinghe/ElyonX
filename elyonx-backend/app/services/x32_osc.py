from __future__ import annotations

import asyncio
import logging
import math
import re
import socket
import struct
import time
from dataclasses import dataclass, field
from typing import Any, Iterable, Literal

from app.core.config import settings
from app.core.ws_manager import ws_manager

logger = logging.getLogger("elyonx.x32_osc")

OscArg = int | float | str | bytes
ConnectionState = Literal["disconnected", "connecting", "connected", "error"]
GainTarget = Literal["trim", "headamp"]


class OscCodecError(ValueError):
    """Raised when an OSC datagram cannot be encoded or decoded."""


class MixerConnectionError(RuntimeError):
    """Raised when the X32 cannot be reached or is not connected."""


class MixerCommandError(RuntimeError):
    """Raised when a mixer command is invalid or cannot be sent."""


@dataclass(slots=True)
class OscMessage:
    address: str
    args: list[OscArg] = field(default_factory=list)


@dataclass(slots=True)
class RegisteredMixerChannel:
    channel: int
    name: str | None = None
    instrument: str | None = None
    input_source: int | None = None
    registered_at: float = field(default_factory=time.time)


@dataclass(slots=True)
class MixerStatus:
    connected: bool
    state: ConnectionState
    host: str
    port: int
    mixer_name: str | None = None
    firmware: str | None = None
    model: str | None = None
    last_seen_at: float | None = None
    latency_ms: float | None = None
    error: str | None = None
    responsive: bool = False
    last_seen_age_seconds: float | None = None
    last_error_at: float | None = None
    last_sent_at: float | None = None
    last_sent_address: str | None = None
    last_datagram_from: str | None = None
    packets_sent: int = 0
    packets_received: int = 0
    transport_open: bool = False
    registered_channels: list[RegisteredMixerChannel] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return {
            "connected": self.connected,
            "state": self.state,
            "host": self.host,
            "port": self.port,
            "mixer_name": self.mixer_name,
            "firmware": self.firmware,
            "model": self.model,
            "last_seen_at": self.last_seen_at,
            "latency_ms": self.latency_ms,
            "error": self.error,
            "responsive": self.responsive,
            "last_seen_age_seconds": self.last_seen_age_seconds,
            "last_error_at": self.last_error_at,
            "last_sent_at": self.last_sent_at,
            "last_sent_address": self.last_sent_address,
            "last_datagram_from": self.last_datagram_from,
            "packets_sent": self.packets_sent,
            "packets_received": self.packets_received,
            "transport_open": self.transport_open,
            "registered_channels": [
                {
                    "channel": channel.channel,
                    "name": channel.name,
                    "instrument": channel.instrument,
                    "input_source": channel.input_source,
                    "registered_at": channel.registered_at,
                }
                for channel in self.registered_channels
            ],
        }


def _pad4(payload: bytes) -> bytes:
    padding = (4 - (len(payload) % 4)) % 4
    return payload + (b"\0" * padding)


def _encode_osc_string(value: str) -> bytes:
    return _pad4(value.encode("utf-8") + b"\0")


def _decode_osc_string(packet: bytes, offset: int) -> tuple[str, int]:
    end = packet.find(b"\0", offset)
    if end < 0:
        raise OscCodecError("OSC string is missing null terminator.")
    value = packet[offset:end].decode("utf-8", errors="replace")
    next_offset = end + 1
    while next_offset % 4 != 0:
        next_offset += 1
    if next_offset > len(packet):
        raise OscCodecError("OSC string padding exceeds packet length.")
    return value, next_offset


def encode_osc_message(address: str, args: Iterable[OscArg] | None = None) -> bytes:
    if not address.startswith("/"):
        raise OscCodecError("OSC address must start with '/'.")

    encoded_args = b""
    type_tags = ","
    for arg in args or []:
        if isinstance(arg, bool):
            type_tags += "i"
            encoded_args += struct.pack(">i", 1 if arg else 0)
        elif isinstance(arg, int):
            type_tags += "i"
            encoded_args += struct.pack(">i", arg)
        elif isinstance(arg, float):
            type_tags += "f"
            encoded_args += struct.pack(">f", arg)
        elif isinstance(arg, str):
            type_tags += "s"
            encoded_args += _encode_osc_string(arg)
        elif isinstance(arg, bytes):
            type_tags += "b"
            encoded_args += struct.pack(">i", len(arg)) + _pad4(arg)
        else:
            raise OscCodecError(f"Unsupported OSC argument type: {type(arg)!r}")

    return _encode_osc_string(address) + _encode_osc_string(type_tags) + encoded_args


def decode_osc_message(packet: bytes) -> OscMessage:
    address, offset = _decode_osc_string(packet, 0)
    type_tags, offset = _decode_osc_string(packet, offset)
    if not type_tags.startswith(","):
        raise OscCodecError("OSC type tag string must start with ','.")

    args: list[OscArg] = []
    for tag in type_tags[1:]:
        if tag == "i":
            if offset + 4 > len(packet):
                raise OscCodecError("OSC int argument exceeds packet length.")
            args.append(struct.unpack(">i", packet[offset : offset + 4])[0])
            offset += 4
        elif tag == "f":
            if offset + 4 > len(packet):
                raise OscCodecError("OSC float argument exceeds packet length.")
            args.append(struct.unpack(">f", packet[offset : offset + 4])[0])
            offset += 4
        elif tag == "s":
            value, offset = _decode_osc_string(packet, offset)
            args.append(value)
        elif tag == "b":
            if offset + 4 > len(packet):
                raise OscCodecError("OSC blob length exceeds packet length.")
            length = struct.unpack(">i", packet[offset : offset + 4])[0]
            offset += 4
            if length < 0 or offset + length > len(packet):
                raise OscCodecError("OSC blob argument exceeds packet length.")
            args.append(packet[offset : offset + length])
            offset += length
            while offset % 4 != 0:
                offset += 1
        else:
            raise OscCodecError(f"Unsupported OSC type tag: {tag!r}")

    return OscMessage(address=address, args=args)


def clamp(value: float, minimum: float, maximum: float) -> float:
    return max(minimum, min(maximum, value))


def pad_channel(channel: int) -> str:
    validate_channel(channel)
    return f"{channel:02d}"


def validate_channel(channel: int) -> None:
    if channel < 1 or channel > 32:
        raise MixerCommandError("X32 input channel must be between 1 and 32.")


def validate_eq_band(band: int) -> None:
    if band < 1 or band > 4:
        raise MixerCommandError("X32 channel EQ band must be between 1 and 4.")


FADER_TABLE: tuple[tuple[float, float], ...] = (
    (-90.0, 0.0),
    (-60.0, 0.0625),
    (-50.0, 0.125),
    (-40.0, 0.1875),
    (-30.0, 0.25),
    (-20.0, 0.375),
    (-10.0, 0.5),
    (-5.0, 0.625),
    (0.0, 0.75),
    (5.0, 0.875),
    (10.0, 1.0),
)

X32_EQ_TYPE: dict[str, int] = {
    "highpass": 0,  # LCut
    "lowshelf": 1,  # LShv
    "bell": 2,  # PEQ
    "highshelf": 4,  # HShv
    "lowpass": 5,  # HCut
}
X32_EQ_TYPE_BY_VALUE: dict[int, str] = {value: key for key, value in X32_EQ_TYPE.items()}

CHANNEL_FADER_RE = re.compile(r"^/ch/(\d{2})/mix/fader$")
CHANNEL_MUTE_RE = re.compile(r"^/ch/(\d{2})/mix/on$")
CHANNEL_NAME_RE = re.compile(r"^/ch/(\d{2})/config/name$")
CHANNEL_EQ_ENABLED_RE = re.compile(r"^/ch/(\d{2})/eq/on$")
CHANNEL_EQ_PARAM_RE = re.compile(r"^/ch/(\d{2})/eq/([1-4])/(type|f|g|q)$")
CHANNEL_EQ_BAND_RE = re.compile(r"^/ch/(\d{2})/eq/([1-4])$")
CHANNEL_SOLO_RE = re.compile(r"^/-stat/solosw/(\d{2})$")


def db_to_x32_fader(db: float) -> float:
    if db <= FADER_TABLE[0][0]:
        return FADER_TABLE[0][1]
    if db >= FADER_TABLE[-1][0]:
        return FADER_TABLE[-1][1]

    for index in range(1, len(FADER_TABLE)):
        prev_db, prev_value = FADER_TABLE[index - 1]
        next_db, next_value = FADER_TABLE[index]
        if db <= next_db:
            ratio = (db - prev_db) / (next_db - prev_db)
            return prev_value + ratio * (next_value - prev_value)

    return 1.0


def x32_fader_to_db(value: float) -> float:
    value = clamp(value, 0.0, 1.0)
    table = tuple((osc, db) for db, osc in FADER_TABLE)
    if value <= table[0][0]:
        return table[0][1]
    if value >= table[-1][0]:
        return table[-1][1]

    for index in range(1, len(table)):
        prev_value, prev_db = table[index - 1]
        next_value, next_db = table[index]
        if value <= next_value:
            ratio = (value - prev_value) / (next_value - prev_value)
            return prev_db + ratio * (next_db - prev_db)

    return 10.0


def frequency_to_x32(freq_hz: float) -> float:
    freq_hz = clamp(freq_hz, 20.0, 20000.0)
    return (math.log10(freq_hz) - math.log10(20.0)) / (
        math.log10(20000.0) - math.log10(20.0)
    )


def x32_to_frequency(value: float) -> float:
    value = clamp(value, 0.0, 1.0)
    return 10 ** (
        math.log10(20.0)
        + value * (math.log10(20000.0) - math.log10(20.0))
    )


def eq_gain_to_x32(gain_db: float) -> float:
    return (clamp(gain_db, -15.0, 15.0) + 15.0) / 30.0


def x32_to_eq_gain(value: float) -> float:
    return (clamp(value, 0.0, 1.0) * 30.0) - 15.0


def q_to_x32(q_value: float) -> float:
    # X32 stores channel EQ Q as a reversed logarithmic normalized value.
    q_value = clamp(q_value, 0.3, 10.0)
    return (math.log(q_value) - math.log(10.0)) / (math.log(0.3) - math.log(10.0))


def x32_to_q(value: float) -> float:
    value = clamp(value, 0.0, 1.0)
    return math.exp(math.log(10.0) + value * (math.log(0.3) - math.log(10.0)))


def trim_db_to_x32(trim_db: float) -> float:
    return (clamp(trim_db, -18.0, 18.0) + 18.0) / 36.0


def headamp_gain_db_to_x32(gain_db: float) -> float:
    return clamp(gain_db, 0.0, 60.0) / 60.0


def _arg_as_float(message: OscMessage, index: int = 0) -> float | None:
    if len(message.args) <= index:
        return None
    value = message.args[index]
    if isinstance(value, int | float):
        return float(value)
    return None


def _arg_as_int(message: OscMessage, index: int = 0) -> int | None:
    if len(message.args) <= index:
        return None
    value = message.args[index]
    if isinstance(value, int):
        return value
    if isinstance(value, float):
        return int(value)
    return None


def _arg_as_string(message: OscMessage, index: int = 0) -> str | None:
    if len(message.args) <= index:
        return None
    value = message.args[index]
    return value if isinstance(value, str) else None


class _X32DatagramProtocol(asyncio.DatagramProtocol):
    def __init__(self, service: X32OscService) -> None:
        self.service = service

    def connection_made(self, transport: asyncio.BaseTransport) -> None:
        self.service._transport = transport  # noqa: SLF001

    def datagram_received(self, data: bytes, addr: tuple[str, int]) -> None:
        self.service._handle_datagram(data, addr)  # noqa: SLF001

    def error_received(self, exc: Exception) -> None:
        self.service._mark_error(f"OSC transport error: {exc}")  # noqa: SLF001

    def connection_lost(self, exc: Exception | None) -> None:
        if exc:
            self.service._mark_error(f"OSC transport closed: {exc}")  # noqa: SLF001


class X32OscService:
    """Backend-owned OSC controller for Behringer X32/Midas M32 mixers."""

    def __init__(
        self,
        host: str | None = None,
        port: int | None = None,
        *,
        connect_timeout_seconds: float | None = None,
        heartbeat_interval_seconds: float | None = None,
    ) -> None:
        self.host = host or settings.OSC_TARGET_IP
        self.port = int(port or settings.OSC_TARGET_PORT)
        self.connect_timeout_seconds = (
            connect_timeout_seconds
            if connect_timeout_seconds is not None
            else settings.OSC_CONNECT_TIMEOUT_SECONDS
        )
        self.heartbeat_interval_seconds = (
            heartbeat_interval_seconds
            if heartbeat_interval_seconds is not None
            else settings.OSC_HEARTBEAT_INTERVAL_SECONDS
        )
        self.stale_timeout_seconds = settings.OSC_STALE_TIMEOUT_SECONDS
        self._transport: asyncio.BaseTransport | None = None
        self._heartbeat_task: asyncio.Task[None] | None = None
        self._state: ConnectionState = "disconnected"
        self._last_seen_at: float | None = None
        self._last_probe_at: float | None = None
        self._latency_ms: float | None = None
        self._error: str | None = None
        self._last_error_at: float | None = None
        self._last_sent_at: float | None = None
        self._last_sent_address: str | None = None
        self._last_datagram_from: str | None = None
        self._packets_sent = 0
        self._packets_received = 0
        self._mixer_name: str | None = None
        self._firmware: str | None = None
        self._model: str | None = None
        self._pending_probe: asyncio.Future[OscMessage] | None = None
        self._channels: dict[int, RegisteredMixerChannel] = {}
        self._lock = asyncio.Lock()

    @property
    def connected(self) -> bool:
        return self._transport is not None and self._last_seen_at is not None

    def _has_recent_mixer_reply(self) -> bool:
        if self._last_seen_at is None:
            return False
        return (time.time() - self._last_seen_at) <= self.stale_timeout_seconds

    def status(self) -> MixerStatus:
        now = time.time()
        connected = self.connected
        responsive = self._has_recent_mixer_reply()
        state: ConnectionState = "connected" if connected else self._state
        if self._state == "connected" and not connected:
            state = "error"
        last_seen_age_seconds = (
            None if self._last_seen_at is None else max(0.0, now - self._last_seen_at)
        )
        return MixerStatus(
            connected=connected,
            state=state,
            host=self.host,
            port=self.port,
            mixer_name=self._mixer_name,
            firmware=self._firmware,
            model=self._model,
            last_seen_at=self._last_seen_at,
            latency_ms=self._latency_ms,
            error=None if connected else self._error,
            responsive=responsive,
            last_seen_age_seconds=last_seen_age_seconds,
            last_error_at=self._last_error_at,
            last_sent_at=self._last_sent_at,
            last_sent_address=self._last_sent_address,
            last_datagram_from=self._last_datagram_from,
            packets_sent=self._packets_sent,
            packets_received=self._packets_received,
            transport_open=self._transport is not None,
            registered_channels=sorted(self._channels.values(), key=lambda item: item.channel),
        )

    def configure(self, host: str, port: int) -> None:
        host_changed = host != self.host or int(port) != self.port
        self.host = host
        self.port = int(port)
        if host_changed:
            self._state = "disconnected"
            self._last_seen_at = None
            self._latency_ms = None
            self._error = None
            self._mixer_name = None
            self._firmware = None
            self._model = None

    async def connect(self, host: str | None = None, port: int | None = None) -> MixerStatus:
        if host is not None or port is not None:
            self.configure(host or self.host, int(port or self.port))

        async with self._lock:
            await self._close_transport()
            self._state = "connecting"
            self._error = None

            loop = asyncio.get_running_loop()
            try:
                transport, _ = await loop.create_datagram_endpoint(
                    lambda: _X32DatagramProtocol(self),
                    local_addr=("0.0.0.0", 0),
                    family=socket.AF_INET,
                )
            except OSError as exc:
                self._mark_error(f"Could not open UDP socket: {exc}")
                raise MixerConnectionError(self._error or "Could not open UDP socket.") from exc

            self._transport = transport

            try:
                await self._probe(timeout=self.connect_timeout_seconds)
            except MixerConnectionError:
                await self._close_transport()
                raise

            self._state = "connected"
            self._send_payload(encode_osc_message("/xremote"), "/xremote")
            self._heartbeat_task = asyncio.create_task(self._heartbeat_loop())
            await self._broadcast_status()
            return self.status()

    async def disconnect(self) -> MixerStatus:
        async with self._lock:
            await self._close_transport()
            self._state = "disconnected"
            self._last_seen_at = None
            self._latency_ms = None
            self._error = None
        await self._broadcast_status()
        return self.status()

    async def register_channel(
        self,
        channel: int,
        *,
        name: str | None = None,
        instrument: str | None = None,
        input_source: int | None = None,
    ) -> MixerStatus:
        validate_channel(channel)
        if input_source is not None:
            validate_channel(input_source)

        clean_name = name.strip()[:12] if name else None
        self._channels[channel] = RegisteredMixerChannel(
            channel=channel,
            name=clean_name,
            instrument=instrument,
            input_source=input_source or channel,
        )

        if self.connected:
            if clean_name:
                await self.send(f"/ch/{pad_channel(channel)}/config/name", [clean_name])

            await self.send(f"/ch/{pad_channel(channel)}/mix/fader")
            await self.send(f"/ch/{pad_channel(channel)}/mix/on")
            await self.send(f"/-stat/solosw/{pad_channel(channel)}")
            await self.send(f"/ch/{pad_channel(channel)}/preamp/trim")
            await self.send(f"/ch/{pad_channel(channel)}/eq/on")
            for band in range(1, 5):
                await self.send(f"/ch/{pad_channel(channel)}/eq/{band}")
        else:
            logger.info(
                "Registered channel %s locally; X32 is not connected.",
                channel,
            )

        await self._broadcast_status()
        return self.status()

    async def set_channel_fader(self, channel: int, db: float) -> None:
        validate_channel(channel)
        await self.send(f"/ch/{pad_channel(channel)}/mix/fader", [db_to_x32_fader(db)])

    async def set_master_fader(self, db: float) -> None:
        await self.send("/main/st/mix/fader", [db_to_x32_fader(db)])

    async def set_channel_gain(
        self,
        channel: int,
        db: float,
        *,
        target: GainTarget = "trim",
    ) -> None:
        validate_channel(channel)
        if target == "headamp":
            await self.send(f"/headamp/{pad_channel(channel)}/gain", [headamp_gain_db_to_x32(db)])
            return

        await self.send(f"/ch/{pad_channel(channel)}/preamp/trim", [trim_db_to_x32(db)])

    async def set_channel_mute(self, channel: int, muted: bool) -> None:
        validate_channel(channel)
        await self.send(f"/ch/{pad_channel(channel)}/mix/on", [0 if muted else 1])

    async def set_channel_solo(self, channel: int, solo: bool) -> None:
        validate_channel(channel)
        await self.send(f"/-stat/solosw/{pad_channel(channel)}", [1 if solo else 0])

    async def set_channel_eq_band(
        self,
        channel: int,
        band: int,
        *,
        eq_type: str | None = None,
        frequency: float | None = None,
        gain: float | None = None,
        q: float | None = None,
        enabled: bool | None = None,
    ) -> None:
        validate_channel(channel)
        validate_eq_band(band)
        prefix = f"/ch/{pad_channel(channel)}/eq/{band}"

        if enabled is not None and not enabled:
            await self.send(f"{prefix}/g", [eq_gain_to_x32(0.0)])
            return

        if eq_type is not None:
            normalized_type = eq_type.strip().lower()
            if normalized_type not in X32_EQ_TYPE:
                raise MixerCommandError(f"Unsupported X32 EQ band type: {eq_type}")
            await self.send(f"{prefix}/type", [X32_EQ_TYPE[normalized_type]])

        if frequency is not None:
            await self.send(f"{prefix}/f", [frequency_to_x32(frequency)])

        if gain is not None:
            await self.send(f"{prefix}/g", [eq_gain_to_x32(gain)])

        if q is not None:
            await self.send(f"{prefix}/q", [q_to_x32(q)])

        await self.send(f"/ch/{pad_channel(channel)}/eq/on", [1])

    async def send(self, address: str, args: Iterable[OscArg] | None = None) -> None:
        await self.ensure_connected()
        if self._transport is None:
            raise MixerConnectionError("Mixer transport is not open.")

        payload = encode_osc_message(address, args)
        self._send_payload(payload, address)
        logger.debug("OSC -> %s %s", address, list(args or []))

    async def ensure_connected(self) -> None:
        if self.connected:
            return
        await self.connect(self.host, self.port)

    async def _probe(self, timeout: float) -> OscMessage:
        loop = asyncio.get_running_loop()
        self._pending_probe = loop.create_future()
        self._last_probe_at = time.time()
        payload = encode_osc_message("/xinfo")
        if self._transport is None:
            raise MixerConnectionError("Mixer transport is not open.")
        self._send_payload(payload, "/xinfo")

        try:
            message = await asyncio.wait_for(self._pending_probe, timeout=timeout)
        except TimeoutError as exc:
            self._mark_error(
                f"No X32 response from {self.host}:{self.port} within {timeout:.1f}s."
            )
            raise MixerConnectionError(self._error or "No X32 response.") from exc
        finally:
            self._pending_probe = None

        return message

    async def _heartbeat_loop(self) -> None:
        try:
            while True:
                if self._transport is not None:
                    self._send_payload(encode_osc_message("/xremote"), "/xremote")
                    self._last_probe_at = time.time()
                    self._send_payload(encode_osc_message("/xinfo"), "/xinfo")
                await asyncio.sleep(self.heartbeat_interval_seconds)
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            self._mark_error(f"OSC heartbeat failed: {exc}")

    async def _close_transport(self) -> None:
        if self._heartbeat_task is not None:
            self._heartbeat_task.cancel()
            try:
                await self._heartbeat_task
            except asyncio.CancelledError:
                pass
            self._heartbeat_task = None

        if self._pending_probe is not None and not self._pending_probe.done():
            self._pending_probe.cancel()
            self._pending_probe = None

        if self._transport is not None:
            self._transport.close()
            self._transport = None

    def _send_payload(self, payload: bytes, address: str) -> None:
        if self._transport is None:
            raise MixerConnectionError("Mixer transport is not open.")
        self._transport.sendto(payload, (self.host, self.port))  # type: ignore[attr-defined]
        self._last_sent_at = time.time()
        self._last_sent_address = address
        self._packets_sent += 1

    def _mixer_event_from_message(self, message: OscMessage) -> dict[str, Any] | None:
        payload: dict[str, Any] = {
            "event": "mixer_event",
            "address": message.address,
            "timestamp_ms": int(time.time() * 1000),
        }

        if message.address == "/main/st/mix/fader":
            value = _arg_as_float(message)
            if value is None:
                return None
            return {**payload, "type": "fader", "channel": 0, "value": x32_fader_to_db(value)}

        if match := CHANNEL_FADER_RE.match(message.address):
            value = _arg_as_float(message)
            if value is None:
                return None
            return {
                **payload,
                "type": "fader",
                "channel": int(match.group(1)),
                "value": x32_fader_to_db(value),
            }

        if match := CHANNEL_MUTE_RE.match(message.address):
            value = _arg_as_int(message)
            if value is None:
                return None
            return {
                **payload,
                "type": "mute",
                "channel": int(match.group(1)),
                "value": value == 0,
            }

        if match := CHANNEL_SOLO_RE.match(message.address):
            value = _arg_as_int(message)
            if value is None:
                return None
            return {
                **payload,
                "type": "solo",
                "channel": int(match.group(1)),
                "value": value == 1,
            }

        if match := CHANNEL_NAME_RE.match(message.address):
            value = _arg_as_string(message)
            if value is None:
                return None
            return {
                **payload,
                "type": "channel_name",
                "channel": int(match.group(1)),
                "value": value,
            }

        if match := CHANNEL_EQ_ENABLED_RE.match(message.address):
            value = _arg_as_int(message)
            if value is None:
                return None
            return {
                **payload,
                "type": "eq_enabled",
                "channel": int(match.group(1)),
                "value": value == 1,
            }

        if match := CHANNEL_EQ_PARAM_RE.match(message.address):
            channel = int(match.group(1))
            band = int(match.group(2))
            param = match.group(3)
            value = _arg_as_float(message)
            if value is None:
                return None

            if param == "type":
                type_value = _arg_as_int(message)
                if type_value is None:
                    return None
                return {
                    **payload,
                    "type": "eq_type",
                    "channel": channel,
                    "band": band,
                    "value": X32_EQ_TYPE_BY_VALUE.get(type_value, "bell"),
                }
            if param == "f":
                return {
                    **payload,
                    "type": "eq_freq",
                    "channel": channel,
                    "band": band,
                    "value": x32_to_frequency(value),
                }
            if param == "g":
                return {
                    **payload,
                    "type": "eq_gain",
                    "channel": channel,
                    "band": band,
                    "value": x32_to_eq_gain(value),
                }
            return {
                **payload,
                "type": "eq_q",
                "channel": channel,
                "band": band,
                "value": x32_to_q(value),
            }

        if match := CHANNEL_EQ_BAND_RE.match(message.address):
            eq_type = _arg_as_int(message, 0)
            frequency = _arg_as_float(message, 1)
            gain = _arg_as_float(message, 2)
            q = _arg_as_float(message, 3)
            if eq_type is None or frequency is None or gain is None or q is None:
                return None
            return {
                **payload,
                "type": "eq_band",
                "channel": int(match.group(1)),
                "band": int(match.group(2)),
                "value": {
                    "type": X32_EQ_TYPE_BY_VALUE.get(eq_type, "bell"),
                    "frequency": x32_to_frequency(frequency),
                    "gain": x32_to_eq_gain(gain),
                    "q": x32_to_q(q),
                },
            }

        return None

    def _handle_datagram(self, data: bytes, addr: tuple[str, int]) -> None:
        try:
            message = decode_osc_message(data)
        except OscCodecError as exc:
            logger.debug("Ignored malformed OSC datagram from %s: %s", addr, exc)
            return

        self._packets_received += 1
        self._last_datagram_from = f"{addr[0]}:{addr[1]}"
        self._last_seen_at = time.time()
        if self._last_probe_at is not None:
            self._latency_ms = (self._last_seen_at - self._last_probe_at) * 1000.0
        self._state = "connected"
        self._error = None

        if message.address in {"/xinfo", "/info"}:
            self._parse_info_message(message)

        mixer_event = self._mixer_event_from_message(message)

        if (
            message.address in {"/xinfo", "/info"}
            and self._pending_probe is not None
            and not self._pending_probe.done()
        ):
            self._pending_probe.set_result(message)

        try:
            if mixer_event is not None:
                asyncio.create_task(ws_manager.broadcast(mixer_event))
            asyncio.create_task(self._broadcast_status())
        except RuntimeError:
            pass

    def _parse_info_message(self, message: OscMessage) -> None:
        values = [str(arg) for arg in message.args if isinstance(arg, str)]
        if not values:
            return

        if message.address == "/xinfo":
            if len(values) >= 4:
                self._mixer_name = values[1]
                self._model = values[2]
                self._firmware = values[3]
                return
            self._firmware = values[0] if len(values) >= 1 else self._firmware
            self._mixer_name = values[1] if len(values) >= 2 else self._mixer_name
            self._model = values[2] if len(values) >= 3 else self._model
            return

        self._firmware = values[0] if len(values) >= 1 else self._firmware
        self._mixer_name = values[1] if len(values) >= 2 else self._mixer_name
        self._model = values[2] if len(values) >= 3 else self._model

    def _mark_error(self, error: str) -> None:
        self._state = "error"
        self._error = error
        self._last_error_at = time.time()
        logger.warning(error)

    async def _broadcast_status(self) -> None:
        await ws_manager.broadcast({"event": "mixer_status", **self.status().to_dict()})
