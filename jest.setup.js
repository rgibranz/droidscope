// SafeAreaProvider withholds its children until it has measured real insets,
// which never happens under the test renderer. The package ships a mock, but
// exports it as a default -- spreading it is what makes the named imports work.
jest.mock('react-native-safe-area-context', () => ({
  ...jest.requireActual('react-native-safe-area-context'),
  ...require('react-native-safe-area-context/jest/mock').default,
}));
