'use client';

/**
 * Comprehensive Vendor Earnings & Settlement Dashboard
 * Full-featured dashboard with tier management, analytics, settlement history, and bank verification
 * Restored from Warmpawz Ecosystem Development/src/components/vendor/SettlementTierDashboard.tsx
 */

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';
import { 
  TrendingUp, Award, CreditCard, 
  CheckCircle, Clock, XCircle, Download, 
  ArrowUp, Info, Star, Zap, Crown,
  Calendar, RefreshCw, ArrowLeft, ChevronRight,
  Wallet, PiggyBank, ArrowDownLeft, ArrowUpRight,
  icons
} from 'lucide-react';

const IndianRupee = icons?.IndianRupee ?? icons?.DollarSign;
import { Button } from '@/components/ui/button';

interface VendorEarningsSettlementDashboardProps {
  vendorId: string;
  /** When provided (e.g. embedded in Reporting), back button calls this instead of router.push('/') */
  onBack?: () => void;
}

interface TierDefinition {
  name: string;
  displayName?: string;
  commissionRate: number;
  features: string[];
  payoutPeriodDays?: number;
  payoutCycleLabel?: string;
  monthlyCost?: number;
  yearlyCost?: number;
  tierLevel?: number;
}

interface TierInfo {
  current: string;
  name: string;
  commissionRate: number;
  features: string[];
  canUpgrade: boolean;
  nextTier?: string;
  payoutPeriodDays?: number;
  payoutCycleLabel?: string;
  allTiers?: TierDefinition[];
  upgradeTiers?: Array<{ name: string; displayName?: string; commissionRate: number; monthlyCost: number; yearlyCost: number; features: string[]; termsAndConditions?: string; requiresTermsAcceptance?: boolean }>;
  upgradeRequirements?: {
    upgradeCost: number;
    commissionRate: number;
    features: string[];
    termsAndConditions?: string;
    requiresTermsAcceptance?: boolean;
  };
}

interface Analytics {
  totalRevenue: number;
  periodRevenue: number;
  periodCount: number;
  avgSettlement: number;
  commissionSaved: number;
  pendingAmount: number;
  processingAmount: number;
}

interface Settlement {
  id: string;
  amount: number;
  gross_amount?: number;
  net_amount?: number;
  status: string;
  tier: string;
  commissionRate: number;
  commission_amount?: number;
  bookingCount?: number;
  bookingIds?: string[];
  processedAt?: string;
  created_at?: string;
  period_start?: string;
  period_end?: string;
  payout_reference?: string;
  payout_method?: string;
}

interface EarningsData {
  totalEarnings: number;
  pendingSettlement: number;
  thisMonth: number;
  lastMonth: number;
  thisWeek: number;
  today: number;
  totalBookings: number;
  completedBookings: number;
  avgBookingValue: number;
}

interface Transaction {
  id: string;
  type: 'booking' | 'settlement' | 'refund' | 'commission';
  amount: number;
  description: string;
  status: string;
  created_at: string;
}

export function VendorEarningsSettlementDashboard({ vendorId, onBack: onBackProp }: VendorEarningsSettlementDashboardProps) {
  const router = useRouter();
  const handleBack = onBackProp ?? (() => router.push('/'));
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'earnings' | 'settlements' | 'tier'>('overview');
  const [period, setPeriod] = useState<'week' | 'month' | 'year' | 'all'>('month');
  
  // Data states
  const [tierInfo, setTierInfo] = useState<TierInfo | null>(null);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [earnings, setEarnings] = useState<EarningsData | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  
  // Bank account states
  const [bankAccount, setBankAccount] = useState<any>(null);
  const [bankVerified, setBankVerified] = useState(false);
  
  // Settlement breakup modal
  const [showBreakupModal, setShowBreakupModal] = useState(false);
  const [selectedSettlementBreakup, setSelectedSettlementBreakup] = useState<any>(null);
  const [loadingBreakup, setLoadingBreakup] = useState(false);
  
  // Payout request
  const [requestingPayout, setRequestingPayout] = useState(false);
  // Tier upgrade modal
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [upgradeTermsAccepted, setUpgradeTermsAccepted] = useState(false);
  const [upgradeSettlementSchedule, setUpgradeSettlementSchedule] = useState<'monthly' | 'weekly_4'>('monthly');

  useEffect(() => {
    loadAllData();
  }, [vendorId, period]);

  const loadAllData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadTierInfo(),
        loadAnalytics(),
        loadSettlements(),
        loadEarnings(),
        loadTransactions(),
        loadBankAccount()
      ]);
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadAllData();
    setRefreshing(false);
  };

  const defaultTierInfo: TierInfo = {
    current: 'bronze',
    name: 'Bronze',
    commissionRate: 0.15,
    features: ['Basic listing', 'Standard support', 'Weekly settlements'],
    canUpgrade: true,
    nextTier: 'silver',
    upgradeRequirements: {
      upgradeCost: 5000,
      commissionRate: 0.12,
      features: ['Priority listing', 'Priority support', 'Daily settlements', 'Analytics dashboard']
    }
  };

  const loadTierInfo = async () => {
    try {
      const response = await apiClient.get<any>(`/vendor/${vendorId}/tier`).catch(() => null);
      
      // Handle different API response shapes: response.tier, response itself, or response.data
      const t = response?.tier ?? response?.data?.tier ?? response;
      
      if (t && typeof t === 'object') {
        // Helper to extract string safely
        const safeString = (val: any, fallback: string): string => {
          if (typeof val === 'string') return val;
          if (val && typeof val === 'object' && typeof val.name === 'string') return val.name;
          return fallback;
        };
        
        // Helper to extract number safely
        const safeNumber = (val: any, fallback: number): number => {
          if (typeof val === 'number') return val;
          if (typeof val === 'string' && !isNaN(parseFloat(val))) return parseFloat(val);
          return fallback;
        };
        
        // Check if API returned alternate shape {name, eligible, requirements, progress}
        const hasAltShape = 'eligible' in t || 'progress' in t;
        
        // Normalize allTiers: ensure payoutCycleLabel and features/benefits per tier
        const normalizedAllTiers: TierDefinition[] | undefined = Array.isArray(t.allTiers)
          ? t.allTiers.map((tier: any) => {
              const payoutDays = tier.payoutPeriodDays ?? tier.payout_period_days ?? 7;
              return {
                name: tier.name ?? tier.tier_name ?? '',
                displayName: tier.displayName ?? tier.display_name ?? tier.name ?? tier.tier_name,
                commissionRate: safeNumber(tier.commissionRate ?? tier.commission_rate, 0),
                features: Array.isArray(tier.features) ? tier.features : (Array.isArray(tier.benefits) ? tier.benefits : []),
                payoutPeriodDays: payoutDays,
                payoutCycleLabel: typeof tier.payoutCycleLabel === 'string' ? tier.payoutCycleLabel : (payoutDays === 1 ? 'Daily' : payoutDays === 7 ? 'Weekly' : `Every ${payoutDays} days`),
                monthlyCost: tier.monthlyCost ?? tier.monthly_cost,
                yearlyCost: tier.yearlyCost ?? tier.yearly_cost,
                tierLevel: tier.tierLevel ?? tier.tier_level,
              };
            })
          : undefined;

        const payoutDays = safeNumber(t.payoutPeriodDays ?? t.payout_period_days, 7);
        setTierInfo({
          current: safeString(t.current ?? t.tier_name ?? t.tierName, defaultTierInfo.current),
          name: safeString(t.name ?? t.tier_name ?? t.tierName ?? t.current ?? t.displayName, defaultTierInfo.name),
          commissionRate: safeNumber(t.commissionRate ?? t.commission_rate ?? t.commission, defaultTierInfo.commissionRate),
          payoutPeriodDays: payoutDays,
          payoutCycleLabel: typeof t.payoutCycleLabel === 'string' ? t.payoutCycleLabel : undefined,
          allTiers: normalizedAllTiers,
          upgradeTiers: Array.isArray(t.upgradeTiers) ? t.upgradeTiers : undefined,
          features: Array.isArray(t.features) ? t.features : 
                   (Array.isArray(t.benefits) ? t.benefits : defaultTierInfo.features),
          canUpgrade: typeof t.canUpgrade === 'boolean' ? t.canUpgrade : 
                     (typeof t.eligible === 'boolean' ? t.eligible : 
                     (typeof t.can_upgrade === 'boolean' ? t.can_upgrade : defaultTierInfo.canUpgrade)),
          nextTier: safeString(t.nextTier ?? t.next_tier ?? t.upgradeTo, defaultTierInfo.nextTier),
          upgradeRequirements: (t.upgradeRequirements || t.requirements || t.upgrade_requirements) && 
                              typeof (t.upgradeRequirements || t.requirements || t.upgrade_requirements) === 'object'
            ? {
                upgradeCost: safeNumber(
                  (t.upgradeRequirements || t.requirements || t.upgrade_requirements).upgradeCost ?? 
                  (t.upgradeRequirements || t.requirements || t.upgrade_requirements).upgrade_cost ??
                  (t.upgradeRequirements || t.requirements || t.upgrade_requirements).cost,
                  defaultTierInfo.upgradeRequirements!.upgradeCost
                ),
                commissionRate: safeNumber(
                  (t.upgradeRequirements || t.requirements || t.upgrade_requirements).commissionRate ?? 
                  (t.upgradeRequirements || t.requirements || t.upgrade_requirements).commission_rate,
                  defaultTierInfo.upgradeRequirements!.commissionRate
                ),
                features: Array.isArray((t.upgradeRequirements || t.requirements || t.upgrade_requirements).features) 
                  ? (t.upgradeRequirements || t.requirements || t.upgrade_requirements).features 
                  : (Array.isArray((t.upgradeRequirements || t.requirements || t.upgrade_requirements).benefits)
                    ? (t.upgradeRequirements || t.requirements || t.upgrade_requirements).benefits
                    : defaultTierInfo.upgradeRequirements!.features),
                termsAndConditions: (t.upgradeRequirements || t.requirements || t.upgrade_requirements).termsAndConditions ?? (t.upgradeRequirements || t.requirements || t.upgrade_requirements).terms_and_conditions ?? null,
                requiresTermsAcceptance: Boolean((t.upgradeRequirements || t.requirements || t.upgrade_requirements).requiresTermsAcceptance ?? (t.upgradeRequirements || t.requirements || t.upgrade_requirements).requires_terms_acceptance),
              }
            : defaultTierInfo.upgradeRequirements
        });
      } else {
        setTierInfo(defaultTierInfo);
      }
    } catch (error) {
      console.error('Failed to fetch tier info:', error);
      setTierInfo(defaultTierInfo);
    }
  };

  const loadAnalytics = async () => {
    try {
      const [dashboardRes, settlementsRes] = await Promise.all([
        apiClient.get<any>(`/vendor/${vendorId}/dashboard?timeframe=${period}`).catch(() => null),
        apiClient.get<any>(`/vendor/${vendorId}/settlements?summary=true`).catch(() => null)
      ]);
      
      const stats = dashboardRes?.stats || dashboardRes?.data?.stats || {};
      const summary = settlementsRes?.summary || {};
      
      setAnalytics({
        totalRevenue: stats.totalEarnings || stats.earnings || 0,
        periodRevenue: stats.thisMonthEarnings || stats.earnings || 0,
        periodCount: stats.completedServices || stats.completedBookings || 0,
        avgSettlement: stats.averageBookingValue || 0,
        commissionSaved: summary.commission_saved || 0,
        pendingAmount: summary.pending_amount ?? summary.pendingAmount ?? 0,
        processingAmount: summary.processing_amount ?? summary.processingAmount ?? 0
      });
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
    }
  };

  const loadSettlements = async () => {
    try {
      const response = await apiClient.get<any>(`/vendor/${vendorId}/settlements?limit=20`).catch(() => null);
      const list = response?.settlements;
      setSettlements(Array.isArray(list) ? list : []);
    } catch (error) {
      console.error('Failed to fetch settlements:', error);
      setSettlements([]);
    }
  };

  const loadEarnings = async () => {
    try {
      const [todayRes, weekRes, monthRes, totalRes] = await Promise.all([
        apiClient.get<any>(`/vendor/${vendorId}/earnings?period=day`).catch(() => null),
        apiClient.get<any>(`/vendor/${vendorId}/earnings?period=week`).catch(() => null),
        apiClient.get<any>(`/vendor/${vendorId}/earnings?period=month`).catch(() => null),
        apiClient.get<any>(`/vendor/${vendorId}/earnings?period=lifetime`).catch(() => null)
      ]);
      // API returns { success, earnings: { totalEarnings, thisPeriod, pendingSettlement, transactions, totalBookings, ... }, period }
      const e = (v: any) => v?.earnings;
      setEarnings({
        totalEarnings: e(totalRes)?.totalEarnings ?? 0,
        pendingSettlement: e(totalRes)?.pendingSettlement ?? 0,
        thisMonth: e(monthRes)?.thisPeriod ?? e(monthRes)?.totalEarnings ?? 0,
        lastMonth: e(monthRes)?.lastMonthEarnings ?? 0,
        thisWeek: e(weekRes)?.thisPeriod ?? e(weekRes)?.totalEarnings ?? 0,
        today: e(todayRes)?.thisPeriod ?? e(todayRes)?.totalEarnings ?? 0,
        totalBookings: e(totalRes)?.totalBookings ?? (e(totalRes)?.transactions?.length ?? 0),
        completedBookings: e(totalRes)?.completedBookings ?? 0,
        avgBookingValue: e(totalRes)?.averageBookingValue ?? 0
      });
    } catch (error) {
      console.error('Failed to fetch earnings:', error);
    }
  };

  const loadTransactions = async () => {
    try {
      const response = await apiClient.get<any>(`/vendor/${vendorId}/transactions?period=${period}&limit=10`).catch(() => null);
      const list = response?.transactions;
      setTransactions(Array.isArray(list) ? list : []);
    } catch (error) {
      console.error('Failed to fetch transactions:', error);
      setTransactions([]);
    }
  };

  const loadBankAccount = async () => {
    try {
      const response = await apiClient.get<any>(`/vendor/${vendorId}/bank-details`).catch(() => null);
      if (response?.bankDetails) {
        setBankAccount(response.bankDetails);
        setBankVerified(response.bankDetails.bank_verified || response.bankDetails.is_verified || false);
      }
    } catch (error) {
      console.error('Failed to fetch bank account:', error);
    }
  };

  /** Next settlement date based on vendor's tier payout_period_days (from admin tier config) */
  const getNextSettlementDate = (): string => {
    const payoutDays = tierInfo?.payoutPeriodDays ?? 7;
    const nextDate = new Date(Date.now() + payoutDays * 24 * 60 * 60 * 1000);
    return nextDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  };

  const handleRequestPayout = async () => {
    // Align with backend: available = settlements pending + vendor_earnings pending
    const availableAmount = Math.max(
      analytics?.pendingAmount ?? 0,
      earnings?.pendingSettlement ?? 0
    );
    if (availableAmount <= 0) {
      alert('No amount available for payout');
      return;
    }
    if (!bankVerified || !bankAccount) {
      alert('Please add and verify your bank account in Settings first. Automatic settlement requires a verified bank account.');
      router.push('/settings?tab=bank');
      return;
    }
    if (!confirm(`Request payout of ₹${availableAmount.toLocaleString()}?`)) return;
    
    setRequestingPayout(true);
    try {
      const response = await apiClient.post<any>('/settlements/request', {
        vendorId,
        amount: availableAmount
      });
      
      if (response?.success) {
        alert('✅ Payout request submitted successfully!');
        await loadAllData();
      } else {
        alert(`❌ Failed to request payout: ${response?.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error requesting payout:', error);
      alert('❌ Error requesting payout. Please try again.');
    } finally {
      setRequestingPayout(false);
    }
  };

  const handleTierUpgradeClick = () => {
    if (!tierInfo?.canUpgrade || !tierInfo.nextTier) return;
    setUpgradeTermsAccepted(false);
    setUpgradeSettlementSchedule('monthly');
    setShowUpgradeModal(true);
  };

  const handleTierUpgrade = async () => {
    if (!tierInfo) return;
    const raw = tierInfo.nextTier;
    const rawStr = typeof raw === 'string'
      ? raw.trim()
      : (raw && typeof raw === 'object' && typeof (raw as any).name === 'string')
        ? String((raw as any).name).trim()
        : '';
    const nextTierName = rawStr || (tierInfo.upgradeRequirements && (tierInfo.upgradeRequirements as any).name);
    if (!nextTierName) {
      alert('No upgrade tier available for your role.');
      setShowUpgradeModal(false);
      return;
    }
    const req = tierInfo.upgradeRequirements;
    const requiresTerms = req?.requiresTermsAcceptance === true || !!(req?.termsAndConditions && String(req.termsAndConditions).trim());
    if (requiresTerms && !upgradeTermsAccepted) {
      alert('Please accept the terms and conditions to proceed.');
      return;
    }
    const upgradeCost = typeof req?.upgradeCost === 'number' ? req.upgradeCost : 0;
    setShowUpgradeModal(false);

    try {
      const response = await apiClient.post<any>(`/vendor/${vendorId}/tier/upgrade`, {
        newTier: nextTierName,
        paymentMethod: 'settlement_deduction',
        subscriptionPeriod: 'monthly',
        settlementSchedule: upgradeSettlementSchedule,
        termsAccepted: upgradeTermsAccepted || !requiresTerms,
      });

      if (response?.success) {
        alert(`Successfully upgraded to ${nextTierName} tier!`);
        await loadAllData();
      } else if (response?.requiresTermsAcceptance) {
        setShowUpgradeModal(true);
        alert(response?.error || 'Please accept the terms and conditions.');
      } else {
        alert(response?.error || 'Failed to upgrade tier.');
      }
    } catch (error: any) {
      console.error('Failed to upgrade tier:', error);
      const msg = error?.response?.data?.error || error?.message || 'Failed to upgrade tier. Please try again.';
      if (msg?.includes('terms')) {
        setShowUpgradeModal(true);
      }
      alert(msg);
    }
  };

  const handleViewBreakup = async (settlementId: string) => {
    setLoadingBreakup(true);
    try {
      const response = await apiClient.get<any>(`/vendor/${vendorId}/settlements/${settlementId}/breakup`);
      if (response?.breakup) {
        setSelectedSettlementBreakup(response);
        setShowBreakupModal(true);
      }
    } catch (error) {
      console.error('Failed to load settlement breakup:', error);
    } finally {
      setLoadingBreakup(false);
    }
  };

  const handleDownloadStatement = async (settlementId: string) => {
    try {
      const response = await apiClient.get<any>(`/vendor/settlements/${settlementId}/statement`);
      const blob = new Blob([JSON.stringify(response, null, 2)], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `settlement-${settlementId}.json`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to download statement:', error);
    }
  };

  // Helper functions
  const getTierIcon = (tier: string) => {
    switch (tier?.toLowerCase()) {
      case 'bronze': case 'basic': case 'free tier': return <Star className="w-5 h-5 text-amber-700" />;
      case 'silver': case 'advance': case 'professional': return <Zap className="w-5 h-5 text-gray-400" />;
      case 'gold': case 'premium': case 'growth': return <Award className="w-5 h-5 text-yellow-500" />;
      case 'platinum': case 'enterprise': return <Crown className="w-5 h-5 text-purple-500" />;
      default: return <Star className="w-5 h-5" />;
    }
  };

  const getTierColor = (tier: string) => {
    switch (tier?.toLowerCase()) {
      case 'bronze': case 'basic': case 'free tier': return 'text-amber-700 bg-amber-100';
      case 'silver': case 'advance': case 'professional': return 'text-gray-600 bg-gray-100';
      case 'gold': case 'premium': case 'growth': return 'text-yellow-700 bg-yellow-100';
      case 'platinum': case 'enterprise': return 'text-purple-700 bg-purple-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'processing': return <Clock className="w-5 h-5 text-blue-600" />;
      case 'pending': return <Clock className="w-5 h-5 text-yellow-600" />;
      case 'failed': return <XCircle className="w-5 h-5 text-red-600" />;
      default: return <Clock className="w-5 h-5 text-gray-600" />;
    }
  };

  // Unified available-for-payout amount (settlements + vendor_earnings pending)
  const availableForPayout = Math.max(
    analytics?.pendingAmount ?? 0,
    earnings?.pendingSettlement ?? 0
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-700';
      case 'processing': return 'bg-blue-100 text-blue-700';
      case 'pending': return 'bg-yellow-100 text-yellow-700';
      case 'failed': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-full max-w-[430px] mx-auto bg-white text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading earnings dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 w-full flex justify-center">
      <div className="w-full max-w-[430px] mx-auto bg-white min-h-screen shadow-lg sm:shadow-xl">
        {/* Header - Mobile optimized */}
        <div className="bg-gradient-to-r from-orange-500 to-amber-500 text-white sticky top-0 z-10">
          <div className="px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Button variant="ghost" size="icon" onClick={handleBack} className="rounded-full text-white hover:bg-white/20 -ml-2">
                  <ArrowLeft className="w-5 h-5" />
                </Button>
                <div>
                  <h1 className="text-lg font-bold">Earnings & Settlements</h1>
                  <p className="text-xs text-white/80">Manage your revenue, settlements, and tier</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={handleRefresh} disabled={refreshing} className="text-white hover:bg-white/20 px-2">
                  <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                </Button>
                {tierInfo?.canUpgrade && (
                  <Button 
                    onClick={handleTierUpgradeClick} 
                    size="sm"
                    className="bg-white text-orange-600 hover:bg-white/90 text-xs px-3"
                  >
                    <ArrowUp className="w-3 h-3 mr-1" />
                    Upgrade
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="p-4 space-y-4">
        {/* Tier Badge Card - Mobile optimized */}
        {tierInfo && (
          <div className="bg-gradient-to-br from-orange-500 to-amber-500 rounded-xl p-4 text-white">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
                {getTierIcon(typeof tierInfo.current === 'string' ? tierInfo.current : 'bronze')}
              </div>
              <div className="flex-1">
                <p className="text-xs opacity-80">Current Tier</p>
                <p className="text-xl font-bold">{typeof tierInfo.name === 'string' ? tierInfo.name : 'Bronze'}</p>
              </div>
              <div className="text-right">
                <p className="text-xs opacity-80">Commission</p>
                <p className="text-2xl font-bold">{(typeof tierInfo.commissionRate === 'number' ? (tierInfo.commissionRate > 1 ? tierInfo.commissionRate : tierInfo.commissionRate * 100) : 15).toFixed(0)}%</p>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-2 mb-3">
              <div className="bg-white/10 rounded-lg p-2">
                <p className="text-[10px] opacity-80">Next Payout</p>
                <p className="text-sm font-medium">{tierInfo.payoutCycleLabel || 'Weekly (every 7 days)'}</p>
              </div>
              {tierInfo.nextTier && (
                <div className="bg-white/10 rounded-lg p-2">
                  <p className="text-[10px] opacity-80">Next Tier</p>
                  <p className="text-sm font-medium capitalize">{typeof tierInfo.nextTier === 'string' ? tierInfo.nextTier : 'Silver'}</p>
                  {tierInfo.canUpgrade && (
                    <span className="text-[10px] bg-green-400/30 px-1.5 py-0.5 rounded">Eligible!</span>
                  )}
                </div>
              )}
            </div>
            
            <div className="flex flex-wrap gap-1.5">
              {(tierInfo.features ?? []).map((feature, idx) => (
                <span key={idx} className="px-2 py-0.5 text-[10px] font-medium rounded-full bg-white/20">
                  {feature}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Bank Account Warning */}
        {!bankVerified && (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0">
                <Info className="w-6 h-6 text-amber-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-amber-800">Bank Account {bankAccount ? 'Verification Required' : 'Not Added'}</h3>
                <p className="text-sm text-amber-700 mt-1">
                  {bankAccount 
                    ? 'Your bank account is pending verification. Once verified, you can receive settlements.'
                    : 'Add and verify your bank account to receive settlements. This is required for payouts.'}
                </p>
                <div className="flex gap-3 mt-3">
                  {bankAccount ? (
                    <>
                      <span className="text-sm text-gray-600">
                        Account: {bankAccount.account_number?.includes('*') || bankAccount.account_number?.includes('•') ? bankAccount.account_number : `****${String(bankAccount.account_number || '').slice(-4)}`} | IFSC: {bankAccount.ifsc_code}
                      </span>
                      <Button variant="outline" size="sm" onClick={() => router.push('/settings?tab=bank')}>
                        Change Account
                      </Button>
                    </>
                  ) : (
                    <Button onClick={() => router.push('/settings?tab=bank')} className="bg-amber-600 hover:bg-amber-700 text-white">
                      Add Bank Account
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Verified Bank Account */}
        {bankVerified && bankAccount && (
          <div className="p-4 bg-green-50 border border-green-200 rounded-xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-green-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-green-800">Bank Account Verified ✓</h3>
                <p className="text-sm text-green-700">
                  {bankAccount.account_holder_name} | {bankAccount.bank_name} | {bankAccount.account_number?.includes('*') || bankAccount.account_number?.includes('•') ? bankAccount.account_number : `****${String(bankAccount.account_number || '').slice(-4)}`}
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={() => router.push('/settings?tab=bank')}>
                Change
              </Button>
            </div>
          </div>
        )}

        {/* Period Selector - Mobile optimized */}
        <div className="flex overflow-x-auto bg-white rounded-lg shadow-sm">
          {(['week', 'month', 'year', 'all'] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`flex-1 px-3 py-2 text-xs font-medium whitespace-nowrap transition ${
                period === p ? 'bg-orange-500 text-white' : 'text-gray-600 hover:bg-gray-50'
              } ${p === 'week' ? 'rounded-l-lg' : ''} ${p === 'all' ? 'rounded-r-lg' : ''}`}
            >
              {p === 'all' ? 'All Time' : `This ${p}`}
            </button>
          ))}
        </div>

        {/* Tabs - Mobile optimized horizontal scroll */}
        <div className="flex overflow-x-auto bg-white border-b border-gray-200 rounded-t-xl -mx-4 px-4">
          {[
            { id: 'overview', label: 'Overview', icon: TrendingUp },
            { id: 'earnings', label: 'Earnings', icon: IndianRupee },
            { id: 'settlements', label: 'Settlements', icon: Wallet },
            { id: 'tier', label: 'Tier Benefits', icon: Crown }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium whitespace-nowrap transition-colors border-b-2 -mb-[2px] ${
                activeTab === tab.id
                  ? 'text-orange-600 border-orange-600'
                  : 'text-gray-500 border-transparent'
              }`}
            >
              <tab.icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="bg-white rounded-b-xl -mx-4 px-4 py-4">
          {/* OVERVIEW TAB */}
          {activeTab === 'overview' && (
            <div className="space-y-4">
              {/* Stats Cards - 2 columns for mobile */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-3">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-[10px] text-green-600 font-medium">Total Revenue</p>
                    <IndianRupee className="w-4 h-4 text-green-500" />
                  </div>
                  <p className="text-lg font-bold text-green-700">₹{(analytics?.totalRevenue || 0).toLocaleString()}</p>
                  <p className="text-[10px] text-green-600">All time earnings</p>
                </div>

                <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-3">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-[10px] text-blue-600 font-medium">This {period === 'all' ? 'Period' : period.charAt(0).toUpperCase() + period.slice(1)}</p>
                    <TrendingUp className="w-4 h-4 text-blue-500" />
                  </div>
                  <p className="text-lg font-bold text-blue-700">₹{(analytics?.periodRevenue || 0).toLocaleString()}</p>
                  <p className="text-[10px] text-blue-600">{analytics?.periodCount || 0} services completed</p>
                </div>

                <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl p-3">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-[10px] text-orange-600 font-medium">Pending Payout</p>
                    <PiggyBank className="w-4 h-4 text-orange-500" />
                  </div>
                  <p className="text-lg font-bold text-orange-700">₹{availableForPayout.toLocaleString()}</p>
                  {availableForPayout > 0 && (
                    <button
                      onClick={handleRequestPayout}
                      disabled={requestingPayout}
                      className="text-orange-700 text-[10px] font-medium hover:underline"
                    >
                      {requestingPayout ? 'Requesting...' : `Request Payout →`}
                    </button>
                  )}
                </div>

                <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-3">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-[10px] text-purple-600 font-medium">Commission Saved</p>
                    <Award className="w-4 h-4 text-purple-500" />
                  </div>
                  <p className="text-lg font-bold text-purple-700">₹{(analytics?.commissionSaved || 0).toLocaleString()}</p>
                  <p className="text-[10px] text-purple-600">vs Basic tier</p>
                </div>
              </div>

              {/* Quick Actions - Mobile stacked */}
              <div className="space-y-3">
                {/* Recent Transactions */}
                <div className="border border-gray-100 rounded-xl p-3 bg-gray-50/50">
                  <h3 className="font-semibold text-gray-900 text-sm mb-2">Recent Transactions</h3>
                  {(transactions ?? []).length === 0 ? (
                    <p className="text-gray-500 text-center text-xs py-3">No transactions yet</p>
                  ) : (
                    <div className="space-y-1.5">
                      {(transactions ?? []).slice(0, 3).map((txn) => (
                        <div key={txn.id} className="flex items-center justify-between py-1.5 border-b border-gray-100 last:border-0">
                          <div className="flex items-center gap-2">
                            {txn.type === 'booking' ? <ArrowDownLeft className="w-3.5 h-3.5 text-green-600" /> : 
                             txn.type === 'settlement' ? <ArrowUpRight className="w-3.5 h-3.5 text-blue-600" /> :
                             <IndianRupee className="w-3.5 h-3.5 text-gray-600" />}
                            <div>
                              <p className="text-xs font-medium text-gray-900">{txn.description}</p>
                              <p className="text-[10px] text-gray-500">{new Date(txn.created_at).toLocaleDateString()}</p>
                            </div>
                          </div>
                          <p className={`text-xs font-semibold ${txn.type === 'refund' ? 'text-red-600' : 'text-green-600'}`}>
                            {txn.type === 'refund' ? '-' : '+'}₹{txn.amount.toLocaleString()}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                  <button 
                    onClick={() => setActiveTab('earnings')}
                    className="w-full mt-2 text-orange-600 text-xs font-medium"
                  >
                    View All Transactions →
                  </button>
                </div>

                {/* Recent Settlements */}
                <div className="border border-gray-100 rounded-xl p-3 bg-gray-50/50">
                  <h3 className="font-semibold text-gray-900 text-sm mb-2">Recent Settlements</h3>
                  {(settlements ?? []).length === 0 ? (
                    <p className="text-gray-500 text-center text-xs py-3">No settlements yet</p>
                  ) : (
                    <div className="space-y-1.5">
                      {(settlements ?? []).slice(0, 3).map((settlement) => (
                        <div key={settlement.id} className="flex items-center justify-between py-1.5 border-b border-gray-100 last:border-0">
                          <div className="flex items-center gap-2">
                            {getStatusIcon(settlement.status)}
                            <div>
                              <p className="text-xs font-medium text-gray-900">
                                ₹{(settlement.net_amount || settlement.amount).toLocaleString()}
                              </p>
                              <p className="text-[10px] text-gray-500">
                                {settlement.period_start ? new Date(settlement.period_start).toLocaleDateString() : 'Processing'}
                              </p>
                            </div>
                          </div>
                          <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded-full ${getStatusColor(settlement.status)}`}>
                            {settlement.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                  <button 
                    onClick={() => setActiveTab('settlements')}
                    className="w-full mt-2 text-orange-600 text-xs font-medium"
                  >
                    View All Settlements →
                  </button>
                </div>
              </div>

              {/* Upgrade Prompt - Mobile optimized */}
              {tierInfo?.canUpgrade && tierInfo.upgradeRequirements && (
                <div className="bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-xl p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <ArrowUp className="w-5 h-5 text-purple-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-gray-900 text-sm mb-1">
                        Upgrade to {typeof tierInfo.nextTier === 'string' ? tierInfo.nextTier.charAt(0).toUpperCase() + tierInfo.nextTier.slice(1) : 'Silver'} Tier
                      </h3>
                      <p className="text-xs text-gray-600 mb-2">
                        Reduce commission from{' '}
                        {(typeof tierInfo.commissionRate === 'number' ? (tierInfo.commissionRate > 1 ? tierInfo.commissionRate : tierInfo.commissionRate * 100) : 15).toFixed(0)}% to{' '}
                        {(typeof tierInfo.upgradeRequirements.commissionRate === 'number' ? (tierInfo.upgradeRequirements.commissionRate > 1 ? tierInfo.upgradeRequirements.commissionRate : tierInfo.upgradeRequirements.commissionRate * 100) : 12).toFixed(0)}%
                      </p>
                      <ul className="space-y-1 mb-3">
                        {(tierInfo?.upgradeRequirements?.features ?? []).map((feature, idx) => (
                          <li key={idx} className="flex items-center gap-1.5 text-xs text-gray-700">
                            <CheckCircle className="w-3 h-3 text-green-600 flex-shrink-0" />
                            {feature}
                          </li>
                        ))}
                      </ul>
                      <Button onClick={handleTierUpgradeClick} size="sm" className="bg-purple-600 hover:bg-purple-700 text-xs">
                        Upgrade for ₹{(typeof tierInfo.upgradeRequirements.upgradeCost === 'number' ? tierInfo.upgradeRequirements.upgradeCost : 5000).toLocaleString()}
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* EARNINGS TAB */}
          {activeTab === 'earnings' && (
            <div className="space-y-6">
              {/* Earnings Summary Cards */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-green-50 rounded-xl p-4">
                  <p className="text-sm text-green-600">Today</p>
                  <p className="text-2xl font-bold text-green-700">₹{(earnings?.today || 0).toLocaleString()}</p>
                </div>
                <div className="bg-blue-50 rounded-xl p-4">
                  <p className="text-sm text-blue-600">This Week</p>
                  <p className="text-2xl font-bold text-blue-700">₹{(earnings?.thisWeek || 0).toLocaleString()}</p>
                </div>
                <div className="bg-purple-50 rounded-xl p-4">
                  <p className="text-sm text-purple-600">This Month</p>
                  <p className="text-2xl font-bold text-purple-700">₹{(earnings?.thisMonth || 0).toLocaleString()}</p>
                  {earnings?.lastMonth && earnings.lastMonth > 0 && (
                    <p className={`text-xs mt-1 ${earnings.thisMonth >= earnings.lastMonth ? 'text-green-600' : 'text-red-600'}`}>
                      {earnings.thisMonth >= earnings.lastMonth ? '+' : ''}
                      {(((earnings.thisMonth - earnings.lastMonth) / earnings.lastMonth) * 100).toFixed(1)}% vs last month
                    </p>
                  )}
                </div>
                <div className="bg-orange-50 rounded-xl p-4">
                  <p className="text-sm text-orange-600">Total Earnings</p>
                  <p className="text-2xl font-bold text-orange-700">₹{(earnings?.totalEarnings || 0).toLocaleString()}</p>
                </div>
              </div>

              {/* Additional Stats */}
              <div className="grid grid-cols-3 gap-4">
                <div className="border rounded-xl p-4 text-center">
                  <p className="text-sm text-gray-500">Total Bookings</p>
                  <p className="text-3xl font-bold text-gray-900">{earnings?.totalBookings || 0}</p>
                </div>
                <div className="border rounded-xl p-4 text-center">
                  <p className="text-sm text-gray-500">Completed</p>
                  <p className="text-3xl font-bold text-green-600">{earnings?.completedBookings || 0}</p>
                </div>
                <div className="border rounded-xl p-4 text-center">
                  <p className="text-sm text-gray-500">Avg. Booking Value</p>
                  <p className="text-3xl font-bold text-gray-900">₹{(earnings?.avgBookingValue || 0).toLocaleString()}</p>
                </div>
              </div>

              {/* Pending Settlement */}
              <div className="bg-gradient-to-r from-orange-50 to-amber-50 rounded-xl p-6 border border-orange-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-orange-600">Pending Settlement</p>
                    <p className="text-3xl font-bold text-orange-700">₹{availableForPayout.toLocaleString()}</p>
                    <p className="text-xs text-orange-600 mt-1">Available for payout request</p>
                  </div>
                  {availableForPayout > 0 && (
                    <Button 
                      onClick={handleRequestPayout}
                      disabled={requestingPayout}
                      className="bg-orange-500 hover:bg-orange-600"
                    >
                      {requestingPayout ? 'Requesting...' : 'Request Payout'}
                    </Button>
                  )}
                </div>
              </div>

              {/* All Transactions */}
              <div>
                <h3 className="font-semibold text-gray-900 mb-4">Transaction History</h3>
                {(transactions ?? []).length === 0 ? (
                  <div className="text-center py-8 bg-gray-50 rounded-xl">
                    <IndianRupee className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                    <p className="text-gray-500">No transactions yet</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {(transactions ?? []).map((txn) => (
                      <div key={txn.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                            txn.type === 'booking' ? 'bg-green-100' : 
                            txn.type === 'settlement' ? 'bg-blue-100' : 
                            txn.type === 'refund' ? 'bg-red-100' : 'bg-gray-100'
                          }`}>
                            {txn.type === 'booking' ? '📅' : 
                             txn.type === 'settlement' ? '💸' : 
                             txn.type === 'refund' ? '↩️' : '💰'}
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{txn.description}</p>
                            <p className="text-sm text-gray-500">
                              {new Date(txn.created_at).toLocaleDateString()} • {txn.type}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={`font-semibold ${
                            txn.type === 'refund' || txn.type === 'commission' ? 'text-red-600' : 'text-green-600'
                          }`}>
                            {txn.type === 'refund' || txn.type === 'commission' ? '-' : '+'}₹{txn.amount.toLocaleString()}
                          </p>
                          <p className={`text-xs ${txn.status === 'completed' ? 'text-green-600' : 'text-yellow-600'}`}>
                            {txn.status}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* SETTLEMENTS TAB */}
          {activeTab === 'settlements' && (
            <div className="space-y-6">
              {/* Settlement Summary */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-green-50 rounded-xl p-4">
                  <p className="text-sm text-green-600">Total Settled</p>
                  <p className="text-2xl font-bold text-green-700">₹{(analytics?.totalRevenue || 0).toLocaleString()}</p>
                </div>
                <div className="bg-yellow-50 rounded-xl p-4">
                  <p className="text-sm text-yellow-600">Pending</p>
                  <p className="text-2xl font-bold text-yellow-700">₹{availableForPayout.toLocaleString()}</p>
                </div>
                <div className="bg-blue-50 rounded-xl p-4">
                  <p className="text-sm text-blue-600">Processing</p>
                  <p className="text-2xl font-bold text-blue-700">₹{(analytics?.processingAmount || 0).toLocaleString()}</p>
                </div>
                <div className="bg-orange-50 rounded-xl p-4">
                  <p className="text-sm text-orange-600">Next Settlement</p>
                  <p className="text-lg font-bold text-orange-700">
                    {getNextSettlementDate()}
                  </p>
                </div>
              </div>

              {/* Settlement History */}
              <div>
                <h3 className="font-semibold text-gray-900 mb-4">Settlement History</h3>
                {(settlements ?? []).length === 0 ? (
                  <div className="text-center py-12 bg-gray-50 rounded-xl">
                    <Wallet className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                    <p className="text-gray-500">No settlements yet</p>
                    <p className="text-sm text-gray-400 mt-1">Your settlements will appear here once processed</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {(settlements ?? []).map((settlement) => (
                      <div key={settlement.id} className="bg-gray-50 rounded-xl p-4 hover:bg-gray-100 transition">
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-4">
                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                              settlement.status === 'completed' ? 'bg-green-100' : 
                              settlement.status === 'processing' ? 'bg-blue-100' : 
                              settlement.status === 'pending' ? 'bg-yellow-100' : 'bg-gray-100'
                            }`}>
                              {settlement.status === 'completed' ? '✅' : 
                               settlement.status === 'processing' ? '⏳' : '💰'}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="font-semibold text-gray-900">
                                  {settlement.period_start && settlement.period_end ? (
                                    <>
                                      {new Date(settlement.period_start).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} - {new Date(settlement.period_end).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                                    </>
                                  ) : (
                                    `Settlement #${settlement.id.slice(0, 8)}`
                                  )}
                                </p>
                                <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${getStatusColor(settlement.status)}`}>
                                  {settlement.status}
                                </span>
                              </div>
                              <p className="text-sm text-gray-500 mt-1">
                                {settlement.bookingCount || settlement.bookingIds?.length || 0} bookings
                              </p>
                              {settlement.payout_reference && (
                                <p className="text-xs text-gray-400 mt-1">Ref: {settlement.payout_reference}</p>
                              )}
                            </div>
                          </div>
                          
                          <div className="text-right">
                            <div className="flex items-center gap-6">
                              <div>
                                <p className="text-sm text-gray-500">Gross</p>
                                <p className="font-medium text-gray-700">₹{(settlement.grossAmount ?? settlement.gross_amount ?? settlement.amount ?? 0).toLocaleString()}</p>
                              </div>
                              <div>
                                <p className="text-sm text-gray-500">Commission ({typeof settlement.commissionRate === 'number' && settlement.commissionRate > 1 ? (settlement.commissionRate || 0).toFixed(0) : ((settlement.commissionRate ?? 0.15) * 100).toFixed(0)}%)</p>
                                <p className="font-medium text-red-600">-₹{(settlement.commission_amount || 0).toLocaleString()}</p>
                              </div>
                              <div>
                                <p className="text-sm text-gray-500">Net Payout</p>
                                <p className="text-xl font-bold text-green-600">₹{(settlement.netAmount ?? settlement.net_amount ?? settlement.amount ?? 0).toLocaleString()}</p>
                              </div>
                            </div>
                            
                            <div className="flex justify-end gap-2 mt-3">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleViewBreakup(settlement.id)}
                                disabled={loadingBreakup}
                              >
                                📊 Breakup
                              </Button>
                              {settlement.status === 'completed' && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleDownloadStatement(settlement.id)}
                                >
                                  📄 Statement
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Settlement Info */}
              <div className="p-4 bg-blue-50 rounded-xl">
                <div className="flex items-start gap-3">
                  <span className="text-xl">💡</span>
                  <div>
                    <p className="text-sm text-blue-700 font-medium">How Settlements Work</p>
                    <ul className="text-sm text-blue-600 mt-1 space-y-1">
                      <li>• Settlements are calculated every 7 days</li>
                      <li>• Platform commission is deducted based on your tier</li>
                      <li>• Payouts are processed to your verified bank account</li>
                      <li>• Download statements for tax and accounting purposes</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TIER BENEFITS TAB - Current tier at top, then other tiers in rectangle boxes */}
          {activeTab === 'tier' && (
            <div className="space-y-6">
              <p className="text-gray-600 text-sm">Compare tier benefits and upgrade to unlock lower commission rates and premium features.</p>
              
              {(() => {
                // Single source of truth: tiers come from API (Finance → Tier Management). No hardcoded fallback.
                const tiers = tierInfo?.allTiers && tierInfo.allTiers.length > 0
                  ? tierInfo.allTiers
                  : tierInfo?.name || tierInfo?.current
                    ? [{
                        name: tierInfo.current ?? tierInfo.name,
                        displayName: tierInfo.name ?? tierInfo.current,
                        commissionRate: tierInfo.commissionRate ?? 0,
                        features: tierInfo.features ?? [],
                        monthlyCost: 0,
                        yearlyCost: 0,
                        tierLevel: 1,
                        payoutPeriodDays: tierInfo.payoutPeriodDays ?? 7,
                        payoutCycleLabel: tierInfo.payoutCycleLabel ?? (tierInfo.payoutPeriodDays === 1 ? 'Daily' : tierInfo.payoutPeriodDays === 7 ? 'Weekly' : `Every ${tierInfo.payoutPeriodDays ?? 7} days`),
                      }]
                    : [];
                const currentName = (tierInfo?.current ?? tierInfo?.name ?? '').toLowerCase();
                const currentIdx = tiers.findIndex((t) => String(t.name).toLowerCase() === currentName);
                const currentTier = currentIdx >= 0 ? tiers[currentIdx] : tiers[0];
                const currentLevel = currentIdx >= 0 ? (tiers[currentIdx]?.tierLevel ?? currentIdx + 1) : 1;
                const otherTiers = tiers.filter((_, i) => i !== currentIdx);

                const formatCommission = (rate: number) =>
                  typeof rate === 'number' && rate <= 1 ? rate * 100 : rate;

                if (tiers.length === 0) {
                  return (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-800">
                      <p className="font-medium">Tier information is not available.</p>
                      <p className="text-sm mt-1">Tiers are configured in Finance → Tier Management. Please refresh the page or contact support.</p>
                    </div>
                  );
                }

                return (
                  <div className="space-y-6">
                    {/* YOUR CURRENT TIER - Prominent card at top */}
                    <div className="border-2 border-orange-400 bg-orange-50/50 rounded-lg p-5 shadow-sm">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="px-2 py-1 bg-orange-500 text-white text-xs font-bold rounded uppercase">Your Current Tier</span>
                      </div>
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 flex items-center justify-center rounded-lg bg-orange-100">
                            {getTierIcon(currentTier.name)}
                          </div>
                          <div>
                            <h3 className="text-xl font-bold text-gray-900">{currentTier.displayName ?? currentTier.name}</h3>
                            <p className="text-2xl font-bold text-orange-600">{formatCommission(currentTier.commissionRate ?? 0)}% Commission</p>
                            <p className="text-xs text-gray-600 mt-1"><span className="font-medium text-gray-700">Payout schedule:</span> {tierInfo?.payoutCycleLabel ?? currentTier.payoutCycleLabel ?? 'Weekly'} payouts</p>
                          </div>
                        </div>
                      </div>
                      <div className="mt-4 pt-4 border-t border-orange-200">
                        <p className="text-sm font-semibold text-gray-700 mb-2">Benefits</p>
                        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                          {(currentTier.features ?? []).map((f, i) => (
                            <li key={i} className="flex items-center gap-2 text-sm text-gray-700">
                              <CheckCircle className="w-4 h-4 flex-shrink-0 text-green-600" />
                              <span>{f}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    {/* OTHER TIERS - Full-width cards, text fits inside frame */}
                    <div className="w-full min-w-0">
                      <p className="text-sm font-semibold text-gray-700 mb-3">Other Tiers</p>
                      <div className="grid grid-cols-1 gap-4 w-full min-w-0">
                        {otherTiers.map((tier, idx) => {
                          const tierLevel = tier.tierLevel ?? idx + 1;
                          const isNextUpgrade = tierLevel === currentLevel + 1 && tierInfo?.canUpgrade;
                          const upgradeCost = tier.monthlyCost ?? tier.yearlyCost ?? 0;
                          const tierDisplayName = tier.displayName ?? tier.name;
                          const payoutLabel = tier.payoutCycleLabel ?? (tier.payoutPeriodDays === 1 ? 'Daily' : tier.payoutPeriodDays === 7 ? 'Weekly' : tier.payoutPeriodDays ? `Every ${tier.payoutPeriodDays} days` : 'Weekly');
                          const benefits = tier.features ?? [];

                          return (
                            <div
                              key={tier.name}
                              className="w-full min-w-0 border-2 border-gray-200 rounded-lg p-4 flex flex-col bg-white max-h-[320px] overflow-hidden"
                            >
                              <div className="flex items-start gap-3 mb-2 shrink-0">
                                <div className="w-10 h-10 flex items-center justify-center rounded-lg bg-gray-100 shrink-0 flex-shrink-0">
                                  {getTierIcon(tier.name)}
                                </div>
                                <div className="min-w-0 flex-1 overflow-hidden">
                                  <h3 className="font-bold text-gray-900 text-base break-words">{tierDisplayName}</h3>
                                  <p className="text-base font-bold text-gray-900 mt-0.5">
                                    <span>{formatCommission(tier.commissionRate ?? 0)}%</span>
                                    <span className="font-normal text-gray-700 ml-1">Commission</span>
                                  </p>
                                  <p className="text-xs text-gray-600 mt-1 break-words">
                                    <span className="font-medium text-gray-700">Payout schedule:</span>{' '}
                                    <span>{payoutLabel} payouts</span>
                                  </p>
                                </div>
                              </div>
                              <div className="mt-3 pt-3 border-t border-gray-200 flex-1 min-h-0 flex flex-col overflow-hidden">
                                <p className="text-sm font-semibold text-gray-700 mb-1.5 shrink-0">Benefits</p>
                                <ul className="space-y-1 overflow-y-auto flex-1 min-h-0 pr-1 text-xs text-gray-700 break-words">
                                  {benefits.map((f, i) => (
                                    <li key={i} className="flex items-center gap-2">
                                      <CheckCircle className="w-3.5 h-3.5 flex-shrink-0 text-gray-500" />
                                      <span>{f}</span>
                                    </li>
                                  ))}
                                  {benefits.length === 0 && (
                                    <li className="text-gray-500 italic">No benefits configured</li>
                                  )}
                                </ul>
                              </div>
                              {isNextUpgrade && (
                                <Button
                                  onClick={handleTierUpgradeClick}
                                  size="sm"
                                  className="w-full shrink-0 mt-3 text-xs min-h-9 py-2 whitespace-normal leading-tight"
                                >
                                  {upgradeCost > 0 ? (
                                    <>
                                      <span className="block">Upgrade</span>
                                      <span className="block font-semibold">₹{Number(upgradeCost).toLocaleString()}</span>
                                    </>
                                  ) : (
                                    'Upgrade'
                                  )}
                                </Button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      </div>
    </div>

      {/* Tier Upgrade Modal - terms acceptance and settlement schedule */}
      {showUpgradeModal && tierInfo && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="upgrade-modal-title">
          <div className="bg-white rounded-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto shadow-xl">
            <h3 id="upgrade-modal-title" className="text-lg font-bold text-gray-900 mb-4">Upgrade to {typeof tierInfo.nextTier === 'string' ? tierInfo.nextTier : 'Next'} Tier</h3>
            <p className="text-sm text-gray-600 mb-4">
              Pay ₹{(tierInfo.upgradeRequirements?.upgradeCost ?? 0).toLocaleString()} via settlement deduction.
            </p>
            {tierInfo.upgradeRequirements?.requiresTermsAcceptance && tierInfo.upgradeRequirements?.termsAndConditions && (
              <div className="mb-4 p-3 bg-gray-50 rounded-lg max-h-32 overflow-y-auto">
                <p className="text-xs text-gray-600 font-medium mb-2">Terms & Conditions</p>
                <p className="text-xs text-gray-700 whitespace-pre-wrap">{String(tierInfo.upgradeRequirements.termsAndConditions).slice(0, 500)}{String(tierInfo.upgradeRequirements.termsAndConditions).length > 500 ? '...' : ''}</p>
                <label className="flex items-center gap-2 mt-2 cursor-pointer">
                  <input type="checkbox" checked={upgradeTermsAccepted} onChange={(e) => setUpgradeTermsAccepted(e.target.checked)} className="w-4 h-4" />
                  <span className="text-sm text-gray-700">I accept the terms and conditions</span>
                </label>
              </div>
            )}
            <div className="mb-4">
              <p className="text-sm font-medium text-gray-700 mb-2">Settlement deduction</p>
              <div className="space-y-2">
                <label className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer ${upgradeSettlementSchedule === 'monthly' ? 'border-orange-500 bg-orange-50' : 'border-gray-200'}`}>
                  <input type="radio" name="schedule" value="monthly" checked={upgradeSettlementSchedule === 'monthly'} onChange={() => setUpgradeSettlementSchedule('monthly')} />
                  <span className="text-sm">Deduct once from next settlement</span>
                </label>
                <label className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer ${upgradeSettlementSchedule === 'weekly_4' ? 'border-orange-500 bg-orange-50' : 'border-gray-200'}`}>
                  <input type="radio" name="schedule" value="weekly_4" checked={upgradeSettlementSchedule === 'weekly_4'} onChange={() => setUpgradeSettlementSchedule('weekly_4')} />
                  <span className="text-sm">Split over 4 weekly settlements</span>
                </label>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setShowUpgradeModal(false)}>Cancel</Button>
              <Button className="flex-1 bg-orange-500 hover:bg-orange-600" onClick={handleTierUpgrade}>
                Confirm Upgrade
              </Button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Settlement Breakup Modal - portaled to body so it shows above Reporting container */}
      {showBreakupModal && selectedSettlementBreakup && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="breakup-modal-title">
          <div className="bg-white rounded-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 id="breakup-modal-title" className="text-lg font-bold text-gray-900">Settlement Breakup</h3>
              <button onClick={() => { setShowBreakupModal(false); setSelectedSettlementBreakup(null); }} className="text-gray-400 hover:text-gray-600" aria-label="Close">✕</button>
            </div>

            {selectedSettlementBreakup.breakup && (
              <div className="space-y-4">
                <div className="p-4 bg-gray-50 rounded-lg">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="font-medium text-gray-900">{selectedSettlementBreakup.breakup.booking?.label || 'Total Booking Amount'}</p>
                      <p className="text-xs text-gray-500">{selectedSettlementBreakup.breakup.booking?.explanation}</p>
                    </div>
                    <p className="text-lg font-bold text-gray-900">₹{(Number(selectedSettlementBreakup.breakup.booking?.amount) || 0).toLocaleString()}</p>
                  </div>
                </div>

                <div className="p-4 bg-red-50 rounded-lg">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="font-medium text-red-700">{selectedSettlementBreakup.breakup.commission?.label || 'Platform Commission'}</p>
                      <p className="text-xs text-red-600">{selectedSettlementBreakup.breakup.commission?.explanation}</p>
                    </div>
                    <p className="text-lg font-bold text-red-600">-₹{(Number(selectedSettlementBreakup.breakup.commission?.amount) || 0).toLocaleString()}</p>
                  </div>
                </div>

                <div className="p-4 bg-green-50 rounded-lg border-2 border-green-200">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="font-medium text-green-700">{selectedSettlementBreakup.breakup.netPayout?.label || 'Net Payout'}</p>
                      <p className="text-xs text-green-600">{selectedSettlementBreakup.breakup.netPayout?.explanation}</p>
                    </div>
                    <p className="text-2xl font-bold text-green-700">₹{(Number(selectedSettlementBreakup.breakup.netPayout?.amount) || 0).toLocaleString()}</p>
                  </div>
                </div>
              </div>
            )}

            <Button onClick={() => { setShowBreakupModal(false); setSelectedSettlementBreakup(null); }} className="w-full mt-6 bg-orange-500 hover:bg-orange-600">
              Close
            </Button>
          </div>
        </div>,
        document.body
      )}

      {/* Bank account Add/Change redirects to Settings > Bank tab */}
    </div>
  );
}
