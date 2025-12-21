# React Native - Getting Started
## Your First 2 Hours

**Date:** January 2025  
**Time Required:** 2 hours  
**Difficulty:** Easy

---

## ⚡ Quick Start (Copy & Paste)

### Step 1: Install Prerequisites (5 min)
```bash
# Check versions
node --version    # Should be 18+
java -version     # Should be 11+

# Install React Native CLI
npm install -g react-native-cli

# Install CocoaPods (macOS only)
sudo gem install cocoapods
```

### Step 2: Create Customer App (20 min)
```bash
cd apps
npx react-native@latest init WarmpawzCustomer --version 0.73.0
cd WarmpawzCustomer

# Install essential packages
npm install @react-navigation/native @react-navigation/native-stack
npm install react-native-screens react-native-safe-area-context
npm install react-native-paper react-native-vector-icons
npm install @supabase/supabase-js @react-native-async-storage/async-storage

# iOS setup (macOS only)
cd ios && pod install && cd ..

# Test it works
npm run android  # or npm run ios
```

### Step 3: Create Vendor App (20 min)
```bash
cd apps
npx react-native@latest init WarmpawzVendor --version 0.73.0
cd WarmpawzVendor

# Install same packages
npm install @react-navigation/native @react-navigation/native-stack
npm install react-native-screens react-native-safe-area-context
npm install react-native-paper react-native-vector-icons
npm install @supabase/supabase-js @react-native-async-storage/async-storage

# iOS setup (macOS only)
cd ios && pod install && cd ..

# Test it works
npm run android  # or npm run ios
```

### Step 4: Verify Success (5 min)
- [ ] Customer app runs on Android/iOS
- [ ] Vendor app runs on Android/iOS
- [ ] No build errors
- [ ] Apps show default React Native screen

**✅ If all checkboxes are checked, you're ready to proceed!**

---

## 📚 What to Read Next

1. **REACT_NATIVE_SETUP_GUIDE.md** - Complete setup instructions
2. **REACT_NATIVE_IMPLEMENTATION_PLAN.md** - Full 12-week roadmap
3. **REACT_NATIVE_NEXT_STEPS.md** - Detailed next steps

---

## 🎯 Your Goal Today

**By end of day:** Both Customer and Vendor React Native apps created and running

**Success looks like:**
- ✅ Two React Native projects in `apps/` directory
- ✅ Both apps launch on simulators/emulators
- ✅ No build errors
- ✅ Ready to start development

---

## 🆘 Troubleshooting

### Issue: "Command not found: react-native"
**Fix:** `npm install -g react-native-cli`

### Issue: Android build fails
**Fix:** 
```bash
cd android
./gradlew clean
cd ..
npm run android
```

### Issue: iOS pod install fails
**Fix:**
```bash
cd ios
pod deintegrate
pod install
cd ..
```

### Issue: Metro bundler won't start
**Fix:**
```bash
npm start -- --reset-cache
```

---

## ✅ Done? What's Next?

1. ✅ Both apps running? → Move to Week 1 plan
2. ✅ Read REACT_NATIVE_SETUP_GUIDE.md
3. ✅ Start setting up project structure
4. ✅ Begin component migration

---

**Getting Started Guide Created:** January 2025  
**Status:** Ready to Execute Now

