/**
 * Progress Tracking Screen - Behaviorist/Vendor View
 * Track session progress and update milestones
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { BrandColors, Typography, BorderRadius, Spacing } from '../../theme';
import { API_BASE_URL, getPublicAnonKey } from '../../config/api';
import ErrorHandler from '../../utils/errorHandler';

interface ProgressUpdate {
  improvements: string[];
  challenges: string[];
  notes: string;
  behavioristNotes: string;
  nextSteps: string;
  milestonesAchieved?: string[];
}

export default function ProgressTrackingScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const { bookingId } = route.params as { bookingId: string };

  const [progress, setProgress] = useState<ProgressUpdate>({
    improvements: [],
    challenges: [],
    notes: '',
    behavioristNotes: '',
    nextSteps: '',
    milestonesAchieved: [],
  });
  const [loading, setLoading] = useState(false);
  const [improvementText, setImprovementText] = useState('');
  const [challengeText, setChallengeText] = useState('');

  const addImprovement = () => {
    if (improvementText.trim()) {
      setProgress({
        ...progress,
        improvements: [...progress.improvements, improvementText.trim()],
      });
      setImprovementText('');
    }
  };

  const removeImprovement = (index: number) => {
    setProgress({
      ...progress,
      improvements: progress.improvements.filter((_, i) => i !== index),
    });
  };

  const addChallenge = () => {
    if (challengeText.trim()) {
      setProgress({
        ...progress,
        challenges: [...progress.challenges, challengeText.trim()],
      });
      setChallengeText('');
    }
  };

  const removeChallenge = (index: number) => {
    setProgress({
      ...progress,
      challenges: progress.challenges.filter((_, i) => i !== index),
    });
  };

  const handleSubmit = async () => {
    if (!progress.behavioristNotes.trim()) {
      Alert.alert('Required', 'Please add behaviorist notes');
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/behaviorist/progress/track`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getPublicAnonKey()}`,
        },
        body: JSON.stringify({
          bookingId,
          ...progress,
        }),
      });

      if (response.ok) {
        Alert.alert('Success', 'Progress updated successfully!', [
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
        {/* Improvements */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Improvements</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              placeholder="Add improvement..."
              value={improvementText}
              onChangeText={setImprovementText}
              placeholderTextColor={BrandColors.text.secondary}
            />
            <TouchableOpacity style={styles.addButton} onPress={addImprovement}>
              <Icon name="add" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
          {progress.improvements.map((improvement, index) => (
            <View key={index} style={styles.tag}>
              <Text style={styles.tagText}>{improvement}</Text>
              <TouchableOpacity onPress={() => removeImprovement(index)}>
                <Icon name="close" size={16} color={BrandColors.text.secondary} />
              </TouchableOpacity>
            </View>
          ))}
        </View>

        {/* Challenges */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Challenges</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              placeholder="Add challenge..."
              value={challengeText}
              onChangeText={setChallengeText}
              placeholderTextColor={BrandColors.text.secondary}
            />
            <TouchableOpacity style={styles.addButton} onPress={addChallenge}>
              <Icon name="add" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
          {progress.challenges.map((challenge, index) => (
            <View key={index} style={styles.tag}>
              <Text style={styles.tagText}>{challenge}</Text>
              <TouchableOpacity onPress={() => removeChallenge(index)}>
                <Icon name="close" size={16} color={BrandColors.text.secondary} />
              </TouchableOpacity>
            </View>
          ))}
        </View>

        {/* Customer Notes */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Customer Notes</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Notes from customer..."
            value={progress.notes}
            onChangeText={(text) => setProgress({ ...progress, notes: text })}
            multiline
            numberOfLines={4}
            placeholderTextColor={BrandColors.text.secondary}
          />
        </View>

        {/* Behaviorist Notes */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Behaviorist Notes *</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Your professional assessment and observations..."
            value={progress.behavioristNotes}
            onChangeText={(text) => setProgress({ ...progress, behavioristNotes: text })}
            multiline
            numberOfLines={6}
            placeholderTextColor={BrandColors.text.secondary}
          />
        </View>

        {/* Next Steps */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Next Steps</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Recommended next steps for the pet owner..."
            value={progress.nextSteps}
            onChangeText={(text) => setProgress({ ...progress, nextSteps: text })}
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
          {loading ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.submitButtonText}>Update Progress</Text>
          )}
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
    marginBottom: Spacing.sm,
  },
  inputRow: {
    flexDirection: 'row',
    marginBottom: Spacing.sm,
  },
  input: {
    flex: 1,
    ...Typography.bodyMedium,
    color: BrandColors.text.primary,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginRight: Spacing.sm,
  },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.md,
    backgroundColor: BrandColors.primary.orange,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    marginRight: Spacing.sm,
    marginBottom: Spacing.sm,
    alignSelf: 'flex-start',
  },
  tagText: {
    ...Typography.bodySmall,
    color: '#2E7D32',
    marginRight: Spacing.xs,
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

