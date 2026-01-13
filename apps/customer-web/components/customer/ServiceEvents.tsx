'use client';

import React, { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';
import { Calendar, MapPin, Clock, Users, ArrowRight } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface ServiceEvent {
  id: string;
  title: string;
  description: string;
  category: string;
  start_date: string;
  end_date: string;
  start_time: string;
  end_time: string;
  location: string;
  image_url?: string;
  registration_fee: number;
  max_participants?: number;
  registered_count: number;
  status: string;
}

interface ServiceEventsProps {
  serviceId: string;
  vendorId?: string;
  className?: string;
}

export function ServiceEvents({ serviceId, vendorId, className = '' }: ServiceEventsProps) {
  const [events, setEvents] = useState<ServiceEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    loadEvents();
  }, [serviceId, vendorId]);

  const loadEvents = async () => {
    try {
      setLoading(true);
      // Try to get events by service ID first, then fallback to vendor ID
      let data;
      if (serviceId) {
        try {
          data = await apiClient.get<any>(`/events/service/${serviceId}`);
        } catch {
          // If service endpoint fails, try vendor endpoint
          if (vendorId) {
            data = await apiClient.get<any>(`/events/vendor/${vendorId}?upcoming=true`);
          }
        }
      } else if (vendorId) {
        data = await apiClient.get<any>(`/events/vendor/${vendorId}?upcoming=true`);
      }

      if (data?.events) {
        setEvents(data.events.slice(0, 3)); // Show max 3 events
      } else if (Array.isArray(data)) {
        setEvents(data.slice(0, 3));
      }
    } catch (error: any) {
      console.error('Error loading service events:', error);
      setEvents([]);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className={`${className}`}>
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-gray-200 rounded w-1/3"></div>
          <div className="h-20 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (events.length === 0) {
    return null;
  }

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return dateString;
    }
  };

  return (
    <div className={`${className}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <Calendar className="w-5 h-5 text-orange-500" />
          Related Events
        </h3>
        <button
          onClick={() => router.push('/events')}
          className="text-sm text-orange-500 hover:text-orange-600 flex items-center gap-1"
        >
          View All <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      <div className="space-y-3">
        {events.map((event) => (
          <div
            key={event.id}
            onClick={() => router.push(`/events?eventId=${event.id}`)}
            className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow cursor-pointer"
          >
            <div className="flex items-start justify-between mb-2">
              <h4 className="font-semibold text-gray-900 text-sm">{event.title}</h4>
              {event.registration_fee > 0 && (
                <span className="text-xs font-medium text-orange-600">₹{event.registration_fee}</span>
              )}
            </div>

            {event.description && (
              <p className="text-xs text-gray-600 mb-3 line-clamp-2">{event.description}</p>
            )}

            <div className="space-y-1 text-xs text-gray-500">
              <div className="flex items-center gap-2">
                <Clock className="w-3 h-3" />
                <span>{formatDate(event.start_date)}</span>
                {event.start_time && <span>• {event.start_time}</span>}
              </div>
              {event.location && (
                <div className="flex items-center gap-2">
                  <MapPin className="w-3 h-3" />
                  <span className="line-clamp-1">{event.location}</span>
                </div>
              )}
              {(event.max_participants || event.registered_count) && (
                <div className="flex items-center gap-2">
                  <Users className="w-3 h-3" />
                  <span>
                    {event.registered_count || 0} / {event.max_participants || '∞'} registered
                  </span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
