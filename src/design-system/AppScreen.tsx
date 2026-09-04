import type { ReactNode } from 'react';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { ScrollView, YStack } from './tamagui';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Edge-to-edge page shell (§41.7). Insets and the tab bar height both come from
 * the platform rather than fixed padding, so cutouts, gesture bars and the tab
 * bar are all accounted for without magic numbers.
 */
export function AppScreen({
  children,
  scroll = true,
}: {
  children: ReactNode;
  scroll?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();

  const content = (
    <YStack
      paddingHorizontal="$4"
      paddingTop={insets.top + 12}
      paddingBottom={tabBarHeight + 24}
      gap="$5"
    >
      {children}
    </YStack>
  );

  if (!scroll) {
    return (
      <YStack flex={1} backgroundColor="$background">
        {content}
      </YStack>
    );
  }

  return (
    <ScrollView
      flex={1}
      backgroundColor="$background"
      showsVerticalScrollIndicator={false}
    >
      {content}
    </ScrollView>
  );
}
