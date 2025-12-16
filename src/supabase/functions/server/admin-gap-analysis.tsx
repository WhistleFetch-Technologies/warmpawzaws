import { Hono } from "npm:hono";
import { sendSuccess, sendError } from "./response-utils.ts";

/**
 * 📊 ADMIN GAP ANALYSIS & IMPLEMENTATION TRACKING
 * 
 * Rule 18: Complete Missing Pieces Analysis
 * 
 * Analyzes production data to find business rule gaps.
 */

export function adminGapAnalysisEndpoints(app: Hono, kv: any) {
  const BASE_PATH = "/make-server-3dd53475";

  /**
   * GET /admin/analysis/gaps
   * Analyze system for implementation gaps based on data population
   */
  app.get(`${BASE_PATH}/admin/analysis/gaps`, async (c) => {
    try {
      console.log('🔍 Starting Gap Analysis...');
      
      const gaps = [];
      const stats: any = {
          vendors: 0,
          bookings: 0,
          services: 0
      };

      // 1. Fetch Core Data
      const allVendors = await kv.getByPrefix('vendor_') || [];
      const allBookings = await kv.getByPrefix('booking_') || [];
      const allServices = await kv.getByPrefix('service_') || []; // If services stored separately

      stats.vendors = allVendors.length;
      stats.bookings = allBookings.length;

      // 2. Rule 2: Home Services Analysis
      const homeServiceVendors = allVendors.filter((v: any) => v.serviceType === 'home' || v.services?.includes('home'));
      if (homeServiceVendors.length === 0) {
          gaps.push({ rule: 2, severity: 'critical', message: 'No Home Service Vendors found' });
      }

      // 3. Rule 3: Tele Services Analysis
      const teleVendors = allVendors.filter((v: any) => v.serviceType === 'tele' || v.services?.includes('tele'));
      if (teleVendors.length === 0) {
          gaps.push({ rule: 3, severity: 'critical', message: 'No Tele-Consultation Vendors found' });
      } else {
          // Check for instant capability
          const instantCapable = teleVendors.filter((v: any) => v.instantTeleEnabled === true);
          if (instantCapable.length === 0) {
              gaps.push({ rule: 3, severity: 'high', message: 'No Vendors enabled for Instant Tele-Consultation' });
          }
      }

      // 4. Rule 6: Integrated Services
      const ambulance = allVendors.filter((v: any) => v.serviceType === 'ambulance');
      if (ambulance.length === 0) gaps.push({ rule: 6, severity: 'high', message: 'No Ambulance Providers' });

      // 5. Rule 15: Bank Verification
      // Check count of verified banks
      const verifiedBanks = await kv.getByPrefix('vendor_tier_data_') || [];
      const verifiedCount = verifiedBanks.filter((v: any) => v.value.bankVerified).length;
      if (verifiedCount === 0 && allVendors.length > 0) {
          gaps.push({ rule: 15, severity: 'medium', message: 'Zero vendors with verified bank accounts' });
      }

      // 6. Rule 13: Holidays
      const holidayPackages = await kv.getByPrefix('package_holiday_') || [];
      if (holidayPackages.length === 0) {
          gaps.push({ rule: 13, severity: 'high', message: 'No Holiday Packages created' });
      }

      // 7. Rule 7: Breeder Profiles
      const breederProfiles = await kv.getByPrefix('breeder_profile_') || [];
      if (breederProfiles.length === 0) {
           gaps.push({ rule: 7, severity: 'medium', message: 'No Breeder/Puppy Profiles found' });
      }

      return sendSuccess(c, {
          timestamp: new Date().toISOString(),
          totalGaps: gaps.length,
          stats,
          gaps
      });

    } catch (error) {
      console.error('Gap analysis failed:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * GET /admin/analysis/progress
   * Track implementation progress percentage
   */
  app.get(`${BASE_PATH}/admin/analysis/progress`, async (c) => {
      // Mock progress based on enabled features flags or DB presence
      return sendSuccess(c, {
          overallProgress: 78,
          breakdown: {
              'Core Booking': 95,
              'Home Services': 80,
              'Tele Services': 70,
              'Integrated Services': 90,
              'Payments': 85,
              'Admin': 60
          }
      });
  });

  /**
   * POST /admin/analysis/prioritize
   * Prioritize gaps for implementation
   */
  app.post(`${BASE_PATH}/admin/analysis/prioritize`, async (c) => {
      try {
          const { priorities } = await c.req.json(); // Array of { ruleId, priority }
          
          if (!priorities || !Array.isArray(priorities)) {
              return sendError(c, 'Invalid input format', 400);
          }
          
          await kv.set('admin_gap_priorities', {
              priorities,
              updatedAt: new Date().toISOString()
          });
          
          return sendSuccess(c, { message: 'Priorities updated' });
      } catch (e) {
          return sendError(c, e, 500);
      }
  });
}
