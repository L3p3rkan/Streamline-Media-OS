#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
STAGED_WEB="$SCRIPT_DIR/config/includes.chroot/usr/share/streamline/web"
KIOSK_SOURCE="$SCRIPT_DIR/config/includes.chroot/usr/local/bin/streamline-kiosk"
REMOTE_SOURCE="$SCRIPT_DIR/config/includes.chroot/usr/local/lib/streamline/streamline_remote.py"
DESKTOP_SOURCE="$SCRIPT_DIR/config/includes.chroot/etc/xdg/autostart/streamline-launcher.desktop"
UDEV_SOURCE="$SCRIPT_DIR/config/includes.chroot/etc/udev/rules.d/70-streamline-uinput.rules"
MODULES_SOURCE="$SCRIPT_DIR/config/includes.chroot/etc/modules-load.d/streamline-uinput.conf"

if [[ "${EUID}" -ne 0 ]]; then
  echo "Run with sudo: sudo ./streamline-os/install-ubuntu.sh" >&2
  exit 1
fi

TARGET_USER="${SUDO_USER:-}"
if [[ -z "$TARGET_USER" || "$TARGET_USER" == "root" ]]; then
  echo "Run this with sudo from the Ubuntu desktop account that should auto-launch Streamline." >&2
  exit 1
fi

TARGET_HOME="$(getent passwd "$TARGET_USER" | cut -d: -f6)"
TARGET_GROUP="$(id -gn "$TARGET_USER")"
if [[ -z "$TARGET_HOME" || ! -d "$TARGET_HOME" ]]; then
  echo "Could not find the home directory for $TARGET_USER." >&2
  exit 1
fi

if [[ ! -s "$STAGED_WEB/index.html" ]]; then
  echo "Dashboard bundle is missing. From the project root, run ./streamline-os/build-dashboard.sh first." >&2
  exit 1
fi
if [[ ! -x "$KIOSK_SOURCE" || ! -f "$DESKTOP_SOURCE" ]]; then
  echo "Kiosk launcher files are missing from $SCRIPT_DIR/config/includes.chroot." >&2
  exit 1
fi
if ! command -v python3 >/dev/null 2>&1; then
  echo "Python 3 is required. Install it with: sudo apt install python3" >&2
  exit 1
fi
if ! python3 -c 'import evdev' >/dev/null 2>&1; then
  echo "Linux input support is required. Install it with: sudo apt install python3-evdev" >&2
  exit 1
fi
if ! command -v firefox-esr >/dev/null 2>&1 && ! command -v firefox >/dev/null 2>&1; then
  echo "Firefox is required. Install Firefox, then run this installer again." >&2
  exit 1
fi

install -d -o root -g root -m 0755 /usr/share/streamline/web
cp -a "$STAGED_WEB/." /usr/share/streamline/web/
install -D -o root -g root -m 0755 "$KIOSK_SOURCE" /usr/local/bin/streamline-kiosk
install -D -o root -g root -m 0644 "$REMOTE_SOURCE" /usr/local/lib/streamline/streamline_remote.py
install -D -o root -g root -m 0644 "$UDEV_SOURCE" /etc/udev/rules.d/70-streamline-uinput.rules
install -D -o root -g root -m 0644 "$MODULES_SOURCE" /etc/modules-load.d/streamline-uinput.conf
modprobe uinput || true
udevadm control --reload-rules || true
if [[ -e /dev/uinput ]]; then
  udevadm trigger /dev/uinput || true
fi

AUTOSTART_DIR="$TARGET_HOME/.config/autostart"
install -d -o "$TARGET_USER" -g "$TARGET_GROUP" -m 0755 "$AUTOSTART_DIR"
install -o "$TARGET_USER" -g "$TARGET_GROUP" -m 0644 \
  "$DESKTOP_SOURCE" "$AUTOSTART_DIR/streamline-launcher.desktop"

echo "Installed Streamline for $TARGET_USER."
echo "It will start in kiosk mode after that user signs in to the Ubuntu desktop."
echo "Sign out and back in (or reboot) to test it."
