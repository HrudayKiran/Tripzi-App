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

// Register background handler
// Using getMessaging() instance method to avoid namespace deprecation warning
try {
    const messaging = getMessaging();
    messaging.setBackgroundMessageHandler(async remoteMessage => {

    });
} catch (e) {

}

registerRootComponent(App);
