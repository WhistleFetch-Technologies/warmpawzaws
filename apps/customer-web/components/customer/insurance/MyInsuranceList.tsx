'use client';

import { ArrowLeft } from 'lucide-react';
import { CustomerPolicyCards } from './CustomerPolicyCards';

export function MyInsuranceList({
  onBack,
  focusApplicationId,
}: {
  onBack: () => void;
  focusApplicationId?: string;
}) {
  return (
    <div className="flex min-h-[100dvh] flex-col bg-[#FFF8F3]">
      <header className="bg-gradient-to-br from-[#FF8C42] to-[#FF7A2F] px-4 pb-5 text-white cw-header-safe-top">
        <button
          type="button"
          onClick={onBack}
          className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-white/15"
          aria-label="Back"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-xl font-bold">My Insurance</h1>
        <p className="mt-0.5 text-sm text-white/90">Issued policies and documents</p>
      </header>
      <div className="mx-auto w-full max-w-lg flex-1 px-4 py-4">
        <CustomerPolicyCards scope="all" focusApplicationId={focusApplicationId} />
      </div>
    </div>
  );
}
