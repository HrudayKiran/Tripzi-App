
import React from 'react';
import AppNavigator from './src/navigation/AppNavigator';
import usePushNotifications from './src/hooks/usePushNotifications';

export default function App() {
  // Initialize push notification listeners and handlers
  usePushNotifications();

  return <AppNavigator />;
}
