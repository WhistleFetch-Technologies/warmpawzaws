import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '../../ui/card';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Switch } from '../../ui/switch';
import { Separator } from '../../ui/separator';
import { 
  CreditCard, RefreshCcw, ShieldCheck, AlertCircle, Save, CheckCircle2 
} from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { projectId, publicAnonKey } from '../../../utils/supabase/info';

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
  const [refundConfig, setRefundConfig] = useState<RefundConfig>({
    enabled: true,
    schedule: [],
    autoReconcile: true,
    reconcilePeriod: 7
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [razorpayConfig, setRazorpayConfig] = useState({
    keyId: 'rzp_test_123456789',
    keySecret: '****************',
    webhookSecret: '****************',
    enabled: true
  });

  const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475`;

  useEffect(() => {
    loadRefundRules();
  }, []);

  const loadRefundRules = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/admin/payments/refund-rules`, {
        headers: { 'Authorization': `Bearer ${publicAnonKey}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        setRefundConfig(data.rules || {
          enabled: true,
          schedule: [
            { hours: 48, refundPercent: 90, description: 'Full refund > 48h' },
            { hours: 24, refundPercent: 50, description: 'Partial refund 24-48h' },
            { hours: 12, refundPercent: 0, description: 'No refund < 12h' }
          ],
          autoReconcile: true,
          reconcilePeriod: 7
        });
      }
    } catch (error) {
      console.error('Error loading rules:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveRules = async () => {
    setSaving(true);
    try {
      const response = await fetch(`${API_BASE}/admin/payments/refund-rules`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${publicAnonKey}`
        },
        body: JSON.stringify(refundConfig)
      });

      if (response.ok) {
        toast.success('Refund rules updated successfully');
      } else {
        toast.error('Failed to update refund rules');
      }
    } catch (error) {
      toast.error('Error saving rules');
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
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">Payment Settings</h2>
        <p className="text-sm text-slate-500">Configure gateway integration and refund policies</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Gateway Configuration */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <div className="p-2 bg-blue-100 rounded-lg">
                <CreditCard className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <CardTitle className="text-lg">Gateway Configuration</CardTitle>
                <CardDescription>Razorpay Marketplace Integration</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${razorpayConfig.enabled ? 'bg-green-500' : 'bg-slate-300'}`}></div>
                <span className="font-medium">Status</span>
              </div>
              <Badge variant={razorpayConfig.enabled ? 'default' : 'secondary'} className={razorpayConfig.enabled ? 'bg-green-100 text-green-700 hover:bg-green-200' : ''}>
                {razorpayConfig.enabled ? 'Active' : 'Disabled'}
              </Badge>
            </div>

            <div className="space-y-2">
              <Label>API Key ID</Label>
              <Input value={razorpayConfig.keyId} readOnly className="bg-slate-50 font-mono" />
            </div>
            
            <div className="space-y-2">
              <Label>Key Secret</Label>
              <Input type="password" value={razorpayConfig.keySecret} readOnly className="bg-slate-50 font-mono" />
            </div>

            <div className="space-y-2">
              <Label>Webhook Secret</Label>
              <Input type="password" value={razorpayConfig.webhookSecret} readOnly className="bg-slate-50 font-mono" />
            </div>

            <div className="pt-2">
              <Button variant="outline" className="w-full" onClick={() => toast.info('Gateway configuration is managed via Environment Variables')}>
                Edit Configuration
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Refund Rules */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <div className="p-2 bg-orange-100 rounded-lg">
                <RefreshCcw className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <CardTitle className="text-lg">Refund & Reconciliation</CardTitle>
                <CardDescription>Automated refund policies</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Enable Automated Refunds</Label>
                <p className="text-xs text-slate-500">Process refunds based on cancellation time</p>
              </div>
              <Switch 
                checked={refundConfig.enabled}
                onCheckedChange={(c) => setRefundConfig({...refundConfig, enabled: c})}
              />
            </div>

            <Separator />

            <div className="space-y-4">
              <Label>Refund Schedule</Label>
              {refundConfig.schedule.map((rule, index) => (
                <div key={index} className="grid grid-cols-12 gap-2 items-center bg-slate-50 p-2 rounded-md border">
                  <div className="col-span-3">
                    <div className="relative">
                      <Input 
                        type="number" 
                        value={rule.hours}
                        onChange={(e) => updateRule(index, 'hours', parseInt(e.target.value))}
                        className="h-8 text-xs"
                      />
                      <span className="absolute right-2 top-2 text-[10px] text-slate-400">Hrs</span>
                    </div>
                  </div>
                  <div className="col-span-3">
                    <div className="relative">
                      <Input 
                        type="number" 
                        value={rule.refundPercent}
                        onChange={(e) => updateRule(index, 'refundPercent', parseInt(e.target.value))}
                        className="h-8 text-xs"
                      />
                      <span className="absolute right-2 top-2 text-[10px] text-slate-400">%</span>
                    </div>
                  </div>
                  <div className="col-span-6">
                    <Input 
                      value={rule.description}
                      onChange={(e) => updateRule(index, 'description', e.target.value)}
                      className="h-8 text-xs"
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between pt-2">
              <div className="space-y-0.5">
                <Label>Auto Reconciliation</Label>
                <p className="text-xs text-slate-500">Reconcile payments every {refundConfig.reconcilePeriod} days</p>
              </div>
              <Switch 
                checked={refundConfig.autoReconcile}
                onCheckedChange={(c) => setRefundConfig({...refundConfig, autoReconcile: c})}
              />
            </div>

            <Button onClick={handleSaveRules} disabled={saving || loading} className="w-full bg-[#FF8C42] hover:bg-[#FF7A2E]">
              {saving ? 'Saving...' : 'Save Refund Rules'}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
