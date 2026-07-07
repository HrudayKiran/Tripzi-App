import analytics from '@react-native-firebase/analytics';

/**
 * Firebase Analytics wrapper.
 * All calls are no-ops in __DEV__ to keep debug logs clean and
 * avoid polluting production analytics with test data.
 *
 * Usage:
 *   import { logEvent, logScreenView, logLogin, logSignUp } from '../lib/analytics';
 *   await logLogin('email');
 *   await logScreenView('HomeScreen');
 *   await logEvent('trip_created', { method: 'manual' });
 */

/** Log a custom event. Parameters must be string | number | boolean. */
export const logEvent = async (
  name: string,
  params?: Record<string, string | number | boolean>
): Promise<void> => {
  if (__DEV__) return;
  try {
    await analytics().logEvent(name, params);
  } catch {
    // Analytics must never crash the app
  }
};

/** Log a screen view — call this on each major screen's useFocusEffect. */
export const logScreenView = async (screenName: string): Promise<void> => {
  if (__DEV__) return;
  try {
    await analytics().logScreenView({
      screen_name: screenName,
      screen_class: screenName,
    });
  } catch {}
};

/**
 * Log a login event.
 * @param method - 'email' | 'google'
 */
export const logLogin = async (method: 'email' | 'google'): Promise<void> => {
  if (__DEV__) return;
  try {
    await analytics().logLogin({ method });
  } catch {}
};

/**
 * Log a sign-up event.
 * @param method - 'email' | 'google'
 */
export const logSignUp = async (method: 'email' | 'google'): Promise<void> => {
  if (__DEV__) return;
  try {
    await analytics().logSignUp({ method });
  } catch {}
};

/** Log a logout event. */
export const logLogout = async (): Promise<void> => {
  if (__DEV__) return;
  try {
    await analytics().logEvent('logout');
  } catch {}
};

/** Log trip creation. */
export const logTripCreated = async (method: 'manual' | 'ai'): Promise<void> => {
  if (__DEV__) return;
  try {
    await analytics().logEvent('trip_created', { method });
  } catch {}
};

/** Set the Firebase Analytics user ID. Call this after successful sign-in. */
export const setAnalyticsUser = async (userId: string): Promise<void> => {
  if (__DEV__) return;
  try {
    await analytics().setUserId(userId);
  } catch {}
};

/** Clear the Firebase Analytics user ID. Call this on logout. */
export const clearAnalyticsUser = async (): Promise<void> => {
  if (__DEV__) return;
  try {
    await analytics().setUserId(null);
  } catch {}
};
