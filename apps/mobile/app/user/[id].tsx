import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams } from 'expo-router';
import type { Review } from '@yourtime/shared-types';
import { intlLocale, t, tn } from '@yourtime/shared-utils';
import { ApiError } from '@/api/client';
import { flatten, useProfile, useUserReviews } from '@/api/hooks';
import { ScreenHeader } from '@/components/ScreenHeader';
import { ReliabilityFacts } from '@/components/reviews/ReliabilityFacts';
import { ReviewCard } from '@/components/reviews/ReviewCard';
import { ReplySheet } from '@/components/reviews/ReviewSheets';
import { StarRow, formatAverage } from '@/components/reviews/Stars';
import { Avatar, Button, EmptyState, Screen, Skeleton, Text } from '@/components/ui';
import { useAuth } from '@/store/auth';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/tokens';

/** Public profile: who someone is and what others say about them. No contact details. */
export default function UserProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const me = useAuth((s) => s.user);
  const profile = useProfile(id);
  const reviews = useUserReviews(id);
  const [replyTo, setReplyTo] = useState<Review | null>(null);

  const isMe = me?.id === id;
  const list = flatten(reviews.data?.pages);

  if (profile.isLoading) {
    return (
      <View style={styles.flex}>
        <ScreenHeader title={t('Perfil')} />
        <Screen noTopInset>
          <View style={{ gap: space.md }}>
            <Skeleton height={150} />
            <Skeleton height={90} />
          </View>
        </Screen>
      </View>
    );
  }

  if (profile.isError || !profile.data) {
    return (
      <View style={styles.flex}>
        <ScreenHeader title={t('Perfil')} />
        <Screen noTopInset>
          <EmptyState
            icon="person-outline"
            title={
              profile.error instanceof ApiError && profile.error.status === 404
                ? t('Este perfil no está disponible')
                : t('No pudimos cargar el perfil')
            }
            actionLabel={t('Reintentar')}
            onAction={() => void profile.refetch()}
          />
        </Screen>
      </View>
    );
  }

  const p = profile.data;
  const since = new Intl.DateTimeFormat(intlLocale(), { month: 'long', year: 'numeric' }).format(
    new Date(p.member_since)
  );

  return (
    <View style={styles.flex}>
      <ScreenHeader title={isMe ? t('Mi perfil') : t('Perfil')} />
      <Screen noTopInset>
        <LinearGradient
          colors={[colors.primarySoft, colors.surface]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.identity, { borderColor: colors.border }]}
        >
          <Avatar name={p.full_name} uri={p.avatar_url} size={72} />
          <Text variant="title" style={styles.center}>
            {p.full_name}
          </Text>
          <Text variant="caption" tone="muted">
            {t('Miembro desde {date}', { date: since })}
          </Text>

          {p.rating.count > 0 ? (
            <View
              style={styles.score}
              accessible
              accessibilityLabel={tn(
                p.rating.count,
                'Calificación {average} de 5, según {count} persona',
                'Calificación {average} de 5, según {count} personas',
                { average: formatAverage(p.rating.average) }
              )}
            >
              <Text style={styles.scoreNumber}>{formatAverage(p.rating.average)}</Text>
              <View style={styles.scoreSide}>
                <StarRow value={p.rating.average} size={18} />
                <Text variant="caption" tone="muted">
                  {tn(p.rating.count, '{count} calificación', '{count} calificaciones')}
                </Text>
              </View>
            </View>
          ) : (
            <Text tone="muted" style={styles.center}>
              {t('Aún no tiene calificaciones.')}
            </Text>
          )}

          {p.bio ? (
            <Text tone="muted" style={styles.center}>
              {p.bio}
            </Text>
          ) : null}
        </LinearGradient>

        <View style={styles.section}>
          <Text variant="heading">{t('Cómo trabaja')}</Text>
          <ReliabilityFacts
            reliability={p.reliability}
            emptyLabel={
              isMe
                ? t(
                    'Cuando termines servicios, aquí verás qué tan rápido sales y si llegas a tiempo.'
                  )
                : t('Aún no ha realizado servicios.')
            }
          />
          {p.reliability.on_time_total > 0 ? (
            <Text variant="caption" tone="subtle">
              {t(
                'La puntualidad solo cuenta servicios presenciales con hora acordada, y es justa: no se penaliza el tráfico si salió a tiempo ni si lo eligieron sin tiempo para llegar.'
              )}
            </Text>
          ) : null}
        </View>

        <View style={styles.section}>
          <Text variant="heading">{t('Reseñas')}</Text>
          {reviews.isLoading ? (
            <Skeleton height={110} />
          ) : list.length === 0 ? (
            <Text tone="muted">
              {isMe
                ? t('Cuando alguien te califique al finalizar una tarea, lo verás aquí.')
                : t('Todavía no tiene reseñas.')}
            </Text>
          ) : (
            list.map((r) => (
              <ReviewCard
                key={r.id}
                review={r}
                showReviewer
                replyLabel={t('Respuesta de {full_name}', { full_name: p.full_name })}
                onReply={isMe && !r.reply ? () => setReplyTo(r) : undefined}
              />
            ))
          )}
          {reviews.hasNextPage ? (
            <Button
              label={t('Ver más reseñas')}
              variant="secondary"
              onPress={() => void reviews.fetchNextPage()}
              loading={reviews.isFetchingNextPage}
              block
            />
          ) : null}
        </View>
      </Screen>

      <ReplySheet review={replyTo} visible={replyTo !== null} onClose={() => setReplyTo(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  identity: {
    alignItems: 'center',
    gap: space.sm,
    padding: space.xl,
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
  },
  center: { textAlign: 'center' },
  score: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginTop: space.sm },
  scoreNumber: { fontSize: 44, lineHeight: 48, fontWeight: '800', letterSpacing: -1 },
  scoreSide: { gap: 2 },
  section: { gap: space.md, marginTop: space.xl },
});
