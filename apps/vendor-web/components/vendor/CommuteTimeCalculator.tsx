'use client';

import React, { useState } from 'react';
import { Navigation, MapPin, Clock } from 'lucide-react';
import { apiClient } from '@/lib/api-client';

interface CommuteTimeCalculatorProps {
  providerId: string;
}

export function CommuteTimeCalculator({ providerId }: CommuteTimeCalculatorProps) {
  const [fromLat, setFromLat] = useState('');
  const [fromLng, setFromLng] = useState('');
  const [toLat, setToLat] = useState('');
  const [toLng, setToLng] = useState('');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const calculate = async () => {
    try {
      setLoading(true);
      const data = await apiClient.post<any>('/home-services/calculate-commute-time', {
        fromLat: parseFloat(fromLat),
        fromLng: parseFloat(fromLng),
        toLat: parseFloat(toLat),
        toLng: parseFloat(toLng),
        providerId,
      });
      setResult(data.data || data);
    } catch (error) {
      console.error('Error calculating commute time:', error);
      alert('Failed to calculate commute time');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-6">
      <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900">
        <Navigation className="w-6 h-6 text-blue-600" />
        Commute Time Calculator
      </h2>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block mb-2 text-sm font-medium text-gray-700">From Latitude</label>
          <input 
            type="number" 
            value={fromLat} 
            onChange={e => setFromLat(e.target.value)} 
            className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-orange-500" 
            step="0.000001" 
          />
        </div>
        <div>
          <label className="block mb-2 text-sm font-medium text-gray-700">From Longitude</label>
          <input 
            type="number" 
            value={fromLng} 
            onChange={e => setFromLng(e.target.value)} 
            className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-orange-500" 
            step="0.000001" 
          />
        </div>
        <div>
          <label className="block mb-2 text-sm font-medium text-gray-700">To Latitude</label>
          <input 
            type="number" 
            value={toLat} 
            onChange={e => setToLat(e.target.value)} 
            className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-orange-500" 
            step="0.000001" 
          />
        </div>
        <div>
          <label className="block mb-2 text-sm font-medium text-gray-700">To Longitude</label>
          <input 
            type="number" 
            value={toLng} 
            onChange={e => setToLng(e.target.value)} 
            className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-orange-500" 
            step="0.000001" 
          />
        </div>
      </div>
      <button 
        onClick={calculate} 
        disabled={loading}
        className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {loading ? (
          <>
            <Clock className="w-4 h-4 animate-spin" />
            Calculating...
          </>
        ) : (
          'Calculate Commute Time'
        )}
      </button>
      {result && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium text-gray-700">Distance:</span>
            <span className="text-sm text-gray-900">{result.distance} km</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium text-gray-700">Commute Time:</span>
            <span className="text-sm text-gray-900">{result.commuteTime} min</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium text-gray-700">Buffer Time:</span>
            <span className="text-sm text-gray-900">{result.bufferTime} min</span>
          </div>
          <div className="flex justify-between items-center border-t border-blue-200 pt-2">
            <span className="text-sm font-semibold text-gray-900">Total Time:</span>
            <span className="text-sm font-semibold text-gray-900">{result.totalTime} min</span>
          </div>
          {result.estimatedArrival && (
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-gray-700">Est. Arrival:</span>
              <span className="text-sm text-gray-900">{new Date(result.estimatedArrival).toLocaleTimeString()}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

