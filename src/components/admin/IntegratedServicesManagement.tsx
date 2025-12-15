import React, { useState, useEffect } from 'react';
import { Check, X, Eye } from 'lucide-react';

export function IntegratedServicesManagement({ apiUrl = `${import.meta.env.VITE_API_URL}/make-server-3dd53475` }) {
  const [vendors, setVendors] = useState<any[]>([]);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved'>('all');

  useEffect(() => {
    loadVendors();
  }, [filter]);

  const loadVendors = async () => {
    const params = new URLSearchParams();
    if (filter !== 'all') params.append('approved', filter === 'approved' ? 'true' : 'false');
    const res = await fetch(`${apiUrl}/integrated-services/vendor/independent/list?${params}`);
    const data = await res.json();
    setVendors(data.data?.vendors || []);
  };

  const approveVendor = async (vendorId: string) => {
    await fetch(`${apiUrl}/integrated-services/vendor/independent/${vendorId}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isApproved: true }),
    });
    loadVendors();
  };

  const rejectVendor = async (vendorId: string) => {
    await fetch(`${apiUrl}/integrated-services/vendor/independent/${vendorId}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isApproved: false, rejectionReason: 'Does not meet criteria' }),
    });
    loadVendors();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1>Integrated Services Management</h1>
        <div className="flex gap-2">
          {['all', 'pending', 'approved'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f as any)}
              className={`px-4 py-2 rounded-lg capitalize ${
                filter === f ? 'bg-blue-600 text-white' : 'bg-gray-100'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left p-4">Vendor Name</th>
              <th className="text-left p-4">Type</th>
              <th className="text-left p-4">Location</th>
              <th className="text-center p-4">Status</th>
              <th className="text-center p-4">Actions</th>
            </tr>
          </thead>
          <tbody>
            {vendors.map(v => (
              <tr key={v.vendorId} className="border-b hover:bg-gray-50">
                <td className="p-4">{v.vendorName}</td>
                <td className="p-4 capitalize">{v.vendorType}</td>
                <td className="p-4 text-sm text-gray-600">{v.location.address}</td>
                <td className="p-4 text-center">
                  <span className={`px-2 py-1 rounded-full text-xs ${
                    v.isApproved ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {v.isApproved ? 'Approved' : 'Pending'}
                  </span>
                </td>
                <td className="p-4">
                  <div className="flex items-center justify-center gap-2">
                    {!v.isApproved && (
                      <>
                        <button
                          onClick={() => approveVendor(v.vendorId)}
                          className="p-2 bg-green-100 text-green-800 rounded hover:bg-green-200"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => rejectVendor(v.vendorId)}
                          className="p-2 bg-red-100 text-red-800 rounded hover:bg-red-200"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </>
                    )}
                    <button className="p-2 bg-blue-100 text-blue-800 rounded hover:bg-blue-200">
                      <Eye className="w-4 h-4" />
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
