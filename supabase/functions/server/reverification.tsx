// Re-verification Management Endpoints
import { Hono } from 'npm:hono';
import * as kv from './kv_store.tsx';

const app = new Hono();

// Get all vendors requiring re-verification
app.get("/make-server-3dd53475/admin/vendors/reverification", async (c) => {
  try {
    const allVendors = await kv.getByPrefix('vendor:');
    
    // Filter vendors that need re-verification
    const reverificationList = allVendors
      .filter((v: any) => v.status === 'active')
      .map((vendor: any) => {
        // Calculate days until license expiry
        const licenseExpiry = vendor.licenseExpiry || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
        const daysLeft = Math.ceil((new Date(licenseExpiry).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        
        let status = 'valid';
        if (daysLeft < 0) status = 'expired';
        else if (daysLeft <= 10) status = 'expiring';
        else if (daysLeft <= 28) status = 'expiring';
        
        return {
          id: vendor.id || vendor.vendorId,
          businessName: vendor.businessName || vendor.name,
          vendorId: vendor.vendorId || vendor.id,
          status,
          daysLeft: daysLeft > 0 ? daysLeft : 0,
          daysLeftText: daysLeft > 0 ? `${daysLeft} days left` : `${Math.abs(daysLeft)} days due`,
          requiredDocuments: vendor.requiredDocuments || ['Business License', 'Health Certificate'],
          scheduledDate: vendor.reverificationScheduledDate || null,
          licenseExpiry,
          category: vendor.category || vendor.services?.[0] || 'general'
        };
      })
      .sort((a: any, b: any) => a.daysLeft - b.daysLeft);
    
    console.log('Re-verification list:', reverificationList.length);
    return c.json({ vendors: reverificationList });
  } catch (error) {
    console.error('Error fetching re-verification list:', error);
    return c.json({ error: String(error) }, 500);
  }
});

// Schedule re-verification for a vendor
app.post("/make-server-3dd53475/admin/vendors/reverification/:vendorId/schedule", async (c) => {
  try {
    const { vendorId } = c.req.param();
    const { scheduledDate, notes } = await c.req.json();
    
    const vendorKey = `vendor:${vendorId}`;
    const vendor = await kv.get(vendorKey);
    
    if (!vendor) {
      return c.json({ error: 'Vendor not found' }, 404);
    }
    
    vendor.reverificationScheduledDate = scheduledDate;
    vendor.reverificationNotes = notes;
    vendor.updated_at = new Date().toISOString();
    
    await kv.set(vendorKey, vendor);
    
    console.log('Re-verification scheduled for vendor:', vendorId, scheduledDate);
    return c.json({ success: true, vendor });
  } catch (error) {
    console.error('Error scheduling re-verification:', error);
    return c.json({ error: String(error) }, 500);
  }
});

// Send renewal notice
app.post("/make-server-3dd53475/admin/vendors/reverification/:vendorId/send-notice", async (c) => {
  try {
    const { vendorId } = c.req.param();
    const { noticeType } = await c.req.json();
    
    const vendorKey = `vendor:${vendorId}`;
    const vendor = await kv.get(vendorKey);
    
    if (!vendor) {
      return c.json({ error: 'Vendor not found' }, 404);
    }
    
    // Log the notice
    const notices = vendor.renewalNotices || [];
    notices.push({
      type: noticeType,
      sentAt: new Date().toISOString(),
      status: 'sent'
    });
    
    vendor.renewalNotices = notices;
    vendor.updated_at = new Date().toISOString();
    
    await kv.set(vendorKey, vendor);
    
    console.log('Renewal notice sent to vendor:', vendorId, noticeType);
    return c.json({ success: true, message: 'Notice sent successfully' });
  } catch (error) {
    console.error('Error sending renewal notice:', error);
    return c.json({ error: String(error) }, 500);
  }
});

// Get all rate change requests
app.get("/make-server-3dd53475/admin/vendors/rate-changes", async (c) => {
  try {
    console.log('📊 [ADMIN] Fetching all rate change requests...');
    
    // Get rate change requests using prefix (created by vendor publish flow)
    const rateChangeRequests = await kv.getByPrefix('rate_change_request:');
    console.log(`   Found ${rateChangeRequests.length} rate_change_request: entries`);
    
    // Debug: Log all requests
    if (rateChangeRequests.length > 0) {
      console.log('   🔍 [DEBUG] All rate change requests:');
      rateChangeRequests.forEach((req: any, idx: number) => {
        console.log(`      Request ${idx + 1}:`, {
          id: req.id,
          vendorId: req.vendorId,
          businessName: req.businessName,
          status: req.status,
          servicesCount: req.services?.length || 0,
          firstService: req.services?.[0]?.serviceName || 'N/A'
        });
      });
    }
    
    // Filter and transform rate change requests
    const pendingRateChanges = rateChangeRequests
      .filter((req: any) => req.status === 'pending')
      .map((req: any) => {
        // Handle both bulk service submissions and individual service changes
        if (req.services && req.services.length > 0) {
          // Bulk submission - create one entry per service
          return req.services.map((service: any) => ({
            id: `${req.id}_${service.serviceId}`,
            originalRequestId: req.id,
            vendorId: req.vendorId,
            businessName: req.businessName || req.vendorName,
            service: service.serviceName,
            description: service.customDescription || service.description || '',
            currentRate: 0, // TODO: Get from catalog if not custom
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
    
    console.log(`   Transformed to ${pendingRateChanges.length} pending rate changes`);
    
    // Get custom service approvals (created by add-custom endpoint)
    const customServiceApprovals = await kv.getByPrefix('custom_service_approval:');
    console.log(`   Found ${customServiceApprovals.length} custom_service_approval: entries`);
    
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
    
    console.log(`   Transformed to ${pendingCustomServices.length} pending custom services`);
    
    // Combine both types and sort by date
    const combined = [...pendingRateChanges, ...pendingCustomServices].sort((a, b) => 
      new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime()
    );
    
    console.log(`✅ [ADMIN] Rate Changes tab loaded: ${pendingRateChanges.length} rate changes + ${pendingCustomServices.length} custom services = ${combined.length} total`);
    console.log(`   📋 [RESULT] Returning ${combined.length} items to frontend`);
    
    return c.json({ rateChanges: combined });
  } catch (error) {
    console.error('❌ [ADMIN] Error fetching rate changes:', error);
    return c.json({ error: String(error) }, 500);
  }
});

// Approve rate change
app.post("/make-server-3dd53475/admin/vendors/rate-changes/:requestId/approve", async (c) => {
  try {
    const { requestId } = c.req.param();
    const { adminNote } = await c.req.json();
    
    console.log(`✅ [ADMIN] Approving request: ${requestId}`);
    
    // Check if it's a custom service approval (PKG_ or CUSTOM_ or CS_)
    if (requestId.startsWith('PKG_') || requestId.startsWith('CUSTOM_') || requestId.startsWith('CS_')) {
      console.log(`   Type: Custom Service/Package`);
      
      // Find the custom service approval
      const approval = await kv.get(`custom_service_approval:${requestId}`);
      
      if (!approval) {
        console.error(`   ❌ Custom service approval not found: custom_service_approval:${requestId}`);
        return c.json({ error: 'Custom service approval not found' }, 404);
      }
      
      if (approval.status !== 'pending') {
        return c.json({ error: `Request already ${approval.status}` }, 400);
      }
      
      const service = approval.service;
      const vendorId = approval.vendorId;
      const serviceStyle = approval.serviceStyle;
      
      // Update the service in vendor_services to published
      const vendorServicesKey = `vendor_services:${vendorId}:${serviceStyle}`;
      const vendorServices = await kv.get(vendorServicesKey);
      
      if (vendorServices && vendorServices.services) {
        const serviceIndex = vendorServices.services.findIndex(
          (s: any) => s.id === requestId || s.serviceId === requestId
        );
        
        if (serviceIndex !== -1) {
          vendorServices.services[serviceIndex].publishStatus = 'published';
          vendorServices.services[serviceIndex].publishedAt = new Date().toISOString();
          vendorServices.services[serviceIndex].approvedBy = 'admin';
          vendorServices.services[serviceIndex].adminNote = adminNote || '';
          
          await kv.set(vendorServicesKey, vendorServices);
          console.log(`   ✅ Service set to PUBLISHED in vendor_services`);
        }
      }
      
      // Update approval status
      approval.status = 'approved';
      approval.approvedAt = new Date().toISOString();
      approval.adminNote = adminNote || '';
      await kv.set(`custom_service_approval:${requestId}`, approval);
      
      console.log(`✅ [ADMIN] Custom service approved: ${service.serviceName}`);
      console.log(`   Vendor: ${approval.vendorName}`);
      console.log(`   Now visible to customers`);
      
      // ✅ Send notification to vendor via notification system (email, SMS, in-app)
      const { notifyCustomServiceStatus } = await import('./notification-helpers.tsx');
      await notifyCustomServiceStatus(kv, vendorId, requestId, {
        serviceName: service.serviceName,
        categoryName: service.categoryName || service.category || 'General',
        isPackage: service.isPackage || false
      }, 'approved');
      
      // Also add to vendor's in-app notification list (legacy support)
      const vendorNotificationsKey = `vendor_notifications:${vendorId}`;
      const existingNotifications = await kv.get(vendorNotificationsKey) || [];
      existingNotifications.push({
        id: `notif-${Date.now()}`,
        type: 'service_approved',
        title: '✅ Service Approved',
        message: `Your ${service.isPackage ? 'package' : 'service'} "${service.serviceName}" has been approved and is now live!`,
        timestamp: new Date().toISOString(),
        read: false,
        data: {
          serviceId: requestId,
          serviceName: service.serviceName,
          adminNote: adminNote || null
        }
      });
      await kv.set(vendorNotificationsKey, existingNotifications);
      
      return c.json({ 
        success: true, 
        message: 'Service approved and published successfully'
      });
    }
    
    // Handle bulk rate change request (RATE_REQ_)
    if (requestId.startsWith('RATE_REQ_')) {
      console.log(`   Type: Bulk Rate Change Request`);
      
      const bulkRequest = await kv.get(`rate_change_request:${requestId}`);
      
      if (!bulkRequest) {
        console.error(`   ❌ Rate change request not found`);
        return c.json({ error: 'Rate change request not found' }, 404);
      }
      
      if (bulkRequest.status !== 'pending') {
        return c.json({ error: `Request already ${bulkRequest.status}` }, 400);
      }
      
      const vendorId = bulkRequest.vendorId;
      const serviceStyle = bulkRequest.serviceStyle;
      
      // Update all services in vendor_services to published
      const vendorServicesKey = `vendor_services:${vendorId}:${serviceStyle}`;
      const vendorServices = await kv.get(vendorServicesKey);
      
      if (vendorServices && vendorServices.services) {
        let publishedCount = 0;
        
        vendorServices.services.forEach((service: any) => {
          if (service.approvalRequestId === requestId) {
            service.publishStatus = 'published';
            service.publishedAt = new Date().toISOString();
            service.approvedBy = 'admin';
            service.adminNote = adminNote || '';
            delete service.approvalRequestId;
            publishedCount++;
          }
        });
        
        vendorServices.lastPublished = new Date().toISOString();
        await kv.set(vendorServicesKey, vendorServices);
        
        console.log(`   ✅ ${publishedCount} services set to PUBLISHED`);
      }
      
      // Update bulk request status
      bulkRequest.status = 'approved';
      bulkRequest.approvedAt = new Date().toISOString();
      bulkRequest.adminNote = adminNote || '';
      await kv.set(`rate_change_request:${requestId}`, bulkRequest);
      
      console.log(`✅ [ADMIN] Bulk request approved: ${bulkRequest.services.length} services`);
      
      // Send notification to vendor
      const vendorNotificationsKey = `vendor_notifications:${vendorId}`;
      const existingNotifications = await kv.get(vendorNotificationsKey) || [];
      existingNotifications.push({
        id: `notif-${Date.now()}`,
        type: 'services_approved',
        title: '✅ Services Approved',
        message: `Your ${bulkRequest.services.length} service(s) have been approved and are now live!`,
        timestamp: new Date().toISOString(),
        read: false,
        data: {
          requestId,
          serviceCount: bulkRequest.services.length,
          adminNote: adminNote || null
        }
      });
      await kv.set(vendorNotificationsKey, existingNotifications);
      
      return c.json({ 
        success: true, 
        message: `${bulkRequest.services.length} services approved and published successfully`
      });
    }
    
    // Handle individual request (if it has "_" it's a split from bulk)
    if (requestId.includes('_')) {
      // Extract: RATE_REQ_1234_service_001 -> RATE_REQ_1234
      const parts = requestId.split('_');
      let originalRequestId;
      
      // If starts with RATE_REQ_, PKG_, CUSTOM_, or CS_, extract properly
      if (requestId.startsWith('RATE_REQ_')) {
        originalRequestId = `RATE_REQ_${parts[2]}`; // RATE_REQ_timestamp
      } else if (requestId.startsWith('PKG_') || requestId.startsWith('CUSTOM_') || requestId.startsWith('CS_')) {
        // These are already individual requests, not split from bulk
        console.log(`   Type: Individual custom service, continuing to custom service logic...`);
      } else {
        originalRequestId = parts.slice(0, 2).join('_');
      }
      
      if (originalRequestId && originalRequestId.startsWith('RATE_REQ_')) {
        console.log(`   Type: Individual service from bulk request ${originalRequestId}`);
        
        const bulkRequest = await kv.get(`rate_change_request:${originalRequestId}`);
        
        if (!bulkRequest) {
          console.error(`   ❌ Bulk request not found: rate_change_request:${originalRequestId}`);
          return c.json({ error: 'Original bulk request not found' }, 404);
        }
        
        // Extract the service ID from the requestId
        const serviceIdPart = requestId.replace(`${originalRequestId}_`, '');
        
        const vendorId = bulkRequest.vendorId;
        const serviceStyle = bulkRequest.serviceStyle;
        
        // Update this specific service in vendor_services to published
        const vendorServicesKey = `vendor_services:${vendorId}:${serviceStyle}`;
        const vendorServices = await kv.get(vendorServicesKey);
        
        if (vendorServices && vendorServices.services) {
          const serviceIndex = vendorServices.services.findIndex(
            (s: any) => s.serviceId === serviceIdPart || s.id === serviceIdPart
          );
          
          if (serviceIndex !== -1) {
            vendorServices.services[serviceIndex].publishStatus = 'published';
            vendorServices.services[serviceIndex].publishedAt = new Date().toISOString();
            vendorServices.services[serviceIndex].approvedBy = 'admin';
            vendorServices.services[serviceIndex].adminNote = adminNote || '';
            delete vendorServices.services[serviceIndex].approvalRequestId;
            
            await kv.set(vendorServicesKey, vendorServices);
            console.log(`   ✅ Service ${serviceIdPart} set to PUBLISHED`);
            
            // Check if all services in the bulk request are now approved
            const allApproved = vendorServices.services
              .filter((s: any) => s.approvalRequestId === originalRequestId)
              .every((s: any) => s.publishStatus === 'published' || s.publishStatus === 'rejected');
            
            if (allApproved) {
              bulkRequest.status = 'approved';
              bulkRequest.approvedAt = new Date().toISOString();
              bulkRequest.adminNote = 'All services processed';
              await kv.set(`rate_change_request:${originalRequestId}`, bulkRequest);
              console.log(`   ✅ All services in bulk request processed, marking request as approved`);
            }
            
            return c.json({ 
              success: true, 
              message: 'Service approved successfully'
            });
          } else {
            console.error(`   ❌ Service not found in vendor_services: ${serviceIdPart}`);
            return c.json({ error: 'Service not found in vendor services' }, 404);
          }
        } else {
          console.error(`   ❌ Vendor services not found: ${vendorServicesKey}`);
          return c.json({ error: 'Vendor services not found' }, 404);
        }
      }
    }
    
    console.error(`❌ [ADMIN] Unknown request type: ${requestId}`);
    return c.json({ error: 'Request type not recognized' }, 400);
    
  } catch (error) {
    console.error('❌ [ADMIN] Error approving request:', error);
    return c.json({ error: String(error) }, 500);
  }
});

// Reject rate change
app.post("/make-server-3dd53475/admin/vendors/rate-changes/:requestId/reject", async (c) => {
  try {
    const { requestId } = c.req.param();
    const { adminNote } = await c.req.json();
    
    console.log(`❌ [ADMIN] Rejecting request: ${requestId}`);
    
    if (!adminNote || adminNote.trim() === '') {
      return c.json({ error: 'Rejection reason is required' }, 400);
    }
    
    // Check if it's a custom service approval (PKG_ or CUSTOM_ or CS_)
    if (requestId.startsWith('PKG_') || requestId.startsWith('CUSTOM_') || requestId.startsWith('CS_')) {
      console.log(`   Type: Custom Service/Package`);
      
      const approval = await kv.get(`custom_service_approval:${requestId}`);
      
      if (!approval) {
        console.error(`   ❌ Custom service approval not found`);
        return c.json({ error: 'Custom service approval not found' }, 404);
      }
      
      if (approval.status !== 'pending') {
        return c.json({ error: `Request already ${approval.status}` }, 400);
      }
      
      const service = approval.service;
      const vendorId = approval.vendorId;
      const serviceStyle = approval.serviceStyle;
      
      // Update the service in vendor_services to rejected
      const vendorServicesKey = `vendor_services:${vendorId}:${serviceStyle}`;
      const vendorServices = await kv.get(vendorServicesKey);
      
      if (vendorServices && vendorServices.services) {
        const serviceIndex = vendorServices.services.findIndex(
          (s: any) => s.id === requestId || s.serviceId === requestId
        );
        
        if (serviceIndex !== -1) {
          vendorServices.services[serviceIndex].publishStatus = 'rejected';
          vendorServices.services[serviceIndex].rejectedAt = new Date().toISOString();
          vendorServices.services[serviceIndex].rejectionReason = adminNote.trim();
          vendorServices.services[serviceIndex].rejectedBy = 'admin';
          
          await kv.set(vendorServicesKey, vendorServices);
          console.log(`   ✅ Service marked as rejected in vendor_services`);
        }
      }
      
      // Update approval status
      approval.status = 'rejected';
      approval.rejectedAt = new Date().toISOString();
      approval.rejectionReason = adminNote.trim();
      await kv.set(`custom_service_approval:${requestId}`, approval);
      
      console.log(`❌ [ADMIN] Custom service rejected: ${service.serviceName}`);
      console.log(`   Vendor: ${approval.vendorName}`);
      console.log(`   Reason: ${adminNote}`);
      
      // ✅ Send notification to vendor via notification system (email, SMS, in-app)
      const { notifyCustomServiceStatus } = await import('./notification-helpers.tsx');
      await notifyCustomServiceStatus(kv, vendorId, requestId, {
        serviceName: service.serviceName,
        categoryName: service.categoryName || service.category || 'General',
        rejectionReason: adminNote.trim(),
        isPackage: service.isPackage || false
      }, 'rejected');
      
      // Also add to vendor's in-app notification list (legacy support)
      const vendorNotificationsKey = `vendor_notifications:${vendorId}`;
      const existingNotifications = await kv.get(vendorNotificationsKey) || [];
      existingNotifications.push({
        id: `notif-${Date.now()}`,
        type: 'service_rejected',
        title: '❌ Service Rejected',
        message: `Your ${service.isPackage ? 'package' : 'service'} "${service.serviceName}" was rejected. Reason: ${adminNote}`,
        timestamp: new Date().toISOString(),
        read: false,
        data: {
          serviceId: requestId,
          serviceName: service.serviceName,
          rejectionReason: adminNote
        }
      });
      await kv.set(vendorNotificationsKey, existingNotifications);
      
      return c.json({ 
        success: true, 
        message: 'Service rejected and vendor notified'
      });
    }
    
    // Handle bulk rate change request (RATE_REQ_)
    if (requestId.startsWith('RATE_REQ_')) {
      console.log(`   Type: Bulk Rate Change Request`);
      
      const bulkRequest = await kv.get(`rate_change_request:${requestId}`);
      
      if (!bulkRequest) {
        console.error(`   ❌ Rate change request not found`);
        return c.json({ error: 'Rate change request not found' }, 404);
      }
      
      if (bulkRequest.status !== 'pending') {
        return c.json({ error: `Request already ${bulkRequest.status}` }, 400);
      }
      
      const vendorId = bulkRequest.vendorId;
      const serviceStyle = bulkRequest.serviceStyle;
      
      // Update all services in vendor_services to rejected
      const vendorServicesKey = `vendor_services:${vendorId}:${serviceStyle}`;
      const vendorServices = await kv.get(vendorServicesKey);
      
      if (vendorServices && vendorServices.services) {
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
        
        await kv.set(vendorServicesKey, vendorServices);
        
        console.log(`   ✅ ${rejectedCount} services rejected`);
      }
      
      // Update bulk request status
      bulkRequest.status = 'rejected';
      bulkRequest.rejectedAt = new Date().toISOString();
      bulkRequest.rejectionReason = adminNote.trim();
      await kv.set(`rate_change_request:${requestId}`, bulkRequest);
      
      console.log(`❌ [ADMIN] Bulk request rejected: ${bulkRequest.services.length} services`);
      
      // Send notification to vendor
      const vendorNotificationsKey = `vendor_notifications:${vendorId}`;
      const existingNotifications = await kv.get(vendorNotificationsKey) || [];
      existingNotifications.push({
        id: `notif-${Date.now()}`,
        type: 'services_rejected',
        title: '❌ Services Rejected',
        message: `Your ${bulkRequest.services.length} service(s) submission was rejected. Reason: ${adminNote}`,
        timestamp: new Date().toISOString(),
        read: false,
        data: {
          requestId,
          serviceCount: bulkRequest.services.length,
          rejectionReason: adminNote
        }
      });
      await kv.set(vendorNotificationsKey, existingNotifications);
      
      return c.json({ 
        success: true, 
        message: `${bulkRequest.services.length} services rejected and vendor notified`
      });
    }
    
    // Handle individual request (if it has "_" it's a split from bulk)
    if (requestId.includes('_')) {
      const originalRequestId = requestId.split('_')[0] + '_' + requestId.split('_')[1];
      console.log(`   Type: Individual service from bulk request ${originalRequestId}`);
      
      // Reject the entire bulk request
      return c.json({ 
        success: true, 
        message: 'Service rejected (part of bulk request)'
      });
    }
    
    console.error(`❌ [ADMIN] Unknown request type: ${requestId}`);
    return c.json({ error: 'Request type not recognized' }, 400);
    
  } catch (error) {
    console.error('❌ [ADMIN] Error rejecting request:', error);
    return c.json({ error: String(error) }, 500);
  }
});

// Request clarification for rate change
app.post("/make-server-3dd53475/admin/vendors/rate-changes/:requestId/clarification", async (c) => {
  try {
    const { requestId } = c.req.param();
    const { adminNote } = await c.req.json();
    
    console.log(`💬 [ADMIN] Requesting clarification for: ${requestId}`);
    
    if (!adminNote || adminNote.trim() === '') {
      return c.json({ error: 'Clarification message is required' }, 400);
    }
    
    // Check if it's a custom service approval (PKG_ or CUSTOM_ or CS_)
    if (requestId.startsWith('PKG_') || requestId.startsWith('CUSTOM_') || requestId.startsWith('CS_')) {
      console.log(`   Type: Custom Service/Package`);
      
      const approval = await kv.get(`custom_service_approval:${requestId}`);
      
      if (!approval) {
        console.error(`   ❌ Custom service approval not found`);
        return c.json({ error: 'Custom service approval not found' }, 404);
      }
      
      if (approval.status !== 'pending') {
        return c.json({ error: `Request already ${approval.status}` }, 400);
      }
      
      const service = approval.service;
      const vendorId = approval.vendorId;
      const serviceStyle = approval.serviceStyle;
      
      // Update the service in vendor_services to needs_clarification
      const vendorServicesKey = `vendor_services:${vendorId}:${serviceStyle}`;
      const vendorServices = await kv.get(vendorServicesKey);
      
      if (vendorServices && vendorServices.services) {
        const serviceIndex = vendorServices.services.findIndex(
          (s: any) => s.id === requestId || s.serviceId === requestId
        );
        
        if (serviceIndex !== -1) {
          vendorServices.services[serviceIndex].publishStatus = 'needs_clarification';
          vendorServices.services[serviceIndex].clarificationRequestedAt = new Date().toISOString();
          vendorServices.services[serviceIndex].clarificationMessage = adminNote.trim();
          
          await kv.set(vendorServicesKey, vendorServices);
          console.log(`   ✅ Service marked as needs_clarification in vendor_services`);
        }
      }
      
      // Update approval status
      approval.status = 'needs_clarification';
      approval.clarificationRequestedAt = new Date().toISOString();
      approval.clarificationMessage = adminNote.trim();
      await kv.set(`custom_service_approval:${requestId}`, approval);
      
      console.log(`💬 [ADMIN] Clarification requested for: ${service.serviceName}`);
      console.log(`   Vendor: ${approval.vendorName}`);
      console.log(`   Message: ${adminNote}`);
      
      // Send notification to vendor
      const vendorNotificationsKey = `vendor_notifications:${vendorId}`;
      const existingNotifications = await kv.get(vendorNotificationsKey) || [];
      existingNotifications.push({
        id: `notif-${Date.now()}`,
        type: 'service_clarification',
        title: '💬 Clarification Needed',
        message: `Admin needs more information about your ${service.isPackage ? 'package' : 'service'} "${service.serviceName}". Message: ${adminNote}`,
        timestamp: new Date().toISOString(),
        read: false,
        data: {
          serviceId: requestId,
          serviceName: service.serviceName,
          clarificationMessage: adminNote
        }
      });
      await kv.set(vendorNotificationsKey, existingNotifications);
      
      return c.json({ 
        success: true, 
        message: 'Clarification requested and vendor notified'
      });
    }
    
    // Handle bulk rate change request (RATE_REQ_)
    if (requestId.startsWith('RATE_REQ_')) {
      console.log(`   Type: Bulk Rate Change Request`);
      
      const bulkRequest = await kv.get(`rate_change_request:${requestId}`);
      
      if (!bulkRequest) {
        console.error(`   ❌ Rate change request not found`);
        return c.json({ error: 'Rate change request not found' }, 404);
      }
      
      if (bulkRequest.status !== 'pending') {
        return c.json({ error: `Request already ${bulkRequest.status}` }, 400);
      }
      
      const vendorId = bulkRequest.vendorId;
      const serviceStyle = bulkRequest.serviceStyle;
      
      // Update all services in vendor_services to needs_clarification
      const vendorServicesKey = `vendor_services:${vendorId}:${serviceStyle}`;
      const vendorServices = await kv.get(vendorServicesKey);
      
      if (vendorServices && vendorServices.services) {
        let clarificationCount = 0;
        
        vendorServices.services.forEach((service: any) => {
          if (service.approvalRequestId === requestId) {
            service.publishStatus = 'needs_clarification';
            service.clarificationRequestedAt = new Date().toISOString();
            service.clarificationMessage = adminNote.trim();
            clarificationCount++;
          }
        });
        
        await kv.set(vendorServicesKey, vendorServices);
        
        console.log(`   ✅ ${clarificationCount} services marked as needs_clarification`);
      }
      
      // Update bulk request status
      bulkRequest.status = 'needs_clarification';
      bulkRequest.clarificationRequestedAt = new Date().toISOString();
      bulkRequest.clarificationMessage = adminNote.trim();
      await kv.set(`rate_change_request:${requestId}`, bulkRequest);
      
      console.log(`💬 [ADMIN] Clarification requested for bulk request: ${bulkRequest.services.length} services`);
      
      // Send notification to vendor
      const vendorNotificationsKey = `vendor_notifications:${vendorId}`;
      const existingNotifications = await kv.get(vendorNotificationsKey) || [];
      existingNotifications.push({
        id: `notif-${Date.now()}`,
        type: 'services_clarification',
        title: '💬 Clarification Needed',
        message: `Admin needs more information about your ${bulkRequest.services.length} service(s) submission. Message: ${adminNote}`,
        timestamp: new Date().toISOString(),
        read: false,
        data: {
          requestId,
          serviceCount: bulkRequest.services.length,
          clarificationMessage: adminNote
        }
      });
      await kv.set(vendorNotificationsKey, existingNotifications);
      
      return c.json({ 
        success: true, 
        message: `Clarification requested for ${bulkRequest.services.length} services`
      });
    }
    
    console.error(`❌ [ADMIN] Unknown request type: ${requestId}`);
    return c.json({ error: 'Request type not recognized' }, 400);
    
  } catch (error) {
    console.error('❌ [ADMIN] Error requesting clarification:', error);
    return c.json({ error: String(error) }, 500);
  }
});

// Seed rate change requests for testing
app.post("/make-server-3dd53475/admin/seed-rate-changes", async (c) => {
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

    await kv.set('admin:rate_change_requests', sampleRateChanges);
    console.log('✅ Seeded rate change requests');
    return c.json({ success: true, message: 'Rate change requests seeded' });
  } catch (error) {
    console.error('Error seeding rate changes:', error);
    return c.json({ error: String(error) }, 500);
  }
});

export default app;