'use client';

import { useState, useEffect } from 'react';
import { Button } from '@warmpawz/ui';
import { AlertTriangle, Check, X, Eye } from 'lucide-react';
import { apiClient } from '@/lib/api-client';

interface DeactivationRequest {
  id: string;
  vendorName: string;
  businessName: string;
  reason: string;
  requestedAt: string;
  status: 'pending' | 'approved' | 'rejected';
}

export function DeactivationRequestsTab() {
  const [requests, setRequests] = useState<DeactivationRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRequests();
  }, []);

  const loadRequests = async () => {
    setLoading(true);
    try {
      const data = await apiClient.get<any>('/admin/vendors/deactivation-requests');
      setRequests(data.requests || []);
    } catch (error) {
      console.error('Error loading deactivation requests:', error);
      // Mock data for now
      setRequests([
        {
          id: '1',
          vendorName: 'Dr. Sharma',
          businessName: 'Pet Care Clinic',
          reason: 'Relocating to different city',
          requestedAt: new Date().toISOString(),
          status: 'pending',
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (requestId: string) => {
    try {
      await apiClient.post(`/admin/vendors/deactivation-requests/${requestId}/approve`);
      alert('Deactivation request approved');
      await loadRequests();
    } catch (error: any) {
      console.error('Error approving deactivation request:', error);
      alert(error.message || 'Failed to approve request');
    }
  };

  const handleReject = async (requestId: string) => {
    try {
      await apiClient.post(`/admin/vendors/deactivation-requests/${requestId}/reject`);
      alert('Deactivation request rejected');
      await loadRequests();
    } catch (error: any) {
      console.error('Error rejecting deactivation request:', error);
      alert(error.message || 'Failed to reject request');
    }
  };

  if (loading) {
    return <div className="p-6 text-center text-gray-500">Loading requests...</div>;
  }

  if (requests.length === 0) {
    return (
      <div className="p-6 text-center">
        <AlertTriangle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-500">No deactivation requests at this time.</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="space-y-4">
        {requests.map((request) => (
          <div key={request.id} className="bg-white border rounded-lg p-4">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900">{request.vendorName}</h3>
                <p className="text-sm text-gray-600">{request.businessName}</p>
                <p className="text-sm text-gray-700 mt-2">
                  <strong>Reason:</strong> {request.reason}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Requested: {new Date(request.requestedAt).toLocaleDateString()}
                </p>
              </div>
              
              {request.status === 'pending' && (
                <div className="flex gap-2 ml-4">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleApprove(request.id)}
                    className="text-green-600 hover:bg-green-50"
                  >
                    <Check className="w-4 h-4 mr-1" />
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleReject(request.id)}
                    className="text-red-600 hover:bg-red-50"
                  >
                    <X className="w-4 h-4 mr-1" />
                    Reject
                  </Button>
                </div>
              )}
              
              {request.status !== 'pending' && (
                <div className="ml-4">
                  <span className={`px-3 py-1 text-xs rounded-full ${
                    request.status === 'approved' 
                      ? 'bg-green-100 text-green-700' 
                      : 'bg-red-100 text-red-700'
                  }`}>
                    {request.status}
                  </span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

