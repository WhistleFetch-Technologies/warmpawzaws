import React, { useState, useEffect } from 'react';
import { TrendingUp, Target, Calendar, Award, Star, ChevronRight, Image as ImageIcon } from 'lucide-react';
import { toast } from 'sonner';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
// Brand color: #FF8C42

interface TrainingSession {
  sessionId: string;
  sessionNumber: number;
  date: string;
  duration: number;
  skillsFocused: string[];
  progressRating: number; // 1-5
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
  overallProgress: number; // percentage
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
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/training/package/${packageId}/progress`,
        { headers: { 'Authorization': `Bearer ${publicAnonKey}` } }
      );

      if (response.ok) {
        const data = await response.json();
        setProgress(data.progress || getMockProgress());
      } else {
        // Use mock data if endpoint not available
        setProgress(getMockProgress());
      }
    } catch (error) {
      console.error('Error fetching progress:', error);
      setProgress(getMockProgress());
    } finally {
      setLoading(false);
    }
  };

  const getMockProgress = (): TrainingPackageProgress => ({
    packageId: 'PKG-001',
    packageName: 'Basic Obedience Training',
    trainerName: 'Rajesh Kumar',
    petName: 'Max',
    startDate: '2024-11-01',
    totalSessions: 10,
    completedSessions: 6,
    overallProgress: 60,
    currentLevel: 'Intermediate',
    sessions: [
      {
        sessionId: 'S001',
        sessionNumber: 1,
        date: '2024-11-01',
        duration: 60,
        skillsFocused: ['Sit', 'Stay', 'Come'],
        progressRating: 3,
        notes: 'Great first session! Max is responsive and eager to learn.',
        achievements: ['Learned "Sit" command', 'Good focus'],
        nextSteps: ['Practice "Stay" command', 'Increase distraction level']
      },
      {
        sessionId: 'S002',
        sessionNumber: 2,
        date: '2024-11-04',
        duration: 60,
        skillsFocused: ['Stay', 'Down', 'Leash walking'],
        progressRating: 4,
        notes: 'Excellent progress! Max is responding well to commands.',
        achievements: ['Mastered "Sit"', 'Learning "Stay"', 'Improved leash behavior'],
        nextSteps: ['Perfect "Stay" command', 'Start "Down" training']
      },
      {
        sessionId: 'S003',
        sessionNumber: 3,
        date: '2024-11-08',
        duration: 60,
        skillsFocused: ['Down', 'Stay (advanced)', 'Recall'],
        progressRating: 5,
        notes: 'Outstanding session! Max is ahead of schedule.',
        achievements: ['Mastered "Stay" for 30 seconds', 'Learning "Down"', 'Excellent recall'],
        nextSteps: ['Increase "Stay" duration', 'Practice in different environments']
      }
    ],
    milestones: [
      { name: 'Basic Commands', achieved: true, achievedAt: '2024-11-04' },
      { name: 'Leash Training', achieved: true, achievedAt: '2024-11-08' },
      { name: 'Advanced Obedience', achieved: false },
      { name: 'Off-Leash Control', achieved: false }
    ],
    beforePhotos: ['/mock/before1.jpg', '/mock/before2.jpg'],
    afterPhotos: ['/mock/after1.jpg']
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-12 h-12 border-4 border-orange-600 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-600">Loading progress...</p>
        </div>
      </div>
    );
  }

  if (!progress) {
    return (
      <div className="min-h-screen bg-gray-50 p-6 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">No progress data available</p>
        </div>
      </div>
    );
  }

  const getProgressColor = (percentage: number) => {
    if (percentage >= 75) return 'text-green-600 bg-green-100';
    if (percentage >= 50) return 'text-blue-600 bg-blue-100';
    if (percentage >= 25) return 'text-orange-600 bg-orange-100';
    return 'text-gray-600 bg-gray-100';
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 mb-1">{progress.packageName}</h1>
              <p className="text-gray-600">{progress.petName} • Trainer: {progress.trainerName}</p>
            </div>
            <div className={`px-4 py-2 rounded-full ${getProgressColor(progress.overallProgress)}`}>
              <span className="font-semibold">{progress.currentLevel}</span>
            </div>
          </div>

          {/* Overall Progress */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600">Overall Progress</span>
              <span className="font-semibold text-gray-900">{progress.overallProgress}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-orange-500 to-orange-600 transition-all duration-500"
                style={{ width: `${progress.overallProgress}%` }}
              />
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-1">
                <Calendar className="w-4 h-4 text-blue-600" />
                <span className="text-sm text-gray-600">Sessions</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">
                {progress.completedSessions}/{progress.totalSessions}
              </p>
            </div>

            <div className="bg-green-50 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-1">
                <Target className="w-4 h-4 text-green-600" />
                <span className="text-sm text-gray-600">Milestones</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">
                {progress.milestones.filter(m => m.achieved).length}/{progress.milestones.length}
              </p>
            </div>

            <div className="bg-purple-50 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-1">
                <Award className="w-4 h-4 text-purple-600" />
                <span className="text-sm text-gray-600">Achievements</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">
                {progress.sessions.reduce((sum, s) => sum + s.achievements.length, 0)}
              </p>
            </div>

            <div className="bg-orange-50 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="w-4 h-4 text-orange-600" />
                <span className="text-sm text-gray-600">Avg Rating</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">
                {(progress.sessions.reduce((sum, s) => sum + s.progressRating, 0) / progress.sessions.length).toFixed(1)}/5
              </p>
            </div>
          </div>
        </div>

        {/* Milestones */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h2 className="font-bold text-lg text-gray-900 mb-4 flex items-center gap-2">
            <Target className="w-5 h-5 text-orange-600" />
            Training Milestones
          </h2>

          <div className="space-y-3">
            {progress.milestones.map((milestone, idx) => (
              <div
                key={idx}
                className={`flex items-center gap-4 p-4 rounded-lg border-2 ${
                  milestone.achieved
                    ? 'border-green-200 bg-green-50'
                    : 'border-gray-200 bg-gray-50'
                }`}
              >
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  milestone.achieved ? 'bg-green-500' : 'bg-gray-300'
                }`}>
                  {milestone.achieved ? (
                    <Award className="w-5 h-5 text-white" />
                  ) : (
                    <span className="text-white font-semibold">{idx + 1}</span>
                  )}
                </div>
                <div className="flex-1">
                  <p className="font-medium text-gray-900">{milestone.name}</p>
                  {milestone.achievedAt && (
                    <p className="text-sm text-green-600">
                      Achieved on {new Date(milestone.achievedAt).toLocaleDateString()}
                    </p>
                  )}
                </div>
                {milestone.achieved && (
                  <div className="text-green-600">
                    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Session History */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h2 className="font-bold text-lg text-gray-900 mb-4 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-orange-600" />
            Session History
          </h2>

          <div className="space-y-4">
            {progress.sessions.map((session) => (
              <div
                key={session.sessionId}
                className="border-2 border-gray-200 rounded-lg p-4 hover:border-orange-300 cursor-pointer transition-colors"
                onClick={() => setSelectedSession(session)}
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-1">
                      Session {session.sessionNumber}
                    </h3>
                    <p className="text-sm text-gray-600">
                      {new Date(session.date).toLocaleDateString()} • {session.duration} min
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    {[...Array(5)].map((_, i) => (
                      <Star
                        key={i}
                        className={`w-4 h-4 ${
                          i < session.progressRating
                            ? 'text-yellow-500 fill-current'
                            : 'text-gray-300'
                        }`}
                      />
                    ))}
                  </div>
                </div>

                <div className="mb-3">
                  <p className="text-sm text-gray-700 mb-2">{session.notes}</p>
                </div>

                <div className="flex flex-wrap gap-2 mb-3">
                  {session.skillsFocused.map((skill, idx) => (
                    <span
                      key={idx}
                      className="text-xs px-3 py-1 bg-blue-100 text-blue-700 rounded-full"
                    >
                      {skill}
                    </span>
                  ))}
                </div>

                <div className="flex items-center justify-between">
                  <div className="text-sm text-gray-600">
                    {session.achievements.length} achievements
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Before/After Photos */}
        {(progress.beforePhotos?.length || progress.afterPhotos?.length) && (
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="font-bold text-lg text-gray-900 mb-4 flex items-center gap-2">
              <ImageIcon className="w-5 h-5 text-orange-600" />
              Progress Photos
            </h2>

            <div className="grid md:grid-cols-2 gap-6">
              {progress.beforePhotos && progress.beforePhotos.length > 0 && (
                <div>
                  <h3 className="font-medium text-gray-900 mb-3">Before Training</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {progress.beforePhotos.map((photo, idx) => (
                      <div
                        key={idx}
                        className="aspect-square bg-gray-200 rounded-lg flex items-center justify-center"
                      >
                        <ImageIcon className="w-8 h-8 text-gray-400" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {progress.afterPhotos && progress.afterPhotos.length > 0 && (
                <div>
                  <h3 className="font-medium text-gray-900 mb-3">Current Progress</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {progress.afterPhotos.map((photo, idx) => (
                      <div
                        key={idx}
                        className="aspect-square bg-gray-200 rounded-lg flex items-center justify-center"
                      >
                        <ImageIcon className="w-8 h-8 text-gray-400" />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Session Detail Modal */}
        {selectedSession && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-6">
            <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-xl font-bold text-gray-900">
                    Session {selectedSession.sessionNumber}
                  </h3>
                  <p className="text-gray-600">
                    {new Date(selectedSession.date).toLocaleDateString()}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedSession(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Skills Focused</h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedSession.skillsFocused.map((skill, idx) => (
                      <span
                        key={idx}
                        className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>

                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Trainer's Notes</h4>
                  <p className="text-gray-700">{selectedSession.notes}</p>
                </div>

                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Achievements</h4>
                  <ul className="space-y-2">
                    {selectedSession.achievements.map((achievement, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-gray-700">
                        <Award className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                        {achievement}
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Next Steps</h4>
                  <ul className="space-y-2">
                    {selectedSession.nextSteps.map((step, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-gray-700">
                        <ChevronRight className="w-4 h-4 text-orange-600 flex-shrink-0 mt-0.5" />
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
    </div>
  );
}
