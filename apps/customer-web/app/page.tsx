'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CustomerHomeComplete } from '@/components/customer/CustomerHomeComplete';

export default function HomePage() {
  const router = useRouter();
  const [phone, setPhone] = useState<string | null>(null);

  useEffect(() => {
    // Get phone from localStorage or auth
    const storedPhone = localStorage.getItem('customerPhone');
    if (storedPhone) {
      setPhone(storedPhone);
    } else {
      // Redirect to auth if no phone
      router.push('/auth');
    }
  }, [router]);

  if (!phone) {
    return <div>Loading...</div>;
  }

  return <CustomerHomeComplete phone={phone} />;
}

