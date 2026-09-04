import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons, MapPin } from '@expo/vector-icons';
import { useColorScheme } from 'react-native';
import { TaskDTO } from '@yourtime/shared-types';
import { Button, Badge } from '../ui';

interface TaskCardProps {
  task: TaskDTO;
  onPress: (id: string) => void;
  onApply?: (id: string) => void;
}

export const TaskCard = ({ task, onPress, onApply }: TaskCardProps) => {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const formatTokens = (tokens: number) => {
    return new Intl.NumberFormat('es-AR').format(tokens);
  };

  return (
    <Pressable onPress={() => onPress(task.id)} style={[styles.card, isDark ? styles.cardDark : styles.cardLight]}>
      <View style={styles.header}>
        <View style={styles.titleContainer}>
          <Text style={[styles.title, isDark ? styles.titleDark : styles.titleLight]} numberOfLines={1}>
            {task.title}
          </Text>
          {task.urgency === 'high' || task.urgency === 'urgent' ? (
            <Badge variant="error" size="sm">{task.urgency}</Badge>
          ) : null}
        </View>
      </View>

      <Text style={[styles.description, isDark ? styles.descriptionDark : styles.descriptionLight]} numberOfLines={2}>
        {task.description}
      </Text>

      <View style={styles.meta}>
        <View style={styles.metaItem}>
          <MapPin size={16} color={isDark ? '#9CA3AF' : '#6B7280'} />
          <Text style={[styles.metaText, isDark ? styles.metaTextDark : styles.metaTextLight]}>
            {task.location_city}
          </Text>
        </View>

        <Text style={[styles.budget, isDark ? styles.budgetDark : styles.budgetLight]}>
          {formatTokens(task.budget_min_tokens)} tokens
        </Text>
      </View>

      {onApply && (
        <Button
          title="Aplicar"
          variant="outline"
          onPress={() => onApply(task.id)}
          className="mt-3 w-full"
        />
      )}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
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
  header: {
    marginBottom: 8,
  },
  titleContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
    marginRight: 8,
  },
  titleLight: { color: '#111827' },
  titleDark: { color: '#F9FAFB' },
  description: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  descriptionLight: { color: '#6B7280' },
  descriptionDark: { color: '#9CA3AF' },
  meta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 13,
  },
  metaTextLight: { color: '#6B7280' },
  metaTextDark: { color: '#9CA3AF' },
  budget: {
    fontSize: 18,
    fontWeight: '700',
  },
  budgetLight: { color: '#3B82F6' },
  budgetDark: { color: '#60A5FA' },
});