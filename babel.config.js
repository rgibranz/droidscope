module.exports = {
  presets: ['module:@react-native/babel-preset'],
  // Reanimated 4 moved its Babel plugin into react-native-worklets.
  // It must stay last in the plugin list.
  plugins: ['react-native-worklets/plugin'],
};
