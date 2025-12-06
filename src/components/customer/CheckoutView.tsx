import { useState } from 'react';
import { 
  ArrowLeft, 
  MapPin, 
  Phone, 
  Mail,
  CreditCard,
  Wallet,
  Building2,
  CheckCircle,
  AlertCircle,
  Percent,
  Tag,
  ChevronRight,
  Home,
  Briefcase,
  Plus,
  Package
} from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import { Separator } from '../ui/separator';
import { useCart } from '../../context/CartContext';
import { toast } from 'sonner@2.0.3';
import { projectId, publicAnonKey } from '../../utils/supabase/info';

interface CheckoutViewProps {
  onBack: () => void;
  onSuccess: (orderId: string) => void;
  phone: string;
}

export function CheckoutView({ onBack, onSuccess, phone }: CheckoutViewProps) {
  const { items, cartTotal, clearCart } = useCart();
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedAddress, setSelectedAddress] = useState('addr-1');
  const [selectedPayment, setSelectedPayment] = useState('cod');
  const [promoCode, setPromoCode] = useState('');
  const [appliedPromo, setAppliedPromo] = useState<{code: string, discount: number} | null>(null);

  // Mock addresses - in production, fetch from API
  const addresses = [
    {
      id: 'addr-1',
      type: 'home',
      name: 'Home',
      line1: '123 Park Street',
      line2: 'Apartment 4B',
      city: 'Mumbai',
      state: 'Maharashtra',
      pincode: '400001',
      phone: '+91 98765 43210',
      isDefault: true
    },
    {
      id: 'addr-2',
      type: 'work',
      name: 'Office',
      line1: '456 Business Complex',
      line2: 'Floor 12',
      city: 'Mumbai',
      state: 'Maharashtra',
      pincode: '400002',
      phone: '+91 98765 43210',
      isDefault: false
    }
  ];

  const paymentMethods = [
    { id: 'cod', name: 'Cash on Delivery', icon: Wallet, description: 'Pay when you receive' },
    { id: 'upi', name: 'UPI', icon: Phone, description: 'Google Pay, PhonePe, Paytm' },
    { id: 'card', name: 'Credit/Debit Card', icon: CreditCard, description: 'Visa, Mastercard, Amex' },
    { id: 'netbanking', name: 'Net Banking', icon: Building2, description: 'All major banks' }
  ];

  const deliveryFee = cartTotal > 999 ? 0 : 60;
  const discount = appliedPromo ? appliedPromo.discount : 0;
  const totalAmount = cartTotal + deliveryFee - discount;

  const handleApplyPromo = () => {
    const upperCode = promoCode.toUpperCase();
    if (upperCode === 'FIRSTORDER') {
      const discountAmount = Math.min(cartTotal * 0.1, 500);
      setAppliedPromo({ code: 'FIRSTORDER', discount: discountAmount });
      toast.success(`Promo applied! You saved ₹${discountAmount}`);
    } else if (upperCode === 'SAVE20') {
      const discountAmount = Math.min(cartTotal * 0.2, 200);
      setAppliedPromo({ code: 'SAVE20', discount: discountAmount });
      toast.success(`Promo applied! You saved ₹${discountAmount}`);
    } else if (upperCode === 'FREESHIP') {
      const discountAmount = deliveryFee;
      setAppliedPromo({ code: 'FREESHIP', discount: discountAmount });
      toast.success('Free shipping applied!');
    } else {
      toast.error('Invalid promo code');
    }
  };

  const handlePlaceOrder = async () => {
    setIsProcessing(true);

    try {
      const selectedAddr = addresses.find(a => a.id === selectedAddress);
      
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/orders/place`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            customerPhone: phone,
            items: items.map(item => ({
              productId: item.id,
              productName: item.name,
              quantity: item.quantity,
              price: item.price,
              vendorId: item.vendorId
            })),
            address: selectedAddr,
            paymentMethod: selectedPayment,
            promoCode: appliedPromo?.code,
            pricing: {
              subtotal: cartTotal,
              deliveryFee: deliveryFee,
              discount: discount,
              total: totalAmount
            }
          })
        }
      );

      if (response.ok) {
        const data = await response.json();
        clearCart();
        toast.success('Order placed successfully!');
        onSuccess(data.orderId);
      } else {
        throw new Error('Failed to place order');
      }
    } catch (error) {
      console.error('Order placement error:', error);
      toast.error('Failed to place order. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-32 max-w-md mx-auto relative">
      {/* Header */}
      <div className="sticky top-0 bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3 z-10">
        <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-full">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="font-bold text-lg">Checkout</h1>
      </div>

      <div className="p-4 space-y-4">
        {/* Delivery Address */}
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-blue-600" />
              Delivery Address
            </h2>
            <button className="text-blue-600 text-sm font-medium flex items-center gap-1">
              <Plus className="w-4 h-4" />
              Add New
            </button>
          </div>

          <RadioGroup value={selectedAddress} onValueChange={setSelectedAddress} className="space-y-3">
            {addresses.map((addr) => (
              <label
                key={addr.id}
                className={`flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                  selectedAddress === addr.id
                    ? 'border-blue-600 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <RadioGroupItem value={addr.id} id={addr.id} className="mt-1" />
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    {addr.type === 'home' ? (
                      <Home className="w-4 h-4 text-gray-600" />
                    ) : (
                      <Briefcase className="w-4 h-4 text-gray-600" />
                    )}
                    <span className="font-semibold text-gray-900">{addr.name}</span>
                    {addr.isDefault && (
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                        Default
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600">
                    {addr.line1}, {addr.line2}
                  </p>
                  <p className="text-sm text-gray-600">
                    {addr.city}, {addr.state} - {addr.pincode}
                  </p>
                  <p className="text-sm text-gray-500 mt-1 flex items-center gap-1">
                    <Phone className="w-3 h-3" />
                    {addr.phone}
                  </p>
                </div>
              </label>
            ))}
          </RadioGroup>
        </div>

        {/* Order Items Summary */}
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <h2 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <Package className="w-5 h-5 text-blue-600" />
            Order Items ({items.length})
          </h2>
          <div className="space-y-3">
            {items.slice(0, 3).map((item) => (
              <div key={item.id} className="flex gap-3">
                <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center text-2xl">
                  {item.image ? (
                    <img src={item.image} alt={item.name} className="w-full h-full object-cover rounded-lg" />
                  ) : (
                    '📦'
                  )}
                </div>
                <div className="flex-1">
                  <h3 className="font-medium text-sm text-gray-900 line-clamp-1">{item.name}</h3>
                  <p className="text-xs text-gray-500">Qty: {item.quantity}</p>
                  <p className="font-semibold text-blue-600 text-sm">₹{item.price * item.quantity}</p>
                </div>
              </div>
            ))}
            {items.length > 3 && (
              <p className="text-sm text-gray-500 text-center">
                +{items.length - 3} more items
              </p>
            )}
          </div>
        </div>

        {/* Promo Code */}
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <h2 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <Tag className="w-5 h-5 text-blue-600" />
            Apply Promo Code
          </h2>
          <div className="flex gap-2">
            <Input
              type="text"
              placeholder="Enter promo code"
              value={promoCode}
              onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
              className="flex-1"
              disabled={!!appliedPromo}
            />
            {appliedPromo ? (
              <Button
                variant="outline"
                onClick={() => {
                  setAppliedPromo(null);
                  setPromoCode('');
                }}
                className="px-6"
              >
                Remove
              </Button>
            ) : (
              <Button onClick={handleApplyPromo} className="bg-blue-600 px-6">
                Apply
              </Button>
            )}
          </div>
          {appliedPromo && (
            <div className="mt-2 flex items-center gap-2 text-sm text-green-600">
              <CheckCircle className="w-4 h-4" />
              Promo code "{appliedPromo.code}" applied
            </div>
          )}
          <div className="mt-3 text-xs text-gray-500">
            Try: FIRSTORDER, SAVE20, FREESHIP
          </div>
        </div>

        {/* Payment Method */}
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <h2 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <Wallet className="w-5 h-5 text-blue-600" />
            Payment Method
          </h2>

          <RadioGroup value={selectedPayment} onValueChange={setSelectedPayment} className="space-y-2">
            {paymentMethods.map((method) => (
              <label
                key={method.id}
                className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                  selectedPayment === method.id
                    ? 'border-blue-600 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <RadioGroupItem value={method.id} id={method.id} />
                <method.icon className="w-5 h-5 text-gray-600" />
                <div className="flex-1">
                  <p className="font-medium text-gray-900 text-sm">{method.name}</p>
                  <p className="text-xs text-gray-500">{method.description}</p>
                </div>
              </label>
            ))}
          </RadioGroup>
        </div>

        {/* Price Breakdown */}
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <h2 className="font-semibold text-gray-900 mb-3">Price Details</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Subtotal</span>
              <span className="font-medium">₹{cartTotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Delivery Fee</span>
              <span className={deliveryFee === 0 ? 'text-green-600 font-medium' : 'font-medium'}>
                {deliveryFee === 0 ? 'FREE' : `₹${deliveryFee.toFixed(2)}`}
              </span>
            </div>
            {discount > 0 && (
              <div className="flex justify-between text-green-600">
                <span>Discount</span>
                <span className="font-medium">-₹{discount.toFixed(2)}</span>
              </div>
            )}
            {cartTotal < 999 && (
              <div className="flex items-start gap-2 text-xs text-orange-600 bg-orange-50 p-2 rounded">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>Add ₹{(999 - cartTotal).toFixed(2)} more for FREE delivery</span>
              </div>
            )}
            <Separator className="my-2" />
            <div className="flex justify-between font-semibold text-base">
              <span>Total Amount</span>
              <span className="text-blue-600">₹{totalAmount.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom CTA */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 shadow-lg">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-xs text-gray-500">Total Amount</p>
            <p className="text-xl font-bold text-gray-900">₹{totalAmount.toFixed(2)}</p>
          </div>
          <Button
            onClick={handlePlaceOrder}
            disabled={isProcessing || items.length === 0}
            className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 px-8 h-12"
          >
            {isProcessing ? (
              <>
                <span className="animate-spin mr-2">⏳</span>
                Processing...
              </>
            ) : (
              <>
                Place Order
                <ChevronRight className="w-5 h-5 ml-1" />
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}