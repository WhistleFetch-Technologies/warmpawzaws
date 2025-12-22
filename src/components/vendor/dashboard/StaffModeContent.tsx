import { useState, useEffect } from 'react';
import { Calendar, MapPin, Navigation, CheckCircle, Clock, User, Award, Phone } from 'lucide-react';
import { Card } from '../../ui/card';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';
import { GPSTrackingWidget } from './GPSTrackingWidget';
import { ActiveBookingsList, AvailabilityToggle, TodaySchedule, StaffProfileEditor } from './SoloProviderHelpers';
import { projectId, publicAnonKey } from '../../../utils/supabase/info';

interface StaffModeContentProps {
  session: {
    vendorId: string;
    centerId: string;
    staffId: string;
    ownerName: string;
  };
  staff: any;
  center: any;
  isSoloProvider: boolean;
  onRefresh: () => void;
}

export function StaffModeContent({
  session,
  staff,
  center,
  isSoloProvider,
  onRefresh
}: StaffModeContentProps) {
  const [activeBookings, setActiveBookings] = useState<any[]>([]);
  const [todaySchedule, setTodaySchedule] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475`;

  useEffect(() => {
    fetchStaffData();
  }, [session.staffId]);

  const fetchStaffData = async () => {
    try {
      setLoading(true);
      console.log('🔍 Fetching staff data:', session.staffId);

      // Fetch active bookings
      const bookingsRes = await fetch(
        `${API_BASE}/staff/${session.staffId}/bookings/active`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`
          }
        }
      );

      if (bookingsRes.ok) {
        const bookingsData = await bookingsRes.json();
        if (bookingsData.success) {
          setActiveBookings(bookingsData.bookings || []);
        }
      }

      // Fetch today's schedule
      const today = new Date().toISOString().split('T')[0];
      const scheduleRes = await fetch(
        `${API_BASE}/staff/${session.staffId}/schedule?date=${today}`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`
          }
        }
      );

      if (scheduleRes.ok) {
        const scheduleData = await scheduleRes.json();
        if (scheduleData.success) {
          setTodaySchedule(scheduleData.schedule || []);
        }
      }

    } catch (error) {
      console.error('❌ Error fetching staff data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Staff Overview */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Staff Profile</h2>
          {isSoloProvider && (
            <Badge variant="secondary" className="bg-orange-100 text-orange-800">
              Owner
            </Badge>
          )}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <p className="text-sm text-gray-600 mb-1">Name</p>
            <p className="font-semibold">{staff?.name || session.ownerName}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600 mb-1">Phone</p>
            <p className="font-semibold">{staff?.phone}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600 mb-1">Experience</p>
            <p className="font-semibold">{staff?.experience || 0} years</p>
          </div>
          <div>
            <p className="text-sm text-gray-600 mb-1">Rating</p>
            <p className="font-semibold">⭐ {staff?.rating?.toFixed(1) || '0.0'}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600 mb-1">Total Bookings</p>
            <p className="font-semibold">{staff?.totalBookings || 0}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600 mb-1">Status</p>
            <AvailabilityToggle
              staffId={session.staffId}
              currentStatus={staff?.availability || 'available'}
              onUpdate={onRefresh}
            />
          </div>
        </div>
        {staff?.specializations && staff.specializations.length > 0 && (
          <div className="mt-4">
            <p className="text-sm text-gray-600 mb-2">Specializations</p>
            <div className="flex flex-wrap gap-2">
              {staff.specializations.map((spec: string, idx: number) => (
                <Badge key={idx} variant="secondary">{spec}</Badge>
              ))}
            </div>
          </div>
        )}
      </Card>

      {/* Active Bookings */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-orange-600" />
            Active Bookings
          </h2>
          <Badge variant="secondary">
            {activeBookings.length} active
          </Badge>
        </div>
        <ActiveBookingsList
          bookings={activeBookings}
          staffId={session.staffId}
          onUpdate={fetchStaffData}
        />
      </Card>

      {/* GPS Tracking */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Navigation className="w-5 h-5 text-orange-600" />
          <h2 className="text-xl font-semibold">GPS Tracking</h2>
        </div>
        <GPSTrackingWidget
          staffId={session.staffId}
          isSoloProvider={isSoloProvider}
          onUpdate={onRefresh}
        />
      </Card>

      {/* Today's Schedule */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Calendar className="w-5 h-5 text-orange-600" />
          <h2 className="text-xl font-semibold">Today's Schedule</h2>
        </div>
        <TodaySchedule
          schedule={todaySchedule}
          staffId={session.staffId}
        />
      </Card>

      {/* Professional Profile */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <User className="w-5 h-5 text-orange-600" />
          <h2 className="text-xl font-semibold">Professional Profile</h2>
        </div>
        <StaffProfileEditor
          staffId={session.staffId}
          staff={staff}
          onUpdate={onRefresh}
        />
      </Card>
    </div>
  );
}
