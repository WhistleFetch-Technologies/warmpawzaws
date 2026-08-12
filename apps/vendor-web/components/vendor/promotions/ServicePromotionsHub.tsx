'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import CapabilityHelper from '@/lib/capability-helper';
import { useVendorCapabilities } from '@/components/vendor/hooks/useVendorCapabilities';
import {
  PromotionDashboard,
  type PromotionDomain,
  enrichPromotionRow,
  splitVendorPromotionRows,
  isEligiblePublishedInventory,
  wizardToVendorServicePayload,
  type NormalizedCouponItem,
  type NormalizedPromotionItem,
  type PromotionTargetCatalog,
  type PromotionWizardForm,
  type TargetScopeId,
} from '@warmpawz/promotion-management-ui';
import { VendorCommercialCampaigns } from '@/components/vendor/campaigns/VendorCommercialCampaigns';

interface ServicePromotionsHubProps {
  vendorId: string;
  vendorRole?: string;
  roleId?: string;
  onBack?: () => void;
}

const SERVICE_PROMOTION_DOMAINS: PromotionDomain[] = ['service', 'package'];

function serviceDisplayName(s: Record<string, unknown>): string {
  const raw = s.serviceName ?? s.name ?? s.service_name;
  if (raw == null || raw === '') return 'Unnamed service';
  const label = String(raw).trim();
  return label === 'undefined' ? 'Unnamed service' : label;
}

function serviceDisplayPrice(s: Record<string, unknown>): number | undefined {
  const raw = s.customPrice ?? s.custom_price ?? s.price;
  if (raw == null || raw === '') return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

function packageDisplayName(p: Record<string, unknown>): string {
  const raw = p.packageName ?? p.package_name ?? p.name;
  if (raw == null || raw === '') return 'Unnamed package';
  const label = String(raw).trim();
  return label === 'undefined' ? 'Unnamed package' : label;
}

function packageDisplayPrice(p: Record<string, unknown>): number | undefined {
  const raw = p.packagePrice ?? p.package_price ?? p.price;
  if (raw == null || raw === '') return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

function dedupeOptions<T extends { id: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

function buildEnabledTargetScopes(
  capabilities: Record<string, boolean>,
  catalog: PromotionTargetCatalog
): TargetScopeId[] {
  const scopes: TargetScopeId[] = ['services'];

  const showPackages =
    CapabilityHelper.hasPackageManagement(capabilities) ||
    CapabilityHelper.hasCapability(capabilities, 'packages') ||
    (catalog.packages?.length ?? 0) > 0;

  const showMealPlans =
    CapabilityHelper.hasCapability(capabilities, 'meal_plans') ||
    (catalog.mealPlans?.length ?? 0) > 0;

  if (showPackages) scopes.push('packages');
  if (showMealPlans) scopes.push('meal_plans');
  scopes.push('styles');
  return scopes;
}

export function ServicePromotionsHub({
  vendorId,
  vendorRole,
  roleId,
  onBack,
}: ServicePromotionsHubProps) {
  const [view, setView] = useState<'promotions' | 'campaigns'>('promotions');
  const [promotions, setPromotions] = useState<NormalizedPromotionItem[]>([]);
  const [coupons, setCoupons] = useState<NormalizedCouponItem[]>([]);
  const [catalog, setCatalog] = useState<PromotionTargetCatalog>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { capabilities } = useVendorCapabilities(roleId);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const hasMealPlans = CapabilityHelper.hasCapability(capabilities, 'meal_plans');

      const [promosRes, servicesRes, packagesRes, mealPlansRes] = await Promise.all([
        apiClient.get<any>(`/vendor/${vendorId}/service-promotions`),
        apiClient.get<any>(`/vendor/${vendorId}/services/enabled`),
        apiClient.get<any>(`/vendor/${vendorId}/packages`).catch(() => ({ packages: [] })),
        hasMealPlans
          ? apiClient
              .get<any>(`/vendor/${vendorId}/nutritionist/meal-plans`)
              .catch(() => ({ mealPlans: [], plans: [] }))
          : Promise.resolve({ mealPlans: [], plans: [] }),
      ]);

      const rows = promosRes?.promotions || [];
      const services = (servicesRes?.services || []) as Record<string, unknown>[];
      const nonPackageServices = services.filter((s) => !s.isPackage && !s.is_package);
      const packageServices = services.filter((s) => s.isPackage || s.is_package);
      const standalonePackages = ((packagesRes as any)?.packages || []) as Record<string, unknown>[];

      const mealPlanRows = ((mealPlansRes as any)?.mealPlans ?? (mealPlansRes as any)?.plans ?? []) as Record<
        string,
        unknown
      >[];

      const nextCatalog: PromotionTargetCatalog = {
        services: dedupeOptions(
          nonPackageServices
            .filter(isEligiblePublishedInventory)
            .map((s) => {
            const price = serviceDisplayPrice(s);
            return {
              id: String(s.id),
              label: serviceDisplayName(s),
              subtitle: price != null ? `₹${price}` : undefined,
              price,
            };
          })
        ),
        packages: dedupeOptions(
          [
            ...packageServices.filter(isEligiblePublishedInventory).map((s) => {
              const price = serviceDisplayPrice(s);
              return {
                id: String(s.id),
                label: serviceDisplayName(s),
                subtitle: price != null ? `₹${price}` : undefined,
                price,
              };
            }),
            ...standalonePackages.filter(isEligiblePublishedInventory).map((p) => {
              const price = packageDisplayPrice(p);
              const sessionCount = p.sessionCount ?? p.session_count ?? p.totalSessions ?? p.total_sessions;
              return {
                id: String(p.id),
                label: packageDisplayName(p),
                subtitle:
                  price != null
                    ? `₹${price}${sessionCount ? ` - ${sessionCount} sessions` : ''}`
                    : sessionCount
                      ? `${sessionCount} sessions`
                      : undefined,
                price,
              };
            }),
          ].filter((p) => p.id && p.id !== 'undefined')
        ),
        mealPlans: dedupeOptions(
          mealPlanRows
            .filter(isEligiblePublishedInventory)
            .map((p) => {
              const mealPrice =
                p.price_per_meal != null
                  ? Number(p.price_per_meal)
                  : p.price != null
                    ? Number(p.price)
                    : undefined;
              const price =
                mealPrice != null && Number.isFinite(mealPrice) ? mealPrice : undefined;
              return {
                id: String(p.id),
                label: String(p.name ?? p.plan_name ?? p.planName ?? 'Meal plan'),
                subtitle: price != null ? `₹${price}` : undefined,
                price,
              };
            })
            .filter((p) => p.id && p.id !== 'undefined')
        ),
        styles: [
          { id: 'at_home', label: 'At home' },
          { id: 'at_center', label: 'At center' },
          { id: 'tele', label: 'Tele' },
        ],
      };

      setCatalog(nextCatalog);

      const enriched = rows.map((r: Record<string, unknown>) =>
        enrichPromotionRow(r, nextCatalog, { vendorMode: true })
      );
      const split = splitVendorPromotionRows(enriched);
      setPromotions(split.promotions);
      setCoupons(split.coupons);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load promotions');
    } finally {
      setLoading(false);
    }
  }, [vendorId, capabilities]);

  useEffect(() => {
    load();
  }, [load]);

  const enabledTargetScopes = useMemo(
    () => buildEnabledTargetScopes(capabilities, catalog),
    [capabilities, catalog]
  );

  const existingCodes = useMemo(
    () => [...promotions, ...coupons.map((c) => ({ code: c.code }))].map((p) => p.code).filter(Boolean) as string[],
    [promotions, coupons]
  );

  const scope = useMemo(
    () => ({
      mode: 'vendor_services' as const,
      title: 'Service Promotions',
      subtitle: `Auto-applied offers and coupon codes for ${vendorRole ?? 'service'} bookings`,
      canManageCoupons: true,
      canManagePlatformTargets: false,
      domains: SERVICE_PROMOTION_DOMAINS,
      enabledTargetScopes,
    }),
    [vendorRole, enabledTargetScopes]
  );

  const savePromotion = async (form: PromotionWizardForm, _publish: boolean, editingId?: string) => {
    const payload = wizardToVendorServicePayload(form, vendorId);
    if (editingId) {
      await apiClient.put(`/vendor/${vendorId}/service-promotions/${editingId}`, payload);
    } else {
      await apiClient.post(`/vendor/${vendorId}/service-promotions`, payload);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {onBack && (
        <header className="sticky top-0 z-10 shrink-0 vendor-screen-safe-top border-b bg-white">
          <div className="vendor-header-safe-x flex items-center px-4 pb-3">
            <button
              type="button"
              onClick={onBack}
              className="inline-flex h-11 min-w-[44px] items-center gap-2 rounded-xl px-2 text-sm font-medium text-slate-600 hover:bg-gray-100 active:bg-gray-200"
              aria-label="Go back"
            >
              <ArrowLeft className="h-5 w-5" aria-hidden />
              Back
            </button>
          </div>
        </header>
      )}

      <div className="border-b bg-white px-4 py-2">
        <div className="mx-auto flex max-w-6xl gap-2">
          <button
            type="button"
            className={`rounded-lg px-3 py-1.5 text-sm ${
              view === 'promotions' ? 'bg-orange-50 font-semibold text-orange-800' : 'text-slate-600'
            }`}
            onClick={() => setView('promotions')}
          >
            Promotions
          </button>
          <button
            type="button"
            className={`rounded-lg px-3 py-1.5 text-sm ${
              view === 'campaigns' ? 'bg-orange-50 font-semibold text-orange-800' : 'text-slate-600'
            }`}
            onClick={() => setView('campaigns')}
          >
            Campaigns
          </button>
        </div>
      </div>

      {view === 'campaigns' ? (
        <VendorCommercialCampaigns vendorId={vendorId} surface="marketing" />
      ) : (
        <PromotionDashboard
          scope={scope}
          promotions={promotions}
          coupons={coupons}
          catalog={catalog}
          loading={loading}
          error={error}
          existingCodes={existingCodes}
          onRefresh={load}
          onSave={savePromotion}
          onDeletePromotion={async (id) => {
            await apiClient.delete(`/vendor/${vendorId}/service-promotions/${id}`);
          }}
          onTogglePromotion={async (id, active) => {
            await apiClient.put(`/vendor/${vendorId}/service-promotions/${id}`, { is_active: active });
          }}
          onDeleteCoupon={async (id) => {
            await apiClient.delete(`/vendor/${vendorId}/service-promotions/${id}`);
          }}
          onToggleCoupon={async (id, active) => {
            await apiClient.put(`/vendor/${vendorId}/service-promotions/${id}`, { is_active: active });
          }}
        />
      )}
    </div>
  );
}
