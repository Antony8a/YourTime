import { useState } from 'react';
import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { LOCALES, SUPPORTED_CURRENCIES, t, tn } from '@yourtime/shared-utils';
import { ApiError } from '@/api/client';
import { useUpdateMe } from '@/api/hooks';
import { useFeedback } from '@/components/feedback/FeedbackProvider';
import { CurrencyPicker } from '@/components/profile/CurrencyPicker';
import { LanguagePicker } from '@/components/profile/LanguagePicker';
import { followDeviceLanguage, rememberLanguage } from '@/i18n';
import { RatingBadge } from '@/components/reviews/Stars';
import {
  Avatar,
  Button,
  Card,
  Chip,
  Icon,
  Input,
  Screen,
  Sheet,
  Text,
  type IconName,
} from '@/components/ui';
import { useDeviceLocation } from '@/lib/useDeviceLocation';
import { useAuth } from '@/store/auth';
import { useTheme } from '@/theme/ThemeProvider';
import { space } from '@/theme/tokens';

const RADIUS_OPTIONS = [5, 10, 25, 50, 100];

export default function ProfileScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { toast, confirm } = useFeedback();
  const user = useAuth((s) => s.user);
  const signOut = useAuth((s) => s.signOut);
  const updateMe = useUpdateMe();
  const { locate, locating } = useDeviceLocation();

  const [sheet, setSheet] = useState<'currency' | 'language' | 'radius' | 'edit' | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [bio, setBio] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  if (!user) return null;
  const currencyKey = SUPPORTED_CURRENCIES.find((c) => c.code === user.currency)?.name;
  const currencyName = currencyKey ? t(currencyKey) : undefined;
  const languageName = user.language
    ? (LOCALES.find((l) => l.code === user.language)?.name ?? user.language)
    : t('Idioma del dispositivo');

  const save = (
    body: Parameters<typeof updateMe.mutate>[0],
    message: string,
    onDone?: () => void
  ) =>
    updateMe.mutate(body, {
      onSuccess: () => {
        toast(message);
        onDone?.();
      },
      onError: (e) => {
        if (e instanceof ApiError && Object.keys(e.fieldErrors).length > 0)
          setErrors(e.fieldErrors);
        else toast(e instanceof ApiError ? e.message : t('No pudimos guardar el cambio.'), 'error');
      },
    });

  const openEdit = () => {
    setName(user.full_name);
    setPhone(user.phone ?? '');
    setBio(user.bio ?? '');
    setErrors({});
    setSheet('edit');
  };

  const updateLocation = async () => {
    const place = await locate();
    if (place) save({ location: place }, t('Ubicación actualizada.'));
  };

  const logout = async () => {
    const ok = await confirm({
      title: t('Cerrar sesión'),
      message: t('Tendrás que ingresar de nuevo para ver tus tareas.'),
      confirmLabel: t('Cerrar sesión'),
      destructive: true,
    });
    if (ok) await signOut();
  };

  return (
    <Screen bottomInset={space.xl}>
      <View style={styles.identity}>
        <Avatar name={user.full_name} uri={user.avatar_url} size={72} />
        <View style={styles.identityText}>
          <Text variant="title" level={1}>
            {user.full_name}
          </Text>
          <Text tone="muted">{user.email}</Text>
          <RatingBadge rating={user.rating} />
        </View>
      </View>

      <Section title={t('Preferencias')}>
        <Row
          icon="cash-outline"
          title={t('Moneda')}
          value={`${user.currency}${currencyName ? ` · ${currencyName}` : ''}`}
          onPress={() => setSheet('currency')}
        />
        <Divider />
        <Row
          icon="language-outline"
          title={t('Idioma')}
          value={languageName}
          onPress={() => setSheet('language')}
        />
        <Divider />
        <Row
          icon="location-outline"
          title={t('Mi ubicación')}
          value={user.location ? user.location.city || t('Guardada') : t('Sin configurar')}
          action={
            locating || updateMe.isPending
              ? t('Buscando…')
              : user.location
                ? t('Actualizar')
                : t('Configurar')
          }
          onPress={() => void updateLocation()}
        />
        <Divider />
        <Row
          icon="navigate-outline"
          title={t('Radio preferido')}
          value={user.search_radius_km ? `${user.search_radius_km} km` : t('Sin límite')}
          onPress={() => setSheet('radius')}
        />
      </Section>
      <Text variant="caption" tone="subtle" style={styles.note}>
        {t(
          'Tu ubicación y radio solo sirven de guía: te muestran qué tan lejos queda cada tarea, pero nunca te impiden postularte. Tú decides.'
        )}
      </Text>

      <Section title={t('Cuenta')}>
        <Row
          icon="star-outline"
          title={t('Mis reseñas')}
          value={
            user.rating.count > 0
              ? tn(user.rating.count, '{count} calificación', '{count} calificaciones')
              : t('Aún sin calificaciones')
          }
          onPress={() => router.push({ pathname: '/user/[id]', params: { id: user.id } })}
        />
        <Divider />
        <Row
          icon="wallet-outline"
          title={t('Mi balance')}
          value={t('Lo que ganaste y lo que gastaste')}
          onPress={() => router.push('/balance')}
        />
        <Divider />
        <Row
          icon="create-outline"
          title={t('Editar perfil')}
          value={user.phone ?? t('Nombre, teléfono y presentación')}
          onPress={openEdit}
        />
      </Section>

      <View style={styles.logout}>
        <Button
          label={t('Cerrar sesión')}
          icon="log-out-outline"
          variant="secondary"
          onPress={() => void logout()}
          block
        />
      </View>

      <LanguagePicker
        visible={sheet === 'language'}
        onClose={() => setSheet(null)}
        followsDevice={!user.language}
        onSelect={(locale) => {
          // The screens start over in the new language, so this one will not be around to
          // show a confirmation; the change itself is the feedback.
          if (locale) void rememberLanguage(locale);
          else void followDeviceLanguage();
          updateMe.mutate({ language: locale ?? '' });
        }}
      />

      <CurrencyPicker
        visible={sheet === 'currency'}
        selected={user.currency}
        onClose={() => setSheet(null)}
        onSelect={(code) =>
          code !== user.currency &&
          save({ currency: code }, t('Moneda cambiada a {code}.', { code }))
        }
      />

      <Sheet
        visible={sheet === 'radius'}
        onClose={() => setSheet(null)}
        title={t('Radio preferido')}
        subtitle={t(
          'Distancia que consideras razonable. Resalta las tareas que quedan fuera, sin bloquearlas.'
        )}
      >
        <View style={styles.wrap}>
          <Chip
            label={t('Sin límite')}
            selected={!user.search_radius_km}
            onPress={() =>
              save({ search_radius_km: null }, t('Radio quitado.'), () => setSheet(null))
            }
          />
          {RADIUS_OPTIONS.map((km) => (
            <Chip
              key={km}
              label={t('{km} km', { km })}
              selected={user.search_radius_km === km}
              onPress={() =>
                save({ search_radius_km: km }, t('Radio de {km} km guardado.', { km }), () =>
                  setSheet(null)
                )
              }
            />
          ))}
        </View>
        {!user.location ? (
          <Text variant="caption" tone="warning">
            {t('Guarda tu ubicación para que el radio tenga efecto.')}
          </Text>
        ) : null}
      </Sheet>

      <Sheet visible={sheet === 'edit'} onClose={() => setSheet(null)} title={t('Editar perfil')}>
        <Input
          label={t('Nombre completo')}
          value={name}
          onChangeText={setName}
          autoCapitalize="words"
          error={errors.full_name}
        />
        <Input
          label={t('Teléfono (opcional)')}
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          placeholder="+573001234567"
          hint={t('Solo lo verá la persona con la que acuerdes una tarea.')}
          error={errors.phone}
        />
        <Input
          label={t('Presentación (opcional)')}
          value={bio}
          onChangeText={setBio}
          multiline
          maxLength={1000}
          placeholder={t('Cuéntales en qué eres bueno.')}
          error={errors.bio}
        />
        <Button
          label={t('Guardar')}
          loading={updateMe.isPending}
          block
          onPress={() => {
            setErrors({});
            save(
              {
                full_name: name.trim(),
                bio: bio.trim(),
                ...(phone.trim() && phone.trim() !== (user.phone ?? '')
                  ? { phone: phone.trim() }
                  : {}),
              },
              t('Perfil actualizado.'),
              () => setSheet(null)
            );
          }}
        />
      </Sheet>

      <View style={styles.footerMark}>
        <Icon name="time" size={14} color={colors.textSubtle} />
        <Text variant="caption" tone="subtle">
          {t('YourTime')}
        </Text>
      </View>
    </Screen>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text variant="label" tone="subtle" style={styles.sectionTitle}>
        {title}
      </Text>
      <Card padded={false}>{children}</Card>
    </View>
  );
}

function Divider() {
  const { colors } = useTheme();
  return <View style={[styles.divider, { backgroundColor: colors.border }]} />;
}

function Row({
  icon,
  title,
  value,
  action,
  onPress,
}: {
  icon: IconName;
  title: string;
  value: string;
  action?: string;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Card
      onPress={onPress}
      padded={false}
      accessibilityLabel={`${title}: ${value}`}
      style={styles.rowCard}
    >
      <View style={styles.row}>
        <View style={[styles.rowIcon, { backgroundColor: colors.primarySoft }]}>
          <Icon name={icon} size={18} color="primary" />
        </View>
        <View style={styles.flex}>
          <Text variant="bodyStrong">{title}</Text>
          <Text variant="caption" tone="muted" numberOfLines={1}>
            {value}
          </Text>
        </View>
        {action ? (
          <Text variant="caption" tone="primary" style={styles.action}>
            {action}
          </Text>
        ) : (
          <Icon name="chevron-forward" size={18} color="textSubtle" />
        )}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  identity: { flexDirection: 'row', alignItems: 'center', gap: space.lg, marginBottom: space.xxl },
  identityText: { flex: 1, gap: 2 },
  section: { gap: space.sm, marginTop: space.lg },
  sectionTitle: { marginLeft: space.xs },
  note: { marginTop: space.md, marginHorizontal: space.xs },
  divider: { height: StyleSheet.hairlineWidth, marginLeft: 64 },
  rowCard: { borderWidth: 0, shadowOpacity: 0, elevation: 0, backgroundColor: 'transparent' },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  action: { fontWeight: '700' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  logout: { marginTop: space.xxl },
  footerMark: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: space.xxl,
  },
});
