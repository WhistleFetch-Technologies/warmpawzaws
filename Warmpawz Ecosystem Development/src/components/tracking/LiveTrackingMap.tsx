import { useState, useEffect, useRef } from 'react';
import { Loader2, MapPin, Navigation, Phone } from 'lucide-react';
import { Button } from '../ui/button';
import { Card } from '../ui/card';

interface LiveTrackingMapProps {
  bookingId: string;
  walkerName: string;
  walkerPhone: string;
  petName: string;
  onClose: () => void;
}

export function LiveTrackingMap({ bookingId, walkerName, walkerPhone, petName, onClose }: LiveTrackingMapProps) {
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('Walk in progress');
  const [duration, setDuration] = useState('15:20');
  const [distance, setDistance] = useState('1.2 km');
  const mapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Simulate map loading
    const timer = setTimeout(() => {
      setLoading(false);
    }, 1500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col">
      {/* Header */}
      <div className="bg-white border-b px-4 py-3 flex items-center justify-between shadow-sm z-10">
        <div>
          <h3 className="font-semibold text-gray-900">Live Tracking</h3>
          <p className="text-xs text-green-600 flex items-center gap-1">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
            {status}
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose}>Close</Button>
      </div>

      {/* Map Area */}
      <div className="flex-1 relative bg-gray-100">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-20">
            <div className="flex flex-col items-center">
              <Loader2 className="w-8 h-8 text-[#FF8C42] animate-spin mb-2" />
              <p className="text-sm text-gray-500">Locating {walkerName}...</p>
            </div>
          </div>
        )}

        {/* Simulated Map */}
        <div className="absolute inset-0 bg-[#E5E7EB] overflow-hidden relative">
          {/* Map Background Pattern */}
          <div className="absolute inset-0 opacity-30" 
            style={{ 
              backgroundImage: 'radial-gradient(#9CA3AF 1px, transparent 1px)', 
              backgroundSize: '20px 20px' 
            }}
          ></div>
          
          {/* Streets (Simulated) */}
          <div className="absolute top-1/2 left-0 w-full h-4 bg-white transform -translate-y-1/2"></div>
          <div className="absolute top-0 left-1/2 h-full w-4 bg-white transform -translate-x-1/2"></div>
          <div className="absolute top-1/4 left-0 w-full h-2 bg-white"></div>
          <div className="absolute top-3/4 left-0 w-full h-2 bg-white"></div>
          
          {/* Path */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none">
             <path d="M 50% 50% Q 60% 40% 70% 30%" stroke="#FF8C42" strokeWidth="4" fill="none" strokeDasharray="8 4" className="animate-pulse" />
          </svg>

          {/* Walker Marker (Animated) */}
          <div className="absolute top-[30%] left-[70%] transform -translate-x-1/2 -translate-y-1/2 z-10">
             <div className="relative">
               <div className="w-12 h-12 bg-[#FF8C42] rounded-full border-4 border-white shadow-lg flex items-center justify-center animate-bounce">
                 <img 
                   src="https://images.unsplash.com/photo-1517423568366-69755254d7e1?auto=format&fit=crop&q=80&w=100" 
                   alt={walkerName}
                   className="w-full h-full rounded-full object-cover" 
                 />
               </div>
               <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 bg-black/70 text-white text-[10px] px-2 py-1 rounded-full whitespace-nowrap">
                 {walkerName} & {petName}
               </div>
             </div>
          </div>

          {/* Home Marker */}
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
            <div className="w-8 h-8 bg-blue-500 rounded-full border-2 border-white shadow-lg flex items-center justify-center">
              <MapPin className="w-4 h-4 text-white" />
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Card */}
      <div className="bg-white p-4 rounded-t-2xl shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] z-20">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gray-100 overflow-hidden">
              <img 
                src="https://images.unsplash.com/photo-1517423568366-69755254d7e1?auto=format&fit=crop&q=80&w=100" 
                alt={walkerName}
                className="w-full h-full object-cover" 
              />
            </div>
            <div>
              <h4 className="font-semibold text-gray-900">{walkerName}</h4>
              <p className="text-sm text-gray-500">Professional Walker</p>
            </div>
          </div>
          <Button size="icon" className="rounded-full bg-green-500 hover:bg-green-600">
            <Phone className="w-5 h-5" />
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="bg-orange-50 p-3 rounded-xl text-center">
            <p className="text-xs text-gray-500 mb-1">Duration</p>
            <p className="text-lg font-bold text-[#FF8C42]">{duration}</p>
          </div>
          <div className="bg-blue-50 p-3 rounded-xl text-center">
            <p className="text-xs text-gray-500 mb-1">Distance</p>
            <p className="text-lg font-bold text-blue-600">{distance}</p>
          </div>
        </div>
      </div>
    </div>
  );
}