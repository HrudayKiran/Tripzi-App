import notifee, { AndroidImportance, AndroidVisibility } from '@notifee/react-native';

/**
 * Android Notification Channels — MUST be created before any notification is displayed.
 * Required for Android 8+ (API 26). Without these, notifications are silently dropped.
 *
 * Call this once on app startup (idempotent — safe to call multiple times).
 */
export async function createNotificationChannels(): Promise<void> {
  try {
    // Chat messages — high priority, sound + vibration
    await notifee.createChannel({
      id: 'chat_messages',
      name: 'Chat Messages',
      description: 'Messages from trip group chats and direct messages',
      importance: AndroidImportance.HIGH,
      visibility: AndroidVisibility.PRIVATE,
      sound: 'default',
      vibration: true,
      lights: true,
    });

    // Trip updates — default priority
    await notifee.createChannel({
      id: 'trip_updates',
      name: 'Trip Updates',
      description: 'Trip start reminders, itinerary changes, and member updates',
      importance: AndroidImportance.DEFAULT,
      visibility: AndroidVisibility.PUBLIC,
      sound: 'default',
      vibration: true,
    });

    // Reminders — default priority
    await notifee.createChannel({
      id: 'reminders',
      name: 'Reminders',
      description: 'Trip departure reminders and scheduled notifications',
      importance: AndroidImportance.DEFAULT,
      visibility: AndroidVisibility.PUBLIC,
      sound: 'default',
    });

    // System — low priority, silent
    await notifee.createChannel({
      id: 'system',
      name: 'System',
      description: 'Account updates, app updates, and system messages',
      importance: AndroidImportance.LOW,
      visibility: AndroidVisibility.PUBLIC,
      sound: undefined,
      vibration: false,
    });

    if (__DEV__) console.log('[Channels] Notification channels created successfully.');
  } catch (error: any) {
    console.error('[Channels] Failed to create notification channels:', error?.message || error);
  }
}

/**
 * Gets the badge count (unread notifications on app icon).
 */
export async function getBadgeCount(): Promise<number> {
  try {
    return await notifee.getBadgeCount();
  } catch {
    return 0;
  }
}

/**
 * Sets the badge count on the app icon.
 */
export async function setBadgeCount(count: number): Promise<void> {
  try {
    await notifee.setBadgeCount(Math.max(0, count));
  } catch (error: any) {
    if (__DEV__) console.error('[Badge] Failed to set badge count:', error?.message);
  }
}

/**
 * Increments the badge count by 1.
 */
export async function incrementBadgeCount(): Promise<void> {
  try {
    const current = await notifee.getBadgeCount();
    await notifee.setBadgeCount(current + 1);
  } catch (error: any) {
    if (__DEV__) console.error('[Badge] Failed to increment badge count:', error?.message);
  }
}

/**
 * Clears the badge count (set to 0).
 */
export async function clearBadgeCount(): Promise<void> {
  try {
    await notifee.setBadgeCount(0);
  } catch (error: any) {
    if (__DEV__) console.error('[Badge] Failed to clear badge count:', error?.message);
  }
}
