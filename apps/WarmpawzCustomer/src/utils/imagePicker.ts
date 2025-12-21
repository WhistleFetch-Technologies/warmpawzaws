/**
 * Image Picker Utility
 * Handles camera and gallery access
 * Requires expo-image-picker package
 */

import { Alert, Platform } from 'react-native';
// import * as ImagePicker from 'expo-image-picker';

export interface ImagePickerResult {
  uri: string;
  type?: string;
  fileName?: string;
}

export async function requestCameraPermission(): Promise<boolean> {
  // TODO: Implement when expo-image-picker is installed
  // const { status } = await ImagePicker.requestCameraPermissionsAsync();
  // return status === 'granted';
  return false;
}

export async function requestMediaLibraryPermission(): Promise<boolean> {
  // TODO: Implement when expo-image-picker is installed
  // const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  // return status === 'granted';
  return false;
}

export async function pickImageFromGallery(): Promise<ImagePickerResult | null> {
  // TODO: Implement when expo-image-picker is installed
  Alert.alert(
    'Image Picker',
    'expo-image-picker package is required. Please install it: npm install expo-image-picker',
    [{ text: 'OK' }]
  );
  return null;
  
  // try {
  //   const hasPermission = await requestMediaLibraryPermission();
  //   if (!hasPermission) {
  //     Alert.alert('Permission Required', 'Please grant camera roll permission');
  //     return null;
  //   }

  //   const result = await ImagePicker.launchImageLibraryAsync({
  //     mediaTypes: ImagePicker.MediaTypeOptions.Images,
  //     allowsEditing: true,
  //     aspect: [1, 1],
  //     quality: 0.8,
  //   });

  //   if (result.canceled || !result.assets[0]) {
  //     return null;
  //   }

  //   return {
  //     uri: result.assets[0].uri,
  //     type: result.assets[0].type,
  //     fileName: result.assets[0].fileName,
  //   };
  // } catch (error) {
  //   console.error('Error picking image:', error);
  //   Alert.alert('Error', 'Failed to pick image');
  //   return null;
  // }
}

export async function takePhoto(): Promise<ImagePickerResult | null> {
  // TODO: Implement when expo-image-picker is installed
  Alert.alert(
    'Camera',
    'expo-image-picker package is required. Please install it: npm install expo-image-picker',
    [{ text: 'OK' }]
  );
  return null;
  
  // try {
  //   const hasPermission = await requestCameraPermission();
  //   if (!hasPermission) {
  //     Alert.alert('Permission Required', 'Please grant camera permission');
  //     return null;
  //   }

  //   const result = await ImagePicker.launchCameraAsync({
  //     allowsEditing: true,
  //     aspect: [1, 1],
  //     quality: 0.8,
  //   });

  //   if (result.canceled || !result.assets[0]) {
  //     return null;
  //   }

  //   return {
  //     uri: result.assets[0].uri,
  //     type: result.assets[0].type,
  //     fileName: result.assets[0].fileName,
  //   };
  // } catch (error) {
  //   console.error('Error taking photo:', error);
  //   Alert.alert('Error', 'Failed to take photo');
  //   return null;
  // }
}

