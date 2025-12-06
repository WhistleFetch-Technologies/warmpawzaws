import { Hono } from 'npm:hono@4';

export function insuranceEndpoints(app: Hono, kvStore: any) {
  
  /**
   * Get all insurance plans for a vendor
   * GET /make-server-3dd53475/vendor/:vendorId/insurance/plans
   */
  app.get('/make-server-3dd53475/vendor/:vendorId/insurance/plans', async (c) => {
    try {
      const { vendorId } = c.req.param();
      
      console.log('📋 [INSURANCE] Fetching plans for vendor:', vendorId);
      
      // Get all plans for this vendor
      const allPlans = await kvStore.getByPrefix(`insurance:plan:vendor:${vendorId}:`);
      
      console.log('✅ [INSURANCE] Found plans:', allPlans.length);
      
      return c.json({
        success: true,
        plans: allPlans || [],
        total: allPlans?.length || 0
      });
    } catch (error) {
      console.error('❌ [INSURANCE] Error fetching plans:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * Create new insurance plan
   * POST /make-server-3dd53475/vendor/:vendorId/insurance/plans
   */
  app.post('/make-server-3dd53475/vendor/:vendorId/insurance/plans', async (c) => {
    try {
      const { vendorId } = c.req.param();
      const planData = await c.req.json();
      
      console.log('📝 [INSURANCE] Creating new plan for vendor:', vendorId);
      
      const planId = `plan_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      
      const plan = {
        id: planId,
        vendorId,
        planName: planData.planName,
        petType: planData.petType,
        coverageAmount: planData.coverageAmount,
        premium: planData.premium,
        coveragePercentage: planData.coveragePercentage,
        claimTurnaroundDays: planData.claimTurnaroundDays,
        description: planData.description,
        inclusions: planData.inclusions || [],
        exclusions: planData.exclusions || [],
        ageLimit: planData.ageLimit || { min: 0, max: 15 },
        waitingPeriod: planData.waitingPeriod || 30,
        renewalBenefit: planData.renewalBenefit || '',
        status: 'pending', // Pending admin approval
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      await kvStore.set(`insurance:plan:vendor:${vendorId}:${planId}`, plan);
      await kvStore.set(`insurance:plan:${planId}`, plan);
      
      console.log('✅ [INSURANCE] Plan created:', planId);
      
      return c.json({
        success: true,
        planId,
        plan
      });
    } catch (error) {
      console.error('❌ [INSURANCE] Error creating plan:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * Get all claims for a vendor
   * GET /make-server-3dd53475/vendor/:vendorId/insurance/claims
   */
  app.get('/make-server-3dd53475/vendor/:vendorId/insurance/claims', async (c) => {
    try {
      const { vendorId } = c.req.param();
      
      console.log('📋 [INSURANCE] Fetching claims for vendor:', vendorId);
      
      // Get all claims for this vendor
      const allClaims = await kvStore.getByPrefix(`insurance:claim:vendor:${vendorId}:`);
      
      console.log('✅ [INSURANCE] Found claims:', allClaims.length);
      
      return c.json({
        success: true,
        claims: allClaims || [],
        total: allClaims?.length || 0
      });
    } catch (error) {
      console.error('❌ [INSURANCE] Error fetching claims:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * Get single claim details
   * GET /make-server-3dd53475/vendor/:vendorId/insurance/claims/:claimId
   */
  app.get('/make-server-3dd53475/vendor/:vendorId/insurance/claims/:claimId', async (c) => {
    try {
      const { vendorId, claimId } = c.req.param();
      
      console.log('📋 [INSURANCE] Fetching claim:', claimId);
      
      const claim = await kvStore.get(`insurance:claim:${claimId}`);
      
      if (!claim) {
        return c.json({ error: 'Claim not found' }, 404);
      }
      
      // Verify vendor owns this claim
      if (claim.vendorId !== vendorId) {
        return c.json({ error: 'Unauthorized' }, 403);
      }
      
      return c.json({
        success: true,
        claim
      });
    } catch (error) {
      console.error('❌ [INSURANCE] Error fetching claim:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * Process claim action (approve/reject/request info)
   * POST /make-server-3dd53475/vendor/:vendorId/insurance/claims/:claimId/action
   */
  app.post('/make-server-3dd53475/vendor/:vendorId/insurance/claims/:claimId/action', async (c) => {
    try {
      const { vendorId, claimId } = c.req.param();
      const { action, response } = await c.req.json();
      
      console.log('🔄 [INSURANCE] Processing claim action:', { claimId, action });
      
      const claim = await kvStore.get(`insurance:claim:${claimId}`);
      
      if (!claim) {
        return c.json({ error: 'Claim not found' }, 404);
      }
      
      // Verify vendor owns this claim
      if (claim.vendorId !== vendorId) {
        return c.json({ error: 'Unauthorized' }, 403);
      }
      
      // Update claim status
      const updatedClaim = {
        ...claim,
        status: action,
        vendorResponse: response,
        responseDate: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      await kvStore.set(`insurance:claim:${claimId}`, updatedClaim);
      await kvStore.set(`insurance:claim:vendor:${vendorId}:${claimId}`, updatedClaim);
      
      console.log('✅ [INSURANCE] Claim updated:', claimId);
      
      // TODO: Send notification to customer
      
      return c.json({
        success: true,
        claim: updatedClaim
      });
    } catch (error) {
      console.error('❌ [INSURANCE] Error processing claim action:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * ADMIN: Get all pending insurance plans
   * GET /make-server-3dd53475/admin/insurance/plans/pending
   */
  app.get('/make-server-3dd53475/admin/insurance/plans/pending', async (c) => {
    try {
      console.log('📋 [ADMIN-INSURANCE] Fetching pending plans');
      
      // Get all insurance plans
      const allPlans = await kvStore.getByPrefix('insurance:plan:');
      
      // Filter pending plans
      const pendingPlans = allPlans.filter((plan: any) => plan.status === 'pending');
      
      console.log('✅ [ADMIN-INSURANCE] Found pending plans:', pendingPlans.length);
      
      return c.json({
        success: true,
        plans: pendingPlans,
        total: pendingPlans.length
      });
    } catch (error) {
      console.error('❌ [ADMIN-INSURANCE] Error fetching pending plans:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * ADMIN: Approve/Reject insurance plan
   * POST /make-server-3dd53475/admin/insurance/plans/:planId/review
   */
  app.post('/make-server-3dd53475/admin/insurance/plans/:planId/review', async (c) => {
    try {
      const { planId } = c.req.param();
      const { action, notes } = await c.req.json();
      
      console.log('🔄 [ADMIN-INSURANCE] Reviewing plan:', { planId, action });
      
      const plan = await kvStore.get(`insurance:plan:${planId}`);
      
      if (!plan) {
        return c.json({ error: 'Plan not found' }, 404);
      }
      
      // Update plan status
      const updatedPlan = {
        ...plan,
        status: action, // 'approved' or 'rejected'
        adminNotes: notes,
        reviewedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      await kvStore.set(`insurance:plan:${planId}`, updatedPlan);
      await kvStore.set(`insurance:plan:vendor:${plan.vendorId}:${planId}`, updatedPlan);
      
      console.log('✅ [ADMIN-INSURANCE] Plan reviewed:', planId);
      
      // TODO: Send notification to vendor
      
      return c.json({
        success: true,
        plan: updatedPlan
      });
    } catch (error) {
      console.error('❌ [ADMIN-INSURANCE] Error reviewing plan:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * ADMIN: Get all claims for oversight
   * GET /make-server-3dd53475/admin/insurance/claims
   */
  app.get('/make-server-3dd53475/admin/insurance/claims', async (c) => {
    try {
      console.log('📋 [ADMIN-INSURANCE] Fetching all claims');
      
      const allClaims = await kvStore.getByPrefix('insurance:claim:');
      
      console.log('✅ [ADMIN-INSURANCE] Found claims:', allClaims.length);
      
      return c.json({
        success: true,
        claims: allClaims,
        total: allClaims.length
      });
    } catch (error) {
      console.error('❌ [ADMIN-INSURANCE] Error fetching claims:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  console.log('✅ Insurance endpoints registered');
}
