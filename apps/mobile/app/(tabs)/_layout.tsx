import { BottomTabBar } from '@react-navigation/bottom-tabs';
import { Tabs } from 'expo-router';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ServiceBanner } from '@/components/service/ServiceBanner';
import { Icon, type IconName } from '@/components/ui';
import { useTheme } from '@/theme/ThemeProvider';

const TABS: { name: string; title: string; icon: IconName; iconActive: IconName }[] = [
  { name: 'index', title: 'Explorar', icon: 'compass-outline', iconActive: 'compass' },
  { name: 'publish', title: 'Publicar', icon: 'add-circle-outline', iconActive: 'add-circle' },
  { name: 'activity', title: 'Actividad', icon: 'briefcase-outline', iconActive: 'briefcase' },
  { name: 'profile', title: 'Perfil', icon: 'person-outline', iconActive: 'person' },
];

export default function TabsLayout() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const bottom = Math.max(insets.bottom, 8);
  return (
    <Tabs
      detachInactiveScreens
      tabBar={(props) => (
        <View>
          <ServiceBanner />
          <View role="navigation" aria-label="Navegación principal">
            <BottomTabBar {...props} />
          </View>
        </View>
      )}
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSubtle,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          height: 68 + bottom,
          paddingTop: 8,
          paddingBottom: bottom,
        },
        tabBarLabelStyle: { fontSize: 11, lineHeight: 16, fontWeight: '600' },
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      {TABS.map((t) => (
        <Tabs.Screen
          key={t.name}
          name={t.name}
          options={{
            title: t.title,
            tabBarIcon: ({ focused, color }) => (
              <Icon name={focused ? t.iconActive : t.icon} size={24} color={color} />
            ),
          }}
        />
      ))}
    </Tabs>
  );
}
