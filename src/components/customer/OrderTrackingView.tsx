import { useState, useEffect } from 'react';
import { 
  ArrowLeft, 
  MapPin, 
  Phone, 
  Package,
  CheckCircle2,
  Clock,
  Truck,
  Home,
  Navigation
} from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';

interface OrderTrackingViewProps {
  order: any;
  onBack: () => void;
  onContactDelivery?: () => void;
}

export function OrderTrackingView({ order, onBack, onContactDelivery }: OrderTrackingViewProps) {
  const [currentLocation, setCurrentLocation] = useState({ lat: 12.9716, lng: 77.5946 });
  const [estimatedTime, setEstimatedTime] = useState('25 mins');

  // Mock tracking statuses
  const trackingSteps = [
    {
      status: 'Order Confirmed',
      timestamp: '2024-12-02, 10:30 AM',
      location: 'Warmpawz Warehouse, Bangalore',
      icon: CheckCircle2,
      completed: true
    },
    {
      status: 'Packed & Ready',
      timestamp: '2024-12-02, 02:15 PM',
      location: 'Warmpawz Warehouse, Bangalore',
      icon: Package,
      completed: true
    },
    {
      status: 'Out for Delivery',
      timestamp: '2024-12-03, 09:00 AM',
      location: 'Delivery Hub, Koramangala',
      icon: Truck,
      completed: true,
      active: true
    },
    {
      status: 'Delivered',
      timestamp: '',
      location: order.deliveryAddress,
      icon: Home,
      completed: false
    }
  ];

  const deliveryPartner = {
    name: 'Rajesh Kumar',
    phone: '+91 98765 43210',
    vehicle: 'Bike - KA01AB1234',
    rating: 4.8,
    deliveries: 2450
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200">
        <div className="px-4 py-3 flex items-center gap-3">
          <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-full">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="font-bold text-lg">Track Order</h1>
            <p className="text-sm text-gray-500">{order.orderNumber}</p>
          </div>
        </div>
      </div>

      <div className="pb-24">
        {/* Live Map */}
        <div className="relative h-80 bg-gradient-to-br from-blue-100 to-blue-200">
          {/* Simulated Map */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <div className="w-20 h-20 bg-blue-500 rounded-full flex items-center justify-center mb-4 animate-pulse mx-auto">
                <Truck className="w-10 h-10 text-white" />
              </div>
              <p className="text-gray-700 font-medium">Delivery in progress...</p>
              <p className="text-sm text-gray-600">Estimated arrival in {estimatedTime}</p>
            </div>
          </div>

          {/* Delivery Pin */}
          <div className="absolute top-16 right-8">
            <div className="relative">
              <div className="w-12 h-12 bg-green-500 rounded-full border-4 border-white shadow-lg flex items-center justify-center">
                <Home className="w-6 h-6 text-white" />
              </div>
              <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-1 h-2 bg-green-500" />
            </div>
          </div>

          {/* Live Location Button */}
          <button className="absolute bottom-4 right-4 bg-white p-3 rounded-full shadow-lg hover:shadow-xl transition-shadow">
            <Navigation className="w-5 h-5 text-[#FF8C42]" />
          </button>
        </div>

        {/* Delivery Partner Info */}
        <div className="bg-white p-4 mx-4 -mt-8 rounded-xl shadow-lg relative z-10 mb-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-[#FF8C42] rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-white text-xl">👤</span>
            </div>
            <div className="flex-1">
              <p className="font-semibold text-gray-900">{deliveryPartner.name}</p>
              <p className="text-sm text-gray-500">{deliveryPartner.vehicle}</p>
              <div className="flex items-center gap-2 mt-1">
                <div className="flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-green-500" />
                  <span className="text-xs text-gray-600">{deliveryPartner.deliveries} deliveries</span>
                </div>
                <span className="text-xs text-gray-400">•</span>
                <span className="text-xs text-gray-600">⭐ {deliveryPartner.rating}</span>
              </div>
            </div>
            <button 
              onClick={onContactDelivery}
              className="p-3 bg-green-100 hover:bg-green-200 rounded-full transition-colors"
            >
              <Phone className="w-5 h-5 text-green-600" />
            </button>
          </div>
        </div>

        {/* Estimated Delivery Time */}
        <div className="mx-4 mb-4 p-4 bg-gradient-to-r from-[#FF8C42] to-[#FF7028] rounded-xl text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm opacity-90 mb-1">Estimated Delivery</p>
              <p className="text-2xl font-bold">Today, {estimatedTime}</p>
            </div>
            <Clock className="w-12 h-12 opacity-90" />
          </div>
        </div>

        {/* Tracking Timeline */}
        <div className="bg-white p-6 mx-4 rounded-xl mb-4">
          <h2 className="font-semibold text-gray-900 mb-6">Tracking History</h2>
          <div className="relative">
            {trackingSteps.map((step, index) => (
              <div key={index} className="flex gap-4 pb-8 last:pb-0">
                {/* Timeline Line */}
                {index < trackingSteps.length - 1 && (
                  <div 
                    className={`absolute left-[15px] w-0.5 ${
                      step.completed ? 'bg-green-500' : 'bg-gray-200'
                    }`}
                    style={{ 
                      top: `${32 + index * 96}px`, 
                      height: '64px' 
                    }}
                  />
                )}
                
                {/* Icon */}
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                  step.active 
                    ? 'bg-[#FF8C42] animate-pulse' 
                    : step.completed 
                    ? 'bg-green-500' 
                    : 'bg-gray-200'
                }`}>
                  <step.icon className={`w-4 h-4 ${
                    step.completed || step.active ? 'text-white' : 'text-gray-400'
                  }`} />
                </div>

                {/* Content */}
                <div className="flex-1 pt-0.5">
                  <div className="flex items-start justify-between mb-1">
                    <p className={`font-medium ${
                      step.active 
                        ? 'text-[#FF8C42]' 
                        : step.completed 
                        ? 'text-gray-900' 
                        : 'text-gray-400'
                    }`}>
                      {step.status}
                    </p>
                    {step.active && (
                      <Badge className="bg-[#FF8C42] text-white">In Progress</Badge>
                    )}
                  </div>
                  
                  {step.timestamp && (
                    <p className="text-xs text-gray-500 mb-1">{step.timestamp}</p>
                  )}
                  
                  <div className="flex items-start gap-1 text-sm text-gray-600">
                    <MapPin className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <span>{step.location}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Package Details */}
        <div className="bg-white p-6 mx-4 rounded-xl">
          <h2 className="font-semibold text-gray-900 mb-4">Package Details</h2>
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Tracking Number</span>
              <span className="font-mono font-medium text-gray-900">{order.trackingNumber || 'TRK1234567890'}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Items</span>
              <span className="font-medium text-gray-900">{order.items?.length || 1} items</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Weight</span>
              <span className="font-medium text-gray-900">2.5 kg</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Shipping Method</span>
              <span className="font-medium text-gray-900">Standard Delivery</span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Actions */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 shadow-lg">
        <div className="flex gap-3">
          <Button
            onClick={onContactDelivery}
            variant="outline"
            className="flex-1 border-[#FF8C42] text-[#FF8C42] hover:bg-orange-50"
          >
            <Phone className="w-4 h-4 mr-2" />
            Call Delivery Partner
          </Button>
          <Button
            className="flex-1 bg-[#FF8C42] hover:bg-[#FF7028] text-white"
          >
            <MapPin className="w-4 h-4 mr-2" />
            Share Live Location
          </Button>
        </div>
      </div>
    </div>
  );
}
