import { useState } from 'react';
import { ChevronDown, ChevronUp, Code, CheckCircle, XCircle, AlertCircle, Info } from 'lucide-react';
import { VendorCapabilities } from './hooks/useVendorCapabilities';
import { Badge } from '../ui/badge';
import { Card } from '../ui/card';
import { Button } from '../ui/button';

interface CapabilityDebugOverlayProps {
  roleId: string;
  roleName: string;
  capabilities: VendorCapabilities;
  vendorData: any;
  showInProduction?: boolean; // Only show in dev by default
}

interface ModuleStatus {
  name: string;
  shouldLoad: boolean;
  reason: string;
  dependencies?: string[];
}

export function CapabilityDebugOverlay({
  roleId,
  roleName,
  capabilities,
  vendorData,
  showInProduction = false
}: CapabilityDebugOverlayProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<'modules' | 'capabilities' | 'vendor'>('modules');

  // Only show in development unless explicitly enabled
  const isDev = (typeof import.meta !== 'undefined' && import.meta.env?.DEV) || showInProduction;
  if (!isDev) return null;

  // Determine which modules should load based on capabilities
  const modules: ModuleStatus[] = [
    {
      name: 'Services & Catalog',
      shouldLoad: capabilities.catalog || capabilities.booking,
      reason: capabilities.catalog 
        ? 'Catalog enabled' 
        : capabilities.booking 
        ? 'Booking enabled (requires services)' 
        : 'Neither catalog nor booking enabled',
      dependencies: ['catalog', 'booking']
    },
    {
      name: 'Centre Management',
      shouldLoad: vendorData?.centres?.length > 0 || vendorData?.vendorType === 'centre',
      reason: vendorData?.centres?.length > 0
        ? `${vendorData.centres.length} centre(s) configured`
        : vendorData?.vendorType === 'centre'
        ? 'Vendor type is centre'
        : 'No centres configured',
      dependencies: []
    },
    {
      name: 'Staff Management',
      shouldLoad: capabilities.staff_management,
      reason: capabilities.staff_management
        ? 'Staff management capability enabled'
        : 'Staff management not enabled for this role',
      dependencies: ['staff_management']
    },
    {
      name: 'Orders & Commerce',
      shouldLoad: capabilities.orders || capabilities.inventory,
      reason: capabilities.orders
        ? 'Orders enabled'
        : capabilities.inventory
        ? 'Inventory management enabled'
        : 'Commerce features disabled',
      dependencies: ['orders', 'inventory', 'delivery']
    },
    {
      name: 'Appointments & Bookings',
      shouldLoad: capabilities.booking,
      reason: capabilities.booking
        ? 'Booking capability enabled'
        : 'Booking disabled for this role',
      dependencies: ['booking']
    },
    {
      name: 'Medical Records',
      shouldLoad: capabilities.medical_records || capabilities.prescription,
      reason: capabilities.medical_records
        ? 'Medical records enabled'
        : capabilities.prescription
        ? 'Prescription capability enabled'
        : 'Medical features disabled',
      dependencies: ['medical_records', 'prescription', 'emergency']
    },
    {
      name: 'Tele-health',
      shouldLoad: capabilities.tele,
      reason: capabilities.tele
        ? 'Tele-health enabled'
        : 'Tele-health not available',
      dependencies: ['tele', 'chat']
    },
    {
      name: 'Reports & Analytics',
      shouldLoad: true, // Always available
      reason: 'Core feature - always available',
      dependencies: []
    },
    {
      name: 'Payment Settings',
      shouldLoad: true, // Always available
      reason: 'Core feature - always available',
      dependencies: []
    },
    {
      name: 'Live Tracking',
      shouldLoad: capabilities.gps_tracking,
      reason: capabilities.gps_tracking
        ? 'GPS tracking enabled'
        : 'GPS tracking not enabled',
      dependencies: ['gps_tracking']
    }
  ];

  const enabledModules = modules.filter(m => m.shouldLoad);
  const disabledModules = modules.filter(m => !m.shouldLoad);

  const capabilityGroups = {
    'Core Features': ['booking', 'chat', 'tele'],
    'Medical/Clinical': ['prescription', 'medical_records', 'emergency'],
    'Commerce': ['catalog', 'orders', 'inventory', 'delivery'],
    'Media/Content': ['photo_updates', 'gallery', 'portfolio', 'progress_tracking', 'cctv_access'],
    'Location & Tracking': ['gps_tracking'],
    'Administration': ['staff_management']
  };

  return (
    <>
      {/* Floating Toggle Button */}
      <Button onClick={() => setIsExpanded(!isExpanded)}
        className="fixed bottom-4 right-4 z-50 bg-purple-600 hover:bg-[#FF8C42] purple-700 text-white rounded-full p-3 shadow-lg transition-all duration-300 flex items-center gap-2"
        title="Developer: Capability Debug Panel"
      >
        <Code className="w-5 h-5" />
        {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
      </Button>

      {/* Debug Panel */}
      {isExpanded && (
        <div className="fixed bottom-20 right-4 z-50 w-96 max-h-[600px] bg-[#FF8C42] white rounded-xl shadow-2xl border-2 border-purple-600 overflow-hidden flex flex-col">
          {/* Header */}
          <div className="bg-[#FF8C42] purple-600 text-white p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Code className="w-5 h-5" />
                <h3 className="font-bold">Capability Debug Panel</h3>
              </div>
              <Badge className="bg-[#FF8C42] purple-800 text-white">DEV ONLY</Badge>
            </div>
            <p className="text-xs text-purple-200">Role-based module visibility audit</p>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-gray-200 bg-[#FF8C42] gray-50">
            <Button onClick={() => setActiveTab('modules')} className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === 'modules'
                  ? 'bg-white text-purple-600 border-b-2 border-purple-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Modules ({enabledModules.length}/{modules.length})
            </Button>
            <Button onClick={() => setActiveTab('capabilities')} className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === 'capabilities'
                  ? 'bg-white text-purple-600 border-b-2 border-purple-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Capabilities
            </Button>
            <Button onClick={() => setActiveTab('vendor')} className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === 'vendor'
                  ? 'bg-white text-purple-600 border-b-2 border-purple-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Vendor Info
            </Button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {/* Modules Tab */}
            {activeTab === 'modules' && (
              <>
                {/* Summary */}
                <Card className="p-3 bg-[#FF8C42] purple-50 border-purple-200">
                  <div className="flex items-center gap-2 mb-2">
                    <Info className="w-4 h-4 text-purple-600" />
                    <p className="text-xs font-semibold text-purple-900">Module Load Summary</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-gray-600">Enabled:</span>{' '}
                      <span className="font-bold text-green-700">{enabledModules.length}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Disabled:</span>{' '}
                      <span className="font-bold text-red-700">{disabledModules.length}</span>
                    </div>
                  </div>
                </Card>

                {/* Enabled Modules */}
                <div>
                  <h4 className="text-xs font-semibold text-gray-700 mb-2 flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    Enabled Modules
                  </h4>
                  <div className="space-y-2">
                    {enabledModules.map((module) => (
                      <Card key={module.name} className="p-2 bg-[#FF8C42] green-50 border-green-200">
                        <div className="flex items-start gap-2">
                          <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-gray-900">{module.name}</p>
                            <p className="text-xs text-gray-600 mt-0.5">{module.reason}</p>
                            {module.dependencies && module.dependencies.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {module.dependencies.map((dep) => (
                                  <Badge
                                    key={dep}
                                    className={`text-xs ${
                                      (capabilities as any)[dep]
                                        ? 'bg-green-100 text-green-800'
                                        : 'bg-gray-100 text-gray-600'
                                    }`}
                                  >
                                    {dep}
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>

                {/* Disabled Modules */}
                {disabledModules.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-gray-700 mb-2 flex items-center gap-2">
                      <XCircle className="w-4 h-4 text-red-600" />
                      Disabled Modules
                    </h4>
                    <div className="space-y-2">
                      {disabledModules.map((module) => (
                        <Card key={module.name} className="p-2 bg-[#FF8C42] red-50 border-red-200">
                          <div className="flex items-start gap-2">
                            <XCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium text-gray-900">{module.name}</p>
                              <p className="text-xs text-gray-600 mt-0.5">{module.reason}</p>
                              {module.dependencies && module.dependencies.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {module.dependencies.map((dep) => (
                                    <Badge key={dep} className="text-xs bg-[#FF8C42] gray-100 text-gray-600">
                                      {dep}
                                    </Badge>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Capabilities Tab */}
            {activeTab === 'capabilities' && (
              <>
                {Object.entries(capabilityGroups).map(([group, caps]) => (
                  <div key={group}>
                    <h4 className="text-xs font-semibold text-gray-700 mb-2">{group}</h4>
                    <div className="space-y-1">
                      {caps.map((cap) => {
                        const isEnabled = (capabilities as any)[cap];
                        return (
                          <div
                            key={cap}
                            className={`flex items-center justify-between p-2 rounded-lg ${
                              isEnabled ? 'bg-green-50' : 'bg-gray-50'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              {isEnabled ? (
                                <CheckCircle className="w-3 h-3 text-green-600" />
                              ) : (
                                <XCircle className="w-3 h-3 text-gray-400" />
                              )}
                              <span
                                className={`text-xs ${
                                  isEnabled ? 'text-gray-900 font-medium' : 'text-gray-500'
                                }`}
                              >
                                {cap}
                              </span>
                            </div>
                            <Badge
                              className={`text-xs ${
                                isEnabled
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-gray-100 text-gray-600'
                              }`}
                            >
                              {isEnabled ? 'ON' : 'OFF'}
                            </Badge>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </>
            )}

            {/* Vendor Info Tab */}
            {activeTab === 'vendor' && (
              <>
                <Card className="p-3 bg-[#FF8C42] blue-50 border-blue-200">
                  <h4 className="text-xs font-semibold text-blue-900 mb-2">Role Information</h4>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Role ID:</span>
                      <code className="bg-[#FF8C42] white px-2 py-0.5 rounded border border-blue-200 text-blue-900">
                        {roleId}
                      </code>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Role Name:</span>
                      <span className="font-medium text-gray-900">{roleName || 'N/A'}</span>
                    </div>
                  </div>
                </Card>

                <Card className="p-3 bg-orange-50 border-orange-200">
                  <h4 className="text-xs font-semibold text-orange-900 mb-2">Vendor Details</h4>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Vendor ID:</span>
                      <code className="bg-white px-2 py-0.5 rounded border border-orange-200 text-orange-900">
                        {vendorData?.id || 'N/A'}
                      </code>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Business Name:</span>
                      <span className="font-medium text-gray-900 truncate max-w-[180px]">
                        {vendorData?.businessName || vendorData?.fullName || 'N/A'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Vendor Type:</span>
                      <Badge className="bg-orange-100 text-orange-800">
                        {vendorData?.vendorType || 'individual'}
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Centres:</span>
                      <Badge className="bg-orange-100 text-orange-800">
                        {vendorData?.centres?.length || 0}
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Status:</span>
                      <Badge
                        className={
                          vendorData?.status === 'approved'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }
                      >
                        {vendorData?.status || 'unknown'}
                      </Badge>
                    </div>
                  </div>
                </Card>

                <Card className="p-3 bg-[#FF8C42] gray-50 border-gray-200">
                  <h4 className="text-xs font-semibold text-gray-900 mb-2">Service Styles</h4>
                  <div className="flex flex-wrap gap-1">
                    {vendorData?.serviceStyles && vendorData.serviceStyles.length > 0 ? (
                      vendorData.serviceStyles.map((style: string) => (
                        <Badge key={style} className="bg-[#FF8C42] blue-100 text-blue-800 text-xs">
                          {style}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-xs text-gray-500">No service styles configured</span>
                    )}
                  </div>
                </Card>

                <div className="p-2 bg-[#FF8C42] yellow-50 border border-yellow-200 rounded-lg">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-yellow-800">
                      This panel is only visible in development mode. It will not appear in
                      production builds.
                    </p>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-gray-200 bg-[#FF8C42] gray-50 px-4 py-2">
            <p className="text-xs text-gray-600 text-center">
              Capability-driven rendering • Dev Tools • v1.0
            </p>
          </div>
        </div>
      )}
    </>
  );
}