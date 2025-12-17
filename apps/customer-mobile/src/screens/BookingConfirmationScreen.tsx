/**
 * Booking Confirmation Screen - Customer Mobile App
 * Show booking confirmation details
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../types/navigation';
import Icon from 'react-native-vector-icons/MaterialIcons';

type BookingConfirmationScreenRouteProp = RouteProp<RootStackParamList, 'BookingConfirmation'>;
type BookingConfirmationScreenNavigationProp = StackNavigationProp<RootStackParamList, 'BookingConfirmation'>;

export default function BookingConfirmationScreen() {
  const route = useRoute<BookingConfirmationScreenRouteProp>();
  const navigation = useNavigation<BookingConfirmationScreenNavigationProp>();
  const { bookingId } = route.params;
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState<any>(null);

  useEffect(() => {
    loadBookingDetails();
  }, [bookingId]);

  const loadBookingDetails = async () => {
    try {
      // TODO: Implement API call
      setBooking(null);
      setLoading(false);
    } catch (error) {
      console.error('Error loading booking:', error);
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FF8C42" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.successIcon}>
        <Icon name="check-circle" size={80} color="#4CAF50" />
      </View>
      <Text style={styles.successTitle}>Booking Confirmed!</Text>
      <Text style={styles.successMessage}>
        Your booking has been confirmed. You will receive a confirmation message shortly.
      </Text>

      {booking && (
        <View style={styles.bookingDetails}>
          <Text style={styles.detailsTitle}>Booking Details</Text>
          {/* Booking details here */}
        </View>
      )}

      <TouchableOpacity
        style={styles.homeButton}
        onPress={() => navigation.navigate('MainTabs')}
      >
        <Text style={styles.homeButtonText}>Go to Home</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  successIcon: {
    alignItems: 'center',
    marginTop: 40,
    marginBottom: 20,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    color: '#333',
    marginBottom: 12,
  },
  successMessage: {
    fontSize: 16,
    textAlign: 'center',
    color: '#666',
    paddingHorizontal: 40,
    marginBottom: 32,
  },
  bookingDetails: {
    padding: 20,
    backgroundColor: '#f9f9f9',
    marginHorizontal: 20,
    borderRadius: 8,
    marginBottom: 32,
  },
  detailsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#333',
  },
  homeButton: {
    backgroundColor: '#FF8C42',
    marginHorizontal: 20,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 40,
  },
  homeButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
});

