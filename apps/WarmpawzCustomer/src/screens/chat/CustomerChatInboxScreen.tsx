/**
 * Unified inbox: provider booking chats (GET /chat/conversations) + support tickets (GET /support/tickets).
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
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { OrangeBrandedScreenLayout } from '../../components/layout/OrangeBrandedScreenLayout';
import { colors, spacing, borderRadius, typography } from '../../theme/colors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  formatInboxRelative,
  loadUnifiedInbox,
  SUPPORT_INBOX_LABEL,
  type UnifiedInboxRow,
} from './unifiedInbox';

interface CustomerChatInboxScreenProps {
  phone: string;
  customerId?: string;
  onBack: () => void;
  onNavigate?: (screen: string, data?: any) => void;
}

export function CustomerChatInboxScreen({
  phone,
  customerId,
  onBack,
  onNavigate,
}: CustomerChatInboxScreenProps) {
  const insets = useSafeAreaInsets();
  const [rows, setRows] = useState<UnifiedInboxRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const list = await loadUnifiedInbox({ customerId, phone });
    setRows(list);
  }, [customerId, phone]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        await load();
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  };

  const openThread = (item: UnifiedInboxRow) => {
    if (!onNavigate) return;
    if (item.kind === 'support') {
      onNavigate('SupportTicketThread', { ticketId: item.ticketId });
      return;
    }
    onNavigate('Chat', {
      bookingId: item.bookingId,
      recipientName: item.participant_name || 'Provider',
    });
  };

  const renderItem = ({ item }: { item: UnifiedInboxRow }) => {
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
      <TouchableOpacity style={styles.row} onPress={() => openThread(item)} activeOpacity={0.7}>
        <View style={styles.rowIcon}>
          <Icon name={isSup ? 'headset' : 'message-text-outline'} size={24} color={colors.primary} />
        </View>
        <View style={styles.rowBody}>
          <View style={styles.rowTop}>
            <Text style={styles.rowTitle} numberOfLines={1}>
              {title}
            </Text>
            {tIso ? <Text style={styles.rowTimeRight}>{formatInboxRelative(tIso)}</Text> : null}
          </View>
          <Text style={styles.rowService} numberOfLines={1}>
            {subline}
          </Text>
          <Text style={styles.rowPreview} numberOfLines={2}>
            {preview}
          </Text>
        </View>
        {unread > 0 ? (
          <View style={styles.unreadPill}>
            <Text style={styles.unreadText}>{unread}</Text>
          </View>
        ) : null}
        <Icon name="chevron-right" size={22} color={colors.textSecondary} />
      </TouchableOpacity>
    );
  };

  const listBottomPad = Math.max(insets.bottom, spacing.xl);

  return (
    <OrangeBrandedScreenLayout
      title="Messages"
      onBack={onBack}
      bodyBackgroundColor={colors.backgroundSecondary}
      padBodyBottomInset={false}
    >
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          style={styles.listFlex}
          data={rows}
          keyExtractor={(item) => item.listKey}
          renderItem={renderItem}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          contentContainerStyle={
            rows.length === 0
              ? [styles.emptyList, { paddingBottom: listBottomPad }]
              : [styles.listPad, { paddingBottom: listBottomPad }]
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Icon name="message-outline" size={48} color={colors.textSecondary} />
              <Text style={styles.emptyTitle}>No conversations yet</Text>
              <Text style={styles.emptySub}>
                Active booking chats and your support requests appear here. You can also start from My bookings or Help
                and Support.
              </Text>
              <TouchableOpacity
                style={styles.emptyCta}
                onPress={() => onNavigate && onNavigate('BookingList')}
              >
                <Text style={styles.emptyCtaText}>My bookings</Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}
    </OrangeBrandedScreenLayout>
  );
}

const styles = StyleSheet.create({
  listFlex: {
    flex: 1,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listPad: {
    padding: spacing.md,
  },
  emptyList: {
    flexGrow: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rowIcon: {
    marginRight: spacing.md,
  },
  rowBody: {
    flex: 1,
    minWidth: 0,
  },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  rowTitle: {
    flex: 1,
    fontSize: typography.fontSizes.md,
    fontWeight: typography.fontWeights.bold,
    color: colors.text,
    marginRight: spacing.sm,
  },
  rowTimeRight: {
    fontSize: 11,
    color: colors.textSecondary,
    marginLeft: spacing.xs,
  },
  unreadPill: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.full,
    minWidth: 22,
    height: 22,
    marginRight: spacing.xs,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadText: {
    color: colors.white,
    fontSize: 11,
    fontWeight: typography.fontWeights.bold,
  },
  rowService: {
    fontSize: typography.fontSizes.sm,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  rowPreview: {
    fontSize: typography.fontSizes.sm,
    color: colors.text,
  },
  empty: {
    flex: 1,
    padding: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 48,
  },
  emptyTitle: {
    marginTop: spacing.md,
    fontSize: typography.fontSizes.lg,
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
  emptyCta: {
    marginTop: spacing.lg,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
  },
  emptyCtaText: {
    color: colors.white,
    fontWeight: typography.fontWeights.bold,
    fontSize: typography.fontSizes.md,
  },
});
