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
} from '@warmpawz/ui';
import {
  CreditCard,
  RefreshCcw,
  Settings,
  Receipt,
  Calendar,
  Percent,
  Save,
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';
import { PaymentRulesSection } from '../paymentPolicies/PaymentRulesSection';
import { RefundPoliciesSection } from '../refundPolicies/RefundPoliciesSection';
import { SettlementScheduleSettings } from '../scheduleSettings/SettlementScheduleSettings';

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

  const [razorpayConfig, setRazorpayConfig] = useState({
    keyId: '',
    keySecret: '****************',
    webhookSecret: '****************',
    enabled: true,
  });

  useEffect(() => {
    loadRefundRules();
    loadPaymentGatewayConfig();
  }, []);

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

  const updateRule = (index: number, field: keyof RefundRule, value: any) => {
    const newSchedule = [...refundConfig.schedule];
    newSchedule[index] = { ...newSchedule[index], [field]: value };
    setRefundConfig({ ...refundConfig, schedule: newSchedule });
  };

  return (
    <div className="space-y-6 w-full max-w-full">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Payment & Refund Settings</h2>
          <p className="text-sm text-slate-500">
            Configure gateways, payment rules, and refund policies
          </p>
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
                  onCheckedChange={(checked) =>
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
                  onCheckedChange={(checked) =>
                    setRefundConfig({ ...refundConfig, autoReconcile: checked })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label>Reconcile Period (days)</Label>
                <Input
                  type="number"
                  value={refundConfig.reconcilePeriod}
                  onChange={(e) =>
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
              <CardTitle>Payment Gateway Configuration</CardTitle>
              <CardDescription>Configure Razorpay and other payment gateways</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label>Razorpay Key ID</Label>
                <Input
                  value={razorpayConfig.keyId}
                  onChange={(e) =>
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
                  onChange={(e) =>
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
                  onChange={(e) =>
                    setRazorpayConfig({ ...razorpayConfig, webhookSecret: e.target.value })
                  }
                  placeholder="Enter webhook secret"
                />
              </div>

              <div className="flex items-center justify-between">
                <Label>Enable Razorpay</Label>
                <Switch
                  checked={razorpayConfig.enabled}
                  onCheckedChange={(checked) =>
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
    </div>
  );
}
