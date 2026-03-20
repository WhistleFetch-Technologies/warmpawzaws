'use client';

import React, { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';
import { IndianRupee, Loader2, AlertCircle } from 'lucide-react';

interface Settlement {
  id: string;
  vendor_id?: string;
  vendorId?: string;
  vendorName?: string;
  amount: number;
  commission?: number;
  total_amount?: number;
  currency?: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'processed';
  period?: string;
  period_start?: string;
  period_end?: string;
  failure_reason?: string;
  created_at?: string;
}

export function SettlementsTab() {
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSettlements();
  }, []);

  const loadSettlements = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get<any>('/admin/finance/settlements');
      const raw = (response as any)?.data?.settlements ?? (response as any)?.settlements ?? [];
      const list = Array.isArray(raw) ? raw : [];
      setSettlements(list.map((s: any) => {
        // Normalize status: check both settlement_status and status fields, convert to lowercase
        const rawStatus = s.settlement_status || s.status || 'pending';
        const normalizedStatus = String(rawStatus).toLowerCase();
        return {
          id: s.id,
          vendor_id: s.vendor_id,
          vendorId: s.vendor_id,
          vendorName: s.vendorName ?? s.vendor_name ?? 'Unknown',
          amount: Number(s.amount ?? 0),
          commission: s.commission,
          total_amount: s.total_amount,
          currency: s.currency,
          status: normalizedStatus as any,
          period: s.period,
          period_start: s.period_start,
          period_end: s.period_end,
          failure_reason: s.failure_reason,
          created_at: s.created_at,
        };
      }));
    } catch (error) {
      console.error('Error loading settlements:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-orange-600" />
      </div>
    );
  }

  const getStatusBadge = (status: string) => {
    const s = String(status || 'pending').toLowerCase();
    if (s === 'completed' || s === 'processed' || s === 'paid') return 'bg-green-100 text-green-700';
    if (s === 'failed') return 'bg-red-100 text-red-700';
    if (s === 'processing') return 'bg-blue-100 text-blue-700';
    return 'bg-yellow-100 text-yellow-700';
  };

  const getStatusDisplay = (status: string): string => {
    const s = String(status || 'pending').toLowerCase();
    const statusMap: Record<string, string> = {
      'pending': 'Pending',
      'processing': 'Processing',
      'completed': 'Completed',
      'processed': 'Processed',
      'paid': 'Paid',
      'failed': 'Failed',
    };
    return statusMap[s] || s.charAt(0).toUpperCase() + s.slice(1);
  };

  return (
    <div className="space-y-3">
      {settlements.map((settlement) => (
        <div key={settlement.id} className="bg-white rounded-lg border-2 border-gray-200 p-4">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-0">
                <IndianRupee className="w-4 h-4 text-gray-400" />
                <span className="font-semibold text-gray-900">{settlement.vendorName || 'Unknown'}</span>
              </div>
              <p className="text-sm text-gray-600">
                {settlement.currency || 'INR'} ₹{Number(settlement.amount || 0).toFixed(2)}
                {settlement.commission != null && (
                  <span className="text-gray-500 ml-1">(commission: ₹{Number(settlement.commission).toFixed(2)})</span>
                )}
              </p>
              <p className="text-xs text-gray-500 mt-0">
                Period: {settlement.period || (settlement.period_start && settlement.period_end
                  ? `${settlement.period_start} - ${settlement.period_end}`
                  : settlement.created_at ? new Date(settlement.created_at).toLocaleDateString() : '-')}
              </p>
              <span className={`inline-block mt-0 text-xs px-2 py-0.5 rounded ${getStatusBadge(settlement.status)}`}>
                {getStatusDisplay(settlement.status)}
              </span>
              {settlement.failure_reason && (
                <div className="flex items-start gap-2 mt-2 p-2 bg-red-50 rounded text-red-700 text-xs">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>{settlement.failure_reason}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

