/**
 * Booking Detail Screen - Vendor Mobile App
 * View booking details and manage status
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
import { useRoute } from '@react-navigation/native';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../types/navigation';

type BookingDetailScreenRouteProp = RouteProp<RootStackParamList, 'BookingDetail'>;

export default function BookingDetailScreen() {
  const route = useRoute<BookingDetailScreenRouteProp>();
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
      <View style={styles.content}>
        {booking ? (
          <>
            <Text style={styles.title}>Booking Details</Text>
            {/* Booking details here */}
          </>
        ) : (
          <Text style={styles.errorText}>Booking not found</Text>
        )}
      </View>
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
  content: {
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  errorText: {
    fontSize: 16,
    color: '#999',
  },
});

