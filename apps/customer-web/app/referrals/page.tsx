'use client';

import React, { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';

// ============================================================================
// TYPES
// ============================================================================

interface ReferralStats {
  referral_code: string;
  referral_link: string;
  total_referrals: number;
  successful_signups: number;
  pending_signups: number;
  total_rewards_earned: number;
  pending_rewards: number;
}

interface Referral {
  id: string;
  referred_user_id: string;
  referred_user_name: string;
  referred_user_phone: string;
  status: 'pending' | 'completed' | 'rewarded';
  signup_date: string;
  first_booking_date?: string;
  reward_earned: number;
  reward_paid: boolean;
  created_at: string;
}

interface Reward {
  id: string;
  referral_id: string;
  amount: number;
  type: 'signup_bonus' | 'booking_bonus';
  status: 'pending' | 'credited' | 'expired';
  credited_at?: string;
  expires_at?: string;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function ReferralsPage() {
  const [stats, setStats] = useState<ReferralStats | null>(null);
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [copying, setCopying] = useState(false);

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
      
      const [statsRes, referralsRes, rewardsRes] = await Promise.all([
        apiClient.get<any>('/referrals/stats'),
        apiClient.get<any>('/referrals/list'),
        apiClient.get<any>('/referrals/rewards'),
      ]);
      
      setStats(statsRes.stats || statsRes);
      setReferrals(referralsRes.referrals || referralsRes || []);
      setRewards(rewardsRes.rewards || rewardsRes || []);
    } catch (err: any) {
      console.error('Error loading referrals:', err);
      setError(err.message || 'Failed to load referral data');
    } finally {
      setLoading(false);
    }
  };

  // ============================================================================
  // ACTIONS
  // ============================================================================

  const handleCopyLink = async () => {
    if (!stats) return;
    
    try {
      setCopying(true);
      await navigator.clipboard.writeText(stats.referral_link);
      setSuccess('Referral link copied to clipboard!');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError('Failed to copy link');
    } finally {
      setCopying(false);
    }
  };

  const handleShare = async () => {
    if (!stats) return;
    
    try {
      if (navigator.share) {
        await navigator.share({
          title: 'Join Warmpawz!',
          text: `Use my referral code ${stats.referral_code} and get ₹200 bonus!`,
          url: stats.referral_link,
        });
      } else {
        handleCopyLink();
      }
    } catch (err) {
      // User cancelled share
    }
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-amber-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading referral program...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-50">
      {/* Hero Section - Special design, keep as-is but update container */}
      <div className="bg-gradient-to-br from-orange-500 to-orange-600 text-white">
        <div className="max-w-7xl mx-auto px-6 py-8 text-center">
          {/* ✅ FIX: Match consistency - text-2xl font-bold */}
          <h1 className="text-2xl font-bold mb-2">Refer & Earn</h1>
          <p className="text-orange-100">Invite friends and earn rewards together!</p>
        </div>
      </div>

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
        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-white rounded-2xl p-6 shadow-sm text-center">
              <p className="text-3xl mb-2">👥</p>
              <p className="text-2xl font-bold text-gray-900">{stats.total_referrals}</p>
              <p className="text-sm text-gray-500">Total Referrals</p>
            </div>
            <div className="bg-green-50 rounded-2xl p-6 text-center">
              <p className="text-3xl mb-2">✅</p>
              <p className="text-2xl font-bold text-green-600">{stats.successful_signups}</p>
              <p className="text-sm text-green-600">Successful</p>
            </div>
            <div className="bg-yellow-50 rounded-2xl p-6 text-center">
              <p className="text-3xl mb-2">⏳</p>
              <p className="text-2xl font-bold text-yellow-600">{stats.pending_signups}</p>
              <p className="text-sm text-yellow-600">Pending</p>
            </div>
            <div className="bg-orange-50 rounded-2xl p-6 text-center">
              <p className="text-3xl mb-2">💰</p>
              <p className="text-2xl font-bold text-orange-600">₹{stats.total_rewards_earned.toLocaleString()}</p>
              <p className="text-sm text-orange-600">Earned</p>
            </div>
          </div>
        )}

        {/* Referral Code Section */}
        {stats && (
          <div className="bg-white rounded-2xl p-6 shadow-sm mb-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Your Referral Code</h2>
            <div className="flex items-center gap-4 mb-4">
              <div className="flex-1 px-4 py-3 bg-gray-50 rounded-xl border-2 border-orange-200">
                <p className="text-xs text-gray-500 mb-1">Referral Code</p>
                <p className="text-2xl font-bold font-mono text-orange-600">{stats.referral_code}</p>
              </div>
              <button
                onClick={handleCopyLink}
                disabled={copying}
                className="px-6 py-3 bg-orange-500 text-white rounded-xl font-medium hover:bg-orange-600 transition disabled:opacity-50"
              >
                {copying ? 'Copied!' : '📋 Copy'}
              </button>
            </div>
            
            <div className="flex items-center gap-4 mb-4">
              <div className="flex-1 px-4 py-3 bg-gray-50 rounded-xl">
                <p className="text-xs text-gray-500 mb-1">Referral Link</p>
                <p className="text-sm font-mono text-gray-700 truncate">{stats.referral_link}</p>
              </div>
              <button
                onClick={handleShare}
                className="px-6 py-3 bg-blue-500 text-white rounded-xl font-medium hover:bg-blue-600 transition"
              >
                📤 Share
              </button>
            </div>
            
            <div className="p-4 bg-blue-50 rounded-xl">
              <p className="text-sm text-blue-700 font-medium mb-2">How it works:</p>
              <ul className="text-sm text-blue-600 space-y-1">
                <li>• Share your referral code or link with friends</li>
                <li>• They sign up using your code → You get ₹200</li>
                <li>• They make their first booking → You get ₹300</li>
                <li>• Rewards are credited to your wallet instantly</li>
              </ul>
            </div>
          </div>
        )}

        {/* Referrals List */}
        <div className="bg-white rounded-2xl p-6 shadow-sm mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Your Referrals</h2>
          {referrals.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-5xl mb-4">👥</div>
              <p className="text-gray-500 mb-4">No referrals yet</p>
              <p className="text-sm text-gray-400">Share your referral code to start earning!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {referrals.map(referral => (
                <div key={referral.id} className="border rounded-xl p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-semibold text-gray-900">{referral.referred_user_name}</h3>
                      <p className="text-sm text-gray-500">{referral.referred_user_phone}</p>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      referral.status === 'completed' ? 'bg-green-100 text-green-700' :
                      referral.status === 'rewarded' ? 'bg-blue-100 text-blue-700' :
                      'bg-yellow-100 text-yellow-700'
                    }`}>
                      {referral.status}
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="text-gray-500">Signed Up</p>
                      <p className="font-medium">{new Date(referral.signup_date).toLocaleDateString()}</p>
                    </div>
                    {referral.first_booking_date && (
                      <div>
                        <p className="text-gray-500">First Booking</p>
                        <p className="font-medium">{new Date(referral.first_booking_date).toLocaleDateString()}</p>
                      </div>
                    )}
                    <div>
                      <p className="text-gray-500">Reward Earned</p>
                      <p className="font-medium text-green-600">₹{referral.reward_earned}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Status</p>
                      <p className="font-medium">{referral.reward_paid ? '✅ Paid' : '⏳ Pending'}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Rewards History */}
        <div className="bg-white rounded-2xl p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Reward History</h2>
          {rewards.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-5xl mb-4">💰</div>
              <p className="text-gray-500">No rewards earned yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {rewards.map(reward => (
                <div key={reward.id} className="flex items-center justify-between p-4 border rounded-xl">
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center text-xl ${
                      reward.type === 'signup_bonus' ? 'bg-green-100' : 'bg-blue-100'
                    }`}>
                      {reward.type === 'signup_bonus' ? '🎁' : '💳'}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 capitalize">
                        {reward.type === 'signup_bonus' ? 'Signup Bonus' : 'Booking Bonus'}
                      </p>
                      <p className="text-sm text-gray-500">
                        {reward.credited_at ? new Date(reward.credited_at).toLocaleDateString() : 'Pending'}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-green-600">+₹{reward.amount}</p>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      reward.status === 'credited' ? 'bg-green-100 text-green-700' :
                      reward.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-gray-100 text-gray-600'
                    }`}>
                      {reward.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        </div>
      </div>
    </div>
  );
}

