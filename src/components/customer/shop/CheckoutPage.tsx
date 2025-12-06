import { useState, useEffect } from 'react';
import { ArrowLeft, MapPin, CreditCard, Truck, Check, ChevronRight, ShieldCheck, Wallet } from 'lucide-react';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { RadioGroup, RadioGroupItem } from '../../ui/radio-group';
import { Separator } from '../../ui/separator';
import { Card } from '../../ui/card';
import { ImageWithFallback } from '../../figma/ImageWithFallback';
import { PriceDisplay } from './PriceDisplay';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import { toast } from 'sonner@2.0.3';
import { cn } from '../../../lib/utils';

interface CartItem {
  id: string;
  productId: string;
  variantId?: string;
  name: string;
  price: number;
  image: string;
  quantity: number;
  vendorId: string;
}

interface Cart {
  items: CartItem[];
  subtotal: number;
  gst: number;
  shipping: number;
  discount: number;
  total: number;
}

interface CheckoutPageProps {
  customerId: string;
  customerPhone?: string;
  onBack: () => void;
  onOrderPlaced: (orderData: any) => void;
}

interface Address {
  fullName: string;
  street: string;
  city: string;
  state: string;
  zipCode: string;
  phone: string;
}

export function CheckoutPage({ customerId, customerPhone, onBack, onOrderPlaced }: CheckoutPageProps) {
  const [step, setStep] = useState<'address' | 'payment' | 'review'>('address');
  const [cart, setCart] = useState<Cart | null>(null);
  const [loading, setLoading] = useState(true);
  const [placingOrder, setPlacingOrder] = useState(false);
  
  // Form States
  const [address, setAddress] = useState<Address>({
    fullName: '',
    street: '',
    city: '',
    state: '',
    zipCode: '',
    phone: customerPhone || ''
  });
  
  const [paymentMethod, setPaymentMethod] = useState('upi');

  useEffect(() => {
    fetchCart();
  }, [customerId]);

  const fetchCart = async () => {
    try {
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/cart?customerId=${customerId}`,
        { headers: { 'Authorization': `Bearer ${publicAnonKey}` } }
      );
      if (res.ok) {
        const data = await res.json();
        setCart(data.cart);
      }
    } catch (error) {
      console.error('Error fetching cart:', error);
      toast.error('Failed to load cart');
    } finally {
      setLoading(false);
    }
  };

  const handleAddressSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!address.fullName || !address.street || !address.zipCode || !address.phone) {
      toast.error('Please fill in all required fields');
      return;
    }
    setStep('payment');
  };

  const handlePlaceOrder = async () => {
    if (!cart) return;
    
    setPlacingOrder(true);
    try {
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/orders/place`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            customerId, // Pass customerId to link order and clear cart
            customerPhone: address.phone,
            items: cart.items,
            address,
            paymentMethod,
            pricing: {
              subtotal: cart.subtotal,
              gst: cart.gst,
              shipping: cart.shipping,
              discount: cart.discount,
              total: cart.total
            }
          })
        }
      );

      if (res.ok) {
        const data = await res.json();
        onOrderPlaced(data);
      } else {
        throw new Error('Failed to place order');
      }
    } catch (error) {
      console.error('Order error:', error);
      toast.error('Failed to place order. Please try again.');
    } finally {
      setPlacingOrder(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!cart || cart.items.length === 0) {
    return (
      <div className="p-6 text-center">
        <p>Your cart is empty.</p>
        <Button onClick={onBack} className="mt-4">Go Back</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <div className="bg-white border-b px-4 py-3 flex items-center gap-3 sticky top-0 z-30">
        <Button variant="ghost" size="icon" onClick={step === 'address' ? onBack : () => setStep(step === 'review' ? 'payment' : 'address')}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="font-semibold text-lg">Checkout</h1>
      </div>

      {/* Progress Steps */}
      <div className="px-6 py-4 bg-white mb-2">
        <div className="flex items-center justify-between relative">
          <div className="absolute left-0 right-0 top-1/2 h-0.5 bg-gray-100 -z-10" />
          {['Address', 'Payment', 'Review'].map((s, i) => {
            const isActive = (step === 'address' && i === 0) || (step === 'payment' && i <= 1) || (step === 'review' && i <= 2);
            const isCompleted = (step === 'payment' && i === 0) || (step === 'review' && i <= 1);
            
            return (
              <div key={s} className="flex flex-col items-center gap-1 bg-white px-2">
                <div className={cn(
                  "w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium transition-colors",
                  isActive ? "bg-indigo-600 text-white" : "bg-gray-200 text-gray-500",
                  isCompleted && "bg-green-600"
                )}>
                  {isCompleted ? <Check className="w-3 h-3" /> : i + 1}
                </div>
                <span className={cn("text-[10px] font-medium", isActive ? "text-indigo-600" : "text-gray-400")}>
                  {s}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="p-4 max-w-md mx-auto space-y-4">
        {/* Step 1: Address */}
        {step === 'address' && (
          <form onSubmit={handleAddressSubmit} className="space-y-4 animate-in slide-in-from-right">
            <Card className="p-4 space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <MapPin className="w-5 h-5 text-indigo-600" />
                <h2 className="font-semibold">Shipping Address</h2>
              </div>
              
              <div className="space-y-3">
                <div>
                  <Label htmlFor="fullName">Full Name</Label>
                  <Input 
                    id="fullName" 
                    placeholder="John Doe"
                    value={address.fullName}
                    onChange={e => setAddress({...address, fullName: e.target.value})}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input 
                    id="phone" 
                    placeholder="+91 98765 43210"
                    value={address.phone}
                    onChange={e => setAddress({...address, phone: e.target.value})}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="street">Street Address</Label>
                  <Input 
                    id="street" 
                    placeholder="House No, Street, Area"
                    value={address.street}
                    onChange={e => setAddress({...address, street: e.target.value})}
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="city">City</Label>
                    <Input 
                      id="city" 
                      placeholder="City"
                      value={address.city}
                      onChange={e => setAddress({...address, city: e.target.value})}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="zipCode">Pincode</Label>
                    <Input 
                      id="zipCode" 
                      placeholder="123456"
                      maxLength={6}
                      value={address.zipCode}
                      onChange={e => setAddress({...address, zipCode: e.target.value})}
                      required
                    />
                  </div>
                </div>
              </div>
            </Card>

            <Button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white h-12">
              Continue to Payment
            </Button>
          </form>
        )}

        {/* Step 2: Payment */}
        {step === 'payment' && (
          <div className="space-y-4 animate-in slide-in-from-right">
            <Card className="p-4 space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <CreditCard className="w-5 h-5 text-indigo-600" />
                <h2 className="font-semibold">Payment Method</h2>
              </div>

              <RadioGroup value={paymentMethod} onValueChange={setPaymentMethod} className="space-y-3">
                <div className="flex items-center justify-between space-x-2 border rounded-lg p-3 cursor-pointer hover:bg-gray-50">
                  <div className="flex items-center space-x-3">
                    <RadioGroupItem value="upi" id="upi" />
                    <Label htmlFor="upi" className="flex items-center gap-2 cursor-pointer">
                      <Wallet className="w-4 h-4 text-purple-600" /> UPI / GPay / PhonePe
                    </Label>
                  </div>
                  <span className="text-xs text-green-600 font-medium">Fastest</span>
                </div>

                <div className="flex items-center justify-between space-x-2 border rounded-lg p-3 cursor-pointer hover:bg-gray-50">
                  <div className="flex items-center space-x-3">
                    <RadioGroupItem value="card" id="card" />
                    <Label htmlFor="card" className="flex items-center gap-2 cursor-pointer">
                      <CreditCard className="w-4 h-4 text-blue-600" /> Credit / Debit Card
                    </Label>
                  </div>
                </div>

                <div className="flex items-center justify-between space-x-2 border rounded-lg p-3 cursor-pointer hover:bg-gray-50">
                  <div className="flex items-center space-x-3">
                    <RadioGroupItem value="cod" id="cod" />
                    <Label htmlFor="cod" className="flex items-center gap-2 cursor-pointer">
                      <Truck className="w-4 h-4 text-orange-600" /> Cash on Delivery
                    </Label>
                  </div>
                </div>
              </RadioGroup>
            </Card>
            
            <Button onClick={() => setStep('review')} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white h-12">
              Review Order
            </Button>
          </div>
        )}

        {/* Step 3: Review */}
        {step === 'review' && (
          <div className="space-y-4 animate-in slide-in-from-right">
            {/* Address Summary */}
            <Card className="p-4 bg-white">
              <div className="flex justify-between items-start mb-2">
                <h3 className="font-semibold text-sm text-gray-900">Deliver To</h3>
                <Button variant="link" className="h-auto p-0 text-xs text-indigo-600" onClick={() => setStep('address')}>Change</Button>
              </div>
              <div className="text-sm text-gray-600">
                <p className="font-medium text-gray-900">{address.fullName}</p>
                <p>{address.street}</p>
                <p>{address.city}, {address.zipCode}</p>
                <p>Phone: {address.phone}</p>
              </div>
            </Card>

            {/* Items Summary */}
            <Card className="p-4 bg-white space-y-3">
              <h3 className="font-semibold text-sm text-gray-900">Order Items ({cart.items.length})</h3>
              <div className="space-y-3">
                {cart.items.map(item => (
                  <div key={item.id} className="flex gap-3">
                    <div className="w-12 h-12 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
                      <ImageWithFallback src={item.image} alt={item.name} className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium line-clamp-1">{item.name}</p>
                      <div className="flex justify-between items-center mt-1">
                        <p className="text-xs text-gray-500">Qty: {item.quantity}</p>
                        <PriceDisplay basePrice={item.price * item.quantity} size="sm" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            {/* Bill Summary */}
            <Card className="p-4 bg-white space-y-2">
              <h3 className="font-semibold text-sm text-gray-900">Payment Details</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between text-gray-600">
                  <span>Subtotal</span>
                  <span>₹{cart.subtotal}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>Tax & Fees</span>
                  <span>₹{cart.gst.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>Delivery</span>
                  <span className={cart.shipping === 0 ? "text-green-600" : ""}>
                    {cart.shipping === 0 ? "Free" : `₹${cart.shipping}`}
                  </span>
                </div>
                <Separator className="my-2" />
                <div className="flex justify-between font-bold text-base">
                  <span>Total Amount</span>
                  <span>₹{cart.total.toFixed(2)}</span>
                </div>
              </div>
            </Card>
            
            {/* Secure Payment Badge */}
            <div className="flex items-center justify-center gap-2 text-xs text-gray-500">
              <ShieldCheck className="w-4 h-4 text-green-600" />
              <span>100% Secure Payment</span>
            </div>

            {/* Place Order Button */}
            <Button 
              onClick={handlePlaceOrder} 
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white h-12"
              disabled={placingOrder}
            >
              {placingOrder ? (
                <span className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Processing...
                </span>
              ) : (
                `Pay ₹${cart.total.toFixed(2)}`
              )}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
