import { Hono } from "npm:hono";
import * as kv from "./kv_store.tsx";

export function registerAdminVendorRoutes(app: Hono) {

// ============================================
// VENDOR ADMINISTRATION - OVERVIEW & STATS
// ============================================

// Get vendor statistics and overview
app.get("/make-server-3dd53475/admin/vendors/stats", async (c) => {
  try {
    console.log('Fetching vendor statistics...');
    
    // FIX: Get all vendors with prefix 'vendor:' not 'vendor:vendor_'
    const allVendors = await kv.getByPrefix('vendor:');
    console.log(`Total vendors found: ${allVendors.length}`);
    
    // Calculate statistics
    const activeVendors = allVendors.filter(v => v.status === 'approved' && !v.deactivated);
    const pendingApplications = allVendors.filter(v => v.status === 'pending_approval');
    const deactivatedVendors = allVendors.filter(v => v.deactivated === true);
    const rejectedVendors = allVendors.filter(v => v.status === 'rejected');
    
    // Get compliance issues
    const complianceIssues = allVendors.filter(v => {
      if (!v.complianceFlags) return false;
      return v.complianceFlags.length > 0;
    });
    
    // Get vendors with high priority issues
    const highPriorityIssues = complianceIssues.filter(v => 
      v.complianceFlags?.some((flag: any) => flag.priority === 'high')
    );
    
    // Count support tickets
    const supportTickets = await kv.getByPrefix('support:ticket:vendor:');
    const openTickets = supportTickets.filter((t: any) => t.status === 'open' || t.status === 'in_progress');
    
    // Calculate quality alerts
    const qualityAlerts = allVendors.filter(v => {
      if (!v.rating) return false;
      return v.rating < 3.5 || (v.complaints && v.complaints.length > 0);
    });
    
    // Pending today count
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const pendingToday = pendingApplications.filter(v => {
      const submittedDate = new Date(v.submittedAt);
      return submittedDate >= today;
    });
    
    // Distribution by category
    const distributionByCategory = allVendors.reduce((acc: any, vendor) => {
      if (!vendor.services) return acc;
      vendor.services.forEach((service: string) => {
        acc[service] = (acc[service] || 0) + 1;
      });
      return acc;
    }, {});
    
    return c.json({
      success: true,
      stats: {
        activeVendors: {
          count: activeVendors.length,
          percentage: allVendors.length > 0 ? Math.round((activeVendors.length / allVendors.length) * 100) : 0
        },
        pendingApplications: {
          count: pendingApplications.length,
          todayCount: pendingToday.length
        },
        deactivatedVendors: {
          count: deactivatedVendors.length
        },
        complianceIssues: {
          count: complianceIssues.length,
          highPriority: highPriorityIssues.length
        },
        supportTickets: {
          total: supportTickets.length,
          open: openTickets.length
        },
        qualityAlerts: {
          count: qualityAlerts.length
        },
        distribution: {
          active: activeVendors.length,
          deactivated: deactivatedVendors.length,
          pending: pendingApplications.length
        },
        categoryDistribution: distributionByCategory
      }
    });
  } catch (error) {
    console.error('Error fetching vendor stats:', error);
    return c.json({ error: String(error) }, 500);
  }
});

// ============================================
// NEW VENDOR APPLICATIONS
// ============================================

// Get all pending vendor applications with filters
app.get("/make-server-3dd53475/applications/pending", async (c) => {
  try {
    const category = c.req.query('category') || 'all';
    const priority = c.req.query('priority') || 'all';
    
    console.log('📋 Fetching pending applications with filters:', { category, priority });
    
    // FIX: Get ALL vendors with prefix 'vendor:' not 'vendor:vendor_'
    const allVendors = await kv.getByPrefix('vendor:');
    console.log(`📊 Total vendors found: ${allVendors.length}`);
    
    let pendingVendors = allVendors.filter(v => v.status === 'pending_approval');
    console.log(`⏳ Pending vendors found: ${pendingVendors.length}`);
    
    // Filter by category
    if (category !== 'all') {
      pendingVendors = pendingVendors.filter(v => 
        v.services && v.services.includes(category)
      );
    }
    
    // Filter by priority (calculated based on waiting time and completeness)
    if (priority !== 'all') {
      pendingVendors = pendingVendors.map(v => {
        const daysSinceSubmission = Math.floor(
          (Date.now() - new Date(v.submittedAt).getTime()) / (1000 * 60 * 60 * 24)
        );
        
        let calculatedPriority = 'low';
        if (daysSinceSubmission > 7) calculatedPriority = 'high';
        else if (daysSinceSubmission > 3) calculatedPriority = 'medium';
        
        return { ...v, priority: calculatedPriority };
      }).filter(v => v.priority === priority);
    }
    
    // Calculate progress for each vendor
    const vendorsWithProgress = pendingVendors.map(vendor => {
      let totalFields = 0;
      let filledFields = 0;
      
      // Basic info
      totalFields += 6;
      if (vendor.fullName) filledFields++;
      if (vendor.phone) filledFields++;
      if (vendor.email) filledFields++;
      if (vendor.address) filledFields++;
      if (vendor.services && vendor.services.length > 0) filledFields++;
      if (vendor.experience) filledFields++;
      
      // Documents
      totalFields += 4;
      if (vendor.aadhaarNumber) filledFields++;
      if (vendor.panNumber) filledFields++;
      if (vendor.gstNumber) filledFields++;
      if (vendor.bankDetails && vendor.bankDetails.accountNumber) filledFields++;
      
      const progressPercentage = Math.round((filledFields / totalFields) * 100);
      
      return {
        ...vendor,
        progressPercentage,
        daysSinceSubmission: Math.floor(
          (Date.now() - new Date(vendor.submittedAt).getTime()) / (1000 * 60 * 60 * 24)
        )
      };
    });
    
    // Sort by submission date (newest first)
    vendorsWithProgress.sort((a, b) => 
      new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
    );
    
    return c.json({
      success: true,
      applications: vendorsWithProgress,
      count: vendorsWithProgress.length
    });
  } catch (error) {
    console.error('Error fetching pending applications:', error);
    return c.json({ error: String(error) }, 500);
  }
});

// Get single vendor application details
app.get("/make-server-3dd53475/applications/:vendorId", async (c) => {
  try {
    const { vendorId } = c.req.param();
    
    const vendor = await kv.get(`vendor:${vendorId}`);
    
    if (!vendor) {
      return c.json({ error: 'Vendor not found' }, 404);
    }
    
    return c.json({
      success: true,
      vendor
    });
  } catch (error) {
    console.error('Error fetching vendor application:', error);
    return c.json({ error: String(error) }, 500);
  }
});

// Approve vendor application
app.post("/make-server-3dd53475/applications/:vendorId/approve", async (c) => {
  try {
    const { vendorId } = c.req.param();
    const { adminId, adminName, notes } = await c.req.json();
    
    const vendor = await kv.get(`vendor:${vendorId}`);
    
    if (!vendor) {
      return c.json({ error: 'Vendor not found' }, 404);
    }
    
    if (vendor.status !== 'pending_approval') {
      return c.json({ error: 'Vendor is not pending approval' }, 400);
    }
    
    // Update vendor status
    vendor.status = 'approved';
    vendor.reviewedBy = adminId;
    vendor.reviewedByName = adminName;
    vendor.reviewedAt = new Date().toISOString();
    vendor.approvalNotes = notes;
    vendor.isActive = true;
    
    await kv.set(`vendor:${vendorId}`, vendor);
    
    // Remove from pending list and add to approved list
    const pendingList = await kv.get('vendor:pending_approvals') || [];
    const updatedPending = pendingList.filter((id: string) => id !== vendorId);
    await kv.set('vendor:pending_approvals', updatedPending);
    
    const approvedList = await kv.get('vendor:approved_list') || [];
    approvedList.push(vendorId);
    await kv.set('vendor:approved_list', approvedList);
    
    // Create notification for vendor
    const notificationId = `notification_${Date.now()}`;
    await kv.set(`notification:vendor:${vendorId}:${notificationId}`, {
      id: notificationId,
      vendorId,
      type: 'application_approved',
      title: 'Application Approved',
      message: 'Congratulations! Your vendor application has been approved. You can now start accepting bookings.',
      read: false,
      createdAt: new Date().toISOString()
    });
    
    return c.json({
      success: true,
      message: 'Vendor approved successfully',
      vendor
    });
  } catch (error) {
    console.error('Error approving vendor:', error);
    return c.json({ error: String(error) }, 500);
  }
});

// Reject vendor application
app.post("/make-server-3dd53475/applications/:vendorId/reject", async (c) => {
  try {
    const { vendorId } = c.req.param();
    const { adminId, adminName, reason, rejectionNotes } = await c.req.json();
    
    const vendor = await kv.get(`vendor:${vendorId}`);
    
    if (!vendor) {
      return c.json({ error: 'Vendor not found' }, 404);
    }
    
    if (vendor.status !== 'pending_approval') {
      return c.json({ error: 'Vendor is not pending approval' }, 400);
    }
    
    // Update vendor status
    vendor.status = 'rejected';
    vendor.isActive = false; // ✅ PERMANENT FIX: Rejected vendors should NOT be active
    vendor.reviewedBy = adminId;
    vendor.reviewedByName = adminName;
    vendor.reviewedAt = new Date().toISOString();
    vendor.rejectionReason = reason;
    vendor.rejectionNotes = rejectionNotes;
    
    await kv.set(`vendor:${vendorId}`, vendor);
    
    // Remove from pending list
    const pendingList = await kv.get('vendor:pending_approvals') || [];
    const updatedPending = pendingList.filter((id: string) => id !== vendorId);
    await kv.set('vendor:pending_approvals', updatedPending);
    
    // Create notification for vendor
    const notificationId = `notification_${Date.now()}`;
    await kv.set(`notification:vendor:${vendorId}:${notificationId}`, {
      id: notificationId,
      vendorId,
      type: 'application_rejected',
      title: 'Application Rejected',
      message: `Unfortunately, your vendor application has been rejected. Reason: ${reason}`,
      read: false,
      createdAt: new Date().toISOString()
    });
    
    return c.json({
      success: true,
      message: 'Vendor rejected',
      vendor
    });
  } catch (error) {
    console.error('Error rejecting vendor:', error);
    return c.json({ error: String(error) }, 500);
  }
});

// ============================================
// VENDOR SETTINGS & POLICIES
// ============================================

// Get platform-wide vendor settings
app.get("/make-server-3dd53475/settings/platform", async (c) => {
  try {
    const settings = await kv.get('admin:platform:vendor_settings') || {
      refundPolicies: {
        customerCancellation: {
          tier1: {
            hoursBeforeService: 24,
            refundPercentage: 75,
            cancellationFee: 10
          },
          tier2: {
            hoursBeforeService: 6,
            refundPercentage: 50,
            cancellationFee: null
          }
        },
        providerCancellation: {
          refundToCustomer: 100,
          additionalCompensation: 10,
          cancellationFee: 50
        },
        refundProcessing: {
          mode: 'auto',
          processingTimeBusinessDays: 1000,
          disputeResolutionTimeDays: 7,
          refundPreference: 'wallet'
        }
      },
      reservationPayment: {
        reservationType: 'flat',
        fullPayment: '100_upfront',
        partialPaymentAllowed: true,
        reservationPercentage: 30,
        minimumAdvancePayment: 25,
        autoCapturePayment: true,
        escrowHoldPeriodHours: 24,
        cancellationGraceMinutes: 5
      },
      serviceSpecificCharges: {
        travelDistanceLimit: 20,
        travelSurchargePerKm: 12,
        equipmentFee: 50
      },
      bookingRules: {
        minAdvanceBookingHours: 2,
        maxAdvanceBookingDays: 90,
        cancellationWindowHours: 24,
        rescheduleWindowHours: 12,
        maxReschedulesPerBooking: 2
      }
    };
    
    return c.json({
      success: true,
      settings
    });
  } catch (error) {
    console.error('Error fetching platform settings:', error);
    return c.json({ error: String(error) }, 500);
  }
});

// Update platform-wide vendor settings
app.put("/make-server-3dd53475/settings/platform", async (c) => {
  try {
    const updates = await c.req.json();
    
    const currentSettings = await kv.get('admin:platform:vendor_settings') || {};
    const updatedSettings = {
      ...currentSettings,
      ...updates,
      updatedAt: new Date().toISOString()
    };
    
    await kv.set('admin:platform:vendor_settings', updatedSettings);
    
    return c.json({
      success: true,
      settings: updatedSettings
    });
  } catch (error) {
    console.error('Error updating platform settings:', error);
    return c.json({ error: String(error) }, 500);
  }
});

// ============================================
// VENDOR DEACTIVATION REQUESTS
// ============================================

// Get all deactivation requests
app.get("/make-server-3dd53475/deactivation-requests", async (c) => {
  try {
    const requests = await kv.getByPrefix('vendor:deactivation_request:') || [];
    
    // Enrich with vendor details
    const enrichedRequests = await Promise.all(
      requests.map(async (request: any) => {
        const vendor = await kv.get(`vendor:${request.vendorId}`);
        return {
          ...request,
          vendorDetails: vendor ? {
            fullName: vendor.fullName,
            businessName: vendor.businessName,
            phone: vendor.phone,
            email: vendor.email,
            services: vendor.services
          } : null
        };
      })
    );
    
    // Sort by request date (newest first)
    enrichedRequests.sort((a, b) => 
      new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime()
    );
    
    return c.json({
      success: true,
      requests: enrichedRequests
    });
  } catch (error) {
    console.error('Error fetching deactivation requests:', error);
    return c.json({ error: String(error) }, 500);
  }
});

// Approve deactivation request
app.post("/make-server-3dd53475/deactivation-requests/:requestId/approve", async (c) => {
  try {
    const { requestId } = c.req.param();
    const { adminId, adminName } = await c.req.json();
    
    const request = await kv.get(`vendor:deactivation_request:${requestId}`);
    
    if (!request) {
      return c.json({ error: 'Request not found' }, 404);
    }
    
    const vendor = await kv.get(`vendor:${request.vendorId}`);
    
    if (!vendor) {
      return c.json({ error: 'Vendor not found' }, 404);
    }
    
    // Deactivate vendor
    vendor.deactivated = true;
    vendor.deactivatedAt = new Date().toISOString();
    vendor.deactivatedBy = adminId;
    vendor.deactivationReason = request.reason;
    
    await kv.set(`vendor:${request.vendorId}`, vendor);
    
    // Update request status
    request.status = 'approved';
    request.reviewedBy = adminId;
    request.reviewedByName = adminName;
    request.reviewedAt = new Date().toISOString();
    
    await kv.set(`vendor:deactivation_request:${requestId}`, request);
    
    return c.json({
      success: true,
      message: 'Vendor deactivated successfully'
    });
  } catch (error) {
    console.error('Error approving deactivation:', error);
    return c.json({ error: String(error) }, 500);
  }
});

// ============================================
// VENDOR RE-VERIFICATION
// ============================================

// Get vendors due for re-verification
app.get("/make-server-3dd53475/reverification/due", async (c) => {
  try {
    const allVendors = await kv.getByPrefix('vendor:');
    const activeVendors = allVendors.filter(v => v.status === 'approved' && !v.deactivated);
    
    const vendorsDueForReverification = activeVendors.filter(vendor => {
      if (!vendor.reviewedAt) return true;
      
      const reviewDate = new Date(vendor.reviewedAt);
      const now = new Date();
      const daysSinceReview = Math.floor((now.getTime() - reviewDate.getTime()) / (1000 * 60 * 60 * 24));
      
      // Due for re-verification after 365 days (1 year)
      return daysSinceReview >= 365;
    });
    
    // Sort by days since last review (oldest first)
    vendorsDueForReverification.sort((a, b) => {
      const dateA = new Date(a.reviewedAt || a.submittedAt);
      const dateB = new Date(b.reviewedAt || b.submittedAt);
      return dateA.getTime() - dateB.getTime();
    });
    
    return c.json({
      success: true,
      vendors: vendorsDueForReverification,
      count: vendorsDueForReverification.length
    });
  } catch (error) {
    console.error('Error fetching vendors due for re-verification:', error);
    return c.json({ error: String(error) }, 500);
  }
});

// Schedule re-verification for vendor
app.post("/make-server-3dd53475/reverification/:vendorId/schedule", async (c) => {
  try {
    const { vendorId } = c.req.param();
    const { scheduledDate, adminId, notes } = await c.req.json();
    
    const vendor = await kv.get(`vendor:${vendorId}`);
    
    if (!vendor) {
      return c.json({ error: 'Vendor not found' }, 404);
    }
    
    // Create re-verification record
    const reverificationId = `reverification_${Date.now()}`;
    await kv.set(`vendor:reverification:${reverificationId}`, {
      id: reverificationId,
      vendorId,
      scheduledDate,
      status: 'scheduled',
      scheduledBy: adminId,
      notes,
      createdAt: new Date().toISOString()
    });
    
    // Update vendor record
    vendor.nextReverificationDate = scheduledDate;
    vendor.reverificationStatus = 'scheduled';
    await kv.set(`vendor:${vendorId}`, vendor);
    
    // Create notification for vendor
    const notificationId = `notification_${Date.now()}`;
    await kv.set(`notification:vendor:${vendorId}:${notificationId}`, {
      id: notificationId,
      vendorId,
      type: 'reverification_scheduled',
      title: 'Re-verification Scheduled',
      message: `Your account re-verification has been scheduled for ${new Date(scheduledDate).toLocaleDateString()}. Please ensure all documents are up to date.`,
      read: false,
      createdAt: new Date().toISOString()
    });
    
    return c.json({
      success: true,
      message: 'Re-verification scheduled successfully'
    });
  } catch (error) {
    console.error('Error scheduling re-verification:', error);
    return c.json({ error: String(error) }, 500);
  }
});

// ============================================
// COMPLIANCE & QUALITY MONITORING
// ============================================

// Get vendors with compliance issues
app.get("/make-server-3dd53475/compliance/issues", async (c) => {
  try {
    const allVendors = await kv.getByPrefix('vendor:');
    
    const vendorsWithIssues = allVendors.filter(vendor => {
      if (!vendor.complianceFlags) return false;
      return vendor.complianceFlags.length > 0;
    }).map(vendor => {
      // Calculate priority based on flags
      const highPriorityFlags = vendor.complianceFlags.filter((flag: any) => flag.priority === 'high');
      const priority = highPriorityFlags.length > 0 ? 'high' : 
                      vendor.complianceFlags.length > 3 ? 'medium' : 'low';
      
      return {
        ...vendor,
        overallPriority: priority,
        issueCount: vendor.complianceFlags.length
      };
    });
    
    // Sort by priority and issue count
    vendorsWithIssues.sort((a, b) => {
      const priorityOrder: any = { high: 3, medium: 2, low: 1 };
      return priorityOrder[b.overallPriority] - priorityOrder[a.overallPriority] || 
             b.issueCount - a.issueCount;
    });
    
    return c.json({
      success: true,
      vendors: vendorsWithIssues,
      count: vendorsWithIssues.length
    });
  } catch (error) {
    console.error('Error fetching compliance issues:', error);
    return c.json({ error: String(error) }, 500);
  }
});

// Add compliance flag to vendor
app.post("/make-server-3dd53475/:vendorId/compliance/flag", async (c) => {
  try {
    const { vendorId } = c.req.param();
    const { type, description, priority, adminId } = await c.req.json();
    
    const vendor = await kv.get(`vendor:${vendorId}`);
    
    if (!vendor) {
      return c.json({ error: 'Vendor not found' }, 404);
    }
    
    if (!vendor.complianceFlags) {
      vendor.complianceFlags = [];
    }
    
    vendor.complianceFlags.push({
      id: `flag_${Date.now()}`,
      type,
      description,
      priority,
      flaggedBy: adminId,
      flaggedAt: new Date().toISOString(),
      resolved: false
    });
    
    await kv.set(`vendor:${vendorId}`, vendor);
    
    return c.json({
      success: true,
      message: 'Compliance flag added',
      vendor
    });
  } catch (error) {
    console.error('Error adding compliance flag:', error);
    return c.json({ error: String(error) }, 500);
  }
});

// Get quality alerts
app.get("/make-server-3dd53475/quality/alerts", async (c) => {
  try {
    const allVendors = await kv.getByPrefix('vendor:');
    const activeVendors = allVendors.filter(v => v.status === 'approved' && !v.deactivated);
    
    const qualityAlerts = activeVendors.filter(vendor => {
      // Low rating alert
      if (vendor.rating && vendor.rating < 3.5) return true;
      
      // High complaint rate
      if (vendor.complaints && vendor.complaints.length > 0) {
        const recentComplaints = vendor.complaints.filter((c: any) => {
          const complaintDate = new Date(c.createdAt);
          const thirtyDaysAgo = new Date();
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
          return complaintDate >= thirtyDaysAgo;
        });
        if (recentComplaints.length >= 3) return true;
      }
      
      // Rating dropped significantly
      if (vendor.ratingHistory && vendor.ratingHistory.length >= 2) {
        const latest = vendor.ratingHistory[vendor.ratingHistory.length - 1];
        const previous = vendor.ratingHistory[vendor.ratingHistory.length - 2];
        if (latest.rating - previous.rating < -0.5) return true;
      }
      
      return false;
    }).map(vendor => {
      let alertType = 'low_rating';
      let alertMessage = '';
      let priority = 'low';
      
      if (vendor.rating < 3.0) {
        alertType = 'critical_rating';
        alertMessage = `Critical: Rating dropped to ${vendor.rating}`;
        priority = 'high';
      } else if (vendor.rating < 3.5) {
        alertType = 'low_rating';
        alertMessage = `Low rating: ${vendor.rating}`;
        priority = 'medium';
      }
      
      if (vendor.complaints && vendor.complaints.length > 0) {
        const recentComplaints = vendor.complaints.filter((c: any) => {
          const complaintDate = new Date(c.createdAt);
          const thirtyDaysAgo = new Date();
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
          return complaintDate >= thirtyDaysAgo;
        });
        
        if (recentComplaints.length >= 5) {
          alertType = 'high_complaint_rate';
          alertMessage = `${recentComplaints.length} complaints received | This Month`;
          priority = 'high';
        } else if (recentComplaints.length >= 3) {
          alertType = 'moderate_complaint_rate';
          alertMessage = `${recentComplaints.length} complaints received | This Month`;
          priority = 'medium';
        }
      }
      
      return {
        vendorId: vendor.id,
        vendorName: vendor.fullName || vendor.businessName,
        alertType,
        alertMessage,
        priority,
        rating: vendor.rating,
        complaintCount: vendor.complaints?.length || 0
      };
    });
    
    // Sort by priority
    qualityAlerts.sort((a, b) => {
      const priorityOrder: any = { high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
    
    return c.json({
      success: true,
      alerts: qualityAlerts,
      count: qualityAlerts.length
    });
  } catch (error) {
    console.error('Error fetching quality alerts:', error);
    return c.json({ error: String(error) }, 500);
  }
});

// ============================================
// VENDOR SEARCH & FILTERING
// ============================================

// Search vendors
app.get("/make-server-3dd53475/search", async (c) => {
  try {
    const query = c.req.query('q') || '';
    const status = c.req.query('status') || 'all';
    const service = c.req.query('service') || 'all';
    
    let vendors = await kv.getByPrefix('vendor:');
    
    // Filter by status
    if (status !== 'all') {
      vendors = vendors.filter(v => {
        if (status === 'active') return v.status === 'approved' && !v.deactivated;
        if (status === 'pending') return v.status === 'pending_approval';
        if (status === 'deactivated') return v.deactivated === true;
        if (status === 'rejected') return v.status === 'rejected';
        return true;
      });
    }
    
    // Filter by service
    if (service !== 'all') {
      vendors = vendors.filter(v => v.services && v.services.includes(service));
    }
    
    // Search by name, phone, or email
    if (query) {
      const lowerQuery = query.toLowerCase();
      vendors = vendors.filter(v => 
        (v.fullName && v.fullName.toLowerCase().includes(lowerQuery)) ||
        (v.businessName && v.businessName.toLowerCase().includes(lowerQuery)) ||
        (v.phone && v.phone.includes(query)) ||
        (v.email && v.email.toLowerCase().includes(lowerQuery))
      );
    }
    
    return c.json({
      success: true,
      vendors,
      count: vendors.length
    });
  } catch (error) {
    console.error('Error searching vendors:', error);
    return c.json({ error: String(error) }, 500);
  }
});

}