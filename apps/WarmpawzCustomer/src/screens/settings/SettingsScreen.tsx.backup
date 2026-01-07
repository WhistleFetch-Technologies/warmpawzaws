/**
 * Settings Screen - Mobile
 * App settings and preferences
 * Identical functionality to web app
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  Switch,
  Alert,
} from 'react-native';
import { colors, spacing, borderRadius } from '../../theme/colors';
import { ApiService } from '../../services/api';

interface SettingsScreenProps {
  phone: string;
  customerId?: string;
  onBack: () => void;
  onNavigate?: (screen: string, data?: any) => void;
  onLogout?: () => void;
}

export function SettingsScreen({
  phone,
  customerId,
  onBack,
  onNavigate,
  onLogout,
}: SettingsScreenProps) {
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [smsNotifications, setSmsNotifications] = useState(true);
  const [pushNotifications, setPushNotifications] = useState(true);

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            try {
              // Clear session token
              await ApiService.clearSessionToken();
              
              // Call logout callback if provided
              if (onLogout) {
                onLogout();
              } else if (onNavigate) {
                // Navigate to auth screen
                onNavigate('Auth');
              }
            } catch (error) {
              console.error('Error during logout:', error);
              Alert.alert('Error', 'Failed to logout. Please try again.');
            }
          },
        },
      ]
    );
  };

  const settingsSections = [
    {
      title: 'Account',
      items: [
        { label: 'Profile', icon: '👤', screen: 'CustomerProfile' },
        { label: 'Addresses', icon: '📍', screen: 'Addresses' },
        { label: 'Payment Methods', icon: '💳', screen: 'PaymentMethods' },
      ],
    },
    {
      title: 'Notifications',
      items: [
        { label: 'Notification Center', icon: '🔔', screen: 'NotificationCenter' },
      ],
    },
    {
      title: 'Support',
      items: [
        { label: 'Help & Support', icon: '❓', screen: 'HelpSupport' },
        { label: 'Contact Us', icon: '📞', screen: 'ContactUs' },
      ],
    },
    {
      title: 'About',
      items: [
        { label: 'Terms & Conditions', icon: '📄', screen: 'TermsConditions' },
        { label: 'Privacy Policy', icon: '🔒', screen: 'PrivacyPolicy' },
        { label: 'About App', icon: 'ℹ️', screen: 'AboutApp' },
      ],
    },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {settingsSections.map((section, sectionIndex) => (
          <View key={sectionIndex} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <View style={styles.sectionContent}>
              {section.items.map((item, itemIndex) => (
                <TouchableOpacity
                  key={itemIndex}
                  style={styles.settingsItem}
                  onPress={() => onNavigate && onNavigate(item.screen)}
                >
                  <Text style={styles.settingsIcon}>{item.icon}</Text>
                  <Text style={styles.settingsLabel}>{item.label}</Text>
                  <Text style={styles.settingsArrow}>›</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}

        {/* Notification Toggles */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notification Preferences</Text>
          <View style={styles.sectionContent}>
            <View style={styles.toggleItem}>
              <View style={styles.toggleInfo}>
                <Text style={styles.toggleLabel}>Enable Notifications</Text>
                <Text style={styles.toggleDescription}>
                  Receive notifications about bookings and orders
                </Text>
              </View>
              <Switch
                value={notificationsEnabled}
                onValueChange={setNotificationsEnabled}
                trackColor={{ false: '#e5e7eb', true: colors.primary }}
              />
            </View>
            {notificationsEnabled && (
              <>
                <View style={styles.toggleItem}>
                  <View style={styles.toggleInfo}>
                    <Text style={styles.toggleLabel}>Email Notifications</Text>
                    <Text style={styles.toggleDescription}>
                      Receive notifications via email
                    </Text>
                  </View>
                  <Switch
                    value={emailNotifications}
                    onValueChange={setEmailNotifications}
                    trackColor={{ false: '#e5e7eb', true: colors.primary }}
                  />
                </View>
                <View style={styles.toggleItem}>
                  <View style={styles.toggleInfo}>
                    <Text style={styles.toggleLabel}>SMS Notifications</Text>
                    <Text style={styles.toggleDescription}>
                      Receive notifications via SMS
                    </Text>
                  </View>
                  <Switch
                    value={smsNotifications}
                    onValueChange={setSmsNotifications}
                    trackColor={{ false: '#e5e7eb', true: colors.primary }}
                  />
                </View>
                <View style={styles.toggleItem}>
                  <View style={styles.toggleInfo}>
                    <Text style={styles.toggleLabel}>Push Notifications</Text>
                    <Text style={styles.toggleDescription}>
                      Receive push notifications
                    </Text>
                  </View>
                  <Switch
                    value={pushNotifications}
                    onValueChange={setPushNotifications}
                    trackColor={{ false: '#e5e7eb', true: colors.primary }}
                  />
                </View>
              </>
            )}
          </View>
        </View>

        {/* Logout */}
        <TouchableOpacity
          style={styles.logoutButton}
          onPress={handleLogout}
        >
          <Text style={styles.logoutButtonText}>Logout</Text>
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    padding: spacing.xs,
  },
  backButtonText: {
    fontSize: 16,
    color: colors.primary,
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
  },
  placeholder: {
    width: 60,
  },
  content: {
    flex: 1,
    padding: spacing.md,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
  },
  sectionContent: {
    backgroundColor: '#fff',
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  settingsItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  settingsIcon: {
    fontSize: 24,
    marginRight: spacing.md,
  },
  settingsLabel: {
    flex: 1,
    fontSize: 16,
    color: colors.text,
  },
  settingsArrow: {
    fontSize: 24,
    color: colors.textSecondary,
  },
  toggleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  toggleInfo: {
    flex: 1,
    marginRight: spacing.md,
  },
  toggleLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  toggleDescription: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  logoutButton: {
    backgroundColor: '#fee2e2',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    marginTop: spacing.md,
    marginBottom: spacing.lg,
  },
  logoutButtonText: {
    color: '#dc2626',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
