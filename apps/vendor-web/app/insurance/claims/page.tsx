'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';
import { ArrowLeft, Plus, FileText, CheckCircle, XCircle, Clock } from 'lucide-react';

interface InsuranceClaim {
  id: string;
  claim_number: string;
  policy_id: string;
  policy_number: string;
  customer_name: string;
  pet_name: string;
  claim_type: 'medical' | 'accident' | 'illness' | 'wellness' | 'other';
  claim_amount: number;
  description: string;
  status: 'pending' | 'under_review' | 'approved' | 'rejected' | 'paid';
  submitted_date: string;
  reviewed_date?: string;
  reviewed_by?: string;
  rejection_reason?: string;
  documents: string[];
}

export default function InsuranceClaimsPage() {
  const router = useRouter();
  const [claims, setClaims] = useState<InsuranceClaim[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'under_review' | 'approved' | 'rejected' | 'paid'>('all');

  useEffect(() => {
    loadClaims();
  }, [filter]);

  const loadClaims = async () => {
    try {
      setLoading(true);
      const vendorId = localStorage.getItem('vendorId');
      if (!vendorId) {
        router.push('/');
        return;
      }
      const response = await apiClient.get<any>(
        `/vendor/${vendorId}/insurance/claims?status=${filter === 'all' ? '' : filter}`
      );
      if (response.success || response.claims) {
        setClaims(response.claims || []);
      }
    } catch (error: any) {
      console.error('Error loading claims:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateClaimStatus = async (claimId: string, newStatus: InsuranceClaim['status'], reason?: string) => {
    try {
      const vendorId = localStorage.getItem('vendorId');
      if (!vendorId) return;
      await apiClient.put(`/vendor/${vendorId}/insurance/claims/${claimId}/status`, {
        status: newStatus,
        rejection_reason: reason,
      });
      loadClaims();
    } catch (error: any) {
      alert(error.message || 'Failed to update claim status');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  const statusColors: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-700',
    under_review: 'bg-blue-100 text-blue-700',
    approved: 'bg-green-100 text-green-700',
    rejected: 'bg-red-100 text-red-700',
    paid: 'bg-purple-100 text-purple-700',
  };

  const statusIcons: Record<string, any> = {
    pending: Clock,
    under_review: FileText,
    approved: CheckCircle,
    rejected: XCircle,
    paid: CheckCircle,
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.back()}
                className="p-2 hover:bg-gray-100 rounded-lg transition"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">🎫 Insurance Claims</h1>
                <p className="text-sm text-gray-500">Process and manage insurance claims</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <div className="text-2xl font-bold text-gray-900">{claims.length}</div>
            <div className="text-sm text-gray-500">Total Claims</div>
          </div>
          <div className="bg-yellow-50 rounded-xl p-4 shadow-sm">
            <div className="text-2xl font-bold text-yellow-700">
              {claims.filter(c => c.status === 'pending').length}
            </div>
            <div className="text-sm text-yellow-600">Pending</div>
          </div>
          <div className="bg-blue-50 rounded-xl p-4 shadow-sm">
            <div className="text-2xl font-bold text-blue-700">
              {claims.filter(c => c.status === 'under_review').length}
            </div>
            <div className="text-sm text-blue-600">Under Review</div>
          </div>
          <div className="bg-green-50 rounded-xl p-4 shadow-sm">
            <div className="text-2xl font-bold text-green-700">
              {claims.filter(c => c.status === 'approved').length}
            </div>
            <div className="text-sm text-green-600">Approved</div>
          </div>
          <div className="bg-purple-50 rounded-xl p-4 shadow-sm">
            <div className="text-2xl font-bold text-purple-700">
              {claims.filter(c => c.status === 'paid').length}
            </div>
            <div className="text-sm text-purple-600">Paid</div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-2 mb-6 overflow-x-auto">
          {['all', 'pending', 'under_review', 'approved', 'rejected', 'paid'].map((status) => (
            <button
              key={status}
              onClick={() => setFilter(status as any)}
              className={`px-4 py-2 rounded-lg whitespace-nowrap transition ${
                filter === status
                  ? 'bg-orange-500 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-100'
              }`}
            >
              {status.replace('_', ' ').charAt(0).toUpperCase() + status.slice(1).replace('_', ' ')}
            </button>
          ))}
        </div>

        {/* Claims List */}
        {claims.length === 0 ? (
          <div className="bg-white rounded-xl p-12 text-center shadow-sm">
            <div className="text-5xl mb-4">🎫</div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No claims</h3>
            <p className="text-gray-500">Insurance claims will appear here when customers submit them</p>
          </div>
        ) : (
          <div className="space-y-4">
            {claims.map((claim) => {
              const StatusIcon = statusIcons[claim.status] || FileText;
              return (
                <div key={claim.id} className="bg-white rounded-xl p-6 shadow-sm">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-bold text-gray-900">Claim #{claim.claim_number}</h3>
                      <p className="text-sm text-gray-500">
                        Policy: {claim.policy_number} • {claim.customer_name} • {claim.pet_name}
                      </p>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1 ${statusColors[claim.status]}`}>
                      <StatusIcon className="w-3 h-3" />
                      {claim.status.replace('_', ' ')}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                      <p className="text-sm text-gray-500">Claim Type</p>
                      <p className="font-medium text-gray-900 capitalize">{claim.claim_type.replace('_', ' ')}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Claim Amount</p>
                      <p className="text-xl font-bold text-orange-600">₹{claim.claim_amount.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Submitted Date</p>
                      <p className="font-medium text-gray-900">{claim.submitted_date}</p>
                    </div>
                    {claim.reviewed_date && (
                      <div>
                        <p className="text-sm text-gray-500">Reviewed Date</p>
                        <p className="font-medium text-gray-900">{claim.reviewed_date}</p>
                        {claim.reviewed_by && (
                          <p className="text-xs text-gray-500">by {claim.reviewed_by}</p>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="mb-4">
                    <p className="text-sm text-gray-500 mb-1">Description</p>
                    <p className="text-sm text-gray-900 bg-gray-50 rounded-lg p-3">{claim.description}</p>
                  </div>

                  {claim.rejection_reason && (
                    <div className="mb-4">
                      <p className="text-sm text-red-600 font-medium mb-1">Rejection Reason</p>
                      <p className="text-sm text-red-700 bg-red-50 rounded-lg p-3">{claim.rejection_reason}</p>
                    </div>
                  )}

                  {claim.documents.length > 0 && (
                    <div className="mb-4">
                      <p className="text-sm text-gray-500 mb-2">Documents</p>
                      <div className="flex flex-wrap gap-2">
                        {claim.documents.map((doc, idx) => (
                          <a
                            key={idx}
                            href={doc}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3 py-1 bg-blue-100 text-blue-700 rounded-lg text-sm hover:bg-blue-200 transition"
                          >
                            Document {idx + 1}
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Action Buttons */}
                  {claim.status === 'pending' && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => updateClaimStatus(claim.id, 'under_review')}
                        className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition font-medium"
                      >
                        Start Review
                      </button>
                      <button
                        onClick={() => {
                          const reason = prompt('Enter rejection reason:');
                          if (reason) {
                            updateClaimStatus(claim.id, 'rejected', reason);
                          }
                        }}
                        className="px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition font-medium"
                      >
                        Reject
                      </button>
                    </div>
                  )}
                  {claim.status === 'under_review' && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => updateClaimStatus(claim.id, 'approved')}
                        className="flex-1 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition font-medium"
                      >
                        Approve Claim
                      </button>
                      <button
                        onClick={() => {
                          const reason = prompt('Enter rejection reason:');
                          if (reason) {
                            updateClaimStatus(claim.id, 'rejected', reason);
                          }
                        }}
                        className="px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition font-medium"
                      >
                        Reject
                      </button>
                    </div>
                  )}
                  {claim.status === 'approved' && (
                    <button
                      onClick={() => updateClaimStatus(claim.id, 'paid')}
                      className="w-full px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition font-medium"
                    >
                      Mark as Paid
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}

