'use client';

import { useState, useEffect } from 'react';
import { Button, Badge } from '@warmpawz/ui';
import { MessageSquare, Eye, Clock } from 'lucide-react';
import { apiClient } from '@/lib/api-client';

interface ClarificationRequest {
  id: string;
  vendorName: string;
  businessName: string;
  requestedInfo: string;
  requestedAt: string;
  respondedAt?: string;
  response?: string;
  status: 'pending' | 'responded' | 'reviewed';
}

export function ClarificationRequestedTab() {
  const [requests, setRequests] = useState<ClarificationRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRequests();
  }, []);

  const loadRequests = async () => {
    setLoading(true);
    try {
      const data = await apiClient.get<any>('/admin/vendors/clarification-requests');
      setRequests(data.requests || []);
    } catch (error) {
      console.error('Error loading clarification requests:', error);
      // Mock data for now
      setRequests([
        {
          id: '1',
          vendorName: 'Dr. Kumar',
          businessName: 'Happy Paws Clinic',
          requestedInfo: 'Please provide updated vaccination certificate',
          requestedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
          status: 'pending',
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleReview = async (requestId: string) => {
    try {
      await apiClient.post(`/admin/vendors/clarification-requests/${requestId}/review`);
      alert('Request marked as reviewed');
      await loadRequests();
    } catch (error) {
      console.error('Error reviewing clarification:', error);
      alert('Failed to review request');
    }
  };

  const getDaysAgo = (dateString: string) => {
    const days = Math.floor((Date.now() - new Date(dateString).getTime()) / (1000 * 60 * 60 * 24));
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    return `${days} days ago`;
  };

  if (loading) {
    return <div className="p-0 text-center text-gray-500">Loading requests...</div>;
  }

  if (requests.length === 0) {
    return (
      <div className="p-0 text-center">
        <MessageSquare className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-500">No clarification requests pending.</p>
      </div>
    );
  }

  return (
    <div className="p-0">
      <div className="space-y-4">
        {requests.map((request) => {
          const isOverdue = (request.status as any) === 'pending' && 
            Date.now() - new Date(request.requestedAt).getTime() > 3 * 24 * 60 * 60 * 1000;

          return (
            <div 
              key={request.id} 
              className={`bg-white border rounded-lg p-4 ${isOverdue ? 'border-orange-300 bg-orange-50' : ''}`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-0 mb-0">
                    {isOverdue && (
                      <Badge variant="warning" className="bg-orange-200 text-orange-800">
                        <Clock className="w-3 h-3 mr-0" />
                        Overdue
                      </Badge>
                    )}
                    <Badge 
                      variant={request.status === 'reviewed' ? 'default' : 'warning'}
                      className={
                        request.status === 'reviewed' 
                          ? 'bg-green-100 text-green-700' 
                          : request.status === 'responded'
                          ? 'bg-blue-100 text-blue-700'
                          : ''
                      }
                    >
                      {request.status}
                    </Badge>
                  </div>
                  
                  <h3 className="font-semibold text-gray-900">{request.vendorName}</h3>
                  <p className="text-sm text-gray-600">{request.businessName}</p>
                  <p className="text-sm text-gray-700 mt-0">
                    <strong>Requested:</strong> {request.requestedInfo}
                  </p>
                  <p className="text-xs text-gray-500 mt-0">
                    {getDaysAgo(request.requestedAt)}
                  </p>
                  
                  {request.response && (
                    <div className="mt-0 p-0 bg-blue-50 border border-blue-200 rounded-lg">
                      <p className="text-sm text-blue-800">
                        <strong>Response:</strong> {request.response}
                      </p>
                      <p className="text-xs text-blue-600 mt-0">
                        Responded: {new Date(request.respondedAt!).toLocaleDateString()}
                      </p>
                    </div>
                  )}
                </div>
                
                <div className="flex gap-0 ml-4">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleReview(request.id)}
                    disabled={request.status === 'reviewed'}
                  >
                    <Eye className="w-4 h-4 mr-0" />
                    Review
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

