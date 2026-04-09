/**
 * Tax Management Component
 *
 * HSN codes, legacy tax rules (gst_rules CRUD), tax categories, calculator preview.
 * Flexible Tax System UI was removed — checkout uses HSN → tax category / catalogue+role → 18% default only.
 */

'use client';

import { useState } from 'react';
import { TaxRulesManager } from './TaxRulesManager';
import { HSNCodesManager } from './HSNCodesManager';
import { TaxCategoriesManager } from './TaxCategoriesManager';
import { TaxCalculatorPreview } from './TaxCalculatorPreview';

type TabType = 'rules' | 'hsn' | 'categories' | 'calculator';

export function TaxManagement() {
  const [activeTab, setActiveTab] = useState<TabType>('hsn');

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl shadow-sm p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Tax Management</h2>
        <p className="text-gray-600">
          Configure HSN codes and tax categories. Legacy <strong>Tax Rules</strong> edit the{' '}
          <code className="text-xs bg-gray-100 px-1 rounded">gst_rules</code> table only — they are{' '}
          <strong>not</strong> used in live GST calculation (use GST Configuration for catalogue + role rates).
        </p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6" aria-label="Tabs">
            <button
              onClick={() => setActiveTab('hsn')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'hsn'
                  ? 'border-orange-500 text-orange-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              HSN Codes
            </button>
            <button
              onClick={() => setActiveTab('categories')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'categories'
                  ? 'border-orange-500 text-orange-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Tax Categories
            </button>
            <button
              onClick={() => setActiveTab('rules')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'rules'
                  ? 'border-orange-500 text-orange-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Tax Rules (legacy DB)
            </button>
            <button
              onClick={() => setActiveTab('calculator')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'calculator'
                  ? 'border-orange-500 text-orange-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Tax Calculator
            </button>
          </nav>
        </div>

        <div className="p-6">
          {activeTab === 'rules' && <TaxRulesManager />}
          {activeTab === 'hsn' && <HSNCodesManager />}
          {activeTab === 'categories' && <TaxCategoriesManager />}
          {activeTab === 'calculator' && <TaxCalculatorPreview />}
        </div>
      </div>
    </div>
  );
}
