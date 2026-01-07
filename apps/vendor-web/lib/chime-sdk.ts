/**
 * ============================================================================
 * AWS CHIME SDK WRAPPER
 * ============================================================================
 * 
 * Provides simplified interface for AWS Chime SDK video calling
 * 
 * Date: 2026-01-07
 * ============================================================================
 */

import {
  DefaultMeetingSession,
  MeetingSessionConfiguration,
  AudioVideoFacade,
  DefaultDeviceController,
  Logger,
  LogLevel,
  VideoTile,
} from 'amazon-chime-sdk-js';

export interface ChimeMeetingInfo {
  meetingId: string;
  attendeeId: string;
  joinToken: string;
  mediaRegion: string;
}

// Simple logger implementation
class ConsoleLogger implements Logger {
  info(msg: string): void {
    console.log(`[Chime] ${msg}`);
  }
  warn(msg: string): void {
    console.warn(`[Chime] ${msg}`);
  }
  error(msg: string): void {
    console.error(`[Chime] ${msg}`);
  }
  debug(debugFunction: () => string): void {
    if (process.env.NODE_ENV === 'development') {
      console.debug(`[Chime] ${debugFunction()}`);
    }
  }
  setLogLevel(level: LogLevel): void {
    // Ignore for now
  }
  getLogLevel(): LogLevel {
    return LogLevel.INFO;
  }
}

const logger = new ConsoleLogger();

export class ChimeSDKManager {
  private meetingSession: DefaultMeetingSession | null = null;
  private audioVideo: AudioVideoFacade | null = null;
  private localVideoElement: HTMLVideoElement | null = null;
  private remoteVideoElement: HTMLVideoElement | null = null;

  async initialize(meetingInfo: ChimeMeetingInfo): Promise<void> {
    try {
      const configuration = new MeetingSessionConfiguration(
        {
          MeetingId: meetingInfo.meetingId,
          MediaRegion: meetingInfo.mediaRegion,
          ExternalMeetingId: meetingInfo.meetingId,
        },
        {
          AttendeeId: meetingInfo.attendeeId,
          JoinToken: meetingInfo.joinToken,
          ExternalUserId: meetingInfo.attendeeId,
        }
      );

      const deviceController = new DefaultDeviceController(logger);

      this.meetingSession = new DefaultMeetingSession(
        configuration,
        logger,
        deviceController
      );

      this.audioVideo = this.meetingSession.audioVideo;

      // Set up event observers
      this.setupEventObservers();

      console.log('✅ Chime SDK initialized successfully');
    } catch (error: any) {
      console.error('Error initializing Chime SDK:', error);
      throw new Error(`Failed to initialize Chime SDK: ${error.message}`);
    }
  }

  private setupEventObservers(): void {
    if (!this.audioVideo) return;

    // Observe audio/video state changes
    this.audioVideo.realtimeSubscribeToMuteAndUnmuteLocalAudio((muted: boolean) => {
      console.log(`Audio ${muted ? 'muted' : 'unmuted'}`);
    });

    this.audioVideo.realtimeSubscribeToLocalVideoTileDidChange((tile: VideoTile | null) => {
      if (tile?.boundVideoElement && this.localVideoElement) {
        this.localVideoElement.srcObject = tile.boundVideoElement.srcObject;
      }
    });

    // Observe remote video tiles
    this.audioVideo.addObserver({
      videoTileDidUpdate: (tileState: any) => {
        if (tileState.boundVideoElement && this.remoteVideoElement && !tileState.isContent) {
          this.remoteVideoElement.srcObject = tileState.boundVideoElement.srcObject;
        }
      },
    });
  }

  async startLocalVideo(videoElement: HTMLVideoElement): Promise<void> {
    if (!this.audioVideo) throw new Error('Not initialized');
    
    this.localVideoElement = videoElement;
    await this.audioVideo.startLocalVideoTile();
    this.audioVideo.bindVideoElement(0, videoElement);
  }

  async startRemoteVideo(videoElement: HTMLVideoElement): Promise<void> {
    if (!this.audioVideo) throw new Error('Not initialized');
    
    this.remoteVideoElement = videoElement;
    // Remote video will be bound automatically via observer
  }

  async join(): Promise<void> {
    if (!this.audioVideo) throw new Error('Not initialized');
    
    await this.audioVideo.start();
    console.log('✅ Joined Chime meeting');
  }

  async toggleMute(): Promise<boolean> {
    if (!this.audioVideo) throw new Error('Not initialized');
    
    const isMuted = this.audioVideo.realtimeIsLocalAudioMuted();
    this.audioVideo.realtimeMuteLocalAudio(!isMuted);
    return !isMuted;
  }

  async toggleVideo(): Promise<boolean> {
    if (!this.audioVideo) throw new Error('Not initialized');
    
    const hasVideo = this.audioVideo.hasStartedLocalVideoTile();
    if (hasVideo) {
      this.audioVideo.stopLocalVideoTile();
      return false;
    } else {
      await this.audioVideo.startLocalVideoTile();
      if (this.localVideoElement) {
        this.audioVideo.bindVideoElement(0, this.localVideoElement);
      }
      return true;
    }
  }

  async endCall(): Promise<void> {
    if (this.audioVideo) {
      this.audioVideo.stop();
    }
    
    // Clean up video elements
    if (this.localVideoElement) {
      this.localVideoElement.srcObject = null;
    }
    if (this.remoteVideoElement) {
      this.remoteVideoElement.srcObject = null;
    }
    
    this.meetingSession = null;
    this.audioVideo = null;
    this.localVideoElement = null;
    this.remoteVideoElement = null;
    
    console.log('✅ Chime call ended');
  }

  isInitialized(): boolean {
    return this.audioVideo !== null;
  }
}

