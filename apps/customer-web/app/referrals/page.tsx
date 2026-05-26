'use client';

import { ReferralSystemPage } from '@/components/customer/ReferralSystemPage';
import { goBackOrHome, handleWalletChildPageBack } from '@/lib/go-back-or-replace';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function ReferralsPage() {
  const router = useRouter();
  const [phone, setPhone] = useState<string | undefined>(undefined);

  useEffect(() => {
    const stored = localStorage.getItem('customerPhone');
    setPhone(stored ?? undefined);
  }, []);

  return (
    <ReferralSystemPage
      customerPhone={phone}
      customerId={phone}
      onBack={() => handleWalletChildPageBack(router)}
      onCloseToHome={() => goBackOrHome(router)}
    />
  );
}
