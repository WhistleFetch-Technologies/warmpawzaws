# Capacitor Setup Guide
## Step-by-Step Implementation for APK/IPA Generation

**Date:** January 2025  
**Estimated Time:** 2-3 weeks  
**Difficulty:** Medium

---

## Prerequisites

- Node.js 18+ installed
- Android Studio installed (for Android builds)
- Xcode installed (for iOS builds, macOS only)
- Java JDK 11+ installed
- CocoaPods installed (for iOS, macOS only)

---

## Step 1: Install Capacitor (Day 1)

### 1.1 Install Capacitor CLI and Core
```bash
npm install @capacitor/core @capacitor/cli --save-dev
```

### 1.2 Install Platform Packages
```bash
npm install @capacitor/android @capacitor/ios --save-dev
```

### 1.3 Initialize Capacitor
```bash
npx cap init
```

**Prompts:**
- **App name:** `Warmpawz Customer` (or `Warmpawz Vendor`)
- **App ID:** `com.warmpawz.customer` (or `com.warmpawz.vendor`)
- **Web dir:** `build`

This creates `capacitor.config.ts`

---

## Step 2: Configure Capacitor (Day 1)

### 2.1 Update capacitor.config.ts
```typescript
import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.warmpawz.customer', // Change for vendor app
  appName: 'Warmpawz Customer',
  webDir: 'build',
  server: {
    androidScheme: 'https',
    iosScheme: 'https'
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#FF8C42',
      showSpinner: true,
      spinnerColor: '#FFFFFF'
    },
    StatusBar: {
      style: 'dark',
      backgroundColor: '#FF8C42'
    }
  },
  android: {
    buildOptions: {
      keystorePath: undefined,
      keystorePassword: undefined,
      keystoreAlias: undefined,
      keystoreAliasPassword: undefined
    }
  },
  ios: {
    scheme: 'Warmpawz Customer'
  }
};

export default config;
```

### 2.2 Update vite.config.ts
```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'build', // Must match capacitor webDir
    emptyOutDir: true
  },
  // ... rest of config
});
```

---

## Step 3: Add Native Platforms (Day 1)

### 3.1 Add Android Platform
```bash
npx cap add android
```

### 3.2 Add iOS Platform (macOS only)
```bash
npx cap add ios
```

This creates:
- `android/` directory with Android project
- `ios/` directory with iOS project

---

## Step 4: Install Native Plugins (Day 2)

### 4.1 Core Plugins
```bash
npm install @capacitor/app
npm install @capacitor/haptics
npm install @capacitor/keyboard
npm install @capacitor/status-bar
npm install @capacitor/splash-screen
```

### 4.2 Feature Plugins
```bash
npm install @capacitor/camera
npm install @capacitor/geolocation
npm install @capacitor/push-notifications
npm install @capacitor/local-notifications
npm install @capacitor/filesystem
npm install @capacitor/share
npm install @capacitor/network
npm install @capacitor/device
```

### 4.3 Sync Plugins
```bash
npx cap sync
```

---

## Step 5: Configure Android (Day 2-3)

### 5.1 Update AndroidManifest.xml
```xml
<!-- android/app/src/main/AndroidManifest.xml -->
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.CAMERA" />
    <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
    <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
    <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
    
    <application
        android:label="Warmpawz Customer"
        android:icon="@mipmap/ic_launcher"
        android:roundIcon="@mipmap/ic_launcher_round"
        android:allowBackup="true"
        android:theme="@style/AppTheme">
        
        <activity
            android:name=".MainActivity"
            android:exported="true"
            android:launchMode="singleTask"
            android:theme="@style/AppTheme"
            android:configChanges="orientation|keyboardHidden|keyboard|screenSize|locale|smallestScreenSize|screenLayout|uiMode"
            android:hardwareAccelerated="true">
            
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>
    </application>
</manifest>
```

### 5.2 Update build.gradle (App Level)
```gradle
// android/app/build.gradle
android {
    namespace "com.warmpawz.customer"
    compileSdkVersion 34
    
    defaultConfig {
        applicationId "com.warmpawz.customer"
        minSdkVersion 24
        targetSdkVersion 34
        versionCode 1
        versionName "1.0.0"
    }
    
    buildTypes {
        release {
            minifyEnabled true
            proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
            signingConfig signingConfigs.release
        }
    }
    
    signingConfigs {
        release {
            storeFile file('keystore.jks')
            storePassword System.getenv("KEYSTORE_PASSWORD")
            keyAlias System.getenv("KEY_ALIAS")
            keyPassword System.getenv("KEY_PASSWORD")
        }
    }
}
```

### 5.3 Create Keystore (for Release Builds)
```bash
keytool -genkey -v -keystore android/app/keystore.jks \
  -keyalg RSA -keysize 2048 -validity 10000 \
  -alias warmpawz-customer
```

**Store credentials securely!**

---

## Step 6: Configure iOS (Day 3-4, macOS only)

### 6.1 Update Info.plist
```xml
<!-- ios/App/App/Info.plist -->
<key>NSCameraUsageDescription</key>
<string>We need access to your camera to take photos for pet profiles and service updates.</string>

<key>NSLocationWhenInUseUsageDescription</key>
<string>We need your location to find nearby services and track deliveries.</string>

<key>NSLocationAlwaysUsageDescription</key>
<string>We need your location to track deliveries in real-time.</string>

<key>NSPhotoLibraryUsageDescription</key>
<string>We need access to your photo library to upload pet photos.</string>

<key>NSUserNotificationsUsageDescription</key>
<string>We send notifications about your bookings and orders.</string>
```

### 6.2 Update Podfile
```ruby
# ios/App/Podfile
platform :ios, '13.0'
use_frameworks!

target 'App' do
  capacitor_pods
  # Add any additional pods here
end
```

### 6.3 Install Pods
```bash
cd ios/App
pod install
cd ../..
```

---

## Step 7: Add Build Scripts (Day 4)

### 7.1 Update package.json
```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "build:android": "npm run build && npx cap sync android",
    "build:ios": "npm run build && npx cap sync ios",
    "build:android:release": "npm run build:android && cd android && ./gradlew assembleRelease",
    "build:android:bundle": "npm run build:android && cd android && ./gradlew bundleRelease",
    "open:android": "npx cap open android",
    "open:ios": "npx cap open ios",
    "sync": "npx cap sync",
    "sync:android": "npx cap sync android",
    "sync:ios": "npx cap sync ios"
  }
}
```

---

## Step 8: Create App Icons & Splash Screens (Day 5)

### 8.1 Android Icons
- Use Android Asset Studio or generate manually
- Place in `android/app/src/main/res/mipmap-*/`
- Sizes: mdpi, hdpi, xhdpi, xxhdpi, xxxhdpi

### 8.2 iOS Icons
- Use Xcode Asset Catalog
- Place in `ios/App/App/Assets.xcassets/AppIcon.appiconset/`
- All required sizes

### 8.3 Splash Screens
- Android: `android/app/src/main/res/drawable/splash.xml`
- iOS: Configure in Xcode or use Capacitor Splash Screen plugin

---

## Step 9: Test on Devices (Day 6-7)

### 9.1 Android Testing
```bash
# Build and sync
npm run build:android

# Open in Android Studio
npm run open:android

# Run on device/emulator from Android Studio
```

### 9.2 iOS Testing
```bash
# Build and sync
npm run build:ios

# Open in Xcode
npm run open:ios

# Run on device/simulator from Xcode
```

---

## Step 10: Generate Release Builds (Day 8-10)

### 10.1 Android APK
```bash
# Generate signed APK
npm run build:android:release

# APK location: android/app/build/outputs/apk/release/app-release.apk
```

### 10.2 Android AAB (for Play Store)
```bash
# Generate signed AAB
npm run build:android:bundle

# AAB location: android/app/build/outputs/bundle/release/app-release.aab
```

### 10.3 iOS IPA
```bash
# Build in Xcode
# 1. Open project: npm run open:ios
# 2. Select "Any iOS Device" or specific device
# 3. Product > Archive
# 4. Distribute App > App Store Connect
# 5. Follow prompts to generate IPA
```

---

## Step 11: Separate Customer & Vendor Apps

### 11.1 Create Separate Configurations

**Option A: Separate Capacitor Projects**
```bash
# Customer app
cd apps/customer-mobile
npx cap init "Warmpawz Customer" "com.warmpawz.customer" --web-dir="../../build"

# Vendor app
cd apps/vendor-mobile
npx cap init "Warmpawz Vendor" "com.warmpawz.vendor" --web-dir="../../build"
```

**Option B: Build Variants (Single Project)**
- Use different build variants in Android
- Use different schemes in iOS
- More complex but single codebase

### 11.2 Recommended: Separate Projects
- Easier to manage
- Separate app store listings
- Independent versioning
- Clear separation

---

## Step 12: Environment Configuration

### 12.1 Create .env files
```bash
# .env.customer
VITE_APP_NAME=Warmpawz Customer
VITE_APP_ID=com.warmpawz.customer
VITE_API_URL=https://api.warmpawz.com

# .env.vendor
VITE_APP_NAME=Warmpawz Vendor
VITE_APP_ID=com.warmpawz.vendor
VITE_API_URL=https://api.warmpawz.com
```

### 12.2 Update capacitor.config.ts to use env
```typescript
import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: import.meta.env.VITE_APP_ID || 'com.warmpawz.customer',
  appName: import.meta.env.VITE_APP_NAME || 'Warmpawz Customer',
  webDir: 'build',
  // ... rest
};
```

---

## Common Issues & Solutions

### Issue 1: Build Fails - Missing Dependencies
**Solution:**
```bash
npm install
npx cap sync
```

### Issue 2: Android Build - Gradle Errors
**Solution:**
- Update `android/gradle/wrapper/gradle-wrapper.properties`
- Update Android SDK versions
- Clean build: `cd android && ./gradlew clean`

### Issue 3: iOS Build - Pod Errors
**Solution:**
```bash
cd ios/App
pod deintegrate
pod install
cd ../..
```

### Issue 4: Capacitor Sync Fails
**Solution:**
- Ensure `build/` directory exists
- Run `npm run build` first
- Check `capacitor.config.ts` webDir matches build output

---

## Testing Checklist

### Android
- [ ] App installs on device
- [ ] App launches successfully
- [ ] Camera access works
- [ ] Location access works
- [ ] Push notifications work
- [ ] Deep linking works
- [ ] Back button behavior correct
- [ ] App icons display correctly
- [ ] Splash screen shows

### iOS
- [ ] App installs on device
- [ ] App launches successfully
- [ ] Camera access works
- [ ] Location access works
- [ ] Push notifications work
- [ ] Deep linking works
- [ ] App icons display correctly
- [ ] Splash screen shows
- [ ] Status bar styling correct

---

## Deployment Checklist

### Google Play Store
- [ ] Create Google Play Console account
- [ ] Create app listing
- [ ] Generate signed AAB
- [ ] Upload AAB to Play Console
- [ ] Complete store listing
- [ ] Submit for review

### Apple App Store
- [ ] Create Apple Developer account
- [ ] Create app in App Store Connect
- [ ] Generate IPA
- [ ] Upload IPA via Xcode or Transporter
- [ ] Complete store listing
- [ ] Submit for review

---

## Estimated Timeline

- **Day 1:** Setup and configuration
- **Day 2-3:** Android configuration
- **Day 3-4:** iOS configuration
- **Day 5:** Assets and icons
- **Day 6-7:** Testing
- **Day 8-10:** Release builds
- **Day 11-14:** App store submission

**Total:** 2-3 weeks

---

## Next Steps

1. ✅ Install Capacitor
2. ✅ Configure platforms
3. ✅ Add native plugins
4. ✅ Test on devices
5. ✅ Generate release builds
6. ✅ Submit to app stores

---

**Guide Created:** January 2025  
**Status:** Ready for Implementation

