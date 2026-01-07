/**
 * Video Call Screen
 * Video call integration for consultations
 * Batch 2 - Screen 2
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
import { colors, spacing, borderRadius, typography } from '../../theme/colors';
import { CallApi } from '../../services/api';

interface VideoCallScreenProps {
  bookingId: string;
  vendorId: string;
  customerId: string;
  customerName: string;
  callId?: string;
  onBack?: () => void;
  onCallEnd?: () => void;
}

export function VideoCallScreen({
  bookingId,
  vendorId,
  customerId,
  customerName,
  callId,
  onBack,
  onCallEnd,
}: VideoCallScreenProps) {
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
      const response = await CallApi.initiateCall(bookingId, 'video', vendorId);
      currentCallId.current = response.callId;
      setCallStatus('ringing');
      
      // Simulate call connection (in production, use WebRTC)
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
      if (onCallEnd) {
        onCallEnd();
      }
    } catch (error: any) {
      console.error('Error ending call:', error);
    }
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.videoContainer}>
        {callStatus === 'connecting' || callStatus === 'ringing' ? (
          <View style={styles.connectingView}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.connectingText}>
              {callStatus === 'connecting' ? 'Connecting...' : 'Ringing...'}
            </Text>
            <Text style={styles.customerName}>{customerName}</Text>
          </View>
        ) : callStatus === 'active' ? (
          <View style={styles.videoView}>
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

      <View style={styles.callInfo}>
        <Text style={styles.callDuration}>{formatDuration(callDuration)}</Text>
        <Text style={styles.callStatus}>
          {callStatus === 'active' ? 'Connected' : callStatus === 'ringing' ? 'Ringing...' : 'Connecting...'}
        </Text>
      </View>

      {callStatus === 'active' && (
        <View style={styles.controls}>
          <TouchableOpacity
            style={[styles.controlButton, muted && styles.controlButtonActive]}
            onPress={() => setMuted(!muted)}
          >
            <Text style={styles.controlButtonText}>{muted ? '🔇' : '🎤'}</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.controlButton, videoOff && styles.controlButtonActive]}
            onPress={() => setVideoOff(!videoOff)}
          >
            <Text style={styles.controlButtonText}>{videoOff ? '📹' : '📹'}</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.controlButton, styles.endCallButton]}
            onPress={handleEndCall}
          >
            <Text style={styles.controlButtonText}>📞</Text>
          </TouchableOpacity>
        </View>
      )}

      {callStatus === 'ended' && onBack && (
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.black,
  },
  videoContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  connectingView: {
    alignItems: 'center',
  },
  connectingText: {
    fontSize: typography.fontSizes.lg,
    color: colors.white,
    marginTop: spacing.md,
  },
  customerName: {
    fontSize: typography.fontSizes.md,
    color: colors.textMuted,
    marginTop: spacing.sm,
  },
  videoView: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoPlaceholder: {
    width: '80%',
    aspectRatio: 16 / 9,
    backgroundColor: '#1a1a1a',
    borderRadius: borderRadius.xl,
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoPlaceholderText: {
    fontSize: 64,
    marginBottom: spacing.sm,
  },
  videoPlaceholderLabel: {
    fontSize: typography.fontSizes.md,
    color: colors.white,
  },
  videoOffOverlay: {
    position: 'absolute',
    top: spacing.md,
    left: spacing.md,
    backgroundColor: 'rgba(0,0,0,0.7)',
    padding: spacing.sm,
    borderRadius: borderRadius.md,
  },
  videoOffText: {
    color: colors.white,
    fontSize: typography.fontSizes.sm,
  },
  endedView: {
    alignItems: 'center',
  },
  endedText: {
    fontSize: typography.fontSizes.xl,
    color: colors.white,
  },
  callInfo: {
    padding: spacing.lg,
    alignItems: 'center',
  },
  callDuration: {
    fontSize: typography.fontSizes['2xl'],
    fontWeight: typography.fontWeights.bold,
    color: colors.white,
    marginBottom: spacing.xs,
  },
  callStatus: {
    fontSize: typography.fontSizes.md,
    color: colors.textMuted,
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'center',
    padding: spacing.lg,
    gap: spacing.md,
  },
  controlButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  controlButtonActive: {
    backgroundColor: colors.primary,
  },
  controlButtonText: {
    fontSize: 24,
  },
  endCallButton: {
    backgroundColor: colors.error,
  },
  backButton: {
    padding: spacing.lg,
    alignItems: 'center',
  },
  backButtonText: {
    fontSize: typography.fontSizes.md,
    color: colors.white,
  },
});

