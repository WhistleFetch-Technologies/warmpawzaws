import { useState, useEffect } from 'react';
import { LoadingState, ErrorState, EmptyState } from '../../ui/states';
import { Button } from '../../ui/button';
import { ArrowLeft, MapPin, Truck, Calendar, Clock, CheckCircle } from 'lucide-react';
import { projectId, publicAnonKey } from '../../../utils/supabase/info';

interface OrderTrackingPageProps {
  orderId: string;
  onBack: () => void;
}

export function OrderTrackingPage({ orderId, onBack }: OrderTrackingPageProps) {
  const [order, setOrder] = useState<any>(null);
  const [tracking, setTracking] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475`;
  const getAuthHeaders = () => ({
    'Authorization': `Bearer ${publicAnonKey}`,
    'apikey': publicAnonKey
  });

  useEffect(() => {
    fetchOrderAndTracking();
  }, [orderId]);
  
  const fetchOrderAndTracking = async () => {
    try {
      setLoading(true);
      
      // Fetch order
      const orderResponse = await fetch(
        `${API_BASE}/ecommerce/orders/${orderId}`,
        { headers: getAuthHeaders() }
      );
      
      if (!orderResponse.ok) {
        throw new Error('Failed to fetch order');
      }
      
      const orderData = await orderResponse.json();
      setOrder(orderData.order);
      
      // Fetch tracking if AWB code exists
      if (orderData.order.shiprocketAwbCode) {
        const trackingResponse = await fetch(
          `${API_BASE}/ecommerce/orders/${orderId}/shiprocket/tracking`,
          { headers: getAuthHeaders() }
        );
        
        if (trackingResponse.ok) {
          const trackingData = await trackingResponse.json();
          setTracking(trackingData.tracking);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tracking');
    } finally {
      setLoading(false);
    }
  };
  
  if (loading) return <LoadingState message="Loading tracking info..." />;
  if (error) return <ErrorState message={error} />;
  if (!order) return <EmptyState message="Order not found" />;
  
  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <div className="bg-white border-b px-4 py-4 sticky top-0 z-10 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-lg font-bold">Track Order</h1>
          <p className="text-xs text-gray-500">#{order.orderNumber}</p>
        </div>
      </div>
      
      <div className="container mx-auto px-4 py-6 max-w-lg">
        {/* Order Info Card */}
        <div className="bg-white rounded-xl shadow-sm p-5 mb-6">
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="text-sm text-gray-500">Status</p>
              <p className="text-lg font-bold capitalize text-blue-600">{order.status}</p>
            </div>
            {order.shiprocketCourierName && (
              <div className="text-right">
                <p className="text-sm text-gray-500">Courier</p>
                <p className="font-medium">{order.shiprocketCourierName}</p>
              </div>
            )}
          </div>
          
          {order.shiprocketAwbCode && (
            <div className="bg-gray-50 p-3 rounded-lg flex justify-between items-center">
              <span className="text-sm text-gray-600">AWB Code</span>
              <span className="font-mono font-medium">{order.shiprocketAwbCode}</span>
            </div>
          )}
        </div>
        
        {/* Tracking Timeline */}
        {tracking ? (
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold mb-6 flex items-center gap-2">
              <Truck className="w-5 h-5 text-gray-600" />
              Tracking Timeline
            </h2>
            <div className="space-y-0">
              {tracking.tracking_data?.shipment_track?.map((event: any, index: number) => {
                const isLast = index === tracking.tracking_data.shipment_track.length - 1;
                return (
                  <div key={index} className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <div className={`w-3 h-3 rounded-full ${index === 0 ? 'bg-blue-600 ring-4 ring-blue-50' : 'bg-gray-300'}`}></div>
                      {!isLast && <div className="w-0.5 h-full bg-gray-100 my-1"></div>}
                    </div>
                    <div className="flex-1 pb-8">
                      <p className={`font-medium ${index === 0 ? 'text-gray-900' : 'text-gray-600'}`}>
                        {event.status}
                      </p>
                      <div className="flex items-center gap-1 text-xs text-gray-500 mt-1">
                        <MapPin className="w-3 h-3" />
                        {event.location}
                      </div>
                      <div className="flex items-center gap-1 text-xs text-gray-400 mt-1">
                        <Calendar className="w-3 h-3" />
                        {event.date}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 p-4 rounded-xl flex items-start gap-3">
             <Clock className="w-5 h-5 flex-shrink-0 mt-0.5" />
             <div>
               <p className="font-medium">Tracking Pending</p>
               <p className="text-sm mt-1 text-yellow-700">
                 Detailed tracking information will be available once the courier picks up your package.
               </p>
             </div>
          </div>
        )}
      </div>
    </div>
  );
}
