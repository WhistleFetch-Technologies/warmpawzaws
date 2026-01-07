'use client';

import React, { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';
import { CreditCard, Loader2, CheckCircle, XCircle } from 'lucide-react';

interface Payment {
  id: string;
  amount: number;
  currency: string;
  status: 'pending' | 'completed' | 'failed';
  method: string;
  createdAt: string;
}

export function PaymentsTab() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPayments();
  }, []);

  const loadPayments = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get<any>('/admin/finance/payments');
      if (response.success && response.payments) {
        setPayments(response.payments);
      }
    } catch (error) {
      console.error('Error loading payments:', error);
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
      {payments.map((payment) => (
        <div key={payment.id} className="bg-white rounded-lg border-2 border-gray-200 p-4">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <CreditCard className="w-4 h-4 text-gray-400" />
                <span className="font-semibold text-gray-900">
                  {payment.currency} {payment.amount.toFixed(2)}
                </span>
              </div>
              <p className="text-sm text-gray-600">{payment.method}</p>
              <div className="flex items-center gap-2 mt-2">
                {payment.status === 'completed' ? (
                  <CheckCircle className="w-4 h-4 text-green-600" />
                ) : payment.status === 'failed' ? (
                  <XCircle className="w-4 h-4 text-red-600" />
                ) : null}
                <span className={`text-xs px-2 py-1 rounded ${
                  payment.status === 'completed' ? 'bg-green-100 text-green-700' :
                  payment.status === 'failed' ? 'bg-red-100 text-red-700' :
                  'bg-yellow-100 text-yellow-700'
                }`}>
                  {payment.status}
                </span>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

