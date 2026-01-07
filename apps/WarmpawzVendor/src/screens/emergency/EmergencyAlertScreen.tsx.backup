/**
 * Emergency Alert Screen
 * Emergency handling and alerts
 * Batch 2 - Screen 4
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Alert,
  ScrollView,
  TextInput,
} from 'react-native';
import { colors, spacing, borderRadius, typography } from '../../theme/colors';
import { EmergencyApi } from '../../services/api';

interface EmergencyAlertScreenProps {
  bookingId?: string;
  vendorId: string;
  onBack?: () => void;
  onEmergencyReported?: (alert: any) => void;
}

export function EmergencyAlertScreen({
  bookingId,
  vendorId,
  onBack,
  onEmergencyReported,
}: EmergencyAlertScreenProps) {
  const [reporting, setReporting] = useState(false);
  const [emergencyType, setEmergencyType] = useState<string>('');
  const [description, setDescription] = useState('');

  const emergencyTypes = [
    { id: 'medical', label: 'Medical Emergency', icon: '🏥' },
    { id: 'safety', label: 'Safety Concern', icon: '⚠️' },
    { id: 'pet_injury', label: 'Pet Injury', icon: '🐾' },
    { id: 'customer_issue', label: 'Customer Issue', icon: '👤' },
    { id: 'other', label: 'Other', icon: '🚨' },
  ];

  const handleReportEmergency = async () => {
    if (!emergencyType) {
      Alert.alert('Error', 'Please select an emergency type');
      return;
    }

    if (!description.trim()) {
      Alert.alert('Error', 'Please provide a description');
      return;
    }

    setReporting(true);
    try {
      const response = await EmergencyApi.reportEmergency({
        vendorId,
        bookingId,
        emergencyType,
        description,
      });

      if (response.success) {
        Alert.alert('Success', 'Emergency reported successfully. Help is on the way.', [
          {
            text: 'OK',
            onPress: () => {
              if (onEmergencyReported) {
                onEmergencyReported(response.alert);
              }
            },
          },
        ]);
      } else {
        Alert.alert('Error', response.error || 'Failed to report emergency');
      }
    } catch (error: any) {
      console.error('Error reporting emergency:', error);
      Alert.alert('Error', error.message || 'Failed to report emergency. Please try again.');
    } finally {
      setReporting(false);
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
        <Text style={styles.title}>Emergency Alert</Text>
        <Text style={styles.subtitle}>Report an emergency situation</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.warningBox}>
          <Text style={styles.warningText}>
            ⚠️ Only use this for genuine emergencies. False reports may result in penalties.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Emergency Type</Text>
          {emergencyTypes.map((type) => (
            <TouchableOpacity
              key={type.id}
              style={[
                styles.emergencyTypeCard,
                emergencyType === type.id && styles.emergencyTypeCardSelected,
              ]}
              onPress={() => setEmergencyType(type.id)}
            >
              <Text style={styles.emergencyTypeIcon}>{type.icon}</Text>
              <Text
                style={[
                  styles.emergencyTypeLabel,
                  emergencyType === type.id && styles.emergencyTypeLabelSelected,
                ]}
              >
                {type.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Description</Text>
          <Text style={styles.sectionSubtitle}>
            Provide details about the emergency situation
          </Text>
          <TextInput
            style={styles.textArea}
            placeholder="Describe the emergency situation..."
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={6}
            textAlignVertical="top"
          />
        </View>

        <TouchableOpacity
          style={[styles.reportButton, (!emergencyType || !description.trim() || reporting) && styles.reportButtonDisabled]}
          onPress={handleReportEmergency}
          disabled={!emergencyType || !description.trim() || reporting}
        >
          <Text style={styles.reportButtonText}>
            {reporting ? 'Reporting...' : 'Report Emergency'}
          </Text>
        </TouchableOpacity>

        <View style={styles.helpSection}>
          <Text style={styles.helpTitle}>Need Immediate Help?</Text>
          <Text style={styles.helpText}>
            Call emergency services: 911 (or your local emergency number)
          </Text>
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
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: typography.fontSizes.sm,
    color: colors.textSecondary,
  },
  content: {
    padding: spacing.lg,
  },
  warningBox: {
    backgroundColor: '#FFF4E6',
    borderWidth: 2,
    borderColor: colors.warning,
    borderRadius: borderRadius.xl,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  warningText: {
    fontSize: typography.fontSizes.sm,
    color: colors.text,
    textAlign: 'center',
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: typography.fontSizes.lg,
    fontWeight: typography.fontWeights.bold,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  sectionSubtitle: {
    fontSize: typography.fontSizes.sm,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  emergencyTypeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: borderRadius.xl,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  emergencyTypeCardSelected: {
    borderColor: colors.error,
    backgroundColor: '#FEE',
  },
  emergencyTypeIcon: {
    fontSize: 32,
    marginRight: spacing.md,
  },
  emergencyTypeLabel: {
    fontSize: typography.fontSizes.md,
    color: colors.text,
  },
  emergencyTypeLabelSelected: {
    fontWeight: typography.fontWeights.semibold,
    color: colors.error,
  },
  textArea: {
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: borderRadius.xl,
    padding: spacing.md,
    minHeight: 120,
    backgroundColor: colors.background,
    fontSize: typography.fontSizes.md,
    color: colors.text,
  },
  reportButton: {
    backgroundColor: colors.error,
    borderRadius: borderRadius.xl,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  reportButtonDisabled: {
    opacity: 0.5,
  },
  reportButtonText: {
    fontSize: typography.fontSizes.md,
    fontWeight: typography.fontWeights.semibold,
    color: '#ffffff',
  },
  helpSection: {
    marginTop: spacing.xl,
    padding: spacing.md,
    backgroundColor: '#F0F0F0',
    borderRadius: borderRadius.xl,
    alignItems: 'center',
  },
  helpTitle: {
    fontSize: typography.fontSizes.md,
    fontWeight: typography.fontWeights.bold,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  helpText: {
    fontSize: typography.fontSizes.sm,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});

