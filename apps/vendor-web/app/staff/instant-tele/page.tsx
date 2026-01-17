'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { InstantTeleQueue } from '@/components/staff/InstantTeleQueue';

export default function StaffInstantTelePage() {
  const router = useRouter();
  const [staffId, setStaffId] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const staffSession = localStorage.getItem('staff_session');
      if (!staffSession) {
        router.push('/staff/login');
        return;
      }

      try {
        const staffData = JSON.parse(staffSession);
        setStaffId(staffData.id);
      } catch (error) {
        console.error('Error parsing staff session:', error);
        router.push('/staff/login');
      }
    }
  }, [router]);

  if (!staffId) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF8C42]"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        <button
          onClick={() => router.back()}
          className="mb-4 text-gray-600 hover:text-gray-800 flex items-center gap-2"
        >
          ← Back to Dashboard
        </button>
        <InstantTeleQueue staffId={staffId} />
      </div>
    </div>
  );
}
