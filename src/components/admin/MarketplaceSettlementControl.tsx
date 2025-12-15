import React, { useState, useEffect } from 'react';
import { DollarSign, Clock, Check, AlertCircle } from 'lucide-react';

export function MarketplaceSettlementControl({ apiUrl = `${import.meta.env.VITE_API_URL}/make-server-3dd53475` }) {
  const [settlements, setSettlements] = useState<any[]>([]);

  useEffect(() => {
    loadSettlements();
  }, []);

  const loadSettlements = async () => {
    const res = await fetch(`${apiUrl}/payment/settlement/pending`);
    const data = await res.json();
    setSettlements(data.data?.settlements || []);
  };

  const processSettlement = async (settlementId: string, status: 'completed' | 'failed') => {
    await fetch(`${apiUrl}/payment/settlement/${settlementId}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, razorpayPayoutId: `payout_${Date.now()}` }),
    });
    loadSettlements();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <DollarSign className="w-8 h-8 text-green-600" />
        <div>
          <h1>Marketplace Settlement Control</h1>
          <p className="text-gray-600">{settlements.length} pending settlements</p>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left p-4">Settlement ID</th>
              <th className="text-left p-4">Vendor ID</th>
              <th className="text-right p-4">Amount</th>
              <th className="text-right p-4">Commission</th>
              <th className="text-right p-4">Net Amount</th>
              <th className="text-center p-4">Scheduled</th>
              <th className="text-center p-4">Actions</th>
            </tr>
          </thead>
          <tbody>
            {settlements.map(s => (
              <tr key={s.settlementId} className="border-b hover:bg-gray-50">
                <td className="p-4 text-sm font-mono">{s.settlementId.slice(0, 20)}...</td>
                <td className="p-4 text-sm">{s.vendorId}</td>
                <td className="p-4 text-right">₹{s.amount.toLocaleString()}</td>
                <td className="p-4 text-right text-red-600">-₹{s.commission.toLocaleString()}</td>
                <td className="p-4 text-right">₹{s.netAmount.toLocaleString()}</td>
                <td className="p-4 text-center text-sm">{new Date(s.scheduledAt).toLocaleDateString()}</td>
                <td className="p-4">
                  <div className="flex items-center justify-center gap-2">
                    <button
                      onClick={() => processSettlement(s.settlementId, 'completed')}
                      className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 text-sm"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => processSettlement(s.settlementId, 'failed')}
                      className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 text-sm"
                    >
                      Reject
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
