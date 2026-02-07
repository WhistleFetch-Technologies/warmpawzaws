'use client';

import React, { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';

// ============================================================================
// TYPES
// ============================================================================

interface RewardsBalance {
  points: number;
  tier: 'bronze' | 'silver' | 'gold' | 'platinum';
  points_to_next_tier: number;
  next_tier: string | null;
  lifetime_points: number;
}

interface RewardItem {
  id: string;
  name: string;
  description: string;
  points_required: number;
  category: 'discount' | 'service' | 'product' | 'experience';
  image_url?: string;
  validity_days: number;
  stock?: number;
  is_featured: boolean;
}

interface PointsHistory {
  id: string;
  type: 'earned' | 'redeemed' | 'expired' | 'bonus';
  points: number;
  description: string;
  created_at: string;
  booking_id?: string;
  reward_id?: string;
}

interface RedeemedReward {
  id: string;
  reward: RewardItem;
  redeemed_at: string;
  expires_at: string;
  status: 'active' | 'used' | 'expired';
  coupon_code?: string;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function RewardsPage() {
  const [balance, setBalance] = useState<RewardsBalance | null>(null);
  const [rewards, setRewards] = useState<RewardItem[]>([]);
  const [history, setHistory] = useState<PointsHistory[]>([]);
  const [redeemed, setRedeemed] = useState<RedeemedReward[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // UI States
  const [activeTab, setActiveTab] = useState<'rewards' | 'history' | 'redeemed'>('rewards');
  const [filterCategory, setFilterCategory] = useState<string>('');
  const [redeeming, setRedeeming] = useState<string | null>(null);

  // ============================================================================
  // DATA LOADING
  // ============================================================================

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const customerId = localStorage.getItem('customerId');
      if (!customerId) {
        setError('Please log in to view rewards');
        setLoading(false);
        return;
      }
      
      const [balanceRes, rewardsRes, historyRes] = await Promise.all([
        apiClient.get<any>(`/customer/${customerId}/rewards/points`),
        apiClient.get<any>(`/customer/${customerId}/rewards/available`),
        apiClient.get<any>(`/customer/${customerId}/rewards/history`),
      ]);
      
      setBalance(balanceRes.balance || balanceRes);
      setRewards(rewardsRes.rewards || rewardsRes || []);
      setHistory(historyRes.history || historyRes || []);
      setRedeemed(historyRes.history?.filter((h: any) => h.type === 'redemption') || []);
    } catch (err: any) {
      console.error('Error loading rewards:', err);
      setError(err.message || 'Failed to load rewards');
    } finally {
      setLoading(false);
    }
  };

  // ============================================================================
  // ACTIONS
  // ============================================================================

  const handleRedeem = async (reward: RewardItem) => {
    if (!balance || balance.points < reward.points_required) {
      setError('Not enough points to redeem this reward');
      return;
    }
    
    if (!confirm(`Redeem ${reward.name} for ${reward.points_required} points?`)) return;
    
    try {
      setRedeeming(reward.id);
      setError(null);
      
      const customerId = localStorage.getItem('customerId');
      if (!customerId) {
        setError('Please log in to redeem rewards');
        return;
      }
      
      await apiClient.post(`/customer/${customerId}/rewards/redeem`, { 
        rewardId: reward.id,
        points: reward.points_required 
      });
      
      setSuccess(`Successfully redeemed: ${reward.name}! Check "My Rewards" tab.`);
      loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to redeem reward');
    } finally {
      setRedeeming(null);
    }
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading rewards...</p>
        </div>
      </div>
    );
  }

  const tierColors: Record<string, { bg: string; text: string; icon: string }> = {
    bronze: { bg: 'bg-amber-100', text: 'text-amber-700', icon: '🥉' },
    silver: { bg: 'bg-gray-100', text: 'text-gray-700', icon: '🥈' },
    gold: { bg: 'bg-yellow-100', text: 'text-yellow-700', icon: '🥇' },
    platinum: { bg: 'bg-purple-100', text: 'text-purple-700', icon: '💎' },
  };

  const categoryIcons: Record<string, string> = {
    discount: '🏷️',
    service: '✨',
    product: '🎁',
    experience: '🌟',
  };

  const filteredRewards = filterCategory
    ? rewards.filter(r => r.category === filterCategory)
    : rewards;

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-50">
      {/* Hero Section - Special design, keep as-is but update container */}
      {balance && (
        <div className="bg-gradient-to-br from-orange-500 to-orange-600 text-white">
          <div className="max-w-7xl mx-auto px-6 py-8 text-center">
            <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full ${tierColors[balance.tier].bg} ${tierColors[balance.tier].text} mb-4`}>
              <span>{tierColors[balance.tier].icon}</span>
              <span className="font-semibold capitalize">{balance.tier} Member</span>
            </div>
            
            <p className="text-5xl font-bold mb-2">{balance.points.toLocaleString()}</p>
            <p className="text-white/80">Available Points</p>
            
            {balance.next_tier && (
              <div className="mt-6 bg-white/10 rounded-xl p-4">
                <div className="flex justify-between text-sm mb-2">
                  <span>Progress to {balance.next_tier}</span>
                  <span>{balance.points_to_next_tier} points to go</span>
                </div>
                <div className="h-2 bg-white/20 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-white rounded-full transition-all" 
                    style={{ width: `${Math.min(100, ((3000 - balance.points_to_next_tier) / 3000) * 100)}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Main Content - Match consistency pattern: max-w-7xl mx-auto p-6 or p-8 */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto p-6">
          
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
          <div className="mb-6">
            <div className="flex bg-white rounded-xl p-1 shadow-sm">
              {[
                { id: 'rewards', label: 'Redeem Points', icon: '🎁' },
                { id: 'history', label: 'Points History', icon: '📜' },
                { id: 'redeemed', label: 'My Rewards', icon: '🎫' },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex-1 py-3 rounded-lg font-medium transition ${
                    activeTab === tab.id
                      ? 'bg-orange-500 text-white'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {tab.icon} {tab.label}
                </button>
              ))}
            </div>
          </div>
        {/* Rewards Tab */}
        {activeTab === 'rewards' && (
          <>
            {/* Category Filter */}
            <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
              <button
                onClick={() => setFilterCategory('')}
                className={`px-4 py-2 rounded-full whitespace-nowrap transition ${!filterCategory ? 'bg-orange-500 text-white' : 'bg-white text-gray-600 hover:bg-gray-100'}`}
              >
                All Rewards
              </button>
              {Object.entries(categoryIcons).map(([cat, icon]) => (
                <button
                  key={cat}
                  onClick={() => setFilterCategory(cat)}
                  className={`px-4 py-2 rounded-full whitespace-nowrap transition ${filterCategory === cat ? 'bg-orange-500 text-white' : 'bg-white text-gray-600 hover:bg-gray-100'}`}
                >
                  {icon} {cat.charAt(0).toUpperCase() + cat.slice(1)}
                </button>
              ))}
            </div>
            
            {/* Featured */}
            {!filterCategory && (
              <div className="mb-8">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">⭐ Featured Rewards</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {rewards.filter(r => r.is_featured).map(reward => (
                    <div key={reward.id} className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-2xl p-5 border-2 border-orange-200">
                      <span className="text-3xl">{categoryIcons[reward.category]}</span>
                      <h3 className="font-semibold text-gray-900 mt-3">{reward.name}</h3>
                      <p className="text-sm text-gray-600 mt-1">{reward.description}</p>
                      <div className="flex items-center justify-between mt-4">
                        <span className="font-bold text-orange-600">{reward.points_required} pts</span>
                        <button
                          onClick={() => handleRedeem(reward)}
                          disabled={redeeming === reward.id || (balance?.points || 0) < reward.points_required}
                          className="px-4 py-2 bg-orange-500 text-white text-sm rounded-lg font-medium hover:bg-orange-600 transition disabled:opacity-50"
                        >
                          {redeeming === reward.id ? '...' : 'Redeem'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* All Rewards */}
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              {filterCategory ? `${categoryIcons[filterCategory]} ${filterCategory.charAt(0).toUpperCase() + filterCategory.slice(1)} Rewards` : 'All Rewards'}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredRewards.map(reward => (
                <div key={reward.id} className="bg-white rounded-2xl p-5 shadow-sm">
                  <div className="flex items-start gap-4">
                    <span className="text-3xl">{categoryIcons[reward.category]}</span>
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900">{reward.name}</h3>
                      <p className="text-sm text-gray-600 mt-1">{reward.description}</p>
                      <p className="text-xs text-gray-400 mt-2">Valid for {reward.validity_days} days after redemption</p>
                      {reward.stock !== undefined && (
                        <p className="text-xs text-orange-600 mt-1">Only {reward.stock} left!</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-4 pt-4 border-t">
                    <div>
                      <span className="text-xl font-bold text-orange-600">{reward.points_required}</span>
                      <span className="text-sm text-gray-500 ml-1">points</span>
                    </div>
                    <button
                      onClick={() => handleRedeem(reward)}
                      disabled={redeeming === reward.id || (balance?.points || 0) < reward.points_required}
                      className={`px-6 py-2 rounded-lg font-medium transition ${
                        (balance?.points || 0) >= reward.points_required
                          ? 'bg-orange-500 text-white hover:bg-orange-600'
                          : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      }`}
                    >
                      {redeeming === reward.id ? 'Redeeming...' : (balance?.points || 0) >= reward.points_required ? 'Redeem' : 'Not enough points'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* History Tab */}
        {activeTab === 'history' && (
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            {history.length === 0 ? (
              <div className="p-12 text-center">
                <div className="text-5xl mb-4">📜</div>
                <p className="text-gray-500">No points history yet</p>
              </div>
            ) : (
              <div className="divide-y">
                {history.map(item => (
                  <div key={item.id} className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg ${
                        item.type === 'earned' ? 'bg-green-100' :
                        item.type === 'bonus' ? 'bg-blue-100' :
                        item.type === 'redeemed' ? 'bg-orange-100' :
                        'bg-gray-100'
                      }`}>
                        {item.type === 'earned' ? '💰' :
                         item.type === 'bonus' ? '🎁' :
                         item.type === 'redeemed' ? '🎫' : '⏰'}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{item.description}</p>
                        <p className="text-sm text-gray-500">
                          {new Date(item.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
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

        {/* Redeemed Tab */}
        {activeTab === 'redeemed' && (
          <div className="space-y-4">
            {redeemed.length === 0 ? (
              <div className="bg-white rounded-2xl p-12 text-center shadow-sm">
                <div className="text-5xl mb-4">🎫</div>
                <p className="text-gray-500">No redeemed rewards yet</p>
                <button
                  onClick={() => setActiveTab('rewards')}
                  className="mt-4 text-orange-500 font-medium hover:underline"
                >
                  Browse rewards to redeem
                </button>
              </div>
            ) : (
              redeemed.map(item => (
                <div key={item.id} className={`bg-white rounded-2xl p-5 shadow-sm border-l-4 ${
                  item.status === 'active' ? 'border-green-500' :
                  item.status === 'used' ? 'border-gray-400' :
                  'border-red-400'
                }`}>
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold text-gray-900">{item.reward.name}</h3>
                      <p className="text-sm text-gray-600 mt-1">{item.reward.description}</p>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      item.status === 'active' ? 'bg-green-100 text-green-700' :
                      item.status === 'used' ? 'bg-gray-100 text-gray-600' :
                      'bg-red-100 text-red-700'
                    }`}>
                      {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                    </span>
                  </div>
                  
                  {item.coupon_code && item.status === 'active' && (
                    <div className="mt-4 p-3 bg-orange-50 rounded-lg">
                      <p className="text-xs text-orange-600 mb-1">Use this code at checkout:</p>
                      <p className="font-mono font-bold text-orange-700 text-lg">{item.coupon_code}</p>
                    </div>
                  )}
                  
                  <div className="mt-4 flex items-center justify-between text-sm text-gray-500">
                    <span>Redeemed: {new Date(item.redeemed_at).toLocaleDateString()}</span>
                    <span>Expires: {new Date(item.expires_at).toLocaleDateString()}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
        </div>
      </div>
    </div>
  );
}

