import { useState, useEffect } from 'react';
import { 
  DollarSign, TrendingUp, Award, CreditCard, 
  CheckCircle, Clock, XCircle, Download, 
  ArrowUp, Info, Star, Zap, Crown 
} from 'lucide-react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { projectId, publicAnonKey } from '../../utils/supabase/info';

interface SettlementTierDashboardProps {
  vendorId: string;
}

export function SettlementTierDashboard({ vendorId }: SettlementTierDashboardProps) {
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'history' | 'tier'>('overview');
  
  // Tier data
  const [tierInfo, setTierInfo] = useState<any>(null);
  
  // Settlement data
  const [analytics, setAnalytics] = useState<any>(null);
  const [settlementHistory, setSettlementHistory] = useState<any[]>([]);
  
  // Bank account
  const [bankAccount, setBankAccount] = useState<any>(null);
  const [showBankForm, setShowBankForm] = useState(false);
  const [bankFormData, setBankFormData] = useState({
    accountNumber: '',
    ifscCode: '',
    accountHolderName: '',
    bankName: ''
  });

  const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475`;

  useEffect(() => {
    loadData();
  }, [vendorId]);

  const loadData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchTierInfo(),
        fetchAnalytics(),
        fetchSettlementHistory(),
        fetchBankAccount()
      ]);
    } catch (error) {
      console.error('Failed to load settlement data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTierInfo = async () => {
    try {
      const response = await fetch(`${API_BASE}/settlement/vendor/${vendorId}/tier`, {
        headers: { 'Authorization': `Bearer ${publicAnonKey}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setTierInfo(data.tier);
        }
      }
    } catch (error) {
      console.error('Failed to fetch tier info:', error);
    }
  };

  const fetchAnalytics = async () => {
    try {
      const response = await fetch(`${API_BASE}/settlement/vendor/${vendorId}/analytics?period=month`, {
        headers: { 'Authorization': `Bearer ${publicAnonKey}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setAnalytics(data.analytics);
        }
      }
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
    }
  };

  const fetchSettlementHistory = async () => {
    try {
      const response = await fetch(`${API_BASE}/settlement/vendor/${vendorId}/history?limit=10`, {
        headers: { 'Authorization': `Bearer ${publicAnonKey}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setSettlementHistory(data.settlements || []);
        }
      }
    } catch (error) {
      console.error('Failed to fetch settlement history:', error);
    }
  };

  const fetchBankAccount = async () => {
    try {
      const response = await fetch(`${API_BASE}/settlement/vendor/${vendorId}/bank-account`, {
        headers: { 'Authorization': `Bearer ${publicAnonKey}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setBankAccount(data.bankAccount);
        }
      }
    } catch (error) {
      console.error('Failed to fetch bank account:', error);
    }
  };

  const handleBankAccountSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const response = await fetch(`${API_BASE}/settlement/vendor/${vendorId}/bank-account/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${publicAnonKey}`
        },
        body: JSON.stringify(bankFormData)
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setBankAccount(data.bankAccount);
          setShowBankForm(false);
          setBankFormData({
            accountNumber: '',
            ifscCode: '',
            accountHolderName: '',
            bankName: ''
          });
          alert('Bank account verified successfully!');
        }
      }
    } catch (error) {
      console.error('Failed to verify bank account:', error);
      alert('Failed to verify bank account. Please try again.');
    }
  };

  const handleTierUpgrade = async () => {
    if (!tierInfo || !tierInfo.nextTier) return;
    
    const confirmed = confirm(
      `Upgrade to ${tierInfo.nextTier} tier for ₹${tierInfo.upgradeRequirements.upgradeCost}?\n\n` +
      `Benefits:\n${tierInfo.upgradeRequirements.features.join('\n')}\n\n` +
      `Commission will reduce from ${tierInfo.commissionRate * 100}% to ${tierInfo.upgradeRequirements.commissionRate * 100}%`
    );
    
    if (!confirmed) return;
    
    try {
      const response = await fetch(`${API_BASE}/settlement/vendor/${vendorId}/tier/upgrade`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${publicAnonKey}`
        },
        body: JSON.stringify({
          targetTier: tierInfo.nextTier,
          paymentMethod: 'wallet' // In production, integrate with payment gateway
        })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          alert(`Successfully upgraded to ${tierInfo.nextTier} tier!`);
          await loadData(); // Reload all data
        }
      }
    } catch (error) {
      console.error('Failed to upgrade tier:', error);
      alert('Failed to upgrade tier. Please try again.');
    }
  };

  if (loading) {
    return (
      <div className="py-12 text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
        <p className="text-gray-500">Loading settlement dashboard...</p>
      </div>
    );
  }

  const getTierIcon = (tier: string) => {
    switch (tier) {
      case 'basic': return <Star className="w-5 h-5 text-gray-500" />;
      case 'premium': return <Zap className="w-5 h-5 text-purple-500" />;
      case 'enterprise': return <Crown className="w-5 h-5 text-yellow-500" />;
      default: return <Star className="w-5 h-5" />;
    }
  };

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'basic': return 'text-gray-600 bg-gray-100';
      case 'premium': return 'text-purple-600 bg-purple-100';
      case 'enterprise': return 'text-yellow-600 bg-yellow-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'processing': return <Clock className="w-5 h-5 text-yellow-600" />;
      case 'failed': return <XCircle className="w-5 h-5 text-red-600" />;
      default: return <Clock className="w-5 h-5 text-gray-600" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Settlement & Tier Management</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage your settlements, view earnings, and upgrade your tier
          </p>
        </div>
        
        {tierInfo && tierInfo.canUpgrade && (
          <Button onClick={handleTierUpgrade} className="bg-gradient-to-r from-purple-600 to-blue-600 text-white">
            <ArrowUp className="w-4 h-4 mr-2" />
            Upgrade to {tierInfo.nextTier}
          </Button>
        )}
      </div>

      {/* Tier Badge */}
      {tierInfo && (
        <Card className="p-6 bg-gradient-to-r from-blue-50 to-purple-50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {getTierIcon(tierInfo.current)}
              <div>
                <p className="text-sm text-gray-600">Current Tier</p>
                <p className={`text-2xl font-bold ${getTierColor(tierInfo.current).split(' ')[0]}`}>
                  {tierInfo.name}
                </p>
              </div>
            </div>
            
            <div className="text-right">
              <p className="text-sm text-gray-600">Commission Rate</p>
              <p className="text-2xl font-bold text-gray-900">
                {(tierInfo.commissionRate * 100).toFixed(0)}%
              </p>
            </div>
          </div>
          
          <div className="mt-4 flex flex-wrap gap-2">
            {tierInfo.features.map((feature: string, idx: number) => (
              <span
                key={idx}
                className={`px-3 py-1 text-xs font-medium rounded-full ${getTierColor(tierInfo.current)}`}
              >
                {feature}
              </span>
            ))}
          </div>
        </Card>
      )}

      {/* Bank Account Status */}
      {!bankAccount && (
        <Card className="p-6 bg-yellow-50 border-yellow-200">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-yellow-600 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold text-yellow-900">Bank Account Required</p>
              <p className="text-sm text-yellow-700 mt-1">
                Add your bank account details to receive settlements
              </p>
              <Button
                onClick={() => setShowBankForm(true)}
                variant="outline"
                size="sm"
                className="mt-3"
              >
                Add Bank Account
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Bank Account Form */}
      {showBankForm && (
        <Card className="p-6">
          <h3 className="font-bold text-gray-900 mb-4">Add Bank Account</h3>
          <form onSubmit={handleBankAccountSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Account Holder Name
              </label>
              <input
                type="text"
                required
                value={bankFormData.accountHolderName}
                onChange={(e) => setBankFormData({ ...bankFormData, accountHolderName: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                placeholder="Enter account holder name"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Account Number
              </label>
              <input
                type="text"
                required
                value={bankFormData.accountNumber}
                onChange={(e) => setBankFormData({ ...bankFormData, accountNumber: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                placeholder="Enter account number"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                IFSC Code
              </label>
              <input
                type="text"
                required
                value={bankFormData.ifscCode}
                onChange={(e) => setBankFormData({ ...bankFormData, ifscCode: e.target.value.toUpperCase() })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                placeholder="e.g., SBIN0001234"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Bank Name
              </label>
              <input
                type="text"
                value={bankFormData.bankName}
                onChange={(e) => setBankFormData({ ...bankFormData, bankName: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                placeholder="Enter bank name"
              />
            </div>
            
            <div className="flex gap-3">
              <Button type="submit" className="flex-1">Verify Account</Button>
              <Button type="button" variant="outline" onClick={() => setShowBankForm(false)}>
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-4 py-3 text-sm font-medium transition-colors ${
            activeTab === 'overview'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Overview
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`px-4 py-3 text-sm font-medium transition-colors ${
            activeTab === 'history'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Settlement History
        </button>
        <button
          onClick={() => setActiveTab('tier')}
          className={`px-4 py-3 text-sm font-medium transition-colors ${
            activeTab === 'tier'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Tier Benefits
        </button>
      </div>

      {/* Tab Content */}
      <div className="mt-6">
        {/* Overview Tab */}
        {activeTab === 'overview' && analytics && (
          <div className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm text-gray-600">Total Revenue</p>
                  <DollarSign className="w-5 h-5 text-green-600" />
                </div>
                <p className="text-2xl font-bold text-gray-900">
                  ₹{analytics.totalRevenue.toLocaleString()}
                </p>
                <p className="text-xs text-gray-500 mt-1">All time</p>
              </Card>

              <Card className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm text-gray-600">This Month</p>
                  <TrendingUp className="w-5 h-5 text-blue-600" />
                </div>
                <p className="text-2xl font-bold text-gray-900">
                  ₹{analytics.periodRevenue.toLocaleString()}
                </p>
                <p className="text-xs text-gray-500 mt-1">{analytics.periodCount} settlements</p>
              </Card>

              <Card className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm text-gray-600">Avg Settlement</p>
                  <CreditCard className="w-5 h-5 text-purple-600" />
                </div>
                <p className="text-2xl font-bold text-gray-900">
                  ₹{Math.round(analytics.avgSettlement).toLocaleString()}
                </p>
                <p className="text-xs text-gray-500 mt-1">Per settlement</p>
              </Card>

              <Card className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm text-gray-600">Commission Saved</p>
                  <Award className="w-5 h-5 text-yellow-600" />
                </div>
                <p className="text-2xl font-bold text-gray-900">
                  ₹{Math.round(analytics.commissionSaved).toLocaleString()}
                </p>
                <p className="text-xs text-gray-500 mt-1">vs Basic tier</p>
              </Card>
            </div>

            {/* Bank Account Info */}
            {bankAccount && (
              <Card className="p-6">
                <h3 className="font-bold text-gray-900 mb-4">Bank Account</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">Account Holder</p>
                    <p className="font-semibold text-gray-900">{bankAccount.accountHolderName}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Account Number</p>
                    <p className="font-semibold text-gray-900">{bankAccount.accountNumber}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">IFSC Code</p>
                    <p className="font-semibold text-gray-900">{bankAccount.ifscCode}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Status</p>
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded-full">
                      <CheckCircle className="w-3 h-3" />
                      Verified
                    </span>
                  </div>
                </div>
              </Card>
            )}

            {/* Upgrade Prompt */}
            {tierInfo && tierInfo.canUpgrade && (
              <Card className="p-6 bg-gradient-to-r from-purple-50 to-blue-50 border-purple-200">
                <div className="flex items-start gap-4">
                  <div className="flex-1">
                    <h3 className="font-bold text-gray-900 mb-2">
                      Upgrade to {tierInfo.nextTier} Tier
                    </h3>
                    <p className="text-sm text-gray-600 mb-3">
                      You're eligible for an upgrade! Reduce your commission rate from{' '}
                      {(tierInfo.commissionRate * 100).toFixed(0)}% to{' '}
                      {(tierInfo.upgradeRequirements.commissionRate * 100).toFixed(0)}%
                    </p>
                    <ul className="space-y-2 mb-4">
                      {tierInfo.upgradeRequirements.features.map((feature: string, idx: number) => (
                        <li key={idx} className="flex items-center gap-2 text-sm text-gray-700">
                          <CheckCircle className="w-4 h-4 text-green-600" />
                          {feature}
                        </li>
                      ))}
                    </ul>
                    <Button onClick={handleTierUpgrade} className="bg-purple-600 hover:bg-purple-700">
                      Upgrade for ₹{tierInfo.upgradeRequirements.upgradeCost.toLocaleString()}
                    </Button>
                  </div>
                </div>
              </Card>
            )}
          </div>
        )}

        {/* Settlement History Tab */}
        {activeTab === 'history' && (
          <div className="space-y-4">
            {settlementHistory.length === 0 ? (
              <Card className="p-12 text-center">
                <DollarSign className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-600">No settlements yet</p>
                <p className="text-sm text-gray-500 mt-1">
                  Your settlements will appear here once processed
                </p>
              </Card>
            ) : (
              settlementHistory.map((settlement) => (
                <Card key={settlement.id} className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4 flex-1">
                      {getStatusIcon(settlement.status)}
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-gray-900">
                            ₹{settlement.amount.toLocaleString()}
                          </p>
                          <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${getTierColor(settlement.tier)}`}>
                            {settlement.tier}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 mt-1">
                          {settlement.bookingCount || settlement.bookingIds?.length || 0} bookings
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          {settlement.processedAt
                            ? new Date(settlement.processedAt).toLocaleDateString('en-IN', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })
                            : 'Processing...'}
                        </p>
                      </div>
                    </div>
                    
                    <div className="text-right">
                      <p className="text-xs text-gray-500">Commission ({(settlement.commissionRate * 100).toFixed(0)}%)</p>
                      <p className="text-sm font-semibold text-gray-700">
                        -₹{((settlement.amount / (1 - settlement.commissionRate)) * settlement.commissionRate).toFixed(2)}
                      </p>
                    </div>
                  </div>
                </Card>
              ))
            )}
          </div>
        )}

        {/* Tier Benefits Tab */}
        {activeTab === 'tier' && tierInfo && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Basic Tier */}
            <Card className={`p-6 ${tierInfo.current === 'basic' ? 'ring-2 ring-gray-500' : ''}`}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Star className="w-6 h-6 text-gray-500" />
                  <h3 className="font-bold text-gray-900">Basic</h3>
                </div>
                {tierInfo.current === 'basic' && (
                  <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs font-semibold rounded-full">
                    Current
                  </span>
                )}
              </div>
              
              <p className="text-3xl font-bold text-gray-900 mb-1">20%</p>
              <p className="text-sm text-gray-600 mb-4">Commission</p>
              
              <ul className="space-y-2">
                <li className="flex items-center gap-2 text-sm text-gray-700">
                  <CheckCircle className="w-4 h-4 text-gray-500" />
                  Basic listing
                </li>
                <li className="flex items-center gap-2 text-sm text-gray-700">
                  <CheckCircle className="w-4 h-4 text-gray-500" />
                  Standard support
                </li>
                <li className="flex items-center gap-2 text-sm text-gray-700">
                  <CheckCircle className="w-4 h-4 text-gray-500" />
                  Monthly settlements
                </li>
              </ul>
            </Card>

            {/* Premium Tier */}
            <Card className={`p-6 ${tierInfo.current === 'premium' ? 'ring-2 ring-purple-500' : ''}`}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Zap className="w-6 h-6 text-purple-500" />
                  <h3 className="font-bold text-gray-900">Premium</h3>
                </div>
                {tierInfo.current === 'premium' && (
                  <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs font-semibold rounded-full">
                    Current
                  </span>
                )}
              </div>
              
              <p className="text-3xl font-bold text-gray-900 mb-1">15%</p>
              <p className="text-sm text-gray-600 mb-4">Commission</p>
              
              <ul className="space-y-2 mb-4">
                <li className="flex items-center gap-2 text-sm text-gray-700">
                  <CheckCircle className="w-4 h-4 text-purple-500" />
                  Priority listing
                </li>
                <li className="flex items-center gap-2 text-sm text-gray-700">
                  <CheckCircle className="w-4 h-4 text-purple-500" />
                  Priority support
                </li>
                <li className="flex items-center gap-2 text-sm text-gray-700">
                  <CheckCircle className="w-4 h-4 text-purple-500" />
                  Weekly settlements
                </li>
                <li className="flex items-center gap-2 text-sm text-gray-700">
                  <CheckCircle className="w-4 h-4 text-purple-500" />
                  Analytics dashboard
                </li>
              </ul>
              
              {tierInfo.current === 'basic' && (
                <Button
                  onClick={handleTierUpgrade}
                  className="w-full bg-purple-600 hover:bg-purple-700"
                  disabled={!tierInfo.canUpgrade}
                >
                  Upgrade - ₹5,000
                </Button>
              )}
            </Card>

            {/* Enterprise Tier */}
            <Card className={`p-6 ${tierInfo.current === 'enterprise' ? 'ring-2 ring-yellow-500' : ''}`}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Crown className="w-6 h-6 text-yellow-500" />
                  <h3 className="font-bold text-gray-900">Enterprise</h3>
                </div>
                {tierInfo.current === 'enterprise' && (
                  <span className="px-2 py-1 bg-yellow-100 text-yellow-700 text-xs font-semibold rounded-full">
                    Current
                  </span>
                )}
              </div>
              
              <p className="text-3xl font-bold text-gray-900 mb-1">10%</p>
              <p className="text-sm text-gray-600 mb-4">Commission</p>
              
              <ul className="space-y-2 mb-4">
                <li className="flex items-center gap-2 text-sm text-gray-700">
                  <CheckCircle className="w-4 h-4 text-yellow-500" />
                  Featured listing
                </li>
                <li className="flex items-center gap-2 text-sm text-gray-700">
                  <CheckCircle className="w-4 h-4 text-yellow-500" />
                  Dedicated support
                </li>
                <li className="flex items-center gap-2 text-sm text-gray-700">
                  <CheckCircle className="w-4 h-4 text-yellow-500" />
                  Daily settlements
                </li>
                <li className="flex items-center gap-2 text-sm text-gray-700">
                  <CheckCircle className="w-4 h-4 text-yellow-500" />
                  Advanced analytics
                </li>
                <li className="flex items-center gap-2 text-sm text-gray-700">
                  <CheckCircle className="w-4 h-4 text-yellow-500" />
                  Custom branding
                </li>
              </ul>
              
              {tierInfo.current === 'premium' && (
                <Button
                  onClick={handleTierUpgrade}
                  className="w-full bg-yellow-600 hover:bg-yellow-700"
                  disabled={!tierInfo.canUpgrade}
                >
                  Upgrade - ₹15,000
                </Button>
              )}
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
