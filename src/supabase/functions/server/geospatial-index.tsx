/**
 * 🌍 GEOSPATIAL INDEXING SYSTEM - SQL MIGRATION
 * 
 * ✅ SQL MIGRATION: All KV operations replaced with SQL repositories
 * 
 * Provides location-based search using PostgreSQL.
 * Uses a Grid-based indexing strategy (Geohash-like) stored in SQL.
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
 * ✅ SQL: Uses geospatial_index and provider_locations tables
 */
export async function updateProviderLocationIndex(db: any, providerId: string, lat: number, lng: number, type: string) {
    // ✅ SQL: 1. Remove from old index if exists
    const { data: oldLocation } = await db
        .from('provider_locations')
        .select('*')
        .eq('provider_id', providerId)
        .single();
    
    if (oldLocation) {
        const oldKey = getGeoGridKey(oldLocation.latitude, oldLocation.longitude);
        // Remove from old grid index
        await db
            .from('geospatial_index')
            .update({
                provider_ids: db.raw('array_remove(provider_ids, ?)', [providerId]),
                updated_at: new Date().toISOString()
            })
            .eq('grid_key', oldKey);
    }

    // ✅ SQL: 2. Add to new index
    const newKey = getGeoGridKey(lat, lng);
    const { data: existingGrid } = await db
        .from('geospatial_index')
        .select('*')
        .eq('grid_key', newKey)
        .single();
    
    if (existingGrid) {
        const providerIds = existingGrid.provider_ids || [];
        if (!providerIds.includes(providerId)) {
            providerIds.push(providerId);
            await db
                .from('geospatial_index')
                .update({
                    provider_ids: providerIds,
                    updated_at: new Date().toISOString()
                })
                .eq('grid_key', newKey);
        }
    } else {
        await db
            .from('geospatial_index')
            .insert({
                grid_key: newKey,
                provider_ids: [providerId],
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            });
    }

    // ✅ SQL: 3. Update provider's stored location reference
    await db
        .from('provider_locations')
        .upsert({
            provider_id: providerId,
            latitude: lat,
            longitude: lng,
            provider_type: type,
            updated_at: new Date().toISOString()
        }, {
            onConflict: 'provider_id'
        });
    
    // ✅ SQL: 4. Update Type-Specific Index (provider_types table)
    const { data: typeIndex } = await db
        .from('provider_types')
        .select('*')
        .eq('provider_type', type)
        .single();
    
    if (typeIndex) {
        const providerIds = typeIndex.provider_ids || [];
        if (!providerIds.includes(providerId)) {
            providerIds.push(providerId);
            await db
                .from('provider_types')
                .update({
                    provider_ids: providerIds,
                    updated_at: new Date().toISOString()
                })
                .eq('provider_type', type);
        }
    } else {
        await db
            .from('provider_types')
            .insert({
                provider_type: type,
                provider_ids: [providerId],
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            });
    }
}

/**
 * Find providers near a location
 * ✅ SQL: Uses geospatial_index and provider_locations tables
 * @param radiusKm (Approximate, used to determine grid span)
 */
export async function findProvidersNearby(db: any, lat: number, lng: number, type: string, radiusKm: number = 20) {
    // ✅ SQL: 1. Determine grids to search
    const gridKeys = getAdjacentGridKeys(lat, lng);
    
    // ✅ SQL: 2. Fetch all IDs from these grids
    const { data: gridIndexes } = await db
        .from('geospatial_index')
        .select('*')
        .in('grid_key', gridKeys);
    
    const providerIds = new Set<string>();
    for (const grid of gridIndexes || []) {
        const ids = grid.provider_ids || [];
        ids.forEach((id: string) => providerIds.add(id));
    }

    // ✅ SQL: 3. Fetch Provider Locations & Filter by Type and Exact Distance
    const providers = Array.from(providerIds);
    if (providers.length === 0) return [];
    
    const { data: locations } = await db
        .from('provider_locations')
        .select('*')
        .in('provider_id', providers)
        .eq('provider_type', type);
    
    const results = [];
    for (const loc of locations || []) {
        // Calculate Distance (Haversine Formula)
        const dist = calculateDistance(lat, lng, loc.latitude, loc.longitude);
        
        if (dist <= radiusKm) {
            // ✅ SQL: Fetch full vendor/provider details
            const { data: vendor } = await db
                .from('vendors')
                .select('*')
                .eq('id', loc.provider_id)
                .single();
            
            if (vendor) {
                results.push({
                    ...vendor,
                    distance: dist,
                    location: { lat: loc.latitude, lng: loc.longitude }
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
