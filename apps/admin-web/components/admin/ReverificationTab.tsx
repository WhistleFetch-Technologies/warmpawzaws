'use client';

import { useState, useEffect } from 'react';
import { Button } from '@warmpawz/ui';
import { Shield, Check, X, AlertTriangle } from 'lucide-react';
import { apiClient } from '@/lib/api-client';

interface ReverificationRequest {
  id: string;
  vendorName: string;
  businessName: string;
  reason: string;
  documentType: string;
  expiryDate: string;
  status: 'pending' | 'verified' | 'rejected';
}

export function ReverificationTab() {
  const [requests, setRequests] = useState<ReverificationRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRequests();
  }, []);

  const loadRequests = async () => {
    setLoading(true);
    try {
      const data = await apiClient.get<any>('/admin/vendors/reverification-requests');
      setRequests(data.requests || []);
    } catch (error) {
      console.error('Error loading reverification requests:', error);
      // Mock data for now
      setRequests([
        {
          id: '1',
          vendorName: 'Dr. Patel',
          businessName: 'Paws Veterinary Clinic',
          reason: 'License expiring soon',
          documentType: 'Veterinary License',
          expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          status: 'pending',
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (requestId: string) => {
    try {
      await apiClient.post(`/admin/vendors/reverification-requests/${requestId}/verify`);
      alert('Request verified successfully');
      await loadRequests();
    } catch (error: any) {
      console.error('Error verifying request:', error);
      alert(error.message || 'Failed to verify request');
    }
  };

  const handleReject = async (requestId: string) => {
    try {
      await apiClient.post(`/admin/vendors/reverification-requests/${requestId}/reject`);
      alert('Request rejected');
      await loadRequests();
    } catch (error: any) {
      console.error('Error rejecting request:', error);
      alert(error.message || 'Failed to reject request');
    }
  };

  if (loading) {
    return <div className="p-0 text-center text-gray-500">Loading requests...</div>;
  }

  if (requests.length === 0) {
    return (
      <div className="p-0 text-center">
        <Shield className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-500">No reverification requests pending.</p>
      </div>
    );
  }

  return (
    <div className="p-0">
      <div className="space-y-4">
        {requests.map((request) => {
          const daysUntilExpiry = Math.ceil(
            (new Date(request.expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
          );
          const isUrgent = daysUntilExpiry <= 7;

          return (
            <div key={request.id} className={`bg-white border rounded-lg p-4 ${isUrgent ? 'border-red-300' : ''}`}>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  {isUrgent && (
                    <div className="flex items-center gap-0 text-red-600 mb-0">
                      <AlertTriangle className="w-4 h-4" />
                      <span className="text-xs font-semibold">URGENT - Expires in {daysUntilExpiry} days</span>
                    </div>
                  )}
                  
                  <h3 className="font-semibold text-gray-900">{request.vendorName}</h3>
                  <p className="text-sm text-gray-600">{request.businessName}</p>
                  
                  <div className="mt-0 space-y-1">
                    <p className="text-sm text-gray-700">
                      <strong>Document:</strong> {request.documentType}
                    </p>
                    <p className="text-sm text-gray-700">
                      <strong>Expires:</strong> {new Date(request.expiryDate).toLocaleDateString()}
                    </p>
                    <p className="text-sm text-gray-700">
                      <strong>Reason:</strong> {request.reason}
                    </p>
                  </div>
                </div>
                
                {(request.status as any) === 'pending' && (
                  <div className="flex gap-0 ml-4">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleVerify(request.id)}
                      className="text-green-600 hover:bg-green-50"
                    >
                      <Check className="w-4 h-4 mr-0" />
                      Verify
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleReject(request.id)}
                      className="text-red-600 hover:bg-red-50"
                    >
                      <X className="w-4 h-4 mr-0" />
                      Reject
                    </Button>
                  </div>
                )}
                
                {(request.status as any) !== 'pending' && (
                  <div className="ml-4">
                    <span className={`px-0 py-0 text-xs rounded-full ${
                      request.status === 'verified' 
                        ? 'bg-green-100 text-green-700' 
                        : 'bg-red-100 text-red-700'
                    }`}>
                      {request.status}
                    </span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

