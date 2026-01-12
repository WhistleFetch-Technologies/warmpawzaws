import React, { useState, useEffect } from 'react';
import { Calendar, Settings, Save } from 'lucide-react';

export function ReschedulingPolicyManager({ apiUrl = `${import.meta.env.VITE_API_URL}/make-server-3dd53475` }) {
  const [serviceType, setServiceType] = useState('grooming');
  const [policy, setPolicy] = useState<any>(null);
  const [allowRescheduling, setAllowRescheduling] = useState(true);
  const [maxReschedules, setMaxReschedules] = useState(2);
  const [minNoticeHours, setMinNoticeHours] = useState(24);
  const [refundType, setRefundType] = useState<'full' | 'partial' | 'none'>('partial');
  const [partialRefundPercentage, setPartialRefundPercentage] = useState(50);

  useEffect(() => {
    loadPolicy();
  }, [serviceType]);

  const loadPolicy = async () => {
    const res = await fetch(`${apiUrl}/booking/rescheduling-policy/${serviceType}`);
    const data = await res.json();
    const p = data.data?.policy;
    if (p) {
      setPolicy(p);
      setAllowRescheduling(p.allowRescheduling);
      setMaxReschedules(p.maxReschedules);
      setMinNoticeHours(p.minNoticeHours);
      if (p.refundPolicy.fullRefund) setRefundType('full');
      else if (p.refundPolicy.noRefund) setRefundType('none');
      else setRefundType('partial');
      setPartialRefundPercentage(p.refundPolicy.partialRefundPercentage || 50);
    }
  };

  const savePolicy = async () => {
    await fetch(`${apiUrl}/booking/rescheduling-policy/${serviceType}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        allowRescheduling,
        maxReschedules,
        minNoticeHours,
        refundPolicy: {
          fullRefund: refundType === 'full',
          partialRefundPercentage: refundType === 'partial' ? partialRefundPercentage : undefined,
          noRefund: refundType === 'none',
        },
      }),
    });
    loadPolicy();
  };

  const serviceTypes = [
    'grooming', 'training', 'veterinary', 'boarding', 'walking',
    'daycare', 'sitting', 'nutrition', 'photography', 'spa'
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Settings className="w-8 h-8 text-blue-600" />
        <div>
          <h1>Rescheduling Policy Manager</h1>
          <p className="text-gray-600">Configure rescheduling rules for each service type</p>
        </div>
      </div>

      <div>
        <label className="block mb-2">Service Type</label>
        <select
          value={serviceType}
          onChange={e => setServiceType(e.target.value)}
          className="w-full p-3 border border-gray-300 rounded-lg"
        >
          {serviceTypes.map(type => (
            <option key={type} value={type} className="capitalize">{type}</option>
          ))}
        </select>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-6">
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id="allowRescheduling"
            checked={allowRescheduling}
            onChange={e => setAllowRescheduling(e.target.checked)}
            className="w-5 h-5"
          />
          <label htmlFor="allowRescheduling">Allow Rescheduling</label>
        </div>

        {allowRescheduling && (
          <>
            <div>
              <label className="block mb-2">Maximum Reschedules Allowed</label>
              <input
                type="number"
                value={maxReschedules}
                onChange={e => setMaxReschedules(parseInt(e.target.value))}
                className="w-full p-3 border border-gray-300 rounded-lg"
                min={0}
                max={10}
              />
            </div>

            <div>
              <label className="block mb-2">Minimum Notice (hours)</label>
              <input
                type="number"
                value={minNoticeHours}
                onChange={e => setMinNoticeHours(parseInt(e.target.value))}
                className="w-full p-3 border border-gray-300 rounded-lg"
                min={0}
                max={168}
              />
            </div>

            <div>
              <label className="block mb-2">Refund Policy</label>
              <div className="space-y-2">
                {['full', 'partial', 'none'].map(type => (
                  <div key={type} className="flex items-center gap-2">
                    <input
                      type="radio"
                      id={`refund-${type}`}
                      checked={refundType === type}
                      onChange={() => setRefundType(type as any)}
                      className="w-4 h-4"
                    />
                    <label htmlFor={`refund-${type}`} className="capitalize">{type} Refund</label>
                  </div>
                ))}
              </div>
            </div>

            {refundType === 'partial' && (
              <div>
                <label className="block mb-2">Partial Refund Percentage</label>
                <input
                  type="number"
                  value={partialRefundPercentage}
                  onChange={e => setPartialRefundPercentage(parseInt(e.target.value))}
                  className="w-full p-3 border border-gray-300 rounded-lg"
                  min={0}
                  max={100}
                />
              </div>
            )}
          </>
        )}

        <button
          onClick={savePolicy}
          className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2"
        >
          <Save className="w-5 h-5" />
          Save Policy
        </button>
      </div>
    </div>
  );
}
