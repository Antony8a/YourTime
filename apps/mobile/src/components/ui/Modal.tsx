import { View, Text, TouchableOpacity, StyleSheet, Modal as RNModal, Pressable } from 'react-native';
import { useColorScheme } from 'react-native';

interface ModalProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'full';
}

const sizeStyles = {
  sm: { maxWidth: '80%' },
  md: { maxWidth: '90%' },
  lg: { maxWidth: '95%' },
  full: { maxWidth: '100%' },
};

export const Modal = ({ visible, onClose, title, children, size = 'md' }: ModalProps) => {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  if (!visible) return null;

  return (
    <RNModal visible={visible} animationType="fade" transparent={true} onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <View
          style={[
            styles.container,
            {
              backgroundColor: isDark ? '#1F2937' : '#FFFFFF',
              width: '100%',
              ...sizeStyles[size],
            },
          ]}
        >
          {(title || onClose) && (
            <View style={styles.header}>
              {title && <Text style={styles.title}>{title}</Text>}
              <Pressable onPress={onClose} style={styles.closeButton} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Text style={styles.closeText}>✕</Text>
              </Pressable>
            </View>
          )}
          <View style={styles.content}>{children}</View>
        </View>
      </Pressable>
    </RNModal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  container: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderColor: '#E5E7EB',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  closeButton: {
    padding: 4,
  },
  closeText: {
    fontSize: 24,
    color: '#6B7280',
    fontWeight: '300',
  },
  content: {
    padding: 16,
  },
});