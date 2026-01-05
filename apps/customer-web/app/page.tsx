'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CustomerApp } from '@/components/customer/CustomerApp';

interface CustomerSession {
  phone: string;
  customerId?: string;
  customer?: any;
  sessionToken?: string;
  verified: boolean;
  isNewUser?: boolean;
  hasCompletedOnboarding?: boolean;
  hasPets?: boolean;
}

export default function HomePage() {
  const router = useRouter();
  const [session, setSession] = useState<CustomerSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Get session data from localStorage
    const loadSession = () => {
      const storedPhone = localStorage.getItem('customerPhone');
      const storedToken = localStorage.getItem('authToken');
      const storedCustomer = localStorage.getItem('customerData');
      const storedOnboarding = localStorage.getItem('customerOnboardingComplete');
      const storedPets = localStorage.getItem('customerPets');

      if (storedPhone && storedToken) {
        const customerData = storedCustomer ? JSON.parse(storedCustomer) : null;
        const petsData = storedPets ? JSON.parse(storedPets) : null;
        
        setSession({
          phone: storedPhone,
          sessionToken: storedToken,
          verified: true,
          customer: customerData,
          hasCompletedOnboarding: storedOnboarding === 'true',
          hasPets: petsData && petsData.length > 0,
          isNewUser: !storedOnboarding
        });
      } else {
        // Redirect to auth if no session
        router.push('/auth');
      }
      setIsLoading(false);
    };

    loadSession();
  }, [router]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return null; // Will redirect to /auth
  }

  return <CustomerApp initialSession={session} />;
}
