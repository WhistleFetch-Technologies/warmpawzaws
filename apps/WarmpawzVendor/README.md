# Warmpawz Vendor Mobile App

React Native mobile application for Warmpawz vendors.

## Setup

### Prerequisites
- Node.js 18+
- Java JDK 11+
- Android Studio (for Android)
- Xcode (for iOS, macOS only)

### Installation

1. Install dependencies:
```bash
npm install
```

2. iOS setup (macOS only):
```bash
cd ios && pod install && cd ..
```

3. Run the app:
```bash
# Android
npm run android

# iOS
npm run ios
```

## Project Structure

```
src/
├── screens/          # Screen components
├── components/       # Reusable components
├── navigation/       # Navigation setup
├── services/         # API services
├── hooks/           # Custom hooks
├── utils/           # Utility functions
├── theme/           # Theme and colors
└── config/          # Configuration files
```

## Features

- ✅ Authentication with OTP
- ✅ Staff login support
- ✅ Vendor dashboard
- ✅ Service management
- ✅ Booking management
- ✅ Staff management
- ✅ All vendor capabilities

## API Integration

All API calls go through the centralized `ApiService` in `src/services/api.ts`.

## Design System

Primary color: #FF8C42

See `src/theme/colors.ts` for full design system.

