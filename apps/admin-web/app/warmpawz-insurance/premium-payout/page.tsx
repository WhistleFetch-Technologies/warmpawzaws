'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function WarmpawzInsurancePayoutRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/warmpawz-insurance/dashboard');
  }, [router]);
  return null;
}
