'use client';

import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { CustomerPolicyCards } from './CustomerPolicyCards';
import { CustomerApplicationCards } from './CustomerApplicationCards';

type Tab = 'applications' | 'policies';

export function MyInsuranceList({
  onBack,
  focusApplicationId,
  onTalkToExpert,
}: {
  onBack: () => void;
  focusApplicationId?: string;
  onTalkToExpert?: () => void;
}) {
  const [tab, setTab] = useState<Tab>('applications');

  return (
    <div className="flex min-h-[100dvh] flex-col bg-[#FBF7F2] text-[#1F2A37]">
      <header className="border-b border-[#F0E6DB] bg-[#FBF7F2] px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <button
          type="button"
          onClick={onBack}
          className="mb-2 flex h-10 w-10 items-center justify-center rounded-full hover:bg-white/80"
          aria-label="Back"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-xl font-bold">My Insurance</h1>
        <p className="mt-0.5 text-sm text-[#6B7280]">Track applications and active policies</p>

        <div className="mt-4 flex gap-4 border-b border-[#F0E6DB]">
          {(
            [
              { key: 'applications' as const, label: 'Applications' },
              { key: 'policies' as const, label: 'Policies' },
            ] as const
          ).map((item) => {
            const active = tab === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => setTab(item.key)}
                className={`pb-2 text-sm font-semibold ${
                  active ? 'text-[#FF8C42]' : 'text-[#6B7280]'
                }`}
              >
                {item.label}
                {active ? <span className="mt-1 block h-0.5 rounded-full bg-[#FF8C42]" /> : null}
              </button>
            );
          })}
        </div>
      </header>

      <div className="mx-auto w-full max-w-lg flex-1 px-4 py-4 pb-[calc(5rem+var(--customer-tabbed-nav-offset,0px))]">
        {tab === 'applications' ? (
          <CustomerApplicationCards
            focusApplicationId={focusApplicationId}
            onTalkToExpert={onTalkToExpert}
          />
        ) : (
          <CustomerPolicyCards scope="all" focusApplicationId={focusApplicationId} />
        )}
      </div>
    </div>
  );
}
