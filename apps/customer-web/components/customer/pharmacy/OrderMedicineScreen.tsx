"use client";

import { useState, useEffect } from 'react';
import { 
  MapPin, Package, Clock, CreditCard, Wallet, ChevronRight, 
  Plus, Minus, Trash2, Search, ArrowLeft, CheckCircle, Loader2,
  Navigation, AlertCircle
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';

interface MedicineItem {
  medicine_name: string;
  quantity: number;
  unit_price: number;
}

interface DeliveryAddress {
  address: string;
  lat: number;
  lng: number;
  landmark?: string;
  pincode?: string;
}

interface OrderMedicineScreenProps {
  customerId: string;
  prescriptionId?: string;
  initialItems?: MedicineItem[];
  onBack?: () => void;
  onOrderPlaced?: (orderId: string) => void;
}

export function OrderMedicineScreen({ 
  customerId, 
  prescriptionId, 
  initialItems = [],
  onBack,
  onOrderPlaced 
}: OrderMedicineScreenProps) {
  const [step, setStep] = useState<'items' | 'address' | 'payment' | 'searching' | 'confirmed'>('items');
  const [items, setItems] = useState<MedicineItem[]>(initialItems);
  const [newItem, setNewItem] = useState({ medicine_name: '', quantity: 1, unit_price: 0 });
  const [address, setAddress] = useState<DeliveryAddress | null>(null);
  const [addressInput, setAddressInput] = useState('');
  const [landmark, setLandmark] = useState('');
  const [pincode, setPincode] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'online' | 'cod'>('online');
  const [logisticsType, setLogisticsType] = useState<'own' | 'warmpawz'>('warmpawz');
  const [loading, setLoading] = useState(false);
  const [detectingLocation, setDetectingLocation] = useState(false);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [orderStatus, setOrderStatus] = useState<string>('');
  const [searchTimeout, setSearchTimeout] = useState(120); // 2 minutes

  // Calculate totals
  const subtotal = items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
  const estimatedDeliveryFee = 50; // Will be updated by pharmacy
  const platformFee = Math.round(subtotal * 0.02);
  const total = subtotal + estimatedDeliveryFee + platformFee;

  // Detect current location
  const detectLocation = () => {
    setDetectingLocation(true);
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          
          // Reverse geocode (using a simple approach, ideally use Google Maps API)
          try {
            // For now, just set coordinates
            setAddress({
              address: addressInput || 'Current Location',
              lat: latitude,
              lng: longitude,
              landmark,
              pincode,
            });
            toast.success('Location detected!');
          } catch (error) {
            toast.error('Could not get address from location');
          }
          setDetectingLocation(false);
        },
        (error) => {
          toast.error('Could not detect location. Please enter manually.');
          setDetectingLocation(false);
        }
      );
    } else {
      toast.error('Geolocation not supported');
      setDetectingLocation(false);
    }
  };

  // Add item to order
  const addItem = () => {
    if (!newItem.medicine_name || newItem.unit_price <= 0) {
      toast.error('Please enter medicine name and price');
      return;
    }
    setItems([...items, { ...newItem }]);
    setNewItem({ medicine_name: '', quantity: 1, unit_price: 0 });
  };

  // Update item quantity
  const updateQuantity = (index: number, delta: number) => {
    const updated = [...items];
    updated[index].quantity = Math.max(1, updated[index].quantity + delta);
    setItems(updated);
  };

  // Remove item
  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  // Place order
  const placeOrder = async () => {
    if (items.length === 0) {
      toast.error('Please add at least one item');
      return;
    }
    if (!address || !address.lat || !address.lng) {
      toast.error('Please set delivery address with location');
      return;
    }

    setLoading(true);
    try {
      const response = await apiClient.post('/pharmacy/orders/create', {
        customerId,
        prescriptionId,
        items,
        deliveryAddress: {
          address: addressInput,
          lat: address.lat,
          lng: address.lng,
          landmark,
          pincode,
        },
        paymentMethod,
        logisticsType,
      }) as any;

      if (response.success) {
        setOrderId(response.order.id);
        setStep('searching');
        toast.success('Order placed! Searching for nearby pharmacies...');
        
        // Start polling for order status
        pollOrderStatus(response.order.id);
      } else {
        toast.error(response.error || 'Failed to place order');
      }
    } catch (error) {
      toast.error('Failed to place order');
    } finally {
      setLoading(false);
    }
  };

  // Poll order status
  const pollOrderStatus = async (id: string) => {
    const poll = setInterval(async () => {
      try {
        const response = await apiClient.get(`/pharmacy/orders/${id}`) as any;
        if (response.success) {
          setOrderStatus(response.order.status);
          
          if (response.order.status === 'accepted') {
            clearInterval(poll);
            setStep('confirmed');
            toast.success('🎉 Pharmacy accepted your order!');
            onOrderPlaced?.(id);
          } else if (response.order.status === 'cancelled') {
            clearInterval(poll);
            toast.error('No pharmacy found nearby. Order cancelled.');
            setStep('items');
          }
        }
      } catch (error) {
        console.error('Error polling order:', error);
      }
    }, 3000);

    // Timeout after 2 minutes
    setTimeout(() => {
      clearInterval(poll);
      if (step === 'searching') {
        toast.error('Taking longer than expected. Check order status in My Orders.');
      }
    }, 120000);
  };

  // Countdown timer for search
  useEffect(() => {
    if (step === 'searching' && searchTimeout > 0) {
      const timer = setInterval(() => {
        setSearchTimeout(t => t - 1);
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [step, searchTimeout]);

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <div className="bg-gradient-to-r from-green-600 to-teal-600 text-white p-4 sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-2 hover:bg-white/10 rounded-full">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="font-bold text-lg">Order Medicine</h1>
            <p className="text-sm text-white/80">
              {step === 'items' && 'Add your medicines'}
              {step === 'address' && 'Set delivery address'}
              {step === 'payment' && 'Choose payment method'}
              {step === 'searching' && 'Finding pharmacy...'}
              {step === 'confirmed' && 'Order confirmed!'}
            </p>
          </div>
        </div>
      </div>

      {/* Progress Steps */}
      <div className="px-4 py-3 bg-white border-b flex items-center justify-between">
        {['items', 'address', 'payment'].map((s, i) => (
          <div key={s} className="flex items-center">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
              step === s ? 'bg-green-500 text-white' :
              ['items', 'address', 'payment'].indexOf(step) > i ? 'bg-green-100 text-green-600' :
              'bg-gray-100 text-gray-400'
            }`}>
              {['items', 'address', 'payment'].indexOf(step) > i ? '✓' : i + 1}
            </div>
            {i < 2 && <div className="w-16 h-0.5 mx-1 bg-gray-200" />}
          </div>
        ))}
      </div>

      {/* Step 1: Items */}
      {step === 'items' && (
        <div className="p-4 space-y-4">
          {/* Add Item Form */}
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <h3 className="font-semibold text-gray-900 mb-3">Add Medicine</h3>
            <div className="space-y-3">
              <input
                type="text"
                placeholder="Medicine name"
                value={newItem.medicine_name}
                onChange={(e) => setNewItem({ ...newItem, medicine_name: e.target.value })}
                className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-xs text-gray-500">Quantity</label>
                  <div className="flex items-center border border-gray-200 rounded-xl">
                    <button 
                      onClick={() => setNewItem({ ...newItem, quantity: Math.max(1, newItem.quantity - 1) })}
                      className="p-3 hover:bg-gray-50"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <span className="flex-1 text-center font-medium">{newItem.quantity}</span>
                    <button 
                      onClick={() => setNewItem({ ...newItem, quantity: newItem.quantity + 1 })}
                      className="p-3 hover:bg-gray-50"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div className="flex-1">
                  <label className="text-xs text-gray-500">Est. Price (₹)</label>
                  <input
                    type="number"
                    placeholder="0"
                    value={newItem.unit_price || ''}
                    onChange={(e) => setNewItem({ ...newItem, unit_price: parseFloat(e.target.value) || 0 })}
                    className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500"
                  />
                </div>
              </div>
              <button
                onClick={addItem}
                className="w-full py-3 bg-green-50 text-green-600 rounded-xl font-medium flex items-center justify-center gap-2 hover:bg-green-100"
              >
                <Plus className="w-5 h-5" />
                Add Item
              </button>
            </div>
          </div>

          {/* Items List */}
          {items.length > 0 && (
            <div className="bg-white rounded-2xl p-4 shadow-sm">
              <h3 className="font-semibold text-gray-900 mb-3">Your Items ({items.length})</h3>
              <div className="space-y-3">
                {items.map((item, index) => (
                  <div key={index} className="flex items-center justify-between py-2 border-b last:border-0">
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{item.medicine_name}</p>
                      <p className="text-sm text-gray-500">₹{item.unit_price} x {item.quantity}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1">
                        <button 
                          onClick={() => updateQuantity(index, -1)}
                          className="p-1.5 bg-gray-100 rounded-lg"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="w-6 text-center text-sm">{item.quantity}</span>
                        <button 
                          onClick={() => updateQuantity(index, 1)}
                          className="p-1.5 bg-gray-100 rounded-lg"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                      <button onClick={() => removeItem(index)} className="p-1.5 text-red-500">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Step 2: Address */}
      {step === 'address' && (
        <div className="p-4 space-y-4">
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <h3 className="font-semibold text-gray-900 mb-3">Delivery Address</h3>
            
            {/* Detect Location Button */}
            <button
              onClick={detectLocation}
              disabled={detectingLocation}
              className="w-full py-3 px-4 border-2 border-dashed border-green-300 rounded-xl text-green-600 font-medium flex items-center justify-center gap-2 hover:bg-green-50 mb-4 disabled:opacity-50"
            >
              {detectingLocation ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Navigation className="w-5 h-5" />
              )}
              Use Current Location
            </button>

            <div className="space-y-3">
              <div>
                <label className="text-sm text-gray-600 mb-1 block">Full Address *</label>
                <textarea
                  placeholder="Enter your complete address..."
                  value={addressInput}
                  onChange={(e) => setAddressInput(e.target.value)}
                  rows={3}
                  className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 resize-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm text-gray-600 mb-1 block">Landmark</label>
                  <input
                    type="text"
                    placeholder="Near..."
                    value={landmark}
                    onChange={(e) => setLandmark(e.target.value)}
                    className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500"
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-600 mb-1 block">Pincode *</label>
                  <input
                    type="text"
                    placeholder="560001"
                    value={pincode}
                    onChange={(e) => setPincode(e.target.value)}
                    className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500"
                  />
                </div>
              </div>
            </div>

            {address && (
              <div className="mt-4 p-3 bg-green-50 rounded-xl flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <span className="text-sm text-green-700">Location set successfully</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Step 3: Payment */}
      {step === 'payment' && (
        <div className="p-4 space-y-4">
          {/* Payment Method */}
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <h3 className="font-semibold text-gray-900 mb-3">Payment Method</h3>
            <div className="space-y-2">
              <button
                onClick={() => setPaymentMethod('online')}
                className={`w-full p-4 rounded-xl border-2 flex items-center gap-4 transition-colors ${
                  paymentMethod === 'online'
                    ? 'border-green-500 bg-green-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                  <CreditCard className="w-6 h-6 text-blue-600" />
                </div>
                <div className="text-left flex-1">
                  <p className="font-medium">Pay Online</p>
                  <p className="text-sm text-gray-500">UPI, Cards, Wallets</p>
                </div>
                {paymentMethod === 'online' && <CheckCircle className="w-5 h-5 text-green-500" />}
              </button>

              <button
                onClick={() => setPaymentMethod('cod')}
                className={`w-full p-4 rounded-xl border-2 flex items-center gap-4 transition-colors ${
                  paymentMethod === 'cod'
                    ? 'border-green-500 bg-green-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center">
                  <Wallet className="w-6 h-6 text-yellow-600" />
                </div>
                <div className="text-left flex-1">
                  <p className="font-medium">Cash on Delivery</p>
                  <p className="text-sm text-gray-500">Pay when you receive</p>
                </div>
                {paymentMethod === 'cod' && <CheckCircle className="w-5 h-5 text-green-500" />}
              </button>
            </div>
          </div>

          {/* Order Summary */}
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <h3 className="font-semibold text-gray-900 mb-3">Order Summary</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Items ({items.length})</span>
                <span>₹{subtotal}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Delivery Fee (Est.)</span>
                <span>₹{estimatedDeliveryFee}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Platform Fee</span>
                <span>₹{platformFee}</span>
              </div>
              <div className="border-t pt-2 flex justify-between font-semibold">
                <span>Total</span>
                <span className="text-green-600">₹{total}</span>
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              * Final amount may vary based on pharmacy pricing
            </p>
          </div>
        </div>
      )}

      {/* Step 4: Searching */}
      {step === 'searching' && (
        <div className="flex flex-col items-center justify-center py-16 px-4">
          <div className="relative mb-6">
            <div className="w-32 h-32 rounded-full border-4 border-green-500 border-t-transparent animate-spin" />
            <div className="absolute inset-0 flex items-center justify-center">
              <Package className="w-12 h-12 text-green-600" />
            </div>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Finding Pharmacies</h2>
          <p className="text-gray-600 text-center mb-4">
            Searching for available pharmacies near you...
          </p>
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Clock className="w-4 h-4" />
            <span>Estimated wait: {Math.floor(searchTimeout / 60)}:{(searchTimeout % 60).toString().padStart(2, '0')}</span>
          </div>
          <div className="mt-6 space-y-2 text-sm text-center">
            <p className="text-green-600">🔍 Searching within 5km...</p>
            {searchTimeout < 90 && <p className="text-orange-500">📡 Expanding to 10km...</p>}
            {searchTimeout < 30 && <p className="text-red-500">📡 Expanding to 20km...</p>}
          </div>
        </div>
      )}

      {/* Step 5: Confirmed */}
      {step === 'confirmed' && (
        <div className="flex flex-col items-center justify-center py-16 px-4">
          <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mb-6">
            <CheckCircle className="w-12 h-12 text-green-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Order Confirmed!</h2>
          <p className="text-gray-600 text-center mb-6">
            A pharmacy has accepted your order and is preparing it.
          </p>
          <button
            onClick={() => onOrderPlaced?.(orderId!)}
            className="w-full max-w-xs py-3 bg-green-500 text-white rounded-xl font-medium"
          >
            Track Order
          </button>
        </div>
      )}

      {/* Bottom Action Bar */}
      {step !== 'searching' && step !== 'confirmed' && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-4 shadow-lg">
          {step === 'items' && (
            <button
              onClick={() => items.length > 0 ? setStep('address') : toast.error('Add at least one item')}
              disabled={items.length === 0}
              className="w-full py-4 bg-green-500 hover:bg-green-600 text-white rounded-xl font-semibold flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Continue
              <ChevronRight className="w-5 h-5" />
            </button>
          )}
          {step === 'address' && (
            <div className="flex gap-3">
              <button
                onClick={() => setStep('items')}
                className="flex-1 py-4 border border-gray-300 rounded-xl font-medium"
              >
                Back
              </button>
              <button
                onClick={() => {
                  if (!addressInput || !pincode || !address?.lat) {
                    toast.error('Please enter address and enable location');
                    return;
                  }
                  setStep('payment');
                }}
                className="flex-1 py-4 bg-green-500 hover:bg-green-600 text-white rounded-xl font-semibold"
              >
                Continue
              </button>
            </div>
          )}
          {step === 'payment' && (
            <div className="flex gap-3">
              <button
                onClick={() => setStep('address')}
                className="flex-1 py-4 border border-gray-300 rounded-xl font-medium"
              >
                Back
              </button>
              <button
                onClick={placeOrder}
                disabled={loading}
                className="flex-1 py-4 bg-green-500 hover:bg-green-600 text-white rounded-xl font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  `Place Order • ₹${total}`
                )}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
