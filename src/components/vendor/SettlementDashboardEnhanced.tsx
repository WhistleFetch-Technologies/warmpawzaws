import React, { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Badge } from '../ui/badge';
import { toast } from 'sonner';
import { TrendingUp, DollarSign, Crown, ArrowUpRight, Building2, CheckCircle2, AlertCircle } from 'lucide-react';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import { settlementTierSystemApi } from '../../utils/api/client';

interface VendorTier {
  id: string;
  name: string;
  commissionRate: number;
  payoutFrequency: string;
  features: string[];
}

interface DashboardStats {
  currentTier: VendorTier;
  nextTier: VendorTier | null;
  stats: {
    totalEarnings: number;
    pendingSettlement: number;
    completedSettlements: number;
    lastPayout: string | null;
  };
}

export function SettlementDashboardEnhanced({ vendorId }: { vendorId: string }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DashboardStats | null>(null);
  const [processingPayout, setProcessingPayout] = useState(false);

  useEffect(() => {
    loadData();
  }, [vendorId]);

  const loadData = async () => {
    try {
      setLoading(true);
      
      const { apiCallJson } = await import('@warmpawz/api-client/http');
      const API_GATEWAY_URL = process.env.NEXT_PUBLIC_API_GATEWAY_URL || '';
      if (!API_GATEWAY_URL) {
        throw new Error('API Gateway URL not configured');
      }
      
      const resData = await apiCallJson<any>(
        `${API_GATEWAY_URL}/make-server-3dd53475/vendor/tier/${vendorId}`
      );
      
      if (resData.success) {
        setData(resData);
      } else {
        throw new Error(resData.error || resData.message || 'Failed to load data');
      }
    } catch (error: any) {
      console.error(error);
      toast.error(error?.message || 'Failed to load settlement data');
    } finally {
      setLoading(false);
    }
  };

  const handleRequestPayout = async () => {
    if (!data || data.stats.pendingSettlement <= 0) return;

    try {
        setProcessingPayout(true);
        // ✅ Updated: Use API client instead of direct fetch
        const result = await settlementTierSystemApi.processSettlement(vendorId, data.stats.pendingSettlement);
        if (result.success) {
            toast.success('Payout processed successfully!');
            loadData();
        } else {
            toast.error(result.error || 'Payout failed');
        }
    } catch (error) {
        toast.error('Error processing payout');
    } finally {
        setProcessingPayout(false);
    }
  };

  const handleUpgrade = async (targetTierId: string) => {
      try {
          // ✅ Updated: Use API client instead of direct fetch
          const result = await settlementTierSystemApi.upgradeVendorTier(vendorId, targetTierId);
          if (result.success) {
              toast.success('Tier upgraded successfully!');
              loadData();
          } else {
              toast.error(result.error || 'Upgrade failed');
          }
      } catch (error) {
          toast.error('Error upgrading tier');
      }
  };

  if (loading) return <div className="p-8 text-center">Loading financial dashboard...</div>;
  if (!data) return <div className="p-8 text-center text-red-500">Failed to load data</div>;

  const isBasic = data.currentTier.id === 'basic';
  const isPremium = data.currentTier.id === 'premium';
  const isEnterprise = data.currentTier.id === 'enterprise';

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      <div className="flex justify-between items-center">
        <div>
            <h1 className="text-2xl font-bold text-gray-900">Financial Overview</h1>
            <p className="text-gray-500">Manage earnings, payouts, and commission tiers.</p>
        </div>
        <div className="flex items-center gap-2 bg-blue-50 px-4 py-2 rounded-full border border-blue-100">
            <Building2 className="w-4 h-4 text-blue-600" />
            <span className="text-sm font-medium text-blue-800">Bank Account Verified</span>
            <CheckCircle2 className="w-4 h-4 text-green-500 ml-1" />
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-gradient-to-br from-green-50 to-white border-green-200">
            <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-green-800">Available for Payout</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="text-3xl font-bold text-green-900">₹{data.stats.pendingSettlement.toLocaleString()}</div>
                <Button 
                    onClick={handleRequestPayout} 
                    disabled={data.stats.pendingSettlement <= 0 || processingPayout}
                    className="w-full mt-4 bg-green-600 hover:bg-green-700"
                >
                    {processingPayout ? 'Processing...' : 'Request Payout'}
                </Button>
                <p className="text-xs text-green-600 mt-2 text-center">
                    Frequency: <span className="font-semibold capitalize">{data.currentTier.payoutFrequency}</span>
                </p>
            </CardContent>
        </Card>

        <Card>
            <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-500">Total Earnings</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="text-3xl font-bold text-gray-900">₹{data.stats.totalEarnings.toLocaleString()}</div>
                <div className="flex items-center text-sm text-green-600 mt-1">
                    <TrendingUp className="w-4 h-4 mr-1" />
                    <span>Lifetime Gross Revenue</span>
                </div>
            </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-white border-purple-200">
            <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-purple-800">Current Tier Plan</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="flex justify-between items-center mb-2">
                    <Badge className="bg-purple-100 text-purple-800 border-purple-200 text-lg px-3 py-1 capitalize">
                        {data.currentTier.name}
                    </Badge>
                    <Crown className="w-8 h-8 text-purple-300" />
                </div>
                <div className="space-y-1 text-sm text-purple-700">
                    <div className="flex justify-between">
                        <span>Commission:</span>
                        <span className="font-bold">{data.currentTier.commissionRate}%</span>
                    </div>
                    <div className="flex justify-between">
                        <span>Payouts:</span>
                        <span className="font-bold capitalize">{data.currentTier.payoutFrequency}</span>
                    </div>
                </div>
            </CardContent>
        </Card>
      </div>

      {/* Tier Upgrade Section */}
      {data.nextTier && (
          <div>
              <h2 className="text-xl font-bold text-gray-900 mb-4">Upgrade Your Plan</h2>
              <Card className="border-2 border-orange-100 overflow-hidden">
                  <div className="bg-orange-50 p-6 flex flex-col md:flex-row justify-between items-center gap-6">
                      <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                              <Crown className="w-6 h-6 text-orange-600" />
                              <h3 className="text-lg font-bold text-gray-900">
                                  Upgrade to {data.nextTier.name.toUpperCase()}
                              </h3>
                              <Badge className="bg-orange-200 text-orange-800">Recommended</Badge>
                          </div>
                          <p className="text-gray-600 mb-4">
                              Reduce your commission rate to <strong>{data.nextTier.commissionRate}%</strong> and get <strong>{data.nextTier.payoutFrequency} payouts</strong>.
                          </p>
                          <div className="grid grid-cols-2 gap-2">
                              {data.nextTier.features.map(f => (
                                  <div key={f} className="flex items-center gap-2 text-sm text-gray-700">
                                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                                      {f}
                                  </div>
                              ))}
                          </div>
                      </div>
                      <div className="text-center md:text-right">
                          <p className="text-sm text-gray-500 mb-2">Save on every booking</p>
                          <Button 
                            onClick={() => handleUpgrade(data.nextTier!.id)}
                            className="bg-orange-600 hover:bg-orange-700 px-8 py-6 text-lg"
                          >
                              Upgrade Now <ArrowUpRight className="w-5 h-5 ml-2" />
                          </Button>
                      </div>
                  </div>
              </Card>
          </div>
      )}

      {/* Recent Payouts Table (Mock) */}
      <Card>
          <CardHeader>
              <CardTitle>Recent Payouts</CardTitle>
              <CardDescription>History of settlements to your bank account</CardDescription>
          </CardHeader>
          <CardContent>
              {data.stats.completedSettlements > 0 ? (
                  <div className="space-y-4">
                      {/* Mock list */}
                      <div className="flex items-center justify-between p-4 border rounded-lg bg-gray-50">
                          <div className="flex items-center gap-3">
                              <div className="p-2 bg-green-100 rounded-full">
                                  <ArrowUpRight className="w-5 h-5 text-green-600" />
                              </div>
                              <div>
                                  <p className="font-medium text-gray-900">Weekly Settlement</p>
                                  <p className="text-xs text-gray-500">{data.stats.lastPayout ? new Date(data.stats.lastPayout).toLocaleDateString() : 'Recent'}</p>
                              </div>
                          </div>
                          <div className="text-right">
                              <p className="font-bold text-gray-900">₹{data.stats.completedSettlements.toLocaleString()}</p>
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                                  Processed
                              </span>
                          </div>
                      </div>
                  </div>
              ) : (
                  <div className="text-center py-8 text-gray-500">No payout history available</div>
              )}
          </CardContent>
      </Card>
    </div>
  );
}
