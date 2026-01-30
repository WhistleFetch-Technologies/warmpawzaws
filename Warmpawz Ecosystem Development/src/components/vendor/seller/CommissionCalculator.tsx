import { useState, useEffect } from 'react';
import { Calculator, DollarSign, Percent, TrendingUp, Info, Calendar } from 'lucide-react';
import { getApiBaseUrl, getAuthHeaders } from '../../../utils/api-config';

interface CommissionCalculatorProps {
  sellerId: string;
}

export function CommissionCalculator({ sellerId }: CommissionCalculatorProps) {
  const [commissionSettings, setCommissionSettings] = useState<any>(null);
  const [analytics, setAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [calculatorAmount, setCalculatorAmount] = useState('');
  const [calculatorResult, setCalculatorResult] = useState<any>(null);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));

  useEffect(() => {
    loadData();
  }, [sellerId]);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Load commission settings
      const settingsRes = await fetch(
        `${getApiBaseUrl()}/ecommerce/commission/settings`,
        { headers: getAuthHeaders() }
      );
      
      if (settingsRes.ok) {
        const data = await settingsRes.json();
        setCommissionSettings(data.settings);
      }

      // Load seller analytics
      const analyticsRes = await fetch(
        `${getApiBaseUrl()}/ecommerce/analytics/seller/${sellerId}`,
        { headers: getAuthHeaders() }
      );
      
      if (analyticsRes.ok) {
        const data = await analyticsRes.json();
        setAnalytics(data);
      }
    } catch (error) {
      console.error('Error loading commission data:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateCommission = async () => {
    const amount = parseFloat(calculatorAmount);
    if (!amount || amount <= 0) return;

    try {
      const res = await fetch(
        `${getApiBaseUrl()}/ecommerce/commission/calculate`,
        {
          method: 'POST',
          headers: {
            ...getAuthHeaders(),
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ sellerId, amount })
        }
      );

      if (res.ok) {
        const data = await res.json();
        setCalculatorResult(data);
      }
    } catch (error) {
      console.error('Error calculating commission:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full p-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF8C42]"></div>
      </div>
    );
  }

  const currentRate = analytics?.commissionRate || commissionSettings?.defaultRate || 15;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-black">Commission Calculator</h1>
        <p className="text-gray-500 mt-1">Calculate platform fees and track your earnings</p>
      </div>

      {/* Current Commission Rate */}
      <div className="bg-gradient-to-r from-[#FF8C42] to-[#FFA562] rounded-xl p-8 text-white shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Percent className="w-6 h-6" />
              <h2 className="text-xl font-semibold">Your Commission Rate</h2>
            </div>
            <p className="text-white/90">This is the platform fee charged on all your sales</p>
          </div>
          <div className="text-right">
            <p className="text-5xl font-bold">{currentRate}%</p>
            <p className="text-white/90 mt-1">Platform Fee</p>
          </div>
        </div>

        {/* Info Box */}
        <div className="mt-6 bg-white/10 backdrop-blur-sm rounded-lg p-4">
          <div className="flex items-start gap-2">
            <Info className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium">How it works:</p>
              <ul className="mt-2 space-y-1 text-white/90">
                <li>• Commission is calculated on the total order value</li>
                <li>• You receive the remaining amount after commission</li>
                <li>• Payments are processed within 7 working days</li>
                <li>• GST is applicable on commission amount</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Monthly Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-50 rounded-lg">
              <DollarSign className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-gray-500 text-sm">Total Revenue</p>
              <p className="text-black text-2xl mt-1">₹{analytics?.totalRevenue?.toLocaleString() || 0}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-red-50 rounded-lg">
              <Percent className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <p className="text-gray-500 text-sm">Commission Paid</p>
              <p className="text-black text-2xl mt-1">₹{analytics?.totalCommission?.toLocaleString() || 0}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-green-50 rounded-lg">
              <TrendingUp className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-gray-500 text-sm">Net Earnings</p>
              <p className="text-black text-2xl mt-1">₹{analytics?.netEarnings?.toLocaleString() || 0}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Commission Calculator Tool */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-6">
          <Calculator className="w-6 h-6 text-[#FF8C42]" />
          <h2 className="text-black text-xl font-semibold">Calculate Commission</h2>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Enter Sale Amount (₹)
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={calculatorAmount}
              onChange={(e) => setCalculatorAmount(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && calculateCommission()}
              placeholder="0.00"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF8C42] text-lg"
            />
            <button
              onClick={calculateCommission}
              className="w-full mt-4 bg-[#FF8C42] text-white px-4 py-3 rounded-lg hover:bg-[#E67A32] transition-colors font-medium"
            >
              Calculate
            </button>
          </div>

          {/* Result */}
          <div className="bg-gray-50 rounded-lg p-6">
            {calculatorResult ? (
              <div className="space-y-4">
                <h3 className="font-semibold text-black mb-4">Breakdown</h3>
                
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Sale Amount:</span>
                  <span className="font-medium text-black">₹{calculatorResult.amount.toLocaleString()}</span>
                </div>

                <div className="border-t border-gray-200 pt-3 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Commission ({calculatorResult.rate}%):</span>
                    <span className="font-medium text-red-600">- ₹{calculatorResult.commission.toFixed(2)}</span>
                  </div>

                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">GST on Commission (18%):</span>
                    <span className="font-medium text-gray-600">₹{calculatorResult.gst.toFixed(2)}</span>
                  </div>
                </div>

                <div className="border-t-2 border-gray-300 pt-3 flex justify-between">
                  <span className="font-bold text-black">You will receive:</span>
                  <span className="font-bold text-green-600 text-xl">₹{calculatorResult.sellerEarnings.toFixed(2)}</span>
                </div>

                <div className="bg-blue-50 rounded-lg p-3 mt-4">
                  <p className="text-xs text-blue-900">
                    <strong>Note:</strong> Actual payout may vary based on payment gateway charges and other fees.
                  </p>
                </div>
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-gray-400">
                <div className="text-center">
                  <Calculator className="w-12 h-12 mx-auto mb-2" />
                  <p className="text-sm">Enter an amount to calculate</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Commission Tiers Info */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        <h2 className="text-black text-xl font-semibold mb-4">Commission Structure</h2>
        <div className="space-y-3">
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div>
              <p className="font-medium text-black">Standard Rate</p>
              <p className="text-sm text-gray-500">Default commission for all categories</p>
            </div>
            <span className="text-xl font-bold text-[#FF8C42]">{commissionSettings?.defaultRate || 15}%</span>
          </div>

          {commissionSettings?.categoryRates && Object.keys(commissionSettings.categoryRates).length > 0 && (
            <>
              <p className="text-sm text-gray-600 mt-4 mb-2">Category-specific rates:</p>
              {Object.entries(commissionSettings.categoryRates).map(([category, rate]: [string, any]) => (
                <div key={category} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <span className="text-black capitalize">{category.replace('_', ' ')}</span>
                  <span className="font-bold text-[#FF8C42]">{rate}%</span>
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
