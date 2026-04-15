/**
 * Medical Records Screen - Mobile
 * View pet medical records
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
  FlatList,
  Alert,
} from 'react-native';
import { ScreenShell } from '../../components/layout/ScreenShell';
import { colors, spacing, borderRadius } from '../../theme/colors';
import { MedicalHistoryApi } from '../../services/api';

interface MedicalRecordsScreenProps {
  petId: string;
  phone: string;
  customerId?: string;
  onBack: () => void;
  onNavigate?: (screen: string, data?: any) => void;
}

interface MedicalRecord {
  id: string;
  type: 'prescription' | 'vaccination' | 'lab_report' | 'xray' | 'medical_history';
  title: string;
  date: string;
  doctorName?: string;
  clinicName?: string;
  description?: string;
}

export function MedicalRecordsScreen({
  petId,
  phone,
  customerId,
  onBack,
  onNavigate,
}: MedicalRecordsScreenProps) {
  const [records, setRecords] = useState<MedicalRecord[]>([]);
  const [prescriptions, setPrescriptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'all' | 'prescriptions' | 'vaccinations' | 'reports'>('all');

  useEffect(() => {
    loadMedicalRecords();
  }, [petId, activeTab]);

  const loadMedicalRecords = async () => {
    try {
      setLoading(true);
      const response = await MedicalHistoryApi.getMedicalRecords(petId);
      const recordsData = Array.isArray(response) ? response : response.records || [];
      
      let filtered = recordsData;
      if (activeTab === 'prescriptions') {
        filtered = recordsData.filter((r: MedicalRecord) => r.type === 'prescription');
      } else if (activeTab === 'vaccinations') {
        filtered = recordsData.filter((r: MedicalRecord) => r.type === 'vaccination');
      } else if (activeTab === 'reports') {
        filtered = recordsData.filter((r: MedicalRecord) => 
          ['lab_report', 'xray'].includes(r.type)
        );
      }
      
      setRecords(filtered);

      // Load prescriptions separately
      const prescResponse = await MedicalHistoryApi.getPrescriptions(petId);
      setPrescriptions(prescResponse.prescriptions || []);
    } catch (error) {
      console.error('Error loading medical records:', error);
      Alert.alert('Error', 'Failed to load medical records');
    } finally {
      setLoading(false);
    }
  };

  const getRecordIcon = (type: string) => {
    switch (type) {
      case 'prescription':
        return '💊';
      case 'vaccination':
        return '💉';
      case 'lab_report':
        return '📋';
      case 'xray':
        return '🩻';
      case 'medical_history':
        return '📄';
      default:
        return '📁';
    }
  };

  const getRecordTypeLabel = (type: string) => {
    switch (type) {
      case 'prescription':
        return 'Prescription';
      case 'vaccination':
        return 'Vaccination';
      case 'lab_report':
        return 'Lab Report';
      case 'xray':
        return 'X-Ray';
      case 'medical_history':
        return 'Medical History';
      default:
        return 'Record';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const renderRecordItem = ({ item }: { item: MedicalRecord }) => (
    <TouchableOpacity
      style={styles.recordCard}
      onPress={() => {
        if (item.type === 'prescription') {
          onNavigate && onNavigate('PrescriptionView', { 
            prescriptionId: item.id,
            petId 
          });
        } else {
          onNavigate && onNavigate('MedicalRecordDetail', { recordId: item.id });
        }
      }}
    >
      <View style={styles.recordIcon}>
        <Text style={styles.recordIconText}>{getRecordIcon(item.type)}</Text>
      </View>
      <View style={styles.recordInfo}>
        <Text style={styles.recordTitle}>{item.title}</Text>
        <Text style={styles.recordType}>{getRecordTypeLabel(item.type)}</Text>
        {item.doctorName && (
          <Text style={styles.recordDoctor}>Dr. {item.doctorName}</Text>
        )}
        {item.clinicName && (
          <Text style={styles.recordClinic}>{item.clinicName}</Text>
        )}
        <Text style={styles.recordDate}>{formatDate(item.date)}</Text>
      </View>
      <Text style={styles.recordArrow}>›</Text>
    </TouchableOpacity>
  );

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
        <Text style={styles.headerTitle}>Medical Records</Text>
        <View style={styles.placeholder} />
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'all' && styles.tabActive]}
          onPress={() => setActiveTab('all')}
        >
          <Text style={[styles.tabText, activeTab === 'all' && styles.tabTextActive]}>
            All
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'prescriptions' && styles.tabActive]}
          onPress={() => setActiveTab('prescriptions')}
        >
          <Text style={[styles.tabText, activeTab === 'prescriptions' && styles.tabTextActive]}>
            Prescriptions
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'vaccinations' && styles.tabActive]}
          onPress={() => setActiveTab('vaccinations')}
        >
          <Text style={[styles.tabText, activeTab === 'vaccinations' && styles.tabTextActive]}>
            Vaccinations
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'reports' && styles.tabActive]}
          onPress={() => setActiveTab('reports')}
        >
          <Text style={[styles.tabText, activeTab === 'reports' && styles.tabTextActive]}>
            Reports
          </Text>
        </TouchableOpacity>
      </View>

      {/* Records List */}
      {records.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>📁</Text>
          <Text style={styles.emptyTitle}>No Medical Records</Text>
          <Text style={styles.emptySubtitle}>
            Medical records will appear here after appointments
          </Text>
        </View>
      ) : (
        <FlatList
          data={records}
          renderItem={renderRecordItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
        />
      )}
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
  tabs: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tab: {
    flex: 1,
    padding: spacing.md,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: colors.primary,
  },
  tabText: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  tabTextActive: {
    color: colors.primary,
  },
  listContent: {
    padding: spacing.md,
  },
  recordCard: {
    backgroundColor: colors.white,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
  },
  recordIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.gray['100'],
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  recordIconText: {
    fontSize: 24,
  },
  recordInfo: {
    flex: 1,
  },
  recordTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  recordType: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  recordDoctor: {
    fontSize: 14,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  recordClinic: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  recordDate: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  recordArrow: {
    fontSize: 24,
    color: colors.textSecondary,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: spacing.md,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  emptySubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});
