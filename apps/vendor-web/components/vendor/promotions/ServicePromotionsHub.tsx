'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import CapabilityHelper from '@/lib/capability-helper';
import { useVendorCapabilities } from '@/components/vendor/hooks/useVendorCapabilities';
import {
  PromotionDashboard,
  enrichPromotionRow,
  splitVendorPromotionRows,
  wizardToVendorServicePayload,
  type NormalizedCouponItem,
  type NormalizedPromotionItem,
  type PromotionTargetCatalog,
  type PromotionWizardForm,
  type TargetScopeId,
} from '@warmpawz/promotion-management-ui';

interface ServicePromotionsHubProps {
  vendorId: string;
  vendorRole?: string;
  roleId?: string;
  onBack?: () => void;
}

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

      const requests: Promise<unknown>[] = [
        apiClient.get<any>(`/vendor/${vendorId}/service-promotions`),
        apiClient.get<any>(`/vendor/${vendorId}/services/enabled`),
      ];

      if (hasMealPlans) {
        requests.push(
          apiClient
            .get<any>(`/vendor/${vendorId}/nutritionist/meal-plans`)
            .catch(() => ({ mealPlans: [], plans: [] }))
        );
      }

      const results = await Promise.all(requests);
      const promosRes = results[0] as any;
      const servicesRes = results[1] as any;
      const mealPlansRes = hasMealPlans ? (results[2] as any) : null;

      const rows = promosRes?.promotions || [];
      const services = (servicesRes?.services || []) as Record<string, unknown>[];
      const nonPackageServices = services.filter((s) => !s.isPackage && !s.is_package);
      const packageServices = services.filter((s) => s.isPackage || s.is_package);

      const mealPlanRows = (mealPlansRes?.mealPlans ?? mealPlansRes?.plans ?? []) as Record<
        string,
        unknown
      >[];

      const nextCatalog: PromotionTargetCatalog = {
        services: dedupeOptions(
          nonPackageServices.map((s) => {
            const price = serviceDisplayPrice(s);
            return {
              id: String(s.id),
              label: serviceDisplayName(s),
              subtitle: price != null ? `₹${price}` : undefined,
            };
          })
        ),
        packages: dedupeOptions(
          packageServices.map((s) => {
            const price = serviceDisplayPrice(s);
            return {
              id: String(s.id),
              label: serviceDisplayName(s),
              subtitle: price != null ? `₹${price}` : undefined,
            };
          })
        ),
        mealPlans: dedupeOptions(
          mealPlanRows.map((p) => ({
            id: String(p.id),
            label: String(p.name ?? p.plan_name ?? p.planName ?? 'Meal plan'),
            subtitle:
              p.price != null || p.price_per_meal != null
                ? `₹${p.price_per_meal ?? p.price}`
                : undefined,
          }))
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
      domains: ['service', 'package'] as const,
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
        <div className="bg-white border-b px-4 py-3">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-600"
          >
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
        </div>
      )}
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
    </div>
  );
}
