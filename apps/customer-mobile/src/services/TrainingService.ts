/**
 * Training Service - Customer Mobile App
 * Handles training progress tracking and session management
 */

import { API_BASE_URL, publicAnonKey } from '../config/api';

export interface TrainingSession {
  sessionId: string;
  packageId: string;
  sessionNumber: number;
  totalSessions: number;
  scheduledDate: string;
  completedDate?: string;
  duration: number; // minutes
  status: 'scheduled' | 'completed' | 'cancelled' | 'rescheduled';
  progress: {
    skillsPracticed: string[];
    behaviorObserved: string[];
    issuesAddressed: string[];
    improvementAreas: string[];
    trainerNotes: string;
    customerFeedback?: string;
    rating?: number;
  };
  media: Array<{
    mediaId: string;
    type: 'photo' | 'video';
    url: string;
    caption?: string;
  }>;
}

export interface TrainingMilestone {
  milestoneId: string;
  milestoneName: string;
  description: string;
  targetSession: number;
  achievedDate?: string;
  status: 'pending' | 'achieved' | 'in_progress';
  criteria: string[];
  evidencePhotos?: string[];
}

export interface TrainingProgress {
  packageId: string;
  packageName: string;
  totalSessions: number;
  completedSessions: number;
  progress: number; // percentage
  overallProgress: number;
  averageRating: number;
  sessions: TrainingSession[];
  milestones: TrainingMilestone[];
  skillsProgress: Array<{
    skillName: string;
    progress: number;
    lastPracticed: string;
  }>;
  behaviorTrends: Array<{
    behavior: string;
    trend: 'improving' | 'stable' | 'declining';
    data: Array<{ sessionNumber: number; rating: number }>;
  }>;
}

class TrainingService {
  /**
   * Get training package progress
   */
  async getPackageProgress(packageId: string): Promise<TrainingProgress | null> {
    try {
      const response = await fetch(
        `${API_BASE_URL}/training/package/${encodeURIComponent(packageId)}/progress`,
        {
          headers: {
            Authorization: `Bearer ${publicAnonKey}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        return data.data || null;
      }

      return null;
    } catch (error) {
      console.error('Error fetching training progress:', error);
      return null;
    }
  }

  /**
   * Get session details
   */
  async getSessionDetails(sessionId: string): Promise<TrainingSession | null> {
    try {
      const response = await fetch(
        `${API_BASE_URL}/training/session/${encodeURIComponent(sessionId)}`,
        {
          headers: {
            Authorization: `Bearer ${publicAnonKey}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        return data.session || null;
      }

      return null;
    } catch (error) {
      console.error('Error fetching session details:', error);
      return null;
    }
  }

  /**
   * Submit customer feedback for a session
   */
  async submitFeedback(
    sessionId: string,
    feedback: string,
    rating: number
  ): Promise<boolean> {
    try {
      const response = await fetch(
        `${API_BASE_URL}/training/session/${encodeURIComponent(sessionId)}/feedback`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${publicAnonKey}`,
          },
          body: JSON.stringify({
            feedback,
            rating,
          }),
        }
      );

      return response.ok;
    } catch (error) {
      console.error('Error submitting feedback:', error);
      return false;
    }
  }
}

export default new TrainingService();

