/**
 * Video Consultation Screen - Mobile
 * Video call interface for tele consultations
 * Identical functionality to web app
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { colors, spacing, borderRadius } from '../../theme/colors';
import { CallApi } from '../../services/api';

interface VideoConsultationScreenProps {
  bookingId: string;
  callId?: string;
  phone: string;
  customerId?: string;
  onBack: () => void;
  onNavigate?: (screen: string, data?: any) => void;
  onCallEnd?: () => void;
}

export function VideoConsultationScreen({
  bookingId,
  callId,
  phone,
  customerId,
  onBack,
  onNavigate,
  onCallEnd,
}: VideoConsultationScreenProps) {
  const [callStatus, setCallStatus] = useState<'connecting' | 'ringing' | 'active' | 'ended'>('connecting');
  const [muted, setMuted] = useState(false);
  const [videoOff, setVideoOff] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [loading, setLoading] = useState(false);
  const currentCallId = useRef<string | null>(callId || null);
  const durationInterval = useRef<any>(null);

  useEffect(() => {
    if (!currentCallId.current) {
      initiateCall();
    } else {
      answerCall();
    }

    return () => {
      if (durationInterval.current) {
        clearInterval(durationInterval.current);
      }
    };
  }, []);

  const initiateCall = async () => {
    try {
      setLoading(true);
      const response = await CallApi.initiateCall(bookingId, 'video', customerId || phone);
      currentCallId.current = response.callId;
      setCallStatus('ringing');
      
      // Simulate call connection (in real app, this would be WebRTC)
      setTimeout(() => {
        setCallStatus('active');
        startCallTimer();
      }, 2000);
    } catch (error: any) {
      console.error('Error initiating call:', error);
      Alert.alert('Error', error.message || 'Failed to initiate call');
      setCallStatus('ended');
    } finally {
      setLoading(false);
    }
  };

  const answerCall = async () => {
    try {
      if (currentCallId.current) {
        await CallApi.answerCall(currentCallId.current);
        setCallStatus('active');
        startCallTimer();
      }
    } catch (error: any) {
      console.error('Error answering call:', error);
      Alert.alert('Error', error.message || 'Failed to answer call');
    }
  };

  const startCallTimer = () => {
    durationInterval.current = setInterval(() => {
      setCallDuration(prev => prev + 1);
    }, 1000);
  };

  const handleEndCall = async () => {
    try {
      if (currentCallId.current) {
        await CallApi.endCall(currentCallId.current);
      }
      if (durationInterval.current) {
        clearInterval(durationInterval.current);
      }
      setCallStatus('ended');
      
      Alert.alert(
        'Call Ended',
        `Call duration: ${formatDuration(callDuration)}`,
        [
          {
            text: 'OK',
            onPress: () => {
              if (onCallEnd) {
                onCallEnd();
              } else if (onNavigate) {
                onNavigate('BookingDetail', { bookingId });
              } else {
                onBack();
              }
            },
          },
        ]
      );
    } catch (error: any) {
      console.error('Error ending call:', error);
    }
  };

  const handleToggleMute = () => {
    setMuted(!muted);
    // TODO: Implement actual mute functionality with WebRTC
  };

  const handleToggleVideo = () => {
    setVideoOff(!videoOff);
    // TODO: Implement actual video toggle with WebRTC
  };

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Video View Area */}
      <View style={styles.videoContainer}>
        {callStatus === 'connecting' || callStatus === 'ringing' ? (
          <View style={styles.connectingView}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.connectingText}>
              {callStatus === 'connecting' ? 'Connecting...' : 'Ringing...'}
            </Text>
          </View>
        ) : callStatus === 'active' ? (
          <View style={styles.videoView}>
            {/* TODO: Replace with actual video component (WebRTC) */}
            <View style={styles.videoPlaceholder}>
              <Text style={styles.videoPlaceholderText}>📹</Text>
              <Text style={styles.videoPlaceholderLabel}>Video Call Active</Text>
              {videoOff && (
                <View style={styles.videoOffOverlay}>
                  <Text style={styles.videoOffText}>Video Off</Text>
                </View>
              )}
            </View>
          </View>
        ) : (
          <View style={styles.endedView}>
            <Text style={styles.endedText}>Call Ended</Text>
          </View>
        )}
      </View>

      {/* Call Info */}
      <View style={styles.callInfo}>
        <Text style={styles.callDuration}>{formatDuration(callDuration)}</Text>
        <Text style={styles.callStatus}>
          {callStatus === 'active' ? 'Connected' : callStatus === 'ringing' ? 'Ringing...' : 'Connecting...'}
        </Text>
      </View>

      {/* Control Buttons */}
      {callStatus === 'active' && (
        <View style={styles.controls}>
          <TouchableOpacity
            style={[styles.controlButton, muted && styles.controlButtonActive]}
            onPress={handleToggleMute}
          >
            <Text style={styles.controlButtonIcon}>
              {muted ? '🔇' : '🎤'}
            </Text>
            <Text style={styles.controlButtonLabel}>
              {muted ? 'Unmute' : 'Mute'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.controlButton, videoOff && styles.controlButtonActive]}
            onPress={handleToggleVideo}
          >
            <Text style={styles.controlButtonIcon}>
              {videoOff ? '📹' : '📷'}
            </Text>
            <Text style={styles.controlButtonLabel}>
              {videoOff ? 'Video On' : 'Video Off'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.endCallButton}
            onPress={handleEndCall}
          >
            <Text style={styles.endCallButtonIcon}>📞</Text>
            <Text style={styles.endCallButtonText}>End Call</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* End Call Button (when not active) */}
      {callStatus !== 'active' && (
        <View style={styles.controls}>
          <TouchableOpacity
            style={styles.endCallButton}
            onPress={handleEndCall}
          >
            <Text style={styles.endCallButtonText}>End Call</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  videoContainer: {
    flex: 1,
  },
  connectingView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
  },
  connectingText: {
    marginTop: spacing.md,
    fontSize: 16,
    color: '#fff',
  },
  videoView: {
    flex: 1,
  },
  videoPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
  },
  videoPlaceholderText: {
    fontSize: 64,
    marginBottom: spacing.md,
  },
  videoPlaceholderLabel: {
    fontSize: 18,
    color: '#fff',
  },
  videoOffOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoOffText: {
    fontSize: 24,
    color: '#fff',
  },
  endedView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
  },
  endedText: {
    fontSize: 24,
    color: '#fff',
  },
  callInfo: {
    padding: spacing.md,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    alignItems: 'center',
  },
  callDuration: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: spacing.xs,
  },
  callStatus: {
    fontSize: 14,
    color: '#ccc',
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: spacing.lg,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
  },
  controlButton: {
    alignItems: 'center',
    padding: spacing.md,
  },
  controlButtonActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: borderRadius.md,
  },
  controlButtonIcon: {
    fontSize: 32,
    marginBottom: spacing.xs,
  },
  controlButtonLabel: {
    fontSize: 12,
    color: '#fff',
  },
  endCallButton: {
    backgroundColor: '#dc2626',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    minWidth: 120,
  },
  endCallButtonIcon: {
    fontSize: 24,
    marginBottom: spacing.xs,
  },
  endCallButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

