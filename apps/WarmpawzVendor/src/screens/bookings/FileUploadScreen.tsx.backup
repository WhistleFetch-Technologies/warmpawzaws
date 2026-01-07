/**
 * File Upload Screen
 * Upload reports, prescriptions, and documents
 * Batch 1 - Screen 8
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { colors, spacing, borderRadius, typography } from '../../theme/colors';
import { AppointmentDetailApi } from '../../services/api';

interface FileUploadScreenProps {
  bookingId: string;
  vendorId: string;
  uploadType?: 'prescription' | 'report' | 'document';
  onBack?: () => void;
  onComplete?: (fileUrl: string) => void;
}

interface UploadedFile {
  uri: string;
  type: string;
  name: string;
}

export function FileUploadScreen({
  bookingId,
  vendorId,
  uploadType = 'prescription',
  onBack,
  onComplete,
}: FileUploadScreenProps) {
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<UploadedFile | null>(null);

  const requestPermission = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Camera roll permission is required to upload files');
      return false;
    }
    return true;
  };

  const pickImage = async () => {
    const hasPermission = await requestPermission();
    if (!hasPermission) return;

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        setSelectedFile({
          uri: asset.uri,
          type: 'image/jpeg',
          name: `upload_${Date.now()}.jpg`,
        });
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Camera permission is required to take photos');
      return;
    }

    try {
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        setSelectedFile({
          uri: asset.uri,
          type: 'image/jpeg',
          name: `photo_${Date.now()}.jpg`,
        });
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert('Error', 'Failed to take photo');
    }
  };

  const uploadFile = async () => {
    if (!selectedFile) {
      Alert.alert('Error', 'Please select a file to upload');
      return;
    }

    setUploading(true);
    try {
      // Convert image to base64 or FormData
      const formData = new FormData();
      formData.append('file', {
        uri: selectedFile.uri,
        type: selectedFile.type,
        name: selectedFile.name,
      } as any);
      formData.append('bookingId', bookingId);
      formData.append('vendorId', vendorId);
      formData.append('uploadType', uploadType);

      // Upload prescription
      if (uploadType === 'prescription') {
        const response = await AppointmentDetailApi.uploadPrescription({
          bookingId,
          vendorId,
          file: selectedFile.uri,
          fileName: selectedFile.name,
        });

        if (response.success || response.url) {
          Alert.alert('Success', 'File uploaded successfully!', [
            {
              text: 'OK',
              onPress: () => {
                if (onComplete) {
                  onComplete(response.url || response.fileUrl || '');
                }
              },
            },
          ]);
        } else {
          Alert.alert('Error', response.error || 'Failed to upload file');
        }
      } else {
        // For other file types, use generic upload endpoint
        // Use prescription upload endpoint as fallback
        const response = await AppointmentDetailApi.uploadPrescription({
          bookingId,
          vendorId,
          file: selectedFile.uri,
          fileName: selectedFile.name,
          uploadType,
        });

        if (response.success || response.url) {
          Alert.alert('Success', 'File uploaded successfully!', [
            {
              text: 'OK',
              onPress: () => {
                if (onComplete) {
                  onComplete(response.url || response.fileUrl || '');
                }
              },
            },
          ]);
        } else {
          Alert.alert('Error', response.error || 'Failed to upload file');
        }
      }
    } catch (error: any) {
      console.error('Error uploading file:', error);
      Alert.alert('Error', error.message || 'Failed to upload file. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        {onBack && (
          <TouchableOpacity onPress={onBack} style={styles.backButton}>
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
        )}
        <Text style={styles.title}>
          Upload {uploadType === 'prescription' ? 'Prescription' : uploadType === 'report' ? 'Report' : 'Document'}
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.uploadSection}>
          <Text style={styles.sectionTitle}>Select File</Text>
          
          <View style={styles.buttonRow}>
            <TouchableOpacity style={styles.uploadButton} onPress={pickImage}>
              <Text style={styles.uploadButtonText}>Choose from Gallery</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.uploadButton} onPress={takePhoto}>
              <Text style={styles.uploadButtonText}>Take Photo</Text>
            </TouchableOpacity>
          </View>

          {selectedFile && (
            <View style={styles.previewContainer}>
              <Image source={{ uri: selectedFile.uri }} style={styles.previewImage} />
              <Text style={styles.fileName}>{selectedFile.name}</Text>
              <TouchableOpacity
                style={styles.removeButton}
                onPress={() => setSelectedFile(null)}
              >
                <Text style={styles.removeButtonText}>Remove</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        <TouchableOpacity
          style={[styles.submitButton, (!selectedFile || uploading) && styles.submitButtonDisabled]}
          onPress={uploadFile}
          disabled={!selectedFile || uploading}
        >
          {uploading ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={styles.submitButtonText}>Upload File</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
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
  content: {
    padding: spacing.lg,
  },
  uploadSection: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: typography.fontSizes.lg,
    fontWeight: typography.fontWeights.bold,
    color: colors.text,
    marginBottom: spacing.md,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  uploadButton: {
    flex: 1,
    backgroundColor: colors.background,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: borderRadius.xl,
    padding: spacing.md,
    alignItems: 'center',
  },
  uploadButtonText: {
    fontSize: typography.fontSizes.md,
    fontWeight: typography.fontWeights.medium,
    color: colors.text,
  },
  previewContainer: {
    marginTop: spacing.md,
    alignItems: 'center',
  },
  previewImage: {
    width: 200,
    height: 200,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
  },
  fileName: {
    fontSize: typography.fontSizes.sm,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  removeButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  removeButtonText: {
    fontSize: typography.fontSizes.sm,
    color: colors.error,
  },
  submitButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.xl,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    fontSize: typography.fontSizes.md,
    fontWeight: typography.fontWeights.semibold,
    color: '#ffffff',
  },
});

