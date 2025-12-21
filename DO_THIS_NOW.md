# ⚡ DO THIS NOW - Exact Commands to Execute
## Your Environment Status & Immediate Actions

**Date:** January 2025  
**Current Status:**
- ✅ Node.js v24.11.0 (Ready)
- ❌ Java JDK (Missing - Required)
- ❌ React Native CLI (Missing - Required)
- ❌ Homebrew (Missing - Recommended)
- ⚠️ Mobile app directories exist but not initialized

---

## 🚀 EXECUTE THESE COMMANDS (Copy & Paste)

### STEP 1: Install Homebrew (5 minutes)
```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

**Wait for installation to complete, then:**
```bash
# Verify installation
brew --version
```

---

### STEP 2: Install Java JDK 11 (10 minutes)
```bash
# Install Java using Homebrew
brew install openjdk@11

# Set JAVA_HOME
echo 'export JAVA_HOME=$(/usr/libexec/java_home -v 11)' >> ~/.zshrc
echo 'export PATH=$JAVA_HOME/bin:$PATH' >> ~/.zshrc

# Reload shell configuration
source ~/.zshrc

# Verify installation
java -version
```

**✅ Expected Output:** Should show "openjdk version 11.x.x"

---

### STEP 3: Install React Native CLI (2 minutes)
```bash
npm install -g react-native-cli

# Verify installation
react-native --version
```

**✅ Expected Output:** Should show React Native CLI version

---

### STEP 4: Install Android Studio (30 minutes)

**Manual Steps:**
1. Visit: https://developer.android.com/studio
2. Download Android Studio for macOS
3. Install the application
4. Open Android Studio
5. Complete setup wizard
6. Install Android SDK (API 24-34)

**After Installation, Set Environment Variables:**
```bash
# Set Android environment variables
echo 'export ANDROID_HOME=$HOME/Library/Android/sdk' >> ~/.zshrc
echo 'export PATH=$PATH:$ANDROID_HOME/emulator' >> ~/.zshrc
echo 'export PATH=$PATH:$ANDROID_HOME/platform-tools' >> ~/.zshrc
echo 'export PATH=$PATH:$ANDROID_HOME/tools' >> ~/.zshrc
echo 'export PATH=$PATH:$ANDROID_HOME/tools/bin' >> ~/.zshrc

# Reload shell
source ~/.zshrc

# Verify
echo $ANDROID_HOME
```

**✅ Expected Output:** Should show path like `/Users/ketan/Library/Android/sdk`

---

### STEP 5: Clean Up Existing Directories (2 minutes)
```bash
cd /Users/ketan/Documents/warmpawzecodev/Warmpawzecodev/apps

# Remove incomplete directories
rm -rf customer-mobile vendor-mobile

# Verify removal
ls -la
```

---

### STEP 6: Create Customer React Native App (10 minutes)
```bash
cd /Users/ketan/Documents/warmpawzecodev/Warmpawzecodev/apps

# Create React Native project
npx react-native@latest init WarmpawzCustomer --version 0.73.0

# Enter project directory
cd WarmpawzCustomer

# Install essential dependencies
npm install @react-navigation/native @react-navigation/native-stack
npm install react-native-screens react-native-safe-area-context
npm install react-native-paper react-native-vector-icons
npm install @supabase/supabase-js @react-native-async-storage/async-storage

# iOS setup (macOS)
cd ios
pod install
cd ..
```

**✅ Expected:** Project created with all dependencies installed

---

### STEP 7: Create Vendor React Native App (10 minutes)
```bash
cd /Users/ketan/Documents/warmpawzecodev/Warmpawzecodev/apps

# Create React Native project
npx react-native@latest init WarmpawzVendor --version 0.73.0

# Enter project directory
cd WarmpawzVendor

# Install same dependencies
npm install @react-navigation/native @react-navigation/native-stack
npm install react-native-screens react-native-safe-area-context
npm install react-native-paper react-native-vector-icons
npm install @supabase/supabase-js @react-native-async-storage/async-storage

# iOS setup (macOS)
cd ios
pod install
cd ..
```

**✅ Expected:** Second project created with all dependencies installed

---

### STEP 8: Test Customer App (5 minutes)
```bash
cd /Users/ketan/Documents/warmpawzecodev/Warmpawzecodev/apps/WarmpawzCustomer

# Start Metro bundler (Terminal 1)
npm start

# In a NEW terminal, run Android
cd /Users/ketan/Documents/warmpawzecodev/Warmpawzecodev/apps/WarmpawzCustomer
npm run android

# OR run iOS (macOS)
# npm run ios
```

**✅ Expected:** App launches on Android emulator or iOS simulator

---

### STEP 9: Test Vendor App (5 minutes)
```bash
cd /Users/ketan/Documents/warmpawzecodev/Warmpawzecodev/apps/WarmpawzVendor

# Start Metro bundler (Terminal 1)
npm start

# In a NEW terminal, run Android
cd /Users/ketan/Documents/warmpawzecodev/Warmpawzecodev/apps/WarmpawzVendor
npm run android

# OR run iOS (macOS)
# npm run ios
```

**✅ Expected:** App launches successfully

---

## 📋 COMPLETE COMMAND SEQUENCE (All in One)

```bash
# ============================================
# STEP 1: Install Homebrew
# ============================================
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
brew --version

# ============================================
# STEP 2: Install Java JDK 11
# ============================================
brew install openjdk@11
echo 'export JAVA_HOME=$(/usr/libexec/java_home -v 11)' >> ~/.zshrc
echo 'export PATH=$JAVA_HOME/bin:$PATH' >> ~/.zshrc
source ~/.zshrc
java -version

# ============================================
# STEP 3: Install React Native CLI
# ============================================
npm install -g react-native-cli
react-native --version

# ============================================
# STEP 4: Set Android Environment (After installing Android Studio)
# ============================================
echo 'export ANDROID_HOME=$HOME/Library/Android/sdk' >> ~/.zshrc
echo 'export PATH=$PATH:$ANDROID_HOME/emulator' >> ~/.zshrc
echo 'export PATH=$PATH:$ANDROID_HOME/platform-tools' >> ~/.zshrc
source ~/.zshrc
echo $ANDROID_HOME

# ============================================
# STEP 5: Clean Up
# ============================================
cd /Users/ketan/Documents/warmpawzecodev/Warmpawzecodev/apps
rm -rf customer-mobile vendor-mobile

# ============================================
# STEP 6: Create Customer App
# ============================================
npx react-native@latest init WarmpawzCustomer --version 0.73.0
cd WarmpawzCustomer
npm install @react-navigation/native @react-navigation/native-stack react-native-screens react-native-safe-area-context react-native-paper react-native-vector-icons @supabase/supabase-js @react-native-async-storage/async-storage
cd ios && pod install && cd ..

# ============================================
# STEP 7: Create Vendor App
# ============================================
cd /Users/ketan/Documents/warmpawzecodev/Warmpawzecodev/apps
npx react-native@latest init WarmpawzVendor --version 0.73.0
cd WarmpawzVendor
npm install @react-navigation/native @react-navigation/native-stack react-native-screens react-native-safe-area-context react-native-paper react-native-vector-icons @supabase/supabase-js @react-native-async-storage/async-storage
cd ios && pod install && cd ..

# ============================================
# STEP 8: Test Customer App
# ============================================
cd /Users/ketan/Documents/warmpawzecodev/Warmpawzecodev/apps/WarmpawzCustomer
npm run android  # or npm run ios

# ============================================
# STEP 9: Test Vendor App
# ============================================
cd /Users/ketan/Documents/warmpawzecodev/Warmpawzecodev/apps/WarmpawzVendor
npm run android  # or npm run ios
```

---

## ✅ VERIFICATION CHECKLIST

### After Step 1 (Homebrew):
- [ ] `brew --version` shows version number

### After Step 2 (Java):
- [ ] `java -version` shows "openjdk version 11.x.x"

### After Step 3 (React Native CLI):
- [ ] `react-native --version` shows version number

### After Step 4 (Android Studio):
- [ ] Android Studio opens successfully
- [ ] `$ANDROID_HOME` shows correct path

### After Step 6 (Customer App):
- [ ] `apps/WarmpawzCustomer/` directory exists
- [ ] `package.json` exists
- [ ] `android/` and `ios/` directories exist
- [ ] Dependencies installed without errors

### After Step 7 (Vendor App):
- [ ] `apps/WarmpawzVendor/` directory exists
- [ ] `package.json` exists
- [ ] `android/` and `ios/` directories exist
- [ ] Dependencies installed without errors

### After Step 8-9 (Testing):
- [ ] Customer app launches on Android/iOS
- [ ] Vendor app launches on Android/iOS
- [ ] No build errors
- [ ] Default React Native screen visible

---

## 🆘 TROUBLESHOOTING

### Homebrew Installation Fails
**Solution:** Follow manual installation from https://brew.sh

### Java Installation Fails
**Alternative:** Download from Oracle:
1. Visit: https://www.oracle.com/java/technologies/javase/jdk11-archive-downloads.html
2. Download macOS installer
3. Install manually
4. Set JAVA_HOME manually

### React Native Project Creation Fails
**Solution:**
```bash
# Clear npm cache
npm cache clean --force

# Try with different approach
npx @react-native-community/cli@latest init WarmpawzCustomer
```

### Android Build Fails
**Solution:**
```bash
cd android
./gradlew clean
cd ..
npm run android
```

### iOS Pod Install Fails
**Solution:**
```bash
cd ios
pod deintegrate
pod install
cd ..
```

---

## ⏱️ TIME ESTIMATE

- **Step 1 (Homebrew):** 5 minutes
- **Step 2 (Java):** 10 minutes
- **Step 3 (RN CLI):** 2 minutes
- **Step 4 (Android Studio):** 30 minutes (manual download/install)
- **Step 5 (Cleanup):** 2 minutes
- **Step 6 (Customer App):** 10 minutes
- **Step 7 (Vendor App):** 10 minutes
- **Step 8-9 (Testing):** 10 minutes

**Total:** ~1.5 hours (plus Android Studio download time)

---

## 🎯 SUCCESS = BOTH APPS RUNNING

**You're done when:**
- ✅ Customer app launches on Android/iOS
- ✅ Vendor app launches on Android/iOS
- ✅ No errors in console
- ✅ Ready to start development

---

## 📚 NEXT STEPS (After Apps Are Running)

1. **Read:** `REACT_NATIVE_SETUP_GUIDE.md`
2. **Follow:** Week 1 setup plan
3. **Start:** Component migration

---

## 🚀 START NOW

**Copy and paste the commands from STEP 1 above and execute them in order!**

**Don't skip steps - each builds on the previous one.**

---

**Action Plan Created:** January 2025  
**Status:** 🚀 **EXECUTE IMMEDIATELY**  
**First Command:** Install Homebrew (see STEP 1)

