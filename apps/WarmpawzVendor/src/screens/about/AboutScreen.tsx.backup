/**
 * About Screen
 * App information and version
 * Batch 4 - Screen 9
 */

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Linking,
} from 'react-native';
import { colors, spacing, borderRadius, typography } from '../../theme/colors';

interface AboutScreenProps {
  onBack?: () => void;
}

export function AboutScreen({ onBack }: AboutScreenProps) {
  const appVersion = '1.0.0';
  const buildNumber = '2025.01.28';

  const handleLinkPress = (url: string) => {
    Linking.openURL(url).catch((err) => console.error('Error opening URL:', err));
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        {onBack && (
          <TouchableOpacity onPress={onBack} style={styles.backButton}>
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
        )}
        <Text style={styles.title}>About</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.logoSection}>
          <Text style={styles.logo}>🐾</Text>
          <Text style={styles.appName}>Warmpawz Vendor</Text>
          <Text style={styles.tagline}>Your Pet Care Business Partner</Text>
        </View>

        <View style={styles.infoSection}>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Version</Text>
            <Text style={styles.infoValue}>{appVersion}</Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Build</Text>
            <Text style={styles.infoValue}>{buildNumber}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About Warmpawz</Text>
          <Text style={styles.sectionText}>
            Warmpawz is a comprehensive pet care platform connecting pet owners with trusted
            service providers. Our vendor app helps you manage your pet care business efficiently.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Links</Text>
          <TouchableOpacity
            style={styles.linkItem}
            onPress={() => handleLinkPress('https://warmpawz.com/terms')}
          >
            <Text style={styles.linkText}>Terms of Service</Text>
            <Text style={styles.linkArrow}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.linkItem}
            onPress={() => handleLinkPress('https://warmpawz.com/privacy')}
          >
            <Text style={styles.linkText}>Privacy Policy</Text>
            <Text style={styles.linkArrow}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.linkItem}
            onPress={() => handleLinkPress('https://warmpawz.com')}
          >
            <Text style={styles.linkText}>Website</Text>
            <Text style={styles.linkArrow}>›</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>© 2025 Warmpawz. All rights reserved.</Text>
        </View>
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
  logoSection: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  logo: {
    fontSize: 64,
    marginBottom: spacing.md,
  },
  appName: {
    fontSize: typography.fontSizes['2xl'],
    fontWeight: typography.fontWeights.bold,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  tagline: {
    fontSize: typography.fontSizes.sm,
    color: colors.textSecondary,
  },
  infoSection: {
    backgroundColor: colors.background,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: borderRadius.xl,
    padding: spacing.md,
    marginBottom: spacing.xl,
  },
  infoItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  infoLabel: {
    fontSize: typography.fontSizes.md,
    color: colors.textSecondary,
  },
  infoValue: {
    fontSize: typography.fontSizes.md,
    fontWeight: typography.fontWeights.medium,
    color: colors.text,
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    fontSize: typography.fontSizes.lg,
    fontWeight: typography.fontWeights.bold,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  sectionText: {
    fontSize: typography.fontSizes.md,
    color: colors.textSecondary,
    lineHeight: 24,
  },
  linkItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: borderRadius.xl,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  linkText: {
    fontSize: typography.fontSizes.md,
    color: colors.text,
  },
  linkArrow: {
    fontSize: typography.fontSizes.xl,
    color: colors.textSecondary,
  },
  footer: {
    alignItems: 'center',
    marginTop: spacing.xl,
    paddingTop: spacing.xl,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  footerText: {
    fontSize: typography.fontSizes.sm,
    color: colors.textMuted,
  },
});

