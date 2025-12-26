/**
 * ✅ RE-VERIFICATION MANAGEMENT ENDPOINTS - SQL-ONLY VERSION
 * Vendor re-verification and rate change management
 * 
 * ✅ MIGRATED TO SQL: NO KV STORE - All data from SQL
 * KV Operations: 48 → 0
 * 
 * Features:
 * - Vendor re-verification scheduling
 * - Renewal notice management
 * - Rate change request approval/rejection
 * - Custom service approval workflow
 */

import { Hono } from 'npm:hono';
import { getDbClient, withTransaction } from '../../lib/db.ts';
import { getVendorsRepository } from '../../lib/repositories/vendors.ts';
import { getNotificationsRepository } from '../../lib/repositories/notifications.ts';
import { sendSuccess, sendError } from './response-utils.ts';

export function registerReverificationEndpointsSQL(app: Hono) {
  const client = getDbClient();
  const vendorsRepo = getVendorsRepository();
  const notificationsRepo = getNotificationsRepository();
  const BASE_PATH = '/make-server-3dd53475';

  // ============================================
  // RE-VERIFICATION ENDPOINTS
  // ============================================

  /**
   * GET /admin/vendors/reverification
   * Get all vendors requiring re-verification
   */
  app.get(`${BASE_PATH}/admin/vendors/reverification`, async (c) => {
    try {
      // ✅ SQL: Get all active vendors
      const allVendors = await vendorsRepo.findAllActive();
      
      // Filter vendors that need re-verification
      const reverificationList = allVendors
        .filter((v: any) => v.status === 'active')
        .map((vendor: any) => {
          // Calculate days until license expiry (from vendor metadata or default)
          const licenseExpiry = vendor.license_expiry || vendor.licenseExpiry || 
            new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
          const daysLeft = Math.ceil((new Date(licenseExpiry).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
          
          let status = 'valid';
          if (daysLeft < 0) status = 'expired';
          else if (daysLeft <= 10) status = 'expiring';
          else if (daysLeft <= 28) status = 'expiring';
          
          return {
            id: vendor.id,
            businessName: vendor.business_name,
            vendorId: vendor.id,
            status,
            daysLeft: daysLeft > 0 ? daysLeft : 0,
            daysLeftText: daysLeft > 0 ? `${daysLeft} days left` : `${Math.abs(daysLeft)} days due`,
            requiredDocuments: vendor.required_documents || ['Business License', 'Health Certificate'],
            scheduledDate: vendor.reverification_scheduled_date || null,
            licenseExpiry,
            category: vendor.category || 'general'
          };
        })
        .sort((a: any, b: any) => a.daysLeft - b.daysLeft);
      
      console.log('Re-verification list:', reverificationList.length);
      return sendSuccess(c, { vendors: reverificationList });
    } catch (error) {
      console.error('Error fetching re-verification list:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * POST /admin/vendors/reverification/:vendorId/schedule
   * Schedule re-verification for a vendor
   */
  app.post(`${BASE_PATH}/admin/vendors/reverification/:vendorId/schedule`, async (c) => {
    try {
      const { vendorId } = c.req.param();
      const { scheduledDate, notes } = await c.req.json();
      
      // ✅ SQL: Get vendor
      const vendor = await vendorsRepo.findById(vendorId);
      
      if (!vendor) {
        return sendError(c, new Error('Vendor not found'), 404);
      }
      
      // ✅ SQL: Update vendor with reverification schedule (store in metadata JSONB or separate field)
      // For now, storing in platform_settings as vendor-specific metadata
      const { data: existingSettings } = await client
        .from('platform_settings')
        .select('setting_value')
        .eq('setting_key', `vendor_reverification:${vendorId}`)
        .maybeSingle();

      const reverificationData = {
        scheduledDate,
        notes,
        updatedAt: new Date().toISOString()
      };

      await client
        .from('platform_settings')
        .upsert({
          setting_key: `vendor_reverification:${vendorId}`,
          setting_value: reverificationData,
          setting_type: 'object',
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'setting_key'
        });
      
      console.log('Re-verification scheduled for vendor:', vendorId, scheduledDate);
      return sendSuccess(c, { success: true, vendor });
    } catch (error) {
      console.error('Error scheduling re-verification:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * POST /admin/vendors/reverification/:vendorId/send-notice
   * Send renewal notice
   */
  app.post(`${BASE_PATH}/admin/vendors/reverification/:vendorId/send-notice`, async (c) => {
    try {
      const { vendorId } = c.req.param();
      const { noticeType } = await c.req.json();
      
      // ✅ SQL: Get vendor
      const vendor = await vendorsRepo.findById(vendorId);
      
      if (!vendor) {
        return sendError(c, new Error('Vendor not found'), 404);
      }
      
      // ✅ SQL: Log the notice in platform_settings
      const { data: existingSettings } = await client
        .from('platform_settings')
        .select('setting_value')
        .eq('setting_key', `vendor_reverification:${vendorId}`)
        .maybeSingle();

      const reverificationData = existingSettings?.setting_value || {};
      const notices = reverificationData.renewalNotices || [];
      
      notices.push({
        type: noticeType,
        sentAt: new Date().toISOString(),
        status: 'sent'
      });
      
      reverificationData.renewalNotices = notices;
      reverificationData.updatedAt = new Date().toISOString();

      await client
        .from('platform_settings')
        .upsert({
          setting_key: `vendor_reverification:${vendorId}`,
          setting_value: reverificationData,
          setting_type: 'object',
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'setting_key'
        });
      
      // ✅ SQL: Send notification to vendor
      await notificationsRepo.create({
        user_id: vendorId, // Assuming vendor has user_id
        notification_type: 'reverification_notice',
        title: 'Renewal Notice',
        message: `Your license renewal notice has been sent. Type: ${noticeType}`,
        data: { noticeType, vendorId }
      });
      
      console.log('Renewal notice sent to vendor:', vendorId, noticeType);
      return sendSuccess(c, { success: true, message: 'Notice sent successfully' });
    } catch (error) {
      console.error('Error sending renewal notice:', error);
      return sendError(c, error, 500);
    }
  });

  // ============================================
  // RATE CHANGE REQUEST ENDPOINTS
  // ============================================

  /**
   * GET /admin/vendors/rate-changes
   * Get all rate change requests
   */
  app.get(`${BASE_PATH}/admin/vendors/rate-changes`, async (c) => {
    try {
      console.log('📊 [ADMIN] Fetching all rate change requests...');
      
      // ✅ SQL: Get rate change requests from platform_settings
      const { data: rateChangeSettings } = await client
        .from('platform_settings')
        .select('setting_value')
        .eq('setting_key', 'rate_change_requests')
        .maybeSingle();

      const rateChangeRequests = (rateChangeSettings?.setting_value as any)?.requests || [];
      console.log(`   Found ${rateChangeRequests.length} rate_change_request entries`);
      
      // Filter and transform rate change requests
      const pendingRateChanges = rateChangeRequests
        .filter((req: any) => req.status === 'pending')
        .map((req: any) => {
          if (req.services && req.services.length > 0) {
            // Bulk submission
            return req.services.map((service: any) => ({
              id: `${req.id}_${service.serviceId}`,
              originalRequestId: req.id,
              vendorId: req.vendorId,
              businessName: req.businessName || req.vendorName,
              service: service.serviceName,
              description: service.customDescription || service.description || '',
              currentRate: 0,
              proposedRate: service.customPrice || service.price || 0,
              changePercentage: service.isNewService ? 'New Service' : 'Price Update',
              reason: req.metadata?.reason || `Service configuration for ${req.serviceStyle}`,
              status: 'pending',
              requestedAt: req.submittedAt,
              type: service.isNewService ? 'custom_service' : 'rate_change',
              duration: service.customDuration || service.duration,
              categoryName: service.categoryName,
              subCategoryName: service.subCategoryName,
              isCustomService: service.isNewService || false,
              serviceStyle: req.serviceStyle,
              isPackage: service.isPackage || false,
              packageDetails: service.packageDetails
            }));
          } else {
            // Single service change
            return [{
              id: req.id,
              originalRequestId: req.id,
              vendorId: req.vendorId,
              businessName: req.businessName || req.vendorName,
              service: req.serviceName || 'Unknown Service',
              description: req.description || '',
              currentRate: req.currentRate || 0,
              proposedRate: req.proposedRate || 0,
              changePercentage: req.changePercentage || 'N/A',
              reason: req.reason || '',
              status: 'pending',
              requestedAt: req.submittedAt || req.requestedAt,
              type: 'rate_change',
              duration: req.duration,
              categoryName: req.categoryName,
              subCategoryName: req.subCategoryName
            }];
          }
        }).flat();
      
      // ✅ SQL: Get custom service approvals
      const { data: customServiceSettings } = await client
        .from('platform_settings')
        .select('setting_value')
        .eq('setting_key', 'custom_service_approvals')
        .maybeSingle();

      const customServiceApprovals = (customServiceSettings?.setting_value as any)?.approvals || [];
      console.log(`   Found ${customServiceApprovals.length} custom_service_approval entries`);
      
      const pendingCustomServices = customServiceApprovals
        .filter((approval: any) => approval.status === 'pending')
        .map((approval: any) => {
          const service = approval.service;
          return {
            id: approval.id,
            originalRequestId: approval.id,
            vendorId: approval.vendorId,
            businessName: approval.vendorName,
            service: service.serviceName || service.name,
            description: service.description || '',
            currentRate: 0,
            proposedRate: service.isPackage ? service.packageDetails?.pricing?.packagePrice : service.price,
            changePercentage: 'New Service',
            reason: service.isPackage ? `Package: ${service.packageDetails?.packageType}` : 'Custom Service',
            status: 'pending',
            requestedAt: approval.submittedAt,
            type: 'custom_service',
            duration: service.duration,
            categoryName: service.categoryName || 'Custom',
            subCategoryName: service.subCategoryName || '',
            isCustomService: true,
            serviceStyle: approval.serviceStyle,
            isPackage: service.isPackage || false,
            packageDetails: service.packageDetails
          };
        });
      
      // Combine both types and sort by date
      const combined = [...pendingRateChanges, ...pendingCustomServices].sort((a, b) => 
        new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime()
      );
      
      console.log(`✅ [ADMIN] Rate Changes tab loaded: ${pendingRateChanges.length} rate changes + ${pendingCustomServices.length} custom services = ${combined.length} total`);
      
      return sendSuccess(c, { rateChanges: combined });
    } catch (error) {
      console.error('❌ [ADMIN] Error fetching rate changes:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * POST /admin/vendors/rate-changes/:requestId/approve
   * Approve rate change
   */
  app.post(`${BASE_PATH}/admin/vendors/rate-changes/:requestId/approve`, async (c) => {
    try {
      const { requestId } = c.req.param();
      const { adminNote } = await c.req.json();
      
      console.log(`✅ [ADMIN] Approving request: ${requestId}`);
      
      await withTransaction(async () => {
        // Check if it's a custom service approval
        if (requestId.startsWith('PKG_') || requestId.startsWith('CUSTOM_') || requestId.startsWith('CS_')) {
          // ✅ SQL: Get custom service approval
          const { data: customServiceSettings } = await client
            .from('platform_settings')
            .select('setting_value')
            .eq('setting_key', 'custom_service_approvals')
            .maybeSingle();

          const approvals = (customServiceSettings?.setting_value as any)?.approvals || [];
          const approvalIndex = approvals.findIndex((a: any) => a.id === requestId);
          
          if (approvalIndex === -1) {
            throw new Error('Custom service approval not found');
          }
          
          const approval = approvals[approvalIndex];
          
          if (approval.status !== 'pending') {
            throw new Error(`Request already ${approval.status}`);
          }
          
          // Update approval status
          approvals[approvalIndex] = {
            ...approval,
            status: 'approved',
            approvedAt: new Date().toISOString(),
            adminNote: adminNote || ''
          };
          
          await client
            .from('platform_settings')
            .upsert({
              setting_key: 'custom_service_approvals',
              setting_value: { approvals },
              setting_type: 'object',
              updated_at: new Date().toISOString()
            }, {
              onConflict: 'setting_key'
            });
          
          // ✅ SQL: Send notification to vendor
          await notificationsRepo.create({
            user_id: approval.vendorId,
            notification_type: 'service_approved',
            title: '✅ Service Approved',
            message: `Your ${approval.service.isPackage ? 'package' : 'service'} "${approval.service.serviceName}" has been approved and is now live!`,
            data: {
              serviceId: requestId,
              serviceName: approval.service.serviceName,
              adminNote: adminNote || null
            }
          });
          
          return sendSuccess(c, { 
            success: true, 
            message: 'Service approved and published successfully'
          });
        }
        
        // Handle bulk rate change request
        if (requestId.startsWith('RATE_REQ_')) {
          // ✅ SQL: Get rate change request
          const { data: rateChangeSettings } = await client
            .from('platform_settings')
            .select('setting_value')
            .eq('setting_key', 'rate_change_requests')
            .maybeSingle();

          const requests = (rateChangeSettings?.setting_value as any)?.requests || [];
          const requestIndex = requests.findIndex((r: any) => r.id === requestId);
          
          if (requestIndex === -1) {
            throw new Error('Rate change request not found');
          }
          
          const bulkRequest = requests[requestIndex];
          
          if (bulkRequest.status !== 'pending') {
            throw new Error(`Request already ${bulkRequest.status}`);
          }
          
          // Update request status
          requests[requestIndex] = {
            ...bulkRequest,
            status: 'approved',
            approvedAt: new Date().toISOString(),
            adminNote: adminNote || ''
          };
          
          await client
            .from('platform_settings')
            .upsert({
              setting_key: 'rate_change_requests',
              setting_value: { requests },
              setting_type: 'object',
              updated_at: new Date().toISOString()
            }, {
              onConflict: 'setting_key'
            });
          
          // ✅ SQL: Send notification to vendor
          await notificationsRepo.create({
            user_id: bulkRequest.vendorId,
            notification_type: 'services_approved',
            title: '✅ Services Approved',
            message: `Your ${bulkRequest.services.length} service(s) have been approved and are now live!`,
            data: {
              requestId,
              serviceCount: bulkRequest.services.length,
              adminNote: adminNote || null
            }
          });
          
          return sendSuccess(c, { 
            success: true, 
            message: `${bulkRequest.services.length} services approved and published successfully`
          });
        }
        
        throw new Error('Request type not recognized');
      });
    } catch (error) {
      console.error('❌ [ADMIN] Error approving request:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * POST /admin/vendors/rate-changes/:requestId/reject
   * Reject rate change
   */
  app.post(`${BASE_PATH}/admin/vendors/rate-changes/:requestId/reject`, async (c) => {
    try {
      const { requestId } = c.req.param();
      const { adminNote } = await c.req.json();
      
      console.log(`❌ [ADMIN] Rejecting request: ${requestId}`);
      
      if (!adminNote || adminNote.trim() === '') {
        return sendError(c, new Error('Rejection reason is required'), 400);
      }
      
      await withTransaction(async () => {
        // Check if it's a custom service approval
        if (requestId.startsWith('PKG_') || requestId.startsWith('CUSTOM_') || requestId.startsWith('CS_')) {
          // ✅ SQL: Get custom service approval
          const { data: customServiceSettings } = await client
            .from('platform_settings')
            .select('setting_value')
            .eq('setting_key', 'custom_service_approvals')
            .maybeSingle();

          const approvals = (customServiceSettings?.setting_value as any)?.approvals || [];
          const approvalIndex = approvals.findIndex((a: any) => a.id === requestId);
          
          if (approvalIndex === -1) {
            throw new Error('Custom service approval not found');
          }
          
          const approval = approvals[approvalIndex];
          
          if (approval.status !== 'pending') {
            throw new Error(`Request already ${approval.status}`);
          }
          
          const service = approval.service;
          const vendorId = approval.vendorId;
          const serviceStyle = approval.serviceStyle;
          
          // ✅ SQL: Update vendor_services (stored in platform_settings)
          const { data: vendorServicesSettings } = await client
            .from('platform_settings')
            .select('setting_value')
            .eq('setting_key', `vendor_services:${vendorId}:${serviceStyle}`)
            .maybeSingle();

          if (vendorServicesSettings?.setting_value) {
            const vendorServices = vendorServicesSettings.setting_value as any;
            if (vendorServices.services) {
              const serviceIndex = vendorServices.services.findIndex(
                (s: any) => s.id === requestId || s.serviceId === requestId
              );
              
              if (serviceIndex !== -1) {
                vendorServices.services[serviceIndex].publishStatus = 'rejected';
                vendorServices.services[serviceIndex].rejectedAt = new Date().toISOString();
                vendorServices.services[serviceIndex].rejectionReason = adminNote.trim();
                vendorServices.services[serviceIndex].rejectedBy = 'admin';
                
                await client
                  .from('platform_settings')
                  .upsert({
                    setting_key: `vendor_services:${vendorId}:${serviceStyle}`,
                    setting_value: vendorServices,
                    setting_type: 'object',
                    updated_at: new Date().toISOString()
                  }, {
                    onConflict: 'setting_key'
                  });
              }
            }
          }
          
          // Update approval status
          approvals[approvalIndex] = {
            ...approval,
            status: 'rejected',
            rejectedAt: new Date().toISOString(),
            rejectionReason: adminNote.trim()
          };
          
          await client
            .from('platform_settings')
            .upsert({
              setting_key: 'custom_service_approvals',
              setting_value: { approvals },
              setting_type: 'object',
              updated_at: new Date().toISOString()
            }, {
              onConflict: 'setting_key'
            });
          
          // ✅ SQL: Send notification
          await notificationsRepo.create({
            user_id: vendorId,
            notification_type: 'service_rejected',
            title: '❌ Service Rejected',
            message: `Your ${service.isPackage ? 'package' : 'service'} "${service.serviceName}" was rejected. Reason: ${adminNote}`,
            data: {
              serviceId: requestId,
              serviceName: service.serviceName,
              rejectionReason: adminNote
            }
          });
          
          return sendSuccess(c, { 
            success: true, 
            message: 'Service rejected and vendor notified'
          });
        }
        
        // Handle bulk rate change request
        if (requestId.startsWith('RATE_REQ_')) {
          // ✅ SQL: Get rate change request
          const { data: rateChangeSettings } = await client
            .from('platform_settings')
            .select('setting_value')
            .eq('setting_key', 'rate_change_requests')
            .maybeSingle();

          const requests = (rateChangeSettings?.setting_value as any)?.requests || [];
          const requestIndex = requests.findIndex((r: any) => r.id === requestId);
          
          if (requestIndex === -1) {
            throw new Error('Rate change request not found');
          }
          
          const bulkRequest = requests[requestIndex];
          
          if (bulkRequest.status !== 'pending') {
            throw new Error(`Request already ${bulkRequest.status}`);
          }
          
          const vendorId = bulkRequest.vendorId;
          const serviceStyle = bulkRequest.serviceStyle;
          
          // ✅ SQL: Update vendor_services
          const { data: vendorServicesSettings } = await client
            .from('platform_settings')
            .select('setting_value')
            .eq('setting_key', `vendor_services:${vendorId}:${serviceStyle}`)
            .maybeSingle();

          if (vendorServicesSettings?.setting_value) {
            const vendorServices = vendorServicesSettings.setting_value as any;
            if (vendorServices.services) {
              let rejectedCount = 0;
              
              vendorServices.services.forEach((service: any) => {
                if (service.approvalRequestId === requestId) {
                  service.publishStatus = 'rejected';
                  service.rejectedAt = new Date().toISOString();
                  service.rejectionReason = adminNote.trim();
                  service.rejectedBy = 'admin';
                  delete service.approvalRequestId;
                  rejectedCount++;
                }
              });
              
              await client
                .from('platform_settings')
                .upsert({
                  setting_key: `vendor_services:${vendorId}:${serviceStyle}`,
                  setting_value: vendorServices,
                  setting_type: 'object',
                  updated_at: new Date().toISOString()
                }, {
                  onConflict: 'setting_key'
                });
            }
          }
          
          // Update bulk request status
          requests[requestIndex] = {
            ...bulkRequest,
            status: 'rejected',
            rejectedAt: new Date().toISOString(),
            rejectionReason: adminNote.trim()
          };
          
          await client
            .from('platform_settings')
            .upsert({
              setting_key: 'rate_change_requests',
              setting_value: { requests },
              setting_type: 'object',
              updated_at: new Date().toISOString()
            }, {
              onConflict: 'setting_key'
            });
          
          // ✅ SQL: Send notification
          await notificationsRepo.create({
            user_id: vendorId,
            notification_type: 'services_rejected',
            title: '❌ Services Rejected',
            message: `Your ${bulkRequest.services.length} service(s) submission was rejected. Reason: ${adminNote}`,
            data: {
              requestId,
              serviceCount: bulkRequest.services.length,
              rejectionReason: adminNote
            }
          });
          
          return sendSuccess(c, { 
            success: true, 
            message: `${bulkRequest.services.length} services rejected and vendor notified`
          });
        }
        
        throw new Error('Request type not recognized');
      });
    } catch (error) {
      console.error('❌ [ADMIN] Error rejecting request:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * POST /admin/vendors/rate-changes/:requestId/clarification
   * Request clarification for rate change
   */
  app.post(`${BASE_PATH}/admin/vendors/rate-changes/:requestId/clarification`, async (c) => {
    try {
      const { requestId } = c.req.param();
      const { adminNote } = await c.req.json();
      
      console.log(`💬 [ADMIN] Requesting clarification for: ${requestId}`);
      
      if (!adminNote || adminNote.trim() === '') {
        return sendError(c, new Error('Clarification message is required'), 400);
      }
      
      await withTransaction(async () => {
        // Check if it's a custom service approval
        if (requestId.startsWith('PKG_') || requestId.startsWith('CUSTOM_') || requestId.startsWith('CS_')) {
          // ✅ SQL: Get custom service approval
          const { data: customServiceSettings } = await client
            .from('platform_settings')
            .select('setting_value')
            .eq('setting_key', 'custom_service_approvals')
            .maybeSingle();

          const approvals = (customServiceSettings?.setting_value as any)?.approvals || [];
          const approvalIndex = approvals.findIndex((a: any) => a.id === requestId);
          
          if (approvalIndex === -1) {
            throw new Error('Custom service approval not found');
          }
          
          const approval = approvals[approvalIndex];
          
          if (approval.status !== 'pending') {
            throw new Error(`Request already ${approval.status}`);
          }
          
          const service = approval.service;
          const vendorId = approval.vendorId;
          const serviceStyle = approval.serviceStyle;
          
          // ✅ SQL: Update vendor_services
          const { data: vendorServicesSettings } = await client
            .from('platform_settings')
            .select('setting_value')
            .eq('setting_key', `vendor_services:${vendorId}:${serviceStyle}`)
            .maybeSingle();

          if (vendorServicesSettings?.setting_value) {
            const vendorServices = vendorServicesSettings.setting_value as any;
            if (vendorServices.services) {
              const serviceIndex = vendorServices.services.findIndex(
                (s: any) => s.id === requestId || s.serviceId === requestId
              );
              
              if (serviceIndex !== -1) {
                vendorServices.services[serviceIndex].publishStatus = 'needs_clarification';
                vendorServices.services[serviceIndex].clarificationRequestedAt = new Date().toISOString();
                vendorServices.services[serviceIndex].clarificationMessage = adminNote.trim();
                
                await client
                  .from('platform_settings')
                  .upsert({
                    setting_key: `vendor_services:${vendorId}:${serviceStyle}`,
                    setting_value: vendorServices,
                    setting_type: 'object',
                    updated_at: new Date().toISOString()
                  }, {
                    onConflict: 'setting_key'
                  });
              }
            }
          }
          
          // Update approval status
          approvals[approvalIndex] = {
            ...approval,
            status: 'needs_clarification',
            clarificationRequestedAt: new Date().toISOString(),
            clarificationMessage: adminNote.trim()
          };
          
          await client
            .from('platform_settings')
            .upsert({
              setting_key: 'custom_service_approvals',
              setting_value: { approvals },
              setting_type: 'object',
              updated_at: new Date().toISOString()
            }, {
              onConflict: 'setting_key'
            });
          
          // ✅ SQL: Send notification
          await notificationsRepo.create({
            user_id: vendorId,
            notification_type: 'service_clarification',
            title: '💬 Clarification Needed',
            message: `Admin needs more information about your ${service.isPackage ? 'package' : 'service'} "${service.serviceName}". Message: ${adminNote}`,
            data: {
              serviceId: requestId,
              serviceName: service.serviceName,
              clarificationMessage: adminNote
            }
          });
          
          return sendSuccess(c, { 
            success: true, 
            message: 'Clarification requested and vendor notified'
          });
        }
        
        // Handle bulk rate change request
        if (requestId.startsWith('RATE_REQ_')) {
          // ✅ SQL: Get rate change request
          const { data: rateChangeSettings } = await client
            .from('platform_settings')
            .select('setting_value')
            .eq('setting_key', 'rate_change_requests')
            .maybeSingle();

          const requests = (rateChangeSettings?.setting_value as any)?.requests || [];
          const requestIndex = requests.findIndex((r: any) => r.id === requestId);
          
          if (requestIndex === -1) {
            throw new Error('Rate change request not found');
          }
          
          const bulkRequest = requests[requestIndex];
          
          if (bulkRequest.status !== 'pending') {
            throw new Error(`Request already ${bulkRequest.status}`);
          }
          
          const vendorId = bulkRequest.vendorId;
          const serviceStyle = bulkRequest.serviceStyle;
          
          // ✅ SQL: Update vendor_services
          const { data: vendorServicesSettings } = await client
            .from('platform_settings')
            .select('setting_value')
            .eq('setting_key', `vendor_services:${vendorId}:${serviceStyle}`)
            .maybeSingle();

          if (vendorServicesSettings?.setting_value) {
            const vendorServices = vendorServicesSettings.setting_value as any;
            if (vendorServices.services) {
              let clarificationCount = 0;
              
              vendorServices.services.forEach((service: any) => {
                if (service.approvalRequestId === requestId) {
                  service.publishStatus = 'needs_clarification';
                  service.clarificationRequestedAt = new Date().toISOString();
                  service.clarificationMessage = adminNote.trim();
                  clarificationCount++;
                }
              });
              
              await client
                .from('platform_settings')
                .upsert({
                  setting_key: `vendor_services:${vendorId}:${serviceStyle}`,
                  setting_value: vendorServices,
                  setting_type: 'object',
                  updated_at: new Date().toISOString()
                }, {
                  onConflict: 'setting_key'
                });
            }
          }
          
          // Update bulk request status
          requests[requestIndex] = {
            ...bulkRequest,
            status: 'needs_clarification',
            clarificationRequestedAt: new Date().toISOString(),
            clarificationMessage: adminNote.trim()
          };
          
          await client
            .from('platform_settings')
            .upsert({
              setting_key: 'rate_change_requests',
              setting_value: { requests },
              setting_type: 'object',
              updated_at: new Date().toISOString()
            }, {
              onConflict: 'setting_key'
            });
          
          // ✅ SQL: Send notification
          await notificationsRepo.create({
            user_id: vendorId,
            notification_type: 'services_clarification',
            title: '💬 Clarification Needed',
            message: `Admin needs more information about your ${bulkRequest.services.length} service(s) submission. Message: ${adminNote}`,
            data: {
              requestId,
              serviceCount: bulkRequest.services.length,
              clarificationMessage: adminNote
            }
          });
          
          return sendSuccess(c, { 
            success: true, 
            message: `Clarification requested for ${bulkRequest.services.length} services`
          });
        }
        
        throw new Error('Request type not recognized');
      });
    } catch (error) {
      console.error('❌ [ADMIN] Error requesting clarification:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * POST /admin/seed-rate-changes
   * Seed rate change requests for testing
   */
  app.post(`${BASE_PATH}/admin/seed-rate-changes`, async (c) => {
    try {
      const sampleRateChanges = [
        {
          id: 'RC-001',
          vendorId: 'vendor_001',
          businessName: 'Dr. Priya Veterinary Clinic',
          service: 'General Consultation',
          currentRate: 500,
          proposedRate: 600,
          changePercentage: '+20%',
          reason: 'Increased operational costs and equipment upgrades',
          status: 'pending',
          requestedAt: new Date().toISOString()
        },
        {
          id: 'RC-002',
          vendorId: 'vendor_002',
          businessName: 'Dr. Priya Veterinary Clinic',
          service: 'General Consultation',
          currentRate: 500,
          proposedRate: 600,
          changePercentage: '+20%',
          reason: 'Increased operational costs and equipment upgrades',
          status: 'pending',
          requestedAt: new Date().toISOString()
        },
        {
          id: 'RC-003',
          vendorId: 'vendor_003',
          businessName: 'Dr. Priya Veterinary Clinic',
          service: 'General Consultation',
          currentRate: 500,
          proposedRate: 600,
          changePercentage: '+20%',
          reason: 'Increased operational costs and equipment upgrades',
          status: 'pending',
          requestedAt: new Date().toISOString()
        },
        {
          id: 'RC-004',
          vendorId: 'vendor_004',
          businessName: 'Dr. Priya Veterinary Clinic',
          service: 'General Consultation',
          currentRate: 500,
          proposedRate: 600,
          changePercentage: '+20%',
          reason: 'Increased operational costs and equipment upgrades',
          status: 'pending',
          requestedAt: new Date().toISOString()
        }
      ];

      // ✅ SQL: Store in platform_settings
      await client
        .from('platform_settings')
        .upsert({
          setting_key: 'rate_change_requests',
          setting_value: { requests: sampleRateChanges },
          setting_type: 'object',
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'setting_key'
        });
      
      console.log('✅ Seeded rate change requests');
      return sendSuccess(c, { success: true, message: 'Rate change requests seeded' });
    } catch (error) {
      console.error('Error seeding rate changes:', error);
      return sendError(c, error, 500);
    }
  });
}

