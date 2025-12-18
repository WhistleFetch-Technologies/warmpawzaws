import React, { useState, useEffect } from 'react';
import { Package, Plus, Edit, Trash } from 'lucide-react';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import { Button } from '../ui/button';

/**
 * 🍽️ FOOD DELIVERY VENDOR MANAGEMENT
 * Phase 7B: Rule 8 - Vendor menu & order management
 */

export default function FoodDeliveryManagement({ vendorId }: { vendorId: string }) {
  const [menuItems, setMenuItems] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'menu' | 'orders'>('menu');
  const [showAddItem, setShowAddItem] = useState(false);
  const [itemForm, setItemForm] = useState({
    itemName: '',
    description: '',
    category: 'dog_food',
    price: '',
    preparationTime: '15',
  });

  useEffect(() => {
    fetchMenu();
    fetchOrders();
  }, [vendorId]);

  const fetchMenu = async () => {
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/food-delivery/menu/${vendorId}`,
        { headers: { Authorization: `Bearer ${publicAnonKey}` } }
      );
      const data = await response.json();
      if (data.success) setMenuItems(data.data.menu || []);
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const fetchOrders = async () => {
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/vendor/${vendorId}/food-orders`,
        { headers: { Authorization: `Bearer ${publicAnonKey}` } }
      );
      const data = await response.json();
      if (data.success) setOrders(data.data.orders || []);
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const addMenuItem = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/food-delivery/menu/item/create`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${publicAnonKey}`,
          },
          body: JSON.stringify({
            vendorId,
            ...itemForm,
            price: parseFloat(itemForm.price),
            preparationTime: parseInt(itemForm.preparationTime),
            nutritionalInfo: { calories: 0, protein: 0, fat: 0, carbs: 0 },
            ingredients: [],
          }),
        }
      );

      const data = await response.json();
      if (data.success) {
        alert('Menu item added!');
        setShowAddItem(false);
        fetchMenu();
      }
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const updateOrderStatus = async (orderId: string, status: string) => {
    try {
      await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/food-delivery/order/${orderId}/status`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${publicAnonKey}`,
          },
          body: JSON.stringify({ status }),
        }
      );
      fetchOrders();
    } catch (error) {
      console.error('Error:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-gray-900">Food Delivery Management</h1>
          {activeTab === 'menu' && (
            <Button onClick={() => setShowAddItem(true)}
              className="bg-orange-500 text-white px-6 py-3 rounded-lg hover:bg-orange-600 flex items-center gap-2"
            >
              <Plus className="w-5 h-5" />
              Add Menu Item
            </Button>
          )}
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow-sm mb-6">
          <div className="border-b border-gray-200 flex">
            <Button onClick={() => setActiveTab('menu')} className={`px-6 py-4 ${
                activeTab === 'menu' ? 'border-b-2 border-orange-500 text-orange-500' : 'text-gray-600'
              }`}
            >
              Menu Items
            </Button>
            <Button onClick={() => setActiveTab('orders')} className={`px-6 py-4 ${
                activeTab === 'orders' ? 'border-b-2 border-orange-500 text-orange-500' : 'text-gray-600'
              }`}
            >
              Orders
            </Button>
          </div>

          <div className="p-6">
            {activeTab === 'menu' && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {menuItems.map((item) => (
                  <div key={item.itemId} className="bg-gray-50 rounded-lg p-4">
                    <h3 className="text-gray-900 mb-2">{item.itemName}</h3>
                    <p className="text-gray-600 text-sm mb-3">{item.description}</p>
                    <div className="flex items-center justify-between">
                      <span className="text-orange-600">₹{item.price}</span>
                      <span className={`px-2 py-1 rounded text-xs ${
                        item.isAvailable ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {item.isAvailable ? 'Available' : 'Unavailable'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'orders' && (
              <div className="space-y-4">
                {orders.map((order) => (
                  <div key={order.orderId} className="bg-gray-50 rounded-lg p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="text-gray-900">Order #{order.orderId.slice(-8)}</h3>
                        <p className="text-gray-600 text-sm">{order.items.length} items • ₹{order.grandTotal}</p>
                      </div>
                      <select
                        value={order.status}
                        onChange={(e) => updateOrderStatus(order.orderId, e.target.value)}
                        className="border border-gray-300 rounded px-3 py-1 text-sm"
                      >
                        <option value="pending">Pending</option>
                        <option value="confirmed">Confirmed</option>
                        <option value="preparing">Preparing</option>
                        <option value="out_for_delivery">Out for Delivery</option>
                        <option value="delivered">Delivered</option>
                      </select>
                    </div>
                    <div className="text-sm text-gray-600">
                      {order.items.map((item: any, idx: number) => (
                        <div key={idx}>
                          {item.itemName} x {item.quantity}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Add Item Modal */}
        {showAddItem && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg p-6 max-w-md w-full">
              <h2 className="text-gray-900 mb-4">Add Menu Item</h2>
              <form onSubmit={addMenuItem} className="space-y-4">
                <div>
                  <label className="block text-gray-700 mb-2">Item Name</label>
                  <input
                    type="text"
                    value={itemForm.itemName}
                    onChange={(e) => setItemForm({ ...itemForm, itemName: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2"
                    required
                  />
                </div>
                <div>
                  <label className="block text-gray-700 mb-2">Description</label>
                  <textarea
                    value={itemForm.description}
                    onChange={(e) => setItemForm({ ...itemForm, description: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2"
                    rows={3}
                  />
                </div>
                <div>
                  <label className="block text-gray-700 mb-2">Category</label>
                  <select
                    value={itemForm.category}
                    onChange={(e) => setItemForm({ ...itemForm, category: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2"
                  >
                    <option value="dog_food">Dog Food</option>
                    <option value="cat_food">Cat Food</option>
                    <option value="treats">Treats</option>
                    <option value="supplements">Supplements</option>
                  </select>
                </div>
                <div>
                  <label className="block text-gray-700 mb-2">Price (₹)</label>
                  <input
                    type="number"
                    value={itemForm.price}
                    onChange={(e) => setItemForm({ ...itemForm, price: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2"
                    required
                  />
                </div>
                <div className="flex gap-3">
                  <Button type="submit" className="flex-1 bg-orange-500 text-white py-2 rounded-lg hover:bg-orange-600">
                    Add Item
                  </Button>
                  <Button
                    type="button"
                    onClick={() => setShowAddItem(false)}
                    className="flex-1 bg-gray-300 text-gray-700 py-2 rounded-lg hover:bg-gray-400"
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
