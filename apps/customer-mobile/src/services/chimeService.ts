/**
 * AWS Chime SDK Service
 * Handles video calling and chat integration
 * Matches web app implementation
 */

// Note: AWS Chime SDK JS is primarily for web browsers
// For React Native, we use WebRTC directly with Chime SDK for meeting management
// This service provides a simplified interface that can be enhanced with native bridges
import { projectId, publicAnonKey } from '../config/api';

export interface ChimeMeetingConfig {
  meetingId: string;
  attendeeId: string;
  joinToken: string;
  region?: string;
}

export interface ChimeChatMessage {
  messageId: string;
  senderId: string;
  senderName: string;
  content: string;
  timestamp: number;
  type?: 'text' | 'system';
}

class ChimeService {
  private meetingConfig: ChimeMeetingConfig | null = null;
  private observers: Set<any> = new Set();

  /**
   * Create or join a Chime meeting
   * This should call your backend API to create/join meeting
   */
  async createOrJoinMeeting(
    bookingId: string,
    userId: string,
    userName: string
  ): Promise<ChimeMeetingConfig> {
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/video/meeting/create`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${publicAnonKey}`,
          },
          body: JSON.stringify({
            bookingId,
            userId,
            userName,
          }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to create/join meeting');
      }

      const data = await response.json();
      return {
        meetingId: data.meetingId,
        attendeeId: data.attendeeId,
        joinToken: data.joinToken,
        region: data.region || 'us-east-1',
      };
    } catch (error) {
      console.error('Error creating/joining meeting:', error);
      throw error;
    }
  }

  /**
   * Initialize meeting session
   * Note: For React Native, we store the config and use WebRTC directly
   * The actual Chime SDK integration would require native bridges
   */
  async initializeMeeting(config: ChimeMeetingConfig): Promise<ChimeMeetingConfig> {
    try {
      this.meetingConfig = config;
      
      // In a full implementation, this would initialize the Chime SDK
      // For React Native, we'll use WebRTC with Chime signaling
      console.log('Meeting initialized:', config);
      
      return config;
    } catch (error) {
      console.error('Error initializing meeting:', error);
      throw error;
    }
  }

  /**
   * Start video session
   * Note: Actual video/audio handling is done via WebRTC in React Native
   */
  async startVideoSession(): Promise<void> {
    if (!this.meetingConfig) {
      throw new Error('Meeting not initialized');
    }

    try {
      // Request camera and microphone permissions
      await this.requestPermissions();
      
      // In a full implementation, this would start Chime SDK video/audio
      // For React Native, WebRTC handles the actual streams
      console.log('Video session started for meeting:', this.meetingConfig.meetingId);
    } catch (error) {
      console.error('Error starting video session:', error);
      throw error;
    }
  }

  /**
   * Stop video session
   */
  async stopVideoSession(): Promise<void> {
    if (!this.meetingConfig) {
      return;
    }

    try {
      console.log('Video session stopped for meeting:', this.meetingConfig.meetingId);
    } catch (error) {
      console.error('Error stopping video session:', error);
    }
  }

  /**
   * Toggle mute
   * Note: Actual mute control is handled by WebRTC in React Native
   */
  async toggleMute(): Promise<boolean> {
    if (!this.meetingConfig) {
      throw new Error('Meeting not initialized');
    }

    // This would interact with WebRTC audio track
    // Implementation would be in the VideoCallScreen component
    console.log('Toggle mute requested');
    return false; // Return actual state from WebRTC
  }

  /**
   * Toggle video
   * Note: Actual video control is handled by WebRTC in React Native
   */
  async toggleVideo(): Promise<boolean> {
    if (!this.meetingConfig) {
      throw new Error('Meeting not initialized');
    }

    // This would interact with WebRTC video track
    // Implementation would be in the VideoCallScreen component
    console.log('Toggle video requested');
    return false; // Return actual state from WebRTC
  }

  /**
   * Add observer for video/audio events
   */
  addObserver(observer: any): void {
    if (!this.meetingConfig) {
      throw new Error('Meeting not initialized');
    }

    this.observers.add(observer);
  }

  /**
   * Remove observer
   */
  removeObserver(observer: any): void {
    this.observers.delete(observer);
  }

  /**
   * Leave meeting
   */
  async leaveMeeting(): Promise<void> {
    if (!this.meetingConfig) {
      return;
    }

    try {
      // Remove all observers
      this.observers.clear();

      // Stop video/audio
      await this.stopVideoSession();

      // Notify backend that attendee left
      try {
        await fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/video/meeting/leave`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${publicAnonKey}`,
            },
            body: JSON.stringify({
              meetingId: this.meetingConfig.meetingId,
              attendeeId: this.meetingConfig.attendeeId,
            }),
          }
        );
      } catch (error) {
        console.error('Error notifying backend of leave:', error);
      }
      
      this.meetingConfig = null;
    } catch (error) {
      console.error('Error leaving meeting:', error);
    }
  }

  /**
   * Request camera and microphone permissions
   */
  private async requestPermissions(): Promise<void> {
    // This will be handled by react-native-permissions
    // The actual implementation will be in the component
  }

  /**
   * Send chat message
   */
  async sendChatMessage(
    meetingId: string,
    message: string,
    senderId: string,
    senderName: string
  ): Promise<ChimeChatMessage> {
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/video/chat/send`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${publicAnonKey}`,
          },
          body: JSON.stringify({
            meetingId,
            message,
            senderId,
            senderName,
          }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to send chat message');
      }

      const data = await response.json();
      return {
        messageId: data.messageId,
        senderId,
        senderName,
        content: message,
        timestamp: Date.now(),
        type: 'text',
      };
    } catch (error) {
      console.error('Error sending chat message:', error);
      throw error;
    }
  }

  /**
   * Get chat messages for a meeting
   */
  async getChatMessages(meetingId: string): Promise<ChimeChatMessage[]> {
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/video/chat/messages?meetingId=${encodeURIComponent(meetingId)}`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${publicAnonKey}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to get chat messages');
      }

      const data = await response.json();
      return data.messages || [];
    } catch (error) {
      console.error('Error getting chat messages:', error);
      return [];
    }
  }

  /**
   * Get current meeting config
   */
  getMeetingConfig(): ChimeMeetingConfig | null {
    return this.meetingConfig;
  }
}

export default new ChimeService();

