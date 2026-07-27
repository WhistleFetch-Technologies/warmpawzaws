'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { CheckCircle2 } from 'lucide-react';

function formatInr(n: number): string {
  return `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function WarmpawzPaySuccessClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const saved = Number(searchParams.get('saved') ?? 0);
  const vendor = searchParams.get('vendor') ?? 'the merchant';

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-customer flex-col items-center justify-center bg-gray-50 p-6 text-center">
      <CheckCircle2 className="h-16 w-16 text-green-600" />
      <h1 className="mt-4 text-2xl font-bold text-gray-900">Payment successful!</h1>
      {Number.isFinite(saved) && saved > 0 ? (
        <p className="mt-2 text-lg text-green-700">
          Congratulations, you saved {formatInr(saved)}!
        </p>
      ) : null}
      <p className="mt-2 text-sm text-gray-600">
        Thank you for paying {vendor} with Warmpawz Pay.
      </p>
      <div className="mt-8 flex w-full flex-col gap-3">
        <button
          type="button"
          onClick={() => router.push('/warmpawz-pay/history')}
          className="w-full rounded-xl border border-gray-200 bg-white py-3 text-sm font-medium"
        >
          View payment history
        </button>
        <button
          type="button"
          onClick={() => router.push('/warmpawz-pay')}
          className="w-full rounded-xl bg-[#FF6B00] py-3 text-sm font-semibold text-white"
        >
          Back to Warmpawz Pay
        </button>
      </div>
    </div>
  );
}
