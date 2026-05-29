export interface ShopProduct {
  id: string;
  name: string;
  description: string;
  category_id: string;
  price: number;
  original_price?: number;
  images: string[];
  emoji?: string;
  rating: number;
  review_count: number;
  stock: number;
  vendor_id: string;
  vendor_name: string;
  is_active: boolean;
}

export interface ShopCategory {
  id: string;
  name: string;
  icon: string;
  product_count: number;
}

export interface ShopCartItem {
  product_id: string;
  product: ShopProduct;
  quantity: number;
}

export interface ShopCoupon {
  code: string;
  discount_type: 'percentage' | 'fixed';
  discount_value: number;
  min_order_value?: number;
}

export interface ShopDeliveryAddress {
  label: string;
  hasAddress: boolean;
}

export const SHOP_SORT_LABELS: Record<string, string> = {
  popular: 'Most popular',
  price_low: 'Price: Low to high',
  price_high: 'Price: High to low',
  newest: 'Newest first',
  rating: 'Highest rated',
};
