/**
 * No-op shim for `expo-image-picker`. See expo-location.js for context.
 */

const MediaTypeOptions = {
  All: 'All',
  Videos: 'Videos',
  Images: 'Images',
};

const PermissionStatus = {
  GRANTED: 'granted',
  DENIED: 'denied',
  UNDETERMINED: 'undetermined',
};

const denied = Object.freeze({
  status: 'denied',
  granted: false,
  canAskAgain: false,
  expires: 'never',
});

const cancelledResult = Object.freeze({ canceled: true, assets: null });

async function requestCameraPermissionsAsync() {
  return denied;
}
async function getCameraPermissionsAsync() {
  return denied;
}
async function requestMediaLibraryPermissionsAsync(_writeOnly) {
  return denied;
}
async function getMediaLibraryPermissionsAsync(_writeOnly) {
  return denied;
}

async function launchImageLibraryAsync(_options) {
  return cancelledResult;
}
async function launchCameraAsync(_options) {
  return cancelledResult;
}

module.exports = {
  MediaTypeOptions,
  PermissionStatus,
  requestCameraPermissionsAsync,
  getCameraPermissionsAsync,
  requestMediaLibraryPermissionsAsync,
  getMediaLibraryPermissionsAsync,
  launchImageLibraryAsync,
  launchCameraAsync,
  default: undefined,
};
