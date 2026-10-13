'use client';

const TABS = ['Overview', 'Applications', 'Chat', 'Form Library', 'Availability', 'Reports'] as const;

export function InsuranceWorkspace({ vendorId }: { vendorId: string }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white px-4 py-4">
        <h1 className="text-xl font-bold text-gray-900">Insurance</h1>
        <p className="mt-1 text-sm text-gray-600">Applications, chat, forms, and payout reports.</p>
      </header>
      <nav className="flex gap-1 overflow-x-auto border-b border-gray-200 bg-white px-4">
        {TABS.map((tab) => (
          <span
            key={tab}
            className={`whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium ${
              tab === 'Overview' ? 'border-[#FF8C42] text-[#FF8C42]' : 'border-transparent text-gray-500'
            }`}
          >
            {tab}
          </span>
        ))}
      </nav>
      <main className="mx-auto max-w-3xl px-4 py-6">
        <section className="rounded-xl border border-gray-200 bg-white p-4">
          <h2 className="text-base font-semibold text-gray-900">Overview</h2>
          <p className="mt-2 text-sm text-gray-600">
            Your catalogue links, plans, and readiness load from the insurance workspace once the feature is turned on.
          </p>
          <p className="mt-2 text-xs text-gray-400">Vendor {vendorId}</p>
        </section>
      </main>
    </div>
  );
}
