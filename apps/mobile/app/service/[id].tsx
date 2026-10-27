import { useEffect, useRef, useState } from 'react';
import { Linking, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Task } from '@yourtime/shared-types';
import {
  distanceKm,
  etaMinutes,
  formatDistance,
  formatElapsed,
  formatMoney,
  t,
  timeAgo,
} from '@yourtime/shared-utils';
import { ApiError } from '@/api/client';
import { ConvertedAmount } from '@/components/money/Converted';
import {
  useCancelTask,
  useCompleteTask,
  useReleaseTask,
  useStartRoute,
  useStartService,
  useTask,
} from '@/api/hooks';
import { useFeedback } from '@/components/feedback/FeedbackProvider';
import { ReviewSheet } from '@/components/reviews/ReviewSheets';
import { RatingBadge } from '@/components/reviews/Stars';
import { RouteMap } from '@/components/service/RouteMap';
import { TaskProgress } from '@/components/task/TaskProgress';
import {
  Avatar,
  Button,
  Card,
  EmptyState,
  Icon,
  PressableScale,
  Skeleton,
  Text,
  type IconName,
} from '@/components/ui';
import { useDeviceLocation } from '@/lib/useDeviceLocation';
import { fetchRouteWithin, useRoute } from '@/lib/routing';
import { useShareLocation } from '@/lib/useShareLocation';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/tokens';

/** How often the live screen refreshes the task while a service is under way. */
const POLL_MS = 5000;
/** A position older than this is called out as stale. */
const STALE_MS = 90_000;
/** How long starting the route waits for the trip estimate before going without it. */
const ROUTE_ETA_WAIT_MS = 3000;

/** Farther than this from the destination, starting the service asks for confirmation. */
const ARRIVED_KM = 0.3;

export default function ServiceScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, shadow } = useTheme();
  const { height } = useWindowDimensions();
  const query = useTask(id, POLL_MS);
  const heroHeight = Math.round(Math.min(380, Math.max(260, height * 0.42)));

  const back = (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={t('Volver')}
      onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
      style={[
        styles.back,
        shadow(2),
        { top: insets.top + space.sm, backgroundColor: colors.surface },
      ]}
    >
      <Icon name="chevron-back" size={22} />
    </PressableScale>
  );

  if (query.isLoading) {
    return (
      <View style={[styles.flex, { backgroundColor: colors.bg }]}>
        {back}
        <Skeleton height={heroHeight} />
        <View style={styles.pad}>
          <Skeleton width="60%" height={24} />
          <Skeleton height={80} />
        </View>
      </View>
    );
  }

  const task = query.data;
  const participant = task && (task.is_owner || task.is_worker);
  const live = task && ['assigned', 'en_route', 'in_progress', 'completed'].includes(task.status);

  if (!task || !participant || !live) {
    return (
      <View style={[styles.flex, { backgroundColor: colors.bg, paddingTop: insets.top + 64 }]}>
        {back}
        <EmptyState
          icon="car-outline"
          title={
            task && participant && !live
              ? t('Este servicio ya no está activo')
              : query.error instanceof ApiError && query.error.status === 404
                ? t('Este servicio no existe')
                : t('No pudimos abrir el servicio')
          }
          message={t('Solo quien publicó la tarea y la persona elegida pueden verlo.')}
          actionLabel={task ? t('Ver la tarea') : t('Reintentar')}
          onAction={() =>
            task
              ? router.replace({ pathname: '/task/[id]', params: { id: task.id } })
              : void query.refetch()
          }
        />
      </View>
    );
  }

  return <ServiceView task={task} heroHeight={heroHeight} back={back} />;
}

function useNow(everyMs: number, enabled: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!enabled) return;
    const id = setInterval(() => setNow(Date.now()), everyMs);
    return () => clearInterval(id);
  }, [everyMs, enabled]);
  return now;
}

function ServiceView({
  task,
  heroHeight,
  back,
}: {
  task: Task;
  heroHeight: number;
  back: React.ReactNode;
}) {
  const router = useRouter();
  const { colors, shadow } = useTheme();
  const { toast, confirm } = useFeedback();
  const { locate, locating } = useDeviceLocation();

  const startRoute = useStartRoute(task.id);
  const startService = useStartService(task.id);
  const complete = useCompleteTask(task.id);
  const cancel = useCancelTask(task.id);
  const release = useReleaseTask(task.id);

  const [reviewing, setReviewing] = useState(false);
  const prompted = useRef(false);

  const isWorker = task.is_worker;
  const counterpart = isWorker ? task.poster : task.assigned_applicant;
  const name = counterpart?.full_name ?? t('la otra persona');
  const travelling = task.status === 'en_route';
  const working = task.status === 'in_progress';
  const live = travelling || working;
  const onSite = !task.is_remote;

  const destination = task.location
    ? { latitude: task.location.latitude, longitude: task.location.longitude }
    : null;
  const worker = task.worker_location
    ? { latitude: task.worker_location.latitude, longitude: task.worker_location.longitude }
    : null;

  const route = useRoute(worker, destination, travelling);
  const sharing = useShareLocation(task.id, isWorker && onSite && live);

  const remainingKm =
    worker && destination ? (route.data?.distanceKm ?? distanceKm(worker, destination)) : null;
  const eta = route.data
    ? route.data.durationMin
    : remainingKm != null
      ? etaMinutes(remainingKm)
      : null;

  const now = useNow(1000, working);
  const startedAt = task.started_at ? new Date(task.started_at).getTime() : null;
  const finishedAt = task.completed_at ? new Date(task.completed_at).getTime() : null;
  const stale =
    travelling &&
    task.worker_location &&
    now - new Date(task.worker_location.updated_at).getTime() > STALE_MS;

  // Finishing is the moment to rate: open the sheet once for whoever is looking.
  useEffect(() => {
    if (task.status === 'completed' && task.can_review && !prompted.current) {
      prompted.current = true;
      setReviewing(true);
    }
  }, [task.status, task.can_review]);

  const fail = (e: unknown) =>
    toast(e instanceof ApiError ? e.message : t('No pudimos completar la acción.'), 'error');
  const has = (action: Task['actions'][number]) => task.actions.includes(action);

  const onStartRoute = async () => {
    const place = await locate();
    if (!place) return;
    // The trip time on the route lets the server judge punctuality fairly. It is
    // optional and bounded in time, so it never holds the worker back.
    const trip = destination ? await fetchRouteWithin(place, destination, ROUTE_ETA_WAIT_MS) : null;
    startRoute.mutate(
      {
        latitude: place.latitude,
        longitude: place.longitude,
        ...(trip ? { eta_seconds: Math.round(trip.durationMin * 60) } : {}),
      },
      {
        onSuccess: () => toast(t('Ruta iniciada. {name} te verá en el mapa.', { name })),
        onError: fail,
      }
    );
  };

  const onStartService = async () => {
    const away =
      onSite && worker && destination && distanceKm(worker, destination) > ARRIVED_KM
        ? distanceKm(worker, destination)
        : null;
    const ok = await confirm({
      title: t('¿Iniciar el servicio?'),
      message:
        away != null
          ? t(
              'Según tu ubicación aún estás a {value} del destino. Inicia el servicio solo cuando hayas llegado.',
              { value: formatDistance(away) }
            )
          : t('{name} verá que el servicio comenzó.', { name }),
      confirmLabel: t('Iniciar servicio'),
    });
    if (ok)
      startService.mutate(undefined, {
        onSuccess: () => toast(t('Servicio iniciado.')),
        onError: fail,
      });
  };

  const onComplete = async () => {
    const ok = await confirm({
      title: isWorker ? t('¿Finalizar el servicio?') : t('¿Confirmar que terminó?'),
      message: t('Después podrán calificarse mutuamente.'),
      confirmLabel: isWorker ? t('Finalizar') : t('Confirmar'),
    });
    if (ok)
      complete.mutate(undefined, {
        onSuccess: () => toast(t('Servicio finalizado.')),
        onError: fail,
      });
  };

  const onRelease = async () => {
    const ok = await confirm({
      title: t('¿Renunciar a este servicio?'),
      message: t('La tarea volverá a estar disponible y la persona podrá elegir a alguien más.'),
      confirmLabel: t('Renunciar'),
      cancelLabel: t('Seguir'),
      destructive: true,
    });
    if (ok)
      release.mutate(undefined, {
        onSuccess: () => {
          toast(t('Renunciaste al servicio.'), 'info');
          router.replace({ pathname: '/task/[id]', params: { id: task.id } });
        },
        onError: fail,
      });
  };

  const onCancel = async () => {
    const ok = await confirm({
      title: t('¿Cancelar el servicio?'),
      message: t(
        '{name} quedará libre para otros servicios. No podrás cancelar una vez que comience.',
        { name }
      ),
      confirmLabel: t('Cancelar servicio'),
      cancelLabel: t('Volver'),
      destructive: true,
    });
    if (ok)
      cancel.mutate(undefined, {
        onSuccess: () => {
          toast(t('Servicio cancelado.'), 'info');
          router.replace({ pathname: '/task/[id]', params: { id: task.id } });
        },
        onError: fail,
      });
  };

  // ---- what to say, depending on where we are and who is looking ----
  const header: { icon: IconName; title: string; subtitle: string } = (() => {
    switch (task.status) {
      case 'assigned':
        return isWorker
          ? {
              icon: 'time-outline',
              title: t('Todo listo'),
              subtitle: task.is_remote
                ? t('Inicia el servicio cuando estés listo.')
                : t('Inicia la ruta cuando salgas hacia el destino.'),
            }
          : {
              icon: 'time-outline',
              title: t('{name} se prepara', { name }),
              subtitle: t('Verás aquí cuando salga hacia ti.'),
            };
      case 'en_route':
        return isWorker
          ? { icon: 'navigate', title: t('Rumbo al destino'), subtitle: etaText(eta, remainingKm) }
          : {
              icon: 'navigate',
              title: t('{name} va en camino', { name }),
              subtitle: etaText(eta, remainingKm),
            };
      case 'in_progress':
        return {
          icon: 'construct',
          title: t('Servicio en curso'),
          subtitle: isWorker
            ? t('Finaliza cuando el trabajo esté hecho.')
            : t('{name} está trabajando en tu tarea.', { name }),
        };
      default:
        return {
          icon: 'checkmark-circle',
          title: t('Servicio finalizado'),
          subtitle:
            startedAt && finishedAt
              ? t('Duración: {value}', { value: formatElapsed(finishedAt - startedAt) })
              : t('Gracias por usar YourTime.'),
        };
    }
  })();

  const price =
    task.agreed_price_minor != null
      ? formatMoney(task.agreed_price_minor, task.budget.currency)
      : null;
  const where = task.is_remote
    ? t('Servicio remoto')
    : [task.location?.address, task.location?.city].filter(Boolean).join(', ') ||
      t('Ubicación indicada');

  return (
    <View role="main" style={[styles.flex, { backgroundColor: colors.bg }]}>
      {back}

      {destination && onSite ? (
        <RouteMap
          height={heroHeight}
          destination={destination}
          worker={worker}
          route={travelling ? (route.data?.path ?? null) : null}
        />
      ) : (
        <LinearGradient
          colors={[colors.primarySoft, colors.surfaceMuted]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.remote, { height: heroHeight }]}
        >
          <Icon name="globe-outline" size={56} color="primary" />
          <Text variant="heading" level={0}>
            {t('Servicio remoto')}
          </Text>
          <Text tone="muted">{t('No hay ruta que recorrer.')}</Text>
        </LinearGradient>
      )}

      <View
        style={[
          styles.sheet,
          shadow(2),
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <ScrollView
          contentContainerStyle={styles.sheetContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.headerRow}>
            <View style={[styles.statusIcon, { backgroundColor: colors.primarySoft }]}>
              <Icon name={header.icon} size={24} color="primary" />
            </View>
            <View style={styles.flex}>
              <Text variant="title" level={1}>
                {header.title}
              </Text>
              <Text tone="muted">{header.subtitle}</Text>
            </View>
          </View>

          {working && startedAt ? (
            <Text
              level={0}
              style={styles.timer}
              accessibilityLabel={t('Tiempo de servicio {value}', {
                value: formatElapsed(now - startedAt),
              })}
            >
              {formatElapsed(now - startedAt)}
            </Text>
          ) : null}

          {stale && task.worker_location ? (
            <Text variant="caption" tone="warning">
              {t('Última ubicación de {name}: {when}.', {
                name,
                when: timeAgo(task.worker_location.updated_at),
              })}
            </Text>
          ) : null}
          {isWorker && live && onSite && sharing.denied ? (
            <Card style={{ backgroundColor: colors.warningSoft, borderColor: colors.warningSoft }}>
              <Text variant="bodyStrong" tone="warning">
                {t('No estás compartiendo tu ubicación')}
              </Text>
              <Text variant="caption" tone="warning">
                {t('Activa el permiso de ubicación para que {name} te vea en el mapa.', { name })}
              </Text>
            </Card>
          ) : null}
          {isWorker && live && onSite && !sharing.denied ? (
            <Text variant="caption" tone="subtle">
              {t('Compartiendo tu ubicación con {name} mientras esta pantalla esté abierta.', {
                name,
              })}
            </Text>
          ) : null}

          <TaskProgress status={task.status} remote={task.is_remote} fromAssigned />

          {counterpart ? (
            <View style={[styles.person, { borderColor: colors.border }]}>
              <Avatar name={counterpart.full_name} uri={counterpart.avatar_url} size={48} />
              <View style={styles.flex}>
                <Text variant="heading" level={0}>
                  {counterpart.full_name}
                </Text>
                <Text variant="caption" tone="subtle">
                  {isWorker ? t('Quien publicó la tarea') : t('Quien hace el servicio')}
                </Text>
                <RatingBadge rating={counterpart.rating} />
              </View>
              {counterpart.phone ? (
                <RoundButton
                  icon="call"
                  label={t('Llamar a {full_name}', { full_name: counterpart.full_name })}
                  onPress={() => void Linking.openURL(`tel:${counterpart.phone}`)}
                />
              ) : null}
              {counterpart.email ? (
                <RoundButton
                  icon="mail"
                  label={t('Escribir a {full_name}', { full_name: counterpart.full_name })}
                  onPress={() => void Linking.openURL(`mailto:${counterpart.email}`)}
                />
              ) : null}
            </View>
          ) : null}

          <View style={styles.details}>
            <Detail icon="clipboard-outline" label={t('Servicio')}>
              <PressableScale
                accessibilityRole="link"
                accessibilityLabel={t('Ver la tarea {title}', { title: task.title })}
                onPress={() => router.push({ pathname: '/task/[id]', params: { id: task.id } })}
                style={styles.linkRow}
              >
                <Text variant="bodyStrong" numberOfLines={2} style={styles.flex}>
                  {task.title}
                </Text>
                <Icon name="chevron-forward" size={16} color="textSubtle" />
              </PressableScale>
            </Detail>
            <Detail icon={task.is_remote ? 'globe-outline' : 'location-outline'} label={t('Dónde')}>
              <Text variant="bodyStrong">{where}</Text>
            </Detail>
            {price ? (
              <Detail icon="cash-outline" label={t('Precio acordado')}>
                <Text variant="bodyStrong" tone="primary" style={styles.tabular}>
                  {price}
                </Text>
                <ConvertedAmount
                  minor={task.agreed_price_minor as number}
                  currency={task.budget.currency}
                />
              </Detail>
            ) : null}
          </View>

          <View style={styles.actions}>
            {has('start_route') ? (
              <Button
                label={t('Iniciar ruta')}
                icon="navigate"
                onPress={() => void onStartRoute()}
                loading={startRoute.isPending || locating}
                block
              />
            ) : null}
            {has('start_service') ? (
              <Button
                label={t('Iniciar servicio')}
                icon="play"
                onPress={() => void onStartService()}
                loading={startService.isPending}
                block
              />
            ) : null}
            {has('complete') ? (
              <Button
                label={isWorker ? t('Finalizar servicio') : t('Confirmar finalización')}
                icon="checkmark-done"
                onPress={() => void onComplete()}
                loading={complete.isPending}
                block
              />
            ) : null}
            {task.status === 'completed' && task.can_review ? (
              <Button
                label={t('Calificar a {name}', { name })}
                icon="star"
                onPress={() => setReviewing(true)}
                block
              />
            ) : null}
            {task.status === 'completed' ? (
              <Button
                label={t('Ver la tarea')}
                variant="secondary"
                onPress={() => router.replace({ pathname: '/task/[id]', params: { id: task.id } })}
                block
              />
            ) : null}
            {has('release') ? (
              <Button
                label={t('Renunciar a este servicio')}
                variant="danger"
                onPress={() => void onRelease()}
                loading={release.isPending}
                block
              />
            ) : null}
            {has('cancel') ? (
              <Button
                label={t('Cancelar servicio')}
                variant="danger"
                onPress={() => void onCancel()}
                loading={cancel.isPending}
                block
              />
            ) : null}
          </View>
        </ScrollView>
      </View>

      {counterpart ? (
        <ReviewSheet
          taskId={task.id}
          counterpartName={name}
          visible={reviewing && task.can_review}
          onClose={() => setReviewing(false)}
        />
      ) : null}
    </View>
  );
}

function etaText(eta: number | null, km: number | null): string {
  if (eta == null || km == null) return t('Calculando la ruta…');
  if (eta === 0) return t('Llegando al destino');
  return t('Llega en ~{eta} min · {distance}', { eta, distance: formatDistance(km) });
}

function RoundButton({
  icon,
  label,
  onPress,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={[styles.round, { backgroundColor: colors.primarySoft }]}
    >
      <Icon name={icon} size={20} color="primary" />
    </PressableScale>
  );
}

function Detail({
  icon,
  label,
  children,
}: {
  icon: IconName;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.detail}>
      <Icon name={icon} size={18} color="textSubtle" />
      <View style={styles.flex}>
        <Text variant="caption" tone="subtle">
          {label}
        </Text>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  pad: { padding: space.xl, gap: space.md },
  back: {
    position: 'absolute',
    left: space.lg,
    zIndex: 10,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  remote: { alignItems: 'center', justifyContent: 'center', gap: space.sm },
  sheet: {
    flex: 1,
    marginTop: -28,
    borderTopLeftRadius: radius.xl + 6,
    borderTopRightRadius: radius.xl + 6,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  sheetContent: { padding: space.xl, gap: space.lg, paddingBottom: space.xxxl },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  statusIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timer: {
    fontSize: 44,
    lineHeight: 50,
    fontWeight: '800',
    letterSpacing: -1,
    fontVariant: ['tabular-nums'],
  },
  person: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  round: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  details: { gap: space.md },
  detail: { flexDirection: 'row', gap: space.md, alignItems: 'flex-start' },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: space.xs, minHeight: 28 },
  tabular: { fontVariant: ['tabular-nums'] },
  actions: { gap: space.sm, marginTop: space.sm },
});
