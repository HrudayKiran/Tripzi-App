const fs = require('fs');
const path = require('path');

const baseDir = path.join(process.cwd(), 'app');

const groups = {
  trip: {
    '_layout.tsx': `import { Stack } from 'expo-router';\nexport default function TripLayout() {\n  return (\n    <Stack screenOptions={{ headerShown: false }}>\n      <Stack.Screen name="[id]" />\n      <Stack.Screen name="create" options={{ presentation: 'modal' }} />\n      <Stack.Screen name="edit" options={{ presentation: 'modal' }} />\n      <Stack.Screen name="my-trips" />\n      <Stack.Screen name="map" />\n      <Stack.Screen name="search" />\n    </Stack>\n  );\n}`,
    'create.tsx': `import CreateTripScreen from '../../src/screens/CreateTripScreen';\nexport default function CreateTripRoute() { return <CreateTripScreen />; }`,
    'edit.tsx': `import EditTripScreen from '../../src/screens/EditTripScreen';\nexport default function EditTripRoute() { return <EditTripScreen />; }`,
    '[id].tsx': `import TripDetailsScreen from '../../src/screens/TripDetailsScreen';\nexport default function TripDetailsRoute() { return <TripDetailsScreen />; }`,
    'my-trips.tsx': `import MyTripsScreen from '../../src/screens/MyTripsScreen';\nexport default function MyTripsRoute() { return <MyTripsScreen />; }`,
    'map.tsx': `import MapScreen from '../../src/screens/MapScreen';\nexport default function MapRoute() { return <MapScreen />; }`,
    'search.tsx': `import SearchScreen from '../../src/screens/SearchScreen';\nexport default function SearchRoute() { return <SearchScreen />; }`
  },
  chat: {
    '_layout.tsx': `import { Stack } from 'expo-router';\nexport default function ChatLayout() {\n  return (\n    <Stack screenOptions={{ headerShown: false }}>\n      <Stack.Screen name="[id]" />\n      <Stack.Screen name="info" />\n      <Stack.Screen name="create" options={{ presentation: 'modal' }} />\n      <Stack.Screen name="settings" />\n    </Stack>\n  );\n}`,
    '[id].tsx': `import ChatScreen from '../../src/screens/ChatScreen';\nexport default function ChatRoute() { return <ChatScreen />; }`,
    'info.tsx': `import GroupInfoScreen from '../../src/screens/GroupInfoScreen';\nexport default function GroupInfoRoute() { return <GroupInfoScreen />; }`,
    'create.tsx': `import CreateGroupScreen from '../../src/screens/CreateGroupScreen';\nexport default function CreateGroupRoute() { return <CreateGroupScreen />; }`,
    'settings.tsx': `import MessageSettingsScreen from '../../src/screens/MessageSettingsScreen';\nexport default function MessageSettingsRoute() { return <MessageSettingsScreen />; }`
  },
  profile: {
    '_layout.tsx': `import { Stack } from 'expo-router';\nexport default function ProfileLayout() {\n  return (\n    <Stack screenOptions={{ headerShown: false }}>\n      <Stack.Screen name="settings" />\n      <Stack.Screen name="edit" />\n      <Stack.Screen name="[id]" />\n      <Stack.Screen name="help" />\n      <Stack.Screen name="delete-account" />\n      <Stack.Screen name="suggest-feature" />\n      <Stack.Screen name="privacy" />\n      <Stack.Screen name="terms" />\n    </Stack>\n  );\n}`,
    'settings.tsx': `import SettingsScreen from '../../src/screens/SettingsScreen';\nexport default function SettingsRoute() { return <SettingsScreen />; }`,
    'edit.tsx': `import EditProfileScreen from '../../src/screens/EditProfileScreen';\nexport default function EditProfileRoute() { return <EditProfileScreen />; }`,
    '[id].tsx': `import UserProfileScreen from '../../src/screens/UserProfileScreen';\nexport default function UserProfileRoute() { return <UserProfileScreen />; }`,
    'help.tsx': `import HelpSupportScreen from '../../src/screens/HelpSupportScreen';\nexport default function HelpSupportRoute() { return <HelpSupportScreen />; }`,
    'delete-account.tsx': `import DeleteAccountScreen from '../../src/screens/DeleteAccountScreen';\nexport default function DeleteAccountRoute() { return <DeleteAccountScreen />; }`,
    'suggest-feature.tsx': `import SuggestFeatureScreen from '../../src/screens/SuggestFeatureScreen';\nexport default function SuggestFeatureRoute() { return <SuggestFeatureScreen />; }`,
    'privacy.tsx': `import PrivacyPolicyScreen from '../../src/screens/PrivacyPolicyScreen';\nexport default function PrivacyPolicyRoute() { return <PrivacyPolicyScreen />; }`,
    'terms.tsx': `import TermsScreen from '../../src/screens/TermsScreen';\nexport default function TermsRoute() { return <TermsScreen />; }`
  }
};

for (const [groupName, files] of Object.entries(groups)) {
  const dir = path.join(baseDir, groupName);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  for (const [filename, content] of Object.entries(files)) {
    fs.writeFileSync(path.join(dir, filename), content);
  }
}
console.log('All wrappers created successfully.');
