/**
 * ============================================================================
 * INSURANCE REPOSITORY
 * ============================================================================
 * 
 * Repository for insurance plans, policies, and claims data access.
 * Replaces: insurance:plan:{id}, insurance:policy:{id}, insurance:claim:{id} KV keys
 * 
 * RULES:
 * ❌ NO KV imports allowed
 * ✅ All operations use SQL only
 * ✅ All queries use prepared statements
 * 
 * Date: 2025-01-27
 * ============================================================================
 */

import { getDbClient, selectQuery, insertQuery, updateQuery } from "../db.ts";
import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";

export interface InsurancePlan {
  id: string;
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
  maxCoverAge?: number;
  minCoverAge: number;
  waitingPeriod: number;
  features: string[];
  exclusions: string[];
  claimProcess?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface InsurancePolicy {
  id: string;
  policyId: string;
  policyNumber: string;
  customerId: string;
  petId: string;
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
  nextPaymentDate?: string;
  documents: Array<{
    documentId: string;
    documentType: string;
    fileName: string;
    fileUrl: string;
    uploadedAt: string;
    verificationStatus: 'pending' | 'verified' | 'rejected';
  }>;
  pdfUrl?: string;
  createdAt: string;
  updatedAt: string;
  activatedAt?: string;
  cancelledAt?: string;
  expiredAt?: string;
}

export interface InsuranceClaim {
  id: string;
  claimId: string;
  policyId: string;
  policyNumber: string;
  customerId: string;
  petId: string;
  claimType: 'accident' | 'illness' | 'surgery' | 'dental' | 'vaccination';
  incidentDate: string;
  claimAmount: number;
  description: string;
  veterinarianName?: string;
  clinicName?: string;
  documents: Array<{
    documentId: string;
    documentType: string;
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

export class InsuranceRepository {
  private client: SupabaseClient;

  constructor(client?: SupabaseClient) {
    this.client = client || getDbClient();
  }

  /**
   * Get plan by ID
   */
  async getPlanById(planId: string): Promise<InsurancePlan | null> {
    try {
      const { data, error } = await this.client
        .from('insurance_plans')
        .select('*')
        .or(`id.eq.${planId},plan_id.eq.${planId}`)
        .single();

      if (error || !data) {
        return null;
      }

      return this.mapPlanFromDb(data);
    } catch (error) {
      console.error('Error fetching insurance plan:', error);
      return null;
    }
  }

  /**
   * Get all plans (with optional filters)
   */
  async getAllPlans(options?: {
    type?: string;
    isActive?: boolean;
  }): Promise<InsurancePlan[]> {
    try {
      let query = this.client.from('insurance_plans').select('*');

      if (options?.type) {
        query = query.eq('plan_type', options.type);
      }

      if (options?.isActive !== undefined) {
        query = query.eq('is_active', options.isActive);
      } else {
        query = query.eq('is_active', true);
      }

      query = query.order('monthly_premium', { ascending: true });

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching insurance plans:', error);
        return [];
      }

      return (data || []).map(this.mapPlanFromDb);
    } catch (error) {
      console.error('Error in getAllPlans:', error);
      return [];
    }
  }

  /**
   * Create plan
   */
  async createPlan(planData: Partial<InsurancePlan>): Promise<InsurancePlan> {
    try {
      const planId = `plan_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      const insertData: any = {
        plan_id: planData.planId || planId,
        plan_name: planData.planName!,
        provider: planData.provider!,
        plan_type: planData.type!,
        coverage: planData.coverage || {},
        monthly_premium: planData.monthlyPremium!,
        annual_premium: planData.annualPremium!,
        deductible: planData.deductible || 0,
        max_cover_age: planData.maxCoverAge || null,
        min_cover_age: planData.minCoverAge || 0,
        waiting_period: planData.waitingPeriod || 0,
        features: planData.features || [],
        exclusions: planData.exclusions || [],
        claim_process: planData.claimProcess || null,
        is_active: planData.isActive !== undefined ? planData.isActive : true,
      };

      const { data, error } = await this.client
        .from('insurance_plans')
        .insert(insertData)
        .select()
        .single();

      if (error) {
        throw error;
      }

      return this.mapPlanFromDb(data);
    } catch (error) {
      console.error('Error creating insurance plan:', error);
      throw error;
    }
  }

  /**
   * Get policy by ID
   */
  async getPolicyById(policyId: string): Promise<InsurancePolicy | null> {
    try {
      const { data, error } = await this.client
        .from('insurance_policies')
        .select('*')
        .or(`id.eq.${policyId},policy_id.eq.${policyId}`)
        .single();

      if (error || !data) {
        return null;
      }

      return this.mapPolicyFromDb(data);
    } catch (error) {
      console.error('Error fetching insurance policy:', error);
      return null;
    }
  }

  /**
   * Get policies by customer
   */
  async getCustomerPolicies(customerId: string): Promise<InsurancePolicy[]> {
    try {
      const { data, error } = await this.client
        .from('insurance_policies')
        .select('*')
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching customer policies:', error);
        return [];
      }

      return (data || []).map(this.mapPolicyFromDb);
    } catch (error) {
      console.error('Error in getCustomerPolicies:', error);
      return [];
    }
  }

  /**
   * Create policy
   */
  async createPolicy(policyData: Partial<InsurancePolicy>): Promise<InsurancePolicy> {
    try {
      const policyId = `policy_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const policyNumber = `POL-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;

      const insertData: any = {
        policy_id: policyData.policyId || policyId,
        policy_number: policyData.policyNumber || policyNumber,
        customer_id: policyData.customerId!,
        pet_id: policyData.petId!,
        plan_id: policyData.planId!,
        plan_name: policyData.planName!,
        provider: policyData.provider!,
        status: policyData.status || 'pending_documents',
        start_date: policyData.startDate!,
        end_date: policyData.endDate!,
        premium_amount: policyData.premiumAmount!,
        coverage_amount: policyData.coverageAmount!,
        deductible: policyData.deductible || 0,
        payment_frequency: policyData.paymentFrequency || 'monthly',
        next_payment_date: policyData.nextPaymentDate || null,
        documents: policyData.documents || [],
        pdf_url: policyData.pdfUrl || null,
      };

      const { data, error } = await this.client
        .from('insurance_policies')
        .insert(insertData)
        .select()
        .single();

      if (error) {
        throw error;
      }

      return this.mapPolicyFromDb(data);
    } catch (error) {
      console.error('Error creating insurance policy:', error);
      throw error;
    }
  }

  /**
   * Update policy
   */
  async updatePolicy(policyId: string, updates: Partial<InsurancePolicy>): Promise<InsurancePolicy | null> {
    try {
      const updateData: any = {
        updated_at: new Date().toISOString(),
      };

      if (updates.status !== undefined) updateData.status = updates.status;
      if (updates.activatedAt !== undefined) updateData.activated_at = updates.activatedAt;
      if (updates.cancelledAt !== undefined) updateData.cancelled_at = updates.cancelledAt;
      if (updates.expiredAt !== undefined) updateData.expired_at = updates.expiredAt;
      if (updates.documents !== undefined) updateData.documents = updates.documents;
      if (updates.pdfUrl !== undefined) updateData.pdf_url = updates.pdfUrl;
      if (updates.nextPaymentDate !== undefined) updateData.next_payment_date = updates.nextPaymentDate;

      const { data, error } = await this.client
        .from('insurance_policies')
        .update(updateData)
        .or(`id.eq.${policyId},policy_id.eq.${policyId}`)
        .select()
        .single();

      if (error || !data) {
        return null;
      }

      return this.mapPolicyFromDb(data);
    } catch (error) {
      console.error('Error updating insurance policy:', error);
      return null;
    }
  }

  /**
   * Get claim by ID
   */
  async getClaimById(claimId: string): Promise<InsuranceClaim | null> {
    try {
      const { data, error } = await this.client
        .from('insurance_claims')
        .select('*')
        .or(`id.eq.${claimId},claim_id.eq.${claimId}`)
        .single();

      if (error || !data) {
        return null;
      }

      return this.mapClaimFromDb(data);
    } catch (error) {
      console.error('Error fetching insurance claim:', error);
      return null;
    }
  }

  /**
   * Get claims by customer
   */
  async getCustomerClaims(customerId: string): Promise<InsuranceClaim[]> {
    try {
      const { data, error } = await this.client
        .from('insurance_claims')
        .select('*')
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching customer claims:', error);
        return [];
      }

      return (data || []).map(this.mapClaimFromDb);
    } catch (error) {
      console.error('Error in getCustomerClaims:', error);
      return [];
    }
  }

  /**
   * Create claim
   */
  async createClaim(claimData: Partial<InsuranceClaim>): Promise<InsuranceClaim> {
    try {
      const claimId = `claim_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      const insertData: any = {
        claim_id: claimData.claimId || claimId,
        policy_id: claimData.policyId!,
        policy_number: claimData.policyNumber!,
        customer_id: claimData.customerId!,
        pet_id: claimData.petId!,
        claim_type: claimData.claimType!,
        incident_date: claimData.incidentDate!,
        claim_amount: claimData.claimAmount!,
        description: claimData.description!,
        veterinarian_name: claimData.veterinarianName || null,
        clinic_name: claimData.clinicName || null,
        documents: claimData.documents || [],
        status: claimData.status || 'submitted',
      };

      const { data, error } = await this.client
        .from('insurance_claims')
        .insert(insertData)
        .select()
        .single();

      if (error) {
        throw error;
      }

      return this.mapClaimFromDb(data);
    } catch (error) {
      console.error('Error creating insurance claim:', error);
      throw error;
    }
  }

  /**
   * Update claim
   */
  async updateClaim(claimId: string, updates: Partial<InsuranceClaim>): Promise<InsuranceClaim | null> {
    try {
      const updateData: any = {
        updated_at: new Date().toISOString(),
      };

      if (updates.status !== undefined) updateData.status = updates.status;
      if (updates.reviewedBy !== undefined) updateData.reviewed_by = updates.reviewedBy;
      if (updates.reviewedAt !== undefined) updateData.reviewed_at = updates.reviewedAt;
      if (updates.approvedAmount !== undefined) updateData.approved_amount = updates.approvedAmount;
      if (updates.rejectionReason !== undefined) updateData.rejection_reason = updates.rejectionReason;
      if (updates.paymentDate !== undefined) updateData.payment_date = updates.paymentDate;
      if (updates.paymentReference !== undefined) updateData.payment_reference = updates.paymentReference;

      const { data, error } = await this.client
        .from('insurance_claims')
        .update(updateData)
        .or(`id.eq.${claimId},claim_id.eq.${claimId}`)
        .select()
        .single();

      if (error || !data) {
        return null;
      }

      return this.mapClaimFromDb(data);
    } catch (error) {
      console.error('Error updating insurance claim:', error);
      return null;
    }
  }

  /**
   * Map database row to InsurancePlan
   */
  private mapPlanFromDb(row: any): InsurancePlan {
    return {
      id: row.id,
      planId: row.plan_id,
      planName: row.plan_name,
      provider: row.provider,
      type: row.plan_type,
      coverage: row.coverage || {},
      monthlyPremium: parseFloat(row.monthly_premium),
      annualPremium: parseFloat(row.annual_premium),
      deductible: parseFloat(row.deductible || 0),
      maxCoverAge: row.max_cover_age || undefined,
      minCoverAge: row.min_cover_age || 0,
      waitingPeriod: row.waiting_period || 0,
      features: row.features || [],
      exclusions: row.exclusions || [],
      claimProcess: row.claim_process || undefined,
      isActive: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * Map database row to InsurancePolicy
   */
  private mapPolicyFromDb(row: any): InsurancePolicy {
    return {
      id: row.id,
      policyId: row.policy_id,
      policyNumber: row.policy_number,
      customerId: row.customer_id,
      petId: row.pet_id,
      planId: row.plan_id,
      planName: row.plan_name,
      provider: row.provider,
      status: row.status,
      startDate: row.start_date,
      endDate: row.end_date,
      premiumAmount: parseFloat(row.premium_amount),
      coverageAmount: parseFloat(row.coverage_amount),
      deductible: parseFloat(row.deductible || 0),
      paymentFrequency: row.payment_frequency,
      nextPaymentDate: row.next_payment_date || undefined,
      documents: row.documents || [],
      pdfUrl: row.pdf_url || undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      activatedAt: row.activated_at || undefined,
      cancelledAt: row.cancelled_at || undefined,
      expiredAt: row.expired_at || undefined,
    };
  }

  /**
   * Map database row to InsuranceClaim
   */
  private mapClaimFromDb(row: any): InsuranceClaim {
    return {
      id: row.id,
      claimId: row.claim_id,
      policyId: row.policy_id,
      policyNumber: row.policy_number,
      customerId: row.customer_id,
      petId: row.pet_id,
      claimType: row.claim_type,
      incidentDate: row.incident_date,
      claimAmount: parseFloat(row.claim_amount),
      description: row.description,
      veterinarianName: row.veterinarian_name || undefined,
      clinicName: row.clinic_name || undefined,
      documents: row.documents || [],
      status: row.status,
      reviewedBy: row.reviewed_by || undefined,
      reviewedAt: row.reviewed_at || undefined,
      approvedAmount: row.approved_amount ? parseFloat(row.approved_amount) : undefined,
      rejectionReason: row.rejection_reason || undefined,
      paymentDate: row.payment_date || undefined,
      paymentReference: row.payment_reference || undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

let insuranceRepositoryInstance: InsuranceRepository | null = null;

export function getInsuranceRepository(): InsuranceRepository {
  if (!insuranceRepositoryInstance) {
    insuranceRepositoryInstance = new InsuranceRepository();
  }
  return insuranceRepositoryInstance;
}

