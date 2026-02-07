# 📱 QA LOCAL TESTING GUIDE - WARMPAWZ MOBILE APPS

**For:** QA Team  
**Date:** January 3, 2026  
**Apps:** Customer Mobile + Vendor Mobile  
**Platforms:** Android & iOS

---

## ⚠️ IMPORTANT: READ FIRST

Both mobile apps are **React Native 0.73** applications that require:
- ✅ Native build tools (Android Studio / Xcode)
- ✅ Node.js environment
- ✅ Simulator/Emulator or physical devices
- ⚙️ **Estimated Setup Time:** 1-2 hours (first time)

---

## 📋 PART 1: SYSTEM REQUIREMENTS

### A. Operating System Requirements

| Feature | macOS | Windows | Linux |
|---------|-------|---------|-------|
| **Customer Android** | ✅ | ✅ | ✅ |
| **Customer iOS** | ✅ (Xcode required) | ❌ | ❌ |
| **Vendor Android** | ✅ | ✅ | ✅ |
| **Vendor iOS** | ✅ (Xcode required) | ❌ | ❌ |

**Note:** iOS apps can ONLY be built on macOS with Xcode.

---

### B. Required Software Dependencies

#### B1. Core Requirements (All Platforms)

| Software | Version | Required For | Download Link |
|----------|---------|-------------|---------------|
| **Node.js** | v18.x or v20.x | Both apps | https://nodejs.org |
| **npm** | 9.x+ (comes with Node) | Package management | - |
| **Git** | Any recent | Clone repo | https://git-scm.com |
| **Watchman** | Latest | Metro bundler (macOS/Linux) | https://facebook.github.io/watchman |

**Check Current Versions:**
```bash
node --version    # Should show v18.x or v20.x
npm --version     # Should show 9.x+
git --version
watchman --version  # macOS/Linux only
```

---

#### B2. Android Requirements (All Platforms)

| Software | Version | Purpose | Download |
|----------|---------|---------|----------|
| **JDK (Java)** | 11 or 17 | Build Android app | https://adoptium.net |
| **Android Studio** | Latest (2024.x) | IDE + SDK + Emulator | https://developer.android.com/studio |
| **Android SDK** | API Level 34 | Target SDK | Via Android Studio |
| **Android Build Tools** | 34.0.0 | Build tools | Via Android Studio |
| **Android Emulator** | Latest | Testing | Via Android Studio |

**Check Java Version:**
```bash
java -version
# Should show: openjdk version "11" or "17"
```

---

#### B3. iOS Requirements (macOS ONLY)

| Software | Version | Purpose | Download |
|----------|---------|---------|----------|
| **Xcode** | 15.x+ | IDE + iOS SDK + Simulator | Mac App Store |
| **CocoaPods** | 1.12+ | iOS dependency manager | `sudo gem install cocoapods` |
| **Command Line Tools** | Latest | Build tools | `xcode-select --install` |

**Check Versions:**
```bash
xcodebuild -version
# Should show: Xcode 15.x

pod --version
# Should show: 1.12.x+
```

---

## 🚀 PART 2: ENVIRONMENT SETUP (ONE-TIME)

### Step 1: Install Node.js

**macOS (using Homebrew):**
```bash
# Install Homebrew if not installed
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install Node.js 20
brew install node@20
node --version
```

**Windows:**
```bash
# Download and install from: https://nodejs.org/en/download/
# Choose: LTS version (20.x)
# Verify installation:
node --version
npm --version
```

**Linux (Ubuntu/Debian):**
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
node --version
```

---

### Step 2: Install Java JDK (for Android)

**macOS:**
```bash
brew install openjdk@17
sudo ln -sfn /opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk /Library/Java/JavaVirtualMachines/openjdk-17.jdk
java -version
```

**Windows:**
```bash
# Download from: https://adoptium.net/temurin/releases/?version=17
# Install the MSI installer
# Add JAVA_HOME to environment variables:
# JAVA_HOME=C:\Program Files\Eclipse Adoptium\jdk-17.x.x.x-hotspot
```

**Linux:**
```bash
sudo apt update
sudo apt install openjdk-17-jdk
java -version
```

---

### Step 3: Install Android Studio

1. **Download Android Studio:**
   - Visit: https://developer.android.com/studio
   - Download latest version
   - Install (accept all defaults)

2. **First Launch Setup:**
   ```
   ✅ Choose "Standard" installation
   ✅ Accept all licenses
   ✅ Wait for downloads to complete (~2GB)
   ```

3. **Install Required SDKs:**
   ```
   Open Android Studio
   → More Actions → SDK Manager
   → SDK Platforms tab:
      ✅ Android 14.0 (API Level 34)
      ✅ Android 13.0 (API Level 33)
   → SDK Tools tab:
      ✅ Android SDK Build-Tools 34.0.0
      ✅ Android Emulator
      ✅ Android SDK Platform-Tools
      ✅ Intel x86 Emulator Accelerator (HAXM) [Windows/macOS Intel]
   → Apply → OK
   ```

4. **Set Environment Variables:**

**macOS/Linux (add to `~/.zshrc` or `~/.bashrc`):**
```bash
export ANDROID_HOME=$HOME/Library/Android/sdk  # macOS
# OR
export ANDROID_HOME=$HOME/Android/Sdk  # Linux

export PATH=$PATH:$ANDROID_HOME/emulator
export PATH=$PATH:$ANDROID_HOME/platform-tools
export PATH=$PATH:$ANDROID_HOME/tools
export PATH=$PATH:$ANDROID_HOME/tools/bin
```

**Windows (System Environment Variables):**
```
ANDROID_HOME=C:\Users\YOUR_USERNAME\AppData\Local\Android\Sdk
Path=%Path%;%ANDROID_HOME%\platform-tools
Path=%Path%;%ANDROID_HOME%\emulator
Path=%Path%;%ANDROID_HOME%\tools
Path=%Path%;%ANDROID_HOME%\tools\bin
```

5. **Verify Setup:**
```bash
# Restart terminal, then:
adb --version
# Should show: Android Debug Bridge version x.x.x
```

---

### Step 4: Install Xcode (macOS ONLY - for iOS)

1. **Install Xcode:**
   ```bash
   # Open Mac App Store
   # Search "Xcode"
   # Click Install (12+ GB download)
   ```

2. **Install Command Line Tools:**
   ```bash
   xcode-select --install
   sudo xcodebuild -license accept
   ```

3. **Install CocoaPods:**
   ```bash
   sudo gem install cocoapods
   pod --version
   ```

4. **Configure Simulator:**
   ```bash
   # Open Xcode
   # Xcode → Settings → Platforms
   # Download iOS 17.x Simulator
   ```

---

### Step 5: Install Watchman (macOS/Linux)

**macOS:**
```bash
brew install watchman
watchman --version
```

**Linux:**
```bash
# Follow: https://facebook.github.io/watchman/docs/install#linux
```

---

## 📦 PART 3: PROJECT SETUP

### Step 1: Clone Repository

```bash
cd ~/Desktop  # or any preferred directory
git clone https://github.com/ketan0103/warmpawzaws.git
cd warmpawzaws
```

---

### Step 2: Setup Customer Mobile App

```bash
cd apps/WarmpawzCustomer

# Install dependencies
npm install

# iOS only (macOS):
cd ios && pod install && cd ..

# Verify installation
ls -la node_modules/@react-native  # Should show installed packages
```

**Expected Output:**
```
✅ 300+ packages installed
✅ No errors
⚠️ Warnings about peer dependencies are OK
```

---

### Step 3: Setup Vendor Mobile App

```bash
cd ../WarmpawzVendor

# Install dependencies
npm install

# iOS only (macOS):
cd ios && pod install && cd ..
```

---

## 🏃 PART 4: RUNNING THE APPS

### Option A: Android (Emulator)

#### 1. Create Android Emulator (First Time)

```bash
# Open Android Studio
# More Actions → Virtual Device Manager → Create Device

# Recommended settings:
Phone: Pixel 6 Pro
System Image: Android 14 (API 34) - x86_64
RAM: 2048 MB (or more)
Internal Storage: 2048 MB

# Click Finish
```

#### 2. Start Emulator

```bash
# Method 1: From Android Studio
# Virtual Device Manager → Click ▶️ (Play button)

# Method 2: From Terminal
emulator -list-avds
# Shows: Pixel_6_Pro_API_34 (or your emulator name)

emulator -avd Pixel_6_Pro_API_34
# Emulator window opens
```

#### 3. Run Customer App on Android

**Terminal 1 (Metro Bundler):**
```bash
cd apps/WarmpawzCustomer
npm start
# Wait for "Metro waiting on port 8081"
```

**Terminal 2 (Build & Install):**
```bash
cd apps/WarmpawzCustomer
npm run android
# OR
npx react-native run-android
```

**Expected Output:**
```
✅ BUILD SUCCESSFUL in 2m 30s
✅ Installing APK...
✅ Starting app on Pixel_6_Pro_API_34
✅ App launched
```

#### 4. Run Vendor App on Android

**Terminal 1:**
```bash
cd apps/WarmpawzVendor
npm start
```

**Terminal 2:**
```bash
cd apps/WarmpawzVendor
npm run android
```

---

### Option B: iOS (Simulator) - macOS ONLY

#### 1. Run Customer App on iOS

**Terminal 1 (Metro Bundler):**
```bash
cd apps/WarmpawzCustomer
npm start
```

**Terminal 2 (Build & Run):**
```bash
cd apps/WarmpawzCustomer
npm run ios
# OR
npx react-native run-ios
```

**Expected Output:**
```
✅ Build succeeded
✅ Installing on iPhone 15 Pro
✅ Launching app
```

#### 2. Run Vendor App on iOS

```bash
cd apps/WarmpawzVendor
npm start  # Terminal 1
npm run ios  # Terminal 2
```

---

### Option C: Physical Device

#### Android Physical Device:

1. **Enable Developer Mode:**
   ```
   Settings → About Phone → Tap "Build Number" 7 times
   Settings → Developer Options → Enable "USB Debugging"
   ```

2. **Connect via USB:**
   ```bash
   adb devices
   # Should show: device_id    device
   ```

3. **Run App:**
   ```bash
   cd apps/WarmpawzCustomer
   npm run android
   ```

#### iOS Physical Device (macOS):

1. **Trust Device:**
   ```
   Connect iPhone via USB
   iPhone: Trust This Computer
   ```

2. **Configure Xcode:**
   ```bash
   cd apps/WarmpawzCustomer/ios
   open WarmpawzCustomer.xcworkspace
   
   # In Xcode:
   # 1. Select project
   # 2. Signing & Capabilities → Select your Team
   # 3. Connect iPhone
   # 4. Select iPhone as target
   # 5. Click ▶️ (Run)
   ```

---

## 🔧 PART 5: CONFIGURATION FOR TESTING

### Step 1: Configure API Base URL

Both apps point to the API server. For local testing:

**Customer App:**
```typescript
// File: apps/WarmpawzCustomer/src/lib/api-client.ts
// Line 34-36

const API_BASE_URL = __DEV__ 
  ? 'http://localhost:3000'        // For local backend
  : 'https://api.warmpawz.com';    // For production backend
```

**Vendor App:**
```typescript
// File: apps/WarmpawzVendor/src/lib/api-client.ts
// Line 34-36

const API_BASE_URL = __DEV__ 
  ? 'http://localhost:3000'        // For local backend
  : 'https://api.warmpawz.com';    // For production backend
```

**For Testing Against Production API:**
No changes needed - apps automatically use production URL in release builds.

**For Testing Against Local Backend:**
```bash
# Start local backend first
cd backend/lambda
npm run dev  # Runs on port 3000

# Then run mobile app (will connect to localhost:3000)
```

---

### Step 2: Enable UAT Mode (Vendor App)

For testing with OTP bypass (123456):

**Backend must have UAT_MODE enabled:**
```bash
# In backend/.env
UAT_MODE=true
```

Then restart backend. Now Vendor app can use OTP `123456` for login.

---

## 🧪 PART 6: TESTING CHECKLIST

### A. Customer App Testing

| Feature | Test Case | Screen | Expected Result |
|---------|-----------|--------|----------------|
| **Auth** | Login with OTP | `CustomerAuthScreen` | Shows OTP screen → Dashboard |
| **Discovery** | Search vendors | `ServiceDiscoveryScreen` | Shows list of vendors |
| **Booking** | Create booking | `BookingCreationScreen` | Creates booking → Confirmation |
| **Payment** | Make payment | `PaymentScreen` | Opens Razorpay → Success |
| **Tracking** | GPS tracking | `GPSTrackingScreen` | Shows live location |
| **Offline** | Turn off WiFi | Any screen | Shows offline banner |

### B. Vendor App Testing

| Feature | Test Case | Screen | Expected Result |
|---------|-----------|--------|----------------|
| **Auth** | Login with OTP | `VendorAuthScreen` | Shows OTP screen |
| **Onboarding** | Select role | `VendorRoleSelectionScreen` | Shows 20 roles |
| **Form** | Fill onboarding | `VendorOnboardingScreen` | Dynamic form loads |
| **Dashboard** | View stats | `VendorDashboardScreen` | Shows bookings |
| **Booking** | Accept booking | `BookingActionsScreen` | Status changes |
| **GPS** | Start tracking | `GPSTrackingScreen` | Location updates |

---

## 🐛 PART 7: TROUBLESHOOTING

### Common Issue #1: Metro Bundler Port Conflict

**Error:** "Port 8081 already in use"

**Solution:**
```bash
# Kill existing Metro process
lsof -ti:8081 | xargs kill -9

# Or use different port
npm start -- --port 8082
```

---

### Common Issue #2: Android Build Failed

**Error:** "Could not find or load main class org.gradle.wrapper.GradleWrapperMain"

**Solution:**
```bash
cd apps/WarmpawzCustomer/android
./gradlew clean
cd ..
npm run android
```

---

### Common Issue #3: iOS Build Failed

**Error:** "No bundle URL present"

**Solution:**
```bash
# Clean build
cd apps/WarmpawzCustomer/ios
rm -rf build
pod deintegrate
pod install
cd ..
npm start -- --reset-cache
npm run ios
```

---

### Common Issue #4: ANDROID_HOME not found

**Error:** "SDK location not found"

**Solution:**
```bash
# Create local.properties
cd apps/WarmpawzCustomer/android
echo "sdk.dir=/Users/YOUR_USERNAME/Library/Android/sdk" > local.properties
# Replace path with your actual Android SDK path
```

---

### Common Issue #5: App crashes on launch

**Solution:**
```bash
# Clear app data
adb shell pm clear com.warmpawzcustomer  # Customer app
adb shell pm clear com.warmpawzvendor    # Vendor app

# Reinstall
npm run android
```

---

## 📊 PART 8: BUILD VERIFICATION

After successful build, verify:

### ✅ Customer App Checklist
```bash
□ App launches without crash
□ Auth screen visible
□ Can enter phone number
□ Navigation bar visible at bottom
□ No console errors (check Metro logs)
□ Can navigate between tabs
```

### ✅ Vendor App Checklist
```bash
□ App launches without crash
□ Auth screen visible
□ Branded gradient background shows
□ Can enter phone number
□ Logo displays correctly
□ No console errors (check Metro logs)
```

---

## 🎯 PART 9: QUICK START COMMANDS

### For Daily Testing (After Initial Setup)

**Customer Android:**
```bash
cd apps/WarmpawzCustomer
npm start  # Terminal 1
npm run android  # Terminal 2 (after Metro ready)
```

**Customer iOS:**
```bash
cd apps/WarmpawzCustomer
npm start  # Terminal 1
npm run ios  # Terminal 2 (after Metro ready)
```

**Vendor Android:**
```bash
cd apps/WarmpawzVendor
npm start  # Terminal 1
npm run android  # Terminal 2
```

**Vendor iOS:**
```bash
cd apps/WarmpawzVendor
npm start  # Terminal 1
npm run ios  # Terminal 2
```

---

## 📞 PART 10: QA SUPPORT

### Useful Commands

**View Metro logs:**
```bash
# Already visible in Terminal 1 where you ran `npm start`
```

**View device logs:**
```bash
# Android
adb logcat | grep "ReactNativeJS"

# iOS
xcrun simctl spawn booted log stream --predicate 'processImagePath endswith "WarmpawzCustomer"'
```

**Reload app:**
```bash
# Android: Press R twice (RR) in Metro terminal
# iOS: Cmd+R in simulator
```

**Open developer menu:**
```bash
# Android: Cmd+M (macOS) or Ctrl+M (Windows)
# iOS: Cmd+D
```

---

## ✅ FINAL QA READINESS CONFIRMATION

After completing setup:

| Task | Customer Android | Customer iOS | Vendor Android | Vendor iOS |
|------|-----------------|--------------|----------------|------------|
| Dependencies installed | □ | □ | □ | □ |
| App builds successfully | □ | □ | □ | □ |
| App launches | □ | □ | □ | □ |
| Can navigate screens | □ | □ | □ | □ |
| API calls work | □ | □ | □ | □ |

**When all boxes checked:** ✅ **READY FOR QA TESTING**

---

**Setup Time Estimates:**
- **First time (all tools):** 2-3 hours
- **With tools installed:** 15-30 minutes
- **Daily testing:** 2-5 minutes

**Questions?** Check troubleshooting section or reach out to the development team.

