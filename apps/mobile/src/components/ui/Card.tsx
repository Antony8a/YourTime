import { View, StyleSheet } from 'react-native';
import { useColorScheme } from 'react-native';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  style?: any;
}

export const Card = ({ children, className = '', style }: CardProps) => {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <View style={[styles.card, isDark ? styles.cardDark : styles.cardLight, className && styles[className], style]}>
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
  },
  cardLight: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  cardDark: {
    backgroundColor: '#1F2937',
    borderColor: '#374151',
  },
});