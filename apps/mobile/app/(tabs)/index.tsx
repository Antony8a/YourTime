import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Task, TaskListParams, TaskSort } from '@yourtime/shared-types';
import { flatten, useCategories, useFeed, useUpdateMe } from '@/api/hooks';
import { useFeedback } from '@/components/feedback/FeedbackProvider';
import { TaskCard } from '@/components/task/TaskCard';
import {
  Avatar,
  Button,
  Card,
  Chip,
  EmptyState,
  Icon,
  Input,
  Sheet,
  TaskCardSkeleton,
  Text,
} from '@/components/ui';
import { useDeviceLocation } from '@/lib/useDeviceLocation';
import { useAuth } from '@/store/auth';
import { useTheme } from '@/theme/ThemeProvider';
import { space } from '@/theme/tokens';

const DISTANCE_OPTIONS = [5, 10, 25, 50, 100];

function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return debounced;
}

export default function ExploreScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { toast } = useFeedback();
  const user = useAuth((s) => s.user);
  const updateMe = useUpdateMe();
  const { locate, locating } = useDeviceLocation();
  const categories = useCategories();

  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState<string>();
  // Distance only informs by default. These narrow the list when the person asks.
  const [withinMyRadius, setWithinMyRadius] = useState(false);
  const [maxDistanceKm, setMaxDistanceKm] = useState<number | null>(null);
  const [sort, setSort] = useState<TaskSort>('recent');
  const [filtersOpen, setFiltersOpen] = useState(false);

  const q = useDebounced(search.trim(), 350);
  const hasLocation = !!user?.location;
  const radius = user?.search_radius_km ?? null;

  const params = useMemo<TaskListParams>(
    () => ({
      q: q || undefined,
      category_id: categoryId,
      max_distance_km: maxDistanceKm ?? undefined,
      preferred_radius: withinMyRadius && maxDistanceKm == null ? true : undefined,
      sort: hasLocation ? sort : 'recent',
    }),
    [q, categoryId, maxDistanceKm, withinMyRadius, sort, hasLocation]
  );

  const feed = useFeed(params);
  const tasks = flatten(feed.data?.pages);
  const activeFilters = (maxDistanceKm != null ? 1 : 0) + (sort === 'distance' ? 1 : 0);

  const saveCurrentLocation = useCallback(async () => {
    const place = await locate();
    if (!place) return;
    updateMe.mutate(
      { location: { latitude: place.latitude, longitude: place.longitude, city: place.city } },
      {
        onSuccess: () => toast('Ubicación guardada. Ya puedes ver las distancias.'),
        onError: () => toast('No pudimos guardar tu ubicación.', 'error'),
      }
    );
  }, [locate, updateMe, toast]);

  const header = (
    <View style={styles.header}>
      <View style={styles.topRow}>
        <View style={styles.greeting}>
          <Text variant="title" level={1}>
            Hola, {user?.full_name.split(' ')[0]}
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/profile')}
            style={styles.locationRow}
          >
            <Icon name="location-outline" size={14} color="textSubtle" />
            <Text variant="caption" tone="muted">
              {user?.location?.city || (hasLocation ? 'Ubicación guardada' : 'Sin ubicación')}
              {radius ? ` · radio de ${radius} km` : ''}
            </Text>
          </Pressable>
        </View>
        <Avatar name={user?.full_name ?? '?'} uri={user?.avatar_url} size={42} />
      </View>

      <Input
        icon="search"
        placeholder="Busca tareas: plomería, clases, mudanza…"
        value={search}
        onChangeText={setSearch}
        returnKeyType="search"
        autoCapitalize="none"
        autoCorrect={false}
        right={
          search ? (
            <Pressable
              accessibilityLabel="Borrar búsqueda"
              onPress={() => setSearch('')}
              hitSlop={10}
            >
              <Icon name="close-circle" size={18} color="textSubtle" />
            </Pressable>
          ) : undefined
        }
      />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chips}
      >
        <Chip label="Todas" selected={!categoryId} onPress={() => setCategoryId(undefined)} />
        {categories.data?.map((c) => (
          <Chip
            key={c.id}
            label={c.name}
            selected={categoryId === c.id}
            accent={c.color}
            onPress={() => setCategoryId(categoryId === c.id ? undefined : c.id)}
          />
        ))}
      </ScrollView>

      <View style={styles.filterRow}>
        {hasLocation && radius ? (
          <Chip
            icon="navigate-outline"
            label={`Cerca de mí · ${radius} km`}
            selected={withinMyRadius && maxDistanceKm == null}
            onPress={() => {
              setMaxDistanceKm(null);
              setWithinMyRadius((v) => !v);
            }}
          />
        ) : null}
        <Chip
          icon="options-outline"
          label={activeFilters > 0 ? `Filtros · ${activeFilters}` : 'Filtros'}
          selected={activeFilters > 0}
          onPress={() => setFiltersOpen(true)}
        />
      </View>

      {!hasLocation ? (
        <Card style={{ backgroundColor: colors.primarySoft, borderColor: colors.primarySoft }}>
          <View style={styles.banner}>
            <Icon name="location" size={22} color="primary" />
            <View style={styles.bannerText}>
              <Text variant="bodyStrong">Mira qué tan lejos queda cada tarea</Text>
              <Text variant="caption" tone="muted">
                Guarda tu ubicación. Es solo una guía: tú decides a cuáles postularte.
              </Text>
            </View>
          </View>
          <Button
            label="Usar mi ubicación"
            icon="locate"
            size="sm"
            onPress={() => void saveCurrentLocation()}
            loading={locating || updateMe.isPending}
            style={styles.bannerButton}
          />
        </Card>
      ) : null}
    </View>
  );

  const renderItem = useCallback(
    ({ item }: { item: Task }) => (
      <TaskCard
        task={item}
        onPress={() => router.push({ pathname: '/task/[id]', params: { id: item.id } })}
      />
    ),
    [router]
  );

  return (
    <View role="main" style={[styles.flex, { backgroundColor: colors.bg, paddingTop: insets.top }]}>
      <FlatList
        data={tasks}
        keyExtractor={(t) => t.id}
        renderItem={renderItem}
        ListHeaderComponent={header}
        ItemSeparatorComponent={Separator}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        refreshing={feed.isRefetching && !feed.isFetchingNextPage}
        onRefresh={() => void feed.refetch()}
        onEndReachedThreshold={0.4}
        onEndReached={() =>
          feed.hasNextPage && !feed.isFetchingNextPage && void feed.fetchNextPage()
        }
        ListEmptyComponent={
          feed.isLoading ? (
            <View style={styles.skeletons}>
              <TaskCardSkeleton />
              <TaskCardSkeleton />
              <TaskCardSkeleton />
            </View>
          ) : feed.isError ? (
            <EmptyState
              icon="cloud-offline-outline"
              title="No pudimos cargar las tareas"
              message="Revisa tu conexión e inténtalo otra vez."
              actionLabel="Reintentar"
              onAction={() => void feed.refetch()}
            />
          ) : (
            <EmptyState
              icon="search-outline"
              title="No hay tareas con estos filtros"
              message="Prueba con otra búsqueda, otra categoría o amplía la distancia."
              actionLabel={
                activeFilters > 0 || withinMyRadius || q || categoryId
                  ? 'Limpiar filtros'
                  : undefined
              }
              onAction={() => {
                setSearch('');
                setCategoryId(undefined);
                setMaxDistanceKm(null);
                setWithinMyRadius(false);
                setSort('recent');
              }}
            />
          )
        }
        ListFooterComponent={
          feed.isFetchingNextPage ? (
            <ActivityIndicator color={colors.primary} style={styles.footer} />
          ) : null
        }
      />

      <Sheet
        visible={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        title="Filtros"
        subtitle="Afinan la lista; nunca te impiden postularte."
      >
        {hasLocation ? (
          <>
            <View style={styles.sheetSection}>
              <Text variant="bodyStrong">Distancia máxima</Text>
              <View style={styles.wrap}>
                <Chip
                  label="Sin límite"
                  selected={maxDistanceKm == null}
                  onPress={() => setMaxDistanceKm(null)}
                />
                {DISTANCE_OPTIONS.map((km) => (
                  <Chip
                    key={km}
                    label={`${km} km`}
                    selected={maxDistanceKm === km}
                    onPress={() => {
                      setWithinMyRadius(false);
                      setMaxDistanceKm(km);
                    }}
                  />
                ))}
              </View>
              <Text variant="caption" tone="subtle">
                Las tareas remotas siempre se muestran.
              </Text>
            </View>
            <View style={styles.sheetSection}>
              <Text variant="bodyStrong">Ordenar por</Text>
              <View style={styles.wrap}>
                <Chip
                  label="Más recientes"
                  selected={sort === 'recent'}
                  onPress={() => setSort('recent')}
                />
                <Chip
                  label="Más cercanas"
                  selected={sort === 'distance'}
                  onPress={() => setSort('distance')}
                />
              </View>
            </View>
          </>
        ) : (
          <Text tone="muted">Guarda tu ubicación para filtrar y ordenar por distancia.</Text>
        )}
        <Button label="Listo" onPress={() => setFiltersOpen(false)} block />
      </Sheet>
    </View>
  );
}

function Separator() {
  return <View style={{ height: space.md }} />;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  list: { paddingHorizontal: space.xl, paddingBottom: space.xxxl },
  header: { gap: space.lg, paddingTop: space.lg, paddingBottom: space.lg },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.md,
  },
  greeting: { flex: 1, gap: 2 },
  // 44 pt to tap, with negative margin so the header layout does not grow.
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 44,
    marginVertical: -13,
  },
  chips: { gap: space.sm, paddingRight: space.xl },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  banner: { flexDirection: 'row', gap: space.md },
  bannerText: { flex: 1, gap: 2 },
  bannerButton: { alignSelf: 'flex-start', marginTop: space.md },
  skeletons: { gap: space.md },
  footer: { paddingVertical: space.xl },
  sheetSection: { gap: space.sm },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
