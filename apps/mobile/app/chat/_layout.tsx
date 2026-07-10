import { Stack } from 'expo-router';
import { useTheme } from '../../src/contexts/ThemeContext';

export default function ChatLayout() {
  const { colors } = useTheme();
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background }, animation: 'fade' }}>
      <Stack.Screen name="[id]" options={{ contentStyle: { backgroundColor: colors.background } }} />
      <Stack.Screen name="info" options={{ contentStyle: { backgroundColor: colors.background } }} />
      <Stack.Screen name="create" options={{ presentation: 'modal', contentStyle: { backgroundColor: colors.background } }} />
      <Stack.Screen name="settings" options={{ contentStyle: { backgroundColor: colors.background } }} />
    </Stack>
  );
}