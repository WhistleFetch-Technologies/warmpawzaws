/**
 * ============================================================================
 * PRODUCTS REPOSITORY
 * ============================================================================
 * 
 * Repository for product data access (E-commerce).
 * Replaces: product:{productId} KV keys
 * 
 * RULES:
 * ❌ NO KV imports allowed
 * ✅ All operations use SQL only
 * 
 * Date: 2025-01-27
 * ============================================================================
 */

import { getDbClient, selectQuery, insertQuery, updateQuery, deleteQuery } from "../db.ts";
import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";

export interface Product {
  id: string;
  vendor_id: string | null;
  name: string;
  description: string;
  category: string;
  subcategory: string | null;
  price: number;
  compare_at_price: number | null;
  cost_price: number | null;
  sku: string | null;
  barcode: string | null;
  stock: number;
  min_stock: number;
  weight: number | null;
  dimensions: string | null;
  images: string[];
  tags: string[];
  is_active: boolean;
  is_featured: boolean;
  hsn_code: string | null;
  gst_rate: number | null;
  created_at: string;
  updated_at: string;
}

export interface CreateProductInput {
  vendor_id?: string | null;
  name: string;
  description: string;
  category: string;
  subcategory?: string | null;
  price: number;
  compare_at_price?: number | null;
  cost_price?: number | null;
  sku?: string | null;
  barcode?: string | null;
  stock?: number;
  min_stock?: number;
  weight?: number | null;
  dimensions?: string | null;
  images?: string[];
  tags?: string[];
  is_active?: boolean;
  is_featured?: boolean;
  hsn_code?: string | null;
  gst_rate?: number | null;
}

export interface UpdateProductInput {
  name?: string;
  description?: string;
  category?: string;
  subcategory?: string | null;
  price?: number;
  compare_at_price?: number | null;
  cost_price?: number | null;
  sku?: string | null;
  barcode?: string | null;
  stock?: number;
  min_stock?: number;
  weight?: number | null;
  dimensions?: string | null;
  images?: string[];
  tags?: string[];
  is_active?: boolean;
  is_featured?: boolean;
  hsn_code?: string | null;
  gst_rate?: number | null;
}

export class ProductsRepository {
  private client: SupabaseClient;

  constructor(client?: SupabaseClient) {
    this.client = client || getDbClient();
  }

  async findById(productId: string): Promise<Product | null> {
    const results = await selectQuery<Product>("products", { id: productId }, { limit: 1 });
    return results[0] || null;
  }

  async findByVendor(vendorId: string, options?: { limit?: number; offset?: number; isActive?: boolean }): Promise<Product[]> {
    const conditions: any = { vendor_id: vendorId };
    if (options?.isActive !== undefined) {
      conditions.is_active = options.isActive;
    }
    return selectQuery<Product>("products", conditions, {
      limit: options?.limit || 100,
      offset: options?.offset,
      orderBy: "created_at",
      orderDirection: "desc"
    });
  }

  async findByCategory(category: string, options?: { limit?: number; offset?: number; isActive?: boolean }): Promise<Product[]> {
    const conditions: any = { category };
    if (options?.isActive !== undefined) {
      conditions.is_active = options.isActive;
    }
    return selectQuery<Product>("products", conditions, {
      limit: options?.limit || 100,
      offset: options?.offset,
      orderBy: "created_at",
      orderDirection: "desc"
    });
  }

  async search(query: string, options?: { limit?: number; offset?: number }): Promise<Product[]> {
    // Use PostgreSQL full-text search
    const results = await this.client
      .from("products")
      .select("*")
      .or(`name.ilike.%${query}%,description.ilike.%${query}%,tags.cs.{${query}}`)
      .eq("is_active", true)
      .limit(options?.limit || 100)
      .offset(options?.offset || 0)
      .order("created_at", { ascending: false });
    
    return (results.data || []) as Product[];
  }

  async create(input: CreateProductInput): Promise<Product> {
    const results = await insertQuery<Product>("products", {
      vendor_id: input.vendor_id || null,
      name: input.name,
      description: input.description,
      category: input.category,
      subcategory: input.subcategory || null,
      price: input.price,
      compare_at_price: input.compare_at_price || null,
      cost_price: input.cost_price || null,
      sku: input.sku || null,
      barcode: input.barcode || null,
      stock: input.stock || 0,
      min_stock: input.min_stock || 0,
      weight: input.weight || null,
      dimensions: input.dimensions || null,
      images: input.images || [],
      tags: input.tags || [],
      is_active: input.is_active !== false,
      is_featured: input.is_featured || false,
      hsn_code: input.hsn_code || null,
      gst_rate: input.gst_rate || null,
    });
    
    if (!results[0]) {
      throw new Error("Failed to create product");
    }
    
    return results[0];
  }

  async update(productId: string, input: UpdateProductInput): Promise<Product> {
    const updateData: any = {
      updated_at: new Date().toISOString(),
    };
    
    if (input.name !== undefined) updateData.name = input.name;
    if (input.description !== undefined) updateData.description = input.description;
    if (input.category !== undefined) updateData.category = input.category;
    if (input.subcategory !== undefined) updateData.subcategory = input.subcategory;
    if (input.price !== undefined) updateData.price = input.price;
    if (input.compare_at_price !== undefined) updateData.compare_at_price = input.compare_at_price;
    if (input.cost_price !== undefined) updateData.cost_price = input.cost_price;
    if (input.sku !== undefined) updateData.sku = input.sku;
    if (input.barcode !== undefined) updateData.barcode = input.barcode;
    if (input.stock !== undefined) updateData.stock = input.stock;
    if (input.min_stock !== undefined) updateData.min_stock = input.min_stock;
    if (input.weight !== undefined) updateData.weight = input.weight;
    if (input.dimensions !== undefined) updateData.dimensions = input.dimensions;
    if (input.images !== undefined) updateData.images = input.images;
    if (input.tags !== undefined) updateData.tags = input.tags;
    if (input.is_active !== undefined) updateData.is_active = input.is_active;
    if (input.is_featured !== undefined) updateData.is_featured = input.is_featured;
    if (input.hsn_code !== undefined) updateData.hsn_code = input.hsn_code;
    if (input.gst_rate !== undefined) updateData.gst_rate = input.gst_rate;
    
    const results = await updateQuery<Product>("products", { id: productId }, updateData);
    
    if (!results[0]) {
      throw new Error(`Product not found: ${productId}`);
    }
    
    return results[0];
  }

  async updateStock(productId: string, quantity: number, operation: 'add' | 'subtract' | 'set' = 'subtract'): Promise<Product> {
    const product = await this.findById(productId);
    if (!product) {
      throw new Error(`Product not found: ${productId}`);
    }
    
    let newStock: number;
    if (operation === 'add') {
      newStock = product.stock + quantity;
    } else if (operation === 'subtract') {
      newStock = Math.max(0, product.stock - quantity);
    } else {
      newStock = quantity;
    }
    
    return this.update(productId, { stock: newStock });
  }

  async delete(productId: string): Promise<void> {
    await deleteQuery("products", { id: productId });
  }

  async findAll(options?: { limit?: number; offset?: number; isActive?: boolean }): Promise<Product[]> {
    const conditions: any = {};
    if (options?.isActive !== undefined) {
      conditions.is_active = options.isActive;
    }
    return selectQuery<Product>("products", conditions, {
      limit: options?.limit || 100,
      offset: options?.offset,
      orderBy: "created_at",
      orderDirection: "desc"
    });
  }
}

let repositoryInstance: ProductsRepository | null = null;

export function getProductsRepository(): ProductsRepository {
  if (!repositoryInstance) {
    repositoryInstance = new ProductsRepository();
  }
  return repositoryInstance;
}

