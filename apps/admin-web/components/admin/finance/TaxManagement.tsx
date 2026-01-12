/**
 * Tax Management Component
 * 
 * Main component for tax management in Finance & Logistics tab
 * Follows existing design philosophy and UI migration patterns
 */

'use client';

import { useState } from 'react';
import { useTaxRules } from '../../../hooks/useTaxRules';
import { useHSNCodes } from '../../../hooks/useHSNCodes';
import { useTaxCategories } from '../../../hooks/useTaxCategories';
import { TaxRulesManager } from './TaxRulesManager';
import { HSNCodesManager } from './HSNCodesManager';
import { TaxCategoriesManager } from './TaxCategoriesManager';
import { FlexibleTaxRulesManager } from './FlexibleTaxRulesManager';
import { FlexibleTaxConfigurationManager } from './FlexibleTaxConfigurationManager';
import { TaxCalculatorPreview } from './TaxCalculatorPreview';

type TabType = 'rules' | 'hsn' | 'categories' | 'flexible-rules' | 'flexible-config' | 'calculator';

export function TaxManagement() {
  const [activeTab, setActiveTab] = useState<TabType>('flexible-rules');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-2xl shadow-sm p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Tax Management</h2>
        <p className="text-gray-600">
          Configure tax rules, HSN codes, and tax categories for services and products
        </p>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-2xl shadow-sm">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6" aria-label="Tabs">
            <button
              onClick={() => setActiveTab('rules')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'rules'
                  ? 'border-orange-500 text-orange-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Tax Rules
            </button>
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
              onClick={() => setActiveTab('flexible-rules')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'flexible-rules'
                  ? 'border-orange-500 text-orange-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Flexible Tax Rules
            </button>
            <button
              onClick={() => setActiveTab('flexible-config')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'flexible-config'
                  ? 'border-orange-500 text-orange-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Tax Configuration
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

        {/* Tab Content */}
        <div className="p-6">
          {activeTab === 'rules' && <TaxRulesManager />}
          {activeTab === 'hsn' && <HSNCodesManager />}
          {activeTab === 'categories' && <TaxCategoriesManager />}
          {activeTab === 'flexible-rules' && <FlexibleTaxRulesManager />}
          {activeTab === 'flexible-config' && <FlexibleTaxConfigurationManager />}
          {activeTab === 'calculator' && <TaxCalculatorPreview />}
        </div>
      </div>
    </div>
  );
}

