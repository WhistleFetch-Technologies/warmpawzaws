/**
 * Progress View Screen - Customer Mobile App
 * Customer view of behaviorist progress tracking
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { BrandColors, Typography, BorderRadius, Spacing } from '../../theme';
import { API_BASE_URL, getPublicAnonKey } from '../../config/api';
import ErrorHandler from '../../utils/errorHandler';

interface ProgressEntry {
  id: string;
  sessionNumber: number;
  date: string;
  improvements: string[];
  challenges: string[];
  notes: string;
  behavioristNotes?: string;
  nextSteps?: string;
}

interface ProgressData {
  bookingId: string;
  assessment: any;
  sessions: ProgressEntry[];
  overallProgress: number; // 0-100
  milestones: Array<{
    id: string;
    title: string;
    achieved: boolean;
    achievedDate?: string;
  }>;
}

export default function ProgressViewScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const { bookingId } = route.params as { bookingId: string };

  const [progress, setProgress] = useState<ProgressData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProgress();
  }, [bookingId]);

  const loadProgress = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/behaviorist/progress/${bookingId}`, {
        headers: {
          Authorization: `Bearer ${getPublicAnonKey()}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setProgress(data.progress);
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

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={BrandColors.primary.orange} />
      </View>
    );
  }

  if (!progress) {
    return (
      <View style={styles.centerContainer}>
        <Icon name="error-outline" size={64} color={BrandColors.text.secondary} />
        <Text style={styles.errorText}>Progress data not found</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      {/* Overall Progress */}
      <View style={styles.progressCard}>
        <Text style={styles.progressTitle}>Overall Progress</Text>
        <View style={styles.progressBarContainer}>
          <View style={styles.progressBar}>
            <View
              style={[styles.progressBarFill, { width: `${progress.overallProgress}%` }]}
            />
          </View>
          <Text style={styles.progressPercentage}>{progress.overallProgress}%</Text>
        </View>
      </View>

      {/* Milestones */}
      {progress.milestones && progress.milestones.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Milestones</Text>
          {progress.milestones.map((milestone) => (
            <View key={milestone.id} style={styles.milestoneCard}>
              <Icon
                name={milestone.achieved ? 'check-circle' : 'radio-button-unchecked'}
                size={24}
                color={milestone.achieved ? '#4CAF50' : BrandColors.text.secondary}
              />
              <View style={styles.milestoneInfo}>
                <Text style={styles.milestoneTitle}>{milestone.title}</Text>
                {milestone.achieved && milestone.achievedDate && (
                  <Text style={styles.milestoneDate}>
                    Achieved: {new Date(milestone.achievedDate).toLocaleDateString()}
                  </Text>
                )}
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Sessions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Session History</Text>
        {progress.sessions && progress.sessions.length > 0 ? (
          progress.sessions.map((session) => (
            <View key={session.id} style={styles.sessionCard}>
              <View style={styles.sessionHeader}>
                <Text style={styles.sessionNumber}>Session {session.sessionNumber}</Text>
                <Text style={styles.sessionDate}>
                  {new Date(session.date).toLocaleDateString()}
                </Text>
              </View>

              {session.improvements && session.improvements.length > 0 && (
                <View style={styles.sessionSection}>
                  <View style={styles.sessionSectionHeader}>
                    <Icon name="trending-up" size={20} color="#4CAF50" />
                    <Text style={styles.sessionSectionTitle}>Improvements</Text>
                  </View>
                  {session.improvements.map((improvement, index) => (
                    <View key={index} style={styles.listItem}>
                      <Icon name="check" size={16} color="#4CAF50" />
                      <Text style={styles.listItemText}>{improvement}</Text>
                    </View>
                  ))}
                </View>
              )}

              {session.challenges && session.challenges.length > 0 && (
                <View style={styles.sessionSection}>
                  <View style={styles.sessionSectionHeader}>
                    <Icon name="warning" size={20} color="#FF9800" />
                    <Text style={styles.sessionSectionTitle}>Challenges</Text>
                  </View>
                  {session.challenges.map((challenge, index) => (
                    <View key={index} style={styles.listItem}>
                      <Icon name="info" size={16} color="#FF9800" />
                      <Text style={styles.listItemText}>{challenge}</Text>
                    </View>
                  ))}
                </View>
              )}

              {session.notes && (
                <View style={styles.sessionSection}>
                  <Text style={styles.sessionSectionTitle}>Notes</Text>
                  <Text style={styles.sessionNotes}>{session.notes}</Text>
                </View>
              )}

              {session.behavioristNotes && (
                <View style={styles.sessionSection}>
                  <Text style={styles.sessionSectionTitle}>Behaviorist Notes</Text>
                  <Text style={styles.sessionNotes}>{session.behavioristNotes}</Text>
                </View>
              )}

              {session.nextSteps && (
                <View style={styles.sessionSection}>
                  <Text style={styles.sessionSectionTitle}>Next Steps</Text>
                  <Text style={styles.sessionNotes}>{session.nextSteps}</Text>
                </View>
              )}
            </View>
          ))
        ) : (
          <View style={styles.emptyState}>
            <Icon name="event-note" size={64} color={BrandColors.text.secondary} />
            <Text style={styles.emptyText}>No sessions recorded yet</Text>
          </View>
        )}
      </View>

      {/* View Chart Button */}
      <TouchableOpacity
        style={styles.chartButton}
        onPress={() => {
          navigation.navigate('ProgressChart' as never, { bookingId } as never);
        }}
      >
        <Icon name="bar-chart" size={20} color="#FFFFFF" />
        <Text style={styles.chartButtonText}>View Progress Chart</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    ...Typography.bodyMedium,
    color: BrandColors.text.secondary,
    marginTop: Spacing.md,
  },
  progressCard: {
    backgroundColor: '#FFFFFF',
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  progressTitle: {
    ...Typography.headingSmall,
    color: BrandColors.text.primary,
    marginBottom: Spacing.md,
  },
  progressBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  progressBar: {
    flex: 1,
    height: 20,
    backgroundColor: '#E0E0E0',
    borderRadius: BorderRadius.full,
    overflow: 'hidden',
    marginRight: Spacing.md,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: BrandColors.primary.orange,
  },
  progressPercentage: {
    ...Typography.headingSmall,
    color: BrandColors.primary.orange,
    fontWeight: '600',
    minWidth: 50,
    textAlign: 'right',
  },
  section: {
    backgroundColor: '#FFFFFF',
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  sectionTitle: {
    ...Typography.headingSmall,
    color: BrandColors.text.primary,
    marginBottom: Spacing.md,
  },
  milestoneCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    backgroundColor: '#F5F5F5',
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
  },
  milestoneInfo: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  milestoneTitle: {
    ...Typography.bodyMedium,
    color: BrandColors.text.primary,
    fontWeight: '600',
    marginBottom: Spacing.xs,
  },
  milestoneDate: {
    ...Typography.bodySmall,
    color: BrandColors.text.secondary,
  },
  sessionCard: {
    backgroundColor: '#F5F5F5',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
  },
  sessionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
    paddingBottom: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  sessionNumber: {
    ...Typography.headingSmall,
    color: BrandColors.text.primary,
    fontWeight: '600',
  },
  sessionDate: {
    ...Typography.bodySmall,
    color: BrandColors.text.secondary,
  },
  sessionSection: {
    marginBottom: Spacing.md,
  },
  sessionSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  sessionSectionTitle: {
    ...Typography.bodyMedium,
    color: BrandColors.text.primary,
    fontWeight: '600',
    marginLeft: Spacing.xs,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: Spacing.xs,
  },
  listItemText: {
    ...Typography.bodySmall,
    color: BrandColors.text.primary,
    marginLeft: Spacing.xs,
    flex: 1,
  },
  sessionNotes: {
    ...Typography.bodySmall,
    color: BrandColors.text.primary,
    lineHeight: 20,
  },
  emptyState: {
    alignItems: 'center',
    padding: Spacing.xl,
  },
  emptyText: {
    ...Typography.bodyMedium,
    color: BrandColors.text.secondary,
    marginTop: Spacing.md,
  },
  chartButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: BrandColors.primary.orange,
    padding: Spacing.md,
    margin: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  chartButtonText: {
    ...Typography.bodyMedium,
    color: '#FFFFFF',
    fontWeight: '600',
    marginLeft: Spacing.sm,
  },
});

