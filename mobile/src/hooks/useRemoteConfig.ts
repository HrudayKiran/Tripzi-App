import { useEffect } from 'react';
import { Alert, Linking } from 'react-native';
import remoteConfig from '@react-native-firebase/remote-config';
import { compareVersions } from '../utils/version';

export const useRemoteConfig = (currentVersion: string) => {
    useEffect(() => {
        const initializeRemoteConfig = async () => {
            try {
                // Set default values
                await remoteConfig().setDefaults({
                    min_version: '1.0.0',
                    latest_version: '1.0.0',
                    store_url: 'market://details?id=com.tripzi.mobile',
                });

                // Fetch and activate config
                await remoteConfig().setConfigSettings({
                    minimumFetchIntervalMillis: __DEV__ ? 0 : 3600000, // 1 hour in prod
                });
                
                await remoteConfig().fetchAndActivate();

                const minVersion = remoteConfig().getString('min_version');
                const latestVersion = remoteConfig().getString('latest_version');
                const storeUrl = remoteConfig().getString('store_url');

                const isBelowMinVersion = compareVersions(currentVersion, minVersion) < 0;
                const isUpdateAvailable = compareVersions(currentVersion, latestVersion) < 0;

                if (isBelowMinVersion) {
                    Alert.alert(
                        'Update Required',
                        'Your app version is no longer supported. Please update to continue.',
                        [
                            {
                                text: 'Update Now',
                                onPress: () => Linking.openURL(storeUrl)
                            }
                        ],
                        { cancelable: false }
                    );
                    return;
                }

                if (isUpdateAvailable) {
                    Alert.alert(
                        'Update Available 🚀',
                        'A new version of Tripzi is available! Please update for the best experience.',
                        [
                            { text: 'Later', style: 'cancel' },
                            {
                                text: 'Update Now',
                                onPress: () => Linking.openURL(storeUrl)
                            }
                        ]
                    );
                }

            } catch (error) {
                console.error('Failed to initialize Firebase Remote Config:', error);
            }
        };

        initializeRemoteConfig();
    }, [currentVersion]);
};
