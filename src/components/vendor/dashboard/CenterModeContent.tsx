import { useState } from 'react';
import { Building2, Clock, MapPin, DollarSign, Users, Package, Plus, Settings } from 'lucide-react';
import { Card } from '../../ui/card';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';
import { ServiceCatalogManager } from './ServiceCatalogManager';
import { ServiceAreaConfigModal } from './ServiceAreaConfigModal';
import { OperatingHoursManager } from './OperatingHoursManager';
import { BusinessInfoEditor } from './BusinessInfoEditor';

interface CenterModeContentProps {
  session: {
    vendorId: string;
    centerId: string;
    staffId?: string;
    ownerName: string;
    roleName: string;
  };
  vendor: any;
  center: any;
  isSoloProvider: boolean;
  onRefresh: () => void;
}

export function CenterModeContent({
  session,
  vendor,
  center,
  isSoloProvider,
  onRefresh
}: CenterModeContentProps) {
  const [activeSection, setActiveSection] = useState<'overview' | 'services' | 'hours' | 'area' | 'business'>('overview');
  const [serviceAreaModalOpen, setServiceAreaModalOpen] = useState(false);

  return (
    <div className="space-y-6">
      {/* Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Button
          variant={activeSection === 'overview' ? 'default' : 'outline'}
          onClick={() => setActiveSection('overview')}
          className="flex flex-col items-center gap-2 h-auto py-4"
        >
          <Building2 className="w-5 h-5" />
          <span className="text-sm">Overview</span>
        </Button>
        <Button
          variant={activeSection === 'services' ? 'default' : 'outline'}
          onClick={() => setActiveSection('services')}
          className="flex flex-col items-center gap-2 h-auto py-4"
        >
          <Package className="w-5 h-5" />
          <span className="text-sm">Services</span>
        </Button>
        <Button
          variant={activeSection === 'hours' ? 'default' : 'outline'}
          onClick={() => setActiveSection('hours')}
          className="flex flex-col items-center gap-2 h-auto py-4"
        >
          <Clock className="w-5 h-5" />
          <span className="text-sm">Hours</span>
        </Button>
        <Button
          variant={activeSection === 'area' ? 'default' : 'outline'}
          onClick={() => setActiveSection('area')}
          className="flex flex-col items-center gap-2 h-auto py-4"
        >
          <MapPin className="w-5 h-5" />
          <span className="text-sm">Service Area</span>
        </Button>
        <Button
          variant={activeSection === 'business' ? 'default' : 'outline'}
          onClick={() => setActiveSection('business')}
          className="flex flex-col items-center gap-2 h-auto py-4"
        >
          <Settings className="w-5 h-5" />
          <span className="text-sm">Business Info</span>
        </Button>
      </div>

      {/* Content Sections */}
      {activeSection === 'overview' && (
        <div className="space-y-6">
          {/* Business Overview */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Business Overview</h2>
              <Badge variant="secondary" className="bg-orange-100 text-orange-800">
                Solo Provider
              </Badge>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <p className="text-sm text-gray-600 mb-1">Business Name</p>
                <p className="font-semibold">{center?.name || vendor?.businessName}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-1">Owner</p>
                <p className="font-semibold">{vendor?.ownerName}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-1">Role</p>
                <p className="font-semibold">{session.roleName}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-1">Phone</p>
                <p className="font-semibold">{center?.phone || vendor?.phone}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-1">Service Area</p>
                <p className="font-semibold">{center?.serviceArea?.displayText || 'Not configured'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-1">Status</p>
                <Badge variant={vendor?.status === 'approved' ? 'default' : 'secondary'}>
                  {vendor?.status || 'pending'}
                </Badge>
              </div>
            </div>
          </Card>

          {/* Quick Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="p-6">
              <div className="flex items-center gap-3">
                <div className="bg-[#FF8C42] blue-100 rounded-full p-3">
                  <Package className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Total Services</p>
                  <p className="text-2xl font-semibold">{center?.services?.length || 0}</p>
                </div>
              </div>
            </Card>
            <Card className="p-6">
              <div className="flex items-center gap-3">
                <div className="bg-[#FF8C42] green-100 rounded-full p-3">
                  <DollarSign className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Total Bookings</p>
                  <p className="text-2xl font-semibold">{center?.totalBookings || 0}</p>
                </div>
              </div>
            </Card>
            <Card className="p-6">
              <div className="flex items-center gap-3">
                <div className="bg-[#FF8C42] yellow-100 rounded-full p-3">
                  <Users className="w-6 h-6 text-yellow-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Rating</p>
                  <p className="text-2xl font-semibold">{center?.rating?.toFixed(1) || '0.0'}</p>
                </div>
              </div>
            </Card>
          </div>

          {/* Staff Management (Disabled for Solo) */}
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">Staff Management</h2>
            <div className="text-center py-8 bg-[#FF8C42] gray-50 rounded-lg">
              <Users className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <h3 className="font-semibold text-gray-700 mb-2">
                Solo Provider Mode
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                You're currently operating as a solo provider.<br />
                To add staff members, contact support@warmpawz.com
              </p>
              <Button variant="outline" size="sm">
                Contact Support
              </Button>
            </div>
          </Card>
        </div>
      )}

      {activeSection === 'services' && (
        <ServiceCatalogManager
          centerId={session.centerId}
          center={center}
          isSoloProvider={isSoloProvider}
          onUpdate={onRefresh}
        />
      )}

      {activeSection === 'hours' && (
        <OperatingHoursManager
          centerId={session.centerId}
          currentHours={center?.operatingHours}
          onUpdate={onRefresh}
        />
      )}

      {activeSection === 'area' && (
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Service Area Configuration</h2>
            <Button onClick={() => setServiceAreaModalOpen(true)}>
              <Settings className="w-4 h-4 mr-2" />
              Edit
            </Button>
          </div>
          {center?.serviceArea ? (
            <div className="space-y-3">
              <div>
                <p className="text-sm text-gray-600">Type</p>
                <p className="font-semibold capitalize">{center.serviceArea.type.replace('_', ' ')}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Coverage</p>
                <p className="font-semibold">{center.serviceArea.displayText}</p>
              </div>
              {center.serviceArea.type === 'RADIUS' && (
                <div>
                  <p className="text-sm text-gray-600">Radius</p>
                  <p className="font-semibold">{center.serviceArea.radiusKm} km</p>
                </div>
              )}
              {center.serviceArea.type === 'SPECIFIC_AREAS' && (
                <div>
                  <p className="text-sm text-gray-600 mb-2">Areas</p>
                  <div className="flex flex-wrap gap-2">
                    {center.serviceArea.areas?.map((area: string, idx: number) => (
                      <Badge key={idx} variant="secondary">{area}</Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8 bg-[#FF8C42] gray-50 rounded-lg">
              <MapPin className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-600 mb-4">No service area configured</p>
              <Button onClick={() => setServiceAreaModalOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Configure Service Area
              </Button>
            </div>
          )}
        </Card>
      )}

      {activeSection === 'business' && (
        <BusinessInfoEditor
          vendorId={session.vendorId}
          vendor={vendor}
          center={center}
          onUpdate={onRefresh}
        />
      )}

      {/* Service Area Modal */}
      {serviceAreaModalOpen && (
        <ServiceAreaConfigModal
          centerId={session.centerId}
          currentServiceArea={center?.serviceArea}
          onClose={() => setServiceAreaModalOpen(false)}
          onSave={() => {
            setServiceAreaModalOpen(false);
            onRefresh();
          }}
        />
      )}
    </div>
  );
}
