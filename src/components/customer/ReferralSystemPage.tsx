/**
 * REFERRAL SYSTEM PAGE - COMPLETE IMPLEMENTATION
 * 
 * Features:
 * - Generate referral code
 * - Share referral code
 * - Referral stats
 * - Referral leaderboard
 * - Rewards tracking
 * 
 * Status: ✅ P1 IMPLEMENTATION
 */

import React, { useState, useEffect } from 'react';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import { Users, Share2, Gift, Copy, Check, Trophy, TrendingUp, Star, DollarSign } from 'lucide-react';

interface ReferralStats {
  referralCode: string;
  totalReferrals: number;
  successfulReferrals: number;
  pendingReferrals: number;
  totalEarnings: number;
  referrals: Array<{
    refereeId: string;
    refereeName: string;
    status: 'pending' | 'completed';
    rewardEarned: number;
    referredAt: string;
  }>;
}

interface LeaderboardEntry {
  customerId: string;
  customerName: string;
  referralCount: number;
  totalEarnings: number;
  rank: number;
}

interface ReferralSystemPageProps {
  customerId: string;
  customerName: string;
  customerPhone: string;
}

export function ReferralSystemPage({ customerId, customerName, customerPhone }: ReferralSystemPageProps) {
  const [referralStats, setReferralStats] = useState<ReferralStats | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'stats' | 'leaderboard'>('stats');

  useEffect(() => {
    loadReferralStats();
    loadLeaderboard();
  }, [customerId]);

  const loadReferralStats = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/referrals/${customerId}/stats`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        throw new Error('Failed to load referral stats');
      }

      const data = await response.json();
      setReferralStats(data);
    } catch (err) {
      console.error('Error loading referral stats:', err);
      setError('Failed to load referral data');
    } finally {
      setLoading(false);
    }
  };

  const loadLeaderboard = async () => {
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/referrals/leaderboard?limit=50`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        throw new Error('Failed to load leaderboard');
      }

      const data = await response.json();
      setLeaderboard(data.leaderboard || []);
    } catch (err) {
      console.error('Error loading leaderboard:', err);
    }
  };

  const generateReferralCode = async () => {
    try {
      setGenerating(true);
      setError(null);

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/referrals/${customerId}/create-code`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            customerName,
            customerPhone
          })
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate referral code');
      }

      await loadReferralStats();
    } catch (err: any) {
      console.error('Error generating referral code:', err);
      setError(err.message || 'Failed to generate referral code');
    } finally {
      setGenerating(false);
    }
  };

  const copyReferralCode = () => {
    if (referralStats?.referralCode) {
      navigator.clipboard.writeText(referralStats.referralCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const shareReferral = () => {
    if (!referralStats?.referralCode) return;

    const message = `🐾 Join Warmpawz - India's best pet services platform!\n\nUse my referral code: ${referralStats.referralCode}\n\nGet ₹100 off on your first booking!\n\nDownload now: [App Link]`;

    if (navigator.share) {
      navigator.share({
        title: 'Join Warmpawz',
        text: message
      }).catch(err => console.error('Error sharing:', err));
    } else {
      // Fallback: copy to clipboard
      navigator.clipboard.writeText(message);
      alert('Referral message copied to clipboard!');
    }
  };

  const getMyRank = () => {
    const myEntry = leaderboard.find(entry => entry.customerId === customerId);
    return myEntry?.rank || null;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 pb-20">
      {/* Header */}
      <div className="bg-gradient-to-br from-orange-500 to-pink-500 rounded-2xl p-6 text-white shadow-lg mb-6">
        <div className="flex items-center gap-3 mb-4">
          <Users className="w-8 h-8" />
          <div>
            <h1 className="text-2xl font-bold">Refer & Earn</h1>
            <p className="text-sm opacity-90">Invite friends, earn rewards!</p>
          </div>
        </div>

        {referralStats?.referralCode ? (
          <div className="bg-white/20 rounded-xl p-4">
            <div className="text-sm opacity-90 mb-2">Your Referral Code</div>
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-white/90 text-gray-900 rounded-lg px-4 py-3 font-mono text-xl font-bold">
                {referralStats.referralCode}
              </div>
              <button
                onClick={copyReferralCode}
                className="bg-white/90 hover:bg-white text-orange-600 p-3 rounded-lg transition-colors"
              >
                {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
              </button>
            </div>
            <button
              onClick={shareReferral}
              className="w-full bg-white/90 hover:bg-white text-orange-600 mt-3 py-3 rounded-lg font-semibold flex items-center justify-center gap-2 transition-colors"
            >
              <Share2 className="w-5 h-5" />
              Share with Friends
            </button>
          </div>
        ) : (
          <button
            onClick={generateReferralCode}
            disabled={generating}
            className="w-full bg-white/90 hover:bg-white text-orange-600 py-3 rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {generating ? 'Generating...' : 'Generate Referral Code'}
          </button>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
          {error}
        </div>
      )}

      {/* Stats Cards */}
      {referralStats && (
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <Users className="w-5 h-5 text-blue-500" />
              <span className="text-sm text-gray-600">Total Referrals</span>
            </div>
            <div className="text-3xl font-bold text-gray-900">{referralStats.totalReferrals}</div>
          </div>

          <div className="bg-white rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="w-5 h-5 text-green-500" />
              <span className="text-sm text-gray-600">Total Earnings</span>
            </div>
            <div className="text-3xl font-bold text-green-600">₹{referralStats.totalEarnings}</div>
          </div>

          <div className="bg-white rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <Check className="w-5 h-5 text-green-500" />
              <span className="text-sm text-gray-600">Successful</span>
            </div>
            <div className="text-3xl font-bold text-gray-900">{referralStats.successfulReferrals}</div>
          </div>

          <div className="bg-white rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-5 h-5 text-yellow-500" />
              <span className="text-sm text-gray-600">Pending</span>
            </div>
            <div className="text-3xl font-bold text-gray-900">{referralStats.pendingReferrals}</div>
          </div>
        </div>
      )}

      {/* How It Works */}
      <div className="bg-white rounded-xl p-4 shadow-sm mb-6">
        <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Gift className="w-5 h-5 text-orange-500" />
          How It Works
        </h3>
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center font-bold flex-shrink-0">
              1
            </div>
            <div>
              <div className="font-medium text-gray-900">Share Your Code</div>
              <div className="text-sm text-gray-600">Share your unique referral code with friends</div>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center font-bold flex-shrink-0">
              2
            </div>
            <div>
              <div className="font-medium text-gray-900">Friend Signs Up</div>
              <div className="text-sm text-gray-600">Your friend uses your code during signup</div>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center font-bold flex-shrink-0">
              3
            </div>
            <div>
              <div className="font-medium text-gray-900">Both Get Rewards</div>
              <div className="text-sm text-gray-600">Friend gets ₹100 off, you get ₹50 credited!</div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setActiveTab('stats')}
          className={`flex-1 py-3 rounded-lg font-medium transition-colors ${
            activeTab === 'stats'
              ? 'bg-orange-500 text-white'
              : 'bg-white text-gray-700 hover:bg-gray-50'
          }`}
        >
          My Referrals
        </button>
        <button
          onClick={() => setActiveTab('leaderboard')}
          className={`flex-1 py-3 rounded-lg font-medium transition-colors ${
            activeTab === 'leaderboard'
              ? 'bg-orange-500 text-white'
              : 'bg-white text-gray-700 hover:bg-gray-50'
          }`}
        >
          Leaderboard
        </button>
      </div>

      {/* My Referrals Tab */}
      {activeTab === 'stats' && (
        <div className="space-y-4">
          {referralStats && referralStats.referrals.length === 0 ? (
            <div className="bg-white rounded-xl p-8 text-center">
              <Users className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <p className="text-gray-500 mb-2">No referrals yet</p>
              <p className="text-sm text-gray-400">Start sharing your referral code to earn rewards!</p>
            </div>
          ) : (
            referralStats?.referrals.map((referral) => (
              <div key={referral.refereeId} className="bg-white rounded-xl p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center">
                      <Users className="w-5 h-5 text-orange-600" />
                    </div>
                    <div>
                      <div className="font-medium text-gray-900">{referral.refereeName}</div>
                      <div className="text-xs text-gray-500">
                        {new Date(referral.referredAt).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric'
                        })}
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className={`text-xs px-2 py-1 rounded-full ${
                      referral.status === 'completed'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-yellow-100 text-yellow-700'
                    }`}>
                      {referral.status === 'completed' ? 'Completed' : 'Pending'}
                    </div>
                    {referral.rewardEarned > 0 && (
                      <div className="text-sm font-semibold text-green-600 mt-1">
                        +₹{referral.rewardEarned}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Leaderboard Tab */}
      {activeTab === 'leaderboard' && (
        <div className="space-y-4">
          {/* My Rank Card */}
          {getMyRank() && (
            <div className="bg-gradient-to-r from-orange-500 to-pink-500 rounded-xl p-4 text-white shadow-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Trophy className="w-8 h-8" />
                  <div>
                    <div className="text-sm opacity-90">Your Rank</div>
                    <div className="text-2xl font-bold">#{getMyRank()}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm opacity-90">Referrals</div>
                  <div className="text-2xl font-bold">{referralStats?.successfulReferrals || 0}</div>
                </div>
              </div>
            </div>
          )}

          {/* Top 3 */}
          {leaderboard.slice(0, 3).map((entry) => {
            const isMe = entry.customerId === customerId;
            const colors = ['from-yellow-400 to-yellow-600', 'from-gray-400 to-gray-600', 'from-orange-400 to-orange-600'];
            const icons = [Trophy, Star, Star];
            const Icon = icons[entry.rank - 1] || Star;

            return (
              <div
                key={entry.customerId}
                className={`${
                  isMe
                    ? 'bg-gradient-to-r from-orange-500 to-pink-500'
                    : `bg-gradient-to-r ${colors[entry.rank - 1]}`
                } rounded-xl p-4 text-white shadow-lg`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center font-bold text-2xl">
                    {entry.rank}
                  </div>
                  <Icon className="w-6 h-6" />
                  <div className="flex-1">
                    <div className="font-semibold">
                      {isMe ? 'You' : entry.customerName}
                    </div>
                    <div className="text-sm opacity-90">{entry.referralCount} referrals</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xl font-bold">₹{entry.totalEarnings}</div>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Rest of leaderboard */}
          {leaderboard.slice(3).map((entry) => {
            const isMe = entry.customerId === customerId;

            return (
              <div
                key={entry.customerId}
                className={`rounded-xl p-4 shadow-sm ${
                  isMe ? 'bg-orange-50 border-2 border-orange-500' : 'bg-white'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                    isMe ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-700'
                  }`}>
                    {entry.rank}
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold text-gray-900">
                      {isMe ? 'You' : entry.customerName}
                    </div>
                    <div className="text-sm text-gray-600">{entry.referralCount} referrals</div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-gray-900">₹{entry.totalEarnings}</div>
                  </div>
                </div>
              </div>
            );
          })}

          {leaderboard.length === 0 && (
            <div className="bg-white rounded-xl p-8 text-center">
              <Trophy className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <p className="text-gray-500">No leaderboard data yet</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default ReferralSystemPage;
