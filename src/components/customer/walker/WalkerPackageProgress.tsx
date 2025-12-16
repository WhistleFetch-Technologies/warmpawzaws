import React, { useState, useEffect } from 'react';
import {
  Navigation,
  MapPin,
  Clock,
  TrendingUp,
  Calendar,
  Award,
  CheckCircle,
  Timer,
  Route as RouteIcon,
  BarChart3,
  Star,
  ChevronRight,
  Activity
} from 'lucide-react';
import { projectId, publicAnonKey } from '../../../utils/supabase/info';
import { Button } from '../../ui/button';
import { toast } from 'sonner';

interface WalkSession {
  sessionId: string;
  sessionNumber: number;
  date: string;
  status: 'completed' | 'scheduled' | 'cancelled';
  walkerName: string;
  walkerPhoto?: string;
  duration: number; // minutes
  distance: number; // km
  route?: Array<{ lat: number; lng: number; timestamp: string }>;
  startTime: string;
  endTime?: string;
  averageSpeed?: number; // km/h
  notes?: string;
  rating?: number;
  photos?: string[];
}

interface PackageProgress {
  packageId: string;
  packageName: string;
  totalSessions: number;
  completedSessions: number;
  scheduledSessions: number;
  remainingSessions: number;
  progress: number; // percentage
  expiryDate: string;
  sessions: WalkSession[];
  statistics: {
    totalDistance: number;
    totalDuration: number;
    averageDistance: number;
    averageDuration: number;
    longestWalk: number;
    fastestPace: number;
  };
  petName: string;
  petPhoto?: string;
}

interface WalkerPackageProgressProps {
  customerId: string;
  packageId: string;
  onSessionClick?: (session: WalkSession) => void;
}

export function WalkerPackageProgress({
  customerId,
  packageId,
  onSessionClick
}: WalkerPackageProgressProps) {
  const [progress, setProgress] = useState<PackageProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedSession, setSelectedSession] = useState<WalkSession | null>(null);
  const [viewMode, setViewMode] = useState<'overview' | 'sessions' | 'stats'>('overview');

  useEffect(() => {
    fetchProgress();
  }, [packageId]);

  const fetchProgress = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/walker/package/${packageId}/progress?customerId=${customerId}`,
        { headers: { 'Authorization': `Bearer ${publicAnonKey}` } }
      );

      if (response.ok) {
        const data = await response.json();
        setProgress(data.data);
      } else {
        throw new Error('Failed to load progress');
      }
    } catch (error) {
      console.error('Error fetching walker package progress:', error);
      toast.error('Failed to load package progress');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin w-12 h-12 border-4 border-green-600 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  if (!progress) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6">
        <Navigation className="w-16 h-16 text-gray-400 mb-4" />
        <p className="text-gray-600">No package progress available</p>
      </div>
    );
  }

  const daysUntilExpiry = Math.ceil(
    (new Date(progress.expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-green-600 to-teal-600 text-white p-6">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center">
              <Navigation className="w-8 h-8" />
            </div>
            <div className="flex-1">
              <h1 className="text-2xl font-bold mb-1">{progress.packageName}</h1>
              <p className="text-green-100">Walking package for {progress.petName}</p>
            </div>
            {progress.petPhoto && (
              <img
                src={progress.petPhoto}
                alt={progress.petName}
                className="w-16 h-16 rounded-full border-4 border-white/30 object-cover"
              />
            )}
          </div>

          {/* Progress Bar */}
          <div className="bg-white/20 rounded-lg p-4 mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-green-100">Package Progress</span>
              <span className="font-bold">{progress.progress}%</span>
            </div>
            <div className="w-full bg-white/30 rounded-full h-3 overflow-hidden">
              <div
                className="h-full bg-white rounded-full transition-all duration-500"
                style={{ width: `${progress.progress}%` }}
              />
            </div>
            <div className="flex items-center justify-between mt-2 text-sm">
              <span className="text-green-100">
                {progress.completedSessions}/{progress.totalSessions} walks completed
              </span>
              <span className="text-green-100">
                {daysUntilExpiry} days left
              </span>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-4 gap-3">
            <div className="bg-white/10 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold mb-1">{progress.completedSessions}</div>
              <div className="text-xs text-green-100">Completed</div>
            </div>
            <div className="bg-white/10 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold mb-1">{progress.scheduledSessions}</div>
              <div className="text-xs text-green-100">Scheduled</div>
            </div>
            <div className="bg-white/10 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold mb-1">{progress.remainingSessions}</div>
              <div className="text-xs text-green-100">Remaining</div>
            </div>
            <div className="bg-white/10 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold mb-1">
                {progress.statistics.totalDistance.toFixed(1)}
              </div>
              <div className="text-xs text-green-100">Total km</div>
            </div>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="max-w-6xl mx-auto px-6 py-4">
        <div className="bg-white rounded-xl shadow-lg p-2 flex gap-2">
          {['overview', 'sessions', 'stats'].map((mode) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode as any)}
              className={`flex-1 py-3 px-4 rounded-lg font-medium transition-colors ${
                viewMode === mode
                  ? 'bg-green-600 text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {mode.charAt(0).toUpperCase() + mode.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 pb-8 space-y-6">
        {/* Overview Tab */}
        {viewMode === 'overview' && (
          <>
            {/* Statistics Cards */}
            <div className="grid md:grid-cols-3 gap-6">
              <div className="bg-white rounded-xl shadow-lg p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                    <RouteIcon className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Average Distance</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {progress.statistics.averageDistance.toFixed(1)} km
                    </p>
                  </div>
                </div>
                <div className="text-sm text-gray-600">
                  Longest: {progress.statistics.longestWalk.toFixed(1)} km
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-lg p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                    <Clock className="w-6 h-6 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Average Duration</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {progress.statistics.averageDuration} min
                    </p>
                  </div>
                </div>
                <div className="text-sm text-gray-600">
                  Total: {progress.statistics.totalDuration} minutes
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-lg p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
                    <Activity className="w-6 h-6 text-orange-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Fastest Pace</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {progress.statistics.fastestPace.toFixed(1)} km/h
                    </p>
                  </div>
                </div>
                <div className="text-sm text-gray-600">Average walking speed</div>
              </div>
            </div>

            {/* Recent Walks */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h2 className="font-bold text-lg text-gray-900 mb-4 flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-600" />
                Recent Walks
              </h2>
              <div className="space-y-3">
                {progress.sessions.slice(0, 5).map((session) => (
                  <div
                    key={session.sessionId}
                    onClick={() => {
                      setSelectedSession(session);
                      if (onSessionClick) onSessionClick(session);
                    }}
                    className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer transition-colors"
                  >
                    <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="font-bold text-green-700">#{session.sessionNumber}</span>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-semibold text-gray-900">
                          {new Date(session.date).toLocaleDateString()}
                        </span>
                        {session.status === 'completed' && (
                          <CheckCircle className="w-5 h-5 text-green-600" />
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-sm text-gray-600">
                        <span className="flex items-center gap-1">
                          <RouteIcon className="w-4 h-4" />
                          {session.distance.toFixed(1)} km
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          {session.duration} min
                        </span>
                        {session.rating && (
                          <span className="flex items-center gap-1">
                            <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                            {session.rating}
                          </span>
                        )}
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-400" />
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Sessions Tab */}
        {viewMode === 'sessions' && (
          <div className="space-y-4">
            {progress.sessions.map((session) => (
              <div
                key={session.sessionId}
                className="bg-white rounded-xl shadow-lg p-6 hover:shadow-xl transition-shadow"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-4">
                    {session.walkerPhoto ? (
                      <img
                        src={session.walkerPhoto}
                        alt={session.walkerName}
                        className="w-14 h-14 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center">
                        <Navigation className="w-7 h-7 text-green-600" />
                      </div>
                    )}
                    <div>
                      <h3 className="font-bold text-gray-900 mb-1">
                        Walk #{session.sessionNumber}
                      </h3>
                      <p className="text-sm text-gray-600">{session.walkerName}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-gray-900">
                      {new Date(session.date).toLocaleDateString()}
                    </p>
                    <p className="text-sm text-gray-600">
                      {new Date(session.startTime).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div className="bg-blue-50 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <RouteIcon className="w-4 h-4 text-blue-600" />
                      <span className="text-xs text-gray-600">Distance</span>
                    </div>
                    <p className="text-xl font-bold text-blue-700">
                      {session.distance.toFixed(1)} km
                    </p>
                  </div>

                  <div className="bg-purple-50 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Clock className="w-4 h-4 text-purple-600" />
                      <span className="text-xs text-gray-600">Duration</span>
                    </div>
                    <p className="text-xl font-bold text-purple-700">{session.duration} min</p>
                  </div>

                  <div className="bg-orange-50 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Activity className="w-4 h-4 text-orange-600" />
                      <span className="text-xs text-gray-600">Avg Speed</span>
                    </div>
                    <p className="text-xl font-bold text-orange-700">
                      {session.averageSpeed?.toFixed(1) || '0'} km/h
                    </p>
                  </div>
                </div>

                {session.notes && (
                  <div className="p-3 bg-gray-50 rounded-lg mb-4">
                    <p className="text-sm text-gray-700">
                      <span className="font-semibold">Walker Notes:</span> {session.notes}
                    </p>
                  </div>
                )}

                {session.rating && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-600">Your Rating:</span>
                    <div className="flex items-center gap-1">
                      {[...Array(5)].map((_, i) => (
                        <Star
                          key={i}
                          className={`w-5 h-5 ${
                            i < session.rating!
                              ? 'text-yellow-500 fill-yellow-500'
                              : 'text-gray-300'
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {session.photos && session.photos.length > 0 && (
                  <div className="mt-4">
                    <p className="text-sm font-semibold text-gray-700 mb-2">Walk Photos:</p>
                    <div className="flex gap-2 overflow-x-auto">
                      {session.photos.map((photo, idx) => (
                        <img
                          key={idx}
                          src={photo}
                          alt={`Walk photo ${idx + 1}`}
                          className="w-24 h-24 rounded-lg object-cover"
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Stats Tab */}
        {viewMode === 'stats' && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h2 className="font-bold text-lg text-gray-900 mb-4 flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-green-600" />
                Package Statistics
              </h2>

              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg">
                  <div className="flex items-center gap-3">
                    <RouteIcon className="w-8 h-8 text-blue-600" />
                    <div>
                      <p className="font-semibold text-gray-900">Total Distance</p>
                      <p className="text-sm text-gray-600">All walks combined</p>
                    </div>
                  </div>
                  <p className="text-3xl font-bold text-blue-700">
                    {progress.statistics.totalDistance.toFixed(1)} km
                  </p>
                </div>

                <div className="flex items-center justify-between p-4 bg-gradient-to-r from-purple-50 to-purple-100 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Timer className="w-8 h-8 text-purple-600" />
                    <div>
                      <p className="font-semibold text-gray-900">Total Time</p>
                      <p className="text-sm text-gray-600">Active walking time</p>
                    </div>
                  </div>
                  <p className="text-3xl font-bold text-purple-700">
                    {Math.floor(progress.statistics.totalDuration / 60)}h{' '}
                    {progress.statistics.totalDuration % 60}m
                  </p>
                </div>

                <div className="flex items-center justify-between p-4 bg-gradient-to-r from-green-50 to-green-100 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Award className="w-8 h-8 text-green-600" />
                    <div>
                      <p className="font-semibold text-gray-900">Longest Walk</p>
                      <p className="text-sm text-gray-600">Personal best</p>
                    </div>
                  </div>
                  <p className="text-3xl font-bold text-green-700">
                    {progress.statistics.longestWalk.toFixed(1)} km
                  </p>
                </div>

                <div className="flex items-center justify-between p-4 bg-gradient-to-r from-orange-50 to-orange-100 rounded-lg">
                  <div className="flex items-center gap-3">
                    <TrendingUp className="w-8 h-8 text-orange-600" />
                    <div>
                      <p className="font-semibold text-gray-900">Average Pace</p>
                      <p className="text-sm text-gray-600">Fastest recorded</p>
                    </div>
                  </div>
                  <p className="text-3xl font-bold text-orange-700">
                    {progress.statistics.fastestPace.toFixed(1)} km/h
                  </p>
                </div>
              </div>
            </div>

            {/* Progress Chart */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="font-bold text-gray-900 mb-4">Distance Progress</h3>
              <div className="space-y-2">
                {progress.sessions
                  .filter(s => s.status === 'completed')
                  .slice(0, 10)
                  .map((session, idx) => {
                    const maxDistance = progress.statistics.longestWalk;
                    const percentage = (session.distance / maxDistance) * 100;
                    
                    return (
                      <div key={session.sessionId} className="flex items-center gap-3">
                        <span className="text-sm text-gray-600 w-16">Walk #{session.sessionNumber}</span>
                        <div className="flex-1 bg-gray-200 rounded-full h-8 overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-green-500 to-teal-500 rounded-full flex items-center justify-end px-3"
                            style={{ width: `${percentage}%` }}
                          >
                            <span className="text-xs font-semibold text-white">
                              {session.distance.toFixed(1)} km
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
