import { StyleSheet, type StyleProp, type TextStyle } from 'react-native';
import type { BudgetLike } from '@yourtime/shared-utils';
import {
  convertBudget,
  convertMinor,
  formatBudget,
  formatMoney,
  roundForDisplay,
} from '@yourtime/shared-utils';
import { useRates } from '@/api/hooks';
import { Text } from '@/components/ui';
import { useAuth } from '@/store/auth';

/**
 * What an amount in another currency is worth in the person's own, at today's
 * rate. Used as a small line under a price: "≈ 45.000 COP". It is a guide for
 * comparing, not what is paid: the price stays in the currency it was agreed in.
 */
export function useConverter() {
  const currency = useAuth((s) => s.user?.currency);
  const rates = useRates().data;
  return { currency, rates };
}

interface LineProps {
  style?: StyleProp<TextStyle>;
}

/** Nothing renders for the person's own currency, or while rates are not known. */
export function ConvertedAmount({
  minor,
  currency,
  style,
}: LineProps & { minor: number; currency: string }) {
  const { currency: mine, rates } = useConverter();
  if (!mine || mine === currency) return null;
  const converted = convertMinor(minor, currency, mine, rates);
  if (converted == null) return null;
  return <Line text={formatMoney(roundForDisplay(converted, mine), mine)} style={style} />;
}

export function ConvertedBudget({ budget, style }: LineProps & { budget: BudgetLike }) {
  const { currency: mine, rates } = useConverter();
  if (!mine) return null;
  const converted = convertBudget(budget, mine, rates);
  if (!converted) return null;
  const rounded = {
    ...converted,
    min_minor: roundForDisplay(converted.min_minor as number, mine),
    max_minor: roundForDisplay(converted.max_minor as number, mine),
  };
  return <Line text={formatBudget(rounded)} style={style} />;
}

function Line({ text, style }: LineProps & { text: string }) {
  return (
    <Text
      variant="caption"
      tone="subtle"
      style={[styles.line, style]}
      accessibilityLabel={`Aproximadamente ${text} en tu moneda`}
    >
      ≈ {text}
    </Text>
  );
}

const styles = StyleSheet.create({
  line: { fontVariant: ['tabular-nums'] },
});
