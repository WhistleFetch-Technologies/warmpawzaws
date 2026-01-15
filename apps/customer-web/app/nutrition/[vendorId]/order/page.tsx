import NutritionOrderPageClient from './NutritionOrderPageClient';

export async function generateStaticParams() {
  return [{ vendorId: 'placeholder' }];
}

export default function NutritionOrderPage() {
  return <NutritionOrderPageClient />;
}
