import { Linking, StyleSheet, View } from 'react-native';
import type { Party } from '@yourtime/shared-types';
import { RatingBadge } from '@/components/reviews/Stars';
import { Avatar, Button, Card, Text } from '@/components/ui';
import { useTheme } from '@/theme/ThemeProvider';
import { space } from '@/theme/tokens';

interface ContactCardProps {
  title: string;
  party: Party;
}

/** Contact details shared between the poster and the chosen applicant. */
export function ContactCard({ title, party }: ContactCardProps) {
  const { colors } = useTheme();
  return (
    <Card
      style={{
        backgroundColor: colors.successSoft,
        borderColor: colors.successSoft,
        marginTop: space.xl,
      }}
    >
      <Text variant="label" tone="success">
        {title}
      </Text>
      <View style={styles.person}>
        <Avatar name={party.full_name} uri={party.avatar_url} size={44} />
        <View style={styles.flex}>
          <Text variant="heading">{party.full_name}</Text>
          <RatingBadge rating={party.rating} />
          {party.email ? (
            <Text variant="caption" tone="muted" selectable>
              {party.email}
            </Text>
          ) : null}
          {party.phone ? (
            <Text variant="caption" tone="muted" selectable>
              {party.phone}
            </Text>
          ) : null}
        </View>
      </View>
      <View style={styles.actions}>
        {party.phone ? (
          <Button
            label="Llamar"
            icon="call-outline"
            size="sm"
            variant="secondary"
            onPress={() => void Linking.openURL(`tel:${party.phone}`)}
          />
        ) : null}
        {party.email ? (
          <Button
            label="Escribir"
            icon="mail-outline"
            size="sm"
            variant="secondary"
            onPress={() => void Linking.openURL(`mailto:${party.email}`)}
          />
        ) : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  person: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginTop: space.md },
  actions: { flexDirection: 'row', gap: space.sm, marginTop: space.md },
});
