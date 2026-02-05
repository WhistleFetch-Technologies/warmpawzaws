# Google Maps Platform Setup & Map Styles

This document describes the Google Maps APIs and configuration used across Warmpawz for **search area places**, **routes**, **tracking ETA**, **map styles**, **home services tracker**, and **delivery tracking**.

## Required APIs (Verify in Google Cloud Console)

Ensure these APIs are **enabled** in your GCP project (APIs & Services):

### Maps
- **Maps JavaScript API** – Interactive maps (vendor/customer trackers)
- **Maps Static API** – Static map images
- **Maps Embed API** – Embedded directions

### Places
- **Places API** – Search area places, address autocomplete
- **Places API (New)** – Next-gen Places
- **Places UI Kit** – Map display for place data
- **Geocoding API** – Address ↔ coordinates conversion

### Routes
- **Directions API** – Route directions
- **Distance Matrix API** – ETA and distance between points
- **Routes API** – Performance-optimized routing
- **Roads API** – Snap-to-road for GPS breadcrumbs
- **Navigation SDK** – Turn-by-turn (mobile)

## Map Styles (Tracker)

A custom **Tracker** map style (Light) is used for consistent branding across all tracking UIs.

- **Style ID**: `91ba2b86f2fafdb672497f7c`
- **Location**: Google Cloud Console → Map Management → Map Styles

### Using the Tracker Style

1. **Backend**: The config endpoint `/config/google-maps-key` returns both `apiKey` and `mapId`.
2. **Frontend**: When creating a map with `new google.maps.Map(container, { mapId: '...' })`, pass the `mapId` for cloud-based styling.
3. **Default**: If no `mapId` is configured, the backend uses the Tracker style ID by default.

## Configuration Sources

API key and map ID are resolved in this order:

1. **Database** (`platform_settings`):
   - `google_maps_api_key` – API key
   - `google_maps_map_id` – Map style ID (optional)

2. **Environment variables**:
   - `GOOGLE_MAPS_API_KEY`
   - `GOOGLE_MAPS_MAP_ID` (optional)

3. **AWS Secrets Manager**:
   - Secret `warmpawz/<env>/google-maps` (JSON): `{ "apiKey": "...", "mapId": "..." }`
   - Or legacy `google-maps/api-key` for API key only

## Components Using Google Maps

| Component | App | API | Map Style |
|-----------|-----|-----|-----------|
| AppointmentDetailModal (Start Travel map) | vendor-web | Maps JavaScript | Tracker (mapId) |
| VendorLiveTrackingPopup | customer-web | Maps JavaScript | Tracker (mapId) |
| TrackingPageClient | customer-web | Static / overlay | N/A |
| EnhancedAddressAutocomplete | admin-web | Places | N/A |
| LiveTrackingMap | customer-web | Static | N/A |
| HomeServiceTrackingManager | vendor-web | Placeholder | — |

## Backend Usage

- **Geocoding**: `backend/lambda/src/lib/utils/geocode.ts` – address → lat/lng
- **ETA / Distance**: `backend/lambda/src/lib/services/gps-tracking-service.ts` – Distance Matrix + Directions
- **Config**: `backend/lambda/src/endpoints/admin-integrations.ts` – `/config/google-maps-key` returns `apiKey` and `mapId`

## Enabling Map Styles for New Trackers

To apply the Tracker map style to a new map component:

1. Fetch config: `GET /config/google-maps-key` → `{ apiKey, mapId }`
2. Load Maps JS: `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=geometry,places`
3. Create map: `new google.maps.Map(container, { mapId: response.mapId, ... })`

## AWS Secrets Manager (Optional but Recommended)

**Required when:** API key is not in database/platform_settings and Lambda needs to fetch from Secrets Manager.

### Option A: JSON secret (recommended – supports both apiKey and mapId)

1. Create/update secret in AWS Secrets Manager:
   - **Secret name:** `warmpawz/<env>/google-maps` (e.g. `warmpawz/dev/google-maps`)
   - **Secret value (JSON):**
   ```json
   {
     "apiKey": "AIza...",
     "mapId": "91ba2b86f2fafdb672497f7c"
   }
   ```

2. Or run the setup script (supports JSON format):
   ```bash
   ./scripts/setup-google-maps-secret.sh
   ```

### Option B: Legacy API key only

- **Secret name:** `warmpawz/<env>/google-maps/api-key`
- **Secret value:** Plain API key string

When using Option B, the backend falls back to the default Tracker map style ID.

---

## Next Steps

- **Deploy vendor-web** for Start Travel map style: `./scripts/deploy-vendor-web.sh`
- **Deploy customer-web** for tracking popup map style: `./scripts/deploy-customer-web.sh`
- **AWS Secrets Manager** – If API key is not in database, run:
  ```bash
  ./scripts/setup-google-maps-secret.sh <api-key> [map-id] [stage]
  ```
  Or create `warmpawz/<env>/google-maps` secret with JSON: `{ "apiKey": "...", "mapId": "..." }`
