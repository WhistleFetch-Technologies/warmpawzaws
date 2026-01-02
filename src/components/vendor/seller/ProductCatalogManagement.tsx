import React, { useState, useEffect } from 'react';
import {
  Plus, Search, Filter, Edit2, Trash2, Eye, Package,
  Grid, List, ChevronDown, X, Upload, DollarSign, Tag
} from 'lucide-react';
import { toast } from 'sonner';
import { WARM_ORANGE } from '../../../assets/design-tokens';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../ui/table";
import { Badge } from '../../ui/badge';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';

interface ProductCatalogManagementProps {
  sellerId: string;
}

export function ProductCatalogManagement({ sellerId }: ProductCatalogManagementProps) {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [categories, setCategories] = useState<any[]>([]);

  useEffect(() => {
    loadProducts();
    loadCategories();
  }, [sellerId]);

  const loadProducts = async () => {
    try {
      setLoading(true);
      // ✅ FIX: Use API Gateway URL instead of Supabase
      const { apiCallJson } = await import('@warmpawz/api-client/http');
      const API_GATEWAY_URL = process.env.NEXT_PUBLIC_API_GATEWAY_URL || '';
      if (!API_GATEWAY_URL) {
        throw new Error('API Gateway URL not configured');
      }

      const data = await apiCallJson<any>(
        `${API_GATEWAY_URL}/make-server-3dd53475/ecommerce/products?sellerId=${sellerId}`
      );
      
      if (data.success) {
        setProducts(data.products || data.data?.products || []);
      } else {
        toast.error(data.error || data.message || 'Failed to load products');
      }
    } catch (error: any) {
      console.error('Error loading products:', error);
      toast.error(error?.message || 'Failed to load products');
    } finally {
      setLoading(false);
    }
  };

  const loadCategories = async () => {
    try {
      // ✅ FIX: Use API Gateway URL instead of Supabase
      const { apiCallJson } = await import('@warmpawz/api-client/http');
      const API_GATEWAY_URL = process.env.NEXT_PUBLIC_API_GATEWAY_URL || '';
      if (!API_GATEWAY_URL) {
        throw new Error('API Gateway URL not configured');
      }

      const data = await apiCallJson<any>(
        `${API_GATEWAY_URL}/make-server-3dd53475/ecommerce/categories`
      );
      
      if (data.success) {
        setCategories(data.categories || data.data?.categories || []);
      }
    } catch (error: any) {
      console.error('Error loading categories:', error);
    }
  };

  const handleDeleteProduct = async (productId: string) => {
    if (!confirm('Are you sure you want to delete this product?')) return;
    
    try {
      // ✅ FIX: Use API Gateway URL instead of Supabase
      const { apiCallJson } = await import('@warmpawz/api-client/http');
      const API_GATEWAY_URL = process.env.NEXT_PUBLIC_API_GATEWAY_URL || '';
      if (!API_GATEWAY_URL) {
        throw new Error('API Gateway URL not configured');
      }

      const data = await apiCallJson<any>(
        `${API_GATEWAY_URL}/make-server-3dd53475/ecommerce/product/${productId}`,
        {
          method: 'DELETE'
        }
      );
      
      if (data.success) {
        toast.success('Product deleted successfully');
        await loadProducts();
      } else {
        toast.error(data.error || data.message || 'Failed to delete product');
      }
    } catch (error: any) {
      console.error('Error deleting product:', error);
      toast.error(error?.message || 'Failed to delete product');
    }
  };

  const filteredProducts = products.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || product.category === selectedCategory;
    const matchesStatus = selectedStatus === 'all' || product.status === selectedStatus;
    return matchesSearch && matchesCategory && matchesStatus;
  });

  const statusColors: any = {
    'active': 'bg-green-100 text-green-700 border-green-200',
    'pending_approval': 'bg-yellow-100 text-yellow-700 border-yellow-200',
    'draft': 'bg-gray-100 text-gray-700 border-gray-200',
    'rejected': 'bg-red-100 text-red-700 border-red-200',
    'out_of_stock': 'bg-orange-100 text-orange-700 border-orange-200'
  };

  const getStatusBadge = (status: string) => {
      const styles = statusColors[status] || 'bg-gray-100 text-gray-700';
      return (
          <Badge variant="outline" className={`${styles} capitalize`}>
              {status.replace('_', ' ')}
          </Badge>
      );
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-black">Product Catalog</h1>
          <p className="text-gray-500 mt-1">Manage your product listings</p>
        </div>
        <Button
          onClick={() => {
            setEditingProduct(null);
            setShowAddModal(true);
          }}
          className="gap-2"
          style={{ backgroundColor: WARM_ORANGE }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#E67A32';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = WARM_ORANGE;
          }}
        >
          <Plus className="w-5 h-5" />
          Add Product
        </Button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <Input
              type="text"
              placeholder="Search products..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Category Filter */}
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
             <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="All Categories" />
             </SelectTrigger>
             <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map(cat => (
                   <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                ))}
             </SelectContent>
          </Select>

          {/* Status Filter */}
          <Select value={selectedStatus} onValueChange={setSelectedStatus}>
             <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All Status" />
             </SelectTrigger>
             <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="pending_approval">Pending Approval</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="out_of_stock">Out of Stock</SelectItem>
             </SelectContent>
          </Select>

          {/* View Toggle */}
          <div className="flex gap-1 bg-gray-100 p-1 rounded-lg border">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded ${viewMode === 'grid' ? 'bg-white shadow' : 'text-gray-500 hover:text-gray-900'}`}
              style={{
                color: viewMode === 'grid' ? WARM_ORANGE : undefined
              }}
            >
              <Grid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded ${viewMode === 'list' ? 'bg-white shadow text-[#FF8C42]' : 'text-gray-500 hover:text-gray-900'}`}
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Products Grid/List */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF8C42]"></div>
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">No products found</p>
          <p className="text-sm text-gray-400 mt-1">Try adjusting your filters or add a new product</p>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredProducts.map(product => (
            <ProductCard
              key={product.id}
              product={product}
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
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
           <Table>
              <TableHeader>
                 <TableRow className="bg-gray-50">
                    <TableHead className="w-[80px]">Image</TableHead>
                    <TableHead>Product Name</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Price</TableHead>
                    <TableHead className="text-center">Stock</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                 </TableRow>
              </TableHeader>
              <TableBody>
                 {filteredProducts.map(product => (
                    <TableRow key={product.id} className="hover:bg-gray-50">
                       <TableCell>
                          <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center text-xl overflow-hidden border">
                             {product.image ? (
                                <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
                             ) : (
                                <span>{product.emoji || '📦'}</span>
                             )}
                          </div>
                       </TableCell>
                       <TableCell className="font-medium">
                          <div className="flex flex-col">
                             <span>{product.name}</span>
                             <span className="text-xs text-muted-foreground line-clamp-1">{product.description}</span>
                          </div>
                       </TableCell>
                       <TableCell className="font-mono text-xs text-muted-foreground">{product.sku}</TableCell>
                       <TableCell>{categories.find(c => c.id === product.category)?.name || 'Uncategorized'}</TableCell>
                       <TableCell className="text-right font-bold">₹{product.price}</TableCell>
                       <TableCell className="text-center">
                          <Badge variant={product.stock > 10 ? 'outline' : 'destructive'} className="font-mono">
                             {product.stock}
                          </Badge>
                       </TableCell>
                       <TableCell className="text-center">{getStatusBadge(product.status)}</TableCell>
                       <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                             <Button size="sm" variant="ghost" onClick={() => { setEditingProduct(product); setShowAddModal(true); }}>
                                <Edit2 className="h-4 w-4" />
                             </Button>
                             <Button size="sm" variant="ghost" className="text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => handleDeleteProduct(product.id)}>
                                <Trash2 className="h-4 w-4" />
                             </Button>
                          </div>
                       </TableCell>
                    </TableRow>
                 ))}
              </TableBody>
           </Table>
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
    </div>
  );
}

function ProductCard({ product, onEdit, onDelete, getStatusBadge }: any) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-lg transition-shadow flex flex-col h-full">
      <div className="aspect-square bg-gray-100 flex items-center justify-center text-6xl border-b relative">
        {product.image ? (
            <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
        ) : (
            <span>{product.emoji || '📦'}</span>
        )}
        <div className="absolute top-2 right-2">
            {getStatusBadge(product.status)}
        </div>
      </div>
      <div className="p-4 flex-1 flex flex-col">
        <div className="mb-2">
          <h3 className="font-semibold text-black line-clamp-2 h-12">{product.name}</h3>
        </div>
        <p className="text-gray-500 text-sm line-clamp-2 mb-3 flex-1">{product.description}</p>
        <div className="flex items-center justify-between mb-4 mt-auto pt-2 border-t border-dashed">
          <div>
            <p className="text-black font-bold">₹{product.price}</p>
            {product.originalPrice && product.originalPrice > product.price && (
              <p className="text-xs text-gray-400 line-through">₹{product.originalPrice}</p>
            )}
          </div>
          <div className="text-sm text-gray-600">
            Stock: <span className={`font-bold ${product.stock < 10 ? 'text-red-600' : ''}`}>{product.stock || 0}</span>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={onEdit}
            className="flex-1 gap-2"
          >
            <Edit2 className="w-4 h-4" /> Edit
          </Button>
          <Button
            variant="ghost"
            onClick={onDelete}
            className="flex-1 gap-2 text-red-600 hover:text-red-700 hover:bg-red-50"
          >
            <Trash2 className="w-4 h-4" /> Delete
          </Button>
        </div>
      </div>
    </div>
  );
}

function ProductModal({ product, sellerId, categories, onClose, onSave }: any) {
  const [formData, setFormData] = useState({
    name: product?.name || '',
    header: product?.header || '',
    description: product?.description || '',
    category: product?.category || '',
    price: product?.price || '',
    originalPrice: product?.originalPrice || '',
    stock: product?.stock || '',
    sku: product?.sku || `SKU-${Date.now()}`,
    emoji: product?.emoji || '📦',
    images: product?.images || (product?.image ? [product.image] : []),
    size: product?.size || '',
    weight: product?.weight || '',
    dimensions: product?.dimensions || { length: '', width: '', height: '' },
    lowStockThreshold: product?.lowStockThreshold || 10,
    status: product?.status || 'draft'
  });
  const [newImageUrl, setNewImageUrl] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      // ✅ FIX: Use API Gateway URL instead of Supabase
      const { apiCallJson } = await import('@warmpawz/api-client/http');
      const API_GATEWAY_URL = process.env.NEXT_PUBLIC_API_GATEWAY_URL || '';
      if (!API_GATEWAY_URL) {
        throw new Error('API Gateway URL not configured');
      }

      const url = product
        ? `${API_GATEWAY_URL}/make-server-3dd53475/ecommerce/product/${product.id}`
        : `${API_GATEWAY_URL}/make-server-3dd53475/ecommerce/product`;

      const data = await apiCallJson<any>(url, {
        method: product ? 'PUT' : 'POST',
        body: JSON.stringify({
          ...formData,
          sellerId,
          price: parseFloat(formData.price),
          originalPrice: formData.originalPrice ? parseFloat(formData.originalPrice) : null,
          stock: parseInt(formData.stock),
          lowStockThreshold: parseInt(formData.lowStockThreshold),
          image: formData.images[0] || '' // Set primary image for backward compatibility
        })
      });

      if (data.success) {
        toast.success(product ? 'Product updated successfully' : 'Product created successfully');
        onSave();
      } else {
        toast.error(data.error || data.message || 'Failed to save product');
      }
    } catch (error: any) {
      console.error('Error saving product:', error);
      toast.error(error?.message || 'Failed to save product');
    } finally {
      setSaving(false);
    }
  };

  const addImage = () => {
    if (newImageUrl) {
      setFormData({ ...formData, images: [...formData.images, newImageUrl] });
      setNewImageUrl('');
    }
  };

  const removeImage = (index: number) => {
    const newImages = [...formData.images];
    newImages.splice(index, 1);
    setFormData({ ...formData, images: newImages });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex items-center justify-between z-10">
          <h2 className="text-xl font-bold text-black">{product ? 'Edit Product' : 'Add New Product'}</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Basic Info Section */}
          <div className="space-y-4">
            <h3 className="font-medium text-gray-900 border-b pb-2">Basic Information</h3>
            
            {/* Product Name */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">Product Name *</label>
              <Input
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Premium Dog Food"
              />
            </div>

            {/* Header/Subtitle */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">Subtitle (Optional)</label>
              <Input
                value={formData.header}
                onChange={(e) => setFormData({ ...formData, header: e.target.value })}
                placeholder="e.g., Best Seller, New Arrival"
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
                placeholder="Describe your product..."
              />
            </div>
          </div>

          {/* Product Details Section */}
          <div className="space-y-4">
            <h3 className="font-medium text-gray-900 border-b pb-2">Product Details</h3>

            {/* Category & SKU */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">Category *</label>
                <Select required value={formData.category} onValueChange={(v) => setFormData({...formData, category: v})}>
                    <SelectTrigger>
                        <SelectValue placeholder="Select Category" />
                    </SelectTrigger>
                    <SelectContent>
                        {Array.isArray(categories) && categories.map((cat: any) => (
                            <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">SKU</label>
                <Input
                  value={formData.sku}
                  onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                />
              </div>
            </div>

            {/* Physical Specs */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">Size / Variant</label>
                <Input
                  value={formData.size}
                  onChange={(e) => setFormData({ ...formData, size: e.target.value })}
                  placeholder="e.g., Small, 5kg"
                />
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">Weight (kg)</label>
                <Input
                  value={formData.weight}
                  onChange={(e) => setFormData({ ...formData, weight: e.target.value })}
                  placeholder="0.5"
                />
              </div>
            </div>
          </div>

          {/* Pricing & Stock Section */}
          <div className="space-y-4">
            <h3 className="font-medium text-gray-900 border-b pb-2">Pricing & Inventory</h3>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">Price (₹) *</label>
                <Input
                  type="number"
                  required
                  min="0"
                  step="0.01"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">Original Price (₹)</label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.originalPrice}
                  onChange={(e) => setFormData({ ...formData, originalPrice: e.target.value })}
                  placeholder="Optional"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">Stock Quantity *</label>
                <Input
                  type="number"
                  required
                  min="0"
                  value={formData.stock}
                  onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">Low Stock Alert</label>
                <Input
                  type="number"
                  min="0"
                  value={formData.lowStockThreshold}
                  onChange={(e) => setFormData({ ...formData, lowStockThreshold: e.target.value })}
                />
              </div>
            </div>
          </div>

          {/* Status Section */}
          <div className="space-y-4">
            <h3 className="font-medium text-gray-900 border-b pb-2">Settings</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">Product Icon (Emoji)</label>
                <Input
                  value={formData.emoji}
                  onChange={(e) => setFormData({ ...formData, emoji: e.target.value })}
                  placeholder="📦"
                />
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">Status</label>
                <Select value={formData.status} onValueChange={(v) => setFormData({...formData, status: v})}>
                    <SelectTrigger>
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="draft">Draft</SelectItem>
                        <SelectItem value="pending_approval">Pending Approval</SelectItem>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="out_of_stock">Out of Stock</SelectItem>
                    </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-6 border-t">
             <Button type="button" variant="outline" className="mr-2" onClick={onClose}>Cancel</Button>
             <Button type="submit" disabled={saving} className="bg-[#FF8C42] hover:bg-[#E67A32]">
                {saving ? 'Saving...' : 'Save Product'}
             </Button>
          </div>
        </form>
      </div>
    </div>
  );
}