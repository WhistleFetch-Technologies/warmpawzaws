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
import { WebView } from 'react-native-webview';
import { colors, spacing, borderRadius } from '../../theme/colors';
import { apiClient } from '../../lib/api-client';
import { CUSTOMER_WEB_BASE_URL } from '../../config/aws';

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
  const [callStatus, setCallStatus] = useState<'connecting' | 'active' | 'ended'>('connecting');
  const [callDuration, setCallDuration] = useState(0);
  const [loading, setLoading] = useState(false);
  const [webUrl, setWebUrl] = useState<string>('');
  const durationInterval = useRef<any>(null);

  useEffect(() => {
    openWebVideoCall();
    return () => {
      if (durationInterval.current) {
        clearInterval(durationInterval.current);
      }
    };
  }, []);

  /** Open the web video call (uses full Chime SDK in web) */
  const openWebVideoCall = async () => {
    try {
      setLoading(true);
      setCallStatus('connecting');

      const participantId = customerId || phone;

      // Best-effort: notify vendor that customer is ready
      apiClient.notifyVideoCallReady(bookingId, 'customer').catch((err) => {
        console.warn('notify-ready failed (customer):', err?.message || err);
      });
      const params: string[] = [];
      if (customerId) params.push(`customerId=${encodeURIComponent(customerId)}`);
      if (phone) params.push(`customerPhone=${encodeURIComponent(phone)}`);
      if (participantId) params.push(`participantId=${encodeURIComponent(participantId)}`);

      const query = params.length ? `?${params.join('&')}` : '';
      const url = `${CUSTOMER_WEB_BASE_URL.replace(/\\/$/, '')}/video/${bookingId}${query}`;
      setWebUrl(url);

      setCallStatus('active');
      startCallTimer();
    } catch (error: any) {
      console.error('Error opening video call:', error);
      Alert.alert('Error', error.message || 'Failed to open video call');
      setCallStatus('ended');
    } finally {
      setLoading(false);
    }
  };

  const startCallTimer = () => {
    durationInterval.current = setInterval(() => {
      setCallDuration(prev => prev + 1);
    }, 1000);
  };

  const handleEndCall = async () => {
    try {
      await apiClient.endVideoCall(bookingId);
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
      <View style={styles.header}>
        <TouchableOpacity onPress={handleEndCall} style={styles.endCallButton}>
          <Text style={styles.endCallButtonText}>End Call</Text>
        </TouchableOpacity>
        <View style={styles.callInfo}>
          <Text style={styles.callDuration}>{formatDuration(callDuration)}</Text>
          <Text style={styles.callStatus}>
            {callStatus === 'active' ? 'Connected' : 'Connecting...'}
          </Text>
        </View>
      </View>

      {loading || !webUrl ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.connectingText}>Preparing video call...</Text>
        </View>
      ) : (
        <WebView
          source={{ uri: webUrl }}
          originWhitelist={['*']}
          javaScriptEnabled
          domStorageEnabled
          allowsInlineMediaPlayback
          allowsFullscreenVideo
          mediaPlaybackRequiresUserAction={false}
          mixedContentMode="always"
          startInLoadingState
          renderLoading={() => (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.connectingText}>Loading call...</Text>
            </View>
          )}
          onError={() => {
            setCallStatus('ended');
            Alert.alert('Error', 'Failed to load video call');
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.black,
  },
  header: {
    padding: spacing.md,
    backgroundColor: colors.black,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  callInfo: {
    alignItems: 'flex-end',
  },
  callDuration: {
    color: colors.white,
    fontSize: 16,
    fontWeight: 'bold',
  },
  callStatus: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  connectingText: {
    marginTop: spacing.md,
    fontSize: 16,
    color: colors.white,
  },
  endCallButton: {
    backgroundColor: colors.error,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  endCallButtonText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '600',
  },
});
