/**
 * ============================================================================
 * TAX CALCULATOR PREVIEW
 * ============================================================================
 * 
 * Admin UI for testing tax calculations with sample data.
 * 
 * Date: 2026-01-28
 * ============================================================================
 */

'use client';

import { useState } from 'react';
import { Calculator, AlertCircle, Info } from 'lucide-react';
import { Button } from '@warmpawz/ui';
import { calculateTax } from '@/lib/tax-system';
import { TaxableItem } from '@/types/tax-system';

export function TaxCalculatorPreview() {
  const [testItems, setTestItems] = useState<TaxableItem[]>([
    {
      id: 'test-1',
      type: 'product',
      amount: 1000,
      quantity: 1,
      categoryId: '',
    },
  ]);
  const [result, setResult] = useState<any>(null);
  const [calculating, setCalculating] = useState(false);

  const handleCalculate = () => {
    try {
      setCalculating(true);
      const taxResult = calculateTax(testItems);
      setResult(taxResult);
    } catch (err: any) {
      alert(err.message || 'Failed to calculate tax');
    } finally {
      setCalculating(false);
    }
  };

  const addTestItem = () => {
    setTestItems([
      ...testItems,
      {
        id: `test-${Date.now()}`,
        type: 'product',
        amount: 0,
        quantity: 1,
        categoryId: '',
      },
    ]);
  };

  const removeTestItem = (id: string) => {
    setTestItems(testItems.filter(item => item.id !== id));
  };

  const updateTestItem = (id: string, updates: Partial<TaxableItem>) => {
    setTestItems(testItems.map(item => 
      item.id === id ? { ...item, ...updates } : item
    ));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900">Tax Calculator Preview</h3>
        <p className="text-sm text-gray-600 mt-1">
          Test tax calculations with sample items
        </p>
      </div>

      {/* Info Banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
        <Info className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
        <div className="flex-1">
          <p className="text-sm text-blue-900 font-medium mb-1">Test Tax Calculations</p>
          <p className="text-sm text-blue-700">
            Add test items and calculate taxes to preview how the tax system will work.
            This helps verify tax rules are configured correctly.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Test Items */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-semibold text-gray-900">Test Items</h4>
            <Button onClick={addTestItem} size="sm" variant="outline">
              Add Item
            </Button>
          </div>

          <div className="space-y-4">
            {testItems.map((item, index) => (
              <div key={item.id} className="border border-gray-200 rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">Item {index + 1}</span>
                  {testItems.length > 1 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeTestItem(item.id)}
                      className="text-red-600"
                    >
                      Remove
                    </Button>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                    <select
                      value={item.type}
                      onChange={(e: React.ChangeEvent<HTMLSelectElement>) => 
                        updateTestItem(item.id, { type: e.target.value as 'product' | 'service' })
                      }
                      className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    >
                      <option value="product">Product</option>
                      <option value="service">Service</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
                    <input
                      type="number"
                      value={item.quantity || 1}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => 
                        updateTestItem(item.id, { quantity: parseInt(e.target.value) || 1 })
                      }
                      min="1"
                      className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Amount (₹)</label>
                  <input
                    type="number"
                    value={item.amount}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => 
                      updateTestItem(item.id, { amount: parseFloat(e.target.value) || 0 })
                    }
                    step="0.01"
                    min="0"
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category ID (optional)</label>
                  <input
                    type="text"
                    value={item.categoryId || ''}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => 
                      updateTestItem(item.id, { categoryId: e.target.value })
                    }
                    placeholder="e.g., medicines, pet_food"
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  />
                </div>
              </div>
            ))}
          </div>

          <Button 
            onClick={handleCalculate} 
            disabled={calculating || testItems.length === 0}
            className="w-full mt-4 bg-orange-500 hover:bg-orange-600"
          >
            <Calculator className="w-4 h-4 mr-2" />
            {calculating ? 'Calculating...' : 'Calculate Tax'}
          </Button>
        </div>

        {/* Results */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h4 className="font-semibold text-gray-900 mb-4">Tax Calculation Results</h4>

          {!result ? (
            <div className="text-center py-12 text-gray-500">
              <Calculator className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p>Add test items and click "Calculate Tax" to see results</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Summary */}
              <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Subtotal</span>
                  <span className="font-medium text-gray-900">₹{result.subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Total Tax</span>
                  <span className="font-medium text-gray-900">₹{result.total.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-lg font-bold border-t border-gray-200 pt-2">
                  <span className="text-gray-900">Grand Total</span>
                  <span className="text-orange-600">₹{result.grandTotal.toFixed(2)}</span>
                </div>
              </div>

              {/* Tax by Type */}
              {result.byType && result.byType.length > 0 && (
                <div>
                  <h5 className="font-medium text-gray-900 mb-2">Tax Breakdown by Type</h5>
                  <div className="space-y-2">
                    {result.byType.map((taxType: any) => (
                      <div key={taxType.taxType} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                          {taxType.taxType.toUpperCase()}
                        </span>
                        <span className="font-medium">₹{taxType.totalAmount.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Detailed Breakdown */}
              {result.breakdown && result.breakdown.length > 0 && (
                <div>
                  <h5 className="font-medium text-gray-900 mb-2">Detailed Breakdown</h5>
                  <div className="space-y-2">
                    {result.breakdown.map((tax: any, idx: number) => (
                      <div key={idx} className="text-xs text-gray-600 p-2 bg-gray-50 rounded">
                        <div className="font-medium">{tax.ruleName}</div>
                        <div>Rate: {tax.rate}% | Amount: ₹{tax.taxAmount.toFixed(2)}</div>
                        {tax.isCompound && (
                          <div className="text-orange-600">Compound Tax</div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

