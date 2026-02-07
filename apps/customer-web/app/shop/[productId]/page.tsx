import ProductDetailClient from './ProductDetailClient';

// Required for static export with dynamic routes
// Return placeholder - actual navigation happens client-side
export async function generateStaticParams() {
  return [{ productId: 'placeholder' }];
}

// Allow dynamic params at runtime (client-side navigation)
export const dynamicParams = true;

export default function ProductPage({ params }: { params: { productId: string } }) {
  return <ProductDetailClient />;
}
