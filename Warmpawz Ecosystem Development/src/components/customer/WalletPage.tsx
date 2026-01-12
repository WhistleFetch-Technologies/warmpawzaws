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
 * Status: ✅ P0 IMPLEMENTATION (MockAPI Migrated)
 */

import React, { useState, useEffect } from 'react';
import MockAPI from '../../lib/mockAPI';
import { Wallet, Plus, History, Gift, ArrowUpCircle, ArrowDownCircle, Check, X } from 'lucide-react';
import { toast } from 'sonner';

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
      const response = await MockAPI.get(
        `loyalty/profile/${customerId}?type=customer`
      );
      const data = await response.json();
      setLoyaltyProfile(data.profile);
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
      const response = await MockAPI.post(
        `loyalty/redeem`,
        {
          userId: customerId,
          pointsToRedeem: loyaltyProfile.pointsBalance, // Redeem all for now
          userType: 'customer'
        }
      );
      
      const data = await response.json();
      if (data.success) {
        alert(`Successfully redeemed ${data.redeemed} points for ₹${data.walletCredited}!`);
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
      const response = await MockAPI.get(
        `customer/wallet/${customerPhone}`
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
      const response = await MockAPI.get(
        `customer/${customerId}/wallet/topup-offers`
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
      const response = await MockAPI.post(
        `customer/${customerId}/wallet/topup/initiate`,
        {
          amount,
          customerPhone
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
      const response = await MockAPI.post(
        `customer/${customerId}/wallet/topup/verify`,
        {
          transactionId,
          razorpayPaymentId: razorpayResponse.razorpay_payment_id,
          razorpayOrderId: razorpayResponse.razorpay_order_id,
          razorpaySignature: razorpayResponse.razorpay_signature
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
          <button
            onClick={() => setShowTopUpModal(true)}
            className="bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span className="text-sm">Top Up</span>
          </button>
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
            <button 
              onClick={redeemPoints}
              disabled={redeeming || loyaltyProfile.pointsBalance < 10}
              className="bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {redeeming ? '...' : 'Redeem to Wallet'}
            </button>
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
          <button
            onClick={() => setShowTopUpModal(true)}
            className="bg-orange-50 hover:bg-orange-100 border border-orange-200 rounded-lg p-4 flex flex-col items-center gap-2 transition-colors"
          >
            <ArrowUpCircle className="w-6 h-6 text-orange-500" />
            <span className="text-sm text-orange-700">Add Money</span>
          </button>
          <button
            onClick={() => setShowHistory(true)}
            className="bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg p-4 flex flex-col items-center gap-2 transition-colors"
          >
            <History className="w-6 h-6 text-gray-600" />
            <span className="text-sm text-gray-700">History</span>
          </button>
        </div>
      </div>

      {/* Recent Transactions */}
      <div className="bg-white rounded-xl p-4 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-medium text-gray-900">Recent Transactions</h3>
          <button
            onClick={() => setShowHistory(true)}
            className="text-sm text-orange-500 hover:text-orange-600"
          >
            View All
          </button>
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
              <button
                onClick={() => {
                  setShowTopUpModal(false);
                  setSelectedAmount(null);
                  setCustomAmount('');
                  setError(null);
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-6 h-6" />
              </button>
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
                    <button
                      key={offer.amount}
                      onClick={() => handleTopUpClick(offer.amount)}
                      disabled={processing}
                      className={`relative border-2 rounded-lg p-4 transition-all ${
                        selectedAmount === offer.amount
                          ? 'border-orange-500 bg-orange-50'
                          : 'border-gray-200 hover:border-orange-300'
                      } ${processing ? 'opacity-50 cursor-not-allowed' : ''} ${
                        offer.popular ? 'ring-2 ring-orange-300' : ''
                      }`}
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
                    </button>
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
                  <button
                    onClick={handleCustomTopUp}
                    disabled={processing || !customAmount}
                    className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-3 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Add
                  </button>
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
              <button
                onClick={() => setShowHistory(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-6 h-6" />
              </button>
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