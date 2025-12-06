import { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { Separator } from '../ui/separator';
import { ChevronDown, RotateCcw, Plus } from 'lucide-react';

export function VendorSettings() {
  const [resetToDefault, setResetToDefault] = useState(false);

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl text-gray-900 mb-1">Vendor Administration</h1>
            <p className="text-sm text-gray-600">Complete vendor lifecycle management and administration</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="gap-2">
              <RotateCcw className="w-4 h-4" />
              Refresh
            </Button>
            <Button className="bg-[#FF8C42] hover:bg-[#FF7A2E] gap-2">
              <Plus className="w-4 h-4" />
              Add Vendor
            </Button>
          </div>
        </div>
      </div>

      {/* Refund Policies Section */}
      <div className="bg-orange-50 border border-orange-200 rounded-lg p-6 mb-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-700">📋</span>
            <h2 className="text-lg text-gray-900">Refund Policies</h2>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" className="text-[#FF8C42] gap-2">
              <RotateCcw className="w-4 h-4" />
              Reset to Default
            </Button>
            <ChevronDown className="w-5 h-5 text-gray-600" />
          </div>
        </div>

        {/* Customer Cancellation Section */}
        <div className="bg-white rounded-lg p-6 mb-4">
          <div className="flex items-start gap-2 mb-4">
            <div className="w-5 h-5 rounded-full border-2 border-gray-400 mt-1" />
            <div className="flex-1">
              <h3 className="text-gray-900 mb-1">Customer Cancellation - Time-Based Refund Tiers</h3>
              <p className="text-sm text-gray-600">Define refund amounts based on cancellation timing</p>
            </div>
            <Button className="bg-[#FF8C42] hover:bg-[#FF7A2E]">
              <Plus className="w-4 h-4 mr-1" />
              Add Tier
            </Button>
          </div>

          {/* Tier 1 */}
          <div className="grid grid-cols-4 gap-4 mb-4 pb-4 border-b border-gray-200">
            <div>
              <Label className="text-xs text-gray-700 mb-1">Tier 1</Label>
              <div className="text-sm text-gray-900">Hours before the service</div>
              <div className="text-xs text-gray-500 mt-1">24 hours before the service</div>
            </div>
            <div>
              <Label className="text-xs text-gray-700 mb-1">% Refund Percentage</Label>
              <Input value="75" className="h-9 text-center" readOnly />
              <div className="text-xs text-gray-500 mt-1">Complete refund (75%)</div>
            </div>
            <div>
              <Label className="text-xs text-gray-700 mb-1">% Cancellation Fee</Label>
              <Input value="10" className="h-9 text-center" readOnly />
              <div className="text-xs text-gray-500 mt-1">Full deduction</div>
            </div>
            <div>
              <Label className="text-xs text-gray-700 mb-1">Choose Vendor</Label>
              <Select defaultValue="grooming">
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="grooming">Grooming Services</SelectItem>
                  <SelectItem value="walking">Pet Walking</SelectItem>
                  <SelectItem value="vet">Vet Services</SelectItem>
                </SelectContent>
              </Select>
              <div className="text-xs text-gray-500 mt-1">Service provider information</div>
            </div>
          </div>

          {/* Tier 2 */}
          <div className="grid grid-cols-4 gap-4 pb-4 border-b border-gray-200">
            <div>
              <Label className="text-xs text-gray-700 mb-1">Tier 2</Label>
              <div className="text-sm text-gray-900">Hours before the service</div>
              <div className="text-xs text-gray-500 mt-1">12 hours before the service</div>
            </div>
            <div>
              <Label className="text-xs text-gray-700 mb-1">% Refund Percentage</Label>
              <Input value="75" className="h-9 text-center" readOnly />
              <div className="text-xs text-gray-500 mt-1">Complete refund (75%)</div>
            </div>
            <div>
              <Label className="text-xs text-gray-700 mb-1">% Cancellation Fee</Label>
              <Input value="NO" className="h-9 text-center" readOnly />
              <div className="text-xs text-gray-500 mt-1">Full deduction</div>
            </div>
            <div>
              <Label className="text-xs text-gray-700 mb-1">Choose Vendor</Label>
              <Select defaultValue="grooming">
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="grooming">Grooming Services</SelectItem>
                  <SelectItem value="walking">Pet Walking</SelectItem>
                  <SelectItem value="vet">Vet Services</SelectItem>
                </SelectContent>
              </Select>
              <div className="text-xs text-gray-500 mt-1">Service provider to select</div>
            </div>
          </div>
        </div>

        {/* Provider/Vendor Cancellation */}
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
              <Label className="text-xs text-gray-700 mb-1">Refund to the Customer (%)</Label>
              <Input value="100" className="h-9 text-center" readOnly />
              <div className="text-xs text-gray-500 mt-1">Complete refund</div>
            </div>
            <div>
              <Label className="text-xs text-gray-700 mb-1">Additional Compensation (%)</Label>
              <Input value="" placeholder="%" className="h-9 text-center" />
              <div className="text-xs text-gray-500 mt-1">Extra compensation provided</div>
            </div>
            <div>
              <Label className="text-xs text-gray-700 mb-1">% Cancellation Fee</Label>
              <Input value="20" className="h-9 text-center" readOnly />
              <div className="text-xs text-gray-500 mt-1">Fee deduction</div>
            </div>
            <div>
              <Label className="text-xs text-gray-700 mb-1">Choose Vendor</Label>
              <Select defaultValue="grooming">
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="grooming">Grooming Services</SelectItem>
                  <SelectItem value="walking">Pet Walking</SelectItem>
                  <SelectItem value="vet">Vet Services</SelectItem>
                </SelectContent>
              </Select>
              <div className="text-xs text-gray-500 mt-1">Service provider to select</div>
            </div>
          </div>
        </div>

        {/* Refund Processing Settings */}
        <div className="bg-white rounded-lg p-6">
          <div className="flex items-start gap-2 mb-4">
            <div className="w-5 h-5 rounded-full border-2 border-gray-400 mt-1" />
            <div className="flex-1">
              <h3 className="text-gray-900 mb-1">Refund Processing Settings</h3>
              <p className="text-sm text-gray-600">Configure how refunds are processed and delivered</p>
            </div>
          </div>

          <div className="space-y-4">
            {/* Refund Processing Mode */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label className="text-xs text-gray-700 mb-1">Refund Processing Mode</Label>
                <Select defaultValue="auto">
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">Auto</SelectItem>
                    <SelectItem value="manual">Manual</SelectItem>
                  </SelectContent>
                </Select>
                <div className="text-xs text-gray-500 mt-1">Refunds approved</div>
              </div>
              <div>
                <Label className="text-xs text-gray-700 mb-1">Manual</Label>
                <Select defaultValue="manual">
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manual">Manual</SelectItem>
                    <SelectItem value="auto">Auto</SelectItem>
                  </SelectContent>
                </Select>
                <div className="text-xs text-gray-500 mt-1">Requires Approval</div>
              </div>
              <div>
                <Label className="text-xs text-gray-700 mb-1">Hybrid</Label>
                <Select defaultValue="hybrid">
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hybrid">Hybrid</SelectItem>
                    <SelectItem value="auto">Auto</SelectItem>
                  </SelectContent>
                </Select>
                <div className="text-xs text-gray-500 mt-1">Mixed Processing</div>
              </div>
            </div>

            {/* Processing Time */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label className="text-xs text-gray-700 mb-1">Processing Time (Business days)</Label>
                <Input value="5-7" className="h-9 text-center" readOnly />
                <div className="text-xs text-gray-500 mt-1">Auto-Initiate when</div>
              </div>
              <div>
                <Label className="text-xs text-gray-700 mb-1">Action Refund Threshold (%)</Label>
                <Input value="1000" className="h-9 text-center" readOnly />
                <div className="text-xs text-gray-500 mt-1"></div>
              </div>
              <div>
                <Label className="text-xs text-gray-700 mb-1">Dispute Resolution Time (days)</Label>
                <Input value="7" className="h-9 text-center" readOnly />
                <div className="text-xs text-gray-500 mt-1"></div>
              </div>
            </div>

            {/* Refund Preference */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label className="text-xs text-gray-700 mb-1">Refund Preference</Label>
                <div className="flex gap-2">
                  <Button variant="outline" className="h-9 flex-1 text-xs">Wallet only</Button>
                  <Button variant="outline" className="h-9 flex-1 text-xs">Original Source</Button>
                </div>
              </div>
              <div>
                <Label className="text-xs text-gray-700 mb-1">Customer Choice</Label>
                <Select defaultValue="customer">
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="customer">Customer Choice</SelectItem>
                    <SelectItem value="wallet">Wallet Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Other Collapsible Sections */}
      <div className="space-y-4">
        {/* Reservation & Payment Type */}
        <div className="bg-white rounded-lg p-4 border border-gray-200 flex items-center justify-between cursor-pointer hover:bg-gray-50">
          <div className="flex items-center gap-2">
            <span className="text-sm">💳</span>
            <h3 className="text-gray-900">Reservation & Payment Type</h3>
          </div>
          <ChevronDown className="w-5 h-5 text-gray-600" />
        </div>

        {/* Booking Rules */}
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
