import { useMemo, useState } from 'react';
import { StyleSheet, Switch, View } from 'react-native';
import type { BudgetType, Task, TaskInput } from '@yourtime/shared-types';
import { formatDateTime, fromMinor, msg, parseAmount, t, toMinor } from '@yourtime/shared-utils';
import { categoryName } from '@/i18n/categories';
import { useCategories, useUpdateMe, useWallet } from '@/api/hooks';
import { ApiError } from '@/api/client';
import { useFeedback } from '@/components/feedback/FeedbackProvider';
import { Button, Card, Chip, Icon, Input, Segmented, Text, safeIcon } from '@/components/ui';
import { budgetTypeLabel } from '@/lib/messages';
import { useDeviceLocation } from '@/lib/useDeviceLocation';
import { useAuth } from '@/store/auth';
import { useTheme } from '@/theme/ThemeProvider';
import { space } from '@/theme/tokens';

type SchedulePreset = 'none' | 'keep' | 'today' | 'tomorrow' | 'in3' | 'week';

const SCHEDULE_OPTIONS: { value: Exclude<SchedulePreset, 'keep'>; label: string; days: number }[] =
  [
    { value: 'none', label: msg('Sin fecha'), days: -1 },
    { value: 'today', label: msg('Hoy'), days: 0 },
    { value: 'tomorrow', label: msg('Mañana'), days: 1 },
    { value: 'in3', label: msg('En 3 días'), days: 3 },
    { value: 'week', label: msg('En una semana'), days: 7 },
  ];

/** 9:00 local time, `days` from today. */
function scheduleFor(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(9, 0, 0, 0);
  // Today at 09:00 may already have passed; the API rejects past dates.
  if (d.getTime() < Date.now()) d.setTime(Date.now() + 60 * 60 * 1000);
  return d.toISOString();
}

interface TaskFormProps {
  /** Present when editing an existing task. */
  task?: Task;
  submitLabel: string;
  loading: boolean;
  onSubmit: (input: TaskInput) => void;
  /** Error from the last submit, to show field-level messages. */
  error?: unknown;
}

export function TaskForm({ task, submitLabel, loading, onSubmit, error }: TaskFormProps) {
  const { colors } = useTheme();
  const { toast } = useFeedback();
  const user = useAuth((s) => s.user);
  const categories = useCategories();
  const updateMe = useUpdateMe();
  const { locate, locating } = useDeviceLocation();

  // A task keeps the currency it was published in; new ones use the account's.
  const currency = task?.budget.currency ?? user?.currency ?? 'USD';
  const currencyLocked = useWallet().data?.established === true;

  const [categoryId, setCategoryId] = useState(task?.category.id ?? '');
  const [title, setTitle] = useState(task?.title ?? '');
  const [description, setDescription] = useState(task?.description ?? '');
  const [budgetType, setBudgetType] = useState<BudgetType>(task?.budget.type ?? 'fixed');
  const [minText, setMinText] = useState(
    task?.budget.min_minor != null ? String(fromMinor(task.budget.min_minor, currency)) : ''
  );
  const [maxText, setMaxText] = useState(
    task?.budget.max_minor != null ? String(fromMinor(task.budget.max_minor, currency)) : ''
  );
  const [isRemote, setIsRemote] = useState(task?.is_remote ?? false);
  const [place, setPlace] = useState(
    task?.location ?? (user?.location ? { ...user.location } : null)
  );
  const [address, setAddress] = useState(task?.location?.address ?? '');
  const [schedule, setSchedule] = useState<SchedulePreset>(task?.scheduled_at ? 'keep' : 'none');
  const [localErrors, setLocalErrors] = useState<Record<string, string>>({});

  const serverErrors = useMemo(() => (error instanceof ApiError ? error.fieldErrors : {}), [error]);
  const errors = { ...serverErrors, ...localErrors };
  const generalError =
    error instanceof ApiError && Object.keys(serverErrors).length === 0 ? error.message : undefined;

  const applyMyLocation = async () => {
    const found = await locate();
    if (!found) return;
    setPlace({ latitude: found.latitude, longitude: found.longitude, city: found.city });
    // First time setting a location? Remember it as the account location too.
    if (!user?.location) updateMe.mutate({ location: found });
    toast(t('Ubicación actualizada.'));
  };

  const submit = () => {
    const next: Record<string, string> = {};
    if (!categoryId) next.category_id = t('Elige una categoría.');
    if (title.trim().length < 4)
      next.title = t('Describe la tarea en pocas palabras (mínimo 4 letras).');
    if (description.trim().length < 10)
      next.description = t('Cuéntanos más detalles (mínimo 10 letras).');

    let budget: TaskInput['budget'] = { type: budgetType };
    if (budgetType !== 'negotiable') {
      const min = parseAmount(minText);
      const max = maxText.trim() ? parseAmount(maxText) : min;
      if (min == null) next['budget.min_minor'] = t('Escribe un monto válido.');
      else if (max == null || max < min)
        next['budget.max_minor'] = t('El máximo debe ser igual o mayor al mínimo.');
      else
        budget = {
          type: budgetType,
          min_minor: toMinor(min, currency),
          max_minor: toMinor(max, currency),
        };
    }
    if (!isRemote && !place) next.location = t('Indica dónde será la tarea o márcala como remota.');

    setLocalErrors(next);
    if (Object.keys(next).length > 0) return;

    const preset = SCHEDULE_OPTIONS.find((o) => o.value === schedule);
    const scheduled_at =
      schedule === 'keep'
        ? (task?.scheduled_at ?? undefined)
        : preset && preset.days >= 0
          ? scheduleFor(preset.days)
          : undefined;

    onSubmit({
      category_id: categoryId,
      title: title.trim(),
      description: description.trim(),
      budget: { ...budget, ...(task ? { currency } : {}) },
      is_remote: isRemote,
      location: !isRemote && place ? { ...place, address: address.trim() || undefined } : undefined,
      scheduled_at,
    });
  };

  return (
    <View style={styles.form}>
      <View style={styles.block}>
        <Text variant="bodyStrong">{t('Categoría')}</Text>
        <View style={styles.wrap}>
          {categories.data?.map((c) => (
            <Chip
              key={c.id}
              label={categoryName(c.name)}
              icon={safeIcon(c.icon)}
              accent={c.color}
              selected={categoryId === c.id}
              onPress={() => setCategoryId(c.id)}
            />
          ))}
        </View>
        {errors.category_id ? (
          <Text variant="caption" tone="danger">
            {errors.category_id}
          </Text>
        ) : null}
      </View>

      <Input
        label={t('Título')}
        value={title}
        onChangeText={setTitle}
        placeholder={t('Ej: Arreglar una gotera en el baño')}
        maxLength={200}
        error={errors.title}
      />
      <Input
        label={t('Descripción')}
        value={description}
        onChangeText={setDescription}
        placeholder={t('Qué necesitas, medidas, herramientas, horarios…')}
        multiline
        maxLength={5000}
        error={errors.description}
      />

      <View style={styles.block}>
        <Text variant="bodyStrong">{t('Presupuesto')}</Text>
        <Segmented
          value={budgetType}
          onChange={setBudgetType}
          options={(['fixed', 'hourly', 'negotiable'] as const).map((value) => ({
            value,
            label: t(budgetTypeLabel[value]),
          }))}
        />
        {budgetType !== 'negotiable' ? (
          <View style={styles.row}>
            <View style={styles.flex}>
              <Input
                label={budgetType === 'hourly' ? t('Desde (por hora)') : t('Desde')}
                prefix={currency}
                value={minText}
                onChangeText={setMinText}
                keyboardType="decimal-pad"
                placeholder="0"
                error={errors['budget.min_minor']}
              />
            </View>
            <View style={styles.flex}>
              <Input
                label={t('Hasta (opcional)')}
                prefix={currency}
                value={maxText}
                onChangeText={setMaxText}
                keyboardType="decimal-pad"
                placeholder="0"
                error={errors['budget.max_minor']}
              />
            </View>
          </View>
        ) : (
          <Text variant="caption" tone="muted">
            {t('Quienes se postulen propondrán su precio y tú eliges.')}
          </Text>
        )}
        <Text variant="caption" tone="subtle">
          {task
            ? t('Moneda: {currency} (la tarea conserva la moneda con la que se publicó).', {
                currency,
              })
            : currencyLocked
              ? t('Moneda: {currency} (la de tu cuenta, ya no se puede cambiar).', { currency })
              : t('Moneda: {currency} (la de tu cuenta, puedes cambiarla en tu perfil).', {
                  currency,
                })}
        </Text>
      </View>

      <View style={styles.block}>
        <View style={styles.switchRow}>
          <View style={styles.flex}>
            <Text variant="bodyStrong">{t('Tarea remota')}</Text>
            <Text variant="caption" tone="muted">
              {t('Se puede hacer a distancia, sin ir a un lugar.')}
            </Text>
          </View>
          <Switch
            value={isRemote}
            onValueChange={setIsRemote}
            trackColor={{ true: colors.primary, false: colors.border }}
            accessibilityLabel={t('Tarea remota')}
          />
        </View>

        {!isRemote ? (
          <Card>
            <View style={styles.placeRow}>
              <Icon name="location" size={22} color={place ? 'primary' : 'textSubtle'} />
              <View style={styles.flex}>
                <Text variant="bodyStrong">
                  {place ? place.city || t('Ubicación guardada') : t('Sin ubicación')}
                </Text>
                <Text variant="caption" tone="subtle">
                  {t(
                    'Quienes se postulen verán solo una zona aproximada. La dirección exacta la ve la persona que elijas.'
                  )}
                </Text>
              </View>
            </View>
            <View style={styles.placeActions}>
              <Button
                label={place ? t('Actualizar con mi ubicación') : t('Usar mi ubicación')}
                icon="locate"
                size="sm"
                variant="secondary"
                onPress={() => void applyMyLocation()}
                loading={locating}
              />
            </View>
            <View style={styles.addressInput}>
              <Input
                label={t('Dirección o referencia (opcional)')}
                value={address}
                onChangeText={setAddress}
                placeholder={t('Calle, barrio, punto de referencia')}
                maxLength={300}
              />
            </View>
            {errors.location ? (
              <Text variant="caption" tone="danger" style={styles.addressInput}>
                {errors.location}
              </Text>
            ) : null}
          </Card>
        ) : null}
      </View>

      <View style={styles.block}>
        <Text variant="bodyStrong">{t('¿Para cuándo?')}</Text>
        <View style={styles.wrap}>
          {task?.scheduled_at ? (
            <Chip
              label={t('Mantener · {value}', { value: formatDateTime(task.scheduled_at) })}
              selected={schedule === 'keep'}
              onPress={() => setSchedule('keep')}
            />
          ) : null}
          {SCHEDULE_OPTIONS.map((o) => (
            <Chip
              key={o.value}
              label={t(o.label)}
              selected={schedule === o.value}
              onPress={() => setSchedule(o.value)}
            />
          ))}
        </View>
        {errors.scheduled_at ? (
          <Text variant="caption" tone="danger">
            {errors.scheduled_at}
          </Text>
        ) : null}
      </View>

      {generalError ? (
        <Text variant="caption" tone="danger" accessibilityLiveRegion="polite">
          {generalError}
        </Text>
      ) : null}
      <Button label={submitLabel} onPress={submit} loading={loading} block />
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: space.xl },
  block: { gap: space.md },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  row: { flexDirection: 'row', gap: space.md },
  flex: { flex: 1 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  placeRow: { flexDirection: 'row', gap: space.md },
  placeActions: { flexDirection: 'row', marginTop: space.md },
  addressInput: { marginTop: space.md },
});
