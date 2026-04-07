/**
 * Video Call Screen
 * Loads vendor-web Chime UI in WebView; native camera upload for chat attachments.
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
  Platform,
  PermissionsAndroid,
} from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, spacing, borderRadius, typography } from '../../theme/colors';
import { vendorApiClient } from '../../lib/api-client';
import { VENDOR_WEB_BASE_URL } from '../../config/aws';

const UPLOAD_API_BASE = __DEV__ ? 'https://dev.api.warmpawz.com' : 'https://api.warmpawz.com';

const AUTH_TOKEN_KEY = '@warmpawz_vendor_auth_token';
/** Same slot as web Chime UI: 15-minute countdown from session start. */
const CALL_SLOT_SECONDS = 15 * 60;

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
  onBack,
  onCallEnd,
}: VideoCallScreenProps) {
  const [callStatus, setCallStatus] = useState<'connecting' | 'active' | 'ended'>('connecting');
  const [remainingSeconds, setRemainingSeconds] = useState(CALL_SLOT_SECONDS);
  const [loading, setLoading] = useState(false);
  const [webUrl, setWebUrl] = useState<string>('');
  const webRef = useRef<WebView>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const endCallRef = useRef<() => Promise<void>>(async () => {});

  const formatCountdown = (sec: number): string => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const clearTick = () => {
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
  };

  const startCountdown = () => {
    if (tickRef.current) return;
    tickRef.current = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          clearTick();
          Alert.alert('Time limit', 'The 15-minute consultation slot has ended.');
          void endCallRef.current();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const requestMediaPermissions = async () => {
    if (Platform.OS === 'android') {
      try {
        await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.CAMERA,
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
        ]);
      } catch {
        // non-fatal
      }
    }
    await ImagePicker.requestCameraPermissionsAsync();
    await ImagePicker.requestMediaLibraryPermissionsAsync();
  };

  useEffect(() => {
    void requestMediaPermissions();
  }, []);

  useEffect(() => {
    void openWebVideoCall();
    return () => {
      clearTick();
    };
  }, []);

  const openWebVideoCall = async () => {
    try {
      setLoading(true);
      setCallStatus('connecting');
      setRemainingSeconds(CALL_SLOT_SECONDS);

      vendorApiClient.notifyVideoCallReady(bookingId, 'vendor').catch((err) => {
        console.warn('notify-ready failed (vendor):', err?.message || err);
      });

      const base = VENDOR_WEB_BASE_URL.replace(/\/$/, '');
      const url = `${base}/video/${bookingId}`;
      setWebUrl(url);

      setCallStatus('active');
      startCountdown();
    } catch (error: any) {
      console.error('Error opening video call:', error);
      Alert.alert('Error', error.message || 'Failed to open video call');
      setCallStatus('ended');
    } finally {
      setLoading(false);
    }
  };

  const handleNativeChatUpload = async () => {
    try {
      const cam = await ImagePicker.requestCameraPermissionsAsync();
      if (!cam.granted) {
        Alert.alert('Permission needed', 'Camera access is required to take a photo.');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.85,
      });
      if (result.canceled || !result.assets?.[0]?.uri) return;

      const token = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
      if (!token) {
        Alert.alert('Session', 'Please sign in again.');
        return;
      }

      const uri = result.assets[0].uri;
      const formData = new FormData();
      formData.append('file', {
        uri,
        name: 'chat-photo.jpg',
        type: 'image/jpeg',
      } as unknown as Blob);
      formData.append('bookingId', bookingId);
      formData.append('senderPhone', 'vendor-app');
      formData.append('senderName', 'Vendor');
      formData.append('senderType', 'vendor');

      const res = await fetch(`${UPLOAD_API_BASE}/chat/upload-file`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (!res.ok) {
        throw new Error('Upload failed');
      }
      const json = await res.json();
      const fileUrl = json.fileUrl || json.file_url;
      const messageId = json.message?.id || `file-${Date.now()}`;
      if (!fileUrl) throw new Error('No file URL in response');

      const inner = JSON.stringify({
        fileUrl,
        fileName: 'Photo',
        messageType: 'image',
        messageId,
      });
      webRef.current?.injectJavaScript(
        `try{window.__warmpawzDeliverChatUpload&&window.__warmpawzDeliverChatUpload(JSON.parse(${JSON.stringify(inner)}));}catch(e){}true;`
      );
    } catch (e: any) {
      console.warn('native chat upload', e);
      Alert.alert('Upload failed', e?.message || 'Could not send photo');
    }
  };

  const onWebMessage = (event: WebViewMessageEvent) => {
    try {
      const raw = event.nativeEvent.data;
      const data = JSON.parse(raw);
      if (data?.type === 'WARMPAWZ_PICK_CHAT_FILE') {
        void handleNativeChatUpload();
      }
    } catch {
      // ignore non-JSON
    }
  };

  const handleEndCall = async () => {
    try {
      clearTick();
      await vendorApiClient.endVideoCall(bookingId);
      setCallStatus('ended');
      onCallEnd?.();
    } catch (error: any) {
      console.error('Error ending call:', error);
      setCallStatus('ended');
      onCallEnd?.();
    }
  };

  endCallRef.current = handleEndCall;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={handleEndCall} style={styles.endCallButton}>
          <Text style={styles.endCallButtonText}>End Call</Text>
        </TouchableOpacity>
        <View style={styles.callInfo}>
          <Text style={styles.callDuration}>{formatCountdown(remainingSeconds)}</Text>
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
          ref={webRef}
          source={{ uri: webUrl }}
          originWhitelist={['*']}
          javaScriptEnabled
          domStorageEnabled
          allowsInlineMediaPlayback
          allowsFullscreenVideo
          mediaPlaybackRequiresUserAction={false}
          mixedContentMode="always"
          startInLoadingState
          onMessage={onWebMessage}
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
    flexWrap: 'wrap',
    gap: 8,
  },
  backBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  backText: {
    color: colors.textMuted,
    fontSize: typography.fontSizes.sm,
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
