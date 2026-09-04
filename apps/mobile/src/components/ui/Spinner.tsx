import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { useColorScheme } from 'react-native';

interface SpinnerProps {
  size?: 'small' | 'large';
  color?: string;
  className?: string;
  style?: any;
}

export const Spinner = ({ size = 'large', color, className = '', style }: SpinnerProps) => {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <View style={[styles.container, className && styles[className], style]}>
      <ActivityIndicator
        size={size}
        color={color || (isDark ? '#60A5FA' : '#3B82F6')}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});