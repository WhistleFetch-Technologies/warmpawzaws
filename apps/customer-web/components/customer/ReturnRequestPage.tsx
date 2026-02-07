"use client";

import { useState, useEffect } from 'react';
import { ArrowLeft, Package, AlertCircle, CheckCircle2, XCircle, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';

interface ReturnRequestPageProps {
  phone?: string;
  customerPhone?: string;
  customerId?: string;
  petId?: string;
  bookingId?: string;
  orderId?: string;
  cafeId?: string;
  preSelectedVendorId?: string;
  vendorId?: string;
  onBack: () => void;
  onNavigate?: (screen: string, data?: any) => void;
  onSuccess?: (bookingId?: string) => void;
  onComplete?: () => void;
}

interface ReturnRequest {
  id: string;
  order_id: string;
  order_number?: string;
  status: 'pending' | 'approved' | 'rejected' | 'processing' | 'completed';
  reason: string;
  items: any[];
  created_at: string;
  updated_at?: string;
}

export function ReturnRequestPage(props: ReturnRequestPageProps) {
  const [returnRequests, setReturnRequests] = useState<ReturnRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [returnReason, setReturnReason] = useState('');
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(props.orderId || null);
  const phone = props.customerPhone || props.phone;

  useEffect(() => {
    if (phone) {
      loadReturnRequests();
    } else {
      setLoading(false);
    }
  }, [phone]);

  const loadReturnRequests = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get<any>(`/customer/${phone}/return-requests`);
      setReturnRequests(response.returns || response || []);
    } catch (error: any) {
      console.error('Error loading return requests:', error);
      setReturnRequests([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitReturn = async () => {
    if (!returnReason.trim()) {
      toast.error('Please provide a reason for return');
      return;
    }

    if (!selectedOrderId && !props.orderId) {
      toast.error('Please select an order to return');
      return;
    }

    try {
      const response = await apiClient.post<any>('/ecommerce/returns', {
        orderId: selectedOrderId || props.orderId,
        reason: returnReason,
        customerPhone: phone,
      });

      if ((response as any).success || (response as any).returnId) {
        toast.success('Return request submitted successfully');
        setShowForm(false);
        setReturnReason('');
        loadReturnRequests();
        props.onSuccess?.();
      }
    } catch (error: any) {
      console.error('Error submitting return:', error);
      toast.error(error.message || 'Failed to submit return request');
    }
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: 'bg-amber-100 text-amber-700 border-amber-200',
      approved: 'bg-blue-100 text-blue-700 border-blue-200',
      rejected: 'bg-red-100 text-red-700 border-red-200',
      processing: 'bg-purple-100 text-purple-700 border-purple-200',
      completed: 'bg-green-100 text-green-700 border-green-200',
    };
    return colors[status] || 'bg-gray-100 text-gray-700 border-gray-200';
  };

  if (!phone) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-md mx-auto">
          <div className="flex items-center gap-4 mb-6">
            <Button variant="ghost" size="icon" onClick={props.onBack} className="rounded-full">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-xl font-semibold">Return Request</h1>
          </div>
          <Card className="p-6 text-center">
            <p className="text-gray-600">Please login to submit return requests</p>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <div className="max-w-md mx-auto bg-white min-h-screen">
        <div className="sticky top-0 z-10 bg-gradient-to-r from-[#FF8C42] via-[#FF7A35] to-[#FF6B35] text-white px-4 py-3 rounded-b-2xl shadow-md">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={props.onBack} className="rounded-full text-white hover:bg-white/20">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-xl font-semibold text-white">Return Request</h1>
          </div>
        </div>

        <div className="p-4 space-y-4">
          {/* New Return Button */}
          {!showForm && (props.orderId || selectedOrderId) && (
            <Button
              onClick={() => setShowForm(true)}
              className="w-full bg-gradient-to-r from-[#FF8C42] to-[#FF6B9D] hover:from-[#FF7A29] hover:to-[#FF5A8D] text-white"
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Request Return
            </Button>
          )}

          {/* Return Form */}
          {showForm && (
            <Card className="p-4">
              <h3 className="font-semibold text-gray-900 mb-4">Request Return</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Reason for Return *
                  </label>
                  <Textarea
                    value={returnReason}
                    onChange={(e) => setReturnReason(e.target.value)}
                    placeholder="Please explain why you want to return this order..."
                    rows={4}
                    className="w-full"
                  />
                </div>
                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowForm(false);
                      setReturnReason('');
                    }}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSubmitReturn}
                    className="flex-1 bg-gradient-to-r from-[#FF8C42] to-[#FF6B9D] hover:from-[#FF7A29] hover:to-[#FF5A8D] text-white"
                  >
                    Submit Request
                  </Button>
                </div>
              </div>
            </Card>
          )}

          {/* Return Requests List */}
          {loading ? (
            <Card className="p-8 text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-[#FF8C42] border-t-transparent mx-auto mb-4"></div>
              <p className="text-gray-600">Loading return requests...</p>
            </Card>
          ) : returnRequests.length === 0 ? (
            <Card className="p-8 text-center">
              <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600 font-medium mb-2">No return requests</p>
              <p className="text-sm text-gray-500">Return requests will appear here</p>
            </Card>
          ) : (
            <div className="space-y-3">
              {returnRequests.map((request) => (
                <Card key={request.id} className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="text-sm text-gray-500">Return ID</p>
                      <p className="font-semibold text-gray-900">{request.id.slice(0, 8).toUpperCase()}</p>
                      {request.order_number && (
                        <p className="text-xs text-gray-500 mt-1">Order: {request.order_number}</p>
                      )}
                    </div>
                    <Badge className={getStatusColor(request.status)}>
                      {request.status.toUpperCase()}
                    </Badge>
                  </div>
                  <p className="text-sm text-gray-600 mb-3">{request.reason}</p>
                  <div className="text-xs text-gray-500">
                    Requested: {new Date(request.created_at).toLocaleDateString()}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
