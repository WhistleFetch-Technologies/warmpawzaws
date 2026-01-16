'use client';

import { StaffAuth } from '@/components/staff/StaffAuth';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function StaffLoginPage() {
  const router = useRouter();

  const handleAuthSuccess = (staff: any) => {
    // Store staff session
    if (typeof window !== 'undefined') {
      localStorage.setItem('staff_session', JSON.stringify(staff));
      localStorage.setItem('staff_id', staff.id);
      router.push('/staff/dashboard');
    }
  };

  useEffect(() => {
    // Check if already logged in
    if (typeof window !== 'undefined') {
      const staffSession = localStorage.getItem('staff_session');
      if (staffSession) {
        router.push('/staff/dashboard');
      }
    }
  }, [router]);

  return <StaffAuth onAuthSuccess={handleAuthSuccess} />;
}
