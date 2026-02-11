/**
 * Pet Details Page (Server Wrapper)
 * Route: /pets/[petId]
 *
 * Static export requires generateStaticParams. We render a client
 * component that reads params at runtime for actual petId.
 */

import { PetDetailsClient } from './PetDetailsClient';

export async function generateStaticParams() {
  return [{ petId: '_' }];
}

export const dynamicParams = true;

export default function PetDetailsPage({ params }: { params: { petId?: string } }) {
  return <PetDetailsClient petId={params?.petId} />;
}
