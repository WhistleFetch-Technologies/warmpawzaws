'use client';

import { AdminLayout } from '@/components/admin/layout/AdminLayout';
import { PromotionCenterHub } from '@/components/admin/marketing/PromotionCenterHub';

export default function PromotionCenterPage() {
  return (
    <AdminLayout>
      <PromotionCenterHub />
    </AdminLayout>
  );
}
