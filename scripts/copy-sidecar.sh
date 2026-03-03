#!/bin/bash
# Build the MCP sidecar binary and copy it to src-tauri/binaries/ with the
# target triple suffix that Tauri's externalBin expects.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BINARY_NAME="weekend-browser-mcp"

# CI sets SKIP_SIDECAR=1 when the sidecar was already built for cross-compilation
if [ "${SKIP_SIDECAR:-}" = "1" ]; then
    echo "Skipping sidecar build (SKIP_SIDECAR=1)"
    exit 0
fi

# Determine build profile from argument (default: debug)
PROFILE="${1:-debug}"
# Optional target triple override (for CI cross-compilation)
TARGET_TRIPLE="${2:-$(rustc -vV | grep '^host:' | cut -d' ' -f2)}"

if [ "$PROFILE" = "release" ]; then
    cargo build --release -p "$BINARY_NAME" --target "$TARGET_TRIPLE" --manifest-path "$REPO_ROOT/Cargo.toml"
    SRC="$REPO_ROOT/target/$TARGET_TRIPLE/release/$BINARY_NAME"
else
    cargo build -p "$BINARY_NAME" --target "$TARGET_TRIPLE" --manifest-path "$REPO_ROOT/Cargo.toml"
    SRC="$REPO_ROOT/target/$TARGET_TRIPLE/debug/$BINARY_NAME"
fi

DEST_DIR="$REPO_ROOT/src-tauri/binaries"
mkdir -p "$DEST_DIR"

DEST="$DEST_DIR/${BINARY_NAME}-${TARGET_TRIPLE}"
cp "$SRC" "$DEST"
chmod +x "$DEST"

echo "Copied sidecar: $DEST"
