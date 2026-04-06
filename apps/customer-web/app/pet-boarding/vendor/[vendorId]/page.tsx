import PetBoardingVendorProfilePageClient from './PetBoardingVendorProfilePageClient';

export async function generateStaticParams() {
  // `output: export` requires at least one path; empty [] is treated as "missing".
  // Real vendor IDs are still opened client-side from in-app navigation.
  return [{ vendorId: 'placeholder' }];
}

export default function PetBoardingVendorProfilePage() {
  return <PetBoardingVendorProfilePageClient />;
}
