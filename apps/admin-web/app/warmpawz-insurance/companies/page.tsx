'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function WarmpawzInsuranceCompaniesRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/warmpawz-insurance');
  }, [router]);
  return null;
}
