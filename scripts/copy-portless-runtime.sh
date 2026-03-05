#!/bin/bash
# Copy the portless runtime (CLI + runtime deps) into src-tauri/resources so
# the desktop app can invoke it without requiring a global npm install.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PORTLESS_PKG_DIR="$REPO_ROOT/node_modules/portless"
DEST_DIR="$REPO_ROOT/src-tauri/resources/portless"

if [ ! -f "$PORTLESS_PKG_DIR/dist/cli.js" ]; then
  echo "Missing portless runtime at $PORTLESS_PKG_DIR/dist/cli.js"
  echo "Run pnpm install to fetch dependencies."
  exit 1
fi

CHALK_LINK="$(ls -d "$REPO_ROOT"/node_modules/.pnpm/portless@*/node_modules/chalk 2>/dev/null | head -n 1 || true)"
if [ -z "$CHALK_LINK" ] && [ -d "$REPO_ROOT/node_modules/chalk" ]; then
  CHALK_LINK="$REPO_ROOT/node_modules/chalk"
fi
if [ -n "$CHALK_LINK" ]; then
  CHALK_PKG_DIR="$(cd "$CHALK_LINK" && pwd -P)"
else
  CHALK_PKG_DIR=""
fi

if [ -z "$CHALK_PKG_DIR" ] || [ ! -f "$CHALK_PKG_DIR/package.json" ]; then
  echo "Missing chalk runtime dependency at $CHALK_PKG_DIR"
  echo "Run pnpm install to fetch dependencies."
  exit 1
fi

rm -rf "$DEST_DIR"
mkdir -p "$DEST_DIR/dist" "$DEST_DIR/node_modules"

rsync -a "$PORTLESS_PKG_DIR/dist/" "$DEST_DIR/dist/"
cp "$PORTLESS_PKG_DIR/package.json" "$DEST_DIR/package.json"
rsync -a "$CHALK_PKG_DIR/" "$DEST_DIR/node_modules/chalk/"

chmod +x "$DEST_DIR/dist/cli.js" || true

echo "Copied bundled portless runtime: $DEST_DIR"
