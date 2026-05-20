/**
 * No-op shim for `expo-location`.
 *
 * The bare React Native project does not have `expo-modules-core` wired up
 * natively (no `useExpoModules()` in `android/settings.gradle`), so importing
 * the real `expo-location` would throw at module load. This stub keeps every
 * call site behaving as if the user denied location permission, which all
 * screens already handle.
 */

const PermissionStatus = {
  GRANTED: 'granted',
  DENIED: 'denied',
  UNDETERMINED: 'undetermined',
};

const Accuracy = {
  Lowest: 1,
  Low: 2,
  Balanced: 3,
  High: 4,
  Highest: 5,
  BestForNavigation: 6,
};

const LocationAccuracy = Accuracy;

const deniedPermission = Object.freeze({
  status: PermissionStatus.DENIED,
  granted: false,
  canAskAgain: false,
  expires: 'never',
});

async function requestForegroundPermissionsAsync() {
  return deniedPermission;
}

async function getForegroundPermissionsAsync() {
  return deniedPermission;
}

async function requestBackgroundPermissionsAsync() {
  return deniedPermission;
}

async function getBackgroundPermissionsAsync() {
  return deniedPermission;
}

async function getCurrentPositionAsync(_opts) {
  throw new Error('expo-location stub: native module unavailable');
}

async function getLastKnownPositionAsync() {
  return null;
}

async function watchPositionAsync(_opts, _callback) {
  return { remove() {} };
}

async function reverseGeocodeAsync(_coords) {
  return [];
}

async function geocodeAsync(_address) {
  return [];
}

async function hasServicesEnabledAsync() {
  return false;
}

async function enableNetworkProviderAsync() {
  return false;
}

module.exports = {
  PermissionStatus,
  Accuracy,
  LocationAccuracy,
  requestForegroundPermissionsAsync,
  getForegroundPermissionsAsync,
  requestBackgroundPermissionsAsync,
  getBackgroundPermissionsAsync,
  getCurrentPositionAsync,
  getLastKnownPositionAsync,
  watchPositionAsync,
  reverseGeocodeAsync,
  geocodeAsync,
  hasServicesEnabledAsync,
  enableNetworkProviderAsync,
  default: undefined,
};
