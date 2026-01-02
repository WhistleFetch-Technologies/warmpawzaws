/**
 * Privacy Screen
 * Privacy settings and data management
 * Batch 4 - Screen 7
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
import { PrivacyApi } from '../../services/api';

interface PrivacyScreenProps {
  vendorId: string;
  onBack?: () => void;
}

export function PrivacyScreen({ vendorId, onBack }: PrivacyScreenProps) {
  const [settings, setSettings] = useState({
    shareLocation: true,
    shareContactInfo: false,
    showInSearch: true,
    allowReviews: true,
    dataSharing: false,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadSettings();
  }, [vendorId]);

  const loadSettings = async () => {
    try {
      const response = await PrivacyApi.getSettings(vendorId);
      setSettings(response.settings || settings);
    } catch (error) {
      console.error('Error loading privacy settings:', error);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await PrivacyApi.updateSettings(vendorId, settings);
      Alert.alert('Success', 'Privacy settings saved!');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleRequestData = async () => {
    Alert.alert(
      'Request Data',
      'We will prepare your data export and send it to your registered email.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Request',
          onPress: async () => {
            try {
              await PrivacyApi.requestData(vendorId);
              Alert.alert('Success', 'Data export request submitted. You will receive an email shortly.');
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to request data');
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
        <Text style={styles.title}>Privacy</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Privacy Settings</Text>
          
          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Share Location</Text>
              <Text style={styles.settingDescription}>
                Allow customers to see your location during service
              </Text>
            </View>
            <Switch
              value={settings.shareLocation}
              onValueChange={(value) => setSettings({ ...settings, shareLocation: value })}
            />
          </View>

          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Share Contact Info</Text>
              <Text style={styles.settingDescription}>
                Allow customers to contact you directly
              </Text>
            </View>
            <Switch
              value={settings.shareContactInfo}
              onValueChange={(value) => setSettings({ ...settings, shareContactInfo: value })}
            />
          </View>

          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Show in Search</Text>
              <Text style={styles.settingDescription}>
                Make your profile visible in search results
              </Text>
            </View>
            <Switch
              value={settings.showInSearch}
              onValueChange={(value) => setSettings({ ...settings, showInSearch: value })}
            />
          </View>

          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Allow Reviews</Text>
              <Text style={styles.settingDescription}>
                Allow customers to leave reviews
              </Text>
            </View>
            <Switch
              value={settings.allowReviews}
              onValueChange={(value) => setSettings({ ...settings, allowReviews: value })}
            />
          </View>

          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Data Sharing</Text>
              <Text style={styles.settingDescription}>
                Allow anonymized data sharing for analytics
              </Text>
            </View>
            <Switch
              value={settings.dataSharing}
              onValueChange={(value) => setSettings({ ...settings, dataSharing: value })}
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Data Management</Text>
          <TouchableOpacity style={styles.actionButton} onPress={handleRequestData}>
            <Text style={styles.actionButtonText}>Request My Data</Text>
          </TouchableOpacity>
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
  actionButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.xl,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
  },
  actionButtonText: {
    fontSize: typography.fontSizes.md,
    fontWeight: typography.fontWeights.semibold,
    color: '#ffffff',
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

