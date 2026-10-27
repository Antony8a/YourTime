import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { LOCALES, t, getLocale, type Locale } from '@yourtime/shared-utils';
import { Chip, Sheet, Text } from '@/components/ui';
import { deviceLanguage, followDeviceLanguage, rememberLanguage } from '@/i18n';
import { space } from '@/theme/tokens';

interface LanguagePickerProps {
  visible: boolean;
  onClose: () => void;
  /** The person picked a language; null means "follow my device". */
  onSelect: (locale: Locale | null) => void;
  /** Whether "follow my device" is currently in effect. Default false. */
  followsDevice?: boolean;
}

/** Each language is named in itself, so someone who cannot read the current one can still find theirs. */
export function LanguagePicker({
  visible,
  onClose,
  onSelect,
  followsDevice = false,
}: LanguagePickerProps) {
  const current = getLocale();
  const device = LOCALES.find((l) => l.code === deviceLanguage())?.name;
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={t('Idioma')}
      subtitle={t('El idioma de toda la aplicación.')}
    >
      <View style={{ gap: space.sm }}>
        {LOCALES.map((l) => (
          <Chip
            key={l.code}
            label={l.name}
            selected={!followsDevice && current === l.code}
            onPress={() => {
              onSelect(l.code);
              onClose();
            }}
          />
        ))}
        <Chip
          label={t('Idioma del dispositivo ({language})', { language: device ?? '' })}
          selected={followsDevice}
          onPress={() => {
            onSelect(null);
            onClose();
          }}
        />
      </View>
      <Text variant="caption" tone="subtle">
        {t('Los textos que escriben otras personas, como las tareas, no se traducen.')}
      </Text>
    </Sheet>
  );
}

/**
 * "Idioma: Español · Cambiar" for the screens before there is an account. The choice
 * is kept on this device, and a new account starts with it.
 */
export function LanguageLink() {
  const [open, setOpen] = useState(false);
  const name = LOCALES.find((l) => l.code === getLocale())?.name ?? '';
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('Idioma {name}. Cambiar', { name })}
        onPress={() => setOpen(true)}
        style={styles.link}
      >
        <Text variant="caption" tone="subtle" style={styles.center}>
          {t('Idioma: {name} ·', { name })}{' '}
          <Text variant="caption" tone="primary">
            {t('Cambiar')}
          </Text>
        </Text>
      </Pressable>
      <LanguagePicker
        visible={open}
        onClose={() => setOpen(false)}
        onSelect={(locale) => void (locale ? rememberLanguage(locale) : followDeviceLanguage())}
      />
    </>
  );
}

const styles = StyleSheet.create({
  link: { minHeight: 44, justifyContent: 'center' },
  center: { textAlign: 'center' },
});
