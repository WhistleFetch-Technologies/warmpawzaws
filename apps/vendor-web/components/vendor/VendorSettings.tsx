'use client';

import { useState } from 'react';
import { RotateCcw, Plus, ChevronDown } from 'lucide-react';

export function VendorSettings() {
  const [resetToDefault, setResetToDefault] = useState(false);

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl text-gray-900 mb-1">Vendor Administration</h1>
            <p className="text-sm text-gray-600">Complete vendor lifecycle management and administration</p>
          </div>
          <div className="flex gap-2">
            <button className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2">
              <RotateCcw className="w-4 h-4" />
              Refresh
            </button>
            <button className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg flex items-center gap-2">
              <Plus className="w-4 h-4" />
              Add Vendor
            </button>
          </div>
        </div>
      </div>

      <div className="bg-orange-50 border border-orange-200 rounded-lg p-6 mb-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-700">📋</span>
            <h2 className="text-lg text-gray-900">Refund Policies</h2>
          </div>
          <div className="flex items-center gap-2">
            <button className="px-3 py-1.5 text-orange-600 hover:bg-orange-100 rounded-lg text-sm flex items-center gap-2">
              <RotateCcw className="w-4 h-4" />
              Reset to Default
            </button>
            <ChevronDown className="w-5 h-5 text-gray-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg p-6 mb-4">
          <div className="flex items-start gap-2 mb-4">
            <div className="w-5 h-5 rounded-full border-2 border-gray-400 mt-1" />
            <div className="flex-1">
              <h3 className="text-gray-900 mb-1">Customer Cancellation - Time-Based Refund Tiers</h3>
              <p className="text-sm text-gray-600">Define refund amounts based on cancellation timing</p>
            </div>
            <button className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg flex items-center gap-1">
              <Plus className="w-4 h-4" />
              Add Tier
            </button>
          </div>

          <div className="grid grid-cols-4 gap-4 mb-4 pb-4 border-b border-gray-200">
            <div>
              <label className="text-xs text-gray-700 mb-1 block font-medium">Tier 1</label>
              <div className="text-sm text-gray-900">Hours before the service</div>
              <div className="text-xs text-gray-500 mt-1">24 hours before the service</div>
            </div>
            <div>
              <label className="text-xs text-gray-700 mb-1 block font-medium">% Refund Percentage</label>
              <input value="75" className="h-9 text-center w-full border border-gray-300 rounded-lg px-2" readOnly />
              <div className="text-xs text-gray-500 mt-1">Complete refund (75%)</div>
            </div>
            <div>
              <label className="text-xs text-gray-700 mb-1 block font-medium">% Cancellation Fee</label>
              <input value="10" className="h-9 text-center w-full border border-gray-300 rounded-lg px-2" readOnly />
              <div className="text-xs text-gray-500 mt-1">Full deduction</div>
            </div>
            <div>
              <label className="text-xs text-gray-700 mb-1 block font-medium">Choose Vendor</label>
              <select defaultValue="grooming" className="h-9 w-full border border-gray-300 rounded-lg px-2">
                <option value="grooming">Grooming Services</option>
                <option value="walking">Pet Walking</option>
                <option value="vet">Vet Services</option>
              </select>
              <div className="text-xs text-gray-500 mt-1">Service provider information</div>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-4 pb-4 border-b border-gray-200">
            <div>
              <label className="text-xs text-gray-700 mb-1 block font-medium">Tier 2</label>
              <div className="text-sm text-gray-900">Hours before the service</div>
              <div className="text-xs text-gray-500 mt-1">12 hours before the service</div>
            </div>
            <div>
              <label className="text-xs text-gray-700 mb-1 block font-medium">% Refund Percentage</label>
              <input value="75" className="h-9 text-center w-full border border-gray-300 rounded-lg px-2" readOnly />
              <div className="text-xs text-gray-500 mt-1">Complete refund (75%)</div>
            </div>
            <div>
              <label className="text-xs text-gray-700 mb-1 block font-medium">% Cancellation Fee</label>
              <input value="NO" className="h-9 text-center w-full border border-gray-300 rounded-lg px-2" readOnly />
              <div className="text-xs text-gray-500 mt-1">Full deduction</div>
            </div>
            <div>
              <label className="text-xs text-gray-700 mb-1 block font-medium">Choose Vendor</label>
              <select defaultValue="grooming" className="h-9 w-full border border-gray-300 rounded-lg px-2">
                <option value="grooming">Grooming Services</option>
                <option value="walking">Pet Walking</option>
                <option value="vet">Vet Services</option>
              </select>
              <div className="text-xs text-gray-500 mt-1">Service provider to select</div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg p-6 mb-4">
          <div className="flex items-start gap-2 mb-4">
            <div className="w-5 h-5 rounded-full border-2 border-gray-400 mt-1" />
            <div className="flex-1">
              <h3 className="text-gray-900 mb-1">Provider/Vendor Cancellation</h3>
              <p className="text-sm text-gray-600">Protect customers when vendors cancels</p>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-4">
            <div>
              <label className="text-xs text-gray-700 mb-1 block font-medium">Refund to the Customer (%)</label>
              <input value="100" className="h-9 text-center w-full border border-gray-300 rounded-lg px-2" readOnly />
              <div className="text-xs text-gray-500 mt-1">Complete refund</div>
            </div>
            <div>
              <label className="text-xs text-gray-700 mb-1 block font-medium">Additional Compensation (%)</label>
              <input placeholder="%" className="h-9 text-center w-full border border-gray-300 rounded-lg px-2" />
              <div className="text-xs text-gray-500 mt-1">Extra compensation provided</div>
            </div>
            <div>
              <label className="text-xs text-gray-700 mb-1 block font-medium">% Cancellation Fee</label>
              <input value="20" className="h-9 text-center w-full border border-gray-300 rounded-lg px-2" readOnly />
              <div className="text-xs text-gray-500 mt-1">Fee deduction</div>
            </div>
            <div>
              <label className="text-xs text-gray-700 mb-1 block font-medium">Choose Vendor</label>
              <select defaultValue="grooming" className="h-9 w-full border border-gray-300 rounded-lg px-2">
                <option value="grooming">Grooming Services</option>
                <option value="walking">Pet Walking</option>
                <option value="vet">Vet Services</option>
              </select>
              <div className="text-xs text-gray-500 mt-1">Service provider to select</div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg p-6">
          <div className="flex items-start gap-2 mb-4">
            <div className="w-5 h-5 rounded-full border-2 border-gray-400 mt-1" />
            <div className="flex-1">
              <h3 className="text-gray-900 mb-1">Refund Processing Settings</h3>
              <p className="text-sm text-gray-600">Configure how refunds are processed and delivered</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="text-xs text-gray-700 mb-1 block font-medium">Refund Processing Mode</label>
                <select defaultValue="auto" className="h-9 w-full border border-gray-300 rounded-lg px-2">
                  <option value="auto">Auto</option>
                  <option value="manual">Manual</option>
                </select>
                <div className="text-xs text-gray-500 mt-1">Refunds approved</div>
              </div>
              <div>
                <label className="text-xs text-gray-700 mb-1 block font-medium">Manual</label>
                <select defaultValue="manual" className="h-9 w-full border border-gray-300 rounded-lg px-2">
                  <option value="manual">Manual</option>
                  <option value="auto">Auto</option>
                </select>
                <div className="text-xs text-gray-500 mt-1">Requires Approval</div>
              </div>
              <div>
                <label className="text-xs text-gray-700 mb-1 block font-medium">Hybrid</label>
                <select defaultValue="hybrid" className="h-9 w-full border border-gray-300 rounded-lg px-2">
                  <option value="hybrid">Hybrid</option>
                  <option value="auto">Auto</option>
                </select>
                <div className="text-xs text-gray-500 mt-1">Mixed Processing</div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="text-xs text-gray-700 mb-1 block font-medium">Processing Time (Business days)</label>
                <input value="5-7" className="h-9 text-center w-full border border-gray-300 rounded-lg px-2" readOnly />
                <div className="text-xs text-gray-500 mt-1">Auto-Initiate when</div>
              </div>
              <div>
                <label className="text-xs text-gray-700 mb-1 block font-medium">Action Refund Threshold (%)</label>
                <input value="1000" className="h-9 text-center w-full border border-gray-300 rounded-lg px-2" readOnly />
                <div className="text-xs text-gray-500 mt-1"></div>
              </div>
              <div>
                <label className="text-xs text-gray-700 mb-1 block font-medium">Dispute Resolution Time (days)</label>
                <input value="7" className="h-9 text-center w-full border border-gray-300 rounded-lg px-2" readOnly />
                <div className="text-xs text-gray-500 mt-1"></div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="text-xs text-gray-700 mb-1 block font-medium">Refund Preference</label>
                <div className="flex gap-2">
                  <button className="h-9 flex-1 text-xs border border-gray-300 rounded-lg hover:bg-gray-50">Wallet only</button>
                  <button className="h-9 flex-1 text-xs border border-gray-300 rounded-lg hover:bg-gray-50">Original Source</button>
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-700 mb-1 block font-medium">Customer Choice</label>
                <select defaultValue="customer" className="h-9 w-full border border-gray-300 rounded-lg px-2">
                  <option value="customer">Customer Choice</option>
                  <option value="wallet">Wallet Only</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="bg-white rounded-lg p-4 border border-gray-200 flex items-center justify-between cursor-pointer hover:bg-gray-50">
          <div className="flex items-center gap-2">
            <span className="text-sm">💳</span>
            <h3 className="text-gray-900">Reservation & Payment Type</h3>
          </div>
          <ChevronDown className="w-5 h-5 text-gray-600" />
        </div>

        <div className="bg-white rounded-lg p-4 border border-gray-200 flex items-center justify-between cursor-pointer hover:bg-gray-50">
          <div className="flex items-center gap-2">
            <span className="text-sm">📅</span>
            <h3 className="text-gray-900">Booking Rules</h3>
          </div>
          <ChevronDown className="w-5 h-5 text-gray-600" />
        </div>
      </div>
    </div>
  );
}

