'use client';

import { useState, useEffect } from 'react';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
  Switch,
  Label,
  Input,
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@warmpawz/ui';
import {
  CreditCard,
  RefreshCcw,
  Settings,
  Receipt,
  Calendar,
  Percent,
  Save,
  Plus,
  Edit,
  Trash2,
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';
import { PaymentRulesSection } from '../paymentPolicies/PaymentRulesSection';
import { RefundPoliciesSection } from '../refundPolicies/RefundPoliciesSection';
import { SettlementScheduleSettings } from '../scheduleSettings/SettlementScheduleSettings';
import { PolicyHelpButton } from '@/components/PolicyHelpButton';

interface RefundRule {
  hours: number;
  refundPercent: number;
  description: string;
}

interface RefundConfig {
  enabled: boolean;
  schedule: RefundRule[];
  autoReconcile: boolean;
  reconcilePeriod: number;
}

export function AdminPaymentSettings() {
  const [activeTab, setActiveTab] = useState('general');
  const [refundConfig, setRefundConfig] = useState<RefundConfig>({
    enabled: true,
    schedule: [],
    autoReconcile: true,
    reconcilePeriod: 7,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [gateways, setGateways] = useState<any[]>([]);
  const [razorpayConfig, setRazorpayConfig] = useState({
    keyId: '',
    keySecret: '****************',
    webhookSecret: '****************',
    enabled: true,
  });
  const [showGatewayModal, setShowGatewayModal] = useState(false);
  const [editingGateway, setEditingGateway] = useState<any>(null);

  useEffect(() => {
    loadRefundRules();
    loadPaymentGatewayConfig();
    loadGateways();
  }, []);

  const loadGateways = async () => {
    try {
      const data = await apiClient.get<any>('/admin/payments/gateways');
      const raw = (data as any)?.gateways ?? (data as any)?.data?.gateways;
      setGateways(Array.isArray(raw) ? raw : []);
    } catch (error) {
      console.error('Error loading gateways:', error);
      setGateways([]);
    }
  };

  const loadRefundRules = async () => {
    setLoading(true);
    try {
      const data = await apiClient.get<any>('/admin/payments/refund-rules');
      setRefundConfig(
        (data as any).data?.rules ||
          (data as any).rules || {
            enabled: true,
            schedule: [
              {
                hours: 48,
                refundPercent: 90,
                description: 'Full refund > 48h',
              },
              {
                hours: 24,
                refundPercent: 50,
                description: 'Partial refund 24-48h',
              },
              { hours: 12, refundPercent: 0, description: 'No refund < 12h' },
            ],
            autoReconcile: true,
            reconcilePeriod: 7,
          }
      );
    } catch (error) {
      console.error('Error loading rules:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadPaymentGatewayConfig = async () => {
    try {
      const data = await apiClient.get<any>('/admin/payments/gateway-config');
      if ((data as any).data?.razorpay || (data as any).razorpay) {
        setRazorpayConfig((data as any).data?.razorpay || (data as any).razorpay);
      }
    } catch (error) {
      console.error('Error loading gateway config:', error);
    }
  };

  const handleSaveRules = async () => {
    setSaving(true);
    try {
      await apiClient.put('/admin/payments/refund-rules', refundConfig);
      toast.success('Refund rules updated successfully');
    } catch (error) {
      toast.error('Error saving rules');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveGatewayConfig = async () => {
    setSaving(true);
    try {
      await apiClient.put('/admin/payments/gateway-config', { razorpay: razorpayConfig });
      toast.success('Payment gateway configuration saved');
    } catch (error) {
      toast.error('Error saving gateway configuration');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateGateway = () => {
    setEditingGateway({
      name: '',
      type: 'razorpay',
      keyId: '',
      keySecret: '',
      webhookSecret: '',
      enabled: true,
    });
    setShowGatewayModal(true);
  };

  const handleSaveGateway = async () => {
    if (!editingGateway?.name || !editingGateway?.keyId) {
      toast.error('Please fill all required fields');
      return;
    }

    setSaving(true);
    try {
      if (editingGateway.id) {
        await apiClient.put(`/admin/payments/gateways/${editingGateway.id}`, editingGateway);
        toast.success('Gateway updated successfully');
      } else {
        await apiClient.post('/admin/payments/gateways', editingGateway);
        toast.success('Gateway created successfully');
      }
      await loadGateways();
      setShowGatewayModal(false);
      setEditingGateway(null);
    } catch (error: any) {
      toast.error(error.message || 'Failed to save gateway');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteGateway = async (gatewayId: string) => {
    if (!confirm('Are you sure you want to delete this payment gateway? This action cannot be undone.')) {
      return;
    }

    try {
      await apiClient.delete(`/admin/payments/gateways/${gatewayId}`);
      toast.success('Gateway deleted successfully');
      await loadGateways();
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete gateway');
    }
  };

  const updateRule = (index: number, field: keyof RefundRule, value: any) => {
    const newSchedule = [...refundConfig.schedule];
    newSchedule[index] = { ...newSchedule[index], [field]: value };
    setRefundConfig({ ...refundConfig, schedule: newSchedule });
  };

  return (
    <div className="space-y-6 w-full max-w-full">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Payment & Refund Settings</h2>
            <p className="text-sm text-slate-500">
              Configure gateways, payment rules, and refund policies
            </p>
          </div>
          <PolicyHelpButton docKey="finance-payment-gateway" />
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="gateway">Gateway</TabsTrigger>
          <TabsTrigger value="payment-rules">Payment Rules</TabsTrigger>
          <TabsTrigger value="refund-policies">Refund Policies</TabsTrigger>
          <TabsTrigger value="schedule">Schedule</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>General Payment Settings</CardTitle>
              <CardDescription>Configure general payment and refund settings</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Enable Refunds</Label>
                  <p className="text-sm text-gray-500">Allow customers to request refunds</p>
                </div>
                <Switch
                  checked={refundConfig.enabled}
                  onCheckedChange={(checked: boolean) =>
                    setRefundConfig({ ...refundConfig, enabled: checked })
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label>Auto Reconcile</Label>
                  <p className="text-sm text-gray-500">
                    Automatically reconcile refunds after period
                  </p>
                </div>
                <Switch
                  checked={refundConfig.autoReconcile}
                  onCheckedChange={(checked: boolean) =>
                    setRefundConfig({ ...refundConfig, autoReconcile: checked })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label>Reconcile Period (days)</Label>
                <Input
                  type="number"
                  value={refundConfig.reconcilePeriod}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setRefundConfig({
                      ...refundConfig,
                      reconcilePeriod: parseInt(e.target.value),
                    })
                  }
                />
              </div>

              <Button
                onClick={handleSaveRules}
                disabled={saving}
                className="bg-[#FF8C42] text-white hover:bg-[#E67A32]"
              >
                <Save className="w-4 h-4 mr-2" />
                {saving ? 'Saving...' : 'Save Settings'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="gateway" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Payment Gateways</CardTitle>
                  <CardDescription>Manage payment gateway configurations</CardDescription>
                </div>
                <Button
                  onClick={handleCreateGateway}
                  className="bg-[#FF8C42] text-white hover:bg-[#E67A32]"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Gateway
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Gateways List */}
              {(Array.isArray(gateways) ? gateways : []).length > 0 ? (
                <div className="space-y-4">
                  {(Array.isArray(gateways) ? gateways : []).filter(Boolean).map((gateway, idx) => (
                    <div
                      key={gateway?.id ?? `gateway-${idx}`}
                      className="border border-gray-200 rounded-lg p-4 flex items-center justify-between"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <h4 className="font-semibold">{gateway.name || gateway.type}</h4>
                          <span
                            className={`px-2 py-1 rounded-full text-xs ${
                              gateway.enabled
                                ? 'bg-green-100 text-green-700'
                                : 'bg-gray-100 text-gray-700'
                            }`}
                          >
                            {gateway.enabled ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                        <p className="text-sm text-gray-500 mt-1">
                          Type: {gateway?.type ?? '-'} • Key ID: {gateway?.keyId ? `${String(gateway.keyId).substring(0, 8)}...` : 'Not set'}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setEditingGateway(gateway);
                            setShowGatewayModal(true);
                          }}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-600 hover:text-red-700"
                          onClick={() => gateway?.id && handleDeleteGateway(gateway.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <p>No payment gateways configured</p>
                  <Button
                    onClick={handleCreateGateway}
                    variant="outline"
                    className="mt-4"
                  >
                    Add First Gateway
                  </Button>
                </div>
              )}

              {/* Legacy Razorpay Config (for backward compatibility) */}
              <div className="border-t pt-6 mt-6">
                <h3 className="font-semibold mb-4">Legacy Razorpay Configuration</h3>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Razorpay Key ID</Label>
                    <Input
                      value={razorpayConfig.keyId}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setRazorpayConfig({ ...razorpayConfig, keyId: e.target.value })
                      }
                      placeholder="rzp_test_..."
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Razorpay Key Secret</Label>
                    <Input
                      type="password"
                      value={razorpayConfig.keySecret}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setRazorpayConfig({ ...razorpayConfig, keySecret: e.target.value })
                      }
                      placeholder="Enter key secret"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Webhook Secret</Label>
                    <Input
                      type="password"
                      value={razorpayConfig.webhookSecret}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setRazorpayConfig({ ...razorpayConfig, webhookSecret: e.target.value })
                      }
                      placeholder="Enter webhook secret"
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <Label>Enable Razorpay</Label>
                    <Switch
                      checked={razorpayConfig.enabled}
                      onCheckedChange={(checked: boolean) =>
                        setRazorpayConfig({ ...razorpayConfig, enabled: checked })
                      }
                    />
                  </div>

                  <Button
                    onClick={handleSaveGatewayConfig}
                    disabled={saving}
                    className="bg-[#FF8C42] text-white hover:bg-[#E67A32]"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    {saving ? 'Saving...' : 'Save Gateway Config'}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payment-rules">
          <PaymentRulesSection />
        </TabsContent>

        <TabsContent value="refund-policies">
          <RefundPoliciesSection />
        </TabsContent>

        <TabsContent value="schedule">
          <SettlementScheduleSettings />
        </TabsContent>
      </Tabs>

      {/* Gateway Create/Edit Modal */}
      {showGatewayModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b sticky top-0 bg-white z-10">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold text-gray-900">
                  {editingGateway?.id ? 'Edit Gateway' : 'Add Payment Gateway'}
                </h3>
                <button
                  onClick={() => {
                    setShowGatewayModal(false);
                    setEditingGateway(null);
                  }}
                  className="text-gray-400 hover:text-gray-600 text-2xl"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <Label>Gateway Name *</Label>
                <Input
                  value={editingGateway?.name || ''}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setEditingGateway({ ...editingGateway, name: e.target.value })
                  }
                  placeholder="e.g., Razorpay Production"
                />
              </div>

              <div>
                <Label>Gateway Type *</Label>
                <select
                  value={editingGateway?.type || 'razorpay'}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                    setEditingGateway({ ...editingGateway, type: e.target.value })
                  }
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:border-orange-500 outline-none"
                >
                  <option value="razorpay">Razorpay</option>
                  <option value="stripe">Stripe</option>
                  <option value="paypal">PayPal</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <Label>Key ID *</Label>
                <Input
                  value={editingGateway?.keyId || ''}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setEditingGateway({ ...editingGateway, keyId: e.target.value })
                  }
                  placeholder="rzp_test_..."
                />
              </div>

              <div>
                <Label>Key Secret *</Label>
                <Input
                  type="password"
                  value={editingGateway?.keySecret || ''}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setEditingGateway({ ...editingGateway, keySecret: e.target.value })
                  }
                  placeholder="Enter key secret"
                />
              </div>

              <div>
                <Label>Webhook Secret</Label>
                <Input
                  type="password"
                  value={editingGateway?.webhookSecret || ''}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setEditingGateway({ ...editingGateway, webhookSecret: e.target.value })
                  }
                  placeholder="Enter webhook secret"
                />
              </div>

              <div className="flex items-center justify-between">
                <Label>Enable Gateway</Label>
                <Switch
                  checked={editingGateway?.enabled ?? true}
                  onCheckedChange={(checked: boolean) =>
                    setEditingGateway({ ...editingGateway, enabled: checked })
                  }
                />
              </div>
            </div>

            <div className="p-6 border-t bg-gray-50 flex justify-end gap-3 rounded-b-2xl">
              <Button
                onClick={() => {
                  setShowGatewayModal(false);
                  setEditingGateway(null);
                }}
                variant="outline"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSaveGateway}
                disabled={saving}
                className="bg-[#FF8C42] text-white hover:bg-[#E67A32]"
              >
                <Save className="w-4 h-4 mr-2" />
                {saving ? 'Saving...' : editingGateway?.id ? 'Update Gateway' : 'Create Gateway'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
