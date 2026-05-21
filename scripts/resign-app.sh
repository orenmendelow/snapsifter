#!/bin/bash
set -e
APP="${1:-dist/mac-arm64/drkrm.app}"

if [ ! -d "$APP" ]; then
  echo "App not found: $APP"
  exit 1
fi

echo "Re-signing $APP..."

# Sign all binaries, dylibs, and frameworks inside-out
find "$APP/Contents/Frameworks" -type f -perm +111 -exec codesign --force --sign - {} \; 2>/dev/null
find "$APP/Contents/Frameworks" -name "*.dylib" -exec codesign --force --sign - {} \; 2>/dev/null
find "$APP/Contents/Frameworks" -name "*.framework" -exec codesign --force --sign - {} \; 2>/dev/null
find "$APP" -name "*.app" -path "*/Helpers/*" -exec codesign --force --sign - {} \; 2>/dev/null

# Sign Resources binaries (camera-helper)
find "$APP/Contents/Resources" -type f -perm +111 ! -name "*.js" ! -name "*.json" ! -name "*.node" -exec codesign --force --sign - {} \; 2>/dev/null

# Sign main app
codesign --force --sign - "$APP"

codesign --verify --deep "$APP" && echo "Signing verified OK" || echo "Signing verification FAILED"
