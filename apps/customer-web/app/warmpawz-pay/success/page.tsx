import { Suspense } from 'react';
import { WarmpawzPaySuccessClient } from './WarmpawzPaySuccessClient';

export default function WarmpawzPaySuccessPage() {
  return (
    <Suspense fallback={<p className="p-8 text-center text-sm text-gray-500">Loading…</p>}>
      <WarmpawzPaySuccessClient />
    </Suspense>
  );
}
