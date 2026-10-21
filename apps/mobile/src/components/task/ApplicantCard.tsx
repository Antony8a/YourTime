import { StyleSheet, View } from 'react-native';
import type { Application } from '@yourtime/shared-types';
import { formatMoney, timeAgo } from '@yourtime/shared-utils';
import { ConvertedAmount } from '@/components/money/Converted';
import { ReliabilityFacts } from '@/components/reviews/ReliabilityFacts';
import { RatingBadge } from '@/components/reviews/Stars';
import { Avatar, Badge, Button, Card, PressableScale, Text } from '@/components/ui';
import { applicationStatusLabel, applicationStatusTone } from '@/lib/messages';
import { space } from '@/theme/tokens';

interface ApplicantCardProps {
  application: Application;
  /** Only offered while the task is open and this offer is pending. */
  canDecide: boolean;
  busy: boolean;
  onAccept: () => void;
  onReject: () => void;
  /** Open the applicant's public profile and reviews. */
  /** The applicant is doing another service now, so they cannot be chosen yet. */
  applicantBusy?: boolean;
  onPressProfile: () => void;
}

/** One offer on a task, shown to the poster so they can choose. */
export function ApplicantCard({
  application,
  canDecide,
  busy,
  onAccept,
  onReject,
  applicantBusy = false,
  onPressProfile,
}: ApplicantCardProps) {
  const pending = application.status === 'pending';
  return (
    <Card>
      <View style={styles.head}>
        <PressableScale
          accessibilityRole="link"
          accessibilityLabel={`Ver perfil de ${application.applicant.full_name}`}
          onPress={onPressProfile}
          scaleTo={0.98}
          style={styles.person}
        >
          <Avatar
            name={application.applicant.full_name}
            uri={application.applicant.avatar_url}
            size={42}
          />
          <View style={styles.flex}>
            <Text variant="heading">{application.applicant.full_name}</Text>
            <RatingBadge rating={application.applicant.rating} />
            <Text variant="caption" tone="subtle">
              Se postuló {timeAgo(application.created_at)}
            </Text>
          </View>
        </PressableScale>
        {pending && applicantBusy ? (
          <Badge label="Ocupado ahora" tone="warning" icon="time-outline" />
        ) : null}
        {!pending ? (
          <Badge
            label={applicationStatusLabel[application.status]}
            tone={applicationStatusTone[application.status]}
          />
        ) : null}
      </View>

      <ReliabilityFacts
        reliability={application.applicant.reliability}
        emptyLabel="Aún sin servicios realizados."
      />

      <View style={styles.price}>
        <Text variant="caption" tone="muted">
          Propone
        </Text>
        <Text variant="title" level={0} tone="primary">
          {formatMoney(application.price_minor, application.currency)}
        </Text>
        <ConvertedAmount minor={application.price_minor} currency={application.currency} />
      </View>

      {application.message ? <Text tone="muted">{application.message}</Text> : null}

      {canDecide && pending && applicantBusy ? (
        <Text variant="caption" tone="warning" style={styles.busyNote}>
          Está haciendo otro servicio ahora. Podrás elegirle cuando termine.
        </Text>
      ) : null}

      {canDecide && pending ? (
        <View style={styles.actions}>
          <View style={styles.flex}>
            <Button
              label="Elegir"
              icon="checkmark"
              onPress={onAccept}
              loading={busy}
              disabled={busy || applicantBusy}
              block
            />
          </View>
          <Button label="Descartar" variant="ghost" onPress={onReject} disabled={busy} />
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  person: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 44 },
  busyNote: { marginTop: space.md },
  price: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: space.sm,
    marginTop: space.md,
    marginBottom: space.sm,
  },
  actions: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.lg },
});
