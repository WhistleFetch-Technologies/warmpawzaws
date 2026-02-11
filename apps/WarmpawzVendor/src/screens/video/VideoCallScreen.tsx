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
import { WebView } from 'react-native-webview';
import { colors, spacing, borderRadius, typography } from '../../theme/colors';
import { vendorApiClient } from '../../lib/api-client';
import { VENDOR_WEB_BASE_URL } from '../../config/aws';

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

      // Best-effort: notify customer that vendor is ready
      vendorApiClient.notifyVideoCallReady(bookingId, 'vendor').catch((err) => {
        console.warn('notify-ready failed (vendor):', err?.message || err);
      });

      const params: string[] = [];
      if (vendorId) params.push(`vendorId=${encodeURIComponent(vendorId)}`);
      if (customerId) params.push(`customerId=${encodeURIComponent(customerId)}`);

      const query = params.length ? `?${params.join('&')}` : '';
      const url = `${VENDOR_WEB_BASE_URL.replace(/\\/$/, '')}/video/${bookingId}${query}`;
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
      await vendorApiClient.endVideoCall(bookingId);
      if (durationInterval.current) {
        clearInterval(durationInterval.current);
      }
      setCallStatus('ended');
      if (onCallEnd) {
        onCallEnd();
      }
    } catch (error: any) {
      console.error('Error ending call:', error);
      setCallStatus('ended');
      if (onCallEnd) onCallEnd();
    }
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
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
    fontSize: typography.fontSizes.lg,
    fontWeight: typography.fontWeights.bold,
  },
  callStatus: {
    color: colors.textMuted,
    fontSize: typography.fontSizes.sm,
    marginTop: 2,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  connectingText: {
    fontSize: typography.fontSizes.md,
    color: colors.white,
    marginTop: spacing.md,
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
    fontSize: typography.fontSizes.sm,
    fontWeight: typography.fontWeights.medium,
  },
});
