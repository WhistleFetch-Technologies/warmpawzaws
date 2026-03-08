'use client';

export const dynamic = 'force-dynamic';

import nextDynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

const VendorApp = nextDynamic(
  () => import('@/components/vendor/landingPage/VendorApp').then((m) => ({ default: m.VendorApp })),
  { ssr: false }
);

interface VendorSession {
  phone: string;
  vendorId?: string;
  vendor?: any;
  sessionToken?: string;
  verified: boolean;
  isStaffLogin?: boolean;
  staff?: any;
}

export default function OnboardingPage() {
  const router = useRouter();
  const [session, setSession] = useState<VendorSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Get session data from localStorage
    // Add small delay to ensure localStorage is available after redirect
    const loadSession = () => {
      // Try multiple times to handle race condition with localStorage write
      const checkSession = (attempt = 0) => {
        const storedPhone = localStorage.getItem('vendorPhone');
        const storedToken = localStorage.getItem('authToken');
        const storedVendor = localStorage.getItem('vendorData');
        const storedVendorId = localStorage.getItem('vendorId');

        console.log('🔍 [OnboardingPage] Checking session (attempt', attempt + 1, '):', {
          phone: !!storedPhone,
          token: !!storedToken,
          vendor: !!storedVendor,
          vendorId: !!storedVendorId
        });

        if (storedPhone && storedToken) {
          const vendorData = storedVendor ? JSON.parse(storedVendor) : null;
          
          setSession({
            phone: storedPhone,
            sessionToken: storedToken,
            verified: true,
            vendor: vendorData,
            vendorId: storedVendorId || vendorData?.id
          });
          setIsLoading(false);
        } else if (attempt < 3) {
          // Retry up to 3 times with increasing delays
          const delay = (attempt + 1) * 100; // 100ms, 200ms, 300ms
          console.log(`⏳ [OnboardingPage] Session not found, retrying in ${delay}ms...`);
          setTimeout(() => checkSession(attempt + 1), delay);
        } else {
          // After 3 attempts, redirect to auth
          console.warn('⚠️ [OnboardingPage] Session not found after retries, redirecting to /auth');
          router.push('/auth');
          setIsLoading(false);
        }
      };

      // Start checking with small initial delay
      setTimeout(() => checkSession(0), 50);
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

