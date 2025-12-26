/**
 * ============================================================================
 * GEOSPATIAL INDEXING SYSTEM - SQL-ONLY VERSION
 * ============================================================================
 * 
 * ✅ SQL-ONLY: Removed all KV usage, using SQL repositories only
 * 
 * Provides location-based search using PostgreSQL PostGIS or distance calculations
 * Uses a Grid-based indexing strategy for efficient location queries
 * 
 * CHANGES:
 * - Removed `kv` parameter from function signatures
 * - Replaced all `kv.get()`, `kv.set()` with SQL queries
 * - Uses `vendors` table with latitude/longitude columns
 * - Uses `platform_settings` for grid indexes (or direct SQL distance queries)
 * 
 * Date: 2025-01-28
 * Migration: Batch 16 - KV to SQL (11 KV operations removed)
 * ============================================================================
 */

import { getDbClient } from '../../lib/db.ts';

const db = getDbClient();

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
export async function updateProviderLocationIndex(providerId: string, lat: number, lng: number, type: string) {
    // ✅ SQL: Update vendor location directly
    await db
        .from('vendors')
        .update({
            latitude: lat,
            longitude: lng,
            updated_at: new Date().toISOString()
        })
        .eq('id', providerId);
    
    // ✅ SQL: Store provider location reference in platform_settings
    await db
        .from('platform_settings')
        .upsert({
            setting_key: `provider_loc:${providerId}`,
            setting_value: { lat, lng, type, updatedAt: new Date().toISOString() },
            setting_type: 'object'
        }, {
            onConflict: 'setting_key'
        });
    
    // ✅ SQL: Update Type-Specific Index
    const { data: typeIndexSetting } = await db
        .from('platform_settings')
        .select('setting_value')
        .eq('setting_key', `provider_type_index:${type}`)
        .single();
    
    const typeIndex = typeIndexSetting?.setting_value?.providerIds || [];
    if (!typeIndex.includes(providerId)) {
        typeIndex.push(providerId);
        await db
            .from('platform_settings')
            .upsert({
                setting_key: `provider_type_index:${type}`,
                setting_value: { providerIds: typeIndex },
                setting_type: 'object'
            }, {
                onConflict: 'setting_key'
            });
    }
}

/**
 * Find providers near a location using SQL distance calculation
 * @param radiusKm (Approximate, used to determine grid span)
 */
export async function findProvidersNearby(lat: number, lng: number, type: string, radiusKm: number = 20) {
    // ✅ SQL: Use Haversine formula in SQL to find nearby providers
    // Calculate distance using SQL (PostgreSQL supports this)
    const { data: providers, error } = await db
        .from('vendors')
        .select(`
            *,
            (
                6371 * acos(
                    cos(radians(${lat})) *
                    cos(radians(latitude)) *
                    cos(radians(longitude) - radians(${lng})) +
                    sin(radians(${lat})) *
                    sin(radians(latitude))
                )
            ) as distance
        `)
        .eq('is_active', true)
        .not('latitude', 'is', null)
        .not('longitude', 'is', null);
    
    if (error) {
        console.error('Error finding nearby providers:', error);
        return [];
    }
    
    // Filter by type and radius
    const results = (providers || [])
        .filter((p: any) => {
            // Check type from metadata or specialization
            const providerType = p.metadata?.serviceType || p.specialization;
            if (providerType !== type) return false;
            
            // Filter by radius
            const distance = parseFloat(p.distance || '999999');
            return distance <= radiusKm;
        })
        .map((p: any) => ({
            ...p,
            distance: parseFloat(p.distance || '0'),
            location: {
                lat: p.latitude,
                lng: p.longitude
            }
        }))
        .sort((a: any, b: any) => a.distance - b.distance);
    
    return results;
}

// Helper: Haversine Distance in KM (for client-side calculations if needed)
export function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
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

