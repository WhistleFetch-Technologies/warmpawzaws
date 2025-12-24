import { useState, useEffect } from 'react';
import { Button } from '../../ui/button';
import { Card } from '../../ui/card';
import { Badge } from '../../ui/badge';
import { 
  ArrowLeft, 
  Wallet, 
  CreditCard, 
  Tag, 
  ChevronRight,
  Check,
  Smartphone,
  Building2,
  Loader2
} from 'lucide-react';
import { projectId, publicAnonKey } from '../../../utils/supabase/info';
import { toast } from 'sonner@2.0.3';

interface PaymentPageProps {
  bookingData: {
    bookingId?: string; // Optional because standard props might not have it, but we need it
    services: any[];
    vendorName: string;
    petName: string;
    date: string;
    time: string;
    addOns?: any[];
    price?: number;
    customerId?: string;
    vendorId?: string;
  };
  phone: string;
  onBack: () => void;
  onPaymentSuccess: (paymentData: any) => void;
}

export function PaymentPage({ bookingData, phone, onBack, onPaymentSuccess }: PaymentPageProps) {
  const [loading, setLoading] = useState(false);
  const [walletBalance, setWalletBalance] = useState(0);
  const [useWallet, setUseWallet] = useState(false);
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<any>(null);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>('upi');
  const [loyaltyPoints, setLoyaltyPoints] = useState(0);
  const [useLoyaltyPoints, setUseLoyaltyPoints] = useState(false);
  const [loyaltyTier, setLoyaltyTier] = useState<any>(null);
  const [tierDiscount, setTierDiscount] = useState(0);
  const [activePromotions, setActivePromotions] = useState<any[]>([]);
  const [appliedPromotion, setAppliedPromotion] = useState<any>(null);

  const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475`;

  useEffect(() => {
    loadWalletBalance();
    loadLoyaltyProfile();
    loadActivePromotions();
  }, []);

  // ✅ Calculate GST using rule engine
  useEffect(() => {
    if (bookingData.services && bookingData.services.length > 0) {
      calculateGST();
    }
  }, [bookingData]);

  // ✅ Recalculate tier discount when subtotal changes
  useEffect(() => {
    if (loyaltyTier && loyaltyTier.benefits?.discountPercentage) {
      const discount = (subtotal * loyaltyTier.benefits.discountPercentage) / 100;
      setTierDiscount(discount);
    } else {
      setTierDiscount(0);
    }
  }, [subtotal, loyaltyTier]);

  const loadWalletBalance = async () => {
    try {
      // Fetch real wallet balance from API
      const response = await fetch(
        `${API_BASE}/customer/wallet/${phone}`,
        { headers: { Authorization: `Bearer ${publicAnonKey}` } }
      );
      
      if (response.ok) {
        const data = await response.json();
        setWalletBalance(data.balance || 0);
        console.log('✅ [PAYMENT] Loaded wallet balance: ₹', data.balance);
      } else {
        setWalletBalance(0);
      }
    } catch (error) {
      console.error('❌ [PAYMENT] Error loading wallet:', error);
      setWalletBalance(0);
    }
  };

  const loadLoyaltyProfile = async () => {
    try {
      const response = await fetch(
        `${API_BASE}/customer/loyalty/profile?customerId=${customerId || phone}`,
        { headers: { Authorization: `Bearer ${publicAnonKey}` } }
      );
      
      if (response.ok) {
        const data = await response.json();
        // Handle both response structures
        const profile = data.profile || data;
        setLoyaltyPoints(profile?.totalPoints || profile?.pointsBalance || profile?.points || 0);
        setLoyaltyTier(data.tier || null);
        
        // Tier discount will be calculated in useEffect when subtotal changes
        console.log('✅ [PAYMENT] Loaded loyalty profile:', data.profile, 'Tier:', data.tier);
      }
    } catch (error) {
      console.error('❌ [PAYMENT] Error loading loyalty profile:', error);
    }
  };

  const loadActivePromotions = async () => {
    try {
      const response = await fetch(
        `${API_BASE}/promotions/active?serviceType=${bookingData.vendorRoleId || 'all'}`,
        { headers: { Authorization: `Bearer ${publicAnonKey}` } }
      );
      
      if (response.ok) {
        const data = await response.json();
        setActivePromotions(data.promotions || []);
        console.log('✅ [PAYMENT] Loaded active promotions:', data.promotions?.length || 0);
      }
    } catch (error) {
      console.error('❌ [PAYMENT] Error loading promotions:', error);
    }
  };

  // Calculate pricing
  const servicesPrice = bookingData.services.reduce((sum, service) => {
    const price = service.customPrice || service.price || 0;
    return sum + price;
  }, 0);
  const addOnsPrice = (bookingData.addOns || []).reduce((sum, addon) => sum + (addon.price || 0), 0);
  const subtotal = servicesPrice + addOnsPrice;
  
  // ✅ Use GST rule engine for dynamic GST calculation
  const [gstCalculation, setGstCalculation] = useState<any>(null);
  const [gstLoading, setGstLoading] = useState(false);
  
  useEffect(() => {
    calculateGST();
  }, [subtotal, bookingData]);
  
  const calculateGST = async () => {
    if (subtotal <= 0) return;
    
    setGstLoading(true);
    try {
      const response = await fetch(`${API_BASE}/calculate-gst`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${publicAnonKey}`
        },
        body: JSON.stringify({
          amount: subtotal,
          category: bookingData.category,
          roleId: bookingData.vendorRoleId,
          serviceType: bookingData.serviceStyle || 'at_center',
          customerState: bookingData.customerState,
          vendorState: bookingData.vendorState
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        setGstCalculation(data);
      } else {
        // Fallback to default 18% GST
        setGstCalculation({
          gstAmount: subtotal * 0.18,
          total: subtotal * 1.18
        });
      }
    } catch (error) {
      console.error('Error calculating GST:', error);
      // Fallback to default 18% GST
      setGstCalculation({
        gstAmount: subtotal * 0.18,
        total: subtotal * 1.18
      });
    } finally {
      setGstLoading(false);
    }
  };
  
  const gst = gstCalculation?.gstAmount || subtotal * 0.18; // Fallback to 18% if not calculated
  const couponDiscount = appliedCoupon ? (subtotal * appliedCoupon.discount / 100) : 0;
  const promotionDiscount = appliedPromotion ? (subtotal * (appliedPromotion.discountPercentage || 0) / 100) : 0;
  const totalDiscount = couponDiscount + promotionDiscount + tierDiscount;
  const walletDeduction = useWallet ? Math.min(walletBalance, subtotal - totalDiscount) : 0;
  
  // Loyalty points redemption (1 point = ₹1)
  const pointsRedemption = useLoyaltyPoints ? Math.min(loyaltyPoints, Math.max(0, subtotal - totalDiscount - walletDeduction)) : 0;
  const pointsDiscount = pointsRedemption; // 1 point = ₹1
  
  const finalAmount = Math.max(0, (gstCalculation?.total || (subtotal + gst)) - totalDiscount - walletDeduction - pointsDiscount);

  const handleApplyCoupon = async () => {
    if (!couponCode) return;

    try {
      const response = await fetch(
        `${API_BASE}/coupon/validate`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            code: couponCode,
            amount: subtotal
          })
        }
      );

      if (response.ok) {
        const data = await response.json();
        if (data.valid) {
          setAppliedCoupon(data);
          toast.success('Coupon applied successfully!');
        } else {
          toast.error(data.error || 'Invalid coupon code');
        }
      } else {
        const error = await response.json();
        toast.error(error.error || 'Invalid coupon code');
      }
    } catch (error) {
      console.error('❌ [PAYMENT] Coupon validation error:', error);
      toast.error('Failed to validate coupon');
    }
  };

  const handlePayment = async () => {
    if (!bookingData.bookingId && !bookingData.services) {
        toast.error('Invalid booking data');
        return;
    }
    
    setLoading(true);
    
    try {
      console.log('💳 [PAYMENT] Initiating payment...');
      console.log('Method:', selectedPaymentMethod);
      console.log('Amount:', finalAmount);

      // 1. Initiate Payment (Create Intent)
      // ✅ ENHANCED: Include all discount information for proper tracking
      const initiateRes = await fetch(`${API_BASE}/ecommerce/payments/initiate`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${publicAnonKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          bookingId: bookingData.bookingId || `temp_${Date.now()}`,
          customerId: bookingData.customerId || phone,
          vendorId: bookingData.vendorId || 'vend_guest',
          amount: finalAmount,
          paymentMethod: selectedPaymentMethod,
          // ✅ NEW: Discount breakdown for analytics and tracking
          discounts: {
            coupon: couponDiscount,
            promotion: promotionDiscount,
            tier: tierDiscount,
            wallet: walletDeduction,
            points: pointsDiscount,
            total: totalDiscount + walletDeduction + pointsDiscount
          },
          couponCode: appliedCoupon?.code || null,
          promotionId: appliedPromotion?.id || null,
          loyaltyPointsUsed: pointsRedemption,
          tierName: loyaltyTier?.name || null,
          originalAmount: subtotal + gst,
          walletUsed: walletDeduction
        })
      });

      if (!initiateRes.ok) {
        throw new Error('Failed to initiate payment');
      }

      const initiateData = await initiateRes.json();
      const { paymentId, orderId } = initiateData;
      console.log('✅ [PAYMENT] Initiated:', paymentId);

      // 2. Simulate Payment Gateway Interaction
      // In a real app, this is where Razorpay.open() happens
      await new Promise(resolve => setTimeout(resolve, 1500)); 

      // 3. Verify Payment (Server-Side Completion)
      const verifyRes = await fetch(`${API_BASE}/ecommerce/payments/verify`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${publicAnonKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          paymentId,
          bookingId: bookingData.bookingId || `temp_${Date.now()}`,
          gatewayPaymentId: `pay_${Math.random().toString(36).substring(7)}`, // Mock Gateway ID
          signature: 'mock_signature'
        })
      });

      if (!verifyRes.ok) {
        throw new Error('Payment verification failed');
      }

      const verifyData = await verifyRes.json();
      console.log('✅ [PAYMENT] Verified:', verifyData);

      // Deduct loyalty points if used
      if (pointsRedemption > 0) {
        try {
          await fetch(`${API_BASE}/loyalty/redeem`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${publicAnonKey}`
            },
            body: JSON.stringify({
              customerId: customerId || phone,
              points: pointsRedemption
            })
          });
          console.log(`✅ [PAYMENT] Redeemed ${pointsRedemption} loyalty points`);
        } catch (error) {
          console.error('❌ [PAYMENT] Error redeeming points:', error);
          // Don't fail payment if points redemption fails
        }
      }

      const paymentData = {
        paymentId,
        amount: finalAmount,
        method: selectedPaymentMethod,
        walletUsed: walletDeduction,
        couponApplied: appliedCoupon?.code,
        promotionApplied: appliedPromotion?.id,
        loyaltyPointsUsed: pointsRedemption,
        tierDiscount: tierDiscount,
        status: 'success',
        timestamp: new Date().toISOString()
      };

      toast.success('Payment Successful!');
      onPaymentSuccess(paymentData);
      
    } catch (error) {
      console.error('❌ [PAYMENT] Error:', error);
      toast.error('Payment failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const paymentMethods = [
    { id: 'upi', name: 'UPI', icon: Smartphone, description: 'GPay, PhonePe, Paytm' },
    { id: 'card', name: 'Card', icon: CreditCard, description: 'Credit/Debit Card' },
    { id: 'netbanking', name: 'Net Banking', icon: Building2, description: 'All major banks' }
  ];

  return (
    <div className="min-h-screen bg-gray-50 max-w-md mx-auto pb-32">
      {/* Header */}
      <div className="bg-gradient-to-br from-[#FF8C42] to-[#FF7029] text-white px-6 pt-8 pb-6 sticky top-0 z-10">
        <button 
          onClick={onBack}
          className="mb-4 flex items-center gap-2 text-white/90 hover:text-white"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Back</span>
        </button>
        
        <h1 className="text-2xl font-bold mb-2">Payment</h1>
        <p className="text-white/80 text-sm">Review and pay securely</p>
      </div>

      <div className="px-6 py-6 space-y-4">
        {/* Booking Summary */}
        <Card className="p-4 bg-white border border-gray-100 shadow-sm">
          <h3 className="font-semibold mb-3">Booking Summary</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Services</span>
              <span className="font-semibold text-right max-w-[60%]">
                {bookingData.services.map(service => 
                  service.serviceName || service.name || 'Service'
                ).join(', ')}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Vendor</span>
              <span>{bookingData.vendorName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Pet</span>
              <span>{bookingData.petName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Date & Time</span>
              <span>{bookingData.date} at {bookingData.time}</span>
            </div>
          </div>
        </Card>

        {/* Price Breakdown */}
        <Card className="p-4 bg-white border border-gray-100 shadow-sm">
          <h3 className="font-semibold mb-3">Price Details</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Service Price</span>
              <span>₹{servicesPrice}</span>
            </div>
            {addOnsPrice > 0 && (
              <div className="flex justify-between">
                <span className="text-gray-600">Add-ons</span>
                <span>₹{addOnsPrice}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-gray-600">GST (18%)</span>
              <span>₹{gst.toFixed(2)}</span>
            </div>
            {tierDiscount > 0 && (
              <div className="flex justify-between text-blue-600">
                <span>Loyalty Tier Discount {loyaltyTier?.name ? `(${loyaltyTier.name})` : ''}</span>
                <span>- ₹{tierDiscount.toFixed(2)}</span>
              </div>
            )}
            {couponDiscount > 0 && (
              <div className="flex justify-between text-green-600">
                <span>Coupon Discount</span>
                <span>- ₹{couponDiscount.toFixed(2)}</span>
              </div>
            )}
            {promotionDiscount > 0 && (
              <div className="flex justify-between text-purple-600">
                <span>Promotion Discount</span>
                <span>- ₹{promotionDiscount.toFixed(2)}</span>
              </div>
            )}
            {walletDeduction > 0 && (
              <div className="flex justify-between text-green-600">
                <span>Wallet Deduction</span>
                <span>- ₹{walletDeduction.toFixed(2)}</span>
              </div>
            )}
            {pointsDiscount > 0 && (
              <div className="flex justify-between text-orange-600">
                <span>Reward Points ({pointsRedemption} pts)</span>
                <span>- ₹{pointsDiscount.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between pt-2 border-t border-gray-200">
              <span className="font-semibold">Total Amount</span>
              <span className="font-bold text-[#FF8C42]">₹{finalAmount.toFixed(2)}</span>
            </div>
          </div>
        </Card>

        {/* Wallet */}
        <Card className="p-4 bg-white border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                <Wallet className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="font-semibold">Wallet Balance</p>
                <p className="text-sm text-gray-500">₹{walletBalance.toFixed(2)} available</p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={useWallet}
                onChange={(e) => setUseWallet(e.target.checked)}
                className="sr-only peer"
                disabled={walletBalance === 0}
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-orange-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#FF8C42]"></div>
            </label>
          </div>
        </Card>

        {/* Loyalty Points & Tier */}
        {(loyaltyPoints > 0 || loyaltyTier) && (
          <Card className="p-4 bg-white border border-gray-100 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-10 h-10 bg-gradient-to-br from-orange-400 to-orange-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">⭐</span>
              </div>
              <div className="flex-1">
                <p className="font-semibold">Reward Points</p>
                <p className="text-sm text-gray-500">
                  {loyaltyPoints} points available
                  {loyaltyTier && ` • ${loyaltyTier.name} Tier`}
                </p>
              </div>
            </div>
            {loyaltyPoints > 0 && (
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={useLoyaltyPoints}
                  onChange={(e) => setUseLoyaltyPoints(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-orange-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#FF8C42]"></div>
                <span className="ml-3 text-sm text-gray-700">Use reward points (1 point = ₹1)</span>
              </label>
            )}
            {tierDiscount > 0 && (
              <div className="mt-2 p-2 bg-blue-50 rounded-lg border border-blue-200">
                <p className="text-sm text-blue-700">
                  🎉 {loyaltyTier?.name} tier discount: ₹{tierDiscount.toFixed(2)} applied automatically
                </p>
              </div>
            )}
          </Card>
        )}

        {/* Active Promotions */}
        {activePromotions.length > 0 && (
          <Card className="p-4 bg-white border border-gray-100 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <Tag className="w-5 h-5 text-purple-600" />
              <h3 className="font-semibold">Active Promotions</h3>
            </div>
            <div className="space-y-2">
              {activePromotions.map((promo) => (
                <button
                  key={promo.id}
                  onClick={() => {
                    if (appliedPromotion?.id === promo.id) {
                      setAppliedPromotion(null);
                    } else {
                      setAppliedPromotion(promo);
                      toast.success(`Promotion "${promo.title}" applied!`);
                    }
                  }}
                  className={`w-full text-left p-3 rounded-lg border transition-all ${
                    appliedPromotion?.id === promo.id
                      ? 'border-purple-500 bg-purple-50'
                      : 'border-gray-200 hover:border-purple-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-sm">{promo.title}</p>
                      <p className="text-xs text-gray-600">{promo.description}</p>
                      <p className="text-xs text-purple-600 mt-1">
                        {promo.discountPercentage}% off
                      </p>
                    </div>
                    {appliedPromotion?.id === promo.id && (
                      <Check className="w-5 h-5 text-purple-600" />
                    )}
                  </div>
                </button>
              ))}
            </div>
          </Card>
        )}

        {/* Coupon Code */}
        <Card className="p-4 bg-white border border-gray-100 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <Tag className="w-5 h-5 text-[#FF8C42]" />
            <h3 className="font-semibold">Apply Coupon</h3>
          </div>
          
          {appliedCoupon ? (
            <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-200">
              <div>
                <p className="font-semibold text-green-700">{appliedCoupon.code}</p>
                <p className="text-sm text-green-600">
                  {appliedCoupon.discount}% off applied
                </p>
              </div>
              <button 
                onClick={() => setAppliedCoupon(null)}
                className="text-sm text-red-600 hover:text-red-700"
              >
                Remove
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <input
                type="text"
                value={couponCode}
                onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                placeholder="Enter coupon code"
                className="flex-1 px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF8C42]"
              />
              <Button
                variant="outline"
                onClick={handleApplyCoupon}
                disabled={!couponCode}
                className="border-[#FF8C42] text-[#FF8C42] hover:bg-orange-50"
              >
                Apply
              </Button>
            </div>
          )}
          
          {/* Suggested Coupons */}
          <div className="mt-3 space-y-2">
            <p className="text-xs text-gray-500">Suggested for you:</p>
            <div className="flex flex-wrap gap-2">
              {['FIRST20', 'SAVE10', 'GROOM50'].map((code) => (
                <button
                  key={code}
                  onClick={() => setCouponCode(code)}
                  className="text-xs px-3 py-1.5 bg-orange-50 text-[#FF8C42] rounded-full border border-orange-200 hover:bg-orange-100"
                >
                  {code}
                </button>
              ))}
            </div>
          </div>
        </Card>

        {/* Payment Methods */}
        <Card className="p-4 bg-white border border-gray-100 shadow-sm">
          <h3 className="font-semibold mb-3">Payment Method</h3>
          <div className="space-y-2">
            {paymentMethods.map((method) => {
              const Icon = method.icon;
              const isSelected = selectedPaymentMethod === method.id;
              
              return (
                <button
                  key={method.id}
                  onClick={() => setSelectedPaymentMethod(method.id)}
                  className={`w-full flex items-center justify-between p-3 rounded-lg border transition-all ${
                    isSelected
                      ? 'border-[#FF8C42] bg-orange-50'
                      : 'border-gray-200 hover:border-[#FF8C42]'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`w-5 h-5 ${isSelected ? 'text-[#FF8C42]' : 'text-gray-600'}`} />
                    <div className="text-left">
                      <p className={`font-semibold ${isSelected ? 'text-[#FF8C42]' : 'text-gray-900'}`}>
                        {method.name}
                      </p>
                      <p className="text-xs text-gray-500">{method.description}</p>
                    </div>
                  </div>
                  {isSelected && (
                    <Check className="w-5 h-5 text-[#FF8C42]" />
                  )}
                </button>
              );
            })}
          </div>
        </Card>
      </div>

      {/* Fixed Bottom Button */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 max-w-md mx-auto">
        <div className="flex items-center justify-between mb-3">
          <span className="text-gray-600">Total Payable</span>
          <span className="text-2xl font-bold text-[#FF8C42]">₹{finalAmount.toFixed(2)}</span>
        </div>
        <Button
          className="w-full bg-[#FF8C42] text-white hover:bg-[#FF7029]"
          onClick={handlePayment}
          disabled={loading}
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Processing...
            </>
          ) : 'Pay Securely'}
        </Button>
        <p className="text-xs text-gray-500 text-center mt-2">
          Secured by Razorpay • 256-bit encryption
        </p>
      </div>
    </div>
  );
}
