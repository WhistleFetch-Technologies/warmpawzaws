'use client';

import { useRouter } from 'next/navigation';
import { VendorHeader } from '@/components/vendor/VendorHeader';
import { MealPlansComingSoonPanel } from '@/components/vendor/MealPlansComingSoonPanel';

export default function MealPlansPage() {
  const router = useRouter();
  return (
    <div className="vendor-page-shell bg-gray-50">
      <div className="vendor-app-column bg-white min-h-screen">
        <VendorHeader
          title="🍲 Meal Plans"
          subtitle="Coming soon on Warmpawz"
          onBack={() => router.back()}
        />
        <main className="w-full px-4 py-6 sm:px-6 max-w-lg mx-auto">
          <MealPlansComingSoonPanel />
        </main>
      </div>
    </div>
  );
}
