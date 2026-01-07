/**
 * Payment Gateway Management Component
 * 
 * Main component for payment gateway management in Finance & Logistics tab
 * Follows existing design philosophy and UI migration patterns
 */

'use client';

import { useState } from 'react';
import { usePaymentGateways, PaymentGateway } from '../../../hooks/usePaymentGateways';
import { Button } from '@warmpawz/ui/button';

export function PaymentGatewayManagement() {
  const { gateways, loading, error, createGateway, updateGateway, deleteGateway } = usePaymentGateways();
  const [showModal, setShowModal] = useState(false);
  const [editingGateway, setEditingGateway] = useState<PaymentGateway | null>(null);
  const [formData, setFormData] = useState<Partial<PaymentGateway>>({
    gateway_name: '',
    gateway_type: 'razorpay',
    enabled: true,
    test_mode: true,
    marketplace_mode: true,
    config: {},
  });

  const handleOpenModal = (gateway?: PaymentGateway) => {
    if (gateway) {
      setEditingGateway(gateway);
      setFormData(gateway);
    } else {
      setEditingGateway(null);
      setFormData({
        gateway_name: '',
        gateway_type: 'razorpay',
        enabled: true,
        test_mode: true,
        marketplace_mode: true,
        config: {},
      });
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingGateway(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingGateway) {
        await updateGateway(editingGateway.id, formData);
      } else {
        await createGateway(formData);
      }
      handleCloseModal();
    } catch (err: any) {
      alert(err.message || 'Failed to save payment gateway');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this payment gateway?')) return;
    try {
      await deleteGateway(id);
    } catch (err: any) {
      alert(err.message || 'Failed to delete payment gateway');
    }
  };

  if (loading) {
    return <div className="text-center py-8">Loading payment gateways...</div>;
  }

  if (error) {
    return <div className="text-center py-8 text-red-600">Error: {error}</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-2xl shadow-sm p-6">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Payment Gateway Management</h2>
            <p className="text-gray-600">
              Configure payment gateways for processing payments (Razorpay, Stripe, PayPal, Paytm)
            </p>
          </div>
          <Button onClick={() => handleOpenModal()}>Add Gateway</Button>
        </div>
      </div>

      {/* Gateways List */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Gateway Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Key ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Mode
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {gateways.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-4 text-center text-gray-500">
                    No payment gateways found. Add your first gateway to get started.
                  </td>
                </tr>
              ) : (
                gateways.map((gateway) => (
                  <tr key={gateway.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{gateway.gateway_name}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                        {gateway.gateway_type}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {gateway.key_id ? `${gateway.key_id.substring(0, 10)}...` : 'Not set'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        gateway.test_mode ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'
                      }`}>
                        {gateway.test_mode ? 'Test' : 'Live'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        gateway.enabled ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                      }`}>
                        {gateway.enabled ? 'Enabled' : 'Disabled'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => handleOpenModal(gateway)}
                        className="text-orange-600 hover:text-orange-900 mr-4"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(gateway.id)}
                        className="text-red-600 hover:text-red-900"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                {editingGateway ? 'Edit Payment Gateway' : 'Add Payment Gateway'}
              </h3>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Gateway Name</label>
                  <input
                    type="text"
                    value={formData.gateway_name || ''}
                    onChange={(e) => setFormData({ ...formData, gateway_name: e.target.value })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-orange-500 focus:ring-orange-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Gateway Type</label>
                  <select
                    value={formData.gateway_type || 'razorpay'}
                    onChange={(e) => setFormData({ ...formData, gateway_type: e.target.value as any })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-orange-500 focus:ring-orange-500"
                    required
                  >
                    <option value="razorpay">Razorpay</option>
                    <option value="stripe">Stripe</option>
                    <option value="paypal">PayPal</option>
                    <option value="paytm">Paytm</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Key ID</label>
                  <input
                    type="text"
                    value={formData.key_id || ''}
                    onChange={(e) => setFormData({ ...formData, key_id: e.target.value })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-orange-500 focus:ring-orange-500"
                    placeholder="rzp_test_..."
                  />
                </div>
                <div className="flex items-center space-x-4">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={formData.enabled ?? true}
                      onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
                      className="h-4 w-4 text-orange-600 focus:ring-orange-500 border-gray-300 rounded"
                    />
                    <span className="ml-2 block text-sm text-gray-900">Enabled</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={formData.test_mode ?? true}
                      onChange={(e) => setFormData({ ...formData, test_mode: e.target.checked })}
                      className="h-4 w-4 text-orange-600 focus:ring-orange-500 border-gray-300 rounded"
                    />
                    <span className="ml-2 block text-sm text-gray-900">Test Mode</span>
                  </label>
                </div>
                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={handleCloseModal}
                    className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-orange-500 text-white rounded-md hover:bg-orange-600"
                  >
                    {editingGateway ? 'Update' : 'Create'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

