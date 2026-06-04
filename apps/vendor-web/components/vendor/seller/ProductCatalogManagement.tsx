'use client';

import React, { useState, useEffect, useMemo, useDeferredValue } from 'react';
import {
  Plus, Search, Filter, Edit2, Trash2, Eye, Package,
  Grid, List, ChevronDown, X, Upload, IndianRupee, Tag,
  Check, AlertCircle, Image as ImageIcon, MapPin,   RefreshCcw,
  FileSpreadsheet, Archive,
} from 'lucide-react';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';
import {
  getVendorDisplayStatus,
  getVendorDisplayStatusLabel,
  isRemovedFromCatalog,
} from '@/lib/vendor-product-display-status';
import { TouchFilePicker } from '@/components/shared/TouchFilePicker';
import { BulkProductUpload } from '@/components/vendor/products/BulkProductUpload';
import { formatVendorProductSellingDisplay } from '@/lib/product-ecommerce-pricing';

/** Persist stable S3 object URLs; list/detail APIs return presigned URLs for display. */
function stripAwsPresignFromProductImageUrl(url: string): string {
  try {
    const u = new URL(url);
    if (u.searchParams.has('X-Amz-Algorithm') || u.searchParams.has('X-Amz-Credential')) {
      u.search = '';
      return u.toString();
    }
  } catch {
    /* ignore */
  }
  return url;
}

interface ProductCatalogManagementProps {
  sellerId: string;
}

interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  original_price?: number;
  stock: number;
  sku: string;
  category_id: string;
  /** Legacy / free-text category (API may filter with category_id OR category) */
  category?: string;
  status: string;
  images?: string[];
  emoji?: string;
  is_active: boolean;
}

function productMatchesCategory(product: Product, selectedCategory: string): boolean {
  if (selectedCategory === 'all') return true;
  const sel = String(selectedCategory);
  if (product.category_id != null && String(product.category_id) === sel) return true;
  if (product.category != null && String(product.category) === sel) return true;
  return false;
}

function productMatchesStatusFilter(product: Product, selectedStatus: string): boolean {
  const displayStatus = getVendorDisplayStatus(product);
  if (selectedStatus === 'all') {
    // Hide archived/removed products from the default catalog view
    return displayStatus !== 'inactive';
  }
  if (selectedStatus === 'out_of_stock') {
    const stock = Number(product.stock);
    return displayStatus === 'out_of_stock' || (!Number.isNaN(stock) && stock <= 0);
  }
  return displayStatus === selectedStatus;
}

export function ProductCatalogManagement({ sellerId }: ProductCatalogManagementProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [categories, setCategories] = useState<any[]>([]);

  useEffect(() => {
    loadProducts();
    loadCategories();
  }, [sellerId]);

  const loadProducts = async () => {
    try {
      setLoading(true);
      const data = await apiClient.get<{ products?: Product[] }>(`/vendor/${sellerId}/products`);
      setProducts(data?.products || []);
    } catch (error) {
      console.error('Error loading products:', error);
      setProducts([]);
    } finally {
      setLoading(false);
    }
  };

  const loadCategories = async () => {
    try {
      const data = await apiClient.get<{ categories?: any[] }>('/ecommerce/categories');
      setCategories(data?.categories || []);
    } catch (error) {
      console.error('Error loading categories:', error);
      setCategories([]);
    }
  };

  const handleRefresh = async () => {
    try {
      setRefreshing(true);
      await Promise.all([loadProducts(), loadCategories()]);
    } finally {
      setRefreshing(false);
    }
  };

  const handleDeleteProduct = async (productId: string) => {
    const product = products.find((p) => p.id === productId);
    if (product && isRemovedFromCatalog(product)) {
      toast.info('This product is already removed from your catalog.');
      return;
    }

    const confirmed = window.confirm(
      'Remove this product from your catalog?\n\n' +
        '• Products with past orders will be archived (hidden from your shop and customers) but kept for order records.\n' +
        '• Products with no orders will be permanently deleted.',
    );
    if (!confirmed) return;

    try {
      const res = await apiClient.delete<{
        message?: string;
        action?: 'deactivated' | 'deleted';
        deactivated?: boolean;
      }>(`/vendor/${sellerId}/products/${productId}`);

      if (res?.action === 'deactivated' || res?.deactivated) {
        toast.success(
          res.message ||
            'Product removed from your catalog. Past orders are preserved in order history.',
          { duration: 6000 },
        );
      } else {
        toast.success(res?.message || 'Product deleted successfully.');
      }
      loadProducts();
    } catch (error) {
      console.error('Error deleting product:', error);
      toast.error('Failed to remove product. Please try again.');
    }
  };

  const trimmedSearch = searchQuery.trim();
  const deferredSearch = useDeferredValue(trimmedSearch);
  const deferredSearchLower = deferredSearch.toLowerCase();

  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      if (!productMatchesCategory(product, selectedCategory)) return false;
      if (!productMatchesStatusFilter(product, selectedStatus)) return false;
      if (!deferredSearchLower) return true;
      const name = product.name?.toLowerCase() ?? '';
      const desc = product.description?.toLowerCase() ?? '';
      const sku = product.sku?.toLowerCase() ?? '';
      return (
        name.includes(deferredSearchLower) ||
        desc.includes(deferredSearchLower) ||
        sku.includes(deferredSearchLower)
      );
    });
  }, [products, deferredSearchLower, selectedCategory, selectedStatus]);

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      active: 'bg-emerald-100 text-emerald-700 border-emerald-200',
      pending: 'bg-amber-100 text-amber-700 border-amber-200',
      pending_approval: 'bg-amber-100 text-amber-700 border-amber-200',
      draft: 'bg-slate-100 text-slate-700 border-slate-200',
      rejected: 'bg-red-100 text-red-700 border-red-200',
      inactive: 'bg-slate-200 text-slate-600 border-slate-300',
      out_of_stock: 'bg-orange-100 text-orange-700 border-orange-200',
    };

    const label = getVendorDisplayStatusLabel(status);

    return (
      <span
        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border ${styles[status] || 'bg-slate-100 text-slate-700'}`}
      >
        {status === 'active' && <Check className="w-3 h-3" />}
        {(status === 'pending' || status === 'pending_approval') && (
          <AlertCircle className="w-3 h-3" />
        )}
        {status === 'inactive' && <Archive className="w-3 h-3" />}
        {label}
      </span>
    );
  };

  return (
    <div className="p-8 space-y-6">
      <div className="flex flex-wrap justify-end items-center gap-3">
        <div className="flex flex-wrap items-center justify-end gap-3 mr-1 sm:mr-3">
          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing || loading}
            className="flex items-center gap-2 px-5 py-3 border border-slate-200 text-slate-700 rounded-xl font-semibold hover:bg-slate-50 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <RefreshCcw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            type="button"
            onClick={() => {
              setEditingProduct(null);
              setShowAddModal(true);
            }}
            className="flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl font-semibold shadow-lg shadow-orange-500/25 hover:shadow-xl hover:shadow-orange-500/30 transition-all"
          >
            <Plus className="w-5 h-5" />
            Add Product
          </button>
        </div>
        <span
          className="hidden sm:block h-9 w-px shrink-0 bg-slate-200 self-center"
          aria-hidden
        />
        <button
          type="button"
          onClick={() => setShowBulkUpload(true)}
          className="flex items-center gap-2 px-5 py-3 border border-orange-500 text-orange-600 rounded-xl font-semibold hover:bg-orange-50 transition-all"
        >
          <FileSpreadsheet className="w-5 h-5" />
          Bulk Upload
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-lg shadow-slate-100/50">
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Search products by name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all"
            />
          </div>

          {/* Category Filter */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 min-w-[180px] bg-white"
          >
            <option value="all">All Categories</option>
            {categories.map(cat => (
              <option key={cat.id} value={cat.id}>{cat.name}</option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 min-w-[160px] bg-white"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="pending">Pending Approval</option>
            <option value="inactive">Removed</option>
            <option value="rejected">Rejected</option>
            <option value="draft">Draft</option>
            <option value="out_of_stock">Out of Stock</option>
          </select>

          {/* View Toggle */}
          <div className="flex gap-1 bg-slate-100 p-1.5 rounded-xl">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2.5 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-white shadow text-orange-600' : 'text-slate-500 hover:text-slate-900'}`}
            >
              <Grid className="w-5 h-5" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2.5 rounded-lg transition-all ${viewMode === 'list' ? 'bg-white shadow text-orange-600' : 'text-slate-500 hover:text-slate-900'}`}
            >
              <List className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Products */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-orange-200 border-t-orange-500 mx-auto"></div>
            <p className="mt-4 text-slate-500">Loading products...</p>
          </div>
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 p-16 text-center shadow-lg shadow-slate-100/50">
          <div className="w-20 h-20 bg-gradient-to-br from-orange-100 to-amber-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <Package className="w-10 h-10 text-orange-500" />
          </div>
          <h3 className="text-xl font-semibold text-slate-900">No products found</h3>
          <p className="text-slate-500 mt-2 max-w-md mx-auto">
            {products.length === 0
              ? 'Start building your catalog by adding your first product.'
              : selectedStatus === 'inactive'
                ? 'No removed products. Items with past orders are archived here after you delete them.'
                : 'Try adjusting your filters to find what you\'re looking for.'}
          </p>
          {products.length === 0 && (
            <button
              onClick={() => setShowAddModal(true)}
              className="mt-6 px-6 py-3 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl font-semibold shadow-lg shadow-orange-500/25 hover:shadow-xl transition-all"
            >
              <Plus className="w-5 h-5 inline mr-2" />
              Add Your First Product
            </button>
          )}
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredProducts.map(product => (
            <ProductCard
              key={product.id}
              product={product}
              categories={categories}
              onEdit={() => {
                setEditingProduct(product);
                setShowAddModal(true);
              }}
              onDelete={() => handleDeleteProduct(product.id)}
              getStatusBadge={getStatusBadge}
            />
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-lg shadow-slate-100/50 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="text-left p-4 font-semibold text-slate-600 text-sm">Product</th>
                <th className="text-left p-4 font-semibold text-slate-600 text-sm">SKU</th>
                <th className="text-left p-4 font-semibold text-slate-600 text-sm">Category</th>
                <th className="text-right p-4 font-semibold text-slate-600 text-sm">Price</th>
                <th className="text-center p-4 font-semibold text-slate-600 text-sm">Stock</th>
                <th className="text-center p-4 font-semibold text-slate-600 text-sm">Status</th>
                <th className="text-right p-4 font-semibold text-slate-600 text-sm">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredProducts.map(product => {
                const removed = isRemovedFromCatalog(product);
                const displayStatus = getVendorDisplayStatus(product);
                return (
                <tr key={product.id} className={`hover:bg-slate-50 transition-colors ${removed ? 'opacity-75' : ''}`}>
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-gradient-to-br from-orange-100 to-amber-100 rounded-xl flex items-center justify-center text-2xl">
                        {product.emoji || '📦'}
                      </div>
                      <div>
                        <p className="font-semibold text-slate-900">{product.name}</p>
                        <p className="text-sm text-slate-500 line-clamp-1">{product.description}</p>
                      </div>
                    </div>
                  </td>
                  <td className="p-4 font-mono text-sm text-slate-500">{product.sku}</td>
                  <td className="p-4 text-slate-600">
                    {categories.find(c => c.id === product.category_id)?.name || 'Uncategorized'}
                  </td>
                  <td className="p-4 text-right">
                    {(() => {
                      const p = formatVendorProductSellingDisplay(product.price, product.original_price);
                      return (
                        <>
                          <span className="font-bold text-slate-900">₹{p.selling}</span>
                          {p.discountPercent > 0 && p.mrp && (
                            <span className="text-sm text-slate-400 line-through ml-2">₹{p.mrp}</span>
                          )}
                        </>
                      );
                    })()}
                  </td>
                  <td className="p-4 text-center">
                    <span className={`inline-flex items-center justify-center w-10 h-8 rounded-lg font-medium ${
                      product.stock > 10 ? 'bg-emerald-100 text-emerald-700' : 
                      product.stock > 0 ? 'bg-amber-100 text-amber-700' : 
                      'bg-red-100 text-red-700'
                    }`}>
                      {product.stock}
                    </span>
                  </td>
                  <td className="p-4 text-center">{getStatusBadge(displayStatus)}</td>
                  <td className="p-4 text-right">
                    <div className="flex justify-end gap-2">
                      {!removed && (
                      <button 
                        onClick={() => {
                          setEditingProduct(product);
                          setShowAddModal(true);
                        }}
                        className="p-2 hover:bg-orange-50 text-slate-600 hover:text-orange-600 rounded-lg transition-colors"
                        title="Edit"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      )}
                      {!removed ? (
                      <button 
                        onClick={() => handleDeleteProduct(product.id)}
                        className="p-2 hover:bg-red-50 text-slate-600 hover:text-red-600 rounded-lg transition-colors"
                        title="Remove from catalog"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      ) : (
                        <span className="text-xs text-slate-500 px-2 py-1">Archived</span>
                      )}
                    </div>
                  </td>
                </tr>
              );})}
            </tbody>
          </table>
        </div>
      )}

      {/* Add/Edit Modal */}
      {showAddModal && (
        <ProductModal
          product={editingProduct}
          sellerId={sellerId}
          categories={categories}
          onClose={() => {
            setShowAddModal(false);
            setEditingProduct(null);
          }}
          onSave={() => {
            setShowAddModal(false);
            setEditingProduct(null);
            loadProducts();
          }}
        />
      )}

      <BulkProductUpload
        isOpen={showBulkUpload}
        onClose={() => setShowBulkUpload(false)}
        vendorId={sellerId}
        onSuccess={() => {
          setShowBulkUpload(false);
          loadProducts();
        }}
      />
    </div>
  );
}

function ProductCard({ product, categories, onEdit, onDelete, getStatusBadge }: any) {
  const removed = isRemovedFromCatalog(product);
  const displayStatus = getVendorDisplayStatus(product);
  const pricing = formatVendorProductSellingDisplay(product.price, product.original_price);

  return (
    <div className={`bg-white rounded-2xl border overflow-hidden hover:shadow-xl transition-all duration-300 group ${removed ? 'border-slate-200 opacity-75' : 'border-slate-100'}`}>
      <div className="aspect-square bg-gradient-to-br from-slate-100 to-slate-50 flex items-center justify-center text-7xl relative">
        {product.images?.[0] ? (
          <img src={product.images[0]} alt={product.name} className="w-full h-full object-cover" />
        ) : (
          <span>{product.emoji || '📦'}</span>
        )}
        <div className="absolute top-3 right-3 flex flex-col items-end gap-1">
          {pricing.discountPercent > 0 && (
            <span className="px-2 py-0.5 rounded-md bg-emerald-500 text-white text-[10px] font-bold">
              Save {pricing.discountPercent}%
            </span>
          )}
          {getStatusBadge(displayStatus)}
        </div>
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
      </div>
      <div className="p-5">
        <h3 className="font-semibold text-slate-900 line-clamp-2 h-12">{product.name}</h3>
        <p className="text-slate-500 text-sm line-clamp-2 mt-2 h-10">{product.description}</p>
        
        <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-100">
          <div>
            <p className="text-xl font-bold text-slate-900">₹{pricing.selling}</p>
            {pricing.discountPercent > 0 && pricing.mrp && (
              <p className="text-sm text-slate-400 line-through">₹{pricing.mrp}</p>
            )}
          </div>
          <div className={`text-sm font-medium px-3 py-1 rounded-lg ${
            product.stock > 10 ? 'bg-emerald-50 text-emerald-700' : 
            product.stock > 0 ? 'bg-amber-50 text-amber-700' : 
            'bg-red-50 text-red-700'
          }`}>
            Stock: {product.stock}
          </div>
        </div>
        
        <div className="flex gap-2 mt-4">
          {!removed && (
            <button
              onClick={onEdit}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 border border-slate-200 text-slate-700 rounded-xl font-medium hover:bg-slate-50 transition-colors"
            >
              <Edit2 className="w-4 h-4" /> Edit
            </button>
          )}
          {!removed ? (
            <button
              onClick={onDelete}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 border border-red-200 text-red-600 rounded-xl font-medium hover:bg-red-50 transition-colors"
            >
              <Trash2 className="w-4 h-4" /> Remove
            </button>
          ) : (
            <p className="flex-1 text-center text-xs text-slate-500 py-2.5 px-2">
              Archived — kept for order history
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function sellingPriceForForm(product: { price?: number; original_price?: number } | null | undefined): string {
  if (!product?.price) return '';
  const mrp = product.original_price;
  if (mrp && product.price < mrp) return String(product.price);
  return '';
}

function ProductModal({ product, sellerId, categories, onClose, onSave }: any) {
  const [formData, setFormData] = useState({
    name: product?.name || '',
    description: product?.description || '',
    category_id: product?.category_id || '',
    price: sellingPriceForForm(product),
    original_price: product?.original_price || product?.compare_at_price || product?.price || '',
    stock: product?.stock ?? '',
    sku: product?.sku || '',
    hsn_code: product?.hsn_code || '',
    gst_rate:
      product?.gst_rate !== undefined && product?.gst_rate !== null
        ? String(product.gst_rate)
        : '',
    emoji: product?.emoji || '📦',
    status: product?.status || 'pending',
  });
  const [saving, setSaving] = useState(false);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [variants, setVariants] = useState<Array<{ id: string; size?: string; color?: string; price: string; stock: string; sku: string }>>(
    product?.variants?.map((v: any, idx: number) => ({ id: `${idx}`, size: v.size || '', color: v.color || '', price: String(v.price || formData.price || ''), stock: String(v.stock || ''), sku: v.sku || '' })) || []
  );
  const [images, setImages] = useState<string[]>(product?.images || []);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [deliveryRegions, setDeliveryRegions] = useState<string[]>(product?.delivery_regions || []);

  // Variants Management
  const addVariant = () => {
    setVariants([...variants, { id: Date.now().toString(), size: '', color: '', price: formData.price || '', stock: '', sku: '' }]);
  };

  const removeVariant = (id: string) => {
    setVariants(variants.filter(v => v.id !== id));
  };

  const updateVariant = (id: string, field: string, value: string) => {
    setVariants(variants.map(v => v.id === id ? { ...v, [field]: value } : v));
  };

  // Image Upload
  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    try {
      setUploadingImages(true);
      const uploadedUrls: string[] = [];
      for (const file of Array.from(files)) {
        const formData = new FormData();
        formData.append('image', file);

        try {
          const response = await apiClient.post<{ image_url?: string; url?: string }>(
            `/vendor/${sellerId}/products/images`,
            formData
          );
          const imageUrl = response.image_url || response.url;
          if (imageUrl) {
            uploadedUrls.push(imageUrl);
          } else {
            const dataUrl = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve(String(reader.result));
              reader.onerror = () => reject(new Error('Failed to read image file'));
              reader.readAsDataURL(file);
            });
            uploadedUrls.push(dataUrl);
          }
        } catch (error) {
          console.warn('Image upload failed; sending data URL for server-side S3 upload on save:', error);
          try {
            const dataUrl = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve(String(reader.result));
              reader.onerror = () => reject(new Error('Failed to read image file'));
              reader.readAsDataURL(file);
            });
            uploadedUrls.push(dataUrl);
          } catch {
            console.error('Could not read image for upload', error);
          }
        }
      }

      setImages([...images, ...uploadedUrls]);
      setImageFiles([...imageFiles, ...Array.from(files)]);
    } catch (error: any) {
      console.error('Error uploading images:', error);
      alert(error.message || 'Failed to upload images. You can add them later.');
    } finally {
      setUploadingImages(false);
    }
  };

  const removeImage = (index: number) => {
    setImages(images.filter((_, i) => i !== index));
    setImageFiles(imageFiles.filter((_, i) => i !== index));
  };

  // Delivery Regions
  const addDeliveryRegion = () => {
    const region = prompt('Enter delivery region (Pin code or City name):');
    if (region && !deliveryRegions.includes(region)) {
      setDeliveryRegions([...deliveryRegions, region]);
    }
  };

  const removeDeliveryRegion = (region: string) => {
    setDeliveryRegions(deliveryRegions.filter(r => r !== region));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const mrp = parseFloat(formData.original_price);
      if (!Number.isFinite(mrp) || mrp <= 0) {
        alert('MRP is required and must be greater than 0');
        setSaving(false);
        return;
      }
      const sellingRaw = String(formData.price ?? '').trim();
      const selling = sellingRaw ? parseFloat(sellingRaw) : mrp;
      if (!Number.isFinite(selling) || selling <= 0) {
        alert('Selling price must be greater than 0');
        setSaving(false);
        return;
      }
      if (selling > mrp) {
        alert('Selling price cannot exceed MRP');
        setSaving(false);
        return;
      }

      if (!formData.category_id) {
        alert('Category is required');
        setSaving(false);
        return;
      }

      if (images.length === 0) {
        alert('At least one product image is required');
        setSaving(false);
        return;
      }

      const hsn = String(formData.hsn_code ?? '').trim();
      if (!/^\d{4,8}$/.test(hsn)) {
        alert('HSN is required (4–8 digits)');
        setSaving(false);
        return;
      }

      const gstNum = parseFloat(formData.gst_rate);
      if (![0, 5, 12, 18, 28].includes(gstNum)) {
        alert('Tax (GST %) is required — choose 0, 5, 12, 18, or 28');
        setSaving(false);
        return;
      }

      const stockNum = parseInt(String(formData.stock), 10);
      if (!Number.isInteger(stockNum) || stockNum < 0) {
        alert('Stock quantity must be a whole number ≥ 0');
        setSaving(false);
        return;
      }

      const payload = {
        ...formData,
        price: selling,
        original_price: mrp,
        stock: stockNum,
        hsn_code: hsn,
        gst_rate: gstNum,
        sku: String(formData.sku ?? '').trim() || undefined,
        vendor_id: sellerId,
        images:
          images.length > 0 ? images.map(stripAwsPresignFromProductImageUrl) : [],
        variants: variants.length > 0 ? variants.map(v => ({
          size: v.size || null,
          color: v.color || null,
          price: parseFloat(v.price) || parseFloat(formData.price),
          stock: parseInt(v.stock) || 0,
          sku: v.sku || null,
        })) : null,
        delivery_regions: deliveryRegions.length > 0 ? deliveryRegions : null,
      };

      if (product) {
        await apiClient.put(`/vendor/${sellerId}/products/${product.id}`, payload);
      } else {
        await apiClient.post(`/vendor/${sellerId}/products`, payload);
      }

      onSave();
    } catch (error) {
      console.error('Error saving product:', error);
      alert('Failed to save product');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="shrink-0 border-b border-slate-100 bg-white p-6 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-900">{product ? 'Edit Product' : 'Add New Product'}</h2>
            <p className="text-sm text-slate-500 mt-1">Fill in the details below</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Basic Info */}
          <div className="space-y-4">
            <h3 className="font-semibold text-slate-900 flex items-center gap-2">
              <Package className="w-5 h-5 text-orange-500" />
              Basic Information
            </h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-2">Product Name *</label>
                <input
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Premium Dog Food"
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                />
              </div>

              <div className="col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-2">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  placeholder="Describe your product..."
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Category *</label>
                <select
                  required
                  value={formData.category_id}
                  onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 bg-white"
                >
                  <option value="">Select Category</option>
                  {categories.map((cat: any) => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Vendor Product Id</label>
                <input
                  value={formData.sku}
                  onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                  placeholder="Recommended — auto-generated if empty"
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 font-mono"
                />
              </div>
            </div>
          </div>

          {/* Pricing */}
          <div className="space-y-4">
            <h3 className="font-semibold text-slate-900 flex items-center gap-2">
              <IndianRupee className="w-5 h-5 text-orange-500" />
              Pricing & Inventory
            </h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">MRP (₹) *</label>
                <input
                  type="number"
                  required
                  min="0.01"
                  step="0.01"
                  value={formData.original_price}
                  onChange={(e) => setFormData({ ...formData, original_price: e.target.value })}
                  placeholder="Maximum retail price"
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Selling price (₹)</label>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  placeholder="Optional — same as MRP if empty"
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Stock Quantity *</label>
                <input
                  type="number"
                  required
                  min="0"
                  value={formData.stock}
                  onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">HSN *</label>
                <input
                  required
                  value={formData.hsn_code}
                  onChange={(e) => setFormData({ ...formData, hsn_code: e.target.value.replace(/\D/g, '').slice(0, 8) })}
                  placeholder="4–8 digit code"
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 font-mono"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Tax (GST %) *</label>
                <select
                  required
                  value={formData.gst_rate}
                  onChange={(e) => setFormData({ ...formData, gst_rate: e.target.value })}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 bg-white"
                >
                  <option value="">Select GST slab</option>
                  <option value="0">0%</option>
                  <option value="5">5%</option>
                  <option value="12">12%</option>
                  <option value="18">18%</option>
                  <option value="28">28%</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Product Icon</label>
                <input
                  value={formData.emoji}
                  onChange={(e) => setFormData({ ...formData, emoji: e.target.value })}
                  placeholder="📦"
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 text-2xl text-center"
                />
              </div>
            </div>
          </div>

          {/* Status */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Status</label>
            <select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 bg-white"
            >
              <option value="draft">Draft</option>
              <option value="pending">Submit for Approval</option>
              <option value="active">Active (if auto-approved)</option>
            </select>
          </div>

          {/* PHASE 1.3 ENHANCEMENT: Image Upload */}
          <div className="border-t border-slate-200 pt-6 space-y-4">
            <h3 className="font-semibold text-slate-900 flex items-center gap-2">
              <ImageIcon className="w-5 h-5 text-orange-500" />
              Product Images *
            </h3>
            <div className="space-y-3">
              <div className="flex items-center gap-4 flex-wrap">
                {images.map((image, index) => (
                  <div key={index} className="relative w-24 h-24 border-2 border-slate-200 rounded-xl overflow-hidden">
                    <img src={image} alt={`Product ${index + 1}`} className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removeImage(index)}
                      className="absolute top-1 right-1 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center text-xs hover:bg-red-600"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
                <TouchFilePicker
                  onFileChange={handleImageUpload}
                  accept="image/*"
                  multiple
                  disabled={uploadingImages}
                  className="relative h-24 w-24 flex-shrink-0 overflow-hidden rounded-xl border-2 border-dashed border-slate-300 transition-colors hover:border-orange-500"
                  innerClassName="flex w-full flex-col items-center justify-center p-1"
                >
                  <Upload className="mb-1 w-6 h-6 text-slate-400" />
                  <span className="text-xs text-slate-500">Upload</span>
                </TouchFilePicker>
              </div>
              {uploadingImages && (
                <p className="text-sm text-slate-500">Uploading images...</p>
              )}
              {images.length === 0 && (
                <p className="text-xs text-slate-400">Upload product images (optional, can add later)</p>
              )}
            </div>
          </div>

          {/* PHASE 1.3 ENHANCEMENT: Product Variants */}
          <div className="border-t border-slate-200 pt-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-slate-900">Product Variants (Size, Color)</h3>
              <button
                type="button"
                onClick={addVariant}
                className="flex items-center gap-1 px-3 py-1.5 text-sm bg-orange-100 text-orange-700 rounded-lg hover:bg-orange-200 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add Variant
              </button>
            </div>
            {variants.length > 0 ? (
              <div className="space-y-3">
                {variants.map((variant) => (
                  <div key={variant.id} className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-medium text-slate-700">Variant #{variants.indexOf(variant) + 1}</span>
                      <button
                        type="button"
                        onClick={() => removeVariant(variant.id)}
                        className="text-red-500 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-slate-600 mb-1">Size</label>
                        <input
                          type="text"
                          value={variant.size}
                          onChange={(e) => updateVariant(variant.id, 'size', e.target.value)}
                          className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-orange-500/20 focus:border-orange-500"
                          placeholder="e.g., Small, Medium"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-600 mb-1">Color</label>
                        <input
                          type="text"
                          value={variant.color}
                          onChange={(e) => updateVariant(variant.id, 'color', e.target.value)}
                          className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-orange-500/20 focus:border-orange-500"
                          placeholder="e.g., Red, Blue"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-600 mb-1">Price (₹)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={variant.price}
                          onChange={(e) => updateVariant(variant.id, 'price', e.target.value)}
                          className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-orange-500/20 focus:border-orange-500"
                          placeholder="0.00"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-600 mb-1">Stock</label>
                        <input
                          type="number"
                          value={variant.stock}
                          onChange={(e) => updateVariant(variant.id, 'stock', e.target.value)}
                          className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-orange-500/20 focus:border-orange-500"
                          placeholder="0"
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="block text-xs text-slate-600 mb-1">Variant SKU</label>
                        <input
                          type="text"
                          value={variant.sku}
                          onChange={(e) => updateVariant(variant.id, 'sku', e.target.value)}
                          className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-orange-500/20 focus:border-orange-500"
                          placeholder="Optional SKU for this variant"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400">No variants added. Add variants if your product comes in different sizes or colors.</p>
            )}
          </div>

          {/* PHASE 1.3 ENHANCEMENT: Shipping/Delivery Regions */}
          <div className="border-t border-slate-200 pt-6 space-y-4">
            <div className="flex items-center justify-between">
              <label className="block text-sm font-medium text-slate-700 flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                Delivery Regions (Pin Codes/Cities)
              </label>
              <button
                type="button"
                onClick={addDeliveryRegion}
                className="flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add Region
              </button>
            </div>
            {deliveryRegions.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {deliveryRegions.map((region, index) => (
                  <div key={index} className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-lg">
                    <span className="text-sm text-blue-700">{region}</span>
                    <button
                      type="button"
                      onClick={() => removeDeliveryRegion(region)}
                      className="text-blue-500 hover:text-blue-700"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400">No regions specified. If left empty, product will be available in all regions where vendor delivers.</p>
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-6 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-3 border border-slate-200 text-slate-700 rounded-xl font-medium hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-3 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl font-semibold shadow-lg shadow-orange-500/25 hover:shadow-xl disabled:opacity-50 transition-all"
            >
              {saving ? 'Saving...' : (product ? 'Update Product' : 'Create Product')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
