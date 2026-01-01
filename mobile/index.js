import 'react-native-gesture-handler';
import { registerRootComponent } from 'expo';
import { getMessaging } from '@react-native-firebase/messaging';

import App from './App';

// Register background handler
// Using getMessaging() instance method to avoid namespace deprecation warning
try {
    const messaging = getMessaging();
    messaging.setBackgroundMessageHandler(async remoteMessage => {
        console.log('Message handled in the background!', remoteMessage);
    });
} catch (e) {
    console.log('Failed to set background handler:', e);
}

registerRootComponent(App);
