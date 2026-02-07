import React, { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import {
  Brain,
  TrendingUp,
  TrendingDown,
  Minus,
  Calendar,
  FileText,
  Target,
  AlertCircle,
  CheckCircle,
  BarChart3,
  Activity,
  Heart,
  Shield
} from 'lucide-react';
import { getApiBaseUrl, getAuthHeaders } from '../../utils/api-config';

interface BehaviorMetric {
  behaviorName: string;
  initialRating: number;
  currentRating: number;
  trend: 'improving' | 'stable' | 'declining';
  history: Array<{
    sessionNumber: number;
    rating: number;
    date: string;
    notes: string;
  }>;
}

interface BehavioristSession {
  sessionId: string;
  sessionNumber: number;
  date: string;
  duration: number;
  sessionType: 'tele' | 'home' | 'evaluation';
  status: 'scheduled' | 'completed' | 'cancelled';
  behaviors: Array<{
    behavior: string;
    observed: boolean;
    severity: number;
    notes: string;
  }>;
  interventions: string[];
  homework: string[];
  trainerNotes: string;
  customerFeedback?: string;
  rating?: number;
}

interface BehaviorProgress {
  package: any;
  metrics: BehaviorMetric[];
  sessions: BehavioristSession[];
  overallImprovement: number;
  goalsAchieved: number;
  totalGoals: number;
}

interface BehavioristProgressTrackerProps {
  customerId: string;
  packageId: string;
}

export function BehavioristProgressTracker({
  customerId,
  packageId
}: BehavioristProgressTrackerProps) {
  const [progress, setProgress] = useState<BehaviorProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'overview' | 'sessions' | 'metrics'>('overview');

  useEffect(() => {
    fetchProgress();
  }, [packageId]);

  const fetchProgress = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `${getApiBaseUrl()}/behaviorist/package/${packageId}/progress`,
        { headers: getAuthHeaders() }
      );

      if (response.ok) {
        const data = await response.json();
        setProgress(data.data?.progress);
      }
    } catch (error) {
      console.error('Error fetching behaviorist progress:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6 flex items-center justify-center">
        <div className="animate-spin w-12 h-12 border-4 border-purple-600 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  if (!progress) {
    return (
      <div className="min-h-screen bg-gray-50 p-6 flex items-center justify-center">
        <AlertCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-600">No progress data available</p>
      </div>
    );
  }

  const getTrendIcon = (trend: string) => {
    if (trend === 'improving') return <TrendingUp className="w-5 h-5 text-green-600" />;
    if (trend === 'declining') return <TrendingDown className="w-5 h-5 text-red-600" />;
    return <Minus className="w-5 h-5 text-gray-600" />;
  };

  const getTrendColor = (trend: string) => {
    if (trend === 'improving') return 'bg-green-100 text-green-700 border-green-200';
    if (trend === 'declining') return 'bg-red-100 text-red-700 border-red-200';
    return 'bg-gray-100 text-gray-700 border-gray-200';
  };

  const getSessionTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      'tele': 'Tele Consultation',
      'home': 'Home Visit',
      'evaluation': 'Initial Evaluation'
    };
    return labels[type] || type;
  };

  const getSessionTypeBadge = (type: string) => {
    const badges: Record<string, string> = {
      'tele': 'bg-blue-100 text-blue-700',
      'home': 'bg-green-100 text-green-700',
      'evaluation': 'bg-purple-100 text-purple-700'
    };
    return badges[type] || 'bg-gray-100 text-gray-700';
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white p-6">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
              <Brain className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">{progress.package.packageName}</h1>
              <p className="text-purple-100">
                {progress.package.petName} • {progress.package.behavioristName}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white/10 rounded-lg p-3">
              <p className="text-sm text-purple-200">Sessions Completed</p>
              <p className="text-2xl font-bold">
                {progress.package.completedSessions}/{progress.package.totalSessions}
              </p>
            </div>
            <div className="bg-white/10 rounded-lg p-3">
              <p className="text-sm text-purple-200">Overall Improvement</p>
              <p className="text-2xl font-bold">{progress.overallImprovement}%</p>
            </div>
            <div className="bg-white/10 rounded-lg p-3">
              <p className="text-sm text-purple-200">Goals Achieved</p>
              <p className="text-2xl font-bold">
                {progress.goalsAchieved}/{progress.totalGoals}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-6 space-y-6">
        <div className="bg-white rounded-xl shadow-lg p-2 flex gap-2">
          {['overview', 'metrics', 'sessions'].map((mode) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode as any)}
              className={`flex-1 py-3 px-4 rounded-lg font-medium transition-colors ${
                viewMode === mode
                  ? 'bg-purple-600 text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {mode.charAt(0).toUpperCase() + mode.slice(1)}
            </button>
          ))}
        </div>

        {viewMode === 'overview' && (
          <>
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h2 className="font-bold text-lg text-gray-900 mb-4 flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-orange-600" />
                Primary Concerns
              </h2>
              <div className="flex flex-wrap gap-2">
                {progress.package.primaryConcerns?.map((concern: string, idx: number) => (
                  <span key={idx} className="px-4 py-2 bg-orange-100 text-orange-700 rounded-lg font-medium">
                    {concern}
                  </span>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-lg p-6">
              <h2 className="font-bold text-lg text-gray-900 mb-4 flex items-center gap-2">
                <Target className="w-5 h-5 text-purple-600" />
                Treatment Goals
              </h2>
              <div className="space-y-3">
                {progress.package.goals?.map((goal: string, idx: number) => (
                  <div
                    key={idx}
                    className={`flex items-start gap-3 p-3 rounded-lg border-2 ${
                      idx < progress.goalsAchieved
                        ? 'bg-green-50 border-green-200'
                        : 'bg-gray-50 border-gray-200'
                    }`}
                  >
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                      idx < progress.goalsAchieved ? 'bg-green-500' : 'bg-gray-300'
                    }`}>
                      {idx < progress.goalsAchieved ? (
                        <CheckCircle className="w-4 h-4 text-white" />
                      ) : (
                        <span className="text-xs text-white font-semibold">{idx + 1}</span>
                      )}
                    </div>
                    <p className={`flex-1 ${
                      idx < progress.goalsAchieved ? 'text-green-900 font-medium' : 'text-gray-700'
                    }`}>
                      {goal}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-lg p-6">
              <h2 className="font-bold text-lg text-gray-900 mb-4 flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-purple-600" />
                Behavior Improvement
              </h2>
              <div className="space-y-4">
                {progress.metrics.map((metric, idx) => {
                  const improvement = ((metric.initialRating - metric.currentRating) / metric.initialRating) * 100;
                  return (
                    <div key={idx} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900">{metric.behaviorName}</span>
                          {getTrendIcon(metric.trend)}
                        </div>
                        <span className={`text-sm font-semibold ${
                          improvement > 0 ? 'text-green-600' : 'text-gray-600'
                        }`}>
                          {improvement > 0 ? '+' : ''}{improvement.toFixed(0)}% improvement
                        </span>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="flex-1">
                          <div className="flex justify-between text-sm text-gray-600 mb-1">
                            <span>Initial: {metric.initialRating}/10</span>
                            <span>Current: {metric.currentRating}/10</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-red-500 to-green-500 transition-all"
                              style={{ width: `${((10 - metric.currentRating) / 10) * 100}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {viewMode === 'metrics' && (
          <div className="grid gap-6">
            {progress.metrics.map((metric, idx) => (
              <div key={idx} className="bg-white rounded-xl shadow-lg p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="font-bold text-lg text-gray-900">{metric.behaviorName}</h3>
                    <p className="text-sm text-gray-600">
                      Initial: {metric.initialRating}/10 → Current: {metric.currentRating}/10
                    </p>
                  </div>
                  <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border-2 ${getTrendColor(metric.trend)}`}>
                    {getTrendIcon(metric.trend)}
                    <span className="font-medium capitalize">{metric.trend}</span>
                  </div>
                </div>

                <div className="space-y-3">
                  {metric.history.map((entry, entryIdx) => (
                    <div key={entryIdx} className="flex items-start gap-4 p-3 bg-gray-50 rounded-lg">
                      <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0">
                        <span className="font-bold text-purple-700">{entry.rating}</span>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium text-gray-900">Session {entry.sessionNumber}</span>
                          <span className="text-sm text-gray-600">
                            {new Date(entry.date).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="text-sm text-gray-700">{entry.notes}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {viewMode === 'sessions' && (
          <div className="space-y-4">
            {progress.sessions.map((session) => (
              <div key={session.sessionId} className="bg-white rounded-xl shadow-lg p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="font-bold text-lg text-gray-900 mb-1">
                      Session {session.sessionNumber}
                    </h3>
                    <p className="text-sm text-gray-600">
                      {new Date(session.date).toLocaleDateString()} • {session.duration} minutes
                    </p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${getSessionTypeBadge(session.sessionType)}`}>
                    {getSessionTypeLabel(session.sessionType)}
                  </span>
                </div>

                <div className="mb-4">
                  <h4 className="font-medium text-gray-900 mb-2">Behaviors Observed</h4>
                  <div className="space-y-2">
                    {session.behaviors.map((behavior, idx) => (
                      <div key={idx} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-medium text-gray-900">{behavior.behavior}</span>
                            <span className="text-sm font-semibold text-orange-600">
                              Severity: {behavior.severity}/10
                            </span>
                          </div>
                          <p className="text-sm text-gray-600">{behavior.notes}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mb-4">
                  <h4 className="font-medium text-gray-900 mb-2">Interventions Applied</h4>
                  <div className="flex flex-wrap gap-2">
                    {session.interventions.map((intervention, idx) => (
                      <span key={idx} className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm">
                        {intervention}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="mb-4">
                  <h4 className="font-medium text-gray-900 mb-2">Homework Assigned</h4>
                  <ul className="space-y-2">
                    {session.homework.map((task, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-sm text-gray-700">
                        <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                        {task}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                  <div className="flex items-start gap-2">
                    <FileText className="w-5 h-5 text-purple-600 flex-shrink-0" />
                    <div className="flex-1">
                      <h4 className="font-medium text-purple-900 mb-1">Behaviorist Notes</h4>
                      <p className="text-sm text-purple-800">{session.trainerNotes}</p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}