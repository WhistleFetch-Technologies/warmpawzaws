# Warmpawz Vendor Mobile App

React Native mobile application for Android and iOS.

## Setup

### Prerequisites
- Node.js 18+
- React Native CLI
- Android Studio (for Android)
- Xcode (for iOS - macOS only)

### Installation

```bash
# Install dependencies
npm install

# For iOS (macOS only)
cd ios && pod install && cd ..

# Start Metro bundler
npm start

# Run on Android
npm run android

# Run on iOS
npm run ios
```

## Build

### Android APK
```bash
npm run build:apk
```

### iOS IPA
```bash
npm run build:ios
```

## Project Structure

```
apps/vendor-mobile/
├── src/
│   ├── screens/          # Screen components
│   ├── components/       # Reusable components
│   ├── navigation/       # Navigation setup
│   ├── services/         # API services
│   ├── utils/            # Utilities
│   ├── types/            # TypeScript types
│   └── config/           # Configuration
├── android/              # Android native code
├── ios/                  # iOS native code
└── App.tsx               # Main app component
```

## Features

- Dashboard with key metrics
- Booking management
- Service management (CRUD)
- Staff management
- Profile and settings
- Push notifications
- GPS tracking for home services

