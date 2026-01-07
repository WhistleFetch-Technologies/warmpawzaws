/**
 * Offline Mode Screen
 * Offline capabilities and sync
 * Batch 2 - Screen 10
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { colors, spacing, borderRadius, typography } from '../../theme/colors';
import { OfflineModeApi } from '../../services/api';

interface OfflineModeScreenProps {
  vendorId: string;
  onBack?: () => void;
}

export function OfflineModeScreen({ vendorId, onBack }: OfflineModeScreenProps) {
  const [isOnline, setIsOnline] = useState(true);
  const [pendingActions, setPendingActions] = useState<any[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsOnline(state.isConnected ?? false);
      if (state.isConnected) {
        syncPendingActions();
      }
    });

    loadPendingActions();

    return () => {
      unsubscribe();
    };
  }, [vendorId]);

  const loadPendingActions = async () => {
    try {
      const actions = await OfflineModeApi.getPendingActions(vendorId);
      setPendingActions(actions || []);
    } catch (error) {
      console.error('Error loading pending actions:', error);
    }
  };

  const syncPendingActions = async () => {
    if (pendingActions.length === 0) return;

    setSyncing(true);
    try {
      const result = await OfflineModeApi.syncPendingActions(vendorId);
      if (result.success) {
        setPendingActions([]);
        setLastSync(new Date());
        Alert.alert('Success', `${result.syncedCount} actions synced successfully`);
      } else {
        Alert.alert('Error', result.error || 'Failed to sync actions');
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to sync actions');
    } finally {
      setSyncing(false);
    }
  };

  const clearPendingActions = async () => {
    Alert.alert(
      'Clear Pending Actions',
      'Are you sure you want to clear all pending actions?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            try {
              await OfflineModeApi.clearPendingActions(vendorId);
              setPendingActions([]);
              Alert.alert('Success', 'Pending actions cleared');
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to clear actions');
            }
          },
        },
      ]
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
        <Text style={styles.title}>Offline Mode</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.statusCard}>
          <View style={styles.statusHeader}>
            <View style={[styles.statusIndicator, isOnline && styles.statusIndicatorOnline]} />
            <Text style={styles.statusText}>
              {isOnline ? 'Online' : 'Offline'}
            </Text>
          </View>
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Pending Actions</Text>
          <Text style={styles.infoValue}>{pendingActions.length}</Text>
        </View>

        {lastSync && (
          <View style={styles.infoCard}>
            <Text style={styles.infoTitle}>Last Sync</Text>
            <Text style={styles.infoValue}>
              {lastSync.toLocaleString()}
            </Text>
          </View>
        )}

        {pendingActions.length > 0 && (
          <View style={styles.actionsList}>
            <Text style={styles.actionsTitle}>Pending Actions:</Text>
            {pendingActions.map((action, index) => (
              <View key={index} style={styles.actionItem}>
                <Text style={styles.actionType}>{action.type}</Text>
                <Text style={styles.actionTime}>
                  {new Date(action.timestamp).toLocaleString()}
                </Text>
              </View>
            ))}
          </View>
        )}

        <View style={styles.actions}>
          {isOnline && pendingActions.length > 0 && (
            <TouchableOpacity
              style={[styles.syncButton, syncing && styles.syncButtonDisabled]}
              onPress={syncPendingActions}
              disabled={syncing}
            >
              {syncing ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.syncButtonText}>Sync Now</Text>
              )}
            </TouchableOpacity>
          )}

          {pendingActions.length > 0 && (
            <TouchableOpacity
              style={styles.clearButton}
              onPress={clearPendingActions}
            >
              <Text style={styles.clearButtonText}>Clear Pending</Text>
            </TouchableOpacity>
          )}
        </View>

        {!isOnline && (
          <View style={styles.offlineInfo}>
            <Text style={styles.offlineInfoText}>
              You're currently offline. Actions will be queued and synced when connection is restored.
            </Text>
          </View>
        )}
      </ScrollView>
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
  title: {
    fontSize: typography.fontSizes['2xl'],
    fontWeight: typography.fontWeights.bold,
    color: colors.text,
  },
  content: {
    padding: spacing.lg,
  },
  statusCard: {
    backgroundColor: colors.background,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    marginBottom: spacing.md,
    alignItems: 'center',
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusIndicator: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.error,
    marginRight: spacing.sm,
  },
  statusIndicatorOnline: {
    backgroundColor: colors.success,
  },
  statusText: {
    fontSize: typography.fontSizes.lg,
    fontWeight: typography.fontWeights.bold,
    color: colors.text,
  },
  infoCard: {
    backgroundColor: colors.background,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: borderRadius.xl,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  infoTitle: {
    fontSize: typography.fontSizes.sm,
    color: colors.textSecondary,
    marginBottom: spacing.xs / 2,
  },
  infoValue: {
    fontSize: typography.fontSizes.md,
    fontWeight: typography.fontWeights.medium,
    color: colors.text,
  },
  actionsList: {
    backgroundColor: colors.background,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: borderRadius.xl,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  actionsTitle: {
    fontSize: typography.fontSizes.md,
    fontWeight: typography.fontWeights.semibold,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  actionItem: {
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  actionType: {
    fontSize: typography.fontSizes.sm,
    color: colors.text,
    marginBottom: spacing.xs / 2,
  },
  actionTime: {
    fontSize: typography.fontSizes.xs,
    color: colors.textMuted,
  },
  actions: {
    marginTop: spacing.md,
  },
  syncButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.xl,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  syncButtonDisabled: {
    opacity: 0.5,
  },
  syncButtonText: {
    fontSize: typography.fontSizes.md,
    fontWeight: typography.fontWeights.semibold,
    color: '#ffffff',
  },
  clearButton: {
    backgroundColor: colors.error,
    borderRadius: borderRadius.xl,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
  },
  clearButtonText: {
    fontSize: typography.fontSizes.md,
    fontWeight: typography.fontWeights.semibold,
    color: '#ffffff',
  },
  offlineInfo: {
    backgroundColor: '#FFF4E6',
    borderWidth: 2,
    borderColor: colors.warning,
    borderRadius: borderRadius.xl,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  offlineInfoText: {
    fontSize: typography.fontSizes.sm,
    color: colors.text,
    textAlign: 'center',
  },
});

