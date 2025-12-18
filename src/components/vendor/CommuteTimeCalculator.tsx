import React, { useState } from 'react';
import { Navigation, MapPin, Clock } from 'lucide-react';

export function CommuteTimeCalculator({ providerId, apiUrl = `${import.meta.env.VITE_API_URL}/make-server-3dd53475` }) {
  const [fromLat, setFromLat] = useState('');
  const [fromLng, setFromLng] = useState('');
  const [toLat, setToLat] = useState('');
  const [toLng, setToLng] = useState('');
  const [result, setResult] = useState<any>(null);

  const calculate = async () => {
    const res = await fetch(`${apiUrl}/home-services/calculate-commute-time`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fromLat: parseFloat(fromLat),
        fromLng: parseFloat(fromLng),
        toLat: parseFloat(toLat),
        toLng: parseFloat(toLng),
        providerId,
      }),
    });
    const data = await res.json();
    setResult(data.data);
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-6">
      <h2 className="flex items-center gap-2">
        <Navigation className="w-6 h-6 text-blue-600" />
        Commute Time Calculator
      </h2>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block mb-2">From Latitude</label>
          <input type="number" value={fromLat} onChange={e => setFromLat(e.target.value)} className="w-full p-3 border rounded-lg" step="0.000001" />
        </div>
        <div>
          <label className="block mb-2">From Longitude</label>
          <input type="number" value={fromLng} onChange={e => setFromLng(e.target.value)} className="w-full p-3 border rounded-lg" step="0.000001" />
        </div>
        <div>
          <label className="block mb-2">To Latitude</label>
          <input type="number" value={toLat} onChange={e => setToLat(e.target.value)} className="w-full p-3 border rounded-lg" step="0.000001" />
        </div>
        <div>
          <label className="block mb-2">To Longitude</label>
          <input type="number" value={toLng} onChange={e => setToLng(e.target.value)} className="w-full p-3 border rounded-lg" step="0.000001" />
        </div>
      </div>
      <button onClick={calculate} className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700">
        Calculate Commute Time
      </button>
      {result && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-2">
          <div className="flex justify-between"><span>Distance:</span><span>{result.distance} km</span></div>
          <div className="flex justify-between"><span>Commute Time:</span><span>{result.commuteTime} min</span></div>
          <div className="flex justify-between"><span>Buffer Time:</span><span>{result.bufferTime} min</span></div>
          <div className="flex justify-between"><span>Total Time:</span><span className="font-medium">{result.totalTime} min</span></div>
          <div className="flex justify-between"><span>Est. Arrival:</span><span>{new Date(result.estimatedArrival).toLocaleTimeString()}</span></div>
        </div>
      )}
    </div>
  );
}
