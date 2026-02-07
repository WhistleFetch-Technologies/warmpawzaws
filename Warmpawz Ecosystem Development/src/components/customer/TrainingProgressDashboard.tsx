import React, { useState, useEffect } from 'react';
import { TrendingUp, Target, Calendar, Award, Star, ChevronRight, Image as ImageIcon, BarChart3, Download, Trophy, TrendingDown, Minus } from 'lucide-react';
import { toast } from 'sonner';
import { getApiBaseUrl, getAuthHeaders } from '../../utils/api-config';
import { Button } from '../ui/button';

interface TrainingSession {
  sessionId: string;
  sessionNumber: number;
  date: string;
  duration: number;
  skillsFocused: string[];
  progressRating: number;
  notes: string;
  achievements: string[];
  nextSteps: string[];
  photos?: string[];
}

interface TrainingPackageProgress {
  packageId: string;
  packageName: string;
  trainerName: string;
  petName: string;
  startDate: string;
  endDate?: string;
  totalSessions: number;
  completedSessions: number;
  overallProgress: number;
  currentLevel: string;
  sessions: TrainingSession[];
  milestones: {
    name: string;
    achieved: boolean;
    achievedAt?: string;
  }[];
  beforePhotos?: string[];
  afterPhotos?: string[];
}

interface TrainingProgressDashboardProps {
  customerId: string;
  packageId: string;
}

export function TrainingProgressDashboard({ 
  customerId, 
  packageId 
}: TrainingProgressDashboardProps) {
  const [progress, setProgress] = useState<TrainingPackageProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedSession, setSelectedSession] = useState<TrainingSession | null>(null);

  useEffect(() => {
    fetchProgress();
  }, [packageId]);

  const fetchProgress = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `${getApiBaseUrl()}/training/package/${packageId}/progress`,
        { headers: getAuthHeaders() }
      );

      if (response.ok) {
        const data = await response.json();
        setProgress(data.data?.dashboard);
      }
    } catch (error) {
      console.error('Error fetching progress:', error);
      toast.error('Failed to load progress');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin w-12 h-12 border-4 border-purple-600 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  if (!progress) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-600">No progress data available</p>
      </div>
    );
  }

  const getProgressColor = (percent: number) => {
    if (percent >= 80) return 'bg-green-100 text-green-700';
    if (percent >= 50) return 'bg-yellow-100 text-yellow-700';
    return 'bg-orange-100 text-orange-700';
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white p-6">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-3xl font-bold mb-2">{progress.packageName}</h1>
          <p className="text-purple-100">{progress.petName} • Trainer: {progress.trainerName}</p>
          <div className="mt-4 grid grid-cols-3 gap-4">
            <div className="bg-white/10 rounded-lg p-3">
              <p className="text-sm text-purple-200">Progress</p>
              <p className="text-2xl font-bold">{progress.overallProgress}%</p>
            </div>
            <div className="bg-white/10 rounded-lg p-3">
              <p className="text-sm text-purple-200">Sessions</p>
              <p className="text-2xl font-bold">{progress.completedSessions}/{progress.totalSessions}</p>
            </div>
            <div className="bg-white/10 rounded-lg p-3">
              <p className="text-sm text-purple-200">Level</p>
              <p className="text-2xl font-bold">{progress.currentLevel}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-6 space-y-6">
        {/* Milestones */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h2 className="font-bold text-lg mb-4">Milestones</h2>
          <div className="space-y-3">
            {progress.milestones.map((milestone, idx) => (
              <div key={idx} className={`flex items-center gap-3 p-3 rounded-lg border-2 ${
                milestone.achieved ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'
              }`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  milestone.achieved ? 'bg-green-500' : 'bg-gray-300'
                }`}>
                  {milestone.achieved ? <Trophy className="w-4 h-4 text-white" /> : <Target className="w-4 h-4 text-white" />}
                </div>
                <div className="flex-1">
                  <p className="font-medium text-gray-900">{milestone.name}</p>
                  {milestone.achievedAt && (
                    <p className="text-sm text-gray-600">{new Date(milestone.achievedAt).toLocaleDateString()}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Sessions */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h2 className="font-bold text-lg mb-4">Session History</h2>
          <div className="space-y-3">
            {progress.sessions.map((session) => (
              <div key={session.sessionId} className="p-4 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer"
                   onClick={() => setSelectedSession(session)}>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold">Session {session.sessionNumber}</span>
                  <div className="flex items-center gap-1">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className={`w-4 h-4 ${
                        i < session.progressRating ? 'text-yellow-500 fill-yellow-500' : 'text-gray-300'
                      }`} />
                    ))}
                  </div>
                </div>
                <p className="text-sm text-gray-600 mb-2">{new Date(session.date).toLocaleDateString()} • {session.duration} mins</p>
                <div className="flex flex-wrap gap-2">
                  {session.skillsFocused.slice(0, 3).map((skill, idx) => (
                    <span key={idx} className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs">
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Session Detail Modal */}
      {selectedSession && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b p-4 flex items-center justify-between">
              <h3 className="font-bold text-lg">Session {selectedSession.sessionNumber} Details</h3>
              <button onClick={() => setSelectedSession(null)} className="text-gray-500 hover:text-gray-700">✕</button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <h4 className="font-semibold mb-2">Skills Practiced</h4>
                <div className="flex flex-wrap gap-2">
                  {selectedSession.skillsFocused.map((skill, idx) => (
                    <span key={idx} className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm">
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
              <div>
                <h4 className="font-semibold mb-2">Trainer Notes</h4>
                <p className="text-gray-700">{selectedSession.notes}</p>
              </div>
              <div>
                <h4 className="font-semibold mb-2">Achievements</h4>
                <ul className="space-y-1">
                  {selectedSession.achievements.map((achievement, idx) => (
                    <li key={idx} className="flex items-center gap-2 text-gray-700">
                      <Award className="w-4 h-4 text-green-600" />
                      {achievement}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h4 className="font-semibold mb-2">Next Steps</h4>
                <ul className="space-y-1">
                  {selectedSession.nextSteps.map((step, idx) => (
                    <li key={idx} className="flex items-center gap-2 text-gray-700">
                      <ChevronRight className="w-4 h-4 text-blue-600" />
                      {step}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}