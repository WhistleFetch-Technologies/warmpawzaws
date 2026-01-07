/**
 * Tax Documents Screen
 * Tax documents and statements
 * Batch 3 - Screen 10
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  FlatList,
  ActivityIndicator,
  Alert,
} from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { colors, spacing, borderRadius, typography } from '../../theme/colors';
import { TaxApi } from '../../services/api';

interface TaxDocumentsScreenProps {
  vendorId: string;
  onBack?: () => void;
}

interface TaxDocument {
  id: string;
  type: string;
  period: string;
  year: number;
  amount: number;
  fileUrl?: string;
  generatedAt: string;
}

export function TaxDocumentsScreen({ vendorId, onBack }: TaxDocumentsScreenProps) {
  const [loading, setLoading] = useState(true);
  const [documents, setDocuments] = useState<TaxDocument[]>([]);
  const [downloading, setDownloading] = useState<string | null>(null);

  useEffect(() => {
    loadDocuments();
  }, [vendorId]);

  const loadDocuments = async () => {
    try {
      setLoading(true);
      const response = await TaxApi.getDocuments(vendorId);
      setDocuments(response.documents || []);
    } catch (error) {
      console.error('Error loading documents:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (document: TaxDocument) => {
    if (!document.fileUrl) {
      Alert.alert('Error', 'Document not available');
      return;
    }

    setDownloading(document.id);
    try {
      const fileUri = FileSystem.documentDirectory + `tax_${document.id}.pdf`;
      const downloadResult = await FileSystem.downloadAsync(document.fileUrl, fileUri);
      
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(downloadResult.uri);
        Alert.alert('Success', 'Document downloaded and shared!');
      } else {
        Alert.alert('Success', 'Document downloaded!');
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to download document');
    } finally {
      setDownloading(null);
    }
  };

  const handleGenerate = async (type: string, year: number) => {
    try {
      const response = await TaxApi.generateDocument(vendorId, type, year);
      if (response.success) {
        Alert.alert('Success', 'Document generated successfully!');
        loadDocuments();
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to generate document');
    }
  };

  const renderDocument = ({ item }: { item: TaxDocument }) => (
    <View style={styles.documentCard}>
      <View style={styles.documentInfo}>
        <Text style={styles.documentType}>{item.type}</Text>
        <Text style={styles.documentPeriod}>
          {item.period} {item.year}
        </Text>
        <Text style={styles.documentAmount}>
          Amount: ₹{item.amount.toFixed(2)}
        </Text>
        <Text style={styles.documentDate}>
          Generated: {new Date(item.generatedAt).toLocaleDateString()}
        </Text>
      </View>
      <TouchableOpacity
        style={styles.downloadButton}
        onPress={() => handleDownload(item)}
        disabled={downloading === item.id || !item.fileUrl}
      >
        {downloading === item.id ? (
          <ActivityIndicator color="#ffffff" size="small" />
        ) : (
          <Text style={styles.downloadButtonText}>Download</Text>
        )}
      </TouchableOpacity>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        {onBack && (
          <TouchableOpacity onPress={onBack} style={styles.backButton}>
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
        )}
        <Text style={styles.title}>Tax Documents</Text>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.generateButton}
          onPress={() => {
            const currentYear = new Date().getFullYear();
            handleGenerate('annual', currentYear);
          }}
        >
          <Text style={styles.generateButtonText}>Generate Annual Statement</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={documents}
        keyExtractor={(item) => item.id}
        renderItem={renderDocument}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>No tax documents found</Text>
            <Text style={styles.emptyStateSubtext}>
              Generate a document to get started
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    padding: spacing.lg,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    marginBottom: spacing.sm,
  },
  backButtonText: {
    fontSize: typography.fontSizes.md,
    color: colors.textSecondary,
  },
  title: {
    fontSize: typography.fontSizes['2xl'],
    fontWeight: typography.fontWeights.bold,
    color: colors.text,
  },
  actions: {
    padding: spacing.md,
  },
  generateButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.xl,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
  },
  generateButtonText: {
    fontSize: typography.fontSizes.md,
    fontWeight: typography.fontWeights.semibold,
    color: '#ffffff',
  },
  listContent: {
    padding: spacing.md,
  },
  documentCard: {
    backgroundColor: colors.background,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: borderRadius.xl,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  documentInfo: {
    marginBottom: spacing.sm,
  },
  documentType: {
    fontSize: typography.fontSizes.md,
    fontWeight: typography.fontWeights.semibold,
    color: colors.text,
    marginBottom: spacing.xs / 2,
  },
  documentPeriod: {
    fontSize: typography.fontSizes.sm,
    color: colors.textSecondary,
    marginBottom: spacing.xs / 2,
  },
  documentAmount: {
    fontSize: typography.fontSizes.sm,
    color: colors.text,
    marginBottom: spacing.xs / 2,
  },
  documentDate: {
    fontSize: typography.fontSizes.xs,
    color: colors.textMuted,
  },
  downloadButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.xl,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
  },
  downloadButtonText: {
    fontSize: typography.fontSizes.sm,
    fontWeight: typography.fontWeights.semibold,
    color: '#ffffff',
  },
  emptyState: {
    padding: spacing.xl,
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: typography.fontSizes.md,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  emptyStateSubtext: {
    fontSize: typography.fontSizes.sm,
    color: colors.textMuted,
  },
});

