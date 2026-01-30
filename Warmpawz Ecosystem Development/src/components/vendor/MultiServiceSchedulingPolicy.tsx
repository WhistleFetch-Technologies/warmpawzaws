import React, { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import { Label } from '../ui/label';
import { Switch } from '../ui/switch';
import { Slider } from '../ui/slider';
import { toast } from 'sonner@2.0.3';
import { Save, MapPin, Clock, Truck, ShieldAlert } from 'lucide-react';
import { getApiBaseUrl, getAuthHeaders } from '../../utils/api-config';

interface SchedulingPolicy {
  vendorId: string;
  serviceRadius: number; // km
  bufferTime: number; // minutes
  commuteAllowance: number; // minutes per km
  maxDailyTravelTime: number; // minutes
  enableTrafficFactor: boolean;
  multiServiceBuffer: number; // extra buffer when switching service types
}

export function MultiServiceSchedulingPolicy({ vendorId }: { vendorId: string }) {
  const [loading, setLoading] = useState(false);
  const [policy, setPolicy] = useState<SchedulingPolicy>({
    vendorId,
    serviceRadius: 10,
    bufferTime: 15,
    commuteAllowance: 3, // 3 min per km (approx 20km/h)
    maxDailyTravelTime: 120,
    enableTrafficFactor: true,
    multiServiceBuffer: 30
  });

  useEffect(() => {
    loadPolicy();
  }, [vendorId]);

  const loadPolicy = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `${getApiBaseUrl()}/vendor/${vendorId}/scheduling-policy`,
        { headers: getAuthHeaders() }
      );

      if (response.ok) {
        const data = await response.json();
        if (data.policy) {
          setPolicy(data.policy);
        }
      }
    } catch (error) {
      console.error('Error loading policy:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `${getApiBaseUrl()}/vendor/${vendorId}/scheduling-policy`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            ...getAuthHeaders()
          },
          body: JSON.stringify(policy)
        }
      );

      if (response.ok) {
        toast.success('Scheduling policy saved successfully');
      } else {
        toast.error('Failed to save policy');
      }
    } catch (error) {
      console.error('Error saving policy:', error);
      toast.error('Error saving policy');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto p-6">
      <div className="flex justify-between items-center">
        <div>
            <h2 className="text-2xl font-bold text-gray-900">Scheduling & Travel Policy</h2>
            <p className="text-gray-500">Configure how far you travel and how you manage buffers between appointments.</p>
        </div>
        <Button onClick={handleSave} disabled={loading} className="bg-orange-600 hover:bg-orange-700">
            <Save className="w-4 h-4 mr-2" />
            {loading ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Service Radius */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="w-5 h-5 text-orange-600" />
              Service Coverage Radius
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
                <div className="flex justify-between">
                    <Label>Maximum Travel Distance</Label>
                    <span className="font-bold text-orange-600">{policy.serviceRadius} km</span>
                </div>
                <Slider
                    value={[policy.serviceRadius]}
                    min={1}
                    max={50}
                    step={1}
                    onValueChange={(val) => setPolicy({ ...policy, serviceRadius: val[0] })}
                />
                <p className="text-xs text-gray-500">
                    Customers outside this radius will not see your services in search results.
                </p>
            </div>

            <div className="bg-blue-50 p-4 rounded-lg flex gap-3">
                <ShieldAlert className="w-5 h-5 text-blue-600 flex-shrink-0" />
                <div className="text-sm text-blue-800">
                    <strong>Note:</strong> Increasing radius may increase travel costs and time. Ensure your pricing covers long-distance travel.
                </div>
            </div>
          </CardContent>
        </Card>

        {/* Travel Time & Traffic */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Truck className="w-5 h-5 text-green-600" />
              Travel Time Configuration
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
             <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                    <Label>Enable Traffic Factor</Label>
                    <p className="text-xs text-gray-500">Adjust commute time based on live traffic data (approx)</p>
                </div>
                <Switch
                    checked={policy.enableTrafficFactor}
                    onCheckedChange={(checked) => setPolicy({ ...policy, enableTrafficFactor: checked })}
                />
            </div>

            <div className="space-y-2">
                <div className="flex justify-between">
                    <Label>Commute Allowance</Label>
                    <span className="font-bold text-gray-900">{policy.commuteAllowance} min/km</span>
                </div>
                <Slider
                    value={[policy.commuteAllowance]}
                    min={1}
                    max={10}
                    step={0.5}
                    onValueChange={(val) => setPolicy({ ...policy, commuteAllowance: val[0] })}
                />
                <p className="text-xs text-gray-500">
                    Estimated time to travel 1 km. Used to block out calendar time for travel.
                </p>
            </div>

             <div className="space-y-2">
                <div className="flex justify-between">
                    <Label>Max Daily Travel Time</Label>
                    <span className="font-bold text-gray-900">{Math.floor(policy.maxDailyTravelTime / 60)}h {policy.maxDailyTravelTime % 60}m</span>
                </div>
                <Slider
                    value={[policy.maxDailyTravelTime]}
                    min={30}
                    max={300}
                    step={15}
                    onValueChange={(val) => setPolicy({ ...policy, maxDailyTravelTime: val[0] })}
                />
                <p className="text-xs text-gray-500">
                    Stop accepting bookings if total travel time exceeds this limit.
                </p>
            </div>
          </CardContent>
        </Card>

        {/* Buffers */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-purple-600" />
              Appointment Buffers
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4">
                <div className="space-y-2">
                    <div className="flex justify-between">
                        <Label>Standard Buffer Time</Label>
                        <span className="font-bold text-purple-600">{policy.bufferTime} min</span>
                    </div>
                    <Slider
                        value={[policy.bufferTime]}
                        min={0}
                        max={60}
                        step={5}
                        onValueChange={(val) => setPolicy({ ...policy, bufferTime: val[0] })}
                    />
                    <p className="text-xs text-gray-500">
                        Gap added after every appointment for rest and prep.
                    </p>
                </div>
            </div>

            <div className="space-y-4">
                <div className="space-y-2">
                    <div className="flex justify-between">
                        <Label>Multi-Service Switch Buffer</Label>
                        <span className="font-bold text-purple-600">{policy.multiServiceBuffer} min</span>
                    </div>
                    <Slider
                        value={[policy.multiServiceBuffer]}
                        min={0}
                        max={60}
                        step={5}
                        onValueChange={(val) => setPolicy({ ...policy, multiServiceBuffer: val[0] })}
                    />
                    <p className="text-xs text-gray-500">
                        Extra time added when switching service types (e.g., from Walking to Grooming).
                    </p>
                </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
