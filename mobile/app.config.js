
const googleMapsApiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '';

module.exports = {
  expo: {
    name: 'NxtVibes',
    slug: 'mobile',
    version: '1.0.0',
    scheme: 'nxtvibes',
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'automatic',
    splash: {
      image: './assets/applogo.png',
      resizeMode: 'contain',
      backgroundColor: '#9d74f7',
    },
    extra: {
      eas: {
        projectId: '3070be5b-0bdf-464b-b994-81505f567054',
      },
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: 'com.nxtvibes.mobile',
      config: {
        googleMapsApiKey,
      },
    },
    android: {
      versionCode: 1,
      adaptiveIcon: {
        foregroundImage: './assets/icon.png',
        backgroundColor: '#9d74f7',
      },
      package: 'com.nxtvibes.mobile',
      googleServicesFile: './google-services.json',
      config: {
        googleMaps: {
          apiKey: googleMapsApiKey,
        },
      },
      intentFilters: [
        {
          action: 'VIEW',
          autoVerify: true,
          data: [
            {
              scheme: 'https',
              host: 'hypermatrix.vercel.app',
              pathPrefix: '/trip',
            },
            {
              scheme: 'https',
              host: 'hypermatrix.vercel.app',
              pathPrefix: '/user',
            },
          ],
          category: ['BROWSABLE', 'DEFAULT'],
        },
      ],
      permissions: [
        'android.permission.INTERNET',
        'android.permission.ACCESS_NETWORK_STATE',
        'android.permission.POST_NOTIFICATIONS',
        'android.permission.ACCESS_FINE_LOCATION',
        'android.permission.ACCESS_COARSE_LOCATION',
        'android.permission.CAMERA',
        'android.permission.READ_MEDIA_IMAGES',
        'android.permission.READ_MEDIA_VIDEO',
        'android.permission.RECEIVE_BOOT_COMPLETED',
        'android.permission.VIBRATE',
        'android.permission.WAKE_LOCK',
      ],
    },
    plugins: [
      'expo-router',
      'expo-image',
      '@react-native-firebase/app',

      '@react-native-firebase/messaging',
      '@react-native-firebase/app-check',
      '@react-native-firebase/crashlytics',
      '@react-native-firebase/perf',
      [
        'expo-build-properties',
        {
          android: {
            usesCleartextTraffic: false,
            minSdkVersion: 24,
            compileSdkVersion: 36,
            targetSdkVersion: 35,
            enableProguardInReleaseBuilds: true,
            enableShrinkResourcesInReleaseBuilds: true,
          },
        },
      ],
      [
        'expo-location',
        {
          locationAlwaysAndWhenInUsePermission: 'Allow NxtVibes to use your location for sharing and maps.',
        },
      ],
      [
        'expo-image-picker',
        {
          photosPermission: 'Allow NxtVibes to access your photos for sharing.',
          cameraPermission: 'Allow NxtVibes to use your camera to take photos.',
        },
      ],
      [
        'expo-media-library',
        {
          photosPermission: 'Allow NxtVibes to save photos and videos to your gallery.',
          savePhotosPermission: 'Allow NxtVibes to save photos to your gallery.',
          isAccessMediaLocationEnabled: true,
        },
      ],
      [
        '@morrowdigital/watermelondb-expo-plugin',
        {
          disableJsi: true,
        },
      ],
      '@react-native-community/datetimepicker',
      'expo-font',
    ],
  },
};
