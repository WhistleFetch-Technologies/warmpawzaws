import { useState, useEffect } from 'react';
import { ArrowLeft, Wallet, TrendingUp, TrendingDown, RefreshCw, Calendar, DollarSign } from 'lucide-react';
import { Button } from '../ui/button';
import { projectId, publicAnonKey } from '../../utils/supabase/info';

interface WalletViewProps {
  customerId: string;
  onBack: () => void;
}

export function WalletView({ customerId, onBack }: WalletViewProps) {
  const [wallet, setWallet] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475`;

  useEffect(() => {
    loadWalletData();
  }, [customerId]);

  const loadWalletData = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `${API_BASE}/wallet/${customerId}`,
        {
          headers: { 'Authorization': `Bearer ${publicAnonKey}` }
        }
      );

      if (response.ok) {
        const data = await response.json();
        setWallet(data.wallet);
        setTransactions(data.transactions);
      } else {
        console.error('Failed to load wallet data');
      }
    } catch (error) {
      console.error('Error loading wallet:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 w-full max-w-[430px] mx-auto flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF8C42] mx-auto mb-4"></div>
          <p className="text-gray-600">Loading wallet...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 w-full max-w-[430px] mx-auto pb-24">
      {/* Header */}
      <div className="bg-gradient-to-br from-[#FF8C42] to-[#FF7029] text-white px-6 pt-8 pb-6 sticky top-0 z-10">
        <button onClick={onBack} className="mb-4 flex items-center gap-2">
          <ArrowLeft className="w-5 h-5" />
          <span>Back</span>
        </button>
        <div>
          <h1 className="text-2xl text-white mb-1">My Wallet</h1>
          <p className="text-sm text-white/80">Manage your wallet balance</p>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Balance Card */}
        <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl p-6 text-white shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Wallet className="w-6 h-6" />
              <span className="text-sm opacity-90">Available Balance</span>
            </div>
            <button onClick={loadWalletData} className="text-white/80 hover:text-white">
              <RefreshCw className="w-5 h-5" />
            </button>
          </div>
          <div className="text-4xl mb-6">
            ₹{wallet?.balance?.toLocaleString('en-IN') || '0'}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs opacity-80 mb-1">Total Earned</p>
              <p className="text-lg">₹{wallet?.totalEarned?.toLocaleString('en-IN') || '0'}</p>
            </div>
            <div>
              <p className="text-xs opacity-80 mb-1">Total Spent</p>
              <p className="text-lg">₹{wallet?.totalSpent?.toLocaleString('en-IN') || '0'}</p>
            </div>
          </div>
        </div>

        {/* Info Card */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <h3 className="text-blue-900 mb-2 flex items-center gap-2">
            <DollarSign className="w-4 h-4" />
            How to use wallet?
          </h3>
          <ul className="space-y-1 text-sm text-blue-800">
            <li>• Use wallet balance for any pet service booking</li>
            <li>• Get 100% refund to wallet on cancellations</li>
            <li>• Earn cashback on completed services</li>
            <li>• No expiry on wallet balance</li>
          </ul>
        </div>

        {/* Transactions */}
        <div>
          <h2 className="text-gray-900 mb-3 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-[#FF8C42]" />
            Transaction History
          </h2>

          {transactions.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-xl border-2 border-dashed border-gray-200">
              <Wallet className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-600 mb-1">No transactions yet</p>
              <p className="text-sm text-gray-500">Your wallet transactions will appear here</p>
            </div>
          ) : (
            <div className="space-y-3">
              {transactions.map((txn) => (
                <div key={txn.id} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        {txn.type === 'credit' ? (
                          <TrendingUp className="w-5 h-5 text-green-500" />
                        ) : (
                          <TrendingDown className="w-5 h-5 text-red-500" />
                        )}
                        <span className={`${
                          txn.type === 'credit' ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {txn.type === 'credit' ? '+' : '-'}₹{txn.amount}
                        </span>
                      </div>
                      <p className="text-sm text-gray-900">{txn.description}</p>
                      {txn.source && (
                        <p className="text-xs text-gray-500 mt-1">
                          Source: {txn.source === 'refund' ? '🔄 Refund' :
                                   txn.source === 'cashback' ? '🎁 Cashback' :
                                   txn.source === 'promo' ? '🎉 Promo' :
                                   txn.source}
                        </p>
                      )}
                      {txn.purpose && (
                        <p className="text-xs text-gray-500 mt-1">
                          Purpose: {txn.purpose}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-xs text-gray-500 pt-2 border-t border-gray-100">
                    <span>{formatDate(txn.timestamp)} • {formatTime(txn.timestamp)}</span>
                    <span className="text-gray-700">Balance: ₹{txn.balanceAfter}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
