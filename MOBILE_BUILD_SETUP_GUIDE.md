# 📱 Mobile Build Setup Guide
## Android & iOS Build Configuration

**Date:** January 2, 2026  
**Status:** Setup Instructions  
**Platforms:** Android, iOS

---

## 🎯 QUICK START

### For Android Builds (Required)

1. **Install Android Studio** (includes Android SDK)
2. **Set environment variables**
3. **Create `local.properties` files**
4. **Run build tests**

---

## 1️⃣ ANDROID SDK INSTALLATION

### Option 1: Install Android Studio (Recommended)

**macOS:**
```bash
# Download from: https://developer.android.com/studio
# Or via Homebrew:
brew install --cask android-studio
```

**After Installation:**
1. Open Android Studio
2. Go through first-time setup wizard
3. SDK will be installed to: `~/Library/Android/sdk` (macOS)

### Option 2: Install Standalone SDK (Command Line Only)

```bash
# Download command-line tools
cd ~
mkdir -p Android/Sdk
cd Android/Sdk

# Download SDK tools (replace URL with latest)
curl -O https://dl.google.com/android/repository/commandlinetools-mac-11076708_latest.zip
unzip commandlinetools-mac-11076708_latest.zip
mkdir -p cmdline-tools/latest
mv cmdline-tools/* cmdline-tools/latest/ 2>/dev/null || true

# Set environment variable
export ANDROID_HOME=$HOME/Android/Sdk
export PATH=$PATH:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools

# Accept licenses and install required packages
yes | sdkmanager --licenses
sdkmanager "platform-tools" "platforms;android-34" "build-tools;34.0.0"
```

---

## 2️⃣ ENVIRONMENT VARIABLES SETUP

### macOS (zsh)

Add to `~/.zshrc`:
```bash
# Android SDK
export ANDROID_HOME=$HOME/Library/Android/sdk
# OR if using standalone: export ANDROID_HOME=$HOME/Android/Sdk

export PATH=$PATH:$ANDROID_HOME/emulator
export PATH=$PATH:$ANDROID_HOME/platform-tools
export PATH=$PATH:$ANDROID_HOME/tools
export PATH=$PATH:$ANDROID_HOME/tools/bin
export PATH=$PATH:$ANDROID_HOME/cmdline-tools/latest/bin
```

**Apply changes:**
```bash
source ~/.zshrc
```

### macOS (bash)

Add to `~/.bash_profile`:
```bash
# Android SDK
export ANDROID_HOME=$HOME/Library/Android/sdk
export PATH=$PATH:$ANDROID_HOME/emulator
export PATH=$PATH:$ANDROID_HOME/platform-tools
export PATH=$PATH:$ANDROID_HOME/tools
export PATH=$PATH:$ANDROID_HOME/tools/bin
```

**Apply changes:**
```bash
source ~/.bash_profile
```

---

## 3️⃣ CREATE LOCAL.PROPERTIES FILES

### Automated Setup Script

Run this script to create `local.properties` files:

```bash
# Set Android SDK path (adjust if different)
ANDROID_SDK_PATH="$HOME/Library/Android/sdk"

# Create local.properties for Customer app
echo "sdk.dir=$ANDROID_SDK_PATH" > apps/WarmpawzCustomer/android/local.properties

# Create local.properties for Vendor app
echo "sdk.dir=$ANDROID_SDK_PATH" > apps/WarmpawzVendor/android/local.properties

echo "✅ Created local.properties files"
echo "   Customer: apps/WarmpawzCustomer/android/local.properties"
echo "   Vendor: apps/WarmpawzVendor/android/local.properties"
```

### Manual Setup

**Customer App:**
```bash
echo "sdk.dir=$HOME/Library/Android/sdk" > apps/WarmpawzCustomer/android/local.properties
```

**Vendor App:**
```bash
echo "sdk.dir=$HOME/Library/Android/sdk" > apps/WarmpawzVendor/android/local.properties
```

**Note:** Replace `$HOME/Library/Android/sdk` with your actual SDK path if different.

---

## 4️⃣ VERIFY SETUP

### Check Android SDK Installation

```bash
# Check ANDROID_HOME is set
echo $ANDROID_HOME

# Check adb (Android Debug Bridge)
adb --version

# Check SDK location
ls $ANDROID_HOME/platforms
ls $ANDROID_HOME/build-tools
```

### Verify local.properties Files

```bash
# Check Customer app
cat apps/WarmpawzCustomer/android/local.properties

# Check Vendor app
cat apps/WarmpawzVendor/android/local.properties
```

**Expected output:**
```
sdk.dir=/Users/YOUR_USERNAME/Library/Android/sdk
```

---

## 5️⃣ TEST ANDROID BUILDS

### Customer App

```bash
cd apps/WarmpawzCustomer/android
chmod +x gradlew
./gradlew assembleDevRelease --no-daemon
```

**Expected output:**
- Build should complete successfully
- APK will be in: `app/build/outputs/apk/dev/release/`

### Vendor App

```bash
cd apps/WarmpawzVendor/android
chmod +x gradlew
./gradlew assembleDevRelease --no-daemon
```

**Expected output:**
- Build should complete successfully
- APK will be in: `app/build/outputs/apk/dev/release/`

---

## 6️⃣ TROUBLESHOOTING

### Issue: "SDK location not found"

**Solution:**
1. Verify `ANDROID_HOME` is set:
   ```bash
   echo $ANDROID_HOME
   ```

2. Verify `local.properties` exists:
   ```bash
   ls apps/WarmpawzCustomer/android/local.properties
   ```

3. Check SDK path in `local.properties`:
   ```bash
   cat apps/WarmpawzCustomer/android/local.properties
   ```

4. Verify SDK directory exists:
   ```bash
   ls -la $ANDROID_HOME
   ```

### Issue: "Build tools not found"

**Solution:**
```bash
# Install build tools
sdkmanager "build-tools;34.0.0"

# Or via Android Studio:
# Tools → SDK Manager → SDK Tools → Android SDK Build-Tools
```

### Issue: "Platform not found"

**Solution:**
```bash
# Install Android platform
sdkmanager "platforms;android-34"

# Or via Android Studio:
# Tools → SDK Manager → SDK Platforms → Android 14.0 (API 34)
```

### Issue: "License not accepted"

**Solution:**
```bash
# Accept all licenses
yes | sdkmanager --licenses
```

---

## 7️⃣ REQUIRED SDK COMPONENTS

### Minimum Required

- **Android SDK Platform:** API Level 34 (Android 14.0)
- **Android SDK Build-Tools:** 34.0.0
- **Android SDK Platform-Tools:** Latest
- **Android Emulator:** (Optional, for testing)

### Install via Command Line

```bash
sdkmanager "platform-tools"
sdkmanager "platforms;android-34"
sdkmanager "build-tools;34.0.0"
sdkmanager "emulator"  # Optional
```

### Install via Android Studio

1. Open Android Studio
2. **Tools → SDK Manager**
3. **SDK Platforms tab:**
   - ✅ Android 14.0 (API Level 34)
   - ✅ Android 13.0 (API Level 33) - Optional
4. **SDK Tools tab:**
   - ✅ Android SDK Build-Tools 34.0.0
   - ✅ Android SDK Platform-Tools
   - ✅ Android Emulator (Optional)
5. Click **Apply** and wait for installation

---

## 8️⃣ BUILD FLAVORS

### Available Build Flavors

Both apps support multiple build flavors:

- **dev** - Development build (API: `https://dev.api.warmpawz.com`)
- **staging** - Staging build (API: `https://staging.api.warmpawz.com`)
- **production** - Production build (API: `https://api.warmpawz.com`)

### Build Commands

**Development:**
```bash
./gradlew assembleDevRelease
```

**Staging:**
```bash
./gradlew assembleStagingRelease
```

**Production:**
```bash
./gradlew assembleProductionRelease
```

**Debug (all flavors):**
```bash
./gradlew assembleDevDebug
./gradlew assembleStagingDebug
./gradlew assembleProductionDebug
```

---

## 9️⃣ CI/CD BUILD SETUP

The GitHub Actions workflows automatically set up Android SDK:

**File:** `.github/workflows/mobile-build-android.yml`

**Key Steps:**
1. ✅ Sets up Java 17
2. ✅ Sets up Node.js 18
3. ✅ Installs dependencies
4. ✅ Sets up Android SDK (via `android-actions/setup-android@v3`)
5. ✅ Builds APK
6. ✅ Signs APK (for release builds)
7. ✅ Uploads to S3

**No manual setup required for CI/CD** - it's automated!

---

## 🔟 NEXT STEPS AFTER SETUP

1. **✅ Verify Setup:**
   ```bash
   ./scripts/setup-android-sdk.sh  # If script exists
   ```

2. **✅ Test Customer App Build:**
   ```bash
   cd apps/WarmpawzCustomer/android
   ./gradlew assembleDevRelease
   ```

3. **✅ Test Vendor App Build:**
   ```bash
   cd apps/WarmpawzVendor/android
   ./gradlew assembleDevRelease
   ```

4. **✅ Check Build Outputs:**
   ```bash
   find apps -name "*.apk" -type f
   ```

5. **✅ Update Build Test Results:**
   - Document successful builds
   - Note any warnings or issues
   - Update `BUILD_TEST_RESULTS.md`

---

## 📝 QUICK REFERENCE

### Common Commands

```bash
# Check Android SDK
echo $ANDROID_HOME
adb --version

# Create local.properties
echo "sdk.dir=$ANDROID_HOME" > apps/WarmpawzCustomer/android/local.properties
echo "sdk.dir=$ANDROID_HOME" > apps/WarmpawzVendor/android/local.properties

# Build Customer app
cd apps/WarmpawzCustomer/android && ./gradlew assembleDevRelease

# Build Vendor app
cd apps/WarmpawzVendor/android && ./gradlew assembleDevRelease

# Clean build
./gradlew clean

# List all build tasks
./gradlew tasks
```

---

## ✅ SETUP CHECKLIST

- [ ] Android Studio installed (or standalone SDK)
- [ ] `ANDROID_HOME` environment variable set
- [ ] Android SDK Platform 34 installed
- [ ] Android SDK Build-Tools 34.0.0 installed
- [ ] `local.properties` created for Customer app
- [ ] `local.properties` created for Vendor app
- [ ] Licenses accepted (`yes | sdkmanager --licenses`)
- [ ] Customer app builds successfully
- [ ] Vendor app builds successfully

---

**Status:** ⚠️ **SETUP REQUIRED**  
**Next Action:** Install Android SDK and create `local.properties` files
