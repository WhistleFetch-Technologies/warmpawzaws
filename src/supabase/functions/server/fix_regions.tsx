
import { Hono } from "npm:hono";
import * as kv from "./kv_store.tsx";
import { Region } from "./region-types.tsx";

export async function fixDuplicateRegions() {
  console.log('🌍 [REGION FIX] Checking for duplicate regions...');
  
  try {
    // 1. Get all regions
    const regions = await kv.getByPrefix<Region>('region_');
    console.log(`🌍 [REGION FIX] Found ${regions.length} regions.`);
    
    // 2. Group by Region Code or Name to find duplicates
    const indiaRegions = regions.filter(r => r.regionCode === 'IN' || r.regionName === 'India');
    
    if (indiaRegions.length > 1) {
      console.log(`⚠️ [REGION FIX] Found ${indiaRegions.length} India regions! Fixing...`);
      
      // Identify the correct one (prefer 'region_india' as ID)
      let correctRegion = indiaRegions.find(r => r.regionId === 'india');
      const incorrectRegions = indiaRegions.filter(r => r.regionId !== 'india');
      
      if (!correctRegion) {
        // If 'india' ID doesn't exist, pick the first active one and rename/move it
        correctRegion = indiaRegions.find(r => r.isActive) || indiaRegions[0];
        console.log(`⚠️ [REGION FIX] 'region_india' not found. using ${correctRegion.regionId} as base.`);
        
        // Create correct region
        const newIndiaRegion = {
          ...correctRegion,
          regionId: 'india',
          isActive: true
        };
        await kv.set('region_india', newIndiaRegion);
        console.log(`✅ [REGION FIX] Created 'region_india'.`);
      } else {
        // Ensure correct region is active
        if (!correctRegion.isActive) {
          correctRegion.isActive = true;
          await kv.set('region_india', correctRegion);
          console.log(`✅ [REGION FIX] Activated 'region_india'.`);
        }
      }
      
      // Delete incorrect regions
      for (const badRegion of incorrectRegions) {
        console.log(`🗑️ [REGION FIX] Deleting duplicate region: ${badRegion.regionId}`);
        await kv.del(`region_${badRegion.regionId}`);
      }
      
    } else if (indiaRegions.length === 1) {
        const r = indiaRegions[0];
        if (!r.isActive || r.regionId !== 'india') {
             console.log(`⚠️ [REGION FIX] Found single India region but needs fix. ID: ${r.regionId}, Active: ${r.isActive}`);
             const fixed = { ...r, regionId: 'india', isActive: true };
             await kv.set('region_india', fixed);
             if (r.regionId !== 'india') {
                 await kv.del(`region_${r.regionId}`);
             }
             console.log(`✅ [REGION FIX] Standardized India region.`);
        } else {
            console.log(`✅ [REGION FIX] India region appears correct.`);
        }
    } else {
        console.log(`⚠️ [REGION FIX] No India region found!`);
    }
    
    // Check other regions (ensure duplicates don't exist for others too)
    // ... (omitted for brevity as user specifically mentioned IN regions)
    
  } catch (error) {
    console.error('❌ [REGION FIX] Error:', error);
  }
}

export function registerRegionFix(app: Hono) {
    app.post('/make-server-3dd53475/fix/regions', async (c) => {
        await fixDuplicateRegions();
        return c.json({ success: true, message: 'Region fix executed. Check logs.' });
    });
}
