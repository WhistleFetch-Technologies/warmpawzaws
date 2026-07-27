'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { isWarmpawzAppointmentsAdminEnabled } from '@/lib/warmpawz-appointments-admin-feature';

export default function WarmpawzAppointmentsIndexPage() {
  const router = useRouter();

  useEffect(() => {
    if (!isWarmpawzAppointmentsAdminEnabled()) {
      router.replace('/');
      return;
    }
    router.replace('/warmpawz-appointments/catalogue');
  }, [router]);

  return null;
}
