/**
 * WALLET PAGE - COMPLETE IMPLEMENTATION
 * 
 * Features:
 * - Wallet balance display
 * - Top-up functionality with Razorpay
 * - Transaction history
 * - Bonus offers
 * - Wallet-to-payment integration
 * 
 * Status: ✅ P0 IMPLEMENTATION
 */

import React, { useState, useEffect } from 'react';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import { Wallet, Plus, History, Gift, ArrowUpCircle, ArrowDownCircle, Check, X } from 'lucide-react';
import { WarmpawzButton } from '../shared/design-system/WarmpawzButton';

interface Transaction {
  id: string;
  type: 'credit' | 'debit';
  amount: number;
  description: string;
  source: string;
  createdAt: string;
  balanceAfter?: number;
}

interface WalletData {
  balance: number;
  totalEarned: number;
  totalSpent: number;
  transactions: Transaction[];
}

interface TopUpOffer {
  amount: number;
  bonusPercentage: number;
  bonusAmount: number;
  totalAmount: number;
  popular?: boolean;
}

interface WalletPageProps {
  customerPhone: string;
  customerId: string;
}

export function WalletPage({ customerPhone, customerId }: WalletPageProps) {
  const [walletData, setWalletData] = useState<WalletData | null>(null);
  const [topUpOffers, setTopUpOffers] = useState<TopUpOffer[]>([]);
  const [showTopUpModal, setShowTopUpModal] = useState(false);
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null);
  const [customAmount, setCustomAmount] = useState('');
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  
  // Loyalty State
  const [loyaltyProfile, setLoyaltyProfile] = useState<any>(null);
  const [redeeming, setRedeeming] = useState(false);

  useEffect(() => {
    loadWalletData();
    loadTopUpOffers();
    loadLoyaltyProfile();
  }, [customerId]);

  const loadLoyaltyProfile = async () => {
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/customer/loyalty/profile?customerId=${customerId}`,
        { headers: { 'Authorization': `Bearer ${publicAnonKey}` } }
      );
      const data = await response.json();
      // Transform backend response structure
      if (data.profile) {
        setLoyaltyProfile({
          pointsBalance: data.profile.totalPoints || 0,
          totalPoints: data.profile.totalPoints || 0,
          lifetimePointsEarned: data.profile.lifetimePointsEarned || 0,
          lifetimePointsRedeemed: data.profile.lifetimePointsRedeemed || 0
        });
      } else {
        setLoyaltyProfile(data.profile || data);
      }
    } catch (err) {
      console.error('Error loading loyalty:', err);
    }
  };

  const redeemPoints = async () => {
    if (!loyaltyProfile || loyaltyProfile.pointsBalance < 10) {
      alert("Minimum 10 points required to redeem");
      return;
    }
    
    try {
      setRedeeming(true);
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/loyalty/redeem`,
        {
          method: 'POST',
          headers: { 
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            customerId: customerId,
            points: loyaltyProfile.pointsBalance || loyaltyProfile.totalPoints || 0
          })
        }
      );
      
      const data = await response.json();
      if (data.success) {
        const pointsRedeemed = data.pointsRedeemed || data.redeemed || 0;
        const cashValue = data.cashValue || data.walletCredited || 0;
        alert(`Successfully redeemed ${pointsRedeemed} points for ₹${cashValue}!`);
        loadWalletData();
        loadLoyaltyProfile();
      } else {
        alert(data.error || 'Redemption failed');
      }
    } catch (err) {
      console.error('Redeem error:', err);
    } finally {
      setRedeeming(false);
    }
  };

  const loadWalletData = async () => {
    try {
      setLoading(true);
      // ✅ FIX: Use Batch 14 SQL-migrated wallet endpoint with customerId
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/customer/${customerId}/wallet`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        throw new Error('Failed to load wallet data');
      }

      const data = await response.json();
      setWalletData(data);
    } catch (err) {
      console.error('Error loading wallet:', err);
      setError('Failed to load wallet data');
    } finally {
      setLoading(false);
    }
  };

  const loadTopUpOffers = async () => {
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/customer/${customerId}/wallet/topup-offers`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        throw new Error('Failed to load offers');
      }

      const data = await response.json();
      setTopUpOffers(data.offers || []);
    } catch (err) {
      console.error('Error loading offers:', err);
    }
  };

  const initiateTopUp = async (amount: number) => {
    try {
      setProcessing(true);
      setError(null);

      // Initiate top-up
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/customer/${customerId}/wallet/topup/initiate`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            amount
          })
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to initiate top-up');
      }

      const data = await response.json();

      // Load Razorpay script
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.async = true;
      document.body.appendChild(script);

      script.onload = () => {
        const options = {
          key: data.razorpayKeyId,
          amount: data.razorpayOrder.amount,
          currency: 'INR',
          name: 'Warmpawz',
          description: 'Wallet Top-Up',
          order_id: data.razorpayOrder.id,
          handler: async (response: any) => {
            await verifyTopUp(data.transactionId, response);
          },
          prefill: {
            contact: customerPhone
          },
          theme: {
            color: '#FF6B6B'
          },
          modal: {
            ondismiss: () => {
              setProcessing(false);
              setError('Payment cancelled');
            }
          }
        };

        const rzp = new (window as any).Razorpay(options);
        rzp.open();
      };
    } catch (err: any) {
      console.error('Error initiating top-up:', err);
      setError(err.message || 'Failed to initiate top-up');
      setProcessing(false);
    }
  };

  const verifyTopUp = async (transactionId: string, razorpayResponse: any) => {
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/customer/${customerId}/wallet/topup/verify`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            transactionId,
            razorpayPaymentId: razorpayResponse.razorpay_payment_id,
            razorpayOrderId: razorpayResponse.razorpay_order_id,
            razorpaySignature: razorpayResponse.razorpay_signature
          })
        }
      );

      if (!response.ok) {
        throw new Error('Payment verification failed');
      }

      const data = await response.json();

      // Success!
      setShowTopUpModal(false);
      setSelectedAmount(null);
      setCustomAmount('');
      await loadWalletData();
      alert(`✅ Top-up successful! ₹${data.amountCredited} credited to your wallet`);
    } catch (err: any) {
      console.error('Error verifying top-up:', err);
      setError(err.message || 'Payment verification failed');
    } finally {
      setProcessing(false);
    }
  };

  const handleTopUpClick = (amount: number) => {
    setSelectedAmount(amount);
    initiateTopUp(amount);
  };

  const handleCustomTopUp = () => {
    const amount = parseInt(customAmount);
    if (amount < 100 || amount > 10000) {
      setError('Amount must be between ₹100 and ₹10,000');
      return;
    }
    initiateTopUp(amount);
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
      {/* Wallet Balance Card */}
      <div className="bg-gradient-to-br from-orange-500 to-pink-500 rounded-2xl p-6 text-white shadow-lg mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Wallet className="w-6 h-6" />
            <span className="text-sm opacity-90">Wallet Balance</span>
          </div>
          <WarmpawzButton
            variant="outlined"
            onClick={() => setShowTopUpModal(true)}
            icon={Plus}
            iconPosition="left"
            style={{ 
              background: 'rgba(255, 255, 255, 0.2)',
              color: 'white',
              border: 'none'
            }}
          >
            Top Up
          </WarmpawzButton>
        </div>
        
        <div className="text-4xl mb-6">
          ₹{walletData?.balance.toLocaleString('en-IN') || '0'}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-xs opacity-75 mb-1">Total Earned</div>
            <div className="text-lg">₹{walletData?.totalEarned.toLocaleString('en-IN') || '0'}</div>
          </div>
          <div>
            <div className="text-xs opacity-75 mb-1">Total Spent</div>
            <div className="text-lg">₹{walletData?.totalSpent.toLocaleString('en-IN') || '0'}</div>
          </div>
        </div>
      </div>

      {/* Loyalty Points Card */}
      {loyaltyProfile && (
        <div className="bg-white rounded-xl p-4 shadow-sm mb-6 border border-orange-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center border-2 border-yellow-200">
                <Gift className="w-6 h-6 text-yellow-600" />
              </div>
              <div>
                <div className="text-sm text-gray-500">Loyalty Points</div>
                <div className="text-2xl font-bold text-gray-900">{loyaltyProfile.pointsBalance} <span className="text-sm font-normal text-gray-400">Pawints</span></div>
              </div>
            </div>
            <WarmpawzButton
              variant="solid"
              onClick={redeemPoints}
              disabled={redeeming || loyaltyProfile.pointsBalance < 10}
              style={{ 
                background: '#111827',
                color: 'white'
              }}
            >
              {redeeming ? '...' : 'Redeem to Wallet'}
            </WarmpawzButton>
          </div>
          <div className="mt-3 text-xs text-gray-500 bg-gray-50 p-2 rounded-lg">
            1 Pawint = ₹1 • Minimum redemption: 10 Points
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="bg-white rounded-xl p-4 shadow-sm mb-6">
        <h3 className="text-sm font-medium text-gray-700 mb-3">Quick Actions</h3>
        <div className="grid grid-cols-2 gap-3">
          <WarmpawzButton
            variant="outlined"
            onClick={() => setShowTopUpModal(true)}
            icon={ArrowUpCircle}
            iconPosition="left"
            fullWidth
            style={{ 
              background: '#FFF7ED',
              borderColor: '#FED7AA',
              color: '#9A3412',
              flexDirection: 'column',
              padding: '1rem',
              gap: '0.5rem'
            }}
          >
            Add Money
          </WarmpawzButton>
          <WarmpawzButton
            variant="outlined"
            onClick={() => setShowHistory(true)}
            icon={History}
            iconPosition="left"
            fullWidth
            style={{ 
              background: '#F9FAFB',
              borderColor: '#E5E7EB',
              color: '#374151',
              flexDirection: 'column',
              padding: '1rem',
              gap: '0.5rem'
            }}
          >
            History
          </WarmpawzButton>
        </div>
      </div>

      {/* Recent Transactions */}
      <div className="bg-white rounded-xl p-4 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-medium text-gray-900">Recent Transactions</h3>
          <WarmpawzButton
            variant="outlined"
            onClick={() => setShowHistory(true)}
            style={{ 
              background: 'transparent',
              border: 'none',
              color: '#F97316',
              padding: 0,
              fontSize: '0.875rem'
            }}
          >
            View All
          </WarmpawzButton>
        </div>

        <div className="space-y-3">
          {walletData?.transactions?.slice(0, 5).map((txn) => (
            <div key={txn.id} className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  txn.type === 'credit' ? 'bg-green-50' : 'bg-red-50'
                }`}>
                  {txn.type === 'credit' ? (
                    <ArrowDownCircle className="w-5 h-5 text-green-600" />
                  ) : (
                    <ArrowUpCircle className="w-5 h-5 text-red-600" />
                  )}
                </div>
                <div>
                  <div className="font-medium text-gray-900">{txn.description}</div>
                  <div className="text-xs text-gray-500">
                    {new Date(txn.createdAt).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </div>
                </div>
              </div>
              <div className={`font-semibold ${
                txn.type === 'credit' ? 'text-green-600' : 'text-red-600'
              }`}>
                {txn.type === 'credit' ? '+' : '-'}₹{txn.amount.toLocaleString('en-IN')}
              </div>
            </div>
          ))}

          {(!walletData?.transactions || walletData.transactions.length === 0) && (
            <div className="text-center py-8 text-gray-500">
              <Wallet className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>No transactions yet</p>
            </div>
          )}
        </div>
      </div>

      {/* Top-Up Modal */}
      {showTopUpModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center">
          <div className="bg-white rounded-t-3xl sm:rounded-2xl w-full sm:max-w-md max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold">Add Money to Wallet</h2>
              <WarmpawzButton
                variant="icon"
                onClick={() => {
                  setShowTopUpModal(false);
                  setSelectedAmount(null);
                  setCustomAmount('');
                  setError(null);
                }}
                aria-label="Close top-up modal"
                style={{ 
                  color: '#6B7280',
                  background: 'transparent'
                }}
              >
                <X className="w-6 h-6" />
              </WarmpawzButton>
            </div>

            <div className="p-6">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
                  {error}
                </div>
              )}

              {/* Predefined Amounts */}
              <div className="mb-6">
                <h3 className="text-sm font-medium text-gray-700 mb-3">Choose Amount</h3>
                <div className="grid grid-cols-3 gap-3">
                  {topUpOffers.map((offer) => (
                    <WarmpawzButton
                      key={offer.amount}
                      variant={selectedAmount === offer.amount ? 'solid' : 'outlined'}
                      onClick={() => handleTopUpClick(offer.amount)}
                      disabled={processing}
                      style={{
                        position: 'relative',
                        padding: '1rem',
                        borderWidth: '2px',
                        borderColor: selectedAmount === offer.amount ? '#F97316' : '#E5E7EB',
                        backgroundColor: selectedAmount === offer.amount ? '#FFF7ED' : 'white',
                        ...(offer.popular ? { boxShadow: '0 0 0 2px rgba(249, 115, 22, 0.3)' } : {})
                      }}
                      aria-label={`Select ₹${offer.amount} top-up amount`}
                    >
                      {offer.popular && (
                        <div className="absolute -top-2 left-1/2 transform -translate-x-1/2 bg-orange-500 text-white text-xs px-2 py-0.5 rounded-full">
                          Popular
                        </div>
                      )}
                      <div className="font-semibold text-gray-900">₹{offer.amount}</div>
                      {offer.bonusPercentage > 0 && (
                        <div className="flex items-center gap-1 text-xs text-green-600 mt-1">
                          <Gift className="w-3 h-3" />
                          <span>+₹{offer.bonusAmount}</span>
                        </div>
                      )}
                    </WarmpawzButton>
                  ))}
                </div>
              </div>

              {/* Custom Amount */}
              <div className="mb-6">
                <h3 className="text-sm font-medium text-gray-700 mb-3">Or Enter Custom Amount</h3>
                <div className="flex gap-3">
                  <input
                    type="number"
                    placeholder="Enter amount (₹100 - ₹10,000)"
                    value={customAmount}
                    onChange={(e) => setCustomAmount(e.target.value)}
                    className="flex-1 border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-orange-500"
                    min="100"
                    max="10000"
                  />
                  <WarmpawzButton
                    variant="solid"
                    onClick={handleCustomTopUp}
                    disabled={processing || !customAmount}
                  >
                    Add
                  </WarmpawzButton>
                </div>
                <p className="text-xs text-gray-500 mt-2">Minimum: ₹100 | Maximum: ₹10,000</p>
              </div>

              {/* Bonus Information */}
              {topUpOffers.some(o => o.bonusPercentage > 0) && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-start gap-2">
                    <Gift className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-green-700">
                      <div className="font-medium mb-1">🎉 Bonus Offer!</div>
                      <div>Get extra cashback on top-ups. Higher amounts get bigger bonuses!</div>
                    </div>
                  </div>
                </div>
              )}

              {processing && (
                <div className="mt-4 text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500 mx-auto mb-2"></div>
                  <p className="text-sm text-gray-600">Processing payment...</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Transaction History Modal */}
      {showHistory && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center">
          <div className="bg-white rounded-t-3xl sm:rounded-2xl w-full sm:max-w-md max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold">Transaction History</h2>
              <WarmpawzButton
                variant="icon"
                onClick={() => setShowHistory(false)}
                aria-label="Close transaction history modal"
                style={{ 
                  color: '#6B7280',
                  background: 'transparent'
                }}
              >
                <X className="w-6 h-6" />
              </WarmpawzButton>
            </div>

            <div className="p-4">
              <div className="space-y-3">
                {walletData?.transactions?.map((txn) => (
                  <div key={txn.id} className="bg-white border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {txn.type === 'credit' ? (
                          <ArrowDownCircle className="w-5 h-5 text-green-600" />
                        ) : (
                          <ArrowUpCircle className="w-5 h-5 text-red-600" />
                        )}
                        <span className="font-medium text-gray-900">{txn.description}</span>
                      </div>
                      <span className={`font-semibold ${
                        txn.type === 'credit' ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {txn.type === 'credit' ? '+' : '-'}₹{txn.amount.toLocaleString('en-IN')}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <span>{txn.source}</span>
                      <span>
                        {new Date(txn.createdAt).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                    </div>
                    {txn.balanceAfter !== undefined && (
                      <div className="mt-2 pt-2 border-t border-gray-100 text-xs text-gray-600">
                        Balance: ₹{txn.balanceAfter.toLocaleString('en-IN')}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default WalletPage;
