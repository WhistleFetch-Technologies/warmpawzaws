'use client';

import React, { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';

// ============================================================================
// TYPES
// ============================================================================

interface DonationCampaign {
  id: string;
  title: string;
  description: string;
  organization_name: string;
  organization_type: 'ngo' | 'shelter' | 'rescue' | 'foundation';
  image_url?: string;
  target_amount: number;
  current_amount: number;
  donor_count: number;
  start_date: string;
  end_date?: string;
  status: 'active' | 'completed' | 'paused';
  category: 'medical' | 'food' | 'shelter' | 'rescue' | 'education' | 'other';
  verified: boolean;
}

interface Donation {
  id: string;
  campaign_id: string;
  campaign_title: string;
  amount: number;
  payment_method: 'online' | 'wallet';
  transaction_id: string;
  donated_at: string;
  anonymous: boolean;
  message?: string;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function DonationsPage() {
  const [campaigns, setCampaigns] = useState<DonationCampaign[]>([]);
  const [donations, setDonations] = useState<Donation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // UI States
  const [activeTab, setActiveTab] = useState<'campaigns' | 'my-donations'>('campaigns');
  const [showDonateModal, setShowDonateModal] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<DonationCampaign | null>(null);
  const [donating, setDonating] = useState(false);
  
  // Donation form
  const [donationForm, setDonationForm] = useState({
    amount: 0,
    payment_method: 'online' as 'online' | 'wallet',
    anonymous: false,
    message: '',
  });

  // ============================================================================
  // DATA LOADING
  // ============================================================================

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const [campaignsRes, donationsRes] = await Promise.all([
        apiClient.get<any>('/donations/campaigns'),
        apiClient.get<any>('/donations/my-donations'),
      ]);
      
      setCampaigns(campaignsRes.campaigns || campaignsRes || []);
      setDonations(donationsRes.donations || donationsRes || []);
    } catch (err: any) {
      console.error('Error loading donations:', err);
      setError(err.message || 'Failed to load donation campaigns');
    } finally {
      setLoading(false);
    }
  };

  // ============================================================================
  // ACTIONS
  // ============================================================================

  const handleDonate = async () => {
    if (!selectedCampaign || donationForm.amount <= 0) {
      setError('Please enter a valid donation amount');
      return;
    }
    
    try {
      setDonating(true);
      setError(null);
      
      await apiClient.post(`/donations/campaigns/${selectedCampaign.id}/donate`, {
        amount: donationForm.amount,
        payment_method: donationForm.payment_method,
        anonymous: donationForm.anonymous,
        message: donationForm.message,
      });
      
      setSuccess(`Thank you for your donation of ₹${donationForm.amount.toLocaleString()}!`);
      setShowDonateModal(false);
      setSelectedCampaign(null);
      setDonationForm({
        amount: 0,
        payment_method: 'online',
        anonymous: false,
        message: '',
      });
      loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to process donation');
    } finally {
      setDonating(false);
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
          <p className="mt-4 text-gray-600">Loading donation campaigns...</p>
        </div>
      </div>
    );
  }

  const categoryIcons: Record<string, string> = {
    medical: '🏥',
    food: '🍖',
    shelter: '🏠',
    rescue: '🚑',
    education: '📚',
    other: '❤️',
  };

  const quickAmounts = [100, 500, 1000, 2500, 5000];

  return (
    <div className="min-h-screen bg-gray-50 pb-8">
      {/* Header */}
      <header className="bg-gradient-to-br from-orange-500 to-orange-600 text-white px-4 py-8">
        <div className="max-w-6xl mx-auto text-center">
          <h1 className="text-3xl font-bold mb-2">Make a Difference</h1>
          <p className="text-orange-100">Support pet welfare and rescue organizations</p>
        </div>
      </header>

      {/* Tabs */}
      <div className="max-w-6xl mx-auto px-4 mt-4">
        <div className="flex bg-white rounded-xl p-1 shadow-sm">
          <button
            onClick={() => setActiveTab('campaigns')}
            className={`flex-1 py-3 rounded-lg font-medium transition ${
              activeTab === 'campaigns' ? 'bg-orange-500 text-white' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            ❤️ Donate Now
          </button>
          <button
            onClick={() => setActiveTab('my-donations')}
            className={`flex-1 py-3 rounded-lg font-medium transition ${
              activeTab === 'my-donations' ? 'bg-orange-500 text-white' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            💝 My Donations
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="max-w-6xl mx-auto px-4 mt-4">
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600">✕</button>
          </div>
        )}
        
        {success && (
          <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-xl text-green-700 flex items-center justify-between">
            <span>{success}</span>
            <button onClick={() => setSuccess(null)} className="text-green-400 hover:text-green-600">✕</button>
          </div>
        )}
      </div>

      <main className="max-w-6xl mx-auto px-4 py-6">
        {/* Campaigns Tab */}
        {activeTab === 'campaigns' && (
          <div className="space-y-6">
            {campaigns.length === 0 ? (
              <div className="bg-white rounded-2xl p-12 text-center shadow-sm">
                <div className="text-5xl mb-4">❤️</div>
                <p className="text-gray-500">No active campaigns at the moment</p>
              </div>
            ) : (
              campaigns.map(campaign => {
                const progress = (campaign.current_amount / campaign.target_amount) * 100;
                
                return (
                  <div key={campaign.id} className="bg-white rounded-2xl p-6 shadow-sm hover:shadow-md transition">
                    <div className="flex items-start gap-6">
                      <div className="w-24 h-24 bg-gray-100 rounded-xl flex items-center justify-center text-4xl">
                        {categoryIcons[campaign.category]}
                      </div>
                      
                      <div className="flex-1">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="text-lg font-semibold text-gray-900">{campaign.title}</h3>
                              {campaign.verified && (
                                <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs font-medium">✓ Verified</span>
                              )}
                            </div>
                            <p className="text-sm text-gray-500">{campaign.organization_name}</p>
                          </div>
                          <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                            campaign.status === 'active' ? 'bg-green-100 text-green-700' :
                            campaign.status === 'completed' ? 'bg-blue-100 text-blue-700' :
                            'bg-gray-100 text-gray-600'
                          }`}>
                            {campaign.status}
                          </span>
                        </div>
                        
                        <p className="text-sm text-gray-600 mb-4">{campaign.description}</p>
                        
                        {/* Progress Bar */}
                        <div className="mb-4">
                          <div className="flex justify-between text-sm mb-2">
                            <span className="text-gray-600">
                              ₹{campaign.current_amount.toLocaleString()} raised
                            </span>
                            <span className="font-medium">
                              {Math.round(progress)}% of ₹{campaign.target_amount.toLocaleString()}
                            </span>
                          </div>
                          <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-orange-500 rounded-full transition-all"
                              style={{ width: `${Math.min(100, progress)}%` }}
                            />
                          </div>
                        </div>
                        
                        <div className="flex items-center justify-between">
                          <div className="text-sm text-gray-500">
                            <span className="font-medium text-gray-900">{campaign.donor_count}</span> donors
                          </div>
                          <button
                            onClick={() => {
                              setSelectedCampaign(campaign);
                              setShowDonateModal(true);
                            }}
                            disabled={campaign.status !== 'active'}
                            className="px-6 py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            Donate Now
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* My Donations Tab */}
        {activeTab === 'my-donations' && (
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">My Donation History</h2>
            {donations.length === 0 ? (
              <div className="bg-white rounded-2xl p-12 text-center shadow-sm">
                <div className="text-5xl mb-4">💝</div>
                <p className="text-gray-500 mb-4">No donations made yet</p>
                <button
                  onClick={() => setActiveTab('campaigns')}
                  className="px-6 py-3 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition"
                >
                  Browse Campaigns
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {donations.map(donation => (
                  <div key={donation.id} className="bg-white rounded-2xl p-6 shadow-sm">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="font-semibold text-gray-900">{donation.campaign_title}</h3>
                        <p className="text-sm text-gray-500 mt-1">
                          {new Date(donation.donated_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-orange-600">₹{donation.amount.toLocaleString()}</p>
                        <p className="text-xs text-gray-500 capitalize">{donation.payment_method}</p>
                      </div>
                    </div>
                    
                    {donation.message && (
                      <div className="p-3 bg-gray-50 rounded-lg mb-3">
                        <p className="text-sm text-gray-700">"{donation.message}"</p>
                      </div>
                    )}
                    
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">Transaction: {donation.transaction_id}</span>
                      {donation.anonymous && (
                        <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs">Anonymous</span>
                      )}
                    </div>
                  </div>
                ))}
                
                {/* Total Donated */}
                <div className="bg-orange-50 rounded-2xl p-6 text-center">
                  <p className="text-sm text-orange-600 mb-2">Total Donated</p>
                  <p className="text-3xl font-bold text-orange-700">
                    ₹{donations.reduce((sum, d) => sum + d.amount, 0).toLocaleString()}
                  </p>
                  <p className="text-sm text-orange-600 mt-2">Thank you for your generosity! 🙏</p>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Donate Modal */}
      {showDonateModal && selectedCampaign && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md">
            <div className="p-6 border-b">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold text-gray-900">Donate to Campaign</h3>
                <button onClick={() => setShowDonateModal(false)} className="text-gray-400 hover:text-gray-600 text-2xl">✕</button>
              </div>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="p-4 bg-gray-50 rounded-xl">
                <p className="text-sm text-gray-500 mb-1">Campaign</p>
                <p className="font-semibold text-gray-900">{selectedCampaign.title}</p>
                <p className="text-sm text-gray-600 mt-1">{selectedCampaign.organization_name}</p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Donation Amount (₹) *</label>
                <input
                  type="number"
                  value={donationForm.amount}
                  onChange={(e) => setDonationForm(prev => ({ ...prev, amount: Number(e.target.value) }))}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:border-orange-500 focus:ring-2 focus:ring-orange-100 outline-none text-lg font-semibold"
                  min="1"
                  placeholder="Enter amount"
                />
                <div className="flex gap-2 mt-2">
                  {quickAmounts.map(amount => (
                    <button
                      key={amount}
                      onClick={() => setDonationForm(prev => ({ ...prev, amount }))}
                      className={`px-3 py-1 rounded-lg text-sm font-medium transition ${
                        donationForm.amount === amount
                          ? 'bg-orange-500 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      ₹{amount}
                    </button>
                  ))}
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Payment Method</label>
                <div className="space-y-2">
                  <label className="flex items-center gap-3 p-3 border rounded-xl cursor-pointer hover:border-orange-500">
                    <input type="radio" name="payment" checked={donationForm.payment_method === 'online'} onChange={() => setDonationForm(prev => ({ ...prev, payment_method: 'online' }))} className="text-orange-500" />
                    <span>💳 Pay Online (Razorpay)</span>
                  </label>
                  <label className="flex items-center gap-3 p-3 border rounded-xl cursor-pointer hover:border-orange-500">
                    <input type="radio" name="payment" checked={donationForm.payment_method === 'wallet'} onChange={() => setDonationForm(prev => ({ ...prev, payment_method: 'wallet' }))} className="text-orange-500" />
                    <span>💵 Use Wallet</span>
                  </label>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Message (optional)</label>
                <textarea
                  value={donationForm.message}
                  onChange={(e) => setDonationForm(prev => ({ ...prev, message: e.target.value }))}
                  rows={3}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:border-orange-500 outline-none resize-none"
                  placeholder="Leave a message of support..."
                />
              </div>
              
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={donationForm.anonymous}
                  onChange={(e) => setDonationForm(prev => ({ ...prev, anonymous: e.target.checked }))}
                  className="rounded text-orange-500"
                />
                <span className="text-sm text-gray-700">Donate anonymously</span>
              </label>
            </div>
            
            <div className="p-6 border-t bg-gray-50 flex justify-end gap-3 rounded-b-2xl">
              <button
                onClick={() => setShowDonateModal(false)}
                className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleDonate}
                disabled={donating || donationForm.amount <= 0}
                className="px-6 py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition disabled:opacity-50"
              >
                {donating ? 'Processing...' : `Donate ₹${donationForm.amount.toLocaleString()}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

