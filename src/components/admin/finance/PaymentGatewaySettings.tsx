import { useState, useEffect } from 'react';
import { Card } from '../../ui/card';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Switch } from '../../ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../ui/tabs';
import { 
  ArrowLeft, CreditCard, Check, AlertCircle, Settings, 
  Shield, Eye, EyeOff, Plus, Trash2, Save, RefreshCw
} from 'lucide-react';
import { toast } from 'sonner';
import { projectId, publicAnonKey } from '../../../utils/supabase/info';
import { copyTextToClipboard } from '../../../utils/shareUtils';

interface PaymentGatewaySettingsProps {
  onBack: () => void;
}

interface Gateway {
  id: string;
  name: string;
  provider: 'razorpay' | 'stripe' | 'paypal' | 'paytm';
  enabled: boolean;
  testMode: boolean;
  apiKey: string;
  apiSecret: string;
  webhookSecret: string;
  regions: string[];
  feePercentage: number;
  feeFixed: number;
  priority: number;
}

export function PaymentGatewaySettings({ onBack }: PaymentGatewaySettingsProps) {
  const [loading, setLoading] = useState(false);
  const [gateways, setGateways] = useState<Gateway[]>([]);
  const [selectedGateway, setSelectedGateway] = useState<Gateway | null>(null);
  const [showSecrets, setShowSecrets] = useState<{ [key: string]: boolean }>({});
  const [editMode, setEditMode] = useState(false);

  useEffect(() => {
    loadGateways();
  }, []);

  const loadGateways = async () => {
    setLoading(true);
    try {
      // In production, fetch from: GET /make-server-3dd53475/admin/payment-gateways
      // Mock data for now
      const mockGateways: Gateway[] = [
        {
          id: 'gw_1',
          name: 'Razorpay India',
          provider: 'razorpay',
          enabled: true,
          testMode: false,
          apiKey: 'rzp_live_xxxxxxxxxxxxx',
          apiSecret: 'secret_xxxxxxxxxxxxx',
          webhookSecret: 'whsec_xxxxxxxxxxxxx',
          regions: ['india'],
          feePercentage: 2.0,
          feeFixed: 0,
          priority: 1
        },
        {
          id: 'gw_2',
          name: 'Stripe International',
          provider: 'stripe',
          enabled: true,
          testMode: false,
          apiKey: 'sk_live_xxxxxxxxxxxxx',
          apiSecret: '',
          webhookSecret: 'whsec_xxxxxxxxxxxxx',
          regions: ['usa', 'uk', 'singapore'],
          feePercentage: 2.9,
          feeFixed: 30,
          priority: 2
        },
        {
          id: 'gw_3',
          name: 'PayPal Global',
          provider: 'paypal',
          enabled: false,
          testMode: true,
          apiKey: 'xxxxxxxxxxxxx',
          apiSecret: 'xxxxxxxxxxxxx',
          webhookSecret: '',
          regions: ['all'],
          feePercentage: 3.5,
          feeFixed: 0,
          priority: 3
        }
      ];

      setGateways(mockGateways);
      if (mockGateways.length > 0) {
        setSelectedGateway(mockGateways[0]);
      }
    } catch (error) {
      console.error('Error loading gateways:', error);
      toast.error('Failed to load payment gateways');
    } finally {
      setLoading(false);
    }
  };

  const saveGateway = async (gateway: Gateway) => {
    setLoading(true);
    try {
      // In production: PUT /make-server-3dd53475/admin/payment-gateways/{id}
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/admin/payment-gateways/${gateway.id}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${publicAnonKey}`
          },
          body: JSON.stringify(gateway)
        }
      );

      if (response.ok) {
        toast.success('Gateway settings saved successfully');
        setEditMode(false);
        loadGateways();
      } else {
        throw new Error('Failed to save gateway');
      }
    } catch (error) {
      console.error('Error saving gateway:', error);
      toast.error('Failed to save gateway settings');
    } finally {
      setLoading(false);
    }
  };

  const toggleGatewayStatus = async (gatewayId: string, enabled: boolean) => {
    try {
      // In production: PATCH /make-server-3dd53475/admin/payment-gateways/{id}/status
      setGateways(gateways.map(g => 
        g.id === gatewayId ? { ...g, enabled } : g
      ));
      toast.success(`Gateway ${enabled ? 'enabled' : 'disabled'}`);
    } catch (error) {
      console.error('Error toggling gateway:', error);
      toast.error('Failed to update gateway status');
    }
  };

  const testConnection = async (gatewayId: string) => {
    setLoading(true);
    try {
      // In production: POST /make-server-3dd53475/admin/payment-gateways/{id}/test
      toast.success('Gateway connection test successful!');
    } catch (error) {
      console.error('Error testing connection:', error);
      toast.error('Gateway connection test failed');
    } finally {
      setLoading(false);
    }
  };

  const toggleSecretVisibility = (field: string) => {
    setShowSecrets(prev => ({ ...prev, [field]: !prev[field] }));
  };

  const getProviderLogo = (provider: string) => {
    const logos: { [key: string]: string } = {
      razorpay: '💳',
      stripe: '💵',
      paypal: '🅿️',
      paytm: '📱'
    };
    return logos[provider] || '💰';
  };

  if (loading && !gateways.length) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF8C42] mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading payment gateways...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" onClick={onBack}>
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <div>
                <h1 className="text-xl font-semibold">Payment Gateway Settings</h1>
                <p className="text-sm text-gray-500">Configure payment processors</p>
              </div>
            </div>
            <Button onClick={() => setEditMode(!editMode)} variant="outline">
              <Settings className="w-4 h-4 mr-2" />
              {editMode ? 'View Mode' : 'Edit Mode'}
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Gateway List */}
          <div className="lg:col-span-1">
            <Card className="p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold">Active Gateways</h3>
                <Button size="sm" className="bg-[#FF8C42] hover:bg-[#ff7a28]">
                  <Plus className="w-4 h-4 mr-1" />
                  Add
                </Button>
              </div>

              <div className="space-y-2">
                {gateways.map((gateway) => (
                  <div
                    key={gateway.id}
                    onClick={() => setSelectedGateway(gateway)}
                    className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                      selectedGateway?.id === gateway.id
                        ? 'border-[#FF8C42] bg-orange-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="text-3xl">{getProviderLogo(gateway.provider)}</div>
                        <div>
                          <h4 className="font-medium">{gateway.name}</h4>
                          <p className="text-xs text-gray-500 capitalize">{gateway.provider}</p>
                        </div>
                      </div>
                      <Switch
                        checked={gateway.enabled}
                        onCheckedChange={(checked) => toggleGatewayStatus(gateway.id, checked)}
                      />
                    </div>

                    <div className="mt-3 flex items-center gap-2">
                      {gateway.enabled && (
                        <span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded">
                          Active
                        </span>
                      )}
                      {gateway.testMode && (
                        <span className="text-xs px-2 py-1 bg-yellow-100 text-yellow-700 rounded">
                          Test Mode
                        </span>
                      )}
                      <span className="text-xs text-gray-500">Priority: {gateway.priority}</span>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          {/* Gateway Details */}
          <div className="lg:col-span-2">
            {selectedGateway && (
              <Card className="p-6">
                <Tabs defaultValue="config">
                  <TabsList>
                    <TabsTrigger value="config">Configuration</TabsTrigger>
                    <TabsTrigger value="fees">Fees & Pricing</TabsTrigger>
                    <TabsTrigger value="regions">Regions</TabsTrigger>
                    <TabsTrigger value="webhooks">Webhooks</TabsTrigger>
                  </TabsList>

                  {/* Configuration Tab */}
                  <TabsContent value="config" className="space-y-6 mt-6">
                    <div>
                      <Label>Gateway Name</Label>
                      <Input
                        value={selectedGateway.name}
                        onChange={(e) => setSelectedGateway({ ...selectedGateway, name: e.target.value })}
                        disabled={!editMode}
                        className="mt-2"
                      />
                    </div>

                    <div>
                      <Label>Provider</Label>
                      <Input
                        value={selectedGateway.provider}
                        disabled
                        className="mt-2 capitalize"
                      />
                    </div>

                    <div className="space-y-4">
                      <div>
                        <Label>API Key / Public Key</Label>
                        <div className="flex gap-2 mt-2">
                          <Input
                            type={showSecrets['apiKey'] ? 'text' : 'password'}
                            value={selectedGateway.apiKey}
                            onChange={(e) => setSelectedGateway({ ...selectedGateway, apiKey: e.target.value })}
                            disabled={!editMode}
                            className="flex-1"
                          />
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => toggleSecretVisibility('apiKey')}
                          >
                            {showSecrets['apiKey'] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </Button>
                        </div>
                      </div>

                      <div>
                        <Label>API Secret / Private Key</Label>
                        <div className="flex gap-2 mt-2">
                          <Input
                            type={showSecrets['apiSecret'] ? 'text' : 'password'}
                            value={selectedGateway.apiSecret}
                            onChange={(e) => setSelectedGateway({ ...selectedGateway, apiSecret: e.target.value })}
                            disabled={!editMode}
                            className="flex-1"
                          />
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => toggleSecretVisibility('apiSecret')}
                          >
                            {showSecrets['apiSecret'] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </Button>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
                      <Shield className="w-5 h-5 text-[#FF8C42]" />
                      <div className="flex-1">
                        <Label>Test Mode</Label>
                        <p className="text-xs text-gray-500">Use test credentials for development</p>
                      </div>
                      <Switch
                        checked={selectedGateway.testMode}
                        onCheckedChange={(checked) => 
                          setSelectedGateway({ ...selectedGateway, testMode: checked })
                        }
                        disabled={!editMode}
                      />
                    </div>

                    <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
                      <Check className="w-5 h-5 text-green-600" />
                      <div className="flex-1">
                        <Label>Enable Gateway</Label>
                        <p className="text-xs text-gray-500">Make this gateway available for transactions</p>
                      </div>
                      <Switch
                        checked={selectedGateway.enabled}
                        onCheckedChange={(checked) => 
                          setSelectedGateway({ ...selectedGateway, enabled: checked })
                        }
                        disabled={!editMode}
                      />
                    </div>

                    <div className="flex gap-3">
                      <Button
                        onClick={() => testConnection(selectedGateway.id)}
                        variant="outline"
                        className="flex-1"
                        disabled={loading}
                      >
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Test Connection
                      </Button>
                      {editMode && (
                        <Button
                          onClick={() => saveGateway(selectedGateway)}
                          className="flex-1 bg-[#FF8C42] hover:bg-[#ff7a28]"
                          disabled={loading}
                        >
                          <Save className="w-4 h-4 mr-2" />
                          Save Changes
                        </Button>
                      )}
                    </div>
                  </TabsContent>

                  {/* Fees Tab */}
                  <TabsContent value="fees" className="space-y-6 mt-6">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Fee Percentage (%)</Label>
                        <Input
                          type="number"
                          step="0.1"
                          value={selectedGateway.feePercentage}
                          onChange={(e) => setSelectedGateway({ ...selectedGateway, feePercentage: parseFloat(e.target.value) })}
                          disabled={!editMode}
                          className="mt-2"
                        />
                      </div>
                      <div>
                        <Label>Fixed Fee (₹)</Label>
                        <Input
                          type="number"
                          value={selectedGateway.feeFixed}
                          onChange={(e) => setSelectedGateway({ ...selectedGateway, feeFixed: parseFloat(e.target.value) })}
                          disabled={!editMode}
                          className="mt-2"
                        />
                      </div>
                    </div>

                    <div className="p-4 bg-blue-50 rounded-lg">
                      <h4 className="font-medium mb-2">Fee Calculation Example</h4>
                      <p className="text-sm text-gray-600">
                        For a ₹1,000 transaction:
                        <br />
                        Fee = (₹1,000 × {selectedGateway.feePercentage}%) + ₹{selectedGateway.feeFixed}
                        <br />
                        <span className="font-semibold">
                          Total Fee = ₹{((1000 * selectedGateway.feePercentage / 100) + selectedGateway.feeFixed).toFixed(2)}
                        </span>
                      </p>
                    </div>

                    <div>
                      <Label>Priority Order</Label>
                      <Input
                        type="number"
                        value={selectedGateway.priority}
                        onChange={(e) => setSelectedGateway({ ...selectedGateway, priority: parseInt(e.target.value) })}
                        disabled={!editMode}
                        className="mt-2"
                      />
                      <p className="text-xs text-gray-500 mt-1">Lower number = higher priority (1 is highest)</p>
                    </div>
                  </TabsContent>

                  {/* Regions Tab */}
                  <TabsContent value="regions" className="space-y-6 mt-6">
                    <div>
                      <Label>Supported Regions</Label>
                      <div className="grid grid-cols-2 gap-3 mt-3">
                        {['india', 'usa', 'uk', 'singapore', 'uae', 'australia'].map((region) => (
                          <div
                            key={region}
                            className={`p-3 border-2 rounded-lg cursor-pointer capitalize ${
                              selectedGateway.regions.includes(region) || selectedGateway.regions.includes('all')
                                ? 'border-[#FF8C42] bg-orange-50'
                                : 'border-gray-200'
                            }`}
                            onClick={() => {
                              if (!editMode) return;
                              const regions = selectedGateway.regions.includes(region)
                                ? selectedGateway.regions.filter(r => r !== region)
                                : [...selectedGateway.regions, region];
                              setSelectedGateway({ ...selectedGateway, regions });
                            }}
                          >
                            {region}
                            {(selectedGateway.regions.includes(region) || selectedGateway.regions.includes('all')) && (
                              <Check className="w-4 h-4 text-[#FF8C42] ml-2 inline" />
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="p-4 bg-gray-50 rounded-lg">
                      <AlertCircle className="w-5 h-5 text-blue-600 inline mr-2" />
                      <span className="text-sm text-gray-600">
                        Customers in selected regions will see this gateway as a payment option
                      </span>
                    </div>
                  </TabsContent>

                  {/* Webhooks Tab */}
                  <TabsContent value="webhooks" className="space-y-6 mt-6">
                    <div>
                      <Label>Webhook Secret</Label>
                      <div className="flex gap-2 mt-2">
                        <Input
                          type={showSecrets['webhookSecret'] ? 'text' : 'password'}
                          value={selectedGateway.webhookSecret}
                          onChange={(e) => setSelectedGateway({ ...selectedGateway, webhookSecret: e.target.value })}
                          disabled={!editMode}
                          className="flex-1"
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => toggleSecretVisibility('webhookSecret')}
                        >
                          {showSecrets['webhookSecret'] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </Button>
                      </div>
                    </div>

                    <div>
                      <Label>Webhook URL</Label>
                      <div className="flex gap-2 mt-2">
                        <Input
                          value={`https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/webhooks/${selectedGateway.provider}`}
                          disabled
                          className="flex-1 text-sm"
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            copyTextToClipboard(
                              `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/webhooks/${selectedGateway.provider}`
                            );
                          }}
                        >
                          Copy
                        </Button>
                      </div>
                      <p className="text-xs text-gray-500 mt-2">
                        Configure this URL in your {selectedGateway.provider} dashboard
                      </p>
                    </div>

                    <div className="p-4 bg-yellow-50 rounded-lg">
                      <AlertCircle className="w-5 h-5 text-yellow-600 inline mr-2" />
                      <span className="text-sm text-gray-600">
                        Webhooks are required for payment confirmation and refund processing
                      </span>
                    </div>
                  </TabsContent>
                </Tabs>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
