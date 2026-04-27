/**
 * Vendor-style messages hub: list in a centered modal, then booking chat in the same modal.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  Modal,
  Pressable,
  Dimensions,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { colors, spacing, borderRadius, typography } from '../../theme/colors';
import { ChatScreen } from './ChatScreen';
import { SupportTicketThreadScreen } from '../support/SupportTicketThreadScreen';
import { formatInboxRelative, loadUnifiedInbox, SUPPORT_INBOX_LABEL, type UnifiedInboxRow } from './unifiedInbox';

const { height: WINDOW_H } = Dimensions.get('window');

interface CustomerMessagesModalProps {
  visible: boolean;
  onClose: () => void;
  phone: string;
  customerId?: string;
  customerDisplayName: string;
  senderId: string;
  onNavigate?: (screen: string, data?: any) => void;
}

export function CustomerMessagesModal({
  visible,
  onClose,
  phone,
  customerId,
  customerDisplayName,
  senderId,
  onNavigate,
}: CustomerMessagesModalProps) {
  const [step, setStep] = useState<'list' | 'chat' | 'support'>('list');
  const [rows, setRows] = useState<UnifiedInboxRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [chatBookingId, setChatBookingId] = useState('');
  const [chatRecipient, setChatRecipient] = useState('');
  const [supportTicketId, setSupportTicketId] = useState('');

  useEffect(() => {
    if (!visible) {
      setStep('list');
      setChatBookingId('');
      setChatRecipient('');
      setSupportTicketId('');
    }
  }, [visible]);

  const load = useCallback(async () => {
    const list = await loadUnifiedInbox({ customerId, phone });
    setRows(list);
  }, [customerId, phone]);

  useEffect(() => {
    if (!visible || step !== 'list') return;
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        await load();
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [visible, step, load]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  };

  const openThread = (item: UnifiedInboxRow) => {
    if (item.kind === 'support') {
      if (!item.ticketId) return;
      setSupportTicketId(item.ticketId);
      setStep('support');
      return;
    }
    const bookingId = item.bookingId;
    if (!bookingId) return;
    setChatRecipient(item.participant_name || 'Provider');
    setChatBookingId(bookingId);
    setStep('chat');
  };

  const renderRow = ({ item }: { item: UnifiedInboxRow }) => {
    const isSup = item.kind === 'support';
    const title = isSup ? SUPPORT_INBOX_LABEL : item.participant_name || 'Provider';
    const subline = isSup
      ? `${item.idSnippet} · ${item.subject}`
      : item.booking_service || 'Booking';
    const previewRaw = isSup
      ? item.last_message
      : item.last_message?.trim() ? item.last_message : '';
    const preview = previewRaw || (isSup ? 'Tap to view thread' : 'No messages yet — tap to chat');
    const tIso = item.last_message_time;
    const unread = !isSup && item.unread_count && item.unread_count > 0 ? item.unread_count : 0;
    return (
    <TouchableOpacity style={styles.row} onPress={() => openThread(item)} activeOpacity={0.75}>
      <View style={styles.avatar}>
        <Icon name={isSup ? 'headset' : 'account'} size={22} color={colors.primary} />
      </View>
      <View style={styles.rowBody}>
        <View style={styles.rowTop}>
          <Text style={styles.rowTitle} numberOfLines={1}>
            {title}
          </Text>
          <Text style={styles.rowTime}>{formatInboxRelative(tIso)}</Text>
        </View>
        <Text style={styles.rowService} numberOfLines={1}>
          {subline}
        </Text>
        <Text style={styles.preview} numberOfLines={2}>
          {preview}
        </Text>
      </View>
      {unread > 0 ? (
        <View style={styles.unreadPill}>
          <Text style={styles.unreadText}>{unread}</Text>
        </View>
      ) : null}
    </TouchableOpacity>
  );
  };

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.sheet} pointerEvents="box-none">
          {step === 'list' ? (
            <View style={styles.sheetInner}>
              <View style={styles.listHeader}>
                <View style={{ marginRight: spacing.sm }}>
                  <Icon name="message-text" size={22} color={colors.primary} />
                </View>
                <Text style={styles.listTitle}>Messages</Text>
                <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={12}>
                  <Icon name="close" size={26} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>
              {loading ? (
                <View style={styles.center}>
                  <ActivityIndicator size="large" color={colors.primary} />
                </View>
              ) : (
                <FlatList
                  data={rows}
                  keyExtractor={(item) => item.listKey}
                  renderItem={renderRow}
                  style={styles.listFlex}
                  refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                  contentContainerStyle={rows.length === 0 ? styles.emptyContainer : styles.listPad}
                  ListEmptyComponent={
                    <View style={styles.empty}>
                      <Icon name="message-outline" size={48} color={colors.gray['300']} />
                      <Text style={styles.emptyTitle}>No conversations yet</Text>
                      <Text style={styles.emptySub}>
                        Active booking chats and your support requests appear here. You can also open a thread from
                        My bookings or Help and Support.
                      </Text>
                      {onNavigate ? (
                        <TouchableOpacity
                          style={styles.cta}
                          onPress={() => {
                            onClose();
                            onNavigate('BookingList');
                          }}
                        >
                          <Text style={styles.ctaText}>My bookings</Text>
                        </TouchableOpacity>
                      ) : null}
                    </View>
                  }
                />
              )}
            </View>
          ) : step === 'chat' ? (
            <View style={styles.chatWrap}>
              <ChatScreen
                key={chatBookingId}
                embedded
                bookingId={chatBookingId}
                senderId={senderId}
                recipientName={chatRecipient}
                phone={phone}
                customerName={customerDisplayName}
                supportChat={false}
                onDismissModal={onClose}
                onBack={() => {
                  setStep('list');
                  void load();
                }}
              />
            </View>
          ) : (
            <View style={styles.chatWrap}>
              <SupportTicketThreadScreen
                key={supportTicketId}
                ticketId={supportTicketId}
                customerId={customerId}
                onBack={() => {
                  setStep('list');
                  setSupportTicketId('');
                  void load();
                }}
              />
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const SHEET_MAX = Math.min(WINDOW_H * 0.88, 640);

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
  },
  sheet: {
    width: '100%',
    maxWidth: 400,
    height: SHEET_MAX,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.white,
    overflow: 'hidden',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  sheetInner: {
    flex: 1,
    minHeight: 280,
  },
  listHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  listTitle: {
    flex: 1,
    fontSize: typography.fontSizes.lg,
    fontWeight: typography.fontWeights.bold,
    color: colors.text,
  },
  closeBtn: {
    padding: spacing.xs,
  },
  center: {
    paddingVertical: spacing.xl * 2,
    alignItems: 'center',
  },
  listFlex: {
    flex: 1,
  },
  listPad: {
    padding: spacing.md,
    paddingBottom: spacing.xl,
  },
  emptyContainer: {
    flexGrow: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: `${colors.primary}18`,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  rowBody: {
    flex: 1,
    minWidth: 0,
  },
  rowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  rowTitle: {
    flex: 1,
    fontSize: typography.fontSizes.md,
    fontWeight: typography.fontWeights.bold,
    color: colors.text,
    marginRight: spacing.sm,
  },
  rowTime: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  rowService: {
    fontSize: typography.fontSizes.sm,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  preview: {
    fontSize: typography.fontSizes.sm,
    color: colors.text,
  },
  unreadPill: {
    marginLeft: spacing.xs,
    backgroundColor: colors.primary,
    borderRadius: 12,
    minWidth: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  unreadText: {
    color: colors.white,
    fontSize: 11,
    fontWeight: typography.fontWeights.bold,
  },
  empty: {
    padding: spacing.xl,
    alignItems: 'center',
    paddingTop: spacing.xl * 2,
  },
  emptyTitle: {
    marginTop: spacing.md,
    fontSize: typography.fontSizes.md,
    fontWeight: typography.fontWeights.bold,
    color: colors.text,
  },
  emptySub: {
    marginTop: spacing.sm,
    textAlign: 'center',
    color: colors.textSecondary,
    fontSize: typography.fontSizes.sm,
    lineHeight: 20,
  },
  cta: {
    marginTop: spacing.lg,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
  },
  ctaText: {
    color: colors.white,
    fontWeight: typography.fontWeights.bold,
  },
  chatWrap: {
    flex: 1,
    minHeight: 360,
  },
});
