'use client';

/** @deprecated Use Seller Hub ProductFormModal for inline variant editing. Kept for legacy API compatibility. */

import React, { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';
import {
  Plus, Trash2, Save, X, GripVertical, Palette, Ruler,
  Scale, Tag, AlertCircle, Check
} from 'lucide-react';

interface VariationOption {
  id?: string;
  value: string;
  price_modifier: number;
  stock_quantity: number;
  sku?: string;
  image_url?: string;
  is_active: boolean;
}

interface Variation {
  id?: string;
  name: string;
  type: 'color' | 'size' | 'weight' | 'other';
  is_required: boolean;
  options: VariationOption[];
}

interface ProductVariationsEditorProps {
  productId: string;
  vendorId: string;
  onClose: () => void;
  onSave?: () => void;
}

const variationTypeIcons = {
  color: Palette,
  size: Ruler,
  weight: Scale,
  other: Tag,
};

const variationTypeLabels = {
  color: 'Color',
  size: 'Size',
  weight: 'Weight',
  other: 'Other',
};

export default function ProductVariationsEditor({
  productId,
  vendorId,
  onClose,
  onSave,
}: ProductVariationsEditorProps) {
  const [variations, setVariations] = useState<Variation[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    loadVariations();
  }, [productId]);

  const loadVariations = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const result = await apiClient.get<any>(`/vendor/${vendorId}/products/${productId}/variations`);
      setVariations(result?.variations || []);
    } catch (err: any) {
      console.error('Error loading variations:', err);
      // If no variations exist, start with empty array
      setVariations([]);
    } finally {
      setLoading(false);
    }
  };

  const addVariation = () => {
    setVariations([
      ...variations,
      {
        name: '',
        type: 'other',
        is_required: false,
        options: [{ value: '', price_modifier: 0, stock_quantity: 0, is_active: true }],
      },
    ]);
  };

  const removeVariation = (index: number) => {
    setVariations(variations.filter((_, i) => i !== index));
  };

  const updateVariation = (index: number, field: keyof Variation, value: any) => {
    const updated = [...variations];
    updated[index] = { ...updated[index], [field]: value };
    setVariations(updated);
  };

  const addOption = (variationIndex: number) => {
    const updated = [...variations];
    updated[variationIndex].options.push({
      value: '',
      price_modifier: 0,
      stock_quantity: 0,
      is_active: true,
    });
    setVariations(updated);
  };

  const removeOption = (variationIndex: number, optionIndex: number) => {
    const updated = [...variations];
    updated[variationIndex].options = updated[variationIndex].options.filter(
      (_, i) => i !== optionIndex
    );
    setVariations(updated);
  };

  const updateOption = (
    variationIndex: number,
    optionIndex: number,
    field: keyof VariationOption,
    value: any
  ) => {
    const updated = [...variations];
    updated[variationIndex].options[optionIndex] = {
      ...updated[variationIndex].options[optionIndex],
      [field]: value,
    };
    setVariations(updated);
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      setSuccess(false);

      // Validate
      for (const variation of variations) {
        if (!variation.name.trim()) {
          throw new Error('Variation name is required');
        }
        for (const option of variation.options) {
          if (!option.value.trim()) {
            throw new Error(`Option value is required for ${variation.name}`);
          }
        }
      }

      await apiClient.post(`/vendor/${vendorId}/products/${productId}/variations`, {
        variations,
      });

      setSuccess(true);
      setTimeout(() => {
        onSave?.();
        onClose();
      }, 1500);
    } catch (err: any) {
      console.error('Error saving variations:', err);
      setError(err.message || 'Failed to save variations');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
        <div className="bg-white rounded-2xl p-8">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-orange-200 border-t-orange-500 mx-auto"></div>
          <p className="mt-4 text-slate-500">Loading variations...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative min-h-screen flex items-center justify-center p-4">
        <div className="relative bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
          {/* Header */}
          <div className="sticky top-0 bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between z-10">
            <div>
              <h2 className="text-xl font-bold text-slate-900">Product Variations</h2>
              <p className="text-sm text-slate-500">Add size, color, weight options</p>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl">
              <X className="w-5 h-5 text-slate-500" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6">
            {/* Error/Success Messages */}
            {error && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-red-500" />
                <p className="text-red-700">{error}</p>
              </div>
            )}
            {success && (
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-3">
                <Check className="w-5 h-5 text-emerald-500" />
                <p className="text-emerald-700">Variations saved successfully!</p>
              </div>
            )}

            {/* Variations List */}
            {variations.length === 0 ? (
              <div className="text-center py-12 bg-slate-50 rounded-xl">
                <Tag className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                <p className="text-slate-600 font-medium">No variations added yet</p>
                <p className="text-sm text-slate-400 mt-1">Add variations like size, color, or weight</p>
                <button
                  onClick={addVariation}
                  className="mt-4 px-6 py-2 bg-orange-500 text-white rounded-xl font-medium hover:bg-orange-600"
                >
                  <Plus className="w-4 h-4 inline mr-2" />
                  Add Variation
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                {variations.map((variation, vIndex) => {
                  const TypeIcon = variationTypeIcons[variation.type];
                  
                  return (
                    <div key={vIndex} className="bg-slate-50 rounded-xl p-5">
                      {/* Variation Header */}
                      <div className="flex items-start gap-4 mb-4">
                        <div className="flex-1 grid sm:grid-cols-3 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                              Variation Name
                            </label>
                            <input
                              type="text"
                              value={variation.name}
                              onChange={(e) => updateVariation(vIndex, 'name', e.target.value)}
                              placeholder="e.g., Size, Color"
                              className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                              Type
                            </label>
                            <select
                              value={variation.type}
                              onChange={(e) => updateVariation(vIndex, 'type', e.target.value)}
                              className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                            >
                              <option value="size">Size</option>
                              <option value="color">Color</option>
                              <option value="weight">Weight</option>
                              <option value="other">Other</option>
                            </select>
                          </div>
                          <div className="flex items-end">
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={variation.is_required}
                                onChange={(e) => updateVariation(vIndex, 'is_required', e.target.checked)}
                                className="w-5 h-5 rounded border-slate-300 text-orange-500 focus:ring-orange-500"
                              />
                              <span className="text-sm text-slate-600">Required</span>
                            </label>
                          </div>
                        </div>
                        <button
                          onClick={() => removeVariation(vIndex)}
                          className="p-2 text-red-500 hover:bg-red-50 rounded-xl"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>

                      {/* Options */}
                      <div className="space-y-3">
                        <label className="text-sm font-medium text-slate-700">Options</label>
                        {variation.options.map((option, oIndex) => (
                          <div key={oIndex} className="flex items-center gap-3 bg-white p-3 rounded-xl border border-slate-200">
                            <GripVertical className="w-4 h-4 text-slate-300 cursor-move" />
                            <input
                              type="text"
                              value={option.value}
                              onChange={(e) => updateOption(vIndex, oIndex, 'value', e.target.value)}
                              placeholder="Option value"
                              className="flex-1 px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                            />
                            <div className="flex items-center gap-1">
                              <span className="text-sm text-slate-500">+₹</span>
                              <input
                                type="number"
                                value={option.price_modifier}
                                onChange={(e) => updateOption(vIndex, oIndex, 'price_modifier', parseFloat(e.target.value) || 0)}
                                placeholder="0"
                                className="w-20 px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                              />
                            </div>
                            <div className="flex items-center gap-1">
                              <span className="text-sm text-slate-500">Stock:</span>
                              <input
                                type="number"
                                value={option.stock_quantity}
                                onChange={(e) => updateOption(vIndex, oIndex, 'stock_quantity', parseInt(e.target.value) || 0)}
                                placeholder="0"
                                className="w-20 px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                              />
                            </div>
                            <button
                              onClick={() => removeOption(vIndex, oIndex)}
                              disabled={variation.options.length <= 1}
                              className="p-2 text-red-500 hover:bg-red-50 rounded-lg disabled:opacity-30"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                        <button
                          onClick={() => addOption(vIndex)}
                          className="w-full py-2 border-2 border-dashed border-slate-300 text-slate-500 rounded-xl hover:border-orange-400 hover:text-orange-500 transition-colors"
                        >
                          <Plus className="w-4 h-4 inline mr-2" />
                          Add Option
                        </button>
                      </div>
                    </div>
                  );
                })}

                {/* Add Another Variation */}
                <button
                  onClick={addVariation}
                  className="w-full py-4 border-2 border-dashed border-slate-300 text-slate-600 rounded-xl hover:border-orange-400 hover:text-orange-500 transition-colors font-medium"
                >
                  <Plus className="w-5 h-5 inline mr-2" />
                  Add Another Variation
                </button>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="sticky bottom-0 bg-white border-t border-slate-100 px-6 py-4 flex justify-end gap-3">
            <button
              onClick={onClose}
              className="px-6 py-2.5 border border-slate-200 text-slate-700 rounded-xl font-medium hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || variations.length === 0}
              className="px-6 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl font-medium hover:shadow-lg disabled:opacity-50 flex items-center gap-2"
            >
              {saving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Save Variations
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
