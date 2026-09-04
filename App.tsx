import { useColorScheme, StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { TamaguiProvider, Theme } from './src/design-system/tamagui';
import config from './src/core/theme/tamagui.config';
import { Navigation } from './src/app/navigation';

export default function App() {
  // Settings ships with the next deliverable; until then the system preference
  // is the source of truth. Dark is designed first, not derived from light.
  const dark = useColorScheme() !== 'light';

  return (
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
  );
}
