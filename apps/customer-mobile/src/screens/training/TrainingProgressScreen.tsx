/**
 * Training Progress Screen - Customer Mobile App
 * View training package progress and milestones
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { BrandedButton } from '../../components/BrandedButton';
import { BrandColors, Typography, BorderRadius, Spacing } from '../../theme';
import TrainingService, { TrainingProgress } from '../../services/TrainingService';
import Icon from 'react-native-vector-icons/MaterialIcons';

interface TrainingProgressScreenProps {
  route?: {
    params?: {
      packageId: string;
    };
  };
  navigation?: any;
}

export default function TrainingProgressScreen({
  route,
  navigation,
}: TrainingProgressScreenProps) {
  const packageId = route?.params?.packageId || '';

  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState<TrainingProgress | null>(null);

  useEffect(() => {
    loadProgress();
  }, [packageId]);

  const loadProgress = async () => {
    try {
      setLoading(true);
      const progressData = await TrainingService.getPackageProgress(packageId);
      if (progressData) {
        setProgress(progressData);
      } else {
        Alert.alert('Error', 'Failed to load progress');
      }
    } catch (error) {
      console.error('Error loading progress:', error);
      Alert.alert('Error', 'Failed to load training progress');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={BrandColors.primary.orange} />
        <Text style={[Typography.body, { marginTop: Spacing.base }]}>
          Loading progress...
        </Text>
      </View>
    );
  }

  if (!progress) {
    return (
      <View style={styles.errorContainer}>
        <Icon name="error-outline" size={64} color={BrandColors.semantic.error} />
        <Text style={[Typography.h3, styles.errorText]}>Progress not found</Text>
        <BrandedButton
          title="Go Back"
          onPress={() => navigation?.goBack()}
          variant="primary"
          fullWidth
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation?.goBack()}
          >
            <Icon name="arrow-back" size={24} color={BrandColors.primary.orange} />
          </TouchableOpacity>
          <View style={styles.headerContent}>
            <Text style={[Typography.h2, styles.headerTitle]}>{progress.packageName}</Text>
            <Text style={[Typography.bodySmall, styles.headerSubtitle]}>
              Training Progress
            </Text>
          </View>
        </View>

        {/* Progress Overview */}
        <View style={styles.progressCard}>
          <View style={styles.progressHeader}>
            <View style={styles.progressInfo}>
              <Text style={[Typography.h3, styles.progressTitle]}>Overall Progress</Text>
              <Text style={[Typography.h1, styles.progressPercentage]}>
                {progress.overallProgress}%
              </Text>
            </View>
            <View style={styles.progressCircle}>
              <View
                style={[
                  styles.progressRing,
                  {
                    borderColor: BrandColors.primary.orange,
                    borderWidth: 8,
                  },
                ]}
              />
            </View>
          </View>
          <View style={styles.progressStats}>
            <View style={styles.statItem}>
              <Text style={[Typography.bodySmall, styles.statLabel]}>Sessions</Text>
              <Text style={[Typography.h4, styles.statValue]}>
                {progress.completedSessions}/{progress.totalSessions}
              </Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[Typography.bodySmall, styles.statLabel]}>Rating</Text>
              <View style={styles.ratingRow}>
                <Icon name="star" size={20} color={BrandColors.semantic.warning} />
                <Text style={[Typography.h4, styles.statValue]}>
                  {progress.averageRating.toFixed(1)}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Milestones */}
        {progress.milestones && progress.milestones.length > 0 && (
          <View style={styles.section}>
            <Text style={[Typography.h3, styles.sectionTitle]}>Milestones</Text>
            <View style={styles.milestonesList}>
              {progress.milestones.map((milestone) => (
                <View
                  key={milestone.milestoneId}
                  style={[
                    styles.milestoneCard,
                    milestone.status === 'achieved' && styles.milestoneCardAchieved,
                  ]}
                >
                  <View style={styles.milestoneHeader}>
                    <View style={styles.milestoneIcon}>
                      {milestone.status === 'achieved' ? (
                        <Icon name="check-circle" size={24} color={BrandColors.semantic.success} />
                      ) : milestone.status === 'in_progress' ? (
                        <Icon name="radio-button-checked" size={24} color={BrandColors.primary.orange} />
                      ) : (
                        <Icon name="radio-button-unchecked" size={24} color={BrandColors.neutral.gray400} />
                      )}
                    </View>
                    <View style={styles.milestoneInfo}>
                      <Text style={[Typography.h4, styles.milestoneName]}>
                        {milestone.milestoneName}
                      </Text>
                      <Text style={[Typography.bodySmall, styles.milestoneDescription]}>
                        {milestone.description}
                      </Text>
                    </View>
                  </View>
                  {milestone.status === 'achieved' && milestone.achievedDate && (
                    <Text style={[Typography.bodyTiny, styles.milestoneDate]}>
                      Achieved: {new Date(milestone.achievedDate).toLocaleDateString()}
                    </Text>
                  )}
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Skills Progress */}
        {progress.skillsProgress && progress.skillsProgress.length > 0 && (
          <View style={styles.section}>
            <Text style={[Typography.h3, styles.sectionTitle]}>Skills Progress</Text>
            <View style={styles.skillsList}>
              {progress.skillsProgress.map((skill, index) => (
                <View key={index} style={styles.skillCard}>
                  <View style={styles.skillHeader}>
                    <Text style={[Typography.body, styles.skillName]}>{skill.skillName}</Text>
                    <Text style={[Typography.bodySmall, styles.skillProgress]}>
                      {skill.progress}%
                    </Text>
                  </View>
                  <View style={styles.progressBar}>
                    <View
                      style={[
                        styles.progressBarFill,
                        { width: `${skill.progress}%` },
                      ]}
                    />
                  </View>
                  <Text style={[Typography.bodyTiny, styles.skillLastPracticed]}>
                    Last practiced: {new Date(skill.lastPracticed).toLocaleDateString()}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Sessions */}
        {progress.sessions && progress.sessions.length > 0 && (
          <View style={styles.section}>
            <Text style={[Typography.h3, styles.sectionTitle]}>Sessions</Text>
            <View style={styles.sessionsList}>
              {progress.sessions.map((session) => (
                <TouchableOpacity
                  key={session.sessionId}
                  style={styles.sessionCard}
                  onPress={() =>
                    navigation?.navigate('TrainingSessionDetail', { sessionId: session.sessionId })
                  }
                >
                  <View style={styles.sessionHeader}>
                    <View style={styles.sessionInfo}>
                      <Text style={[Typography.body, styles.sessionNumber]}>
                        Session {session.sessionNumber}
                      </Text>
                      <Text style={[Typography.bodySmall, styles.sessionDate]}>
                        {session.completedDate
                          ? new Date(session.completedDate).toLocaleDateString()
                          : new Date(session.scheduledDate).toLocaleDateString()}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.statusBadge,
                        {
                          backgroundColor:
                            session.status === 'completed'
                              ? BrandColors.semantic.success + '20'
                              : session.status === 'scheduled'
                              ? BrandColors.semantic.warning + '20'
                              : BrandColors.neutral.gray200,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          Typography.bodyTiny,
                          {
                            color:
                              session.status === 'completed'
                                ? BrandColors.semantic.success
                                : session.status === 'scheduled'
                                ? BrandColors.semantic.warning
                                : BrandColors.neutral.gray600,
                          },
                        ]}
                      >
                        {session.status.toUpperCase()}
                      </Text>
                    </View>
                  </View>
                  {session.progress && session.progress.skillsPracticed && (
                    <Text style={[Typography.bodyTiny, styles.sessionSkills]} numberOfLines={1}>
                      Skills: {session.progress.skillsPracticed.join(', ')}
                    </Text>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  errorText: {
    color: BrandColors.semantic.error,
    marginTop: Spacing.base,
    marginBottom: Spacing.xl,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: Spacing.xl,
  },
  header: {
    padding: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: BrandColors.neutral.gray200,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.base,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    color: BrandColors.neutral.gray900,
    marginBottom: Spacing.xs,
  },
  headerSubtitle: {
    color: BrandColors.neutral.gray600,
  },
  progressCard: {
    margin: Spacing.lg,
    padding: Spacing.base,
    backgroundColor: BrandColors.primary.orange + '10',
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: BrandColors.primary.orange + '30',
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.base,
  },
  progressInfo: {
    flex: 1,
  },
  progressTitle: {
    color: BrandColors.neutral.gray900,
    marginBottom: Spacing.xs,
  },
  progressPercentage: {
    color: BrandColors.primary.orange,
    fontWeight: '700',
  },
  progressCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressRing: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  progressStats: {
    flexDirection: 'row',
    gap: Spacing.base,
    marginTop: Spacing.base,
    paddingTop: Spacing.base,
    borderTopWidth: 1,
    borderTopColor: BrandColors.neutral.gray200,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statLabel: {
    color: BrandColors.neutral.gray700,
    marginBottom: Spacing.xs,
  },
  statValue: {
    color: BrandColors.neutral.gray900,
    fontWeight: '600',
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  section: {
    padding: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: BrandColors.neutral.gray200,
  },
  sectionTitle: {
    color: BrandColors.neutral.gray900,
    marginBottom: Spacing.base,
  },
  milestonesList: {
    gap: Spacing.base,
  },
  milestoneCard: {
    padding: Spacing.base,
    backgroundColor: BrandColors.neutral.gray50,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: BrandColors.neutral.gray200,
  },
  milestoneCardAchieved: {
    borderColor: BrandColors.semantic.success,
    backgroundColor: BrandColors.semantic.success + '10',
  },
  milestoneHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.base,
  },
  milestoneIcon: {
    marginTop: Spacing.xs,
  },
  milestoneInfo: {
    flex: 1,
  },
  milestoneName: {
    color: BrandColors.neutral.gray900,
    marginBottom: Spacing.xs,
  },
  milestoneDescription: {
    color: BrandColors.neutral.gray600,
  },
  milestoneDate: {
    color: BrandColors.semantic.success,
    marginTop: Spacing.xs,
    fontWeight: '600',
  },
  skillsList: {
    gap: Spacing.base,
  },
  skillCard: {
    padding: Spacing.base,
    backgroundColor: BrandColors.neutral.gray50,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: BrandColors.neutral.gray200,
  },
  skillHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  skillName: {
    color: BrandColors.neutral.gray900,
    fontWeight: '600',
  },
  skillProgress: {
    color: BrandColors.primary.orange,
    fontWeight: '600',
  },
  progressBar: {
    height: 8,
    backgroundColor: BrandColors.neutral.gray200,
    borderRadius: BorderRadius.sm,
    overflow: 'hidden',
    marginBottom: Spacing.xs,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: BrandColors.primary.orange,
  },
  skillLastPracticed: {
    color: BrandColors.neutral.gray600,
  },
  sessionsList: {
    gap: Spacing.base,
  },
  sessionCard: {
    padding: Spacing.base,
    backgroundColor: BrandColors.neutral.gray50,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: BrandColors.neutral.gray200,
  },
  sessionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.sm,
  },
  sessionInfo: {
    flex: 1,
  },
  sessionNumber: {
    color: BrandColors.neutral.gray900,
    fontWeight: '600',
    marginBottom: Spacing.xs,
  },
  sessionDate: {
    color: BrandColors.neutral.gray600,
  },
  statusBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
  },
  sessionSkills: {
    color: BrandColors.neutral.gray600,
  },
});

