import { Suspense } from 'react';
import ProductDetailClient from './ProductDetailClient';

// Required for static export with dynamic routes
// Return placeholder - actual navigation happens client-side
export async function generateStaticParams() {
  return [{ productId: 'placeholder' }];
}

// Allow dynamic params at runtime (client-side navigation)
export const dynamicParams = true;

export default function ProductPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-white text-slate-500">
          Loading product...
        </div>
      }
    >
      <ProductDetailClient />
    </Suspense>
  );
}
