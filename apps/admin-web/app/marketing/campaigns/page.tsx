'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AdminLayout } from '@/components/admin/layout/AdminLayout';

export default function MarketingCampaignsRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/promotion-center?tab=campaigns');
  }, [router]);

  return (
    <AdminLayout>
      <div className="flex min-h-[40vh] items-center justify-center text-slate-500">
        Redirecting to Promotion Center…
      </div>
    </AdminLayout>
  );
}
