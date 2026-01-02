import { useState, useEffect } from 'react';
import { 
  Bug, X, ChevronDown, ChevronUp, Copy, CheckCircle, AlertTriangle,
  Eye, EyeOff, Shield, Building, Package, Users, Settings
} from 'lucide-react';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { toast } from 'sonner';

interface DebugOverlayProps {
  vendorData: any;
  roleConfiguration: any;
  currentUser: any;
}

export function DebugOverlay({ vendorData, roleConfiguration, currentUser }: DebugOverlayProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [expandedSections, setExpandedSections] = useState<{
    role: boolean;
    capabilities: boolean;
    services: boolean;
    centres: boolean;
    staff: boolean;
  }>({
    role: true,
    capabilities: true,
    services: false,
    centres: false,
    staff: false
  });

  // Only show in development or for admin users
  const isDev = import.meta.env.DEV || currentUser?.role === 'admin';

  useEffect(() => {
    // Keyboard shortcut: Ctrl+Shift+D to toggle overlay
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'D') {
        e.preventDefault();
        setIsVisible(prev => !prev);
      }
    };

    if (isDev) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isDev]);

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  };

  const copyJSON = (data: any, label: string) => {
    navigator.clipboard.writeText(JSON.stringify(data, null, 2));
    toast.success(`${label} JSON copied to clipboard`);
  };

  if (!isDev) return null;

  return (
    <>
      {/* Toggle Button (Fixed Position) */}
      {!isVisible && (
        <button
          onClick={() => setIsVisible(true)}
          className="fixed bottom-4 right-4 z-50 p-3 bg-purple-600 text-white rounded-full shadow-lg hover:bg-purple-700 transition-colors"
          title="Show Debug Overlay (Ctrl+Shift+D)"
        >
          <Bug className="w-5 h-5" />
        </button>
      )}

      {/* Debug Overlay Panel */}
      {isVisible && (
        <div className="fixed inset-y-0 right-0 z-50 w-full max-w-2xl bg-gray-900 text-white shadow-2xl overflow-y-auto">
          {/* Header */}
          <div className="sticky top-0 bg-purple-600 p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Bug className="w-6 h-6" />
              <div>
                <h2 className="font-bold text-lg">Debug Overlay</h2>
                <p className="text-xs text-purple-200">Developer Mode - Press Ctrl+Shift+D to toggle</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsVisible(false)}
              className="text-white hover:bg-purple-700"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>

          <div className="p-4 space-y-4">
            {/* Quick Info */}
            <Card className="bg-gray-800 border-gray-700 p-4">
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Vendor ID:</span>
                  <div className="flex items-center gap-2">
                    <code className="text-purple-400">{vendorData?.id || 'N/A'}</code>
                    <button
                      onClick={() => copyToClipboard(vendorData?.id, 'Vendor ID')}
                      className="text-gray-500 hover:text-white"
                    >
                      <Copy className="w-3 h-3" />
                    </button>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Business Name:</span>
                  <span className="text-white">{vendorData?.businessName || vendorData?.fullName}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Role ID:</span>
                  <div className="flex items-center gap-2">
                    <code className="text-yellow-400">{roleConfiguration?.roleId || 'N/A'}</code>
                    <button
                      onClick={() => copyToClipboard(roleConfiguration?.roleId, 'Role ID')}
                      className="text-gray-500 hover:text-white"
                    >
                      <Copy className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            </Card>

            {/* Section 1: Role Configuration */}
            <Card className="bg-gray-800 border-gray-700">
              <button
                onClick={() => toggleSection('role')}
                className="w-full p-4 flex items-center justify-between hover:bg-gray-750 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Shield className="w-5 h-5 text-blue-400" />
                  <span className="font-semibold">Role Configuration</span>
                </div>
                {expandedSections.role ? (
                  <ChevronUp className="w-5 h-5" />
                ) : (
                  <ChevronDown className="w-5 h-5" />
                )}
              </button>

              {expandedSections.role && roleConfiguration && (
                <div className="p-4 pt-0 space-y-3">
                  <div className="space-y-2 text-sm">
                    <div>
                      <div className="text-gray-400 mb-1">Role Name</div>
                      <div className="text-white font-medium">{roleConfiguration.roleName}</div>
                    </div>

                    <div>
                      <div className="text-gray-400 mb-1">Vendor Types</div>
                      <div className="flex flex-wrap gap-1">
                        {roleConfiguration.vendorTypes?.map((type: string) => (
                          <Badge key={type} className="bg-blue-600 text-white">
                            {type}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    <div>
                      <div className="text-gray-400 mb-1">Service Styles Allowed</div>
                      <div className="flex flex-wrap gap-1">
                        {roleConfiguration.serviceStyles?.map((style: string) => (
                          <Badge key={style} className="bg-green-600 text-white">
                            {style}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    <div>
                      <div className="text-gray-400 mb-1">Centre Management</div>
                      <Badge className={roleConfiguration.centreManagementEnabled ? 'bg-green-600' : 'bg-red-600'}>
                        {roleConfiguration.centreManagementEnabled ? 'Enabled' : 'Disabled'}
                      </Badge>
                    </div>

                    <div>
                      <div className="text-gray-400 mb-1">Staff Management</div>
                      <Badge className={roleConfiguration.staffManagementEnabled ? 'bg-green-600' : 'bg-red-600'}>
                        {roleConfiguration.staffManagementEnabled ? 'Enabled' : 'Disabled'}
                      </Badge>
                    </div>
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyJSON(roleConfiguration, 'Role Configuration')}
                    className="w-full"
                  >
                    <Copy className="w-4 h-4 mr-2" />
                    Copy Full JSON
                  </Button>
                </div>
              )}
            </Card>

            {/* Section 2: Resolved Capabilities */}
            <Card className="bg-gray-800 border-gray-700">
              <button
                onClick={() => toggleSection('capabilities')}
                className="w-full p-4 flex items-center justify-between hover:bg-gray-750 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Settings className="w-5 h-5 text-purple-400" />
                  <span className="font-semibold">Resolved Capabilities</span>
                </div>
                {expandedSections.capabilities ? (
                  <ChevronUp className="w-5 h-5" />
                ) : (
                  <ChevronDown className="w-5 h-5" />
                )}
              </button>

              {expandedSections.capabilities && (
                <div className="p-4 pt-0 space-y-3">
                  <div className="bg-gray-900 rounded-lg p-3 space-y-2 text-sm">
                    {[
                      { key: 'canManageCentres', label: 'Manage Centres', enabled: roleConfiguration?.centreManagementEnabled },
                      { key: 'canManageStaff', label: 'Manage Staff', enabled: roleConfiguration?.staffManagementEnabled },
                      { key: 'canPublishServices', label: 'Publish Services', enabled: true },
                      { key: 'canCreatePackages', label: 'Create Custom Packages', enabled: vendorData?.centres?.length > 0 },
                      { key: 'canOfferHomeServices', label: 'Offer Home Services', enabled: roleConfiguration?.serviceStyles?.includes('at_home') },
                      { key: 'canOfferTeleServices', label: 'Offer Tele Services', enabled: roleConfiguration?.serviceStyles?.includes('tele') },
                      { key: 'canOfferCentreServices', label: 'Offer Centre Services', enabled: roleConfiguration?.serviceStyles?.includes('at_center') },
                    ].map(({ key, label, enabled }) => (
                      <div key={key} className="flex items-center justify-between">
                        <span className="text-gray-400">{label}</span>
                        <div className="flex items-center gap-2">
                          {enabled ? (
                            <>
                              <CheckCircle className="w-4 h-4 text-green-500" />
                              <span className="text-green-500">Enabled</span>
                            </>
                          ) : (
                            <>
                              <X className="w-4 h-4 text-red-500" />
                              <span className="text-red-500">Disabled</span>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="bg-yellow-900 border border-yellow-700 rounded-lg p-3">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-yellow-400 mt-0.5" />
                      <div className="text-xs text-yellow-200">
                        <p className="font-semibold mb-1">Capability Resolution Rules:</p>
                        <ul className="list-disc list-inside space-y-1">
                          <li>Custom packages require centres.length > 0</li>
                          <li>Service styles filtered by roleConfiguration</li>
                          <li>Staff management follows roleConfig setting</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </Card>

            {/* Section 3: Published Services */}
            <Card className="bg-gray-800 border-gray-700">
              <button
                onClick={() => toggleSection('services')}
                className="w-full p-4 flex items-center justify-between hover:bg-gray-750 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Package className="w-5 h-5 text-green-400" />
                  <span className="font-semibold">
                    Published Services ({vendorData?.publishedServices?.length || 0})
                  </span>
                </div>
                {expandedSections.services ? (
                  <ChevronUp className="w-5 h-5" />
                ) : (
                  <ChevronDown className="w-5 h-5" />
                )}
              </button>

              {expandedSections.services && (
                <div className="p-4 pt-0 space-y-2">
                  {vendorData?.publishedServices && vendorData.publishedServices.length > 0 ? (
                    <>
                      {vendorData.publishedServices.map((service: any, index: number) => (
                        <div key={service.id || index} className="bg-gray-900 rounded-lg p-3">
                          <div className="flex items-start justify-between mb-2">
                            <div>
                              <div className="font-medium text-white">{service.name}</div>
                              <div className="text-xs text-gray-400">{service.category}</div>
                            </div>
                            <Badge className={
                              service.serviceStyle === 'at_home' ? 'bg-orange-600' :
                              service.serviceStyle === 'tele' ? 'bg-blue-600' :
                              'bg-green-600'
                            }>
                              {service.serviceStyle}
                            </Badge>
                          </div>

                          <div className="space-y-1 text-xs">
                            <div className="flex items-center justify-between">
                              <span className="text-gray-400">Base Price:</span>
                              <span className="text-white">₹{service.basePrice}</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-gray-400">Publish Level:</span>
                              <span className="text-white">{service.publishLevel || 'vendor'}</span>
                            </div>
                            {service.gpsRequired && (
                              <div className="flex items-center gap-1 text-blue-400">
                                <CheckCircle className="w-3 h-3" />
                                <span>GPS Required</span>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyJSON(vendorData.publishedServices, 'Published Services')}
                        className="w-full mt-2"
                      >
                        <Copy className="w-4 h-4 mr-2" />
                        Copy Services JSON
                      </Button>
                    </>
                  ) : (
                    <div className="bg-gray-900 rounded-lg p-4 text-center text-gray-500">
                      No published services
                    </div>
                  )}
                </div>
              )}
            </Card>

            {/* Section 4: Centres */}
            <Card className="bg-gray-800 border-gray-700">
              <button
                onClick={() => toggleSection('centres')}
                className="w-full p-4 flex items-center justify-between hover:bg-gray-750 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Building className="w-5 h-5 text-yellow-400" />
                  <span className="font-semibold">
                    Centres ({vendorData?.centres?.length || 0})
                  </span>
                </div>
                {expandedSections.centres ? (
                  <ChevronUp className="w-5 h-5" />
                ) : (
                  <ChevronDown className="w-5 h-5" />
                )}
              </button>

              {expandedSections.centres && (
                <div className="p-4 pt-0 space-y-2">
                  {vendorData?.centres && vendorData.centres.length > 0 ? (
                    <>
                      {vendorData.centres.map((centre: any, index: number) => (
                        <div key={centre.id || index} className="bg-gray-900 rounded-lg p-3">
                          <div className="font-medium text-white mb-1">{centre.name}</div>
                          <div className="space-y-1 text-xs">
                            <div className="text-gray-400">{centre.address}</div>
                            <div className="flex items-center justify-between">
                              <span className="text-gray-400">Max Concurrent:</span>
                              <span className="text-white">{centre.maxConcurrentBookings || 'N/A'}</span>
                            </div>
                            {centre.location && (
                              <div className="text-gray-500">
                                Lat: {centre.location.latitude}, Lng: {centre.location.longitude}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyJSON(vendorData.centres, 'Centres')}
                        className="w-full mt-2"
                      >
                        <Copy className="w-4 h-4 mr-2" />
                        Copy Centres JSON
                      </Button>
                    </>
                  ) : (
                    <div className="bg-gray-900 rounded-lg p-4 text-center">
                      <div className="text-gray-500 mb-2">No centres configured</div>
                      {!roleConfiguration?.centreManagementEnabled && (
                        <div className="text-xs text-yellow-400">
                          Centre management is disabled for this role
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </Card>

            {/* Section 5: Staff */}
            <Card className="bg-gray-800 border-gray-700">
              <button
                onClick={() => toggleSection('staff')}
                className="w-full p-4 flex items-center justify-between hover:bg-gray-750 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Users className="w-5 h-5 text-pink-400" />
                  <span className="font-semibold">
                    Staff ({vendorData?.staff?.length || 0})
                  </span>
                </div>
                {expandedSections.staff ? (
                  <ChevronUp className="w-5 h-5" />
                ) : (
                  <ChevronDown className="w-5 h-5" />
                )}
              </button>

              {expandedSections.staff && (
                <div className="p-4 pt-0 space-y-2">
                  {vendorData?.staff && vendorData.staff.length > 0 ? (
                    <>
                      {vendorData.staff.map((member: any, index: number) => (
                        <div key={member.id || index} className="bg-gray-900 rounded-lg p-3">
                          <div className="font-medium text-white mb-1">{member.fullName}</div>
                          <div className="space-y-1 text-xs">
                            <div className="flex items-center justify-between">
                              <span className="text-gray-400">Role:</span>
                              <span className="text-white">{member.role || 'N/A'}</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-gray-400">Email:</span>
                              <span className="text-white">{member.email}</span>
                            </div>
                            {member.specializations && (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {member.specializations.map((spec: string) => (
                                  <Badge key={spec} variant="outline" className="text-xs">
                                    {spec}
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyJSON(vendorData.staff, 'Staff')}
                        className="w-full mt-2"
                      >
                        <Copy className="w-4 h-4 mr-2" />
                        Copy Staff JSON
                      </Button>
                    </>
                  ) : (
                    <div className="bg-gray-900 rounded-lg p-4 text-center">
                      <div className="text-gray-500 mb-2">No staff members</div>
                      {!roleConfiguration?.staffManagementEnabled && (
                        <div className="text-xs text-yellow-400">
                          Staff management is disabled for this role
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </Card>

            {/* How to Use */}
            <Card className="bg-blue-900 border-blue-700 p-4">
              <h3 className="font-semibold text-blue-100 mb-2">How to Use Debug Overlay</h3>
              <div className="space-y-2 text-sm text-blue-200">
                <div className="flex items-start gap-2">
                  <span className="font-mono bg-blue-800 px-2 py-0.5 rounded">Ctrl+Shift+D</span>
                  <span>Toggle overlay on/off</span>
                </div>
                <div className="flex items-start gap-2">
                  <Copy className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>Click copy icons to copy individual values or full JSON to clipboard</span>
                </div>
                <div className="flex items-start gap-2">
                  <Eye className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>Use to validate role configuration, capabilities, and published content</span>
                </div>
              </div>
            </Card>
          </div>
        </div>
      )}
    </>
  );
}
