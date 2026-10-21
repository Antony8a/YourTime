import { useRef, useState } from 'react';
import { Pressable, StyleSheet, View, type TextInput } from 'react-native';
import { Link } from 'expo-router';
import { ApiError } from '@/api/client';
import { useLogin } from '@/api/hooks';
import { BrandMark } from '@/components/BrandMark';
import { Button, Input, Screen, Text } from '@/components/ui';
import { space } from '@/theme/tokens';

export default function LoginScreen() {
  const login = useLogin();
  const passwordRef = useRef<TextInput>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string>();

  const canSubmit = email.trim().length > 3 && password.length > 0;

  const submit = () => {
    if (!canSubmit || login.isPending) return;
    setError(undefined);
    login.mutate(
      { email: email.trim(), password },
      { onError: (e) => setError(e instanceof ApiError ? e.message : 'No pudimos iniciar sesión.') }
    );
  };

  return (
    <Screen>
      <View style={styles.hero}>
        <BrandMark size={64} />
        <Text variant="display">Bienvenido de vuelta</Text>
        <Text tone="muted">Publica tareas o encuentra a quién ayudar cerca de ti.</Text>
      </View>

      <View style={styles.form}>
        <Input
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
          placeholder="tu@correo.com"
        />
        <Input
          ref={passwordRef}
          label="Contraseña"
          icon="lock-closed-outline"
          value={password}
          onChangeText={setPassword}
          secureTextEntry={!showPassword}
          autoCapitalize="none"
          autoComplete="current-password"
          returnKeyType="go"
          onSubmitEditing={submit}
          placeholder="Tu contraseña"
          right={
            <Pressable
              accessibilityRole="button"
              onPress={() => setShowPassword((v) => !v)}
              style={styles.toggleTouch}
            >
              <Text variant="caption" tone="primary" style={styles.toggle}>
                {showPassword ? 'Ocultar' : 'Mostrar'}
              </Text>
            </Pressable>
          }
        />
        {error ? (
          <Text variant="caption" tone="danger" accessibilityLiveRegion="polite">
            {error}
          </Text>
        ) : null}
        <Button
          label="Ingresar"
          onPress={submit}
          loading={login.isPending}
          disabled={!canSubmit}
          block
        />
      </View>

      <View style={styles.footer}>
        <Text tone="muted">¿Aún no tienes cuenta?</Text>
        <Link href="/register" asChild>
          <Pressable accessibilityRole="link" style={styles.linkTouch}>
            <Text tone="primary" style={styles.link}>
              Crear cuenta
            </Text>
          </Pressable>
        </Link>
      </View>

      {__DEV__ ? (
        <Text variant="caption" tone="subtle" style={styles.dev}>
          Cuenta de prueba: ana@yourtime.dev · contraseña yourtime123
        </Text>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { gap: space.md, paddingTop: space.xxxl, paddingBottom: space.xxl },
  form: { gap: space.lg },
  toggle: { fontWeight: '700' },
  toggleTouch: {
    minHeight: 44,
    minWidth: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: -8,
  },
  linkTouch: { minHeight: 44, justifyContent: 'center' },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.xs,
    marginTop: space.xxl,
  },
  link: { fontWeight: '700' },
  dev: { textAlign: 'center', marginTop: space.xxl },
});
