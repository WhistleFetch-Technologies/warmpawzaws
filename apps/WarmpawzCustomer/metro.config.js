const path = require('path');
const {getDefaultConfig, mergeConfig} = require('@react-native/metro-config');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

/**
 * Metro configuration
 * https://facebook.github.io/metro/docs/configuration
 *
 * @type {import('metro-config').MetroConfig}
 */
// Metro's NodeWatcher races against the CMake temp dirs that
// react-native-reanimated creates during the gradle native build (.cxx/...
// CMakeFiles/CMakeTmp/...). The dirs are deleted before Metro can stat them
// and the bundle step crashes with ENOENT on Windows. Block any path under
// android/ build outputs so the watcher never recurses there.
const blockedPathPatterns = [
  /[\\/]android[\\/].*[\\/]\.cxx[\\/].*/,
  /[\\/]android[\\/]app[\\/]build[\\/].*/,
  /[\\/]android[\\/]\.gradle[\\/].*/,
  /[\\/]node_modules[\\/]react-native-reanimated[\\/]android[\\/]\.cxx[\\/].*/,
  /[\\/]node_modules[\\/].*[\\/]android[\\/]\.cxx[\\/].*/,
];

// Expo modules listed in package.json depend on `expo-modules-core` being
// initialized natively (`useExpoModules()` in android/settings.gradle,
// `ApplicationLifecycleDispatcher.onApplicationCreate(this)` in
// MainApplication.kt). Until that wiring is in place, importing the real
// packages throws at module load and the app crashes on cold start. Alias
// each to a local no-op shim so screens continue to compile and the
// "permission denied" path runs at runtime. Restore the native wiring +
// remove these aliases when push / location features are needed.
const expoShims = {
  'expo-location': path.join(projectRoot, 'src/utils/expo-shims/expo-location.js'),
  'expo-notifications': path.join(projectRoot, 'src/utils/expo-shims/expo-notifications.js'),
  'expo-device': path.join(projectRoot, 'src/utils/expo-shims/expo-device.js'),
  'expo-image-picker': path.join(projectRoot, 'src/utils/expo-shims/expo-image-picker.js'),
};

const config = {
  watchFolders: [path.join(monorepoRoot, 'packages', 'shared-types')],
  resolver: {
    nodeModulesPaths: [
      path.join(projectRoot, 'node_modules'),
      path.join(monorepoRoot, 'node_modules'),
    ],
    blockList: blockedPathPatterns,
    blacklistRE: blockedPathPatterns,
    resolveRequest: (context, moduleName, platform) => {
      const shim = expoShims[moduleName];
      if (shim) {
        return { filePath: shim, type: 'sourceFile' };
      }
      return context.resolveRequest(context, moduleName, platform);
    },
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);

