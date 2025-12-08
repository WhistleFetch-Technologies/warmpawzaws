/**
 * Video Consultation Room Component
 * Uses Agora SDK for real-time video calls
 * Used by: Veterinarian, Pet Behaviorist, Pet Nutritionist (tele services)
 */

import { useState, useEffect, useRef } from 'react';
import { Video, VideoOff, Mic, MicOff, PhoneOff, Monitor, MonitorOff, Users } from 'lucide-react';
import { projectId, publicAnonKey } from '../../utils/supabase/info';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475`;

interface VideoConsultationRoomProps {
  consultationId: string;
  userType: 'vendor' | 'customer';
  userName: string;
  onCallEnd?: () => void;
}

export function VideoConsultationRoom({
  consultationId,
  userType,
  userName,
  onCallEnd
}: VideoConsultationRoomProps) {
  // State
  const [isJoined, setIsJoined] = useState(false);
  const [isVideoOn, setIsVideoOn] = useState(true);
  const [isAudioOn, setIsAudioOn] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [remoteUsers, setRemoteUsers] = useState<any[]>([]);
  const [consultation, setConsultation] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [callDuration, setCallDuration] = useState(0);

  // Refs
  const localVideoRef = useRef<HTMLDivElement>(null);
  const remoteVideoRef = useRef<HTMLDivElement>(null);
  const agoraClient = useRef<any>(null);
  const localVideoTrack = useRef<any>(null);
  const localAudioTrack = useRef<any>(null);
  const screenTrack = useRef<any>(null);
  const durationTimerRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * Initialize Agora SDK
   * Using CDN version for simplicity
   */
  const initializeAgora = async () => {
    try {
      // Check if AgoraRTC is loaded
      if (!window.AgoraRTC) {
        // Load Agora SDK dynamically
        await loadAgoraSDK();
      }

      // Create Agora client
      agoraClient.current = window.AgoraRTC.createClient({ 
        mode: 'rtc', 
        codec: 'vp8' 
      });

      // Set up event listeners
      agoraClient.current.on('user-published', handleUserPublished);
      agoraClient.current.on('user-unpublished', handleUserUnpublished);
      agoraClient.current.on('user-left', handleUserLeft);

      console.log('✅ Agora client initialized');
    } catch (err: any) {
      console.error('Failed to initialize Agora:', err);
      setError('Failed to initialize video SDK');
    }
  };

  /**
   * Load Agora SDK from CDN
   */
  const loadAgoraSDK = (): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (window.AgoraRTC) {
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://download.agora.io/sdk/release/AgoraRTC_N-4.19.0.js';
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load Agora SDK'));
      document.head.appendChild(script);
    });
  };

  /**
   * Fetch consultation details
   */
  const fetchConsultation = async () => {
    try {
      const response = await fetch(`${API_BASE}/video/consultation/${consultationId}`, {
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch consultation');
      }

      const data = await response.json();
      setConsultation(data.consultation);
      return data.consultation;
    } catch (err: any) {
      setError(err.message);
      return null;
    }
  };

  /**
   * Join video call
   */
  const joinCall = async () => {
    try {
      const consultData = consultation || await fetchConsultation();
      
      if (!consultData) {
        throw new Error('Consultation data not available');
      }

      // Get token based on user type
      const token = userType === 'vendor' ? consultData.vendorToken : consultData.customerToken;
      const uid = userType === 'vendor' ? 1 : 2; // Simple UID assignment

      // Join channel
      await agoraClient.current.join(
        consultData.appId,
        consultData.channelName,
        token,
        uid
      );

      // Create and publish local tracks
      [localAudioTrack.current, localVideoTrack.current] = await window.AgoraRTC.createMicrophoneAndCameraTracks();

      // Play local video
      if (localVideoRef.current) {
        localVideoTrack.current.play(localVideoRef.current);
      }

      // Publish tracks
      await agoraClient.current.publish([localAudioTrack.current, localVideoTrack.current]);

      setIsJoined(true);
      console.log('✅ Joined video call');

      // Start consultation on server
      await fetch(`${API_BASE}/video/consultation/${consultationId}/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${publicAnonKey}`
        },
        body: JSON.stringify({ participantType: userType })
      });

      // Start duration timer
      startDurationTimer();
    } catch (err: any) {
      console.error('Failed to join call:', err);
      setError('Failed to join video call');
    }
  };

  /**
   * Leave video call
   */
  const leaveCall = async () => {
    try {
      // Stop duration timer
      if (durationTimerRef.current) {
        clearInterval(durationTimerRef.current);
      }

      // Unpublish and close local tracks
      if (localAudioTrack.current) {
        localAudioTrack.current.close();
      }
      if (localVideoTrack.current) {
        localVideoTrack.current.close();
      }
      if (screenTrack.current) {
        screenTrack.current.close();
      }

      // Leave channel
      if (agoraClient.current) {
        await agoraClient.current.leave();
      }

      setIsJoined(false);
      setRemoteUsers([]);

      console.log('✅ Left video call');

      // End consultation on server
      await fetch(`${API_BASE}/video/consultation/${consultationId}/end`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${publicAnonKey}`
        },
        body: JSON.stringify({ duration: callDuration })
      });

      if (onCallEnd) {
        onCallEnd();
      }
    } catch (err: any) {
      console.error('Failed to leave call:', err);
    }
  };

  /**
   * Toggle video
   */
  const toggleVideo = async () => {
    if (localVideoTrack.current) {
      await localVideoTrack.current.setEnabled(!isVideoOn);
      setIsVideoOn(!isVideoOn);
    }
  };

  /**
   * Toggle audio
   */
  const toggleAudio = async () => {
    if (localAudioTrack.current) {
      await localAudioTrack.current.setEnabled(!isAudioOn);
      setIsAudioOn(!isAudioOn);
    }
  };

  /**
   * Toggle screen sharing
   */
  const toggleScreenShare = async () => {
    try {
      if (!isScreenSharing) {
        // Start screen sharing
        screenTrack.current = await window.AgoraRTC.createScreenVideoTrack();
        
        // Unpublish camera
        await agoraClient.current.unpublish([localVideoTrack.current]);
        
        // Publish screen
        await agoraClient.current.publish([screenTrack.current]);
        
        // Play screen locally
        if (localVideoRef.current) {
          screenTrack.current.play(localVideoRef.current);
        }
        
        setIsScreenSharing(true);
      } else {
        // Stop screen sharing
        await agoraClient.current.unpublish([screenTrack.current]);
        screenTrack.current.close();
        
        // Republish camera
        await agoraClient.current.publish([localVideoTrack.current]);
        
        // Play camera locally
        if (localVideoRef.current) {
          localVideoTrack.current.play(localVideoRef.current);
        }
        
        setIsScreenSharing(false);
      }
    } catch (err: any) {
      console.error('Screen sharing error:', err);
      setError('Screen sharing failed');
    }
  };

  /**
   * Handle remote user published
   */
  const handleUserPublished = async (user: any, mediaType: string) => {
    await agoraClient.current.subscribe(user, mediaType);
    
    if (mediaType === 'video') {
      setRemoteUsers(prev => [...prev.filter(u => u.uid !== user.uid), user]);
      
      // Play remote video
      setTimeout(() => {
        const remoteContainer = document.getElementById(`remote-${user.uid}`);
        if (remoteContainer) {
          user.videoTrack.play(remoteContainer);
        }
      }, 100);
    }
    
    if (mediaType === 'audio') {
      user.audioTrack.play();
    }
  };

  /**
   * Handle remote user unpublished
   */
  const handleUserUnpublished = (user: any, mediaType: string) => {
    if (mediaType === 'video') {
      setRemoteUsers(prev => prev.filter(u => u.uid !== user.uid));
    }
  };

  /**
   * Handle remote user left
   */
  const handleUserLeft = (user: any) => {
    setRemoteUsers(prev => prev.filter(u => u.uid !== user.uid));
  };

  /**
   * Start duration timer
   */
  const startDurationTimer = () => {
    durationTimerRef.current = setInterval(() => {
      setCallDuration(prev => prev + 1);
    }, 1000);
  };

  /**
   * Format duration
   */
  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  /**
   * Initialize on mount
   */
  useEffect(() => {
    initializeAgora();
    fetchConsultation();

    return () => {
      if (isJoined) {
        leaveCall();
      }
    };
  }, []);

  return (
    <div className="h-screen bg-gray-900 flex flex-col">
      {/* Header */}
      <div className="bg-gray-800 p-4 flex items-center justify-between">
        <div>
          <h2 className="text-white font-semibold">{userName}</h2>
          <p className="text-gray-400 text-sm">
            {isJoined ? `${formatDuration(callDuration)} • ${remoteUsers.length} participant(s)` : 'Not connected'}
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Users className="size-5 text-gray-400" />
          <span className="text-white">{remoteUsers.length + (isJoined ? 1 : 0)}</span>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-500 text-white px-4 py-2 text-sm">
          ⚠️ {error}
        </div>
      )}

      {/* Video Grid */}
      <div className="flex-1 relative p-4 flex items-center justify-center">
        {/* Remote Video */}
        {remoteUsers.length > 0 ? (
          <div className="w-full h-full grid grid-cols-1 gap-4">
            {remoteUsers.map(user => (
              <div
                key={user.uid}
                id={`remote-${user.uid}`}
                className="bg-gray-800 rounded-lg overflow-hidden relative"
              />
            ))}
          </div>
        ) : (
          <div className="text-center text-gray-400">
            <Users className="size-16 mx-auto mb-4 opacity-50" />
            <p>Waiting for other participant...</p>
          </div>
        )}

        {/* Local Video (Picture-in-Picture) */}
        {isJoined && (
          <div className="absolute bottom-4 right-4 w-48 h-36 bg-gray-800 rounded-lg overflow-hidden shadow-lg">
            <div ref={localVideoRef} className="w-full h-full" />
            <div className="absolute bottom-2 left-2 text-white text-xs bg-black bg-opacity-50 px-2 py-1 rounded">
              You {isScreenSharing && '(Screen)'}
            </div>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="bg-gray-800 p-4 flex items-center justify-center space-x-4">
        {!isJoined ? (
          <button
            onClick={joinCall}
            className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center space-x-2"
          >
            <Video className="size-5" />
            <span>Join Call</span>
          </button>
        ) : (
          <>
            {/* Video Toggle */}
            <button
              onClick={toggleVideo}
              className={`p-4 rounded-full ${isVideoOn ? 'bg-gray-700 hover:bg-gray-600' : 'bg-red-600 hover:bg-red-700'}`}
            >
              {isVideoOn ? <Video className="size-6 text-white" /> : <VideoOff className="size-6 text-white" />}
            </button>

            {/* Audio Toggle */}
            <button
              onClick={toggleAudio}
              className={`p-4 rounded-full ${isAudioOn ? 'bg-gray-700 hover:bg-gray-600' : 'bg-red-600 hover:bg-red-700'}`}
            >
              {isAudioOn ? <Mic className="size-6 text-white" /> : <MicOff className="size-6 text-white" />}
            </button>

            {/* Screen Share Toggle */}
            <button
              onClick={toggleScreenShare}
              className={`p-4 rounded-full ${isScreenSharing ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-700 hover:bg-gray-600'}`}
            >
              {isScreenSharing ? <MonitorOff className="size-6 text-white" /> : <Monitor className="size-6 text-white" />}
            </button>

            {/* End Call */}
            <button
              onClick={leaveCall}
              className="p-4 rounded-full bg-red-600 hover:bg-red-700"
            >
              <PhoneOff className="size-6 text-white" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// Extend Window interface for AgoraRTC
declare global {
  interface Window {
    AgoraRTC: any;
  }
}
