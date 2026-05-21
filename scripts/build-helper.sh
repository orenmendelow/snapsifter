#!/bin/bash
set -e
cd "$(dirname "$0")/../camera-helper"

echo "Building camera-helper (release)..."
swift build -c release

BINARY=".build/release/camera-helper"

if [ -n "$CODESIGN_IDENTITY" ]; then
  echo "Signing camera-helper with: $CODESIGN_IDENTITY"
  codesign --force --options runtime \
    --entitlements camera-helper.entitlements \
    --sign "$CODESIGN_IDENTITY" \
    "$BINARY"
else
  echo "No CODESIGN_IDENTITY set — signing with ad-hoc identity"
  codesign --force \
    --entitlements camera-helper.entitlements \
    --sign - \
    "$BINARY"
fi

echo "camera-helper built at: $BINARY"
