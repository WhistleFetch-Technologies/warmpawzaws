import React, { useState, useEffect } from 'react';
// Brand color: #FF8C42
import { DollarSign, Clock, Check, TrendingUp } from 'lucide-react';

/**
 * 💰 SETTLEMENT DASHBOARD
 * Phase 7C: Rule 15 - Vendor Settlements
 */

export function SettlementDashboard({ vendorId, apiUrl = `${import.meta.env.VITE_API_URL}/make-server-3dd53475` }) {
  const [settlements, setSettlements] = useState<any[]>([]);
  const [stats, setStats] = useState({ pending: 0, completed: 0, total: 0 });

  useEffect(() => {
    loadSettlements();
  }, [vendorId]);

  const loadSettlements = async () => {
    const res = await fetch(`${apiUrl}/payment/settlement/vendor/${vendorId}`);
    const data = await res.json();
    const s = data.data?.settlements || [];
    setSettlements(s);
    setStats({
      pending: s.filter((x: any) => x.status === 'pending').reduce((a: number, b: any) => a + b.netAmount, 0),
      completed: s.filter((x: any) => x.status === 'completed').reduce((a: number, b: any) => a + b.netAmount, 0),
      total: s.reduce((a: number, b: any) => a + b.netAmount, 0),
    });
  };

  return (
    <div className="space-y-6">
      <h2 className="flex items-center gap-2">
        <DollarSign className="w-6 h-6 text-green-600" />
        Settlement Dashboard
      </h2>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-5 h-5 text-yellow-600" />
            <span className="text-sm text-gray-600">Pending</span>
          </div>
          <div className="text-2xl text-yellow-800">₹{stats.pending.toLocaleString()}</div>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <Check className="w-5 h-5 text-green-600" />
            <span className="text-sm text-gray-600">Completed</span>
          </div>
          <div className="text-2xl text-green-800">₹{stats.completed.toLocaleString()}</div>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-5 h-5 text-blue-600" />
            <span className="text-sm text-gray-600">Total</span>
          </div>
          <div className="text-2xl text-blue-800">₹{stats.total.toLocaleString()}</div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left p-4">Date</th>
              <th className="text-left p-4">Booking ID</th>
              <th className="text-right p-4">Amount</th>
              <th className="text-right p-4">Commission</th>
              <th className="text-right p-4">Net Amount</th>
              <th className="text-center p-4">Status</th>
            </tr>
          </thead>
          <tbody>
            {settlements.map(s => (
              <tr key={s.settlementId} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="p-4 text-sm">{new Date(s.createdAt).toLocaleDateString()}</td>
                <td className="p-4 text-sm text-gray-600">{s.bookingId}</td>
                <td className="p-4 text-sm text-right">₹{s.amount.toLocaleString()}</td>
                <td className="p-4 text-sm text-right text-red-600">-₹{s.commission.toLocaleString()}</td>
                <td className="p-4 text-sm text-right">₹{s.netAmount.toLocaleString()}</td>
                <td className="p-4 text-center">
                  <span className={`px-2 py-1 rounded-full text-xs ${
                    s.status === 'completed' ? 'bg-green-100 text-green-800' :
                    s.status === 'processing' ? 'bg-blue-100 text-blue-800' :
                    'bg-yellow-100 text-yellow-800'
                  }`}>
                    {s.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
