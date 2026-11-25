import importlib.util
import base64
import ipaddress
import json
import socket
import tempfile
import threading
import unittest
from pathlib import Path
from urllib.error import HTTPError
from urllib.request import Request, urlopen


MODULE_PATH = (
    Path(__file__).parent.parent
    / "config"
    / "includes.chroot"
    / "usr"
    / "local"
    / "lib"
    / "streamline"
    / "streamline_remote.py"
)
SPEC = importlib.util.spec_from_file_location("streamline_remote", MODULE_PATH)
REMOTE = importlib.util.module_from_spec(SPEC)
assert SPEC.loader is not None
SPEC.loader.exec_module(REMOTE)


class FakeInput:
    def __init__(self):
        self.events = []

    def write(self, event_type, code, value):
        self.events.append((event_type, code, value))

    def syn(self):
        self.events.append(("syn",))

    def close(self):
        pass


class FakeCodes:
    EV_REL = 2
    REL_X = 0
    REL_Y = 1
    EV_KEY = 1
    BTN_LEFT = 272
    KEY_LEFTALT = 56
    KEY_HOME = 102
    KEY_PLAYPAUSE = 164
    KEY_VOLUMEUP = 115
    KEY_VOLUMEDOWN = 114


class RemoteControlTests(unittest.TestCase):
    def make_control(self, directory):
        fake_input = FakeInput()
        control = REMOTE.RemoteControl(
            storage_path=Path(directory) / "pairings.json",
            input_factory=lambda: fake_input,
            event_codes=FakeCodes,
            allowed_networks=(
                ipaddress.ip_network("192.168.1.0/24"),
                ipaddress.ip_network("127.0.0.0/8"),
            ),
        )
        return control, fake_input

    def test_pairing_code_is_one_time_and_tokens_are_hashed(self):
        with tempfile.TemporaryDirectory() as directory:
            control, _ = self.make_control(directory)
            code = control._pairing_code
            paired = control.pair("192.168.1.42", code, "Student iPhone")

            self.assertTrue(paired["token"])
            self.assertEqual(len(control.list_pairings()), 1)
            saved = Path(directory, "pairings.json").read_text(encoding="utf-8")
            self.assertNotIn(paired["token"], saved)
            with self.assertRaises(REMOTE.RemoteControlError):
                control.pair("192.168.1.42", code, "Second attempt")

            restored = REMOTE.RemoteControl(storage_path=Path(directory) / "pairings.json")
            self.assertTrue(restored.is_authorized(paired["token"]))

    def test_public_network_cannot_pair(self):
        with tempfile.TemporaryDirectory() as directory:
            control, _ = self.make_control(directory)
            code = control._pairing_code
            with self.assertRaises(REMOTE.RemoteControlError) as error:
                control.pair("8.8.8.8", code, "Phone")
            self.assertEqual(error.exception.status, 403)

    def test_control_access_is_limited_to_local_subnet(self):
        with tempfile.TemporaryDirectory() as directory:
            control, _ = self.make_control(directory)
            self.assertTrue(control.is_lan_client("192.168.1.42"))
            self.assertFalse(control.is_lan_client("192.168.2.42"))
            self.assertFalse(control.is_lan_client("8.8.8.8"))

    def test_only_allowlisted_pointer_and_media_actions_are_emitted(self):
        with tempfile.TemporaryDirectory() as directory:
            control, fake_input = self.make_control(directory)
            code = control._pairing_code
            paired = control.pair("192.168.1.42", code, "Phone")

            control.move_pointer(14, -8)
            control.control(paired["token"], "click")
            control.control(paired["token"], "playPause")
            control.control(paired["token"], "volumeUp")
            control.control(paired["token"], "volumeDown")
            control.control(paired["token"], "home")

            self.assertGreater(len(fake_input.events), 10)
            with self.assertRaises(REMOTE.RemoteControlError):
                control.control(paired["token"], "shell")

    def test_revoking_pairing_invalidates_its_token(self):
        with tempfile.TemporaryDirectory() as directory:
            control, _ = self.make_control(directory)
            paired = control.pair(
                "192.168.1.42",
                control._pairing_code,
                "Phone",
            )
            control.revoke_device(paired["deviceId"])
            self.assertFalse(control.is_authorized(paired["token"]))

    def test_http_pairing_status_control_and_unpair(self):
        with tempfile.TemporaryDirectory() as directory:
            control, fake_input = self.make_control(directory)
            pairing_code = control._pairing_code
            server = REMOTE.create_remote_server(control, host="127.0.0.1", port=0)
            thread = threading.Thread(target=server.serve_forever, daemon=True)
            thread.start()
            base_url = f"http://127.0.0.1:{server.server_address[1]}"

            def request(path, method="GET", payload=None, token=None):
                headers = {}
                body = None
                if payload is not None:
                    headers["Content-Type"] = "application/json"
                    body = json.dumps(payload).encode("utf-8")
                if token:
                    headers["Authorization"] = f"Bearer {token}"
                req = Request(f"{base_url}{path}", data=body, headers=headers, method=method)
                with urlopen(req, timeout=3) as response:
                    return response.status, json.loads(response.read())

            try:
                _status, paired = request(
                    "/api/pair",
                    method="POST",
                    payload={"code": pairing_code, "clientName": "Test iPhone"},
                )
                status, response = request("/api/status", token=paired["token"])
                self.assertEqual(status, 200)
                self.assertEqual(response["computerName"], control.computer_name)

                status, _response = request(
                    "/api/control",
                    method="POST",
                    payload={"action": "click"},
                    token=paired["token"],
                )
                self.assertEqual(status, 200)
                self.assertIn((FakeCodes.EV_KEY, FakeCodes.BTN_LEFT, 1), fake_input.events)

                try:
                    request(
                        "/api/control",
                        method="POST",
                        payload={"action": "poweroff"},
                        token=paired["token"],
                    )
                except HTTPError as error:
                    self.assertEqual(error.code, 400)
                else:
                    self.fail("Unsupported action should be rejected.")

                request("/api/unpair", method="POST", payload={}, token=paired["token"])
                try:
                    request("/api/status", token=paired["token"])
                except HTTPError as error:
                    self.assertEqual(error.code, 401)
                else:
                    self.fail("Revoked token should not authorize status.")
            finally:
                server.shutdown()
                server.server_close()
                thread.join(timeout=3)
                control.close()

    def test_websocket_heartbeat_keeps_control_session_open(self):
        with tempfile.TemporaryDirectory() as directory:
            control, _fake_input = self.make_control(directory)
            paired = control.pair("127.0.0.1", control._pairing_code, "Test iPhone")
            server = REMOTE.create_remote_server(control, host="127.0.0.1", port=0)
            thread = threading.Thread(target=server.serve_forever, daemon=True)
            thread.start()
            client = socket.create_connection(("127.0.0.1", server.server_address[1]), timeout=3)
            client.settimeout(3)

            def read_exact(size):
                content = bytearray()
                while len(content) < size:
                    chunk = client.recv(size - len(content))
                    if not chunk:
                        raise ConnectionError("WebSocket closed before the expected response.")
                    content.extend(chunk)
                return bytes(content)

            try:
                key = base64.b64encode(b"0123456789abcdef").decode("ascii")
                client.sendall(
                    (
                        f"GET /api/remote-input?token={paired['token']} HTTP/1.1\r\n"
                        f"Host: 127.0.0.1:{server.server_address[1]}\r\n"
                        "Upgrade: websocket\r\n"
                        "Connection: Upgrade\r\n"
                        f"Sec-WebSocket-Key: {key}\r\n"
                        "Sec-WebSocket-Version: 13\r\n\r\n"
                    ).encode("ascii")
                )
                handshake = bytearray()
                while b"\r\n\r\n" not in handshake:
                    handshake.extend(client.recv(1024))
                self.assertIn(b"101 Switching Protocols", handshake)

                payload = b'{"type":"ping"}'
                mask = b"\x11\x22\x33\x44"
                masked_payload = bytes(value ^ mask[index % 4] for index, value in enumerate(payload))
                client.sendall(bytes((0x81, 0x80 | len(payload))) + mask + masked_payload)

                first, second = read_exact(2)
                self.assertEqual(first & 0x0F, 0x1)
                length = second & 0x7F
                response = json.loads(read_exact(length))
                self.assertEqual(response, {"type": "pong"})
            finally:
                client.close()
                server.shutdown()
                server.server_close()
                thread.join(timeout=3)
                control.close()


if __name__ == "__main__":
    unittest.main()
