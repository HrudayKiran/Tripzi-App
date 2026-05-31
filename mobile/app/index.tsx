import React, { useEffect } from 'react';
import { Redirect } from 'expo-router';
import { hasSessionSync } from '../src/lib/supabase';
import * as SplashScreen from 'expo-splash-screen';

// Prevent the native splash screen from hiding automatically
SplashScreen.preventAutoHideAsync().catch(() => {});

export default function Index() {
  const hasSession = hasSessionSync();

  useEffect(() => {
    // Hide the splash screen immediately after rendering the Redirect component
    // since the target route will now be mounting.
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  if (hasSession) {
    return <Redirect href="/(tabs)" />;
  }

  return <Redirect href="/(auth)/launch" />;
}
