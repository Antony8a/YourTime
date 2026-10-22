import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { normalizeServerUrl } from '@yourtime/shared-utils';
import { checkApiUrl, getApiUrl, getDefaultApiUrl, setApiUrl } from '@/api/client';
import { useFeedback } from '@/components/feedback/FeedbackProvider';
import { Button, Input, Sheet, Text } from '@/components/ui';
import { space } from '@/theme/tokens';

/** "http://192.168.1.109:8080" -> "192.168.1.109:8080", for a short label. */
const shortUrl = (url: string) => url.replace(/^https?:\/\//, '');

/**
 * Lets the person say where the YourTime server is. The installed app does not
 * have to be rebuilt when the computer running the server changes address.
 */
export function ServerLink() {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState(getApiUrl());

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Servidor ${shortUrl(current)}. Cambiar`}
        onPress={() => setOpen(true)}
        style={styles.link}
      >
        <Text variant="caption" tone="subtle" style={styles.center}>
          Servidor: {shortUrl(current)} ·{' '}
          <Text variant="caption" tone="primary">
            Cambiar
          </Text>
        </Text>
      </Pressable>
      <ServerSheet
        visible={open}
        onClose={() => {
          setCurrent(getApiUrl());
          setOpen(false);
        }}
      />
    </>
  );
}

function ServerSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { toast } = useFeedback();
  const [text, setText] = useState('');
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (visible) {
      setText(shortUrl(getApiUrl()));
      setError(undefined);
    }
  }, [visible]);

  const save = async () => {
    const url = normalizeServerUrl(text);
    if (!url) {
      setError('Escribe una dirección válida, por ejemplo 192.168.1.109');
      return;
    }
    setBusy(true);
    setError(undefined);
    const ok = await checkApiUrl(url);
    setBusy(false);
    if (!ok) {
      setError(
        'No pude conectar. Revisa que el celular esté en el mismo WiFi que el computador y que la API esté encendida.'
      );
      return;
    }
    await setApiUrl(url);
    toast('Servidor guardado.');
    onClose();
  };

  const reset = async () => {
    await setApiUrl(null);
    toast('Servidor restablecido.');
    onClose();
  };

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="Servidor"
      subtitle="Dónde corre la API de YourTime"
    >
      <Input
        label="Dirección"
        value={text}
        onChangeText={setText}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
        placeholder="192.168.1.109"
        hint="La IP de tu computador en el WiFi. El puerto 8080 se completa solo."
        error={error}
      />
      <View style={{ gap: space.sm }}>
        <Button label="Probar y guardar" onPress={() => void save()} loading={busy} block />
        {getApiUrl() !== getDefaultApiUrl() ? (
          <Button
            label={`Volver a ${shortUrl(getDefaultApiUrl())}`}
            variant="ghost"
            onPress={() => void reset()}
            disabled={busy}
            block
          />
        ) : null}
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  link: { minHeight: 44, justifyContent: 'center', marginTop: space.lg },
  center: { textAlign: 'center' },
});
