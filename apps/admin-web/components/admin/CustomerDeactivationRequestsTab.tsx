'use client';

import { useState, useEffect } from 'react';
import { Button } from '@warmpawz/ui';
import { AlertTriangle, Check, X } from 'lucide-react';
import { apiClient } from '@/lib/api-client';

interface DeactivationRequest {
  id: string;
  vendorName: string;
  businessName: string;
  reason: string;
  requestedAt: string;
  status: 'pending' | 'approved' | 'rejected';
}

export function CustomerDeactivationRequestsTab() {
  const [requests, setRequests] = useState<DeactivationRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRequests();
  }, []);

  const loadRequests = async () => {
    setLoading(true);
    try {
      const data = await apiClient.get<any>('/admin/customers/deactivation-requests');
      setRequests(data.requests || []);
    } catch (error) {
      console.error('Error loading customer deactivation requests:', error);
      setRequests([]);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (requestId: string) => {
    try {
      await apiClient.post(`/admin/customers/deactivation-requests/${requestId}/approve`, {});
      alert('Request approved — customer deactivated');
      await loadRequests();
    } catch (error: unknown) {
      console.error(error);
      alert(error instanceof Error ? error.message : 'Failed to approve');
    }
  };

  const handleReject = async (requestId: string) => {
    try {
      await apiClient.post(`/admin/customers/deactivation-requests/${requestId}/reject`, {});
      alert('Request rejected');
      await loadRequests();
    } catch (error: unknown) {
      console.error(error);
      alert(error instanceof Error ? error.message : 'Failed to reject');
    }
  };

  if (loading) {
    return <div className="p-0 text-center text-gray-500">Loading requests...</div>;
  }

  if (requests.length === 0) {
    return (
      <div className="p-0 text-center">
        <AlertTriangle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-500">No pending customer deactivation requests.</p>
      </div>
    );
  }

  return (
    <div className="p-0">
      <div className="space-y-4">
        {requests.map((request) => (
          <div key={request.id} className="bg-white border rounded-lg p-4">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900">{request.vendorName}</h3>
                <p className="text-sm text-gray-600">{request.businessName}</p>
                <p className="text-sm text-gray-700 mt-0">
                  <strong>Reason:</strong> {request.reason}
                </p>
                <p className="text-xs text-gray-500 mt-0">
                  Requested: {new Date(request.requestedAt).toLocaleDateString()}
                </p>
              </div>

              {request.status === 'pending' && (
                <div className="flex gap-3 ml-4">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleApprove(request.id)}
                    className="text-green-600 hover:bg-green-50"
                  >
                    <Check className="w-4 h-4 mr-2" />
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleReject(request.id)}
                    className="text-red-600 hover:bg-red-50"
                  >
                    <X className="w-4 h-4 mr-2" />
                    Reject
                  </Button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
