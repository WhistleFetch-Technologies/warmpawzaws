'use client';

import { AdminLayout } from '@/components/admin/layout/AdminLayout';
import { AdminPromotionHub } from '@/components/admin/marketing/AdminPromotionHub';

export default function PromotionsPage() {
  return (
    <AdminLayout>
      <AdminPromotionHub surface="marketing" />
    </AdminLayout>
  );
}
