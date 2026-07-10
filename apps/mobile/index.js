import 'react-native-gesture-handler';
import { registerRootComponent } from 'expo';
import { getMessaging } from '@react-native-firebase/messaging';

// Suppress harmless 'Unable to activate keep awake' warnings on emulators in dev mode
if (__DEV__) {
  const originalConsoleError = console.error;
  console.error = (...args) => {
    if (args[0] && args[0].toString().includes('Unable to activate keep awake')) {
      return;
    }
    originalConsoleError(...args);
  };
}

import App from './App';

// Register background handler — runs as Headless JS (no React tree)
// Using getMessaging() instance method to avoid namespace deprecation warning
try {
    const messaging = getMessaging();
    messaging.setBackgroundMessageHandler(async remoteMessage => {
        // This runs when app is in background or killed.
        // Cannot update React state here — only pure logic.
        if (__DEV__) console.log('[BGHandler] Background message received:', remoteMessage.messageId);

        // Increment badge count on app icon
        try {
            const notifee = require('@notifee/react-native').default;
            const currentBadge = await notifee.getBadgeCount();
            await notifee.setBadgeCount(currentBadge + 1);
        } catch (e) {
            // Notifee not available
        }
    });
} catch (e) {
    // FCM not available (e.g., iOS simulator)
}

registerRootComponent(App);
