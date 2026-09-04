import { View, Text, Pressable, StyleSheet, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from 'react-native';
import { Button, Input } from '../ui';

interface TaskFilterProps {
  visible: boolean;
  onClose: () => void;
  onFilter: (filters: any) => void;
  categories: { id: string; name: string }[];
  selectedCategory?: string;
}

export const TaskFilter = ({ visible, onClose, onFilter, categories, selectedCategory }: TaskFilterProps) => {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <View style={[styles.modal, isDark ? styles.modalDark : styles.modalLight]}>
          <View style={styles.header}>
            <Text style={styles.title}>Filtros</Text>
            <Pressable onPress={onClose} style={styles.closeButton} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={styles.closeText}>✕</Text>
            </Pressable>
          </View>

          <View style={styles.content}>
            <Text style={styles.sectionTitle}>Categoría</Text>
            <View style={styles.categoryList}>
              {categories.map((cat) => (
                <Pressable
                  key={cat.id}
                  style={[
                    styles.categoryItem,
                    selectedCategory === cat.id && styles.categoryItemSelected,
                    isDark ? styles.categoryItemDark : styles.categoryItemLight,
                  ]}
                  onPress={() => onFilter({ ...{}, categoryId: cat.id })}
                >
                  <Text style={[
                    styles.categoryName,
                    selectedCategory === cat.id && styles.categoryNameSelected,
                    isDark ? styles.categoryNameDark : styles.categoryNameLight,
                  ]}>
                    {cat.name}
                  </Text>
                </Pressable>
              ))}
              {!selectedCategory && (
                <Pressable style={[styles.categoryItem, styles.categoryItemSelected, isDark ? styles.categoryItemDark : styles.categoryItemLight]} onPress={() => onFilter({ categoryId: '' })}>
                  <Text style={[styles.categoryName, styles.categoryNameSelected, isDark ? styles.categoryNameDark : styles.categoryNameLight]}>Todas</Text>
                </Pressable>
              )}
            </View>

            <Text style={styles.sectionTitle}>Presupuesto</Text>
            <View style={styles.budgetRow}>
              <Input
                placeholder="Mín"
                keyboardType="numeric"
                placeholderTextColor="#9CA3AF"
                style={styles.budgetInput}
              />
              <Text style={styles.budgetSeparator}>-</Text>
              <Input
                placeholder="Máx"
                keyboardType="numeric"
                placeholderTextColor="#9CA3AF"
                style={styles.budgetInput}
              />
            </View>

            <View style={styles.actions}>
              <Button title="Limpiar" variant="outline" onPress={() => onFilter({})} className="flex-1" />
              <Button title="Aplicar" onPress={() => { onFilter({}); onClose(); }} className="flex-1" />
            </View>
          </View>
        </View>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modal: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
  },
  modalLight: { backgroundColor: '#FFFFFF' },
  modalDark: { backgroundColor: '#1F2937' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderColor: '#E5E7EB',
  },
  title: { fontSize: 18, fontWeight: '600', color: '#111827' },
  closeButton: { padding: 4 },
  closeText: { fontSize: 24, color: '#6B7280', fontWeight: '300' },
  content: { padding: 16, maxHeight: '70%' },
  sectionTitle: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 12, marginTop: 8 },
  categoryList: { gap: 8 },
  categoryItem: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  categoryItemLight: { backgroundColor: '#F9FAFB', borderColor: '#E5E7EB' },
  categoryItemDark: { backgroundColor: '#374151', borderColor: '#4B5563' },
  categoryItemSelected: { borderWidth: 2, borderColor: '#3B82F6' },
  categoryName: { fontSize: 14, fontWeight: '500' },
  categoryNameLight: { color: '#374151' },
  categoryNameDark: { color: '#F9FAFB' },
  categoryNameSelected: { color: '#3B82F6', fontWeight: '600' },
  budgetRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  budgetInput: { flex: 1 },
  budgetSeparator: { alignSelf: 'center', color: '#9CA3AF', fontSize: 16 },
  actions: { flexDirection: 'row', gap: 12, marginTop: 24 },
});