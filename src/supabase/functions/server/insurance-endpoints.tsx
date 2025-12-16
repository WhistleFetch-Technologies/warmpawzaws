import { Hono } from "npm:hono";
import { sendSuccess, sendError } from "./response-utils.ts";

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

      const monthlyPremium = calculatePremium(
        plan.monthlyPremium,
        petAge,
        petBreed || 'mixed',
        plan.coverage.accidentCover
      );

      let premiumAmount = monthlyPremium;
      if (paymentFrequency === 'quarterly') premiumAmount = monthlyPremium * 3;
      if (paymentFrequency === 'annual') premiumAmount = monthlyPremium * 12;

      const policyId = `POL-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
      const policyNumber = `WP-INS-${Date.now().toString().slice(-8)}`;
      
      const startDate = new Date();
      const endDate = new Date(startDate);
      endDate.setFullYear(endDate.getFullYear() + 1);

      const nextPaymentDate = new Date(startDate);
      if (paymentFrequency === 'monthly') nextPaymentDate.setMonth(nextPaymentDate.getMonth() + 1);
      if (paymentFrequency === 'quarterly') nextPaymentDate.setMonth(nextPaymentDate.getMonth() + 3);
      if (paymentFrequency === 'annual') nextPaymentDate.setFullYear(nextPaymentDate.getFullYear() + 1);

      const policy: InsurancePolicy = {
        policyId,
        policyNumber,
        customerId,
        petId,
        petName: petName || 'Pet',
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
        nextPaymentDate: nextPaymentDate.toISOString(),
        documents: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await kv.set(`insurance:policy:${policyId}`, policy);

      // Index for customer
      const customerPolicies = await kv.get(`customer:${customerId}:insurance-policies`) || [];
      customerPolicies.unshift(policyId);
      await kv.set(`customer:${customerId}:insurance-policies`, customerPolicies);

      console.log(`✅ Insurance policy created: ${policyNumber}`);

      return sendSuccess(c, { policy }, 'Policy created successfully. Please upload required documents.');

    } catch (error) {
      console.error('❌ Error creating insurance policy:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * ✅ NEW: POST /insurance/policy/:policyId/generate-pdf
   * Generate policy PDF document
   */
  app.post(`${BASE_PATH}/insurance/policy/:policyId/generate-pdf`, async (c) => {
    try {
      const { policyId } = c.req.param();
      
      const policy = await kv.get(`insurance:policy:${policyId}`);
      
      if (!policy) {
        return sendError(c, 'Policy not found', 404);
      }

      if (policy.status !== 'active') {
        return sendError(c, 'Policy must be active to generate PDF', 400);
      }

      // ✅ PRODUCTION: Generate PDF content (HTML template for PDF generation)
      const pdfContent = generatePolicyPDFContent(policy);
      
      // In production, this would call a PDF generation service
      // For now, we create a mock URL and store the content
      const pdfUrl = `https://storage.warmpawz.com/policies/${policyId}.pdf`;
      
      // Store PDF metadata
      const pdfMetadata = {
        policyId,
        pdfUrl,
        content: pdfContent,
        generatedAt: new Date().toISOString(),
        fileSize: pdfContent.length,
        version: '1.0'
      };
      
      await kv.set(`insurance:policy-pdf:${policyId}`, pdfMetadata);

      // Update policy with PDF URL
      policy.pdfUrl = pdfUrl;
      policy.updatedAt = new Date().toISOString();
      await kv.set(`insurance:policy:${policyId}`, policy);

      console.log(`✅ Policy PDF generated: ${policyId}`);

      return sendSuccess(c, {
        policyId,
        pdfUrl,
        generatedAt: pdfMetadata.generatedAt
      }, 'Policy PDF generated successfully');

    } catch (error) {
      console.error('❌ Error generating policy PDF:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * ✅ NEW: GET /insurance/policy/:policyId/download
   * Download policy PDF
   */
  app.get(`${BASE_PATH}/insurance/policy/:policyId/download`, async (c) => {
    try {
      const { policyId } = c.req.param();
      
      const [policy, pdfMetadata] = await Promise.all([
        kv.get(`insurance:policy:${policyId}`),
        kv.get(`insurance:policy-pdf:${policyId}`)
      ]);
      
      if (!policy) {
        return sendError(c, 'Policy not found', 404);
      }

      if (!pdfMetadata) {
        // Generate PDF if not exists
        const pdfContent = generatePolicyPDFContent(policy);
        const pdfUrl = `https://storage.warmpawz.com/policies/${policyId}.pdf`;
        
        const newPdfMetadata = {
          policyId,
          pdfUrl,
          content: pdfContent,
          generatedAt: new Date().toISOString(),
          fileSize: pdfContent.length,
          version: '1.0'
        };
        
        await kv.set(`insurance:policy-pdf:${policyId}`, newPdfMetadata);
        
        return sendSuccess(c, {
          policyId,
          policyNumber: policy.policyNumber,
          pdfUrl,
          downloadUrl: pdfUrl,
          content: pdfContent
        });
      }

      return sendSuccess(c, {
        policyId,
        policyNumber: policy.policyNumber,
        pdfUrl: pdfMetadata.pdfUrl,
        downloadUrl: pdfMetadata.pdfUrl,
        content: pdfMetadata.content,
        generatedAt: pdfMetadata.generatedAt
      });

    } catch (error) {
      console.error('❌ Error downloading policy PDF:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * ✅ NEW: POST /insurance/policy/:policyId/upload-document
   * Upload policy document with validation
   */
  app.post(`${BASE_PATH}/insurance/policy/:policyId/upload-document`, async (c) => {
    try {
      const { policyId } = c.req.param();
      const body = await c.req.json();
      const { documentType, fileName, fileUrl, fileSize, mimeType } = body;

      if (!documentType || !fileName || !fileUrl) {
        return sendError(c, 'Missing required fields', 400);
      }

      const policy = await kv.get(`insurance:policy:${policyId}`);
      
      if (!policy) {
        return sendError(c, 'Policy not found', 404);
      }

      // ✅ Validate document type
      const validDocTypes = ['medical_history', 'vaccination_records', 'id_proof', 'address_proof', 'pet_photo'];
      if (!validDocTypes.includes(documentType)) {
        return sendError(c, 'Invalid document type', 400);
      }

      // ✅ Validate file size (max 5MB)
      if (fileSize && fileSize > 5 * 1024 * 1024) {
        return sendError(c, 'File size must be less than 5MB', 400);
      }

      // ✅ Validate MIME type
      const validMimeTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
      if (mimeType && !validMimeTypes.includes(mimeType)) {
        return sendError(c, 'Invalid file type. Only JPG, PNG, and PDF allowed', 400);
      }

      const documentId = `DOC-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;

      const document = {
        documentId,
        documentType,
        fileName,
        fileUrl,
        fileSize: fileSize || 0,
        mimeType: mimeType || 'application/octet-stream',
        uploadedAt: new Date().toISOString(),
        verificationStatus: 'pending' as const
      };

      // Add document to policy
      if (!policy.documents) policy.documents = [];
      
      // Check for duplicate document type
      const existingDocIndex = policy.documents.findIndex((d: any) => d.documentType === documentType);
      if (existingDocIndex >= 0) {
        // Replace existing document
        policy.documents[existingDocIndex] = document;
      } else {
        policy.documents.push(document);
      }

      policy.updatedAt = new Date().toISOString();

      // Check if all required documents uploaded
      const requiredDocs = ['medical_history', 'vaccination_records', 'pet_photo'];
      const uploadedDocTypes = policy.documents.map((d: any) => d.documentType);
      const allRequiredUploaded = requiredDocs.every(type => uploadedDocTypes.includes(type));

      if (allRequiredUploaded && policy.status === 'pending_documents') {
        policy.status = 'under_review';
      }

      await kv.set(`insurance:policy:${policyId}`, policy);

      console.log(`✅ Document uploaded for policy ${policyId}: ${documentType}`);

      return sendSuccess(c, {
        document,
        policy: {
          policyId: policy.policyId,
          status: policy.status,
          documentsCount: policy.documents.length,
          allRequiredUploaded
        }
      }, 'Document uploaded successfully');

    } catch (error) {
      console.error('❌ Error uploading document:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * ✅ NEW: GET /insurance/policy/:policyId/documents
   * Get all documents for a policy
   */
  app.get(`${BASE_PATH}/insurance/policy/:policyId/documents`, async (c) => {
    try {
      const { policyId } = c.req.param();
      
      const policy = await kv.get(`insurance:policy:${policyId}`);
      
      if (!policy) {
        return sendError(c, 'Policy not found', 404);
      }

      const requiredDocs = [
        { type: 'medical_history', label: 'Medical History', required: true },
        { type: 'vaccination_records', label: 'Vaccination Records', required: true },
        { type: 'pet_photo', label: 'Pet Photo', required: true },
        { type: 'id_proof', label: 'ID Proof', required: false },
        { type: 'address_proof', label: 'Address Proof', required: false }
      ];

      const documentStatus = requiredDocs.map(reqDoc => {
        const uploaded = policy.documents?.find((d: any) => d.documentType === reqDoc.type);
        return {
          documentType: reqDoc.type,
          label: reqDoc.label,
          required: reqDoc.required,
          uploaded: !!uploaded,
          document: uploaded || null
        };
      });

      const uploadedCount = policy.documents?.length || 0;
      const requiredCount = requiredDocs.filter(d => d.required).length;
      const requiredUploadedCount = documentStatus.filter(d => d.required && d.uploaded).length;

      return sendSuccess(c, {
        policyId,
        documents: policy.documents || [],
        documentStatus,
        summary: {
          total: uploadedCount,
          required: requiredCount,
          requiredUploaded: requiredUploadedCount,
          allRequiredUploaded: requiredUploadedCount === requiredCount
        }
      });

    } catch (error) {
      console.error('❌ Error fetching documents:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * ✅ NEW: DELETE /insurance/policy/:policyId/document/:documentId
   * Delete uploaded document
   */
  app.delete(`${BASE_PATH}/insurance/policy/:policyId/document/:documentId`, async (c) => {
    try {
      const { policyId, documentId } = c.req.param();
      
      const policy = await kv.get(`insurance:policy:${policyId}`);
      
      if (!policy) {
        return sendError(c, 'Policy not found', 404);
      }

      if (!policy.documents || policy.documents.length === 0) {
        return sendError(c, 'No documents found', 404);
      }

      const docIndex = policy.documents.findIndex((d: any) => d.documentId === documentId);
      
      if (docIndex === -1) {
        return sendError(c, 'Document not found', 404);
      }

      // Remove document
      policy.documents.splice(docIndex, 1);
      policy.updatedAt = new Date().toISOString();

      // Update status if needed
      const requiredDocs = ['medical_history', 'vaccination_records', 'pet_photo'];
      const uploadedDocTypes = policy.documents.map((d: any) => d.documentType);
      const allRequiredUploaded = requiredDocs.every(type => uploadedDocTypes.includes(type));

      if (!allRequiredUploaded && policy.status === 'under_review') {
        policy.status = 'pending_documents';
      }

      await kv.set(`insurance:policy:${policyId}`, policy);

      console.log(`✅ Document deleted from policy ${policyId}: ${documentId}`);

      return sendSuccess(c, {
        policyId,
        documentsRemaining: policy.documents.length
      }, 'Document deleted successfully');

    } catch (error) {
      console.error('❌ Error deleting document:', error);
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

  /**
   * ✅ NEW: GET /insurance/vendor/claims
   * Get all claims for vendor dashboard
   */
  app.get(`${BASE_PATH}/insurance/vendor/claims`, async (c) => {
    try {
      const status = c.req.query('status');
      const limit = parseInt(c.req.query('limit') || '50');
      const offset = parseInt(c.req.query('offset') || '0');

      const allClaims = await kv.getByPrefix('insurance:claim:') || [];
      
      let claims = allClaims
        .map((item: any) => item.value || item)
        .sort((a: any, b: any) => 
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );

      if (status) {
        claims = claims.filter((c: any) => c.status === status);
      }

      // Get policy and customer details for each claim
      const enrichedClaims = await Promise.all(
        claims.slice(offset, offset + limit).map(async (claim: any) => {
          const policy = await kv.get(`insurance:policy:${claim.policyId}`);
          return {
            ...claim,
            petName: policy?.petName || 'Unknown',
            planName: policy?.planName || 'Unknown',
            provider: policy?.provider || 'Unknown'
          };
        })
      );

      // Calculate statistics
      const stats = {
        total: claims.length,
        submitted: claims.filter((c: any) => c.status === 'submitted').length,
        underReview: claims.filter((c: any) => c.status === 'under_review').length,
        approved: claims.filter((c: any) => c.status === 'approved').length,
        rejected: claims.filter((c: any) => c.status === 'rejected').length,
        paid: claims.filter((c: any) => c.status === 'paid').length,
        totalClaimAmount: claims.reduce((sum: number, c: any) => sum + c.claimAmount, 0),
        totalApprovedAmount: claims
          .filter((c: any) => c.status === 'approved' || c.status === 'paid')
          .reduce((sum: number, c: any) => sum + (c.approvedAmount || 0), 0)
      };

      return sendSuccess(c, {
        claims: enrichedClaims,
        stats,
        pagination: {
          total: claims.length,
          limit,
          offset,
          hasMore: offset + limit < claims.length
        }
      });

    } catch (error) {
      console.error('❌ Error fetching vendor claims:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * ✅ NEW: GET /insurance/vendor/policies
   * Get all policies for vendor dashboard
   */
  app.get(`${BASE_PATH}/insurance/vendor/policies`, async (c) => {
    try {
      const status = c.req.query('status');
      const limit = parseInt(c.req.query('limit') || '50');
      const offset = parseInt(c.req.query('offset') || '0');

      const allPolicies = await kv.getByPrefix('insurance:policy:') || [];
      
      let policies = allPolicies
        .map((item: any) => item.value || item)
        .sort((a: any, b: any) => 
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );

      if (status) {
        policies = policies.filter((p: any) => p.status === status);
      }

      const paginatedPolicies = policies.slice(offset, offset + limit);

      // Calculate statistics
      const stats = {
        total: policies.length,
        pendingDocuments: policies.filter((p: any) => p.status === 'pending_documents').length,
        underReview: policies.filter((p: any) => p.status === 'under_review').length,
        active: policies.filter((p: any) => p.status === 'active').length,
        expired: policies.filter((p: any) => p.status === 'expired').length,
        cancelled: policies.filter((p: any) => p.status === 'cancelled').length,
        totalPremiumRevenue: policies
          .filter((p: any) => p.status === 'active')
          .reduce((sum: number, p: any) => sum + p.premiumAmount, 0)
      };

      return sendSuccess(c, {
        policies: paginatedPolicies,
        stats,
        pagination: {
          total: policies.length,
          limit,
          offset,
          hasMore: offset + limit < policies.length
        }
      });

    } catch (error) {
      console.error('❌ Error fetching vendor policies:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * ✅ NEW: POST /insurance/vendor/policy/:policyId/approve
   * Approve policy and activate it
   */
  app.post(`${BASE_PATH}/insurance/vendor/policy/:policyId/approve`, async (c) => {
    try {
      const { policyId } = c.req.param();
      const { reviewedBy, notes } = await c.req.json();

      const policy = await kv.get(`insurance:policy:${policyId}`);
      
      if (!policy) {
        return sendError(c, 'Policy not found', 404);
      }

      if (policy.status !== 'under_review') {
        return sendError(c, 'Policy must be under review to approve', 400);
      }

      // Verify all documents
      if (policy.documents) {
        policy.documents.forEach((doc: any) => {
          doc.verificationStatus = 'verified';
        });
      }

      policy.status = 'active';
      policy.updatedAt = new Date().toISOString();
      policy.approvedBy = reviewedBy;
      policy.approvedAt = new Date().toISOString();
      policy.approvalNotes = notes;

      await kv.set(`insurance:policy:${policyId}`, policy);

      // Generate PDF automatically upon activation
      const pdfContent = generatePolicyPDFContent(policy);
      const pdfUrl = `https://storage.warmpawz.com/policies/${policyId}.pdf`;
      
      const pdfMetadata = {
        policyId,
        pdfUrl,
        content: pdfContent,
        generatedAt: new Date().toISOString(),
        fileSize: pdfContent.length,
        version: '1.0'
      };
      
      await kv.set(`insurance:policy-pdf:${policyId}`, pdfMetadata);
      
      policy.pdfUrl = pdfUrl;
      await kv.set(`insurance:policy:${policyId}`, policy);

      console.log(`✅ Policy approved and activated: ${policyId}`);

      return sendSuccess(c, {
        policyId,
        policyNumber: policy.policyNumber,
        status: 'active',
        pdfUrl
      }, 'Policy approved and activated successfully');

    } catch (error) {
      console.error('❌ Error approving policy:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * ✅ NEW: POST /insurance/vendor/policy/:policyId/reject
   * Reject policy with reason
   */
  app.post(`${BASE_PATH}/insurance/vendor/policy/:policyId/reject`, async (c) => {
    try {
      const { policyId } = c.req.param();
      const { reviewedBy, reason } = await c.req.json();

      if (!reason) {
        return sendError(c, 'Rejection reason is required', 400);
      }

      const policy = await kv.get(`insurance:policy:${policyId}`);
      
      if (!policy) {
        return sendError(c, 'Policy not found', 404);
      }

      if (policy.status !== 'under_review') {
        return sendError(c, 'Policy must be under review to reject', 400);
      }

      policy.status = 'cancelled';
      policy.updatedAt = new Date().toISOString();
      policy.rejectedBy = reviewedBy;
      policy.rejectedAt = new Date().toISOString();
      policy.rejectionReason = reason;

      await kv.set(`insurance:policy:${policyId}`, policy);

      console.log(`✅ Policy rejected: ${policyId}`);

      return sendSuccess(c, {
        policyId,
        policyNumber: policy.policyNumber,
        status: 'cancelled'
      }, 'Policy rejected successfully');

    } catch (error) {
      console.error('❌ Error rejecting policy:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * ✅ NEW: GET /insurance/vendor/analytics
   * Get analytics for vendor dashboard
   */
  app.get(`${BASE_PATH}/insurance/vendor/analytics`, async (c) => {
    try {
      const [allPolicies, allClaims] = await Promise.all([
        kv.getByPrefix('insurance:policy:'),
        kv.getByPrefix('insurance:claim:')
      ]);

      const policies = allPolicies.map((item: any) => item.value || item);
      const claims = allClaims.map((item: any) => item.value || item);

      // Date ranges for analytics
      const now = new Date();
      const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

      const analytics = {
        policies: {
          total: policies.length,
          active: policies.filter((p: any) => p.status === 'active').length,
          pendingReview: policies.filter((p: any) => p.status === 'under_review').length,
          thisMonth: policies.filter((p: any) => 
            new Date(p.createdAt) >= thisMonth
          ).length,
          lastMonth: policies.filter((p: any) => 
            new Date(p.createdAt) >= lastMonth && new Date(p.createdAt) < thisMonth
          ).length
        },
        claims: {
          total: claims.length,
          pending: claims.filter((c: any) => 
            c.status === 'submitted' || c.status === 'under_review'
          ).length,
          approved: claims.filter((c: any) => c.status === 'approved').length,
          rejected: claims.filter((c: any) => c.status === 'rejected').length,
          paid: claims.filter((c: any) => c.status === 'paid').length,
          thisMonth: claims.filter((c: any) => 
            new Date(c.createdAt) >= thisMonth
          ).length
        },
        revenue: {
          totalPremiums: policies
            .filter((p: any) => p.status === 'active')
            .reduce((sum: number, p: any) => sum + p.premiumAmount, 0),
          monthlyRecurring: policies
            .filter((p: any) => p.status === 'active' && p.paymentFrequency === 'monthly')
            .reduce((sum: number, p: any) => sum + p.premiumAmount, 0),
          totalClaims: claims.reduce((sum: number, c: any) => sum + c.claimAmount, 0),
          totalApproved: claims
            .filter((c: any) => c.status === 'approved' || c.status === 'paid')
            .reduce((sum: number, c: any) => sum + (c.approvedAmount || 0), 0)
        },
        claimsByType: {
          accident: claims.filter((c: any) => c.claimType === 'accident').length,
          illness: claims.filter((c: any) => c.claimType === 'illness').length,
          surgery: claims.filter((c: any) => c.claimType === 'surgery').length,
          dental: claims.filter((c: any) => c.claimType === 'dental').length,
          vaccination: claims.filter((c: any) => c.claimType === 'vaccination').length
        }
      };

      return sendSuccess(c, { analytics });

    } catch (error) {
      console.error('❌ Error fetching analytics:', error);
      return sendError(c, error, 500);
    }
  });

  console.log('✅ Insurance Endpoints registered');
}

// ✅ PRODUCTION: Function to generate PDF content
function generatePolicyPDFContent(policy: InsurancePolicy): string {
  const plan = policy.planName;
  const provider = policy.provider;
  const startDate = new Date(policy.startDate).toLocaleDateString();
  const endDate = new Date(policy.endDate).toLocaleDateString();
  const premiumAmount = policy.premiumAmount.toLocaleString('en-IN', { style: 'currency', currency: 'INR' });
  const coverageAmount = policy.coverageAmount.toLocaleString('en-IN', { style: 'currency', currency: 'INR' });
  const deductible = policy.deductible.toLocaleString('en-IN', { style: 'currency', currency: 'INR' });
  const paymentFrequency = policy.paymentFrequency;
  const nextPaymentDate = new Date(policy.nextPaymentDate).toLocaleDateString();
  const documents = policy.documents.map(doc => `${doc.documentType}: ${doc.fileName}`).join(', ');

  return `
    <html>
      <head>
        <title>Insurance Policy</title>
        <style>
          body { font-family: Arial, sans-serif; }
          .header { text-align: center; margin-bottom: 20px; }
          .header h1 { font-size: 24px; }
          .header p { font-size: 16px; }
          .policy-details { margin-bottom: 20px; }
          .policy-details h2 { font-size: 20px; }
          .policy-details p { font-size: 14px; }
          .documents { margin-bottom: 20px; }
          .documents h2 { font-size: 20px; }
          .documents p { font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Warmpawz Insurance Policy</h1>
          <p>Policy Number: ${policy.policyNumber}</p>
        </div>
        <div class="policy-details">
          <h2>Policy Details</h2>
          <p><strong>Plan:</strong> ${plan}</p>
          <p><strong>Provider:</strong> ${provider}</p>
          <p><strong>Start Date:</strong> ${startDate}</p>
          <p><strong>End Date:</strong> ${endDate}</p>
          <p><strong>Premium Amount:</strong> ${premiumAmount}</p>
          <p><strong>Coverage Amount:</strong> ${coverageAmount}</p>
          <p><strong>Deductible:</strong> ${deductible}</p>
          <p><strong>Payment Frequency:</strong> ${paymentFrequency}</p>
          <p><strong>Next Payment Date:</strong> ${nextPaymentDate}</p>
        </div>
        <div class="documents">
          <h2>Uploaded Documents</h2>
          <p>${documents}</p>
        </div>
      </body>
    </html>
  `;
}