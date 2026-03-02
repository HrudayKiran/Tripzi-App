import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { useNetwork } from '../contexts/NetworkContext';
import { Ionicons } from '@expo/vector-icons';
import { SPACING, FONT_SIZE, FONT_WEIGHT } from '../styles';

const OfflineBanner: React.FC = () => {
    const { isConnected, isInternetReachable } = useNetwork();
    const [slideAnim] = useState(new Animated.Value(-60));
    const [visible, setVisible] = useState(false);

    const isOffline = isConnected === false || isInternetReachable === false;

    useEffect(() => {
        if (isOffline) {
            setVisible(true);
            Animated.spring(slideAnim, {
                toValue: 0,
                useNativeDriver: true,
                tension: 80,
                friction: 10,
            }).start();
        } else if (visible) {
            Animated.timing(slideAnim, {
                toValue: -60,
                duration: 300,
                useNativeDriver: true,
            }).start(() => setVisible(false));
        }
    }, [isOffline, slideAnim, visible]);

    if (!visible && !isOffline) return null;

    return (
        <Animated.View
            style={[
                styles.container,
                { transform: [{ translateY: slideAnim }] },
            ]}
        >
            <View style={styles.content}>
                <Ionicons name="cloud-offline-outline" size={18} color="#fff" />
                <Text style={styles.text}>No Internet Connection</Text>
            </View>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        backgroundColor: '#EF4444',
        paddingTop: 40,
        paddingBottom: SPACING.sm,
        zIndex: 9999,
    },
    content: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: SPACING.sm,
    },
    text: {
        color: '#fff',
        fontSize: FONT_SIZE.sm,
        fontWeight: FONT_WEIGHT.semibold,
    },
});

export default OfflineBanner;
