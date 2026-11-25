#!/usr/bin/python3
"""Local-only, paired remote control for the Streamline kiosk."""

from __future__ import annotations

import base64
import hashlib
import hmac
import ipaddress
import json
import math
import os
import secrets
import socket
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlsplit


REMOTE_PORT = 8766
PAIRING_LIFETIME_SECONDS = 300
PAIR_ATTEMPT_WINDOW_SECONDS = 60
MAX_PAIR_ATTEMPTS = 8
MAX_REMOTE_BODY_BYTES = 2048
MAX_POINTER_EVENTS_PER_SECOND = 100
MAX_POINTER_DELTA = 120
ALLOWED_ACTIONS = {"click", "home", "playPause", "volumeUp", "volumeDown"}
WEBSOCKET_GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11"


class RemoteControlError(Exception):
    def __init__(self, message: str, status: int = 400):
        super().__init__(message)
        self.status = status


def _is_lan_client(address: str) -> bool:
    try:
        parsed = ipaddress.ip_address(address)
    except ValueError:
        return False
    return (
        parsed.version == 4
        and parsed.is_private
        and not parsed.is_loopback
        and not parsed.is_link_local
        and not parsed.is_multicast
        and not parsed.is_unspecified
    )


def _default_ipv4_address() -> str:
    probe = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        probe.connect(("192.0.2.1", 80))
        address = probe.getsockname()[0]
    finally:
        probe.close()
    if not _is_lan_client(address):
        raise RuntimeError("No private IPv4 network address was found.")
    return address


def _safe_device_name(value: object) -> str:
    if not isinstance(value, str):
        return "iPhone"
    cleaned = " ".join(value.strip().split())
    allowed = "".join(character for character in cleaned if character.isprintable())
    return (allowed[:40] or "iPhone")


class RemoteControl:
    """Owns one-time pairing, revocable tokens, and a tiny input allowlist."""

    def __init__(
        self,
        storage_path: Path | None = None,
        input_factory=None,
        event_codes=None,
    ) -> None:
        self.storage_path = storage_path or (
            Path.home() / ".config" / "streamline" / "remote-pairings.json"
        )
        self.input_factory = input_factory
        self.event_codes = event_codes
        self._input = None
        self._pairing_lock = threading.RLock()
        self._pairings: dict[str, dict[str, object]] = {}
        self._pair_attempts: dict[str, list[float]] = {}
        self._pairing_code: str | None = None
        self._pairing_expires_at = 0.0
        self.storage_error: str | None = None
        self.server_error: str | None = None
        self.computer_name = socket.gethostname()[:48] or "Streamline PC"
        self._load_pairings()
        self._new_pairing_code()

    def _load_pairings(self) -> None:
        if not self.storage_path.exists():
            return
        try:
            data = json.loads(self.storage_path.read_text(encoding="utf-8"))
            if not isinstance(data, list):
                raise ValueError("pairing file must contain a list")
            pairings: dict[str, dict[str, object]] = {}
            for entry in data:
                if not isinstance(entry, dict):
                    raise ValueError("pairing entry must be an object")
                token_hash = entry.get("tokenHash")
                device_id = entry.get("deviceId")
                device_name = entry.get("name")
                created_at = entry.get("createdAt")
                if (
                    not isinstance(token_hash, str)
                    or len(token_hash) != 64
                    or not isinstance(device_id, str)
                    or not isinstance(device_name, str)
                    or not isinstance(created_at, int)
                ):
                    raise ValueError("pairing entry has an invalid shape")
                pairings[token_hash] = {
                    "deviceId": device_id,
                    "name": _safe_device_name(device_name),
                    "createdAt": created_at,
                }
            self._pairings = pairings
        except (OSError, ValueError, json.JSONDecodeError) as error:
            self.storage_error = f"Could not read saved phone pairings: {error}"

    def _save_pairings(self) -> None:
        self.storage_path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
        os.chmod(self.storage_path.parent, 0o700)
        temporary = self.storage_path.with_suffix(".json.tmp")
        content = json.dumps(list(self._pairings.values()), separators=(",", ":"))
        with temporary.open("w", encoding="utf-8") as file:
            os.chmod(temporary, 0o600)
            file.write(content)
            file.flush()
            os.fsync(file.fileno())
        os.replace(temporary, self.storage_path)
        os.chmod(self.storage_path, 0o600)
        self.storage_error = None

    def _new_pairing_code(self) -> None:
        self._pairing_code = secrets.token_urlsafe(12)
        self._pairing_expires_at = time.time() + PAIRING_LIFETIME_SECONDS

    def pairing_info(self) -> dict[str, object]:
        with self._pairing_lock:
            if self._pairing_code is None or time.time() >= self._pairing_expires_at:
                self._new_pairing_code()
            try:
                address = _default_ipv4_address()
            except OSError as error:
                return {
                    "available": False,
                    "error": f"Could not find this PC's Wi-Fi address: {error}",
                    "inputReady": self.input_ready(),
                    "pairedDevices": self.list_pairings(),
                }
            except RuntimeError as error:
                return {
                    "available": False,
                    "error": str(error),
                    "inputReady": self.input_ready(),
                    "pairedDevices": self.list_pairings(),
                }

            return {
                "available": self.server_error is None and self.storage_error is None,
                "error": self.server_error or self.storage_error,
                "url": f"http://{address}:{REMOTE_PORT}",
                "code": self._pairing_code,
                "expiresAt": int(self._pairing_expires_at),
                "computerName": self.computer_name,
                "inputReady": self.input_ready(),
                "pairedDevices": self.list_pairings(),
            }

    def refresh_pairing_code(self) -> dict[str, object]:
        with self._pairing_lock:
            self._new_pairing_code()
            return self.pairing_info()

    def list_pairings(self) -> list[dict[str, object]]:
        with self._pairing_lock:
            return [
                {
                    "deviceId": str(entry["deviceId"]),
                    "name": str(entry["name"]),
                    "createdAt": int(entry["createdAt"]),
                }
                for entry in sorted(
                    self._pairings.values(),
                    key=lambda item: int(item["createdAt"]),
                    reverse=True,
                )
            ]

    def pair(self, peer_address: str, code: object, client_name: object) -> dict[str, str]:
        if not _is_lan_client(peer_address):
            raise RemoteControlError("Pairing is available only from a private local network.", 403)
        if self.storage_error:
            raise RemoteControlError(self.storage_error, 503)
        if not isinstance(code, str) or not isinstance(client_name, str):
            raise RemoteControlError("Pairing details are invalid.")

        now = time.monotonic()
        with self._pairing_lock:
            attempts = [
                stamp
                for stamp in self._pair_attempts.get(peer_address, [])
                if now - stamp < PAIR_ATTEMPT_WINDOW_SECONDS
            ]
            if len(attempts) >= MAX_PAIR_ATTEMPTS:
                raise RemoteControlError("Too many pairing attempts. Wait a minute and scan a new code.", 429)
            attempts.append(now)
            self._pair_attempts[peer_address] = attempts

            if (
                self._pairing_code is None
                or time.time() >= self._pairing_expires_at
                or not hmac.compare_digest(code, self._pairing_code)
            ):
                raise RemoteControlError("That pairing code is expired or already used. Refresh the QR code on the PC.", 401)

            token = secrets.token_urlsafe(32)
            device_id = secrets.token_urlsafe(9)
            token_hash = hashlib.sha256(token.encode("utf-8")).hexdigest()
            self._pairings[token_hash] = {
                "deviceId": device_id,
                "name": _safe_device_name(client_name),
                "createdAt": int(time.time()),
            }
            self._save_pairings()
            self._pairing_code = None
            return {
                "deviceId": device_id,
                "token": token,
                "computerName": self.computer_name,
            }

    @staticmethod
    def _token_hash(token: str) -> str:
        return hashlib.sha256(token.encode("utf-8")).hexdigest()

    def is_authorized(self, token: str) -> bool:
        token_hash = self._token_hash(token)
        with self._pairing_lock:
            return any(hmac.compare_digest(token_hash, stored) for stored in self._pairings)

    def _authorized_pairing(self, token: str) -> tuple[str, dict[str, object]]:
        if not isinstance(token, str) or not token:
            raise RemoteControlError("This phone is not paired with the PC.", 401)
        token_hash = self._token_hash(token)
        with self._pairing_lock:
            for stored_hash, entry in self._pairings.items():
                if hmac.compare_digest(token_hash, stored_hash):
                    return stored_hash, entry
        raise RemoteControlError("This phone is not paired with the PC.", 401)

    def revoke_device(self, device_id: object) -> bool:
        if not isinstance(device_id, str):
            raise RemoteControlError("A paired device ID is required.")
        with self._pairing_lock:
            match = next(
                (
                    token_hash
                    for token_hash, entry in self._pairings.items()
                    if entry.get("deviceId") == device_id
                ),
                None,
            )
            if match is None:
                return False
            del self._pairings[match]
            self._save_pairings()
            return True

    def unpair_token(self, token: str) -> None:
        token_hash, _entry = self._authorized_pairing(token)
        with self._pairing_lock:
            del self._pairings[token_hash]
            self._save_pairings()

    def input_ready(self) -> bool:
        if self._input is not None:
            return True
        try:
            import importlib.util

            return importlib.util.find_spec("evdev") is not None and os.access("/dev/uinput", os.W_OK)
        except (ImportError, OSError, ValueError):
            return False

    def _get_input(self):
        if self._input is not None:
            return self._input
        try:
            if self.input_factory is not None:
                self._input = self.input_factory()
            else:
                from evdev import UInput, ecodes

                self._input = UInput(
                    {
                        ecodes.EV_REL: [ecodes.REL_X, ecodes.REL_Y],
                        ecodes.EV_KEY: [
                            ecodes.BTN_LEFT,
                            ecodes.KEY_LEFTALT,
                            ecodes.KEY_HOME,
                            ecodes.KEY_PLAYPAUSE,
                            ecodes.KEY_VOLUMEUP,
                            ecodes.KEY_VOLUMEDOWN,
                        ],
                    },
                    name="Streamline Remote",
                )
        except (ImportError, OSError, PermissionError) as error:
            raise RemoteControlError(
                "Pointer access is not ready. Install the Streamline update, then sign out and back in.",
                503,
            ) from error
        return self._input

    def _event_codes(self):
        if self.event_codes is not None:
            return self.event_codes
        try:
            from evdev import ecodes
        except ImportError as error:
            raise RemoteControlError("The Linux input support package is missing.", 503) from error
        return ecodes

    def move_pointer(self, dx: object, dy: object) -> None:
        if (
            isinstance(dx, bool)
            or isinstance(dy, bool)
            or not isinstance(dx, (int, float))
            or not isinstance(dy, (int, float))
            or not math.isfinite(dx)
            or not math.isfinite(dy)
        ):
            raise RemoteControlError("Pointer movement must contain finite numbers.")
        move_x = max(-MAX_POINTER_DELTA, min(MAX_POINTER_DELTA, int(dx)))
        move_y = max(-MAX_POINTER_DELTA, min(MAX_POINTER_DELTA, int(dy)))
        if move_x == 0 and move_y == 0:
            return
        ui = self._get_input()
        ecodes = self._event_codes()
        ui.write(ecodes.EV_REL, ecodes.REL_X, move_x)
        ui.write(ecodes.EV_REL, ecodes.REL_Y, move_y)
        ui.syn()

    def control(self, token: str, action: object) -> None:
        self._authorized_pairing(token)
        if not isinstance(action, str) or action not in ALLOWED_ACTIONS:
            raise RemoteControlError("That control is not supported.")
        ui = self._get_input()
        ecodes = self._event_codes()

        def key_tap(key: int) -> None:
            ui.write(ecodes.EV_KEY, key, 1)
            ui.syn()
            ui.write(ecodes.EV_KEY, key, 0)
            ui.syn()

        if action == "click":
            key_tap(ecodes.BTN_LEFT)
        elif action == "playPause":
            key_tap(ecodes.KEY_PLAYPAUSE)
        elif action == "volumeUp":
            key_tap(ecodes.KEY_VOLUMEUP)
        elif action == "volumeDown":
            key_tap(ecodes.KEY_VOLUMEDOWN)
        elif action == "home":
            ui.write(ecodes.EV_KEY, ecodes.KEY_LEFTALT, 1)
            ui.syn()
            ui.write(ecodes.EV_KEY, ecodes.KEY_HOME, 1)
            ui.syn()
            ui.write(ecodes.EV_KEY, ecodes.KEY_HOME, 0)
            ui.syn()
            ui.write(ecodes.EV_KEY, ecodes.KEY_LEFTALT, 0)
            ui.syn()

    def close(self) -> None:
        if self._input is not None:
            self._input.close()
            self._input = None


def _read_exact(stream, size: int) -> bytes:
    output = bytearray()
    while len(output) < size:
        chunk = stream.read(size - len(output))
        if not chunk:
            raise ConnectionError("WebSocket peer disconnected.")
        output.extend(chunk)
    return bytes(output)


def _send_ws_frame(connection, opcode: int, payload: bytes) -> None:
    length = len(payload)
    if length < 126:
        header = bytes((0x80 | opcode, length))
    elif length < 65536:
        header = bytes((0x80 | opcode, 126)) + length.to_bytes(2, "big")
    else:
        raise ValueError("WebSocket reply is too large.")
    connection.sendall(header + payload)


def _make_handler(control: RemoteControl):
    class RemoteControlHandler(BaseHTTPRequestHandler):
        protocol_version = "HTTP/1.1"

        def log_message(self, _format: str, *_args: object) -> None:
            # Pairing secrets and bearer tokens must never be written to logs.
            return

        def _send_json(self, status: int, payload: dict[str, object]) -> None:
            body = json.dumps(payload).encode("utf-8")
            self.send_response(status)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Cache-Control", "no-store")
            self.send_header("X-Content-Type-Options", "nosniff")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def _read_json(self) -> dict[str, object]:
            if self.headers.get_content_type() != "application/json":
                raise RemoteControlError("Expected a JSON request.")
            try:
                length = int(self.headers.get("Content-Length", "0"))
            except ValueError as error:
                raise RemoteControlError("Invalid request size.") from error
            if length < 2 or length > MAX_REMOTE_BODY_BYTES:
                raise RemoteControlError("Request size is invalid.")
            try:
                data = json.loads(self.rfile.read(length))
            except (ValueError, json.JSONDecodeError) as error:
                raise RemoteControlError("Invalid JSON request.") from error
            if not isinstance(data, dict):
                raise RemoteControlError("Expected a JSON object.")
            return data

        def _require_lan(self) -> None:
            peer = self.client_address[0]
            if not _is_lan_client(peer):
                raise RemoteControlError("This service accepts connections only from a private local network.", 403)

        def _bearer_token(self) -> str:
            value = self.headers.get("Authorization", "")
            scheme, _, token = value.partition(" ")
            if scheme.lower() != "bearer" or not token:
                raise RemoteControlError("This phone is not paired with the PC.", 401)
            return token

        def _handle_remote_input(self, token: str) -> None:
            self._require_lan()
            if not control.is_authorized(token):
                raise RemoteControlError("This phone is not paired with the PC.", 401)
            if self.headers.get("Upgrade", "").lower() != "websocket":
                raise RemoteControlError("A WebSocket connection is required.", 426)
            key = self.headers.get("Sec-WebSocket-Key", "")
            if not key or self.headers.get("Sec-WebSocket-Version") != "13":
                raise RemoteControlError("The WebSocket request is invalid.", 400)

            accept = base64.b64encode(
                hashlib.sha1((key + WEBSOCKET_GUID).encode("ascii")).digest()
            ).decode("ascii")
            self.send_response(101, "Switching Protocols")
            self.send_header("Upgrade", "websocket")
            self.send_header("Connection", "Upgrade")
            self.send_header("Sec-WebSocket-Accept", accept)
            self.end_headers()
            self.wfile.flush()
            self.connection.settimeout(35)
            event_window = time.monotonic()
            event_count = 0

            try:
                while True:
                    first, second = _read_exact(self.rfile, 2)
                    opcode = first & 0x0F
                    masked = bool(second & 0x80)
                    length = second & 0x7F
                    if length == 126:
                        length = int.from_bytes(_read_exact(self.rfile, 2), "big")
                    elif length == 127:
                        length = int.from_bytes(_read_exact(self.rfile, 8), "big")
                    if not masked or length > MAX_REMOTE_BODY_BYTES:
                        raise ConnectionError("Invalid WebSocket frame.")
                    mask = _read_exact(self.rfile, 4)
                    payload = bytearray(_read_exact(self.rfile, length))
                    for index in range(length):
                        payload[index] ^= mask[index % 4]

                    if opcode == 0x8:
                        _send_ws_frame(self.connection, 0x8, b"")
                        return
                    if opcode == 0x9:
                        _send_ws_frame(self.connection, 0xA, bytes(payload))
                        continue
                    if opcode != 0x1:
                        raise ConnectionError("Unsupported WebSocket message.")
                    if not control.is_authorized(token):
                        _send_ws_frame(
                            self.connection,
                            0x1,
                            json.dumps({"error": "This phone's pairing was revoked."}).encode("utf-8"),
                        )
                        return

                    now = time.monotonic()
                    if now - event_window >= 1:
                        event_window = now
                        event_count = 0
                    event_count += 1
                    if event_count > MAX_POINTER_EVENTS_PER_SECOND:
                        raise ConnectionError("Pointer event rate limit exceeded.")

                    try:
                        message = json.loads(payload)
                    except (ValueError, json.JSONDecodeError) as error:
                        raise ConnectionError("Invalid pointer message.") from error
                    if (
                        not isinstance(message, dict)
                        or set(message) != {"type", "dx", "dy"}
                        or message.get("type") != "move"
                    ):
                        raise ConnectionError("Unsupported pointer message.")
                    try:
                        control.move_pointer(message.get("dx"), message.get("dy"))
                    except RemoteControlError as error:
                        _send_ws_frame(
                            self.connection,
                            0x1,
                            json.dumps({"error": str(error)}).encode("utf-8"),
                        )
                        return
            except (ConnectionError, OSError, TimeoutError, ValueError):
                return
            finally:
                self.close_connection = True

        def do_GET(self) -> None:
            try:
                self._require_lan()
            except RemoteControlError as error:
                self._send_json(error.status, {"error": str(error)})
                return
            parsed = urlsplit(self.path)
            if parsed.path == "/api/status":
                try:
                    control._authorized_pairing(self._bearer_token())
                    self._send_json(
                        200,
                        {
                            "computerName": control.computer_name,
                            "inputReady": control.input_ready(),
                        },
                    )
                except RemoteControlError as error:
                    self._send_json(error.status, {"error": str(error)})
                return
            if parsed.path == "/api/remote-input":
                query = parse_qs(parsed.query)
                token = query.get("token", [""])[0]
                try:
                    self._handle_remote_input(token)
                except RemoteControlError as error:
                    self._send_json(error.status, {"error": str(error)})
                return
            self._send_json(404, {"error": "Not found"})

        def do_POST(self) -> None:
            try:
                self._require_lan()
                parsed_path = urlsplit(self.path).path
                payload = self._read_json()
                if parsed_path == "/api/pair":
                    if set(payload) != {"code", "clientName"}:
                        raise RemoteControlError("Pairing requires a code and client name.")
                    self._send_json(
                        200,
                        control.pair(
                            self.client_address[0],
                            payload.get("code"),
                            payload.get("clientName"),
                        ),
                    )
                    return

                token = self._bearer_token()
                if parsed_path == "/api/control":
                    if set(payload) != {"action"}:
                        raise RemoteControlError("A single control action is required.")
                    control.control(token, payload.get("action"))
                    self._send_json(200, {"accepted": True})
                    return
                if parsed_path == "/api/unpair":
                    if payload != {}:
                        raise RemoteControlError("Expected an empty JSON object.")
                    control.unpair_token(token)
                    self._send_json(200, {"accepted": True})
                    return
                self._send_json(404, {"error": "Not found"})
            except RemoteControlError as error:
                self._send_json(error.status, {"error": str(error)})

    return RemoteControlHandler


def create_remote_server(control: RemoteControl) -> ThreadingHTTPServer:
    class LocalOnlyServer(ThreadingHTTPServer):
        allow_reuse_address = True
        daemon_threads = True

    return LocalOnlyServer(("0.0.0.0", REMOTE_PORT), _make_handler(control))
