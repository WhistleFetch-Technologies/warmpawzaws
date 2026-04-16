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
import { BookingChatApi } from '../../services/api';
import { ChatScreen } from './ChatScreen';

const { height: WINDOW_H } = Dimensions.get('window');

type Row = {
  id?: string;
  booking_id?: string;
  participant_name?: string;
  booking_service?: string;
  last_message?: string;
  last_message_time?: string;
  unread_count?: number;
};

function formatRelative(iso?: string): string {
  if (!iso) return '';
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '';
  const diff = Date.now() - t;
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'Just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

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
  const [step, setStep] = useState<'list' | 'chat'>('list');
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [chatBookingId, setChatBookingId] = useState('');
  const [chatRecipient, setChatRecipient] = useState('');

  useEffect(() => {
    if (!visible) {
      setStep('list');
      setChatBookingId('');
      setChatRecipient('');
    }
  }, [visible]);

  const load = useCallback(async () => {
    const res: any = await BookingChatApi.getConversations({
      customerId,
      phone,
    });
    const list = res?.conversations;
    setRows(Array.isArray(list) ? list : []);
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

  const openThread = (item: Row) => {
    const bookingId = (item.booking_id || item.id || '').toString();
    if (!bookingId) return;
    setChatRecipient(item.participant_name || 'Provider');
    setChatBookingId(bookingId);
    setStep('chat');
  };

  const renderRow = ({ item }: { item: Row }) => (
    <TouchableOpacity style={styles.row} onPress={() => openThread(item)} activeOpacity={0.75}>
      <View style={styles.avatar}>
        <Icon name="account" size={22} color={colors.primary} />
      </View>
      <View style={styles.rowBody}>
        <View style={styles.rowTop}>
          <Text style={styles.rowTitle} numberOfLines={1}>
            {item.participant_name || 'Provider'}
          </Text>
          <Text style={styles.rowTime}>{formatRelative(item.last_message_time)}</Text>
        </View>
        <Text style={styles.rowService} numberOfLines={1}>
          {item.booking_service || 'Booking'}
        </Text>
        <Text style={styles.preview} numberOfLines={2}>
          {item.last_message || '—'}
        </Text>
      </View>
      {!!item.unread_count && item.unread_count > 0 ? (
        <View style={styles.unreadPill}>
          <Text style={styles.unreadText}>{item.unread_count}</Text>
        </View>
      ) : null}
    </TouchableOpacity>
  );

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
                  keyExtractor={(item, i) => String(item.booking_id || item.id || i)}
                  renderItem={renderRow}
                  style={styles.listFlex}
                  refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                  contentContainerStyle={rows.length === 0 ? styles.emptyContainer : styles.listPad}
                  ListEmptyComponent={
                    <View style={styles.empty}>
                      <Icon name="message-outline" size={48} color={colors.gray['300']} />
                      <Text style={styles.emptyTitle}>No conversations yet</Text>
                      <Text style={styles.emptySub}>
                        Message a provider from a booking. Threads appear here after the first message.
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
          ) : (
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
