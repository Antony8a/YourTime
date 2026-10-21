import { forwardRef, useImperativeHandle, useRef, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/tokens';
import { Icon, type IconName } from './Icon';
import { Text } from './Text';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  hint?: string;
  icon?: IconName;
  /** Text shown before the value, e.g. a currency code. */
  prefix?: string;
  /** Element shown after the value, e.g. a show/hide toggle. */
  right?: ReactNode;
}

export const Input = forwardRef<TextInput, InputProps>(function Input(
  { label, error, hint, icon, prefix, right, multiline, style, onFocus, onBlur, ...rest },
  ref
) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  const inner = useRef<TextInput>(null);
  // Expose the real TextInput so parents can focus it (next-field on "return").
  useImperativeHandle(ref, () => inner.current as TextInput, []);
  const borderColor = error ? colors.danger : focused ? colors.primary : colors.border;

  return (
    <View style={styles.wrap}>
      {label ? (
        <Text variant="caption" tone="muted" style={styles.label}>
          {label}
        </Text>
      ) : null}
      {/* Tapping anywhere in the padded field focuses the input. */}
      <Pressable
        accessible={false}
        onPress={() => inner.current?.focus()}
        style={[
          styles.field,
          multiline && styles.fieldMultiline,
          { backgroundColor: colors.surface, borderColor, borderWidth: focused || error ? 1.5 : 1 },
        ]}
      >
        {icon ? <Icon name={icon} size={18} color="textSubtle" /> : null}
        {prefix ? (
          <Text variant="bodyStrong" tone="muted">
            {prefix}
          </Text>
        ) : null}
        <TextInput
          ref={inner}
          accessibilityLabel={label}
          placeholderTextColor={colors.textSubtle}
          multiline={multiline}
          textAlignVertical={multiline ? 'top' : 'center'}
          style={[
            styles.input,
            { color: colors.text },
            multiline && styles.inputMultiline,
            webReset,
            style,
          ]}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          {...rest}
        />
        {right}
      </Pressable>
      {error ? (
        <Text
          variant="caption"
          tone="danger"
          style={styles.message}
          accessibilityLiveRegion="polite"
        >
          {error}
        </Text>
      ) : hint ? (
        <Text variant="caption" tone="subtle" style={styles.message}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
});

// react-native-web draws a browser focus outline; the border already shows focus.
const webReset = { outlineStyle: 'none' } as unknown as object;

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  label: { marginLeft: 2 },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    minHeight: 50,
    paddingHorizontal: space.lg,
    borderRadius: radius.md,
  },
  fieldMultiline: { alignItems: 'flex-start', paddingVertical: space.md },
  input: { flex: 1, fontSize: 16, paddingVertical: 10, minHeight: 44 },
  inputMultiline: { minHeight: 104, paddingVertical: 0 },
  message: { marginLeft: 2 },
});
