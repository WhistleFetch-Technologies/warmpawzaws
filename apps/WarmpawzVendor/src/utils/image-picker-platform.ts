import { Platform } from 'react-native';

/**
 * Android 13+ system Photo Picker often returns canceled or empty `assets` when
 * `allowsEditing` is true. Keep in-picker cropping on iOS only.
 */
export const libraryPickerAllowsEditing = Platform.OS === 'ios';

/**
 * Same constraint applies to some Android camera → crop handoffs.
 */
export const cameraPickerAllowsEditing = Platform.OS === 'ios';
