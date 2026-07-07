import { Stack } from 'expo-router';
import { useTheme } from '../../src/contexts/ThemeContext';

export default function TripLayout() {
  const { colors } = useTheme();
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background }, animation: 'fade' }}>
      <Stack.Screen name="create" options={{ presentation: 'modal', contentStyle: { backgroundColor: colors.background } }} />
      <Stack.Screen name="edit" options={{ presentation: 'modal', contentStyle: { backgroundColor: colors.background } }} />
    </Stack>
  );
}