'use client';

import { useState, useEffect } from 'react';
import { CheckCircle, Circle, Clock, Calendar } from 'lucide-react';
import { apiClient } from '@/lib/api-client';

interface PackageSessionViewProps {
  bookingId: string;
  packageId?: string;
}

export function PackageSessionView({ bookingId, packageId }: PackageSessionViewProps) {
  const [sessions, setSessions] = useState<any[]>([]);
  const [progress, setProgress] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPackageSessions();
  }, [bookingId, packageId]);

  const loadPackageSessions = async () => {
    try {
      setLoading(true);
      
      // Get package sessions progress
      const progressResponse = await apiClient.get<{
        totalSessions: number;
        completedSessions: number;
        sessions: any[];
      }>(`/package-sessions/${bookingId}/progress`);

      if (progressResponse.sessions) {
        setSessions(progressResponse.sessions);
        setProgress({
          total: progressResponse.totalSessions || progressResponse.sessions.length,
          completed: progressResponse.completedSessions || progressResponse.sessions.filter((s: any) => s.status === 'completed').length,
        });
      }
    } catch (err: any) {
      console.error('Error loading package sessions:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-2xl p-0 shadow-sm">
        <div className="flex items-center justify-center py-8">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          <span className="ml-2 text-gray-600">Loading sessions...</span>
        </div>
      </div>
    );
  }

  if (!sessions || sessions.length === 0) {
    return (
      <div className="bg-white rounded-2xl p-0 shadow-sm">
        <div className="text-center py-8">
          <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">No package sessions found</p>
        </div>
      </div>
    );
  }

  const completionPercentage = progress
    ? Math.round((progress.completed / progress.total) * 100)
    : 0;

  return (
    <div className="bg-white rounded-2xl p-0 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-gray-900">Package Sessions</h3>
        {progress && (
          <span className="text-sm text-gray-600">
            {progress.completed}/{progress.total} completed
          </span>
        )}
      </div>

      {/* Progress Bar */}
      {progress && (
        <div className="mb-0">
          <div className="flex items-center justify-between mb-0">
            <span className="text-sm font-medium text-gray-700">Progress</span>
            <span className="text-sm font-bold text-primary">{completionPercentage}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-primary h-2 rounded-full transition-all duration-300"
              style={{ width: `${completionPercentage}%` }}
            />
          </div>
        </div>
      )}

      {/* Sessions List */}
      <div className="space-y-3">
        {sessions.map((session: any, index: number) => {
          const isCompleted = session.status === 'completed';
          const isInProgress = session.status === 'in_progress';
          const isPending = session.status === 'pending' || session.status === 'scheduled';

          return (
            <div
              key={session.id || index}
              className={`border rounded-lg p-4 ${
                isCompleted
                  ? 'border-green-200 bg-green-50'
                  : isInProgress
                  ? 'border-primary bg-primary/5'
                  : 'border-gray-200 bg-gray-50'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 mt-0">
                  {isCompleted ? (
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  ) : isInProgress ? (
                    <Clock className="w-5 h-5 text-primary animate-spin" />
                  ) : (
                    <Circle className="w-5 h-5 text-gray-400" />
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-0">
                    <p className="font-semibold text-gray-900">
                      Session {index + 1}
                    </p>
                    <span
                      className={`text-xs px-0 py-0 rounded-full ${
                        isCompleted
                          ? 'bg-green-100 text-green-700'
                          : isInProgress
                          ? 'bg-primary/20 text-primary'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {session.status || 'Pending'}
                    </span>
                  </div>
                  {session.scheduled_date && (
                    <p className="text-sm text-gray-600 flex items-center gap-3">
                      <Calendar className="w-4 h-4" />
                      {new Date(session.scheduled_date).toLocaleDateString()}
                      {session.scheduled_time && ` at ${session.scheduled_time}`}
                    </p>
                  )}
                  {session.completed_at && (
                    <p className="text-xs text-gray-500 mt-0">
                      Completed: {new Date(session.completed_at).toLocaleString()}
                    </p>
                  )}
                  {session.notes && (
                    <p className="text-sm text-gray-600 mt-0">{session.notes}</p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary */}
      {progress && (
        <div className="mt-0 pt-0 border-t border-gray-200">
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-primary">{progress.completed}</p>
              <p className="text-sm text-gray-600">Completed</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-700">
                {progress.total - progress.completed}
              </p>
              <p className="text-sm text-gray-600">Remaining</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

