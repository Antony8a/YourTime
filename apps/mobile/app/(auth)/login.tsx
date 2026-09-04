import { View, Text, TextInput, TouchableOpacity, Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet } from 'react-native';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../src/stores/authStore';
import { Button, Input, Card, Spinner } from '../components/ui';

export default function LoginScreen() {
  const router = useRouter();
  const { login, loading } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);

  const handleLogin = async () => {
    try {
      await login({ email, password, remember_me: rememberMe });
      router.replace('/(app)');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Error al iniciar sesión');
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1, backgroundColor: 'gray.50' }}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
    >
      <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 24, justifyContent: 'center' }}>
        <View style={{ alignItems: 'center', marginBottom: 48 }}>
          <Text style={{ fontSize: 32, fontWeight: 'bold', color: 'primary.600' }}>YourTime</Text>
          <Text style={{ fontSize: 16, color: 'gray.500', marginTop: 8 }}>Inicia sesión en tu cuenta</Text>
        </View>

        <Card className="w-full p-6">
          <View style={{ marginBottom: 24 }}>
            <Text style={{ fontSize: 18, fontWeight: '600', color: 'gray.900', marginBottom: 8 }}>
              Iniciar sesión
            </Text>
          </View>

          <Input
            label="Email"
            placeholder="tu@email.com"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            required
            style={{ marginBottom: 16 }}
          />

          <Input
            label="Contraseña"
            placeholder="••••••••"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="password"
            required
            style={{ marginBottom: 16 }}
          />

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
            <TouchableOpacity onPress={() => setRememberMe(!rememberMe)}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View
                  style={{
                    width: 20,
                    height: 20,
                    borderWidth: 2,
                    borderColor: rememberMe ? 'primary.500' : 'gray.300',
                    borderRadius: 4,
                    backgroundColor: rememberMe ? 'primary.500' : 'transparent',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {rememberMe && <Text style={{ color: 'white', fontSize: 12, fontWeight: 'bold' }}>✓</Text>}
                </View>
                <Text style={{ color: 'gray.700' }}>Recordarme</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => router.push('/(auth)/forgot-password')}>
              <Text style={{ color: 'primary.500', fontWeight: '500' }}>¿Olvidaste tu contraseña?</Text>
            </TouchableOpacity>
          </View>

          <Button
            title="Iniciar sesión"
            onPress={handleLogin}
            loading={loading}
            className="w-full"
            variant="primary"
          />

          <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 24, gap: 8 }}>
            <Text style={{ color: 'gray.500' }}>¿No tienes cuenta?</Text>
            <TouchableOpacity onPress={() => router.push('/(auth)/register')}>
              <Text style={{ color: 'primary.500', fontWeight: '600' }}>Regístrate</Text>
            </TouchableOpacity>
          </View>
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}