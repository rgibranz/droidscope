import { useColorScheme, StatusBar, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { TamaguiProvider, Theme } from './src/design-system/tamagui';
import config from './src/core/theme/tamagui.config';
import { Navigation } from './src/app/navigation';

export default function App() {
  // Settings ships with the next deliverable; until then the system preference
  // is the source of truth. Dark is designed first, not derived from light.
  const dark = useColorScheme() !== 'light';

  return (
    // Required by react-native-gesture-handler, which backs chart scrubbing.
    <GestureHandlerRootView style={styles.root}>
      <TamaguiProvider config={config} defaultTheme={dark ? 'dark' : 'light'}>
        <Theme name={dark ? 'dark' : 'light'}>
          <SafeAreaProvider>
            {/* Edge-to-edge is enabled in gradle.properties, so the status bar
                background is owned by the system rather than set here. */}
            <StatusBar barStyle={dark ? 'light-content' : 'dark-content'} />
            <Navigation dark={dark} />
          </SafeAreaProvider>
        </Theme>
      </TamaguiProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  // GestureHandlerRootView is an RN view, not a Tamagui one, so it takes a
  // plain style rather than tokens.
  root: { flex: 1 },
});
