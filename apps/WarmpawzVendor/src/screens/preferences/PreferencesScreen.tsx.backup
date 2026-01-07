/**
 * Preferences Screen
 * App preferences and customization
 * Batch 4 - Screen 3
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
import { PreferencesApi } from '../../services/api';

interface PreferencesScreenProps {
  vendorId: string;
  onBack?: () => void;
}

export function PreferencesScreen({ vendorId, onBack }: PreferencesScreenProps) {
  const [preferences, setPreferences] = useState({
    language: 'en',
    currency: 'INR',
    timezone: 'Asia/Kolkata',
    theme: 'light',
    autoAcceptBookings: false,
    showNotifications: true,
    emailNotifications: true,
    smsNotifications: false,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadPreferences();
  }, [vendorId]);

  const loadPreferences = async () => {
    try {
      const response = await PreferencesApi.getPreferences(vendorId);
      setPreferences(response.preferences || preferences);
    } catch (error) {
      console.error('Error loading preferences:', error);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await PreferencesApi.updatePreferences(vendorId, preferences);
      Alert.alert('Success', 'Preferences saved successfully!');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to save preferences');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        {onBack && (
          <TouchableOpacity onPress={onBack} style={styles.backButton}>
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
        )}
        <Text style={styles.title}>Preferences</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>General</Text>
          
          <View style={styles.preferenceItem}>
            <View style={styles.preferenceInfo}>
              <Text style={styles.preferenceLabel}>Auto Accept Bookings</Text>
              <Text style={styles.preferenceDescription}>
                Automatically accept new bookings
              </Text>
            </View>
            <Switch
              value={preferences.autoAcceptBookings}
              onValueChange={(value) =>
                setPreferences({ ...preferences, autoAcceptBookings: value })
              }
            />
          </View>

          <View style={styles.preferenceItem}>
            <View style={styles.preferenceInfo}>
              <Text style={styles.preferenceLabel}>Show Notifications</Text>
              <Text style={styles.preferenceDescription}>
                Display in-app notifications
              </Text>
            </View>
            <Switch
              value={preferences.showNotifications}
              onValueChange={(value) =>
                setPreferences({ ...preferences, showNotifications: value })
              }
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notification Preferences</Text>
          
          <View style={styles.preferenceItem}>
            <View style={styles.preferenceInfo}>
              <Text style={styles.preferenceLabel}>Email Notifications</Text>
              <Text style={styles.preferenceDescription}>
                Receive notifications via email
              </Text>
            </View>
            <Switch
              value={preferences.emailNotifications}
              onValueChange={(value) =>
                setPreferences({ ...preferences, emailNotifications: value })
              }
            />
          </View>

          <View style={styles.preferenceItem}>
            <View style={styles.preferenceInfo}>
              <Text style={styles.preferenceLabel}>SMS Notifications</Text>
              <Text style={styles.preferenceDescription}>
                Receive notifications via SMS
              </Text>
            </View>
            <Switch
              value={preferences.smsNotifications}
              onValueChange={(value) =>
                setPreferences({ ...preferences, smsNotifications: value })
              }
            />
          </View>
        </View>

        <TouchableOpacity
          style={styles.saveButton}
          onPress={handleSave}
          disabled={saving}
        >
          <Text style={styles.saveButtonText}>
            {saving ? 'Saving...' : 'Save Preferences'}
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
  preferenceItem: {
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
  preferenceInfo: {
    flex: 1,
    marginRight: spacing.md,
  },
  preferenceLabel: {
    fontSize: typography.fontSizes.md,
    fontWeight: typography.fontWeights.medium,
    color: colors.text,
    marginBottom: spacing.xs / 2,
  },
  preferenceDescription: {
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

