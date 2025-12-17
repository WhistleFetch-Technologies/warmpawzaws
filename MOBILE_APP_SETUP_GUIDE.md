# 📱 Mobile App Setup Guide - React Native

## Overview

This guide covers the setup and initialization of React Native mobile applications for Warmpawz.

## Project Structure

```
Warmpawzecodev/
├── apps/
│   ├── customer-mobile/      # Customer mobile app (React Native)
│   └── vendor-mobile/        # Vendor mobile app (React Native)
├── packages/
│   ├── shared-api/          # Shared API client
│   ├── shared-types/       # Shared TypeScript types
│   └── shared-utils/        # Shared utilities
└── builds/                  # Build outputs (APK/IPA)
```

## Prerequisites

### Required Software

1. **Node.js** (v18 or higher)
   ```bash
   node --version  # Should be >= 18.0.0
   ```

2. **React Native CLI**
   ```bash
   npm install -g react-native-cli
   ```

3. **Android Development**
   - Android Studio
   - Android SDK (API 33+)
   - Java Development Kit (JDK 17+)
   - Android emulator or physical device

4. **iOS Development** (macOS only)
   - Xcode (latest version)
   - CocoaPods
   - iOS Simulator or physical device

### Environment Setup

1. **Android Environment Variables**
   ```bash
   export ANDROID_HOME=$HOME/Library/Android/sdk
   export PATH=$PATH:$ANDROID_HOME/emulator
   export PATH=$PATH:$ANDROID_HOME/tools
   export PATH=$PATH:$ANDROID_HOME/tools/bin
   export PATH=$PATH:$ANDROID_HOME/platform-tools
   ```

2. **iOS Environment** (macOS only)
   ```bash
   sudo gem install cocoapods
   ```

## Initialization Steps

### Step 1: Initialize React Native Projects

**For Customer App:**
```bash
cd apps/customer-mobile
npx react-native init WarmpawzCustomer --version 0.73.0
```

**For Vendor App:**
```bash
cd apps/vendor-mobile
npx react-native init WarmpawzVendor --version 0.73.0
```

**Note:** The project structure has been created. You'll need to run the React Native CLI initialization to generate the native Android and iOS folders.

### Step 2: Install Dependencies

**Customer App:**
```bash
cd apps/customer-mobile
npm install
```

**Vendor App:**
```bash
cd apps/vendor-mobile
npm install
```

### Step 3: iOS Setup (macOS only)

**Customer App:**
```bash
cd apps/customer-mobile/ios
pod install
cd ..
```

**Vendor App:**
```bash
cd apps/vendor-mobile/ios
pod install
cd ..
```

### Step 4: Configure Environment Variables

Create `.env` files for each app:

**apps/customer-mobile/.env:**
```env
API_BASE_URL=https://vpvpbdwtyugbknrntkho.supabase.co/functions/v1/make-server-3dd53475
SUPABASE_URL=https://vpvpbdwtyugbknrntkho.supabase.co
SUPABASE_ANON_KEY=your-anon-key-here
```

**apps/vendor-mobile/.env:**
```env
API_BASE_URL=https://vpvpbdwtyugbknrntkho.supabase.co/functions/v1/make-server-3dd53475
SUPABASE_URL=https://vpvpbdwtyugbknrntkho.supabase.co
SUPABASE_ANON_KEY=your-anon-key-here
```

## Running the Apps

### Android

**Customer App:**
```bash
cd apps/customer-mobile
npm run android
```

**Vendor App:**
```bash
cd apps/vendor-mobile
npm run android
```

### iOS (macOS only)

**Customer App:**
```bash
cd apps/customer-mobile
npm run ios
```

**Vendor App:**
```bash
cd apps/vendor-mobile
npm run ios
```

## Building for Production

### Android APK

**Customer App:**
```bash
cd apps/customer-mobile
npm run build:apk
# APK will be in builds/customer-app-release.apk
```

**Vendor App:**
```bash
cd apps/vendor-mobile
npm run build:apk
# APK will be in builds/vendor-app-release.apk
```

### iOS IPA (macOS only)

**Customer App:**
```bash
cd apps/customer-mobile
npm run build:ios
```

**Vendor App:**
```bash
cd apps/vendor-mobile
npm run build:ios
```

## Key Features Implemented

### Customer Mobile App
- ✅ Navigation structure (Stack + Tab navigators)
- ✅ Home screen with featured services
- ✅ Search screen with problem-first search
- ✅ Bookings screen
- ✅ Profile screen with pet management
- ✅ Service detail screen
- ✅ Booking confirmation screen
- ✅ API configuration

### Vendor Mobile App
- ✅ Navigation structure (Stack + Tab navigators)
- ✅ Dashboard with key metrics
- ✅ Bookings management screen
- ✅ Services management screen
- ✅ Staff management screen
- ✅ Profile screen
- ✅ Service detail screen
- ✅ Booking detail screen
- ✅ API configuration

## Next Steps

### 1. Complete Native Project Initialization
- Run React Native CLI to generate Android/iOS folders
- Configure app icons and splash screens
- Set up app signing (Android keystore, iOS certificates)

### 2. Implement API Integration
- Connect screens to backend API
- Implement authentication
- Add error handling and loading states

### 3. Add Native Features
- Push notifications setup
- GPS/location services
- Camera integration
- Image picker
- Deep linking

### 4. Testing
- Unit tests for utilities
- Integration tests for API calls
- E2E tests for critical flows

### 5. Build Configuration
- Android signing configuration
- iOS code signing setup
- Build automation scripts

## Troubleshooting

### Common Issues

1. **Metro bundler not starting**
   ```bash
   npm start --reset-cache
   ```

2. **Android build fails**
   - Check Android SDK path
   - Verify JDK version (should be 17+)
   - Clean build: `cd android && ./gradlew clean`

3. **iOS build fails**
   - Run `pod install` in ios folder
   - Clean build folder in Xcode
   - Check code signing settings

4. **Dependencies issues**
   ```bash
   rm -rf node_modules
   npm install
   ```

## Resources

- [React Native Documentation](https://reactnative.dev/docs/getting-started)
- [React Navigation](https://reactnavigation.org/)
- [Supabase JS Client](https://supabase.com/docs/reference/javascript/introduction)

---

*Last Updated: December 2024*
*Status: Project Structure Created | Native Projects Pending Initialization*

