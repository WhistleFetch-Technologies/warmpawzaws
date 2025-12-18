# Warmpawz Vendor Mobile App

React Native mobile application for vendors to manage their pet care business.

## Features

- ✅ Phone OTP Authentication
- ✅ Vendor Onboarding Flow
- ✅ Application Status Tracking
- ✅ Service Setup & Configuration
- ✅ Availability Management
- ✅ Dashboard with Stats
- ✅ Booking Management
- ✅ Service Management
- ✅ Profile & Settings

## Setup

### Prerequisites

- Node.js >= 18
- React Native CLI or Expo CLI
- Android Studio (for Android)
- Xcode (for iOS)

### Installation

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables:
```bash
cp .env.example .env
# Edit .env and add your SUPABASE_ANON_KEY
```

3. For iOS (if using bare React Native):
```bash
cd ios && pod install && cd ..
```

### Running the App

**Android:**
```bash
npm run android
```

**iOS:**
```bash
npm run ios
```

**Start Metro:**
```bash
npm start
```

## Project Structure

```
apps/vendor-mobile/
├── src/
│   ├── components/       # Reusable UI components
│   ├── screens/          # Screen components
│   │   ├── auth/         # Authentication screens
│   │   ├── onboarding/   # Onboarding flow
│   │   ├── status/       # Application status screens
│   │   ├── setup/        # Setup screens
│   │   └── dashboard/    # Dashboard screens
│   ├── services/         # API services
│   ├── context/          # React Context providers
│   ├── theme/            # Theme system (colors, typography, etc.)
│   ├── config/           # Configuration files
│   ├── types/            # TypeScript types
│   ├── navigation/       # Navigation configuration
│   └── utils/            # Utility functions
├── App.tsx               # Main app component
└── index.js              # Entry point
```

## Branding Guidelines

The app strictly follows the Warmpawz branding guidelines:
- **Primary Color**: Orange (#FF8C42)
- **Secondary Color**: Pink (#FF6B9D)
- **Font**: Inter
- **Spacing**: 4px grid system
- **Border Radius**: 8px (sm), 12px (md), 16px (lg)

See `src/guidelines/BRANDING_QUICK_REFERENCE.md` for complete guidelines.

## API Integration

All API endpoints match the web app:
- `/vendor/profile` - Vendor profile
- `/vendor/application` - Application management
- `/vendor/bookings` - Booking management
- `/vendor/services` - Service management
- `/vendor/staff` - Staff management
- `/vendor/schedule` - Schedule management

## Development

### Code Style

- Use TypeScript for all new files
- Follow React Native best practices
- Use functional components with hooks
- Follow the existing component patterns

### Testing

```bash
npm test
```

### Linting

```bash
npm run lint
```

## Building for Production

### Android

```bash
npm run build:android
```

### iOS

```bash
npm run build:ios
```

## Troubleshooting

### Common Issues

1. **Module not found errors**: Run `npm install` again
2. **Metro bundler issues**: Clear cache with `npm start -- --reset-cache`
3. **iOS build issues**: Run `cd ios && pod install && cd ..`
4. **Android build issues**: Clean gradle with `cd android && ./gradlew clean && cd ..`

## Next Steps

See `NEXT_STEPS.md` for a detailed roadmap of upcoming features and improvements.

## License

Proprietary - Warmpawz

