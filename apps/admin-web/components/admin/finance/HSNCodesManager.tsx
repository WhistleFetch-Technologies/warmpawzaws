/**
 * HSN Codes Manager Component
 */

'use client';

import { useState } from 'react';
import { useHSNCodes, HSNCode } from '../../../hooks/useHSNCodes';
import { Button } from '@warmpawz/ui/button';

export function HSNCodesManager() {
  const { hsnCodes, loading, error, createHSNCode, updateHSNCode, deleteHSNCode } = useHSNCodes();
  const [showModal, setShowModal] = useState(false);
  const [editingCode, setEditingCode] = useState<HSNCode | null>(null);
  const [formData, setFormData] = useState<Partial<HSNCode>>({
    hsn_code: '',
    description: '',
    gst_rate: 18,
    is_active: true,
  });

  const handleOpenModal = (code?: HSNCode) => {
    if (code) {
      setEditingCode(code);
      setFormData(code);
    } else {
      setEditingCode(null);
      setFormData({
        hsn_code: '',
        description: '',
        gst_rate: 18,
        is_active: true,
      });
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingCode(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingCode) {
        await updateHSNCode(editingCode.id, formData);
      } else {
        await createHSNCode(formData);
      }
      handleCloseModal();
    } catch (err: any) {
      alert(err.message || 'Failed to save HSN code');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this HSN code?')) return;
    try {
      await deleteHSNCode(id);
    } catch (err: any) {
      alert(err.message || 'Failed to delete HSN code');
    }
  };

  if (loading) {
    return <div className="text-center py-8">Loading HSN codes...</div>;
  }

  if (error) {
    return <div className="text-center py-8 text-red-600">Error: {error}</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">HSN Codes</h3>
          <p className="text-sm text-gray-600">
            Manage HSN (Harmonized System of Nomenclature) codes for products and services
          </p>
        </div>
        <Button onClick={() => handleOpenModal()}>Create HSN Code</Button>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">HSN Code</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">GST Rate (%)</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {hsnCodes.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                  No HSN codes found. Create your first HSN code to get started.
                </td>
              </tr>
            ) : (
              hsnCodes.map((code) => (
                <tr key={code.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {code.hsn_code}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">{code.description || '-'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{code.gst_rate}%</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        code.is_active
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {code.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => handleOpenModal(code)}
                      className="text-orange-600 hover:text-orange-900 mr-4"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(code.id)}
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

      {showModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              {editingCode ? 'Edit HSN Code' : 'Create HSN Code'}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">HSN Code *</label>
                <input
                  type="text"
                  required
                  value={formData.hsn_code}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, hsn_code: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-orange-500 focus:border-orange-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={formData.description || ''}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-orange-500 focus:border-orange-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">GST Rate (%) *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  required
                  value={formData.gst_rate}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, gst_rate: parseFloat(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-orange-500 focus:border-orange-500"
                />
              </div>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={formData.is_active}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="h-4 w-4 text-orange-600 focus:ring-orange-500 border-gray-300 rounded"
                />
                <label htmlFor="is_active" className="ml-2 block text-sm text-gray-900">
                  Active
                </label>
              </div>
              <div className="flex justify-end space-x-3 pt-4">
                <Button type="button" variant="outline" onClick={handleCloseModal}>
                  Cancel
                </Button>
                <Button type="submit">Save</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

