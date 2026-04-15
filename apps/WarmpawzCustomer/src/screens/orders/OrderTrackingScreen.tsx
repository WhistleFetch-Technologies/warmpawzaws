/**
 * Order Tracking Screen - Mobile
 * Track order delivery status with timeline
 * Identical functionality to web app
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { ScreenShell } from '../../components/layout/ScreenShell';
import { colors, spacing, borderRadius } from '../../theme/colors';
import { CustomerApi } from '../../services/api';

interface OrderTrackingScreenProps {
  orderId: string;
  phone: string;
  onBack: () => void;
  onNavigate?: (screen: string, data?: any) => void;
}

interface TrackingEvent {
  id: string;
  status: string;
  label: string;
  timestamp: string;
  description?: string;
  completed: boolean;
}

interface DeliveryAgent {
  name: string;
  phone: string;
  vehicleNumber?: string;
}

export function OrderTrackingScreen({
  orderId,
  phone,
  onBack,
  onNavigate,
}: OrderTrackingScreenProps) {
  const [order, setOrder] = useState<any>(null);
  const [trackingEvents, setTrackingEvents] = useState<TrackingEvent[]>([]);
  const [deliveryAgent, setDeliveryAgent] = useState<DeliveryAgent | null>(null);
  const [estimatedDelivery, setEstimatedDelivery] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadOrderTracking();
  }, [orderId]);

  const loadOrderTracking = async () => {
    try {
      setLoading(true);
      // Use the newly added getOrderTracking method
      const response = await CustomerApi.getOrderTracking(orderId);
      
      setOrder(response.order || response);
      setTrackingEvents(response.trackingEvents || response.tracking?.steps || generateTrackingEvents(response.order || response));
      setDeliveryAgent(response.deliveryAgent || response.tracking?.deliveryPartner || null);
      setEstimatedDelivery(response.estimatedDelivery || response.tracking?.estimatedDelivery || '');
    } catch (error) {
      console.error('Error loading order tracking:', error);
      Alert.alert('Error', 'Failed to load order tracking');
    } finally {
      setLoading(false);
    }
  };

  const generateTrackingEvents = (orderData: any): TrackingEvent[] => {
    // Check if it's a meal plan order
    const isMealPlan = orderData.order_type === 'meal_plan_delivery' || 
                       orderData.orderType === 'meal_plan_delivery' ||
                       orderData.service_type === 'meal_plan';

    const events: TrackingEvent[] = isMealPlan ? [
      {
        id: '1',
        status: 'ordered',
        label: 'Order Placed',
        timestamp: orderData.createdAt || orderData.created_at || new Date().toISOString(),
        description: 'Your meal plan order has been placed',
        completed: true,
      },
      {
        id: '2',
        status: 'confirmed',
        label: 'Order Confirmed',
        timestamp: orderData.confirmedAt || orderData.confirmed_at || new Date().toISOString(),
        description: 'Order confirmed and payment received',
        completed: orderData.status !== 'pending',
      },
      {
        id: '3',
        status: 'preparing',
        label: 'Preparing Meal Plan',
        timestamp: orderData.processingAt || orderData.processing_at || new Date().toISOString(),
        description: 'Your meal plan is being prepared',
        completed: ['out_for_delivery', 'delivered'].includes(orderData.status),
      },
      {
        id: '4',
        status: 'out_for_delivery',
        label: 'Out for Delivery',
        timestamp: orderData.outForDeliveryAt || orderData.out_for_delivery_at || new Date().toISOString(),
        description: 'Your meal plan is on the way',
        completed: orderData.status === 'delivered',
      },
      {
        id: '5',
        status: 'delivered',
        label: 'Delivered',
        timestamp: orderData.deliveredAt || orderData.delivered_at || new Date().toISOString(),
        description: 'Meal plan has been delivered',
        completed: orderData.status === 'delivered',
      },
    ] : [
      {
        id: '1',
        status: 'ordered',
        label: 'Order Placed',
        timestamp: orderData.createdAt || new Date().toISOString(),
        description: 'Your order has been placed',
        completed: true,
      },
      {
        id: '2',
        status: 'confirmed',
        label: 'Order Confirmed',
        timestamp: orderData.confirmedAt || new Date().toISOString(),
        description: 'Order confirmed by vendor',
        completed: orderData.status !== 'pending',
      },
      {
        id: '3',
        status: 'processing',
        label: 'Processing',
        timestamp: orderData.processingAt || new Date().toISOString(),
        description: 'Your order is being prepared',
        completed: ['shipped', 'out_for_delivery', 'delivered'].includes(orderData.status),
      },
      {
        id: '4',
        status: 'shipped',
        label: 'Shipped',
        timestamp: orderData.shippedAt || new Date().toISOString(),
        description: 'Order has been shipped',
        completed: ['out_for_delivery', 'delivered'].includes(orderData.status),
      },
      {
        id: '5',
        status: 'out_for_delivery',
        label: 'Out for Delivery',
        timestamp: orderData.outForDeliveryAt || new Date().toISOString(),
        description: 'Order is out for delivery',
        completed: orderData.status === 'delivered',
      },
      {
        id: '6',
        status: 'delivered',
        label: 'Delivered',
        timestamp: orderData.deliveredAt || new Date().toISOString(),
        description: 'Order has been delivered',
        completed: orderData.status === 'delivered',
      },
    ];

    return events;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleCallAgent = () => {
    if (deliveryAgent?.phone) {
      Alert.alert(
        'Call Delivery Agent',
        `Call ${deliveryAgent.name}?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Call',
            onPress: () => {
              // TODO: Implement phone call
              Alert.alert('Call', `Calling ${deliveryAgent?.phone}`);
            },
          },
        ]
      );
    }
  };

  if (loading) {
    return (
      <ScreenShell style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </ScreenShell>
    );
  }

  return (
    <ScreenShell style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Order Tracking</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Order Info */}
        <View style={styles.orderInfo}>
          <Text style={styles.orderId}>Order #{orderId}</Text>
          {estimatedDelivery && (
            <Text style={styles.estimatedDelivery}>
              Estimated Delivery: {formatDate(estimatedDelivery)}
            </Text>
          )}
        </View>

        {/* Tracking Timeline */}
        <View style={styles.timelineContainer}>
          <Text style={styles.sectionTitle}>Tracking Status</Text>
          {trackingEvents.map((event, index) => (
            <View key={event.id} style={styles.timelineItem}>
              <View style={styles.timelineLine}>
                <View
                  style={[
                    styles.timelineDot,
                    event.completed && styles.timelineDotCompleted,
                  ]}
                >
                  {event.completed && (
                    <Text style={styles.timelineCheck}>✓</Text>
                  )}
                </View>
                {index < trackingEvents.length - 1 && (
                  <View
                    style={[
                      styles.timelineConnector,
                      event.completed && styles.timelineConnectorCompleted,
                    ]}
                  />
                )}
              </View>
              <View style={styles.timelineContent}>
                <Text
                  style={[
                    styles.timelineLabel,
                    event.completed && styles.timelineLabelCompleted,
                  ]}
                >
                  {event.label}
                </Text>
                {event.description && (
                  <Text style={styles.timelineDescription}>
                    {event.description}
                  </Text>
                )}
                <Text style={styles.timelineTime}>
                  {formatDate(event.timestamp)}
                </Text>
              </View>
            </View>
          ))}
        </View>

        {/* Delivery Agent */}
        {deliveryAgent && (
          <View style={styles.agentContainer}>
            <Text style={styles.sectionTitle}>Delivery Agent</Text>
            <View style={styles.agentCard}>
              <View style={styles.agentInfo}>
                <Text style={styles.agentName}>{deliveryAgent.name}</Text>
                <Text style={styles.agentPhone}>{deliveryAgent.phone}</Text>
                {deliveryAgent.vehicleNumber && (
                  <Text style={styles.agentVehicle}>
                    Vehicle: {deliveryAgent.vehicleNumber}
                  </Text>
                )}
              </View>
              <TouchableOpacity
                style={styles.callButton}
                onPress={handleCallAgent}
              >
                <Text style={styles.callButtonIcon}>📞</Text>
                <Text style={styles.callButtonText}>Call</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Order Details Link */}
        <TouchableOpacity
          style={styles.viewOrderButton}
          onPress={() => onNavigate && onNavigate('OrderDetail', { orderId })}
        >
          <Text style={styles.viewOrderButtonText}>View Order Details</Text>
        </TouchableOpacity>
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    padding: spacing.xs,
  },
  backButtonText: {
    fontSize: 16,
    color: colors.primary,
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
  },
  placeholder: {
    width: 60,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    padding: spacing.md,
  },
  orderInfo: {
    backgroundColor: colors.white,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  orderId: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  estimatedDelivery: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  timelineContainer: {
    backgroundColor: colors.white,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: spacing.md,
  },
  timelineItem: {
    flexDirection: 'row',
    marginBottom: spacing.lg,
  },
  timelineLine: {
    alignItems: 'center',
    marginRight: spacing.md,
  },
  timelineDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.gray['200'],
    alignItems: 'center',
    justifyContent: 'center',
  },
  timelineDotCompleted: {
    backgroundColor: colors.primary,
  },
  timelineCheck: {
    color: colors.white,
    fontSize: 16,
    fontWeight: 'bold',
  },
  timelineConnector: {
    width: 2,
    height: 40,
    backgroundColor: colors.gray['200'],
    marginTop: spacing.xs,
  },
  timelineConnectorCompleted: {
    backgroundColor: colors.primary,
  },
  timelineContent: {
    flex: 1,
  },
  timelineLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  timelineLabelCompleted: {
    color: colors.text,
  },
  timelineDescription: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  timelineTime: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  agentContainer: {
    marginBottom: spacing.lg,
  },
  agentCard: {
    backgroundColor: colors.white,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  agentInfo: {
    flex: 1,
  },
  agentName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  agentPhone: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  agentVehicle: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  callButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  callButtonIcon: {
    fontSize: 20,
    marginBottom: spacing.xs / 2,
  },
  callButtonText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '600',
  },
  viewOrderButton: {
    backgroundColor: colors.primary,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  viewOrderButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: 'bold',
  },
});
