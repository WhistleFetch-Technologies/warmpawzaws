'use client';

import { MyBookings } from '@/components/customer/MyBookings';
import { useEffect, useState } from 'react';

export default function BookingsPage() {
  const [phone, setPhone] = useState<string | null>(null);

  useEffect(() => {
    const storedPhone = localStorage.getItem('customerPhone');
    setPhone(storedPhone);
  }, []);

  if (!phone) {
    return <div>Loading...</div>;
  }

  return <MyBookings phone={phone} onBack={() => window.history.back()} />;
}

