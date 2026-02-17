'use client';

import { useState, useEffect } from 'react';
import {
  Settings,
  Percent,
  CheckCircle,
  Save,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  Button,
  Input,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@warmpawz/ui';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';

interface RefundPolicy {
  enabledCategories: string[];
  defaultRefundWindow: number; // days
  autoApprovalThreshold: number; // amount
  partialRefundEnabled: boolean;
  restockingFeePercentage: number;
}

interface PaymentPolicy {
  enabledMethods: string[];
  minOrderAmount: number;
  maxOrderAmount: number;
  walletEnabled: boolean;
  codEnabled: boolean;
  codCharges: number;
}

interface CommissionPolicy {
  defaultPercentage: number;
  categoryWiseRates: Record<string, number>;
  tieredRates: Array<{ min: number; max: number; rate: number }>;
}

interface VerificationPolicy {
  requireGST: boolean;
  requirePAN: boolean;
  requireBankDetails: boolean;
  requireBusinessProof: boolean;
  autoApprove: boolean;
  verificationDays: number;
}

export function PolicyManagement() {
  const [activeTab, setActiveTab] = useState('commission');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Policy states
  const [refundPolicy, setRefundPolicy] = useState<RefundPolicy>({
    enabledCategories: ['electronics', 'clothing', 'toys'],
    defaultRefundWindow: 7,
    autoApprovalThreshold: 500,
    partialRefundEnabled: true,
    restockingFeePercentage: 10,
  });

  const [paymentPolicy, setPaymentPolicy] = useState<PaymentPolicy>({
    enabledMethods: ['razorpay', 'wallet', 'cod'],
    minOrderAmount: 50,
    maxOrderAmount: 100000,
    walletEnabled: true,
    codEnabled: true,
    codCharges: 50,
  });

  const [commissionPolicy, setCommissionPolicy] = useState<CommissionPolicy>({
    defaultPercentage: 15,
    categoryWiseRates: {
      food: 12,
      toys: 15,
      healthcare: 10,
      accessories: 18,
    },
    tieredRates: [
      { min: 0, max: 1000, rate: 20 },
      { min: 1001, max: 5000, rate: 15 },
      { min: 5001, max: 999999, rate: 12 },
    ],
  });

  const [verificationPolicy, setVerificationPolicy] = useState<VerificationPolicy>({
    requireGST: true,
    requirePAN: true,
    requireBankDetails: true,
    requireBusinessProof: true,
    autoApprove: false,
    verificationDays: 3,
  });

  useEffect(() => {
    fetchPolicies();
  }, []);

  const fetchPolicies = async () => {
    setLoading(true);
    try {
      const policies = await apiClient.get<any>('/admin/policies');
      const data = (policies as any).data || policies;
      if (data.refund) setRefundPolicy(data.refund);
      if (data.payment) setPaymentPolicy(data.payment);
      if (data.commission) setCommissionPolicy(data.commission);
      if (data.verification) setVerificationPolicy(data.verification);
    } catch (err: any) {
      console.error('Error fetching policies:', err);
      // Use default values if API fails
    } finally {
      setLoading(false);
    }
  };

  const savePolicy = async (type: string, data: any) => {
    setSaving(true);
    try {
      await apiClient.put(`/admin/policies/${type}`, data);
      toast.success(`${type.charAt(0).toUpperCase() + type.slice(1)} policy saved successfully!`);
    } catch (err: any) {
      console.error('Error saving policy:', err);
      toast.error(err.message || `Failed to save ${type} policy`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-black text-xl font-semibold">Policy Management</h2>
        <p className="text-gray-500 text-sm mt-1">Configure marketplace policies and rules</p>
      </div>

      {/* Policy Tabs (Refund and Payment managed in Finance) */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="commission" className="gap-2">
            <Percent className="w-4 h-4" />
            Commission
          </TabsTrigger>
          <TabsTrigger value="verification" className="gap-2">
            <CheckCircle className="w-4 h-4" />
            Verification
          </TabsTrigger>
        </TabsList>

        {/* Commission Policy */}
        <TabsContent value="commission" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Commission Policy Configuration</CardTitle>
              <CardDescription>Configure commission rates and tiers</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <label htmlFor="default-commission" className="text-sm font-medium">
                  Default Commission Rate (%)
                </label>
                <Input
                  id="default-commission"
                  type="number"
                  value={commissionPolicy.defaultPercentage}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setCommissionPolicy({
                      ...commissionPolicy,
                      defaultPercentage: parseInt(e.target.value),
                    })
                  }
                />
                <p className="text-sm text-gray-500">Default rate for all categories</p>
              </div>

              <div className="space-y-3">
                <label className="text-sm font-medium">Category-wise Rates (%)</label>
                <div className="grid grid-cols-2 gap-4">
                  {Object.entries(commissionPolicy.categoryWiseRates).map(([category, rate]) => (
                    <div key={category} className="flex items-center gap-3">
                      <label className="flex-1 capitalize text-sm">{category}</label>
                      <Input
                        type="number"
                        value={rate}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          setCommissionPolicy({
                            ...commissionPolicy,
                            categoryWiseRates: {
                              ...commissionPolicy.categoryWiseRates,
                              [category]: parseInt(e.target.value),
                            },
                          })
                        }
                        className="w-24"
                      />
                      <span className="text-sm text-gray-600">%</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-sm font-medium">Tiered Rates</label>
                <div className="space-y-2">
                  {commissionPolicy.tieredRates.map((tier, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-3 bg-gray-50 p-3 rounded-lg"
                    >
                      <span className="text-sm">
                        ₹{tier.min} - ₹{tier.max}
                      </span>
                      <Input
                        type="number"
                        value={tier.rate}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                          const newRates = [...commissionPolicy.tieredRates];
                          newRates[index].rate = parseInt(e.target.value);
                          setCommissionPolicy({
                            ...commissionPolicy,
                            tieredRates: newRates,
                          });
                        }}
                        className="w-24"
                      />
                      <span className="text-sm">%</span>
                    </div>
                  ))}
                </div>
              </div>

              <Button
                onClick={() => savePolicy('commission', commissionPolicy)}
                disabled={saving}
                className="bg-[#FF8C42] hover:bg-[#FF7029]"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Save className="w-4 h-4 mr-2" />
                )}
                Save Commission Policy
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Verification Policy */}
        <TabsContent value="verification" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Seller Verification Policy</CardTitle>
              <CardDescription>Configure seller verification requirements</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                <label className="text-sm font-medium">Required Documents</label>
                <div className="space-y-2">
                  {[
                    { key: 'requireGST', label: 'GST Certificate' },
                    { key: 'requirePAN', label: 'PAN Card' },
                    { key: 'requireBankDetails', label: 'Bank Account Details' },
                    { key: 'requireBusinessProof', label: 'Business Proof' },
                  ].map(({ key, label }) => (
                    <div key={key} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={
                          verificationPolicy[key as keyof VerificationPolicy] as boolean
                        }
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          setVerificationPolicy({
                            ...verificationPolicy,
                            [key]: e.target.checked,
                          })
                        }
                        className="w-4 h-4"
                      />
                      <span className="text-sm">{label}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label htmlFor="verification-days" className="text-sm font-medium">
                    Verification Period (days)
                  </label>
                  <Input
                    id="verification-days"
                    type="number"
                    value={verificationPolicy.verificationDays}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setVerificationPolicy({
                        ...verificationPolicy,
                        verificationDays: parseInt(e.target.value),
                      })
                    }
                  />
                  <p className="text-sm text-gray-500">Maximum days to complete verification</p>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Auto-approval</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={verificationPolicy.autoApprove}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setVerificationPolicy({
                          ...verificationPolicy,
                          autoApprove: e.target.checked,
                        })
                      }
                      className="w-4 h-4"
                    />
                    <span className="text-sm">Auto-approve after verification period</span>
                  </div>
                </div>
              </div>

              <Button
                onClick={() => savePolicy('verification', verificationPolicy)}
                disabled={saving}
                className="bg-[#FF8C42] hover:bg-[#FF7029]"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Save className="w-4 h-4 mr-2" />
                )}
                Save Verification Policy
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
