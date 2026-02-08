/**
 * ============================================================================
 * FLEXIBLE TAX CONFIGURATION MANAGER
 * ============================================================================
 * 
 * Admin UI for managing tax configuration settings.
 * 
 * Date: 2026-01-28
 * ============================================================================
 */

'use client';

import { useState, useEffect } from 'react';
import { Save, AlertCircle, Info } from 'lucide-react';
import { Button } from '@warmpawz/ui';
import { useFlexibleTaxRules } from '../../../hooks/useFlexibleTaxRules';
import { TaxConfiguration } from '../../../types/tax-system';

export function FlexibleTaxConfigurationManager() {
  const { taxConfig, loading, error, updateTaxConfiguration, reload } = useFlexibleTaxRules();
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState<Partial<TaxConfiguration>>({
    name: '',
    description: '',
    isActive: true,
  });

  useEffect(() => {
    if (taxConfig) {
      setFormData({
        name: taxConfig.name,
        description: taxConfig.description,
        isActive: taxConfig.isActive,
      });
    }
  }, [taxConfig]);

  const handleSave = async () => {
    if (!formData.name) {
      alert('Configuration name is required');
      return;
    }

    try {
      setSaving(true);
      await updateTaxConfiguration(formData);
      alert('Tax configuration updated successfully');
    } catch (err: any) {
      alert(err.message || 'Failed to update tax configuration');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500 mx-auto"></div>
        <p className="mt-4 text-gray-600">Loading tax configuration...</p>
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
      <div>
        <h3 className="text-lg font-semibold text-gray-900">Tax Configuration</h3>
        <p className="text-sm text-gray-600 mt-1">
          Manage global tax configuration settings
        </p>
      </div>

      {/* Info Banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
        <Info className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
        <div className="flex-1">
          <p className="text-sm text-blue-900 font-medium mb-1">Tax Configuration</p>
          <p className="text-sm text-blue-700">
            Configure global tax settings. Individual tax rules are managed in the Tax Rules section.
          </p>
        </div>
      </div>

      {/* Configuration Form */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
        <div>
          <label htmlFor="configName" className="block text-sm font-medium text-gray-700 mb-1">
            Configuration Name *
          </label>
          <input
            id="configName"
            type="text"
            value={formData.name || taxConfig?.name || ''}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, name: e.target.value })}
            placeholder="e.g., Default GST Configuration"
            className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
            required
          />
        </div>

        <div>
          <label htmlFor="configDescription" className="block text-sm font-medium text-gray-700 mb-1">
            Description
          </label>
          <textarea
            id="configDescription"
            value={formData.description || taxConfig?.description || ''}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Describe this tax configuration..."
            rows={3}
            className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 resize-none"
          />
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="isActive"
            checked={formData.isActive ?? taxConfig?.isActive ?? true}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, isActive: e.target.checked })}
            className="w-4 h-4 text-orange-500 border-gray-300 rounded focus:ring-orange-500"
          />
          <label htmlFor="isActive" className="text-sm font-medium text-gray-700">
            Active Configuration
          </label>
        </div>

        {taxConfig && (
          <div className="bg-gray-50 rounded-lg p-4 space-y-2">
            <p className="text-sm font-medium text-gray-900">Current Configuration</p>
            <div className="text-sm text-gray-600 space-y-1">
              <p>Total Rules: {taxConfig.rules?.length || 0}</p>
              <p>Active Rules: {taxConfig.rules?.filter(r => r.isActive).length || 0}</p>
              {taxConfig.version && <p>Version: {taxConfig.version}</p>}
            </div>
          </div>
        )}

        <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
          <Button variant="outline" onClick={reload}>
            Reload
          </Button>
          <Button onClick={handleSave} disabled={saving} className="bg-orange-500 hover:bg-orange-600">
            <Save className="w-4 h-4 mr-2" />
            {saving ? 'Saving...' : 'Save Configuration'}
          </Button>
        </div>
      </div>
    </div>
  );
}

