import { Suspense } from 'react';
import { WarmpawzPayVendorClient } from './WarmpawzPayVendorClient';

export async function generateStaticParams() {
  return [{ vendorId: 'placeholder' }];
}

export const dynamicParams = true;

export default function WarmpawzPayVendorPage({ params }: { params: { vendorId?: string } }) {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-white text-slate-500">
          Loading Pay Bill...
        </div>
      }
    >
      <WarmpawzPayVendorClient vendorId={params?.vendorId} />
    </Suspense>
  );
}
