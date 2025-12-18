import { useState } from 'react';
import { 
  ArrowLeft, 
  MapPin, 
  CreditCard, 
  FileText, 
  ChevronRight, 
  Check, 
  Plus, 
  Minus, 
  Trash2,
  AlertCircle
} from 'lucide-react';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import { Label } from '../ui/label';
import { Separator } from '../ui/separator';
import { useCart } from '../../context/CartContext';
import { toast } from 'sonner@2.0.3';
import { Loader2 } from 'lucide-react';

interface PharmacyCheckoutProps {
  onBack: () => void;
  onSuccess: () => void;
  phone: string;
}

export function PharmacyCheckout({ onBack, onSuccess, phone }: PharmacyCheckoutProps) {
  const { items, updateQuantity, removeFromCart, cartTotal, clearCart } = useCart();
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedAddress, setSelectedAddress] = useState('addr-1');
  const [paymentMethod, setPaymentMethod] = useState('upi');
  const [showPrescriptionUpload, setShowPrescriptionUpload] = useState(false);

  const hasPrescriptionItems = items.some(item => item.prescriptionRequired);
  const deliveryFee = cartTotal > 500 ? 0 : 40;
  const totalAmount = cartTotal + deliveryFee;

  const handlePlaceOrder = async () => {
    if (items.length === 0) return;

    if (hasPrescriptionItems && !showPrescriptionUpload) { // In a real app, check if file is uploaded
        // For this mock, we assume if they saw the section they "uploaded" it or it's on file
    }

    setIsProcessing(true);
    
    // Simulate API call
    setTimeout(() => {
      setIsProcessing(false);
      clearCart();
      onSuccess();
      toast.success('Order placed successfully!');
    }, 2000);
  };

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-[#FF8C42] white flex flex-col items-center justify-center p-6 text-center">
        <div className="w-20 h-20 bg-[#FF8C42] gray-100 rounded-full flex items-center justify-center mb-6">
          <CreditCard className="w-10 h-10 text-gray-400" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">Your cart is empty</h2>
        <p className="text-gray-500 mb-8">Looks like you haven't added any medicines yet.</p>
        <Button onClick={onBack} className="bg-pink-600 hover:bg-[#FF8C42] pink-700 text-white min-w-[200px]">
          Start Shopping
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FF8C42] gray-50 pb-32">
      {/* Header */}
      <div className="bg-[#FF8C42] white sticky top-0 z-10 border-b border-gray-100">
        <div className="px-4 py-4 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack} className="-ml-2">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="font-bold text-lg">Checkout</h1>
        </div>
      </div>

      <div className="p-4 space-y-6">
        {/* Order Summary */}
        <section>
          <h2 className="text-sm font-semibold text-gray-500 mb-3 uppercase tracking-wider">Order Summary</h2>
          <Card className="bg-[#FF8C42] white border-gray-100 shadow-sm overflow-hidden">
            <div className="divide-y divide-gray-100">
              {items.map((item) => (
                <div key={item.id} className="p-4 flex gap-3">
                  <div className="w-16 h-16 bg-[#FF8C42] gray-100 rounded-lg overflow-hidden flex-shrink-0">
                    <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between items-start mb-1">
                      <h3 className="font-medium text-sm text-gray-900">{item.name}</h3>
                      <p className="font-bold text-sm">₹{item.price * item.quantity}</p>
                    </div>
                    {item.prescriptionRequired && (
                      <div className="flex items-center gap-1 text-xs text-blue-600 mb-2">
                        <FileText className="w-3 h-3" />
                        RX Required
                      </div>
                    )}
                    
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 border border-gray-200 rounded-lg p-1">
                        <button 
                          className="w-6 h-6 flex items-center justify-center text-gray-500 hover:text-gray-700 disabled:opacity-50"
                          onClick={() => updateQuantity(item.id, item.quantity - 1)}
                          disabled={item.quantity <= 1}
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="text-sm font-medium w-4 text-center">{item.quantity}</span>
                        <button 
                          className="w-6 h-6 flex items-center justify-center text-gray-500 hover:text-gray-700"
                          onClick={() => updateQuantity(item.id, item.quantity + 1)}
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                      <button 
                        className="text-red-500 p-2"
                        onClick={() => removeFromCart(item.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </section>

        {/* Prescription Upload (if needed) */}
        {hasPrescriptionItems && (
          <section>
            <div className="flex items-center gap-2 mb-3 text-amber-600 bg-[#FF8C42] amber-50 p-3 rounded-lg border border-amber-100">
              <AlertCircle className="w-5 h-5" />
              <p className="text-xs font-medium">Some items require a prescription</p>
            </div>
            <Card className="bg-[#FF8C42] white p-4 border-dashed border-2 border-gray-200 shadow-none text-center">
              <div className="w-12 h-12 bg-[#FF8C42] blue-50 rounded-full flex items-center justify-center mx-auto mb-3">
                <FileText className="w-6 h-6 text-blue-600" />
              </div>
              <h3 className="font-medium text-sm mb-1">Upload Prescription</h3>
              <p className="text-xs text-gray-500 mb-4">Upload a photo of your prescription</p>
              <Button variant="outline" className="w-full text-blue-600 border-blue-200 hover:bg-[#FF8C42] blue-50">
                Select File
              </Button>
            </Card>
          </section>
        )}

        {/* Address Selection */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Deliver To</h2>
            <Button variant="link" className="text-pink-600 h-auto p-0 text-xs">Add New</Button>
          </div>
          
          <RadioGroup value={selectedAddress} onValueChange={setSelectedAddress} className="space-y-3">
            <div className={`relative flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${selectedAddress === 'addr-1' ? 'border-pink-600 bg-pink-50/30' : 'border-transparent bg-white'}`}>
              <RadioGroupItem value="addr-1" id="addr-1" className="mt-1 text-pink-600 border-gray-300" />
              <div className="flex-1">
                <Label htmlFor="addr-1" className="font-semibold text-gray-900 cursor-pointer">Home</Label>
                <p className="text-sm text-gray-600 mt-0.5">B-402, Palm Heights, Koramangala 4th Block, Bangalore - 560034</p>
              </div>
            </div>
            
            <div className={`relative flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${selectedAddress === 'addr-2' ? 'border-pink-600 bg-pink-50/30' : 'border-transparent bg-white'}`}>
              <RadioGroupItem value="addr-2" id="addr-2" className="mt-1 text-pink-600 border-gray-300" />
              <div className="flex-1">
                <Label htmlFor="addr-2" className="font-semibold text-gray-900 cursor-pointer">Office</Label>
                <p className="text-sm text-gray-600 mt-0.5">WeWork Galaxy, Residency Road, Bangalore - 560025</p>
              </div>
            </div>
          </RadioGroup>
        </section>

        {/* Bill Details */}
        <section>
          <h2 className="text-sm font-semibold text-gray-500 mb-3 uppercase tracking-wider">Bill Details</h2>
          <Card className="bg-[#FF8C42] white p-4 border-gray-100 shadow-sm space-y-3">
            <div className="flex justify-between text-sm text-gray-600">
              <span>Item Total</span>
              <span>₹{cartTotal}</span>
            </div>
            <div className="flex justify-between text-sm text-gray-600">
              <span>Delivery Fee</span>
              {deliveryFee === 0 ? (
                <span className="text-green-600">FREE</span>
              ) : (
                <span>₹{deliveryFee}</span>
              )}
            </div>
            <div className="flex justify-between text-sm text-gray-600">
              <span>Taxes & Charges</span>
              <span>₹{(cartTotal * 0.05).toFixed(0)}</span>
            </div>
            <Separator />
            <div className="flex justify-between font-bold text-gray-900">
              <span>To Pay</span>
              <span>₹{totalAmount + parseInt((cartTotal * 0.05).toFixed(0))}</span>
            </div>
          </Card>
        </section>
      </div>

      {/* Footer */}
      <div className="fixed bottom-0 left-0 right-0 bg-[#FF8C42] white border-t border-gray-200 p-4 z-20">
        <div className="max-w-md mx-auto flex items-center gap-4">
          <div className="flex-1">
            <p className="text-xs text-gray-500 mb-0.5">Total Payable</p>
            <p className="text-xl font-bold text-gray-900">₹{totalAmount + parseInt((cartTotal * 0.05).toFixed(0))}</p>
          </div>
          <Button 
            className="flex-1 bg-pink-600 hover:bg-[#FF8C42] pink-700 text-white h-12 rounded-xl font-semibold"
            onClick={handlePlaceOrder}
            disabled={isProcessing}
          >
            {isProcessing ? (
              <Loader2 className="w-5 h-5 animate-spin" />
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
