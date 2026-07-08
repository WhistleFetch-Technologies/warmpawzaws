'use client';

import { useMemo } from 'react';
import { CommercialCampaignHub as SharedCommercialCampaignHub } from '@warmpawz/commercial-campaign-ui';
import { createAdminCampaignApi } from '@/lib/commercial-campaign/admin-campaign-api-adapter';
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

  return (
    <SharedCommercialCampaignHub
      surface={surface}
      readOnly={false}
      api={api}
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
