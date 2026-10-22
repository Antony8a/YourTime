#!/usr/bin/env bash
# Runs inside the image. /src is the repository (read-only) and /out receives the APK.
# Environment: API_URL (baked in as the default server) and ABIS (default arm64-v8a).
set -euo pipefail

: "${API_URL:?API_URL is required, e.g. http://192.168.1.109:8080}"
ABIS="${ABIS:-arm64-v8a}"

echo "==> Copying the project (without node_modules)"
rsync -a --delete \
  --exclude node_modules --exclude .git --exclude .expo --exclude dist \
  --exclude apps/mobile/android --exclude apps/mobile/ios \
  /src/ /work/

cd /work
echo "==> Installing dependencies"
npx --yes pnpm@9.15.4 install --frozen-lockfile --ignore-scripts

cd apps/mobile
echo "==> Generating the Android project (server: $API_URL)"
EXPO_PUBLIC_API_URL="$API_URL" npx expo prebuild --platform android --no-install --clean

cd android
echo "==> Building the release APK ($ABIS)"
EXPO_PUBLIC_API_URL="$API_URL" ./gradlew assembleRelease --no-daemon \
  "-PreactNativeArchitectures=$ABIS" \
  "-Dorg.gradle.jvmargs=-Xmx4g -XX:MaxMetaspaceSize=1g"

mkdir -p /out
cp app/build/outputs/apk/release/app-release.apk /out/YourTime.apk
ls -lh /out/YourTime.apk
