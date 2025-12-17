/**
 * Bookings Screen - Vendor Mobile App
 * View and manage bookings
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
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../types/navigation';
import Icon from 'react-native-vector-icons/MaterialIcons';

type BookingsScreenNavigationProp = StackNavigationProp<RootStackParamList, 'MainTabs'>;

export default function BookingsScreen() {
  const navigation = useNavigation<BookingsScreenNavigationProp>();
  const [loading, setLoading] = useState(true);
  const [bookings, setBookings] = useState<any[]>([]);

  useEffect(() => {
    loadBookings();
  }, []);

  const loadBookings = async () => {
    try {
      // TODO: Implement API call
      setBookings([]);
      setLoading(false);
    } catch (error) {
      console.error('Error loading bookings:', error);
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Bookings</Text>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#FF8C42" style={styles.loader} />
      ) : bookings.length === 0 ? (
        <View style={styles.emptyState}>
          <Icon name="event-busy" size={64} color="#ccc" />
          <Text style={styles.emptyStateText}>No bookings yet</Text>
        </View>
      ) : (
        <ScrollView style={styles.content}>
          {bookings.map((booking) => (
            <TouchableOpacity
              key={booking.id}
              style={styles.bookingCard}
              onPress={() => navigation.navigate('BookingDetail', { bookingId: booking.id })}
            >
              <View style={styles.bookingHeader}>
                <Text style={styles.bookingService}>{booking.serviceName}</Text>
                <View style={[styles.statusBadge, { backgroundColor: getStatusColor(booking.status) }]}>
                  <Text style={styles.statusText}>{booking.status}</Text>
                </View>
              </View>
              <Text style={styles.bookingCustomer}>{booking.customerName}</Text>
              <Text style={styles.bookingDate}>
                <Icon name="calendar-today" size={16} color="#666" /> {booking.date}
              </Text>
              <Text style={styles.bookingTime}>
                <Icon name="access-time" size={16} color="#666" /> {booking.time}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

function getStatusColor(status: string): string {
  switch (status.toLowerCase()) {
    case 'confirmed':
      return '#4CAF50';
    case 'pending':
      return '#FF9800';
    case 'completed':
      return '#2196F3';
    case 'cancelled':
      return '#F44336';
    default:
      return '#999';
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#FF8C42',
    padding: 20,
    paddingTop: 50,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  loader: {
    marginTop: 50,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  bookingCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  bookingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  bookingService: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  bookingCustomer: {
    fontSize: 16,
    color: '#666',
    marginBottom: 8,
  },
  bookingDate: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  bookingTime: {
    fontSize: 14,
    color: '#666',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  emptyStateText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginTop: 16,
  },
});

