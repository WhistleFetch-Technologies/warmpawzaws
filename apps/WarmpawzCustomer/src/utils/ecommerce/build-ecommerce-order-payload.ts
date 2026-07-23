export type MobileCheckoutAddress = {
  name: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
};

export type MobileCartItem = {
  id: string;
  productId?: string;
  product_id?: string;
  product_sku_id?: string;
  productSkuId?: string;
  skuId?: string;
  vendorId?: string;
  vendor_id?: string;
  price: number;
  quantity: number;
};

export function generateIdempotencyKey(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function normalizePhoneE164(phone: string): string {
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.length >= 12 && digits.startsWith('91')) return `+${digits}`;
  if (digits.length === 10) return `+91${digits}`;
  return phone.startsWith('+') ? phone : `+${digits}`;
}

export function buildMobileEcommerceOrderPayload(params: {
  phone: string;
  customerId?: string;
  cart: MobileCartItem[];
  shippingAddress: MobileCheckoutAddress;
  discount?: number;
  idempotencyKey: string;
  couponCode?: string;
}) {
  const subtotal = params.cart.reduce((total, item) => total + item.price * item.quantity, 0);
  const discountAmount = Math.max(0, params.discount || 0);
  const totalAmount = Math.max(0, subtotal - discountAmount);

  return {
    customerId: params.customerId,
    customerPhone: normalizePhoneE164(params.phone),
    idempotencyKey: params.idempotencyKey,
    items: params.cart.map((item) => {
      const productId = item.productId || item.product_id || item.id;
      return {
        product_id: productId,
        productId,
        product_sku_id: item.product_sku_id || item.productSkuId || item.skuId,
        quantity: item.quantity,
        unitPrice: item.price,
        vendorId: item.vendorId || item.vendor_id || '',
      };
    }),
    shippingAddress: {
      name: params.shippingAddress.name,
      line1: params.shippingAddress.address,
      city: params.shippingAddress.city,
      state: params.shippingAddress.state,
      pincode: params.shippingAddress.pincode,
      phone: params.shippingAddress.phone,
    },
    paymentMethod: 'online' as const,
    subtotal,
    shippingFee: 0,
    taxAmount: 0,
    discountAmount,
    totalAmount,
    couponCode: params.couponCode,
  };
}
