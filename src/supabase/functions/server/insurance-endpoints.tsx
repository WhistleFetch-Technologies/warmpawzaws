import { Hono } from "hono";
import { sendSuccess, sendError } from "./response-utils";

/**
 * 🏥 INSURANCE ENDPOINTS
 * 
 * Complete pet insurance system for Warmpawz
 * 
 * Features:
 * - Insurance plan browsing
 * - Policy purchase & management
 * - Document upload & verification
 * - Claim filing & tracking
 * - Premium calculation
 * - Coverage validation
 */

interface InsurancePlan {
  planId: string;
  planName: string;
  provider: string;
  type: 'accident_only' | 'time_limited' | 'maximum_benefit' | 'lifetime';
  coverage: {
    accidentCover: number;
    illnessCover: number;
    surgicalCover: number;
    dentalCover?: number;
    vaccinationCover?: number;
  };
  monthlyPremium: number;
  annualPremium: number;
  deductible: number;
  maxCoverAge: number;
  minCoverAge: number;
  waitingPeriod: number; // in days
  features: string[];
  exclusions: string[];
  claimProcess: string;
  isActive: boolean;
  createdAt: string;
}

interface InsurancePolicy {
  policyId: string;
  policyNumber: string;
  customerId: string;
  petId: string;
  petName: string;
  planId: string;
  planName: string;
  provider: string;
  status: 'pending_documents' | 'under_review' | 'active' | 'expired' | 'cancelled';
  startDate: string;
  endDate: string;
  premiumAmount: number;
  coverageAmount: number;
  deductible: number;
  paymentFrequency: 'monthly' | 'quarterly' | 'annual';
  nextPaymentDate: string;
  documents: Array<{
    documentId: string;
    documentType: 'medical_history' | 'vaccination_records' | 'id_proof' | 'address_proof' | 'pet_photo';
    fileName: string;
    fileUrl: string;
    uploadedAt: string;
    verificationStatus: 'pending' | 'verified' | 'rejected';
  }>;
  pdfUrl?: string; // Generated policy PDF
  createdAt: string;
  updatedAt: string;
}

interface InsuranceClaim {
  claimId: string;
  policyId: string;
  policyNumber: string;
  customerId: string;
  petId: string;
  claimType: 'accident' | 'illness' | 'surgery' | 'dental' | 'vaccination';
  incidentDate: string;
  claimAmount: number;
  description: string;
  veterinarianName: string;
  clinicName: string;
  documents: Array<{
    documentId: string;
    documentType: 'medical_bill' | 'prescription' | 'medical_report' | 'lab_results' | 'photos';
    fileName: string;
    fileUrl: string;
    uploadedAt: string;
  }>;
  status: 'submitted' | 'under_review' | 'approved' | 'rejected' | 'paid';
  reviewedBy?: string;
  reviewedAt?: string;
  approvedAmount?: number;
  rejectionReason?: string;
  paymentDate?: string;
  paymentReference?: string;
  createdAt: string;
  updatedAt: string;
}

// Calculate premium based on pet details
function calculatePremium(
  basePremium: number,
  petAge: number,
  petBreed: string,
  coverageAmount: number
): number {
  let premium = basePremium;

  // Age factor
  if (petAge < 1) {
    premium *= 0.8; // 20% discount for young pets
  } else if (petAge >= 1 && petAge <= 5) {
    premium *= 1.0; // Standard rate
  } else if (petAge > 5 && petAge <= 8) {
    premium *= 1.3; // 30% increase
  } else {
    premium *= 1.6; // 60% increase for senior pets
  }

  // Coverage factor
  const coverageFactor = coverageAmount / 100000; // Base coverage 1 lakh
  premium *= coverageFactor;

  return Math.round(premium);
}

export function insuranceEndpoints(app: Hono, kv: any) {
  const BASE_PATH = "/make-server-3dd53475";

  /**
   * GET /insurance/plans
   * Browse available insurance plans
   */
  app.get(`${BASE_PATH}/insurance/plans`, async (c) => {
    try {
      const type = c.req.query('type');
      const minCoverage = parseFloat(c.req.query('minCoverage') || '0');
      const maxPremium = parseFloat(c.req.query('maxPremium') || '999999');

      const allPlans = await kv.getByPrefix('insurance:plan:') || [];
      
      let plans = allPlans
        .map((item: any) => item.value || item)
        .filter((plan: any) => plan.isActive);

      if (type) {
        plans = plans.filter((p: any) => p.type === type);
      }

      if (minCoverage > 0) {
        plans = plans.filter((p: any) => 
          (p.coverage.accidentCover + p.coverage.illnessCover) >= minCoverage
        );
      }

      if (maxPremium < 999999) {
        plans = plans.filter((p: any) => p.monthlyPremium <= maxPremium);
      }

      // Sort by popularity/premium
      plans.sort((a: any, b: any) => a.monthlyPremium - b.monthlyPremium);

      return sendSuccess(c, {
        count: plans.length,
        plans
      });

    } catch (error) {
      console.error('❌ Error fetching insurance plans:', error);
      return sendError(c, error, 500);
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

      const plan = await kv.get(`insurance:plan:${planId}`);
      
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
      return sendError(c, error, 500);
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

      const plan = await kv.get(`insurance:plan:${planId}`);
      
      if (!plan) {
        return sendError(c, 'Plan not found', 404);
      }

      // Check age eligibility
      if (petAge < plan.minCoverAge || petAge > plan.maxCoverAge) {
        return sendError(c, `Pet age must be between ${plan.minCoverAge} and ${plan.maxCoverAge} years`, 400);
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

      const policyId = `POL-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
      const policyNumber = `WP${Date.now().toString().slice(-10)}`;

      const startDate = new Date();
      startDate.setDate(startDate.getDate() + plan.waitingPeriod);
      
      const endDate = new Date(startDate);
      endDate.setFullYear(endDate.getFullYear() + 1);

      const policy: InsurancePolicy = {
        policyId,
        policyNumber,
        customerId,
        petId,
        petName,
        planId,
        planName: plan.planName,
        provider: plan.provider,
        status: 'pending_documents',
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        premiumAmount,
        coverageAmount: plan.coverage.accidentCover + plan.coverage.illnessCover,
        deductible: plan.deductible,
        paymentFrequency,
        nextPaymentDate: startDate.toISOString(),
        documents: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await kv.set(`insurance:policy:${policyId}`, policy);

      console.log(`✅ Insurance policy purchased: ${policyId}`);

      return sendSuccess(c, {
        policy: {
          policyId,
          policyNumber,
          status: 'pending_documents',
          premiumAmount,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString()
        }
      }, 'Policy purchased successfully. Please upload required documents.');

    } catch (error) {
      console.error('❌ Error purchasing policy:', error);
      return sendError(c, error, 500);
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

      const policy = await kv.get(`insurance:policy:${policyId}`);
      
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

      policy.documents.push(document);
      policy.updatedAt = new Date().toISOString();

      // Check if all required documents uploaded
      const requiredDocs = ['medical_history', 'vaccination_records', 'pet_photo'];
      const uploadedDocTypes = policy.documents.map((d: any) => d.documentType);
      const allUploaded = requiredDocs.every(type => uploadedDocTypes.includes(type));

      if (allUploaded && policy.status === 'pending_documents') {
        policy.status = 'under_review';
      }

      await kv.set(`insurance:policy:${policyId}`, policy);

      console.log(`✅ Document uploaded for policy: ${policyId}`);

      return sendSuccess(c, {
        policyId,
        document,
        status: policy.status
      }, 'Document uploaded successfully');

    } catch (error) {
      console.error('❌ Error uploading document:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * GET /insurance/policy/:policyId
   * Get policy details
   */
  app.get(`${BASE_PATH}/insurance/policy/:policyId`, async (c) => {
    try {
      const { policyId } = c.req.param();

      const policy = await kv.get(`insurance:policy:${policyId}`);
      
      if (!policy) {
        return sendError(c, 'Policy not found', 404);
      }

      // Get plan details
      const plan = await kv.get(`insurance:plan:${policy.planId}`);

      return sendSuccess(c, {
        policy,
        plan
      });

    } catch (error) {
      console.error('❌ Error fetching policy:', error);
      return sendError(c, error, 500);
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

      const policy = await kv.get(`insurance:policy:${policyId}`);
      
      if (!policy) {
        return sendError(c, 'Policy not found', 404);
      }

      if (policy.status !== 'active') {
        return sendError(c, 'Policy is not active', 400);
      }

      // Check if claim amount exceeds coverage
      const plan = await kv.get(`insurance:plan:${policy.planId}`);
      const maxCover = plan.coverage[`${claimType}Cover`] || plan.coverage.accidentCover;
      
      if (claimAmount > maxCover) {
        return sendError(c, `Claim amount exceeds coverage limit of ₹${maxCover}`, 400);
      }

      const claimId = `CLM-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

      const claim: InsuranceClaim = {
        claimId,
        policyId,
        policyNumber: policy.policyNumber,
        customerId: policy.customerId,
        petId: policy.petId,
        claimType,
        incidentDate,
        claimAmount,
        description: description || '',
        veterinarianName: veterinarianName || '',
        clinicName: clinicName || '',
        documents,
        status: 'submitted',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await kv.set(`insurance:claim:${claimId}`, claim);

      console.log(`✅ Insurance claim filed: ${claimId}`);

      return sendSuccess(c, {
        claim: {
          claimId,
          status: 'submitted',
          claimAmount,
          submittedAt: claim.createdAt
        }
      }, 'Claim filed successfully');

    } catch (error) {
      console.error('❌ Error filing claim:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * GET /insurance/claim/:claimId
   * Get claim status and details
   */
  app.get(`${BASE_PATH}/insurance/claim/:claimId`, async (c) => {
    try {
      const { claimId } = c.req.param();

      const claim = await kv.get(`insurance:claim:${claimId}`);
      
      if (!claim) {
        return sendError(c, 'Claim not found', 404);
      }

      // Get policy details
      const policy = await kv.get(`insurance:policy:${claim.policyId}`);

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
      return sendError(c, error, 500);
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

      const claim = await kv.get(`insurance:claim:${claimId}`);
      
      if (!claim) {
        return sendError(c, 'Claim not found', 404);
      }

      claim.status = status;
      claim.updatedAt = new Date().toISOString();

      if (status === 'approved' || status === 'rejected') {
        claim.reviewedBy = reviewedBy;
        claim.reviewedAt = new Date().toISOString();
      }

      if (status === 'approved') {
        claim.approvedAmount = approvedAmount || claim.claimAmount;
      }

      if (status === 'rejected') {
        claim.rejectionReason = rejectionReason;
      }

      if (status === 'paid') {
        claim.paymentDate = new Date().toISOString();
        claim.paymentReference = `PAY-${Date.now()}`;
      }

      await kv.set(`insurance:claim:${claimId}`, claim);

      console.log(`✅ Claim ${claimId} status updated to: ${status}`);

      return sendSuccess(c, {
        claimId,
        status,
        updatedAt: claim.updatedAt
      }, 'Claim status updated successfully');

    } catch (error) {
      console.error('❌ Error updating claim status:', error);
      return sendError(c, error, 500);
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

      const allPolicies = await kv.getByPrefix('insurance:policy:') || [];
      
      let policies = allPolicies
        .map((item: any) => item.value || item)
        .filter((policy: any) => policy.customerId === customerId);

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
      return sendError(c, error, 500);
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

      const allClaims = await kv.getByPrefix('insurance:claim:') || [];
      
      let claims = allClaims
        .map((item: any) => item.value || item)
        .filter((claim: any) => claim.customerId === customerId);

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
      return sendError(c, error, 500);
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

      const planId = `PLAN-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

      const plan: InsurancePlan = {
        planId,
        planName,
        provider,
        type,
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
        createdAt: new Date().toISOString()
      };

      await kv.set(`insurance:plan:${planId}`, plan);

      console.log(`✅ Insurance plan created: ${planId}`);

      return sendSuccess(c, { plan }, 'Plan created successfully');

    } catch (error) {
      console.error('❌ Error creating plan:', error);
      return sendError(c, error, 500);
    }
  });

  console.log('✅ Insurance Endpoints registered');
}
