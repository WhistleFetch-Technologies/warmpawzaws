import { useState } from 'react';
import { getApiBaseUrl, getAuthHeaders } from '../../utils/api-config';
import { useAuth } from '../../context/AuthContext';
import { Ticket, Loader2, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { toast } from 'sonner@2.0.3';

interface CouponInputProps {
  orderAmount: number;
  targetIds?: string[]; // IDs of items/categories in cart
  onCouponApplied: (couponData: any) => void; // Callback with valid coupon data
  onCouponRemoved: () => void;
  className?: string;
}

export function CouponInput({ 
  orderAmount, 
  targetIds = [], 
  onCouponApplied, 
  onCouponRemoved,
  className 
}: CouponInputProps) {
  const { user, accessToken } = useAuth();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [appliedCoupon, setAppliedCoupon] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleValidate = async () => {
    if (!code.trim()) return;
    
    try {
      setLoading(true);
      setError(null);
      
      const headers: any = {
        'apikey': publicAnonKey,
        'Content-Type': 'application/json'
      };
      
      if (accessToken) {
        headers['Authorization'] = `Bearer ${accessToken}`;
      }

      const res = await fetch(
        `${getApiBaseUrl()}/coupons/validate`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({
            code: code.trim(),
            orderAmount,
            customerId: user?.id,
            targetIds
          })
        }
      );

      const data = await res.json();

      if (data.success && data.valid) {
        setAppliedCoupon(data.coupon);
        onCouponApplied(data.coupon);
        toast.success(`Coupon '${data.coupon.code}' applied! Saved ₹${data.coupon.discountAmount}`);
      } else {
        setError(data.error || 'Invalid coupon');
        setAppliedCoupon(null);
        onCouponRemoved();
      }
    } catch (err) {
      console.error('Error validating coupon:', err);
      setError('Failed to validate coupon');
      setAppliedCoupon(null);
      onCouponRemoved();
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = () => {
    setCode('');
    setAppliedCoupon(null);
    setError(null);
    onCouponRemoved();
  };

  return (
    <div className={`bg-white rounded-xl border border-gray-200 p-4 ${className}`}>
      <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
        <Ticket className="w-4 h-4 text-[#FF8C42]" />
        Offers & Coupons
      </h4>

      {appliedCoupon ? (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-start justify-between">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5" />
            <div>
              <p className="font-medium text-green-900">
                '{appliedCoupon.code}' applied
              </p>
              <p className="text-sm text-green-700">
                You saved <span className="font-bold">₹{appliedCoupon.discountAmount}</span>
              </p>
            </div>
          </div>
          <button 
            onClick={handleRemove}
            className="text-xs text-red-600 hover:text-red-700 font-medium underline"
          >
            Remove
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Input
                placeholder="Enter coupon code"
                value={code}
                onChange={(e) => {
                  setCode(e.target.value.toUpperCase());
                  setError(null);
                }}
                className={`uppercase placeholder:normal-case ${error ? 'border-red-300 focus-visible:ring-red-200' : ''}`}
                onKeyDown={(e) => e.key === 'Enter' && handleValidate()}
              />
            </div>
            <Button 
              onClick={handleValidate} 
              disabled={!code.trim() || loading}
              className="bg-[#FF8C42] hover:bg-[#E67A32] text-white shrink-0"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Apply'}
            </Button>
          </div>
          
          {error && (
            <div className="flex items-center gap-2 text-red-600 text-sm animate-in slide-in-from-top-1">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
