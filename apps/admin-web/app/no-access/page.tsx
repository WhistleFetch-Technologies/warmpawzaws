'use client';

export const dynamic = 'force-dynamic';

import { useRouter } from 'next/navigation';
import { ShieldX } from 'lucide-react';
import { Button } from '@warmpawz/ui';
import { AdminLayout } from '@/components/admin/layout/AdminLayout';

export default function NoAccessPage() {
  const router = useRouter();

  return (
    <AdminLayout>
      <div className="max-w-2xl mx-auto py-16 px-4 flex flex-col items-center justify-center min-h-[60vh]">
        <div className="rounded-full bg-amber-100 p-4 mb-6">
          <ShieldX className="w-12 h-12 text-amber-600" />
        </div>
        <h1 className="text-2xl font-semibold text-gray-900 mb-2">Access denied</h1>
        <p className="text-gray-600 text-center mb-8">
          You don&apos;t have permission to view this section. If you believe this is an error, contact your administrator.
        </p>
        <Button
          onClick={() => router.push('/analytics')}
          className="bg-[#FF8C42] hover:bg-[#e67a35] text-white"
        >
          Go to Analytics
        </Button>
      </div>
    </AdminLayout>
  );
}
