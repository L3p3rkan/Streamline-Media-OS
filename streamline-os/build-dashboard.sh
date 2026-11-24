#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
WORKSPACE_ROOT="$(cd -- "$SCRIPT_DIR/.." && pwd)"
ARTIFACT_DIR="$WORKSPACE_ROOT/artifacts/streamline-dashboard"
BUILD_DIR="$ARTIFACT_DIR/dist/public"
TARGET_DIR="$SCRIPT_DIR/config/includes.chroot/usr/share/streamline/web"

if ! command -v pnpm >/dev/null 2>&1; then
  echo "pnpm is required to build the dashboard. Run this from the configured Replit project or install Node.js 24 and pnpm." >&2
  exit 1
fi

cd "$WORKSPACE_ROOT"
PORT=4173 BASE_PATH=/ pnpm --filter @workspace/streamline-dashboard run build

if [[ ! -s "$BUILD_DIR/index.html" ]]; then
  echo "Dashboard build did not create $BUILD_DIR/index.html" >&2
  exit 1
fi

mkdir -p "$TARGET_DIR"
find "$TARGET_DIR" -mindepth 1 -maxdepth 1 -exec rm -rf -- {} +
cp -a "$BUILD_DIR/." "$TARGET_DIR/"
echo "Installed the dashboard bundle into $TARGET_DIR"
