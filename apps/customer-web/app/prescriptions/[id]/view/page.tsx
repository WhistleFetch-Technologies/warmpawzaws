import { PrescriptionPublicViewClient } from './PrescriptionPublicViewClient';

/** Required for `output: 'export'` (same pattern as `order/page.tsx`). Real UUIDs load client-side. */
export async function generateStaticParams() {
  return [{ id: 'placeholder' }];
}

export default function PrescriptionPublicViewPage() {
  return <PrescriptionPublicViewClient />;
}
