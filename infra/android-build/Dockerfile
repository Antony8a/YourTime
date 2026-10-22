# Builds the Android APK without installing anything on the host: JDK 17, Node 20
# and the exact Android SDK pieces Expo SDK 52 (React Native 0.76) asks for.
# Used by scripts/build-apk.ps1; see docs/APK.md.
FROM eclipse-temurin:17-jdk-jammy

ENV ANDROID_HOME=/opt/android \
    ANDROID_SDK_ROOT=/opt/android \
    CI=1 \
    EXPO_NO_TELEMETRY=1 \
    PATH=/opt/android/cmdline-tools/latest/bin:/opt/android/platform-tools:$PATH

RUN apt-get update \
 && apt-get install -y --no-install-recommends curl unzip ca-certificates rsync xz-utils python3 make g++ \
 && rm -rf /var/lib/apt/lists/*

RUN curl -fsSL https://nodejs.org/dist/v20.19.1/node-v20.19.1-linux-x64.tar.xz | tar -xJ -C /usr/local --strip-components=1

RUN mkdir -p "$ANDROID_HOME/cmdline-tools" \
 && curl -fsSL -o /tmp/cmdline-tools.zip https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip \
 && unzip -q /tmp/cmdline-tools.zip -d "$ANDROID_HOME/cmdline-tools" \
 && mv "$ANDROID_HOME/cmdline-tools/cmdline-tools" "$ANDROID_HOME/cmdline-tools/latest" \
 && rm /tmp/cmdline-tools.zip

RUN yes | sdkmanager --licenses > /dev/null \
 && sdkmanager "platform-tools" "platforms;android-35" "build-tools;35.0.0" "ndk;26.1.10909125" "cmake;3.22.1"

WORKDIR /work
