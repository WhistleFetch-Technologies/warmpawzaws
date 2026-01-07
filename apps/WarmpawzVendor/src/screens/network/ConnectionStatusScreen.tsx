/**
 * Connection Status Screen
 * Network status and connectivity
 * Batch 2 - Screen 9
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
} from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { colors, spacing, borderRadius, typography } from '../../theme/colors';

interface ConnectionStatusScreenProps {
  onBack?: () => void;
}

export function ConnectionStatusScreen({ onBack }: ConnectionStatusScreenProps) {
  const [connectionInfo, setConnectionInfo] = useState<any>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      setConnectionInfo(state);
      setIsConnected(state.isConnected ?? false);
    });

    // Get initial state
    NetInfo.fetch().then(state => {
      setConnectionInfo(state);
      setIsConnected(state.isConnected ?? false);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const getConnectionType = () => {
    if (!connectionInfo) return 'Unknown';
    return connectionInfo.type || 'Unknown';
  };

  const getConnectionDetails = () => {
    if (!connectionInfo) return {};
    return {
      type: connectionInfo.type,
      isConnected: connectionInfo.isConnected,
      isInternetReachable: connectionInfo.isInternetReachable,
      details: connectionInfo.details,
    };
  };

  const details = getConnectionDetails();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        {onBack && (
          <TouchableOpacity onPress={onBack} style={styles.backButton}>
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
        )}
        <Text style={styles.title}>Connection Status</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.statusCard}>
          <View style={styles.statusHeader}>
            <View style={[styles.statusIndicator, isConnected && styles.statusIndicatorConnected]} />
            <Text style={styles.statusText}>
              {isConnected ? 'Connected' : 'Disconnected'}
            </Text>
          </View>
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Connection Type</Text>
          <Text style={styles.infoValue}>{getConnectionType()}</Text>
        </View>

        {details.details && (
          <>
            {details.details.ssid && (
              <View style={styles.infoCard}>
                <Text style={styles.infoTitle}>WiFi Network</Text>
                <Text style={styles.infoValue}>{details.details.ssid}</Text>
              </View>
            )}

            {details.details.cellularGeneration && (
              <View style={styles.infoCard}>
                <Text style={styles.infoTitle}>Cellular Generation</Text>
                <Text style={styles.infoValue}>{details.details.cellularGeneration}</Text>
              </View>
            )}

            {details.details.strength && (
              <View style={styles.infoCard}>
                <Text style={styles.infoTitle}>Signal Strength</Text>
                <Text style={styles.infoValue}>{details.details.strength}%</Text>
              </View>
            )}
          </>
        )}

        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Internet Reachable</Text>
          <Text style={styles.infoValue}>
            {details.isInternetReachable ? 'Yes' : 'No'}
          </Text>
        </View>

        {!isConnected && (
          <View style={styles.warningBox}>
            <Text style={styles.warningText}>
              ⚠️ No internet connection. Some features may not work.
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
  statusIndicatorConnected: {
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
  warningBox: {
    backgroundColor: colors.gradientOrange50,
    borderWidth: 2,
    borderColor: colors.warning,
    borderRadius: borderRadius.xl,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  warningText: {
    fontSize: typography.fontSizes.sm,
    color: colors.text,
    textAlign: 'center',
  },
});

