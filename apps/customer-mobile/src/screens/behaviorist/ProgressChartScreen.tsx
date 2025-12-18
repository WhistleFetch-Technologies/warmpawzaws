/**
 * Progress Chart Screen - Customer Mobile App
 * Visualize behaviorist progress over time
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { useRoute } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { BrandColors, Typography, BorderRadius, Spacing } from '../../theme';
import { API_BASE_URL, getPublicAnonKey } from '../../config/api';
import ErrorHandler from '../../utils/errorHandler';

const { width } = Dimensions.get('window');

interface ProgressData {
  bookingId: string;
  sessions: Array<{
    sessionNumber: number;
    date: string;
    progressScore: number; // 0-100
  }>;
  overallProgress: number;
  milestones: Array<{
    id: string;
    title: string;
    achieved: boolean;
    achievedDate?: string;
  }>;
}

export default function ProgressChartScreen() {
  const route = useRoute();
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

  const renderSimpleChart = () => {
    if (!progress || !progress.sessions || progress.sessions.length === 0) {
      return (
        <View style={styles.emptyChart}>
          <Icon name="bar-chart" size={64} color={BrandColors.text.secondary} />
          <Text style={styles.emptyText}>No progress data available yet</Text>
        </View>
      );
    }

    const maxScore = 100;
    const chartWidth = width - Spacing.md * 4;
    const chartHeight = 200;

    return (
      <View style={styles.chartContainer}>
        <View style={styles.chart}>
          {/* Y-axis labels */}
          <View style={styles.yAxis}>
            <Text style={styles.axisLabel}>100</Text>
            <Text style={styles.axisLabel}>75</Text>
            <Text style={styles.axisLabel}>50</Text>
            <Text style={styles.axisLabel}>25</Text>
            <Text style={styles.axisLabel}>0</Text>
          </View>

          {/* Chart bars */}
          <View style={styles.barsContainer}>
            {progress.sessions.map((session, index) => {
              const barHeight = (session.progressScore / maxScore) * chartHeight;
              return (
                <View key={index} style={styles.barWrapper}>
                  <View style={styles.barContainer}>
                    <View
                      style={[
                        styles.bar,
                        {
                          height: barHeight,
                          backgroundColor:
                            session.progressScore >= 75
                              ? '#4CAF50'
                              : session.progressScore >= 50
                              ? '#FF9800'
                              : '#F44336',
                        },
                      ]}
                    />
                  </View>
                  <Text style={styles.barLabel}>S{session.sessionNumber}</Text>
                  <Text style={styles.barValue}>{session.progressScore}%</Text>
                </View>
              );
            })}
          </View>
        </View>
      </View>
    );
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

      {/* Chart */}
      <View style={styles.chartCard}>
        <Text style={styles.chartTitle}>Progress Over Time</Text>
        {renderSimpleChart()}
      </View>

      {/* Milestones Progress */}
      {progress.milestones && progress.milestones.length > 0 && (
        <View style={styles.milestonesCard}>
          <Text style={styles.milestonesTitle}>Milestones</Text>
          {progress.milestones.map((milestone) => (
            <View key={milestone.id} style={styles.milestoneRow}>
              <Icon
                name={milestone.achieved ? 'check-circle' : 'radio-button-unchecked'}
                size={24}
                color={milestone.achieved ? '#4CAF50' : BrandColors.text.secondary}
              />
              <View style={styles.milestoneInfo}>
                <Text
                  style={[
                    styles.milestoneText,
                    milestone.achieved && styles.milestoneTextAchieved,
                  ]}
                >
                  {milestone.title}
                </Text>
                {milestone.achieved && milestone.achievedDate && (
                  <Text style={styles.milestoneDate}>
                    {new Date(milestone.achievedDate).toLocaleDateString()}
                  </Text>
                )}
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Session Details */}
      <View style={styles.sessionsCard}>
        <Text style={styles.sessionsTitle}>Session Progress</Text>
        {progress.sessions.map((session, index) => (
          <View key={index} style={styles.sessionRow}>
            <View style={styles.sessionInfo}>
              <Text style={styles.sessionLabel}>Session {session.sessionNumber}</Text>
              <Text style={styles.sessionDate}>
                {new Date(session.date).toLocaleDateString()}
              </Text>
            </View>
            <View style={styles.sessionProgress}>
              <View style={styles.sessionProgressBar}>
                <View
                  style={[
                    styles.sessionProgressFill,
                    {
                      width: `${session.progressScore}%`,
                      backgroundColor:
                        session.progressScore >= 75
                          ? '#4CAF50'
                          : session.progressScore >= 50
                          ? '#FF9800'
                          : '#F44336',
                    },
                  ]}
                />
              </View>
              <Text style={styles.sessionScore}>{session.progressScore}%</Text>
            </View>
          </View>
        ))}
      </View>
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
    height: 24,
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
  chartCard: {
    backgroundColor: '#FFFFFF',
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  chartTitle: {
    ...Typography.headingSmall,
    color: BrandColors.text.primary,
    marginBottom: Spacing.md,
  },
  chartContainer: {
    marginTop: Spacing.md,
  },
  chart: {
    flexDirection: 'row',
    height: 250,
  },
  yAxis: {
    width: 30,
    justifyContent: 'space-between',
    paddingRight: Spacing.sm,
  },
  axisLabel: {
    ...Typography.bodyTiny,
    color: BrandColors.text.secondary,
  },
  barsContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-around',
    paddingHorizontal: Spacing.sm,
  },
  barWrapper: {
    alignItems: 'center',
    flex: 1,
  },
  barContainer: {
    height: 200,
    justifyContent: 'flex-end',
    width: 40,
  },
  bar: {
    width: 30,
    borderRadius: BorderRadius.sm,
    marginHorizontal: 5,
  },
  barLabel: {
    ...Typography.bodyTiny,
    color: BrandColors.text.secondary,
    marginTop: Spacing.xs,
  },
  barValue: {
    ...Typography.bodyTiny,
    color: BrandColors.text.primary,
    fontWeight: '600',
    marginTop: 2,
  },
  emptyChart: {
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    ...Typography.bodyMedium,
    color: BrandColors.text.secondary,
    marginTop: Spacing.md,
  },
  milestonesCard: {
    backgroundColor: '#FFFFFF',
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  milestonesTitle: {
    ...Typography.headingSmall,
    color: BrandColors.text.primary,
    marginBottom: Spacing.md,
  },
  milestoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  milestoneInfo: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  milestoneText: {
    ...Typography.bodyMedium,
    color: BrandColors.text.primary,
  },
  milestoneTextAchieved: {
    textDecorationLine: 'line-through',
    color: BrandColors.text.secondary,
  },
  milestoneDate: {
    ...Typography.bodySmall,
    color: BrandColors.text.secondary,
    marginTop: Spacing.xs,
  },
  sessionsCard: {
    backgroundColor: '#FFFFFF',
    padding: Spacing.md,
    marginBottom: Spacing.lg,
  },
  sessionsTitle: {
    ...Typography.headingSmall,
    color: BrandColors.text.primary,
    marginBottom: Spacing.md,
  },
  sessionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  sessionInfo: {
    flex: 1,
  },
  sessionLabel: {
    ...Typography.bodyMedium,
    color: BrandColors.text.primary,
    fontWeight: '600',
    marginBottom: Spacing.xs,
  },
  sessionDate: {
    ...Typography.bodySmall,
    color: BrandColors.text.secondary,
  },
  sessionProgress: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 120,
  },
  sessionProgressBar: {
    flex: 1,
    height: 8,
    backgroundColor: '#E0E0E0',
    borderRadius: BorderRadius.full,
    overflow: 'hidden',
    marginRight: Spacing.sm,
  },
  sessionProgressFill: {
    height: '100%',
  },
  sessionScore: {
    ...Typography.bodySmall,
    color: BrandColors.text.primary,
    fontWeight: '600',
    minWidth: 40,
    textAlign: 'right',
  },
});

