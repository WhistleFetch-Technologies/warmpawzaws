'use client';
export const dynamic = 'force-dynamic';

import React, { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';
import { AdminLayout } from '@/components/AdminLayout';

// ============================================================================
// TYPES
// ============================================================================

interface AWSConfig {
  region: string;
  s3: { bucket: string; enabled: boolean };
  sns: { enabled: boolean };
  ses: { enabled: boolean };
  chime: { enabled: boolean };
}

interface RazorpayConfig {
  key_id: string;
  webhook_secret: string;
  live_mode: boolean;
  enabled: boolean;
}

interface GoogleMapsConfig {
  api_key: string;
  places_enabled: boolean;
  directions_enabled: boolean;
  enabled: boolean;
}

interface ShiprocketConfig {
  email: string;
  token: string;
  pickup_locations: string[];
  enabled: boolean;
}

interface SMSConfig {
  provider: string;
  api_key: string;
  sender_id: string;
  enabled: boolean;
}

interface IntegrationStatus {
  name: string;
  connected: boolean;
  lastTested: string | null;
  error?: string;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function IntegrationsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Configs
  const [awsConfig, setAwsConfig] = useState<AWSConfig | null>(null);
  const [razorpayConfig, setRazorpayConfig] = useState<RazorpayConfig | null>(null);
  const [googleMapsConfig, setGoogleMapsConfig] = useState<GoogleMapsConfig | null>(null);
  const [shiprocketConfig, setShiprocketConfig] = useState<ShiprocketConfig | null>(null);
  const [smsConfig, setSmsConfig] = useState<SMSConfig | null>(null);
  
  // Test states
  const [testing, setTesting] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, IntegrationStatus>>({});
  
  // Expanded sections
  const [expandedSection, setExpandedSection] = useState<string | null>('aws');

  // ============================================================================
  // DATA LOADING
  // ============================================================================

  useEffect(() => {
    loadConfigs();
  }, []);

  const loadConfigs = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const [aws, razorpay, maps, shiprocket] = await Promise.all([
        apiClient.get<any>('/admin/integrations/aws'),
        apiClient.get<any>('/admin/integrations/razorpay'),
        apiClient.get<any>('/admin/integrations/google-maps'),
        apiClient.get<any>('/admin/integrations/shiprocket'),
      ]);
      
      setAwsConfig(aws.config || aws);
      setRazorpayConfig(razorpay.config || razorpay);
      setGoogleMapsConfig(maps.config || maps);
      setShiprocketConfig(shiprocket.config || shiprocket);
    } catch (err: any) {
      console.error('Error loading configs:', err);
      setError(err.message || 'Failed to load integration configs');
    } finally {
      setLoading(false);
    }
  };

  // ============================================================================
  // ACTIONS
  // ============================================================================

  const handleTestConnection = async (integration: string) => {
    try {
      setTesting(integration);
      setError(null);
      
      const response = await apiClient.post<any>(`/admin/integrations/${integration}/test`, {});
      
      setTestResults(prev => ({
        ...prev,
        [integration]: {
          name: integration,
          connected: response.success,
          lastTested: new Date().toISOString(),
          error: response.error,
        }
      }));
      
      if (response.success) {
        setSuccess(`${integration.toUpperCase()} connection successful!`);
      } else {
        setError(`${integration.toUpperCase()} connection failed: ${response.error}`);
      }
    } catch (err: any) {
      setTestResults(prev => ({
        ...prev,
        [integration]: {
          name: integration,
          connected: false,
          lastTested: new Date().toISOString(),
          error: err.message,
        }
      }));
      setError(`Failed to test ${integration}: ${err.message}`);
    } finally {
      setTesting(null);
    }
  };

  const handleSaveConfig = async (integration: string, config: any) => {
    try {
      setError(null);
      await apiClient.put(`/admin/integrations/${integration}`, config);
      setSuccess(`${integration.toUpperCase()} configuration saved!`);
      loadConfigs();
    } catch (err: any) {
      setError(err.message || `Failed to save ${integration} config`);
    }
  };

  // ============================================================================
  // RENDER HELPERS
  // ============================================================================

  const StatusBadge = ({ connected, tested }: { connected: boolean; tested: boolean }) => {
    if (!tested) {
      return <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded-full text-xs">Not tested</span>;
    }
    return connected 
      ? <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs">✓ Connected</span>
      : <span className="px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs">✕ Failed</span>;
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading integrations...</p>
        </div>
      </div>
    );
  }

  const integrations = [
    {
      id: 'aws',
      name: 'Amazon Web Services',
      icon: '☁️',
      description: 'S3 Storage, SNS Notifications, SES Email, Chime Video',
      configured: !!awsConfig?.s3?.bucket,
    },
    {
      id: 'razorpay',
      name: 'Razorpay',
      icon: '💳',
      description: 'Payment gateway for bookings and orders',
      configured: !!razorpayConfig?.key_id,
    },
    {
      id: 'google-maps',
      name: 'Google Maps',
      icon: '🗺️',
      description: 'Location services, directions, and places',
      configured: !!googleMapsConfig?.api_key,
    },
    {
      id: 'shiprocket',
      name: 'Shiprocket',
      icon: '📦',
      description: 'Logistics and shipping for e-commerce orders',
      configured: !!shiprocketConfig?.email,
    },
    {
      id: 'sms',
      name: 'SMS Gateway',
      icon: '📱',
      description: 'OTP and notification SMS delivery',
      configured: !!smsConfig?.api_key,
    },
  ];

  return (
    <AdminLayout>
      <div className="min-h-screen bg-slate-50">
        {/* Header */}
        <header className="bg-white border-b px-8 py-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Platform Integrations</h1>
            <p className="text-gray-500">Configure third-party services and APIs</p>
          </div>
          <button
            onClick={loadConfigs}
            className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition"
          >
            🔄 Refresh
          </button>
        </div>
      </header>

      <main className="p-8">
        {/* Messages */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600">✕</button>
          </div>
        )}
        
        {success && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl text-green-700 flex items-center justify-between">
            <span>{success}</span>
            <button onClick={() => setSuccess(null)} className="text-green-400 hover:text-green-600">✕</button>
          </div>
        )}

        {/* Integration Cards */}
        <div className="space-y-4">
          {integrations.map(integration => (
            <div key={integration.id} className="bg-white rounded-2xl shadow-sm overflow-hidden">
              {/* Card Header */}
              <button
                onClick={() => setExpandedSection(expandedSection === integration.id ? null : integration.id)}
                className="w-full p-6 flex items-center justify-between hover:bg-gray-50 transition"
              >
                <div className="flex items-center gap-4">
                  <div className="text-4xl">{integration.icon}</div>
                  <div className="text-left">
                    <h3 className="font-semibold text-gray-900">{integration.name}</h3>
                    <p className="text-sm text-gray-500">{integration.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <StatusBadge 
                    connected={testResults[integration.id]?.connected ?? false}
                    tested={!!testResults[integration.id]}
                  />
                  <span className={`px-3 py-1 rounded-full text-xs ${integration.configured ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                    {integration.configured ? 'Configured' : 'Not configured'}
                  </span>
                  <span className="text-gray-400 text-xl">{expandedSection === integration.id ? '▼' : '▶'}</span>
                </div>
              </button>

              {/* Expanded Content */}
              {expandedSection === integration.id && (
                <div className="border-t p-6 bg-gray-50">
                  {/* AWS Configuration */}
                  {integration.id === 'aws' && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Region</label>
                          <input
                            type="text"
                            value={awsConfig?.region || 'ap-south-1'}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAwsConfig(prev => prev ? { ...prev, region: e.target.value } : null)}
                            className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:border-orange-500 outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">S3 Bucket</label>
                          <input
                            type="text"
                            value={awsConfig?.s3?.bucket || ''}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAwsConfig(prev => prev ? { ...prev, s3: { ...prev.s3, bucket: e.target.value } } : null)}
                            className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:border-orange-500 outline-none"
                          />
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-4">
                        <label className="flex items-center gap-2">
                          <input type="checkbox" checked={awsConfig?.s3?.enabled ?? false} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAwsConfig(prev => prev ? { ...prev, s3: { ...prev.s3, enabled: e.target.checked } } : null)} className="rounded" />
                          <span className="text-sm">S3 Storage</span>
                        </label>
                        <label className="flex items-center gap-2">
                          <input type="checkbox" checked={awsConfig?.sns?.enabled ?? false} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAwsConfig(prev => prev ? { ...prev, sns: { enabled: e.target.checked } } : null)} className="rounded" />
                          <span className="text-sm">SNS Notifications</span>
                        </label>
                        <label className="flex items-center gap-2">
                          <input type="checkbox" checked={awsConfig?.ses?.enabled ?? false} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAwsConfig(prev => prev ? { ...prev, ses: { enabled: e.target.checked } } : null)} className="rounded" />
                          <span className="text-sm">SES Email</span>
                        </label>
                        <label className="flex items-center gap-2">
                          <input type="checkbox" checked={awsConfig?.chime?.enabled ?? false} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAwsConfig(prev => prev ? { ...prev, chime: { enabled: e.target.checked } } : null)} className="rounded" />
                          <span className="text-sm">Chime Video</span>
                        </label>
                      </div>
                    </div>
                  )}

                  {/* Razorpay Configuration */}
                  {integration.id === 'razorpay' && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Key ID</label>
                          <input
                            type="text"
                            value={razorpayConfig?.key_id || ''}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRazorpayConfig(prev => prev ? { ...prev, key_id: e.target.value } : { key_id: e.target.value, webhook_secret: '', live_mode: false, enabled: false })}
                            className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:border-orange-500 outline-none"
                            placeholder="rzp_test_..."
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Webhook Secret</label>
                          <input
                            type="password"
                            value={razorpayConfig?.webhook_secret || ''}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRazorpayConfig(prev => prev ? { ...prev, webhook_secret: e.target.value } : null)}
                            className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:border-orange-500 outline-none"
                            placeholder="••••••••"
                          />
                        </div>
                      </div>
                      <div className="flex items-center gap-6">
                        <label className="flex items-center gap-2">
                          <input 
                            type="checkbox" 
                            checked={razorpayConfig?.live_mode ?? false} 
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRazorpayConfig(prev => prev ? { ...prev, live_mode: e.target.checked } : null)} 
                            className="rounded" 
                          />
                          <span className="text-sm">Live Mode</span>
                        </label>
                        <label className="flex items-center gap-2">
                          <input 
                            type="checkbox" 
                            checked={razorpayConfig?.enabled ?? false} 
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRazorpayConfig(prev => prev ? { ...prev, enabled: e.target.checked } : null)} 
                            className="rounded" 
                          />
                          <span className="text-sm">Enabled</span>
                        </label>
                      </div>
                      {razorpayConfig?.live_mode && (
                        <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                          <p className="text-yellow-700 text-sm">⚠️ Live mode is enabled. Real payments will be processed.</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Google Maps Configuration */}
                  {integration.id === 'google-maps' && (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">API Key</label>
                        <input
                          type="password"
                          value={googleMapsConfig?.api_key || ''}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setGoogleMapsConfig(prev => prev ? { ...prev, api_key: e.target.value } : { api_key: e.target.value, places_enabled: false, directions_enabled: false, enabled: false })}
                          className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:border-orange-500 outline-none"
                          placeholder="AIza..."
                        />
                      </div>
                      <div className="flex flex-wrap gap-4">
                        <label className="flex items-center gap-2">
                          <input type="checkbox" checked={googleMapsConfig?.places_enabled ?? false} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setGoogleMapsConfig(prev => prev ? { ...prev, places_enabled: e.target.checked } : null)} className="rounded" />
                          <span className="text-sm">Places API</span>
                        </label>
                        <label className="flex items-center gap-2">
                          <input type="checkbox" checked={googleMapsConfig?.directions_enabled ?? false} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setGoogleMapsConfig(prev => prev ? { ...prev, directions_enabled: e.target.checked } : null)} className="rounded" />
                          <span className="text-sm">Directions API</span>
                        </label>
                        <label className="flex items-center gap-2">
                          <input type="checkbox" checked={googleMapsConfig?.enabled ?? false} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setGoogleMapsConfig(prev => prev ? { ...prev, enabled: e.target.checked } : null)} className="rounded" />
                          <span className="text-sm">Enabled</span>
                        </label>
                      </div>
                    </div>
                  )}

                  {/* Shiprocket Configuration */}
                  {integration.id === 'shiprocket' && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                          <input
                            type="email"
                            value={shiprocketConfig?.email || ''}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setShiprocketConfig(prev => prev ? { ...prev, email: e.target.value } : { email: e.target.value, token: '', pickup_locations: [], enabled: false })}
                            className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:border-orange-500 outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">API Token</label>
                          <input
                            type="password"
                            value={shiprocketConfig?.token || ''}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setShiprocketConfig(prev => prev ? { ...prev, token: e.target.value } : null)}
                            className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:border-orange-500 outline-none"
                          />
                        </div>
                      </div>
                      <label className="flex items-center gap-2">
                        <input type="checkbox" checked={shiprocketConfig?.enabled ?? false} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setShiprocketConfig(prev => prev ? { ...prev, enabled: e.target.checked } : null)} className="rounded" />
                        <span className="text-sm">Enabled</span>
                      </label>
                    </div>
                  )}

                  {/* SMS Configuration */}
                  {integration.id === 'sms' && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Provider</label>
                          <select
                            value={smsConfig?.provider || 'twilio'}
                            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSmsConfig(prev => prev ? { ...prev, provider: e.target.value } : { provider: e.target.value, api_key: '', sender_id: '', enabled: false })}
                            className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:border-orange-500 outline-none"
                          >
                            <option value="twilio">Twilio</option>
                            <option value="msg91">MSG91</option>
                            <option value="aws_sns">AWS SNS</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">API Key</label>
                          <input
                            type="password"
                            value={smsConfig?.api_key || ''}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSmsConfig(prev => prev ? { ...prev, api_key: e.target.value } : null)}
                            className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:border-orange-500 outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Sender ID</label>
                          <input
                            type="text"
                            value={smsConfig?.sender_id || ''}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSmsConfig(prev => prev ? { ...prev, sender_id: e.target.value } : null)}
                            className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:border-orange-500 outline-none"
                            placeholder="WMPAWZ"
                          />
                        </div>
                      </div>
                      <label className="flex items-center gap-2">
                        <input type="checkbox" checked={smsConfig?.enabled ?? false} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSmsConfig(prev => prev ? { ...prev, enabled: e.target.checked } : null)} className="rounded" />
                        <span className="text-sm">Enabled</span>
                      </label>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
                    <button
                      onClick={() => handleTestConnection(integration.id)}
                      disabled={testing === integration.id}
                      className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg font-medium hover:bg-slate-200 transition disabled:opacity-50"
                    >
                      {testing === integration.id ? (
                        <span className="flex items-center gap-2">
                          <span className="animate-spin">⏳</span> Testing...
                        </span>
                      ) : (
                        '🔌 Test Connection'
                      )}
                    </button>
                    <button
                      onClick={() => {
                        const config = integration.id === 'aws' ? awsConfig :
                                       integration.id === 'razorpay' ? razorpayConfig :
                                       integration.id === 'google-maps' ? googleMapsConfig :
                                       integration.id === 'shiprocket' ? shiprocketConfig :
                                       smsConfig;
                        handleSaveConfig(integration.id, config);
                      }}
                      className="px-4 py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition"
                    >
                      💾 Save Configuration
                    </button>
                  </div>

                  {/* Test Result */}
                  {testResults[integration.id] && (
                    <div className={`mt-4 p-4 rounded-lg ${testResults[integration.id].connected ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                      <div className="flex items-center gap-2">
                        <span className={testResults[integration.id].connected ? 'text-green-600' : 'text-red-600'}>
                          {testResults[integration.id].connected ? '✓' : '✕'}
                        </span>
                        <span className={`font-medium ${testResults[integration.id].connected ? 'text-green-700' : 'text-red-700'}`}>
                          {testResults[integration.id].connected ? 'Connection successful' : 'Connection failed'}
                        </span>
                      </div>
                      {testResults[integration.id].error && (
                        <p className="text-red-600 text-sm mt-1">{testResults[integration.id].error}</p>
                      )}
                      <p className="text-gray-500 text-xs mt-1">
                        Tested: {new Date(testResults[integration.id].lastTested!).toLocaleString()}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </main>
      </div>
    </AdminLayout>
  );
}

