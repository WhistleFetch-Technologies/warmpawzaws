'use client';

import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, Wallet, Plus, ArrowDownLeft, ArrowUpRight, Gift, 
  Sparkles, History, TrendingUp, ChevronRight, Filter, Calendar,
  CreditCard, Shield, Clock, CheckCircle2, AlertCircle, Coins,
  ShoppingBag, Stethoscope, Scissors, Users, X, Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';

// Razorpay type declaration
declare global {
  interface Window {
    Razorpay: any;
  }
}

interface WalletData {
  balance: number;
  pending_credits: number;
  total_earned: number;
  total_spent: number;
  loyalty_points?: number;
  tier?: 'bronze' | 'silver' | 'gold' | 'platinum';
}

interface Transaction {
  id: string;
  type: 'credit' | 'debit';
  amount: number;
  description: string;
  reference_type?: string;
  reference_id?: string;
  status: 'completed' | 'pending' | 'failed';
  created_at: string;
  category?: string;
  service_name?: string;
  vendor_name?: string;
}

interface SpendingCategory {
  category: string;
  amount: number;
  count: number;
  icon: string;
  color: string;
}

interface EnhancedWalletPageProps {
  customerPhone: string;
  customerId?: string;
  onBack: () => void;
  onNavigate?: (screen: string, data?: any) => void;
}

export function EnhancedWalletPage({ 
  customerPhone, 
  customerId: propCustomerId,
  onBack,
  onNavigate 
}: EnhancedWalletPageProps) {
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [spendingByCategory, setSpendingByCategory] = useState<SpendingCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'credit' | 'debit'>('all');
  const [showTopUpModal, setShowTopUpModal] = useState(false);
  const [topUpAmount, setTopUpAmount] = useState('');
  const [processingTopUp, setProcessingTopUp] = useState(false);
  const [customerId, setCustomerId] = useState<string | null>(propCustomerId || null);
  const [activeTab, setActiveTab] = useState<'transactions' | 'insights'>('transactions');

  useEffect(() => {
    loadData();
    loadRazorpayScript();
  }, [customerPhone]);

  useEffect(() => {
    if (customerId) {
      loadTransactions();
    }
  }, [customerId, filter]);

  const loadRazorpayScript = () => {
    if (typeof window !== 'undefined' && !window.Razorpay) {
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.async = true;
      document.body.appendChild(script);
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      // Get customer ID
      const customerRes = await apiClient.get<any>(`/customer/by-phone?phone=${encodeURIComponent(customerPhone)}`);
      const id = customerRes.customer?.id;
      
      if (id) {
        setCustomerId(id);
        
        // Load wallet
        try {
          const walletRes = await apiClient.get<any>(`/wallet/${id}`);
          if (walletRes.success && walletRes.data) {
            setWallet({
              balance: walletRes.data.balance || 0,
              pending_credits: walletRes.data.pending_credits || 0,
              total_earned: walletRes.data.total_earned || 0,
              total_spent: walletRes.data.total_spent || 0,
              loyalty_points: walletRes.data.loyalty_points || 0,
              tier: walletRes.data.tier || 'bronze',
            });
          }
        } catch {
          // Fallback
          const fallback = await apiClient.get<any>(`/customer/wallet?phone=${encodeURIComponent(customerPhone)}`);
          if (fallback.wallet) {
            setWallet(fallback.wallet);
          }
        }
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadTransactions = async () => {
    if (!customerId) return;
    
    try {
      const params = new URLSearchParams();
      if (filter !== 'all') params.append('type', filter);
      params.append('limit', '50');
      
      const res = await apiClient.get<any>(`/wallet/${customerId}/transactions?${params.toString()}`);
      if (res.success && res.data) {
        setTransactions(res.data.transactions || []);
        
        // Calculate spending by category
        const spending: Record<string, SpendingCategory> = {};
        (res.data.transactions || []).forEach((t: Transaction) => {
          if (t.type === 'debit' && t.reference_type) {
            const key = t.reference_type;
            if (!spending[key]) {
              spending[key] = {
                category: key,
                amount: 0,
                count: 0,
                icon: getCategoryIcon(key),
                color: getCategoryColor(key),
              };
            }
            spending[key].amount += t.amount;
            spending[key].count += 1;
          }
        });
        setSpendingByCategory(Object.values(spending).sort((a, b) => b.amount - a.amount));
      }
    } catch (error) {
      console.error('Error loading transactions:', error);
    }
  };

  const getCategoryIcon = (category: string): string => {
    const icons: Record<string, string> = {
      'booking': '📅',
      'order': '📦',
      'vet': '🩺',
      'grooming': '✂️',
      'training': '🎓',
      'walking': '🐕',
      'boarding': '🏠',
      'pharmacy': '💊',
      'shop': '🛒',
      'topup': '💳',
      'refund': '💸',
      'cashback': '🎁',
      'referral': '👥',
    };
    return icons[category.toLowerCase()] || '💰';
  };

  const getCategoryColor = (category: string): string => {
    const colors: Record<string, string> = {
      'booking': 'bg-blue-100 text-blue-600',
      'order': 'bg-purple-100 text-purple-600',
      'vet': 'bg-red-100 text-red-600',
      'grooming': 'bg-orange-100 text-orange-600',
      'training': 'bg-yellow-100 text-yellow-600',
      'walking': 'bg-green-100 text-green-600',
      'boarding': 'bg-indigo-100 text-indigo-600',
      'pharmacy': 'bg-pink-100 text-pink-600',
      'shop': 'bg-cyan-100 text-cyan-600',
    };
    return colors[category.toLowerCase()] || 'bg-gray-100 text-gray-600';
  };

  const handleTopUp = async () => {
    const amount = parseFloat(topUpAmount);
    if (!amount || amount < 100) {
      toast.error('Minimum top-up amount is ₹100');
      return;
    }

    if (!customerId) {
      toast.error('Please refresh and try again');
      return;
    }

    setProcessingTopUp(true);
    try {
      const orderRes = await apiClient.post<any>('/razorpay/create-order', {
        amount,
        currency: 'INR',
        customerId,
      });

      if (!orderRes.orderId) {
        throw new Error('Failed to create payment order');
      }

      const options = {
        key: orderRes.keyId,
        amount: amount * 100,
        currency: 'INR',
        name: 'Warmpawz',
        description: `Add ₹${amount} to Wallet`,
        order_id: orderRes.orderId,
        handler: async (response: any) => {
          try {
            await apiClient.post<any>('/razorpay/verify-payment', {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });

            await apiClient.post<any>(`/wallet/${customerId}/credit`, {
              amount,
              referenceType: 'topup',
              referenceId: response.razorpay_payment_id,
              description: 'Wallet top-up via Razorpay',
            });

            await loadData();
            await loadTransactions();
            
            setShowTopUpModal(false);
            setTopUpAmount('');
            toast.success('Wallet topped up successfully!');
          } catch (error) {
            console.error('Error processing top-up:', error);
            toast.error('Failed to process top-up');
          } finally {
            setProcessingTopUp(false);
          }
        },
        prefill: { contact: customerPhone },
        theme: { color: '#FF8C42' },
        modal: {
          ondismiss: () => setProcessingTopUp(false),
        },
      };

      const razorpay = new window.Razorpay(options);
      razorpay.open();
    } catch (error) {
      console.error('Error initiating top-up:', error);
      toast.error('Failed to initiate top-up');
      setProcessingTopUp(false);
    }
  };

  const getTierBadge = (tier?: string) => {
    const tiers = {
      'bronze': { color: 'bg-amber-600', text: 'Bronze' },
      'silver': { color: 'bg-gray-400', text: 'Silver' },
      'gold': { color: 'bg-yellow-500', text: 'Gold' },
      'platinum': { color: 'bg-purple-500', text: 'Platinum' },
    };
    return tiers[tier as keyof typeof tiers] || tiers['bronze'];
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-amber-50 to-white flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-orange-500 mx-auto" />
          <p className="mt-4 text-gray-600">Loading wallet...</p>
        </div>
      </div>
    );
  }

  const tierBadge = getTierBadge(wallet?.tier);

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 via-white to-orange-50/30">
      {/* Header with Gold Theme */}
      <header className="bg-gradient-to-br from-amber-500 via-orange-500 to-orange-600 text-white relative overflow-hidden">
        {/* Background pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-4 left-4 w-32 h-32 rounded-full border-2 border-white/30" />
          <div className="absolute bottom-4 right-4 w-24 h-24 rounded-full border-2 border-white/30" />
          <div className="absolute top-1/2 left-1/2 w-40 h-40 rounded-full border border-white/20" />
        </div>
        
        <div className="max-w-lg mx-auto px-4 pt-4 pb-8 relative">
          {/* Top bar */}
          <div className="flex items-center justify-between mb-6">
            <button 
              onClick={onBack}
              className="w-10 h-10 rounded-full bg-white/20 backdrop-blur flex items-center justify-center"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-xl font-bold">My Wallet</h1>
            <button className="w-10 h-10 rounded-full bg-white/20 backdrop-blur flex items-center justify-center">
              <History className="w-5 h-5" />
            </button>
          </div>
          
          {/* Balance Card */}
          <div className="bg-white/10 backdrop-blur-xl rounded-3xl p-6 border border-white/20">
            {/* Tier Badge */}
            <div className="flex items-center justify-between mb-4">
              <Badge className={`${tierBadge.color} text-white px-3 py-1`}>
                <Sparkles className="w-3 h-3 mr-1" />
                {tierBadge.text} Member
              </Badge>
              {wallet?.loyalty_points && wallet.loyalty_points > 0 && (
                <div className="flex items-center gap-1 text-amber-200 text-sm">
                  <Coins className="w-4 h-4" />
                  {wallet.loyalty_points} pts
                </div>
              )}
            </div>
            
            {/* Main Balance */}
            <div className="text-center mb-6">
              <p className="text-white/70 text-sm mb-1">Available Balance</p>
              <p className="text-5xl font-bold tracking-tight">
                ₹{(wallet?.balance || 0).toLocaleString()}
              </p>
              {wallet?.pending_credits && wallet.pending_credits > 0 && (
                <div className="flex items-center justify-center gap-1 mt-2 text-amber-200 text-sm">
                  <Clock className="w-4 h-4" />
                  ₹{wallet.pending_credits.toLocaleString()} pending
                </div>
              )}
            </div>
            
            {/* Quick Stats */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white/10 rounded-2xl p-3 text-center">
                <ArrowDownLeft className="w-5 h-5 text-green-300 mx-auto mb-1" />
                <p className="text-xs text-white/70">Total Earned</p>
                <p className="font-bold">₹{(wallet?.total_earned || 0).toLocaleString()}</p>
              </div>
              <div className="bg-white/10 rounded-2xl p-3 text-center">
                <ArrowUpRight className="w-5 h-5 text-orange-300 mx-auto mb-1" />
                <p className="text-xs text-white/70">Total Spent</p>
                <p className="font-bold">₹{(wallet?.total_spent || 0).toLocaleString()}</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 -mt-4 pb-24 space-y-4">
        {/* Quick Actions */}
        <Card className="bg-white rounded-3xl p-4 shadow-lg border-0">
          <div className="grid grid-cols-4 gap-2">
            <button
              onClick={() => setShowTopUpModal(true)}
              className="flex flex-col items-center p-3 rounded-2xl bg-gradient-to-br from-orange-50 to-amber-50 
                         border-2 border-orange-200 hover:border-orange-400 transition"
            >
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-500 to-amber-500 
                              flex items-center justify-center mb-2 shadow-lg shadow-orange-500/30">
                <Plus className="w-5 h-5 text-white" />
              </div>
              <span className="text-xs font-semibold text-gray-700">Add Money</span>
            </button>
            
            <button 
              onClick={() => onNavigate?.('offers')}
              className="flex flex-col items-center p-3 rounded-2xl hover:bg-gray-50 transition"
            >
              <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center mb-2">
                <Gift className="w-5 h-5 text-green-600" />
              </div>
              <span className="text-xs font-medium text-gray-600">Offers</span>
            </button>
            
            <button 
              onClick={() => onNavigate?.('referral')}
              className="flex flex-col items-center p-3 rounded-2xl hover:bg-gray-50 transition"
            >
              <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center mb-2">
                <Users className="w-5 h-5 text-purple-600" />
              </div>
              <span className="text-xs font-medium text-gray-600">Refer</span>
            </button>
            
            <button 
              onClick={() => onNavigate?.('help')}
              className="flex flex-col items-center p-3 rounded-2xl hover:bg-gray-50 transition"
            >
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center mb-2">
                <Shield className="w-5 h-5 text-blue-600" />
              </div>
              <span className="text-xs font-medium text-gray-600">Help</span>
            </button>
          </div>
        </Card>

        {/* Tab Switcher */}
        <div className="flex bg-gray-100 rounded-2xl p-1">
          <button
            onClick={() => setActiveTab('transactions')}
            className={`flex-1 py-3 rounded-xl text-sm font-semibold transition ${
              activeTab === 'transactions' 
                ? 'bg-white shadow text-gray-900' 
                : 'text-gray-500'
            }`}
          >
            Transactions
          </button>
          <button
            onClick={() => setActiveTab('insights')}
            className={`flex-1 py-3 rounded-xl text-sm font-semibold transition ${
              activeTab === 'insights' 
                ? 'bg-white shadow text-gray-900' 
                : 'text-gray-500'
            }`}
          >
            Insights
          </button>
        </div>

        {activeTab === 'transactions' ? (
          <>
            {/* Filters */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setFilter('all')}
                className={`px-4 py-2 rounded-full text-sm font-medium transition ${
                  filter === 'all' ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setFilter('credit')}
                className={`px-4 py-2 rounded-full text-sm font-medium transition flex items-center gap-1 ${
                  filter === 'credit' ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <ArrowDownLeft className="w-4 h-4" />
                Credits
              </button>
              <button
                onClick={() => setFilter('debit')}
                className={`px-4 py-2 rounded-full text-sm font-medium transition flex items-center gap-1 ${
                  filter === 'debit' ? 'bg-red-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <ArrowUpRight className="w-4 h-4" />
                Debits
              </button>
            </div>

            {/* Transactions List */}
            <Card className="bg-white rounded-3xl overflow-hidden shadow-sm border-0">
              {transactions.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
                    <History className="w-10 h-10 text-gray-300" />
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-1">No transactions yet</h3>
                  <p className="text-gray-500 text-sm">Your wallet activity will appear here</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {transactions.map((txn) => (
                    <div key={txn.id} className="p-4 hover:bg-gray-50 transition">
                      <div className="flex items-center gap-4">
                        {/* Icon */}
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl
                          ${txn.type === 'credit' ? 'bg-green-100' : 'bg-red-50'}`}
                        >
                          {getCategoryIcon(txn.reference_type || txn.type)}
                        </div>
                        
                        {/* Details */}
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-gray-900 truncate">{txn.description}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs text-gray-500">
                              {new Date(txn.created_at).toLocaleDateString('en-IN', {
                                day: 'numeric',
                                month: 'short',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </span>
                            {txn.status === 'pending' && (
                              <Badge variant="outline" className="text-xs bg-yellow-50 text-yellow-600 border-yellow-200">
                                Pending
                              </Badge>
                            )}
                          </div>
                        </div>
                        
                        {/* Amount */}
                        <div className="text-right">
                          <p className={`font-bold text-lg ${
                            txn.type === 'credit' ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {txn.type === 'credit' ? '+' : '-'}₹{txn.amount.toLocaleString()}
                          </p>
                          {txn.status === 'completed' && (
                            <p className="text-xs text-green-600 flex items-center justify-end gap-0.5">
                              <CheckCircle2 className="w-3 h-3" />
                              Done
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </>
        ) : (
          <>
            {/* Spending Insights */}
            <Card className="bg-white rounded-3xl p-5 shadow-sm border-0">
              <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-orange-500" />
                Spending by Category
              </h3>
              
              {spendingByCategory.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-500">No spending data yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {spendingByCategory.map((cat, index) => (
                    <div key={cat.category} className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl ${cat.color}`}>
                        {cat.icon}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium text-gray-900 capitalize">{cat.category}</span>
                          <span className="font-bold text-gray-900">₹{cat.amount.toLocaleString()}</span>
                        </div>
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-gradient-to-r from-orange-400 to-amber-400 rounded-full"
                            style={{ width: `${(cat.amount / spendingByCategory[0].amount) * 100}%` }}
                          />
                        </div>
                        <p className="text-xs text-gray-500 mt-1">{cat.count} transaction{cat.count > 1 ? 's' : ''}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* Savings Card */}
            <Card className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-3xl p-5 border-2 border-green-200">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-green-500 flex items-center justify-center shadow-lg shadow-green-500/30">
                  <Sparkles className="w-7 h-7 text-white" />
                </div>
                <div>
                  <p className="text-green-800 font-bold text-lg">Great savings!</p>
                  <p className="text-green-600 text-sm">
                    You've saved ₹{Math.round((wallet?.total_earned || 0) * 0.1).toLocaleString()} through wallet cashbacks
                  </p>
                </div>
              </div>
            </Card>
          </>
        )}
      </main>

      {/* Top-up Modal */}
      {showTopUpModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end justify-center">
          <div className="bg-white w-full max-w-lg rounded-t-3xl p-6 animate-slide-up">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-gray-900">Add Money to Wallet</h3>
              <button
                onClick={() => {
                  setShowTopUpModal(false);
                  setTopUpAmount('');
                }}
                className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Enter Amount (Min ₹100)
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-bold text-gray-400">₹</span>
                <input
                  type="number"
                  min="100"
                  value={topUpAmount}
                  onChange={(e) => setTopUpAmount(e.target.value)}
                  placeholder="500"
                  className="w-full pl-10 pr-4 py-4 text-2xl font-bold border-2 border-gray-200 rounded-2xl 
                             focus:border-orange-400 focus:outline-none text-center"
                />
              </div>
            </div>

            <div className="grid grid-cols-4 gap-2 mb-6">
              {[100, 500, 1000, 2000].map((amount) => (
                <button
                  key={amount}
                  onClick={() => setTopUpAmount(amount.toString())}
                  className={`py-3 rounded-xl font-bold transition ${
                    topUpAmount === amount.toString()
                      ? 'bg-orange-500 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  ₹{amount}
                </button>
              ))}
            </div>

            <Button
              onClick={handleTopUp}
              disabled={processingTopUp || !topUpAmount || parseFloat(topUpAmount) < 100}
              className="w-full py-6 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 
                         text-white rounded-2xl font-bold text-lg disabled:opacity-50 shadow-xl shadow-orange-500/30"
            >
              {processingTopUp ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Processing...
                </span>
              ) : (
                `Add ₹${topUpAmount || '0'} to Wallet`
              )}
            </Button>

            <p className="text-center text-xs text-gray-500 mt-4 flex items-center justify-center gap-1">
              <Shield className="w-3 h-3" />
              Secured by Razorpay
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default EnhancedWalletPage;
