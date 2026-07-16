import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, useWindowDimensions } from 'react-native';
import LottieView from 'lottie-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MotiView, MotiText } from 'moti';
import { useTheme } from '../contexts/ThemeContext';
import { SPACING, BORDER_RADIUS, FONT_SIZE, BRAND, NEUTRAL } from '../styles';
import AppLogo from '../components/AppLogo';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';

import { useRouter } from 'expo-router';

// A beautiful animated travel illustration representing friends traveling.
const LOTTIE_HERO = 'https://lottie.host/2eea2965-86b8-44b7-883e-9a3146b3d919/dQobJzWoOR.lottie';

const WelcomeScreen = () => {
    const { colors } = useTheme();
    const router = useRouter();
    // Use useWindowDimensions for responsive live updates (handles foldables, rotation, etc.)
    const { width, height } = useWindowDimensions();

    // Scale logo and font sizes relative to screen height
    const isSmallScreen = height < 700;
    const isLargeScreen = height > 900;
    const logoSize = isSmallScreen ? 72 : isLargeScreen ? 104 : 96;
    const headlineFontSize = isSmallScreen ? 36 : isLargeScreen ? 52 : 46;
    const appNameFontSize = isSmallScreen ? 30 : isLargeScreen ? 44 : 38;

    const handleNext = () => {
        router.replace('/(auth)/start');
    };

    return (
        <View style={styles.container}>
            <StatusBar style="light" />
            {/* Background Lottie Animation */}
            <LottieView
                source={{ uri: LOTTIE_HERO }}
                style={[styles.lottieBackground, { top: height * 0.28 }]}
                autoPlay
                loop
                resizeMode="cover"
            />

            {/* Gradient Overlay for Readability */}
            <LinearGradient
                colors={['rgba(0,0,0,0.2)', 'rgba(0,0,0,0.6)', 'rgba(0,0,0,0.9)']}
                style={StyleSheet.absoluteFillObject}
            />

            <SafeAreaView style={styles.safeArea}>
                <View style={styles.content}>

                    {/* Top Section - Logo */}
                    <MotiView
                        from={{ opacity: 0, translateY: -20 }}
                        animate={{ opacity: 1, translateY: 0 }}
                        transition={{ type: 'timing', duration: 1000 }}
                        style={[styles.topSection, { marginTop: height * 0.04 }]}
                    >
                        <AppLogo size={logoSize} showDot={false} />
                        <Text style={[styles.appName, { fontSize: appNameFontSize }]}>NxtVibes</Text>
                    </MotiView>

                    {/* Middle Section - Value Proposition */}
                    <View style={styles.middleSection}>
                        <MotiText
                            from={{ opacity: 0, translateY: 20 }}
                            animate={{ opacity: 1, translateY: 0 }}
                            transition={{ type: 'timing', duration: 800, delay: 400 }}
                            style={styles.tagline}
                        >
                            THE TRAVEL SOCIAL APP
                        </MotiText>

                        <MotiText
                            from={{ opacity: 0, translateY: 20 }}
                            animate={{ opacity: 1, translateY: 0 }}
                            transition={{ type: 'timing', duration: 800, delay: 600 }}
                            style={[styles.headline, { fontSize: headlineFontSize, lineHeight: headlineFontSize * 1.1 }]}
                        >
                            Connect.{'\n'}Plan.{'\n'}Travel.
                        </MotiText>

                        <MotiText
                            from={{ opacity: 0, translateY: 20 }}
                            animate={{ opacity: 1, translateY: 0 }}
                            transition={{ type: 'timing', duration: 800, delay: 800 }}
                            style={[styles.description, { fontSize: isSmallScreen ? FONT_SIZE.sm : FONT_SIZE.md }]}
                        >
                            Chat with travel buddies, plan group itineraries, and explore the world together. Your next adventure starts here.
                        </MotiText>
                    </View>

                    {/* Bottom Section - Button */}
                    <MotiView
                        from={{ opacity: 0, translateY: 20 }}
                        animate={{ opacity: 1, translateY: 0 }}
                        transition={{ type: 'timing', duration: 800, delay: 1000 }}
                        style={styles.buttonSection}
                    >
                        <TouchableOpacity
                            style={[styles.button, { backgroundColor: colors.primary }]}
                            onPress={handleNext}
                            activeOpacity={0.8}
                            accessibilityLabel="Join the Journey — get started with NxtVibes"
                            accessibilityRole="button"
                        >
                            <Text style={styles.buttonText}>Join the Journey</Text>
                        </TouchableOpacity>
                    </MotiView>
                </View>
            </SafeAreaView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000' },
    lottieBackground: {
        position: 'absolute',
        // top is set dynamically based on height
        bottom: 0,
        left: 0,
        right: 0,
    },
    safeArea: { flex: 1 },
    content: {
        flex: 1,
        justifyContent: 'space-between',
        paddingHorizontal: SPACING.xl,
        paddingTop: SPACING.md,
        paddingBottom: SPACING.xl,
    },
    topSection: {
        alignItems: 'center',
    },
    appName: {
        fontWeight: '800',
        color: NEUTRAL.white,
        marginTop: SPACING.md,
        letterSpacing: 1,
    },
    middleSection: {
        flex: 1,
        justifyContent: 'flex-end',
        paddingBottom: SPACING.lg,
    },
    tagline: {
        fontSize: FONT_SIZE.xs,
        fontWeight: '700',
        color: '#d0bdfb', // Primary light variant
        letterSpacing: 3,
        textTransform: 'uppercase',
        marginBottom: SPACING.md,
    },
    headline: {
        fontWeight: '900',
        color: NEUTRAL.white,
        marginBottom: SPACING.lg,
    },
    description: {
        color: 'rgba(255, 255, 255, 0.85)',
        lineHeight: 24,
        fontWeight: '500',
    },
    buttonSection: {
        width: '100%',
    },
    button: {
        width: '100%',
        paddingVertical: SPACING.lg,
        borderRadius: BORDER_RADIUS.xl,
        alignItems: 'center',
        justifyContent: 'center',
    },
    buttonText: {
        color: NEUTRAL.white,
        fontSize: FONT_SIZE.lg,
        fontWeight: 'bold',
        letterSpacing: 0.5,
    },
});

export default WelcomeScreen;
