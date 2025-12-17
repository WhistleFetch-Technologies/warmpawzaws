/**
 * Home Screen - Customer Mobile App
 * Main landing screen with featured services and quick actions
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../types/navigation';
import { API_BASE_URL } from '../config/api';
import Icon from 'react-native-vector-icons/MaterialIcons';

type HomeScreenNavigationProp = StackNavigationProp<RootStackParamList, 'MainTabs'>;

export default function HomeScreen() {
  const navigation = useNavigation<HomeScreenNavigationProp>();
  const [loading, setLoading] = useState(true);
  const [featuredServices, setFeaturedServices] = useState<any[]>([]);

  useEffect(() => {
    loadFeaturedServices();
  }, []);

  const loadFeaturedServices = async () => {
    try {
      // TODO: Implement API call to fetch featured services
      // const response = await fetch(`${API_BASE_URL}/customer/featured-services`);
      // const data = await response.json();
      // setFeaturedServices(data.services);
      
      // Placeholder data
      setFeaturedServices([]);
      setLoading(false);
    } catch (error) {
      console.error('Error loading featured services:', error);
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Warmpawz</Text>
        <Text style={styles.headerSubtitle}>Your pet care companion</Text>
      </View>

      {/* Quick Actions */}
      <View style={styles.quickActions}>
        <TouchableOpacity
          style={styles.quickActionButton}
          onPress={() => navigation.navigate('Search')}
        >
          <Icon name="search" size={24} color="#FF8C42" />
          <Text style={styles.quickActionText}>Find Services</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.quickActionButton}
          onPress={() => navigation.navigate('Bookings')}
        >
          <Icon name="calendar-today" size={24} color="#FF8C42" />
          <Text style={styles.quickActionText}>My Bookings</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.quickActionButton}
          onPress={() => navigation.navigate('Profile')}
        >
          <Icon name="pets" size={24} color="#FF8C42" />
          <Text style={styles.quickActionText}>My Pets</Text>
        </TouchableOpacity>
      </View>

      {/* Featured Services */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Featured Services</Text>
        {loading ? (
          <ActivityIndicator size="large" color="#FF8C42" />
        ) : featuredServices.length === 0 ? (
          <View style={styles.emptyState}>
            <Icon name="info" size={48} color="#ccc" />
            <Text style={styles.emptyStateText}>No featured services available</Text>
          </View>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {featuredServices.map((service) => (
              <TouchableOpacity
                key={service.id}
                style={styles.serviceCard}
                onPress={() => navigation.navigate('ServiceDetail', { serviceId: service.id })}
              >
                <Image source={{ uri: service.image }} style={styles.serviceImage} />
                <Text style={styles.serviceName}>{service.name}</Text>
                <Text style={styles.servicePrice}>₹{service.price}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
      </View>
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
  headerSubtitle: {
    fontSize: 16,
    color: '#fff',
    marginTop: 4,
  },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 20,
    backgroundColor: '#fff',
  },
  quickActionButton: {
    alignItems: 'center',
    padding: 10,
  },
  quickActionText: {
    marginTop: 8,
    fontSize: 12,
    color: '#333',
  },
  section: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#333',
  },
  serviceCard: {
    width: 200,
    backgroundColor: '#fff',
    borderRadius: 12,
    marginRight: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  serviceImage: {
    width: '100%',
    height: 120,
    backgroundColor: '#f0f0f0',
  },
  serviceName: {
    fontSize: 16,
    fontWeight: '600',
    padding: 12,
    color: '#333',
  },
  servicePrice: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FF8C42',
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  emptyState: {
    alignItems: 'center',
    padding: 40,
  },
  emptyStateText: {
    marginTop: 16,
    fontSize: 16,
    color: '#999',
  },
});

