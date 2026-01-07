/**
 * Tax Rules Manager Component
 * 
 * Manages tax rules with priority-based matching
 */

'use client';

import { useState } from 'react';
import { useTaxRules, TaxRule } from '../../../hooks/useTaxRules';
import { Button } from '@warmpawz/ui/button';

export function TaxRulesManager() {
  const { taxRules, loading, error, createTaxRule, updateTaxRule, deleteTaxRule } = useTaxRules();
  const [showModal, setShowModal] = useState(false);
  const [editingRule, setEditingRule] = useState<TaxRule | null>(null);
  const [formData, setFormData] = useState<Partial<TaxRule>>({
    rule_name: '',
    enabled: true,
    priority: 100,
    gst_type: 'percentage',
    gst_rate: 18,
    cgst_percentage: 9,
    sgst_percentage: 9,
    igst_percentage: 18,
  });

  const handleOpenModal = (rule?: TaxRule) => {
    if (rule) {
      setEditingRule(rule);
      setFormData(rule);
    } else {
      setEditingRule(null);
      setFormData({
        rule_name: '',
        enabled: true,
        priority: 100,
        gst_type: 'percentage',
        gst_rate: 18,
        cgst_percentage: 9,
        sgst_percentage: 9,
        igst_percentage: 18,
      });
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingRule(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingRule) {
        await updateTaxRule(editingRule.id, formData);
      } else {
        await createTaxRule(formData);
      }
      handleCloseModal();
    } catch (err: any) {
      alert(err.message || 'Failed to save tax rule');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this tax rule?')) return;
    try {
      await deleteTaxRule(id);
    } catch (err: any) {
      alert(err.message || 'Failed to delete tax rule');
    }
  };

  if (loading) {
    return <div className="text-center py-8">Loading tax rules...</div>;
  }

  if (error) {
    return <div className="text-center py-8 text-red-600">Error: {error}</div>;
  }

  return (
    <div className="space-y-4">
      {/* Header Actions */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Tax Rules</h3>
          <p className="text-sm text-gray-600">
            Configure tax rules with priority-based matching for different services and locations
          </p>
        </div>
        <Button onClick={() => handleOpenModal()}>Create Tax Rule</Button>
      </div>

      {/* Rules List */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Rule Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Priority
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                GST Rate
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Conditions
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
            {taxRules.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                  No tax rules found. Create your first tax rule to get started.
                </td>
              </tr>
            ) : (
              taxRules.map((rule) => (
                <tr key={rule.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{rule.rule_name}</div>
                    {rule.description && (
                      <div className="text-sm text-gray-500">{rule.description}</div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {rule.priority}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {rule.gst_rate}%
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    <div className="space-y-1">
                      {rule.role_name && <div>Role: {rule.role_name}</div>}
                      {rule.service_style && <div>Style: {rule.service_style}</div>}
                      {rule.category && <div>Category: {rule.category}</div>}
                      {rule.customer_state && <div>Customer State: {rule.customer_state}</div>}
                      {rule.vendor_state && <div>Vendor State: {rule.vendor_state}</div>}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        rule.enabled
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {rule.enabled ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => handleOpenModal(rule)}
                      className="text-orange-600 hover:text-orange-900 mr-4"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(rule.id)}
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

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 max-w-3xl shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                {editingRule ? 'Edit Tax Rule' : 'Create Tax Rule'}
              </h3>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Rule Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.rule_name}
                      onChange={(e) => setFormData({ ...formData, rule_name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-orange-500 focus:border-orange-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Priority *
                    </label>
                    <input
                      type="number"
                      required
                      value={formData.priority}
                      onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-orange-500 focus:border-orange-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      GST Rate (%) *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      required
                      value={formData.gst_rate}
                      onChange={(e) => setFormData({ ...formData, gst_rate: parseFloat(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-orange-500 focus:border-orange-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      GST Type
                    </label>
                    <select
                      value={formData.gst_type}
                      onChange={(e) => setFormData({ ...formData, gst_type: e.target.value as 'percentage' | 'fixed' })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-orange-500 focus:border-orange-500"
                    >
                      <option value="percentage">Percentage</option>
                      <option value="fixed">Fixed</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      CGST (%)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.cgst_percentage || ''}
                      onChange={(e) => setFormData({ ...formData, cgst_percentage: parseFloat(e.target.value) || undefined })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-orange-500 focus:border-orange-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      SGST (%)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.sgst_percentage || ''}
                      onChange={(e) => setFormData({ ...formData, sgst_percentage: parseFloat(e.target.value) || undefined })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-orange-500 focus:border-orange-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      IGST (%)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.igst_percentage || ''}
                      onChange={(e) => setFormData({ ...formData, igst_percentage: parseFloat(e.target.value) || undefined })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-orange-500 focus:border-orange-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <textarea
                    value={formData.description || ''}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-orange-500 focus:border-orange-500"
                  />
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="enabled"
                    checked={formData.enabled}
                    onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
                    className="h-4 w-4 text-orange-600 focus:ring-orange-500 border-gray-300 rounded"
                  />
                  <label htmlFor="enabled" className="ml-2 block text-sm text-gray-900">
                    Enabled
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
        </div>
      )}
    </div>
  );
}

