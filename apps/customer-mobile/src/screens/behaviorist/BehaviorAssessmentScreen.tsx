/**
 * Behavior Assessment Screen - Customer Mobile App
 * Create initial behavior assessment for pet
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { BrandColors, Typography, BorderRadius, Spacing } from '../../theme';
import { API_BASE_URL, getPublicAnonKey } from '../../config/api';
import ErrorHandler from '../../utils/errorHandler';

interface AssessmentData {
  petId: string;
  problemAreas: string[];
  severity: 'mild' | 'moderate' | 'severe';
  duration: string;
  triggers: string[];
  currentBehavior: string;
  desiredOutcome: string;
  previousAttempts?: string;
}

export default function BehaviorAssessmentScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const { user } = useAuth();
  const { bookingId } = route.params as { bookingId: string };

  const [assessment, setAssessment] = useState<AssessmentData>({
    petId: '',
    problemAreas: [],
    severity: 'moderate',
    duration: '',
    triggers: [],
    currentBehavior: '',
    desiredOutcome: '',
    previousAttempts: '',
  });
  const [loading, setLoading] = useState(false);

  const problemOptions = [
    'Aggression',
    'Anxiety',
    'Barking',
    'Chewing',
    'Digging',
    'Jumping',
    'Separation Anxiety',
    'House Training',
    'Leash Pulling',
    'Fear',
    'Other',
  ];

  const toggleProblemArea = (area: string) => {
    setAssessment((prev) => ({
      ...prev,
      problemAreas: prev.problemAreas.includes(area)
        ? prev.problemAreas.filter((a) => a !== area)
        : [...prev.problemAreas, area],
    }));
  };

  const handleSubmit = async () => {
    if (assessment.problemAreas.length === 0) {
      Alert.alert('Required', 'Please select at least one problem area');
      return;
    }

    if (!assessment.currentBehavior || !assessment.desiredOutcome) {
      Alert.alert('Required', 'Please fill in all required fields');
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/behaviorist/assessment/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getPublicAnonKey()}`,
        },
        body: JSON.stringify({
          bookingId,
          customerId: user?.id,
          ...assessment,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        Alert.alert('Success', 'Assessment created successfully!', [
          {
            text: 'OK',
            onPress: () => {
              navigation.goBack();
            },
          },
        ]);
      } else {
        const error = await response.json();
        ErrorHandler.showError(error);
      }
    } catch (error) {
      ErrorHandler.showError(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.sectionTitle}>Problem Areas</Text>
        <Text style={styles.sectionSubtitle}>Select all that apply</Text>
        <View style={styles.optionsGrid}>
          {problemOptions.map((option) => (
            <TouchableOpacity
              key={option}
              style={[
                styles.optionChip,
                assessment.problemAreas.includes(option) && styles.optionChipSelected,
              ]}
              onPress={() => toggleProblemArea(option)}
            >
              <Text
                style={[
                  styles.optionText,
                  assessment.problemAreas.includes(option) && styles.optionTextSelected,
                ]}
              >
                {option}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Severity</Text>
          <View style={styles.radioGroup}>
            {(['mild', 'moderate', 'severe'] as const).map((level) => (
              <TouchableOpacity
                key={level}
                style={styles.radioOption}
                onPress={() => setAssessment({ ...assessment, severity: level })}
              >
                <Icon
                  name={assessment.severity === level ? 'radio-button-checked' : 'radio-button-unchecked'}
                  size={24}
                  color={BrandColors.primary.orange}
                />
                <Text style={styles.radioText}>{level.charAt(0).toUpperCase() + level.slice(1)}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Duration</Text>
          <TextInput
            style={styles.input}
            placeholder="How long has this been happening? (e.g., 3 months)"
            value={assessment.duration}
            onChangeText={(text) => setAssessment({ ...assessment, duration: text })}
            placeholderTextColor={BrandColors.text.secondary}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Current Behavior *</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Describe the current behavior in detail..."
            value={assessment.currentBehavior}
            onChangeText={(text) => setAssessment({ ...assessment, currentBehavior: text })}
            multiline
            numberOfLines={4}
            placeholderTextColor={BrandColors.text.secondary}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Desired Outcome *</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="What behavior would you like to see instead?"
            value={assessment.desiredOutcome}
            onChangeText={(text) => setAssessment({ ...assessment, desiredOutcome: text })}
            multiline
            numberOfLines={4}
            placeholderTextColor={BrandColors.text.secondary}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Triggers</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="What seems to trigger this behavior? (e.g., loud noises, strangers, being alone)"
            value={assessment.triggers.join(', ')}
            onChangeText={(text) =>
              setAssessment({ ...assessment, triggers: text.split(',').map((t) => t.trim()) })
            }
            multiline
            numberOfLines={3}
            placeholderTextColor={BrandColors.text.secondary}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Previous Attempts (Optional)</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Have you tried anything before? What worked or didn't work?"
            value={assessment.previousAttempts}
            onChangeText={(text) => setAssessment({ ...assessment, previousAttempts: text })}
            multiline
            numberOfLines={4}
            placeholderTextColor={BrandColors.text.secondary}
          />
        </View>

        <TouchableOpacity
          style={[styles.submitButton, loading && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={loading}
        >
          <Text style={styles.submitButtonText}>
            {loading ? 'Submitting...' : 'Submit Assessment'}
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  content: {
    padding: Spacing.md,
  },
  section: {
    marginBottom: Spacing.lg,
  },
  sectionTitle: {
    ...Typography.headingSmall,
    color: BrandColors.text.primary,
    marginBottom: Spacing.xs,
  },
  sectionSubtitle: {
    ...Typography.bodySmall,
    color: BrandColors.text.secondary,
    marginBottom: Spacing.md,
  },
  optionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: Spacing.md,
  },
  optionChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    backgroundColor: '#F5F5F5',
    marginRight: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  optionChipSelected: {
    backgroundColor: BrandColors.primary.orange,
  },
  optionText: {
    ...Typography.bodySmall,
    color: BrandColors.text.primary,
  },
  optionTextSelected: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  radioGroup: {
    marginTop: Spacing.sm,
  },
  radioOption: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  radioText: {
    ...Typography.bodyMedium,
    color: BrandColors.text.primary,
    marginLeft: Spacing.sm,
  },
  input: {
    ...Typography.bodyMedium,
    color: BrandColors.text.primary,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginTop: Spacing.sm,
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  submitButton: {
    backgroundColor: BrandColors.primary.orange,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    marginTop: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  submitButtonDisabled: {
    backgroundColor: '#E0E0E0',
  },
  submitButtonText: {
    ...Typography.bodyMedium,
    color: '#FFFFFF',
    fontWeight: '600',
  },
});

