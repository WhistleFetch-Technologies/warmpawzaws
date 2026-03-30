"use client";

import { useState, useEffect } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/lib/api-client';

interface RewardsLoyaltyPageProps {
  phone?: string;
  customerPhone?: string;
  customerId?: string;
  petId?: string;
  bookingId?: string;
  orderId?: string;
  cafeId?: string;
  preSelectedVendorId?: string;
  vendorId?: string;
  onBack: () => void;
  onNavigate?: (screen: string, data?: any) => void;
  onSuccess?: (bookingId?: string) => void;
  onComplete?: () => void;
}

interface RewardsBalance {
  points: number;
  totalPoints: number;
  tier: {
    name: string;
    min_points: number;
  };
  lifetimePointsEarned: number;
  lifetimePointsRedeemed: number;
}

interface RewardItem {
  id: string;
  name: string;
  description: string;
  points_cost: number;
  cash_value?: number;
  type: string;
  image_url?: string;
}

interface PointsHistory {
  id: string;
  type: string;
  points: number;
  description: string;
  date: string;
  created_at?: string; // Optional for backward compatibility
  source?: string;
}

export function RewardsLoyaltyPage(props: RewardsLoyaltyPageProps) {
  const phone = props.customerPhone || props.phone || (typeof window !== 'undefined' ? localStorage.getItem('customerPhone') : null);
  
  const [balance, setBalance] = useState<RewardsBalance | null>(null);
  const [rewards, setRewards] = useState<RewardItem[]>([]);
  const [history, setHistory] = useState<PointsHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'rewards' | 'history'>('rewards');
  const [customerId, setCustomerId] = useState<string | null>(props.customerId || null);
  const [redeeming, setRedeeming] = useState<string | null>(null);

  useEffect(() => {
    if (phone) {
      loadData();
    }
  }, [phone]);

  const loadData = async () => {
    if (!phone) return;

    try {
      setLoading(true);
      setError(null);

      // Get customer ID if not provided
      let id = customerId;
      if (!id) {
        try {
          const customerResponse = await apiClient.get<any>(`/customer/by-phone?phone=${encodeURIComponent(phone)}`);
          id = customerResponse.customer?.id;
          if (id) setCustomerId(id);
        } catch (err) {
          console.error('Error getting customer ID:', err);
        }
      }

      if (!id) {
        setError('Customer not found. Please login again.');
        setLoading(false);
        return;
      }

      // Load balance, rewards, and history
      const [balanceRes, rewardsRes, historyRes] = await Promise.all([
        apiClient.get<any>(`/customer/${id}/rewards/points`).catch(() => null),
        apiClient.get<any>(`/customer/${id}/rewards/available`).catch(() => null),
        apiClient.get<any>(`/customer/${id}/rewards/history`).catch(() => null),
      ]);

      if (balanceRes?.success || balanceRes?.points !== undefined) {
        setBalance({
          points: balanceRes.points || balanceRes.totalPoints || 0,
          totalPoints: balanceRes.totalPoints || balanceRes.points || 0,
          tier: balanceRes.tier || { name: 'Bronze', min_points: 0 },
          lifetimePointsEarned: balanceRes.lifetimePointsEarned || 0,
          lifetimePointsRedeemed: balanceRes.lifetimePointsRedeemed || 0,
        });
      }

      if (rewardsRes?.success || Array.isArray(rewardsRes?.rewards) || Array.isArray(rewardsRes?.catalog)) {
        setRewards(rewardsRes.rewards || rewardsRes.catalog || rewardsRes || []);
      }

      if (historyRes?.success || Array.isArray(historyRes?.history)) {
        setHistory(historyRes.history || historyRes || []);
      }
    } catch (err: any) {
      console.error('Error loading rewards:', err);
      setError(err.message || 'Failed to load rewards');
    } finally {
      setLoading(false);
    }
  };

  const handleRedeem = async (reward: RewardItem) => {
    if (!customerId) {
      setError('Customer not found. Please login again.');
      return;
    }

    if (!balance || balance.points < reward.points_cost) {
      setError('Not enough points to redeem this reward');
      return;
    }

    if (!confirm(`Redeem ${reward.name} for ${reward.points_cost} points?`)) return;

    try {
      setRedeeming(reward.id);
      setError(null);

      const response = await apiClient.post<any>(`/customer/${customerId}/rewards/redeem`, {
        rewardId: reward.id,
        points: reward.points_cost,
      });

      if (response.success) {
        setSuccess(`Successfully redeemed: ${reward.name}! Check your rewards.`);
        await loadData(); // Reload data
      } else {
        setError(response.message || 'Failed to redeem reward');
      }
    } catch (err: any) {
      console.error('Error redeeming reward:', err);
      setError(err.message || 'Failed to redeem reward');
    } finally {
      setRedeeming(null);
    }
  };

  const tierColors: Record<string, { bg: string; text: string; icon: string }> = {
    Bronze: { bg: 'bg-amber-100', text: 'text-amber-700', icon: '🥉' },
    Silver: { bg: 'bg-gray-100', text: 'text-gray-700', icon: '🥈' },
    Gold: { bg: 'bg-yellow-100', text: 'text-yellow-700', icon: '🥇' },
    Platinum: { bg: 'bg-purple-100', text: 'text-purple-700', icon: '💎' },
  };

  const categoryIcons: Record<string, string> = {
    discount: '🏷️',
    service: '✨',
    product: '🎁',
    experience: '🌟',
  };

  if (loading) {
    return (
      <div className="min-h-screen min-h-[100dvh] w-full bg-gradient-to-br from-orange-50 to-amber-50 flex justify-center">
        <div className="w-full max-w-customer mx-auto flex items-center justify-center px-4 py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto" />
            <p className="mt-4 text-sm text-gray-600">Loading rewards...</p>
          </div>
        </div>
      </div>
    );
  }

  const tierName = balance?.tier?.name || 'Bronze';
  const tierColor = tierColors[tierName] || tierColors.Bronze;

  return (
    <div className="min-h-screen min-h-[100dvh] w-full bg-gradient-to-br from-orange-50 to-amber-50 flex justify-center">
      <div className="w-full max-w-customer mx-auto min-h-screen min-h-[100dvh] flex flex-col shadow-[0_0_0_1px_rgba(0,0,0,0.04)]">
        {/* Header — compact app-style bar */}
        <header className="bg-white/90 backdrop-blur-sm border-b border-orange-200/80 sticky top-0 z-10 pt-[env(safe-area-inset-top,0px)]">
          <div className="px-4 pb-3 pt-2">
            <div className="flex items-start gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={props.onBack}
                className="rounded-full shrink-0 h-10 w-10 -ml-1"
                aria-label="Go back"
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div className="flex-1 min-w-0 pt-0.5 pr-1">
                <h1 className="text-lg font-bold text-gray-800 leading-snug">Rewards & Loyalty</h1>
                <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
                  Earn points and redeem amazing rewards
                </p>
              </div>
            </div>
          </div>
        </header>

        {/* Hero Section */}
        {balance && (
          <div className="bg-gradient-to-br from-orange-500 to-orange-600 text-white shrink-0">
            <div className="px-4 py-6 text-center">
              <div
                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm ${tierColor.bg} ${tierColor.text} mb-3`}
              >
                <span>{tierColor.icon}</span>
                <span className="font-semibold capitalize">{tierName} Member</span>
              </div>

              <p className="text-4xl font-bold tabular-nums mb-1">{balance.points.toLocaleString()}</p>
              <p className="text-sm text-white/85">Available Points</p>

              <div className="mt-5 grid grid-cols-2 gap-3">
                <div className="bg-white/10 rounded-xl p-3">
                  <p className="text-xs text-white/80">Total Earned</p>
                  <p className="text-xl font-bold tabular-nums mt-0.5">{balance.lifetimePointsEarned.toLocaleString()}</p>
                </div>
                <div className="bg-white/10 rounded-xl p-3">
                  <p className="text-xs text-white/80">Total Redeemed</p>
                  <p className="text-xl font-bold tabular-nums mt-0.5">{balance.lifetimePointsRedeemed.toLocaleString()}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Main Content */}
        <div className="flex-1 overflow-y-auto pb-[max(1rem,env(safe-area-inset-bottom,0px))]">
          <div className="px-4 py-4">
          
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

          {/* Tabs */}
          <div className="mb-4">
            <div
              className="flex bg-white rounded-xl p-1 shadow-sm border border-stone-200/90"
              role="tablist"
            >
              {[
                { id: 'rewards', label: 'Redeem Points', icon: '🎁' },
                { id: 'history', label: 'Points History', icon: '📜' },
              ].map(tab => (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={activeTab === tab.id}
                  onClick={() => setActiveTab(tab.id as 'rewards' | 'history')}
                  className={`flex-1 min-h-[44px] py-2 px-1 rounded-lg text-xs font-semibold transition flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-1.5 leading-tight ${
                    activeTab === tab.id
                      ? 'bg-orange-500 text-white shadow-sm'
                      : 'text-gray-600 hover:bg-stone-50'
                  }`}
                >
                  <span className="text-base leading-none" aria-hidden>
                    {tab.icon}
                  </span>
                  <span>{tab.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Rewards Tab */}
          {activeTab === 'rewards' && (
            <div className="space-y-6">
              {rewards.length === 0 ? (
                <div className="bg-white rounded-2xl p-8 py-10 text-center shadow-sm border border-stone-200/80">
                  <div className="text-5xl mb-3" aria-hidden>
                    🎁
                  </div>
                  <p className="text-sm text-gray-600">No rewards available at the moment</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4">
                  {rewards.map(reward => (
                    <div key={reward.id} className="bg-white rounded-2xl p-5 shadow-sm">
                      <div className="flex items-start gap-4">
                        <span className="text-3xl">{categoryIcons[reward.type] || '🎁'}</span>
                        <div className="flex-1">
                          <h3 className="font-semibold text-gray-900">{reward.name}</h3>
                          <p className="text-sm text-gray-600 mt-1">{reward.description}</p>
                          {reward.cash_value && (
                            <p className="text-xs text-gray-400 mt-2">Worth ₹{reward.cash_value}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center justify-between mt-4 pt-4 border-t">
                        <div>
                          <span className="text-xl font-bold text-orange-600">{reward.points_cost}</span>
                          <span className="text-sm text-gray-500 ml-1">points</span>
                        </div>
                        <button
                          onClick={() => handleRedeem(reward)}
                          disabled={redeeming === reward.id || (balance?.points || 0) < reward.points_cost}
                          className={`px-6 py-2 rounded-lg font-medium transition ${
                            (balance?.points || 0) >= reward.points_cost
                              ? 'bg-orange-500 text-white hover:bg-orange-600'
                              : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                          }`}
                        >
                          {redeeming === reward.id ? 'Redeeming...' : (balance?.points || 0) >= reward.points_cost ? 'Redeem' : 'Not enough points'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* History Tab */}
          {activeTab === 'history' && (
            <div className="bg-white rounded-2xl shadow-sm border border-stone-200/80 overflow-hidden">
              {history.length === 0 ? (
                <div className="p-8 py-10 text-center">
                  <div className="text-5xl mb-3" aria-hidden>
                    📜
                  </div>
                  <p className="text-sm text-gray-600">No points history yet</p>
                </div>
              ) : (
                <div className="divide-y">
                  {history.map(item => (
                    <div key={item.id} className="p-4 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg ${
                          item.type === 'earned' ? 'bg-green-100' :
                          item.type === 'redeemed' ? 'bg-orange-100' :
                          'bg-gray-100'
                        }`}>
                          {item.type === 'earned' ? '💰' :
                           item.type === 'redeemed' ? '🎫' : '⏰'}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{item.description || `${item.type} points`}</p>
                          <p className="text-sm text-gray-500">
                            {new Date(item.date || (item as any).created_at || Date.now()).toLocaleDateString('en-IN', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric'
                            })}
                          </p>
                        </div>
                      </div>
                      <span className={`font-bold ${
                        item.points > 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {item.points > 0 ? '+' : ''}{item.points}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          </div>
        </div>
      </div>
    </div>
  );
}
