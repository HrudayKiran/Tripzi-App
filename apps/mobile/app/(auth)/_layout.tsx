import { Stack } from 'expo-router';
import { useTheme } from '../../src/contexts/ThemeContext';

export default function AuthLayout() {
  const { colors } = useTheme();
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background }, animation: 'fade' }}>
      <Stack.Screen name="launch" options={{ contentStyle: { backgroundColor: colors.background } }} />
      <Stack.Screen name="welcome" options={{ contentStyle: { backgroundColor: colors.background } }} />
      <Stack.Screen name="start" options={{ contentStyle: { backgroundColor: colors.background } }} />
      <Stack.Screen name="complete-profile" options={{ contentStyle: { backgroundColor: colors.background } }} />
    </Stack>
  );
}
