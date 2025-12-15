/**
 * 🌍 GEOSPATIAL INDEXING SYSTEM (Simulated for KV Store)
 * 
 * Provides "Enterprise Grade" location-based search without a geospatial DB.
 * Uses a Grid-based indexing strategy (Geohash-like).
 * 
 * Grid Size: Approx 5km x 5km cells.
 * Lat/Lng are rounded to 2 decimal places (approx 1.1km precision) for bucketing.
 */

// Helper: Generate Grid Key for a location
export function getGeoGridKey(lat: number, lng: number): string {
    const latGrid = Math.floor(lat * 10) / 10; // 0.1 deg precision (~11km)
    const lngGrid = Math.floor(lng * 10) / 10;
    return `geo_index:${latGrid.toFixed(1)}:${lngGrid.toFixed(1)}`;
}

// Helper: Get adjacent grid keys (3x3 grid) for wider search
export function getAdjacentGridKeys(lat: number, lng: number): string[] {
    const latGrid = Math.floor(lat * 10) / 10;
    const lngGrid = Math.floor(lng * 10) / 10;
    
    const keys = [];
    for (let x = -1; x <= 1; x++) {
        for (let y = -1; y <= 1; y++) {
            const adjLat = (latGrid + (x * 0.1)).toFixed(1);
            const adjLng = (lngGrid + (y * 0.1)).toFixed(1);
            keys.push(`geo_index:${adjLat}:${adjLng}`);
        }
    }
    return keys;
}

// --------------------------------------------------------
// CORE FUNCTIONS
// --------------------------------------------------------

/**
 * Update the location index for a provider
 */
export async function updateProviderLocationIndex(kv: any, providerId: string, lat: number, lng: number, type: string) {
    // 1. Remove from old index if exists
    const oldLocation = await kv.get(`provider_loc:${providerId}`);
    if (oldLocation) {
        const oldKey = getGeoGridKey(oldLocation.lat, oldLocation.lng);
        const oldIndex = await kv.get(oldKey) || [];
        const filtered = oldIndex.filter((id: string) => id !== providerId);
        await kv.set(oldKey, filtered);
    }

    // 2. Add to new index
    const newKey = getGeoGridKey(lat, lng);
    const newIndex = await kv.get(newKey) || [];
    if (!newIndex.includes(providerId)) {
        newIndex.push(providerId);
        await kv.set(newKey, newIndex);
    }

    // 3. Update provider's stored location reference
    await kv.set(`provider_loc:${providerId}`, { lat, lng, type, updatedAt: new Date().toISOString() });
    
    // 4. Update Type-Specific Index (e.g., 'ambulance', 'lab')
    // We maintain a list of ALL providers of a certain type for fallback
    const typeIndex = await kv.get(`provider_type_index:${type}`) || [];
    if (!typeIndex.includes(providerId)) {
        typeIndex.push(providerId);
        await kv.set(`provider_type_index:${type}`, typeIndex);
    }
}

/**
 * Find providers near a location
 * @param radiusKm (Approximate, used to determine grid span)
 */
export async function findProvidersNearby(kv: any, lat: number, lng: number, type: string, radiusKm: number = 20) {
    // 1. Determine grids to search
    // For simplicity, we search the 3x3 grid around the user (approx 30x30km area coverage)
    const gridKeys = getAdjacentGridKeys(lat, lng);
    
    // 2. Fetch all IDs from these grids
    const providerIds = new Set<string>();
    
    // Parallel fetch for speed
    // Note: In Deno KV, we might need to loop. 
    // Assuming `kv` wrapper has basic get.
    
    for (const key of gridKeys) {
        const ids = await kv.get(key) || [];
        ids.forEach((id: string) => providerIds.add(id));
    }

    // 3. Fetch Provider Details & Filter by Type and Exact Distance
    const results = [];
    const providers = Array.from(providerIds);
    
    for (const pid of providers) {
        const loc = await kv.get(`provider_loc:${pid}`);
        if (!loc) continue;

        // Check Type
        if (loc.type !== type) continue;

        // Calculate Distance (Haversine Formula)
        const dist = calculateDistance(lat, lng, loc.lat, loc.lng);
        
        if (dist <= radiusKm) {
            // Fetch full details
            const details = await kv.get(`vendor:${pid}`) || await kv.get(`independent_provider:${pid}`);
            if (details) {
                results.push({
                    ...details,
                    distance: dist,
                    location: { lat: loc.lat, lng: loc.lng }
                });
            }
        }
    }

    return results.sort((a, b) => a.distance - b.distance);
}

// Helper: Haversine Distance in KM
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Radius of the earth in km
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
        Math.sin(dLon/2) * Math.sin(dLon/2); 
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
    const d = R * c; // Distance in km
    return d;
}

function deg2rad(deg: number): number {
    return deg * (Math.PI/180);
}
