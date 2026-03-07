import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Easing, Platform, Dimensions } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

interface TripziAnimatedLogoProps {
    size?: number;
    showGlow?: boolean;
}

const TripziAnimatedLogo = ({ size = 80, showGlow = false }: TripziAnimatedLogoProps) => {
    const borderRadius = size * 0.22;
    const iconSize = size * 0.57;

    const progress = useRef(new Animated.Value(0)).current;

    const startAnimation = () => {
        progress.setValue(0);
        Animated.timing(progress, {
            toValue: 100,
            duration: 6000,
            easing: Easing.linear,
            useNativeDriver: false,
        }).start(({ finished }) => {
            if (finished) {
                setTimeout(() => {
                    startAnimation();
                }, 4000);
            }
        });
    };

    useEffect(() => {
        startAnimation();
        return () => {
            progress.stopAnimation();
        };
    }, []);

    const boxWidth = progress.interpolate({
        inputRange: [0, 10, 20, 85, 95, 100],
        outputRange: [size, size, size * 3.6, size * 3.6, size, size],
    });

    const spreadWidth = size * 2.5;
    const stepX = spreadWidth / 8;
    const startX = -spreadWidth / 5;

    const xT = startX;
    const xr = startX + stepX * 1;
    const xi = startX + stepX * 2;
    const xp = startX + stepX * 3;
    const xz = startX + stepX * 4;
    const xi2 = startX + stepX * 5;

    // --- Typographic Standards ---
    const stemThickness = iconSize * 0.12;
    const stemHeight = iconSize * 0.75;
    const sharedDotY = -size * 0.25;

    // 1. 'T' - Plane rotated to exactly 200deg
    const plane1X = progress.interpolate({
        inputRange: [0, 10, 20, 85, 95, 100],
        outputRange: [0, 0, xT, xT, 0, 0],
    });
    const plane1Y = progress.interpolate({
        inputRange: [0, 10, 20, 85, 95, 100],
        outputRange: [0, 0, -iconSize * 0.1, -iconSize * 0.1, 0, 0],
    });
    const plane1Rot = progress.interpolate({
        inputRange: [0, 10, 20, 85, 95, 100],
        outputRange: ['0deg', '0deg', '200deg', '200deg', '0deg', '0deg'],
    });

    // 2. 'r' - Plane rotated to exactly 90deg
    const plane2Opacity = progress.interpolate({
        inputRange: [0, 15, 25, 85, 95, 100],
        outputRange: [0, 0, 1, 1, 0, 0],
    });
    const plane2X = progress.interpolate({
        inputRange: [0, 100],
        outputRange: [xr, xr],
    });
    const plane2Y = progress.interpolate({
        inputRange: [0, 100],
        outputRange: [iconSize * 0.15, iconSize * 0.15],
    });
    const plane2Rot = progress.interpolate({
        inputRange: [0, 100],
        outputRange: ['90deg', '90deg'],
    });
    const plane2Scale = progress.interpolate({
        inputRange: [0, 100],
        outputRange: [0.85, 0.85],
    });

    // 3. 'i' - First Bar + Original Dot
    const bar1Opacity = progress.interpolate({
        inputRange: [0, 20, 30, 85, 95, 100],
        outputRange: [0, 0, 1, 1, 0, 0],
    });
    const bar1X = progress.interpolate({
        inputRange: [0, 20, 30, 40, 85, 95, 100],
        outputRange: [0, 0, xi, xi, xi, 0, 0],
    });
    const bar1Y = progress.interpolate({
        inputRange: [0, 20, 30, 40, 85, 95, 100],
        // Starts hidden underneath plane, moves perfectly to Y=0 to match other stems
        outputRange: [iconSize * 0.35, iconSize * 0.35, iconSize * 0.35, 0, 0, iconSize * 0.35, iconSize * 0.35],
    });
    const bar1Rot = progress.interpolate({
        inputRange: [0, 20, 30, 40, 85, 95, 100],
        outputRange: ['0deg', '0deg', '0deg', '-90deg', '-90deg', '0deg', '0deg'],
    });

    // Dot tracks from top right to position exactly matching second 'i'
    const dotStartX = size * 0.44;
    const dotStartY = -size * 0.44;
    const dot1X = progress.interpolate({
        inputRange: [0, 30, 40, 85, 95, 100],
        outputRange: [dotStartX, dotStartX, xi, xi, dotStartX, dotStartX],
    });
    const dot1Y = progress.interpolate({
        inputRange: [0, 30, 40, 85, 95, 100],
        outputRange: [dotStartY, dotStartY, sharedDotY, sharedDotY, dotStartY, dotStartY],
    });

    // 4. 'p' - Bar + Oval
    const pOpacity = progress.interpolate({
        inputRange: [0, 40, 50, 85, 95, 100],
        outputRange: [0, 0, 1, 1, 0, 0],
    });

    // 5. 'z' - 3 bars
    const zOpacity = progress.interpolate({
        inputRange: [0, 50, 60, 85, 95, 100],
        outputRange: [0, 0, 1, 1, 0, 0],
    });

    // 6. 'i' - Second Bar + Dot
    const i2Opacity = progress.interpolate({
        inputRange: [0, 60, 70, 85, 95, 100],
        outputRange: [0, 0, 1, 1, 0, 0],
    });

    return (
        <View style={[styles.container, { width: size, height: size }]}>
            {showGlow && (
                <View style={[
                    styles.glowRing,
                    {
                        borderRadius: 999,
                        transform: [{ scale: 1.1 }],
                    }
                ]} />
            )}

            <Animated.View style={[
                styles.logoBoxWrapper,
                {
                    width: boxWidth,
                    height: size,
                    borderRadius,
                }
            ]}>
                <LinearGradient
                    colors={['#FFFFFF', '#F0EBFF']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={StyleSheet.absoluteFillObject}
                />
            </Animated.View>

            {/* Stage: Use exact center (alignItems/justifyContent) as origin for all offsets */}
            <View style={{ position: 'absolute', alignItems: 'center', justifyContent: 'center' }}>

                {/* 1. T - Base Plane rotated to 160deg */}
                <Animated.View style={{ position: 'absolute', transform: [{ translateX: plane1X }, { translateY: plane1Y }, { rotate: plane1Rot }] }}>
                    <MaterialIcons name="flight-takeoff" size={iconSize} color="#895af6" />
                </Animated.View>

                {/* 2. r - Second Plane rotated to -100deg */}
                <Animated.View style={{ position: 'absolute', opacity: plane2Opacity, transform: [{ translateX: plane2X }, { translateY: plane2Y }, { rotate: plane2Rot }, { scale: plane2Scale }] }}>
                    <MaterialIcons name="flight-takeoff" size={iconSize} color="#895af6" />
                </Animated.View>

                {/* 3. i - Main Bar (Slides right, rotates perfectly vertical) */}
                <Animated.View style={{
                    position: 'absolute',
                    opacity: bar1Opacity,
                    transform: [{ translateX: bar1X }, { translateY: bar1Y }, { rotate: bar1Rot }],
                    // Starts horizontal: width is the tall dimension
                    width: stemHeight,
                    height: stemThickness,
                    backgroundColor: '#895af6',
                    borderRadius: 99
                }} />

                {/* Dot 1 */}
                <Animated.View style={{
                    position: 'absolute',
                    transform: [{ translateX: dot1X }, { translateY: dot1Y }],
                    width: size * 0.22,
                    height: size * 0.22,
                    justifyContent: 'center',
                    alignItems: 'center',
                }}>
                    <View style={[styles.badgeRing, { padding: size * 0.04, width: '130%', height: '130%' }]}>
                        <View style={styles.badgeInner}>
                            <View style={{ width: size * 0.07, height: size * 0.07, borderRadius: 999, backgroundColor: '#FFFFFF' }} />
                        </View>
                    </View>
                </Animated.View>

                {/* 4. p - Bar + Oval (Stem shares identical height/thickness to 'i', anchored at Y=0) */}
                <Animated.View style={{ position: 'absolute', opacity: pOpacity, transform: [{ translateX: xp }] }}>
                    <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                        <View style={{
                            width: stemThickness,
                            height: stemHeight,
                            backgroundColor: '#895af6',
                            borderRadius: 99
                        }} />
                        <View style={{
                            width: iconSize * 0.45,
                            height: iconSize * 0.5,
                            backgroundColor: '#facc15',
                            borderTopRightRadius: 99,
                            borderBottomRightRadius: 99,
                            marginLeft: -iconSize * 0.05,
                            borderWidth: 3,
                            borderColor: '#FFFFFF',
                            shadowColor: '#000',
                            shadowOffset: { width: 0, height: 2 },
                            shadowOpacity: 0.1,
                            shadowRadius: 2,
                            elevation: 2,
                        }} />
                    </View>
                </Animated.View>

                {/* 5. z - 3 Bars (Anchored at Y=0) */}
                <Animated.View style={{ position: 'absolute', opacity: zOpacity, transform: [{ translateX: xz }] }}>
                    <View style={{ width: iconSize * 0.55, height: iconSize * 0.6 }}>
                        <View style={{ position: 'absolute', top: 0, width: '100%', height: stemThickness, backgroundColor: '#895af6', borderRadius: 99 }} />
                        <View style={{ position: 'absolute', top: '45%', width: '110%', height: stemThickness, backgroundColor: '#895af6', borderRadius: 99, transform: [{ rotate: '-45deg' }], left: '-5%' }} />
                        <View style={{ position: 'absolute', bottom: 0, width: '100%', height: stemThickness, backgroundColor: '#895af6', borderRadius: 99 }} />
                    </View>
                </Animated.View>

                {/* 6. i - Second Bar and Dot */}
                <Animated.View style={{ position: 'absolute', opacity: i2Opacity, transform: [{ translateX: xi2 }] }}>
                    {/* STEM: Anchored exactly at center Y=0 like 'p' and the rotated first 'i' bar */}
                    <View style={{
                        position: 'absolute', width: stemThickness, height: stemHeight, backgroundColor: '#895af6', borderRadius: 99,
                        marginLeft: -stemThickness / 2, marginTop: -stemHeight / 2 // Force exact center anchor
                    }} />
                </Animated.View>

                {/* 6. Second Dot */}
                <Animated.View style={{
                    position: 'absolute',
                    opacity: i2Opacity,
                    transform: [{ translateX: xi2 }, { translateY: sharedDotY }],
                    width: size * 0.22,
                    height: size * 0.22,
                    justifyContent: 'center',
                    alignItems: 'center',
                }}>
                    <View style={[styles.badgeRing, { padding: size * 0.04, width: '130%', height: '130%' }]}>
                        <View style={styles.badgeInner}>
                            <View style={{ width: size * 0.07, height: size * 0.07, borderRadius: 999, backgroundColor: '#FFFFFF' }} />
                        </View>
                    </View>
                </Animated.View>

            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'relative',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'visible',
    },
    logoBoxWrapper: {
        position: 'absolute',
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 20 },
        shadowOpacity: 0.15,
        shadowRadius: 25,
        elevation: 10,
        backgroundColor: '#fff',
    },
    glowRing: {
        position: 'absolute',
        inset: 0,
        backgroundColor: 'rgba(255,255,255,0.2)',
        width: '100%',
        height: '100%',
    },
    badgeRing: {
        borderRadius: 999,
        backgroundColor: 'rgba(255,255,255,0.3)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    badgeInner: {
        backgroundColor: '#facc15',
        width: '100%',
        height: '100%',
        aspectRatio: 1,
        borderRadius: 999,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    }
});

export default TripziAnimatedLogo;
