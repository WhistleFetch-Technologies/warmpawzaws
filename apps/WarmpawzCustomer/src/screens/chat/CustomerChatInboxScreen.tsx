/**
 * Lists booking chats that already have messages (GET /chat/conversations).
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
import { BookingChatApi } from '../../services/api';

interface Row {
  id?: string;
  booking_id?: string;
  participant_name?: string;
  booking_service?: string;
  last_message?: string;
  last_message_time?: string;
  unread_count?: number;
}

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
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const res: any = await BookingChatApi.getConversations({
      customerId,
      phone,
    });
    const list = res?.conversations;
    setRows(Array.isArray(list) ? list : []);
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

  const openThread = (item: Row) => {
    const bookingId = item.booking_id || item.id;
    if (!bookingId || !onNavigate) return;
    onNavigate('Chat', {
      bookingId,
      recipientName: item.participant_name || 'Provider',
    });
  };

  const renderItem = ({ item }: { item: Row }) => (
    <TouchableOpacity style={styles.row} onPress={() => openThread(item)} activeOpacity={0.7}>
      <View style={styles.rowIcon}>
        <Icon name="message-text-outline" size={24} color={colors.primary} />
      </View>
      <View style={styles.rowBody}>
        <View style={styles.rowTop}>
          <Text style={styles.rowTitle} numberOfLines={1}>
            {item.participant_name || 'Provider'}
          </Text>
          {!!item.unread_count && item.unread_count > 0 ? (
            <View style={styles.unreadPill}>
              <Text style={styles.unreadText}>{item.unread_count}</Text>
            </View>
          ) : null}
        </View>
        <Text style={styles.rowService} numberOfLines={1}>
          {item.booking_service || 'Booking'}
        </Text>
        <Text style={styles.rowPreview} numberOfLines={2}>
          {item.last_message || '—'}
        </Text>
      </View>
      <Icon name="chevron-right" size={22} color={colors.textSecondary} />
    </TouchableOpacity>
  );

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
          keyExtractor={(item, index) => String(item.booking_id || item.id || index)}
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
                After you message a provider from a booking, it will appear here.
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
  unreadPill: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.full,
    minWidth: 22,
    height: 22,
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
