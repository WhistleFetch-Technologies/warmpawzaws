'use client';

import { useCallback, useMemo } from 'react';
import { CommercialCampaignHub as SharedCommercialCampaignHub } from '@warmpawz/commercial-campaign-ui';
import { createAdminCampaignApi } from '@/lib/commercial-campaign/admin-campaign-api-adapter';
import { useCommercialAiOptional } from '@/context/CommercialAiContext';
import type { AdminPromoSurface } from '@/lib/promotion-domain/surface-config';
import {
  ECOMMERCE_CAMPAIGN_TITLE,
  MARKETING_CAMPAIGN_TITLE,
} from '@/lib/promotion-domain/surface-config';
import { useCommercialCampaigns } from '@/hooks/marketing/useCommercialCampaigns';
import { CampaignBuilderDialog } from './CampaignBuilderDialog';
import type { CommercialCampaignRecord } from '@/lib/commercial-campaign/types';

/**
 * Admin Commercial Campaign Hub — full access.
 * Same SharedCommercialCampaignHub used by Vendor/Seller with readOnly + participant scope.
 */
export function CommercialCampaignHub({ surface = 'marketing' }: { surface?: AdminPromoSurface }) {
  const api = useMemo(() => createAdminCampaignApi(), []);
  const { registry, reload } = useCommercialCampaigns({ surface });
  const commercialAi = useCommercialAiOptional();

  const handleEntityFocus = useCallback(
    (entity: { type: 'campaign'; id: string; name: string } | null) => {
      if (!commercialAi) return;
      if (!entity) {
        commercialAi.setEntity(null);
        return;
      }
      commercialAi.setEntity({ type: 'campaign', id: entity.id, name: entity.name });
    },
    [commercialAi]
  );

  return (
    <SharedCommercialCampaignHub
      surface={surface}
      readOnly={false}
      api={api}
      onEntityFocus={handleEntityFocus}
      title={surface === 'ecommerce' ? ECOMMERCE_CAMPAIGN_TITLE : MARKETING_CAMPAIGN_TITLE}
      subtitle={
        surface === 'ecommerce'
          ? 'Marketplace campaign orchestration over seller promotions & coupons — Phase 10'
          : 'Service campaign orchestration over promotions, coupons, notifications & analytics — Phase 10'
      }
      renderBuilder={({ open, onClose, cloneFrom, onSuccess }) => (
        <CampaignBuilderDialog
          open={open}
          onClose={onClose}
          registry={registry}
          cloneFrom={cloneFrom as CommercialCampaignRecord | null}
          onSuccess={() => {
            void reload();
            onSuccess();
          }}
          surface={surface}
        />
      )}
    />
  );
}
