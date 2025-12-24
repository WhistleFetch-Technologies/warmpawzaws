/**
 * ============================================================================
 * INSURANCE ENDPOINTS - SQL-ONLY VERSION
 * ============================================================================
 * 
 * REFACTORED: Removed all KV usage, using SQL repositories only
 * 
 * Features:
 * - Insurance plan browsing
 * - Policy purchase & management
 * - Document upload & verification
 * - Claim filing & tracking
 * - Premium calculation
 * - Coverage validation
 * 
 * RULES:
 * ❌ NO KV imports allowed
 * ✅ All operations use SQL only
 * ✅ Proper error handling
 * ✅ CRUD operations via repositories
 * 
 * Date: 2025-01-27
 * Migration: Phase 2 - Critical Flow Migration
 * ============================================================================
 */

import { Hono } from "npm:hono";
import { sendSuccess, sendError } from "./response-utils.ts";
import { getInsuranceRepository } from "../../lib/repositories/insurance.ts";

/**
 * Calculate premium based on pet age, breed, and coverage
 */
function calculatePremium(
  basePremium: number,
  petAge: number,
  petBreed: string,
  coverageAmount: number
): number {
  let premium = basePremium;

  // Age-based adjustments
  if (petAge < 1) {
    premium *= 1.2; // 20% increase for puppies/kittens
  } else if (petAge > 8) {
    premium *= 1.5; // 50% increase for senior pets
  } else if (petAge > 5) {
    premium *= 1.2; // 20% increase for middle-aged pets
  }

  // Breed-based adjustments (premium breeds cost more)
  const premiumBreeds = ['bulldog', 'pug', 'persian', 'maine coon'];
  if (premiumBreeds.includes(petBreed.toLowerCase())) {
    premium *= 1.3; // 30% increase for premium breeds
  }

  // Coverage amount adjustment
  if (coverageAmount > 50000) {
    premium *= 1.1; // 10% increase for high coverage
  }

  return Math.round(premium);
}

export function insuranceEndpoints(app: Hono) {
  const BASE_PATH = "/make-server-3dd53475";
  const insuranceRepo = getInsuranceRepository();

  /**
   * GET /insurance/plans
   * Browse available insurance plans
   */
  app.get(`${BASE_PATH}/insurance/plans`, async (c) => {
    try {
      const type = c.req.query('type');
      const minCoverage = parseFloat(c.req.query('minCoverage') || '0');
      const maxPremium = parseFloat(c.req.query('maxPremium') || '999999');

      // ✅ SQL: Get all plans
      const allPlans = await insuranceRepo.getAllPlans({
        type: type || undefined,
        isActive: true,
      });

      // Apply filters
      let plans = allPlans;

      if (minCoverage > 0) {
        plans = plans.filter((p: any) => 
          ((p.coverage.accidentCover || 0) + (p.coverage.illnessCover || 0)) >= minCoverage
        );
      }

      if (maxPremium < 999999) {
        plans = plans.filter((p: any) => p.monthlyPremium <= maxPremium);
      }

      // Sort by premium
      plans.sort((a: any, b: any) => a.monthlyPremium - b.monthlyPremium);

      return sendSuccess(c, {
        count: plans.length,
        plans
      });

    } catch (error) {
      console.error('❌ Error fetching insurance plans:', error);
      return sendError(c, String(error), 500);
    }
  });

  /**
   * POST /insurance/calculate-premium
   * Calculate premium for specific pet
   */
  app.post(`${BASE_PATH}/insurance/calculate-premium`, async (c) => {
    try {
      const body = await c.req.json();
      const { planId, petAge, petBreed, coverageAmount } = body;

      if (!planId || petAge === undefined) {
        return sendError(c, 'Missing required fields', 400);
      }

      // ✅ SQL: Get plan
      const plan = await insuranceRepo.getPlanById(planId);
      
      if (!plan) {
        return sendError(c, 'Plan not found', 404);
      }

      const monthlyPremium = calculatePremium(
        plan.monthlyPremium,
        petAge,
        petBreed || 'mixed',
        coverageAmount || plan.coverage.accidentCover
      );

      return sendSuccess(c, {
        planId,
        planName: plan.planName,
        monthlyPremium,
        annualPremium: monthlyPremium * 12,
        quarterlyPremium: monthlyPremium * 3,
        breakdown: {
          basePremium: plan.monthlyPremium,
          ageAdjustment: monthlyPremium - plan.monthlyPremium,
          totalPremium: monthlyPremium
        }
      });

    } catch (error) {
      console.error('❌ Error calculating premium:', error);
      return sendError(c, String(error), 500);
    }
  });

  /**
   * POST /insurance/policy/purchase
   * Purchase insurance policy
   */
  app.post(`${BASE_PATH}/insurance/policy/purchase`, async (c) => {
    try {
      const body = await c.req.json();
      const {
        customerId,
        petId,
        petName,
        petAge,
        petBreed,
        planId,
        paymentFrequency = 'monthly'
      } = body;

      if (!customerId || !petId || !planId) {
        return sendError(c, 'Missing required fields', 400);
      }

      // ✅ SQL: Get plan
      const plan = await insuranceRepo.getPlanById(planId);
      
      if (!plan) {
        return sendError(c, 'Plan not found', 404);
      }

      // Check age eligibility
      if (petAge < plan.minCoverAge || (plan.maxCoverAge && petAge > plan.maxCoverAge)) {
        return sendError(c, `Pet age must be between ${plan.minCoverAge} and ${plan.maxCoverAge || 'no limit'} years`, 400);
      }

      // Calculate premium
      const monthlyPremium = calculatePremium(
        plan.monthlyPremium,
        petAge,
        petBreed,
        plan.coverage.accidentCover
      );

      let premiumAmount = monthlyPremium;
      if (paymentFrequency === 'quarterly') {
        premiumAmount = monthlyPremium * 3;
      } else if (paymentFrequency === 'annual') {
        premiumAmount = monthlyPremium * 12 * 0.9; // 10% discount
      }

      const startDate = new Date();
      startDate.setDate(startDate.getDate() + plan.waitingPeriod);
      
      const endDate = new Date(startDate);
      endDate.setFullYear(endDate.getFullYear() + 1);

      const nextPaymentDate = new Date(startDate);
      if (paymentFrequency === 'quarterly') {
        nextPaymentDate.setMonth(nextPaymentDate.getMonth() + 3);
      } else if (paymentFrequency === 'annual') {
        nextPaymentDate.setFullYear(nextPaymentDate.getFullYear() + 1);
      } else {
        nextPaymentDate.setMonth(nextPaymentDate.getMonth() + 1);
      }

      // ✅ SQL: Create policy
      const policy = await insuranceRepo.createPolicy({
        customerId,
        petId,
        planId: plan.planId,
        planName: plan.planName,
        provider: plan.provider,
        status: 'pending_documents',
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
        premiumAmount,
        coverageAmount: (plan.coverage.accidentCover || 0) + (plan.coverage.illnessCover || 0),
        deductible: plan.deductible,
        paymentFrequency: paymentFrequency as 'monthly' | 'quarterly' | 'annual',
        nextPaymentDate: nextPaymentDate.toISOString().split('T')[0],
        documents: [],
      });

      console.log(`✅ Insurance policy purchased: ${policy.policyId}`);

      return sendSuccess(c, {
        policy: {
          policyId: policy.policyId,
          policyNumber: policy.policyNumber,
          status: policy.status,
          premiumAmount: policy.premiumAmount,
          startDate: policy.startDate,
          endDate: policy.endDate
        }
      }, 'Policy purchased successfully. Please upload required documents.');

    } catch (error) {
      console.error('❌ Error purchasing policy:', error);
      return sendError(c, String(error), 500);
    }
  });

  /**
   * POST /insurance/policy/:policyId/documents/upload
   * Upload policy documents
   */
  app.post(`${BASE_PATH}/insurance/policy/:policyId/documents/upload`, async (c) => {
    try {
      const { policyId } = c.req.param();
      const body = await c.req.json();
      const { documentType, fileName, fileUrl } = body;

      if (!documentType || !fileName || !fileUrl) {
        return sendError(c, 'Missing required fields', 400);
      }

      // ✅ SQL: Get policy
      const policy = await insuranceRepo.getPolicyById(policyId);
      
      if (!policy) {
        return sendError(c, 'Policy not found', 404);
      }

      const documentId = `DOC-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

      const document = {
        documentId,
        documentType,
        fileName,
        fileUrl,
        uploadedAt: new Date().toISOString(),
        verificationStatus: 'pending' as const
      };

      // Add document to policy
      const updatedDocuments = [...(policy.documents || []), document];

      // Check if all required documents uploaded
      const requiredDocs = ['medical_history', 'vaccination_records', 'pet_photo'];
      const uploadedDocTypes = updatedDocuments.map((d: any) => d.documentType);
      const allUploaded = requiredDocs.every(type => uploadedDocTypes.includes(type));

      const newStatus = allUploaded && policy.status === 'pending_documents' 
        ? 'under_review' 
        : policy.status;

      // ✅ SQL: Update policy
      const updated = await insuranceRepo.updatePolicy(policyId, {
        documents: updatedDocuments,
        status: newStatus as any,
      });

      if (!updated) {
        return sendError(c, 'Failed to update policy', 500);
      }

      console.log(`✅ Document uploaded for policy: ${policyId}`);

      return sendSuccess(c, {
        policyId,
        document,
        status: updated.status
      }, 'Document uploaded successfully');

    } catch (error) {
      console.error('❌ Error uploading document:', error);
      return sendError(c, String(error), 500);
    }
  });

  /**
   * GET /insurance/policy/:policyId
   * Get policy details
   */
  app.get(`${BASE_PATH}/insurance/policy/:policyId`, async (c) => {
    try {
      const { policyId } = c.req.param();

      // ✅ SQL: Get policy
      const policy = await insuranceRepo.getPolicyById(policyId);
      
      if (!policy) {
        return sendError(c, 'Policy not found', 404);
      }

      // ✅ SQL: Get plan details
      const plan = await insuranceRepo.getPlanById(policy.planId);

      return sendSuccess(c, {
        policy,
        plan
      });

    } catch (error) {
      console.error('❌ Error fetching policy:', error);
      return sendError(c, String(error), 500);
    }
  });

  /**
   * POST /insurance/claim/file
   * File insurance claim
   */
  app.post(`${BASE_PATH}/insurance/claim/file`, async (c) => {
    try {
      const body = await c.req.json();
      const {
        policyId,
        claimType,
        incidentDate,
        claimAmount,
        description,
        veterinarianName,
        clinicName,
        documents = []
      } = body;

      if (!policyId || !claimType || !incidentDate || !claimAmount) {
        return sendError(c, 'Missing required fields', 400);
      }

      // ✅ SQL: Get policy
      const policy = await insuranceRepo.getPolicyById(policyId);
      
      if (!policy) {
        return sendError(c, 'Policy not found', 404);
      }

      if (policy.status !== 'active') {
        return sendError(c, 'Policy is not active', 400);
      }

      // ✅ SQL: Get plan to check coverage
      const plan = await insuranceRepo.getPlanById(policy.planId);
      if (!plan) {
        return sendError(c, 'Plan not found', 404);
      }

      const maxCover = (plan.coverage as any)[`${claimType}Cover`] || plan.coverage.accidentCover;
      
      if (claimAmount > maxCover) {
        return sendError(c, `Claim amount exceeds coverage limit of ₹${maxCover}`, 400);
      }

      // ✅ SQL: Create claim
      const claim = await insuranceRepo.createClaim({
        policyId: policy.policyId,
        policyNumber: policy.policyNumber,
        customerId: policy.customerId,
        petId: policy.petId,
        claimType: claimType as any,
        incidentDate: incidentDate.split('T')[0],
        claimAmount,
        description: description || '',
        veterinarianName: veterinarianName || '',
        clinicName: clinicName || '',
        documents: documents.map((doc: any) => ({
          documentId: doc.documentId || `DOC-${Date.now()}`,
          documentType: doc.documentType,
          fileName: doc.fileName,
          fileUrl: doc.fileUrl,
          uploadedAt: doc.uploadedAt || new Date().toISOString(),
        })),
        status: 'submitted',
      });

      console.log(`✅ Insurance claim filed: ${claim.claimId}`);

      return sendSuccess(c, {
        claim: {
          claimId: claim.claimId,
          status: claim.status,
          claimAmount: claim.claimAmount,
          submittedAt: claim.createdAt
        }
      }, 'Claim filed successfully');

    } catch (error) {
      console.error('❌ Error filing claim:', error);
      return sendError(c, String(error), 500);
    }
  });

  /**
   * GET /insurance/claim/:claimId
   * Get claim status and details
   */
  app.get(`${BASE_PATH}/insurance/claim/:claimId`, async (c) => {
    try {
      const { claimId } = c.req.param();

      // ✅ SQL: Get claim
      const claim = await insuranceRepo.getClaimById(claimId);
      
      if (!claim) {
        return sendError(c, 'Claim not found', 404);
      }

      // ✅ SQL: Get policy details
      const policy = await insuranceRepo.getPolicyById(claim.policyId);

      return sendSuccess(c, {
        claim,
        policy: policy ? {
          policyNumber: policy.policyNumber,
          planName: policy.planName,
          provider: policy.provider
        } : null
      });

    } catch (error) {
      console.error('❌ Error fetching claim:', error);
      return sendError(c, String(error), 500);
    }
  });

  /**
   * POST /insurance/claim/:claimId/update-status
   * Update claim status (admin/vendor)
   */
  app.post(`${BASE_PATH}/insurance/claim/:claimId/update-status`, async (c) => {
    try {
      const { claimId } = c.req.param();
      const body = await c.req.json();
      const { status, approvedAmount, rejectionReason, reviewedBy } = body;

      const validStatuses = ['submitted', 'under_review', 'approved', 'rejected', 'paid'];
      
      if (!status || !validStatuses.includes(status)) {
        return sendError(c, 'Invalid status', 400);
      }

      // ✅ SQL: Get claim
      const claim = await insuranceRepo.getClaimById(claimId);
      
      if (!claim) {
        return sendError(c, 'Claim not found', 404);
      }

      // ✅ SQL: Update claim
      const updated = await insuranceRepo.updateClaim(claimId, {
        status: status as any,
        reviewedBy: (status === 'approved' || status === 'rejected') ? reviewedBy : undefined,
        reviewedAt: (status === 'approved' || status === 'rejected') ? new Date().toISOString() : undefined,
        approvedAmount: status === 'approved' ? (approvedAmount || claim.claimAmount) : undefined,
        rejectionReason: status === 'rejected' ? rejectionReason : undefined,
        paymentDate: status === 'paid' ? new Date().toISOString().split('T')[0] : undefined,
        paymentReference: status === 'paid' ? `PAY-${Date.now()}` : undefined,
      });

      if (!updated) {
        return sendError(c, 'Failed to update claim', 500);
      }

      console.log(`✅ Claim ${claimId} status updated to: ${status}`);

      return sendSuccess(c, {
        claimId,
        status: updated.status,
        updatedAt: updated.updatedAt
      }, 'Claim status updated successfully');

    } catch (error) {
      console.error('❌ Error updating claim status:', error);
      return sendError(c, String(error), 500);
    }
  });

  /**
   * GET /insurance/customer/:customerId/policies
   * Get customer's policies
   */
  app.get(`${BASE_PATH}/insurance/customer/:customerId/policies`, async (c) => {
    try {
      const { customerId } = c.req.param();
      const status = c.req.query('status');

      // ✅ SQL: Get customer policies
      let policies = await insuranceRepo.getCustomerPolicies(customerId);

      if (status) {
        policies = policies.filter((p: any) => p.status === status);
      }

      policies.sort((a: any, b: any) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      return sendSuccess(c, {
        customerId,
        count: policies.length,
        policies
      });

    } catch (error) {
      console.error('❌ Error fetching customer policies:', error);
      return sendError(c, String(error), 500);
    }
  });

  /**
   * GET /insurance/customer/:customerId/claims
   * Get customer's claims
   */
  app.get(`${BASE_PATH}/insurance/customer/:customerId/claims`, async (c) => {
    try {
      const { customerId } = c.req.param();
      const status = c.req.query('status');

      // ✅ SQL: Get customer claims
      let claims = await insuranceRepo.getCustomerClaims(customerId);

      if (status) {
        claims = claims.filter((c: any) => c.status === status);
      }

      claims.sort((a: any, b: any) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      return sendSuccess(c, {
        customerId,
        count: claims.length,
        claims
      });

    } catch (error) {
      console.error('❌ Error fetching customer claims:', error);
      return sendError(c, String(error), 500);
    }
  });

  /**
   * POST /insurance/plan/create
   * Create insurance plan (admin)
   */
  app.post(`${BASE_PATH}/insurance/plan/create`, async (c) => {
    try {
      const body = await c.req.json();
      const {
        planName,
        provider,
        type,
        coverage,
        monthlyPremium,
        deductible,
        maxCoverAge,
        minCoverAge = 0,
        waitingPeriod = 30,
        features = [],
        exclusions = []
      } = body;

      if (!planName || !provider || !type || !coverage || !monthlyPremium) {
        return sendError(c, 'Missing required fields', 400);
      }

      // ✅ SQL: Create plan
      const plan = await insuranceRepo.createPlan({
        planName,
        provider,
        type: type as any,
        coverage,
        monthlyPremium,
        annualPremium: monthlyPremium * 12 * 0.9, // 10% discount
        deductible: deductible || 0,
        maxCoverAge,
        minCoverAge,
        waitingPeriod,
        features,
        exclusions,
        claimProcess: 'Submit documents → Review (3-5 days) → Approval → Payment (7-10 days)',
        isActive: true,
      });

      console.log(`✅ Insurance plan created: ${plan.planId}`);

      return sendSuccess(c, { plan }, 'Plan created successfully');

    } catch (error) {
      console.error('❌ Error creating plan:', error);
      return sendError(c, String(error), 500);
    }
  });

  console.log('✅ Insurance Endpoints (SQL) registered');
}

