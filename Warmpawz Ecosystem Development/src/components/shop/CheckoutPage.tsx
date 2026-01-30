import React, { useState, useEffect } from 'react';
import { Check, MapPin, CreditCard, ClipboardList, Truck, Plus, Home, Briefcase, Wallet, Banknote, Loader2, ArrowRight } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '../ui/card';
import { Separator } from '../ui/separator';
import { CheckoutLayout } from './CheckoutLayout';
import { useNavigate } from 'react-router-dom';
import { ImageWithFallback } from '../figma/ImageWithFallback';
import { Badge } from '../ui/badge';
import { Checkbox } from '../ui/checkbox';
import { getApiBaseUrl, getAuthHeaders } from '../../utils/api-config';
import { authenticatedGet, authenticatedPost } from '../../utils/authenticatedFetch';
import { toast } from 'sonner';

const STEPS = [
  { id: 'address', title: 'Delivery Address', icon: MapPin },
  { id: 'payment', title: 'Payment Method', icon: CreditCard },
  { id: 'review', title: 'Review Order', icon: ClipboardList },
];

// Mock Saved Addresses
const SAVED_ADDRESSES = [
  { id: 'addr1', name: 'Rahul Sharma', type: 'Home', line: 'Flat 402, Sunshine Apartments, Indiranagar', city: 'Bangalore', pin: '560038', phone: '9876543210', state: 'Karnataka' },
  { id: 'addr2', name: 'Rahul Work', type: 'Work', line: 'Tech Park, EGL, Domlur', city: 'Bangalore', pin: '560071', phone: '9876543210', state: 'Karnataka' }
];

const MOCK_CART_ITEMS = [
  {
    id: '1',
    title: 'Royal Canin Adult Golden Retriever Dog Food (3kg)',
    price: 2400,
    originalPrice: 2800,
    quantity: 1,
    image: 'https://images.unsplash.com/photo-1764249453874-46864677b10e?q=80&w=200&auto=format&fit=crop',
    variant: '3kg',
    stock: true
  },
  {
    id: '2',
    title: 'Interactive Cat Laser Toy Automatic',
    price: 899,
    originalPrice: 0,
    quantity: 2,
    image: 'https://images.unsplash.com/photo-1729008764855-9b5257318beb?q=80&w=200&auto=format&fit=crop',
    variant: 'Red',
    stock: true
  }
];

export function CheckoutPage() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState('address');
  const [completedSteps, setCompletedSteps] = useState<string[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState(SAVED_ADDRESSES[0].id);
  const [isAddingAddress, setIsAddingAddress] = useState(false);
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  
  // New Address State
  const [newAddress, setNewAddress] = useState({
    fullName: '',
    phone: '',
    pincode: '',
    line1: '',
    city: '',
    state: '',
    type: 'home'
  });

  // Payment State
  const [paymentMethod, setPaymentMethod] = useState('upi');

  // Order Summary Calcs
  const subtotal = MOCK_CART_ITEMS.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const shipping = subtotal > 499 ? 0 : 50;
  const total = subtotal + shipping;

  const handleAddressSubmit = () => {
    if (selectedAddressId === 'new') {
        // Validate new address logic here
    }
    completeStep('address');
    setCurrentStep('payment');
  };

  const handlePaymentSubmit = () => {
    completeStep('payment');
    setCurrentStep('review');
  };

  const handlePlaceOrder = () => {
    setIsPlacingOrder(true);
    // Simulate API call
    setTimeout(() => {
      navigate('/shop/order-confirmation');
    }, 2000);
  };

  const completeStep = (step: string) => {
    if (!completedSteps.includes(step)) {
      setCompletedSteps([...completedSteps, step]);
    }
  };

  const selectedAddress = selectedAddressId === 'new' ? newAddress : SAVED_ADDRESSES.find(a => a.id === selectedAddressId);

  const renderStepIndicator = () => (
    <div className="flex items-center justify-between mb-8 px-4 md:px-0">
      {STEPS.map((step, index) => {
        const isCompleted = completedSteps.includes(step.id);
        const isCurrent = currentStep === step.id;
        
        return (
          <div key={step.id} className="flex flex-col items-center relative z-10 flex-1 group cursor-pointer" onClick={() => {
              if (completedSteps.includes(step.id) || completedSteps.includes(STEPS[index-1]?.id)) {
                  setCurrentStep(step.id);
              }
          }}>
            <div 
              className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-300
                ${isCompleted ? 'bg-green-600 border-green-600 text-white' : isCurrent ? 'bg-primary border-primary text-white' : 'bg-white border-gray-200 text-gray-400 group-hover:border-gray-300'}
              `}
            >
              {isCompleted ? <Check className="h-5 w-5" /> : <step.icon className="h-5 w-5" />}
            </div>
            <span className={`text-xs font-medium mt-2 ${isCurrent ? 'text-primary' : isCompleted ? 'text-green-600' : 'text-muted-foreground'}`}>
              {step.title}
            </span>
            
            {/* Connector Line */}
            {index < STEPS.length - 1 && (
              <div className="absolute top-5 left-1/2 w-full h-[2px] bg-gray-200 -z-10">
                <div 
                  className="h-full bg-green-600 transition-all duration-500" 
                  style={{ width: isCompleted ? '100%' : '0%' }} 
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );

  return (
    <CheckoutLayout>
      {renderStepIndicator()}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Form Area */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Step 1: Address */}
          <Card className={currentStep === 'address' ? 'border-primary ring-1 ring-primary/20 shadow-md' : 'opacity-70'}>
            <CardHeader className="pb-4 bg-gray-50/50 border-b">
              <CardTitle className="flex items-center justify-between text-base">
                <span className="flex items-center gap-2">
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${currentStep === 'address' ? 'bg-primary text-white' : 'bg-gray-200 text-gray-600'}`}>1</span>
                  Delivery Address
                </span>
                {completedSteps.includes('address') && currentStep !== 'address' && (
                  <Button variant="outline" size="sm" onClick={() => setCurrentStep('address')} className="h-8">Change</Button>
                )}
              </CardTitle>
            </CardHeader>
            
            {currentStep === 'address' && (
              <CardContent className="p-6">
                <RadioGroup value={selectedAddressId} onValueChange={setSelectedAddressId} className="space-y-4">
                   {SAVED_ADDRESSES.map(addr => (
                     <div key={addr.id} className={`flex items-start space-x-3 border p-4 rounded-lg cursor-pointer transition-colors ${selectedAddressId === addr.id ? 'border-primary bg-primary/5' : 'hover:border-gray-300'}`}>
                       <RadioGroupItem value={addr.id} id={addr.id} className="mt-1" />
                       <Label htmlFor={addr.id} className="flex-1 cursor-pointer font-normal">
                         <div className="flex items-center gap-2 mb-1">
                           <span className="font-bold text-base">{addr.name}</span>
                           <Badge variant="secondary" className="text-[10px] uppercase">{addr.type}</Badge>
                           <span className="text-sm text-muted-foreground">{addr.phone}</span>
                         </div>
                         <p className="text-muted-foreground text-sm leading-relaxed">
                           {addr.line}, {addr.city}, {addr.state} - <strong>{addr.pin}</strong>
                         </p>
                       </Label>
                     </div>
                   ))}
                   
                   {/* Add New Address Option */}
                   <div className={`border rounded-lg p-4 cursor-pointer ${selectedAddressId === 'new' ? 'border-primary bg-primary/5' : 'hover:border-gray-300'}`}>
                     <div className="flex items-center space-x-3">
                       <RadioGroupItem value="new" id="new_addr" />
                       <Label htmlFor="new_addr" className="flex items-center gap-2 cursor-pointer font-medium text-primary">
                         <Plus className="h-4 w-4" /> Add New Address
                       </Label>
                     </div>
                     
                     {/* New Address Form (Collapsible) */}
                     {selectedAddressId === 'new' && (
                        <div className="mt-6 space-y-4 pl-7 animate-in slide-in-from-top-2 fade-in duration-200">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                <Label htmlFor="fullName">Full Name</Label>
                                <Input id="fullName" placeholder="John Doe" value={newAddress.fullName} onChange={e => setNewAddress({...newAddress, fullName: e.target.value})} />
                                </div>
                                <div className="space-y-2">
                                <Label htmlFor="phone">Phone Number</Label>
                                <Input id="phone" placeholder="10-digit mobile number" value={newAddress.phone} onChange={e => setNewAddress({...newAddress, phone: e.target.value})} />
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                <Label htmlFor="pincode">Pincode</Label>
                                <Input id="pincode" placeholder="e.g. 560038" value={newAddress.pincode} onChange={e => setNewAddress({...newAddress, pincode: e.target.value})} />
                                </div>
                                <div className="space-y-2">
                                <Label htmlFor="city">City</Label>
                                <Input id="city" placeholder="Bangalore" value={newAddress.city} onChange={e => setNewAddress({...newAddress, city: e.target.value})} />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="address">Address (House No, Building, Street)</Label>
                                <Input id="address" placeholder="" value={newAddress.line1} onChange={e => setNewAddress({...newAddress, line1: e.target.value})} />
                            </div>
                            <div className="space-y-2">
                                <Label>Type</Label>
                                <div className="flex gap-4">
                                    <Button 
                                        type="button"
                                        variant={newAddress.type === 'home' ? 'default' : 'outline'} 
                                        size="sm" 
                                        onClick={() => setNewAddress({...newAddress, type: 'home'})}
                                        className="gap-2"
                                    >
                                        <Home className="h-4 w-4" /> Home
                                    </Button>
                                    <Button 
                                        type="button"
                                        variant={newAddress.type === 'work' ? 'default' : 'outline'} 
                                        size="sm" 
                                        onClick={() => setNewAddress({...newAddress, type: 'work'})}
                                        className="gap-2"
                                    >
                                        <Briefcase className="h-4 w-4" /> Work
                                    </Button>
                                </div>
                            </div>
                        </div>
                     )}
                   </div>
                </RadioGroup>

                <Button onClick={handleAddressSubmit} className="mt-6 w-full md:w-auto">Deliver Here</Button>
              </CardContent>
            )}
            
            {/* Summary View for Completed Step */}
            {completedSteps.includes('address') && currentStep !== 'address' && selectedAddress && (
              <CardContent className="p-6 pt-2 text-sm">
                <div className="flex items-start gap-2">
                   <MapPin className="h-4 w-4 mt-0.5 text-muted-foreground" />
                   <div>
                       <p className="font-semibold text-foreground">{selectedAddress.name || selectedAddress.fullName} <span className="font-normal text-muted-foreground">({selectedAddress.phone})</span></p>
                       <p className="text-muted-foreground">{selectedAddress.line || selectedAddress.line1}, {selectedAddress.city} - {selectedAddress.pin || selectedAddress.pincode}</p>
                   </div>
                </div>
              </CardContent>
            )}
          </Card>

          {/* Step 2: Payment */}
          <Card className={currentStep === 'payment' ? 'border-primary ring-1 ring-primary/20 shadow-md' : 'opacity-70'}>
            <CardHeader className="pb-4 bg-gray-50/50 border-b">
              <CardTitle className="flex items-center justify-between text-base">
                <span className="flex items-center gap-2">
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${currentStep === 'payment' ? 'bg-primary text-white' : 'bg-gray-200 text-gray-600'}`}>2</span>
                  Payment Method
                </span>
                {completedSteps.includes('payment') && currentStep !== 'payment' && (
                  <Button variant="outline" size="sm" onClick={() => setCurrentStep('payment')} className="h-8">Change</Button>
                )}
              </CardTitle>
            </CardHeader>
            {currentStep === 'payment' && (
              <CardContent className="p-6">
                <RadioGroup value={paymentMethod} onValueChange={setPaymentMethod} className="space-y-3">
                  <div className={`flex items-center space-x-3 border p-4 rounded-md cursor-pointer transition-all ${paymentMethod === 'upi' ? 'border-primary bg-primary/5 ring-1 ring-primary/20' : 'hover:border-gray-300'}`}>
                    <RadioGroupItem value="upi" id="upi" />
                    <Label htmlFor="upi" className="flex-1 cursor-pointer">
                        <div className="flex items-center gap-3">
                             <div className="p-2 bg-white rounded border"><Wallet className="h-5 w-5 text-blue-600" /></div>
                             <div>
                                 <div className="font-medium">UPI</div>
                                 <div className="text-xs text-muted-foreground">Google Pay, PhonePe, Paytm</div>
                             </div>
                        </div>
                    </Label>
                  </div>
                  <div className={`flex items-center space-x-3 border p-4 rounded-md cursor-pointer transition-all ${paymentMethod === 'card' ? 'border-primary bg-primary/5 ring-1 ring-primary/20' : 'hover:border-gray-300'}`}>
                    <RadioGroupItem value="card" id="card" />
                    <Label htmlFor="card" className="flex-1 cursor-pointer">
                         <div className="flex items-center gap-3">
                             <div className="p-2 bg-white rounded border"><CreditCard className="h-5 w-5 text-indigo-600" /></div>
                             <div>
                                 <div className="font-medium">Credit / Debit Card</div>
                                 <div className="text-xs text-muted-foreground">Visa, Mastercard, RuPay</div>
                             </div>
                        </div>
                    </Label>
                  </div>
                  <div className={`flex items-center space-x-3 border p-4 rounded-md cursor-pointer transition-all ${paymentMethod === 'cod' ? 'border-primary bg-primary/5 ring-1 ring-primary/20' : 'hover:border-gray-300'}`}>
                    <RadioGroupItem value="cod" id="cod" />
                    <Label htmlFor="cod" className="flex-1 cursor-pointer">
                        <div className="flex items-center gap-3">
                             <div className="p-2 bg-white rounded border"><Banknote className="h-5 w-5 text-green-600" /></div>
                             <div>
                                 <div className="font-medium">Cash on Delivery</div>
                                 <div className="text-xs text-muted-foreground">Pay when you receive</div>
                             </div>
                        </div>
                    </Label>
                  </div>
                </RadioGroup>
                <Button onClick={handlePaymentSubmit} className="mt-6 w-full md:w-auto">Continue</Button>
              </CardContent>
            )}
             {completedSteps.includes('payment') && currentStep !== 'payment' && (
              <CardContent className="p-6 pt-2 text-sm">
                 <div className="flex items-center gap-2">
                    {paymentMethod === 'upi' && <Wallet className="h-4 w-4" />}
                    {paymentMethod === 'card' && <CreditCard className="h-4 w-4" />}
                    {paymentMethod === 'cod' && <Banknote className="h-4 w-4" />}
                    <span className="font-medium uppercase">{paymentMethod === 'cod' ? 'Cash on Delivery' : paymentMethod}</span>
                 </div>
              </CardContent>
            )}
          </Card>

          {/* Step 3: Review */}
          <Card className={currentStep === 'review' ? 'border-primary ring-1 ring-primary/20 shadow-md' : 'opacity-70'}>
            <CardHeader className="pb-4 bg-gray-50/50 border-b">
              <CardTitle className="flex items-center justify-between text-base">
                <span className="flex items-center gap-2">
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${currentStep === 'review' ? 'bg-primary text-white' : 'bg-gray-200 text-gray-600'}`}>3</span>
                  Review Items
                </span>
              </CardTitle>
            </CardHeader>
            {currentStep === 'review' && (
              <CardContent className="p-6">
                 <div className="space-y-4 mb-6">
                   {MOCK_CART_ITEMS.map(item => (
                        <div key={item.id} className="flex gap-4 p-3 bg-white rounded-lg border">
                            <div className="w-16 h-16 bg-white rounded-md border shrink-0 overflow-hidden">
                                <ImageWithFallback 
                                src={item.image} 
                                alt={item.title} 
                                className="w-full h-full object-cover"
                                />
                            </div>
                            <div className="flex-1">
                                <h4 className="font-medium text-sm line-clamp-1">{item.title}</h4>
                                <p className="text-xs text-muted-foreground mt-1">Qty: {item.quantity} | Variant: {item.variant}</p>
                                <p className="text-sm font-bold mt-1">₹{item.price.toLocaleString()}</p>
                            </div>
                            <div className="ml-auto text-xs text-green-600 flex flex-col items-end gap-1 h-fit">
                                <span className="flex items-center gap-1"><Truck className="h-3 w-3" /> Delivery by 25 Jan</span>
                                <span className="text-muted-foreground">FREE Delivery</span>
                            </div>
                        </div>
                   ))}
                 </div>
                 
                 <Button 
                    onClick={handlePlaceOrder} 
                    size="lg" 
                    className="w-full bg-green-600 hover:bg-green-700 text-white h-12 text-lg"
                    disabled={isPlacingOrder}
                 >
                    {isPlacingOrder ? (
                        <>
                            <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Processing...
                        </>
                    ) : (
                        <>
                            Place Order & Pay ₹{total.toLocaleString()}
                        </>
                    )}
                 </Button>
              </CardContent>
            )}
          </Card>
        </div>

        {/* Sidebar: Price Details */}
        <div className="lg:col-span-1">
           <Card className="sticky top-24">
             <CardHeader>
               <CardTitle className="text-lg">Price Details</CardTitle>
             </CardHeader>
             <CardContent className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span>Price ({MOCK_CART_ITEMS.length} items)</span>
                  <span>₹{subtotal.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>Delivery Charges</span>
                  <span className="text-green-600">{shipping === 0 ? 'Free' : `₹${shipping}`}</span>
                </div>
                <div className="flex justify-between">
                  <span>Handling Fee</span>
                  <span>₹0</span>
                </div>
                <Separator className="my-2" />
                <div className="flex justify-between text-lg font-bold">
                  <span>Total Payable</span>
                  <span>₹{total.toLocaleString()}</span>
                </div>
             </CardContent>
             <CardFooter className="bg-gray-50 border-t p-4 text-xs text-muted-foreground rounded-b-lg">
                Your order is eligible for free delivery.
             </CardFooter>
           </Card>
           
           <div className="mt-6 flex items-start gap-3 p-4 bg-blue-50 text-blue-700 rounded-lg text-sm border border-blue-100">
               <Truck className="h-5 w-5 shrink-0 mt-0.5" />
               <div>
                   <p className="font-semibold">Fast Delivery</p>
                   <p className="text-blue-600/80">Get it by Wed, Jan 25</p>
               </div>
           </div>
        </div>
      </div>
    </CheckoutLayout>
  );
}