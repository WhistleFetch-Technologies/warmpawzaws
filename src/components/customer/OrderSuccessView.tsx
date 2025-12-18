import { CheckCircle, Package, Home, ChevronRight } from 'lucide-react';
import { Button } from '../ui/button';
import { motion } from 'motion/react';

interface OrderSuccessViewProps {
  orderId: string;
  onTrackOrder: () => void;
  onBackToHome: () => void;
  onViewOrders: () => void;
}

export function OrderSuccessView({ orderId, onTrackOrder, onBackToHome, onViewOrders }: OrderSuccessViewProps) {
  return (
    <div className="min-h-screen bg-[#FF8C42] gradient-to-br from-green-50 to-blue-50 flex flex-col items-center justify-center p-6 max-w-md mx-auto relative">
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', duration: 0.5 }}
        className="mb-6"
      >
        <div className="w-24 h-24 bg-[#FF8C42] green-500 rounded-full flex items-center justify-center shadow-lg">
          <CheckCircle className="w-16 h-16 text-white" />
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="text-center max-w-md"
      >
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Order Placed!</h1>
        <p className="text-gray-600 mb-6">
          Your order has been successfully placed and is being processed.
        </p>

        <div className="bg-[#FF8C42] white rounded-2xl p-6 shadow-lg mb-6">
          <div className="mb-4">
            <p className="text-sm text-gray-500 mb-1">Order ID</p>
            <p className="text-2xl font-bold text-blue-600">{orderId}</p>
          </div>
          
          <div className="bg-[#FF8C42] blue-50 rounded-xl p-4">
            <div className="flex items-center gap-3 mb-2">
              <Package className="w-5 h-5 text-blue-600" />
              <p className="font-semibold text-gray-900">What's Next?</p>
            </div>
            <p className="text-sm text-gray-600">
              We'll send you updates about your order via notifications. You can track your order anytime from the Orders section.
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <Button
            onClick={onTrackOrder}
            className="w-full bg-[#FF8C42] gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 h-12"
          >
            Track Order
            <ChevronRight className="w-5 h-5 ml-1" />
          </Button>

          <Button
            onClick={onViewOrders}
            variant="outline"
            className="w-full h-12 border-2"
          >
            View All Orders
          </Button>

          <Button
            onClick={onBackToHome}
            variant="ghost"
            className="w-full h-12"
          >
            <Home className="w-5 h-5 mr-2" />
            Back to Home
          </Button>
        </div>

        <div className="mt-8 text-center">
          <p className="text-sm text-gray-500">
            Need help? Contact our support team
          </p>
          <button className="text-blue-600 font-medium text-sm mt-1">
            Get Support
          </button>
        </div>
      </motion.div>
    </div>
  );
}