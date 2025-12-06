import { CheckCircle, Package, ShoppingBag, ChevronRight } from 'lucide-react';
import { Button } from '../../ui/button';
import { Card } from '../../ui/card';
import { motion } from 'motion/react';

interface OrderSuccessProps {
  order: any;
  onContinueShopping: () => void;
  onViewOrder: (orderId: string) => void;
}

export function OrderSuccess({ order, onContinueShopping, onViewOrder }: OrderSuccessProps) {
  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-500">
      <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-6 animate-bounce">
        <CheckCircle className="w-10 h-10 text-green-600" />
      </div>
      
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Order Placed Successfully!</h1>
      <p className="text-gray-600 mb-8 max-w-xs mx-auto">
        Thank you for your purchase. Your order <span className="font-mono font-medium text-gray-900">{order.orderNumber}</span> has been received.
      </p>

      <Card className="w-full max-w-sm bg-gray-50 p-4 mb-8 text-left border-dashed border-2 border-gray-200">
        <div className="flex items-center gap-3 mb-3 pb-3 border-b border-gray-200">
          <Package className="w-5 h-5 text-indigo-600" />
          <div>
            <p className="text-xs text-gray-500">Estimated Delivery</p>
            <p className="font-medium text-sm text-gray-900">
              {new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
            </p>
          </div>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Amount Paid</span>
          <span className="font-semibold">₹{order.pricing.total.toFixed(2)}</span>
        </div>
      </Card>

      <div className="w-full max-w-sm space-y-3">
        <Button 
          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white h-12"
          onClick={onContinueShopping}
        >
          <ShoppingBag className="w-4 h-4 mr-2" /> Continue Shopping
        </Button>
        <Button 
          variant="outline" 
          className="w-full h-12"
          onClick={() => onViewOrder(order.id)}
        >
          View Order Details
        </Button>
      </div>
    </div>
  );
}
