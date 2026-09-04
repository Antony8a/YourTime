import { View, Text, Image, StyleSheet } from 'react-native';
import { useColorScheme } from 'react-native';

interface AvatarProps {
  source?: { uri: string };
  name?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  style?: any;
}

const sizeMap = {
  xs: 24,
  sm: 32,
  md: 40,
  lg: 56,
  xl: 80,
};

export const Avatar = ({ source, name, size = 'md', className = '', style }: AvatarProps) => {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const avatarSize = sizeMap[size];

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getColorFromName = (name: string) => {
    const colors = [
      '#3B82F6', '#8B5CF6', '#10B981', '#F59E0B', '#EF4444', '#EC4899', '#06B6D4', '#84CC16',
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

  if (source) {
    return (
      <Image
        source={source}
        style={[
          styles.avatar,
          { width: avatarSize, height: avatarSize, borderRadius: avatarSize / 2 },
          style,
        ]}
      />
    );
  }

  if (name) {
    const color = getColorFromName(name);
    return (
      <View
        style={[
          styles.avatar,
          { width: avatarSize, height: avatarSize, borderRadius: avatarSize / 2, backgroundColor: color },
          style,
        ]}
      >
        <Text style={[styles.initials, { fontSize: avatarSize * 0.4 }]}>{getInitials(name)}</Text>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.avatar,
        { width: avatarSize, height: avatarSize, borderRadius: avatarSize / 2, backgroundColor: isDark ? '#374151' : '#E5E7EB' },
        style,
      ]}
    >
      <Text style={[styles.initials, { fontSize: avatarSize * 0.4 }, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>?</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  avatar: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  initials: {
    fontWeight: '600',
    color: '#FFFFFF',
  },
});