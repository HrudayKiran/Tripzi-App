import { Stack } from 'expo-router';

export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="launch" />
      <Stack.Screen name="welcome" />
      <Stack.Screen name="start" />
      <Stack.Screen name="complete-profile" />
    </Stack>
  );
}
