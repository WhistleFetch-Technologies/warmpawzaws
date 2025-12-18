# Google Maps Loading Issue - QUICK FIX GUIDE

## 🚨 Error
```
Error initializing map: Error: Google Maps Map class could not be found. API may not be loaded correctly.
```

## ✅ Root Cause
The Google Maps script was loading, but the `Map` class wasn't available when `initializeMap()` was called. This is a **timing issue**.

## 🔧 Fix Applied

### 1. **Using Google Maps Callback Pattern**
Changed from:
```javascript
script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}`;
script.onload = () => { setMapLoaded(true); }
```

To:
```javascript
script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&callback=initGoogleMaps`;
window.initGoogleMaps = () => {
  // Called when Google Maps is TRULY ready
  setMapLoaded(true);
  setTimeout(() => initializeMap(), 200);
};
```

### 2. **Better Polling for Existing Scripts**
If script already exists, we now poll specifically for `window.google.maps.Map` class availability, not just `window.google.maps`.

### 3. **Enhanced Error Checking in initializeMap()**
Now checks for:
- `window.google`
- `window.google.maps`
- `window.google.maps.Map` ✅ (This is the critical one!)
- `window.google.maps.Marker`

## 📋 How to Verify It Works

### Step 1: Open Browser Console
Navigate to the vendor onboarding page and open DevTools Console (F12).

### Step 2: Look for These Logs (in order)

✅ **Initial Setup:**
```
🚀 [INIT] Component mounted, starting initialization...
🔍 [ENV] Checking for environment variable...
🔍 [ENV] envApiKey exists: true
✅ [ENV] Using Google Maps API key from environment variable
```

✅ **Script Loading:**
```
🔄 [API KEY EFFECT] Calling loadGoogleMapsScript...
🗺️ [GOOGLE MAPS] loadGoogleMapsScript called
🗺️ [GOOGLE MAPS] API Key exists: true
📦 [GOOGLE MAPS] Creating new script tag...
📦 [GOOGLE MAPS] Appending script to document head...
```

✅ **Callback Fired (Critical!):**
```
✅ [GOOGLE MAPS] Callback fired - Google Maps is ready!
✅ [GOOGLE MAPS] window.google exists: true
✅ [GOOGLE MAPS] window.google.maps exists: true
✅ [GOOGLE MAPS] window.google.maps.Map exists: true  👈 THIS MUST BE TRUE
🔄 [GOOGLE MAPS] Attempting to initialize map...
🔄 [GOOGLE MAPS] mapRef.current exists: true
```

✅ **Map Initialization:**
```
🗺️ [MAP INIT] Starting map initialization...
🗺️ [MAP INIT] window.google.maps.Map exists: true  👈 THIS MUST BE TRUE
🗺️ [MAP INIT] All checks passed - creating map instance...
✅ [MAP INIT] Map instance created successfully
✅ [MAP INIT] Marker created successfully
✅ [MAP INIT] Map fully initialized and ready to use
```

✅ **Success Toast:**
You should see: **"Map loaded successfully! Click or drag to set your location."**

## 🚨 If It Still Doesn't Work

### Debug Step 1: Check API Key
Open browser console and type:
```javascript
import.meta.env.VITE_GOOGLE_MAPS_API_KEY
```

**Expected:** Should return your API key string (e.g., `"AIzaSyB..."`)  
**If undefined:** API key is not set in environment

### Debug Step 2: Check Google Maps API Status
After script loads, type in console:
```javascript
console.log('google exists:', !!window.google);
console.log('google.maps exists:', !!window.google?.maps);
console.log('google.maps.Map exists:', !!window.google?.maps?.Map);
console.log('google.maps.Marker exists:', !!window.google?.maps?.Marker);
```

**All should be `true`**. If any are false, Google Maps API didn't load correctly.

### Debug Step 3: Check Network Tab
1. Open DevTools → Network tab
2. Filter for "maps.googleapis.com"
3. Look for the API request
4. Check the response:
   - **Status 200 OK:** ✅ Good
   - **Status 403 Forbidden:** ❌ API key restrictions (see below)
   - **Status 400 Bad Request:** ❌ Invalid API key

### Debug Step 4: Common Issues

#### Issue A: RefererNotAllowedMapError
**Error in console:** `RefererNotAllowedMapError`

**Solution:**
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. APIs & Services → Credentials
3. Click on your API key
4. Under "Application restrictions":
   - Select "HTTP referrers (web sites)"
   - Add these referrers:
     ```
     *.supabase.co/*
     *.figma.com/*
     localhost:*
     ```
5. Click "Save"
6. Wait 5 minutes for changes to propagate

#### Issue B: Maps JavaScript API Not Enabled
**Error in console:** `This API project is not authorized to use this API`

**Solution:**
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. APIs & Services → Library
3. Search for "Maps JavaScript API"
4. Click "Enable"
5. Wait 1-2 minutes

#### Issue C: Billing Not Enabled
**Error in console:** `You must enable Billing on the Google Cloud Project`

**Solution:**
1. Google Maps requires billing to be enabled (even for free tier)
2. Go to [Google Cloud Console](https://console.cloud.google.com/)
3. Billing → Link a billing account
4. Note: Google provides $200 free credit per month

#### Issue D: Quota Exceeded
**Error in console:** `You have exceeded your request quota`

**Solution:**
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. APIs & Services → Dashboard
3. Click "Maps JavaScript API"
4. Check quotas and limits
5. Either wait for quota reset or increase limits

## 🎯 Expected Behavior When Working

1. **Map Loads:** You see an interactive Google Map centered on India
2. **Marker Visible:** Orange marker at center of India
3. **Click to Place:** Click anywhere on map → marker moves there + toast "Location updated!"
4. **Drag to Move:** Drag marker → coordinates update + toast "Location updated!"
5. **Location Box:** Green "Location Pinned" box appears showing lat/lng
6. **Detect Location:** Button works if geolocation permission granted

## 📞 Still Not Working?

1. **Copy ENTIRE console log** (from page load to error)
2. **Screenshot** the map area showing the error
3. **Check Network tab** for the Google Maps API request and share the response
4. **Verify** your Google Cloud Project has:
   - Maps JavaScript API enabled
   - Valid API key
   - Billing enabled
   - Correct HTTP referrer restrictions

## 💡 Alternative: Use Backend API Key

If environment variable is not working, you can configure the API key in the backend:

1. Go to Admin Panel → Integrations
2. Find "Google Maps" section
3. Enter your API key
4. Save

The code will automatically fetch from backend if `VITE_GOOGLE_MAPS_API_KEY` is not set.

---

**Last Updated:** December 18, 2024  
**Fix Version:** v2.0 with callback pattern  
**Files Modified:** `/components/vendor/DynamicVendorOnboardingForm.tsx`
