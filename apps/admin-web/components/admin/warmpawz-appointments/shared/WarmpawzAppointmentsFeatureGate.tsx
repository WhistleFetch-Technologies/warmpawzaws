'use client';

import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { isWarmpawzAppointmentsAdminEnabled } from '@/lib/warmpawz-appointments-admin-feature';

export function WarmpawzAppointmentsFeatureGate({
  children,
}: {
  readonly children: ReactNode;
}) {
  const router = useRouter();
  const enabled = isWarmpawzAppointmentsAdminEnabled();

  useEffect(() => {
    if (!enabled) {
      router.replace('/');
    }
  }, [enabled, router]);

  if (!enabled) {
    return null;
  }

  return <>{children}</>;
}
