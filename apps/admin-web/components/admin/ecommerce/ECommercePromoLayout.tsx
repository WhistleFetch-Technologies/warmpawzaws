'use client';

import { Suspense } from 'react';
import { AdminLayout } from '@/components/admin/layout/AdminLayout';
import { ECommercePageHeader, ECommerceSubNav } from '@/components/admin/ecommerce/ECommerceSubNav';

export function ECommercePromoLayout({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <AdminLayout>
      <div className="flex min-h-screen flex-col bg-gray-50">
        <ECommercePageHeader title={title} subtitle={subtitle} />
        <Suspense fallback={null}>
          <ECommerceSubNav />
        </Suspense>
        <div className="flex-1">{children}</div>
      </div>
    </AdminLayout>
  );
}
