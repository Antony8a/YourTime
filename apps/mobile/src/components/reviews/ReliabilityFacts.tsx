import { StyleSheet, View } from 'react-native';
import type { Reliability } from '@yourtime/shared-types';
import { reliabilityFacts, type ReliabilityTone } from '@yourtime/shared-utils';
import { Icon, Text, type IconName } from '@/components/ui';
import { space } from '@/theme/tokens';

const toneToText = { good: 'success', warn: 'warning', bad: 'danger', neutral: 'muted' } as const;
const toneToIcon: Record<ReliabilityTone, IconName> = {
  good: 'checkmark-circle-outline',
  warn: 'time-outline',
  bad: 'alert-circle-outline',
  neutral: 'time-outline',
};

interface ReliabilityFactsProps {
  reliability: Reliability | undefined;
  /** Shown when there is nothing to say yet, e.g. someone's first applications. */
  emptyLabel?: string;
}

/**
 * How someone has behaved as a worker: how fast they set out once chosen and
 * whether they arrive on time. It helps a poster decide, so it says plainly when
 * there is not enough history instead of showing an empty or invented score.
 */
export function ReliabilityFacts({ reliability, emptyLabel }: ReliabilityFactsProps) {
  const facts = reliabilityFacts(reliability);
  const rows: { icon: IconName; text: string; tone: 'muted' | 'success' | 'warning' | 'danger' }[] =
    [];
  if (facts.punctuality)
    rows.push({
      icon: toneToIcon[facts.punctualityTone],
      text: facts.punctuality,
      tone: toneToText[facts.punctualityTone],
    });
  if (facts.response) rows.push({ icon: 'flash-outline', text: facts.response, tone: 'muted' });
  if (facts.experience)
    rows.push({ icon: 'briefcase-outline', text: facts.experience, tone: 'muted' });

  if (rows.length === 0) {
    return emptyLabel ? (
      <Text variant="caption" tone="subtle">
        {emptyLabel}
      </Text>
    ) : null;
  }
  return (
    <View style={styles.list} accessible accessibilityLabel={rows.map((r) => r.text).join('. ')}>
      {rows.map((row) => (
        <View key={row.text} style={styles.row} importantForAccessibility="no-hide-descendants">
          <Icon name={row.icon} size={15} color={row.tone === 'muted' ? 'textMuted' : row.tone} />
          <Text variant="caption" tone={row.tone}>
            {row.text}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: 2, marginTop: space.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
});
