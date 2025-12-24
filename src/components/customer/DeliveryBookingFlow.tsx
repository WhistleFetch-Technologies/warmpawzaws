/**
 * Delivery Booking Flow
 * 
 * Unified delivery booking flow for:
 * - Pharmacy (prescription-based medicine delivery)
 * - Product Store (e-commerce style product delivery)
 * - Meal Products (nutritionist meal plan delivery)
 * 
 * Features:
 * - Address selection/input
 * - Delivery time slot selection
 * - Prescription upload (for pharmacy)
 * - Cart/order review
 * - Payment integration
 * - Order tracking integration
 * 
 * Aligned with capability-specific patterns:
 * - Similar to MedicineDelivery (pharmacy)
 * - Similar to PharmacyCheckout (products)
 * - Similar to MealProductCatalog (meal plans)
 * - Integrates with VendorDeliveryManagement
 */

import { useState, useEffect } from 'react';
import { 
  ArrowLeft, 
  MapPin, 
  Clock, 
  Package, 
  Truck, 
  Upload, 
  Check, 
  Plus, 
  Minus, 
  Trash2,
  AlertCircle,
  CreditCard,
  FileText,
  ShoppingCart,
  Calendar,
  Edit,
  Search
} from 'lucide-react';

declare global {
  interface Window {
    Razorpay: any;
  }
}
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import { toast } from 'sonner@2.0.3';

interface DeliveryBookingFlowProps {
  serviceType: 'pharmacy' | 'products' | 'meals';
  vendorId: string;
  vendorName?: string;
  vendorRoleId?: string; // ✅ NEW: Role ID for role-specific features
  customerId: string;
  customerPhone: string;
  petId?: string;
  petName?: string;
  onBack: () => void;
  onNavigate?: (screen: string, data?: any) => void;
  onBookingComplete?: (orderId: string) => void;
}

interface DeliveryAddress {
  id: string;
  name: string;
  address: string;
  landmark?: string;
  city: string;
  state: string;
  pincode: string;
  phone: string;
  isDefault?: boolean;
}

interface DeliveryTimeSlot {
  id: string;
  date: string;
  time: string;
  display: string;
  available: boolean;
}

interface OrderItem {
  id: string;
  name: string;
  description?: string;
  price: number;
  quantity: number;
  image?: string;
  prescriptionRequired?: boolean;
  packSize?: string;
  dietType?: string;
}

type Step = 'select-items' | 'address' | 'time-slot' | 'prescription' | 'review' | 'payment' | 'confirmation';

export function DeliveryBookingFlow({
  serviceType,
  vendorId,
  vendorName,
  customerId,
  customerPhone,
  petId,
  petName,
  onBack,
  onNavigate,
  onBookingComplete
}: DeliveryBookingFlowProps) {
  const [step, setStep] = useState<Step>('select-items');
  const [loading, setLoading] = useState(false);
  
  // Order items (cart)
  const [items, setItems] = useState<OrderItem[]>([]);
  const [availableProducts, setAvailableProducts] = useState<OrderItem[]>([]);
  
  // Address
  const [addresses, setAddresses] = useState<DeliveryAddress[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string>('');
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [newAddress, setNewAddress] = useState<Partial<DeliveryAddress>>({
    name: '',
    address: '',
    landmark: '',
    city: '',
    state: '',
    pincode: '',
    phone: customerPhone
  });
  
  // Time slots
  const [timeSlots, setTimeSlots] = useState<DeliveryTimeSlot[]>([]);
  const [selectedTimeSlotId, setSelectedTimeSlotId] = useState<string>('');
  
  // Prescription (for pharmacy)
  const [prescriptionUploaded, setPrescriptionUploaded] = useState(false);
  const [prescriptionFile, setPrescriptionFile] = useState<File | null>(null);
  const [prescriptionUrl, setPrescriptionUrl] = useState<string>('');
  
  // Search
  const [searchQuery, setSearchQuery] = useState('');

  // Payment
  const [paymentMethod, setPaymentMethod] = useState<'razorpay' | 'cod'>('razorpay');
  const [processingPayment, setProcessingPayment] = useState(false);

  const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475`;

  useEffect(() => {
    loadInitialData();
  }, [vendorId, serviceType]);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      
      // Load products based on service type
      await loadProducts();
      
      // Load saved addresses
      await loadAddresses();
      
      // Load delivery time slots
      await loadTimeSlots();
    } catch (error: any) {
      console.error('Error loading initial data:', error);
      toast.error('Failed to load data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const loadProducts = async () => {
    try {
      let endpoint = '';
      
      if (serviceType === 'pharmacy') {
        endpoint = `${API_BASE}/customer/pharmacy/${vendorId}/products`;
      } else if (serviceType === 'products') {
        endpoint = `${API_BASE}/customer/products/${vendorId}`;
      } else if (serviceType === 'meals') {
        endpoint = `${API_BASE}/customer/meals/${vendorId}/products`;
      }

      if (!endpoint) return;

      const response = await fetch(endpoint, {
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        const products = data.products || data.data?.products || data.items || [];
        setAvailableProducts(products);
      }
    } catch (error: any) {
      console.error('Error loading products:', error);
    }
  };

  const loadAddresses = async () => {
    try {
      const response = await fetch(
        `${API_BASE}/customer/${customerId}/addresses`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        const addressList = data.addresses || data.data?.addresses || [];
        setAddresses(addressList);
        
        // Set default address
        const defaultAddr = addressList.find((a: DeliveryAddress) => a.isDefault);
        if (defaultAddr) {
          setSelectedAddressId(defaultAddr.id);
        } else if (addressList.length > 0) {
          setSelectedAddressId(addressList[0].id);
        }
      }
    } catch (error: any) {
      console.error('Error loading addresses:', error);
    }
  };

  const loadTimeSlots = async () => {
    try {
      const response = await fetch(
        `${API_BASE}/customer/delivery/${vendorId}/time-slots`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        const slots = data.slots || data.data?.slots || generateDefaultTimeSlots();
        setTimeSlots(slots);
      } else {
        // Fallback to default time slots
        setTimeSlots(generateDefaultTimeSlots());
      }
    } catch (error: any) {
      console.error('Error loading time slots:', error);
      // Fallback to default time slots
      setTimeSlots(generateDefaultTimeSlots());
    }
  };

  const generateDefaultTimeSlots = (): DeliveryTimeSlot[] => {
    const slots: DeliveryTimeSlot[] = [];
    const today = new Date();
    
    // Generate slots for next 7 days
    for (let day = 0; day < 7; day++) {
      const date = new Date(today);
      date.setDate(date.getDate() + day);
      const dateStr = date.toISOString().split('T')[0];
      
      // Morning slots (9 AM - 12 PM)
      for (let hour = 9; hour < 12; hour++) {
        slots.push({
          id: `slot_${dateStr}_${hour}`,
          date: dateStr,
          time: `${hour}:00`,
          display: `${dateStr === today.toISOString().split('T')[0] ? 'Today' : date.toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric' })} ${hour}:00 - ${hour + 1}:00`,
          available: true
        });
      }
      
      // Evening slots (4 PM - 8 PM)
      for (let hour = 16; hour < 20; hour++) {
        slots.push({
          id: `slot_${dateStr}_${hour}`,
          date: dateStr,
          time: `${hour}:00`,
          display: `${dateStr === today.toISOString().split('T')[0] ? 'Today' : date.toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric' })} ${hour}:00 - ${hour + 1}:00`,
          available: true
        });
      }
    }
    
    return slots;
  };

  const handleAddItem = (product: OrderItem) => {
    const existingItem = items.find(item => item.id === product.id);
    
    if (existingItem) {
      setItems(items.map(item => 
        item.id === product.id 
          ? { ...item, quantity: item.quantity + 1 }
          : item
      ));
    } else {
      setItems([...items, { ...product, quantity: 1 }]);
    }
    
    toast.success(`${product.name} added to cart`);
  };

  const handleUpdateQuantity = (itemId: string, delta: number) => {
    setItems(items.map(item => {
      if (item.id === itemId) {
        const newQuantity = item.quantity + delta;
        if (newQuantity <= 0) return null;
        return { ...item, quantity: newQuantity };
      }
      return item;
    }).filter(Boolean) as OrderItem[]);
  };

  const handleRemoveItem = (itemId: string) => {
    setItems(items.filter(item => item.id !== itemId));
    toast.success('Item removed from cart');
  };

  const handleSaveAddress = async () => {
    if (!newAddress.name || !newAddress.address || !newAddress.city || !newAddress.pincode) {
      toast.error('Please fill all required fields');
      return;
    }

    try {
      setLoading(true);
      
      const addressData = {
        ...newAddress,
        customerId,
        phone: customerPhone,
        isDefault: addresses.length === 0 // First address is default
      };

      const response = await fetch(
        `${API_BASE}/customer/${customerId}/addresses`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(addressData)
        }
      );

      if (response.ok) {
        const data = await response.json();
        const savedAddress = data.address || data.data?.address;
        
        setAddresses([...addresses, savedAddress]);
        setSelectedAddressId(savedAddress.id);
        setShowAddressForm(false);
        setNewAddress({
          name: '',
          address: '',
          landmark: '',
          city: '',
          state: '',
          pincode: '',
          phone: customerPhone
        });
        toast.success('Address saved successfully');
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || 'Failed to save address');
      }
    } catch (error: any) {
      console.error('Error saving address:', error);
      toast.error('Failed to save address. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handlePrescriptionUpload = async (file: File) => {
    try {
      setLoading(true);
      
      // Convert to base64 or upload to storage
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = reader.result as string;
        
        // Upload to backend
        const response = await fetch(
          `${API_BASE}/customer/prescription/upload`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${publicAnonKey}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              customerId,
              petId,
              file: base64,
              fileName: file.name,
              fileType: file.type
            })
          }
        );

        if (response.ok) {
          const data = await response.json();
          setPrescriptionUrl(data.url || data.prescriptionUrl);
          setPrescriptionUploaded(true);
          setPrescriptionFile(file);
          toast.success('Prescription uploaded successfully');
        } else {
          toast.error('Failed to upload prescription');
        }
      };
      
      reader.readAsDataURL(file);
    } catch (error: any) {
      console.error('Error uploading prescription:', error);
      toast.error('Failed to upload prescription');
    } finally {
      setLoading(false);
    }
  };

  const handlePlaceOrder = async (paymentId?: string) => {
    if (items.length === 0) {
      toast.error('Please add items to your cart');
      return;
    }

    if (!selectedAddressId) {
      toast.error('Please select a delivery address');
      return;
    }

    if (!selectedTimeSlotId) {
      toast.error('Please select a delivery time slot');
      return;
    }

    // For pharmacy, check prescription
    if (serviceType === 'pharmacy' && items.some(item => item.prescriptionRequired) && !prescriptionUploaded) {
      toast.error('Please upload prescription for prescription medicines');
      return;
    }

    try {
      setLoading(true);

      const selectedAddress = addresses.find(a => a.id === selectedAddressId);
      const selectedSlot = timeSlots.find(s => s.id === selectedTimeSlotId);

        const totals = calculateTotal();
        let orderData: any = {
        customerId,
        customerPhone,
        vendorId,
        petId,
        serviceType,
        items: items.map(item => ({
          id: item.id,
          name: item.name,
          price: item.price,
          quantity: item.quantity
        })),
        deliveryAddress: selectedAddress,
        deliveryDate: selectedSlot?.date,
        deliveryTime: selectedSlot?.time,
        prescriptionUrl: serviceType === 'pharmacy' ? prescriptionUrl : undefined,
        totalAmount: totals.total,
        subtotal: totals.subtotal,
        deliveryFee: totals.deliveryFee,
        paymentMethod: paymentMethod,
        paymentId: paymentId, // Razorpay payment ID if paid online
        status: paymentMethod === 'cod' ? 'pending' : 'confirmed' // COD is pending, online payment is confirmed
      };

      // ✅ SQL: Use SQL-only endpoints based on service type
      let endpoint = '';
      if (serviceType === 'pharmacy') {
        // ✅ FIX: Use SQL-only pharmacy medicine order endpoint
        endpoint = `${API_BASE}/pharmacy/medicine-order`;
        // Transform data for pharmacy endpoint
        orderData = {
          customerId,
          petId,
          vendorId,
          prescriptionUrl: prescriptionUrl,
          medicines: items.map(item => ({
            name: item.name,
            quantity: item.quantity,
            price: item.price
          })),
          deliveryAddress: selectedAddress,
          notes: `Delivery on ${selectedSlot?.date} at ${selectedSlot?.time}`
        };
      } else if (serviceType === 'products') {
        endpoint = `${API_BASE}/ecommerce/orders/create`;
      } else if (serviceType === 'meals') {
        endpoint = `${API_BASE}/ecommerce/orders/create`;
        // Add meal-specific fields
        orderData.serviceType = 'meals';
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(orderData)
      });

      if (response.ok) {
        const data = await response.json();
        const orderId = data.orderId || data.order?.id || data.id;
        
        toast.success('Order placed successfully!');
        
        if (onBookingComplete) {
          onBookingComplete(orderId);
        } else if (onNavigate) {
          onNavigate('order-tracking', { orderId });
        } else {
          setStep('confirmation');
        }
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || 'Failed to place order');
      }
    } catch (error: any) {
      console.error('Error placing order:', error);
      toast.error('Failed to place order. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const calculateTotal = () => {
    const subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const deliveryFee = subtotal > 500 ? 0 : 40; // Free delivery above ₹500
    return {
      subtotal,
      deliveryFee,
      total: subtotal + deliveryFee
    };
  };

  const filteredProducts = availableProducts.filter(product => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return product.name.toLowerCase().includes(query) ||
           product.description?.toLowerCase().includes(query);
  });

  // Render based on step
  if (step === 'select-items') {
    return (
      <div className="min-h-screen bg-gray-50 max-w-md mx-auto">
        {/* Header */}
        <div className="bg-white sticky top-0 z-10 border-b border-gray-200">
          <div className="px-4 py-3 flex items-center gap-3">
            <button onClick={onBack} className="p-2 -ml-2 hover:bg-gray-100 rounded-full">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex-1">
              <h1 className="font-semibold text-lg">
                {serviceType === 'pharmacy' ? 'Medicine Delivery' : 
                 serviceType === 'meals' ? 'Meal Products' : 
                 'Product Delivery'}
              </h1>
              {vendorName && <p className="text-sm text-gray-600">{vendorName}</p>}
            </div>
            {items.length > 0 && (
              <button
                onClick={() => setStep('review')}
                className="relative p-2 hover:bg-gray-100 rounded-full"
              >
                <ShoppingCart className="w-5 h-5" />
                {items.length > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-orange-500 text-white text-xs rounded-full flex items-center justify-center">
                    {items.reduce((sum, item) => sum + item.quantity, 0)}
                  </span>
                )}
              </button>
            )}
          </div>

          {/* Search */}
          <div className="px-4 pb-3">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search products..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>
          </div>
        </div>

        {/* Products List */}
        <div className="p-4 space-y-3">
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500 mx-auto mb-2"></div>
              <p className="text-gray-600">Loading products...</p>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="text-center py-8">
              <Package className="w-12 h-12 text-gray-400 mx-auto mb-2" />
              <p className="text-gray-600">No products found</p>
            </div>
          ) : (
            filteredProducts.map((product) => {
              const cartItem = items.find(item => item.id === product.id);
              const inCart = cartItem !== undefined;

              return (
                <div key={product.id} className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm">
                  <div className="flex gap-4">
                    {product.image && (
                      <div className="w-20 h-20 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
                        <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
                      </div>
                    )}
                    <div className="flex-1">
                      <h3 className="font-medium mb-1">{product.name}</h3>
                      {product.description && (
                        <p className="text-sm text-gray-600 mb-2">{product.description}</p>
                      )}
                      {product.packSize && (
                        <p className="text-xs text-gray-500 mb-2">Pack: {product.packSize}</p>
                      )}
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-bold text-lg">₹{product.price}</p>
                          {product.prescriptionRequired && (
                            <span className="text-xs text-red-600 flex items-center gap-1 mt-1">
                              <FileText className="w-3 h-3" />
                              Prescription required
                            </span>
                          )}
                        </div>
                        {inCart ? (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleUpdateQuantity(product.id, -1)}
                              className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center hover:bg-gray-100"
                            >
                              <Minus className="w-4 h-4" />
                            </button>
                            <span className="w-8 text-center font-medium">{cartItem.quantity}</span>
                            <button
                              onClick={() => handleUpdateQuantity(product.id, 1)}
                              className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center hover:bg-gray-100"
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleAddItem(product)}
                            className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 text-sm font-medium"
                          >
                            Add
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Cart Summary Footer */}
        {items.length > 0 && (
          <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white border-t border-gray-200 p-4 shadow-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-600">
                {items.reduce((sum, item) => sum + item.quantity, 0)} items
              </span>
              <span className="font-bold text-lg">
                ₹{calculateTotal().total}
              </span>
            </div>
            <button
              onClick={() => setStep('address')}
              className="w-full py-3 bg-orange-500 text-white rounded-lg hover:bg-orange-600 font-medium"
            >
              Proceed to Delivery
            </button>
          </div>
        )}
      </div>
    );
  }

  // Step 2: Address Selection
  if (step === 'address') {
    return (
      <div className="min-h-screen bg-gray-50 max-w-md mx-auto pb-24">
        {/* Header */}
        <div className="bg-white sticky top-0 z-10 border-b border-gray-200">
          <div className="px-4 py-3 flex items-center gap-3">
            <button onClick={() => setStep('select-items')} className="p-2 -ml-2 hover:bg-gray-100 rounded-full">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="font-semibold text-lg">Delivery Address</h1>
          </div>
        </div>

        <div className="p-4 space-y-4">
          {/* Add New Address Form */}
          {showAddressForm ? (
            <div className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm">
              <h3 className="font-semibold mb-4">Add New Address</h3>
              
              <div className="space-y-3">
                <div>
                  <label className="text-sm text-gray-600 mb-1 block">Name *</label>
                  <input
                    type="text"
                    value={newAddress.name || ''}
                    onChange={(e) => setNewAddress({ ...newAddress, name: e.target.value })}
                    placeholder="Your name"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>

                <div>
                  <label className="text-sm text-gray-600 mb-1 block">Address *</label>
                  <textarea
                    value={newAddress.address || ''}
                    onChange={(e) => setNewAddress({ ...newAddress, address: e.target.value })}
                    placeholder="House No., Building, Street"
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>

                <div>
                  <label className="text-sm text-gray-600 mb-1 block">Landmark</label>
                  <input
                    type="text"
                    value={newAddress.landmark || ''}
                    onChange={(e) => setNewAddress({ ...newAddress, landmark: e.target.value })}
                    placeholder="Near by landmark"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm text-gray-600 mb-1 block">City *</label>
                    <input
                      type="text"
                      value={newAddress.city || ''}
                      onChange={(e) => setNewAddress({ ...newAddress, city: e.target.value })}
                      placeholder="City"
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-gray-600 mb-1 block">Pincode *</label>
                    <input
                      type="text"
                      value={newAddress.pincode || ''}
                      onChange={(e) => setNewAddress({ ...newAddress, pincode: e.target.value })}
                      placeholder="Pincode"
                      maxLength={6}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-sm text-gray-600 mb-1 block">State</label>
                  <input
                    type="text"
                    value={newAddress.state || ''}
                    onChange={(e) => setNewAddress({ ...newAddress, state: e.target.value })}
                    placeholder="State"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={newAddress.isDefault || false}
                    onChange={(e) => setNewAddress({ ...newAddress, isDefault: e.target.checked })}
                    className="w-4 h-4 text-orange-500 border-gray-300 rounded focus:ring-orange-500"
                  />
                  <label className="text-sm text-gray-700">Set as default address</label>
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    onClick={() => {
                      setShowAddressForm(false);
                      setNewAddress({
                        name: '',
                        address: '',
                        landmark: '',
                        city: '',
                        state: '',
                        pincode: '',
                        phone: customerPhone
                      });
                    }}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveAddress}
                    disabled={loading}
                    className="flex-1 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50"
                  >
                    {loading ? 'Saving...' : 'Save Address'}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* Add New Address Button */
            <div
              onClick={() => setShowAddressForm(true)}
              className="bg-white rounded-lg p-4 border-2 border-dashed border-gray-300 cursor-pointer hover:border-orange-500 transition-all"
            >
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-orange-50 rounded-full flex items-center justify-center">
                  <Plus className="w-6 h-6 text-orange-500" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Add New Address</h3>
                  <p className="text-sm text-gray-500">Save a new delivery address</p>
                </div>
              </div>
            </div>
          )}

          {/* Saved Addresses */}
          {addresses.length === 0 && !showAddressForm ? (
            <div className="text-center py-12">
              <MapPin className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 mb-4">No saved addresses</p>
              <button
                onClick={() => setShowAddressForm(true)}
                className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600"
              >
                <Plus className="w-4 h-4 inline mr-2" />
                Add Address
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <h3 className="font-semibold text-sm text-gray-600 uppercase tracking-wide">
                Saved Addresses
              </h3>
              
              {addresses.map((address) => {
                const isSelected = selectedAddressId === address.id;
                
                return (
                  <div
                    key={address.id}
                    onClick={() => setSelectedAddressId(address.id)}
                    className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                      isSelected
                        ? 'border-orange-500 bg-orange-50'
                        : 'border-gray-200 hover:border-orange-300 bg-white'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                        isSelected ? 'bg-orange-500' : 'bg-gray-100'
                      }`}>
                        <MapPin className={`w-5 h-5 ${isSelected ? 'text-white' : 'text-gray-600'}`} />
                      </div>
                      
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-gray-900">{address.name || address.label || 'Address'}</h3>
                          {address.isDefault && (
                            <span className="px-2 py-0.5 bg-green-100 text-green-600 text-xs rounded-full">
                              Default
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 mb-1">{address.address || address.fullAddress || address.addressLine1}</p>
                        {address.landmark && (
                          <p className="text-sm text-gray-500">Near: {address.landmark}</p>
                        )}
                        <p className="text-sm text-gray-500">
                          {address.city}, {address.pincode}
                        </p>
                      </div>
                      
                      {isSelected && (
                        <div className="w-6 h-6 bg-orange-500 rounded-full flex items-center justify-center flex-shrink-0">
                          <Check className="w-4 h-4 text-white" />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Fixed Bottom Button */}
        {selectedAddressId && (
          <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white border-t border-gray-200 p-4">
            <button
              onClick={() => {
                // Check if prescription needed
                if (serviceType === 'pharmacy' && items.some(item => item.prescriptionRequired)) {
                  setStep('prescription');
                } else {
                  setStep('time-slot');
                }
              }}
              className="w-full py-3 bg-orange-500 text-white rounded-lg hover:bg-orange-600 font-medium"
            >
              Continue
            </button>
          </div>
        )}
      </div>
    );
  }

  // Step 3: Time Slot Selection
  if (step === 'time-slot') {
    return (
      <div className="min-h-screen bg-gray-50 max-w-md mx-auto pb-24">
        {/* Header */}
        <div className="bg-white sticky top-0 z-10 border-b border-gray-200">
          <div className="px-4 py-3 flex items-center gap-3">
            <button onClick={() => setStep('address')} className="p-2 -ml-2 hover:bg-gray-100 rounded-full">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="font-semibold text-lg">Select Delivery Time</h1>
          </div>
        </div>

        <div className="p-4">
          <div className="mb-4">
            <p className="text-sm text-gray-600">Choose a convenient time slot for delivery</p>
          </div>

          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500 mx-auto mb-2"></div>
              <p className="text-gray-600">Loading time slots...</p>
            </div>
          ) : timeSlots.length === 0 ? (
            <div className="text-center py-8">
              <Clock className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600">No time slots available</p>
            </div>
          ) : (
            <div className="space-y-3">
              {timeSlots.map((slot) => {
                const isSelected = selectedTimeSlotId === slot.id;
                
                return (
                  <div
                    key={slot.id}
                    onClick={() => slot.available && setSelectedTimeSlotId(slot.id)}
                    className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                      !slot.available
                        ? 'border-gray-200 bg-gray-50 opacity-50 cursor-not-allowed'
                        : isSelected
                        ? 'border-orange-500 bg-orange-50'
                        : 'border-gray-200 hover:border-orange-300 bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Clock className={`w-5 h-5 ${isSelected ? 'text-orange-500' : 'text-gray-400'}`} />
                        <div>
                          <p className="font-medium text-gray-900">{slot.display}</p>
                          {!slot.available && (
                            <p className="text-xs text-red-600">Not available</p>
                          )}
                        </div>
                      </div>
                      {isSelected && (
                        <div className="w-6 h-6 bg-orange-500 rounded-full flex items-center justify-center">
                          <Check className="w-4 h-4 text-white" />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Fixed Bottom Button */}
        {selectedTimeSlotId && (
          <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white border-t border-gray-200 p-4">
            <button
              onClick={() => setStep('review')}
              className="w-full py-3 bg-orange-500 text-white rounded-lg hover:bg-orange-600 font-medium"
            >
              Continue to Review
            </button>
          </div>
        )}
      </div>
    );
  }

  // Step 4: Prescription Upload (Pharmacy only)
  if (step === 'prescription') {
    return (
      <div className="min-h-screen bg-gray-50 max-w-md mx-auto pb-24">
        {/* Header */}
        <div className="bg-white sticky top-0 z-10 border-b border-gray-200">
          <div className="px-4 py-3 flex items-center gap-3">
            <button onClick={() => setStep('address')} className="p-2 -ml-2 hover:bg-gray-100 rounded-full">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="font-semibold text-lg">Upload Prescription</h1>
          </div>
        </div>

        <div className="p-4 space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-medium text-blue-900 mb-1">Prescription Required</h4>
                <p className="text-xs text-blue-700">
                  Some medicines in your cart require a valid prescription. Please upload a clear photo or PDF of your prescription.
                </p>
              </div>
            </div>
          </div>

          {/* Upload Area */}
          <div className="bg-white rounded-lg p-6 border-2 border-dashed border-gray-300 text-center">
            {prescriptionUploaded ? (
              <div className="space-y-4">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                  <Check className="w-8 h-8 text-green-600" />
                </div>
                <div>
                  <h3 className="font-medium text-gray-900 mb-1">Prescription Uploaded</h3>
                  <p className="text-sm text-gray-600">{prescriptionFile?.name || 'prescription.pdf'}</p>
                </div>
                <button
                  onClick={() => {
                    setPrescriptionUploaded(false);
                    setPrescriptionFile(null);
                    setPrescriptionUrl('');
                  }}
                  className="text-sm text-orange-600 hover:text-orange-700"
                >
                  Upload Different File
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto">
                  <Upload className="w-8 h-8 text-gray-400" />
                </div>
                <div>
                  <h3 className="font-medium text-gray-900 mb-1">Upload Prescription</h3>
                  <p className="text-sm text-gray-600 mb-4">
                    Upload a clear photo or PDF of your prescription
                  </p>
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        handlePrescriptionUpload(file);
                      }
                    }}
                    className="hidden"
                    id="prescription-upload"
                  />
                  <label
                    htmlFor="prescription-upload"
                    className="inline-block px-6 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 cursor-pointer"
                  >
                    Choose File
                  </label>
                </div>
              </div>
            )}
          </div>

          {prescriptionUploaded && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <Check className="w-5 h-5 text-green-600" />
                <div>
                  <p className="text-sm font-medium text-green-900">Prescription uploaded successfully</p>
                  <p className="text-xs text-green-700">Pharmacy will verify your prescription before confirming the order</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Fixed Bottom Button */}
        <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white border-t border-gray-200 p-4">
          <button
            onClick={() => {
              if (prescriptionUploaded) {
                setStep('time-slot');
              } else {
                toast.error('Please upload a prescription to continue');
              }
            }}
            disabled={!prescriptionUploaded || loading}
            className="w-full py-3 bg-orange-500 text-white rounded-lg hover:bg-orange-600 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Uploading...' : 'Continue to Time Slot'}
          </button>
        </div>
      </div>
    );
  }

  // Step 5: Review Order
  if (step === 'review') {
    const totals = calculateTotal();
    const selectedAddress = addresses.find(a => a.id === selectedAddressId);
    const selectedSlot = timeSlots.find(s => s.id === selectedTimeSlotId);

    return (
      <div className="min-h-screen bg-gray-50 max-w-md mx-auto pb-24">
        {/* Header */}
        <div className="bg-white sticky top-0 z-10 border-b border-gray-200">
          <div className="px-4 py-3 flex items-center gap-3">
            <button onClick={() => setStep('time-slot')} className="p-2 -ml-2 hover:bg-gray-100 rounded-full">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="font-semibold text-lg">Review Order</h1>
          </div>
        </div>

        <div className="p-4 space-y-4">
          {/* Order Items */}
          <div className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm">
            <h3 className="font-semibold mb-3">Order Items</h3>
            <div className="space-y-3">
              {items.map((item) => (
                <div key={item.id} className="flex gap-3 pb-3 border-b border-gray-100 last:border-0 last:pb-0">
                  {item.image && (
                    <div className="w-16 h-16 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
                      <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                    </div>
                  )}
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-900 mb-1">{item.name}</h4>
                    {item.description && (
                      <p className="text-xs text-gray-600 mb-1">{item.description}</p>
                    )}
                    {item.packSize && (
                      <p className="text-xs text-gray-500 mb-1">Pack: {item.packSize}</p>
                    )}
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Qty: {item.quantity}</span>
                      <span className="font-semibold">₹{item.price * item.quantity}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Delivery Address */}
          {selectedAddress && (
            <div className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <MapPin className="w-5 h-5 text-orange-500" />
                <h3 className="font-semibold">Delivery Address</h3>
              </div>
              <p className="text-sm text-gray-700 mb-1">{selectedAddress.name || selectedAddress.label}</p>
              <p className="text-sm text-gray-600 mb-1">
                {selectedAddress.address || selectedAddress.fullAddress || selectedAddress.addressLine1}
              </p>
              {selectedAddress.landmark && (
                <p className="text-xs text-gray-500 mb-1">Near: {selectedAddress.landmark}</p>
              )}
              <p className="text-xs text-gray-500">
                {selectedAddress.city}, {selectedAddress.pincode}
              </p>
            </div>
          )}

          {/* Delivery Time */}
          {selectedSlot && (
            <div className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="w-5 h-5 text-orange-500" />
                <h3 className="font-semibold">Delivery Time</h3>
              </div>
              <p className="text-sm text-gray-700">{selectedSlot.display}</p>
            </div>
          )}

          {/* Prescription Status (Pharmacy) */}
          {serviceType === 'pharmacy' && prescriptionUploaded && (
            <div className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <FileText className="w-5 h-5 text-green-500" />
                <h3 className="font-semibold">Prescription</h3>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-green-600" />
                <p className="text-sm text-gray-700">Uploaded and verified</p>
              </div>
            </div>
          )}

          {/* Price Breakdown */}
          <div className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm">
            <h3 className="font-semibold mb-3">Price Breakdown</h3>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Subtotal</span>
                <span className="text-gray-900">₹{totals.subtotal}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Delivery Fee</span>
                <span className="text-gray-900">
                  {totals.deliveryFee === 0 ? (
                    <span className="text-green-600">Free</span>
                  ) : (
                    `₹${totals.deliveryFee}`
                  )}
                </span>
              </div>
              <div className="pt-2 border-t border-gray-200 flex justify-between">
                <span className="font-semibold text-gray-900">Total</span>
                <span className="font-bold text-lg text-orange-600">₹{totals.total}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Fixed Bottom Button */}
        <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white border-t border-gray-200 p-4">
          <button
            onClick={() => setStep('payment')}
            className="w-full py-3 bg-orange-500 text-white rounded-lg hover:bg-orange-600 font-medium"
          >
            Proceed to Payment
          </button>
        </div>
      </div>
    );
  }

  // Step 6: Payment
  if (step === 'payment') {
    const totals = calculateTotal();

  const handlePayment = async () => {
    if (paymentMethod === 'cod') {
      // Cash on delivery - proceed directly to order creation
      await handlePlaceOrder();
    } else {
      // Razorpay marketplace payment
      setProcessingPayment(true);
      try {
        const totals = calculateTotal();
        
        // 1. Create Razorpay order via backend (marketplace mode)
        const initiateResponse = await fetch(
          `${API_BASE}/ecommerce/payments/initiate`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${publicAnonKey}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              orderId: `delivery_order_${Date.now()}`,
              customerId,
              vendorId,
              amount: totals.total,
              paymentMethod: 'razorpay'
            })
          }
        );

        if (!initiateResponse.ok) {
          const errorData = await initiateResponse.json();
          throw new Error(errorData.error || 'Failed to initiate payment');
        }

        const initiateData = await initiateResponse.json();
        const { paymentId, orderId: razorpayOrderId, key: razorpayKey } = initiateData;

        // 2. Load Razorpay script if not loaded
        if (!window.Razorpay) {
          await loadRazorpayScript();
        }

        // 3. Open Razorpay checkout
        const options = {
          key: razorpayKey || import.meta.env.VITE_RAZORPAY_KEY_ID,
          amount: totals.total * 100, // Convert to paise
          currency: 'INR',
          name: 'Warmpawz',
          description: `${serviceType === 'pharmacy' ? 'Medicine' : serviceType === 'meals' ? 'Meal Products' : 'Product'} Delivery Order`,
          order_id: razorpayOrderId,
          prefill: {
            name: customerPhone, // Use phone as name placeholder
            contact: customerPhone,
            email: `${customerPhone}@warmpawz.com` // Placeholder email
          },
          theme: {
            color: '#FF8C42' // WARMPAWZ orange
          },
          handler: async function (response: any) {
            try {
              // 4. Verify payment on backend
              const verifyResponse = await fetch(
                `${API_BASE}/ecommerce/payments/verify`,
                {
                  method: 'POST',
                  headers: {
                    'Authorization': `Bearer ${publicAnonKey}`,
                    'Content-Type': 'application/json'
                  },
                  body: JSON.stringify({
                    paymentId,
                    razorpayOrderId: response.razorpay_order_id,
                    razorpayPaymentId: response.razorpay_payment_id,
                    razorpaySignature: response.razorpay_signature
                  })
                }
              );

              if (verifyResponse.ok) {
                const verifyData = await verifyResponse.json();
                // 5. Create order after payment verification
                await handlePlaceOrder(verifyData.paymentId);
              } else {
                const errorData = await verifyResponse.json();
                throw new Error(errorData.error || 'Payment verification failed');
              }
            } catch (error: any) {
              console.error('Payment verification error:', error);
              toast.error(error?.message || 'Payment verification failed');
              setProcessingPayment(false);
            }
          },
          modal: {
            ondismiss: function() {
              setProcessingPayment(false);
              toast.info('Payment cancelled');
            }
          }
        };

        const razorpay = new window.Razorpay(options);
        
        razorpay.on('payment.failed', function (response: any) {
          console.error('Payment failed:', response.error);
          toast.error(response.error?.description || 'Payment failed');
          setProcessingPayment(false);
        });

        razorpay.open();

      } catch (error: any) {
        console.error('Payment error:', error);
        toast.error(error?.message || 'Payment failed. Please try again.');
        setProcessingPayment(false);
      }
    }
  };

  const loadRazorpayScript = (): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (window.Razorpay) {
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load Razorpay'));
      document.body.appendChild(script);
    });
  };

    return (
      <div className="min-h-screen bg-gray-50 max-w-md mx-auto pb-24">
        {/* Header */}
        <div className="bg-white sticky top-0 z-10 border-b border-gray-200">
          <div className="px-4 py-3 flex items-center gap-3">
            <button onClick={() => setStep('review')} className="p-2 -ml-2 hover:bg-gray-100 rounded-full">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="font-semibold text-lg">Payment</h1>
          </div>
        </div>

        <div className="p-4 space-y-4">
          {/* Order Summary */}
          <div className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm">
            <h3 className="font-semibold mb-3">Order Summary</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Items ({items.reduce((sum, item) => sum + item.quantity, 0)})</span>
                <span className="text-gray-900">₹{totals.subtotal}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Delivery</span>
                <span className="text-gray-900">
                  {totals.deliveryFee === 0 ? 'Free' : `₹${totals.deliveryFee}`}
                </span>
              </div>
              <div className="pt-2 border-t border-gray-200 flex justify-between font-semibold">
                <span>Total</span>
                <span className="text-orange-600">₹{totals.total}</span>
              </div>
            </div>
          </div>

          {/* Payment Methods */}
          <div className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm">
            <h3 className="font-semibold mb-3">Select Payment Method</h3>
            <div className="space-y-3">
              <div
                onClick={() => setPaymentMethod('razorpay')}
                className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                  paymentMethod === 'razorpay'
                    ? 'border-orange-500 bg-orange-50'
                    : 'border-gray-200 hover:border-orange-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <CreditCard className="w-5 h-5 text-orange-500" />
                    <div>
                      <p className="font-medium text-gray-900">Online Payment</p>
                      <p className="text-xs text-gray-600">Credit/Debit Card, UPI, Net Banking</p>
                    </div>
                  </div>
                  {paymentMethod === 'razorpay' && (
                    <div className="w-5 h-5 bg-orange-500 rounded-full flex items-center justify-center">
                      <Check className="w-3 h-3 text-white" />
                    </div>
                  )}
                </div>
              </div>

              <div
                onClick={() => setPaymentMethod('cod')}
                className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                  paymentMethod === 'cod'
                    ? 'border-orange-500 bg-orange-50'
                    : 'border-gray-200 hover:border-orange-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Package className="w-5 h-5 text-orange-500" />
                    <div>
                      <p className="font-medium text-gray-900">Cash on Delivery</p>
                      <p className="text-xs text-gray-600">Pay when you receive</p>
                    </div>
                  </div>
                  {paymentMethod === 'cod' && (
                    <div className="w-5 h-5 bg-orange-500 rounded-full flex items-center justify-center">
                      <Check className="w-3 h-3 text-white" />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Fixed Bottom Button */}
        <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white border-t border-gray-200 p-4">
          <button
            onClick={handlePayment}
            disabled={processingPayment || loading}
            className="w-full py-3 bg-orange-500 text-white rounded-lg hover:bg-orange-600 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {processingPayment ? 'Processing Payment...' : loading ? 'Placing Order...' : `Pay ₹${totals.total}`}
          </button>
        </div>
      </div>
    );
  }

  // Step 7: Confirmation
  if (step === 'confirmation') {
    return (
      <div className="min-h-screen bg-gray-50 max-w-md mx-auto pb-24">
        {/* Header */}
        <div className="bg-white sticky top-0 z-10 border-b border-gray-200">
          <div className="px-4 py-3 flex items-center gap-3">
            <button onClick={onBack} className="p-2 -ml-2 hover:bg-gray-100 rounded-full">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="font-semibold text-lg">Order Confirmed</h1>
          </div>
        </div>

        <div className="p-4">
          <div className="bg-white rounded-lg p-6 border border-gray-200 shadow-sm text-center mb-4">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check className="w-10 h-10 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Order Placed Successfully!</h2>
            <p className="text-gray-600 mb-4">
              Your order has been confirmed and will be delivered soon.
            </p>
            {serviceType === 'pharmacy' && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                <p className="text-sm text-blue-800">
                  <strong>Note:</strong> Your prescription is being verified. You'll receive a confirmation once verified.
                </p>
              </div>
            )}
          </div>

          {/* Order Details */}
          <div className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm mb-4">
            <h3 className="font-semibold mb-3">Order Details</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Order ID</span>
                <span className="font-medium text-gray-900">#{Date.now().toString().slice(-8)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Items</span>
                <span className="text-gray-900">{items.reduce((sum, item) => sum + item.quantity, 0)} items</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Total Amount</span>
                <span className="font-semibold text-orange-600">₹{calculateTotal().total}</span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-3">
            <button
              onClick={() => {
                if (onNavigate) {
                  onNavigate('order-tracking', { orderId: `order_${Date.now()}` });
                } else if (onBack) {
                  onBack();
                }
              }}
              className="w-full py-3 bg-orange-500 text-white rounded-lg hover:bg-orange-600 font-medium"
            >
              Track Order
            </button>
            <button
              onClick={onBack}
              className="w-full py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium"
            >
              Back to Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Fallback
  return (
    <div className="min-h-screen bg-gray-50 max-w-md mx-auto">
      <div className="text-center py-8">
        <p className="text-gray-600">Unknown step: {step}</p>
        <button onClick={onBack} className="mt-4 px-4 py-2 bg-orange-500 text-white rounded-lg">
          Back
        </button>
      </div>
    </div>
  );
}

