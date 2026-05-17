import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Dimensions, Animated, Easing, StatusBar as RNStatusBar } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { supabase } from '../lib/supabase';
import AppLogo from '../components/AppLogo';
import { MotiView } from 'moti';
import { BRAND, NEUTRAL } from '../styles';

const { width, height } = Dimensions.get('window');

const MAP_PATTERN_URL = 'https://lh3.googleusercontent.com/aida-public/AB6AXuC2zQAHh1rkj2FOH71NZ5u5InNaK_bDbfoyy8O91U9Xmx-N7Qu3U5uuuQ386ncxJR4ZMfcZi2iglnw8Vqdn0-Q03VIJ0PK6sugqvEXcydEzxm1ulpMWGy1TwUT1RlTaUOhfBviPNgVlb_1sxRuF83KnmRjmtJFDQHj4gOSXjflVp27SQzE_Xm8m5r4kvyaGe2o-MucjQ5US4UfjqhIFXRIYfureKViEvplWqzhcJbeCbExN7KVaP8enyNUYXGu0PLp0gMNZ79-7WbA';

const LaunchScreen = () => {
  const router = useRouter();
  const progress = useRef(new Animated.Value(0)).current;
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;

    // Check session immediately
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session && isMountedRef.current) {
        // If logged in, go directly to home
        router.replace('/(tabs)');
      } else if (isMountedRef.current) {
        // If not logged in, show splash animation then go to welcome
        const anim = Animated.timing(progress, {
          toValue: 1,
          duration: 3500,
          useNativeDriver: false,
          easing: Easing.out(Easing.cubic),
        });

        anim.start(({ finished }) => {
          if (finished && isMountedRef.current) {
            router.replace('/(auth)/welcome');
          }
        });
      }
    });

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const widthInterpolation = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      {/* Main Gradient Background */}
      <LinearGradient
        // from-[#9d74f7] via-primary (#895af6) to-[#6d28d9]
        colors={[...BRAND.authGradient]}
        locations={[0, 0.5, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      >
        {/* Abstract Map Overlay */}




        {/* Top Spacer */}
        <View style={{ height: RNStatusBar.currentHeight || 48 }} />

        {/* Center Content */}
        <View style={styles.centerContent}>
          <MotiView
            from={{ opacity: 0, translateY: 20 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: 1000 }}
            style={styles.logoWrapper}
          >
            {/* Logo with Glow */}
            <AppLogo size={112} showDot={true} showGlow={true} />

            {/* Text */}
            <View style={styles.textContainer}>
              <Text style={styles.appName}>NxtVibes</Text>
              <Text style={styles.tagline}>CONNECT. PLAN. TRAVEL.</Text>
            </View>
          </MotiView>
        </View>

        {/* Bottom Section: Loader & Meta */}
        <View style={styles.bottomSection}>
          <View style={styles.progressBarTrack}>
            <Animated.View
              style={[
                styles.progressBarFill,
                { width: widthInterpolation }
              ]}
            />
          </View>
          <Text style={styles.versionText}>v1.0.0</Text>
        </View>

      </LinearGradient>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 64, // pb-16
  },
  mapOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0.1, // opacity-10
  },

  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 32, // gap-8
  },
  logoWrapper: {
    alignItems: 'center',
    gap: 32,
  },
  textContainer: {
    alignItems: 'center',
    gap: 8, // gap-2
    marginTop: 32,
  },
  appName: {
    fontSize: 48, // text-5xl
    fontWeight: '800', // font-extrabold
    color: NEUTRAL.white,
    letterSpacing: -1, // tracking-tight
    textShadowColor: 'rgba(0,0,0,0.1)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  tagline: {
    fontSize: 14, // text-sm
    fontWeight: '500', // font-medium
    color: 'rgba(255,255,255,0.8)', // text-white/80
    letterSpacing: 4.2, // tracking-[0.3em] -> 14 * 0.3 = 4.2
    textTransform: 'uppercase',
  },
  bottomSection: {
    width: '100%',
    alignItems: 'center',
    gap: 24, // gap-6
    paddingHorizontal: 48, // px-12
  },
  progressBarTrack: {
    width: '100%',
    maxWidth: 200,
    height: 6, // h-1.5
    backgroundColor: 'rgba(0,0,0,0.2)', // bg-black/20
    borderRadius: 999,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: NEUTRAL.white,
    borderRadius: 999,
    shadowColor: NEUTRAL.white,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
  },
  versionText: {
    fontSize: 12, // text-xs
    fontWeight: '400',
    color: 'rgba(255,255,255,0.4)', // text-white/40
  }
});

export default LaunchScreen;
