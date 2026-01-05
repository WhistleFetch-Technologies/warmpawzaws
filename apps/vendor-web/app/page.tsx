'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { VendorApp } from '@/components/vendor/VendorApp';

interface VendorSession {
  phone: string;
  vendorId?: string;
  vendor?: any;
  sessionToken?: string;
  verified: boolean;
  isStaffLogin?: boolean;
  staff?: any;
}

export default function VendorHomePage() {
  const router = useRouter();
  const [session, setSession] = useState<VendorSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Get session data from localStorage
    const loadSession = () => {
      const storedPhone = localStorage.getItem('vendorPhone');
      const storedToken = localStorage.getItem('authToken');
      const storedVendor = localStorage.getItem('vendorData');
      const storedVendorId = localStorage.getItem('vendorId');

      if (storedPhone && storedToken) {
        const vendorData = storedVendor ? JSON.parse(storedVendor) : null;
        
        setSession({
          phone: storedPhone,
          sessionToken: storedToken,
          verified: true,
          vendor: vendorData,
          vendorId: storedVendorId || vendorData?.id
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
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-amber-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return null; // Will redirect to /auth
  }

  return <VendorApp initialSession={session} />;
}
