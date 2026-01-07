/**
 * Account Screen
 * Account management
 * Batch 4 - Screen 4
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
import { colors, spacing, borderRadius, typography } from '../../theme/colors';
import { AccountApi } from '../../services/api';

interface AccountScreenProps {
  vendorId: string;
  onBack?: () => void;
  onNavigate?: (screen: string, data?: any) => void;
}

export function AccountScreen({ vendorId, onBack, onNavigate }: AccountScreenProps) {
  const [loading, setLoading] = useState(true);
  const [account, setAccount] = useState<any>(null);

  useEffect(() => {
    loadAccount();
  }, [vendorId]);

  const loadAccount = async () => {
    try {
      setLoading(true);
      const response = await AccountApi.getAccount(vendorId);
      setAccount(response.account);
    } catch (error) {
      console.error('Error loading account:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'Are you sure you want to delete your account? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await AccountApi.deleteAccount(vendorId);
              Alert.alert('Success', 'Account deleted successfully');
              if (onNavigate) {
                onNavigate('Auth');
              }
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to delete account');
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        {onBack && (
          <TouchableOpacity onPress={onBack} style={styles.backButton}>
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
        )}
        <Text style={styles.title}>Account</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {account && (
          <>
            <View style={styles.infoCard}>
              <Text style={styles.infoLabel}>Account Status</Text>
              <Text style={styles.infoValue}>
                {account.status?.charAt(0).toUpperCase() + account.status?.slice(1) || 'Active'}
              </Text>
            </View>

            <View style={styles.infoCard}>
              <Text style={styles.infoLabel}>Account Created</Text>
              <Text style={styles.infoValue}>
                {new Date(account.createdAt).toLocaleDateString()}
              </Text>
            </View>

            <View style={styles.infoCard}>
              <Text style={styles.infoLabel}>Last Login</Text>
              <Text style={styles.infoValue}>
                {account.lastLogin ? new Date(account.lastLogin).toLocaleString() : 'Never'}
              </Text>
            </View>

            {onNavigate && (
              <View style={styles.actions}>
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => onNavigate('Security')}
                >
                  <Text style={styles.actionButtonText}>Security Settings</Text>
                </TouchableOpacity>
              </View>
            )}

            <View style={styles.dangerSection}>
              <Text style={styles.dangerTitle}>Danger Zone</Text>
              <TouchableOpacity
                style={styles.dangerButton}
                onPress={handleDeleteAccount}
              >
                <Text style={styles.dangerButtonText}>Delete Account</Text>
              </TouchableOpacity>
            </View>
          </>
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
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
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
  infoCard: {
    backgroundColor: colors.background,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: borderRadius.xl,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  infoLabel: {
    fontSize: typography.fontSizes.sm,
    color: colors.textSecondary,
    marginBottom: spacing.xs / 2,
  },
  infoValue: {
    fontSize: typography.fontSizes.md,
    fontWeight: typography.fontWeights.medium,
    color: colors.text,
  },
  actions: {
    marginTop: spacing.md,
    marginBottom: spacing.md,
  },
  actionButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.xl,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  actionButtonText: {
    fontSize: typography.fontSizes.md,
    fontWeight: typography.fontWeights.semibold,
    color: '#ffffff',
  },
  dangerSection: {
    marginTop: spacing.xl,
    padding: spacing.md,
    backgroundColor: '#FFF4E6',
    borderWidth: 2,
    borderColor: colors.error,
    borderRadius: borderRadius.xl,
  },
  dangerTitle: {
    fontSize: typography.fontSizes.md,
    fontWeight: typography.fontWeights.bold,
    color: colors.error,
    marginBottom: spacing.sm,
  },
  dangerButton: {
    backgroundColor: colors.error,
    borderRadius: borderRadius.xl,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
  },
  dangerButtonText: {
    fontSize: typography.fontSizes.md,
    fontWeight: typography.fontWeights.semibold,
    color: '#ffffff',
  },
});

