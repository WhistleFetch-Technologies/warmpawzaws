'use client';

import { useEffect } from 'react';
import { getStaticImagePrewarmPaths } from '@/lib/static-image-prewarm';
import { scheduleStaticImagePrewarm } from '@/lib/image-asset-cache';

/** Idle pre-warm of home/shop static images into IndexedDB. */
export function StaticImagePrewarm() {
  useEffect(() => {
    scheduleStaticImagePrewarm(getStaticImagePrewarmPaths());
  }, []);
  return null;
}
