import { Hono } from "npm:hono";
import { sendSuccess, sendError } from "./response-utils.ts";

/**
 * VENDOR DASHBOARD ENDPOINTS
 * 
 * Complete API endpoints for vendor dashboard with:
 * - Real-time appointment data from customer bookings
 * - Revenue tracking (realized after service completion)
 * - Payout management (settled via admin)
 * - Dashboard statistics and analytics
 */

export function vendorDashboardEndpoints(app: Hono, kv: any) {
  
  /**
   * Get comprehensive vendor dashboard data
   * GET /make-server-3dd53475/vendor/dashboard/:vendorId
   */
  app.get("/make-server-3dd53475/vendor/dashboard/:vendorId", async (c) => {
    try {
      const { vendorId } = c.req.param();
      const timeframe = c.req.query('timeframe') || 'today'; // today, week, month
      
      // Get vendor profile
      const vendor = await kv.get(`vendor:${vendorId}`);
      if (!vendor) {
        console.log(`⚠️ Vendor not found: ${vendorId}, returning default dashboard`);
        // Return default dashboard for newly created vendors
        return sendSuccess(c, { 
          vendor: {
            vendorId,
            fullName: 'Vendor',
            businessName: null,
            vendorType: 'service_provider',
            serviceStyle: 'both',
            address: 'Location not set',
            isActive: false
          },
          stats: {
            appointments: 0,
            consultations: 0,
            earnings: 0,
            pendingEarnings: 0,
            completedServices: 0,
            rating: 4.8,
            totalReviews: 0
          },
          timeframe
        });
      }
      
      // Get all vendor bookings
      // FIX: Use correct key format - vendor:bookings:${vendorId}
      const bookingIds = await kv.get(`vendor:bookings:${vendorId}`) || [];
      
      // Initialize stats
      const stats = {
        appointments: 0,
        consultations: 0,
        earnings: 0,
        pendingEarnings: 0,
        completedServices: 0,
        rating: 0,
        totalReviews: 0
      };
      
      const now = new Date();
      const today = now.toISOString().split('T')[0];
      
      // Calculate date ranges
      let startDate = new Date();
      if (timeframe === 'today') {
        startDate = new Date(today);
      } else if (timeframe === 'week') {
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      } else if (timeframe === 'month') {
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      }
      
      // Process bookings
      for (const bookingId of bookingIds) {
        const booking = await kv.get(`booking:${bookingId}`);
        if (!booking) continue;
        
        const bookingDate = new Date(booking.bookingDate);
        
        // Filter by timeframe
        if (bookingDate >= startDate) {
          if (booking.status === 'confirmed' || booking.status === 'pending') {
            stats.appointments++;
          }
          
          if (booking.status === 'completed') {
            stats.completedServices++;
            stats.consultations++;
            stats.earnings += booking.price || 0;
          }
          
          if (booking.status === 'in_progress' || booking.status === 'confirmed') {
            stats.pendingEarnings += booking.price || 0;
          }
        }
      }
      
      // Get vendor rating
      const reviews = await kv.get(`vendor:${vendorId}:reviews`) || [];
      if (reviews.length > 0) {
        const totalRating = reviews.reduce((sum: number, review: any) => sum + (review.rating || 0), 0);
        stats.rating = Number((totalRating / reviews.length).toFixed(1));
        stats.totalReviews = reviews.length;
      } else {
        stats.rating = 4.8; // Default rating for new vendors
        stats.totalReviews = 0;
      }
      
      return sendSuccess(c, { 
        vendor: {
          vendorId: vendor.vendorId,
          fullName: vendor.fullName,
          businessName: vendor.businessName,
          vendorType: vendor.vendorType,
          serviceStyle: vendor.serviceStyle,
          address: vendor.address,
          phone: vendor.phone,
          email: vendor.email,
          isActive: vendor.isActive
        },
        stats,
        timeframe 
      });
    } catch (error) {
      console.error('Error fetching vendor dashboard:', error);
      return sendError(c, error, 500);
    }
  });
  
  /**
   * Get today's schedule for vendor
   * GET /make-server-3dd53475/vendor/schedule/:vendorId
   */
  app.get("/make-server-3dd53475/vendor/schedule/:vendorId", async (c) => {
    try {
      const { vendorId } = c.req.param();
      const date = c.req.query('date') || new Date().toISOString().split('T')[0];
      
      // FIX: Use correct key format - vendor:bookings:${vendorId} (not vendor:${vendorId}:bookings)
      const vendorBookingsKey = `vendor:bookings:${vendorId}`;
      const bookingIds = await kv.get(vendorBookingsKey) || [];
      
      console.log(`📅 [SCHEDULE] Vendor: ${vendorId}, Date: ${date}, BookingIDs: ${bookingIds.length}`);
      
      const schedule = [];
      
      for (const bookingId of bookingIds) {
        const booking = await kv.get(`booking:${bookingId}`);
        if (!booking) continue;
        
        // Filter by date and active statuses
        if (booking.bookingDate === date && 
            (booking.status === 'pending' || booking.status === 'confirmed' || booking.status === 'in_progress')) {
          
          // Get customer details
          const customer = await kv.get(`customer:${booking.customerId}`);
          
          schedule.push({
            id: booking.id,
            bookingId: booking.id,
            time: booking.bookingTime,
            duration: booking.duration,
            petName: booking.petName,
            petBreed: booking.petBreed,
            customerName: booking.customerName || customer?.name || 'Customer',
            customerPhone: booking.customerPhone,
            serviceName: booking.serviceName,
            serviceType: booking.serviceType,
            status: booking.status,
            price: booking.price,
            address: booking.customerAddress,
            specialInstructions: booking.specialInstructions
          });
        }
      }
      
      // Sort by time
      schedule.sort((a, b) => {
        const timeA = a.time.split(':').map(Number);
        const timeB = b.time.split(':').map(Number);
        return timeA[0] * 60 + timeA[1] - (timeB[0] * 60 + timeB[1]);
      });
      
      return sendSuccess(c, { schedule, date, total: schedule.length });
    } catch (error) {
      console.error('Error fetching vendor schedule:', error);
      return sendError(c, error, 500);
    }
  });
  
  /**
   * Get vendor revenue details
   * GET /make-server-3dd53475/vendor/revenue/:vendorId
   */
  app.get("/make-server-3dd53475/vendor/revenue/:vendorId", async (c) => {
    try {
      const { vendorId } = c.req.param();
      const timeframe = c.req.query('timeframe') || 'month';
      
      // FIX: Use correct key format - vendor:bookings:${vendorId}
      const bookingIds = await kv.get(`vendor:bookings:${vendorId}`) || [];
      
      const revenue = {
        total: 0,
        completed: 0,
        pending: 0,
        inProgress: 0,
        platformFee: 0,
        netRevenue: 0,
        breakdown: [] as any[]
      };
      
      // Platform commission rate (e.g., 15%)
      const COMMISSION_RATE = 0.15;
      
      const now = new Date();
      let startDate = new Date();
      
      if (timeframe === 'week') {
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      } else if (timeframe === 'month') {
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      } else if (timeframe === 'year') {
        startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
      }
      
      for (const bookingId of bookingIds) {
        const booking = await kv.get(`booking:${bookingId}`);
        if (!booking) continue;
        
        const bookingDate = new Date(booking.bookingDate);
        
        if (bookingDate >= startDate) {
          const amount = booking.price || 0;
          
          if (booking.status === 'completed') {
            revenue.completed += amount;
            revenue.breakdown.push({
              bookingId: booking.id,
              date: booking.bookingDate,
              service: booking.serviceName,
              customer: booking.customerName,
              amount: amount,
              status: 'completed',
              completedAt: booking.completedAt
            });
          } else if (booking.status === 'confirmed') {
            revenue.pending += amount;
          } else if (booking.status === 'in_progress') {
            revenue.inProgress += amount;
          }
          
          revenue.total += amount;
        }
      }
      
      // Calculate platform fee and net revenue (only on completed services)
      revenue.platformFee = Number((revenue.completed * COMMISSION_RATE).toFixed(2));
      revenue.netRevenue = Number((revenue.completed - revenue.platformFee).toFixed(2));
      
      // Sort breakdown by date (most recent first)
      revenue.breakdown.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      
      return sendSuccess(c, { revenue, timeframe, commissionRate: COMMISSION_RATE });
    } catch (error) {
      console.error('Error fetching vendor revenue:', error);
      return sendError(c, error, 500);
    }
  });
  
  /**
   * Get vendor payout information
   * GET /make-server-3dd53475/vendor/payouts/:vendorId
   */
  app.get("/make-server-3dd53475/vendor/payouts/:vendorId", async (c) => {
    try {
      const { vendorId } = c.req.param();
      const status = c.req.query('status'); // pending, processing, completed
      
      // Get all payouts for vendor
      const payoutIds = await kv.get(`vendor:${vendorId}:payouts`) || [];
      
      const payouts = [];
      let totalPending = 0;
      let totalProcessing = 0;
      let totalCompleted = 0;
      
      for (const payoutId of payoutIds) {
        const payout = await kv.get(`payout:${payoutId}`);
        if (!payout) continue;
        
        if (!status || payout.status === status) {
          payouts.push(payout);
        }
        
        if (payout.status === 'pending') {
          totalPending += payout.amount;
        } else if (payout.status === 'processing') {
          totalProcessing += payout.amount;
        } else if (payout.status === 'completed') {
          totalCompleted += payout.amount;
        }
      }
      
      // Sort by date (most recent first)
      payouts.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      
      return sendSuccess(c, { 
        payouts, 
        summary: {
          totalPending,
          totalProcessing,
          totalCompleted,
          count: payouts.length
        }
      });
    } catch (error) {
      console.error('Error fetching vendor payouts:', error);
      return sendError(c, error, 500);
    }
  });
  
  /**
   * Create payout request (triggered after settlement period)
   * POST /make-server-3dd53475/vendor/payouts/create
   */
  app.post("/make-server-3dd53475/vendor/payouts/create", async (c) => {
    try {
      const { vendorId, amount, bookingIds, bankDetails } = await c.req.json();
      
      if (!vendorId || !amount || !bookingIds || bookingIds.length === 0) {
        return sendError(c, 'Missing required fields', 400);
      }
      
      // Generate payout ID
      const payoutId = `payout_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      
      const payout = {
        payoutId,
        vendorId,
        amount,
        bookingIds,
        status: 'pending', // pending, processing, completed, failed
        bankDetails: bankDetails || null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        requestedAt: new Date().toISOString(),
        processedAt: null,
        completedAt: null,
        failedAt: null,
        failureReason: null,
        transactionId: null,
        adminNotes: null
      };
      
      // Save payout
      await kv.set(`payout:${payoutId}`, payout);
      
      // Add to vendor's payouts
      const vendorPayouts = await kv.get(`vendor:${vendorId}:payouts`) || [];
      vendorPayouts.unshift(payoutId);
      await kv.set(`vendor:${vendorId}:payouts`, vendorPayouts);
      
      // Add to admin's pending payouts queue
      const pendingPayouts = await kv.get(`admin:payouts:pending`) || [];
      pendingPayouts.unshift(payoutId);
      await kv.set(`admin:payouts:pending`, pendingPayouts);
      
      console.log(`✅ Payout request created: ${payoutId} for vendor ${vendorId}`);
      return sendSuccess(c, { payoutId, payout }, 'Payout request created successfully');
    } catch (error) {
      console.error('Error creating payout request:', error);
      return sendError(c, error, 500);
    }
  });
  
  /**
   * Get vendor notifications
   * GET /make-server-3dd53475/vendor/notifications/:vendorId
   */
  app.get("/make-server-3dd53475/vendor/notifications/:vendorId", async (c) => {
    try {
      const { vendorId } = c.req.param();
      const limit = parseInt(c.req.query('limit') || '10');
      
      console.log(`📬 [VENDOR-NOTIFICATIONS] Fetching notifications for vendor: ${vendorId}`);
      
      // ✅ FIX: Read from BOTH notification patterns to support both chat and admin notifications
      
      // PATTERN 1: Chat notifications (vendor:${vendorId}:notifications)
      // This is an array of notificationIds, each pointing to notification:${notifId}
      let notificationIds = [];
      try {
        notificationIds = await kv.get(`vendor:${vendorId}:notifications`) || [];
        console.log(`📬 [VENDOR-NOTIFICATIONS] Found ${notificationIds.length} chat notification IDs`);
      } catch (kvError) {
        console.error(`⚠️ [VENDOR-NOTIFICATIONS] Error fetching chat notifications:`, kvError);
        // Continue with empty array if KV fails
      }
      
      const chatNotifications = [];
      for (const notifId of notificationIds) {
        try {
          const notif = await kv.get(`notification:${notifId}`);
          if (notif) {
            chatNotifications.push({
              notificationId: notifId,
              type: notif.type,
              title: notif.title,
              message: notif.message,
              createdAt: notif.createdAt,
              read: notif.read || false,
              bookingId: notif.bookingId,
              messageId: notif.messageId,
              senderType: notif.senderType
            });
          }
        } catch (notifError) {
          console.error(`⚠️ [VENDOR-NOTIFICATIONS] Error fetching notification ${notifId}:`, notifError);
          // Continue with other notifications
        }
      }
      
      // PATTERN 2: Admin notifications (vendor_notifications:${vendorId})
      // This is an array of notification objects stored directly
      let adminNotifications = [];
      try {
        adminNotifications = await kv.get(`vendor_notifications:${vendorId}`) || [];
        console.log(`📬 [VENDOR-NOTIFICATIONS] Found ${adminNotifications.length} admin notifications`);
      } catch (kvError) {
        console.error(`⚠️ [VENDOR-NOTIFICATIONS] Error fetching admin notifications:`, kvError);
        // Continue with empty array if KV fails
      }
      
      const formattedAdminNotifications = adminNotifications.map((n: any) => ({
        notificationId: n.id,
        type: n.type,
        title: n.title,
        message: n.message,
        createdAt: n.timestamp,
        read: n.read || false,
        data: n.data
      }));
      
      // ✅ MERGE both notification types
      const allNotifications = [...chatNotifications, ...formattedAdminNotifications];
      
      // Sort by timestamp (most recent first)
      const sortedNotifications = allNotifications.sort((a: any, b: any) => {
        const dateA = new Date(a.createdAt).getTime();
        const dateB = new Date(b.createdAt).getTime();
        return dateB - dateA;
      });
      
      // Apply limit
      const limitedNotifications = sortedNotifications.slice(0, limit);
      
      console.log(`📬 [VENDOR-NOTIFICATIONS] Returning ${limitedNotifications.length} total notifications (${chatNotifications.length} chat + ${formattedAdminNotifications.length} admin)`);
      
      return sendSuccess(c, { 
        notifications: limitedNotifications, 
        total: allNotifications.length 
      });
    } catch (error) {
      console.error('Error fetching vendor notifications:', error);
      // Return empty array instead of error to prevent UI from breaking
      return sendSuccess(c, { 
        notifications: [], 
        total: 0,
        warning: 'Failed to fetch notifications due to network error'
      });
    }
  });
  
  /**
   * ⚠️ REMOVED DUPLICATE: /vendor/services/:vendorId
   * This endpoint is already implemented in vendor-onboarding.tsx with full catalog/custom service logic
   * Keeping this would override that implementation
   */
  
  /**
   * Get vendor watchlist (patients requiring follow-up)
   * GET /make-server-3dd53475/vendor/watchlist/:vendorId
   */
  app.get("/make-server-3dd53475/vendor/watchlist/:vendorId", async (c) => {
    try {
      const { vendorId } = c.req.param();
      
      const watchlistIds = await kv.get(`vendor:${vendorId}:watchlist`) || [];
      
      const watchlist = [];
      
      for (const watchlistId of watchlistIds) {
        const item = await kv.get(`watchlist:${watchlistId}`);
        if (item && item.isActive) {
          watchlist.push(item);
        }
      }
      
      // Sort by last update (most recent first)
      watchlist.sort((a, b) => new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime());
      
      return sendSuccess(c, { watchlist, total: watchlist.length });
    } catch (error) {
      console.error('Error fetching vendor watchlist:', error);
      return sendError(c, error, 500);
    }
  });
  
  /**
   * Add patient to watchlist
   * POST /make-server-3dd53475/vendor/watchlist/add
   */
  app.post("/make-server-3dd53475/vendor/watchlist/add", async (c) => {
    try {
      const { vendorId, customerId, petId, petName, issue, notes, bookingId } = await c.req.json();
      
      if (!vendorId || !customerId || !petName) {
        return sendError(c, 'Missing required fields', 400);
      }
      
      const watchlistId = `watchlist_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      
      // Get customer details
      const customer = await kv.get(`customer:${customerId}`);
      
      const watchlistItem = {
        watchlistId,
        vendorId,
        customerId,
        petId: petId || null,
        petName,
        customerName: customer?.name || 'Customer',
        issue: issue || 'Monitoring required',
        notes: notes || '',
        bookingId: bookingId || null,
        isActive: true,
        createdAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString()
      };
      
      await kv.set(`watchlist:${watchlistId}`, watchlistItem);
      
      const vendorWatchlist = await kv.get(`vendor:${vendorId}:watchlist`) || [];
      vendorWatchlist.unshift(watchlistId);
      await kv.set(`vendor:${vendorId}:watchlist`, vendorWatchlist);
      
      console.log(`✅ Patient added to watchlist: ${watchlistId}`);
      return sendSuccess(c, { watchlistId, watchlistItem }, 'Patient added to watchlist');
    } catch (error) {
      console.error('Error adding to watchlist:', error);
      return sendError(c, error, 500);
    }
  });
  
  console.log('✅ Vendor dashboard endpoints registered');

  // ============================================
  // STAFF MANAGEMENT
  // ============================================

  /**
   * GET /make-server-3dd53475/vendor/staff/:vendorId
   * Get all staff members for a vendor
   */
  app.get("/make-server-3dd53475/vendor/staff/:vendorId", async (c) => {
    try {
      const { vendorId } = c.req.param();
      
      let staffIds = await kv.get(`vendor:${vendorId}:staff`) || [];
      let staffList = [];
      
      // 1. Try loading from index
      if (staffIds.length > 0) {
        // ✅ FIX: Filter out invalid staff IDs (specifically staffsvc_ which are service records)
        const validIds = staffIds.filter((id: string) => 
          typeof id === 'string' && 
          (id.startsWith('staff_') || id.includes('_staff_self')) &&
          !id.startsWith('staffsvc_')
        );

        for (const id of validIds) {
          const staff = await kv.get(`staff:${id}`);
          // Also verify the object ID matches
          if (staff && staff.isActive !== false && !staff.id.startsWith('staffsvc_')) {
            staffList.push(staff);
          }
        }
      }
      
      // 2. ALWAYS Sync: Check for orphaned staff records to ensure list is complete
      // This fixes issues where new staff don't appear if the index is stale
      try {
        console.log(`🔍 Syncing staff list for vendor ${vendorId}...`);
        const allStaff = await kv.getByPrefix('staff:') || [];
        
        // Find staff belonging to this vendor
        const vendorStaffRecords = allStaff.filter((s: any) => 
          s.vendorId === vendorId && 
          s.isActive !== false && 
          // Exclude index entries (if any returned by getByPrefix, though usually values)
          typeof s === 'object' && s.id
        );
        
        console.log(`   Found ${vendorStaffRecords.length} active staff records in total`);
        
        // Identify missing IDs
        const missingStaff = vendorStaffRecords.filter((s: any) => !staffIds.includes(s.id));
        
        if (missingStaff.length > 0) {
          console.log(`   🔧 Found ${missingStaff.length} staff missing from index. Updating...`);
          const missingIds = missingStaff.map((s: any) => s.id);
          staffIds = [...staffIds, ...missingIds];
          
          // Update the index
          await kv.set(`vendor:${vendorId}:staff`, staffIds);
          console.log(`   ✅ Updated staff index with:`, missingIds);
          
          // Add to our list for response
          staffList.push(...missingStaff);
        } else {
           console.log(`   ✅ Index is in sync`);
        }
        
        // If staffList was empty (index was empty), populate it now
        if (staffList.length === 0 && vendorStaffRecords.length > 0) {
             staffList = vendorStaffRecords;
        }
        
      } catch (error) {
        console.error('⚠️ Error syncing staff list:', error);
        // Fallback: if sync fails, rely on what we loaded from index
      }
      
      // Deduplicate staff list (just in case)
      const uniqueStaffMap = new Map();
      for (const s of staffList) {
          if (s && s.id) uniqueStaffMap.set(s.id, s);
      }
      staffList = Array.from(uniqueStaffMap.values());
      
      return sendSuccess(c, {
        staff: staffList,
        count: staffList.length
      });
    } catch (error) {
      console.error('Error fetching vendor staff:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * POST /make-server-3dd53475/vendor/staff/add
   * Add a new staff member
   */
  app.post("/make-server-3dd53475/vendor/staff/add", async (c) => {
    try {
      const { vendorId, staffData } = await c.req.json();
      
      if (!vendorId || !staffData) {
        return sendError(c, 'Missing required fields', 400);
      }
      
      const staffId = `staff_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const newStaff = {
        id: staffId,
        vendorId,
        ...staffData,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isActive: true
      };
      
      await kv.set(`staff:${staffId}`, newStaff);
      
      // Add to vendor's staff list
      const staffIds = await kv.get(`vendor:${vendorId}:staff`) || [];
      if (!staffIds.includes(staffId)) {
        staffIds.push(staffId);
        await kv.set(`vendor:${vendorId}:staff`, staffIds);
      }
      
      return sendSuccess(c, {
        staff: newStaff
      }, 'Staff member added successfully');
    } catch (error) {
      console.error('Error adding staff:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * PUT /make-server-3dd53475/vendor/staff/:staffId
   * Update staff member
   */
  app.put("/make-server-3dd53475/vendor/staff/:staffId", async (c) => {
    try {
      const { staffId } = c.req.param();
      const updates = await c.req.json();
      
      const staff = await kv.get(`staff:${staffId}`);
      if (!staff) {
        return sendError(c, 'Staff not found', 404);
      }
      
      const updatedStaff = {
        ...staff,
        ...updates,
        updatedAt: new Date().toISOString()
      };
      
      await kv.set(`staff:${staffId}`, updatedStaff);
      
      return sendSuccess(c, {
        staff: updatedStaff
      }, 'Staff updated successfully');
    } catch (error) {
      console.error('Error updating staff:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * DELETE /make-server-3dd53475/vendor/staff/:staffId
   * Remove/Archive staff member
   */
  app.delete("/make-server-3dd53475/vendor/staff/:staffId", async (c) => {
    try {
      const { staffId } = c.req.param();
      const { vendorId } = await c.req.query();
      
      const staff = await kv.get(`staff:${staffId}`);
      if (staff) {
        staff.isActive = false;
        await kv.set(`staff:${staffId}`, staff);
      }
      
      if (vendorId) {
        const staffIds = await kv.get(`vendor:${vendorId}:staff`) || [];
        const updatedIds = staffIds.filter((id: string) => id !== staffId);
        await kv.set(`vendor:${vendorId}:staff`, updatedIds);
      }
      
      return sendSuccess(c, {}, 'Staff member removed successfully');
    } catch (error) {
      console.error('Error removing staff:', error);
      return sendError(c, error, 500);
    }
  });
}
