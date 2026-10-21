import { useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Task } from '@yourtime/shared-types';
import {
  formatBudget,
  formatDateTime,
  formatDistance,
  formatMoney,
  timeAgo,
} from '@yourtime/shared-utils';
import { ApiError } from '@/api/client';
import { ConvertedAmount, ConvertedBudget } from '@/components/money/Converted';
import {
  useApplicationAction,
  useActiveServices,
  useCancelTask,
  useTask,
  useTaskApplications,
} from '@/api/hooks';
import { ScreenHeader } from '@/components/ScreenHeader';
import { useFeedback } from '@/components/feedback/FeedbackProvider';
import { ApplicantCard } from '@/components/task/ApplicantCard';
import { ApplySheet } from '@/components/task/ApplySheet';
import { ReviewCard } from '@/components/reviews/ReviewCard';
import { ReplySheet, ReviewSheet } from '@/components/reviews/ReviewSheets';
import { RatingBadge } from '@/components/reviews/Stars';
import { ContactCard } from '@/components/task/ContactCard';
import { TaskProgress } from '@/components/task/TaskProgress';
import { DistanceBadge } from '@/components/task/DistanceBadge';
import {
  Avatar,
  Badge,
  Button,
  Card,
  EmptyState,
  Icon,
  PressableScale,
  Screen,
  Skeleton,
  Text,
  safeIcon,
  type IconName,
} from '@/components/ui';
import {
  applicationStatusLabel,
  applicationStatusTone,
  budgetTypeLabel,
  taskStatusLabel,
  taskStatusTone,
} from '@/lib/messages';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/tokens';

export default function TaskDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const query = useTask(id);

  return (
    <View style={styles.flex}>
      <ScreenHeader title="Tarea" />
      {query.isLoading ? (
        <Screen noTopInset>
          <View style={{ gap: space.md }}>
            <Skeleton width="70%" height={26} />
            <Skeleton width="40%" />
            <Skeleton height={120} />
            <Skeleton height={90} />
          </View>
        </Screen>
      ) : query.isError || !query.data ? (
        <Screen noTopInset>
          <EmptyState
            icon="alert-circle-outline"
            title={
              query.error instanceof ApiError && query.error.status === 404
                ? 'Esta tarea ya no existe'
                : 'No pudimos cargar la tarea'
            }
            message="Vuelve atrás e inténtalo de nuevo."
            actionLabel="Reintentar"
            onAction={() => void query.refetch()}
          />
        </Screen>
      ) : (
        <TaskDetail
          task={query.data}
          onRefresh={() => void query.refetch()}
          refreshing={query.isRefetching}
        />
      )}
    </View>
  );
}

function TaskDetail({
  task,
  onRefresh,
  refreshing,
}: {
  task: Task;
  onRefresh: () => void;
  refreshing: boolean;
}) {
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { toast, confirm } = useFeedback();
  const [applying, setApplying] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [replying, setReplying] = useState(false);

  const isOwner = task.is_owner;
  const mine = task.my_application;
  const offers = useTaskApplications(task.id, isOwner);
  const accept = useApplicationAction(task.id, 'accept');
  const reject = useApplicationAction(task.id, 'reject');
  const withdraw = useApplicationAction(task.id, 'withdraw');
  const cancel = useCancelTask(task.id);
  const active = useActiveServices();
  // One hire at a time: while a service is under way the poster cannot choose another.
  const blockedByActive = isOwner && task.status === 'open' && !!active.data?.as_client;

  const fail = (e: unknown) =>
    toast(e instanceof ApiError ? e.message : 'No pudimos completar la acción.', 'error');

  const onAccept = async (applicationId: string, name: string, price: string) => {
    const ok = await confirm({
      title: `¿Elegir a ${name}?`,
      message: `Acordarán ${price}. Las demás postulaciones se descartarán y compartirán sus datos de contacto.`,
      confirmLabel: 'Sí, elegir',
    });
    if (ok)
      accept.mutate(applicationId, {
        onSuccess: () => {
          toast(`Elegiste a ${name}. Sigue el servicio desde aquí.`);
          router.push({ pathname: '/service/[id]', params: { id: task.id } });
        },
        onError: fail,
      });
  };

  const onReject = async (applicationId: string, name: string) => {
    const ok = await confirm({
      title: `¿Descartar a ${name}?`,
      confirmLabel: 'Descartar',
      destructive: true,
    });
    if (ok) reject.mutate(applicationId, { onError: fail });
  };

  const onWithdraw = async () => {
    if (!mine) return;
    const ok = await confirm({
      title: '¿Retirar tu postulación?',
      message: 'Podrás volver a postularte mientras la tarea siga abierta.',
      confirmLabel: 'Retirar',
      destructive: true,
    });
    if (ok)
      withdraw.mutate(mine.id, {
        onSuccess: () => toast('Postulación retirada.', 'info'),
        onError: fail,
      });
  };

  const onCancel = async () => {
    const ok = await confirm({
      title: '¿Cancelar la tarea?',
      message:
        task.status === 'open'
          ? 'Dejará de ser visible para todos.'
          : 'La persona elegida quedará libre para otros servicios.',
      confirmLabel: 'Cancelar tarea',
      cancelLabel: 'Volver',
      destructive: true,
    });
    if (ok)
      cancel.mutate(undefined, {
        onSuccess: () => toast('Tarea cancelada.', 'info'),
        onError: fail,
      });
  };

  const showApplyBar = !isOwner && task.can_apply;
  const counterpart = isOwner ? task.assigned_applicant : task.poster;
  const openProfile = (id: string) => router.push({ pathname: '/user/[id]', params: { id } });
  const canSeeReviews =
    task.status === 'completed' && counterpart && (isOwner || mine?.status === 'accepted');
  const location = task.location;
  const serviceLive = ['assigned', 'en_route', 'in_progress'].includes(task.status);
  const canOpenService = serviceLive && (isOwner || task.is_worker);
  const can = (action: Task['actions'][number]) => task.actions.includes(action);

  return (
    <View style={styles.flex}>
      <Screen
        noTopInset
        onRefresh={onRefresh}
        refreshing={refreshing}
        bottomInset={showApplyBar ? 96 : 0}
      >
        <View style={styles.titleBlock}>
          <View style={styles.tags}>
            <View style={[styles.categoryIcon, { backgroundColor: `${task.category.color}1F` }]}>
              <Icon name={safeIcon(task.category.icon)} size={16} color={task.category.color} />
            </View>
            <Text variant="caption" tone="muted">
              {task.category.name}
            </Text>
            <Badge label={taskStatusLabel[task.status]} tone={taskStatusTone[task.status]} />
          </View>
          <Text variant="title">{task.title}</Text>
          <PressableScale
            accessibilityRole="link"
            accessibilityLabel={`Ver perfil de ${task.poster.full_name}`}
            disabled={isOwner}
            onPress={() => openProfile(task.poster.id)}
            scaleTo={0.98}
            style={styles.poster}
          >
            <Avatar name={task.poster.full_name} uri={task.poster.avatar_url} size={28} />
            <View style={styles.posterText}>
              <Text variant="caption" tone="muted">
                {isOwner ? 'Publicada por ti' : task.poster.full_name}
              </Text>
              {isOwner ? null : <RatingBadge rating={task.poster.rating} />}
              <Text variant="caption" tone="muted">
                · {timeAgo(task.created_at)}
              </Text>
            </View>
          </PressableScale>
          <TaskProgress status={task.status} />
        </View>

        <Card>
          <Text variant="caption" tone="muted">
            {task.budget.type === 'negotiable' ? 'Presupuesto' : budgetTypeLabel[task.budget.type]}
          </Text>
          {/* A long range ("80.000 COP – 150.000 COP") would wrap into two huge lines. */}
          <Text
            variant={formatBudget(task.budget).length > 16 ? 'title' : 'display'}
            level={0}
            tone="primary"
            style={styles.tabular}
          >
            {formatBudget(task.budget)}
          </Text>
          <ConvertedBudget budget={task.budget} />
          <View style={styles.facts}>
            <Fact
              icon={task.is_remote ? 'globe-outline' : 'location-outline'}
              label={
                task.is_remote
                  ? 'Se hace a distancia'
                  : [location?.city, location?.address].filter(Boolean).join(' · ') ||
                    'Ubicación indicada'
              }
            />
            {task.scheduled_at ? (
              <Fact icon="calendar-outline" label={formatDateTime(task.scheduled_at)} />
            ) : (
              <Fact icon="calendar-outline" label="Sin fecha definida" />
            )}
            <Fact
              icon="people-outline"
              label={`${task.applications_count} ${task.applications_count === 1 ? 'postulación' : 'postulaciones'}`}
            />
          </View>
          <View style={styles.distance}>
            <DistanceBadge task={task} />
          </View>
        </Card>

        {!isOwner && task.within_preferred_radius === false && task.distance_km != null ? (
          <View style={[styles.hint, { backgroundColor: colors.warningSoft }]}>
            <Icon name="information-circle" size={20} color="warning" />
            <Text variant="caption" tone="warning" style={styles.flex}>
              Queda a {formatDistance(task.distance_km)}, fuera de tu radio preferido. Tú decides si
              te sirve: puedes postularte igual.
            </Text>
          </View>
        ) : null}

        <View style={styles.section}>
          <Text variant="heading">Descripción</Text>
          <Text tone="muted" selectable>
            {task.description}
          </Text>
        </View>

        {/* ---- the chosen applicant (poster) / the poster (chosen applicant) ---- */}
        {isOwner && task.assigned_applicant ? (
          <ContactCard title="Persona elegida" party={task.assigned_applicant} />
        ) : null}
        {!isOwner && mine?.status === 'accepted' ? (
          <ContactCard title="Te eligieron: contacta a quien publicó" party={task.poster} />
        ) : null}

        {/* ---- applicant's own offer ---- */}
        {!isOwner && mine ? (
          <Card>
            <View style={styles.offerHead}>
              <Text variant="heading">Tu postulación</Text>
              <Badge
                label={applicationStatusLabel[mine.status]}
                tone={applicationStatusTone[mine.status]}
              />
            </View>
            <Text variant="title" level={0} tone="primary" style={styles.offerPrice}>
              {formatMoney(mine.price_minor, task.budget.currency)}
            </Text>
            <ConvertedAmount minor={mine.price_minor} currency={task.budget.currency} />
            {mine.status === 'pending' ? (
              <Button
                label="Retirar postulación"
                variant="ghost"
                size="sm"
                onPress={() => void onWithdraw()}
                loading={withdraw.isPending}
              />
            ) : null}
          </Card>
        ) : null}

        {/* ---- poster's offers ---- */}
        {isOwner ? (
          <View style={styles.section}>
            <Text variant="heading">Postulaciones</Text>
            {blockedByActive && active.data?.as_client ? (
              <View style={[styles.hint, { backgroundColor: colors.warningSoft }]}>
                <Icon name="information-circle" size={20} color="warning" />
                <Text variant="caption" tone="warning" style={styles.flex}>
                  Ya tienes un servicio en curso. Podrás elegir a alguien aquí cuando lo finalices.
                </Text>
              </View>
            ) : null}
            {offers.isLoading ? (
              <ActivityIndicator color={colors.primary} />
            ) : offers.isError ? (
              <Text tone="danger">No pudimos cargar las postulaciones.</Text>
            ) : offers.data && offers.data.length > 0 ? (
              offers.data.map((a) => (
                <ApplicantCard
                  key={a.id}
                  application={a}
                  canDecide={task.status === 'open' && !blockedByActive}
                  applicantBusy={a.applicant_busy}
                  busy={accept.isPending || reject.isPending}
                  onAccept={() =>
                    void onAccept(
                      a.id,
                      a.applicant.full_name,
                      formatMoney(a.price_minor, a.currency)
                    )
                  }
                  onReject={() => void onReject(a.id, a.applicant.full_name)}
                  onPressProfile={() => openProfile(a.applicant.id)}
                />
              ))
            ) : (
              <Text tone="muted">
                Aún nadie se ha postulado. Cuando llegue una postulación, la verás aquí.
              </Text>
            )}
          </View>
        ) : null}

        {/* ---- reviews, once the service is finished ---- */}
        {canSeeReviews ? (
          <View style={styles.section}>
            <Text variant="heading">Calificaciones</Text>
            {task.can_review ? (
              <Card>
                <Text variant="bodyStrong">¿Cómo te fue con {counterpart.full_name}?</Text>
                <Text tone="muted" style={styles.reviewPrompt}>
                  Tu calificación ayuda a otras personas a decidir.
                </Text>
                <Button label="Calificar" icon="star" onPress={() => setReviewing(true)} block />
              </Card>
            ) : null}
            {task.review_for_me ? (
              <ReviewCard
                heading={`Reseña de ${counterpart.full_name}`}
                review={task.review_for_me}
                replyLabel="Tu respuesta"
                onReply={task.review_for_me.reply ? undefined : () => setReplying(true)}
              />
            ) : null}
            {task.my_review ? (
              <ReviewCard
                heading="Tu reseña"
                review={task.my_review}
                replyLabel={`Respuesta de ${counterpart.full_name}`}
              />
            ) : null}
          </View>
        ) : null}

        {/* ---- the live service, and what the poster can still change ---- */}
        {canOpenService || (isOwner && (can('edit') || can('cancel'))) ? (
          <View style={styles.manage}>
            {canOpenService ? (
              <Button
                label="Ver servicio en curso"
                icon="navigate"
                onPress={() => router.push({ pathname: '/service/[id]', params: { id: task.id } })}
                block
              />
            ) : null}
            {isOwner && can('edit') ? (
              <Button
                label="Editar tarea"
                icon="create-outline"
                variant="secondary"
                onPress={() =>
                  router.push({ pathname: '/task/[id]/edit', params: { id: task.id } })
                }
                block
              />
            ) : null}
            {isOwner && can('cancel') ? (
              <Button
                label="Cancelar tarea"
                variant="danger"
                onPress={() => void onCancel()}
                loading={cancel.isPending}
                block
              />
            ) : null}
          </View>
        ) : null}
      </Screen>

      {showApplyBar ? (
        <View
          style={[
            styles.applyBar,
            {
              backgroundColor: colors.surface,
              borderTopColor: colors.border,
              paddingBottom: Math.max(insets.bottom, space.md),
            },
          ]}
        >
          <View style={styles.flex}>
            <Text variant="caption" tone="muted">
              Presupuesto
            </Text>
            <Text variant="bodyStrong">{formatBudget(task.budget)}</Text>
            <ConvertedBudget budget={task.budget} />
          </View>
          <Button
            label={mine?.status === 'withdrawn' ? 'Postularme de nuevo' : 'Postularme'}
            icon="paper-plane-outline"
            onPress={() => setApplying(true)}
          />
        </View>
      ) : null}

      {!isOwner ? (
        <ApplySheet task={task} visible={applying} onClose={() => setApplying(false)} />
      ) : null}
      {counterpart && task.status === 'completed' ? (
        <>
          <ReviewSheet
            taskId={task.id}
            counterpartName={counterpart.full_name}
            visible={reviewing && task.can_review}
            onClose={() => setReviewing(false)}
          />
          <ReplySheet
            review={task.review_for_me}
            taskId={task.id}
            visible={replying}
            onClose={() => setReplying(false)}
          />
        </>
      ) : null}
    </View>
  );
}

function Fact({ icon, label }: { icon: IconName; label: string }) {
  return (
    <View style={styles.fact}>
      <Icon name={icon} size={16} color="textSubtle" />
      <Text variant="caption" tone="muted" style={styles.flex}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  tabular: { fontVariant: ['tabular-nums'] },
  titleBlock: { gap: space.sm, marginBottom: space.lg },
  tags: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  categoryIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  poster: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    alignSelf: 'flex-start',
    minHeight: 44,
  },
  posterText: { flexDirection: 'row', alignItems: 'center', gap: space.xs, flexWrap: 'wrap' },
  reviewPrompt: { marginVertical: space.sm },
  facts: { gap: space.sm, marginTop: space.lg },
  fact: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  distance: { marginTop: space.md },
  hint: {
    flexDirection: 'row',
    gap: space.sm,
    padding: space.md,
    borderRadius: radius.md,
    marginTop: space.md,
  },
  section: { gap: space.md, marginTop: space.xl },
  offerHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  offerPrice: { marginVertical: space.sm },
  manage: { gap: space.md, marginTop: space.xxl },
  applyBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.lg,
    paddingHorizontal: space.xl,
    paddingTop: space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
