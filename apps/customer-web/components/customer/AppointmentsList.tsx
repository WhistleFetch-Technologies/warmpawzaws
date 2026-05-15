'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Calendar, Clock, MapPin, ChevronRight, Sparkles, PawPrint } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { ApiError } from '@/lib/error-handling';
import {
  getResolvedCustomerId,
  isCustomerDatabaseUuid,
  persistCustomerDatabaseId,
} from '@/lib/customer-id-storage';
import { ServiceDashboardHeader } from './shared/ServiceDashboardHeader';

export interface AppointmentsListProps {
  /** Customer login phone (used to resolve DB customer UUID). */
  phone: string;
  onBack: () => void;
  onCloseToHome?: () => void;
  onSelectAppointment: (appointmentId: string) => void;
}

type Row = {
  id: string;
  serviceName: string;
  serviceStyle: string;
  status: string;
  date: string;
  startTime: string;
  locationName: string;
  petName?: string;
  amount: number;
};

/** Normalize list payloads from `{ appointments }`, `{ data: { appointments } }`, or a bare array. */
function extractAppointmentsFromResponse(data: unknown): unknown[] {
  if (Array.isArray(data)) return data;
  if (!data || typeof data !== 'object') return [];
  const d = data as Record<string, unknown>;
  if (Array.isArray(d.appointments)) return d.appointments;
  const inner = d.data;
  if (inner && typeof inner === 'object') {
    const i = inner as Record<string, unknown>;
    if (Array.isArray(i.appointments)) return i.appointments;
  }
  return [];
}

function mapRow(raw: Record<string, unknown>): Row {
  const date = String(raw.appointment_date ?? raw.date ?? '');
  let timeRaw = String(raw.appointment_time ?? raw.startTime ?? raw.start_time ?? '0:0');
  if (timeRaw.length > 5 && timeRaw.includes('.')) timeRaw = timeRaw.split('.')[0] ?? timeRaw;
  const st = String(raw.service_style ?? raw.serviceStyle ?? '').toLowerCase();

  return {
    id: String(raw.id),
    serviceName: String(raw.service_name ?? raw.serviceName ?? 'Service'),
    serviceStyle: st || 'at_center',
    status: String(raw.status ?? 'scheduled').toLowerCase(),
    date,
    startTime: timeRaw,
    locationName: String(raw.vendor_name ?? raw.locationName ?? ''),
    petName: raw.pet_name != null ? String(raw.pet_name) : undefined,
    amount: Number(raw.total_amount ?? raw.amount ?? 0),
  };
}

async function resolveCustomerDatabaseId(phone: string): Promise<string | null> {
  const cached = getResolvedCustomerId();
  if (cached) return cached;
  if (!phone?.trim()) return null;
  try {
    const res = (await apiClient.get(
      `/customer/profile?phone=${encodeURIComponent(phone.trim())}`
    )) as Record<string, unknown>;
    const p = (res.profile ?? res) as Record<string, unknown>;
    const id = p?.id ?? p?.customer_id;
    if (typeof id === 'string' && isCustomerDatabaseUuid(id)) {
      persistCustomerDatabaseId(id);
      return id;
    }
  } catch {
    /* ignore */
  }
  return null;
}

export function AppointmentsList({ phone, onBack, onCloseToHome, onSelectAppointment }: AppointmentsListProps) {
  const [rawRows, setRawRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  /** Server hint when list is empty (e.g. `No booking` from GET /appointment/customer/:id). */
  const [emptyListMessage, setEmptyListMessage] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'upcoming' | 'completed' | 'cancelled'>('all');

  const loadAppointments = useCallback(async () => {
    try {
      setLoading(true);
      setLoadError(null);
      const customerUuid = await resolveCustomerDatabaseId(phone);
      if (!customerUuid) {
        setRawRows([]);
        setLoadError('Could not resolve your account. Please sign in again.');
        return;
      }

      // My Appointments list: only this route on load (no GET /appointment/:id, no alternate list URL).
      const data = await apiClient.get<unknown>(
        `/appointment/customer/${encodeURIComponent(customerUuid)}`
      );
      const list = extractAppointmentsFromResponse(data);
      const top = data && typeof data === 'object' ? (data as Record<string, unknown>) : null;
      const serverEmptyMsg =
        list.length === 0 && top && typeof top.message === 'string' && top.message.trim()
          ? top.message.trim()
          : null;
      setEmptyListMessage(serverEmptyMsg);
      const rows: Row[] = [];
      for (const item of list) {
        if (!item || typeof item !== 'object') continue;
        try {
          rows.push(mapRow(item as Record<string, unknown>));
        } catch {
          /* skip malformed row */
        }
      }
      setRawRows(rows);
    } catch (e) {
      console.error('Error loading appointments:', e);
      setRawRows([]);
      setEmptyListMessage(null);
      if (e instanceof ApiError && e.message) {
        setLoadError(e.message);
      } else {
        setLoadError('Unable to load appointments. Try again in a moment.');
      }
    } finally {
      setLoading(false);
    }
  }, [phone]);

  useEffect(() => {
    loadAppointments();
  }, [loadAppointments]);

  const appointments = useMemo(() => {
    return rawRows.filter((row) => {
      const st = row.status;
      if (filter === 'all') return true;
      if (filter === 'completed') return st === 'completed';
      if (filter === 'cancelled') return st === 'cancelled';
      return st !== 'completed' && st !== 'cancelled';
    });
  }, [rawRows, filter]);

  const upcomingCount = useMemo(
    () => rawRows.filter((r) => r.status !== 'completed' && r.status !== 'cancelled').length,
    [rawRows]
  );
  const completedCount = useMemo(() => rawRows.filter((r) => r.status === 'completed').length, [rawRows]);

  const formatDate = (date: string) => {
    if (!date) return '—';
    const d = new Date(date.includes('T') ? date : `${date}T12:00:00`);
    if (Number.isNaN(d.getTime())) return date;
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const formatTime = (time: string) => {
    const parts = time.split(':');
    const hours = parseInt(parts[0] || '0', 10);
    const minutes = parts[1] || '00';
    const period = hours >= 12 ? 'PM' : 'AM';
    const h = hours > 12 ? hours - 12 : hours === 0 ? 12 : hours;
    return `${h}:${minutes} ${period}`;
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { bg: string; text: string; label: string }> = {
      confirmed: { bg: 'bg-orange-100', text: 'text-orange-800', label: 'Confirmed' },
      scheduled: { bg: 'bg-violet-100', text: 'text-violet-800', label: 'Scheduled' },
      pending: { bg: 'bg-amber-100', text: 'text-amber-800', label: 'Pending' },
      in_progress: { bg: 'bg-blue-100', text: 'text-blue-800', label: 'In progress' },
      completed: { bg: 'bg-emerald-100', text: 'text-emerald-800', label: 'Completed' },
      cancelled: { bg: 'bg-red-100', text: 'text-red-800', label: 'Cancelled' },
    };
    const key = status.toLowerCase();
    const config = statusConfig[key] || {
      bg: 'bg-gray-100',
      text: 'text-gray-800',
      label: status.replace(/_/g, ' ') || 'Status',
    };
    return (
      <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
        {config.label}
      </span>
    );
  };

  const styleIcon = (serviceStyle: string) => {
    if (serviceStyle === 'at_home') return '🏠';
    if (serviceStyle === 'tele') return '📹';
    return '🏥';
  };

  const styleLabel = (serviceStyle: string) => {
    if (serviceStyle === 'at_home') return 'Home visit';
    if (serviceStyle === 'tele') return 'Video call';
    return 'At center';
  };

  return (
    <div className="min-h-screen bg-gray-50 w-full max-w-customer mx-auto pb-24">
      <ServiceDashboardHeader
        serviceName="My Appointments"
        serviceSubtitle="Scheduled visits & consultations"
        serviceIcon={Calendar}
        iconColor="text-white"
        stats={[
          {
            value: loading ? '…' : loadError ? '—' : String(rawRows.length),
            label: 'Total',
          },
          {
            value: loading ? '…' : loadError ? '—' : String(upcomingCount),
            label: 'Upcoming',
          },
          {
            value: loading ? '…' : loadError ? '—' : String(completedCount),
            label: 'Completed',
          },
        ]}
        onBack={onBack}
        showBackButton
        onCloseToHome={onCloseToHome}
      />

      <div className="px-4 pt-4 space-y-4">
        {/* Filters — chip row, pastel accent for active */}
        <div className="bg-white rounded-2xl p-2 border border-gray-100 shadow-sm flex gap-2 overflow-x-auto scrollbar-hide">
          {[
            { value: 'all' as const, label: 'All' },
            { value: 'upcoming' as const, label: 'Upcoming' },
            { value: 'completed' as const, label: 'Completed' },
            { value: 'cancelled' as const, label: 'Cancelled' },
          ].map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => setFilter(tab.value)}
              className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
                filter === tab.value
                  ? 'bg-gradient-to-br from-purple-100 to-purple-200 text-purple-800 shadow-sm'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {loadError && (
          <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-2xl px-4 py-3 text-sm space-y-3">
            <p>{loadError}</p>
            <button
              type="button"
              onClick={() => void loadAppointments()}
              className="text-sm font-semibold text-amber-950 underline underline-offset-2 hover:text-amber-800"
            >
              Try again
            </button>
          </div>
        )}

        {loading && (
          <div className="text-center py-16">
            <div className="animate-spin rounded-full h-12 w-12 border-2 border-purple-200 border-t-purple-600 mx-auto mb-4" />
            <p className="text-gray-600">Loading appointments…</p>
          </div>
        )}

        {!loading && !loadError && appointments.length === 0 && (
          <div className="text-center py-14 bg-white rounded-2xl border border-dashed border-gray-200 shadow-sm">
            <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-gradient-to-br from-purple-100 to-purple-200 flex items-center justify-center">
              <Sparkles className="w-7 h-7 text-purple-600" />
            </div>
            <p className="text-gray-900 font-semibold mb-1">
              {rawRows.length === 0 && emptyListMessage ? emptyListMessage : 'No appointments here'}
            </p>
            <p className="text-sm text-gray-500 px-6">
              {filter === 'all'
                ? 'Book a service from the home screen to see it listed here.'
                : filter === 'upcoming'
                  ? 'You have no upcoming appointments.'
                  : filter === 'completed'
                    ? 'Completed visits will show up here.'
                    : 'No cancelled appointments in this list.'}
            </p>
          </div>
        )}

        {!loading && appointments.length > 0 && (
          <div className="space-y-3">
            {appointments.map((appointment) => (
              <button
                key={appointment.id}
                type="button"
                onClick={() => onSelectAppointment(appointment.id)}
                className="w-full text-left bg-white rounded-2xl p-4 border border-gray-100 shadow-sm active:scale-[0.99] transition-transform hover:border-purple-200/80"
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex gap-3 min-w-0 flex-1">
                    <div className="w-12 h-12 shrink-0 rounded-2xl bg-gradient-to-br from-purple-100 to-purple-200 flex items-center justify-center text-lg">
                      {styleIcon(appointment.serviceStyle)}
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-semibold text-gray-900 text-[15px] leading-snug truncate">
                        {appointment.serviceName}
                      </h3>
                      <p className="text-sm text-gray-500 mt-0.5">
                        {styleLabel(appointment.serviceStyle)}
                        {appointment.petName ? (
                          <span className="inline-flex items-center gap-1 ml-2 text-purple-700/90">
                            <PawPrint className="w-3.5 h-3.5" />
                            {appointment.petName}
                          </span>
                        ) : null}
                      </p>
                    </div>
                  </div>
                  {getStatusBadge(appointment.status)}
                </div>

                <div className="space-y-2 mt-1 pl-0.5">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Calendar className="w-4 h-4 text-purple-500 shrink-0" />
                    <span>{formatDate(appointment.date)}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Clock className="w-4 h-4 text-purple-500 shrink-0" />
                    <span>{formatTime(appointment.startTime)}</span>
                  </div>
                  {appointment.locationName ? (
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <MapPin className="w-4 h-4 text-emerald-500 shrink-0" />
                      <span className="truncate">{appointment.locationName}</span>
                    </div>
                  ) : null}
                </div>

                <div className="flex items-center justify-between pt-3 mt-3 border-t border-gray-100">
                  {appointment.amount > 0 ? (
                    <span className="text-emerald-600 font-semibold">₹{appointment.amount.toFixed(0)}</span>
                  ) : (
                    <span className="text-gray-400 text-sm">—</span>
                  )}
                  <ChevronRight className="w-5 h-5 text-gray-300" />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}