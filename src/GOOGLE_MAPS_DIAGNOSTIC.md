# Google Maps Integration Diagnostic Guide

## 🔍 Issue
Google Maps not loading on Dynamic Vendor Onboarding Form - "Detect Location" button says "wait while map gets loaded" but map never loads.

## ✅ Fixes Applied

### 1. **Simplified Google Maps Script Loading**
- Removed complex `loading=async` and `libraries=marker` parameters that were causing issues
- Added comprehensive logging at every step
- Added timeout protection (10 seconds)
- Better error messages for users

**Location:** `/components/vendor/DynamicVendorOnboardingForm.tsx` - `loadGoogleMapsScript()` function

### 2. **Simplified Map Initialization**
- Removed complex `importLibrary` approach that was failing
- Using direct `window.google.maps.Map` and `window.google.maps.Marker`
- Clearer error handling and success messages
- Toast notifications for user feedback

**Location:** `/components/vendor/DynamicVendorOnboardingForm.tsx` - `initializeMap()` function

### 3. **Enhanced API Key Fetching**
- Added comprehensive logging for environment variable check
- Added logging for backend API key fetch
- Shows exact API key length and first 10 characters for debugging
- Clear error messages when API key is not found

**Location:** `/components/vendor/DynamicVendorOnboardingForm.tsx` - `fetchGoogleMapsKey()` function

### 4. **Improved UI Feedback**
- Shows different loading states based on API key availability
- Yellow warning when API key is not configured
- Loading spinner when map is initializing
- Success message when map loads
- Helpful hint overlay when map is ready

**Location:** `/components/vendor/DynamicVendorOnboardingForm.tsx` - Map rendering UI

### 5. **Created Test Component**
A diagnostic component to verify Google Maps integration independently.

**Location:** `/components/test/GoogleMapsTest.tsx`

**Usage:**
```tsx
import { GoogleMapsTest } from './components/test/GoogleMapsTest';

// Add to your app temporarily for testing
<GoogleMapsTest />
```

## 🔧 How to Verify Google Maps API Key

### Method 1: Check Environment Variable
1. Open browser console on the vendor onboarding page
2. Look for logs starting with `🔍 [ENV]`
3. You should see:
   ```
   🔍 [ENV] Checking for environment variable...
   🔍 [ENV] import.meta exists: true
   🔍 [ENV] import.meta.env exists: true
   🔍 [ENV] envApiKey exists: true
   🔍 [ENV] envApiKey value: AIzaSyB...
   ✅ [ENV] Using Google Maps API key from environment variable
   ```

### Method 2: Check Backend Settings
1. Open browser console
2. Look for logs starting with `🔑 [API KEY]`
3. You should see:
   ```
   🔑 [API KEY] Fetching Google Maps API key from backend...
   🔑 [API KEY] Response status: 200
   ✅ [API KEY] Found API key in backend settings
   🔑 [API KEY] Key length: 39
   ```

### Method 3: Use Test Component
1. Import and render `<GoogleMapsTest />` component
2. It will show visual indicators for:
   - ✅ Environment variable status
   - ✅ Backend KV store status
   - ✅ Script loading status
   - ✅ Map initialization status
3. Click "Test Load Google Maps" button to verify

## 📋 Complete Diagnostic Checklist

Run through these in order:

### Step 1: Verify API Key Exists
- [ ] Check browser console for `🔍 [ENV]` logs
- [ ] Verify `VITE_GOOGLE_MAPS_API_KEY` environment variable is set
- [ ] OR verify backend returns API key (check `🔑 [API KEY]` logs)

### Step 2: Verify Script Loading
- [ ] Check browser console for `🗺️ [GOOGLE MAPS]` logs
- [ ] Look for "Creating new script tag..."
- [ ] Look for "Script onload fired"
- [ ] Look for "Fully initialized and ready"
- [ ] Verify no error logs with ❌

### Step 3: Verify Map Initialization
- [ ] Check browser console for `🗺️ [MAP INIT]` logs
- [ ] Look for "Map instance created successfully"
- [ ] Look for "Marker created successfully"
- [ ] Look for "Map fully initialized and ready to use"
- [ ] Verify you see success toast: "Map loaded successfully!"

### Step 4: Test Map Interaction
- [ ] Map should be visible (not showing loading spinner)
- [ ] Click anywhere on map - marker should move
- [ ] Drag marker - coordinates should update
- [ ] You should see toast "Location updated!"
- [ ] Green "Location Pinned" box should appear below map

## 🚨 Common Issues & Solutions

### Issue 1: "Google Maps API key not configured"
**Symptoms:**
- Yellow warning box instead of map
- Console shows: `❌ [GOOGLE MAPS] No API key available`

**Solution:**
```bash
# Set environment variable
export VITE_GOOGLE_MAPS_API_KEY="your-api-key-here"

# OR configure in backend via Admin panel:
# Navigate to Admin > Integrations > Google Maps
# Enter your API key and save
```

### Issue 2: "Map loading timed out"
**Symptoms:**
- Loading spinner shows for 10+ seconds
- Console shows: `❌ [GOOGLE MAPS] Timeout waiting for existing script to load`

**Solutions:**
1. Check internet connection
2. Verify API key is valid
3. Check Google Cloud Console for API restrictions
4. Ensure Maps JavaScript API is enabled
5. Refresh the page

### Issue 3: Script loads but map doesn't initialize
**Symptoms:**
- Console shows script loaded but no map appears
- Console shows: `❌ [MAP INIT] Google Maps API not loaded`

**Solutions:**
1. Wait a few more seconds (sometimes takes time)
2. Check browser console for any errors
3. Verify API key has Maps JavaScript API enabled
4. Check for CORS or CSP errors in Network tab

### Issue 4: "RefererNotAllowedMapError"
**Symptoms:**
- Error in console about referer
- Map shows gray box with error message

**Solutions:**
1. Go to Google Cloud Console
2. APIs & Services > Credentials
3. Edit your API key
4. Under "Application restrictions":
   - Select "HTTP referrers"
   - Add your domain (e.g., `*.supabase.co/*`)
   - Add `localhost` for testing
5. Save and wait 5 minutes for changes to propagate

### Issue 5: API key in backend but not loading
**Symptoms:**
- Backend returns API key
- Environment variable is empty
- Map still doesn't load

**Solution:**
The code will automatically use backend key if env var is not available. Check console logs to verify the backend key is being used:
```
⚠️ [ENV] No environment variable found, fetching from backend...
✅ [API KEY] Found API key in backend settings
```

## 🎯 Expected Console Log Flow (Success)

When everything works correctly, you should see this in console:

```
🚀 [INIT] Component mounted, starting initialization...
🔍 [ENV] Checking for environment variable...
🔍 [ENV] import.meta exists: true
🔍 [ENV] import.meta.env exists: true
🔍 [ENV] envApiKey exists: true
✅ [ENV] Using Google Maps API key from environment variable
🔄 [API KEY EFFECT] googleMapsApiKey changed: true
🔄 [API KEY EFFECT] Calling loadGoogleMapsScript...
🗺️ [GOOGLE MAPS] loadGoogleMapsScript called
🗺️ [GOOGLE MAPS] API Key exists: true
🗺️ [GOOGLE MAPS] API Key length: 39
📦 [GOOGLE MAPS] Creating new script tag...
📦 [GOOGLE MAPS] Using API key: AIzaSyB...
📦 [GOOGLE MAPS] Appending script to document head...
✅ [GOOGLE MAPS] Script onload fired
✅ [GOOGLE MAPS] Fully initialized and ready
🗺️ [MAP INIT] Starting map initialization...
🗺️ [MAP INIT] mapRef.current exists: true
🗺️ [MAP INIT] window.google exists: true
🗺️ [MAP INIT] window.google.maps exists: true
🗺️ [MAP INIT] Creating map instance...
✅ [MAP INIT] Map instance created successfully
🗺️ [MAP INIT] Creating marker...
✅ [MAP INIT] Marker created successfully
✅ [MAP INIT] Map fully initialized and ready to use
```

## 📞 Still Having Issues?

If you've gone through all the above and maps still don't load:

1. **Copy all console logs** and share with support
2. **Run the Test Component** and screenshot the results
3. **Check Network Tab** in browser DevTools:
   - Look for request to `maps.googleapis.com`
   - Check if it returns 200 OK or an error
   - Share the response if error

4. **Verify Google Cloud Project**:
   - Maps JavaScript API is enabled
   - API key is not restricted or has correct restrictions
   - Billing is enabled (required for Google Maps)
   - No quota limits hit

## 🎉 Success Indicators

You'll know everything is working when you see:

1. ✅ Map renders with India visible
2. ✅ Orange marker in center of India
3. ✅ Click anywhere → marker moves + toast "Location updated!"
4. ✅ Drag marker → coordinates update + toast "Location updated!"
5. ✅ Green "Location Pinned" box shows below map
6. ✅ "Detect Location" button works (if geolocation is enabled)
7. ✅ No red errors in console
8. ✅ All console logs show ✅ green checkmarks

---

**Last Updated:** December 18, 2024
**Component:** DynamicVendorOnboardingForm
**Integration:** Google Maps JavaScript API
