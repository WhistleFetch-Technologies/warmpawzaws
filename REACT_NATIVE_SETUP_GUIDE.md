# React Native Setup Guide
## Complete Implementation for APK/IPA Generation

**Date:** January 2025  
**Estimated Time:** 9-12 weeks  
**Difficulty:** High (requires component migration)

---

## Overview

This guide will help you set up React Native projects for both Customer and Vendor apps, enabling you to build APK (Android) and IPA (iOS) files.

---

## Prerequisites

### Required Software
- **Node.js** 18+ 
- **React Native CLI**: `npm install -g react-native-cli`
- **Android Studio** (for Android builds)
- **Xcode** 14+ (for iOS builds, macOS only)
- **Java JDK** 11+
- **CocoaPods** (for iOS): `sudo gem install cocoapods`
- **Watchman** (optional but recommended): `brew install watchman`

### Required Accounts
- **Google Play Console** account (for Android)
- **Apple Developer** account (for iOS, $99/year)

---

## Step 1: Initialize React Native Projects (Week 1)

### 1.1 Create Customer App
```bash
cd apps
npx react-native@latest init WarmpawzCustomer --version 0.73.0
cd WarmpawzCustomer
```

### 1.2 Create Vendor App
```bash
cd apps
npx react-native@latest init WarmpawzVendor --version 0.73.0
cd WarmpawzVendor
```

### 1.3 Project Structure
```
apps/
├── WarmpawzCustomer/
│   ├── android/
│   ├── ios/
│   ├── src/
│   │   ├── components/
│   │   ├── screens/
│   │   ├── navigation/
│   │   ├── services/
│   │   └── utils/
│   ├── App.tsx
│   └── package.json
└── WarmpawzVendor/
    ├── android/
    ├── ios/
    ├── src/
    │   ├── components/
    │   ├── screens/
    │   ├── navigation/
    │   ├── services/
    │   └── utils/
    ├── App.tsx
    └── package.json
```

---

## Step 2: Install Core Dependencies (Week 1)

### 2.1 Navigation
```bash
npm install @react-navigation/native
npm install @react-navigation/native-stack
npm install @react-navigation/bottom-tabs
npm install react-native-screens
npm install react-native-safe-area-context
```

### 2.2 State Management
```bash
npm install @tanstack/react-query
npm install zustand  # or redux if preferred
```

### 2.3 UI Components
```bash
npm install react-native-paper  # Material Design components
# OR
npm install react-native-elements
npm install react-native-vector-icons
```

### 2.4 API & Networking
```bash
npm install @supabase/supabase-js
npm install axios
npm install @react-native-async-storage/async-storage
```

### 2.5 Forms & Validation
```bash
npm install react-hook-form
npm install @hookform/resolvers
npm install zod  # for validation
```

---

## Step 3: Install Native Modules (Week 1)

### 3.1 Essential Native Modules
```bash
# Camera & Media
npm install react-native-image-picker
npm install react-native-camera

# Location & Maps
npm install react-native-maps
npm install @react-native-community/geolocation

# Notifications
npm install @react-native-firebase/messaging
npm install @react-native-community/push-notification-ios

# Payments
npm install react-native-razorpay

# WebRTC (for video calls)
npm install react-native-webrtc

# File System
npm install react-native-fs

# Device Info
npm install react-native-device-info

# Permissions
npm install react-native-permissions

# Haptics & Feedback
npm install react-native-haptic-feedback
```

### 3.2 iOS Pod Installation
```bash
cd ios
pod install
cd ..
```

---

## Step 4: Configure Android (Week 2)

### 4.1 Update android/app/build.gradle
```gradle
android {
    namespace "com.warmpawzcustomer"
    compileSdkVersion 34
    
    defaultConfig {
        applicationId "com.warmpawz.customer"
        minSdkVersion 24
        targetSdkVersion 34
        versionCode 1
        versionName "1.0.0"
        multiDexEnabled true
    }
    
    buildTypes {
        release {
            minifyEnabled true
            shrinkResources true
            proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
            signingConfig signingConfigs.release
        }
    }
    
    signingConfigs {
        release {
            if (project.hasProperty('MYAPP_RELEASE_STORE_FILE')) {
                storeFile file(MYAPP_RELEASE_STORE_FILE)
                storePassword MYAPP_RELEASE_STORE_PASSWORD
                keyAlias MYAPP_RELEASE_KEY_ALIAS
                keyPassword MYAPP_RELEASE_KEY_PASSWORD
            }
        }
    }
}
```

### 4.2 Update android/app/src/main/AndroidManifest.xml
```xml
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
    
    <!-- Permissions -->
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.CAMERA" />
    <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
    <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
    <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
    <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" />
    <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" />
    <uses-permission android:name="android.permission.RECORD_AUDIO" />
    <uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS" />
    
    <application
        android:name=".MainApplication"
        android:label="@string/app_name"
        android:icon="@mipmap/ic_launcher"
        android:roundIcon="@mipmap/ic_launcher_round"
        android:allowBackup="false"
        android:theme="@style/AppTheme"
        android:usesCleartextTraffic="false">
        
        <activity
            android:name=".MainActivity"
            android:label="@string/app_name"
            android:configChanges="keyboard|keyboardHidden|orientation|screenSize|uiMode"
            android:launchMode="singleTask"
            android:windowSoftInputMode="adjustResize"
            android:exported="true">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>
    </application>
</manifest>
```

### 4.3 Create Keystore
```bash
cd android/app
keytool -genkeypair -v -storetype PKCS12 -keystore warmpawz-customer-release.keystore \
  -alias warmpawz-customer-key -keyalg RSA -keysize 2048 -validity 10000
cd ../..
```

### 4.4 Create gradle.properties
```properties
# android/gradle.properties
MYAPP_RELEASE_STORE_FILE=warmpawz-customer-release.keystore
MYAPP_RELEASE_KEY_ALIAS=warmpawz-customer-key
MYAPP_RELEASE_STORE_PASSWORD=your_store_password
MYAPP_RELEASE_KEY_PASSWORD=your_key_password
```

**⚠️ Add gradle.properties to .gitignore!**

---

## Step 5: Configure iOS (Week 2)

### 5.1 Update Info.plist
```xml
<!-- ios/WarmpawzCustomer/Info.plist -->
<key>NSCameraUsageDescription</key>
<string>We need access to your camera to take photos for pet profiles and service updates.</string>

<key>NSPhotoLibraryUsageDescription</key>
<string>We need access to your photo library to upload pet photos.</string>

<key>NSLocationWhenInUseUsageDescription</key>
<string>We need your location to find nearby services and track deliveries.</string>

<key>NSLocationAlwaysAndWhenInUseUsageDescription</key>
<string>We need your location to track deliveries in real-time.</string>

<key>NSMicrophoneUsageDescription</key>
<string>We need microphone access for video consultations.</string>

<key>UIBackgroundModes</key>
<array>
    <string>location</string>
    <string>fetch</string>
    <string>remote-notification</string>
</array>
```

### 5.2 Update Podfile
```ruby
# ios/Podfile
platform :ios, '13.0'
require_relative '../node_modules/react-native/scripts/react_native_pods'
require_relative '../node_modules/@react-native-community/cli-platform-ios/native_modules'

target 'WarmpawzCustomer' do
  config = use_native_modules!

  use_react_native!(
    :path => config[:reactNativePath],
    :hermes_enabled => true
  )

  pod 'GoogleMaps'
  pod 'Google-Maps-iOS-Utils'
end
```

### 5.3 Install Pods
```bash
cd ios
pod install
cd ..
```

---

## Step 6: Project Structure Setup (Week 2)

### 6.1 Create Directory Structure
```
src/
├── components/          # Reusable components
│   ├── common/
│   ├── forms/
│   └── ui/
├── screens/            # Screen components
│   ├── auth/
│   ├── home/
│   ├── booking/
│   └── profile/
├── navigation/         # Navigation setup
│   ├── AppNavigator.tsx
│   ├── AuthNavigator.tsx
│   └── types.ts
├── services/          # API services
│   ├── api/
│   ├── supabase/
│   └── storage/
├── hooks/             # Custom hooks
├── utils/             # Utility functions
│   ├── constants.ts
│   ├── helpers.ts
│   └── validators.ts
├── store/             # State management
│   ├── authStore.ts
│   └── bookingStore.ts
└── types/             # TypeScript types
    ├── booking.ts
    ├── user.ts
    └── vendor.ts
```

### 6.2 Create App.tsx Structure
```typescript
// App.tsx
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppNavigator } from './src/navigation/AppNavigator';
import { StatusBar } from 'react-native';

const queryClient = new QueryClient();

function App(): React.JSX.Element {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <NavigationContainer>
          <StatusBar barStyle="dark-content" backgroundColor="#FF8C42" />
          <AppNavigator />
        </NavigationContainer>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}

export default App;
```

---

## Step 7: Navigation Setup (Week 3)

### 7.1 Create Navigation Types
```typescript
// src/navigation/types.ts
export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
  Home: undefined;
  Services: undefined;
  Bookings: undefined;
  Profile: undefined;
  BookingDetails: { bookingId: string };
  ServiceDetails: { serviceId: string };
  // ... more routes
};

export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
  OTP: { phone: string };
};

export type MainTabParamList = {
  Home: undefined;
  Services: undefined;
  Bookings: undefined;
  Profile: undefined;
};
```

### 7.2 Create App Navigator
```typescript
// src/navigation/AppNavigator.tsx
import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { RootStackParamList, AuthStackParamList, MainTabParamList } from './types';
import { useAuthStore } from '../store/authStore';

// Screens
import LoginScreen from '../screens/auth/LoginScreen';
import HomeScreen from '../screens/home/HomeScreen';
import ServicesScreen from '../screens/services/ServicesScreen';
import BookingsScreen from '../screens/booking/BookingsScreen';
import ProfileScreen from '../screens/profile/ProfileScreen';

const RootStack = createNativeStackNavigator<RootStackParamList>();
const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const MainTab = createBottomTabNavigator<MainTabParamList>();

function MainTabs() {
  return (
    <MainTab.Navigator
      screenOptions={{
        tabBarActiveTintColor: '#FF8C42',
        tabBarInactiveTintColor: '#999',
        headerShown: false,
      }}>
      <MainTab.Screen name="Home" component={HomeScreen} />
      <MainTab.Screen name="Services" component={ServicesScreen} />
      <MainTab.Screen name="Bookings" component={BookingsScreen} />
      <MainTab.Screen name="Profile" component={ProfileScreen} />
    </MainTab.Navigator>
  );
}

function AuthNavigator() {
  return (
    <AuthStack.Navigator screenOptions={{ headerShown: false }}>
      <AuthStack.Screen name="Login" component={LoginScreen} />
    </AuthStack.Navigator>
  );
}

export function AppNavigator() {
  const { isAuthenticated } = useAuthStore();

  return (
    <RootStack.Navigator screenOptions={{ headerShown: false }}>
      {isAuthenticated ? (
        <RootStack.Screen name="Main" component={MainTabs} />
      ) : (
        <RootStack.Screen name="Auth" component={AuthNavigator} />
      )}
    </RootStack.Navigator>
  );
}
```

---

## Step 8: API Service Setup (Week 3)

### 8.1 Create Supabase Client
```typescript
// src/services/supabase/client.ts
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const supabaseUrl = 'YOUR_SUPABASE_URL';
const supabaseAnonKey = 'YOUR_SUPABASE_ANON_KEY';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
```

### 8.2 Create API Service
```typescript
// src/services/api/bookingService.ts
import { supabase } from '../supabase/client';

export const bookingService = {
  async createBooking(bookingData: any) {
    const response = await fetch(
      `${supabaseUrl}/functions/v1/make-server-3dd53475/customer/bookings`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseAnonKey}`,
        },
        body: JSON.stringify(bookingData),
      }
    );
    return response.json();
  },

  async getBookings(customerId: string) {
    // Implementation
  },

  async cancelBooking(bookingId: string, reason: string) {
    // Implementation
  },
};
```

---

## Step 9: Component Migration (Week 4-8)

### 9.1 Migration Strategy

**Phase 1: Core Components (Week 4-5)**
- Auth components (Login, OTP, Register)
- Home screen
- Navigation structure
- Basic UI components

**Phase 2: Service Screens (Week 5-6)**
- Service discovery
- Service details
- Booking flows
- Payment integration

**Phase 3: Management Screens (Week 6-7)**
- Booking management
- Profile management
- Settings
- Notifications

**Phase 4: Advanced Features (Week 7-8)**
- Maps integration
- Camera/Image picker
- Push notifications
- WebRTC (video calls)

### 9.2 Component Conversion Example

**Web Component:**
```tsx
// Web: src/components/customer/HomeScreen.tsx
<div className="container">
  <button onClick={handleNavigate}>Navigate</button>
</div>
```

**React Native Component:**
```tsx
// RN: src/screens/home/HomeScreen.tsx
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';

export default function HomeScreen({ navigation }) {
  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={() => navigation.navigate('Services')}>
        <Text>Navigate</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
});
```

---

## Step 10: Build Scripts (Week 9)

### 10.1 Update package.json
```json
{
  "scripts": {
    "android": "react-native run-android",
    "ios": "react-native run-ios",
    "start": "react-native start",
    "test": "jest",
    "lint": "eslint .",
    "build:android:debug": "cd android && ./gradlew assembleDebug",
    "build:android:release": "cd android && ./gradlew assembleRelease",
    "build:android:bundle": "cd android && ./gradlew bundleRelease",
    "build:ios:debug": "cd ios && xcodebuild -workspace WarmpawzCustomer.xcworkspace -scheme WarmpawzCustomer -configuration Debug",
    "build:ios:release": "cd ios && xcodebuild -workspace WarmpawzCustomer.xcworkspace -scheme WarmpawzCustomer -configuration Release archive"
  }
}
```

---

## Step 11: Generate APK (Android) - Week 10

### 11.1 Debug APK
```bash
cd android
./gradlew assembleDebug
# APK location: app/build/outputs/apk/debug/app-debug.apk
```

### 11.2 Release APK
```bash
cd android
./gradlew assembleRelease
# APK location: app/build/outputs/apk/release/app-release.apk
```

### 11.3 AAB (App Bundle) for Play Store
```bash
cd android
./gradlew bundleRelease
# AAB location: app/build/outputs/bundle/release/app-release.aab
```

---

## Step 12: Generate IPA (iOS) - Week 10

### 12.1 Build in Xcode
1. Open project:
   ```bash
   open ios/WarmpawzCustomer.xcworkspace
   ```

2. Select "Any iOS Device" or specific device

3. Product > Archive

4. Distribute App > App Store Connect

5. Follow prompts to generate IPA

### 12.2 Command Line Build (Alternative)
```bash
cd ios
xcodebuild -workspace WarmpawzCustomer.xcworkspace \
  -scheme WarmpawzCustomer \
  -configuration Release \
  -archivePath build/WarmpawzCustomer.xcarchive \
  archive

xcodebuild -exportArchive \
  -archivePath build/WarmpawzCustomer.xcarchive \
  -exportPath build \
  -exportOptionsPlist ExportOptions.plist
```

---

## Step 13: Separate Customer & Vendor Apps

### 13.1 Customer App Configuration
```typescript
// apps/WarmpawzCustomer/src/config/app.ts
export const APP_CONFIG = {
  name: 'Warmpawz Customer',
  bundleId: 'com.warmpawz.customer',
  appId: 'com.warmpawz.customer',
  apiUrl: 'https://api.warmpawz.com',
  theme: {
    primaryColor: '#FF8C42',
  },
};
```

### 13.2 Vendor App Configuration
```typescript
// apps/WarmpawzVendor/src/config/app.ts
export const APP_CONFIG = {
  name: 'Warmpawz Vendor',
  bundleId: 'com.warmpawz.vendor',
  appId: 'com.warmpawz.vendor',
  apiUrl: 'https://api.warmpawz.com',
  theme: {
    primaryColor: '#FF8C42',
  },
};
```

---

## Step 14: Testing (Week 11)

### 14.1 Android Testing
```bash
# Run on connected device
npm run android

# Run on emulator
npm run android -- --deviceId=emulator-5554

# Build and install release APK
npm run build:android:release
adb install android/app/build/outputs/apk/release/app-release.apk
```

### 14.2 iOS Testing
```bash
# Run on simulator
npm run ios

# Run on specific simulator
npm run ios -- --simulator="iPhone 15 Pro"

# Run on connected device
npm run ios -- --device="Your Device Name"
```

---

## Step 15: App Store Deployment (Week 12)

### 15.1 Google Play Store
1. Create app in Google Play Console
2. Upload AAB file
3. Complete store listing
4. Set up pricing and distribution
5. Submit for review

### 15.2 Apple App Store
1. Create app in App Store Connect
2. Upload IPA file
3. Complete store listing
4. Set up pricing and distribution
5. Submit for review

---

## Key Differences: Web vs React Native

### Components
- **Web:** `<div>`, `<button>`, HTML elements
- **RN:** `<View>`, `<TouchableOpacity>`, React Native components

### Styling
- **Web:** CSS/Tailwind classes
- **RN:** StyleSheet API or styled-components

### Navigation
- **Web:** React Router
- **RN:** React Navigation

### API Calls
- **Web:** Same (fetch/axios)
- **RN:** Same (fetch/axios)

### Storage
- **Web:** localStorage
- **RN:** AsyncStorage

---

## Migration Checklist

### Core Features
- [ ] Authentication flow
- [ ] Home screen
- [ ] Service discovery
- [ ] Booking creation
- [ ] Booking management
- [ ] Profile management
- [ ] Payment integration

### Native Features
- [ ] Camera access
- [ ] Location/GPS
- [ ] Push notifications
- [ ] File uploads
- [ ] Maps integration
- [ ] Video calls (WebRTC)

### Platform-Specific
- [ ] Android permissions
- [ ] iOS permissions
- [ ] App icons
- [ ] Splash screens
- [ ] Deep linking
- [ ] Background tasks

---

## Common Issues & Solutions

### Issue 1: Metro Bundler Won't Start
```bash
# Clear cache
npm start -- --reset-cache

# Clear watchman
watchman watch-del-all
```

### Issue 2: Android Build Fails
```bash
# Clean build
cd android
./gradlew clean
cd ..

# Rebuild
npm run android
```

### Issue 3: iOS Pod Errors
```bash
cd ios
pod deintegrate
pod install
cd ..
```

### Issue 4: Native Module Not Found
```bash
# Rebuild native modules
npm run android  # or ios
```

---

## Estimated Timeline

- **Week 1:** Project setup and dependencies
- **Week 2:** Platform configuration
- **Week 3:** Navigation and API setup
- **Week 4-8:** Component migration
- **Week 9:** Build scripts and testing
- **Week 10:** Release builds
- **Week 11:** Testing and bug fixes
- **Week 12:** App store submission

**Total:** 9-12 weeks

---

## Next Steps

1. ✅ Initialize React Native projects
2. ✅ Install dependencies
3. ✅ Configure Android and iOS
4. ✅ Set up navigation
5. ✅ Migrate components
6. ✅ Test on devices
7. ✅ Generate release builds
8. ✅ Submit to app stores

---

**Guide Created:** January 2025  
**Status:** Ready for Implementation

