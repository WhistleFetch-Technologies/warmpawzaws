/**
 * VendorTrackingPopup - Mobile-optimized tracking popup for customer app
 * 
 * Shows when vendor starts travel with:
 * - Live GPS tracking
 * - ETA updates
 * - Vendor/Staff details (phone, qualifications, profile)
 * - Appointment purpose and details
 * - Mobile-optimized design
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
  Image,
  Linking,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { colors, spacing, borderRadius, typography } from '../../theme/colors';
import { CustomerApi } from '../../services/api';

const { width, height } = Dimensions.get('window');

interface VendorTrackingPopupProps {
  visible: boolean;
  bookingId: string;
  trackingSessionId: string;
  vendorName: string;
  vendorPhone?: string;
  customerAddress: string;
  serviceName?: string;
  appointmentDate?: string;
  appointmentTime?: string;
  purpose?: string;
  staffName?: string;
  staffPhone?: string;
  staffQualifications?: string;
  staffPhoto?: string;
  vendorPhoto?: string;
  onClose: () => void;
  onVendorArrived?: () => void;
}

interface TrackingStatus {
  status: 'started' | 'in_transit' | 'arrived' | 'completed';
  currentLocation?: {
    latitude: number;
    longitude: number;
  };
  estimatedEtaMinutes?: number;
  distanceKm?: number;
  vendorName: string;
  bookingDetails?: {
    serviceName?: string;
    appointmentDate?: string;
    appointmentTime?: string;
    purpose?: string;
  };
  vendorDetails?: {
    phone?: string;
    photo?: string;
  };
  staffDetails?: {
    name?: string;
    phone?: string;
    qualifications?: string;
    photo?: string;
  };
}

export function VendorTrackingPopup({
  visible,
  bookingId,
  trackingSessionId,
  vendorName,
  vendorPhone,
  customerAddress,
  serviceName,
  appointmentDate,
  appointmentTime,
  purpose,
  staffName,
  staffPhone,
  staffQualifications,
  staffPhoto,
  vendorPhoto,
  onClose,
  onVendorArrived,
}: VendorTrackingPopupProps) {
  const [trackingStatus, setTrackingStatus] = useState<TrackingStatus | null>(null);
  const [bookingDetails, setBookingDetails] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Load booking details on mount
  useEffect(() => {
    if (visible && bookingId) {
      loadBookingDetails();
    }
  }, [visible, bookingId]);

  const loadBookingDetails = async () => {
    try {
      const response = await CustomerApi.getBookingDetails(bookingId);
      if (response.booking) {
        setBookingDetails(response.booking);
      }
    } catch (error) {
      console.error('Error loading booking details:', error);
    }
  };

  // Poll for tracking updates
  useEffect(() => {
    if (!visible) return;

    const fetchTrackingStatus = async () => {
      try {
        setLoading(true);
        const response = await CustomerApi.getTrackingStatus(bookingId);
        
        if (response?.success && (response.isTracking || response.tracking) && response.tracking) {
          setTrackingStatus({
            status: response.tracking.status,
            currentLocation: response.tracking.currentLocation,
            estimatedEtaMinutes: response.tracking.estimatedEtaMinutes,
            distanceKm: response.tracking.distanceKm,
            vendorName: response.tracking.vendorName || vendorName,
            bookingDetails: response.tracking.bookingDetails,
            vendorDetails: response.tracking.vendorDetails,
            staffDetails: response.tracking.staffDetails,
          });
          
          // If vendor arrived, trigger callback
          if (response.tracking.status === 'arrived' && onVendorArrived) {
            onVendorArrived();
          }
        }
      } catch (error) {
        console.error('Error fetching tracking status:', error);
      } finally {
        setLoading(false);
      }
    };

    // Fetch immediately
    fetchTrackingStatus();

    // Poll every 10 seconds
    intervalRef.current = setInterval(fetchTrackingStatus, 10000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [visible, bookingId, vendorName, onVendorArrived]);

  const formatETA = (minutes?: number) => {
    if (!minutes) return 'Calculating...';
    if (minutes < 1) return 'Less than 1 min';
    if (minutes < 60) return `${Math.round(minutes)} min`;
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return `${hours}h ${mins}m`;
  };

  // Get effective vendor/staff details
  const effectiveVendorName = staffName || trackingStatus?.staffDetails?.name || vendorName;
  const effectiveVendorPhone = staffPhone || trackingStatus?.staffDetails?.phone || vendorPhone || trackingStatus?.vendorDetails?.phone;
  const effectiveVendorPhoto = staffPhoto || trackingStatus?.staffDetails?.photo || vendorPhoto || trackingStatus?.vendorDetails?.photo;
  const effectiveQualifications = staffQualifications || trackingStatus?.staffDetails?.qualifications;
  const effectiveServiceName = serviceName || bookingDetails?.serviceName || trackingStatus?.bookingDetails?.serviceName;
  const effectivePurpose = purpose || bookingDetails?.purpose || bookingDetails?.notes || 'Service appointment';
  const effectiveAppointmentDate = appointmentDate || bookingDetails?.appointmentDate || bookingDetails?.date;
  const effectiveAppointmentTime = appointmentTime || bookingDetails?.appointmentTime || bookingDetails?.time;

  const handleCall = () => {
    if (effectiveVendorPhone) {
      Linking.openURL(`tel:${effectiveVendorPhone}`);
    }
  };

  const handleOpenMaps = () => {
    if (trackingStatus?.currentLocation) {
      const url = `https://www.google.com/maps?q=${trackingStatus.currentLocation.latitude},${trackingStatus.currentLocation.longitude}`;
      Linking.openURL(url);
    }
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerContent}>
              <Text style={styles.headerTitle}>GPS Tracker - Live Navigation</Text>
              <Text style={styles.headerSubtitle}>
                Traveling to {bookingDetails?.customerName || 'your'} location
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Icon name="close" size={20} color={colors.white} />
            </TouchableOpacity>
          </View>

          {/* Live Tracking Status */}
          <View style={styles.statusBar}>
            <View style={styles.statusIndicator} />
            <Text style={styles.statusText}>Live Tracking</Text>
            <Text style={styles.sessionText}>Session: {trackingSessionId.slice(0, 8)}</Text>
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {/* Tracking Status Card */}
            <View style={styles.trackingCard}>
              {loading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color={colors.primary} />
                  <Text style={styles.loadingText}>Loading tracking...</Text>
                </View>
              ) : (
                <>
                  <View style={styles.trackingIconContainer}>
                    <Icon name="map-marker-path" size={48} color={colors.primary} />
                  </View>
                  <Text style={styles.trackingTitle}>GPS Tracking Active</Text>
                  <Text style={styles.trackingSubtitle}>
                    Navigating to {customerAddress}
                  </Text>

                  {/* ETA Display */}
                  {trackingStatus && (
                    <View style={styles.etaCard}>
                      <View style={styles.etaHeader}>
                        <Icon name="clock-outline" size={20} color={colors.primary} />
                        <Text style={styles.etaLabel}>Estimated Arrival</Text>
                      </View>
                      <Text style={styles.etaValue}>
                        {formatETA(trackingStatus.estimatedEtaMinutes)}
                      </Text>
                      {trackingStatus.distanceKm && (
                        <Text style={styles.distanceText}>
                          {trackingStatus.distanceKm.toFixed(1)} km away
                        </Text>
                      )}
                    </View>
                  )}
                </>
              )}
            </View>

            {/* Appointment Details */}
            {effectiveServiceName && (
              <View style={styles.detailCard}>
                <View style={styles.detailHeader}>
                  <Icon name="file-document-outline" size={20} color="#3B82F6" />
                  <Text style={styles.detailTitle}>Service Purpose</Text>
                </View>
                <Text style={styles.detailValue}>{effectiveServiceName}</Text>
                {effectivePurpose && effectivePurpose !== effectiveServiceName && (
                  <Text style={styles.detailSubtext}>{effectivePurpose}</Text>
                )}
              </View>
            )}

            {(effectiveAppointmentDate || effectiveAppointmentTime) && (
              <View style={styles.detailCard}>
                <View style={styles.detailHeader}>
                  <Icon name="calendar-outline" size={20} color="#9333EA" />
                  <Text style={styles.detailTitle}>Appointment Details</Text>
                </View>
                {effectiveAppointmentDate && (
                  <Text style={styles.detailValue}>
                    Date: {new Date(effectiveAppointmentDate).toLocaleDateString()}
                  </Text>
                )}
                {effectiveAppointmentTime && (
                  <Text style={styles.detailValue}>Time: {effectiveAppointmentTime}</Text>
                )}
              </View>
            )}

            {/* Vendor/Staff Information */}
            <View style={styles.detailCard}>
              <View style={styles.detailHeader}>
                <Icon name="account-outline" size={20} color={colors.success} />
                <Text style={styles.detailTitle}>Service Provider</Text>
              </View>
              <View style={styles.providerInfo}>
                {effectiveVendorPhoto ? (
                  <Image
                    source={{ uri: effectiveVendorPhoto }}
                    style={styles.providerPhoto}
                  />
                ) : (
                  <View style={styles.providerPhotoPlaceholder}>
                    <Icon name="account" size={24} color={colors.success} />
                  </View>
                )}
                <View style={styles.providerDetails}>
                  <Text style={styles.providerName}>{effectiveVendorName}</Text>
                  {effectiveVendorPhone && (
                    <TouchableOpacity
                      style={styles.phoneButton}
                      onPress={handleCall}
                    >
                      <Icon name="phone" size={16} color={colors.success} />
                      <Text style={styles.phoneText}>{effectiveVendorPhone}</Text>
                    </TouchableOpacity>
                  )}
                  {effectiveQualifications && (
                    <View style={styles.qualificationsRow}>
                      <Icon name="school-outline" size={16} color={colors.success} />
                      <Text style={styles.qualificationsText}>{effectiveQualifications}</Text>
                    </View>
                  )}
                </View>
              </View>
            </View>

            {/* Address */}
            <View style={styles.addressCard}>
              <View style={styles.addressHeader}>
                <Icon name="map-marker" size={20} color={colors.primary} />
                <Text style={styles.addressTitle}>Your Address</Text>
              </View>
              <Text style={styles.addressText}>{customerAddress}</Text>
            </View>
          </ScrollView>

          {/* Footer Actions */}
          <View style={styles.actions}>
            {effectiveVendorPhone && (
              <TouchableOpacity
                style={[styles.actionButton, styles.callButton]}
                onPress={handleCall}
              >
                <Icon name="phone" size={20} color={colors.white} />
                <Text style={styles.actionButtonText}>Call Provider</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[styles.actionButton, styles.mapsButton]}
              onPress={handleOpenMaps}
              disabled={!trackingStatus?.currentLocation}
            >
              <Icon name="google-maps" size={20} color={colors.white} />
              <Text style={styles.actionButtonText}>Open in Maps</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, styles.closeButtonFooter]}
              onPress={onClose}
            >
              <Text style={styles.closeButtonText}>Close Tracker</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.md,
  },
  container: {
    width: '100%',
    maxWidth: 430,
    maxHeight: height * 0.95,
    backgroundColor: colors.white,
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
  },
  header: {
    backgroundColor: colors.primary,
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: typography.h3,
    fontWeight: 'bold',
    color: colors.white,
    marginBottom: spacing.xs,
  },
  headerSubtitle: {
    fontSize: typography.caption,
    color: colors.white + 'E6',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: colors.gray['50'],
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  statusIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.success,
    marginRight: spacing.sm,
  },
  statusText: {
    fontSize: typography.caption,
    fontWeight: '600',
    color: colors.text,
    marginRight: spacing.sm,
  },
  sessionText: {
    fontSize: typography.caption,
    color: colors.textSecondary,
  },
  content: {
    flex: 1,
    padding: spacing.md,
  },
  trackingCard: {
    backgroundColor: colors.gray['50'],
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    alignItems: 'center',
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  loadingContainer: {
    padding: spacing.xl,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: typography.body,
    color: colors.textSecondary,
  },
  trackingIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  trackingTitle: {
    fontSize: typography.h2,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  trackingSubtitle: {
    fontSize: typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  etaCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    width: '100%',
    marginTop: spacing.md,
  },
  etaHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  etaLabel: {
    fontSize: typography.caption,
    fontWeight: '600',
    color: colors.text,
    marginLeft: spacing.xs,
  },
  etaValue: {
    fontSize: typography.h1,
    fontWeight: 'bold',
    color: colors.primary,
    marginBottom: spacing.xs,
  },
  distanceText: {
    fontSize: typography.caption,
    color: colors.textSecondary,
  },
  detailCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  detailTitle: {
    fontSize: typography.caption,
    fontWeight: '600',
    color: colors.text,
    marginLeft: spacing.xs,
  },
  detailValue: {
    fontSize: typography.body,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  detailSubtext: {
    fontSize: typography.caption,
    color: colors.textSecondary,
  },
  providerInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: spacing.sm,
  },
  providerPhoto: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: spacing.md,
  },
  providerPhotoPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.gray['200'],
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  providerDetails: {
    flex: 1,
  },
  providerName: {
    fontSize: typography.body,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  phoneButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  phoneText: {
    fontSize: typography.caption,
    color: colors.success,
    marginLeft: spacing.xs,
  },
  qualificationsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  qualificationsText: {
    fontSize: typography.caption,
    color: colors.textSecondary,
    marginLeft: spacing.xs,
  },
  addressCard: {
    backgroundColor: colors.gray['50'],
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  addressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  addressTitle: {
    fontSize: typography.caption,
    fontWeight: '600',
    color: colors.text,
    marginLeft: spacing.xs,
  },
  addressText: {
    fontSize: typography.caption,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  actions: {
    padding: spacing.md,
    backgroundColor: colors.gray['50'],
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: spacing.sm,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    gap: spacing.xs,
  },
  callButton: {
    backgroundColor: colors.success,
  },
  mapsButton: {
    backgroundColor: colors.primary,
  },
  closeButtonFooter: {
    backgroundColor: colors.gray['200'],
  },
  actionButtonText: {
    fontSize: typography.body,
    fontWeight: '600',
    color: colors.white,
  },
  closeButtonText: {
    fontSize: typography.body,
    fontWeight: '600',
    color: colors.text,
  },
});
