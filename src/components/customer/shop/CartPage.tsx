import { useState, useEffect } from 'react';
import { Trash2, Minus, Plus, ArrowRight, ArrowLeft, ShoppingCart } from 'lucide-react';
import { Button } from '../../ui/button';
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

interface CartPageProps {
  customerId: string;
  onCheckout: () => void;
  onBack: () => void;
}

export function CartPage({ customerId, onCheckout, onBack }: CartPageProps) {
  const [cart, setCart] = useState<Cart | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);

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
    } finally {
      setLoading(false);
    }
  };

  const updateQuantity = async (itemId: string, newQuantity: number) => {
    setUpdating(itemId);
    try {
      if (newQuantity < 1) {
        // Delete
        const res = await fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/cart/item/${itemId}?customerId=${customerId}`,
          { 
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${publicAnonKey}` }
          }
        );
        if (res.ok) {
          const data = await res.json();
          setCart(data.cart);
          toast.success('Item removed');
        }
      } else {
        // Update
        const res = await fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/cart/update`,
          {
            method: 'PUT',
            headers: { 
              'Authorization': `Bearer ${publicAnonKey}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ customerId, itemId, quantity: newQuantity })
          }
        );
        if (res.ok) {
          const data = await res.json();
          setCart(data.cart);
        }
      }
    } catch (error) {
      toast.error('Failed to update cart');
    } finally {
      setUpdating(null);
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
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center">
        <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-4">
          <ShoppingCart className="w-10 h-10 text-gray-400" />
        </div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Your cart is empty</h2>
        <p className="text-gray-500 mb-6">Looks like you haven't added anything to your cart yet.</p>
        <Button onClick={onBack} className="bg-indigo-600 hover:bg-indigo-700 text-white">
          Start Shopping
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <div className="bg-white border-b px-4 py-3 flex items-center gap-3 sticky top-0 z-30">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="font-semibold text-lg">Shopping Cart ({cart.items.length})</h1>
      </div>

      <div className="p-4 space-y-4">
        {/* Items */}
        <div className="space-y-3">
          {cart.items.map((item) => (
            <div key={item.id} className="bg-white rounded-xl p-3 flex gap-3 shadow-sm border border-gray-100">
              <div className="w-20 h-20 bg-gray-50 rounded-lg overflow-hidden flex-shrink-0">
                <ImageWithFallback src={item.image} alt={item.name} className="w-full h-full object-cover" />
              </div>
              <div className="flex-1 flex flex-col justify-between">
                <div>
                  <h3 className="font-medium text-sm line-clamp-2">{item.name}</h3>
                  <PriceDisplay basePrice={item.price} size="sm" className="mt-1" />
                </div>
                <div className="flex items-center justify-between mt-2">
                  <div className="flex items-center border rounded-lg bg-gray-50">
                    <button 
                      onClick={() => updateQuantity(item.id, item.quantity - 1)}
                      disabled={updating === item.id}
                      className="p-1 hover:text-red-600 disabled:opacity-50"
                    >
                      {item.quantity === 1 ? <Trash2 className="w-4 h-4" /> : <Minus className="w-4 h-4" />}
                    </button>
                    <span className="w-8 text-center text-sm font-medium">{item.quantity}</span>
                    <button 
                      onClick={() => updateQuantity(item.id, item.quantity + 1)}
                      disabled={updating === item.id}
                      className="p-1 hover:text-indigo-600 disabled:opacity-50"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Bill Details */}
        <div className="bg-white rounded-xl p-4 space-y-3 shadow-sm border border-gray-100">
          <h3 className="font-semibold text-sm">Bill Details</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between text-gray-600">
              <span>Subtotal</span>
              <span>₹{cart.subtotal}</span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span>GST (18%)</span>
              <span>₹{cart.gst.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span>Delivery Fee</span>
              <span className={cart.shipping === 0 ? "text-green-600" : ""}>
                {cart.shipping === 0 ? "Free" : `₹${cart.shipping}`}
              </span>
            </div>
            {cart.discount > 0 && (
              <div className="flex justify-between text-green-600 font-medium">
                <span>Discount</span>
                <span>-₹{cart.discount}</span>
              </div>
            )}
            <div className="border-t pt-2 flex justify-between font-bold text-base">
              <span>Total Pay</span>
              <span>₹{cart.total.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-4 shadow-up z-40 max-w-md mx-auto">
        <Button 
          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white h-12 text-base"
          onClick={onCheckout}
        >
          Proceed to Checkout <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}

// Remove the duplicate import at the bottom

