#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
APP_DIR="$ROOT_DIR/android/app"
SRC_DIR="$APP_DIR/src/main"
BUILD_DIR="$ROOT_DIR/android/build"
OUTPUT_DIR="$ROOT_DIR/android/output"
mkdir -p "$BUILD_DIR" "$OUTPUT_DIR"

ANDROID_SDK="${ANDROID_SDK:-$LOCALAPPDATA/Android/Sdk}"
if [ -d "$ANDROID_SDK/build-tools/36.0.0" ]; then
  BUILD_TOOLS="$ANDROID_SDK/build-tools/36.0.0"
else
  BUILD_TOOLS="$ANDROID_SDK/build-tools/35.0.0"
fi
ANDROID_JAR="$ANDROID_SDK/platforms/android-35/android.jar"
AAPT2="$BUILD_TOOLS/aapt2.exe"
ZIPALIGN="$BUILD_TOOLS/zipalign.exe"

rm -rf "$BUILD_DIR/classes" "$BUILD_DIR/dex" "$BUILD_DIR/gen"
mkdir -p "$BUILD_DIR/classes" "$BUILD_DIR/dex" "$BUILD_DIR/gen"

"$AAPT2" compile --dir "$SRC_DIR/res" -o "$BUILD_DIR/compiled.zip"
"$AAPT2" link -o "$BUILD_DIR/app-unsigned.apk" -I "$ANDROID_JAR" \
  --manifest "$SRC_DIR/AndroidManifest.xml" \
  --java "$BUILD_DIR/gen" \
  --min-sdk-version 26 \
  --target-sdk-version 35 \
  --version-code 2 \
  --version-name 1.1.0 \
  "$BUILD_DIR/compiled.zip"

javac --release 17 -cp "$ANDROID_JAR" -d "$BUILD_DIR/classes" \
  $(find "$SRC_DIR/java" "$BUILD_DIR/gen" -name '*.java')

java -cp "$BUILD_TOOLS/lib/d8.jar" com.android.tools.r8.D8 --min-api 26 --output "$BUILD_DIR/dex" \
  $(find "$BUILD_DIR/classes" -name '*.class')

jar uf "$BUILD_DIR/app-unsigned.apk" -C "$BUILD_DIR/dex" classes.dex

"$ZIPALIGN" -f 4 "$BUILD_DIR/app-unsigned.apk" "$BUILD_DIR/app-aligned.apk"

KEYSTORE="$BUILD_DIR/debug.keystore"
if [ ! -f "$KEYSTORE" ]; then
  keytool -genkeypair -v -keystore "$KEYSTORE" -alias androiddebugkey \
    -keyalg RSA -keysize 2048 -validity 10000 \
    -storepass android -keypass android \
    -dname "CN=Android Debug,O=Android,C=US"
fi

java -jar "$BUILD_TOOLS/lib/apksigner.jar" sign \
  --ks "$KEYSTORE" \
  --ks-pass pass:android \
  --key-pass pass:android \
  --out "$OUTPUT_DIR/medqcm.apk" \
  "$BUILD_DIR/app-aligned.apk"

echo "APK prêt : $OUTPUT_DIR/medqcm.apk"
