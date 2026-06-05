'use client';

import { X, ShoppingBag, Upload } from 'lucide-react';
import { useState, useEffect } from 'react';
import { apiClientWithMock as apiClient } from '@/lib/api-client-with-mock';
import { TouchFilePicker } from '@/components/shared/TouchFilePicker';

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

function normalizeProductImages(raw: unknown): string[] {
  if (raw == null) return [];
  if (Array.isArray(raw)) {
    return raw.map((u) => String(u ?? '').trim()).filter(Boolean);
  }
  if (typeof raw === 'string') {
    const t = raw.trim();
    if (t.startsWith('[')) {
      try {
        const parsed = JSON.parse(t);
        if (Array.isArray(parsed)) {
          return parsed.map((u) => String(u ?? '').trim()).filter(Boolean);
        }
      } catch {
        /* fall through */
      }
    }
    return t ? [t] : [];
  }
  return [];
}

interface Product {
  id: string;
  name: string;
  description: string;
  category: string;
  category_id?: string;
  price: number;
  original_price?: number;
  compare_at_price?: number;
  stock: number;
  stock_quantity?: number;
  hsn_code?: string;
  gst_rate?: number;
  sku?: string;
  is_active: boolean;
  images?: string[] | string;
}

interface EditProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  product: Product | null;
  categories: Array<{ id: string; name: string }>;
}

export function EditProductModal({
  isOpen,
  onClose,
  onSuccess,
  product,
  categories
}: EditProductModalProps) {
  const [loading, setLoading] = useState(false);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [images, setImages] = useState<string[]>([]);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    categoryId: '',
    category: '',
    price: '',
    original_price: '',
    stock: '',
    hsn_code: '',
    gst_rate: '',
    is_active: true,
  });

  useEffect(() => {
    if (product && isOpen) {
      const mrp = product.original_price ?? product.compare_at_price ?? product.price;
      const selling =
        mrp && product.price < mrp ? product.price : '';
      setFormData({
        name: product.name || '',
        description: product.description || '',
        categoryId: product.category_id || '',
        category: product.category || '',
        price: selling !== '' ? String(selling) : '',
        original_price: mrp != null ? String(mrp) : '',
        stock: String(product.stock ?? product.stock_quantity ?? 0),
        hsn_code: product.hsn_code || '',
        gst_rate: product.gst_rate != null ? String(product.gst_rate) : '',
        is_active: product.is_active !== false,
      });
      setImages(normalizeProductImages(product.images));
    }
  }, [product, isOpen]);

  const handleChange = (field: string, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    try {
      setUploadingImages(true);
      const vendorId = localStorage.getItem('vendorId');
      if (!vendorId) {
        alert('Vendor ID not found. Please login again.');
        return;
      }

      const uploadedUrls: string[] = [];
      for (const file of Array.from(files)) {
        const fd = new FormData();
        fd.append('image', file);
        try {
          const response = await apiClient.post<{ image_url?: string; url?: string }>(
            `/vendor/${vendorId}/products/images`,
            fd
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
        } catch {
          const dataUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result));
            reader.onerror = () => reject(new Error('Failed to read image file'));
            reader.readAsDataURL(file);
          });
          uploadedUrls.push(dataUrl);
        }
      }
      setImages((prev) => [...prev, ...uploadedUrls]);
    } catch (error: unknown) {
      console.error('Error uploading images:', error);
      alert(error instanceof Error ? error.message : 'Failed to upload images');
    } finally {
      setUploadingImages(false);
    }
  };

  const removeImage = (index: number) => {
    setImages(images.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!formData.name?.trim()) {
      alert('Product name is required');
      return;
    }
    if (!formData.categoryId) {
      alert('Category is required');
      return;
    }
    const mrp = parseFloat(formData.original_price);
    if (!Number.isFinite(mrp) || mrp <= 0) {
      alert('MRP is required and must be greater than 0');
      return;
    }
    const sellingRaw = String(formData.price ?? '').trim();
    const selling = sellingRaw ? parseFloat(sellingRaw) : mrp;
    if (!Number.isFinite(selling) || selling <= 0) {
      alert('Selling price must be greater than 0');
      return;
    }
    if (selling > mrp) {
      alert('Selling price cannot exceed MRP');
      return;
    }
    const stockNum = parseInt(String(formData.stock), 10);
    if (!Number.isInteger(stockNum) || stockNum < 0) {
      alert('Stock quantity must be a whole number ≥ 0');
      return;
    }
    const hsn = String(formData.hsn_code ?? '').trim();
    if (!/^\d{4,8}$/.test(hsn)) {
      alert('HSN is required (4–8 digits)');
      return;
    }
    const gstNum = parseFloat(formData.gst_rate);
    if (![0, 5, 12, 18, 28].includes(gstNum)) {
      alert('Tax (GST %) is required — choose 0, 5, 12, 18, or 28');
      return;
    }
    if (images.length === 0) {
      alert('At least one product image is required');
      return;
    }

    if (!product) return;

    try {
      setLoading(true);
      const vendorId = localStorage.getItem('vendorId');
      if (!vendorId) {
        alert('Vendor ID not found. Please login again.');
        return;
      }

      const productData = {
        name: formData.name.trim(),
        description: formData.description,
        category_id: formData.categoryId,
        category: formData.category || null,
        price: selling,
        original_price: mrp,
        compare_at_price: mrp,
        stock: stockNum,
        stock_quantity: stockNum,
        hsn_code: hsn,
        gst_rate: gstNum,
        is_active: formData.is_active,
        images: images.map(stripAwsPresignFromProductImageUrl),
      };

      await apiClient.put(`/vendor/${vendorId}/products/${product.id}`, productData);
      alert('Product updated successfully!');
      onSuccess?.();
      onClose();
    } catch (error: unknown) {
      console.error('Error updating product:', error);
      alert(error instanceof Error ? error.message : 'Failed to update product. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !product) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b sticky top-0 bg-white">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <ShoppingBag className="w-5 h-5 text-blue-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">Edit Product</h3>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded"
            disabled={loading}
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Product Name *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => handleChange('name', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:border-orange-500 focus:ring-2 focus:ring-orange-100 outline-none"
              placeholder="e.g., Premium Dog Food"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => handleChange('description', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:border-orange-500 focus:ring-2 focus:ring-orange-100 outline-none"
              rows={3}
              placeholder="Product description..."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Category *
              </label>
              <select
                value={formData.categoryId}
                onChange={(e) => handleChange('categoryId', e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:border-orange-500 focus:ring-2 focus:ring-orange-100 outline-none"
              >
                <option value="">Select category</option>
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                System SKU
              </label>
              {product.sku ? (
                <p className="w-full px-4 py-2 border border-gray-200 rounded-lg bg-gray-50 font-mono text-sm text-gray-700">
                  {product.sku}
                </p>
              ) : (
                <p className="w-full px-4 py-2 border border-amber-200 rounded-lg bg-amber-50 text-sm text-amber-800">
                  Not assigned yet — a system SKU will be generated when you save.
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                MRP (₹) *
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={formData.original_price}
                onChange={(e) => handleChange('original_price', e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:border-orange-500 focus:ring-2 focus:ring-orange-100 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Selling price (₹)
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={formData.price}
                onChange={(e) => handleChange('price', e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:border-orange-500 focus:ring-2 focus:ring-orange-100 outline-none"
                placeholder="Optional — same as MRP if empty"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Stock Quantity *
              </label>
              <input
                type="number"
                min="0"
                value={formData.stock}
                onChange={(e) => handleChange('stock', e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:border-orange-500 focus:ring-2 focus:ring-orange-100 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                HSN *
              </label>
              <input
                type="text"
                value={formData.hsn_code}
                onChange={(e) => handleChange('hsn_code', e.target.value.replace(/\D/g, '').slice(0, 8))}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:border-orange-500 focus:ring-2 focus:ring-orange-100 outline-none font-mono"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tax (GST %) *
              </label>
              <select
                value={formData.gst_rate}
                onChange={(e) => handleChange('gst_rate', e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:border-orange-500 focus:ring-2 focus:ring-orange-100 outline-none bg-white"
              >
                <option value="">Select GST slab</option>
                <option value="0">0%</option>
                <option value="5">5%</option>
                <option value="12">12%</option>
                <option value="18">18%</option>
                <option value="28">28%</option>
              </select>
            </div>
          </div>

          <div>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.is_active}
                onChange={(e) => handleChange('is_active', e.target.checked)}
                className="w-4 h-4 text-orange-500 border-gray-300 rounded focus:ring-orange-500"
              />
              <span className="text-sm text-gray-700">Product is active (visible to customers)</span>
            </label>
          </div>

          <div className="border-t pt-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Product Images *
            </label>
            <p className="text-xs text-gray-500 mb-2">At least one image required. You can upload multiple images.</p>
            <div className="space-y-3">
              <div className="flex items-center gap-4 flex-wrap">
                {images.map((image, index) => (
                  <div key={index} className="relative w-24 h-24 border-2 border-gray-200 rounded-lg overflow-hidden">
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
                  className="relative h-24 w-24 flex-shrink-0 overflow-hidden rounded-lg border-2 border-dashed border-gray-300 transition-colors hover:border-orange-500"
                  innerClassName="flex w-full flex-col items-center justify-center p-1"
                >
                  <Upload className="mb-1 w-6 h-6 text-gray-400" />
                  <span className="text-xs text-gray-500">Upload</span>
                </TouchFilePicker>
              </div>
              {uploadingImages && (
                <p className="text-sm text-gray-500">Uploading images...</p>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 p-6 border-t bg-gray-50">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 transition disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="px-6 py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition disabled:opacity-50"
          >
            {loading ? 'Updating...' : 'Update Product'}
          </button>
        </div>
      </div>
    </div>
  );
}
