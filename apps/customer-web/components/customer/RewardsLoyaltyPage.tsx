"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Award } from 'lucide-react';
import { ServiceDashboardHeader } from '@/components/customer/shared/ServiceDashboardHeader';
import { apiClient } from '@/lib/api-client';
import { getResolvedCustomerId, isCustomerDatabaseUuid } from '@/lib/customer-id-storage';
import { filterVisibleCatalogRewards } from '@/lib/hidden-rewards-catalog';

/**
 * Phone for `/customer/by-phone` — matches MyBookings / api-client fallbacks.
 * (Some sessions only set `customer_phone` or store phone inside profile JSON.)
 */
function readStoredPhoneForCustomer(): string | null {
  if (typeof window === 'undefined') return null;
  const a = localStorage.getItem('customerPhone')?.trim();
  if (a) return a;
  const b = localStorage.getItem('customer_phone')?.trim();
  if (b) return b;
  for (const key of ['customerData', 'customerProfile'] as const) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw?.trim()) continue;
      const d = JSON.parse(raw) as Record<string, unknown>;
      const p = d.phone ?? d.customerPhone;
      if (p != null && String(p).replace(/\D/g, '').length >= 10) {
        return String(p).trim();
      }
    } catch {
      /* ignore */
    }
  }
  return null;
}

function pickUuidFromByPhoneResponse(res: any): string | null {
  const c = res?.customer ?? res;
  if (!c || typeof c !== 'object') return null;
  const raw = (c as any).id ?? (c as any).customer_id ?? (c as any).customerId;
  const s = raw != null ? String(raw).trim() : '';
  return isCustomerDatabaseUuid(s) ? s : null;
}

/** Flatten `{ success, data: { points… } }` and similar so loyalty fields are always readable. */
function unwrapApiBody<T extends Record<string, unknown>>(res: T | null | undefined): T | null {
  if (!res || typeof res !== 'object') return null;
  const top = res as Record<string, unknown>;
  const d = top.data as Record<string, unknown> | undefined;
  if (d && typeof d === 'object' && !Array.isArray(d)) {
    return { ...top, ...d } as T;
  }
  return res as T;
}

interface RewardsLoyaltyPageProps {
  phone?: string;
  customerPhone?: string;
  customerId?: string;
  petId?: string;
  bookingId?: string;
  orderId?: string;
  cafeId?: string;
  preSelectedVendorId?: string;
  vendorId?: string;
  onBack: () => void;
  /** When set: orange header with X (home) + Back (account menu), same as Wallet / Orders. */
  onCloseToHome?: () => void;
  onNavigate?: (screen: string, data?: any) => void;
  onSuccess?: (bookingId?: string) => void;
  onComplete?: () => void;
}

interface RewardsBalance {
  points: number;
  totalPoints: number;
  lifetimePointsEarned: number;
  lifetimePointsRedeemed: number;
}

interface RewardItem {
  id: string;
  name: string;
  description: string;
  points_cost: number;
  cash_value?: number;
  type: string;
  image_url?: string;
}

interface PointsHistory {
  id: string;
  type: string;
  points: number;
  description: string;
  date: string;
  created_at?: string; // Optional for backward compatibility
  source?: string;
}

/** Active admin basic rules for converting points → wallet money. */
interface WalletRedeemPolicy {
  minRedemptionPoints: number;
  redemptionRatePointsPerRupee: number;
  rupeesPerPoint: number;
  labelPointsToRupee: string;
  labelMinPoints: string;
}

export function RewardsLoyaltyPage(props: RewardsLoyaltyPageProps) {
  const phone =
    props.customerPhone?.trim() ||
    props.phone?.trim() ||
    readStoredPhoneForCustomer();

  const [balance, setBalance] = useState<RewardsBalance | null>(null);
  const [rewards, setRewards] = useState<RewardItem[]>([]);
  const [history, setHistory] = useState<PointsHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'rewards' | 'history'>('rewards');
  /** Postgres `customers.id` (UUID). API routes `/customer/:customerId/rewards/*` require this, not phone. */
  const [customerId, setCustomerId] = useState<string | null>(() => {
    const p = props.customerId?.trim();
    return p && isCustomerDatabaseUuid(p) ? p : null;
  });
  const [redeeming, setRedeeming] = useState<string | null>(null);
  const [walletPolicy, setWalletPolicy] = useState<WalletRedeemPolicy | null>(null);
  const [walletPointsInput, setWalletPointsInput] = useState('');
  const [walletRedeeming, setWalletRedeeming] = useState(false);

  const resolveCustomerUuid = useCallback(async (): Promise<string | null> => {
    const fromProp = props.customerId?.trim();
    if (fromProp && isCustomerDatabaseUuid(fromProp)) {
      return fromProp;
    }
    if (typeof window !== 'undefined') {
      const fromStorage = getResolvedCustomerId();
      if (fromStorage) return fromStorage;
    }
    if (phone) {
      try {
        const customerResponse = await apiClient.get<any>(
          `/customer/by-phone?phone=${encodeURIComponent(phone)}`
        );
        const id = pickUuidFromByPhoneResponse(customerResponse);
        if (id) return id;
      } catch (err) {
        console.error('Error getting customer ID:', err);
      }
    }
    return null;
  }, [phone, props.customerId]);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const id = await resolveCustomerUuid();
      if (!id) {
        setCustomerId(null);
        setError('Customer not found. Please login again.');
        return;
      }
      setCustomerId(id);

      // apiClient rejects non-UUID first path segment for /customer/*/rewards/* (see customerUuidSegmentInPath).
      // Using a phone here fails synchronously — no network entry and empty UI; UUID is required.
      const [balanceRes, rewardsRes, historyRes, policyRes] = await Promise.all([
        apiClient.get<any>(`/customer/${id}/rewards/points`).catch(() => null),
        apiClient.get<any>(`/customer/${id}/rewards/available`).catch(() => null),
        apiClient.get<any>(`/customer/${id}/rewards/history`).catch(() => null),
        apiClient.get<any>(`/customer/${id}/loyalty/wallet-redeem-policy`).catch(() => null),
      ]);

      const balanceBody = unwrapApiBody(balanceRes);
      let loadedPoints = 0;
      if (balanceBody?.success || balanceBody?.points !== undefined) {
        loadedPoints = Number(balanceBody.points ?? balanceBody.totalPoints ?? 0);
        setBalance({
          points: loadedPoints,
          totalPoints: Number(balanceBody.totalPoints ?? balanceBody.points ?? 0),
          lifetimePointsEarned: Number(
            balanceBody.lifetimePointsEarned ??
              (balanceBody as any).lifetime_points_earned ??
              0
          ),
          lifetimePointsRedeemed: Number(
            balanceBody.lifetimePointsRedeemed ??
              (balanceBody as any).lifetime_points_redeemed ??
              0
          ),
        });
      }

      const policyBody = unwrapApiBody(policyRes);
      if (policyBody?.success) {
        setWalletPolicy({
          minRedemptionPoints: Number(policyBody.minRedemptionPoints),
          redemptionRatePointsPerRupee: Number(policyBody.redemptionRatePointsPerRupee ?? 0),
          rupeesPerPoint: Number(policyBody.rupeesPerPoint ?? 0),
          labelPointsToRupee: String(policyBody.labelPointsToRupee ?? ''),
          labelMinPoints: String(policyBody.labelMinPoints ?? ''),
        });
        const minP = Number(policyBody.minRedemptionPoints);
        setWalletPointsInput(loadedPoints >= minP ? String(loadedPoints) : '');
      } else {
        setWalletPolicy(null);
        setWalletPointsInput('');
      }

      const rewardsBody = unwrapApiBody(rewardsRes);
      if (
        rewardsBody?.success ||
        Array.isArray((rewardsBody as any)?.rewards) ||
        Array.isArray((rewardsBody as any)?.catalog)
      ) {
        const catalogRaw =
          (rewardsBody as any)?.rewards ||
          (rewardsBody as any)?.catalog ||
          (Array.isArray(rewardsBody) ? rewardsBody : []) ||
          [];
        setRewards(filterVisibleCatalogRewards(Array.isArray(catalogRaw) ? catalogRaw : []));
      }

      const historyRaw = unwrapApiBody(historyRes) ?? historyRes;
      const histList = Array.isArray(historyRaw)
        ? historyRaw
        : Array.isArray((historyRaw as any)?.history)
          ? (historyRaw as any).history
          : [];
      if ((historyRaw as any)?.success || histList.length > 0) {
        setHistory(histList);
      }
    } catch (err: any) {
      console.error('Error loading rewards:', err);
      setError(err.message || 'Failed to load rewards');
    } finally {
      setLoading(false);
    }
  }, [resolveCustomerUuid]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRedeem = async (reward: RewardItem) => {
    if (!customerId) {
      setError('Customer not found. Please login again.');
      return;
    }

    if (!balance || balance.points < reward.points_cost) {
      setError('Not enough points to redeem this reward');
      return;
    }

    if (!confirm(`Redeem ${reward.name} for ${reward.points_cost} points?`)) return;

    try {
      setRedeeming(reward.id);
      setError(null);

      const response = await apiClient.post<any>(`/customer/${customerId}/rewards/redeem`, {
        rewardId: reward.id,
        points: reward.points_cost,
      });

      const redeemBody = unwrapApiBody(response) ?? response;
      if (redeemBody?.success) {
        setSuccess(`Successfully redeemed: ${reward.name}! Check your rewards.`);
        const rem = Number(
          (redeemBody as any).points ??
            (redeemBody as any).remainingPoints ??
            balance?.points ??
            0
        );
        const le = Number((redeemBody as any).lifetimePointsEarned ?? balance?.lifetimePointsEarned ?? 0);
        const lr = Number((redeemBody as any).lifetimePointsRedeemed ?? balance?.lifetimePointsRedeemed ?? 0);
        setBalance({
          points: rem,
          totalPoints: rem,
          lifetimePointsEarned: le,
          lifetimePointsRedeemed: lr,
        });
        await loadData();
      } else {
        setError(
          (redeemBody as any)?.message ||
            (response as any)?.message ||
            'Failed to redeem reward'
        );
      }
    } catch (err: any) {
      console.error('Error redeeming reward:', err);
      setError(err.message || 'Failed to redeem reward');
    } finally {
      setRedeeming(null);
    }
  };

  const handleRedeemPointsToWallet = async () => {
    if (!customerId || !walletPolicy) {
      setError('Wallet redemption is not available.');
      return;
    }
    const pts = parseInt(String(walletPointsInput).replace(/\D/g, ''), 10);
    if (Number.isNaN(pts) || pts < 1) {
      setError('Enter a valid number of points to redeem.');
      return;
    }
    if (pts < walletPolicy.minRedemptionPoints) {
      setError(`You need at least ${walletPolicy.minRedemptionPoints} points to redeem to wallet.`);
      return;
    }
    const avail = balance?.points ?? 0;
    if (pts > avail) {
      setError('You do not have enough points for this amount.');
      return;
    }

    const est = Math.round((pts / walletPolicy.redemptionRatePointsPerRupee) * 100) / 100;
    if (!confirm(`Redeem ${pts} points to your wallet as ₹${est.toFixed(2)}?`)) return;

    try {
      setWalletRedeeming(true);
      setError(null);
      const response = await apiClient.post<any>(`/customer/${customerId}/loyalty/redeem-to-wallet`, {
        points: pts,
      });
      const body = unwrapApiBody(response) ?? response;
      if (body?.success) {
        const credited = Number(body.walletCredited ?? body.cashValue ?? 0);
        setSuccess(
          credited > 0
            ? `₹${credited.toFixed(2)} added to your wallet. You have ${Number(body.remainingPoints ?? 0)} points left.`
            : 'Points redeemed successfully.'
        );
        await loadData();
      } else {
        setError((body as any)?.error || (body as any)?.message || 'Could not redeem points to wallet.');
      }
    } catch (err: any) {
      console.error('redeem-to-wallet:', err);
      setError(err.message || 'Could not redeem points to wallet.');
    } finally {
      setWalletRedeeming(false);
    }
  };

  const dashboardStats = useMemo(() => {
    if (loading) {
      return [
        { value: '…', label: 'Available Points' },
        { value: '…', label: 'Total Earned' },
        { value: '…', label: 'Total Redeemed' },
      ];
    }
    const pts = balance?.points ?? 0;
    const earned = balance?.lifetimePointsEarned ?? 0;
    const redeemed = balance?.lifetimePointsRedeemed ?? 0;
    return [
      { value: pts.toLocaleString(), label: 'Available Points' },
      { value: earned.toLocaleString(), label: 'Total Earned' },
      { value: redeemed.toLocaleString(), label: 'Total Redeemed' },
    ];
  }, [loading, balance]);

  const categoryIcons: Record<string, string> = {
    discount: '🏷️',
    service: '✨',
    product: '🎁',
    experience: '🌟',
  };

  const headerSubtitle = loading
    ? 'Loading rewards…'
    : 'Earn points and redeem amazing rewards';

  return (
    <div className="min-h-screen min-h-[100dvh] w-full bg-neutral-200/90 sm:bg-neutral-200 flex justify-center">
      <div className="min-h-screen min-h-[100dvh] w-full max-w-customer bg-gradient-to-b from-orange-50 via-amber-50/90 to-orange-50/80 flex flex-col shadow-[0_0_0_1px_rgba(0,0,0,0.04)] sm:shadow-[0_0_48px_rgba(0,0,0,0.06)] sm:border-x border-black/[0.04] pb-[max(1rem,env(safe-area-inset-bottom,0px))]">
        <ServiceDashboardHeader
          className="shrink-0 z-10"
          serviceName="Rewards & Loyalty"
          serviceSubtitle={headerSubtitle}
          serviceIcon={Award}
          iconColor="text-white"
          stats={dashboardStats}
          onBack={props.onBack}
          showBackButton={Boolean(props.onBack)}
          onCloseToHome={props.onCloseToHome}
          bottomEdge="sheet"
          sheetToneClass="bg-orange-50"
        />

        <main className="flex-1 w-full min-h-0 -mt-4 overflow-y-auto px-3 pt-5 sm:px-4 sm:pt-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center px-4 py-16" aria-busy="true" aria-live="polite">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500" />
              <p className="mt-4 text-sm text-gray-600">Loading rewards...</p>
            </div>
          ) : (
            <div className="px-1 sm:px-0 pb-[max(1rem,env(safe-area-inset-bottom,0px))]">
              {/* Messages */}
              {error && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 flex items-center justify-between gap-2">
                  <span>{error}</span>
                  <button
                    type="button"
                    onClick={() => setError(null)}
                    className="text-red-400 hover:text-red-600 shrink-0 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg"
                    aria-label="Dismiss error"
                  >
                    ✕
                  </button>
                </div>
              )}

              {success && (
                <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl text-green-700 flex items-center justify-between gap-2">
                  <span>{success}</span>
                  <button
                    type="button"
                    onClick={() => setSuccess(null)}
                    className="text-green-400 hover:text-green-600 shrink-0 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg"
                    aria-label="Dismiss success message"
                  >
                    ✕
                  </button>
                </div>
              )}

              {/* Tabs */}
              <div className="mb-4">
                <div
                  className="flex bg-white rounded-xl p-1 shadow-sm border border-stone-200/90"
                  role="tablist"
                  aria-label="Rewards sections"
                >
                  {[
                    { id: 'rewards', label: 'Redeem Points', icon: '🎁' },
                    { id: 'history', label: 'Points History', icon: '📜' },
                  ].map(tab => (
                    <button
                      key={tab.id}
                      type="button"
                      role="tab"
                      aria-selected={activeTab === tab.id}
                      onClick={() => setActiveTab(tab.id as 'rewards' | 'history')}
                      className={`flex-1 min-h-[44px] py-2 px-1 rounded-lg text-xs font-semibold transition flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-1.5 leading-tight ${
                        activeTab === tab.id
                          ? 'bg-orange-500 text-white shadow-sm'
                          : 'text-gray-600 hover:bg-stone-50'
                      }`}
                    >
                      <span className="text-base leading-none" aria-hidden>
                        {tab.icon}
                      </span>
                      <span>{tab.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Rewards Tab */}
              {activeTab === 'rewards' && (
                <div className="space-y-6">
                  {walletPolicy && (
                    <div className="bg-white rounded-2xl p-5 shadow-sm border border-stone-200/80">
                      <h3 className="font-semibold text-gray-900">Redeem the points to wallet</h3>
                      <p className="text-sm text-gray-600 mt-2">{walletPolicy.labelPointsToRupee}</p>
                      <p className="text-sm text-gray-600 mt-1">{walletPolicy.labelMinPoints}</p>
                      <label htmlFor="wallet-points-redeem" className="mt-4 block text-xs font-medium text-gray-500">
                        Points to convert
                      </label>
                      <input
                        id="wallet-points-redeem"
                        type="number"
                        inputMode="numeric"
                        min={walletPolicy.minRedemptionPoints}
                        max={balance?.points ?? undefined}
                        value={walletPointsInput}
                        onChange={e => setWalletPointsInput(e.target.value)}
                        className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2.5 text-gray-900 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
                      />
                      <div className="flex items-center justify-between mt-4 pt-4 border-t border-stone-100">
                        <p className="text-xs text-gray-500">
                          Available:{' '}
                          <span className="font-semibold text-orange-600">{balance?.points ?? 0}</span> points
                        </p>
                        <button
                          type="button"
                          onClick={() => void handleRedeemPointsToWallet()}
                          disabled={
                            walletRedeeming ||
                            !walletPolicy ||
                            (balance?.points ?? 0) < walletPolicy.minRedemptionPoints
                          }
                          className={`px-6 py-2 rounded-lg font-medium transition ${
                            !walletRedeeming &&
                            walletPolicy &&
                            (balance?.points ?? 0) >= walletPolicy.minRedemptionPoints
                              ? 'bg-orange-500 text-white hover:bg-orange-600'
                              : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                          }`}
                        >
                          {walletRedeeming ? 'Processing…' : 'Redeem to Wallet'}
                        </button>
                      </div>
                    </div>
                  )}

                  {rewards.length === 0 ? (
                    <div className="bg-white rounded-2xl p-8 py-10 text-center shadow-sm border border-stone-200/80">
                      <div className="text-5xl mb-3" aria-hidden>
                        🎁
                      </div>
                      <p className="text-sm text-gray-600">No rewards available at the moment</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-4">
                      {rewards.map(reward => (
                        <div key={reward.id} className="bg-white rounded-2xl p-5 shadow-sm">
                          <div className="flex items-start gap-4">
                            <span className="text-3xl">{categoryIcons[reward.type] || '🎁'}</span>
                            <div className="flex-1">
                              <h3 className="font-semibold text-gray-900">{reward.name}</h3>
                              <p className="text-sm text-gray-600 mt-1">{reward.description}</p>
                              {reward.cash_value && (
                                <p className="text-xs text-gray-400 mt-2">Worth ₹{reward.cash_value}</p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center justify-between mt-4 pt-4 border-t">
                            <div>
                              <span className="text-xl font-bold text-orange-600">{reward.points_cost}</span>
                              <span className="text-sm text-gray-500 ml-1">points</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleRedeem(reward)}
                              disabled={redeeming === reward.id || (balance?.points || 0) < reward.points_cost}
                              className={`px-6 py-2 rounded-lg font-medium transition ${
                                (balance?.points || 0) >= reward.points_cost
                                  ? 'bg-orange-500 text-white hover:bg-orange-600'
                                  : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                              }`}
                            >
                              {redeeming === reward.id ? 'Redeeming...' : (balance?.points || 0) >= reward.points_cost ? 'Redeem' : 'Not enough points'}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* History Tab */}
              {activeTab === 'history' && (
                <div className="bg-white rounded-2xl shadow-sm border border-stone-200/80 overflow-hidden">
                  {history.length === 0 ? (
                    <div className="p-8 py-10 text-center">
                      <div className="text-5xl mb-3" aria-hidden>
                        📜
                      </div>
                      <p className="text-sm text-gray-600">No points history yet</p>
                    </div>
                  ) : (
                    <div className="divide-y">
                      {history.map(item => (
                        <div key={item.id} className="p-4 flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg ${
                              item.type === 'earned' ? 'bg-green-100' :
                              item.type === 'redeemed' ? 'bg-orange-100' :
                              'bg-gray-100'
                            }`}>
                              {item.type === 'earned' ? '💰' :
                               item.type === 'redeemed' ? '🎫' : '⏰'}
                            </div>
                            <div>
                              <p className="font-medium text-gray-900">{item.description || `${item.type} points`}</p>
                              <p className="text-sm text-gray-500">
                                {new Date(item.date || (item as any).created_at || Date.now()).toLocaleDateString('en-IN', {
                                  day: 'numeric',
                                  month: 'short',
                                  year: 'numeric'
                                })}
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
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
