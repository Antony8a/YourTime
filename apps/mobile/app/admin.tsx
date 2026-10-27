import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type {
  NewPromotion,
  PlatformSettings,
  Promotion,
  PromotionKind,
} from '@yourtime/shared-types';
import {
  formatMoney,
  formatPercent,
  fromMinor,
  msg,
  parseAmount,
  t,
  toMinor,
} from '@yourtime/shared-utils';
import { ApiError } from '@/api/client';
import {
  useAdminOverview,
  useAdminPromotions,
  useCreatePromotion,
  useManualCredit,
  useSetPromotionActive,
  useUpdateSettings,
  useWallet,
} from '@/api/hooks';
import { useFeedback } from '@/components/feedback/FeedbackProvider';
import { ScreenHeader } from '@/components/ScreenHeader';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  Screen,
  Segmented,
  Sheet,
  Skeleton,
  Text,
} from '@/components/ui';
import { space } from '@/theme/tokens';

const KIND_LABEL: Record<PromotionKind, string> = {
  topup_bonus: msg('Bono por recarga'),
  fee_discount: msg('Descuento de comisión'),
  credit_grant: msg('Crédito con código'),
};

/** Percentage text such as "10" or "2,5" to basis points, or null if it is not one. */
const toBps = (text: string): number | null => {
  const pct = text.trim() === '0' ? 0 : parseAmount(text);
  return pct == null || pct > 100 ? null : Math.round(pct * 100);
};

/** Basis points back to the text a person types: 1000 gives "10". */
const bpsText = (bps: number) => String(bps / 100);

/** Where the owner of the app sets the commission, creates promotions and credits wallets. */
export default function AdminScreen() {
  const wallet = useWallet();
  const isAdmin = wallet.data?.is_admin === true;
  const overview = useAdminOverview(isAdmin);
  const promotions = useAdminPromotions(isAdmin);
  const [creating, setCreating] = useState(false);

  if (wallet.isPending) {
    return (
      <View style={styles.flex}>
        <ScreenHeader title={t('Administración')} />
        <Screen noTopInset>
          <Skeleton height={140} />
        </Screen>
      </View>
    );
  }
  if (!isAdmin) {
    return (
      <View style={styles.flex}>
        <ScreenHeader title={t('Administración')} />
        <Screen noTopInset>
          <EmptyState icon="lock-closed-outline" title={t('No tienes acceso a esta sección')} />
        </Screen>
      </View>
    );
  }

  const data = overview.data;
  return (
    <View style={styles.flex}>
      <ScreenHeader title={t('Administración')} />
      <Screen
        noTopInset
        onRefresh={() => {
          void overview.refetch();
          void promotions.refetch();
        }}
        refreshing={overview.isRefetching}
      >
        {overview.isPending || !data ? (
          <Skeleton height={200} />
        ) : (
          <View style={styles.stack}>
            <View style={styles.section}>
              <Text variant="heading">{t('Lo que ha entrado')}</Text>
              {data.totals.length === 0 ? (
                <Text tone="muted">{t('Aún no hay billeteras.')}</Text>
              ) : (
                data.totals.map((row) => (
                  <Card key={row.currency}>
                    <Text variant="caption" tone="muted">
                      {row.currency}
                    </Text>
                    <Text variant="title" level={0}>
                      {t('Comisiones: {amount}', {
                        amount: formatMoney(row.net_fees_minor, row.currency),
                      })}
                    </Text>
                    <Text variant="caption" tone="subtle">
                      {t('Saldo en billeteras: {amount} ({count})', {
                        amount: formatMoney(row.outstanding_minor, row.currency),
                        count: row.wallets,
                      })}
                    </Text>
                  </Card>
                ))
              )}
            </View>

            <SettingsForm settings={data.settings} />

            <View style={styles.section}>
              <View style={styles.sectionHead}>
                <Text variant="heading">{t('Promociones')}</Text>
                <Button label={t('Nueva')} icon="add" size="sm" onPress={() => setCreating(true)} />
              </View>
              {(promotions.data ?? []).length === 0 ? (
                <Text tone="muted">{t('Aún no hay promociones.')}</Text>
              ) : (
                promotions.data!.map((p) => <PromotionRow key={p.id} promotion={p} />)
              )}
            </View>

            <CreditForm />
          </View>
        )}
      </Screen>
      <NewPromotionSheet visible={creating} onClose={() => setCreating(false)} />
    </View>
  );
}

function SettingsForm({ settings }: { settings: PlatformSettings }) {
  const { toast } = useFeedback();
  const save = useUpdateSettings();
  const [fee, setFee] = useState(bpsText(settings.fee_bps));
  const [enabled, setEnabled] = useState(settings.test_topups_enabled);
  const [max, setMax] = useState(String(fromMinor(settings.test_topup_max_usd_minor, 'USD')));
  const [signup, setSignup] = useState(String(fromMinor(settings.signup_credit_usd_minor, 'USD')));
  const [error, setError] = useState<string>();

  // Start over from the server's numbers whenever they change (after saving, or a refresh).
  useEffect(() => {
    setFee(bpsText(settings.fee_bps));
    setEnabled(settings.test_topups_enabled);
    setMax(String(fromMinor(settings.test_topup_max_usd_minor, 'USD')));
    setSignup(String(fromMinor(settings.signup_credit_usd_minor, 'USD')));
  }, [settings]);

  const submit = () => {
    const bps = toBps(fee);
    const maxUsd = max.trim() === '0' ? 0 : parseAmount(max);
    const signupUsd = signup.trim() === '0' ? 0 : parseAmount(signup);
    if (bps == null || maxUsd == null || signupUsd == null) {
      setError(t('Revisa los números: la comisión va de 0 a 100.'));
      return;
    }
    setError(undefined);
    save.mutate(
      {
        fee_bps: bps,
        test_topups_enabled: enabled,
        test_topup_max_usd_minor: toMinor(maxUsd, 'USD'),
        signup_credit_usd_minor: toMinor(signupUsd, 'USD'),
      },
      {
        onSuccess: () => toast(t('Configuración guardada.')),
        onError: (e) => setError(e instanceof ApiError ? e.message : t('No pudimos guardar.')),
      }
    );
  };

  return (
    <View style={styles.section}>
      <Text variant="heading">{t('Comisión y recargas')}</Text>
      <Card>
        <View style={styles.form}>
          <Input
            label={t('Comisión (% del precio acordado)')}
            value={fee}
            onChangeText={setFee}
            keyboardType="decimal-pad"
            hint={t('Hoy: {percent}. Aplica a las tareas que se elijan desde ahora.', {
              percent: formatPercent(settings.fee_bps),
            })}
          />
          <Text variant="caption" tone="muted">
            {t('Recargas de prueba')}
          </Text>
          <Segmented<'on' | 'off'>
            value={enabled ? 'on' : 'off'}
            onChange={(v) => setEnabled(v === 'on')}
            options={[
              { value: 'on', label: t('Activadas') },
              { value: 'off', label: t('Desactivadas') },
            ]}
          />
          <Input
            label={t('Máximo por recarga de prueba (USD)')}
            prefix="USD"
            value={max}
            onChangeText={setMax}
            keyboardType="decimal-pad"
          />
          <Input
            label={t('Crédito de bienvenida (USD)')}
            prefix="USD"
            value={signup}
            onChangeText={setSignup}
            keyboardType="decimal-pad"
            hint={t('Se da a cada cuenta nueva, en su moneda. 0 para no dar nada.')}
            error={error}
          />
          <Button label={t('Guardar')} onPress={submit} loading={save.isPending} block />
        </View>
      </Card>
    </View>
  );
}

function describe(p: Promotion): string {
  if (p.kind === 'credit_grant') return formatMoney(p.amount_usd_minor ?? 0, 'USD');
  return formatPercent(p.value_bps ?? 0);
}

function PromotionRow({ promotion: p }: { promotion: Promotion }) {
  const { toast } = useFeedback();
  const toggle = useSetPromotionActive();
  return (
    <Card>
      <View style={styles.sectionHead}>
        <View style={styles.flex}>
          <Text variant="bodyStrong">{p.name}</Text>
          <Text variant="caption" tone="muted">
            {t(KIND_LABEL[p.kind])} · {describe(p)}
            {p.code ? ` · ${p.code}` : ''}
          </Text>
          <Text variant="caption" tone="subtle">
            {p.max_redemptions != null
              ? t('{used} de {max} usos', { used: p.redemptions_count, max: p.max_redemptions })
              : t('{used} usos', { used: p.redemptions_count })}
          </Text>
        </View>
        <Badge
          label={p.active ? t('Activa') : t('Pausada')}
          tone={p.active ? 'success' : 'neutral'}
        />
      </View>
      <View style={styles.rowButtons}>
        <Button
          label={p.active ? t('Pausar') : t('Activar')}
          variant="secondary"
          size="sm"
          loading={toggle.isPending}
          onPress={() =>
            toggle.mutate(
              { id: p.id, active: !p.active },
              {
                onError: (e) =>
                  toast(e instanceof ApiError ? e.message : t('No pudimos guardar.'), 'error'),
              }
            )
          }
        />
      </View>
    </Card>
  );
}

function NewPromotionSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { toast } = useFeedback();
  const create = useCreatePromotion();
  const [kind, setKind] = useState<PromotionKind>('topup_bonus');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [value, setValue] = useState('');
  const [uses, setUses] = useState('');
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (visible) {
      setKind('topup_bonus');
      setName('');
      setCode('');
      setValue('');
      setUses('');
      setError(undefined);
    }
  }, [visible]);

  const isGrant = kind === 'credit_grant';
  const submit = () => {
    const body: NewPromotion = { name: name.trim(), kind };
    if (code.trim()) body.code = code.trim();
    if (uses.trim()) {
      const n = Number(uses);
      if (!Number.isInteger(n) || n < 1) {
        setError(t('Los usos deben ser un número entero.'));
        return;
      }
      body.max_redemptions = n;
    }
    if (isGrant) {
      const usd = parseAmount(value);
      if (usd == null) return setError(t('Escribe el monto en USD.'));
      body.amount_usd_minor = toMinor(usd, 'USD');
    } else {
      const bps = toBps(value);
      if (bps == null || bps < 1) return setError(t('Escribe un porcentaje entre 1 y 100.'));
      body.value_bps = bps;
    }
    if (!body.name) return setError(t('Ponle un nombre a la promoción.'));
    if (isGrant && !body.code) return setError(t('Un crédito necesita un código.'));
    setError(undefined);
    create.mutate(body, {
      onSuccess: () => {
        toast(t('Promoción creada.'));
        onClose();
      },
      onError: (e) =>
        setError(e instanceof ApiError ? e.message : t('No pudimos crear la promoción.')),
    });
  };

  return (
    <Sheet visible={visible} onClose={onClose} title={t('Nueva promoción')}>
      <Segmented<PromotionKind>
        value={kind}
        onChange={setKind}
        options={[
          { value: 'topup_bonus', label: t('Bono') },
          { value: 'fee_discount', label: t('Descuento') },
          { value: 'credit_grant', label: t('Crédito') },
        ]}
      />
      <Text variant="caption" tone="subtle">
        {kind === 'topup_bonus'
          ? t('Suma un porcentaje extra a cada recarga mientras esté activa.')
          : kind === 'fee_discount'
            ? t('Rebaja la comisión. Con código, solo a quien lo canjee; sin código, a todos.')
            : t('Regala saldo a quien canjee el código, una vez por persona.')}
      </Text>
      <Input label={t('Nombre')} value={name} onChangeText={setName} />
      <Input
        label={isGrant ? t('Monto (USD)') : t('Porcentaje')}
        prefix={isGrant ? 'USD' : '%'}
        value={value}
        onChangeText={setValue}
        keyboardType="decimal-pad"
      />
      <Input
        label={isGrant ? t('Código') : t('Código (opcional)')}
        value={code}
        onChangeText={setCode}
        autoCapitalize="characters"
        autoCorrect={false}
      />
      <Input
        label={t('Usos máximos (opcional)')}
        value={uses}
        onChangeText={setUses}
        keyboardType="number-pad"
        error={error}
      />
      <Button label={t('Crear promoción')} onPress={submit} loading={create.isPending} block />
    </Sheet>
  );
}

function CreditForm() {
  const { toast } = useFeedback();
  const credit = useManualCredit();
  const [email, setEmail] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string>();

  const submit = () => {
    const value = parseAmount(amount);
    if (value == null) return setError(t('Escribe un monto válido.'));
    setError(undefined);
    credit.mutate(
      {
        email: email.trim(),
        amount_minor: toMinor(value, currency.trim().toUpperCase()),
        currency: currency.trim().toUpperCase(),
        note: note.trim() || undefined,
      },
      {
        onSuccess: (r) => {
          toast(
            t('Acreditado. Nuevo saldo: {amount}.', {
              amount: formatMoney(r.balance_minor, r.currency),
            })
          );
          setAmount('');
          setNote('');
        },
        onError: (e) => setError(e instanceof ApiError ? e.message : t('No pudimos acreditar.')),
      }
    );
  };

  return (
    <View style={styles.section}>
      <Text variant="heading">{t('Recarga manual')}</Text>
      <Text variant="caption" tone="subtle">
        {t(
          'Para cuando alguien te pagó por fuera. El monto se convierte a la moneda de su billetera.'
        )}
      </Text>
      <Card>
        <View style={styles.form}>
          <Input
            label={t('Correo de la persona')}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            autoCorrect={false}
          />
          <Input
            label={t('Monto')}
            prefix={currency.toUpperCase()}
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
          />
          <Input
            label={t('Moneda del monto (código de 3 letras)')}
            value={currency}
            onChangeText={setCurrency}
            autoCapitalize="characters"
            maxLength={3}
          />
          <Input label={t('Nota (opcional)')} value={note} onChangeText={setNote} error={error} />
          <Button
            label={t('Acreditar')}
            onPress={submit}
            loading={credit.isPending}
            disabled={email.trim() === '' || amount.trim() === '' || currency.trim().length !== 3}
            block
          />
        </View>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  stack: { gap: space.xl },
  section: { gap: space.md },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.md,
  },
  form: { gap: space.md },
  rowButtons: { flexDirection: 'row', marginTop: space.md },
});
