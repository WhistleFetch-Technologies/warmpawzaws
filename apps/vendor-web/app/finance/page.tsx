'use client';

import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default function FinanceHomePage() {
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
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-50 p-6">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900">Finance</h1>
        <p className="text-sm text-gray-600 mt-1">Choose a finance section to continue.</p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
          {cards.map((card) => (
            <Link
              key={card.href}
              href={card.href}
              className="bg-white border border-orange-100 rounded-xl p-5 hover:border-orange-300 transition"
            >
              <h2 className="text-lg font-semibold text-gray-900">{card.title}</h2>
              <p className="text-sm text-gray-600 mt-2">{card.description}</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

