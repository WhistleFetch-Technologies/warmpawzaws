'use client';

import React, { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';
import { DollarSign, Loader2 } from 'lucide-react';

interface Settlement {
  id: string;
  vendorId: string;
  vendorName: string;
  amount: number;
  currency: string;
  status: 'pending' | 'processed';
  period: string;
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
      if (response.success && response.settlements) {
        setSettlements(response.settlements);
      }
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

  return (
    <div className="space-y-3">
      {settlements.map((settlement) => (
        <div key={settlement.id} className="bg-white rounded-lg border-2 border-gray-200 p-4">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <DollarSign className="w-4 h-4 text-gray-400" />
                <span className="font-semibold text-gray-900">{settlement.vendorName}</span>
              </div>
              <p className="text-sm text-gray-600">
                {settlement.currency} {settlement.amount.toFixed(2)}
              </p>
              <p className="text-xs text-gray-500 mt-1">Period: {settlement.period}</p>
              <span className={`inline-block mt-2 text-xs px-2 py-1 rounded ${
                settlement.status === 'processed' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
              }`}>
                {settlement.status}
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

