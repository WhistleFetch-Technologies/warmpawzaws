/**
 * Checkout Page with Address Selection and Payment
 */

import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Card, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { mockCustomerAPI, mockEcommerceAPI, mockAuthAPI } from '../../lib/mockAPI';
import { toast } from 'sonner';

export function CheckoutPage() {
  const navigate = useNavigate();
  const [orderData, setOrderData] = useState<any>(null);
  const [addresses, setAddresses] = useState<any[]>([]);
  const [selectedAddress, setSelectedAddress] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'wallet' | 'cod'>('card');
  const [loading, setLoading] = useState(false);
  const [showAddAddress, setShowAddAddress] = useState(false);
  
  // New Address Form
  const [newAddress, setNewAddress] = useState({
    line1: '',
    line2: '',
    city: '',
    state: '',
    pincode: '',
    phone: ''
  });

  useEffect(() => {
    loadCheckoutData();
    loadAddresses();
  }, []);

  const loadCheckoutData = () => {
    const saved = localStorage.getItem('warmpawz_checkout_data');
    if (!saved) {
      toast.error('No items in cart');
      navigate('/shop/cart');
      return;
    }
    setOrderData(JSON.parse(saved));
  };

  const loadAddresses = async () => {
    try {
      // Get current user from session
      const session = await mockCustomerAPI.getSession();
      if (session.user) {
        const userAddresses = await mockCustomerAPI.getAddresses(session.user.id);
        setAddresses(userAddresses);
        if (userAddresses.length > 0) {
          setSelectedAddress(userAddresses[0].id);
        }
      }
    } catch (error) {
      console.error('Failed to load addresses:', error);
    }
  };

  const addNewAddress = async () => {
    if (!newAddress.line1 || !newAddress.city || !newAddress.pincode) {
      toast.error('Please fill all required fields');
      return;
    }

    try {
      const session = await mockCustomerAPI.getSession();
      if (!session.user) {
        toast.error('Please login to continue');
        return;
      }

      const address = await mockCustomerAPI.addAddress({
        user_id: session.user.id,
        ...newAddress,
        is_default: addresses.length === 0
      });

      setAddresses(prev => [...prev, address]);
      setSelectedAddress(address.id);
      setShowAddAddress(false);
      setNewAddress({
        line1: '',
        line2: '',
        city: '',
        state: '',
        pincode: '',
        phone: ''
      });
      toast.success('Address added successfully');
    } catch (error) {
      console.error('Failed to add address:', error);
      toast.error('Failed to add address');
    }
  };

  const placeOrder = async () => {
    if (!selectedAddress) {
      toast.error('Please select a delivery address');
      return;
    }

    setLoading(true);

    try {
      const session = await mockAuthAPI.getSession();
      if (!session.user) {
        toast.error('Please login to continue');
        navigate('/auth/login');
        return;
      }

      // Create order
      const order = await mockEcommerceAPI.createOrder({
        customer_id: session.user.id,
        items: orderData.items.map((item: any) => ({
          product_id: item.productId,
          quantity: item.quantity,
          price: item.price
        })),
        subtotal: orderData.subtotal,
        discount: orderData.discount,
        delivery_fee: orderData.deliveryFee,
        total_amount: orderData.total,
        delivery_address_id: selectedAddress,
        payment_method: paymentMethod,
        payment_status: paymentMethod === 'cod' ? 'pending' : 'paid',
        order_status: 'confirmed'
      });

      // Clear cart
      localStorage.removeItem('warmpawz_cart');
      localStorage.removeItem('warmpawz_checkout_data');

      // Show success and redirect
      toast.success('Order placed successfully!');
      navigate(`/orders/${order.id}`);
    } catch (error) {
      console.error('Failed to place order:', error);
      toast.error('Failed to place order. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!orderData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <Button
            variant="ghost"
            onClick={() => navigate('/shop/cart')}
            className="gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Cart
          </Button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">Checkout</h1>

        <div className="grid md:grid-cols-3 gap-6">
          {/* Left Column - Address & Payment */}
          <div className="md:col-span-2 space-y-6">
            {/* Delivery Address */}
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold flex items-center gap-2">
                    <MapPin className="w-5 h-5" />
                    Delivery Address
                  </h2>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowAddAddress(!showAddAddress)}
                  >
                    Add New Address
                  </Button>
                </div>

                {showAddAddress && (
                  <Card className="mb-4 bg-gray-50">
                    <CardContent className="p-4 space-y-3">
                      <Input
                        placeholder="Address Line 1 *"
                        value={newAddress.line1}
                        onChange={(e) => setNewAddress(prev => ({ ...prev, line1: e.target.value }))}
                      />
                      <Input
                        placeholder="Address Line 2"
                        value={newAddress.line2}
                        onChange={(e) => setNewAddress(prev => ({ ...prev, line2: e.target.value }))}
                      />
                      <div className="grid grid-cols-2 gap-3">
                        <Input
                          placeholder="City *"
                          value={newAddress.city}
                          onChange={(e) => setNewAddress(prev => ({ ...prev, city: e.target.value }))}
                        />
                        <Input
                          placeholder="State"
                          value={newAddress.state}
                          onChange={(e) => setNewAddress(prev => ({ ...prev, state: e.target.value }))}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <Input
                          placeholder="Pincode *"
                          value={newAddress.pincode}
                          onChange={(e) => setNewAddress(prev => ({ ...prev, pincode: e.target.value }))}
                        />
                        <Input
                          placeholder="Phone"
                          value={newAddress.phone}
                          onChange={(e) => setNewAddress(prev => ({ ...prev, phone: e.target.value }))}
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button onClick={addNewAddress} size="sm">
                          Save Address
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setShowAddAddress(false)}
                        >
                          Cancel
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {addresses.length === 0 ? (
                  <p className="text-gray-500 text-center py-4">
                    No saved addresses. Please add a delivery address.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {addresses.map(address => (
                      <div
                        key={address.id}
                        onClick={() => setSelectedAddress(address.id)}
                        className={`border rounded-lg p-4 cursor-pointer transition-all ${
                          selectedAddress === address.id
                            ? 'border-orange-500 bg-orange-50'
                            : 'hover:border-gray-400'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <p className="font-medium mb-1">{address.line1}</p>
                            {address.line2 && <p className="text-sm text-gray-600">{address.line2}</p>}
                            <p className="text-sm text-gray-600">
                              {address.city}, {address.state} - {address.pincode}
                            </p>
                            {address.phone && (
                              <p className="text-sm text-gray-600 mt-2">Phone: {address.phone}</p>
                            )}
                          </div>
                          {selectedAddress === address.id && (
                            <CheckCircle className="w-5 h-5 text-orange-600" />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Payment Method */}
            <Card>
              <CardContent className="p-6">
                <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                  <CreditCard className="w-5 h-5" />
                  Payment Method
                </h2>

                <div className="space-y-3">
                  <div
                    onClick={() => setPaymentMethod('card')}
                    className={`border rounded-lg p-4 cursor-pointer transition-all ${
                      paymentMethod === 'card'
                        ? 'border-orange-500 bg-orange-50'
                        : 'hover:border-gray-400'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <CreditCard className="w-5 h-5" />
                        <div>
                          <p className="font-medium">Credit/Debit Card</p>
                          <p className="text-sm text-gray-600">Pay securely with your card</p>
                        </div>
                      </div>
                      {paymentMethod === 'card' && (
                        <CheckCircle className="w-5 h-5 text-orange-600" />
                      )}
                    </div>
                  </div>

                  <div
                    onClick={() => setPaymentMethod('wallet')}
                    className={`border rounded-lg p-4 cursor-pointer transition-all ${
                      paymentMethod === 'wallet'
                        ? 'border-orange-500 bg-orange-50'
                        : 'hover:border-gray-400'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Wallet className="w-5 h-5" />
                        <div>
                          <p className="font-medium">Wallet</p>
                          <p className="text-sm text-gray-600">Use your wallet balance</p>
                        </div>
                      </div>
                      {paymentMethod === 'wallet' && (
                        <CheckCircle className="w-5 h-5 text-orange-600" />
                      )}
                    </div>
                  </div>

                  <div
                    onClick={() => setPaymentMethod('cod')}
                    className={`border rounded-lg p-4 cursor-pointer transition-all ${
                      paymentMethod === 'cod'
                        ? 'border-orange-500 bg-orange-50'
                        : 'hover:border-gray-400'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <CheckCircle className="w-5 h-5" />
                        <div>
                          <p className="font-medium">Cash on Delivery</p>
                          <p className="text-sm text-gray-600">Pay when you receive</p>
                        </div>
                      </div>
                      {paymentMethod === 'cod' && (
                        <CheckCircle className="w-5 h-5 text-orange-600" />
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Order Summary */}
          <div>
            <Card className="sticky top-4">
              <CardContent className="p-6">
                <h2 className="text-xl font-bold mb-4">Order Summary</h2>

                {/* Items Preview */}
                <div className="space-y-3 mb-4 max-h-48 overflow-y-auto">
                  {orderData.items.map((item: any) => (
                    <div key={item.productId} className="flex gap-3">
                      <img
                        src={item.imageUrl}
                        alt={item.name}
                        className="w-16 h-16 object-cover rounded"
                      />
                      <div className="flex-1">
                        <p className="text-sm font-medium line-clamp-2">{item.name}</p>
                        <p className="text-xs text-gray-600">Qty: {item.quantity}</p>
                        <p className="text-sm font-semibold">₹{item.price * item.quantity}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="border-t pt-4 space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Subtotal</span>
                    <span className="font-semibold">₹{orderData.subtotal}</span>
                  </div>

                  {orderData.discount > 0 && (
                    <div className="flex justify-between text-green-600">
                      <span>Discount</span>
                      <span className="font-semibold">-₹{orderData.discount}</span>
                    </div>
                  )}

                  <div className="flex justify-between">
                    <span className="text-gray-600">Delivery Fee</span>
                    <span className="font-semibold">
                      {orderData.deliveryFee === 0 ? (
                        <Badge className="bg-green-500">FREE</Badge>
                      ) : (
                        `₹${orderData.deliveryFee}`
                      )}
                    </span>
                  </div>

                  <div className="border-t pt-3">
                    <div className="flex justify-between text-xl font-bold">
                      <span>Total</span>
                      <span>₹{orderData.total}</span>
                    </div>
                  </div>
                </div>

                {orderData.appliedCoupon && (
                  <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                    <p className="text-sm text-green-700 font-medium">
                      Coupon Applied: {orderData.appliedCoupon}
                    </p>
                  </div>
                )}

                <Button
                  onClick={placeOrder}
                  disabled={loading || !selectedAddress}
                  className="w-full mt-6 bg-gradient-to-r from-orange-500 to-pink-500 h-12 text-lg"
                >
                  {loading ? 'Processing...' : 'Place Order'}
                </Button>

                <p className="text-xs text-center text-gray-500 mt-4">
                  By placing this order, you agree to our Terms & Conditions
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}