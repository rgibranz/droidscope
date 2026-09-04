import { Text, XStack } from './tamagui';
import { typeScale } from '../core/theme/tokens';
import { RANGE_ORDER, type HistoryRange } from '../data/history/buckets';

const PRESS_FEEDBACK = { opacity: 0.7 } as const;

export function TimeRangeSelector({
  value,
  onChange,
}: {
  value: HistoryRange;
  onChange: (range: HistoryRange) => void;
}) {
  return (
    <XStack
      backgroundColor="$surface"
      borderColor="$borderColor"
      borderWidth={1}
      borderRadius="$pill"
      padding="$1"
      gap="$1"
      alignSelf="flex-start"
    >
      {RANGE_ORDER.map(range => {
        const selected = range === value;
        return (
          <XStack
            key={range}
            onPress={() => onChange(range)}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            accessibilityLabel={`Show last ${range}`}
            backgroundColor={selected ? '$surfaceInteractive' : 'transparent'}
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
              {range}
            </Text>
          </XStack>
        );
      })}
    </XStack>
  );
}
