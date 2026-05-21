/**
 * No-op shim for `expo-notifications`. See expo-location.js for context.
 * Push notifications are disabled until expo-modules-core is wired up.
 */

const AndroidNotificationPriority = {
  MIN: 'min',
  LOW: 'low',
  DEFAULT: 'default',
  HIGH: 'high',
  MAX: 'max',
};

const PermissionStatus = {
  GRANTED: 'granted',
  DENIED: 'denied',
  UNDETERMINED: 'undetermined',
};

const NOOP_SUB = { remove() {} };

const denied = Object.freeze({
  status: 'denied',
  granted: false,
  canAskAgain: false,
  expires: 'never',
});

function setNotificationHandler(_handler) {}

async function getPermissionsAsync() {
  return denied;
}

async function requestPermissionsAsync(_options) {
  return denied;
}

async function getExpoPushTokenAsync(_opts) {
  throw new Error('expo-notifications stub: native module unavailable');
}

async function getDevicePushTokenAsync() {
  throw new Error('expo-notifications stub: native module unavailable');
}

async function scheduleNotificationAsync(_request) {
  return null;
}

async function cancelScheduledNotificationAsync(_id) {}
async function cancelAllScheduledNotificationsAsync() {}
async function getAllScheduledNotificationsAsync() {
  return [];
}

async function dismissAllNotificationsAsync() {}
async function dismissNotificationAsync(_id) {}

async function getBadgeCountAsync() {
  return 0;
}
async function setBadgeCountAsync(_count) {
  return false;
}

function addNotificationReceivedListener(_listener) {
  return NOOP_SUB;
}

function addNotificationResponseReceivedListener(_listener) {
  return NOOP_SUB;
}

function removeNotificationSubscription(_subscription) {}

async function setNotificationChannelAsync(_id, _channel) {
  return null;
}

async function deleteNotificationChannelAsync(_id) {}

async function getNotificationChannelsAsync() {
  return [];
}

module.exports = {
  AndroidNotificationPriority,
  PermissionStatus,
  setNotificationHandler,
  getPermissionsAsync,
  requestPermissionsAsync,
  getExpoPushTokenAsync,
  getDevicePushTokenAsync,
  scheduleNotificationAsync,
  cancelScheduledNotificationAsync,
  cancelAllScheduledNotificationsAsync,
  getAllScheduledNotificationsAsync,
  dismissAllNotificationsAsync,
  dismissNotificationAsync,
  getBadgeCountAsync,
  setBadgeCountAsync,
  addNotificationReceivedListener,
  addNotificationResponseReceivedListener,
  removeNotificationSubscription,
  setNotificationChannelAsync,
  deleteNotificationChannelAsync,
  getNotificationChannelsAsync,
  default: undefined,
};
