import { Tabs } from 'expo-router';
import { useTheme } from '../../src/contexts/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import { View, Text, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';

export default function TabsLayout() {
  const { colors } = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: true,
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          height: 76,
          paddingBottom: 10,
          paddingTop: 8,
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarLabelStyle: { fontSize: 12, fontWeight: '600', marginBottom: 4 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }: { color: string; size: number }) => <Ionicons name="home-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="ai-planner"
        options={{
          title: 'AI Planner',
          tabBarIcon: ({ color, size }: { color: string; size: number }) => (
            <View className="w-6 h-6 rounded-full overflow-hidden">
              <Image
                source={require('../../assets/Tripzi AI.png')}
                className="w-full h-full"
                contentFit="cover"
              />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="create"
        options={{
          title: '',
          tabBarButton: (props: any) => (
            <View className="flex-1 items-center justify-center">
              <TouchableOpacity
                className="w-[68px] h-[68px] rounded-full justify-center items-center -mt-[38px] border-4"
                style={{
                  backgroundColor: '#9d74f7',
                  borderColor: colors.card,
                }}
                activeOpacity={0.88}
              >
                <Text className="text-4xl font-black text-white leading-[42px]">+</Text>
              </TouchableOpacity>
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: 'Messages',
          tabBarIcon: ({ color, size }: { color: string; size: number }) => <Ionicons name="chatbubble-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }: { color: string; size: number }) => <Ionicons name="person-outline" size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}
