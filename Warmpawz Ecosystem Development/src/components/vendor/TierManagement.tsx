import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Progress } from '../ui/progress';
import { 
  Crown, TrendingUp, Shield, Zap, CheckCircle, 
  ArrowUpCircle, Award, DollarSign, Info 
} from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { getApiBaseUrl, getAuthHeaders } from '../../utils/api-config';

interface VendorTierData {
  currentTier: 'SILVER' | 'GOLD' | 'PLATINUM';
  totalGMV: number;
  commissionRate: number;
  nextTier?: string;
  gmvRequiredForNext?: number;
  benefits: string[];
}

interface TierConfig {
  id: string;
  name: string;
  commissionRate: number;
  minGMV: number;
  benefits: string[];
}

export function TierManagement({ vendorId }: { vendorId: string }) {
  const [data, setData] = useState<VendorTierData | null>(null);
  const [configs, setConfigs] = useState<Record<string, TierConfig> | null>(null);
  const [loading, setLoading] = useState(true);
  const [upgrading, setUpgrading] = useState(false);

  useEffect(() => {
    loadTierData();
  }, [vendorId]);

  const loadTierData = async () => {
    try {
      setLoading(true);
      
      const response = await fetch(
        `${getApiBaseUrl()}/vendor/${vendorId}/tier`,
        { headers: getAuthHeaders() }
      );

      if (response.ok) {
        const result = await response.json();
        
        // Transform API response to UI model
        // Assuming API returns { currentTier, totalGMV, config: { ... } }
        const currentTierKey = result.currentTier || 'SILVER';
        const currentConfig = result.config; // Configuration of current tier

        // Mock getting full configs if not returned (in real app, fetch /admin/tier-system/config)
        // Here we can infer next tier requirements
        let nextTierKey = '';
        let nextTierGMV = 0;
        
        if (currentTierKey === 'SILVER') {
            nextTierKey = 'GOLD';
            nextTierGMV = 50000;
        } else if (currentTierKey === 'GOLD') {
            nextTierKey = 'PLATINUM';
            nextTierGMV = 200000;
        }

        setData({
            currentTier: currentTierKey,
            totalGMV: result.totalGMV || 0,
            commissionRate: currentConfig?.commissionRate || 15,
            benefits: currentConfig?.benefits || [],
            nextTier: nextTierKey,
            gmvRequiredForNext: nextTierGMV
        });

      } else {
        toast.error('Failed to load tier data');
      }
    } catch (error) {
      console.error(error);
      toast.error('Error loading tier info');
    } finally {
      setLoading(false);
    }
  };

  const handleRecalculate = async () => {
      try {
          setUpgrading(true);
          const response = await fetch(
            `${getApiBaseUrl()}/vendor/${vendorId}/tier/calculate`,
            {
                method: 'POST',
                headers: getAuthHeaders()
            }
          );
          if (response.ok) {
              const res = await response.json();
              toast.success(res.message || 'Tier recalculated');
              loadTierData(); // Refresh
          } else {
              toast.error('Recalculation failed');
          }
      } catch (e) {
          toast.error('Error upgrading');
      } finally {
          setUpgrading(false);
      }
  };

  if (loading) return <div className="p-8 text-center">Loading tier status...</div>;
  if (!data) return <div className="p-8 text-center text-red-500">Failed to load tier information</div>;

  const progress = data.nextTier 
    ? Math.min(100, (data.totalGMV / (data.gmvRequiredForNext || 1)) * 100)
    : 100;

  const TierBadge = ({ tier }: { tier: string }) => {
      const colors = {
          SILVER: 'bg-gray-100 text-gray-700 border-gray-300',
          GOLD: 'bg-yellow-100 text-yellow-800 border-yellow-300',
          PLATINUM: 'bg-purple-100 text-purple-800 border-purple-300'
      };
      return (
          <span className={`px-3 py-1 rounded-full text-xs font-bold border ${colors[tier as keyof typeof colors] || colors.SILVER}`}>
              {tier}
          </span>
      );
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                Vendor Tier Status <Crown className="w-6 h-6 text-yellow-500" />
            </h1>
            <p className="text-gray-500">Manage your commission rates and benefits</p>
        </div>
        <Button onClick={handleRecalculate} disabled={upgrading}>
            {upgrading ? 'Checking Eligibility...' : 'Check for Upgrade'}
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Current Status Card */}
          <Card className="col-span-2 bg-gradient-to-br from-white to-gray-50 border-blue-100">
              <CardContent className="p-6">
                  <div className="flex justify-between items-start mb-6">
                      <div>
                          <p className="text-sm text-gray-500 mb-1">Current Tier</p>
                          <div className="flex items-center gap-3">
                              <h2 className="text-4xl font-extrabold text-gray-900">{data.currentTier}</h2>
                              {data.currentTier === 'GOLD' && <Award className="w-8 h-8 text-yellow-500" />}
                              {data.currentTier === 'PLATINUM' && <Crown className="w-8 h-8 text-purple-500" />}
                          </div>
                      </div>
                      <div className="text-right">
                          <p className="text-sm text-gray-500 mb-1">Commission Rate</p>
                          <p className="text-3xl font-bold text-green-600">{data.commissionRate}%</p>
                          <p className="text-xs text-gray-400">per transaction</p>
                      </div>
                  </div>

                  {data.nextTier && (
                      <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                              <span className="font-medium text-gray-700">Progress to {data.nextTier}</span>
                              <span className="text-gray-500">
                                  ₹{data.totalGMV.toLocaleString()} / ₹{data.gmvRequiredForNext?.toLocaleString()} GMV
                              </span>
                          </div>
                          <Progress value={progress} className="h-3" />
                          <p className="text-xs text-gray-500 mt-2 flex items-center gap-1">
                              <Info className="w-3 h-3" />
                              Generate ₹{((data.gmvRequiredForNext || 0) - data.totalGMV).toLocaleString()} more revenue to reach {data.nextTier} and lower your commission to {data.nextTier === 'GOLD' ? '10%' : '5%'}.
                          </p>
                      </div>
                  )}

                  {!data.nextTier && (
                      <div className="bg-purple-50 text-purple-700 p-3 rounded-lg flex items-center gap-2">
                          <Crown className="w-5 h-5" />
                          <span className="font-semibold">You are at the top tier! Enjoy the lowest commission rates.</span>
                      </div>
                  )}
              </CardContent>
          </Card>

          {/* Benefits Card */}
          <Card>
              <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                      <Zap className="w-5 h-5 text-orange-500" /> Tier Benefits
                  </CardTitle>
              </CardHeader>
              <CardContent>
                  <ul className="space-y-3">
                      {data.benefits.map((benefit, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                              <CheckCircle className="w-4 h-4 text-green-500 mt-0.5" />
                              {benefit}
                          </li>
                      ))}
                      {data.currentTier === 'SILVER' && (
                          <li className="flex items-start gap-2 text-sm text-gray-400 italic">
                              <ArrowUpCircle className="w-4 h-4" />
                              Upgrade to Gold for Priority Support
                          </li>
                      )}
                  </ul>
              </CardContent>
          </Card>
      </div>

      {/* Tier Comparison Table */}
      <Card>
          <CardHeader>
              <CardTitle>Tier Comparison</CardTitle>
          </CardHeader>
          <CardContent>
              <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                      <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                          <tr>
                              <th className="px-6 py-3">Feature</th>
                              <th className="px-6 py-3 text-center">Silver</th>
                              <th className="px-6 py-3 text-center">Gold</th>
                              <th className="px-6 py-3 text-center">Platinum</th>
                          </tr>
                      </thead>
                      <tbody>
                          <tr className="bg-white border-b">
                              <td className="px-6 py-4 font-medium text-gray-900">Commission</td>
                              <td className="px-6 py-4 text-center">15%</td>
                              <td className="px-6 py-4 text-center font-bold text-green-600">10%</td>
                              <td className="px-6 py-4 text-center font-bold text-green-600">5%</td>
                          </tr>
                          <tr className="bg-white border-b">
                              <td className="px-6 py-4 font-medium text-gray-900">Monthly GMV Goal</td>
                              <td className="px-6 py-4 text-center">-</td>
                              <td className="px-6 py-4 text-center">₹50k+</td>
                              <td className="px-6 py-4 text-center">₹2L+</td>
                          </tr>
                          <tr className="bg-white border-b">
                              <td className="px-6 py-4 font-medium text-gray-900">Search Visibility</td>
                              <td className="px-6 py-4 text-center">Standard</td>
                              <td className="px-6 py-4 text-center">High</td>
                              <td className="px-6 py-4 text-center">Top</td>
                          </tr>
                          <tr className="bg-white">
                              <td className="px-6 py-4 font-medium text-gray-900">Support</td>
                              <td className="px-6 py-4 text-center">Standard</td>
                              <td className="px-6 py-4 text-center">Priority</td>
                              <td className="px-6 py-4 text-center">Dedicated Mgr</td>
                          </tr>
                      </tbody>
                  </table>
              </div>
          </CardContent>
      </Card>
    </div>
  );
}
