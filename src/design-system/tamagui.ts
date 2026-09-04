/**
 * Single import point for Tamagui.
 *
 * The `tamagui` barrel pulls in web-only components (menu, popover, dialog) and
 * `@tamagui/popper` among them imports `react-dom`, which does not resolve in a
 * React Native bundle. Importing the specific subpackages avoids that and keeps
 * the bundle to what the app actually renders.
 */
export {
  TamaguiProvider,
  Theme,
  Text,
  View,
  createTamagui,
  createTokens,
  styled,
  useTheme,
} from '@tamagui/core';

export { XStack, YStack } from '@tamagui/stacks';
export { ScrollView } from '@tamagui/scroll-view';
