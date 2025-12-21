# React Native Quick Start
## Get Started in 30 Minutes

**Date:** January 2025  
**Time:** 30 minutes to first build

---

## Prerequisites Check

```bash
# Check Node.js
node --version  # Should be 18+

# Check Java
java -version  # Should be 11+

# Check Android Studio
# Open Android Studio and verify SDK is installed

# Check Xcode (macOS only)
xcodebuild -version
```

---

## Step 1: Install React Native CLI (2 min)

```bash
npm install -g react-native-cli
```

---

## Step 2: Create Customer App (5 min)

```bash
cd apps
npx react-native@latest init WarmpawzCustomer --version 0.73.0
cd WarmpawzCustomer
```

---

## Step 3: Install Essential Dependencies (5 min)

```bash
# Navigation
npm install @react-navigation/native @react-navigation/native-stack
npm install react-native-screens react-native-safe-area-context

# UI
npm install react-native-paper react-native-vector-icons

# API
npm install @supabase/supabase-js @react-native-async-storage/async-storage

# iOS Pods
cd ios && pod install && cd ..
```

---

## Step 4: Create Basic App Structure (10 min)

### 4.1 Update App.tsx
```typescript
// App.tsx
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import HomeScreen from './src/screens/HomeScreen';

const Stack = createNativeStackNavigator();

function App(): React.JSX.Element {
  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <Stack.Navigator>
          <Stack.Screen name="Home" component={HomeScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

export default App;
```

### 4.2 Create Home Screen
```typescript
// src/screens/HomeScreen.tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Warmpawz Customer</Text>
      <Text style={styles.subtitle}>React Native App</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FF8C42',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginTop: 8,
  },
});
```

---

## Step 5: Run on Android (5 min)

```bash
# Start Metro bundler
npm start

# In another terminal, run Android
npm run android
```

---

## Step 6: Run on iOS (3 min, macOS only)

```bash
# Start Metro bundler
npm start

# In another terminal, run iOS
npm run ios
```

---

## Step 7: Build APK (Android)

```bash
cd android
./gradlew assembleDebug
# APK: app/build/outputs/apk/debug/app-debug.apk
```

---

## Step 8: Build IPA (iOS, macOS only)

1. Open Xcode:
   ```bash
   open ios/WarmpawzCustomer.xcworkspace
   ```

2. Select device: "Any iOS Device"

3. Product > Archive

4. Distribute App > Development/App Store

---

## Next Steps

1. ✅ Follow full setup guide: `REACT_NATIVE_SETUP_GUIDE.md`
2. ✅ Follow implementation plan: `REACT_NATIVE_IMPLEMENTATION_PLAN.md`
3. ✅ Start component migration
4. ✅ Integrate with existing API

---

**Quick Start Created:** January 2025  
**Status:** Ready to Execute

