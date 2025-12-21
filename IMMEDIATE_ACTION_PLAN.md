# ⚡ IMMEDIATE ACTION PLAN
## Execute These Commands Right Now

**Date:** January 2025  
**Time:** 2 hours  
**Status:** 🚀 START NOW

---

## 🎯 GOAL: Get Both React Native Apps Running

**By End of Session:** Customer and Vendor React Native apps created and running on Android/iOS

---

## STEP 1: Verify Prerequisites (5 minutes)

### Run These Commands:
```bash
# Check Node.js (should be 18+)
node --version

# Check Java (should be 11+)
java --version

# Install React Native CLI globally
npm install -g react-native-cli

# Verify installation
react-native --version
```

### ✅ Check Results:
- [ ] Node.js version shows 18.x.x or higher
- [ ] Java version shows 11 or higher
- [ ] React Native CLI installed successfully

**If any fail, install missing prerequisites first.**

---

## STEP 2: Create Customer App (30 minutes)

### Open Terminal and Run:
```bash
# Navigate to apps directory
cd /Users/ketan/Documents/warmpawzecodev/Warmpawzecodev/apps

# Create React Native project
npx react-native@latest init WarmpawzCustomer --version 0.73.0

# Enter the project
cd WarmpawzCustomer

# Install essential dependencies
npm install @react-navigation/native @react-navigation/native-stack
npm install react-native-screens react-native-safe-area-context
npm install react-native-paper react-native-vector-icons
npm install @supabase/supabase-js @react-native-async-storage/async-storage

# iOS setup (macOS only - skip if on Windows/Linux)
cd ios
pod install
cd ..

# Test on Android (keep terminal open)
npm run android

# OR Test on iOS (macOS only)
# npm run ios
```

### ✅ Success Indicators:
- [ ] Project created in `apps/WarmpawzCustomer/`
- [ ] Dependencies installed without errors
- [ ] App launches on Android emulator or iOS simulator
- [ ] Default React Native screen visible

**If app doesn't launch, check troubleshooting section below.**

---

## STEP 3: Create Vendor App (30 minutes)

### Open NEW Terminal and Run:
```bash
# Navigate to apps directory
cd /Users/ketan/Documents/warmpawzecodev/Warmpawzecodev/apps

# Create React Native project
npx react-native@latest init WarmpawzVendor --version 0.73.0

# Enter the project
cd WarmpawzVendor

# Install same dependencies
npm install @react-navigation/native @react-navigation/native-stack
npm install react-native-screens react-native-safe-area-context
npm install react-native-paper react-native-vector-icons
npm install @supabase/supabase-js @react-native-async-storage/async-storage

# iOS setup (macOS only)
cd ios
pod install
cd ..

# Test on Android
npm run android

# OR Test on iOS (macOS only)
# npm run ios
```

### ✅ Success Indicators:
- [ ] Project created in `apps/WarmpawzVendor/`
- [ ] Dependencies installed without errors
- [ ] App launches successfully
- [ ] Default React Native screen visible

---

## STEP 4: Verify Both Apps (5 minutes)

### Check Directory Structure:
```bash
cd /Users/ketan/Documents/warmpawzecodev/Warmpawzecodev/apps
ls -la
```

**Should see:**
```
WarmpawzCustomer/
WarmpawzVendor/
```

### Test Both Apps:
1. **Customer App:**
   ```bash
   cd WarmpawzCustomer
   npm run android  # or npm run ios
   ```

2. **Vendor App:**
   ```bash
   cd WarmpawzVendor
   npm run android  # or npm run ios
   ```

### ✅ Final Checklist:
- [ ] Both apps exist in `apps/` directory
- [ ] Customer app runs successfully
- [ ] Vendor app runs successfully
- [ ] No build errors
- [ ] Ready for next phase

---

## 🆘 TROUBLESHOOTING

### Issue: "Command not found: react-native"
**Solution:**
```bash
npm install -g react-native-cli
```

### Issue: Android build fails
**Solution:**
```bash
cd android
./gradlew clean
cd ..
npm run android
```

### Issue: "SDK location not found"
**Solution:**
1. Open Android Studio
2. Tools → SDK Manager
3. Install Android SDK
4. Set ANDROID_HOME environment variable:
   ```bash
   export ANDROID_HOME=$HOME/Library/Android/sdk
   export PATH=$PATH:$ANDROID_HOME/emulator
   export PATH=$PATH:$ANDROID_HOME/platform-tools
   ```

### Issue: iOS pod install fails
**Solution:**
```bash
cd ios
pod deintegrate
pod install
cd ..
```

### Issue: Metro bundler won't start
**Solution:**
```bash
npm start -- --reset-cache
```

### Issue: Port 8081 already in use
**Solution:**
```bash
# Kill process on port 8081
lsof -ti:8081 | xargs kill -9

# Or use different port
npm start -- --port 8082
```

---

## ✅ SUCCESS CRITERIA

### You're Done When:
- ✅ Both apps created in `apps/` directory
- ✅ Both apps launch on simulators/emulators
- ✅ No build errors
- ✅ Default React Native screen visible
- ✅ Ready to start development

---

## 🎯 WHAT'S NEXT?

### After Apps Are Running:

1. **Read Setup Guide:**
   - Open `REACT_NATIVE_SETUP_GUIDE.md`
   - Follow Week 1 plan

2. **Set Up Project Structure:**
   - Create `src/` directories
   - Set up navigation
   - Configure API

3. **Start Development:**
   - Follow `REACT_NATIVE_IMPLEMENTATION_PLAN.md`
   - Begin component migration

---

## 📋 COPY-PASTE COMMANDS (All in One)

### Complete Setup Script:
```bash
# ============================================
# STEP 1: Prerequisites
# ============================================
node --version
java --version
npm install -g react-native-cli

# ============================================
# STEP 2: Create Customer App
# ============================================
cd /Users/ketan/Documents/warmpawzecodev/Warmpawzecodev/apps
npx react-native@latest init WarmpawzCustomer --version 0.73.0
cd WarmpawzCustomer
npm install @react-navigation/native @react-navigation/native-stack react-native-screens react-native-safe-area-context react-native-paper react-native-vector-icons @supabase/supabase-js @react-native-async-storage/async-storage
cd ios && pod install && cd ..
npm run android

# ============================================
# STEP 3: Create Vendor App (in new terminal)
# ============================================
cd /Users/ketan/Documents/warmpawzecodev/Warmpawzecodev/apps
npx react-native@latest init WarmpawzVendor --version 0.73.0
cd WarmpawzVendor
npm install @react-navigation/native @react-navigation/native-stack react-native-screens react-native-safe-area-context react-native-paper react-native-vector-icons @supabase/supabase-js @react-native-async-storage/async-storage
cd ios && pod install && cd ..
npm run android
```

---

## ⏱️ TIME ESTIMATE

- **Step 1 (Prerequisites):** 5 minutes
- **Step 2 (Customer App):** 30 minutes
- **Step 3 (Vendor App):** 30 minutes
- **Step 4 (Verification):** 5 minutes
- **Total:** ~70 minutes (1.5 hours)

**Buffer time for troubleshooting:** +30 minutes

**Total:** ~2 hours

---

## 🎉 YOU'RE READY!

**Start executing the commands above right now!**

**If you encounter any issues, check the troubleshooting section or refer to:**
- `REACT_NATIVE_SETUP_GUIDE.md` - Detailed setup
- `REACT_NATIVE_GETTING_STARTED.md` - Quick start guide

---

**Action Plan Created:** January 2025  
**Status:** 🚀 **EXECUTE NOW**  
**Time:** Start immediately!

