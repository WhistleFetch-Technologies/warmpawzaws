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
  delivery_regions?: string[];
  has_variants?: boolean;
  /** Default / listing SKU (lowest in-stock selling price) when has_variants. */
  listing_sku_id?: string;
  listing_option_values?: Record<string, string>;
  price_from?: boolean;
  min_price?: number;
}

export interface ShopCategory {
  id: string;
  name: string;
  icon?: string;
  image_url?: string;
  product_count?: number;
  display_order?: number;
}

export interface ShopCartItem {
  /** Line key: product id, or `productId::skuId` for variant lines. */
  product_id: string;
  product: ShopProduct;
  quantity: number;
  product_sku_id?: string;
  selected_variations?: Record<string, string>;
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
