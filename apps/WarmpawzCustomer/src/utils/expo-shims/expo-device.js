/**
 * No-op shim for `expo-device`. See expo-location.js for context.
 */

module.exports = {
  isDevice: true,
  brand: null,
  manufacturer: null,
  modelId: null,
  modelName: null,
  designName: null,
  productName: null,
  deviceYearClass: null,
  totalMemory: null,
  supportedCpuArchitectures: null,
  osName: 'Android',
  osVersion: null,
  osBuildId: null,
  osInternalBuildId: null,
  osBuildFingerprint: null,
  platformApiLevel: null,
  deviceName: null,
  async getDeviceTypeAsync() {
    return 0;
  },
  async getMaxMemoryAsync() {
    return 0;
  },
  async getUptimeAsync() {
    return 0;
  },
  async hasPlatformFeatureAsync() {
    return false;
  },
  async isRootedExperimentalAsync() {
    return false;
  },
  async isSideloadingEnabledAsync() {
    return false;
  },
  default: undefined,
};
