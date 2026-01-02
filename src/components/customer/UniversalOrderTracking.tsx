import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Separator } from '../ui/separator';
import { Package, Truck, MapPin, Clock, CheckCircle, XCircle, RefreshCw, ArrowLeft } from 'lucide-react';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import { toast } from 'sonner';

interface TrackingEvent {
  timestamp: string;
  status: string;
  location: string;
  description?: string;
}

interface ShipmentInfo {
  trackingId: string;
  awb?: string;
  partner: string;
  status: string;
  currentLocation?: string;
  estimatedDelivery?: string;
  events: TrackingEvent[];
}

const STATUS_CONFIG = {
  ORDER_CREATED: { label: 'Order Created', color: 'bg-blue-500', icon: Package },
  PICKED_UP: { label: 'Picked Up', color: 'bg-indigo-500', icon: Truck },
  IN_TRANSIT: { label: 'In Transit', color: 'bg-purple-500', icon: Truck },
  OUT_FOR_DELIVERY: { label: 'Out for Delivery', color: 'bg-orange-500', icon: MapPin },
  DELIVERED: { label: 'Delivered', color: 'bg-green-500', icon: CheckCircle },
  FAILED: { label: 'Delivery Failed', color: 'bg-red-500', icon: XCircle },
  RTO: { label: 'Return to Origin', color: 'bg-yellow-500', icon: RefreshCw }
};

export function UniversalOrderTracking({ 
  orderId, 
  trackingId,
  onBack 
}: { 
  orderId: string;
  trackingId?: string;
  onBack?: () => void;
}) {
  const [shipment, setShipment] = useState<ShipmentInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (trackingId) {
      fetchTrackingInfo();
    } else {
      fetchShipmentByOrder();
    }
  }, [orderId, trackingId]);

  const fetchShipmentByOrder = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/orders/${orderId}/shipment`,
        { headers: { Authorization: `Bearer ${publicAnonKey}` } }
      );
      const data = await response.json();
      if (data.success && data.shipment) {
        setShipment(data.shipment);
      } else {
        setError('No shipment information available');
      }
    } catch (err) {
      console.error('Error fetching shipment:', err);
      setError('Failed to load shipment information');
    } finally {
      setLoading(false);
    }
  };

  const fetchTrackingInfo = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/logistics/track/${trackingId}`,
        { headers: { Authorization: `Bearer ${publicAnonKey}` } }
      );
      const data = await response.json();
      if (data.success) {
        setShipment(data.data);
      } else {
        setError('Tracking information not available');
      }
    } catch (err) {
      console.error('Error fetching tracking:', err);
      setError('Failed to load tracking information');
    } finally {
      setLoading(false);
    }
  };

  const refreshTracking = () => {
    if (trackingId) {
      fetchTrackingInfo();
    } else {
      fetchShipmentByOrder();
    }
    toast.success('Tracking information refreshed');
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <RefreshCw className="w-8 h-8 text-slate-400 animate-spin mx-auto mb-4" />
          <p className="text-slate-600">Loading tracking information...</p>
        </CardContent>
      </Card>
    );
  }

  if (error || !shipment) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <XCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h3 className="font-semibold text-slate-900 mb-2">Tracking Not Available</h3>
          <p className="text-sm text-slate-600 mb-4">{error || 'Shipment information not found'}</p>
          {onBack && (
            <Button variant="outline" onClick={onBack}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Go Back
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  const currentStatus = STATUS_CONFIG[shipment.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.IN_TRANSIT;
  const StatusIcon = currentStatus.icon;

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              {onBack && (
                <Button variant="ghost" size="icon" onClick={onBack}>
                  <ArrowLeft className="w-5 h-5" />
                </Button>
              )}
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Truck className="w-5 h-5 text-orange-600" />
                  Track Shipment
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Order #{orderId.slice(0, 16)}...
                </p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={refreshTracking}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Shipment Details */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-slate-50 rounded-lg">
            <div>
              <div className="text-xs text-muted-foreground mb-1">AWB Number</div>
              <div className="font-mono text-sm font-semibold">{shipment.awb || shipment.trackingId}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">Courier Partner</div>
              <Badge variant="outline" className="capitalize">{shipment.partner}</Badge>
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">Current Status</div>
              <Badge className={currentStatus.color + ' text-white'}>
                {currentStatus.label}
              </Badge>
            </div>
            {shipment.estimatedDelivery && (
              <div>
                <div className="text-xs text-muted-foreground mb-1">Est. Delivery</div>
                <div className="text-sm font-medium flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {new Date(shipment.estimatedDelivery).toLocaleDateString()}
                </div>
              </div>
            )}
          </div>

          {/* Current Location */}
          {shipment.currentLocation && (
            <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <MapPin className="w-4 h-4 text-blue-600" />
              <div>
                <div className="text-xs text-blue-600 font-medium">Current Location</div>
                <div className="text-sm text-blue-900">{shipment.currentLocation}</div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tracking Timeline */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tracking Timeline</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {shipment.events && shipment.events.length > 0 ? (
              shipment.events.map((event, index) => {
                const eventStatus = STATUS_CONFIG[event.status as keyof typeof STATUS_CONFIG];
                const EventIcon = eventStatus?.icon || Package;
                const isLast = index === shipment.events.length - 1;

                return (
                  <div key={index} className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <div className={`p-2 rounded-full ${eventStatus?.color || 'bg-slate-500'} bg-opacity-20`}>
                        <EventIcon className={`w-4 h-4 ${eventStatus?.color.replace('bg-', 'text-') || 'text-slate-500'}`} />
                      </div>
                      {!isLast && (
                        <div className="w-0.5 h-full bg-slate-200 mt-2" />
                      )}
                    </div>

                    <div className="flex-1 pb-6">
                      <div className="flex items-start justify-between mb-1">
                        <div>
                          <h4 className="font-semibold text-slate-900">{eventStatus?.label || event.status}</h4>
                          {event.location && (
                            <p className="text-sm text-slate-600 flex items-center gap-1 mt-1">
                              <MapPin className="w-3 h-3" />
                              {event.location}
                            </p>
                          )}
                          {event.description && (
                            <p className="text-sm text-muted-foreground mt-1">{event.description}</p>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground whitespace-nowrap ml-4">
                          {new Date(event.timestamp).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No tracking events available yet</p>
                <p className="text-xs mt-1">Check back later for updates</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Help Section */}
      <Card className="border-blue-200 bg-blue-50/50">
        <CardContent className="p-4">
          <h4 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
            <Package className="w-4 h-4" />
            Need Help?
          </h4>
          <p className="text-sm text-blue-800 mb-3">
            If you have any questions about your delivery, please contact our support team.
          </p>
          <Button variant="outline" size="sm" className="border-blue-300 text-blue-700 hover:bg-blue-100">
            Contact Support
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
