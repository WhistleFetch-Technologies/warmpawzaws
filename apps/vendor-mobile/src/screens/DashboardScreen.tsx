/**
 * Dashboard Screen - Vendor Mobile App
 * Overview of bookings, revenue, and key metrics
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

type DashboardScreenNavigationProp = StackNavigationProp<RootStackParamList, 'MainTabs'>;

export default function DashboardScreen() {
  const navigation = useNavigation<DashboardScreenNavigationProp>();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    todayBookings: 0,
    pendingBookings: 0,
    totalRevenue: 0,
    activeServices: 0,
  });

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      // TODO: Implement API call
      // const response = await fetch(`${API_BASE_URL}/vendor/dashboard`);
      // const data = await response.json();
      // setStats(data.stats);
      
      setLoading(false);
    } catch (error) {
      console.error('Error loading dashboard:', error);
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Dashboard</Text>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#FF8C42" style={styles.loader} />
      ) : (
        <>
          {/* Stats Cards */}
          <View style={styles.statsContainer}>
            <View style={styles.statCard}>
              <Icon name="today" size={32} color="#FF8C42" />
              <Text style={styles.statValue}>{stats.todayBookings}</Text>
              <Text style={styles.statLabel}>Today's Bookings</Text>
            </View>

            <View style={styles.statCard}>
              <Icon name="pending" size={32} color="#FF9800" />
              <Text style={styles.statValue}>{stats.pendingBookings}</Text>
              <Text style={styles.statLabel}>Pending</Text>
            </View>
          </View>

          <View style={styles.statsContainer}>
            <View style={styles.statCard}>
              <Icon name="attach-money" size={32} color="#4CAF50" />
              <Text style={styles.statValue}>₹{stats.totalRevenue}</Text>
              <Text style={styles.statLabel}>Total Revenue</Text>
            </View>

            <View style={styles.statCard}>
              <Icon name="room-service" size={32} color="#2196F3" />
              <Text style={styles.statValue}>{stats.activeServices}</Text>
              <Text style={styles.statLabel}>Active Services</Text>
            </View>
          </View>

          {/* Quick Actions */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Quick Actions</Text>
            
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => navigation.navigate('Services')}
            >
              <Icon name="add-circle" size={24} color="#FF8C42" />
              <Text style={styles.actionText}>Add Service</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => navigation.navigate('Bookings')}
            >
              <Icon name="calendar-today" size={24} color="#FF8C42" />
              <Text style={styles.actionText}>View Bookings</Text>
            </TouchableOpacity>
          </View>
        </>
      )}
    </ScrollView>
  );
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
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
  },
  loader: {
    marginTop: 50,
  },
  statsContainer: {
    flexDirection: 'row',
    padding: 16,
    gap: 16,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  section: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#333',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  actionText: {
    marginLeft: 12,
    fontSize: 16,
    color: '#333',
  },
});

