'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  isServiceStyleHidden,
  loadCustomerServiceLaunchCatalog,
  resolveServiceStyleLaunchFromCatalog,
} from '@/lib/customer-service-style-launch';
import {
  PREMIUM_SERVICE_CARDS,
  type PremiumServiceCardEntry,
} from '../constants/premium-service-cards-catalog';

export function usePremiumServiceCards(
  phone: string | undefined,
  customerCommerceEnabled: boolean,
  reviewDemoAccount: boolean
) {
  const [launchCatalog, setLaunchCatalog] = useState<
    Awaited<ReturnType<typeof loadCustomerServiceLaunchCatalog>>
  >([]);

  useEffect(() => {
    if (!phone) {
      setLaunchCatalog([]);
      return;
    }
    let cancelled = false;
    void loadCustomerServiceLaunchCatalog(phone).then((catalog) => {
      if (!cancelled) setLaunchCatalog(catalog);
    });
    return () => {
      cancelled = true;
    };
  }, [phone]);

  const visibleCards: PremiumServiceCardEntry[] = useMemo(() => {
    return PREMIUM_SERVICE_CARDS.filter((entry) => {
      if (entry.requiresCommerce) {
        if (!customerCommerceEnabled || reviewDemoAccount) return false;
        return true;
      }

      if (!entry.launchServiceId || !entry.launchServiceStyle) return true;
      if (!launchCatalog.length) return true;

      const { status } = resolveServiceStyleLaunchFromCatalog(
        launchCatalog,
        entry.launchServiceId,
        entry.launchServiceStyle
      );
      return !isServiceStyleHidden(status);
    });
  }, [customerCommerceEnabled, launchCatalog, reviewDemoAccount]);

  return { cards: visibleCards };
}
