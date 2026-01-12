import { useState, useEffect } from 'react';
import { Eye, Edit, Trash2, Plus } from 'lucide-react';
import { Button } from '../../ui/button';
import { projectId, publicAnonKey } from '../../../utils/supabase/info';
import { CreateProductServiceModal } from './CreateProductServiceModal';
import { EditProductServiceModal } from './EditProductServiceModal';

interface ProductService {
  id: string;
  name: string;
  sku: string;
  category: string;
  price: number;
  stock: number | string;
  status: 'active' | 'out-of-stock';
  rating: number;
}

export function ProductServicesTab() {
  const [products, setProducts] = useState<ProductService[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<ProductService | null>(null);
  const [categories, setCategories] = useState<string[]>([]);

  useEffect(() => {
    loadProducts();
    loadCategories();
  }, []);

  const loadProducts = async () => {
    try {
      setLoading(true);
      
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/admin/catalog/products`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`
          }
        }
      );
      
      if (response.ok) {
        const data = await response.json();
        console.log('Products loaded:', data);
        setProducts(data.products || []);
      }
    } catch (error) {
      console.error('Error loading products:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadCategories = async () => {
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/admin/catalog/categories`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`
          }
        }
      );
      
      if (response.ok) {
        const data = await response.json();
        const catNames = data.categories.map((c: any) => c.name);
        setCategories(catNames);
      }
    } catch (error) {
      console.error('Error loading categories:', error);
    }
  };

  const handleEdit = (product: ProductService) => {
    setSelectedProduct(product);
    setShowEditModal(true);
  };

  const handleDelete = async (productId: string) => {
    if (!confirm('Are you sure you want to delete this product/service?')) return;
    
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/admin/catalog/products/${productId}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`
          }
        }
      );
      
      if (response.ok) {
        loadProducts();
      }
    } catch (error) {
      console.error('Error deleting product:', error);
    }
  };

  const handleView = (productId: string) => {
    console.log('View product:', productId);
    // Implement view logic
  };

  const filteredProducts = products.filter(product => {
    if (statusFilter !== 'all' && product.status !== statusFilter) return false;
    if (categoryFilter !== 'all' && product.category !== categoryFilter) return false;
    if (searchQuery && !product.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  return (
    <div>
      <div className="mb-4">
        <p className="text-sm text-gray-600 mb-4">Manage your product and service catalog</p>
        
        {/* Filters */}
        <div className="flex items-center gap-3 mb-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">Status</span>
            <select 
              className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="out-of-stock">Out of Stock</option>
            </select>
          </div>
          
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">Category</span>
            <select 
              className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              <option value="all">All Categories</option>
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          <div className="flex-1" />

          <div className="relative">
            <input
              type="text"
              placeholder="Search"
              className="pl-3 pr-4 py-1.5 border border-gray-200 rounded-lg text-sm w-64"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <Button variant="outline" className="text-sm">
            Sort-by
          </Button>
          <Button variant="outline" className="text-sm">
            Bulk Actions
          </Button>
          <Button variant="outline" className="text-sm">
            Filters
          </Button>
        </div>
      </div>

      {/* Table Header */}
      <div className="grid grid-cols-12 gap-4 px-4 py-2 bg-gray-50 rounded-lg text-xs text-gray-600 mb-2">
        <div className="col-span-3">Product / Service</div>
        <div className="col-span-2">Category</div>
        <div className="col-span-2">Price</div>
        <div className="col-span-1">Stock</div>
        <div className="col-span-2">Status</div>
        <div className="col-span-2">Actions</div>
      </div>

      {/* Products List */}
      <div className="space-y-2">
        {loading ? (
          <div className="text-center py-12 text-gray-500">
            <div className="text-sm">Loading products...</div>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <div className="text-sm">No products found</div>
            <Button 
              className="mt-4 bg-[#FF8C42] hover:bg-[#FF7A2E]"
              onClick={() => setShowCreateModal(true)}
            >
              Create First Product
            </Button>
          </div>
        ) : (
          filteredProducts.map((product) => (
            <div key={product.id} className="grid grid-cols-12 gap-4 px-4 py-3 bg-white rounded-lg border border-gray-200 items-center hover:bg-gray-50">
              <div className="col-span-3">
                <div className="text-sm">{product.name}</div>
                <div className="text-xs text-gray-500">SKU: {product.sku} | ⭐ {product.rating} Rating</div>
              </div>
              
              <div className="col-span-2">
                <div className="text-sm">{product.category}</div>
              </div>
              
              <div className="col-span-2">
                <div className="text-sm">₹{product.price.toLocaleString('en-IN')}</div>
              </div>
              
              <div className="col-span-1">
                <div className={`text-sm ${product.stock === 0 ? 'text-red-600' : ''}`}>
                  {product.stock === '∞' ? '∞' : product.stock}
                </div>
              </div>
              
              <div className="col-span-2">
                <span className={`inline-block px-3 py-1 rounded-full text-xs ${
                  product.status === 'active' 
                    ? 'bg-green-100 text-green-700 border border-green-200' 
                    : 'bg-red-100 text-red-700 border border-red-200'
                }`}>
                  {product.status === 'active' ? 'Active' : 'Out of Stock'}
                </span>
              </div>
              
              <div className="col-span-2 flex items-center gap-2">
                <button 
                  onClick={() => handleView(product.id)}
                  className="p-1.5 hover:bg-blue-50 rounded"
                >
                  <Eye className="w-4 h-4 text-blue-600" />
                </button>
                <button 
                  onClick={() => handleEdit(product)}
                  className="p-1.5 hover:bg-green-50 rounded"
                >
                  <Edit className="w-4 h-4 text-green-600" />
                </button>
                <button 
                  onClick={() => handleDelete(product.id)}
                  className="p-1.5 hover:bg-red-50 rounded"
                >
                  <Trash2 className="w-4 h-4 text-red-600" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modals */}
      <CreateProductServiceModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={() => {
          setShowCreateModal(false);
          loadProducts();
        }}
        categories={categories}
      />

      <EditProductServiceModal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setSelectedProduct(null);
        }}
        onSuccess={() => {
          setShowEditModal(false);
          setSelectedProduct(null);
          loadProducts();
        }}
        product={selectedProduct}
        categories={categories}
      />

      {/* Floating Add Button */}
      <button 
        onClick={() => setShowCreateModal(true)}
        className="fixed bottom-8 right-8 w-14 h-14 bg-[#FF8C42] hover:bg-[#FF7A2E] rounded-full flex items-center justify-center shadow-lg z-10"
      >
        <Plus className="w-6 h-6 text-white" />
      </button>
    </div>
  );
}
