import { Calendar, Clock, Users, DollarSign } from 'lucide-react';

interface SubscriptionConfig {
  enabled: boolean;
  subscriptionType: 'weekly' | 'monthly' | 'one-time';
  sessionConfig: {
    walksPerDay: number;
    sessionDuration: string;
    numberOfDays: number;
    daysOfWeek: string[];
  };
  pricing: {
    weekly: {
      oneWalk: number;
      twoWalks: number;
    };
    monthly: {
      oneWalk: number;
      twoWalks: number;
    };
  };
}

interface ServiceSubscriptionPreviewProps {
  serviceName: string;
  basePrice: number;
  subscriptionConfig: SubscriptionConfig | null;
}

export function ServiceSubscriptionPreview({ 
  serviceName, 
  basePrice,
  subscriptionConfig 
}: ServiceSubscriptionPreviewProps) {
  
  if (!subscriptionConfig?.enabled) {
    return (
      <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
        <p className="text-sm text-gray-500 text-center">
          No subscription plans configured for this service
        </p>
      </div>
    );
  }

  const { sessionConfig, pricing } = subscriptionConfig;
  const activeDays = sessionConfig.daysOfWeek.map(day => 
    day.charAt(0).toUpperCase() + day.slice(1, 3)
  ).join(', ');

  return (
    <div className="space-y-4">
      {/* Service Overview */}
      <div className="bg-gradient-to-br from-[#FF8C42]/10 to-[#FF6B1A]/10 rounded-xl p-4 border border-[#FF8C42]/30">
        <h4 className="text-sm mb-3">{serviceName}</h4>
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-[#FF8C42]" />
            <div>
              <div className="text-gray-500">Duration</div>
              <div>{sessionConfig.sessionDuration}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-[#FF8C42]" />
            <div>
              <div className="text-gray-500">Sessions/Day</div>
              <div>{sessionConfig.walksPerDay}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-[#FF8C42]" />
            <div>
              <div className="text-gray-500">Active Days</div>
              <div className="truncate">{activeDays || 'All days'}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-[#FF8C42]" />
            <div>
              <div className="text-gray-500">One-time</div>
              <div>₹{basePrice}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Subscription Plans */}
      <div className="space-y-2">
        <h5 className="text-xs text-gray-500">Subscription Plans</h5>
        
        <div className="grid grid-cols-2 gap-3">
          {/* Weekly Plans */}
          {pricing.weekly.oneWalk > 0 && (
            <div className="bg-white rounded-lg p-3 border border-blue-200">
              <div className="text-xs text-blue-600 mb-1">Weekly - 1 Session</div>
              <div className="text-lg">₹{pricing.weekly.oneWalk}</div>
              <div className="text-xs text-gray-500 mt-1">
                {sessionConfig.numberOfDays} days
              </div>
            </div>
          )}
          
          {pricing.weekly.twoWalks > 0 && (
            <div className="bg-white rounded-lg p-3 border border-blue-200">
              <div className="text-xs text-blue-600 mb-1">Weekly - 2 Sessions</div>
              <div className="text-lg">₹{pricing.weekly.twoWalks}</div>
              <div className="text-xs text-gray-500 mt-1">
                {sessionConfig.numberOfDays} days
              </div>
            </div>
          )}
          
          {/* Monthly Plans */}
          {pricing.monthly.oneWalk > 0 && (
            <div className="bg-white rounded-lg p-3 border border-green-200">
              <div className="text-xs text-green-600 mb-1">Monthly - 1 Session</div>
              <div className="text-lg">₹{pricing.monthly.oneWalk}</div>
              <div className="text-xs text-gray-500 mt-1">
                {sessionConfig.numberOfDays} days
              </div>
            </div>
          )}
          
          {pricing.monthly.twoWalks > 0 && (
            <div className="bg-white rounded-lg p-3 border border-green-200">
              <div className="text-xs text-green-600 mb-1">Monthly - 2 Sessions</div>
              <div className="text-lg">₹{pricing.monthly.twoWalks}</div>
              <div className="text-xs text-gray-500 mt-1">
                {sessionConfig.numberOfDays} days
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
