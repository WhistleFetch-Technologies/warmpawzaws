/**
 * PACKAGE MILESTONE & OTP TRACKING SYSTEM
 * Handles OTP-based service completion for packages with multiple services
 * Each service in a package is a "milestone" that requires customer OTP for completion
 */

import { Hono } from 'npm:hono@4';

export function packageMilestoneEndpoints(app: Hono, kvStore: any) {
  
  /**
   * Generate 4-digit OTP for milestone completion
   */
  const generateOTP = (): string => {
    return Math.floor(1000 + Math.random() * 9000).toString();
  };

  // ============================================
  // CUSTOMER PACKAGE MILESTONE ENDPOINTS
  // ============================================

  /**
   * Get package milestones/services with progress
   * GET /make-server-3dd53475/customer/:customerId/packages/:purchaseId/milestones
   */
  app.get('/make-server-3dd53475/customer/:customerId/packages/:purchaseId/milestones', async (c) => {
    try {
      const { customerId, purchaseId } = c.req.param();
      
      console.log('📋 [MILESTONE] Fetching package milestones:', { customerId, purchaseId });
      
      const purchase = await kvStore.get(`package:purchase:${purchaseId}`);
      
      if (!purchase) {
        return c.json({ error: 'Package not found' }, 404);
      }
      
      if (purchase.customerId !== customerId) {
        return c.json({ error: 'Unauthorized' }, 403);
      }
      
      // Get package details
      const packageObj = await kvStore.get(`package:${purchase.packageId}`);
      
      if (!packageObj) {
        return c.json({ error: 'Package details not found' }, 404);
      }
      
      // Get milestone tracking data
      const milestones = await kvStore.getByPrefix(`package:milestone:purchase:${purchaseId}:`);
      
      // If no milestones exist yet, create them from package services
      if (milestones.length === 0 && packageObj.includedServices?.length > 0) {
        console.log('🆕 [MILESTONE] Creating milestones for first time');
        
        const newMilestones = [];
        
        for (let i = 0; i < packageObj.includedServices.length; i++) {
          const service = packageObj.includedServices[i];
          const milestoneId = `mls_${Date.now()}_${i}_${Math.random().toString(36).substring(7)}`;
          
          const milestone = {
            id: milestoneId,
            purchaseId,
            customerId,
            vendorId: purchase.vendorId,
            packageId: purchase.packageId,
            
            // Service details
            serviceId: service.id,
            serviceName: service.name,
            serviceDescription: service.description || '',
            
            // Order
            sequenceNumber: i + 1,
            totalMilestones: packageObj.includedServices.length,
            
            // Status
            status: 'pending', // 'pending', 'in_progress', 'completed', 'skipped'
            
            // Completion data (filled when completed)
            completedAt: null,
            completedByVendor: null,
            otp: null,
            prescriptionNotes: null,
            medicalRecords: [],
            
            // Timestamps
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };
          
          await kvStore.set(`package:milestone:purchase:${purchaseId}:${milestoneId}`, milestone);
          await kvStore.set(`package:milestone:${milestoneId}`, milestone);
          
          newMilestones.push(milestone);
        }
        
        return c.json({
          success: true,
          purchase,
          package: packageObj,
          milestones: newMilestones,
          progress: {
            total: newMilestones.length,
            completed: 0,
            pending: newMilestones.length,
            percentComplete: 0
          }
        });
      }
      
      // Calculate progress
      const completed = milestones.filter((m: any) => m.status === 'completed').length;
      const pending = milestones.filter((m: any) => m.status === 'pending').length;
      const inProgress = milestones.filter((m: any) => m.status === 'in_progress').length;
      
      return c.json({
        success: true,
        purchase,
        package: packageObj,
        milestones: milestones.sort((a: any, b: any) => a.sequenceNumber - b.sequenceNumber),
        progress: {
          total: milestones.length,
          completed,
          pending,
          inProgress,
          percentComplete: Math.round((completed / milestones.length) * 100)
        }
      });
    } catch (error) {
      console.error('❌ [MILESTONE] Error fetching milestones:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * Generate OTP for milestone completion (customer initiates)
   * POST /make-server-3dd53475/customer/:customerId/packages/milestones/:milestoneId/generate-otp
   */
  app.post('/make-server-3dd53475/customer/:customerId/packages/milestones/:milestoneId/generate-otp', async (c) => {
    try {
      const { customerId, milestoneId } = c.req.param();
      
      console.log('🔑 [MILESTONE] Generating OTP for milestone:', { customerId, milestoneId });
      
      const milestone = await kvStore.get(`package:milestone:${milestoneId}`);
      
      if (!milestone) {
        return c.json({ error: 'Milestone not found' }, 404);
      }
      
      if (milestone.customerId !== customerId) {
        return c.json({ error: 'Unauthorized' }, 403);
      }
      
      if (milestone.status === 'completed') {
        return c.json({ error: 'Milestone already completed' }, 400);
      }
      
      // Generate new OTP
      const otp = generateOTP();
      const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 minutes
      
      // Update milestone with OTP
      const updatedMilestone = {
        ...milestone,
        status: 'in_progress',
        otp,
        otpExpiresAt,
        otpGeneratedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      await kvStore.set(`package:milestone:${milestoneId}`, updatedMilestone);
      await kvStore.set(`package:milestone:purchase:${milestone.purchaseId}:${milestoneId}`, updatedMilestone);
      
      console.log('✅ [MILESTONE] OTP generated:', otp);
      
      return c.json({
        success: true,
        otp,
        otpExpiresAt,
        milestone: updatedMilestone
      });
    } catch (error) {
      console.error('❌ [MILESTONE] Error generating OTP:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  // ============================================
  // VENDOR MILESTONE COMPLETION ENDPOINTS
  // ============================================

  /**
   * Get pending milestones for vendor
   * GET /make-server-3dd53475/vendor/:vendorId/package-milestones
   */
  app.get('/make-server-3dd53475/vendor/:vendorId/package-milestones', async (c) => {
    try {
      const { vendorId } = c.req.param();
      const { status } = c.req.query();
      
      console.log('📋 [VENDOR-MILESTONE] Fetching milestones for vendor:', vendorId);
      
      // Get all milestones
      const allMilestones = await kvStore.getByPrefix('package:milestone:purchase:');
      
      // Filter by vendor
      let vendorMilestones = allMilestones.filter((m: any) => m.vendorId === vendorId);
      
      // Filter by status if provided
      if (status) {
        vendorMilestones = vendorMilestones.filter((m: any) => m.status === status);
      }
      
      // Enrich with customer and purchase details
      const enrichedMilestones = await Promise.all(
        vendorMilestones.map(async (milestone: any) => {
          const customer = await kvStore.get(`customer:${milestone.customerId}`);
          const purchase = await kvStore.get(`package:purchase:${milestone.purchaseId}`);
          
          return {
            ...milestone,
            customerDetails: {
              name: customer?.name || 'Unknown',
              phone: customer?.phone || '',
              email: customer?.email || ''
            },
            packageDetails: {
              packageName: purchase?.packageName || 'Package',
              packageType: purchase?.packageType || ''
            }
          };
        })
      );
      
      // Sort by date (newest first)
      enrichedMilestones.sort((a: any, b: any) => 
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      );
      
      console.log('✅ [VENDOR-MILESTONE] Found milestones:', enrichedMilestones.length);
      
      return c.json({
        success: true,
        milestones: enrichedMilestones,
        total: enrichedMilestones.length
      });
    } catch (error) {
      console.error('❌ [VENDOR-MILESTONE] Error fetching milestones:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * Complete milestone with OTP verification
   * POST /make-server-3dd53475/vendor/:vendorId/package-milestones/:milestoneId/complete
   */
  app.post('/make-server-3dd53475/vendor/:vendorId/package-milestones/:milestoneId/complete', async (c) => {
    try {
      const { vendorId, milestoneId } = c.req.param();
      const { otp, prescriptionNotes, medicalRecords } = await c.req.json();
      
      console.log('✅ [VENDOR-MILESTONE] Attempting to complete milestone:', { vendorId, milestoneId, otp });
      
      const milestone = await kvStore.get(`package:milestone:${milestoneId}`);
      
      if (!milestone) {
        return c.json({ error: 'Milestone not found' }, 404);
      }
      
      if (milestone.vendorId !== vendorId) {
        return c.json({ error: 'Unauthorized' }, 403);
      }
      
      if (milestone.status === 'completed') {
        return c.json({ error: 'Milestone already completed' }, 400);
      }
      
      // Verify OTP
      if (!milestone.otp) {
        return c.json({ error: 'OTP not generated yet. Customer must generate OTP first.' }, 400);
      }
      
      if (milestone.otp !== otp) {
        return c.json({ error: 'Invalid OTP' }, 400);
      }
      
      // Check OTP expiry
      if (milestone.otpExpiresAt && new Date(milestone.otpExpiresAt) < new Date()) {
        return c.json({ error: 'OTP expired. Customer must generate new OTP.' }, 400);
      }
      
      // Validate prescription notes (required for all services)
      if (!prescriptionNotes || prescriptionNotes.trim() === '') {
        return c.json({ error: 'Prescription/service notes are required' }, 400);
      }
      
      // Complete milestone
      const completedMilestone = {
        ...milestone,
        status: 'completed',
        completedAt: new Date().toISOString(),
        completedByVendor: vendorId,
        prescriptionNotes,
        medicalRecords: medicalRecords || [],
        otp: null, // Clear OTP after use for security
        otpExpiresAt: null,
        updatedAt: new Date().toISOString()
      };
      
      await kvStore.set(`package:milestone:${milestoneId}`, completedMilestone);
      await kvStore.set(`package:milestone:purchase:${milestone.purchaseId}:${milestoneId}`, completedMilestone);
      
      // Update package purchase progress
      const purchase = await kvStore.get(`package:purchase:${milestone.purchaseId}`);
      if (purchase) {
        if (!purchase.completedMilestones) {
          purchase.completedMilestones = 0;
        }
        purchase.completedMilestones += 1;
        purchase.lastMilestoneCompletedAt = new Date().toISOString();
        purchase.updatedAt = new Date().toISOString();
        
        await kvStore.set(`package:purchase:${milestone.purchaseId}`, purchase);
        await kvStore.set(`customer:package:${milestone.customerId}:${milestone.purchaseId}`, purchase);
      }
      
      console.log('✅ [VENDOR-MILESTONE] Milestone completed successfully:', milestoneId);
      
      return c.json({
        success: true,
        milestone: completedMilestone,
        message: 'Service completed successfully'
      });
    } catch (error) {
      console.error('❌ [VENDOR-MILESTONE] Error completing milestone:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * Get milestone details
   * GET /make-server-3dd53475/vendor/:vendorId/package-milestones/:milestoneId
   */
  app.get('/make-server-3dd53475/vendor/:vendorId/package-milestones/:milestoneId', async (c) => {
    try {
      const { vendorId, milestoneId } = c.req.param();
      
      console.log('📋 [VENDOR-MILESTONE] Fetching milestone details:', { vendorId, milestoneId });
      
      const milestone = await kvStore.get(`package:milestone:${milestoneId}`);
      
      if (!milestone) {
        return c.json({ error: 'Milestone not found' }, 404);
      }
      
      if (milestone.vendorId !== vendorId) {
        return c.json({ error: 'Unauthorized' }, 403);
      }
      
      // Enrich with customer details
      const customer = await kvStore.get(`customer:${milestone.customerId}`);
      const purchase = await kvStore.get(`package:purchase:${milestone.purchaseId}`);
      const packageObj = await kvStore.get(`package:${milestone.packageId}`);
      
      const enrichedMilestone = {
        ...milestone,
        customerDetails: {
          name: customer?.name || 'Unknown',
          phone: customer?.phone || '',
          email: customer?.email || ''
        },
        purchaseDetails: {
          packageName: purchase?.packageName || 'Package',
          packageType: purchase?.packageType || '',
          purchasedAt: purchase?.purchasedAt || ''
        },
        packageDetails: {
          totalServices: packageObj?.includedServices?.length || 0
        }
      };
      
      return c.json({
        success: true,
        milestone: enrichedMilestone
      });
    } catch (error) {
      console.error('❌ [VENDOR-MILESTONE] Error fetching milestone:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * Get all milestones for a specific package purchase
   * GET /make-server-3dd53475/vendor/:vendorId/packages/:purchaseId/all-milestones
   */
  app.get('/make-server-3dd53475/vendor/:vendorId/packages/:purchaseId/all-milestones', async (c) => {
    try {
      const { vendorId, purchaseId } = c.req.param();
      
      console.log('📋 [VENDOR-MILESTONE] Fetching all milestones for purchase:', { vendorId, purchaseId });
      
      const purchase = await kvStore.get(`package:purchase:${purchaseId}`);
      
      if (!purchase) {
        return c.json({ error: 'Package purchase not found' }, 404);
      }
      
      if (purchase.vendorId !== vendorId) {
        return c.json({ error: 'Unauthorized' }, 403);
      }
      
      const milestones = await kvStore.getByPrefix(`package:milestone:purchase:${purchaseId}:`);
      
      // Sort by sequence number
      milestones.sort((a: any, b: any) => a.sequenceNumber - b.sequenceNumber);
      
      return c.json({
        success: true,
        purchase,
        milestones,
        progress: {
          total: milestones.length,
          completed: milestones.filter((m: any) => m.status === 'completed').length,
          pending: milestones.filter((m: any) => m.status === 'pending').length
        }
      });
    } catch (error) {
      console.error('❌ [VENDOR-MILESTONE] Error fetching milestones:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  console.log('✅ Package milestone endpoints registered');
}
