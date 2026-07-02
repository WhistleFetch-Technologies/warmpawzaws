'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import {
  PromotionDashboard,
  normalizePromotionRow,
  wizardToVendorServicePayload,
  type PromotionTargetCatalog,
  type PromotionWizardForm,
} from '@warmpawz/promotion-management-ui';

interface ServicePromotionsHubProps {
  vendorId: string;
  vendorRole?: string;
  onBack?: () => void;
}

export function ServicePromotionsHub({ vendorId, vendorRole, onBack }: ServicePromotionsHubProps) {
  const [promotions, setPromotions] = useState<ReturnType<typeof normalizePromotionRow>[]>([]);
  const [catalog, setCatalog] = useState<PromotionTargetCatalog>({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [promosRes, servicesRes] = await Promise.all([
        apiClient.get<any>(`/vendor/${vendorId}/service-promotions`),
        apiClient.get<any>(`/vendor/${vendorId}/services/enabled`),
      ]);
      const rows = (promosRes as any)?.promotions || [];
      setPromotions(rows.map((r: Record<string, unknown>) => normalizePromotionRow(r)));
      const services = (servicesRes as any)?.services || [];
      setCatalog({
        services: services.map((s: any) => ({
          id: String(s.id),
          label: String(s.name ?? s.service_name),
          subtitle: s.price != null ? `₹${s.price}` : undefined,
        })),
        packages: services
          .filter((s: any) => s.is_package || s.isPackage)
          .map((s: any) => ({
            id: String(s.id),
            label: String(s.name),
          })),
        mealPlans: [],
        styles: [
          { id: 'all', label: 'All styles' },
          { id: 'at_home', label: 'At home' },
          { id: 'at_center', label: 'At center' },
          { id: 'tele', label: 'Tele' },
        ],
      });
    } finally {
      setLoading(false);
    }
  }, [vendorId]);

  useEffect(() => {
    load();
  }, [load]);

  const scope = useMemo(
    () => ({
      mode: 'vendor_services' as const,
      title: 'Service Promotions',
      subtitle: `Auto-applied offers for ${vendorRole ?? 'service'} bookings`,
      canManageCoupons: false,
      canManagePlatformTargets: false,
      domains: ['service', 'package'] as const,
    }),
    [vendorRole]
  );

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
        catalog={catalog}
        loading={loading}
        onRefresh={load}
        onSave={async (form, _publish, editingId) => {
          const payload = wizardToVendorServicePayload(form, vendorId);
          if (editingId) {
            await apiClient.put(`/vendor/${vendorId}/service-promotions/${editingId}`, payload);
          } else {
            await apiClient.post(`/vendor/${vendorId}/service-promotions`, payload);
          }
        }}
        onDeletePromotion={async (id) => {
          await apiClient.delete(`/vendor/${vendorId}/service-promotions/${id}`);
          load();
        }}
        onTogglePromotion={async (id, active) => {
          await apiClient.put(`/vendor/${vendorId}/service-promotions/${id}`, { is_active: active });
          load();
        }}
      />
    </div>
  );
}
