import { Stack } from 'expo-router';
export default function TripLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="[id]" />
      <Stack.Screen name="create" options={{ presentation: 'modal' }} />
      <Stack.Screen name="edit" options={{ presentation: 'modal' }} />
      <Stack.Screen name="my-trips" />
      <Stack.Screen name="map" />
      <Stack.Screen name="search" />
    </Stack>
  );
}