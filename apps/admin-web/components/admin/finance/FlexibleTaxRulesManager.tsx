/**
 * ============================================================================
 * FLEXIBLE TAX RULES MANAGER
 * ============================================================================
 * 
 * Admin UI for managing flexible tax system rules.
 * Supports multiple tax types, rule conditions, exemptions, and compound taxes.
 * 
 * Date: 2026-01-28
 * ============================================================================
 */

'use client';

import { useState } from 'react';
import { Plus, Edit2, Trash2, Eye, X, Save, AlertCircle, Info } from 'lucide-react';
import { Button } from '@warmpawz/ui';
import { Input } from '@warmpawz/ui';
import { Label } from '@warmpawz/ui';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@warmpawz/ui';
import { Textarea } from '@warmpawz/ui';
import { Switch } from '@warmpawz/ui';
import { Badge } from '@warmpawz/ui';
import { useFlexibleTaxRules } from '../../../hooks/useFlexibleTaxRules';
import { TaxRule, TaxType, TaxCalculationMethod, TransactionType } from '../../../types/tax-system';
import { PolicyHelpButton } from '@/components/PolicyHelpButton';
// Note: Toast notifications - using alert for now, can be replaced with toast library

export function FlexibleTaxRulesManager() {
  const { taxRules, loading, error, createTaxRule, updateTaxRule, deleteTaxRule, reload } = useFlexibleTaxRules({});
  const [showModal, setShowModal] = useState(false);
  const [editingRule, setEditingRule] = useState<TaxRule | null>(null);
  const [formData, setFormData] = useState<Partial<TaxRule>>({
    name: '',
    description: '',
    taxType: 'gst',
    rate: 18,
    calculationMethod: 'percentage',
    priority: 100,
    isActive: true,
    conditions: {
      transactionType: 'both',
    },
    exemptions: {},
  });

  const handleOpenModal = (rule?: TaxRule) => {
    if (rule) {
      setEditingRule(rule);
      setFormData(rule);
    } else {
      setEditingRule(null);
      setFormData({
        name: '',
        description: '',
        taxType: 'gst',
        rate: 18,
        calculationMethod: 'percentage',
        priority: 100,
        isActive: true,
        conditions: {
          transactionType: 'both',
        },
        exemptions: {},
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
    
    if (!formData.name || !formData.taxType || formData.rate === undefined) {
      alert('Please fill in all required fields');
      return;
    }

    try {
      if (editingRule) {
        await updateTaxRule(editingRule.id, formData);
        alert('Tax rule updated successfully');
      } else {
        await createTaxRule(formData);
        alert('Tax rule created successfully');
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
      alert('Tax rule deleted successfully');
    } catch (err: any) {
      alert(err.message || 'Failed to delete tax rule');
    }
  };

  const getTaxTypeLabel = (type: TaxType): string => {
    const labels: Record<TaxType, string> = {
      gst: 'GST',
      cgst: 'CGST',
      sgst: 'SGST',
      igst: 'IGST',
      service_tax: 'Service Tax',
      education_cess: 'Education Cess',
      swachh_bharat_cess: 'Swachh Bharat Cess',
      krishi_kalyan_cess: 'Krishi Kalyan Cess',
      infrastructure_cess: 'Infrastructure Cess',
      custom: 'Custom',
    };
    return labels[type] || type;
  };

  const getTaxTypeColor = (type: TaxType): string => {
    const colors: Record<TaxType, string> = {
      gst: 'bg-blue-100 text-blue-700',
      cgst: 'bg-indigo-100 text-indigo-700',
      sgst: 'bg-purple-100 text-purple-700',
      igst: 'bg-pink-100 text-pink-700',
      service_tax: 'bg-green-100 text-green-700',
      education_cess: 'bg-yellow-100 text-yellow-700',
      swachh_bharat_cess: 'bg-teal-100 text-teal-700',
      krishi_kalyan_cess: 'bg-cyan-100 text-cyan-700',
      infrastructure_cess: 'bg-orange-100 text-orange-700',
      custom: 'bg-gray-100 text-gray-700',
    };
    return colors[type] || 'bg-gray-100 text-gray-700';
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500 mx-auto"></div>
        <p className="mt-4 text-gray-600">Loading tax rules...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <p className="text-red-600">{error}</p>
        <Button onClick={reload} className="mt-4" variant="outline">
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Flexible Tax Rules</h3>
            <p className="text-sm text-gray-600 mt-1">
              Manage tax rules with flexible conditions, exemptions, and compound taxes
            </p>
          </div>
          <PolicyHelpButton docKey="finance-flexible-tax-system" />
        </div>
        <Button onClick={() => handleOpenModal()} className="bg-orange-500 hover:bg-orange-600">
          <Plus className="w-4 h-4 mr-2" />
          Create Tax Rule
        </Button>
      </div>

      {/* Info Banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
        <Info className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
        <div className="flex-1">
          <p className="text-sm text-blue-900 font-medium mb-1">How Tax Rules Work</p>
          <p className="text-sm text-blue-700">
            Rules are matched by priority (lower number = higher priority). Each rule can have conditions 
            (categories, service types, amounts) and exemptions. Compound taxes calculate on top of base taxes.
          </p>
        </div>
      </div>

      {/* Rules List */}
      {taxRules.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg border border-gray-200">
          <p className="text-gray-500 mb-4">No tax rules configured</p>
          <Button onClick={() => handleOpenModal()} variant="outline">
            Create Your First Tax Rule
          </Button>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Rule Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Tax Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Rate
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Priority
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
                {taxRules
                  .sort((a, b) => a.priority - b.priority)
                  .map((rule) => (
                    <tr key={rule.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">{rule.name}</div>
                          {rule.description && (
                            <div className="text-xs text-gray-500 mt-1">{rule.description}</div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getTaxTypeColor(rule.taxType)}`}>
                          {getTaxTypeLabel(rule.taxType)}
                        </span>
                        {rule.calculationMethod === 'compound' && (
                          <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700 border border-gray-300">
                            Compound
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {rule.calculationMethod === 'percentage' ? `${rule.rate}%` : `₹${rule.rate}`}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{rule.priority}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-500 space-y-1">
                          {rule.conditions.transactionType && (
                            <div>Type: {rule.conditions.transactionType}</div>
                          )}
                          {rule.conditions.categoryIds && rule.conditions.categoryIds.length > 0 && (
                            <div>Categories: {rule.conditions.categoryIds.length}</div>
                          )}
                          {rule.conditions.serviceTypes && rule.conditions.serviceTypes.length > 0 && (
                            <div>Services: {rule.conditions.serviceTypes.length}</div>
                          )}
                          {!rule.conditions.transactionType && 
                           !rule.conditions.categoryIds?.length && 
                           !rule.conditions.serviceTypes?.length && (
                            <div className="text-gray-400">No conditions</div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {rule.isActive ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700 border border-gray-300">
                            Inactive
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenModal(rule)}
                            className="text-blue-600 hover:text-blue-800"
                          >
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(rule.id)}
                            className="text-red-600 hover:text-red-800"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">
                {editingRule ? 'Edit Tax Rule' : 'Create Tax Rule'}
              </h3>
              <Button variant="ghost" size="sm" onClick={handleCloseModal}>
                <X className="w-5 h-5" />
              </Button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              {/* Basic Information */}
              <div className="space-y-4">
                <h4 className="font-medium text-gray-900">Basic Information</h4>
                
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                    Rule Name *
                  </label>
                  <input
                    id="name"
                    type="text"
                    value={formData.name || ''}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., GST Standard 18%"
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <textarea
                    id="description"
                    value={formData.description || ''}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Describe when this rule applies..."
                    rows={2}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 resize-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="taxType" className="block text-sm font-medium text-gray-700 mb-1">
                    Tax Type *
                  </label>
                  <select
                    id="taxType"
                    value={formData.taxType}
                    onChange={(e) => setFormData({ ...formData, taxType: e.target.value as TaxType })}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    required
                  >
                    <option value="gst">GST</option>
                    <option value="cgst">CGST</option>
                    <option value="sgst">SGST</option>
                    <option value="igst">IGST</option>
                    <option value="service_tax">Service Tax</option>
                    <option value="education_cess">Education Cess</option>
                    <option value="swachh_bharat_cess">Swachh Bharat Cess</option>
                    <option value="krishi_kalyan_cess">Krishi Kalyan Cess</option>
                    <option value="infrastructure_cess">Infrastructure Cess</option>
                    <option value="custom">Custom</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="calculationMethod" className="block text-sm font-medium text-gray-700 mb-1">
                    Calculation Method *
                  </label>
                  <select
                    id="calculationMethod"
                    value={formData.calculationMethod}
                    onChange={(e) => 
                      setFormData({ ...formData, calculationMethod: e.target.value as TaxCalculationMethod })
                    }
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    required
                  >
                    <option value="percentage">Percentage</option>
                    <option value="fixed">Fixed Amount</option>
                    <option value="compound">Compound (Tax on Tax)</option>
                  </select>
                </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="rate" className="block text-sm font-medium text-gray-700 mb-1">
                      Tax Rate *
                    </label>
                    <input
                      id="rate"
                      type="number"
                      step="0.01"
                      value={formData.rate || ''}
                      onChange={(e) => setFormData({ ...formData, rate: parseFloat(e.target.value) || 0 })}
                      placeholder={formData.calculationMethod === 'percentage' ? '18' : '100'}
                      className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                      required
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      {formData.calculationMethod === 'percentage' ? 'Percentage (e.g., 18 for 18%)' : 'Fixed amount in ₹'}
                    </p>
                  </div>

                  <div>
                    <label htmlFor="priority" className="block text-sm font-medium text-gray-700 mb-1">
                      Priority *
                    </label>
                    <input
                      id="priority"
                      type="number"
                      value={formData.priority || 100}
                      onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) || 100 })}
                      placeholder="100"
                      className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                      required
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Lower number = higher priority (applied first)
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="isActive"
                    checked={formData.isActive ?? true}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                    className="w-4 h-4 text-orange-500 border-gray-300 rounded focus:ring-orange-500"
                  />
                  <label htmlFor="isActive" className="text-sm font-medium text-gray-700">
                    Active
                  </label>
                </div>
              </div>

              {/* Conditions */}
              <div className="space-y-4 border-t border-gray-200 pt-4">
                <h4 className="font-medium text-gray-900">Rule Conditions</h4>
                <p className="text-sm text-gray-600">
                  Define when this tax rule applies. Leave empty to apply to all items.
                </p>

                <div>
                  <label htmlFor="transactionType" className="block text-sm font-medium text-gray-700 mb-1">
                    Transaction Type
                  </label>
                  <select
                    id="transactionType"
                    value={formData.conditions?.transactionType || 'both'}
                    onChange={(e) => 
                      setFormData({ 
                        ...formData, 
                        conditions: { ...formData.conditions, transactionType: e.target.value as TransactionType }
                      })
                    }
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  >
                    <option value="both">Both Products & Services</option>
                    <option value="product">Products Only</option>
                    <option value="service">Services Only</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="categoryIds" className="block text-sm font-medium text-gray-700 mb-1">
                    Category IDs (comma-separated)
                  </label>
                  <input
                    id="categoryIds"
                    type="text"
                    value={formData.conditions?.categoryIds?.join(', ') || ''}
                    onChange={(e) => 
                      setFormData({ 
                        ...formData, 
                        conditions: { 
                          ...formData.conditions, 
                          categoryIds: e.target.value.split(',').map(s => s.trim()).filter(Boolean)
                        }
                      })
                    }
                    placeholder="medicines, healthcare_products"
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  />
                </div>

                <div>
                  <label htmlFor="serviceTypes" className="block text-sm font-medium text-gray-700 mb-1">
                    Service Types (comma-separated)
                  </label>
                  <input
                    id="serviceTypes"
                    type="text"
                    value={formData.conditions?.serviceTypes?.join(', ') || ''}
                    onChange={(e) => 
                      setFormData({ 
                        ...formData, 
                        conditions: { 
                          ...formData.conditions, 
                          serviceTypes: e.target.value.split(',').map(s => s.trim()).filter(Boolean)
                        }
                      })
                    }
                    placeholder="at_center, at_home, tele"
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  />
                </div>
              </div>

              {/* Compound Tax */}
              {formData.calculationMethod === 'compound' && (
                <div className="space-y-4 border-t border-gray-200 pt-4">
                  <h4 className="font-medium text-gray-900">Compound Tax Configuration</h4>
                  <p className="text-sm text-gray-600">
                    This tax will be calculated on top of another tax.
                  </p>

                  <div>
                    <label htmlFor="compoundOnTaxType" className="block text-sm font-medium text-gray-700 mb-1">
                      Calculate on Tax Type
                    </label>
                    <select
                      id="compoundOnTaxType"
                      value={formData.compoundOnTaxType || ''}
                      onChange={(e) => 
                        setFormData({ ...formData, compoundOnTaxType: e.target.value as TaxType })
                      }
                      className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    >
                      <option value="">Select tax type</option>
                      <option value="gst">GST</option>
                      <option value="service_tax">Service Tax</option>
                      <option value="cgst">CGST</option>
                      <option value="sgst">SGST</option>
                      <option value="igst">IGST</option>
                    </select>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-end gap-3 border-t border-gray-200 pt-4">
                <Button type="button" variant="outline" onClick={handleCloseModal}>
                  Cancel
                </Button>
                <Button type="submit" className="bg-orange-500 hover:bg-orange-600">
                  <Save className="w-4 h-4 mr-2" />
                  {editingRule ? 'Update Rule' : 'Create Rule'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

