/**
 * Service Detail Screen - Vendor Mobile App
 * View and edit service details
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

type ServiceDetailScreenRouteProp = RouteProp<RootStackParamList, 'ServiceDetail'>;
type ServiceDetailScreenNavigationProp = StackNavigationProp<RootStackParamList, 'ServiceDetail'>;

export default function ServiceDetailScreen() {
  const route = useRoute<ServiceDetailScreenRouteProp>();
  const navigation = useNavigation<ServiceDetailScreenNavigationProp>();
  const { serviceId } = route.params;
  const [loading, setLoading] = useState(true);
  const [service, setService] = useState<any>(null);

  useEffect(() => {
    loadServiceDetails();
  }, [serviceId]);

  const loadServiceDetails = async () => {
    try {
      // TODO: Implement API call
      setService(null);
      setLoading(false);
    } catch (error) {
      console.error('Error loading service:', error);
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

  if (!service) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Service not found</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.serviceName}>{service.name}</Text>
        <Text style={styles.servicePrice}>₹{service.price}</Text>
        <Text style={styles.serviceDescription}>{service.description}</Text>

        <TouchableOpacity
          style={styles.editButton}
          onPress={() => navigation.navigate('EditService', { serviceId: service.id })}
        >
          <Text style={styles.editButtonText}>Edit Service</Text>
        </TouchableOpacity>
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 16,
    color: '#999',
  },
  content: {
    padding: 20,
  },
  serviceName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  servicePrice: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FF8C42',
    marginBottom: 16,
  },
  serviceDescription: {
    fontSize: 16,
    color: '#666',
    lineHeight: 24,
    marginBottom: 24,
  },
  editButton: {
    backgroundColor: '#FF8C42',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  editButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
});

