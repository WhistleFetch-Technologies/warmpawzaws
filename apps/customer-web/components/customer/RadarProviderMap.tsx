'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, Navigation, User, Briefcase, Star, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/lib/api-client';

interface Provider {
  id: string;
  name: string;
  photo?: string;
  rating: number;
  specialization?: string;
  coordinates: { lat: number; lng: number };
  distance: number;
  price: number;
  commuteTime?: number;
}

interface RadarProviderMapProps {
  userLocation: { lat: number; lng: number };
  radius: number; // in km
  serviceType: string;
  onSelectProvider: (provider: Provider) => void;
}

export function RadarProviderMap({ userLocation, radius, serviceType, onSelectProvider }: RadarProviderMapProps) {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(true);
  const [selectedPin, setSelectedPin] = useState<string | null>(null);

  useEffect(() => {
    // In production, this calls the backend geospatial query
    fetchProviders();
  }, [userLocation, radius, serviceType]);

  const fetchProviders = async () => {
    setLoading(true);
    setScanning(true);
    try {
        // Fetch from the new radar endpoint
        const data = await apiClient.get<{ providers?: any[] }>(`/customer/radar/providers?lat=${userLocation.lat}&lng=${userLocation.lng}&radius=${radius}&serviceType=${serviceType}`);
        
        if (data && data.providers && data.providers.length > 0) {
            // Transform backend data to frontend Provider interface
            const mappedProviders = (data.providers || []).map((p: any) => ({
                id: p.id,
                name: p.name,
                photo: p.photo,
                rating: p.rating,
                specialization: p.serviceType,
                coordinates: p.location || p.coordinates, // Backend might return either
                distance: parseFloat(p.distance),
                price: p.basePrice || 500, // Fallback price
                commuteTime: p.commuteTime
            }));
            setProviders(mappedProviders);
        } else {
            // Fallback for demo if backend returns empty or error
            console.warn("Radar endpoint failed, using mock data for demo");
            await new Promise(resolve => setTimeout(resolve, 1500)); 
            const mockProviders = Array.from({ length: 5 }).map((_, i) => ({
                id: `p-${i}`,
                name: `Provider ${i + 1}`,
                rating: 0,
                coordinates: {
                    lat: userLocation.lat + (Math.random() - 0.5) * 0.05,
                    lng: userLocation.lng + (Math.random() - 0.5) * 0.05
                },
                distance: Math.random() * 5,
                price: 500 + Math.floor(Math.random() * 500),
                specialization: serviceType
            }));
            setProviders(mockProviders);
        }
    } catch (e) {
        console.error(e);
    } finally {
        setLoading(false);
        setTimeout(() => setScanning(false), 2000); // Keep scanning effect a bit longer
    }
  };

  return (
    <div className="relative w-full h-[400px] bg-slate-900 rounded-xl overflow-hidden shadow-inner border border-slate-700">
      {/* Radar Effect Layer */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        {/* Radar Rings */}
        <div className="absolute w-[100px] h-[100px] border border-green-500/20 rounded-full" />
        <div className="absolute w-[200px] h-[200px] border border-green-500/20 rounded-full" />
        <div className="absolute w-[300px] h-[300px] border border-green-500/20 rounded-full" />
        
        {/* Scanning Line */}
        {scanning && (
            <motion.div 
                className="absolute w-[300px] h-[300px] bg-gradient-to-r from-transparent via-green-500/10 to-transparent rounded-full"
                animate={{ rotate: 360 }}
                transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                style={{ transformOrigin: 'center' }}
            />
        )}
      </div>

      {/* User Location Pin */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
        <div className="w-4 h-4 bg-blue-500 rounded-full border-2 border-white shadow-lg shadow-blue-500/50 animate-pulse" />
      </div>

      {/* Provider Pins */}
      {providers.map((provider) => {
        // Calculate relative position based on lat/lng diff (Simplified projection)
        // 1 deg lat approx 111km. Map view approx 10km radius.
        const latDiff = (provider.coordinates.lat - userLocation.lat) * 2000; 
        const lngDiff = (provider.coordinates.lng - userLocation.lng) * 2000;
        
        // Clamp to container bounds (simplified)
        const x = Math.min(Math.max(lngDiff, -180), 180);
        const y = Math.min(Math.max(latDiff, -180), 180); 

        return (
            <motion.div
                key={provider.id}
                className="absolute top-1/2 left-1/2 cursor-pointer group"
                style={{ x, y: -y }} // -y because lat goes up (screen Y goes down)
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: Math.random() * 0.5 }}
                onClick={() => setSelectedPin(provider.id)}
            >
                <div className={`relative flex flex-col items-center ${selectedPin === provider.id ? 'z-20' : 'z-10'}`}>
                    <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center shadow-lg transition-all ${
                        selectedPin === provider.id 
                        ? 'bg-orange-500 border-white scale-125' 
                        : 'bg-white border-orange-500 hover:scale-110'
                    }`}>
                        <User className={`w-4 h-4 ${selectedPin === provider.id ? 'text-white' : 'text-orange-500'}`} />
                    </div>
                    
                    {/* Tooltip on Hover/Select */}
                    <AnimatePresence>
                        {(selectedPin === provider.id) && (
                            <motion.div 
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: 5 }}
                                className="absolute bottom-10 bg-white p-3 rounded-lg shadow-xl w-48 text-left pointer-events-auto z-30"
                            >
                                <h4 className="font-bold text-gray-900 text-sm">{provider.name}</h4>
                                <div className="flex items-center gap-1 text-xs text-gray-600 mt-1">
                                    <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                                    <span>{Number(provider.rating || 0).toFixed(1)}</span>
                                    <span>•</span>
                                    <span>{Number(provider.distance || 0).toFixed(1)} km</span>
                                </div>
                                <div className="mt-2 flex justify-between items-center">
                                    <span className="font-bold text-orange-600">₹{provider.price}</span>
                                    <Button 
                                        size="sm" 
                                        className="h-7 text-xs bg-slate-900 hover:bg-slate-800 text-white"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onSelectProvider(provider);
                                        }}
                                    >
                                        Select
                                    </Button>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </motion.div>
        );
      })}

      {/* Controls */}
      <div className="absolute bottom-4 right-4 flex flex-col gap-2 z-20">
        <Button size="icon" variant="secondary" className="rounded-full shadow-lg" onClick={fetchProviders}>
            <Navigation className={`w-4 h-4 ${scanning ? 'animate-spin' : ''}`} />
        </Button>
      </div>
      
      {/* Legend */}
      <div className="absolute top-4 left-4 bg-black/50 backdrop-blur px-3 py-1.5 rounded-full text-xs text-white flex items-center gap-2 z-20">
        <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" /> You
        <div className="w-2 h-2 bg-white border border-orange-500 rounded-full ml-2" /> Provider
      </div>
    </div>
  );
}
