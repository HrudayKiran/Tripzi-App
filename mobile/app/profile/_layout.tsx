import { Stack } from 'expo-router';
import { useTheme } from '../../src/contexts/ThemeContext';

export default function ProfileLayout() {
  const { colors } = useTheme();
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background }, animation: 'fade' }}>
      <Stack.Screen name="settings" options={{ contentStyle: { backgroundColor: colors.background } }} />
      <Stack.Screen name="edit" options={{ contentStyle: { backgroundColor: colors.background } }} />
      <Stack.Screen name="[id]" options={{ contentStyle: { backgroundColor: colors.background } }} />
      <Stack.Screen name="help" options={{ contentStyle: { backgroundColor: colors.background } }} />
      <Stack.Screen name="delete-account" options={{ contentStyle: { backgroundColor: colors.background } }} />
      <Stack.Screen name="suggest-feature" options={{ contentStyle: { backgroundColor: colors.background } }} />
      <Stack.Screen name="privacy" options={{ contentStyle: { backgroundColor: colors.background } }} />
      <Stack.Screen name="terms" options={{ contentStyle: { backgroundColor: colors.background } }} />
    </Stack>
  );
}