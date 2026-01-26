'use client';

import { StaffAuth } from '@/components/staff/StaffAuth';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function StaffLoginPage() {
  const router = useRouter();

  const handleAuthSuccess = (session: any) => {
    // ✅ FIX: Staff login now uses same format as vendor login
    // Route to vendor dashboard (same as vendors)
    console.log('✅ [StaffLoginPage] Authentication successful:', session);
    
    if (typeof window !== 'undefined') {
      // Session is already stored by StaffAuth component
      // Check onboarding status to route correctly
      const onboardingStatus = session.onboardingStatus || session.profile?.onboarding_status || 'ACTIVATED';
      const isActive = ['ACTIVATED', 'APPROVED'].includes(onboardingStatus);
      
      // ✅ FIX: Route to vendor dashboard (same as vendors)
      if (isActive) {
        console.log('✅ [StaffLoginPage] Active staff - routing to vendor dashboard');
        window.location.href = '/'; // Vendor dashboard
      } else {
        console.log('🔄 [StaffLoginPage] Routing to onboarding');
        window.location.href = '/onboarding';
      }
    }
  };

  useEffect(() => {
    // ✅ FIX: Check vendor session (same as vendors) instead of staff_session
    if (typeof window !== 'undefined') {
      const storedPhone = localStorage.getItem('vendorPhone');
      const storedToken = localStorage.getItem('authToken');
      
      if (storedPhone && storedToken) {
        // Already logged in as vendor (staff uses same session)
        const onboardingStatus = localStorage.getItem('vendorApplicationStatus');
        const isActive = ['ACTIVATED', 'APPROVED'].includes(onboardingStatus || '');
        
        if (isActive) {
          window.location.href = '/'; // Vendor dashboard
        } else {
          window.location.href = '/onboarding';
        }
      }
    }
  }, [router]);

  return <StaffAuth onAuthSuccess={handleAuthSuccess} />;
}
