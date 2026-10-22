import { useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, View, type TextInput } from 'react-native';
import { Link } from 'expo-router';
import { SUPPORTED_CURRENCIES } from '@yourtime/shared-utils';
import { ApiError } from '@/api/client';
import { useRegister } from '@/api/hooks';
import { BrandMark } from '@/components/BrandMark';
import { CurrencyPicker } from '@/components/profile/CurrencyPicker';
import { ServerLink } from '@/components/ServerSheet';
import { Button, Card, Icon, Input, Screen, Text } from '@/components/ui';
import { guessCurrency } from '@/lib/messages';
import { useTheme } from '@/theme/ThemeProvider';
import { space } from '@/theme/tokens';

export default function RegisterScreen() {
  const { colors } = useTheme();
  const register = useRegister();
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [currency, setCurrency] = useState(guessCurrency);
  const [pickingCurrency, setPickingCurrency] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string>();

  const currencyName = useMemo(
    () => SUPPORTED_CURRENCIES.find((c) => c.code === currency)?.name,
    [currency]
  );

  const submit = () => {
    const local: Record<string, string> = {};
    if (!fullName.trim()) local.full_name = 'Cuéntanos cómo te llamas.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) local.email = 'Escribe un correo válido.';
    if (password.length < 8) local.password = 'Usa al menos 8 caracteres.';
    setErrors(local);
    setFormError(undefined);
    if (Object.keys(local).length > 0) return;

    register.mutate(
      { full_name: fullName.trim(), email: email.trim(), password, currency },
      {
        onError: (e) => {
          if (e instanceof ApiError) {
            setErrors(e.fieldErrors);
            if (e.code === 'email_taken') setErrors({ email: e.message });
            else if (Object.keys(e.fieldErrors).length === 0) setFormError(e.message);
          } else setFormError('No pudimos crear tu cuenta.');
        },
      }
    );
  };

  return (
    <Screen>
      <View style={styles.hero}>
        <BrandMark size={56} />
        <Text variant="display">Crea tu cuenta</Text>
        <Text tone="muted">Es gratis. Publica lo que necesitas o ayuda a otros y gana tiempo.</Text>
      </View>

      <View style={styles.form}>
        <Input
          label="Nombre completo"
          icon="person-outline"
          value={fullName}
          onChangeText={setFullName}
          autoComplete="name"
          autoCapitalize="words"
          returnKeyType="next"
          onSubmitEditing={() => emailRef.current?.focus()}
          error={errors.full_name}
          placeholder="Ana Restrepo"
        />
        <Input
          ref={emailRef}
          label="Correo electrónico"
          icon="mail-outline"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          autoCorrect={false}
          returnKeyType="next"
          onSubmitEditing={() => passwordRef.current?.focus()}
          error={errors.email}
          placeholder="tu@correo.com"
        />
        <Input
          ref={passwordRef}
          label="Contraseña"
          icon="lock-closed-outline"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
          autoComplete="new-password"
          returnKeyType="go"
          onSubmitEditing={submit}
          error={errors.password}
          hint="Mínimo 8 caracteres."
          placeholder="Crea una contraseña"
        />

        <View style={styles.currencyBlock}>
          <Text variant="caption" tone="muted" style={styles.currencyLabel}>
            Moneda de tu cuenta
          </Text>
          <Card
            onPress={() => setPickingCurrency(true)}
            accessibilityLabel={`Moneda ${currency}. Cambiar`}
            padded={false}
          >
            <View style={styles.currencyRow}>
              <View style={[styles.currencyBadge, { backgroundColor: colors.primarySoft }]}>
                <Text variant="bodyStrong" tone="primary">
                  {currency}
                </Text>
              </View>
              <View style={styles.currencyText}>
                <Text variant="bodyStrong">{currencyName ?? currency}</Text>
                <Text variant="caption" tone="subtle">
                  Verás y publicarás precios en esta moneda.
                </Text>
              </View>
              <Icon name="chevron-forward" size={18} color="textSubtle" />
            </View>
          </Card>
        </View>

        {formError ? (
          <Text variant="caption" tone="danger" accessibilityLiveRegion="polite">
            {formError}
          </Text>
        ) : null}
        <Button label="Crear cuenta" onPress={submit} loading={register.isPending} block />
      </View>

      <View style={styles.footer}>
        <Text tone="muted">¿Ya tienes cuenta?</Text>
        <Link href="/login" asChild>
          <Pressable accessibilityRole="link" style={styles.linkTouch}>
            <Text tone="primary" style={styles.link}>
              Ingresar
            </Text>
          </Pressable>
        </Link>
      </View>

      <ServerLink />

      <CurrencyPicker
        visible={pickingCurrency}
        selected={currency}
        onSelect={setCurrency}
        onClose={() => setPickingCurrency(false)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { gap: space.md, paddingTop: space.xxl, paddingBottom: space.xxl },
  form: { gap: space.lg },
  currencyBlock: { gap: 6 },
  currencyLabel: { marginLeft: 2 },
  currencyRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md },
  currencyBadge: { paddingHorizontal: space.md, paddingVertical: space.sm, borderRadius: 10 },
  currencyText: { flex: 1 },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.xs,
    marginTop: space.xxl,
  },
  link: { fontWeight: '700' },
  linkTouch: { minHeight: 44, justifyContent: 'center' },
});
