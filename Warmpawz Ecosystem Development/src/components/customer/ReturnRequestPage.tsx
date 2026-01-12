/**
 * RETURN REQUEST PAGE - COMPLETE IMPLEMENTATION
 * 
 * Features:
 * - Request product returns
 * - Photo evidence upload
 * - Return tracking
 * - Return history
 * - 7-day return window validation
 * 
 * Status: ✅ P0 IMPLEMENTATION
 */

import React, { useState, useEffect } from 'react';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import { Package, Camera, Upload, Clock, CheckCircle, XCircle, Truck, RefreshCw, AlertCircle, ChevronRight } from 'lucide-react';

interface OrderItem {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  price: number;
  imageUrl?: string;
}

interface Order {
  id: string;
  items: OrderItem[];
  orderDate: string;
  totalAmount: number;
  status: string;
  deliveryStatus?: string;
}

interface ReturnRequest {
  id: string;
  orderId: string;
  customerId: string;
  items: {
    productId: string;
    productName: string;
    quantity: number;
    price: number;
  }[];
  reason: string;
  photoEvidence?: string[];
  method: 'pickup' | 'drop';
  status: 'requested' | 'approved' | 'rejected' | 'picked_up' | 'completed';
  requestedAt: string;
  completedAt?: string;
  refundAmount: number;
}

interface ReturnRequestPageProps {
  customerId: string;
  orderId?: string; // If returning specific order
}

export function ReturnRequestPage({ customerId, orderId: initialOrderId }: ReturnRequestPageProps) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [returns, setReturns] = useState<ReturnRequest[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [returnReason, setReturnReason] = useState('');
  const [returnMethod, setReturnMethod] = useState<'pickup' | 'drop'>('pickup');
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [activeTab, setActiveTab] = useState<'orders' | 'returns'>('orders');

  useEffect(() => {
    loadOrders();
    loadReturns();
  }, [customerId]);

  const loadOrders = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/customers/${customerId}/orders?status=delivered`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        throw new Error('Failed to load orders');
      }

      const data = await response.json();
      setOrders(data.orders || []);

      if (initialOrderId) {
        const order = (data.orders || []).find((o: Order) => o.id === initialOrderId);
        if (order) {
          setSelectedOrder(order);
          setShowForm(true);
        }
      }
    } catch (err) {
      console.error('Error loading orders:', err);
      setError('Failed to load orders');
    } finally {
      setLoading(false);
    }
  };

  const loadReturns = async () => {
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/customers/${customerId}/returns`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        throw new Error('Failed to load returns');
      }

      const data = await response.json();
      setReturns(data.returns || []);
    } catch (err) {
      console.error('Error loading returns:', err);
    }
  };

  const canReturnOrder = (order: Order): { canReturn: boolean; reason?: string } => {
    // Check if order is delivered
    if (order.deliveryStatus !== 'delivered' && order.status !== 'delivered') {
      return { canReturn: false, reason: 'Order not yet delivered' };
    }

    // Check 7-day window
    const orderDate = new Date(order.orderDate);
    const daysSinceOrder = Math.floor((Date.now() - orderDate.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysSinceOrder > 7) {
      return { canReturn: false, reason: 'Return window expired (7 days)' };
    }

    // Check if already returned
    const existingReturn = returns.find(r => r.orderId === order.id && r.status !== 'rejected');
    if (existingReturn) {
      return { canReturn: false, reason: 'Return already requested' };
    }

    return { canReturn: true };
  };

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    
    if (photoFiles.length + files.length > 5) {
      setError('Maximum 5 photos allowed');
      return;
    }

    setPhotoFiles(prev => [...prev, ...files]);

    // Create previews
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = (e) => {
        setPhotoPreviews(prev => [...prev, e.target?.result as string]);
      };
      reader.readAsDataURL(file);
    });
  };

  const removePhoto = (index: number) => {
    setPhotoFiles(prev => prev.filter((_, i) => i !== index));
    setPhotoPreviews(prev => prev.filter((_, i) => i !== index));
  };

  const toggleItemSelection = (itemId: string) => {
    setSelectedItems(prev => {
      if (prev.includes(itemId)) {
        return prev.filter(id => id !== itemId);
      } else {
        return [...prev, itemId];
      }
    });
  };

  const submitReturnRequest = async () => {
    if (!selectedOrder || selectedItems.length === 0) {
      setError('Please select items to return');
      return;
    }

    if (!returnReason.trim()) {
      setError('Please provide a reason for return');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      // Convert photos to base64
      const photoBase64s: string[] = [];
      for (const file of photoFiles) {
        const base64 = await fileToBase64(file);
        photoBase64s.push(base64);
      }

      const selectedItemsData = selectedOrder.items.filter(item => 
        selectedItems.includes(item.id)
      );

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/orders/${selectedOrder.id}/return/request`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            customerId,
            items: selectedItemsData.map(item => ({
              productId: item.productId,
              productName: item.productName,
              quantity: item.quantity,
              price: item.price
            })),
            reason: returnReason,
            photoEvidence: photoBase64s,
            method: returnMethod
          })
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to submit return request');
      }

      const data = await response.json();

      // Success!
      alert(`✅ Return request submitted successfully!\n\nReturn ID: ${data.returnId}\nRefund: ₹${data.refundAmount}`);
      
      resetForm();
      setShowForm(false);
      await loadReturns();
      setActiveTab('returns');
    } catch (err: any) {
      console.error('Error submitting return:', err);
      setError(err.message || 'Failed to submit return request');
    } finally {
      setSubmitting(false);
    }
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
    });
  };

  const resetForm = () => {
    setSelectedOrder(null);
    setSelectedItems([]);
    setReturnReason('');
    setReturnMethod('pickup');
    setPhotoFiles([]);
    setPhotoPreviews([]);
    setError(null);
  };

  const getReturnStatusIcon = (status: string) => {
    switch (status) {
      case 'requested':
        return <Clock className="w-5 h-5 text-yellow-600" />;
      case 'approved':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'rejected':
        return <XCircle className="w-5 h-5 text-red-600" />;
      case 'picked_up':
        return <Truck className="w-5 h-5 text-blue-600" />;
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      default:
        return <RefreshCw className="w-5 h-5 text-gray-600" />;
    }
  };

  const getReturnStatusColor = (status: string) => {
    switch (status) {
      case 'requested':
        return 'bg-yellow-50 border-yellow-200 text-yellow-700';
      case 'approved':
        return 'bg-green-50 border-green-200 text-green-700';
      case 'rejected':
        return 'bg-red-50 border-red-200 text-red-700';
      case 'picked_up':
        return 'bg-blue-50 border-blue-200 text-blue-700';
      case 'completed':
        return 'bg-green-50 border-green-200 text-green-700';
      default:
        return 'bg-gray-50 border-gray-200 text-gray-700';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  if (showForm && selectedOrder) {
    const returnCheck = canReturnOrder(selectedOrder);
    
    return (
      <div className="min-h-screen bg-gray-50 p-4 pb-24">
        {/* Header */}
        <div className="bg-white rounded-xl p-4 shadow-sm mb-6">
          <button
            onClick={() => {
              setShowForm(false);
              resetForm();
            }}
            className="text-orange-600 hover:text-orange-700 mb-2"
          >
            ← Back to Orders
          </button>
          <h1 className="text-2xl font-bold text-gray-900">Return Request</h1>
          <p className="text-sm text-gray-600 mt-1">
            Order #{selectedOrder.id.slice(0, 8)}
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 flex items-start gap-2">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {!returnCheck.canReturn && (
          <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 px-4 py-3 rounded-lg mb-4">
            ⚠️ {returnCheck.reason}
          </div>
        )}

        {/* Select Items */}
        <div className="bg-white rounded-xl p-4 shadow-sm mb-6">
          <h3 className="font-semibold text-gray-900 mb-4">Select Items to Return</h3>
          
          <div className="space-y-3">
            {selectedOrder.items.map((item) => {
              const isSelected = selectedItems.includes(item.id);
              
              return (
                <button
                  key={item.id}
                  onClick={() => toggleItemSelection(item.id)}
                  disabled={!returnCheck.canReturn}
                  className={`w-full border-2 rounded-lg p-3 transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                    isSelected
                      ? 'border-orange-500 bg-orange-50'
                      : 'border-gray-200 hover:border-orange-300'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                      isSelected
                        ? 'border-orange-500 bg-orange-500'
                        : 'border-gray-300'
                    }`}>
                      {isSelected && <CheckCircle className="w-4 h-4 text-white" />}
                    </div>

                    {item.imageUrl && (
                      <img 
                        src={item.imageUrl} 
                        alt={item.productName}
                        className="w-16 h-16 rounded object-cover"
                      />
                    )}

                    <div className="flex-1 text-left">
                      <div className="font-medium text-gray-900">{item.productName}</div>
                      <div className="text-sm text-gray-600">Qty: {item.quantity}</div>
                    </div>

                    <div className="text-right">
                      <div className="font-semibold text-gray-900">₹{item.price * item.quantity}</div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Return Reason */}
        <div className="bg-white rounded-xl p-4 shadow-sm mb-6">
          <h3 className="font-semibold text-gray-900 mb-4">Reason for Return *</h3>
          
          <select
            value={returnReason}
            onChange={(e) => setReturnReason(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-4 py-3 mb-3 focus:outline-none focus:ring-2 focus:ring-orange-500"
          >
            <option value="">Select a reason</option>
            <option value="defective">Product is defective</option>
            <option value="wrong_item">Wrong item received</option>
            <option value="not_as_described">Not as described</option>
            <option value="damaged">Damaged during shipping</option>
            <option value="expired">Product expired</option>
            <option value="other">Other reason</option>
          </select>
        </div>

        {/* Photo Evidence */}
        <div className="bg-white rounded-xl p-4 shadow-sm mb-6">
          <h3 className="font-semibold text-gray-900 mb-2">Photo Evidence</h3>
          <p className="text-sm text-gray-600 mb-4">Upload photos of the product (optional, max 5)</p>
          
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
            <input
              type="file"
              onChange={handlePhotoSelect}
              accept="image/*"
              multiple
              className="hidden"
              id="photo-upload"
            />
            <label
              htmlFor="photo-upload"
              className="cursor-pointer flex flex-col items-center"
            >
              <Camera className="w-12 h-12 text-gray-400 mb-2" />
              <p className="text-sm text-gray-600">Click to upload photos</p>
              <p className="text-xs text-gray-400 mt-1">JPG, PNG (Max 5 photos)</p>
            </label>
          </div>

          {photoPreviews.length > 0 && (
            <div className="grid grid-cols-3 gap-3 mt-4">
              {photoPreviews.map((preview, index) => (
                <div key={index} className="relative">
                  <img 
                    src={preview} 
                    alt={`Evidence ${index + 1}`}
                    className="w-full h-24 object-cover rounded-lg"
                  />
                  <button
                    onClick={() => removePhoto(index)}
                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1"
                  >
                    <XCircle className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Return Method */}
        <div className="bg-white rounded-xl p-4 shadow-sm mb-6">
          <h3 className="font-semibold text-gray-900 mb-4">Return Method</h3>
          
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setReturnMethod('pickup')}
              className={`border-2 rounded-lg p-4 transition-all ${
                returnMethod === 'pickup'
                  ? 'border-orange-500 bg-orange-50'
                  : 'border-gray-200 hover:border-orange-300'
              }`}
            >
              <Truck className="w-8 h-8 mx-auto mb-2 text-gray-700" />
              <div className="font-medium text-gray-900">Pickup</div>
              <div className="text-xs text-gray-600 mt-1">We'll collect</div>
            </button>

            <button
              onClick={() => setReturnMethod('drop')}
              className={`border-2 rounded-lg p-4 transition-all ${
                returnMethod === 'drop'
                  ? 'border-orange-500 bg-orange-50'
                  : 'border-gray-200 hover:border-orange-300'
              }`}
            >
              <Package className="w-8 h-8 mx-auto mb-2 text-gray-700" />
              <div className="font-medium text-gray-900">Drop-off</div>
              <div className="text-xs text-gray-600 mt-1">You'll ship</div>
            </button>
          </div>
        </div>

        {/* Fixed Bottom Bar */}
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 shadow-lg">
          <div className="max-w-md mx-auto">
            {selectedItems.length > 0 && (
              <div className="flex items-center justify-between mb-3 text-sm">
                <span className="text-gray-600">
                  {selectedItems.length} {selectedItems.length === 1 ? 'item' : 'items'} selected
                </span>
                <span className="font-bold text-orange-600">
                  Refund: ₹{selectedOrder.items
                    .filter(item => selectedItems.includes(item.id))
                    .reduce((sum, item) => sum + (item.price * item.quantity), 0)}
                </span>
              </div>
            )}
            
            <button
              onClick={submitReturnRequest}
              disabled={selectedItems.length === 0 || !returnReason || submitting || !returnCheck.canReturn}
              className="w-full bg-orange-500 hover:bg-orange-600 text-white py-3 rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  Submitting...
                </>
              ) : (
                <>
                  Submit Return Request
                  <ChevronRight className="w-5 h-5" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 pb-20">
      {/* Header */}
      <div className="bg-white rounded-xl p-4 shadow-sm mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Returns & Refunds</h1>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setActiveTab('orders')}
          className={`flex-1 py-3 rounded-lg font-medium transition-colors ${
            activeTab === 'orders'
              ? 'bg-orange-500 text-white'
              : 'bg-white text-gray-700 hover:bg-gray-50'
          }`}
        >
          My Orders
        </button>
        <button
          onClick={() => setActiveTab('returns')}
          className={`flex-1 py-3 rounded-lg font-medium transition-colors ${
            activeTab === 'returns'
              ? 'bg-orange-500 text-white'
              : 'bg-white text-gray-700 hover:bg-gray-50'
          }`}
        >
          My Returns ({returns.length})
        </button>
      </div>

      {/* Orders Tab */}
      {activeTab === 'orders' && (
        <div className="space-y-4">
          {orders.length === 0 ? (
            <div className="bg-white rounded-xl p-8 text-center">
              <Package className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <p className="text-gray-500">No delivered orders</p>
            </div>
          ) : (
            orders.map((order) => {
              const returnCheck = canReturnOrder(order);
              
              return (
                <div key={order.id} className="bg-white rounded-xl p-4 shadow-sm">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="font-medium text-gray-900">Order #{order.id.slice(0, 8)}</div>
                      <div className="text-sm text-gray-600">
                        {new Date(order.orderDate).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric'
                        })}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-gray-900">₹{order.totalAmount}</div>
                      <div className="text-xs text-gray-500">{order.items.length} items</div>
                    </div>
                  </div>

                  {returnCheck.canReturn ? (
                    <button
                      onClick={() => {
                        setSelectedOrder(order);
                        setShowForm(true);
                      }}
                      className="w-full bg-orange-500 hover:bg-orange-600 text-white py-2 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                    >
                      <RefreshCw className="w-4 h-4" />
                      Request Return
                    </button>
                  ) : (
                    <div className="text-sm text-gray-500 text-center py-2">
                      {returnCheck.reason}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Returns Tab */}
      {activeTab === 'returns' && (
        <div className="space-y-4">
          {returns.length === 0 ? (
            <div className="bg-white rounded-xl p-8 text-center">
              <RefreshCw className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <p className="text-gray-500">No return requests</p>
            </div>
          ) : (
            returns.map((returnReq) => (
              <div key={returnReq.id} className="bg-white rounded-xl p-4 shadow-sm">
                <div className="flex items-start gap-3 mb-3">
                  {getReturnStatusIcon(returnReq.status)}
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <div className="font-medium text-gray-900">Return #{returnReq.id.slice(0, 8)}</div>
                      <span className={`text-xs px-2 py-1 rounded-full border ${getReturnStatusColor(returnReq.status)}`}>
                        {returnReq.status.replace('_', ' ').toUpperCase()}
                      </span>
                    </div>
                    <div className="text-sm text-gray-600 mb-2">
                      Order #{returnReq.orderId.slice(0, 8)}
                    </div>
                    <div className="text-sm text-gray-700">
                      <div>Items: {returnReq.items.length}</div>
                      <div>Refund: ₹{returnReq.refundAmount}</div>
                      <div>Method: {returnReq.method === 'pickup' ? 'Pickup' : 'Drop-off'}</div>
                    </div>
                  </div>
                </div>

                <div className="text-xs text-gray-500 pt-3 border-t border-gray-100">
                  Requested: {new Date(returnReq.requestedAt).toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export default ReturnRequestPage;
