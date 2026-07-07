'use client';

import { Suspense, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AdminLayout } from '@/components/admin/layout/AdminLayout';

function PromotionsRedirectInner() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/promotion-center?tab=platform');
  }, [router]);

  return (
    <div className="flex min-h-[40vh] items-center justify-center text-slate-500">
      Redirecting to Promotion Center…
    </div>
  );
}

/** Legacy route — redirects to Promotion Center. */
export default function PromotionsRedirectPage() {
  return (
    <AdminLayout>
      <Suspense fallback={<div className="p-8 text-slate-500">Loading…</div>}>
        <PromotionsRedirectInner />
      </Suspense>
    </AdminLayout>
  );
}
