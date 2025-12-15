import React, { useState, useEffect } from 'react';
import { Clock, MapPin, Settings } from 'lucide-react';

/**
 * 🗓️ MULTI-SERVICE SCHEDULING POLICY
 * Phase 7C: Rule 2 - Vendor Settings
 */

export function MultiServiceSchedulingPolicy({ vendorId, apiUrl = `${import.meta.env.VITE_API_URL}/make-server-3dd53475` }) {
  const [policy, setPolicy] = useState<any>(null);
  const [editing, setEditing] = useState(false);
  const [bufferTime, setBufferTime] = useState(15);
  const [commuteAllowance, setCommuteAllowance] = useState(15);
  const [serviceRadius, setServiceRadius] = useState(10);
  const [multiServiceEnabled, setMultiServiceEnabled] = useState(true);

  useEffect(() => {
    loadPolicy();
  }, [vendorId]);

  const loadPolicy = async () => {
    const res = await fetch(`${apiUrl}/home-services/scheduling-policy/${vendorId}`);
    const data = await res.json();
    const p = data.data?.policy;
    if (p) {
      setPolicy(p);
      setBufferTime(p.bufferTimeBetweenServices);
      setCommuteAllowance(p.commuteTimeAllowance);
      setServiceRadius(p.serviceRadius);
      setMultiServiceEnabled(p.multiServiceEnabled);
    }
  };

  const savePolicy = async () => {
    await fetch(`${apiUrl}/home-services/scheduling-policy/${vendorId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bufferTimeBetweenServices: bufferTime,
        commuteTimeAllowance: commuteAllowance,
        serviceRadius,
        multiServiceEnabled,
      }),
    });
    setEditing(false);
    loadPolicy();
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2">
          <Settings className="w-6 h-6" />
          Multi-Service Scheduling Policy
        </h2>
        <button
          onClick={() => setEditing(!editing)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          {editing ? 'Cancel' : 'Edit'}
        </button>
      </div>

      <div className="space-y-4">
        <div>
          <label className="flex items-center gap-2 mb-2">
            <Clock className="w-5 h-5" />
            Buffer Time Between Services (minutes)
          </label>
          <input
            type="number"
            value={bufferTime}
            onChange={e => setBufferTime(parseInt(e.target.value))}
            disabled={!editing}
            className="w-full p-3 border border-gray-300 rounded-lg disabled:bg-gray-50"
            min={5}
            max={60}
          />
        </div>

        <div>
          <label className="block mb-2">Commute Time Allowance (minutes)</label>
          <input
            type="number"
            value={commuteAllowance}
            onChange={e => setCommuteAllowance(parseInt(e.target.value))}
            disabled={!editing}
            className="w-full p-3 border border-gray-300 rounded-lg disabled:bg-gray-50"
            min={5}
            max={60}
          />
        </div>

        <div>
          <label className="flex items-center gap-2 mb-2">
            <MapPin className="w-5 h-5" />
            Service Radius (km)
          </label>
          <input
            type="number"
            value={serviceRadius}
            onChange={e => setServiceRadius(parseInt(e.target.value))}
            disabled={!editing}
            className="w-full p-3 border border-gray-300 rounded-lg disabled:bg-gray-50"
            min={1}
            max={50}
          />
        </div>

        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id="multiService"
            checked={multiServiceEnabled}
            onChange={e => setMultiServiceEnabled(e.target.checked)}
            disabled={!editing}
            className="w-5 h-5"
          />
          <label htmlFor="multiService">Enable Multi-Service Bookings</label>
        </div>
      </div>

      {editing && (
        <button
          onClick={savePolicy}
          className="w-full bg-green-600 text-white py-3 rounded-lg hover:bg-green-700"
        >
          Save Changes
        </button>
      )}
    </div>
  );
}
