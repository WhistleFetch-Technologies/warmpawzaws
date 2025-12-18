/**
 * Insurance Service - Customer Mobile App
 * Handles pet insurance plan purchase and claims
 */

import { API_BASE_URL, publicAnonKey } from '../config/api';

export interface InsurancePlan {
  id: string;
  name: string;
  description: string;
  coverage: string[];
  premium: number; // monthly/annual
  coverageAmount: number;
  deductible: number;
  waitingPeriod: number; // days
  maxAge: number;
  minAge: number;
  petTypes: string[];
  exclusions: string[];
  networkHospitals: number;
  claimTurnaroundTime: number; // days
  isActive: boolean;
}

export interface InsurancePolicy {
  policyId: string;
  planId: string;
  customerId: string;
  petId: string;
  petName: string;
  premium: number;
  coverageAmount: number;
  startDate: string;
  endDate: string;
  status: 'active' | 'expired' | 'cancelled';
  documents: Array<{
    type: string;
    url: string;
    name: string;
  }>;
  createdAt: string;
}

export interface InsuranceClaim {
  claimId: string;
  policyId: string;
  petId: string;
  claimType: 'medical' | 'accident' | 'illness' | 'surgery';
  claimAmount: number;
  incidentDate: string;
  description: string;
  documents: Array<{
    type: string;
    url: string;
    name: string;
  }>;
  status: 'submitted' | 'under_review' | 'approved' | 'rejected' | 'paid';
  submittedAt: string;
}

class InsuranceService {
  /**
   * Get available insurance plans
   */
  async getPlans(vendorId?: string): Promise<InsurancePlan[]> {
    try {
      const url = vendorId
        ? `${API_BASE_URL}/insurance/plans/${encodeURIComponent(vendorId)}`
        : `${API_BASE_URL}/insurance/plans`;

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${publicAnonKey}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        return data.plans || [];
      }

      return [];
    } catch (error) {
      console.error('Error fetching insurance plans:', error);
      return [];
    }
  }

  /**
   * Purchase insurance policy
   */
  async purchasePolicy(
    vendorId: string,
    planId: string,
    petId: string,
    documents: Array<{ type: string; url: string; name: string }>
  ): Promise<InsurancePolicy | null> {
    try {
      const response = await fetch(
        `${API_BASE_URL}/insurance/purchase`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${publicAnonKey}`,
          },
          body: JSON.stringify({
            vendorId,
            planId,
            petId,
            documents,
          }),
        }
      );

      if (response.ok) {
        const data = await response.json();
        return data.policy || null;
      }

      return null;
    } catch (error) {
      console.error('Error purchasing policy:', error);
      return null;
    }
  }

  /**
   * Get customer's policies
   */
  async getCustomerPolicies(customerId: string): Promise<InsurancePolicy[]> {
    try {
      const response = await fetch(
        `${API_BASE_URL}/customer/${encodeURIComponent(customerId)}/insurance-policies`,
        {
          headers: {
            Authorization: `Bearer ${publicAnonKey}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        return data.policies || [];
      }

      return [];
    } catch (error) {
      console.error('Error fetching policies:', error);
      return [];
    }
  }

  /**
   * File a claim
   */
  async fileClaim(
    policyId: string,
    claimType: string,
    claimAmount: number,
    incidentDate: string,
    description: string,
    documents: Array<{ type: string; url: string; name: string }>
  ): Promise<InsuranceClaim | null> {
    try {
      const response = await fetch(
        `${API_BASE_URL}/insurance/claims/file`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${publicAnonKey}`,
          },
          body: JSON.stringify({
            policyId,
            claimType,
            claimAmount,
            incidentDate,
            description,
            documents,
          }),
        }
      );

      if (response.ok) {
        const data = await response.json();
        return data.claim || null;
      }

      return null;
    } catch (error) {
      console.error('Error filing claim:', error);
      return null;
    }
  }

  /**
   * Get claim status
   */
  async getClaimStatus(claimId: string): Promise<InsuranceClaim | null> {
    try {
      const response = await fetch(
        `${API_BASE_URL}/insurance/claims/${encodeURIComponent(claimId)}`,
        {
          headers: {
            Authorization: `Bearer ${publicAnonKey}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        return data.claim || null;
      }

      return null;
    } catch (error) {
      console.error('Error fetching claim status:', error);
      return null;
    }
  }
}

export default new InsuranceService();

