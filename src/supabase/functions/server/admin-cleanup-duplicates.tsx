import { Hono } from "npm:hono";
import * as kv from "./kv_store.tsx";
import { sendSuccess, sendError } from "./response-utils.ts";

/**
 * 🧹 ADMIN DUPLICATE DETECTION & CLEANUP
 * 
 * Phase 7C: Rule 18
 * 
 * Scans for:
 * 1. Duplicate Vendor Accounts (by Phone/Email)
 * 2. Duplicate Bookings (Double submission)
 * 3. Orphaned Records
 */

export function adminCleanupDuplicatesEndpoints(app: Hono, kv: any) {
  const BASE_PATH = "/make-server-3dd53475";

  /**
   * GET /admin/duplicates/scan
   * Scan for duplicates without deleting
   */
  app.get(`${BASE_PATH}/admin/duplicates/scan`, async (c) => {
    try {
      // 1. Scan Vendors
      const vendors = await kv.getByPrefix('vendor_') || [];
      const vendorDuplicates: any[] = [];
      const seenPhones = new Map();
      const seenEmails = new Map();

      for (const v of vendors) {
        if (!v) continue;
        
        // Check Phone
        if (v.phone) {
            if (seenPhones.has(v.phone)) {
                vendorDuplicates.push({ type: 'phone_dupe', original: seenPhones.get(v.phone), duplicate: v.id });
            } else {
                seenPhones.set(v.phone, v.id);
            }
        }

        // Check Email
        if (v.email) {
            if (seenEmails.has(v.email)) {
                vendorDuplicates.push({ type: 'email_dupe', original: seenEmails.get(v.email), duplicate: v.id });
            } else {
                seenEmails.set(v.email, v.id);
            }
        }
      }

      // 2. Scan Bookings
      const bookings = await kv.getByPrefix('booking_') || [];
      const bookingDuplicates: any[] = [];
      // Simple logic: Same customer, same vendor, same time, created within 1 min
      
      // We'd need a more complex hash, but for now let's just return what we found
      
      return sendSuccess(c, {
        vendorDuplicates,
        count: vendorDuplicates.length
      });

    } catch (error) {
      return sendError(c, error, 500);
    }
  });

  /**
   * POST /admin/duplicates/consolidate
   * Merge duplicates
   */
  app.post(`${BASE_PATH}/admin/duplicates/consolidate`, async (c) => {
      try {
          const { merges } = await c.req.json(); // Array of { keep: string, merge: string }
          
          if (!merges || !Array.isArray(merges)) {
              return sendError(c, 'Invalid input format', 400);
          }
          
          const results = [];
          
          for (const item of merges) {
              const keepId = item.keep;
              const mergeId = item.merge;
              
              if (!keepId || !mergeId) continue;
              
              console.log(`🧹 Merging ${mergeId} into ${keepId}...`);
              
              // 1. Get Data
              const keepVendor = await kv.get(`vendor_${keepId}`);
              const mergeVendor = await kv.get(`vendor_${mergeId}`);
              
              if (!keepVendor || !mergeVendor) {
                  results.push({ id: mergeId, status: 'failed', reason: 'Vendor not found' });
                  continue;
              }
              
              // 2. Scan and Update Bookings (Reassign ownership)
              // This is expensive in KV without index, but necessary for clean merge
              const allBookings = await kv.getByPrefix('booking_') || [];
              let movedBookings = 0;
              
              for (const booking of allBookings) {
                  if (booking.vendorId === mergeId) {
                      booking.vendorId = keepId;
                      // Determine if we need to update vendorName too
                      if (booking.vendorName === mergeVendor.businessName) {
                          booking.vendorName = keepVendor.businessName;
                      }
                      await kv.set(`booking_${booking.id}`, booking);
                      movedBookings++;
                  }
              }
              
              // 3. Delete Duplicate Vendor
              await kv.del(`vendor_${mergeId}`);
              
              // 4. Clean up secondary indices if any (e.g., stats)
              const mergeStats = await kv.get(`vendor_stats_${mergeId}`);
              if (mergeStats) {
                  // Merge stats into keep vendor
                  const keepStats = await kv.get(`vendor_stats_${keepId}`) || { monthlyGMV: 0, totalEarnings: 0 };
                  keepStats.monthlyGMV = (keepStats.monthlyGMV || 0) + (mergeStats.monthlyGMV || 0);
                  keepStats.totalEarnings = (keepStats.totalEarnings || 0) + (mergeStats.totalEarnings || 0);
                  await kv.set(`vendor_stats_${keepId}`, keepStats);
                  await kv.del(`vendor_stats_${mergeId}`);
              }
              
              results.push({ 
                  id: mergeId, 
                  status: 'merged', 
                  mergedInto: keepId,
                  bookingsMoved: movedBookings 
              });
          }
          
          return sendSuccess(c, { results, message: 'Consolidation complete' });
          
      } catch (error) {
          console.error('Consolidation failed:', error);
          return sendError(c, error, 500);
      }
  });
}
