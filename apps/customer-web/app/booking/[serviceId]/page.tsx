'use client';

import { BookingFlow } from '@/components/customer/BookingFlow';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function BookingPage() {
  const params = useParams();
  const [phone, setPhone] = useState<string | null>(null);

  useEffect(() => {
    const storedPhone = localStorage.getItem('customerPhone');
    setPhone(storedPhone);
  }, []);

  if (!phone) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-gray-600">Please login to book a service</p>
          <a href="/auth" className="mt-4 inline-block px-6 py-2 bg-orange-500 text-white rounded-full">
            Login
          </a>
        </div>
      </div>
    );
  }

  return <BookingFlow serviceId={params.serviceId as string} customerPhone={phone} />;
}

