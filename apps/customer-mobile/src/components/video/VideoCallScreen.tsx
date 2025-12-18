/**
 * Video Call Screen - Customer Mobile App
 * AWS Chime SDK integration for video calling
 * Matches web app VideoRoom component
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  Alert,
  Platform,
} from 'react-native';
import { RTCView, mediaDevices, RTCPeerConnection, RTCSessionDescription, RTCIceCandidate } from 'react-native-webrtc';
import { request, PERMISSIONS, RESULTS } from 'react-native-permissions';
import chimeService from '../../services/chimeService';
import { BrandColors, Typography, BorderRadius, Spacing } from '../../theme';
import { projectId, publicAnonKey } from '../../config/api';
import Icon from 'react-native-vector-icons/MaterialIcons';

interface VideoCallScreenProps {
  bookingId: string;
  userId: string;
  userName: string;
  otherUserName: string;
  onEndCall: () => void;
  onToggleChat?: () => void;
}

export default function VideoCallScreen({
  bookingId,
  userId,
  userName,
  otherUserName,
  onEndCall,
  onToggleChat,
}: VideoCallScreenProps) {
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const [localStream, setLocalStream] = useState<any>(null);
  const [remoteStream, setRemoteStream] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  
  const localVideoRef = useRef<any>(null);
  const remoteVideoRef = useRef<any>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const pollingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    initializeCall();
    return () => {
      isMountedRef.current = false;
      cleanup();
    };
  }, []);

  const requestPermissions = async (): Promise<boolean> => {
    try {
      const cameraPermission = Platform.OS === 'ios' 
        ? PERMISSIONS.IOS.CAMERA 
        : PERMISSIONS.ANDROID.CAMERA;
      
      const microphonePermission = Platform.OS === 'ios'
        ? PERMISSIONS.IOS.MICROPHONE
        : PERMISSIONS.ANDROID.RECORD_AUDIO;

      const cameraResult = await request(cameraPermission);
      const micResult = await request(microphonePermission);

      if (cameraResult !== RESULTS.GRANTED || micResult !== RESULTS.GRANTED) {
        Alert.alert(
          'Permissions Required',
          'Camera and microphone permissions are required for video calls.',
          [{ text: 'OK' }]
        );
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error requesting permissions:', error);
      return false;
    }
  };

  const initializeCall = async () => {
    try {
      setConnectionStatus('connecting');
      setError(null);

      // Request permissions
      const hasPermissions = await requestPermissions();
      if (!hasPermissions) {
        setError('Permissions denied');
        setConnectionStatus('disconnected');
        return;
      }

      // Get local media stream
      const stream = await mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      setLocalStream(stream);

      // Create or join meeting (for meeting management)
      const meetingConfig = await chimeService.createOrJoinMeeting(
        bookingId,
        userId,
        userName
      );

      // Initialize meeting session (stores config)
      await chimeService.initializeMeeting(meetingConfig);

      // Initialize WebRTC peer connection
      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
        ],
      });

      // Add local tracks to peer connection
      stream.getTracks().forEach((track: any) => {
        pc.addTrack(track, stream);
      });

      // Handle remote stream
      pc.ontrack = (event: any) => {
        if (event.streams && event.streams[0]) {
          setRemoteStream(event.streams[0]);
        }
      };

      // Handle ICE candidates
      pc.onicecandidate = async (event: any) => {
        if (event.candidate) {
          // Send ICE candidate to signaling server
          try {
            await fetch(
              `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/video/signal/ice`,
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${publicAnonKey}`,
                },
                body: JSON.stringify({
                  meetingId: meetingConfig.meetingId,
                  candidate: event.candidate,
                  userId,
                }),
              }
            );
          } catch (error) {
            console.error('Error sending ICE candidate:', error);
          }
        }
      };

      // Handle connection state changes
      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'connected') {
          setConnectionStatus('connected');
        } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
          setConnectionStatus('disconnected');
        }
      };

      peerConnectionRef.current = pc;

      // Create offer and send to signaling server
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const offerResponse = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/video/signal/offer`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${publicAnonKey}`,
          },
          body: JSON.stringify({
            meetingId: meetingConfig.meetingId,
            offer: offer,
            userId,
            userName,
          }),
        }
      );

      if (offerResponse.ok) {
        // Start polling for answer
        startPollingForAnswer(meetingConfig.meetingId, pc);
      } else {
        throw new Error('Failed to send offer');
      }

      // Start video session
      await chimeService.startVideoSession();
      
    } catch (err: any) {
      console.error('Error initializing call:', err);
      setError(err.message || 'Failed to start video call');
      setConnectionStatus('disconnected');
      Alert.alert('Error', err.message || 'Failed to start video call');
    }
  };

  const startPollingForAnswer = async (meetingId: string, pc: RTCPeerConnection) => {
    // Clear any existing polling interval
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    if (pollingTimeoutRef.current) {
      clearTimeout(pollingTimeoutRef.current);
      pollingTimeoutRef.current = null;
    }

    pollingIntervalRef.current = setInterval(async () => {
      // Check if component is still mounted
      if (!isMountedRef.current) {
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
        }
        return;
      }

      try {
        const response = await fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/video/signal/answer?meetingId=${encodeURIComponent(meetingId)}&userId=${encodeURIComponent(userId)}`,
          {
            headers: {
              Authorization: `Bearer ${publicAnonKey}`,
            },
          }
        );

        if (response.ok) {
          const data = await response.json();
          if (data.answer) {
            // Clear polling interval
            if (pollingIntervalRef.current) {
              clearInterval(pollingIntervalRef.current);
              pollingIntervalRef.current = null;
            }
            if (pollingTimeoutRef.current) {
              clearTimeout(pollingTimeoutRef.current);
              pollingTimeoutRef.current = null;
            }
            
            // Only update state if component is still mounted
            if (isMountedRef.current) {
              await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
              setConnectionStatus('connected');
            }
          }
        }
      } catch (error) {
        console.error('Error polling for answer:', error);
      }
    }, 2000);

    // Stop polling after 30 seconds
    pollingTimeoutRef.current = setTimeout(() => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      pollingTimeoutRef.current = null;
    }, 30000);
  };

  const handleToggleMute = async () => {
    try {
      if (localStream) {
        const audioTrack = localStream.getAudioTracks()[0];
        if (audioTrack) {
          audioTrack.enabled = isMuted;
          setIsMuted(!isMuted);
        }
      }
    } catch (error) {
      console.error('Error toggling mute:', error);
    }
  };

  const handleToggleVideo = async () => {
    try {
      if (localStream) {
        const videoTrack = localStream.getVideoTracks()[0];
        if (videoTrack) {
          videoTrack.enabled = isVideoOff;
          setIsVideoOff(!isVideoOff);
        }
      }
    } catch (error) {
      console.error('Error toggling video:', error);
    }
  };

  const handleEndCall = async () => {
    Alert.alert(
      'End Call',
      'Are you sure you want to end the call?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'End Call',
          style: 'destructive',
          onPress: async () => {
            await cleanup();
            onEndCall();
          },
        },
      ]
    );
  };

  const cleanup = async () => {
    try {
      // Clear polling interval and timeout
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      if (pollingTimeoutRef.current) {
        clearTimeout(pollingTimeoutRef.current);
        pollingTimeoutRef.current = null;
      }

      // Close peer connection
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
        peerConnectionRef.current = null;
      }

      // Stop local stream
      if (localStream) {
        localStream.getTracks().forEach((track: any) => track.stop());
        setLocalStream(null);
      }

      // Stop remote stream
      if (remoteStream) {
        remoteStream.getTracks().forEach((track: any) => track.stop());
        setRemoteStream(null);
      }

      // Leave meeting
      await chimeService.leaveMeeting();
    } catch (error) {
      console.error('Error cleaning up:', error);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />
      
      {/* Video Container */}
      <View style={styles.videoContainer}>
        {/* Remote Video (Other Participant) */}
        {remoteStream ? (
          <RTCView
            ref={remoteVideoRef}
            streamURL={remoteStream.toURL()}
            style={styles.remoteVideo}
            objectFit="cover"
            zOrder={0}
          />
        ) : (
          <View style={styles.remoteVideoPlaceholder}>
            <Icon name="person" size={64} color="#FFFFFF" />
            <Text style={styles.placeholderText}>{otherUserName}</Text>
            {connectionStatus === 'connecting' && (
              <Text style={styles.connectingText}>Connecting...</Text>
            )}
          </View>
        )}

        {/* Local Video (Self) */}
        {localStream && !isVideoOff ? (
          <View style={styles.localVideoContainer}>
            <RTCView
              ref={localVideoRef}
              streamURL={localStream.toURL()}
              style={styles.localVideo}
              objectFit="cover"
              zOrder={1}
              mirror={true}
            />
          </View>
        ) : (
          <View style={styles.localVideoPlaceholder}>
            <Icon name="videocam-off" size={32} color="#FFFFFF" />
            <Text style={styles.localPlaceholderText}>{userName}</Text>
          </View>
        )}

        {/* Connection Status */}
        {connectionStatus === 'connecting' && (
          <View style={styles.statusOverlay}>
            <Text style={styles.statusText}>Connecting...</Text>
          </View>
        )}

        {/* Error Message */}
        {error && (
          <View style={styles.errorOverlay}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}
      </View>

      {/* Controls */}
      <View style={styles.controlsContainer}>
        <View style={styles.controlsRow}>
          {/* Mute Button */}
          <TouchableOpacity
            style={[styles.controlButton, isMuted && styles.controlButtonActive]}
            onPress={handleToggleMute}
          >
            <Icon
              name={isMuted ? 'mic-off' : 'mic'}
              size={24}
              color="#FFFFFF"
            />
          </TouchableOpacity>

          {/* Video Toggle Button */}
          <TouchableOpacity
            style={[styles.controlButton, isVideoOff && styles.controlButtonActive]}
            onPress={handleToggleVideo}
          >
            <Icon
              name={isVideoOff ? 'videocam-off' : 'videocam'}
              size={24}
              color="#FFFFFF"
            />
          </TouchableOpacity>

          {/* Chat Toggle Button */}
          {onToggleChat && (
            <TouchableOpacity
              style={styles.controlButton}
              onPress={onToggleChat}
            >
              <Icon name="chat" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          )}

          {/* End Call Button */}
          <TouchableOpacity
            style={[styles.controlButton, styles.endCallButton]}
            onPress={handleEndCall}
          >
            <Icon name="call-end" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  videoContainer: {
    flex: 1,
    position: 'relative',
  },
  remoteVideo: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  remoteVideoPlaceholder: {
    flex: 1,
    backgroundColor: '#1A1A1A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    ...Typography.body,
    color: '#FFFFFF',
    marginTop: Spacing.base,
  },
  connectingText: {
    ...Typography.bodySmall,
    color: '#CCCCCC',
    marginTop: Spacing.sm,
  },
  localVideoContainer: {
    position: 'absolute',
    top: Spacing.xl,
    right: Spacing.base,
    width: 120,
    height: 160,
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  localVideo: {
    width: '100%',
    height: '100%',
  },
  localVideoPlaceholder: {
    position: 'absolute',
    top: Spacing.xl,
    right: Spacing.base,
    width: 120,
    height: 160,
    backgroundColor: '#2A2A2A',
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  localPlaceholderText: {
    ...Typography.bodyTiny,
    color: '#FFFFFF',
    marginTop: Spacing.xs,
  },
  statusOverlay: {
    position: 'absolute',
    top: Spacing.xl,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  statusText: {
    ...Typography.body,
    color: '#FFFFFF',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
  },
  errorOverlay: {
    position: 'absolute',
    bottom: 100,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  errorText: {
    ...Typography.bodySmall,
    color: '#FF0000',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
  },
  controlsContainer: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Platform.OS === 'ios' ? Spacing.xl + 20 : Spacing.xl,
    paddingTop: Spacing.base,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
  },
  controlsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.base,
  },
  controlButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  controlButtonActive: {
    backgroundColor: BrandColors.primary.orange,
  },
  endCallButton: {
    backgroundColor: '#DC2626',
  },
});

