#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
WORKSPACE_ROOT="$(cd -- "$SCRIPT_DIR/.." && pwd)"
PACKAGE_TEMPLATE="$SCRIPT_DIR/package/deb"
STAGED_WEB="$SCRIPT_DIR/config/includes.chroot/usr/share/streamline/web"
KIOSK_SOURCE="$SCRIPT_DIR/config/includes.chroot/usr/local/bin/streamline-kiosk"
REMOTE_SOURCE="$SCRIPT_DIR/config/includes.chroot/usr/local/lib/streamline/streamline_remote.py"
DESKTOP_SOURCE="$SCRIPT_DIR/config/includes.chroot/etc/xdg/autostart/streamline-launcher.desktop"
UDEV_SOURCE="$SCRIPT_DIR/config/includes.chroot/etc/udev/rules.d/70-streamline-uinput.rules"
MODULES_SOURCE="$SCRIPT_DIR/config/includes.chroot/etc/modules-load.d/streamline-uinput.conf"
OUTPUT_DIR="$SCRIPT_DIR/packages"

VERSION="${1:-$(<"$SCRIPT_DIR/VERSION")}"
VERSION="${VERSION#v}"
if [[ ! "$VERSION" =~ ^[0-9][A-Za-z0-9.+:~-]*$ ]]; then
  echo "Invalid package version: $VERSION" >&2
  echo "Use a Debian-compatible version such as 0.1.0." >&2
  exit 1
fi

if ! command -v dpkg-deb >/dev/null 2>&1; then
  echo "dpkg-deb is required to build the Ubuntu installer." >&2
  exit 1
fi
if [[ ! -x "$KIOSK_SOURCE" || ! -f "$REMOTE_SOURCE" || ! -f "$DESKTOP_SOURCE" || ! -f "$UDEV_SOURCE" || ! -f "$MODULES_SOURCE" ]]; then
  echo "Kiosk launcher files are missing from $SCRIPT_DIR/config/includes.chroot." >&2
  exit 1
fi

"$SCRIPT_DIR/build-dashboard.sh"
if [[ ! -s "$STAGED_WEB/index.html" ]]; then
  echo "Dashboard bundle is missing after the build." >&2
  exit 1
fi

PACKAGE_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/streamline-deb.XXXXXX")"
trap 'rm -rf -- "$PACKAGE_ROOT"' EXIT
mkdir -p \
  "$PACKAGE_ROOT/DEBIAN" \
  "$PACKAGE_ROOT/usr/share/streamline/web" \
  "$PACKAGE_ROOT/usr/local/bin" \
  "$PACKAGE_ROOT/usr/local/lib/streamline" \
  "$PACKAGE_ROOT/etc/udev/rules.d" \
  "$PACKAGE_ROOT/etc/modules-load.d" \
  "$PACKAGE_ROOT/etc/xdg/autostart"

sed "s/@VERSION@/$VERSION/" "$PACKAGE_TEMPLATE/control.in" > "$PACKAGE_ROOT/DEBIAN/control"
install -m 0755 "$PACKAGE_TEMPLATE/postrm" "$PACKAGE_ROOT/DEBIAN/postrm"
install -m 0755 "$PACKAGE_TEMPLATE/postinst" "$PACKAGE_ROOT/DEBIAN/postinst"
install -m 0755 "$KIOSK_SOURCE" "$PACKAGE_ROOT/usr/local/bin/streamline-kiosk"
install -m 0644 "$REMOTE_SOURCE" "$PACKAGE_ROOT/usr/local/lib/streamline/streamline_remote.py"
install -m 0644 "$DESKTOP_SOURCE" "$PACKAGE_ROOT/etc/xdg/autostart/streamline-launcher.desktop"
install -m 0644 "$UDEV_SOURCE" "$PACKAGE_ROOT/etc/udev/rules.d/70-streamline-uinput.rules"
install -m 0644 "$MODULES_SOURCE" "$PACKAGE_ROOT/etc/modules-load.d/streamline-uinput.conf"
cp -a "$STAGED_WEB/." "$PACKAGE_ROOT/usr/share/streamline/web/"
chmod 0755 "$PACKAGE_ROOT"

mkdir -p "$OUTPUT_DIR"
OUTPUT_FILE="$OUTPUT_DIR/streamline-kiosk_${VERSION}_amd64.deb"
dpkg-deb --root-owner-group --build "$PACKAGE_ROOT" "$OUTPUT_FILE"
sha256sum "$OUTPUT_FILE" > "$OUTPUT_FILE.sha256"

echo "Built installer: $OUTPUT_FILE"
echo "Checksum: $OUTPUT_FILE.sha256"
dpkg-deb --field "$OUTPUT_FILE" Package Version Architecture Depends
