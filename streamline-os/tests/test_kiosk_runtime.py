import importlib.util
from importlib.machinery import SourceFileLoader
import json
import os
import sys
import tempfile
import threading
import unittest
import urllib.request
from pathlib import Path
from unittest import mock


WORKSPACE_ROOT = Path(__file__).resolve().parents[2]
KIOSK_SCRIPT = WORKSPACE_ROOT / "streamline-os/config/includes.chroot/usr/local/bin/streamline-kiosk"
REMOTE_LIB = WORKSPACE_ROOT / "streamline-os/config/includes.chroot/usr/local/lib/streamline"
MODULE_NAME = "streamline_kiosk_runtime_tests"


class KioskRuntimeTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.home = tempfile.TemporaryDirectory()
        cls.original_home = os.environ.get("HOME")
        os.environ["HOME"] = cls.home.name
        sys.path.insert(0, str(REMOTE_LIB))
        loader = SourceFileLoader(MODULE_NAME, str(KIOSK_SCRIPT))
        spec = importlib.util.spec_from_loader(MODULE_NAME, loader)
        if spec is None or spec.loader is None:
            raise RuntimeError("Could not load the Streamline kiosk helper.")
        cls.kiosk = importlib.util.module_from_spec(spec)
        sys.modules[MODULE_NAME] = cls.kiosk
        spec.loader.exec_module(cls.kiosk)

    @classmethod
    def tearDownClass(cls):
        sys.modules.pop(MODULE_NAME, None)
        sys.path.remove(str(REMOTE_LIB))
        if cls.original_home is None:
            os.environ.pop("HOME", None)
        else:
            os.environ["HOME"] = cls.original_home
        cls.home.cleanup()

    def setUp(self):
        self.kiosk.runtime.exit_requested.clear()
        self.kiosk.runtime.stop.clear()
        self.kiosk.runtime.clear_profile.clear()
        self.kiosk.runtime.power_action = None
        self.kiosk.runtime.shutdown_callback = None

    def test_firefox_profile_enables_drm_and_preserves_other_preferences(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            profile = Path(temp_dir)
            (profile / "user.js").write_text(
                'user_pref("media.eme.enabled", false);\n'
                'user_pref("custom.preference", true);\n',
                encoding="utf-8",
            )

            self.kiosk._configure_firefox_home(profile)

            user_js = (profile / "user.js").read_text(encoding="utf-8")
            self.assertIn('user_pref("media.eme.enabled", true);', user_js)
            self.assertIn('user_pref("custom.preference", true);', user_js)
            self.assertEqual(user_js.count('user_pref("media.eme.enabled",'), 1)

    def test_exit_marker_suppresses_relaunch_until_boot_id_changes(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            marker_directory = root / "run-lock"
            boot_id_path = root / "boot_id"
            boot_id_path.write_text("boot-one\n", encoding="utf-8")

            self.assertFalse(self.kiosk._exit_requested_until_reboot(marker_directory, boot_id_path))
            self.kiosk._mark_exit_until_reboot(marker_directory, boot_id_path)
            self.assertTrue(self.kiosk._exit_requested_until_reboot(marker_directory, boot_id_path))
            self.kiosk._mark_exit_until_reboot(marker_directory, boot_id_path)

            boot_id_path.write_text("boot-two\n", encoding="utf-8")
            self.assertFalse(self.kiosk._exit_requested_until_reboot(marker_directory, boot_id_path))

    def test_local_exit_request_sets_marker_and_stops_runtime(self):
        server = self.kiosk.ThreadingHTTPServer(("127.0.0.1", 0), self.kiosk.DashboardHandler)
        server.daemon_threads = True
        server_thread = threading.Thread(target=server.serve_forever, daemon=True)
        server_thread.start()
        shutdown_callback = mock.Mock()
        self.kiosk.runtime.shutdown_callback = shutdown_callback
        timer_patcher = mock.patch.object(self.kiosk.threading, "Timer")

        try:
            with mock.patch.object(self.kiosk, "_mark_exit_until_reboot") as mark_exit:
                with timer_patcher as timer:
                    request = urllib.request.Request(
                        f"http://127.0.0.1:{server.server_port}/api/exit-application",
                        data=json.dumps({}).encode("utf-8"),
                        headers={
                            "Host": f"{self.kiosk.HOST}:{self.kiosk.PORT}",
                            "Origin": self.kiosk.ALLOWED_ORIGIN,
                            "Content-Type": "application/json",
                        },
                        method="POST",
                    )
                    with urllib.request.urlopen(request, timeout=3) as response:
                        payload = json.loads(response.read())
                        self.assertEqual(response.status, 202)
                    self.assertTrue(payload["accepted"])
                    self.assertTrue(self.kiosk.runtime.exit_requested.is_set())
                    mark_exit.assert_called_once_with()
                    timer.assert_called_once_with(0.75, self.kiosk.runtime.exit_streamline)
                    timer.return_value.start.assert_called_once_with()

            self.kiosk.runtime.exit_streamline()
            self.assertTrue(self.kiosk.runtime.stop.is_set())
            shutdown_callback.assert_called_once_with()
        finally:
            server.shutdown()
            server.server_close()
            server_thread.join(timeout=3)


if __name__ == "__main__":
    unittest.main()
