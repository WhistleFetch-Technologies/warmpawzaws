/**
 * ============================================================================
 * AWS CHIME SDK WRAPPER
 * ============================================================================
 * 
 * Provides simplified interface for AWS Chime SDK video calling
 * 
 * Date: 2026-01-07
 * Updated: 2026-01-27 - Fixed MediaPlacement requirement for SDK initialization
 * ============================================================================
 */

import type { AudioVideoFacade, DefaultMeetingSession, Logger, LogLevel } from 'amazon-chime-sdk-js';

type ChimeSdkModule = typeof import('amazon-chime-sdk-js');

let chimeSdkModulePromise: Promise<ChimeSdkModule> | null = null;

async function getChimeSdkModule(): Promise<ChimeSdkModule> {
  if (!chimeSdkModulePromise) {
    chimeSdkModulePromise = import('amazon-chime-sdk-js');
  }
  return chimeSdkModulePromise;
}

// Full meeting info with MediaPlacement (required by Chime SDK)
export interface ChimeMeetingInfo {
  meetingId: string;
  attendeeId: string;
  joinToken: string;
  mediaRegion: string;
  // MediaPlacement is REQUIRED for Chime SDK to work properly
  mediaPlacement: {
    audioHostUrl: string;
    audioFallbackUrl: string;
    signalingUrl: string;
    turnControlUrl: string;
    screenDataUrl?: string;
    screenViewingUrl?: string;
    screenSharingUrl?: string;
    eventIngestionUrl?: string;
  };
}

// Full meeting response from backend (preferred format)
export interface ChimeMeetingResponse {
  meeting: {
    MeetingId: string;
    MediaPlacement: {
      AudioHostUrl: string;
      AudioFallbackUrl: string;
      SignalingUrl: string;
      TurnControlUrl: string;
      ScreenDataUrl?: string;
      ScreenViewingUrl?: string;
      ScreenSharingUrl?: string;
      EventIngestionUrl?: string;
    };
    MediaRegion: string;
  };
  attendee: {
    AttendeeId: string;
    JoinToken: string;
    ExternalUserId?: string;
  };
}

// Simple logger implementation (LogLevel values resolved when Chime SDK loads)
class CustomConsoleLogger implements Logger {
  private logLevel = 2;

  info(msg: string): void {
    if (this.logLevel <= 2) {
      if (process.env.NODE_ENV === 'development') console.log(`[Chime] ${msg}`);
    }
  }
  warn(msg: string): void {
    if (this.logLevel <= 3) {
      console.warn(`[Chime] ${msg}`);
    }
  }
  error(msg: string): void {
    console.error(`[Chime] ${msg}`);
  }
  debug(debugFunction: () => string): void {
    if (this.logLevel <= 1 && process.env.NODE_ENV === 'development') {
      console.debug(`[Chime] ${debugFunction()}`);
    }
  }
  setLogLevel(level: LogLevel): void {
    this.logLevel = level;
  }
  getLogLevel(): LogLevel {
    return this.logLevel;
  }
}

const logger = new CustomConsoleLogger();

export class ChimeSDKError extends Error {
  public code: string;
  public retryable: boolean;

  constructor(message: string, code: string, retryable: boolean = false) {
    super(message);
    this.name = 'ChimeSDKError';
    this.code = code;
    this.retryable = retryable;
  }
}

export class ChimeSDKManager {
  private meetingSession: DefaultMeetingSession | null = null;
  private audioVideo: AudioVideoFacade | null = null;
  private localVideoElement: HTMLVideoElement | null = null;
  private remoteVideoElement: HTMLVideoElement | null = null;
  private audioElement: HTMLAudioElement | null = null;

  /**
   * Initialize with full meeting response from backend (RECOMMENDED)
   * This ensures MediaPlacement is properly included
   */
  async initializeWithResponse(response: ChimeMeetingResponse): Promise<void> {
    try {
      const SDK = await getChimeSdkModule();
      logger.setLogLevel(SDK.LogLevel.INFO);

      if (!response.meeting || !response.attendee) {
        throw new ChimeSDKError('Invalid meeting response: missing meeting or attendee data', 'INVALID_RESPONSE', false);
      }

      if (!response.meeting.MediaPlacement) {
        throw new ChimeSDKError('Invalid meeting response: MediaPlacement is required', 'MISSING_MEDIA_PLACEMENT', false);
      }

      // Create configuration with PROPER structure including MediaPlacement
      const configuration = new SDK.MeetingSessionConfiguration(
        {
          MeetingId: response.meeting.MeetingId,
          MediaPlacement: response.meeting.MediaPlacement,
          MediaRegion: response.meeting.MediaRegion,
        },
        {
          AttendeeId: response.attendee.AttendeeId,
          JoinToken: response.attendee.JoinToken,
        }
      );

      const deviceController = new SDK.DefaultDeviceController(logger);

      this.meetingSession = new SDK.DefaultMeetingSession(
        configuration,
        logger,
        deviceController
      );

      this.audioVideo = this.meetingSession.audioVideo;

      // Set up event observers
      this.setupEventObservers();

      if (process.env.NODE_ENV === 'development') {
        console.log('✅ Chime SDK initialized successfully with full meeting data');
      }
    } catch (error: any) {
      console.error('Error initializing Chime SDK:', error);
      if (error instanceof ChimeSDKError) {
        throw error;
      }
      throw new ChimeSDKError(
        `Failed to initialize Chime SDK: ${error.message}`,
        'INIT_FAILED',
        true
      );
    }
  }

  /**
   * @deprecated Use initializeWithResponse instead for proper MediaPlacement support
   * This method is kept for backward compatibility but may fail without MediaPlacement
   */
  async initialize(meetingInfo: ChimeMeetingInfo): Promise<void> {
    try {
      // Convert to full response format
      const response: ChimeMeetingResponse = {
        meeting: {
          MeetingId: meetingInfo.meetingId,
          MediaRegion: meetingInfo.mediaRegion,
          MediaPlacement: meetingInfo.mediaPlacement ? {
            AudioHostUrl: meetingInfo.mediaPlacement.audioHostUrl,
            AudioFallbackUrl: meetingInfo.mediaPlacement.audioFallbackUrl,
            SignalingUrl: meetingInfo.mediaPlacement.signalingUrl,
            TurnControlUrl: meetingInfo.mediaPlacement.turnControlUrl,
            ScreenDataUrl: meetingInfo.mediaPlacement.screenDataUrl,
            ScreenViewingUrl: meetingInfo.mediaPlacement.screenViewingUrl,
            ScreenSharingUrl: meetingInfo.mediaPlacement.screenSharingUrl,
            EventIngestionUrl: meetingInfo.mediaPlacement.eventIngestionUrl,
          } : undefined as any,
        },
        attendee: {
          AttendeeId: meetingInfo.attendeeId,
          JoinToken: meetingInfo.joinToken,
        },
      };

      if (!response.meeting.MediaPlacement) {
        throw new ChimeSDKError(
          'MediaPlacement is required for Chime SDK initialization. Please fetch meeting credentials from backend first.',
          'MISSING_MEDIA_PLACEMENT',
          false
        );
      }

      return this.initializeWithResponse(response);
    } catch (error: any) {
      console.error('Error initializing Chime SDK:', error);
      if (error instanceof ChimeSDKError) {
        throw error;
      }
      throw new ChimeSDKError(`Failed to initialize Chime SDK: ${error.message}`, 'INIT_FAILED', true);
    }
  }

  private setupEventObservers(): void {
    if (!this.audioVideo) return;

    // Observe audio/video state changes
    this.audioVideo.realtimeSubscribeToMuteAndUnmuteLocalAudio((muted: boolean) => {
      console.log(`[Chime] Audio ${muted ? 'muted' : 'unmuted'}`);
    });

    // Observe video tiles using observer pattern
    this.audioVideo.addObserver({
      audioVideoDidStart: () => {
        console.log('[Chime] Audio/Video session started');
      },
      audioVideoDidStop: (sessionStatus: any) => {
        console.log('[Chime] Audio/Video session stopped:', sessionStatus?.statusCode?.());
      },
      audioVideoDidStartConnecting: (reconnecting: boolean) => {
        console.log(`[Chime] ${reconnecting ? 'Reconnecting...' : 'Connecting...'}`);
      },
      videoTileDidUpdate: (tileState: any) => {
        // Handle local video tile
        if (tileState.localTile && this.localVideoElement) {
          this.audioVideo?.bindVideoElement(tileState.tileId, this.localVideoElement);
        }
        // Handle remote video tile (not content share)
        if (!tileState.localTile && !tileState.isContent && this.remoteVideoElement) {
          this.audioVideo?.bindVideoElement(tileState.tileId, this.remoteVideoElement);
        }
      },
      videoTileWasRemoved: (tileId: number) => {
        console.log('[Chime] Video tile removed:', tileId);
      },
    });
  }

  /**
   * Set up audio/video devices and start media
   */
  async setupDevices(): Promise<void> {
    if (!this.audioVideo) {
      throw new ChimeSDKError('Not initialized', 'NOT_INITIALIZED', false);
    }

    try {
      // Get available devices
      const audioInputDevices = await this.audioVideo.listAudioInputDevices();
      const videoInputDevices = await this.audioVideo.listVideoInputDevices();
      const audioOutputDevices = await this.audioVideo.listAudioOutputDevices();

      // Select first available devices
      if (audioInputDevices.length > 0) {
        await this.audioVideo.startAudioInput(audioInputDevices[0].deviceId);
      } else {
        console.warn('[Chime] No audio input devices found');
      }

      if (audioOutputDevices.length > 0) {
        await this.audioVideo.chooseAudioOutput(audioOutputDevices[0].deviceId);
      }

      if (videoInputDevices.length > 0) {
        await this.audioVideo.startVideoInput(videoInputDevices[0].deviceId);
      } else {
        console.warn('[Chime] No video input devices found');
      }

      console.log('✅ [Chime] Devices set up successfully');
    } catch (error: any) {
      console.error('[Chime] Error setting up devices:', error);
      throw new ChimeSDKError(
        'Failed to access camera/microphone. Please grant permissions and try again.',
        'DEVICE_ACCESS_DENIED',
        true
      );
    }
  }

  /**
   * Bind audio element for remote audio playback
   */
  bindAudioElement(audioElement: HTMLAudioElement): void {
    if (!this.audioVideo) {
      throw new ChimeSDKError('Not initialized', 'NOT_INITIALIZED', false);
    }
    this.audioElement = audioElement;
    this.audioVideo.bindAudioElement(audioElement);
  }

  async startLocalVideo(videoElement: HTMLVideoElement): Promise<void> {
    if (!this.audioVideo) {
      throw new ChimeSDKError('Not initialized', 'NOT_INITIALIZED', false);
    }
    
    this.localVideoElement = videoElement;
    await this.audioVideo.startLocalVideoTile();
  }

  async startRemoteVideo(videoElement: HTMLVideoElement): Promise<void> {
    if (!this.audioVideo) {
      throw new ChimeSDKError('Not initialized', 'NOT_INITIALIZED', false);
    }
    
    this.remoteVideoElement = videoElement;
    // Remote video will be bound automatically via observer
  }

  async join(): Promise<void> {
    if (!this.audioVideo) {
      throw new ChimeSDKError('Not initialized', 'NOT_INITIALIZED', false);
    }
    
    try {
      await this.audioVideo.start();
      // Start local video after session starts
      await this.audioVideo.startLocalVideoTile();
      console.log('✅ [Chime] Joined meeting successfully');
    } catch (error: any) {
      console.error('[Chime] Error joining meeting:', error);
      throw new ChimeSDKError(
        `Failed to join meeting: ${error.message}`,
        'JOIN_FAILED',
        true
      );
    }
  }

  async toggleMute(): Promise<boolean> {
    if (!this.audioVideo) {
      throw new ChimeSDKError('Not initialized', 'NOT_INITIALIZED', false);
    }
    
    const isMuted = this.audioVideo.realtimeIsLocalAudioMuted();
    if (isMuted) {
      this.audioVideo.realtimeUnmuteLocalAudio();
    } else {
      this.audioVideo.realtimeMuteLocalAudio();
    }
    return !isMuted;
  }

  async toggleVideo(): Promise<boolean> {
    if (!this.audioVideo) {
      throw new ChimeSDKError('Not initialized', 'NOT_INITIALIZED', false);
    }
    
    const hasVideo = this.audioVideo.hasStartedLocalVideoTile();
    if (hasVideo) {
      this.audioVideo.stopLocalVideoTile();
      return false;
    } else {
      await this.audioVideo.startLocalVideoTile();
      return true;
    }
  }

  /**
   * Start screen sharing
   */
  async startScreenShare(): Promise<void> {
    if (!this.audioVideo) {
      throw new ChimeSDKError('Not initialized', 'NOT_INITIALIZED', false);
    }
    
    try {
      await this.audioVideo.startContentShareFromScreenCapture();
      console.log('✅ [Chime] Screen sharing started');
    } catch (error: any) {
      console.error('[Chime] Error starting screen share:', error);
      throw new ChimeSDKError(
        'Failed to start screen sharing',
        'SCREEN_SHARE_FAILED',
        false
      );
    }
  }

  /**
   * Stop screen sharing
   */
  async stopScreenShare(): Promise<void> {
    if (!this.audioVideo) {
      throw new ChimeSDKError('Not initialized', 'NOT_INITIALIZED', false);
    }
    
    await this.audioVideo.stopContentShare();
  }

  async endCall(): Promise<void> {
    try {
      if (this.audioVideo) {
        this.audioVideo.stopLocalVideoTile();
        this.audioVideo.stop();
      }
    } catch (error) {
      console.warn('[Chime] Error during cleanup:', error);
    }
    
    // Clean up video elements
    if (this.localVideoElement?.srcObject) {
      const stream = this.localVideoElement.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      this.localVideoElement.srcObject = null;
    }
    if (this.remoteVideoElement?.srcObject) {
      const stream = this.remoteVideoElement.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      this.remoteVideoElement.srcObject = null;
    }
    
    this.meetingSession = null;
    this.audioVideo = null;
    this.localVideoElement = null;
    this.remoteVideoElement = null;
    this.audioElement = null;
    
    console.log('✅ [Chime] Call ended and resources cleaned up');
  }

  isInitialized(): boolean {
    return this.audioVideo !== null;
  }

  /**
   * Get the underlying audio/video facade for advanced usage
   */
  getAudioVideo(): AudioVideoFacade | null {
    return this.audioVideo;
  }
}

/**
 * Utility function to load the Chime SDK dynamically
 * This is useful for code splitting and reducing initial bundle size
 */
export async function loadChimeSDK(): Promise<ChimeSdkModule> {
  try {
    const ChimeSDK = await getChimeSdkModule();
    if (!ChimeSDK || !ChimeSDK.DefaultMeetingSession) {
      throw new Error('Chime SDK failed to load properly');
    }
    if (process.env.NODE_ENV === 'development') {
      console.log('✅ AWS Chime SDK loaded from npm package');
    }
    return ChimeSDK;
  } catch (error: any) {
    console.error('Error loading Chime SDK:', error);
    throw new ChimeSDKError(
      'Failed to load video call SDK. Please check your internet connection and try again.',
      'SDK_LOAD_FAILED',
      true
    );
  }
}

