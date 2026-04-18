'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api-client';
import {
  ArrowLeft,
  BarChart3,
  FileText,
  Target,
  Brain,
  Heart,
  Activity,
  Search,
  Footprints,
} from 'lucide-react';
import { toast } from 'sonner';

interface ProgressTracker {
  id: string;
  petId: string;
  petName: string;
  petImage: string;
  customerName: string;
  programType: 'training' | 'behavioral' | 'nutrition' | 'rehabilitation' | 'walking';
  programName: string;
  startDate: string;
  endDate: string;
  status: 'active' | 'completed' | 'paused' | 'cancelled';
  currentPhase: string;
  completionPercentage: number;
  sessionsCompleted: number;
  totalSessions: number;
}

interface ProgressTrackingDashboardProps {
  vendorId: string;
  roleType?: 'trainer' | 'behaviorist' | 'nutritionist' | 'walker';
  onBack?: () => void;
}

type TrainingProgressRow = Record<string, unknown>;

function mapDbStatusToUi(status: string): ProgressTracker['status'] {
  const s = String(status || '').toLowerCase();
  if (s === 'completed') return 'completed';
  if (s === 'dropped') return 'cancelled';
  if (s === 'paused') return 'paused';
  return 'active';
}

function inferProgramType(
  roleType: 'trainer' | 'behaviorist' | 'nutritionist' | 'walker',
  category: string
): ProgressTracker['programType'] {
  const c = (category || '').toLowerCase();
  if (c.includes('walk')) return 'walking';
  if (c.includes('nutrition') || c.includes('diet')) return 'nutrition';
  if (c.includes('rehab')) return 'rehabilitation';
  if (c.includes('behavior') || c.includes('anxiety')) return 'behavioral';
  if (roleType === 'nutritionist') return 'nutrition';
  if (roleType === 'behaviorist') return 'behavioral';
  if (roleType === 'walker') return 'walking';
  return 'training';
}

function mapTrainingProgressRow(
  row: TrainingProgressRow,
  roleType: 'trainer' | 'behaviorist' | 'nutritionist' | 'walker'
): ProgressTracker {
  const estimated =
    row.estimated_total_sessions != null
      ? Number(row.estimated_total_sessions)
      : Number(row.duration_weeks || 4) * Number(row.sessions_per_week || 2);
  const totalSessions = Math.max(1, Number.isFinite(estimated) ? estimated : 8);

  const sessionsCompleted = Math.max(0, Number(row.sessions_completed ?? 0));
  let completionPercentage = Math.min(
    100,
    Math.max(0, Number(row.progress_percentage ?? 0))
  );
  if (
    (row.progress_percentage === null || row.progress_percentage === undefined) &&
    totalSessions > 0
  ) {
    completionPercentage = Math.min(100, Math.round((sessionsCompleted / totalSessions) * 100));
  }

  const category = String(row.program_category ?? '');
  const notes = row.notes != null ? String(row.notes).trim() : '';
  const startRaw = row.enrollment_date ?? row.created_at;
  const endRaw = row.updated_at ?? row.created_at;

  return {
    id: String(row.id),
    petId: String(row.pet_id ?? '00000000-0000-0000-0000-000000000001'),
    petName: String(row.pet_name || 'Pet'),
    petImage: '',
    customerName: String(row.customer_name || 'Customer'),
    programType: inferProgramType(roleType, category),
    programName: String(row.program_name || 'Program'),
    startDate: startRaw ? String(startRaw) : new Date().toISOString(),
    endDate: endRaw ? String(endRaw) : new Date().toISOString(),
    status: mapDbStatusToUi(String(row.status || 'enrolled')),
    currentPhase: notes
      ? notes.length > 80
        ? `${notes.slice(0, 80)}…`
        : notes
      : inferProgramType(roleType, category) === 'walking'
        ? 'Completed walks'
        : 'In program',
    completionPercentage,
    sessionsCompleted,
    totalSessions,
  };
}

export function ProgressTrackingDashboard({
  vendorId,
  roleType = 'trainer',
  onBack,
}: ProgressTrackingDashboardProps) {
  const [trackers, setTrackers] = useState<ProgressTracker[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadTrackers = useCallback(async () => {
    try {
      setLoading(true);
      setLoadError(null);
      const response = await apiClient.get<{
        success?: boolean;
        progress?: TrainingProgressRow[];
        error?: string;
      }>(`/vendor/${vendorId}/training/progress`);

      if (!response?.success) {
        setTrackers([]);
        setLoadError(response?.error || 'Could not load training progress.');
        if (response?.error) toast.error(response.error);
        return;
      }

      const rows = Array.isArray(response.progress) ? response.progress : [];
      setTrackers(rows.map((row) => mapTrainingProgressRow(row, roleType)));
    } catch (error: unknown) {
      console.error('Error loading progress:', error);
      const statusCode =
        error && typeof error === 'object' && 'statusCode' in error
          ? (error as { statusCode?: number }).statusCode
          : undefined;
      if (statusCode === 403) {
        setTrackers([]);
        setLoadError(
          'Progress tracking is not enabled for this account, or your session could not be verified.'
        );
        return;
      }
      const msg =
        error && typeof error === 'object' && 'message' in error
          ? String((error as { message?: string }).message)
          : 'Could not load training progress.';
      setTrackers([]);
      setLoadError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [vendorId, roleType]);

  useEffect(() => {
    loadTrackers();
  }, [loadTrackers]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'completed':
        return 'bg-blue-100 text-blue-800';
      case 'paused':
        return 'bg-yellow-100 text-yellow-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getProgramIcon = (type: string) => {
    switch (type) {
      case 'training':
        return <Target className="w-5 h-5" />;
      case 'behavioral':
        return <Brain className="w-5 h-5" />;
      case 'nutrition':
        return <Heart className="w-5 h-5" />;
      case 'rehabilitation':
        return <Activity className="w-5 h-5" />;
      case 'walking':
        return <Footprints className="w-5 h-5" />;
      default:
        return <FileText className="w-5 h-5" />;
    }
  };

  const filteredTrackers = trackers.filter((t) => {
    if (statusFilter !== 'all' && t.status !== statusFilter) return false;
    if (
      searchQuery &&
      !t.petName.toLowerCase().includes(searchQuery.toLowerCase()) &&
      !t.customerName.toLowerCase().includes(searchQuery.toLowerCase())
    )
      return false;
    return true;
  });

  const activeCount = trackers.filter((t) => t.status === 'active').length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50 vendor-app-column">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF8C42] mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading progress…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 vendor-app-column">
      <div className="bg-gradient-to-r from-[#FF8C42] to-[#FF6B2C] text-white p-4 sticky top-0 z-10">
        <div className="flex items-center gap-3 mb-4">
          {onBack && (
            <button type="button" onClick={onBack} className="p-2 hover:bg-white/10 rounded-full">
              <ArrowLeft className="w-6 h-6" />
            </button>
          )}
          <div>
            <h1 className="text-xl font-bold">Progress Tracking</h1>
            <p className="text-sm text-white/80">
              {trackers.length} program{trackers.length === 1 ? '' : 's'}
              {activeCount > 0 ? ` · ${activeCount} active` : ''}
            </p>
          </div>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search by pet or customer…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white text-gray-800 placeholder:text-gray-400"
          />
        </div>
      </div>

      {loadError && (
        <div className="mx-4 mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {loadError}
        </div>
      )}

      <div className="flex gap-2 p-4 overflow-x-auto">
        {['all', 'active', 'completed', 'paused'].map((status) => (
          <button
            key={status}
            type="button"
            onClick={() => setStatusFilter(status)}
            className={`px-4 py-2 rounded-full text-sm whitespace-nowrap ${
              statusFilter === status
                ? 'bg-[#FF8C42] text-white'
                : 'bg-white text-gray-600 border border-gray-200'
            }`}
          >
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </button>
        ))}
      </div>

      <div className="p-4 space-y-4">
        {filteredTrackers.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
            <BarChart3 className="w-16 h-16 mx-auto mb-4 text-gray-300" />
            <h3 className="text-lg font-semibold text-gray-800 mb-2">No progress records</h3>
            <p className="text-gray-500 mb-4">
              Completed sessions and enrolled programs appear here once bookings are marked complete.
            </p>
            <button
              type="button"
              onClick={() => loadTrackers()}
              className="bg-[#FF8C42] text-white px-6 py-2 rounded-lg font-medium"
            >
              Refresh
            </button>
          </div>
        ) : (
          filteredTrackers.map((tracker) => (
            <div
              key={tracker.id}
              className="bg-white rounded-xl p-4 border border-gray-200 hover:border-[#FF8C42] transition-colors"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-[#FF8C42]/10 rounded-full flex items-center justify-center text-[#FF8C42]">
                    {getProgramIcon(tracker.programType)}
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-800">{tracker.petName}</h3>
                    <p className="text-sm text-gray-500">{tracker.customerName}</p>
                  </div>
                </div>
                <span
                  className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(tracker.status)}`}
                >
                  {tracker.status}
                </span>
              </div>

              <p className="text-sm font-medium text-gray-800 mb-2">{tracker.programName}</p>
              <p className="text-xs text-gray-500 mb-3">Notes: {tracker.currentPhase}</p>

              <div className="mb-1">
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>
                    {tracker.sessionsCompleted}/{tracker.totalSessions} sessions
                  </span>
                  <span>{tracker.completionPercentage}%</span>
                </div>
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#FF8C42] rounded-full transition-all"
                    style={{ width: `${tracker.completionPercentage}%` }}
                  />
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default ProgressTrackingDashboard;
