from __future__ import annotations

import argparse
import socket
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.services.x32_osc import decode_osc_message, encode_osc_message  # noqa: E402


def main() -> int:
    parser = argparse.ArgumentParser(description="Send a direct OSC /xinfo probe to an X32/M32.")
    parser.add_argument("host", help="Mixer IP address")
    parser.add_argument("--port", type=int, default=10023, help="Mixer OSC UDP port")
    parser.add_argument("--timeout", type=float, default=5.0, help="Response timeout in seconds")
    args = parser.parse_args()

    started = time.time()
    with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as sock:
        sock.bind(("0.0.0.0", 0))
        sock.settimeout(args.timeout)
        local_host, local_port = sock.getsockname()
        print(f"Sending /xinfo to {args.host}:{args.port} from {local_host}:{local_port}")
        sock.sendto(encode_osc_message("/xinfo"), (args.host, args.port))

        try:
            data, remote = sock.recvfrom(4096)
        except TimeoutError:
            print(f"No OSC response within {args.timeout:.1f}s.")
            return 1

    elapsed_ms = (time.time() - started) * 1000.0
    message = decode_osc_message(data)
    print(f"Received {len(data)} bytes from {remote[0]}:{remote[1]} in {elapsed_ms:.1f}ms")
    print(f"Address: {message.address}")
    print(f"Args: {message.args}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
