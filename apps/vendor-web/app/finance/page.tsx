'use client';

export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { VendorHeader } from '@/components/vendor/VendorHeader';

export default function FinanceHomePage() {
  const router = useRouter();
  const cards = [
    {
      title: 'Settlements',
      description: 'Track payouts and settlement status.',
      href: '/finance/settlements',
    },
    {
      title: 'Bank Account',
      description: 'Manage and verify payout bank details.',
      href: '/finance/bank',
    },
    {
      title: 'Wallet',
      description: 'View vendor wallet balance and wallet transactions.',
      href: '/finance/wallet',
    },
  ];

  return (
    <div className="vendor-page-shell bg-gray-50">
      <div className="vendor-app-column bg-white min-h-screen">
        <VendorHeader
          title="Finance"
          subtitle="Choose a finance section to continue"
          onBack={() => router.back()}
        />

        <div className="w-full px-4 py-6 sm:px-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {cards.map((card) => (
              <Link
                key={card.href}
                href={card.href}
                className="rounded-xl border border-orange-100 bg-white p-5 transition hover:border-orange-300"
              >
                <h2 className="text-lg font-semibold text-gray-900">{card.title}</h2>
                <p className="mt-2 text-sm text-gray-600">{card.description}</p>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
