/**
 * Training Session Detail Screen - Customer Mobile App
 * View session details and submit feedback
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
  TextInput,
  Image,
} from 'react-native';
import { BrandedButton } from '../../components/BrandedButton';
import { BrandColors, Typography, BorderRadius, Spacing } from '../../theme';
import TrainingService, { TrainingSession } from '../../services/TrainingService';
import Icon from 'react-native-vector-icons/MaterialIcons';

interface TrainingSessionDetailScreenProps {
  route?: {
    params?: {
      sessionId: string;
    };
  };
  navigation?: any;
}

export default function TrainingSessionDetailScreen({
  route,
  navigation,
}: TrainingSessionDetailScreenProps) {
  const sessionId = route?.params?.sessionId || '';

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [session, setSession] = useState<TrainingSession | null>(null);
  const [feedback, setFeedback] = useState('');
  const [rating, setRating] = useState(0);

  useEffect(() => {
    loadSessionDetails();
  }, [sessionId]);

  const loadSessionDetails = async () => {
    try {
      setLoading(true);
      const sessionData = await TrainingService.getSessionDetails(sessionId);
      if (sessionData) {
        setSession(sessionData);
        if (sessionData.progress?.customerFeedback) {
          setFeedback(sessionData.progress.customerFeedback);
        }
        if (sessionData.progress?.rating) {
          setRating(sessionData.progress.rating);
        }
      } else {
        Alert.alert('Error', 'Session not found');
        navigation?.goBack();
      }
    } catch (error) {
      console.error('Error loading session:', error);
      Alert.alert('Error', 'Failed to load session details');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitFeedback = async () => {
    if (!feedback.trim()) {
      Alert.alert('Required', 'Please provide feedback');
      return;
    }

    if (rating === 0) {
      Alert.alert('Required', 'Please provide a rating');
      return;
    }

    try {
      setSubmitting(true);
      const success = await TrainingService.submitFeedback(sessionId, feedback, rating);
      if (success) {
        Alert.alert('Success', 'Feedback submitted successfully!', [
          {
            text: 'OK',
            onPress: () => loadSessionDetails(),
          },
        ]);
      } else {
        Alert.alert('Error', 'Failed to submit feedback');
      }
    } catch (error) {
      console.error('Error submitting feedback:', error);
      Alert.alert('Error', 'Failed to submit feedback');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={BrandColors.primary.orange} />
        <Text style={[Typography.body, { marginTop: Spacing.base }]}>
          Loading session details...
        </Text>
      </View>
    );
  }

  if (!session) {
    return null;
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
            <Text style={[Typography.h2, styles.headerTitle]}>
              Session {session.sessionNumber}
            </Text>
            <Text style={[Typography.bodySmall, styles.headerSubtitle]}>
              {session.completedDate
                ? new Date(session.completedDate).toLocaleDateString()
                : new Date(session.scheduledDate).toLocaleDateString()}
            </Text>
          </View>
        </View>

        {/* Session Info */}
        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Text style={[Typography.body, styles.infoLabel]}>Status</Text>
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
          <View style={styles.infoRow}>
            <Text style={[Typography.body, styles.infoLabel]}>Duration</Text>
            <Text style={[Typography.body, styles.infoValue]}>{session.duration} minutes</Text>
          </View>
        </View>

        {/* Progress Details */}
        {session.progress && (
          <>
            {session.progress.skillsPracticed && session.progress.skillsPracticed.length > 0 && (
              <View style={styles.section}>
                <Text style={[Typography.h3, styles.sectionTitle]}>Skills Practiced</Text>
                <View style={styles.skillsList}>
                  {session.progress.skillsPracticed.map((skill, index) => (
                    <View key={index} style={styles.skillBadge}>
                      <Text style={[Typography.bodyTiny, styles.skillText]}>{skill}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {session.progress.behaviorObserved && session.progress.behaviorObserved.length > 0 && (
              <View style={styles.section}>
                <Text style={[Typography.h3, styles.sectionTitle]}>Behavior Observed</Text>
                <View style={styles.behaviorsList}>
                  {session.progress.behaviorObserved.map((behavior, index) => (
                    <View key={index} style={styles.behaviorItem}>
                      <Icon name="check-circle" size={16} color={BrandColors.semantic.success} />
                      <Text style={[Typography.bodySmall, styles.behaviorText]}>{behavior}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {session.progress.trainerNotes && (
              <View style={styles.section}>
                <Text style={[Typography.h3, styles.sectionTitle]}>Trainer Notes</Text>
                <Text style={[Typography.body, styles.notesText]}>
                  {session.progress.trainerNotes}
                </Text>
              </View>
            )}

            {session.progress.issuesAddressed && session.progress.issuesAddressed.length > 0 && (
              <View style={styles.section}>
                <Text style={[Typography.h3, styles.sectionTitle]}>Issues Addressed</Text>
                <View style={styles.issuesList}>
                  {session.progress.issuesAddressed.map((issue, index) => (
                    <View key={index} style={styles.issueItem}>
                      <Icon name="warning" size={16} color={BrandColors.semantic.warning} />
                      <Text style={[Typography.bodySmall, styles.issueText]}>{issue}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </>
        )}

        {/* Media */}
        {session.media && session.media.length > 0 && (
          <View style={styles.section}>
            <Text style={[Typography.h3, styles.sectionTitle]}>Session Media</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {session.media.map((media) => (
                <View key={media.mediaId} style={styles.mediaItem}>
                  {media.type === 'photo' ? (
                    <Image source={{ uri: media.url }} style={styles.mediaImage} />
                  ) : (
                    <View style={styles.mediaPlaceholder}>
                      <Icon name="videocam" size={32} color={BrandColors.neutral.gray400} />
                    </View>
                  )}
                  {media.caption && (
                    <Text style={[Typography.bodyTiny, styles.mediaCaption]} numberOfLines={1}>
                      {media.caption}
                    </Text>
                  )}
                </View>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Customer Feedback */}
        {session.status === 'completed' && (
          <View style={styles.section}>
            <Text style={[Typography.h3, styles.sectionTitle]}>Your Feedback</Text>
            <View style={styles.ratingContainer}>
              <Text style={[Typography.bodySmall, styles.ratingLabel]}>Rating</Text>
              <View style={styles.ratingStars}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <TouchableOpacity
                    key={star}
                    onPress={() => setRating(star)}
                    disabled={!!session.progress?.rating}
                  >
                    <Icon
                      name={star <= rating ? 'star' : 'star-border'}
                      size={32}
                      color={
                        star <= rating
                          ? BrandColors.semantic.warning
                          : BrandColors.neutral.gray300
                      }
                    />
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            <TextInput
              style={styles.feedbackInput}
              placeholder="Share your feedback about this session..."
              placeholderTextColor={BrandColors.neutral.gray400}
              value={feedback}
              onChangeText={setFeedback}
              multiline
              numberOfLines={5}
              editable={!session.progress?.customerFeedback}
            />
            {!session.progress?.customerFeedback && (
              <BrandedButton
                title={submitting ? 'Submitting...' : 'Submit Feedback'}
                onPress={handleSubmitFeedback}
                disabled={submitting || !feedback.trim() || rating === 0}
                variant="primary"
                fullWidth
              />
            )}
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
  infoCard: {
    margin: Spacing.lg,
    padding: Spacing.base,
    backgroundColor: BrandColors.neutral.gray50,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: BrandColors.neutral.gray200,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  infoLabel: {
    color: BrandColors.neutral.gray700,
  },
  infoValue: {
    color: BrandColors.neutral.gray900,
    fontWeight: '600',
  },
  statusBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
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
  skillsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  skillBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    backgroundColor: BrandColors.primary.orange + '20',
    borderRadius: BorderRadius.sm,
  },
  skillText: {
    color: BrandColors.primary.orange,
    fontWeight: '600',
  },
  behaviorsList: {
    gap: Spacing.sm,
  },
  behaviorItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  behaviorText: {
    color: BrandColors.neutral.gray700,
    flex: 1,
  },
  notesText: {
    color: BrandColors.neutral.gray700,
    lineHeight: 22,
  },
  issuesList: {
    gap: Spacing.sm,
  },
  issueItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  issueText: {
    color: BrandColors.neutral.gray700,
    flex: 1,
  },
  mediaItem: {
    marginRight: Spacing.base,
    width: 150,
  },
  mediaImage: {
    width: 150,
    height: 150,
    borderRadius: BorderRadius.md,
    backgroundColor: BrandColors.neutral.gray200,
  },
  mediaPlaceholder: {
    width: 150,
    height: 150,
    borderRadius: BorderRadius.md,
    backgroundColor: BrandColors.neutral.gray200,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mediaCaption: {
    color: BrandColors.neutral.gray600,
    marginTop: Spacing.xs,
    textAlign: 'center',
  },
  ratingContainer: {
    marginBottom: Spacing.base,
  },
  ratingLabel: {
    color: BrandColors.neutral.gray700,
    marginBottom: Spacing.sm,
    fontWeight: '600',
  },
  ratingStars: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  feedbackInput: {
    padding: Spacing.base,
    backgroundColor: BrandColors.neutral.gray50,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: BrandColors.neutral.gray200,
    ...Typography.body,
    color: BrandColors.neutral.gray900,
    minHeight: 120,
    textAlignVertical: 'top',
    marginBottom: Spacing.base,
  },
});

