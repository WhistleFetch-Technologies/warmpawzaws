'use client';

import React, { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';

// ============================================================================
// TYPES
// ============================================================================

interface InsurancePlan {
  id: string;
  name: string;
  provider: string;
  description: string;
  coverage_type: 'basic' | 'premium' | 'comprehensive';
  monthly_premium: number;
  annual_premium: number;
  coverage_amount: number;
  deductible: number;
  coverage_items: string[];
  exclusions: string[];
  waiting_period_days: number;
  max_age_years: number;
  min_age_months: number;
  is_active: boolean;
}

interface Policy {
  id: string;
  plan_id: string;
  plan_name: string;
  pet_id: string;
  pet_name: string;
  policy_number: string;
  start_date: string;
  end_date: string;
  premium_amount: number;
  coverage_amount: number;
  status: 'active' | 'expired' | 'cancelled' | 'pending';
  auto_renew: boolean;
  next_premium_date?: string;
}

interface Claim {
  id: string;
  policy_id: string;
  policy_number: string;
  pet_id: string;
  pet_name: string;
  claim_type: 'medical' | 'surgery' | 'accident' | 'illness';
  incident_date: string;
  amount_claimed: number;
  amount_approved?: number;
  amount_paid?: number;
  description: string;
  documents: Array<{ id: string; name: string; url: string }>;
  status: 'submitted' | 'under_review' | 'approved' | 'rejected' | 'paid';
  submitted_at: string;
  reviewed_at?: string;
  rejection_reason?: string;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function InsurancePage() {
  const [plans, setPlans] = useState<InsurancePlan[]>([]);
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // UI States
  const [activeTab, setActiveTab] = useState<'plans' | 'policies' | 'claims'>('plans');
  const [showPlanDetails, setShowPlanDetails] = useState<InsurancePlan | null>(null);
  const [showClaimForm, setShowClaimForm] = useState(false);
  const [submittingClaim, setSubmittingClaim] = useState(false);
  
  // Claim form
  const [claimForm, setClaimForm] = useState({
    policy_id: '',
    claim_type: 'medical' as 'medical' | 'surgery' | 'accident' | 'illness',
    incident_date: new Date().toISOString().split('T')[0],
    amount_claimed: 0,
    description: '',
  });

  // ============================================================================
  // DATA LOADING
  // ============================================================================

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const [plansRes, policiesRes, claimsRes] = await Promise.all([
        apiClient.get<any>('/insurance/plans'),
        apiClient.get<any>('/insurance/policies'),
        apiClient.get<any>('/insurance/claims'),
      ]);
      
      setPlans(plansRes.plans || plansRes || []);
      setPolicies(policiesRes.policies || policiesRes || []);
      setClaims(claimsRes.claims || claimsRes || []);
    } catch (err: any) {
      console.error('Error loading insurance data:', err);
      setError(err.message || 'Failed to load insurance data');
    } finally {
      setLoading(false);
    }
  };

  // ============================================================================
  // ACTIONS
  // ============================================================================

  const handlePurchasePlan = async (planId: string) => {
    if (!confirm('Purchase this insurance plan?')) return;
    
    try {
      await apiClient.post('/insurance/policies', { plan_id: planId });
      setSuccess('Insurance policy purchased successfully!');
      loadData();
      setActiveTab('policies');
    } catch (err: any) {
      setError(err.message || 'Failed to purchase insurance');
    }
  };

  const handleSubmitClaim = async () => {
    if (!claimForm.policy_id || !claimForm.description || claimForm.amount_claimed <= 0) {
      setError('Please fill all required fields');
      return;
    }
    
    try {
      setSubmittingClaim(true);
      setError(null);
      
      await apiClient.post('/insurance/claims', claimForm);
      setSuccess('Claim submitted successfully! It will be reviewed within 2-3 business days.');
      setShowClaimForm(false);
      setClaimForm({
        policy_id: '',
        claim_type: 'medical',
        incident_date: new Date().toISOString().split('T')[0],
        amount_claimed: 0,
        description: '',
      });
      loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to submit claim');
    } finally {
      setSubmittingClaim(false);
    }
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading insurance...</p>
        </div>
      </div>
    );
  }

  const coverageColors: Record<string, string> = {
    basic: 'bg-blue-100 text-blue-700',
    premium: 'bg-purple-100 text-purple-700',
    comprehensive: 'bg-orange-100 text-orange-700',
  };

  const statusColors: Record<string, string> = {
    active: 'bg-green-100 text-green-700',
    expired: 'bg-gray-100 text-gray-600',
    cancelled: 'bg-red-100 text-red-700',
    pending: 'bg-yellow-100 text-yellow-700',
    submitted: 'bg-blue-100 text-blue-700',
    under_review: 'bg-yellow-100 text-yellow-700',
    approved: 'bg-green-100 text-green-700',
    rejected: 'bg-red-100 text-red-700',
    paid: 'bg-green-100 text-green-700',
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-8">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold text-gray-900">Pet Insurance</h1>
          <p className="text-sm text-gray-500">Protect your pet's health</p>
        </div>
      </header>

      {/* Tabs */}
      <div className="max-w-6xl mx-auto px-4 mt-4">
        <div className="flex bg-white rounded-xl p-1 shadow-sm">
          {[
            { id: 'plans', label: 'Insurance Plans', icon: '🛡️' },
            { id: 'policies', label: 'My Policies', icon: '📄' },
            { id: 'claims', label: 'Claims', icon: '💰' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex-1 py-3 rounded-lg font-medium transition ${
                activeTab === tab.id
                  ? 'bg-orange-500 text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Messages */}
      <div className="max-w-6xl mx-auto px-4 mt-4">
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600">✕</button>
          </div>
        )}
        
        {success && (
          <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-xl text-green-700 flex items-center justify-between">
            <span>{success}</span>
            <button onClick={() => setSuccess(null)} className="text-green-400 hover:text-green-600">✕</button>
          </div>
        )}
      </div>

      <main className="max-w-6xl mx-auto px-4 py-6">
        {/* Plans Tab */}
        {activeTab === 'plans' && (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold text-gray-900">Available Insurance Plans</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {plans.map(plan => (
                <div key={plan.id} className="bg-white rounded-2xl p-6 shadow-sm hover:shadow-md transition">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">{plan.name}</h3>
                      <p className="text-sm text-gray-500">{plan.provider}</p>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${coverageColors[plan.coverage_type]}`}>
                      {plan.coverage_type}
                    </span>
                  </div>
                  
                  <p className="text-sm text-gray-600 mb-4">{plan.description}</p>
                  
                  <div className="space-y-2 mb-4">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Coverage:</span>
                      <span className="font-medium">₹{plan.coverage_amount.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Deductible:</span>
                      <span className="font-medium">₹{plan.deductible.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Monthly:</span>
                      <span className="font-bold text-orange-600">₹{plan.monthly_premium}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Annual:</span>
                      <span className="font-medium line-through text-gray-400">₹{plan.annual_premium.toLocaleString()}</span>
                    </div>
                  </div>
                  
                  <div className="mb-4">
                    <p className="text-xs font-medium text-gray-500 mb-2">Coverage Includes:</p>
                    <ul className="text-xs text-gray-600 space-y-1">
                      {plan.coverage_items.slice(0, 3).map((item, idx) => (
                        <li key={idx} className="flex items-center gap-1">
                          <span className="text-green-500">✓</span> {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                  
                  <button
                    onClick={() => setShowPlanDetails(plan)}
                    className="w-full py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition mb-2"
                  >
                    View Details
                  </button>
                  <button
                    onClick={() => handlePurchasePlan(plan.id)}
                    className="w-full py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition"
                  >
                    Purchase Plan
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Policies Tab */}
        {activeTab === 'policies' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">My Insurance Policies</h2>
            </div>
            
            {policies.length === 0 ? (
              <div className="bg-white rounded-2xl p-12 text-center shadow-sm">
                <div className="text-5xl mb-4">📄</div>
                <p className="text-gray-500 mb-4">No active policies</p>
                <button
                  onClick={() => setActiveTab('plans')}
                  className="px-6 py-3 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition"
                >
                  Browse Plans
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {policies.map(policy => (
                  <div key={policy.id} className="bg-white rounded-2xl p-6 shadow-sm">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="font-semibold text-gray-900">{policy.plan_name}</h3>
                        <p className="text-sm text-gray-500">Policy: {policy.policy_number}</p>
                        <p className="text-sm text-gray-500">Pet: {policy.pet_name}</p>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusColors[policy.status]}`}>
                        {policy.status}
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                      <div>
                        <p className="text-xs text-gray-500">Coverage</p>
                        <p className="font-medium">₹{policy.coverage_amount.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Premium</p>
                        <p className="font-medium">₹{policy.premium_amount}/month</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Valid Until</p>
                        <p className="font-medium">{new Date(policy.end_date).toLocaleDateString()}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Auto Renew</p>
                        <p className="font-medium">{policy.auto_renew ? '✅ Yes' : '❌ No'}</p>
                      </div>
                    </div>
                    
                    {policy.next_premium_date && (
                      <div className="p-3 bg-blue-50 rounded-lg">
                        <p className="text-sm text-blue-700">
                          Next premium due: {new Date(policy.next_premium_date).toLocaleDateString()}
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Claims Tab */}
        {activeTab === 'claims' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Insurance Claims</h2>
              <button
                onClick={() => setShowClaimForm(true)}
                className="px-4 py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition"
              >
                + File New Claim
              </button>
            </div>
            
            {claims.length === 0 ? (
              <div className="bg-white rounded-2xl p-12 text-center shadow-sm">
                <div className="text-5xl mb-4">💰</div>
                <p className="text-gray-500 mb-4">No claims filed yet</p>
                <button
                  onClick={() => setShowClaimForm(true)}
                  className="px-6 py-3 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition"
                >
                  File Your First Claim
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {claims.map(claim => (
                  <div key={claim.id} className="bg-white rounded-2xl p-6 shadow-sm">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="font-semibold text-gray-900 capitalize">{claim.claim_type} Claim</h3>
                        <p className="text-sm text-gray-500">Policy: {claim.policy_number}</p>
                        <p className="text-sm text-gray-500">Pet: {claim.pet_name}</p>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusColors[claim.status]}`}>
                        {claim.status.replace('_', ' ')}
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                      <div>
                        <p className="text-xs text-gray-500">Amount Claimed</p>
                        <p className="font-medium">₹{claim.amount_claimed.toLocaleString()}</p>
                      </div>
                      {claim.amount_approved && (
                        <div>
                          <p className="text-xs text-gray-500">Amount Approved</p>
                          <p className="font-medium text-green-600">₹{claim.amount_approved.toLocaleString()}</p>
                        </div>
                      )}
                      {claim.amount_paid && (
                        <div>
                          <p className="text-xs text-gray-500">Amount Paid</p>
                          <p className="font-medium text-green-600">₹{claim.amount_paid.toLocaleString()}</p>
                        </div>
                      )}
                      <div>
                        <p className="text-xs text-gray-500">Incident Date</p>
                        <p className="font-medium">{new Date(claim.incident_date).toLocaleDateString()}</p>
                      </div>
                    </div>
                    
                    <div className="mb-4">
                      <p className="text-xs text-gray-500 mb-1">Description</p>
                      <p className="text-sm text-gray-700">{claim.description}</p>
                    </div>
                    
                    {claim.documents.length > 0 && (
                      <div className="mb-4">
                        <p className="text-xs text-gray-500 mb-2">Documents</p>
                        <div className="flex gap-2">
                          {claim.documents.map(doc => (
                            <a key={doc.id} href={doc.url} className="px-3 py-1 bg-gray-100 rounded-lg text-sm text-gray-700 hover:bg-gray-200">
                              📎 {doc.name}
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {claim.rejection_reason && (
                      <div className="p-3 bg-red-50 rounded-lg">
                        <p className="text-sm text-red-700">
                          <span className="font-medium">Rejection Reason:</span> {claim.rejection_reason}
                        </p>
                      </div>
                    )}
                    
                    <p className="text-xs text-gray-400 mt-4">
                      Submitted: {new Date(claim.submitted_at).toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Plan Details Modal */}
      {showPlanDetails && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b sticky top-0 bg-white z-10">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold text-gray-900">{showPlanDetails.name}</h3>
                <button onClick={() => setShowPlanDetails(null)} className="text-gray-400 hover:text-gray-600 text-2xl">✕</button>
              </div>
            </div>
            
            <div className="p-6 space-y-6">
              <div>
                <p className="text-sm text-gray-500 mb-1">Provider</p>
                <p className="font-medium">{showPlanDetails.provider}</p>
              </div>
              
              <div>
                <p className="text-sm text-gray-500 mb-1">Description</p>
                <p className="text-gray-700">{showPlanDetails.description}</p>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500 mb-1">Coverage Amount</p>
                  <p className="font-bold text-lg">₹{showPlanDetails.coverage_amount.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 mb-1">Deductible</p>
                  <p className="font-medium">₹{showPlanDetails.deductible.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 mb-1">Monthly Premium</p>
                  <p className="font-bold text-orange-600">₹{showPlanDetails.monthly_premium}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 mb-1">Annual Premium</p>
                  <p className="font-medium line-through text-gray-400">₹{showPlanDetails.annual_premium.toLocaleString()}</p>
                </div>
              </div>
              
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">Coverage Includes:</p>
                <ul className="space-y-1">
                  {showPlanDetails.coverage_items.map((item, idx) => (
                    <li key={idx} className="flex items-center gap-2 text-sm text-gray-600">
                      <span className="text-green-500">✓</span> {item}
                    </li>
                  ))}
                </ul>
              </div>
              
              {showPlanDetails.exclusions.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">Exclusions:</p>
                  <ul className="space-y-1">
                    {showPlanDetails.exclusions.map((item, idx) => (
                      <li key={idx} className="flex items-center gap-2 text-sm text-gray-600">
                        <span className="text-red-500">✕</span> {item}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-gray-500">Waiting Period</p>
                  <p className="font-medium">{showPlanDetails.waiting_period_days} days</p>
                </div>
                <div>
                  <p className="text-gray-500">Min Age</p>
                  <p className="font-medium">{showPlanDetails.min_age_months} months</p>
                </div>
                <div>
                  <p className="text-gray-500">Max Age</p>
                  <p className="font-medium">{showPlanDetails.max_age_years} years</p>
                </div>
              </div>
            </div>
            
            <div className="p-6 border-t bg-gray-50 flex justify-end gap-3 rounded-b-2xl">
              <button
                onClick={() => setShowPlanDetails(null)}
                className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300 transition"
              >
                Close
              </button>
              <button
                onClick={() => {
                  setShowPlanDetails(null);
                  handlePurchasePlan(showPlanDetails.id);
                }}
                className="px-6 py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition"
              >
                Purchase Plan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Claim Form Modal */}
      {showClaimForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b sticky top-0 bg-white z-10">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold text-gray-900">File Insurance Claim</h3>
                <button onClick={() => setShowClaimForm(false)} className="text-gray-400 hover:text-gray-600 text-2xl">✕</button>
              </div>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Policy *</label>
                <select
                  value={claimForm.policy_id}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setClaimForm(prev => ({ ...prev, policy_id: e.target.value }))}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:border-orange-500 outline-none"
                >
                  <option value="">Select a policy</option>
                  {policies.filter(p => p.status === 'active').map(policy => (
                    <option key={policy.id} value={policy.id}>
                      {policy.policy_number} - {policy.pet_name} ({policy.plan_name})
                    </option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Claim Type *</label>
                <select
                  value={claimForm.claim_type}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setClaimForm(prev => ({ ...prev, claim_type: e.target.value as any }))}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:border-orange-500 outline-none"
                >
                  <option value="medical">Medical Treatment</option>
                  <option value="surgery">Surgery</option>
                  <option value="accident">Accident</option>
                  <option value="illness">Illness</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Incident Date *</label>
                <input
                  type="date"
                  value={claimForm.incident_date}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setClaimForm(prev => ({ ...prev, incident_date: e.target.value }))}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:border-orange-500 outline-none"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Amount Claimed (₹) *</label>
                <input
                  type="number"
                  value={claimForm.amount_claimed}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setClaimForm(prev => ({ ...prev, amount_claimed: Number(e.target.value) }))}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:border-orange-500 outline-none"
                  min="0"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description *</label>
                <textarea
                  value={claimForm.description}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setClaimForm(prev => ({ ...prev, description: e.target.value }))}
                  rows={4}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:border-orange-500 outline-none resize-none"
                  placeholder="Describe the incident and treatment received..."
                />
              </div>
              
              <div className="p-3 bg-blue-50 rounded-lg">
                <p className="text-sm text-blue-700">
                  📎 You can upload supporting documents (bills, reports) after submitting the claim.
                </p>
              </div>
            </div>
            
            <div className="p-6 border-t bg-gray-50 flex justify-end gap-3 rounded-b-2xl">
              <button
                onClick={() => setShowClaimForm(false)}
                className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitClaim}
                disabled={submittingClaim}
                className="px-6 py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition disabled:opacity-50"
              >
                {submittingClaim ? 'Submitting...' : 'Submit Claim'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

