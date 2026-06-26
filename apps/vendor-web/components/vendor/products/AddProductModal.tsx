'use client';

/** Legacy /products page modal. Canonical add/edit UX: Seller Hub → ProductCatalogManagement → ProductFormModal. */

import { X, ShoppingBag, Plus, Trash2, Upload, Image as ImageIcon, MapPin } from 'lucide-react';
import { useState } from 'react';
import { apiClientWithMock as apiClient } from '@/lib/api-client-with-mock';
import { TouchFilePicker } from '@/components/shared/TouchFilePicker';
import { IntegerInput } from '@/components/shared/IntegerInput';
import { DecimalInput } from '@/components/shared/DecimalInput';

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

interface AddProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  categories: Array<{ id: string; name: string }>;
}

export function AddProductModal({
  isOpen,
  onClose,
  onSuccess,
  categories
}: AddProductModalProps) {
  const [loading, setLoading] = useState(false);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [variants, setVariants] = useState<Array<{ id: string; size?: string; color?: string; price: string; stock: string }>>([]);
  const [images, setImages] = useState<string[]>([]);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [deliveryRegions, setDeliveryRegions] = useState<string[]>([]);
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

  const handleChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // Variants Management
  const addVariant = () => {
    setVariants([...variants, { id: Date.now().toString(), size: '', color: '', price: formData.price || '', stock: '' }]);
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
      const vendorId = localStorage.getItem('vendorId');
      if (!vendorId) {
        alert('Vendor ID not found. Please login again.');
        return;
      }

      const uploadedUrls: string[] = [];
      for (const file of Array.from(files)) {
        const formData = new FormData();
        formData.append('image', file);

        try {
          // Try to upload to product images endpoint
          const response = await apiClient.post<{ image_url?: string; url?: string }>(
            `/vendor/${vendorId}/products/images`,
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
          console.warn('Image upload failed; using data URL for server-side S3 on save:', error);
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

  const handleSubmit = async () => {
    const mrp = parseFloat(formData.original_price);
    if (!formData.name?.trim()) {
      alert('Product name is required');
      return;
    }
    if (!formData.categoryId) {
      alert('Category is required');
      return;
    }
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
        skus:
          variants.length > 0
            ? variants.map((v) => ({
                option_values: {
                  ...(v.size ? { size: v.size } : {}),
                  ...(v.color ? { color: v.color } : {}),
                },
                price: parseFloat(v.price) || selling,
                compare_at_price: mrp,
                stock: parseInt(v.stock, 10) || 0,
                images: [],
              }))
            : undefined,
        delivery_regions: deliveryRegions.length > 0 ? deliveryRegions : null,
      };

      await apiClient.post(`/vendor/${vendorId}/products`, productData);
      alert('Product created successfully!');
      onSuccess?.();
      onClose();
      setFormData({
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
      setVariants([]);
      setImages([]);
      setImageFiles([]);
      setDeliveryRegions([]);
    } catch (error: any) {
      console.error('Error creating product:', error);
      alert(error.message || 'Failed to create product. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b sticky top-0 bg-white">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <ShoppingBag className="w-5 h-5 text-green-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">Add Product</h3>
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

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Category *
            </label>
            <select
              required
              value={formData.categoryId}
              onChange={(e) => handleChange('categoryId', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:border-orange-500 focus:ring-2 focus:ring-orange-100 outline-none"
            >
              <option value="">Select category</option>
              {categories.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">System SKU is assigned automatically when you save.</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                MRP (₹) *
              </label>
              <DecimalInput
                value={formData.original_price}
                onChange={(v) => handleChange('original_price', v)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:border-orange-500 focus:ring-2 focus:ring-orange-100 outline-none"
                placeholder="Maximum retail price"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Selling price (₹)
              </label>
              <DecimalInput
                value={formData.price}
                onChange={(v) => handleChange('price', v)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:border-orange-500 focus:ring-2 focus:ring-orange-100 outline-none"
                placeholder="Optional — same as MRP if empty"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Stock Quantity *
              </label>
              <IntegerInput
                value={formData.stock}
                onChange={(v) => handleChange('stock', v)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:border-orange-500 focus:ring-2 focus:ring-orange-100 outline-none"
                placeholder="0"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                HSN *
              </label>
              <input
                type="text"
                value={formData.hsn_code}
                onChange={(e) => handleChange('hsn_code', e.target.value.replace(/\D/g, '').slice(0, 8))}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:border-orange-500 focus:ring-2 focus:ring-orange-100 outline-none font-mono"
                placeholder="4–8 digit code"
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

          {/* PHASE 1.3 ENHANCEMENT: Image Upload */}
          <div className="border-t pt-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Product Images *
            </label>
            <div className="space-y-3">
              <div className="flex items-center gap-4 flex-wrap">
                {images.map((image, index) => (
                  <div key={index} className="relative w-24 h-24 border-2 border-gray-200 rounded-lg overflow-hidden">
                    <img src={image} alt={`Product ${index + 1}`} className="w-full h-full object-cover" />
                    <button
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
              <p className="text-xs text-gray-500">At least one image required. You can upload multiple images.</p>
            </div>
          </div>

          {/* PHASE 1.3 ENHANCEMENT: Product Variants */}
          <div className="border-t pt-4">
            <div className="flex items-center justify-between mb-3">
              <label className="block text-sm font-medium text-gray-700">
                Product Variants (Size, Color)
              </label>
              <button
                type="button"
                onClick={addVariant}
                className="flex items-center gap-1 px-3 py-1 text-sm bg-orange-100 text-orange-700 rounded-lg hover:bg-orange-200 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add Variant
              </button>
            </div>
            {variants.length > 0 ? (
              <div className="space-y-3">
                {variants.map((variant) => (
                  <div key={variant.id} className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-medium text-gray-700">Variant #{variants.indexOf(variant) + 1}</span>
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
                        <label className="block text-xs text-gray-600 mb-1">Size</label>
                        <input
                          type="text"
                          value={variant.size}
                          onChange={(e) => updateVariant(variant.id, 'size', e.target.value)}
                          className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:border-orange-500 focus:ring-1 focus:ring-orange-100 outline-none"
                          placeholder="e.g., Small, Medium"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">Color</label>
                        <input
                          type="text"
                          value={variant.color}
                          onChange={(e) => updateVariant(variant.id, 'color', e.target.value)}
                          className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:border-orange-500 focus:ring-1 focus:ring-orange-100 outline-none"
                          placeholder="e.g., Red, Blue"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">Price (₹)</label>
                        <DecimalInput
                          value={variant.price}
                          onChange={(v) => updateVariant(variant.id, 'price', v)}
                          className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:border-orange-500 focus:ring-1 focus:ring-orange-100 outline-none"
                          placeholder="0.00"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">Stock</label>
                        <IntegerInput
                          value={variant.stock}
                          onChange={(v) => updateVariant(variant.id, 'stock', v)}
                          className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:border-orange-500 focus:ring-1 focus:ring-orange-100 outline-none"
                          placeholder="0"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-400">No variants added. Add variants if your product comes in different sizes or colors.</p>
            )}
          </div>

          {/* PHASE 1.3 ENHANCEMENT: Shipping/Delivery Regions */}
          <div className="border-t pt-4">
            <div className="flex items-center justify-between mb-3">
              <label className="block text-sm font-medium text-gray-700 flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                Delivery Regions (Pin Codes/Cities)
              </label>
              <button
                type="button"
                onClick={addDeliveryRegion}
                className="flex items-center gap-1 px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors"
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
              <p className="text-xs text-gray-400">No regions specified. If left empty, product will be available in all regions where vendor delivers.</p>
            )}
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
            {loading ? 'Creating...' : 'Create Product'}
          </button>
        </div>
      </div>
    </div>
  );
}

