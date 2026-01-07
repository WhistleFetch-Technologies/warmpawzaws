/**
 * React Hook for Payment Gateways Management
 */

import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';

export interface PaymentGateway {
  id: string;
  gateway_name: string;
  gateway_type: 'razorpay' | 'stripe' | 'paypal' | 'paytm';
  key_id?: string;
  marketplace_mode: boolean;
  enabled: boolean;
  test_mode: boolean;
  config: any;
  updated_at: string;
  created_at?: string;
}

export function usePaymentGateways() {
  const [gateways, setGateways] = useState<PaymentGateway[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchGateways = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.get<{ success: boolean; gateways: PaymentGateway[] }>('/admin/payment-gateways');
      setGateways(response.gateways || []);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch payment gateways');
      setGateways([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGateways();
  }, []);

  const createGateway = async (data: Partial<PaymentGateway>) => {
    try {
      const response = await apiClient.post<{ success: boolean; gateway: PaymentGateway }>('/admin/payment-gateways', data);
      await fetchGateways();
      return response.gateway;
    } catch (err: any) {
      throw new Error(err.message || 'Failed to create payment gateway');
    }
  };

  const updateGateway = async (id: string, data: Partial<PaymentGateway>) => {
    try {
      const response = await apiClient.put<{ success: boolean; gateway: PaymentGateway }>(`/admin/payment-gateways/${id}`, data);
      await fetchGateways();
      return response.gateway;
    } catch (err: any) {
      throw new Error(err.message || 'Failed to update payment gateway');
    }
  };

  const deleteGateway = async (id: string) => {
    try {
      await apiClient.delete(`/admin/payment-gateways/${id}`);
      await fetchGateways();
    } catch (err: any) {
      throw new Error(err.message || 'Failed to delete payment gateway');
    }
  };

  return {
    gateways,
    loading,
    error,
    refetch: fetchGateways,
    createGateway,
    updateGateway,
    deleteGateway,
  };
}

