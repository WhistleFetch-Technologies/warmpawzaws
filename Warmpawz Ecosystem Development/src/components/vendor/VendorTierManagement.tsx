import React, { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { TrendingUp, Award, Crown, Star, ArrowUp, ChevronRight, Info } from 'lucide-react';
import { toast } from 'sonner';
import { getApiBaseUrl, getAuthHeaders } from '../../utils/api-config';

interface TierConfig {
  id: string;
  name: string;
  level: number;
  commissionRate: number;
  benefits: string[];
  requirements: {
    monthlyRevenue?: number;
    totalBookings?: number;
    rating?: number;
    reviews?: number;
  };
  color: string;
  icon: string;
}

interface VendorTierManagementProps {
  vendorId: string;
  vendorName: string;
}

export function VendorTierManagement({ vendorId, vendorName }: VendorTierManagementProps) {
  const [loading, setLoading] = useState(false);
  const [tierData, setTierData] = useState<any>(null);
  const [allTiers, setAllTiers] = useState<TierConfig[]>([]);
  const [analytics, setAnalytics] = useState<any>(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  useEffect(() => {
    loadTierData();
    loadAllTiers();
    loadAnalytics();
  }, [vendorId]);

  const loadTierData = async () => {
    try {
      setLoading(true);

      const response = await fetch(
        `${getApiBaseUrl()}/vendor/${vendorId}/tier`,
        { headers: getAuthHeaders() }
      );

      if (response.ok) {
        const data = await response.json();
        setTierData(data);
      }
    } catch (error) {
      console.error('Error loading tier data:', error);
      toast.error('Failed to load tier information');
    } finally {
      setLoading(false);
    }
  };

  const loadAllTiers = async () => {
    try {
      const response = await fetch(
        `${getApiBaseUrl()}/tiers`,
        { headers: getAuthHeaders() }
      );

      if (response.ok) {
        const data = await response.json();
        setAllTiers(data.tiers || []);
      }
    } catch (error) {
      console.error('Error loading tiers:', error);
    }
  };

  const loadAnalytics = async () => {
    try {
      const response = await fetch(
        `${getApiBaseUrl()}/vendor/${vendorId}/tier/analytics`,
        { headers: getAuthHeaders() }
      );

      if (response.ok) {
        const data = await response.json();
        setAnalytics(data.analytics);
      }
    } catch (error) {
      console.error('Error loading analytics:', error);
    }
  };

  const handleUpgrade = async () => {
    if (!tierData?.upgrade?.eligible) {
      toast.error('You do not meet the requirements for upgrade');
      return;
    }

    try {
      const response = await fetch(
        `${getApiBaseUrl()}/vendor/${vendorId}/tier/upgrade`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...getAuthHeaders()
          },
          body: JSON.stringify({ tierId: tierData.upgrade.nextTier })
        }
      );

      if (response.ok) {
        const data = await response.json();
        toast.success(data.message || 'Tier upgraded successfully!');
        setShowUpgradeModal(false);
        loadTierData();
        loadAnalytics();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to upgrade tier');
      }
    } catch (error) {
      console.error('Error upgrading tier:', error);
      toast.error('Error upgrading tier');
    }
  };

  const getTierBadge = (tierId: string) => {
    const colors: Record<string, string> = {
      bronze: 'bg-amber-100 text-amber-700 border-amber-300',
      silver: 'bg-gray-100 text-gray-700 border-gray-300',
      gold: 'bg-yellow-100 text-yellow-700 border-yellow-300',
      platinum: 'bg-purple-100 text-purple-700 border-purple-300'
    };

    const icons: Record<string, string> = {
      bronze: '🥉',
      silver: '🥈',
      gold: '🥇',
      platinum: '💎'
    };

    return { color: colors[tierId] || colors.bronze, icon: icons[tierId] || icons.bronze };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-4 border-orange-600 border-t-transparent rounded-full mx-auto mb-2"></div>
          <p className="text-gray-600">Loading tier information...</p>
        </div>
      </div>
    );
  }

  if (!tierData) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">No tier information available</p>
      </div>
    );
  }

  const currentTierConfig = tierData.config;
  const badge = getTierBadge(tierData.tier.currentTier);

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Tier Management</h1>
          <p className="text-gray-600">Manage your tier level and unlock exclusive benefits</p>
        </div>

        {/* Current Tier Card */}
        <div className="bg-white rounded-xl shadow-md overflow-hidden">
          <div className={`p-6 ${badge.color} border-b-4`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="text-6xl">{badge.icon}</div>
                <div>
                  <p className="text-sm font-medium opacity-80">Your Current Tier</p>
                  <h2 className="text-3xl font-bold">{currentTierConfig.name}</h2>
                  <p className="text-sm opacity-80">Level {currentTierConfig.level}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium opacity-80">Commission Rate</p>
                <p className="text-3xl font-bold">{currentTierConfig.commissionRate}%</p>
              </div>
            </div>
          </div>

          {/* Benefits */}
          <div className="p-6">
            <h3 className="font-semibold text-lg text-gray-900 mb-3">Your Benefits</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {currentTierConfig.benefits.map((benefit: string, idx: number) => (
                <div key={idx} className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span className="text-gray-700">{benefit}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Upgrade Progress */}
        {tierData.upgrade && tierData.upgrade.nextTier && (
          <div className="bg-white rounded-xl shadow-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-lg text-gray-900">
                Progress to {allTiers.find(t => t.id === tierData.upgrade.nextTier)?.name}
              </h3>
              {tierData.upgrade.eligible && (
                <Button
                  onClick={() => setShowUpgradeModal(true)}
                  className="bg-orange-600 hover:bg-orange-700"
                >
                  <ArrowUp className="w-4 h-4 mr-2" />
                  Upgrade Now
                </Button>
              )}
            </div>

            <div className="space-y-4">
              {/* Monthly Revenue */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-600">Monthly Revenue</span>
                  <span className="text-sm font-medium text-gray-900">
                    ₹{tierData.upgrade.currentProgress?.revenue.current.toLocaleString()} / ₹{tierData.upgrade.currentProgress?.revenue.required.toLocaleString()}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${tierData.upgrade.currentProgress?.revenue.met ? 'bg-green-500' : 'bg-orange-500'}`}
                    style={{ width: `${Math.min(100, tierData.upgrade.currentProgress?.revenue.percentage || 0)}%` }}
                  ></div>
                </div>
              </div>

              {/* Total Bookings */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-600">Total Bookings</span>
                  <span className="text-sm font-medium text-gray-900">
                    {tierData.upgrade.currentProgress?.bookings.current} / {tierData.upgrade.currentProgress?.bookings.required}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${tierData.upgrade.currentProgress?.bookings.met ? 'bg-green-500' : 'bg-orange-500'}`}
                    style={{ width: `${Math.min(100, tierData.upgrade.currentProgress?.bookings.percentage || 0)}%` }}
                  ></div>
                </div>
              </div>

              {/* Rating */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-600">Average Rating</span>
                  <span className="text-sm font-medium text-gray-900">
                    {tierData.upgrade.currentProgress?.rating.current.toFixed(1)} / {tierData.upgrade.currentProgress?.rating.required}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${tierData.upgrade.currentProgress?.rating.met ? 'bg-green-500' : 'bg-orange-500'}`}
                    style={{ width: `${Math.min(100, tierData.upgrade.currentProgress?.rating.percentage || 0)}%` }}
                  ></div>
                </div>
              </div>

              {/* Reviews */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-600">Total Reviews</span>
                  <span className="text-sm font-medium text-gray-900">
                    {tierData.upgrade.currentProgress?.reviews.current} / {tierData.upgrade.currentProgress?.reviews.required}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${tierData.upgrade.currentProgress?.reviews.met ? 'bg-green-500' : 'bg-orange-500'}`}
                    style={{ width: `${Math.min(100, tierData.upgrade.currentProgress?.reviews.percentage || 0)}%` }}
                  ></div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Lifetime Stats */}
        {analytics && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white rounded-xl shadow-md p-6">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Total Revenue</p>
                  <p className="text-2xl font-bold text-gray-900">₹{analytics.lifetime.totalRevenue.toLocaleString()}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-md p-6">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Award className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Total Bookings</p>
                  <p className="text-2xl font-bold text-gray-900">{analytics.lifetime.totalBookings}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-md p-6">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                  <Crown className="w-5 h-5 text-orange-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Commission Paid</p>
                  <p className="text-2xl font-bold text-gray-900">₹{analytics.lifetime.totalCommissionPaid.toLocaleString()}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* All Tiers */}
        <div className="bg-white rounded-xl shadow-md p-6">
          <h3 className="font-semibold text-lg text-gray-900 mb-4">All Tier Levels</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {allTiers.map((tier) => {
              const tierBadge = getTierBadge(tier.id);
              const isCurrent = tier.id === tierData.tier.currentTier;

              return (
                <div
                  key={tier.id}
                  className={`rounded-xl border-2 p-4 ${
                    isCurrent ? 'border-orange-500 bg-orange-50' : 'border-gray-200'
                  }`}
                >
                  <div className="text-center mb-3">
                    <div className="text-4xl mb-2">{tierBadge.icon}</div>
                    <h4 className="font-bold text-lg">{tier.name}</h4>
                    <p className="text-sm text-gray-600">Level {tier.level}</p>
                  </div>

                  <div className="mb-3 text-center">
                    <p className="text-sm text-gray-600">Commission</p>
                    <p className="text-2xl font-bold text-orange-600">{tier.commissionRate}%</p>
                  </div>

                  <div className="space-y-2">
                    {tier.benefits.slice(0, 3).map((benefit, idx) => (
                      <div key={idx} className="flex items-start gap-2">
                        <div className="w-1.5 h-1.5 bg-green-500 rounded-full mt-1.5"></div>
                        <span className="text-xs text-gray-600">{benefit}</span>
                      </div>
                    ))}
                    {tier.benefits.length > 3 && (
                      <p className="text-xs text-gray-500 text-center">+{tier.benefits.length - 3} more</p>
                    )}
                  </div>

                  {isCurrent && (
                    <div className="mt-3 bg-orange-100 text-orange-700 text-xs font-semibold py-1 px-2 rounded text-center">
                      Current Tier
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Info Box */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
          <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm text-blue-900">
              <strong>How Tiers Work:</strong> Your tier level determines your platform commission rate. Higher tiers mean lower commissions and more benefits. Progress is evaluated monthly based on revenue, bookings, ratings, and reviews.
            </p>
          </div>
        </div>
      </div>

      {/* Upgrade Modal */}
      {showUpgradeModal && tierData.upgrade?.eligible && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Confirm Tier Upgrade</h3>
            
            <div className="mb-6">
              <p className="text-gray-600 mb-4">
                You're about to upgrade to <strong>{allTiers.find(t => t.id === tierData.upgrade.nextTier)?.name}</strong> tier!
              </p>
              
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <p className="text-sm text-green-900 mb-2"><strong>New Benefits:</strong></p>
                <ul className="space-y-1">
                  <li className="text-sm text-green-800">✓ Commission reduced to {allTiers.find(t => t.id === tierData.upgrade.nextTier)?.commissionRate}%</li>
                  <li className="text-sm text-green-800">✓ Access to premium features</li>
                  <li className="text-sm text-green-800">✓ Priority support</li>
                </ul>
              </div>
            </div>

            <div className="flex gap-3">
              <Button onClick={() => setShowUpgradeModal(false)} variant="outline" className="flex-1">
                Cancel
              </Button>
              <Button onClick={handleUpgrade} className="flex-1 bg-orange-600 hover:bg-orange-700">
                Upgrade Now
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
