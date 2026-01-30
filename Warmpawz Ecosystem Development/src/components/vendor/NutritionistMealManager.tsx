import { useState, useEffect } from 'react';
import { ArrowLeft, Plus, Edit, Trash2, Save, Clock, Package, AlertCircle } from 'lucide-react';
import { getApiBaseUrl, getAuthHeaders } from '../../utils/api-config';
import { toast } from 'sonner';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';

interface NutritionistMealManagerProps {
  vendorId: string;
  vendorName: string;
  onBack: () => void;
}

const DIET_TYPES = ['Non-Veg', 'Veg', 'Egg'];
const SUITABLE_FOR = ['Puppy', 'Adult', 'Senior'];
const PET_TYPES = ['Dog', 'Cat'];

export function NutritionistMealManager({ vendorId, vendorName, onBack }: NutritionistMealManagerProps) {
  const [products, setProducts] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'products' | 'orders'>('products');

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    ingredients: [] as string[],
    nutritionalValue: { protein: '', fat: '', fiber: '', moisture: '', calories: '' },
    preparationMethod: '',
    preparationLeadTime: 60,
    feedingGuidelines: [] as any[],
    storageInstructions: '',
    shelfLife: '',
    price: '',
    packSize: '',
    dietType: 'Non-Veg',
    suitableFor: [] as string[],
    petTypes: ['Dog'] as string[]
  });

  const [ingredientInput, setIngredientInput] = useState('');

  useEffect(() => {
    loadData();
  }, [vendorId]);

  const loadData = async () => {
    try {
      setLoading(true);

      // Load products
      const productsRes = await fetch(
        `${getApiBaseUrl()}/vendor/${vendorId}/meal-products`,
        { headers: getAuthHeaders() }
      );

      if (productsRes.ok) {
        const data = await productsRes.json();
        setProducts(data.products || []);
      }

      // Load orders
      const ordersRes = await fetch(
        `${getApiBaseUrl()}/vendor/${vendorId}/meal-orders`,
        { headers: getAuthHeaders() }
      );

      if (ordersRes.ok) {
        const data = await ordersRes.json();
        setOrders(data.orders || []);
      }

    } catch (error) {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!formData.name || !formData.price || formData.ingredients.length === 0) {
      toast.error('Please fill required fields');
      return;
    }

    try {
      const endpoint = editingProduct
        ? `${getApiBaseUrl()}/vendor/${vendorId}/meal-products/${editingProduct.id}`
        : `${getApiBaseUrl()}/vendor/${vendorId}/meal-products`;

      const response = await fetch(endpoint, {
        method: editingProduct ? 'PUT' : 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        toast.success(editingProduct ? 'Product updated' : 'Product created');
        setShowAddProduct(false);
        setEditingProduct(null);
        resetForm();
        loadData();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Operation failed');
      }
    } catch (error) {
      toast.error('Network error');
    }
  };

  const handleDeleteProduct = async (productId: string) => {
    if (!confirm('Delete this product?')) return;

    try {
      const response = await fetch(
        `${getApiBaseUrl()}/vendor/${vendorId}/meal-products/${productId}`,
        {
          method: 'DELETE',
          headers: getAuthHeaders()
        }
      );

      if (response.ok) {
        toast.success('Product deleted');
        loadData();
      } else {
        toast.error('Failed to delete');
      }
    } catch (error) {
      toast.error('Network error');
    }
  };

  const handleUpdateOrderStatus = async (orderId: string, newStatus: string) => {
    try {
      const response = await fetch(
        `${getApiBaseUrl()}/vendor/${vendorId}/meal-orders/${orderId}/status`,
        {
          method: 'PUT',
          headers: {
            ...getAuthHeaders(),
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ status: newStatus })
        }
      );

      if (response.ok) {
        toast.success(`Order marked as ${newStatus}`);
        loadData();
      } else {
        toast.error('Failed to update status');
      }
    } catch (error) {
      toast.error('Network error');
    }
  };

  const addIngredient = () => {
    if (ingredientInput.trim()) {
      setFormData({
        ...formData,
        ingredients: [...formData.ingredients, ingredientInput.trim()]
      });
      setIngredientInput('');
    }
  };

  const removeIngredient = (index: number) => {
    setFormData({
      ...formData,
      ingredients: formData.ingredients.filter((_, i) => i !== index)
    });
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      ingredients: [],
      nutritionalValue: { protein: '', fat: '', fiber: '', moisture: '', calories: '' },
      preparationMethod: '',
      preparationLeadTime: 60,
      feedingGuidelines: [],
      storageInstructions: '',
      shelfLife: '',
      price: '',
      packSize: '',
      dietType: 'Non-Veg',
      suitableFor: [],
      petTypes: ['Dog']
    });
    setIngredientInput('');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-lg">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex-1">
              <h1 className="font-bold text-gray-900">Meal Products</h1>
              <p className="text-sm text-gray-600">{vendorName}</p>
            </div>
            {activeTab === 'products' && (
              <Button
                onClick={() => setShowAddProduct(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Product
              </Button>
            )}
          </div>

          {/* Tabs */}
          <div className="flex gap-4 mt-4">
            <button
              onClick={() => setActiveTab('products')}
              className={`px-4 py-2 rounded-lg ${
                activeTab === 'products'
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              Products ({products.length})
            </button>
            <button
              onClick={() => setActiveTab('orders')}
              className={`px-4 py-2 rounded-lg ${
                activeTab === 'orders'
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              Orders ({orders.filter(o => o.status === 'pending').length} pending)
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Products Tab */}
        {activeTab === 'products' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {products.map((product) => (
              <div key={product.id} className="bg-white rounded-xl border hover:shadow-lg transition-shadow p-6">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h3 className="font-bold text-gray-900">{product.name}</h3>
                    <p className="text-sm text-gray-600 mt-1">{product.packSize}</p>
                  </div>
                  <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs">
                    {product.dietType}
                  </span>
                </div>

                {product.description && (
                  <p className="text-sm text-gray-600 mb-3 line-clamp-2">{product.description}</p>
                )}

                <div className="mb-3">
                  <p className="text-xs text-gray-500 mb-1">Ingredients</p>
                  <div className="flex flex-wrap gap-1">
                    {product.ingredients.slice(0, 3).map((ing: string, idx: number) => (
                      <span key={idx} className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded text-xs">
                        {ing}
                      </span>
                    ))}
                    {product.ingredients.length > 3 && (
                      <span className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded text-xs">
                        +{product.ingredients.length - 3}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xs text-gray-600 mb-3">
                  <Clock className="w-3 h-3" />
                  <span>Lead time: {product.preparationLeadTime} min</span>
                </div>

                <p className="font-bold text-green-600 mb-4">₹{product.price}</p>

                <div className="flex gap-2 pt-3 border-t">
                  <button
                    onClick={() => {
                      setEditingProduct(product);
                      setFormData({
                        name: product.name,
                        description: product.description || '',
                        ingredients: product.ingredients || [],
                        nutritionalValue: product.nutritionalValue || {},
                        preparationMethod: product.preparationMethod || '',
                        preparationLeadTime: product.preparationLeadTime,
                        feedingGuidelines: product.feedingGuidelines || [],
                        storageInstructions: product.storageInstructions || '',
                        shelfLife: product.shelfLife || '',
                        price: product.price.toString(),
                        packSize: product.packSize || '',
                        dietType: product.dietType || 'Non-Veg',
                        suitableFor: product.suitableFor || [],
                        petTypes: product.petTypes || ['Dog']
                      });
                      setShowAddProduct(true);
                    }}
                    className="flex-1 py-2 border rounded-lg hover:bg-gray-50 flex items-center justify-center gap-2 text-sm"
                  >
                    <Edit className="w-4 h-4" />
                    Edit
                  </button>
                  <button
                    onClick={() => handleDeleteProduct(product.id)}
                    className="p-2 border border-red-200 rounded-lg hover:bg-red-50 text-red-600"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Orders Tab */}
        {activeTab === 'orders' && (
          <div className="space-y-4">
            {orders.map((order) => (
              <div key={order.id} className="bg-white rounded-xl border p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="font-bold text-gray-900">{order.productName}</h3>
                    <p className="text-sm text-gray-600 mt-1">
                      Order #{order.id.substring(0, 8)}
                    </p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-sm ${
                    order.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                    order.status === 'preparing' ? 'bg-blue-100 text-blue-700' :
                    order.status === 'ready' ? 'bg-green-100 text-green-700' :
                    order.status === 'out_for_delivery' ? 'bg-purple-100 text-purple-700' :
                    'bg-gray-100 text-gray-700'
                  }`}>
                    {order.status.replace('_', ' ')}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <p className="text-xs text-gray-500">Quantity</p>
                    <p className="font-medium">{order.quantity}x</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Total Amount</p>
                    <p className="font-medium">₹{order.totalAmount}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Delivery Window</p>
                    <p className="font-medium text-sm">{order.deliveryTimeWindow}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Lead Time</p>
                    <p className="font-medium">{order.preparationLeadTime} min</p>
                  </div>
                </div>

                {order.deliveryAddress && (
                  <div className="mb-4">
                    <p className="text-xs text-gray-500">Delivery Address</p>
                    <p className="text-sm text-gray-700">{order.deliveryAddress}</p>
                  </div>
                )}

                {order.specialInstructions && (
                  <div className="mb-4 p-3 bg-yellow-50 rounded-lg">
                    <p className="text-xs text-yellow-800 font-medium mb-1">Special Instructions</p>
                    <p className="text-sm text-yellow-900">{order.specialInstructions}</p>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex gap-2">
                  {order.status === 'pending' && (
                    <Button
                      onClick={() => handleUpdateOrderStatus(order.id, 'preparing')}
                      className="bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      Start Preparing
                    </Button>
                  )}
                  {order.status === 'preparing' && (
                    <Button
                      onClick={() => handleUpdateOrderStatus(order.id, 'ready')}
                      className="bg-green-600 hover:bg-green-700 text-white"
                    >
                      Mark as Ready
                    </Button>
                  )}
                  {order.status === 'ready' && (
                    <Button
                      onClick={() => handleUpdateOrderStatus(order.id, 'out_for_delivery')}
                      className="bg-purple-600 hover:bg-purple-700 text-white"
                    >
                      Dispatch for Delivery
                    </Button>
                  )}
                </div>
              </div>
            ))}

            {orders.length === 0 && (
              <div className="bg-white rounded-xl border p-12 text-center">
                <Package className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                <h3 className="font-bold text-gray-900 mb-2">No Orders Yet</h3>
                <p className="text-gray-600">Orders will appear here when customers place them</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Add/Edit Product Modal */}
      <Dialog open={showAddProduct} onOpenChange={() => { setShowAddProduct(false); setEditingProduct(null); resetForm(); }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingProduct ? 'Edit Product' : 'Add Meal Product'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-6 mt-4">
            {/* Basic Info */}
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-sm font-medium mb-2">Meal Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg"
                  placeholder="e.g., Chicken & Vegetable Fresh Meal"
                />
              </div>

              <div className="col-span-2">
                <label className="block text-sm font-medium mb-2">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg resize-none"
                  rows={3}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Pack Size</label>
                <input
                  type="text"
                  value={formData.packSize}
                  onChange={(e) => setFormData({ ...formData, packSize: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg"
                  placeholder="500g, 1kg"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Price (₹) *</label>
                <input
                  type="number"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Diet Type</label>
                <select
                  value={formData.dietType}
                  onChange={(e) => setFormData({ ...formData, dietType: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg"
                >
                  {DIET_TYPES.map(type => <option key={type} value={type}>{type}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Prep Lead Time (min)</label>
                <input
                  type="number"
                  value={formData.preparationLeadTime}
                  onChange={(e) => setFormData({ ...formData, preparationLeadTime: parseInt(e.target.value) })}
                  className="w-full px-4 py-2 border rounded-lg"
                />
              </div>
            </div>

            {/* Ingredients */}
            <div>
              <label className="block text-sm font-medium mb-2">Ingredients *</label>
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={ingredientInput}
                  onChange={(e) => setIngredientInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && addIngredient()}
                  className="flex-1 px-4 py-2 border rounded-lg"
                  placeholder="Type ingredient and press Enter"
                />
                <Button onClick={addIngredient} type="button">Add</Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {formData.ingredients.map((ing, idx) => (
                  <span key={idx} className="px-3 py-1 bg-gray-100 rounded-full text-sm flex items-center gap-2">
                    {ing}
                    <button onClick={() => removeIngredient(idx)} className="text-red-600 hover:text-red-800">
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>

            {/* Storage & Preparation */}
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-sm font-medium mb-2">Storage Instructions</label>
                <input
                  type="text"
                  value={formData.storageInstructions}
                  onChange={(e) => setFormData({ ...formData, storageInstructions: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg"
                  placeholder="Refrigerate for 24 hours"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Shelf Life</label>
                <input
                  type="text"
                  value={formData.shelfLife}
                  onChange={(e) => setFormData({ ...formData, shelfLife: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg"
                  placeholder="24 hours"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button onClick={() => { setShowAddProduct(false); setEditingProduct(null); resetForm(); }} variant="outline">
                Cancel
              </Button>
              <Button onClick={handleSubmit} className="bg-blue-600 hover:bg-blue-700 text-white">
                <Save className="w-4 h-4 mr-2" />
                {editingProduct ? 'Update' : 'Create'} Product
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
