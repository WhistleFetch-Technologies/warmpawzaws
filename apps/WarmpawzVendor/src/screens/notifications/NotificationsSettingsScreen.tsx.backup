/**
 * Notifications Settings Screen
 * Notification preferences
 * Batch 4 - Screen 6
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Switch,
  Alert,
} from 'react-native';
import { colors, spacing, borderRadius, typography } from '../../theme/colors';
import { NotificationsSettingsApi } from '../../services/api';

interface NotificationsSettingsScreenProps {
  vendorId: string;
  onBack?: () => void;
}

export function NotificationsSettingsScreen({ vendorId, onBack }: NotificationsSettingsScreenProps) {
  const [settings, setSettings] = useState({
    pushNotifications: true,
    emailNotifications: true,
    smsNotifications: false,
    bookingNotifications: true,
    paymentNotifications: true,
    reviewNotifications: true,
    marketingNotifications: false,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadSettings();
  }, [vendorId]);

  const loadSettings = async () => {
    try {
      const response = await NotificationsSettingsApi.getSettings(vendorId);
      setSettings(response.settings || settings);
    } catch (error) {
      console.error('Error loading notification settings:', error);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await NotificationsSettingsApi.updateSettings(vendorId, settings);
      Alert.alert('Success', 'Notification settings saved!');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const updateSetting = (key: string, value: boolean) => {
    setSettings({ ...settings, [key]: value });
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        {onBack && (
          <TouchableOpacity onPress={onBack} style={styles.backButton}>
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
        )}
        <Text style={styles.title}>Notification Settings</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notification Channels</Text>
          
          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Push Notifications</Text>
              <Text style={styles.settingDescription}>
                Receive push notifications on your device
              </Text>
            </View>
            <Switch
              value={settings.pushNotifications}
              onValueChange={(value) => updateSetting('pushNotifications', value)}
            />
          </View>

          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Email Notifications</Text>
              <Text style={styles.settingDescription}>
                Receive notifications via email
              </Text>
            </View>
            <Switch
              value={settings.emailNotifications}
              onValueChange={(value) => updateSetting('emailNotifications', value)}
            />
          </View>

          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>SMS Notifications</Text>
              <Text style={styles.settingDescription}>
                Receive notifications via SMS
              </Text>
            </View>
            <Switch
              value={settings.smsNotifications}
              onValueChange={(value) => updateSetting('smsNotifications', value)}
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notification Types</Text>
          
          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Booking Notifications</Text>
              <Text style={styles.settingDescription}>
                New bookings, cancellations, updates
              </Text>
            </View>
            <Switch
              value={settings.bookingNotifications}
              onValueChange={(value) => updateSetting('bookingNotifications', value)}
            />
          </View>

          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Payment Notifications</Text>
              <Text style={styles.settingDescription}>
                Payouts, payments, earnings
              </Text>
            </View>
            <Switch
              value={settings.paymentNotifications}
              onValueChange={(value) => updateSetting('paymentNotifications', value)}
            />
          </View>

          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Review Notifications</Text>
              <Text style={styles.settingDescription}>
                New reviews and ratings
              </Text>
            </View>
            <Switch
              value={settings.reviewNotifications}
              onValueChange={(value) => updateSetting('reviewNotifications', value)}
            />
          </View>

          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Marketing Notifications</Text>
              <Text style={styles.settingDescription}>
                Promotions and updates
              </Text>
            </View>
            <Switch
              value={settings.marketingNotifications}
              onValueChange={(value) => updateSetting('marketingNotifications', value)}
            />
          </View>
        </View>

        <TouchableOpacity
          style={styles.saveButton}
          onPress={handleSave}
          disabled={saving}
        >
          <Text style={styles.saveButtonText}>
            {saving ? 'Saving...' : 'Save Settings'}
          </Text>
        </TouchableOpacity>
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
  section: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    fontSize: typography.fontSizes.sm,
    fontWeight: typography.fontWeights.semibold,
    color: colors.textSecondary,
    marginBottom: spacing.md,
    textTransform: 'uppercase',
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.background,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: borderRadius.xl,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  settingInfo: {
    flex: 1,
    marginRight: spacing.md,
  },
  settingLabel: {
    fontSize: typography.fontSizes.md,
    fontWeight: typography.fontWeights.medium,
    color: colors.text,
    marginBottom: spacing.xs / 2,
  },
  settingDescription: {
    fontSize: typography.fontSizes.sm,
    color: colors.textSecondary,
  },
  saveButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.xl,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  saveButtonText: {
    fontSize: typography.fontSizes.md,
    fontWeight: typography.fontWeights.semibold,
    color: '#ffffff',
  },
});

