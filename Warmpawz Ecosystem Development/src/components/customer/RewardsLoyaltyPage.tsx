/**
 * REWARDS & LOYALTY PAGE - COMPLETE IMPLEMENTATION
 * 
 * Features:
 * - Loyalty points display
 * - Tier badges (Silver, Gold, Platinum, Diamond)
 * - Points redemption
 * - Rewards catalog
 * - Points history
 * - Tier benefits
 * 
 * Status: ✅ P1 IMPLEMENTATION (MockAPI Migrated)
 */

import React, { useState, useEffect } from 'react';
import MockAPI from '../../lib/mockAPI';
import { Award, Gift, Star, TrendingUp, Crown, Zap, History, ShoppingBag, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

interface LoyaltyProfile {
  customerId: string;
  points: number;
  tier: 'Silver' | 'Gold' | 'Platinum' | 'Diamond';
  tierBenefits: {
    cashbackPercentage: number;
    prioritySupport: boolean;
    exclusiveOffers: boolean;
  };
  pointsEarned: number;
  pointsRedeemed: number;
  pointsExpiringSoon?: number;
}

interface RewardItem {
  id: string;
  name: string;
  pointsCost: number;
  cashValue: number;
  type: 'discount' | 'freebie' | 'cashback';
  description: string;
  imageUrl?: string;
}

interface RewardsLoyaltyPageProps {
  customerId: string;
}

export function RewardsLoyaltyPage({ customerId }: RewardsLoyaltyPageProps) {
  const [loyaltyProfile, setLoyaltyProfile] = useState<LoyaltyProfile | null>(null);
  const [rewardsCatalog, setRewardsCatalog] = useState<RewardItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [redeeming, setRedeeming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'rewards' | 'history'>('overview');

  useEffect(() => {
    loadLoyaltyProfile();
    loadRewardsCatalog();
  }, [customerId]);

  const loadLoyaltyProfile = async () => {
    try {
      setLoading(true);
      
      // Use MockAPI.loyalty to get customer loyalty profile
      const profile = await MockAPI.loyalty.getProfile(customerId);
      setLoyaltyProfile(profile);
    } catch (err) {
      console.error('Error loading loyalty profile:', err);
      setError('Failed to load loyalty data');
    } finally {
      setLoading(false);
    }
  };

  const loadRewardsCatalog = async () => {
    try {
      // Use MockAPI.loyalty to get rewards catalog
      const catalog = await MockAPI.loyalty.getRewardsCatalog();
      setRewardsCatalog(catalog);
    } catch (err) {
      console.error('Error loading rewards catalog:', err);
    }
  };

  const redeemPoints = async (rewardId: string, pointsCost: number) => {
    if (!loyaltyProfile || loyaltyProfile.points < pointsCost) {
      setError('Insufficient points');
      return;
    }

    if (!confirm(`Redeem ${pointsCost} points for this reward?`)) {
      return;
    }

    try {
      setRedeeming(true);
      setError(null);

      // Use MockAPI.loyalty to redeem points
      const result = await MockAPI.loyalty.redeemPoints(customerId, rewardId, pointsCost);

      toast.success(`✅ Points redeemed successfully!`);
      await loadLoyaltyProfile();
    } catch (err: any) {
      console.error('Error redeeming points:', err);
      setError(err.message || 'Failed to redeem points');
      toast.error(err.message || 'Failed to redeem points');
    } finally {
      setRedeeming(false);
    }
  };

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'Diamond':
        return 'from-purple-600 to-pink-600';
      case 'Platinum':
        return 'from-gray-600 to-gray-800';
      case 'Gold':
        return 'from-yellow-500 to-orange-500';
      case 'Silver':
      default:
        return 'from-gray-400 to-gray-600';
    }
  };

  const getTierIcon = (tier: string) => {
    switch (tier) {
      case 'Diamond':
        return <Sparkles className="w-8 h-8" />;
      case 'Platinum':
        return <Crown className="w-8 h-8" />;
      case 'Gold':
        return <Award className="w-8 h-8" />;
      case 'Silver':
      default:
        return <Star className="w-8 h-8" />;
    }
  };

  const getTierProgress = () => {
    if (!loyaltyProfile) return { current: 0, next: 1000, percentage: 0 };

    const tiers = {
      Silver: { min: 0, max: 1000 },
      Gold: { min: 1000, max: 5000 },
      Platinum: { min: 5000, max: 10000 },
      Diamond: { min: 10000, max: 999999 }
    };

    const currentTier = tiers[loyaltyProfile.tier];
    const points = loyaltyProfile.points;

    if (loyaltyProfile.tier === 'Diamond') {
      return { current: points, next: null, percentage: 100 };
    }

    const progress = ((points - currentTier.min) / (currentTier.max - currentTier.min)) * 100;

    return {
      current: points,
      next: currentTier.max,
      percentage: Math.min(progress, 100)
    };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  if (!loyaltyProfile) {
    return (
      <div className="flex items-center justify-center min-h-screen p-4">
        <div className="text-center">
          <Award className="w-16 h-16 mx-auto mb-4 text-gray-300" />
          <p className="text-gray-500">No loyalty profile found</p>
        </div>
      </div>
    );
  }

  const tierProgress = getTierProgress();

  return (
    <div className="min-h-screen bg-gray-50 p-4 pb-20">
      {/* Tier Badge Card */}
      <div className={`bg-gradient-to-br ${getTierColor(loyaltyProfile.tier)} rounded-2xl p-6 text-white shadow-lg mb-6`}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            {getTierIcon(loyaltyProfile.tier)}
            <div>
              <div className="text-sm opacity-90">Your Tier</div>
              <div className="text-2xl font-bold">{loyaltyProfile.tier}</div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm opacity-90">Total Points</div>
            <div className="text-3xl font-bold">{loyaltyProfile.points}</div>
          </div>
        </div>

        {/* Tier Progress */}
        {tierProgress.next && (
          <div className="mb-4">
            <div className="flex items-center justify-between text-sm mb-2 opacity-90">
              <span>Progress to {loyaltyProfile.tier === 'Silver' ? 'Gold' : loyaltyProfile.tier === 'Gold' ? 'Platinum' : 'Diamond'}</span>
              <span>{tierProgress.next - tierProgress.current} points to go</span>
            </div>
            <div className="bg-white/20 rounded-full h-2 overflow-hidden">
              <div 
                className="bg-white h-full transition-all duration-500"
                style={{ width: `${tierProgress.percentage}%` }}
              />
            </div>
          </div>
        )}

        {/* Tier Benefits */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white/10 rounded-lg p-3">
            <div className="text-xs opacity-75 mb-1">Cashback</div>
            <div className="text-lg font-semibold">{loyaltyProfile.tierBenefits.cashbackPercentage}%</div>
          </div>
          <div className="bg-white/10 rounded-lg p-3">
            <div className="text-xs opacity-75 mb-1">Benefits</div>
            <div className="flex gap-1">
              {loyaltyProfile.tierBenefits.prioritySupport && <Zap className="w-4 h-4" />}
              {loyaltyProfile.tierBenefits.exclusiveOffers && <Gift className="w-4 h-4" />}
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
          {error}
        </div>
      )}

      {/* Points Summary */}
      <div className="bg-white rounded-xl p-4 shadow-sm mb-6">
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">{loyaltyProfile.pointsEarned}</div>
            <div className="text-xs text-gray-600 mt-1">Earned</div>
          </div>
          <div className="text-center border-x border-gray-200">
            <div className="text-2xl font-bold text-orange-600">{loyaltyProfile.pointsRedeemed}</div>
            <div className="text-xs text-gray-600 mt-1">Redeemed</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-600">{loyaltyProfile.points}</div>
            <div className="text-xs text-gray-600 mt-1">Available</div>
          </div>
        </div>
      </div>

      {/* Expiring Points Alert */}
      {loyaltyProfile.pointsExpiringSoon && loyaltyProfile.pointsExpiringSoon > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-6">
          <div className="flex items-start gap-3">
            <TrendingUp className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="font-medium text-yellow-900 mb-1">Points Expiring Soon!</div>
              <div className="text-sm text-yellow-700">
                {loyaltyProfile.pointsExpiringSoon} points will expire in 30 days. Redeem them before they're gone!
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setActiveTab('overview')}
          className={`flex-1 py-3 rounded-lg font-medium transition-colors ${
            activeTab === 'overview'
              ? 'bg-orange-500 text-white'
              : 'bg-white text-gray-700 hover:bg-gray-50'
          }`}
        >
          Overview
        </button>
        <button
          onClick={() => setActiveTab('rewards')}
          className={`flex-1 py-3 rounded-lg font-medium transition-colors ${
            activeTab === 'rewards'
              ? 'bg-orange-500 text-white'
              : 'bg-white text-gray-700 hover:bg-gray-50'
          }`}
        >
          Rewards
        </button>
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="space-y-4">
          {/* How to Earn */}
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-orange-500" />
              How to Earn Points
            </h3>
            <div className="space-y-3">
              <div className="flex items-start gap-3 pb-3 border-b border-gray-100 last:border-0">
                <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center flex-shrink-0">
                  <ShoppingBag className="w-5 h-5 text-green-600" />
                </div>
                <div className="flex-1">
                  <div className="font-medium text-gray-900">Make Bookings</div>
                  <div className="text-sm text-gray-600">Earn 1 point for every ₹1 spent</div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-green-600">1×</div>
                </div>
              </div>

              <div className="flex items-start gap-3 pb-3 border-b border-gray-100 last:border-0">
                <div className="w-10 h-10 rounded-lg bg-purple-50 flex items-center justify-center flex-shrink-0">
                  <Star className="w-5 h-5 text-purple-600" />
                </div>
                <div className="flex-1">
                  <div className="font-medium text-gray-900">First Booking</div>
                  <div className="text-sm text-gray-600">Double points on your first booking</div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-purple-600">2×</div>
                </div>
              </div>

              <div className="flex items-start gap-3 pb-3 border-b border-gray-100 last:border-0">
                <div className="w-10 h-10 rounded-lg bg-orange-50 flex items-center justify-center flex-shrink-0">
                  <Zap className="w-5 h-5 text-orange-600" />
                </div>
                <div className="flex-1">
                  <div className="font-medium text-gray-900">Weekend Bookings</div>
                  <div className="text-sm text-gray-600">1.5× points on weekends</div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-orange-600">1.5×</div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                  <Award className="w-5 h-5 text-blue-600" />
                </div>
                <div className="flex-1">
                  <div className="font-medium text-gray-900">High Value Bookings</div>
                  <div className="text-sm text-gray-600">1.5× points on bookings above ₹5000</div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-blue-600">1.5×</div>
                </div>
              </div>
            </div>
          </div>

          {/* Tier Benefits */}
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Crown className="w-5 h-5 text-orange-500" />
              Tier Benefits
            </h3>
            <div className="space-y-3">
              {['Silver', 'Gold', 'Platinum', 'Diamond'].map((tier) => (
                <div 
                  key={tier}
                  className={`border-2 rounded-lg p-3 ${
                    loyaltyProfile.tier === tier
                      ? 'border-orange-500 bg-orange-50'
                      : 'border-gray-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {getTierIcon(tier)}
                      <span className="font-semibold text-gray-900">{tier}</span>
                      {loyaltyProfile.tier === tier && (
                        <span className="text-xs bg-orange-500 text-white px-2 py-0.5 rounded-full">
                          Current
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-gray-600">
                      {tier === 'Silver' && '0-1K pts'}
                      {tier === 'Gold' && '1K-5K pts'}
                      {tier === 'Platinum' && '5K-10K pts'}
                      {tier === 'Diamond' && '10K+ pts'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Rewards Tab */}
      {activeTab === 'rewards' && (
        <div className="space-y-4">
          {rewardsCatalog.length === 0 ? (
            <div className="bg-white rounded-xl p-8 text-center">
              <Gift className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <p className="text-gray-500">No rewards available</p>
            </div>
          ) : (
            rewardsCatalog.map((reward) => {
              const canAfford = loyaltyProfile.points >= reward.pointsCost;
              
              return (
                <div key={reward.id} className="bg-white rounded-xl p-4 shadow-sm">
                  <div className="flex items-start gap-3">
                    <div className="w-16 h-16 rounded-lg bg-gradient-to-br from-orange-400 to-pink-500 flex items-center justify-center flex-shrink-0">
                      <Gift className="w-8 h-8 text-white" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-gray-900 mb-1">{reward.name}</div>
                      <div className="text-sm text-gray-600 mb-3">{reward.description}</div>

                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-lg font-bold text-orange-600">
                            {reward.pointsCost} points
                          </div>
                          <div className="text-xs text-gray-500">
                            Worth ₹{reward.cashValue}
                          </div>
                        </div>

                        <button
                          onClick={() => redeemPoints(reward.id, reward.pointsCost)}
                          disabled={!canAfford || redeeming}
                          className={`px-6 py-2 rounded-lg font-medium transition-colors ${
                            canAfford
                              ? 'bg-orange-500 hover:bg-orange-600 text-white'
                              : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                          }`}
                        >
                          {redeeming ? 'Redeeming...' : 'Redeem'}
                        </button>
                      </div>

                      {!canAfford && (
                        <div className="mt-2 text-xs text-red-600">
                          Need {reward.pointsCost - loyaltyProfile.points} more points
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

export default RewardsLoyaltyPage;