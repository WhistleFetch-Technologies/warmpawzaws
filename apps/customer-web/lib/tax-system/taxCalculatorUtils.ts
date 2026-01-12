/**
 * ============================================================================
 * TAX CALCULATOR UTILITIES
 * ============================================================================
 * 
 * Helper utilities for converting cart items and order items to taxable items.
 * 
 * Date: 2026-01-28
 * ============================================================================
 */

import { TaxableItem } from './types';

/**
 * Cart Item (from CartContext)
 */
export interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  image?: string;
  vendorId?: string;
  vendorName?: string;
  categoryId?: string;
  subCategoryId?: string;
  productId?: string;
  serviceId?: string;
  serviceType?: string;
  vendorRole?: string;
  prescription_required?: boolean;
  [key: string]: any;
}

/**
 * Convert cart items to taxable items
 */
export function cartItemsToTaxableItems(cartItems: CartItem[]): TaxableItem[] {
  return cartItems.map(item => ({
    id: item.id,
    type: item.serviceId ? 'service' : 'product',
    categoryId: item.categoryId,
    subCategoryId: item.subCategoryId,
    serviceType: item.serviceType,
    vendorRole: item.vendorRole,
    amount: item.price,
    quantity: item.quantity,
    vendorId: item.vendorId,
    serviceId: item.serviceId,
    productId: item.productId
  }));
}

/**
 * Convert a single cart item to taxable item
 */
export function cartItemToTaxableItem(item: CartItem): TaxableItem {
  return {
    id: item.id,
    type: item.serviceId ? 'service' : 'product',
    categoryId: item.categoryId,
    subCategoryId: item.subCategoryId,
    serviceType: item.serviceType,
    vendorRole: item.vendorRole,
    amount: item.price,
    quantity: item.quantity,
    vendorId: item.vendorId,
    serviceId: item.serviceId,
    productId: item.productId
  };
}

/**
 * Service/Booking Item
 */
export interface ServiceItem {
  id: string;
  serviceId: string;
  serviceName: string;
  serviceType: string;
  categoryId?: string;
  subCategoryId?: string;
  vendorId: string;
  vendorRole?: string;
  amount: number;
  quantity?: number;
}

/**
 * Convert service items to taxable items
 */
export function serviceItemsToTaxableItems(serviceItems: ServiceItem[]): TaxableItem[] {
  return serviceItems.map(item => ({
    id: item.id,
    type: 'service',
    categoryId: item.categoryId,
    subCategoryId: item.subCategoryId,
    serviceType: item.serviceType,
    vendorRole: item.vendorRole,
    amount: item.amount,
    quantity: item.quantity || 1,
    vendorId: item.vendorId,
    serviceId: item.serviceId
  }));
}

/**
 * Product Item
 */
export interface ProductItem {
  id: string;
  productId: string;
  productName: string;
  categoryId?: string;
  subCategoryId?: string;
  vendorId: string;
  vendorRole?: string;
  amount: number;
  quantity?: number;
}

/**
 * Convert product items to taxable items
 */
export function productItemsToTaxableItems(productItems: ProductItem[]): TaxableItem[] {
  return productItems.map(item => ({
    id: item.id,
    type: 'product',
    categoryId: item.categoryId,
    subCategoryId: item.subCategoryId,
    vendorRole: item.vendorRole,
    amount: item.amount,
    quantity: item.quantity || 1,
    vendorId: item.vendorId,
    productId: item.productId
  }));
}

