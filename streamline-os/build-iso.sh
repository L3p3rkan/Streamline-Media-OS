#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
OUTPUT_ISO="live-image-amd64.hybrid.iso"
DEBIAN_SUITE="${DEBIAN_SUITE:-stable}"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run this script as root on a Debian x86-64 build host." >&2
  echo "Example: sudo ./streamline-os/build-iso.sh" >&2
  exit 1
fi

if [[ "$(dpkg --print-architecture 2>/dev/null || true)" != "amd64" ]]; then
  echo "The build host must be Debian amd64 (x86-64)." >&2
  exit 1
fi

for tool in lb debootstrap xorriso mksquashfs; do
  if ! command -v "$tool" >/dev/null 2>&1; then
    echo "Missing build tool: $tool. See streamline-os/README.md." >&2
    exit 1
  fi
done

cd "$SCRIPT_DIR"

lb clean --purge
lb config \
  --distribution "$DEBIAN_SUITE" \
  --architectures amd64 \
  --binary-images iso-hybrid \
  --archive-areas "main contrib non-free non-free-firmware" \
  --debian-installer live \
  --bootappend-live "boot=live components username=stream hostname=streamline quiet splash"

lb build

if [[ ! -s "$OUTPUT_ISO" ]]; then
  echo "The build finished without creating the expected ISO: $SCRIPT_DIR/$OUTPUT_ISO" >&2
  exit 1
fi

echo "Created $SCRIPT_DIR/$OUTPUT_ISO"
