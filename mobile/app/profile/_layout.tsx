import { Stack } from 'expo-router';
export default function ProfileLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="settings" />
      <Stack.Screen name="edit" />
      <Stack.Screen name="[id]" />
      <Stack.Screen name="help" />
      <Stack.Screen name="delete-account" />
      <Stack.Screen name="suggest-feature" />
      <Stack.Screen name="privacy" />
      <Stack.Screen name="terms" />
    </Stack>
  );
}