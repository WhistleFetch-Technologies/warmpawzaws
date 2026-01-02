import { useState, useEffect } from 'react';
import { CheckCircle, XCircle, Package, Power } from 'lucide-react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Switch } from '../ui/switch';
import { toast } from 'sonner';
import { projectId, publicAnonKey } from '../../utils/supabase/info';

interface StaffService {
  id: string;
  service_id: string;
  name: string;
  description: string;
  price: number;
  duration: number;
  category: string;
  service_style: string;
  isEnabled: boolean;
  canEnable: boolean;
}

interface StaffServiceEnablementProps {
  staffId: string;
  vendorId?: string;
  onUpdate?: () => void;
}

export function StaffServiceEnablement({ staffId, vendorId, onUpdate }: StaffServiceEnablementProps) {
  const [services, setServices] = useState<StaffService[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);

  const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475`;

  useEffect(() => {
    loadAvailableServices();
  }, [staffId]);

  const loadAvailableServices = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `${API_BASE}/staff/${staffId}/available-services`,
        {
          headers: { 'Authorization': `Bearer ${publicAnonKey}` }
        }
      );

      if (response.ok) {
        const data = await response.json();
        setServices(data.services || []);
      } else {
        throw new Error('Failed to load services');
      }
    } catch (error) {
      console.error('Error loading available services:', error);
      toast.error('Failed to load available services');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleService = async (service: StaffService) => {
    setToggling(service.service_id);
    try {
      const response = await fetch(
        `${API_BASE}/staff/${staffId}/services/${service.service_id}/enable`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${publicAnonKey}`
          },
          body: JSON.stringify({
            enabled: !service.isEnabled
          })
        }
      );

      if (response.ok) {
        const result = await response.json();
        toast.success(result.message || `Service ${!service.isEnabled ? 'enabled' : 'disabled'} successfully`);
        await loadAvailableServices();
        if (onUpdate) onUpdate();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to toggle service');
      }
    } catch (error) {
      console.error('Error toggling service:', error);
      toast.error('Failed to toggle service');
    } finally {
      setToggling(null);
    }
  };

  if (loading) {
    return (
      <Card className="p-6">
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600 mx-auto"></div>
          <p className="text-gray-600 mt-2">Loading available services...</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-semibold">Center Services</h2>
          <p className="text-sm text-gray-600 mt-1">
            Enable center services to offer them to customers
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={loadAvailableServices}>
          Refresh
        </Button>
      </div>

      {services.length === 0 ? (
        <div className="text-center py-8 bg-gray-50 rounded-lg">
          <Package className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-600">No center services available</p>
          <p className="text-sm text-gray-500 mt-1">
            Center services will appear here once they are published by the vendor
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {services.map((service) => (
            <div
              key={service.id}
              className={`border rounded-lg p-4 transition-colors ${
                service.isEnabled ? 'bg-green-50 border-green-200' : 'bg-white border-gray-200'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold">{service.name}</h3>
                    {service.isEnabled && (
                      <Badge className="bg-green-100 text-green-700 border-green-300">
                        <CheckCircle className="w-3 h-3 mr-1" />
                        Enabled
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 mb-2">{service.description}</p>
                  <div className="flex items-center gap-3 text-sm">
                    <Badge variant="secondary">₹{service.price}</Badge>
                    <Badge variant="secondary">{service.duration} mins</Badge>
                    <Badge variant="outline">{service.category}</Badge>
                    <Badge variant="outline">{service.service_style}</Badge>
                  </div>
                </div>
                <div className="ml-4">
                  <Switch
                    checked={service.isEnabled}
                    onCheckedChange={() => handleToggleService(service)}
                    disabled={toggling === service.service_id || !service.canEnable}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-sm text-blue-800">
          <strong>Note:</strong> Only center services (non-custom, non-package) can be enabled by staff. 
          Custom services and packages require vendor admin approval.
        </p>
      </div>
    </Card>
  );
}

