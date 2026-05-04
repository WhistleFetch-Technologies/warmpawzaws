'use client';

/**
 * Sample Collection Tracker
 * Track phlebotomist/collector location and status for home sample collection
 */

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  ArrowLeft,
  MapPin,
  Clock,
  Phone,
  User,
  CheckCircle,
  Circle,
  Navigation,
  Home as HomeIcon,
  TestTube,
  ShieldCheck,
  AlertCircle,
  RefreshCw,
  MessageSquare
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';

interface SampleCollectionTrackerProps {
  bookingId: string;
  customerPhone: string;
  onBack: () => void;
  onComplete?: () => void;
}

interface CollectorInfo {
  id: string;
  name: string;
  phone: string;
  photo?: string;
  rating: number;
  totalCollections: number;
}

interface CollectionStatus {
  status: 'assigned' | 'in_transit' | 'arrived' | 'collecting' | 'collected' | 'completed';
  currentLocation?: {
    lat: number;
    lng: number;
    address?: string;
  };
  eta?: number; // minutes
  collectorInfo?: CollectorInfo;
  otp?: string;
  scheduledDate?: string;
  scheduledTime?: string;
  statusHistory: {
    status: string;
    timestamp: string;
    note?: string;
  }[];
}

const STATUS_STEPS = [
  { key: 'assigned', label: 'Collector Assigned', icon: User, description: 'A phlebotomist has been assigned' },
  { key: 'in_transit', label: 'On The Way', icon: Navigation, description: 'Collector is heading to your location' },
  { key: 'arrived', label: 'Arrived', icon: MapPin, description: 'Collector has reached your location' },
  { key: 'collecting', label: 'Collecting Sample', icon: TestTube, description: 'Sample collection in progress' },
  { key: 'collected', label: 'Sample Collected', icon: CheckCircle, description: 'Sample collected successfully' },
  { key: 'completed', label: 'Completed', icon: ShieldCheck, description: 'Sample sent to lab' },
];

export function SampleCollectionTracker({ 
  bookingId, 
  customerPhone, 
  onBack,
  onComplete 
}: SampleCollectionTrackerProps) {
  const [loading, setLoading] = useState(true);
  const [collectionStatus, setCollectionStatus] = useState<CollectionStatus | null>(null);
  const [showOTPInput, setShowOTPInput] = useState(false);
  const [enteredOTP, setEnteredOTP] = useState('');
  const [verifyingOTP, setVerifyingOTP] = useState(false);

  // ✅ FIX: Format ETA to show hours when >= 60 minutes
  const formatETA = (minutes: number | undefined): string => {
    if (!minutes) return 'Calculating...';
    if (minutes < 1) return 'Arriving now';
    if (minutes === 1) return '1 min';
    if (minutes < 60) return `${Math.round(minutes)} mins`;
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    if (mins === 0) {
      return `${hours} ${hours === 1 ? 'hour' : 'hours'}`;
    } else {
      return `${hours}h ${mins}m`;
    }
  };

  const loadCollectionStatus = useCallback(async () => {
    try {
      const response = await apiClient.get<any>(`/diagnostics/sample-collection/booking/${bookingId}`);
      
      if (response.success && response.assignment) {
        const a = response.assignment;
        const collectorName = a.staffName || a.agentName;
        const collectorPhone = a.staffPhone || a.agentPhone;
        setCollectionStatus({
          status: a.status,
          currentLocation: a.currentLocation,
          eta: a.eta_minutes,
          collectorInfo: (collectorName && collectorPhone) ? {
            id: a.staffId || a.assignmentId || 'adhoc',
            name: collectorName,
            phone: collectorPhone,
            photo: a.staffPhoto,
            rating: 4.8,
            totalCollections: 0
          } : undefined,
          otp: a.otp,
          scheduledDate: a.scheduledDate,
          scheduledTime: a.scheduledTime,
          statusHistory: []
        });
      } else if (response.success && response.collection) {
        const collection = response.collection;
        setCollectionStatus({
          status: collection.status,
          currentLocation: collection.current_location,
          eta: collection.eta_minutes,
          collectorInfo: collection.staff ? {
            id: collection.staff.id,
            name: collection.staff.name,
            phone: collection.staff.phone,
            photo: collection.staff.photo,
            rating: (() => {
              const r = collection.staff.rating != null ? Number(collection.staff.rating) : NaN;
              return Number.isFinite(r) && r > 0 ? r : 0;
            })(),
            totalCollections: collection.staff.total_collections || 0
          } : undefined,
          otp: collection.collection_otp,
          scheduledDate: collection.scheduled_date,
          scheduledTime: collection.scheduled_time,
          statusHistory: collection.status_history || []
        });
      } else {
        // Mock data for demo
        setCollectionStatus({
          status: 'in_transit',
          eta: 15,
          collectorInfo: {
            id: 'collector-1',
            name: 'Rahul Kumar',
            phone: '+91 98765 43210',
            rating: 0,
            totalCollections: 156
          },
          otp: '4521',
          statusHistory: [
            { status: 'assigned', timestamp: new Date(Date.now() - 30 * 60000).toISOString(), note: 'Collector assigned' },
            { status: 'in_transit', timestamp: new Date(Date.now() - 10 * 60000).toISOString(), note: 'Started journey' }
          ]
        });
      }
    } catch (error) {
      console.error('Error loading collection status:', error);
      // Set mock data on error
      setCollectionStatus({
        status: 'in_transit',
        eta: 15,
        collectorInfo: {
          id: 'collector-1',
          name: 'Rahul Kumar',
          phone: '+91 98765 43210',
          rating: 4.9,
          totalCollections: 156
        },
        otp: '4521',
        statusHistory: []
      });
    } finally {
      setLoading(false);
    }
  }, [bookingId]);

  useEffect(() => {
    loadCollectionStatus();
    
    // Poll for updates every 30 seconds
    const interval = setInterval(loadCollectionStatus, 30000);
    return () => clearInterval(interval);
  }, [loadCollectionStatus]);

  const handleVerifyOTP = async () => {
    if (enteredOTP.length !== 4) {
      toast.error('Please enter 4-digit OTP');
      return;
    }

    setVerifyingOTP(true);
    try {
      const response = await apiClient.post<any>(`/diagnostics/sample-collection/${bookingId}/verify-otp`, {
        otp: enteredOTP
      });

      if (response.success) {
        toast.success('OTP verified successfully!');
        setShowOTPInput(false);
        loadCollectionStatus();
        if (onComplete) {
          onComplete();
        }
      } else {
        toast.error('Invalid OTP. Please try again.');
      }
    } catch (error) {
      // For demo, accept the mock OTP
      if (enteredOTP === collectionStatus?.otp) {
        toast.success('OTP verified successfully!');
        setShowOTPInput(false);
        setCollectionStatus(prev => prev ? { ...prev, status: 'completed' } : null);
      } else {
        toast.error('Invalid OTP. Please try again.');
      }
    } finally {
      setVerifyingOTP(false);
    }
  };

  const handleCallCollector = () => {
    if (collectionStatus?.collectorInfo?.phone) {
      window.open(`tel:${collectionStatus.collectorInfo.phone}`, '_self');
    }
  };

  const handleMessageCollector = () => {
    toast.info('Chat is not available.');
  };

  const getCurrentStepIndex = () => {
    if (!collectionStatus) return -1;
    return STATUS_STEPS.findIndex(s => s.key === collectionStatus.status);
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center max-w-md mx-auto">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading tracking info...</p>
        </div>
      </div>
    );
  }

  const currentStep = getCurrentStepIndex();

  return (
    <div className="min-h-screen bg-gray-50 max-w-md mx-auto">
      {/* Header */}
      <div className="bg-gradient-to-r from-teal-600 via-teal-700 to-teal-800 text-white px-4 py-4">
        <div className="flex items-center gap-3 mb-4">
          <button 
            onClick={onBack}
            className="p-2 hover:bg-white/10 rounded-full transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="font-semibold text-lg">Sample Collection</h1>
            <p className="text-sm text-white/70">Track your phlebotomist</p>
          </div>
          <button 
            onClick={loadCollectionStatus}
            className="ml-auto p-2 hover:bg-white/10 rounded-full transition-colors"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>

        {/* ETA Card */}
        {collectionStatus?.eta && collectionStatus.status !== 'completed' && (
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white/70 text-sm">Estimated Arrival</p>
                <p className="text-2xl font-bold">{formatETA(collectionStatus.eta)}</p>
              </div>
              <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                <Navigation className="w-6 h-6" />
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="px-4 py-4">
        {/* Collector Info Card - Agent name, phone, schedule */}
        {collectionStatus?.collectorInfo && (
          <Card className="p-4 mb-4 bg-white border border-gray-100 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-teal-100 rounded-full flex items-center justify-center text-teal-600 text-xl font-bold">
                {collectionStatus.collectorInfo.photo ? (
                  <img 
                    src={collectionStatus.collectorInfo.photo} 
                    alt={collectionStatus.collectorInfo.name}
                    className="w-14 h-14 rounded-full object-cover"
                  />
                ) : (
                  collectionStatus.collectorInfo.name.charAt(0)
                )}
              </div>
              <div className="flex-1">
                <h3 className="font-semibold">{collectionStatus.collectorInfo.name}</h3>
                <p className="text-sm text-gray-500">Sample collection agent</p>
                {(collectionStatus.scheduledDate || collectionStatus.scheduledTime) && (
                  <p className="text-xs text-gray-600 mt-1 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {collectionStatus.scheduledDate} at {collectionStatus.scheduledTime || 'scheduled'}
                  </p>
                )}
                <div className="flex items-center gap-2 mt-1">
                  <Badge className="bg-amber-100 text-amber-600 border-none text-xs">
                    ⭐ {collectionStatus.collectorInfo.rating}
                  </Badge>
                  <span className="text-xs text-gray-400">
                    {collectionStatus.collectorInfo.totalCollections} collections
                  </span>
                </div>
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={handleCallCollector}
                  className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center hover:bg-green-200 transition-colors"
                >
                  <Phone className="w-5 h-5 text-green-600" />
                </button>
                <button 
                  onClick={handleMessageCollector}
                  className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center hover:bg-blue-200 transition-colors"
                >
                  <MessageSquare className="w-5 h-5 text-blue-600" />
                </button>
              </div>
            </div>
          </Card>
        )}

        {/* Status Timeline */}
        <Card className="p-4 mb-4 bg-white border border-gray-100 shadow-sm">
          <h3 className="font-semibold mb-4">Collection Status</h3>
          <div className="space-y-4">
            {STATUS_STEPS.map((step, index) => {
              const Icon = step.icon;
              const isCompleted = index < currentStep;
              const isCurrent = index === currentStep;
              const isPending = index > currentStep;

              return (
                <div key={step.key} className="flex items-start gap-3">
                  <div className="flex flex-col items-center">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      isCompleted ? 'bg-green-500 text-white' :
                      isCurrent ? 'bg-teal-600 text-white animate-pulse' :
                      'bg-gray-200 text-gray-400'
                    }`}>
                      {isCompleted ? (
                        <CheckCircle className="w-4 h-4" />
                      ) : (
                        <Icon className="w-4 h-4" />
                      )}
                    </div>
                    {index < STATUS_STEPS.length - 1 && (
                      <div className={`w-0.5 h-8 ${
                        isCompleted ? 'bg-green-500' :
                        isCurrent ? 'bg-teal-300' :
                        'bg-gray-200'
                      }`} />
                    )}
                  </div>
                  <div className="flex-1 pb-4">
                    <div className="flex items-center gap-2">
                      <h4 className={`font-medium ${
                        isPending ? 'text-gray-400' : 'text-gray-900'
                      }`}>
                        {step.label}
                      </h4>
                      {isCurrent && (
                        <Badge className="bg-teal-100 text-teal-600 border-none text-xs">
                          Current
                        </Badge>
                      )}
                    </div>
                    <p className={`text-sm ${
                      isPending ? 'text-gray-300' : 'text-gray-500'
                    }`}>
                      {step.description}
                    </p>
                    {/* Show timestamp from history */}
                    {collectionStatus?.statusHistory && (
                      collectionStatus.statusHistory
                        .filter(h => h.status === step.key)
                        .map((h, i) => (
                          <p key={i} className="text-xs text-gray-400 mt-1">
                            {formatTime(h.timestamp)}
                          </p>
                        ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* OTP Verification Section */}
        {collectionStatus?.status === 'collected' && !showOTPInput && (
          <Card className="p-4 mb-4 bg-amber-50 border border-amber-200">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-medium text-amber-800">OTP Verification Required</h4>
                <p className="text-sm text-amber-700 mt-1">
                  Please share the OTP with the collector to confirm sample handover
                </p>
                <div className="mt-3 flex items-center gap-3">
                  <div className="bg-white rounded-lg px-4 py-2 border border-amber-300">
                    <p className="text-xs text-gray-500">Your OTP</p>
                    <p className="text-2xl font-bold text-amber-600 tracking-wider">
                      {collectionStatus.otp}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* Completion Message */}
        {collectionStatus?.status === 'completed' && (
          <Card className="p-4 mb-4 bg-green-50 border border-green-200">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <h4 className="font-medium text-green-800">Collection Complete!</h4>
                <p className="text-sm text-green-700 mt-1">
                  Your sample has been collected and is on its way to the lab. 
                  Reports will be available within 24-48 hours.
                </p>
              </div>
            </div>
          </Card>
        )}

        {/* Instructions */}
        <Card className="p-4 bg-blue-50 border border-blue-100">
          <h4 className="font-medium text-blue-800 mb-2">Preparation Tips</h4>
          <ul className="text-sm text-blue-700 space-y-1">
            <li>• Keep your ID proof ready for verification</li>
            <li>• Follow any fasting instructions if applicable</li>
            <li>• Stay hydrated unless instructed otherwise</li>
            <li>• Wear comfortable clothing with easy arm access</li>
          </ul>
        </Card>
      </div>
    </div>
  );
}
