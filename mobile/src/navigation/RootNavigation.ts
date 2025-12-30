/**
 * RootNavigation.ts
 * Provides navigation capabilities outside of React components
 * Used by usePushNotifications to navigate when notification is tapped
 */

import { createNavigationContainerRef, CommonActions } from '@react-navigation/native';

export const navigationRef = createNavigationContainerRef();

/**
 * Navigate to a screen from anywhere in the app
 */
export function navigate(name: string, params?: object) {
    if (navigationRef.isReady()) {
        navigationRef.dispatch(
            CommonActions.navigate({
                name,
                params,
            })
        );
    }
}

/**
 * Go back to previous screen
 */
export function goBack() {
    if (navigationRef.isReady() && navigationRef.canGoBack()) {
        navigationRef.goBack();
    }
}

/**
 * Reset navigation stack
 */
export function reset(state: any) {
    if (navigationRef.isReady()) {
        navigationRef.dispatch(CommonActions.reset(state));
    }
}
