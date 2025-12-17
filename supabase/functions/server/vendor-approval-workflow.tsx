/**
 * Vendor Approval Workflow Endpoints
 * Handles complete vendor application lifecycle with proper state management
 */

import { Hono } from "npm:hono";
import * as kvStore from './kv_store.tsx';
import { determineServiceCategory } from "./service-category-mapping.tsx";
import { normalizePhone, createVendorId, phonesMatch } from "./phone-utils.tsx";
import { notifyVendorApplicationStatus } from './notification-helpers.tsx';

export function vendorApprovalWorkflowEndpoints(app: Hono, kvStore: any) {
  
  /**
   * APPLICATION STATES:
   * - pending: Initial submission, awaiting admin review
   * - under_review: Admin is actively reviewing
   * - approved: Admin approved, vendor can access dashboard
   * - rejected: Admin rejected, vendor cannot proceed
   * - more_info_required: Admin needs clarification, vendor can resubmit
   * - resubmitted: Vendor resubmitted after more info request
   */

  // ============================================
  // ADMIN ACTIONS
  // ============================================

  /**
   * Approve vendor application
   * POST /make-server-3dd53475/admin/vendor/approve
   */
  app.post("/make-server-3dd53475/admin/vendor/approve", async (c) => {
    try {
      const { vendorId, approvedBy, notes } = await c.req.json();

      console.log('✅ APPROVE REQUEST RECEIVED:', {
        vendorId,
        approvedBy,
        notes
      });

      if (!vendorId) {
        console.error('❌ APPROVE FAILED: Missing vendorId');
        return c.json({ error: 'vendorId is required' }, 400);
      }

      // Get vendor application
      console.log(`🔍 Looking for vendor with key: vendor:${vendorId}`);
      const vendor = await kvStore.get(`vendor:${vendorId}`);
      
      if (!vendor) {
        console.error(`❌ VENDOR NOT FOUND in database!`);
        console.error(`   Searched key: vendor:${vendorId}`);
        console.error(`   This means either:`);
        console.error(`   1. The vendorId is incorrect (check if it's applicationId instead)`);
        console.error(`   2. The vendor was never created in the database`);
        console.error(`   3. The vendor was deleted`);
        
        // Let's search for this vendor by phone or other identifiers
        console.log(`🔍 Attempting to find vendor by searching all vendors...`);
        const allVendors = await kvStore.getByPrefix('vendor:vendor_');
        console.log(`   Found ${allVendors.length} total vendors in database`);
        
        // Log the vendorIds of all vendors
        if (allVendors.length > 0) {
          console.log(`   📋 Available vendor IDs:`, allVendors.map(v => v.id).slice(0, 10));
        }
        
        return c.json({ error: 'Vendor not found' }, 404);
      }
      
      console.log('✅ VENDOR FOUND:', {
        id: vendor.id,
        name: vendor.fullName,
        phone: vendor.phone,
        currentStatus: vendor.status,
        roleId: vendor.roleId
      });

      // Update vendor status to approved
      const updatedVendor = {
        ...vendor,
        status: 'approved',
        isActive: true, // ✅ Vendor is approved and active
        setupCompleted: false, // ❌ FIX: Don't mark setup as complete - vendor still needs to configure services
        approvedBy: approvedBy || 'admin',
        approvedAt: new Date().toISOString(),
        approvalNotes: notes || '',
        updatedAt: new Date().toISOString()
      };

      await kvStore.set(`vendor:${vendorId}`, updatedVendor);

      // Create status history entry
      const historyEntry = {
        vendorId,
        applicationId: vendor.applicationId,
        action: 'approved',
        previousStatus: vendor.status,
        newStatus: 'approved',
        actionBy: approvedBy || 'admin',
        notes: notes || '',
        timestamp: new Date().toISOString()
      };

      await kvStore.set(
        `vendor:history:${vendorId}:${Date.now()}`,
        historyEntry
      );

      // Create active vendor session token
      const sessionToken = `session_${vendorId}_${Date.now()}`;
      await kvStore.set(`vendor:session:${vendor.phone}`, {
        vendorId,
        sessionToken,
        status: 'approved',
        createdAt: new Date().toISOString()
      });

      // ✅ CRITICAL FIX: Auto-create staff record for individual vendors when approved
      console.log(`\n🔧 ===== AUTO-CREATING STAFF FOR APPROVED VENDOR =====`);
      console.log(`📝 Vendor ID: ${vendorId}`);
      console.log(`👤 Vendor Type: ${vendor.vendorType}`);
      console.log(`🏥 Role ID: ${vendor.roleId}`);
      console.log(`📋 Service Category: ${vendor.serviceCategory}`);
      
      // Check if this is an individual vendor (not a business center)
      const isIndividualVendor = vendor.vendorType === 'individual' || 
                                 vendor.vendorType === 'individual_professional' ||
                                 vendor.vendorType === 'individual_veterinarian' ||
                                 vendor.vendorType === 'individual_groomer' ||
                                 vendor.vendorType === 'individual_trainer' ||
                                 !vendor.businessName;
      
      console.log(`   Is Individual Vendor: ${isIndividualVendor}`);
      
      // For individual vendors (veterinarians, groomers, trainers, etc.), auto-create staff profile
      if (isIndividualVendor) {
        const staffId = `${vendorId}_staff_self`;
        
        // Check if staff already exists
        const existingStaff = await kvStore.get(`staff:${staffId}`);
        
        if (!existingStaff) {
          console.log(`✅ Creating staff profile for individual vendor...`);
          
          const staffProfile = {
            id: staffId,
            vendorId: vendorId,
            fullName: vendor.fullName,
            name: vendor.fullName,
            phone: vendor.phone || vendor.mobile || '',
            mobile: vendor.mobile || vendor.phone || '',
            email: vendor.email || '',
            
            // Professional details (role-specific)
            specialization: vendor.customFields?.specialization || vendor.specialization || '',
            degree: vendor.customFields?.degree || vendor.degree || '',
            experience: vendor.yearsOfExperience || vendor.experience || 0,
            bio: vendor.customFields?.bio || vendor.bio || '',
            consultationFee: vendor.customFields?.consultationFee || vendor.consultationFee || 0,
            
            // Personal details
            gender: vendor.customFields?.gender || vendor.gender || '',
            dateOfBirth: vendor.customFields?.dateOfBirth || vendor.dateOfBirth || '',
            languages: vendor.customFields?.languages || vendor.languages || ['English', 'Hindi'],
            
            // Address
            address: vendor.address || '',
            city: vendor.city || '',
            state: vendor.state || '',
            pincode: vendor.pincode || '',
            
            // Role and category info
            roleId: vendor.roleId,
            roleName: vendor.roleName,
            serviceCategory: vendor.serviceCategory,
            
            // Staff settings
            isActive: true,
            canAcceptBookings: true,
            assignedServices: [], // Will be populated when services are configured
            
            // Timestamps
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            
            // Link to vendor
            isVendorSelf: true, // Flag to indicate this is the vendor themselves
            vendorApplicationId: vendor.applicationId
          };
          
          await kvStore.set(`staff:${staffId}`, staffProfile);
          console.log(`✅ Staff profile created: ${staffId}`);
          console.log(`   Name: ${staffProfile.fullName}`);
          console.log(`   Role: ${staffProfile.roleName}`);
          console.log(`   Service Category: ${staffProfile.serviceCategory}`);
          
          // Add staff to vendor's staff list
          const vendorStaffList = await kvStore.get(`vendor:${vendorId}:staff`) || [];
          if (!vendorStaffList.includes(staffId)) {
            vendorStaffList.push(staffId);
            await kvStore.set(`vendor:${vendorId}:staff`, vendorStaffList);
            console.log(`✅ Added staff to vendor's staff list`);
          }
          
          // Create phone lookup for staff
          const cleanStaffPhone = vendor.phone?.replace(/[^0-9]/g, '');
          if (cleanStaffPhone) {
            await kvStore.set(`staff:phone:${cleanStaffPhone}`, staffId);
            console.log(`✅ Created staff phone lookup: ${cleanStaffPhone} → ${staffId}`);
          }
        } else {
          console.log(`ℹ️ Staff profile already exists: ${staffId}`);
        }
      } else {
        console.log(`ℹ️ Business/Center vendor - staff profiles managed separately`);
      }

      console.log(`✅ Vendor approved: ${vendorId} (${vendor.fullName})`);
      
      // ✅ Send notification to vendor
      await notifyVendorApplicationStatus(kvStore, vendorId, updatedVendor, 'approved', {});
      
      return c.json({ 
        success: true, 
        vendor: updatedVendor,
        message: `Vendor ${vendor.fullName} has been approved successfully`
      });
    } catch (error) {
      console.error('Error approving vendor:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * Reject vendor application
   * POST /make-server-3dd53475/admin/vendor/reject
   */
  app.post("/make-server-3dd53475/admin/vendor/reject", async (c) => {
    try {
      const { vendorId, rejectedBy, reason } = await c.req.json();

      if (!vendorId || !reason) {
        return c.json({ error: 'vendorId and reason are required' }, 400);
      }

      // Get vendor application
      const vendor = await kvStore.get(`vendor:${vendorId}`);
      if (!vendor) {
        return c.json({ error: 'Vendor not found' }, 404);
      }

      // Update vendor status to rejected
      const updatedVendor = {
        ...vendor,
        status: 'rejected',
        rejectedBy: rejectedBy || 'admin',
        rejectedAt: new Date().toISOString(),
        rejectionReason: reason,
        updatedAt: new Date().toISOString()
      };

      await kvStore.set(`vendor:${vendorId}`, updatedVendor);

      // Create status history entry
      const historyEntry = {
        vendorId,
        applicationId: vendor.applicationId,
        action: 'rejected',
        previousStatus: vendor.status,
        newStatus: 'rejected',
        actionBy: rejectedBy || 'admin',
        notes: reason,
        timestamp: new Date().toISOString()
      };

      await kvStore.set(
        `vendor:history:${vendorId}:${Date.now()}`,
        historyEntry
      );

      console.log(`❌ Vendor rejected: ${vendorId} (${vendor.fullName})`);
      
      // ✅ Send notification to vendor
      await notifyVendorApplicationStatus(kvStore, vendorId, updatedVendor, 'rejected', { rejectionReason: reason });
      
      return c.json({ 
        success: true, 
        vendor: updatedVendor,
        message: `Vendor ${vendor.fullName} has been rejected`
      });
    } catch (error) {
      console.error('Error rejecting vendor:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * Request more information from vendor
   * POST /make-server-3dd53475/admin/vendor/request-info
   */
  app.post("/make-server-3dd53475/admin/vendor/request-info", async (c) => {
    try {
      const { vendorId, requestedBy, message, requiredFields } = await c.req.json();

      if (!vendorId || !message) {
        return c.json({ error: 'vendorId and message are required' }, 400);
      }

      // Get vendor application
      const vendor = await kvStore.get(`vendor:${vendorId}`);
      if (!vendor) {
        return c.json({ error: 'Vendor not found' }, 404);
      }

      // Update vendor status to more_info_required
      const updatedVendor = {
        ...vendor,
        status: 'more_info_required',
        infoRequestedBy: requestedBy || 'admin',
        infoRequestedAt: new Date().toISOString(),
        infoRequestMessage: message,
        infoRequiredFields: requiredFields || [], // Fields that need attention
        updatedAt: new Date().toISOString()
      };

      await kvStore.set(`vendor:${vendorId}`, updatedVendor);

      // Create status history entry
      const historyEntry = {
        vendorId,
        applicationId: vendor.applicationId,
        action: 'info_requested',
        previousStatus: vendor.status,
        newStatus: 'more_info_required',
        actionBy: requestedBy || 'admin',
        notes: message,
        requiredFields: requiredFields || [],
        timestamp: new Date().toISOString()
      };

      await kvStore.set(
        `vendor:history:${vendorId}:${Date.now()}`,
        historyEntry
      );

      console.log(`📋 Info requested from vendor: ${vendorId} (${vendor.fullName})`);
      
      // ✅ Send notification to vendor
      await notifyVendorApplicationStatus(kvStore, vendorId, updatedVendor, 'clarification_requested', { clarificationReason: message });
      
      return c.json({ 
        success: true, 
        vendor: updatedVendor,
        message: `Information request sent to ${vendor.fullName}`
      });
    } catch (error) {
      console.error('Error requesting info:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  // ============================================
  // VENDOR ACTIONS
  // ============================================

  /**
   * Check vendor application status
   * GET /make-server-3dd53475/vendor/status/:phone
   */
  app.get("/make-server-3dd53475/vendor/status/:phone", async (c) => {
    try {
      console.log('');
      console.log('🟢🟢🟢 ============================================');
      console.log('🟢🟢🟢 STATUS ENDPOINT HIT!!!');
      console.log('🟢🟢🟢 ============================================');
      
      const { phone } = c.req.param();
      console.log(`🟢 Phone parameter received: "${phone}"`);

      if (!phone) {
        console.log('❌ Phone is missing!');
        return c.json({ error: 'Phone number is required' }, 400);
      }

      // ✅ FIX: Clean phone number for comparison
      const cleanPhone = normalizePhone(phone);
      console.log(`🔍 Checking status for phone: ${phone} (clean: ${cleanPhone})`);

      // Find vendor by phone - use 'vendor:' prefix to get all vendors
      console.log(`📋 Calling kvStore.getByPrefix('vendor:')...`);
      const allVendors = await kvStore.getByPrefix('vendor:');
      console.log(`📋 Searching through ${allVendors.length} vendors...`);
      
      // ✅ FIX: Clean vendor phone before comparison
      const vendor = allVendors.find((v: any) => {
        if (!v || !v.phone) return false;
        const vendorCleanPhone = normalizePhone(v.phone);
        const matches = phonesMatch(vendorCleanPhone, cleanPhone);
        if (matches) {
          console.log(`✅ MATCH FOUND: ${v.id} with phone ${v.phone}`);
        }
        return matches;
      });

      if (!vendor) {
        console.log(`❌ No vendor found for phone ${cleanPhone}`);
        console.log(`   Checked ${allVendors.length} vendors`);
        console.log(`🟢 Returning 200 with status: 'not_found'`);
        return c.json({ 
          status: 'not_found',
          hasApplication: false,
          message: 'No application found for this phone number'
        });
      }

      console.log(`✅ Found vendor: ${vendor.id}`);
      console.log(`   Status: ${vendor.status}`);
      console.log(`   Setup: ${vendor.setupCompleted}`);
      console.log(`   Active: ${vendor.isActive}`);

      // Return comprehensive status
      const response = {
        status: vendor.status,
        hasApplication: true,
        vendorId: vendor.id,
        applicationId: vendor.applicationId,
        fullName: vendor.fullName,
        roleName: vendor.roleName,
        roleId: vendor.roleId,
        isActive: vendor.isActive || false,
        setupCompleted: vendor.setupCompleted || false,
        servicesConfigured: vendor.servicesConfigured || false,
        availabilityConfigured: vendor.availabilityConfigured || false,
        serviceCategory: vendor.serviceCategory,
        vendorType: vendor.vendorType
      };

      console.log(`🟢 Returning 200 with full vendor data`);
      return c.json(response);
    } catch (error) {
      console.error('❌❌❌ ERROR in status endpoint:', error);
      console.error('Stack:', error.stack);
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * Get vendor application for editing (when more info required)
   * GET /make-server-3dd53475/vendor/application/:vendorId
   */
  app.get("/make-server-3dd53475/vendor/application/:vendorId", async (c) => {
    try {
      const { vendorId } = c.req.param();

      const vendor = await kvStore.get(`vendor:${vendorId}`);
      if (!vendor) {
        return c.json({ error: 'Vendor not found' }, 404);
      }

      // Only allow editing if status is more_info_required
      if (vendor.status !== 'more_info_required') {
        return c.json({ 
          error: 'Application cannot be edited in current status',
          currentStatus: vendor.status
        }, 400);
      }

      return c.json({ 
        vendor,
        canEdit: true,
        infoRequestMessage: vendor.infoRequestMessage,
        requiredFields: vendor.infoRequiredFields || []
      });
    } catch (error) {
      console.error('Error fetching vendor application:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * Resubmit vendor application after corrections
   * PUT /make-server-3dd53475/vendor/resubmit/:vendorId
   */
  app.put("/make-server-3dd53475/vendor/resubmit/:vendorId", async (c) => {
    try {
      const { vendorId } = c.req.param();
      const updates = await c.req.json();

      const vendor = await kvStore.get(`vendor:${vendorId}`);
      if (!vendor) {
        return c.json({ error: 'Vendor not found' }, 404);
      }

      // Only allow resubmission if status is more_info_required
      if (vendor.status !== 'more_info_required') {
        return c.json({ 
          error: 'Application cannot be resubmitted in current status',
          currentStatus: vendor.status
        }, 400);
      }

      // Update vendor with new data
      const updatedVendor = {
        ...vendor,
        ...updates.formData,
        documents: updates.documents || vendor.documents,
        location: updates.location || vendor.location,
        status: 'resubmitted',
        resubmittedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        // Clear previous info request data
        infoRequestMessage: undefined,
        infoRequiredFields: undefined
      };

      await kvStore.set(`vendor:${vendorId}`, updatedVendor);

      // Create status history entry
      const historyEntry = {
        vendorId,
        applicationId: vendor.applicationId,
        action: 'resubmitted',
        previousStatus: vendor.status,
        newStatus: 'resubmitted',
        actionBy: vendor.fullName,
        notes: 'Application resubmitted with corrections',
        timestamp: new Date().toISOString()
      };

      await kvStore.set(
        `vendor:history:${vendorId}:${Date.now()}`,
        historyEntry
      );

      console.log(`🔄 Vendor resubmitted application: ${vendorId} (${vendor.fullName})`);
      
      return c.json({ 
        success: true, 
        vendor: updatedVendor,
        message: 'Application resubmitted successfully. Admin will review again.'
      });
    } catch (error) {
      console.error('Error resubmitting vendor application:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * Get vendor status history
   * GET /make-server-3dd53475/vendor/history/:vendorId
   */
  app.get("/make-server-3dd53475/vendor/history/:vendorId", async (c) => {
    try {
      const { vendorId } = c.req.param();

      const history = await kvStore.getByPrefix(`vendor:history:${vendorId}:`);
      
      // Sort by timestamp descending
      history.sort((a: any, b: any) => 
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );

      return c.json({ history });
    } catch (error) {
      console.error('Error fetching vendor history:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * Bulk status update (for admin panel)
   * POST /make-server-3dd53475/admin/vendor/bulk-action
   */
  app.post("/make-server-3dd53475/admin/vendor/bulk-action", async (c) => {
    try {
      const { vendorIds, action, actionBy, notes } = await c.req.json();

      if (!vendorIds || !Array.isArray(vendorIds) || vendorIds.length === 0) {
        return c.json({ error: 'vendorIds array is required' }, 400);
      }

      if (!['approve', 'reject'].includes(action)) {
        return c.json({ error: 'Invalid action. Must be approve or reject' }, 400);
      }

      const results = [];

      for (const vendorId of vendorIds) {
        try {
          const vendor = await kvStore.get(`vendor:${vendorId}`);
          if (!vendor) {
            results.push({ vendorId, success: false, error: 'Not found' });
            continue;
          }

          const newStatus = action === 'approve' ? 'approved' : 'rejected';
          const timestamp = new Date().toISOString();

          const updatedVendor = {
            ...vendor,
            status: newStatus,
            ...(action === 'approve' ? {
              approvedBy: actionBy || 'admin',
              approvedAt: timestamp,
              approvalNotes: notes || ''
            } : {
              rejectedBy: actionBy || 'admin',
              rejectedAt: timestamp,
              rejectionReason: notes || 'Bulk rejection'
            }),
            updatedAt: timestamp
          };

          await kvStore.set(`vendor:${vendorId}`, updatedVendor);

          // Create history entry
          await kvStore.set(
            `vendor:history:${vendorId}:${Date.now()}`,
            {
              vendorId,
              applicationId: vendor.applicationId,
              action: action === 'approve' ? 'approved' : 'rejected',
              previousStatus: vendor.status,
              newStatus,
              actionBy: actionBy || 'admin',
              notes: notes || '',
              timestamp
            }
          );

          results.push({ vendorId, success: true, newStatus });
        } catch (error) {
          results.push({ vendorId, success: false, error: String(error) });
        }
      }

      const successCount = results.filter(r => r.success).length;

      return c.json({ 
        success: true,
        total: vendorIds.length,
        successful: successCount,
        failed: vendorIds.length - successCount,
        results
      });
    } catch (error) {
      console.error('Error performing bulk action:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * Get all pending applications (for admin dashboard)
   * GET /make-server-3dd53475/admin/vendor/pending
   */
  app.get("/make-server-3dd53475/admin/vendor/pending", async (c) => {
    try {
      const allVendors = await kvStore.getByPrefix('vendor:vendor_');
      
      const pending = allVendors.filter((v: any) => 
        v.status === 'pending' || v.status === 'resubmitted'
      );

      // Sort by submission date
      pending.sort((a: any, b: any) => 
        new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime()
      );

      return c.json({ 
        vendors: pending,
        total: pending.length
      });
    } catch (error) {
      console.error('Error fetching pending vendors:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * Debug endpoint - Check if vendor exists by phone
   * GET /make-server-3dd53475/admin/debug/vendor-by-phone/:phone
   */
  app.get("/make-server-3dd53475/admin/debug/vendor-by-phone/:phone", async (c) => {
    try {
      const { phone } = c.req.param();
      
      console.log(`🔍 DEBUG: Searching for vendor with phone: ${phone}`);
      
      // Get all vendors
      const allVendors = await kvStore.getByPrefix('vendor:vendor_');
      console.log(`   Total vendors in DB: ${allVendors.length}`);
      
      // Find by phone
      const vendor = allVendors.find((v: any) => v.phone === phone || v.phone === `+91 ${phone}` || v.phone.replace(/[^0-9]/g, '') === phone.replace(/[^0-9]/g, ''));
      
      if (vendor) {
        console.log(`   ✅ FOUND: ${vendor.fullName} (${vendor.id})`);
        return c.json({
          found: true,
          vendor: {
            id: vendor.id,
            fullName: vendor.fullName,
            phone: vendor.phone,
            status: vendor.status,
            roleId: vendor.roleId,
            roleName: vendor.roleName,
            isActive: vendor.isActive,
            setupCompleted: vendor.setupCompleted
          }
        });
      } else {
        console.log(`   ❌ NOT FOUND`);
        console.log(`   Available phones:`, allVendors.map((v: any) => v.phone).slice(0, 10));
        return c.json({
          found: false,
          message: 'Vendor not found',
          totalVendors: allVendors.length,
          samplePhones: allVendors.map((v: any) => ({ phone: v.phone, name: v.fullName })).slice(0, 10)
        });
      }
    } catch (error) {
      console.error('Debug error:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * MIGRATION ENDPOINT - Create staff records for existing approved vendors
   * POST /make-server-3dd53475/admin/migrate/create-staff-for-vendors
   */
  app.post("/make-server-3dd53475/admin/migrate/create-staff-for-vendors", async (c) => {
    try {
      console.log(`\n🔧 ===== MIGRATION: CREATE STAFF FOR EXISTING VENDORS =====`);
      
      // Get all vendors
      const allVendors = await kvStore.getByPrefix('vendor:vendor_');
      console.log(`📊 Total vendors found: ${allVendors.length}`);
      
      const results = {
        total: allVendors.length,
        processed: 0,
        staffCreated: 0,
        staffAlreadyExists: 0,
        skippedCenters: 0,
        errors: []
      };
      
      for (const vendor of allVendors) {
        try {
          results.processed++;
          
          console.log(`\n📝 Processing vendor ${results.processed}/${allVendors.length}: ${vendor.fullName} (${vendor.id})`);
          console.log(`   Status: ${vendor.status}`);
          console.log(`   Vendor Type: ${vendor.vendorType}`);
          console.log(`   Role: ${vendor.roleName}`);
          
          // Only process approved vendors
          if (vendor.status !== 'approved') {
            console.log(`   ⏭️ Skipping - not approved (status: ${vendor.status})`);
            continue;
          }
          
          // Check if this is an individual vendor
          const isIndividualVendor = vendor.vendorType === 'individual' || 
                                     vendor.vendorType === 'individual_professional' ||
                                     vendor.vendorType === 'individual_veterinarian' ||
                                     vendor.vendorType === 'individual_groomer' ||
                                     vendor.vendorType === 'individual_trainer' ||
                                     !vendor.businessName;
          
          if (!isIndividualVendor) {
            console.log(`   ⏭️ Skipping - business/center vendor`);
            results.skippedCenters++;
            continue;
          }
          
          const staffId = `${vendor.id}_staff_self`;
          
          // Check if staff already exists
          const existingStaff = await kvStore.get(`staff:${staffId}`);
          
          if (existingStaff) {
            console.log(`   ✅ Staff already exists: ${staffId}`);
            results.staffAlreadyExists++;
            continue;
          }
          
          // Create staff profile
          const staffProfile = {
            id: staffId,
            vendorId: vendor.id,
            fullName: vendor.fullName,
            name: vendor.fullName,
            phone: vendor.phone || vendor.mobile || '',
            mobile: vendor.mobile || vendor.phone || '',
            email: vendor.email || '',
            
            // Professional details
            specialization: vendor.customFields?.specialization || vendor.specialization || '',
            degree: vendor.customFields?.degree || vendor.degree || '',
            experience: vendor.yearsOfExperience || vendor.experience || 0,
            bio: vendor.customFields?.bio || vendor.bio || '',
            consultationFee: vendor.customFields?.consultationFee || vendor.consultationFee || 0,
            
            // Personal details
            gender: vendor.customFields?.gender || vendor.gender || '',
            dateOfBirth: vendor.customFields?.dateOfBirth || vendor.dateOfBirth || '',
            languages: vendor.customFields?.languages || vendor.languages || ['English', 'Hindi'],
            
            // Address
            address: vendor.address || '',
            city: vendor.city || '',
            state: vendor.state || '',
            pincode: vendor.pincode || '',
            
            // Role and category
            roleId: vendor.roleId,
            roleName: vendor.roleName,
            serviceCategory: vendor.serviceCategory,
            
            // Staff settings
            isActive: true,
            canAcceptBookings: true,
            assignedServices: [],
            
            // Timestamps
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            
            // Link to vendor
            isVendorSelf: true,
            vendorApplicationId: vendor.applicationId,
            migratedAt: new Date().toISOString()
          };
          
          await kvStore.set(`staff:${staffId}`, staffProfile);
          console.log(`   ✅ Staff profile created: ${staffId}`);
          
          // Add staff to vendor's staff list
          const vendorStaffList = await kvStore.get(`vendor:${vendor.id}:staff`) || [];
          if (!vendorStaffList.includes(staffId)) {
            vendorStaffList.push(staffId);
            await kvStore.set(`vendor:${vendor.id}:staff`, vendorStaffList);
            console.log(`   ✅ Added staff to vendor's staff list`);
          }
          
          // Create phone lookup for staff
          const cleanStaffPhone = vendor.phone?.replace(/[^0-9]/g, '');
          if (cleanStaffPhone) {
            await kvStore.set(`staff:phone:${cleanStaffPhone}`, staffId);
            console.log(`   ✅ Created staff phone lookup: ${cleanStaffPhone} → ${staffId}`);
          }
          
          results.staffCreated++;
          
        } catch (error) {
          console.error(`   ❌ Error processing vendor ${vendor.id}:`, error);
          results.errors.push({
            vendorId: vendor.id,
            vendorName: vendor.fullName,
            error: String(error)
          });
        }
      }
      
      console.log(`\n✅ MIGRATION COMPLETE`);
      console.log(`   Total processed: ${results.processed}`);
      console.log(`   Staff created: ${results.staffCreated}`);
      console.log(`   Staff already exists: ${results.staffAlreadyExists}`);
      console.log(`   Centers skipped: ${results.skippedCenters}`);
      console.log(`   Errors: ${results.errors.length}`);
      
      return c.json({
        success: true,
        message: 'Staff migration completed',
        results
      });
      
    } catch (error) {
      console.error('Migration error:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  console.log('✅ Vendor approval workflow endpoints registered');
}