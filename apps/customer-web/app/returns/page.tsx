'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';
import {
  ArrowLeft, Package, RefreshCcw, Clock, Check, X as XIcon,
  Truck, AlertCircle, ChevronDown, ChevronUp, Camera, Upload
} from 'lucide-react';

interface ReturnRequest {
  id: string;
  return_number: string;
  order_id: string;
  order_number: string;
  status: 'pending' | 'approved' | 'rejected' | 'pickup_scheduled' | 'picked_up' | 'received' | 'refund_processed';
  reason: string;
  reason_details?: string;
  items: ReturnItem[];
  total_refund_amount: number;
  created_at: string;
  updated_at: string;
  pickup_date?: string;
  refund_method?: string;
}

interface ReturnItem {
  id: string;
  product_id: string;
  product_name: string;
  product_emoji?: string;
  quantity: number;
  refund_amount: number;
}

const statusConfig: Record<string, { color: string; icon: any; label: string; description: string }> = {
  pending: { color: 'amber', icon: Clock, label: 'Pending Review', description: 'We are reviewing your return request' },
  approved: { color: 'blue', icon: Check, label: 'Approved', description: 'Return request approved. Pickup will be scheduled.' },
  rejected: { color: 'red', icon: XIcon, label: 'Rejected', description: 'Return request was not approved' },
  pickup_scheduled: { color: 'purple', icon: Truck, label: 'Pickup Scheduled', description: 'Courier will pick up soon' },
  picked_up: { color: 'indigo', icon: Package, label: 'Picked Up', description: 'Item collected, in transit to warehouse' },
  received: { color: 'cyan', icon: Check, label: 'Received', description: 'Item received, processing refund' },
  refund_processed: { color: 'emerald', icon: Check, label: 'Refund Complete', description: 'Refund has been processed' },
};

export default function ReturnsPage() {
  const router = useRouter();
  const [returns, setReturns] = useState<ReturnRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedReturn, setExpandedReturn] = useState<string | null>(null);

  useEffect(() => {
    loadReturns();
  }, []);

  const loadReturns = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const customerId = localStorage.getItem('warmpawz_customer_id');
      if (!customerId) {
        setReturns([]);
        setLoading(false);
        return;
      }
      
      const result = await apiClient.get<any>(`/customer/${customerId}/returns`);
      setReturns(result?.returns || []);
    } catch (err: any) {
      console.error('Error loading returns:', err);
      setError(err.message || 'Failed to load returns');
    } finally {
      setLoading(false);
    }
  };

  const cancelReturn = async (returnId: string) => {
    if (!confirm('Are you sure you want to cancel this return request?')) return;
    
    try {
      await apiClient.post<any>(`/returns/${returnId}/cancel`, {});
      await loadReturns();
    } catch (err: any) {
      console.error('Error cancelling return:', err);
      alert('Failed to cancel return: ' + (err.message || 'Unknown error'));
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-orange-50/30 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-orange-200 border-t-orange-500 mx-auto"></div>
          <p className="mt-4 text-slate-500">Loading returns...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-orange-50/30">
      <header className="bg-white border-b border-slate-100 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center gap-4">
          <button onClick={() => router.push('/orders')} className="p-2 hover:bg-slate-100 rounded-xl">
            <ArrowLeft className="w-5 h-5 text-slate-600" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <RefreshCcw className="w-6 h-6 text-orange-500" />
              My Returns
            </h1>
            <p className="text-sm text-slate-500">{returns.length} return requests</p>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {error ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-slate-100">
            <AlertCircle className="w-16 h-16 mx-auto mb-4 text-red-300" />
            <p className="text-slate-600 font-medium">Unable to load returns</p>
            <button onClick={loadReturns} className="mt-4 px-6 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600">Try Again</button>
          </div>
        ) : returns.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-slate-100">
            <RefreshCcw className="w-20 h-20 mx-auto mb-6 text-slate-200" />
            <h2 className="text-2xl font-bold text-slate-900 mb-2">No return requests</h2>
            <p className="text-slate-500 mb-6">You haven't requested any returns yet</p>
            <button onClick={() => router.push('/orders')} className="px-8 py-3 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl font-semibold shadow-lg">View Orders</button>
          </div>
        ) : (
          <div className="space-y-6">
            {returns.map(returnReq => {
              const isExpanded = expandedReturn === returnReq.id;
              const config = statusConfig[returnReq.status] || statusConfig.pending;
              const StatusIcon = config.icon;

              return (
                <div key={returnReq.id} className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm">
                  <div className="p-5 border-b border-slate-100">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-3">
                          <h3 className="font-semibold text-slate-900">Return #{returnReq.return_number}</h3>
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold bg-${config.color}-100 text-${config.color}-700`}>
                            {config.label}
                          </span>
                        </div>
                        <p className="text-sm text-slate-500 mt-1">Order #{returnReq.order_number}</p>
                        <p className="text-sm text-slate-500">{new Date(returnReq.created_at).toLocaleDateString()}</p>
                      </div>
                      <button onClick={() => setExpandedReturn(isExpanded ? null : returnReq.id)} className="p-2 hover:bg-slate-100 rounded-xl">
                        {isExpanded ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
                      </button>
                    </div>
                  </div>

                  <div className="p-5 bg-slate-50">
                    <div className="flex gap-4 overflow-x-auto">
                      {returnReq.items?.slice(0, 3).map(item => (
                        <div key={item.id} className="flex-shrink-0 flex items-center gap-3 p-3 bg-white rounded-xl border border-slate-100">
                          <div className="w-12 h-12 bg-slate-100 rounded-lg flex items-center justify-center text-xl">
                            {item.product_emoji || '📦'}
                          </div>
                          <div>
                            <p className="font-medium text-slate-900 text-sm line-clamp-1">{item.product_name}</p>
                            <p className="text-xs text-slate-500">Qty: {item.quantity} • Refund: ₹{item.refund_amount}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="p-5 border-t border-slate-100 space-y-6">
                      <div>
                        <h4 className="font-semibold text-slate-900 mb-3">Return Status</h4>
                        <div className="p-4 bg-slate-50 rounded-xl">
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-full bg-${config.color}-100 flex items-center justify-center`}>
                              <StatusIcon className={`w-5 h-5 text-${config.color}-600`} />
                            </div>
                            <div>
                              <p className="font-medium text-slate-900">{config.label}</p>
                              <p className="text-sm text-slate-500">{config.description}</p>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div>
                        <h4 className="font-semibold text-slate-900 mb-3">Return Reason</h4>
                        <div className="p-4 bg-slate-50 rounded-xl">
                          <p className="font-medium text-slate-900">{returnReq.reason}</p>
                          {returnReq.reason_details && <p className="text-sm text-slate-600 mt-1">{returnReq.reason_details}</p>}
                        </div>
                      </div>

                      <div>
                        <h4 className="font-semibold text-slate-900 mb-3">Refund Summary</h4>
                        <div className="p-4 bg-emerald-50 rounded-xl">
                          <div className="flex justify-between items-center">
                            <span className="text-emerald-700">Total Refund Amount</span>
                            <span className="text-xl font-bold text-emerald-700">₹{returnReq.total_refund_amount}</span>
                          </div>
                          {returnReq.refund_method && (
                            <p className="text-sm text-emerald-600 mt-1">Via: {returnReq.refund_method}</p>
                          )}
                        </div>
                      </div>

                      {returnReq.pickup_date && (
                        <div>
                          <h4 className="font-semibold text-slate-900 mb-3">Pickup Details</h4>
                          <div className="p-4 bg-blue-50 rounded-xl">
                            <div className="flex items-center gap-3">
                              <Truck className="w-5 h-5 text-blue-600" />
                              <div>
                                <p className="font-medium text-blue-900">Scheduled Pickup</p>
                                <p className="text-sm text-blue-700">{new Date(returnReq.pickup_date).toLocaleDateString()}</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {returnReq.status === 'pending' && (
                        <button onClick={() => cancelReturn(returnReq.id)} className="w-full py-3 border border-red-200 text-red-600 rounded-xl font-medium hover:bg-red-50">
                          Cancel Return Request
                        </button>
                      )}
                    </div>
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
