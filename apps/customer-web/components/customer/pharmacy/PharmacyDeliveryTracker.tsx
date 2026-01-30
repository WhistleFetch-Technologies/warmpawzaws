'use client';

/**
 * ============================================================================
 * PHARMACY DELIVERY TRACKER - Live Tracking & Status Updates
 * ============================================================================
 * 
 * Features:
 * - Live ETA updates from logistics partner
 * - Status timeline (picked up, on the way, arriving, delivered)
 * - Map view with delivery partner location (optional)
 * - Delivery OTP display
 * - Call delivery partner
 * 
 * Design: Zomato/Swiggy-like tracking experience
 * ============================================================================
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MapPin, Truck, Package, Building2, CheckCircle2, Clock,
  Phone, Navigation, AlertCircle, Key, Eye, EyeOff, Copy, Check,
  ChevronRight, User, Bike, Car
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

interface DeliveryStatus {
  status: 'preparing' | 'ready' | 'picked_up' | 'on_the_way' | 'arriving' | 'delivered';
  timestamp: string;
  message?: string;
}

interface PharmacyDeliveryTrackerProps {
  orderId: string;
  pharmacyName: string;
  pharmacyAddress: string;
  pharmacyPhone?: string;
  deliveryAddress: string;
  deliveryPartner?: {
    name: string;
    phone: string;
    vehicleNumber?: string;
    vehicleType?: 'bike' | 'car' | 'auto';
    photo?: string;
  };
  currentStatus: DeliveryStatus['status'];
  statusHistory: DeliveryStatus[];
  estimatedDelivery?: {
    minutes: number;
    time: string; // e.g., "2:30 PM"
  };
  deliveryOtp?: string;
  otpVerified?: boolean;
  liveLocation?: {
    lat: number;
    lng: number;
    lastUpdated: string;
  };
  onRefresh?: () => void;
  onCallPartner?: () => void;
}

export function PharmacyDeliveryTracker({
  orderId,
  pharmacyName,
  pharmacyAddress,
  pharmacyPhone,
  deliveryAddress,
  deliveryPartner,
  currentStatus,
  statusHistory,
  estimatedDelivery,
  deliveryOtp,
  otpVerified,
  liveLocation,
  onRefresh,
  onCallPartner
}: PharmacyDeliveryTrackerProps) {
  const [showOTP, setShowOTP] = useState(false);
  const [copiedOTP, setCopiedOTP] = useState(false);
  const [animateStatus, setAnimateStatus] = useState(false);

  // Trigger animation when status changes
  useEffect(() => {
    setAnimateStatus(true);
    const timer = setTimeout(() => setAnimateStatus(false), 1000);
    return () => clearTimeout(timer);
  }, [currentStatus]);

  const copyOTP = () => {
    if (deliveryOtp) {
      navigator.clipboard.writeText(deliveryOtp);
      setCopiedOTP(true);
      toast.success('OTP copied to clipboard');
      setTimeout(() => setCopiedOTP(false), 2000);
    }
  };

  const getStatusConfig = (status: DeliveryStatus['status']) => {
    const configs = {
      preparing: {
        icon: Package,
        color: 'text-yellow-600',
        bgColor: 'bg-yellow-100',
        borderColor: 'border-yellow-300',
        label: 'Preparing',
        description: 'Pharmacy is preparing your order'
      },
      ready: {
        icon: CheckCircle2,
        color: 'text-blue-600',
        bgColor: 'bg-blue-100',
        borderColor: 'border-blue-300',
        label: 'Ready for Pickup',
        description: 'Order is ready, waiting for delivery partner'
      },
      picked_up: {
        icon: Truck,
        color: 'text-purple-600',
        bgColor: 'bg-purple-100',
        borderColor: 'border-purple-300',
        label: 'Picked Up',
        description: 'Delivery partner picked up your order'
      },
      on_the_way: {
        icon: Navigation,
        color: 'text-orange-600',
        bgColor: 'bg-orange-100',
        borderColor: 'border-orange-300',
        label: 'On The Way',
        description: 'Your order is on the way!'
      },
      arriving: {
        icon: MapPin,
        color: 'text-green-600',
        bgColor: 'bg-green-100',
        borderColor: 'border-green-300',
        label: 'Arriving Soon',
        description: 'Delivery partner is near your location'
      },
      delivered: {
        icon: CheckCircle2,
        color: 'text-green-700',
        bgColor: 'bg-green-200',
        borderColor: 'border-green-400',
        label: 'Delivered',
        description: 'Order delivered successfully!'
      }
    };
    return configs[status] || configs.preparing;
  };

  const statusOrder: DeliveryStatus['status'][] = ['preparing', 'ready', 'picked_up', 'on_the_way', 'arriving', 'delivered'];
  const currentStatusIndex = statusOrder.indexOf(currentStatus);
  const config = getStatusConfig(currentStatus);
  const StatusIcon = config.icon;

  const VehicleIcon = deliveryPartner?.vehicleType === 'car' ? Car : Bike;

  return (
    <div className="space-y-6">
      {/* Main Status Card */}
      <motion.div
        className={`rounded-2xl border-2 ${config.borderColor} ${config.bgColor} p-6`}
        animate={animateStatus ? { scale: [1, 1.02, 1] } : {}}
        transition={{ duration: 0.3 }}
      >
        <div className="flex items-center gap-4">
          <motion.div
            className={`w-16 h-16 rounded-full ${config.bgColor} flex items-center justify-center`}
            animate={currentStatus === 'on_the_way' || currentStatus === 'arriving' ? { scale: [1, 1.1, 1] } : {}}
            transition={{ duration: 1, repeat: currentStatus === 'on_the_way' || currentStatus === 'arriving' ? Infinity : 0 }}
          >
            <StatusIcon className={`w-8 h-8 ${config.color}`} />
          </motion.div>
          <div className="flex-1">
            <Badge className={`${config.bgColor} ${config.color} border ${config.borderColor} mb-2`}>
              {config.label}
            </Badge>
            <p className="text-gray-700 font-medium">{config.description}</p>
          </div>
        </div>

        {/* ETA Display */}
        {estimatedDelivery && currentStatus !== 'delivered' && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-gray-600" />
                <span className="text-gray-600 font-medium">Estimated Delivery</span>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-gray-900">{estimatedDelivery.minutes} min</p>
                <p className="text-sm text-gray-500">by {estimatedDelivery.time}</p>
              </div>
            </div>
          </div>
        )}
      </motion.div>

      {/* Status Timeline */}
      <Card className="p-5">
        <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Clock className="w-5 h-5 text-orange-500" />
          Order Timeline
        </h3>
        
        <div className="relative">
          {/* Timeline Line */}
          <div className="absolute left-[18px] top-0 bottom-0 w-0.5 bg-gray-200" />
          
          {/* Timeline Items */}
          <div className="space-y-6">
            {statusOrder.map((status, index) => {
              const itemConfig = getStatusConfig(status);
              const ItemIcon = itemConfig.icon;
              const isCompleted = index <= currentStatusIndex;
              const isCurrent = status === currentStatus;
              const historyItem = statusHistory.find(h => h.status === status);
              
              return (
                <motion.div
                  key={status}
                  className="relative flex items-start gap-4"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  {/* Timeline Dot */}
                  <div className={`relative z-10 w-9 h-9 rounded-full flex items-center justify-center ${
                    isCompleted 
                      ? isCurrent 
                        ? `${itemConfig.bgColor} ring-4 ring-opacity-50 ${itemConfig.borderColor.replace('border', 'ring')}`
                        : 'bg-green-500'
                      : 'bg-gray-200'
                  }`}>
                    {isCompleted ? (
                      isCurrent ? (
                        <ItemIcon className={`w-5 h-5 ${itemConfig.color}`} />
                      ) : (
                        <CheckCircle2 className="w-5 h-5 text-white" />
                      )
                    ) : (
                      <div className="w-3 h-3 rounded-full bg-gray-300" />
                    )}
                    {/* Pulse for current status */}
                    {isCurrent && (
                      <motion.div
                        className={`absolute inset-0 rounded-full ${itemConfig.bgColor}`}
                        animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }}
                        transition={{ duration: 2, repeat: Infinity }}
                      />
                    )}
                  </div>
                  
                  {/* Content */}
                  <div className={`flex-1 pb-2 ${!isCompleted ? 'opacity-40' : ''}`}>
                    <div className="flex items-center justify-between">
                      <p className={`font-medium ${isCurrent ? itemConfig.color : 'text-gray-900'}`}>
                        {itemConfig.label}
                      </p>
                      {historyItem && (
                        <span className="text-xs text-gray-500">
                          {new Date(historyItem.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      )}
                    </div>
                    {historyItem?.message && (
                      <p className="text-sm text-gray-500 mt-1">{historyItem.message}</p>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </Card>

      {/* Delivery Partner Card */}
      {deliveryPartner && (currentStatus === 'picked_up' || currentStatus === 'on_the_way' || currentStatus === 'arriving') && (
        <Card className="p-5 border-2 border-purple-200 bg-purple-50">
          <h3 className="font-semibold text-purple-900 mb-4 flex items-center gap-2">
            <Truck className="w-5 h-5 text-purple-600" />
            Delivery Partner
          </h3>
          
          <div className="flex items-center gap-4">
            {/* Partner Photo/Avatar */}
            <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center">
              {deliveryPartner.photo ? (
                <img src={deliveryPartner.photo} alt={deliveryPartner.name} className="w-full h-full rounded-full object-cover" />
              ) : (
                <User className="w-8 h-8 text-purple-600" />
              )}
            </div>
            
            <div className="flex-1">
              <p className="font-semibold text-purple-900">{deliveryPartner.name}</p>
              {deliveryPartner.vehicleNumber && (
                <div className="flex items-center gap-2 mt-1">
                  <VehicleIcon className="w-4 h-4 text-purple-600" />
                  <span className="text-sm text-purple-700">{deliveryPartner.vehicleNumber}</span>
                </div>
              )}
            </div>
            
            {/* Call Button */}
            <Button
              variant="outline"
              className="border-purple-300 text-purple-700 hover:bg-purple-100"
              onClick={() => {
                if (deliveryPartner.phone) {
                  window.location.href = `tel:${deliveryPartner.phone}`;
                }
              }}
            >
              <Phone className="w-5 h-5" />
            </Button>
          </div>

          {/* Live Location Indicator */}
          {liveLocation && (
            <div className="mt-4 pt-4 border-t border-purple-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <motion.div
                    className="w-3 h-3 bg-green-500 rounded-full"
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ duration: 1, repeat: Infinity }}
                  />
                  <span className="text-sm text-purple-700">Live tracking active</span>
                </div>
                <span className="text-xs text-purple-500">
                  Updated {new Date(liveLocation.lastUpdated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Delivery OTP Card */}
      {deliveryOtp && !otpVerified && (currentStatus === 'on_the_way' || currentStatus === 'arriving') && (
        <Card className="p-5 border-2 border-orange-200 bg-gradient-to-br from-orange-50 to-orange-100">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Key className="w-5 h-5 text-orange-600" />
            <h3 className="font-bold text-orange-800 text-lg">Your Delivery OTP</h3>
          </div>
          
          {/* Large OTP Display */}
          <div className="flex justify-center gap-3 mb-4">
            {deliveryOtp.split('').map((digit, idx) => (
              <motion.div
                key={idx}
                className="w-14 h-16 bg-white rounded-xl shadow-sm border-2 border-orange-300 flex items-center justify-center"
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: idx * 0.1 }}
              >
                <span className="text-3xl font-bold text-orange-600">
                  {showOTP ? digit : '•'}
                </span>
              </motion.div>
            ))}
          </div>
          
          {/* Toggle & Copy Buttons */}
          <div className="flex justify-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowOTP(!showOTP)}
              className="border-orange-300 text-orange-700 hover:bg-orange-50"
            >
              {showOTP ? (
                <>
                  <EyeOff className="w-4 h-4 mr-2" />
                  Hide OTP
                </>
              ) : (
                <>
                  <Eye className="w-4 h-4 mr-2" />
                  Show OTP
                </>
              )}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={copyOTP}
              className="border-orange-300 text-orange-700 hover:bg-orange-50"
            >
              {copiedOTP ? (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 mr-2" />
                  Copy OTP
                </>
              )}
            </Button>
          </div>
          
          {/* Instructions */}
          <div className="mt-4 text-center">
            <p className="text-orange-700 text-sm font-medium">
              Share this OTP with the delivery partner to confirm delivery
            </p>
            <p className="text-orange-600 text-xs mt-1">
              Only share after receiving your medicines
            </p>
          </div>
        </Card>
      )}

      {/* OTP Verified Success */}
      {otpVerified && currentStatus === 'delivered' && (
        <Card className="p-5 bg-green-50 border-2 border-green-200">
          <motion.div
            className="flex items-center justify-center gap-3"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
          >
            <CheckCircle2 className="w-8 h-8 text-green-600" />
            <div>
              <h3 className="font-bold text-green-800">Delivery Confirmed!</h3>
              <p className="text-sm text-green-600">Your order has been delivered successfully</p>
            </div>
          </motion.div>
        </Card>
      )}

      {/* Location Cards */}
      <div className="space-y-3">
        {/* Pharmacy Location */}
        <Card className="p-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
              <Building2 className="w-5 h-5 text-blue-600" />
            </div>
            <div className="flex-1">
              <p className="text-xs text-gray-500">Pickup From</p>
              <p className="font-semibold text-gray-900">{pharmacyName}</p>
              <p className="text-sm text-gray-600">{pharmacyAddress}</p>
            </div>
            {pharmacyPhone && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => window.location.href = `tel:${pharmacyPhone}`}
              >
                <Phone className="w-4 h-4 text-gray-500" />
              </Button>
            )}
          </div>
        </Card>

        {/* Dotted Line Connector */}
        <div className="flex justify-center">
          <div className="h-8 w-px border-l-2 border-dashed border-gray-300" />
        </div>

        {/* Delivery Location */}
        <Card className="p-4 border-2 border-green-200 bg-green-50">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
              <MapPin className="w-5 h-5 text-green-600" />
            </div>
            <div className="flex-1">
              <p className="text-xs text-gray-500">Deliver To</p>
              <p className="font-semibold text-gray-900">Your Location</p>
              <p className="text-sm text-gray-600">{deliveryAddress}</p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
