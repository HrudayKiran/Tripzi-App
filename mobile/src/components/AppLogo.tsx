import React from 'react';
import { View, StyleSheet, ViewStyle, Platform } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

interface AppLogoProps {
    size?: number;
    style?: ViewStyle;
    showDot?: boolean;
    showGlow?: boolean; // New prop for the splash screen glow effect
}

const AppLogo = ({ size = 80, style, showDot = true, showGlow = false }: AppLogoProps) => {
    // HTML uses rounded-3xl for 112px (h-28). 1.5rem = 24px. 24/112 ~= 0.21
    const borderRadius = size * 0.22;
    const iconSize = size * 0.57; // 64px icon in 112px box -> 0.57

    return (
        <View style={[styles.container, { width: size, height: size }, style]}>
            {/* Outer Ring Glow (Splash only) */}
            {showGlow && (
                <View style={[
                    styles.glowRing,
                    {
                        borderRadius: 999, // rounded-full
                        transform: [{ scale: 1.1 }],
                    }
                ]} />
            )}

            {/* Icon Circle (The Box) */}
            <LinearGradient
                colors={['#FFFFFF', '#F0EBFF']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[
                    styles.logoBox,
                    {
                        borderRadius,
                        width: size,
                        height: size,
                        // shadow-[0_20px_50px_rgba(0,0,0,0.15)]
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 20 },
                        shadowOpacity: 0.15,
                        shadowRadius: 25, // Android limitation approximation
                        elevation: 10,
                    }
                ]}
            >
                <MaterialIcons
                    name="flight-takeoff"
                    size={iconSize}
                    color="#895af6"
                />
            </LinearGradient>

            {/* Decorative Location Dot (Yellow Badge) */}
            {showDot && (
                <View style={[
                    styles.badge,
                    {
                        width: size * 0.22, // 24px/112px approx 0.21
                        height: size * 0.22,
                        borderRadius: (size * 0.22) / 2,
                        top: -size * 0.05, // -top-2 (8px) / 112px approx 0.07. Reduced slightly
                        right: -size * 0.05,
                    }
                ]}>
                    {/* Ring effect simulated with border on the badge container or extra view */}
                    {/* HTML: ring-4 ring-white/30. In RN, we can use a wrapper or border.
                        Since it overlaps the background, borderColor with opacity works if background is solid.
                        But here background is complex.
                        Best to use a wrapper for the ring.
                    */}
                    <View style={[
                        styles.badgeRing,
                        {
                            borderRadius: 999,
                            padding: size * 0.04, // ring width
                            backgroundColor: 'rgba(255,255,255,0.3)', // Ring color
                        }
                    ]}>
                        <View style={[
                            styles.badgeInner,
                            {
                                backgroundColor: '#facc15', // Yellow
                                width: '100%',
                                height: '100%',
                                borderRadius: 999,
                                justifyContent: 'center',
                                alignItems: 'center'
                            }
                        ]}>
                            <View style={{
                                width: size * 0.07, // 8px / 24px = 0.33 of badge size -> 0.07 of full size
                                height: size * 0.07,
                                borderRadius: 999,
                                backgroundColor: '#FFFFFF',
                            }} />
                        </View>
                    </View>
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'relative',
        alignItems: 'center',
        justifyContent: 'center',
        // Important: visible overflow for shadows/glow/badge to pop out
        overflow: 'visible',
    },
    glowRing: {
        position: 'absolute',
        inset: 0,
        backgroundColor: 'rgba(255,255,255,0.2)', // white/20
        width: '100%',
        height: '100%',
        // Blur is hard in RN views without specialized libs.
        // We can simulate with opacity or assume the shadow of the main box handles 'glow'.
        // Or if 'blur-md' is critical, we just use low opacity.
    },
    logoBox: {
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#fff',
    },
    badge: {
        position: 'absolute',
        justifyContent: 'center',
        alignItems: 'center',
    },
    badgeRing: {
        width: '130%', // Make it bigger than the inner badge to simulate ring
        height: '130%',
        justifyContent: 'center',
        alignItems: 'center',
        // Blur backdrop? 'backdrop-blur-sm'
    },
    badgeInner: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    }
});

export default AppLogo;
