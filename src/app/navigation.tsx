import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Activity, History as HistoryIconSrc, LineChart, Stethoscope } from 'lucide-react-native';
import { useTheme } from '../design-system/tamagui';
import { DashboardScreen } from '../features/battery-live/DashboardScreen';
import { DiagnosticsScreen } from '../features/diagnostics/DiagnosticsScreen';
import { HistoryScreen } from '../features/history/HistoryScreen';
import { SessionsScreen } from '../features/sessions/SessionsScreen';

const Tab = createBottomTabNavigator();

type TabIconProps = { color: string; size: number };

// Defined outside the navigator so React does not see a new component type on
// every render.
const OverviewIcon = ({ color, size }: TabIconProps) => (
  <Activity color={color} size={size} />
);
const HistoryIcon = ({ color, size }: TabIconProps) => (
  <LineChart color={color} size={size} />
);
const SessionsIcon = ({ color, size }: TabIconProps) => (
  <HistoryIconSrc color={color} size={size} />
);
const DiagnosticsIcon = ({ color, size }: TabIconProps) => (
  <Stethoscope color={color} size={size} />
);

/**
 * §42.1's four primary destinations. Diagnostics sits alongside them for now
 * rather than under Settings, because Settings does not exist yet.
 */
export function Navigation({ dark }: { dark: boolean }) {
  const theme = useTheme();

  const base = dark ? DarkTheme : DefaultTheme;
  const navTheme = {
    ...base,
    colors: {
      ...base.colors,
      background: theme.background?.val ?? base.colors.background,
      card: theme.surface?.val ?? base.colors.card,
      text: theme.color?.val ?? base.colors.text,
      border: theme.borderColor?.val ?? base.colors.border,
      primary: theme.accent?.val ?? base.colors.primary,
    },
  };

  return (
    <NavigationContainer theme={navTheme}>
      <Tab.Navigator
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: theme.accent?.val,
          tabBarInactiveTintColor: theme.textMuted?.val,
          tabBarStyle: {
            backgroundColor: theme.surface?.val,
            borderTopColor: theme.borderColor?.val,
          },
        }}
      >
        <Tab.Screen
          name="Overview"
          component={DashboardScreen}
          options={{
            tabBarIcon: OverviewIcon,
          }}
        />
        <Tab.Screen
          name="History"
          component={HistoryScreen}
          options={{
            tabBarIcon: HistoryIcon,
          }}
        />
        <Tab.Screen
          name="Sessions"
          component={SessionsScreen}
          options={{
            tabBarIcon: SessionsIcon,
          }}
        />
        <Tab.Screen
          name="Diagnostics"
          component={DiagnosticsScreen}
          options={{
            tabBarIcon: DiagnosticsIcon,
          }}
        />
      </Tab.Navigator>
    </NavigationContainer>
  );
}
