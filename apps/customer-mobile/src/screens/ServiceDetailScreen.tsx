/**
 * Service Detail Screen - Customer Mobile App
 * Service details and booking
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
} from 'react-native';
import { BrandedButton } from '../../components/BrandedButton';
import { BrandColors, Typography, BorderRadius, Spacing } from '../../theme';
import Icon from 'react-native-vector-icons/MaterialIcons';

interface ServiceDetailScreenProps {
  route?: {
    params?: {
      serviceId?: string;
      serviceName?: string;
    };
  };
  navigation?: any;
}

export default function ServiceDetailScreen({ route, navigation }: ServiceDetailScreenProps) {
  const serviceId = route?.params?.serviceId;
  const serviceName = route?.params?.serviceName || 'Service';

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <Text style={[Typography.h2, styles.title]}>{serviceName}</Text>
        <Text style={[Typography.body, styles.description]}>
          Service details will be displayed here
        </Text>
        <BrandedButton
          title="Book Now"
          onPress={() => navigation?.navigate('TimeSlotSelection', { serviceId })}
          fullWidth
          style={styles.bookButton}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.lg,
    paddingBottom: Spacing.xl,
  },
  title: {
    color: BrandColors.neutral.gray900,
    marginBottom: Spacing.base,
  },
  description: {
    color: BrandColors.neutral.gray600,
    marginBottom: Spacing.xl,
  },
  bookButton: {
    marginTop: Spacing.base,
  },
});

