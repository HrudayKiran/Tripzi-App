import { getMessaging } from '@react-native-firebase/messaging';
import { Platform, PermissionsAndroid } from 'react-native';
import { workersApi } from '../lib/workersApi';

/**
 * Central notification service.
 * Manages FCM token lifecycle, foreground notifications, and deep linking.
 *
 * Permission strategy:
 * - Android 12 and below: Notifications auto-granted, no dialog needed
 * - Android 13+ (API 33+): Uses PermissionsAndroid.request(POST_NOTIFICATIONS)
 *   which shows the native system dialog. Firebase's requestPermission() alone
 *   does NOT reliably trigger the dialog on Android 13+.
 */

// ─── Permission Helpers ──────────────────────────────────────────────

/**
 * Check if notification permission is currently granted.
 */
async function isNotificationPermissionGranted(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;

  // Android 13+ (API 33) requires runtime POST_NOTIFICATIONS permission
  if (Platform.Version >= 33) {
    const status = await PermissionsAndroid.check(
      PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
    );
    return status;
  }

  // Android 12 and below: notifications auto-granted
  return true;
}

/**
 * Request notification permission using the native Android dialog.
 * Returns true if permission was granted, false otherwise.
 *
 * On Android 12 and below, returns true immediately (auto-granted).
 * On Android 13+, shows the native POST_NOTIFICATIONS system dialog.
 *
 * This is the function you should call from a dedicated
 * "Enable Notifications" prompt screen.
 */
export async function requestNotificationPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;

  // Android 12 and below: auto-granted
  if (Platform.Version < 33) {
    if (__DEV__) console.log('[Notifications] Android <13, permission auto-granted.');
    return true;
  }

  // Already granted?
  const alreadyGranted = await PermissionsAndroid.check(
    PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
  );
  if (alreadyGranted) {
    if (__DEV__) console.log('[Notifications] POST_NOTIFICATIONS already granted.');
    return true;
  }

  // Show the native system dialog
  if (__DEV__) console.log('[Notifications] Requesting POST_NOTIFICATIONS via native dialog...');
  try {
    const result = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
    );
    const granted = result === PermissionsAndroid.RESULTS.GRANTED;
    if (__DEV__) console.log(`[Notifications] POST_NOTIFICATIONS result: ${result} (granted: ${granted})`);
    return granted;
  } catch (err) {
    console.error('[Notifications] Error requesting POST_NOTIFICATIONS:', err);
    return false;
  }
}

// ─── Token Registration ─────────────────────────────────────────────

/**
 * Gets the FCM token and registers it with our backend.
 * Call this after successful login / auth state change to SIGNED_IN.
 *
 * 1. Checks notification permission (requests if needed on Android 13+)
 * 2. Gets FCM token from Firebase
 * 3. Registers token with Workers backend
 * 4. Updates profiles.push_notifications_enabled in Supabase
 */
export async function registerPushToken(): Promise<void> {
  try {
    // Step 1: Check/request notification permission using native Android API
    const permissionGranted = await requestNotificationPermission();

    if (!permissionGranted) {
      if (__DEV__) console.log('[Notifications] Permission denied, skipping token registration.');

      // Update profile to reflect denied status
      try {
        const { supabase } = require('../lib/supabase');
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          await supabase.from('profiles').update({
            push_notifications_enabled: false,
          }).eq('id', session.user.id);
        }
      } catch {}

      return;
    }

    // Step 2: Get FCM token
    const messaging = getMessaging();
    const token = await messaging.getToken();
    if (!token) {
      if (__DEV__) console.log('[Notifications] No FCM token available.');
      return;
    }

    if (__DEV__) console.log('[Notifications] FCM token obtained, registering with server...');

    // Step 3: Register with backend
    await workersApi('/account/push-token', {
      method: 'POST',
      body: {
        token,
        deviceInfo: `${Platform.OS} ${Platform.Version}`,
      },
    });

    // Step 4: Update profile to reflect enabled notifications
    try {
      const { supabase } = require('../lib/supabase');
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        await supabase.from('profiles').update({
          push_notifications_enabled: true,
        }).eq('id', session.user.id);
      }
    } catch {}

    if (__DEV__) console.log('[Notifications] Push token registered successfully.');
  } catch (error: any) {
    console.error('[Notifications] Failed to register push token:', error?.message || error);
  }
}

/**
 * Removes the FCM token from our backend.
 * Call this BEFORE signOut() on logout.
 */
export async function unregisterPushToken(): Promise<void> {
  try {
    const messaging = getMessaging();
    const token = await messaging.getToken();

    if (!token) return;

    if (__DEV__) console.log('[Notifications] Unregistering push token...');

    await workersApi('/account/push-token', {
      method: 'DELETE',
      body: { token },
    });

    if (__DEV__) console.log('[Notifications] Push token unregistered.');
  } catch (error: any) {
    // Don't block logout if this fails
    console.error('[Notifications] Failed to unregister push token:', error?.message || error);
  }
}

// ─── Token Refresh Listener ──────────────────────────────────────────

/**
 * Sets up a listener for FCM token rotation.
 * Returns an unsubscribe function.
 */
export function setupTokenRefreshListener(): () => void {
  const messaging = getMessaging();

  const unsubscribe = messaging.onTokenRefresh(async (newToken: string) => {
    if (__DEV__) console.log('[Notifications] Token refreshed, re-registering...');

    // Only re-register if user is authenticated (token refresh fires on startup before auth is ready)
    try {
      const { supabase } = require('../lib/supabase');
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        if (__DEV__) console.log('[Notifications] Skipping token re-registration — not authenticated yet.');
        return;
      }

      await workersApi('/account/push-token', {
        method: 'POST',
        body: {
          token: newToken,
          deviceInfo: `${Platform.OS} ${Platform.Version}`,
        },
      });
    } catch (error: any) {
      console.error('[Notifications] Failed to re-register refreshed token:', error?.message || error);
    }
  });

  return unsubscribe;
}

// ─── Foreground Message Handler ──────────────────────────────────────

/**
 * Sets up the foreground message listener.
 * When a push arrives while the app is open, show an in-app toast.
 * Returns an unsubscribe function.
 */
export function setupForegroundHandler(
  showToast: (title: string, message: string, route?: string, params?: Record<string, any>) => void
): () => void {
  const messaging = getMessaging();

  const unsubscribe = messaging.onMessage(async (remoteMessage) => {
    if (__DEV__) console.log('[Notifications] Foreground message received:', remoteMessage.messageId);

    const title = remoteMessage.notification?.title || 'New Notification';
    const body = remoteMessage.notification?.body || '';

    // Parse deep link data from push for tap-to-navigate
    const data = remoteMessage.data as Record<string, string> | undefined;
    let route: string | undefined;
    let params: Record<string, any> | undefined;
    if (data?.deepLinkRoute) {
      route = data.deepLinkRoute;
      if (data.deepLinkParams) {
        try { params = JSON.parse(data.deepLinkParams); } catch {}
      }
    }

    // Skip notification banner if user is already viewing the same chat
    const { useActiveChatStore } = require('../store/activeChatStore');
    const activeChatId = useActiveChatStore.getState().activeChatId;
    if (activeChatId && params?.chatId && activeChatId === params.chatId) {
      if (__DEV__) console.log('[Notifications] Skipping banner — user is in the same chat:', activeChatId);
      return; // Don't show toast or system notification
    }

    // Haptic feedback when notification arrives
    try {
      const Haptics = require('expo-haptics');
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      // expo-haptics not available or failed
    }

    // Show in-app toast via Zustand store (with deep link for tap navigation)
    showToast(title, body, route, params);

    // Also show system notification via Notifee (appears in notification shade)
    try {
      const notifee = require('@notifee/react-native').default;
      await notifee.displayNotification({
        title,
        body,
        data: data || {},
        android: {
          channelId: data?.channelId || 'chat_messages',
          smallIcon: 'ic_launcher',
          pressAction: { id: 'default' },
        },
      });
    } catch (e: any) {
      if (__DEV__) console.error('[Notifications] Notifee display error:', e?.message);
    }
  });

  return unsubscribe;
}

// ─── Notification Tap Handlers ───────────────────────────────────────

export interface NotificationNavigation {
  route: string;
  params?: Record<string, any>;
}

/**
 * Parses deep link data from a remote message's data payload.
 */
export function parseNotificationNavigation(
  data: Record<string, string> | undefined
): NotificationNavigation | null {
  if (!data?.deepLinkRoute) return null;

  let params: Record<string, any> | undefined;
  if (data.deepLinkParams) {
    try {
      params = JSON.parse(data.deepLinkParams);
    } catch {
      // Invalid JSON in params — ignore
    }
  }

  return { route: data.deepLinkRoute, params };
}

/**
 * Sets up handler for when user taps a notification while app is in background.
 * Returns an unsubscribe function.
 */
export function setupNotificationTapHandler(
  navigate: (route: string, params?: Record<string, any>) => void
): () => void {
  const messaging = getMessaging();

  const unsubscribe = messaging.onNotificationOpenedApp((remoteMessage) => {
    if (__DEV__) console.log('[Notifications] Notification tapped (background):', remoteMessage.messageId);

    const nav = parseNotificationNavigation(remoteMessage.data as Record<string, string>);
    if (nav) {
      navigate(nav.route, nav.params);
    }
  });

  return unsubscribe;
}

/**
 * Checks if the app was opened from a killed state by tapping a notification.
 * Call this once on app startup.
 */
export async function handleInitialNotification(
  navigate: (route: string, params?: Record<string, any>) => void
): Promise<void> {
  try {
    const messaging = getMessaging();
    const remoteMessage = await messaging.getInitialNotification();

    if (remoteMessage) {
      if (__DEV__) console.log('[Notifications] App opened from killed state via notification:', remoteMessage.messageId);

      const nav = parseNotificationNavigation(remoteMessage.data as Record<string, string>);
      if (nav) {
        // Small delay to let the navigation tree mount
        setTimeout(() => navigate(nav.route, nav.params), 1000);
      }
    }
  } catch (error: any) {
    console.error('[Notifications] Error handling initial notification:', error?.message || error);
  }
}

// ─── Phase 7: Local Scheduled Notifications ─────────────────────────

/**
 * Schedule a trip reminder notification 1 day before departure.
 * Uses Notifee's trigger notification with a timestamp.
 */
export async function scheduleTripReminder(
  tripId: string,
  tripTitle: string,
  departureDate: Date
): Promise<string | null> {
  try {
    const notifee = require('@notifee/react-native').default;
    const { TriggerType } = require('@notifee/react-native');

    // Schedule for 9 AM the day before departure
    const reminderDate = new Date(departureDate);
    reminderDate.setDate(reminderDate.getDate() - 1);
    reminderDate.setHours(9, 0, 0, 0);

    // Don't schedule if the reminder time has already passed
    if (reminderDate.getTime() <= Date.now()) {
      if (__DEV__) console.log('[Notifications] Skipping reminder — departure is today or in the past');
      return null;
    }

    const notificationId = await notifee.createTriggerNotification(
      {
        id: `trip-reminder-${tripId}`,
        title: '✈️ Trip Tomorrow!',
        body: `"${tripTitle}" starts tomorrow. Pack your bags and get ready!`,
        data: {
          deepLinkRoute: '/trip/itinerary-view',
          deepLinkParams: JSON.stringify({ id: tripId }),
        },
        android: {
          channelId: 'reminders',
          smallIcon: 'ic_launcher',
          pressAction: { id: 'default' },
        },
      },
      {
        type: TriggerType.TIMESTAMP,
        timestamp: reminderDate.getTime(),
      }
    );

    if (__DEV__) console.log(`[Notifications] Trip reminder scheduled for ${reminderDate.toISOString()}`);
    return notificationId;
  } catch (error: any) {
    console.error('[Notifications] Failed to schedule trip reminder:', error?.message || error);
    return null;
  }
}

/**
 * Cancel a previously scheduled trip reminder.
 */
export async function cancelTripReminder(tripId: string): Promise<void> {
  try {
    const notifee = require('@notifee/react-native').default;
    await notifee.cancelNotification(`trip-reminder-${tripId}`);
    if (__DEV__) console.log(`[Notifications] Cancelled trip reminder for ${tripId}`);
  } catch (error: any) {
    if (__DEV__) console.error('[Notifications] Failed to cancel trip reminder:', error?.message);
  }
}

/**
 * Cancel all scheduled notifications (useful on logout).
 */
export async function cancelAllScheduledNotifications(): Promise<void> {
  try {
    const notifee = require('@notifee/react-native').default;
    await notifee.cancelAllNotifications();
    if (__DEV__) console.log('[Notifications] All scheduled notifications cancelled');
  } catch (error: any) {
    if (__DEV__) console.error('[Notifications] Failed to cancel all notifications:', error?.message);
  }
}
