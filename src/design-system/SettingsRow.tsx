import type { ReactNode } from 'react';
import { Switch } from 'react-native';
import { Text, XStack, YStack, useTheme } from './tamagui';
import { typeScale } from '../core/theme/tokens';

const PRESS_FEEDBACK = { opacity: 0.7 } as const;

export function SettingsGroup({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <YStack gap="$2">
      <Text
        fontSize={typeScale.label}
        letterSpacing={1}
        textTransform="uppercase"
        color="$textMuted"
      >
        {title}
      </Text>
      <YStack
        backgroundColor="$surface"
        borderColor="$borderColor"
        borderWidth={1}
        borderRadius="$2"
        overflow="hidden"
      >
        {children}
      </YStack>
    </YStack>
  );
}

export function SettingsRow({
  label,
  description,
  value,
  onPress,
  tone = 'default',
}: {
  label: string;
  description?: string;
  value?: string;
  onPress?: () => void;
  tone?: 'default' | 'danger';
}) {
  return (
    <XStack
      onPress={onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      alignItems="center"
      justifyContent="space-between"
      paddingHorizontal="$4"
      paddingVertical="$4"
      gap="$3"
      pressStyle={onPress ? PRESS_FEEDBACK : undefined}
    >
      <YStack flex={1} gap="$1">
        <Text
          fontSize={typeScale.body}
          color={tone === 'danger' ? '$danger' : '$color'}
        >
          {label}
        </Text>
        {description ? (
          <Text fontSize={typeScale.label} color="$textMuted">
            {description}
          </Text>
        ) : null}
      </YStack>
      {value ? (
        <Text fontSize={typeScale.body} color="$textMuted">
          {value}
        </Text>
      ) : null}
    </XStack>
  );
}

export function SettingsToggle({
  label,
  description,
  value,
  onChange,
}: {
  label: string;
  description?: string;
  value: boolean;
  onChange: (next: boolean) => void;
}) {
  const theme = useTheme();
  return (
    <XStack
      alignItems="center"
      justifyContent="space-between"
      paddingHorizontal="$4"
      paddingVertical="$4"
      gap="$3"
    >
      <YStack flex={1} gap="$1">
        <Text fontSize={typeScale.body} color="$color">
          {label}
        </Text>
        {description ? (
          <Text fontSize={typeScale.label} color="$textMuted">
            {description}
          </Text>
        ) : null}
      </YStack>
      <Switch
        value={value}
        onValueChange={onChange}
        accessibilityLabel={label}
        trackColor={{
          false: theme.surfaceInteractive?.val,
          true: theme.accent?.val,
        }}
      />
    </XStack>
  );
}

/** A row of mutually exclusive choices -- theme, retention, interval. */
export function SettingsChoice<T extends string | number>({
  label,
  options,
  value,
  format,
  onChange,
}: {
  label: string;
  options: readonly T[];
  value: T;
  format: (option: T) => string;
  onChange: (next: T) => void;
}) {
  return (
    <YStack paddingHorizontal="$4" paddingVertical="$4" gap="$3">
      <Text fontSize={typeScale.body} color="$color">
        {label}
      </Text>
      <XStack gap="$2" flexWrap="wrap">
        {options.map(option => {
          const selected = option === value;
          return (
            <XStack
              key={String(option)}
              onPress={() => onChange(option)}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={`${label}: ${format(option)}`}
              backgroundColor={selected ? '$surfaceInteractive' : 'transparent'}
              borderColor={selected ? '$accent' : '$borderColor'}
              borderWidth={1}
              borderRadius="$pill"
              paddingHorizontal="$4"
              paddingVertical="$2"
              pressStyle={PRESS_FEEDBACK}
            >
              <Text
                fontSize={typeScale.label}
                fontWeight={selected ? '700' : '400'}
                color={selected ? '$color' : '$textMuted'}
              >
                {format(option)}
              </Text>
            </XStack>
          );
        })}
      </XStack>
    </YStack>
  );
}

export function SettingsDivider() {
  return <YStack height={1} backgroundColor="$borderColor" />;
}
