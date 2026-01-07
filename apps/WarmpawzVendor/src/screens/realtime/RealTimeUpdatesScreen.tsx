/**
 * Real-Time Updates Screen
 * Live updates and notifications
 * Batch 2 - Screen 8
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { colors, spacing, borderRadius, typography } from '../../theme/colors';
import { RealTimeUpdatesApi } from '../../services/api';

interface RealTimeUpdatesScreenProps {
  vendorId: string;
  onBack?: () => void;
  onUpdateTap?: (update: any) => void;
}

interface Update {
  id: string;
  type: string;
  title: string;
  message: string;
  timestamp: string;
  data?: any;
}

export function RealTimeUpdatesScreen({
  vendorId,
  onBack,
  onUpdateTap,
}: RealTimeUpdatesScreenProps) {
  const [updates, setUpdates] = useState<Update[]>([]);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    // ✅ API Integration: Load initial updates via HTTP
    loadInitialUpdates();
    // Then connect WebSocket for real-time updates
    connectWebSocket();
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [vendorId]);

  const loadInitialUpdates = async () => {
    try {
      setLoading(true);
      const response = await RealTimeUpdatesApi.getRealTimeUpdates(vendorId);
      if (response.updates && Array.isArray(response.updates)) {
        setUpdates(response.updates);
      }
    } catch (error) {
      console.error('Error loading initial updates:', error);
      // Continue with WebSocket connection even if HTTP fails
    } finally {
      setLoading(false);
    }
  };

  const connectWebSocket = () => {
    try {
      // ✅ MIGRATED: Removed Supabase path, using API Gateway WebSocket endpoint
      const wsBaseUrl = process.env.WS_BASE_URL || 'wss://api.warmpawz.com';
      const wsUrl = `${wsBaseUrl}/ws/updates/${vendorId}`;
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log('WebSocket connected for real-time updates');
        setConnected(true);
        ws.send(JSON.stringify({
          type: 'subscribe',
          vendorId,
        }));
      };

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'update') {
          const newUpdate: Update = {
            id: data.id || Date.now().toString(),
            type: data.updateType || 'info',
            title: data.title || 'Update',
            message: data.message || '',
            timestamp: data.timestamp || new Date().toISOString(),
            data: data.data,
          };
          setUpdates(prev => [newUpdate, ...prev]);
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        setConnected(false);
      };

      ws.onclose = () => {
        console.log('WebSocket disconnected');
        setConnected(false);
        // Attempt to reconnect after 3 seconds
        setTimeout(connectWebSocket, 3000);
      };

      wsRef.current = ws;
    } catch (error) {
      console.error('Error connecting WebSocket:', error);
      setConnected(false);
    }
  };

  const renderUpdate = ({ item }: { item: Update }) => {
    const getTypeColor = (type: string) => {
      switch (type) {
        case 'booking':
          return colors.primary;
        case 'alert':
          return colors.error;
        case 'info':
          return colors.info;
        default:
          return colors.textSecondary;
      }
    };

    return (
      <TouchableOpacity
        style={styles.updateCard}
        onPress={() => {
          if (onUpdateTap) {
            onUpdateTap(item);
          }
        }}
      >
        <View style={[styles.updateTypeIndicator, { backgroundColor: getTypeColor(item.type) }]} />
        <View style={styles.updateContent}>
          <Text style={styles.updateTitle}>{item.title}</Text>
          <Text style={styles.updateMessage}>{item.message}</Text>
          <Text style={styles.updateTime}>
            {new Date(item.timestamp).toLocaleString()}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        {onBack && (
          <TouchableOpacity onPress={onBack} style={styles.backButton}>
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
        )}
        <View style={styles.headerInfo}>
          <Text style={styles.title}>Real-Time Updates</Text>
          <View style={styles.connectionStatus}>
            <View style={[styles.statusDot, connected && styles.statusDotConnected]} />
            <Text style={styles.statusText}>
              {connected ? 'Connected' : 'Disconnected'}
            </Text>
          </View>
        </View>
      </View>

      <FlatList
        data={updates}
        keyExtractor={(item) => item.id}
        renderItem={renderUpdate}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>
              {connected ? 'No updates yet' : 'Connecting...'}
            </Text>
            {!connected && <ActivityIndicator size="small" color={colors.primary} style={{ marginTop: spacing.sm }} />}
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    padding: spacing.lg,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    marginBottom: spacing.sm,
  },
  backButtonText: {
    fontSize: typography.fontSizes.md,
    color: colors.textSecondary,
  },
  headerInfo: {
    flex: 1,
  },
  title: {
    fontSize: typography.fontSizes['2xl'],
    fontWeight: typography.fontWeights.bold,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  connectionStatus: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.error,
    marginRight: spacing.xs,
  },
  statusDotConnected: {
    backgroundColor: colors.success,
  },
  statusText: {
    fontSize: typography.fontSizes.sm,
    color: colors.textSecondary,
  },
  listContent: {
    padding: spacing.md,
  },
  updateCard: {
    flexDirection: 'row',
    backgroundColor: colors.background,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: borderRadius.xl,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  updateTypeIndicator: {
    width: 4,
    borderRadius: 2,
    marginRight: spacing.md,
  },
  updateContent: {
    flex: 1,
  },
  updateTitle: {
    fontSize: typography.fontSizes.md,
    fontWeight: typography.fontWeights.semibold,
    color: colors.text,
    marginBottom: spacing.xs / 2,
  },
  updateMessage: {
    fontSize: typography.fontSizes.sm,
    color: colors.textSecondary,
    marginBottom: spacing.xs / 2,
  },
  updateTime: {
    fontSize: typography.fontSizes.xs,
    color: colors.textMuted,
  },
  emptyState: {
    padding: spacing.xl,
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: typography.fontSizes.md,
    color: colors.textSecondary,
  },
});

