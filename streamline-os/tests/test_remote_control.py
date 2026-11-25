import importlib.util
import tempfile
import unittest
from pathlib import Path


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
        )
        return control, fake_input

    def test_pairing_code_is_one_time_and_tokens_are_hashed(self):
        with tempfile.TemporaryDirectory() as directory:
            control, _ = self.make_control(directory)
            info = control.pairing_info()
            paired = control.pair("192.168.1.42", info["code"], "Student iPhone")

            self.assertTrue(paired["token"])
            self.assertEqual(len(control.list_pairings()), 1)
            saved = Path(directory, "pairings.json").read_text(encoding="utf-8")
            self.assertNotIn(paired["token"], saved)
            with self.assertRaises(REMOTE.RemoteControlError):
                control.pair("192.168.1.42", info["code"], "Second attempt")

    def test_public_network_cannot_pair(self):
        with tempfile.TemporaryDirectory() as directory:
            control, _ = self.make_control(directory)
            code = control.pairing_info()["code"]
            with self.assertRaises(REMOTE.RemoteControlError) as error:
                control.pair("8.8.8.8", code, "Phone")
            self.assertEqual(error.exception.status, 403)

    def test_only_allowlisted_pointer_and_media_actions_are_emitted(self):
        with tempfile.TemporaryDirectory() as directory:
            control, fake_input = self.make_control(directory)
            code = control.pairing_info()["code"]
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
                control.pairing_info()["code"],
                "Phone",
            )
            control.revoke_device(paired["deviceId"])
            self.assertFalse(control.is_authorized(paired["token"]))


if __name__ == "__main__":
    unittest.main()
