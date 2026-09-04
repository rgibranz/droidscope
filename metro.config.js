const path = require('path');
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */

// @tamagui/web declares a react-dom peer, which a React Native project does not
// satisfy, so npm installs a nested copy for every dependent -- 45 of them, with
// no hoisted copy at all. Multiple copies mean multiple Tamagui runtimes, and
// theme context is then looked up in a different instance than the one the
// provider registered ("no parent theme context was found"). `npm dedupe` does
// not fix it because the duplication is caused by the unmet peer, not by
// version drift.
//
// Resolving every @tamagui/web request as if it came from @tamagui/core pins
// the whole bundle to a single copy.
const TAMAGUI_WEB_ORIGIN = path.resolve(
  __dirname,
  'node_modules/@tamagui/core/package.json',
);

const config = {
  resolver: {
    resolveRequest: (context, moduleName, platform) => {
      if (
        moduleName === '@tamagui/web' ||
        moduleName.startsWith('@tamagui/web/')
      ) {
        return context.resolveRequest(
          { ...context, originModulePath: TAMAGUI_WEB_ORIGIN },
          moduleName,
          platform,
        );
      }
      return context.resolveRequest(context, moduleName, platform);
    },
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
