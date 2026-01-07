/**
 * Settings Screen
 * App settings and configuration
 * Batch 4 - Screen 1
 */

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
} from 'react-native';
import { colors, spacing, borderRadius, typography } from '../../theme/colors';

interface SettingsScreenProps {
  vendorId: string;
  onBack?: () => void;
  onNavigate?: (screen: string, data?: any) => void;
}

export function SettingsScreen({ vendorId, onBack, onNavigate }: SettingsScreenProps) {
  const settingsSections = [
    {
      title: 'Account',
      items: [
        { id: 'profile', label: 'Profile', icon: '👤', screen: 'Profile' },
        { id: 'account', label: 'Account Settings', icon: '⚙️', screen: 'Account' },
        { id: 'security', label: 'Security', icon: '🔒', screen: 'Security' },
      ],
    },
    {
      title: 'Preferences',
      items: [
        { id: 'notifications', label: 'Notifications', icon: '🔔', screen: 'NotificationsSettings' },
        { id: 'privacy', label: 'Privacy', icon: '🛡️', screen: 'Privacy' },
        { id: 'preferences', label: 'Preferences', icon: '🎨', screen: 'Preferences' },
      ],
    },
    {
      title: 'Support',
      items: [
        { id: 'help', label: 'Help & Support', icon: '❓', screen: 'Help' },
        { id: 'about', label: 'About', icon: 'ℹ️', screen: 'About' },
      ],
    },
    {
      title: 'Account Actions',
      items: [
        { id: 'logout', label: 'Logout', icon: '🚪', screen: 'Logout', danger: true },
      ],
    },
  ];

  const handleItemPress = (item: any) => {
    if (onNavigate) {
      onNavigate(item.screen);
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
        <Text style={styles.title}>Settings</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {settingsSections.map((section, sectionIndex) => (
          <View key={sectionIndex} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            {section.items.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={[styles.settingsItem, item.danger && styles.settingsItemDanger]}
                onPress={() => handleItemPress(item)}
              >
                <Text style={styles.settingsIcon}>{item.icon}</Text>
                <Text style={[styles.settingsLabel, item.danger && styles.settingsLabelDanger]}>
                  {item.label}
                </Text>
                <Text style={styles.settingsArrow}>›</Text>
              </TouchableOpacity>
            ))}
          </View>
        ))}
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
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
  },
  settingsItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: borderRadius.xl,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  settingsItemDanger: {
    borderColor: colors.error,
  },
  settingsIcon: {
    fontSize: 24,
    marginRight: spacing.md,
  },
  settingsLabel: {
    flex: 1,
    fontSize: typography.fontSizes.md,
    color: colors.text,
  },
  settingsLabelDanger: {
    color: colors.error,
  },
  settingsArrow: {
    fontSize: typography.fontSizes.xl,
    color: colors.textSecondary,
  },
});

