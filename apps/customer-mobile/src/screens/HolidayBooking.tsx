/**
 * Holiday Package Booking Screen - Customer Mobile App
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { BrandColors, Typography, BorderRadius, Spacing } from '../../theme';
import { projectId, getPublicAnonKey } from '../../config/api';
import { useAuth } from '../../context/AuthContext';

export default function HolidayBookingScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const { user } = useAuth();
  const { packageId, package: packageData, selectedDate } = route.params as {
    packageId: string;
    package?: any;
    selectedDate?: string;
  };

  const [packageInfo, setPackageInfo] = useState<any>(packageData);
  const [loading, setLoading] = useState(!packageData);
  const [bookingDate, setBookingDate] = useState(selectedDate || '');
  const [numberOfPets, setNumberOfPets] = useState(1);
  const [numberOfOwners, setNumberOfOwners] = useState(1);
  const [specialRequests, setSpecialRequests] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!packageData) {
      loadPackageDetails();
    }
  }, [packageId]);

  const loadPackageDetails = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/holiday-packages/${packageId}`,
        {
          headers: {
            'Authorization': `Bearer ${getPublicAnonKey()}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setPackageInfo(data.package);
      }
    } catch (error) {
      console.error('Error loading package:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleBook = async () => {
    if (!bookingDate) {
      // Show date picker
      return;
    }

    try {
      setSubmitting(true);
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/holiday-packages/book`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${getPublicAnonKey()}`,
          },
          body: JSON.stringify({
            customerId: user?.id,
            customerPhone: user?.phone,
            packageId,
            bookingDate,
            numberOfPets,
            numberOfOwners,
            specialRequests,
          }),
        }
      );

      if (response.ok) {
        const data = await response.json();
        navigation.navigate('BookingConfirmation' as never, {
          bookingId: data.bookingId,
          bookingData: data.booking,
        } as never);
      } else {
        const error = await response.json();
        // Show error
      }
    } catch (error) {
      console.error('Error booking package:', error);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={BrandColors.primary} />
        </View>
      </View>
    );
  }

  if (!packageInfo) {
    return (
      <View style={styles.container}>
        <Text style={[Typography.h3, styles.errorText]}>Package not found</Text>
      </View>
    );
  }

  const totalAmount = packageInfo.price * numberOfPets;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Icon name="arrow-back" size={24} color={BrandColors.text} />
        </TouchableOpacity>
        <Text style={[Typography.h2, styles.headerTitle]}>Book Package</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.section}>
          <Text style={[Typography.h3, styles.sectionTitle]}>{packageInfo.packageName}</Text>
          <Text style={[Typography.body, styles.destination]}>{packageInfo.destination}</Text>
          <Text style={[Typography.bodySmall, styles.duration]}>
            {packageInfo.duration} {packageInfo.duration === 1 ? 'Day' : 'Days'}
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={[Typography.h3, styles.sectionTitle]}>Booking Date</Text>
          <TouchableOpacity style={styles.dateButton}>
            <Icon name="calendar-today" size={20} color={BrandColors.primary} />
            <Text style={[Typography.body, styles.dateText]}>
              {bookingDate || 'Select Date'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={[Typography.h3, styles.sectionTitle]}>Number of Pets</Text>
          <View style={styles.counterRow}>
            <TouchableOpacity
              style={styles.counterButton}
              onPress={() => setNumberOfPets(Math.max(1, numberOfPets - 1))}
            >
              <Icon name="remove" size={20} color={BrandColors.primary} />
            </TouchableOpacity>
            <Text style={[Typography.h3, styles.counterValue]}>{numberOfPets}</Text>
            <TouchableOpacity
              style={styles.counterButton}
              onPress={() => setNumberOfPets(Math.min(packageInfo.maxPets || 5, numberOfPets + 1))}
            >
              <Icon name="add" size={20} color={BrandColors.primary} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[Typography.h3, styles.sectionTitle]}>Number of Owners</Text>
          <View style={styles.counterRow}>
            <TouchableOpacity
              style={styles.counterButton}
              onPress={() => setNumberOfOwners(Math.max(1, numberOfOwners - 1))}
            >
              <Icon name="remove" size={20} color={BrandColors.primary} />
            </TouchableOpacity>
            <Text style={[Typography.h3, styles.counterValue]}>{numberOfOwners}</Text>
            <TouchableOpacity
              style={styles.counterButton}
              onPress={() => setNumberOfOwners(Math.min(packageInfo.maxOwners || 10, numberOfOwners + 1))}
            >
              <Icon name="add" size={20} color={BrandColors.primary} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[Typography.h3, styles.sectionTitle]}>Special Requests</Text>
          <TextInput
            style={styles.textInput}
            placeholder="Any special requirements or requests..."
            placeholderTextColor={BrandColors.textSecondary}
            multiline
            numberOfLines={4}
            value={specialRequests}
            onChangeText={setSpecialRequests}
          />
        </View>

        <View style={styles.summarySection}>
          <View style={styles.summaryRow}>
            <Text style={[Typography.body, styles.summaryLabel]}>Package Price</Text>
            <Text style={[Typography.body, styles.summaryValue]}>
              ₹{packageInfo.price.toLocaleString('en-IN')} × {numberOfPets}
            </Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={[Typography.h3, styles.summaryLabel]}>Total Amount</Text>
            <Text style={[Typography.h3, styles.summaryValue]}>
              ₹{totalAmount.toLocaleString('en-IN')}
            </Text>
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.bookButton, (!bookingDate || submitting) && styles.bookButtonDisabled]}
          onPress={handleBook}
          disabled={!bookingDate || submitting}
        >
          {submitting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={[Typography.button, styles.bookButtonText]}>
              Book Now - ₹{totalAmount.toLocaleString('en-IN')}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BrandColors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    backgroundColor: BrandColors.surface,
    borderBottomWidth: 1,
    borderBottomColor: BrandColors.border,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    color: BrandColors.text,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    textAlign: 'center',
    marginTop: Spacing.xl,
    color: BrandColors.text,
  },
  content: {
    flex: 1,
  },
  section: {
    padding: Spacing.md,
    backgroundColor: BrandColors.surface,
    marginBottom: Spacing.sm,
  },
  sectionTitle: {
    color: BrandColors.text,
    marginBottom: Spacing.sm,
  },
  destination: {
    color: BrandColors.textSecondary,
    marginTop: 4,
  },
  duration: {
    color: BrandColors.textSecondary,
    marginTop: 4,
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    backgroundColor: BrandColors.background,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: BrandColors.border,
  },
  dateText: {
    marginLeft: Spacing.sm,
    color: BrandColors.text,
  },
  counterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.sm,
  },
  counterButton: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.md,
    backgroundColor: BrandColors.primary + '20',
    justifyContent: 'center',
    alignItems: 'center',
  },
  counterValue: {
    marginHorizontal: Spacing.xl,
    color: BrandColors.text,
  },
  textInput: {
    marginTop: Spacing.sm,
    padding: Spacing.md,
    backgroundColor: BrandColors.background,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: BrandColors.border,
    color: BrandColors.text,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  summarySection: {
    padding: Spacing.md,
    backgroundColor: BrandColors.surface,
    marginTop: Spacing.sm,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: Spacing.sm,
  },
  summaryLabel: {
    color: BrandColors.text,
  },
  summaryValue: {
    color: BrandColors.text,
  },
  footer: {
    padding: Spacing.md,
    backgroundColor: BrandColors.surface,
    borderTopWidth: 1,
    borderTopColor: BrandColors.border,
  },
  bookButton: {
    backgroundColor: BrandColors.primary,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
  },
  bookButtonDisabled: {
    backgroundColor: BrandColors.border,
  },
  bookButtonText: {
    color: '#FFFFFF',
  },
});

