/**
 * Chat Screen - Mobile
 * - Vendor booking chat: Lambda `/chat/booking/...` (same thread as vendor app)
 * - Support chat: existing `/dating/chat/...` when `type === 'support'`
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Image,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { ScreenShell } from '../../components/layout/ScreenShell';
import { colors, spacing, borderRadius } from '../../theme/colors';
import { DatingChatApi, BookingChatApi } from '../../services/api';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(id: string | undefined): boolean {
  return !!id && UUID_RE.test(id);
}

function digitsOnly(phone: string): string {
  return (phone || '').replace(/\D/g, '');
}

interface ChatScreenProps {
  bookingId: string;
  matchId?: string;
  senderId: string;
  recipientName?: string;
  recipientAvatar?: string;
  phone: string;
  customerName?: string;
  /** When true, use dating/support chat APIs with `matchId` */
  supportChat?: boolean;
  /** Render inside a modal (no ScreenShell); vendor-style orange header when booking chat */
  embedded?: boolean;
  /** Full dismiss (e.g. close messages modal from chat view) */
  onDismissModal?: () => void;
  onBack: () => void;
  onNavigate?: (screen: string, data?: any) => void;
}

interface UiMessage {
  id: string;
  body: string;
  timestamp: string;
  isOwn: boolean;
  senderLabel?: string;
}

export function ChatScreen({
  bookingId,
  matchId,
  senderId,
  recipientName = 'Support',
  recipientAvatar,
  phone,
  customerName = 'Customer',
  supportChat = false,
  embedded = false,
  onDismissModal,
  onBack,
}: ChatScreenProps) {
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [chatAvailable, setChatAvailable] = useState(true);
  const [headerName, setHeaderName] = useState(recipientName);
  const flatListRef = useRef<FlatList>(null);

  const supportMode = supportChat || (!!matchId && !isUuid(bookingId));
  const bookingMode = !supportMode && isUuid(bookingId);
  const chatMatchId =
    matchId || (supportMode ? `customer-support-${digitsOnly(phone) || 'guest'}` : '');

  const scrollToEnd = () => {
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 80);
  };

  const mapBookingRows = useCallback(
    (rows: any[]): UiMessage[] => {
      const myPhone = digitsOnly(phone);
      return (rows || []).map((m: any) => {
        const senderType = (m.sender_type || '').toLowerCase();
        const senderPhone = digitsOnly(m.sender_phone || '');
        const isOwn =
          senderType === 'customer' ||
          (!!myPhone && senderPhone === myPhone && senderPhone.length > 0);
        const ts = m.created_at || m.timestamp || new Date().toISOString();
        const body = m.message ?? m.content ?? '';
        return {
          id: String(m.id || `${ts}-${Math.random()}`),
          body,
          timestamp: ts,
          isOwn,
          senderLabel: !isOwn ? m.sender_name || 'Provider' : undefined,
        };
      });
    },
    [phone]
  );

  const loadBookingThread = useCallback(async (): Promise<boolean> => {
    if (!bookingId) return false;
    try {
      const res: any = await BookingChatApi.getConversation(bookingId);
      if (res?.booking?.vendorName) {
        setHeaderName(res.booking.vendorName);
      } else if (recipientName) {
        setHeaderName(recipientName);
      }
      if (typeof res?.chatAvailable === 'boolean') {
        setChatAvailable(res.chatAvailable);
      }
      setMessages(mapBookingRows(res?.messages || []));
      return true;
    } catch (e) {
      console.error('Error loading booking chat:', e);
      return false;
    }
  }, [bookingId, recipientName, mapBookingRows]);

  const loadSupportThread = useCallback(async () => {
    try {
      setHeaderName(recipientName);
      const response = await DatingChatApi.getMessages(chatMatchId, 50, 0);
      const raw = response.messages || [];
      const mapped: UiMessage[] = raw.map((item: any) => ({
        id: String(item.id || item.messageId || Date.now()),
        body: item.message || item.text || '',
        timestamp: item.timestamp || item.created_at || new Date().toISOString(),
        isOwn: item.senderId === senderId,
      }));
      setMessages(mapped);
    } catch (error) {
      console.error('Error loading support messages:', error);
    }
  }, [chatMatchId, recipientName, senderId]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    const run = async () => {
      if (bookingMode) {
        const ok = await loadBookingThread();
        if (cancelled) return;
        if (!ok) {
          Alert.alert('Error', 'Could not load messages for this booking.');
        }
        if (!cancelled) setLoading(false);
        BookingChatApi.markConversationRead(bookingId).catch(() => {});
        return;
      }

      if (supportMode && chatMatchId) {
        try {
          await loadSupportThread();
        } catch (error) {
          console.error('Error loading support messages:', error);
        } finally {
          if (!cancelled) setLoading(false);
        }
        return;
      }

      if (!cancelled) setLoading(false);
      if (!supportMode) {
        Alert.alert('Chat', 'Invalid booking. Open chat from a confirmed booking.', [
          { text: 'OK', onPress: () => onBack() },
        ]);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
    // onBack omitted from deps (stable enough for alert dismiss)
  }, [
    bookingId,
    matchId,
    supportChat,
    phone,
    senderId,
    recipientName,
    bookingMode,
    supportMode,
    chatMatchId,
    loadBookingThread,
    loadSupportThread,
  ]);

  useEffect(() => {
    if (!bookingMode || !chatAvailable) return;
    const t = setInterval(() => {
      void loadBookingThread().catch(() => {});
    }, 5000);
    return () => clearInterval(t);
  }, [bookingMode, chatAvailable, loadBookingThread]);

  const sendBookingMessage = async () => {
    if (!inputText.trim() || !bookingId) return;
    const senderPhone = digitsOnly(phone) || phone;
    if (!senderPhone) {
      Alert.alert('Chat', 'Phone number is required to send a message.');
      return;
    }
    const messageText = inputText.trim();
    setInputText('');
    setSending(true);
    try {
      await BookingChatApi.sendMessage(bookingId, {
        senderPhone,
        senderName: customerName,
        senderType: 'customer',
        message: messageText,
        messageType: 'text',
      });
      await loadBookingThread();
      scrollToEnd();
    } catch (error) {
      console.error('Error sending booking message:', error);
      setInputText(messageText);
      Alert.alert('Error', 'Failed to send message.');
    } finally {
      setSending(false);
    }
  };

  const sendSupportMessage = async () => {
    if (!inputText.trim() || !chatMatchId) return;
    const messageText = inputText.trim();
    setInputText('');
    setSending(true);
    try {
      await DatingChatApi.sendMessage(chatMatchId, senderId, messageText);
      await loadSupportThread();
      scrollToEnd();
    } catch (error) {
      console.error('Error sending support message:', error);
      setInputText(messageText);
    } finally {
      setSending(false);
    }
  };

  const sendMessage = () => {
    if (bookingMode) return sendBookingMessage();
    if (supportMode) return sendSupportMessage();
  };

  const renderMessage = ({ item }: { item: UiMessage }) => (
    <View
      style={[
        styles.messageContainer,
        item.isOwn ? styles.messageOwn : styles.messageOther,
      ]}
    >
      {!item.isOwn && recipientAvatar && (
        <Image source={{ uri: recipientAvatar }} style={styles.avatar} />
      )}
      <View
        style={[
          styles.messageBubble,
          item.isOwn ? styles.messageBubbleOwn : styles.messageBubbleOther,
        ]}
      >
        {!item.isOwn && item.senderLabel ? (
          <Text style={styles.senderLabel}>{item.senderLabel}</Text>
        ) : null}
        <Text
          style={[
            styles.messageText,
            item.isOwn ? styles.messageTextOwn : styles.messageTextOther,
          ]}
        >
          {item.body}
        </Text>
        <Text
          style={[
            styles.messageTime,
            item.isOwn ? styles.messageTimeOwn : styles.messageTimeOther,
          ]}
        >
          {new Date(item.timestamp).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </Text>
      </View>
    </View>
  );

  const inputDisabled =
    sending ||
    (bookingMode && !chatAvailable) ||
    (!bookingMode && !supportMode);

  const vendorStyleHeader = embedded && bookingMode;
  const headerStyles = [
    styles.header,
    vendorStyleHeader && styles.embeddedHeader,
  ];
  const backLabel = embedded ? '←' : '← Back';

  const inner = (
    <>
      <View style={headerStyles}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Text
            style={[
              styles.backButtonText,
              vendorStyleHeader && styles.embeddedHeaderLightText,
            ]}
          >
            {backLabel}
          </Text>
        </TouchableOpacity>
        {recipientAvatar && (
          <Image source={{ uri: recipientAvatar }} style={styles.headerAvatar} />
        )}
        <View style={styles.headerInfo}>
          <Text
            style={[styles.headerName, vendorStyleHeader && styles.embeddedHeaderTitle]}
            numberOfLines={1}
          >
            {headerName}
          </Text>
          <Text
            style={[styles.headerStatus, vendorStyleHeader && styles.embeddedHeaderSub]}
            numberOfLines={1}
          >
            {bookingMode ? (chatAvailable ? 'Chat with provider' : 'Chat closed') : 'Online'}
          </Text>
        </View>
        {embedded && onDismissModal ? (
          <TouchableOpacity onPress={onDismissModal} style={styles.headerCloseBtn} hitSlop={10}>
            <Text style={styles.headerCloseText}>✕</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.placeholder} />
        )}
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <KeyboardAvoidingView
          style={styles.chatContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={embedded ? 24 : 90}
        >
          {bookingMode && !chatAvailable ? (
            <View style={styles.closedBanner}>
              <Text style={styles.closedBannerText}>
                Chat is not available for this booking (cancelled or outside the allowed
                time after completion).
              </Text>
            </View>
          ) : null}

          <FlatList
            ref={flatListRef}
            data={messages}
            renderItem={renderMessage}
            keyExtractor={(item) => item.id}
            style={styles.messagesList}
            contentContainerStyle={styles.messagesContent}
            onContentSizeChange={scrollToEnd}
          />

          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              placeholder="Type a message..."
              placeholderTextColor={colors.textSecondary}
              value={inputText}
              onChangeText={setInputText}
              multiline
              maxLength={500}
              editable={!inputDisabled}
            />
            <TouchableOpacity
              style={[
                styles.sendButton,
                (!inputText.trim() || inputDisabled) && styles.sendButtonDisabled,
              ]}
              onPress={sendMessage}
              disabled={!inputText.trim() || inputDisabled}
            >
              <Text style={styles.sendButtonText}>Send</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      )}
    </>
  );

  if (embedded) {
    return <View style={[styles.container, styles.embeddedRoot]}>{inner}</View>;
  }

  return <ScreenShell style={styles.container}>{inner}</ScreenShell>;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  embeddedRoot: {
    borderTopLeftRadius: borderRadius.lg,
    borderTopRightRadius: borderRadius.lg,
    overflow: 'hidden',
  },
  embeddedHeader: {
    backgroundColor: colors.primary,
    borderBottomWidth: 0,
    paddingVertical: spacing.md,
    borderTopLeftRadius: borderRadius.lg,
    borderTopRightRadius: borderRadius.lg,
  },
  embeddedHeaderLightText: {
    color: colors.white,
  },
  embeddedHeaderTitle: {
    color: colors.white,
  },
  embeddedHeaderSub: {
    color: 'rgba(255,255,255,0.88)',
  },
  headerCloseBtn: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    justifyContent: 'center',
  },
  headerCloseText: {
    color: colors.white,
    fontSize: 20,
    fontWeight: '300',
  },
  loadingWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closedBanner: {
    backgroundColor: colors.gray['100'],
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  closedBannerText: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    padding: spacing.xs,
  },
  backButtonText: {
    fontSize: 16,
    color: colors.primary,
    fontWeight: '600',
  },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginLeft: spacing.sm,
    marginRight: spacing.sm,
  },
  headerInfo: {
    flex: 1,
  },
  headerName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  headerStatus: {
    fontSize: 12,
    color: '#16a34a',
  },
  placeholder: {
    width: 60,
  },
  chatContainer: {
    flex: 1,
  },
  messagesList: {
    flex: 1,
  },
  messagesContent: {
    padding: spacing.md,
  },
  messageContainer: {
    flexDirection: 'row',
    marginBottom: spacing.sm,
    alignItems: 'flex-end',
  },
  messageOwn: {
    justifyContent: 'flex-end',
  },
  messageOther: {
    justifyContent: 'flex-start',
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: spacing.xs,
  },
  senderLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  messageBubble: {
    maxWidth: '75%',
    padding: spacing.sm,
    borderRadius: borderRadius.md,
  },
  messageBubbleOwn: {
    backgroundColor: colors.primary,
    borderBottomRightRadius: borderRadius.xs,
  },
  messageBubbleOther: {
    backgroundColor: colors.gray['200'],
    borderBottomLeftRadius: borderRadius.xs,
  },
  messageText: {
    fontSize: 14,
    marginBottom: spacing.xs,
  },
  messageTextOwn: {
    color: colors.white,
  },
  messageTextOther: {
    color: colors.text,
  },
  messageTime: {
    fontSize: 10,
    alignSelf: 'flex-end',
  },
  messageTimeOwn: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  messageTimeOther: {
    color: colors.textSecondary,
  },
  inputContainer: {
    flexDirection: 'row',
    padding: spacing.md,
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    alignItems: 'flex-end',
  },
  input: {
    flex: 1,
    backgroundColor: colors.gray['100'],
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    fontSize: 14,
    color: colors.text,
    maxHeight: 100,
    marginRight: spacing.sm,
  },
  sendButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
  },
  sendButtonDisabled: {
    backgroundColor: colors.gray['400'],
  },
  sendButtonText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '600',
  },
});
