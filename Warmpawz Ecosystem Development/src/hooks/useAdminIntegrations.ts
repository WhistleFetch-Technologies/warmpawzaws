import { useState, useEffect } from 'react';
import { getApiBaseUrl, getAuthHeaders } from '../utils/api-config';
import { toast } from 'sonner@2.0.3';

const API_BASE = getApiBaseUrl();

export function useAdminIntegrations() {
  const [loading, setLoading] = useState(false);

  const fetchSettings = async () => {
    try {
      console.log('[useAdminIntegrations] Fetching settings from:', `${API_BASE}/admin/integrations/settings`);
      
      const res = await fetch(`${API_BASE}/admin/integrations/settings`, {
        headers: getAuthHeaders()
      });
      
      if (!res.ok) {
        console.error('[useAdminIntegrations] Settings API error:', res.status, res.statusText);
        return { success: false, error: `API error: ${res.status}` };
      }
      
      const text = await res.text();
      if (!text || text.trim().length === 0) {
        console.warn('[useAdminIntegrations] Empty response from settings API');
        return { success: true, settings: {} }; // Return empty settings if no data
      }
      
      try {
        const parsed = JSON.parse(text);
        console.log('[useAdminIntegrations] Fetched settings:', parsed);
        return parsed;
      } catch (parseError) {
        console.error('[useAdminIntegrations] JSON parse error:', parseError, 'Response:', text.substring(0, 200));
        return { success: false, error: 'Invalid JSON response' };
      }
    } catch (error) {
      console.error('[useAdminIntegrations] Error fetching settings:', error);
      return { success: false, error };
    }
  };

  const saveSettings = async (type: 'aws' | 'googleMaps', settings: any) => {
    try {
      setLoading(true);
      console.log(`[useAdminIntegrations] Saving ${type} settings:`, settings);
      
      const res = await fetch(`${API_BASE}/admin/integrations/settings`, {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ type, settings })
      });
      
      if (!res.ok) {
        console.error(`[useAdminIntegrations] Save failed with status:`, res.status, res.statusText);
        toast.error(`Failed to save: ${res.statusText}`);
        return { success: false, error: res.statusText };
      }
      
      const data = await res.json();
      console.log(`[useAdminIntegrations] Save response:`, data);
      
      if (data.success) toast.success(`${type === 'aws' ? 'AWS' : 'Google Maps'} settings saved`);
      else toast.error(data.error || 'Failed to save settings');
      return data;
    } catch (error) {
      console.error(`[useAdminIntegrations] Save error:`, error);
      toast.error('Network error');
      return { success: false, error: String(error) };
    } finally {
      setLoading(false);
    }
  };

  const fetchGateways = async () => {
    try {
      const res = await fetch(`${API_BASE}/admin/integrations/payments/gateways`, {
        headers: getAuthHeaders()
      });
      
      if (!res.ok) {
        return { success: false, gateways: [] };
      }
      
      const text = await res.text();
      if (!text || text.trim().length === 0) {
        return { success: true, gateways: [] };
      }
      
      try {
        return JSON.parse(text);
      } catch {
        return { success: false, gateways: [] };
      }
    } catch (error) {
      console.error('Error fetching gateways:', error);
      return { success: false, gateways: [] };
    }
  };

  const saveGateway = async (gateway: any) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/admin/integrations/payments/gateways`, {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(gateway)
      });
      const data = await res.json();
      if (data.success) toast.success('Gateway saved');
      else toast.error(data.error);
      return data;
    } finally {
      setLoading(false);
    }
  };

  const deleteGateway = async (id: string) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/admin/integrations/payments/gateways/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      return await res.json();
    } finally {
      setLoading(false);
    }
  };

  const fetchPayoutRules = async () => {
    try {
      const res = await fetch(`${API_BASE}/admin/integrations/payments/rules`, {
        headers: getAuthHeaders()
      });
      
      if (!res.ok) {
        return { success: false, rules: {} };
      }
      
      const text = await res.text();
      if (!text || text.trim().length === 0) {
        return { success: true, rules: {} };
      }
      
      try {
        return JSON.parse(text);
      } catch {
        return { success: false, rules: {} };
      }
    } catch (error) {
      console.error('Error fetching payout rules:', error);
      return { success: false, rules: {} };
    }
  };

  const savePayoutRules = async (rules: any) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/admin/integrations/payments/rules`, {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(rules)
      });
      const data = await res.json();
      if (data.success) toast.success('Rules saved');
      return data;
    } finally {
      setLoading(false);
    }
  };

  // Similar methods for Logistics...
  const fetchLogistics = async () => {
    try {
      const res = await fetch(`${API_BASE}/admin/integrations/logistics`, {
        headers: getAuthHeaders()
      });
      
      if (!res.ok) {
        return { success: false, partners: [] };
      }
      
      const text = await res.text();
      if (!text || text.trim().length === 0) {
        return { success: true, partners: [] };
      }
      
      try {
        return JSON.parse(text);
      } catch {
        return { success: false, partners: [] };
      }
    } catch (error) {
      console.error('Error fetching logistics:', error);
      return { success: false, partners: [] };
    }
  };

  const saveLogisticsPartner = async (partner: any) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/admin/integrations/logistics`, {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(partner)
      });
      const data = await res.json();
      if (data.success) toast.success('Partner saved');
      return data;
    } finally {
      setLoading(false);
    }
  };

  const testBedrockConnection = async (config?: any) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/ai/test-bedrock`, {
        method: 'POST',
        headers: { 
          ...getAuthHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(config || {})
      });
      return await res.json();
    } catch (error) {
      console.error('Bedrock Test Error:', error);
      return { status: 'error', error: String(error) };
    } finally {
      setLoading(false);
    }
  };

  const testIntegrationConnection = async (type: string, config: any) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/admin/integrations/test-connection`, {
        method: 'POST',
        headers: { 
          ...getAuthHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ type, config })
      });
      return await res.json();
    } catch (error) {
      console.error('Integration Test Error:', error);
      return { success: false, error: String(error) };
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    fetchSettings,
    saveSettings,
    fetchGateways,
    saveGateway,
    deleteGateway,
    fetchPayoutRules,
    savePayoutRules,
    fetchLogistics,
    saveLogisticsPartner,
    testBedrockConnection,
    testIntegrationConnection
  };
}