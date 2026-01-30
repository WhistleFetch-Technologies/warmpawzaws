import { useState } from 'react';
import { Button } from '../ui/button';
import { Stethoscope, Scissors, Heart } from 'lucide-react';
import { getApiBaseUrl, getAuthHeaders } from '../../utils/api-config';
import { toast } from 'sonner';

interface StaffLoginPageProps {
  onLoginSuccess: (staff: any) => void;
}

export function StaffLoginPage({ onLoginSuccess }: StaffLoginPageProps) {
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!phone || phone.length !== 10) {
      toast.error('Please enter a valid 10-digit mobile number');
      return;
    }

    try {
      setLoading(true);
      console.log('🔐 Staff login attempt:', phone);

      const response = await fetch(
        `${getApiBaseUrl()}/staff/auth/login`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...getAuthHeaders()
          },
          body: JSON.stringify({ phone })
        }
      );

      if (response.ok) {
        const data = await response.json();
        console.log('✅ Staff login successful:', data.staff);
        toast.success(`Welcome back, ${data.staff.fullName}!`);
        onLoginSuccess(data.staff);
      } else {
        const error = await response.json();
        console.error('❌ Staff login failed:', error);
        toast.error(error.error || 'Invalid phone number or staff not found');
      }
    } catch (error) {
      console.error('Error during staff login:', error);
      toast.error('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white w-full max-w-[430px] mx-auto">
      <div className="p-6">
        {/* Header */}
        <div className="text-center mb-8 pt-12">
          <div className="flex items-center justify-center gap-4 mb-4">
            <div className="w-12 h-12 bg-[#FF8C42] rounded-full flex items-center justify-center">
              <Stethoscope className="w-6 h-6 text-white" />
            </div>
            <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center">
              <Scissors className="w-6 h-6 text-white" />
            </div>
            <div className="w-12 h-12 bg-purple-500 rounded-full flex items-center justify-center">
              <Heart className="w-6 h-6 text-white" />
            </div>
          </div>
          <h1 className="text-gray-900 mb-2">Staff Login</h1>
          <p className="text-gray-600">
            For Veterinarians, Groomers, Trainers & Clinic Staff
          </p>
        </div>

        {/* Login Form */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-700 mb-2">
                Mobile Number
              </label>
              <div className="flex items-center border border-gray-300 rounded-lg p-3">
                <span className="text-gray-600 mr-2">+91</span>
                <input
                  type="tel"
                  maxLength={10}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                  placeholder="Enter your mobile number"
                  className="flex-1 outline-none"
                  disabled={loading}
                />
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Enter the mobile number registered by your clinic/business
              </p>
            </div>

            <Button
              onClick={handleLogin}
              disabled={loading || phone.length !== 10}
              className="w-full bg-[#FF8C42] hover:bg-[#ff7a28] text-white h-12"
            >
              {loading ? 'Logging in...' : 'Login'}
            </Button>
          </div>
        </div>

        {/* Info Card */}
        <div className="mt-6 bg-blue-50 rounded-xl p-4 border border-blue-100">
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-white text-sm">!</span>
            </div>
            <div>
              <h3 className="text-sm text-blue-900 mb-1">Staff Access</h3>
              <p className="text-xs text-blue-800">
                Your account is created and managed by your clinic or business owner. 
                Contact your administrator if you don't have login credentials.
              </p>
            </div>
          </div>
        </div>

        {/* Features */}
        <div className="mt-8 space-y-3">
          <h3 className="text-sm text-gray-700 mb-3">Staff Portal Features:</h3>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <span className="text-green-600">✓</span>
            </div>
            <span className="text-sm text-gray-700">View your appointments</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <span className="text-green-600">✓</span>
            </div>
            <span className="text-sm text-gray-700">Manage your schedule</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <span className="text-green-600">✓</span>
            </div>
            <span className="text-sm text-gray-700">Configure your services</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <span className="text-green-600">✓</span>
            </div>
            <span className="text-sm text-gray-700">Track your earnings & performance</span>
          </div>
        </div>
      </div>
    </div>
  );
}